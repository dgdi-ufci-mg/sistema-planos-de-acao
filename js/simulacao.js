/**
 * Simulação de Monte Carlo e indicadores por ação (documentação técnica, seções 5.7, 7 e 15).
 *
 * Em cada cenário, a duração de cada ação não concluída é sorteada da beta-PERT
 * da estimativa vigente; as regras do cálculo determinístico (js/calculo.js) valem
 * igualmente: duração real das concluídas, reestimativas contadas do dia em que
 * foram feitas, data mínima e "nada termina no passado".
 *
 * Reprodutível: a mesma semente, o mesmo número de simulações e a mesma versão
 * do cálculo dão sempre o mesmo resultado (a ordem dos sorteios está na seção 15.6).
 * Funções puras: não acessam a tela nem o banco.
 */
import { ordenarPorDependencia, estimativaVigente } from "./calculo.js";

/**
 * Versão do método de cálculo, guardada em cada retrato (seção 5.7).
 * Aumente-a sempre que uma mudança fizer a mesma semente dar outro resultado.
 */
export const VERSAO_CALCULO = 1;

/** Gerador de números pseudoaleatórios mulberry32: devolve números em [0, 1). */
export function mulberry32(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal padrão, pelo método de Box-Muller (um par de sorteios por valor). */
function normal(aleatorio) {
  let u = 0, v = 0;
  while (u === 0) u = aleatorio();
  while (v === 0) v = aleatorio();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gama(forma, 1), pelo método de Marsaglia e Tsang. */
function gama(forma, aleatorio) {
  if (forma < 1) return gama(1 + forma, aleatorio) * Math.pow(aleatorio(), 1 / forma);
  const d = forma - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = normal(aleatorio); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = aleatorio();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * Sorteio da beta-PERT: o + (p − o) · X, com X ~ Beta(α, β),
 * α = 1 + 4(m − o)/(p − o) e β = 1 + 4(p − m)/(p − o). Média: (o + 4m + p)/6.
 */
export function sortearBetaPert({ o, m, p }, aleatorio) {
  if (p <= o) return m;
  const alfa = 1 + (4 * (m - o)) / (p - o);
  const beta = 1 + (4 * (p - m)) / (p - o);
  const x = gama(alfa, aleatorio), y = gama(beta, aleatorio);
  return o + ((p - o) * x) / (x + y);
}

/** Valor na posição do quantil q (posição mais próxima, para cima). */
const quantil = (ordenados, q) => ordenados[Math.min(ordenados.length - 1, Math.max(0, Math.ceil(q * ordenados.length) - 1))];

/**
 * Simula o espaço.
 * @param {object[]} acoes ações do espaço (dicionário de dados, 4.2)
 * @param {ReturnType<import("./calendario.js").criarCalendario>} calendario
 * @param {{hoje: string, semente: number, simulacoes: number, prazoFinal?: string}} opcoes
 */
export function simular(acoes, calendario, { hoje, semente, simulacoes, prazoFinal }) {
  const { ordem, anteriores, seguintes } = ordenarPorDependencia(acoes);
  const n = ordem.length;
  const indice = new Map(ordem.map((c, i) => [c, i]));
  const porNumero = new Map(acoes.map((a) => [a.numero, a]));
  const idxHoje = calendario.diasUteisAntes(hoje);

  // dados fixos de cada ação, por posição na ordem de cálculo
  const ants = ordem.map((c) => anteriores.get(c).map((d) => indice.get(d)));
  const segs = ordem.map((c) => seguintes.get(c).map((s) => indice.get(s)));
  const conclusaoReal = new Float64Array(n).fill(NaN);
  const minimo = new Float64Array(n);
  const contaDoDia = new Float64Array(n).fill(NaN);
  const estimativa = new Array(n).fill(null);
  const liberada = new Uint8Array(n);
  ordem.forEach((c, i) => {
    const a = porNumero.get(c);
    if (a.concluidaEm) conclusaoReal[i] = calendario.diasUteisAte(a.concluidaEm);
    if (a.naoAntesDe) minimo[i] = calendario.diasUteisAntes(a.naoAntesDe);
    const v = estimativaVigente(a);
    estimativa[i] = v;
    if (v?.contaDe === "data") contaDoDia[i] = calendario.diasUteisAntes(v.em);
  });
  ordem.forEach((c, i) => {
    const a = porNumero.get(c);
    liberada[i] = !a.concluidaEm && ants[i].every((j) => !Number.isNaN(conclusaoReal[j]))
      && (!a.naoAntesDe || a.naoAntesDe <= hoje) ? 1 : 0;
  });

  const aleatorio = mulberry32(semente);
  const fins = new Float64Array(simulacoes);
  const criticas = new Float64Array(n);
  const soma = new Float64Array(n), soma2 = new Float64Array(n), somaDT = new Float64Array(n);
  let somaT = 0, somaT2 = 0;
  const lib = new Float64Array(n), con = new Float64Array(n), dur = new Float64Array(n), libTardia = new Float64Array(n);

  for (let k = 0; k < simulacoes; k++) {
    let fim = 0;
    for (let i = 0; i < n; i++) {
      let l = minimo[i];
      for (const j of ants[i]) if (con[j] > l) l = con[j];
      let c;
      if (!Number.isNaN(conclusaoReal[i])) {
        c = conclusaoReal[i];
        if (c < l) l = c;
        dur[i] = c - l;
      } else {
        const d = estimativa[i] ? sortearBetaPert(estimativa[i], aleatorio) : 0;
        dur[i] = d;
        c = Math.max(l, (Number.isNaN(contaDoDia[i]) ? l : contaDoDia[i]) + d);
        if (liberada[i] && c <= idxHoje) c = idxHoje + 1; // nada termina no passado (seção 5.5)
      }
      lib[i] = l; con[i] = c;
      if (c > fim) fim = c;
    }
    for (let i = n - 1; i >= 0; i--) {
      let lt = fim;
      for (const s of segs[i]) if (libTardia[s] < lt) lt = libTardia[s];
      libTardia[i] = lt - (con[i] - lib[i]);
      if (Number.isNaN(conclusaoReal[i]) && libTardia[i] - lib[i] < 1e-6) criticas[i]++;
    }
    const T = fim; // duração total, em dias úteis desde o início do espaço
    fins[k] = fim;
    somaT += T; somaT2 += T * T;
    for (let i = 0; i < n; i++) { soma[i] += dur[i]; soma2[i] += dur[i] * dur[i]; somaDT[i] += dur[i] * T; }
  }

  // contribuição para a variância (seção 15.3)
  const K = simulacoes;
  const varT = somaT2 / K - (somaT / K) ** 2;
  const parcela = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(conclusaoReal[i])) continue;
    const vari = soma2[i] / K - (soma[i] / K) ** 2;
    if (vari <= 1e-12 || varT <= 1e-12) continue;
    const r = (somaDT[i] / K - (soma[i] / K) * (somaT / K)) / Math.sqrt(vari * varT);
    parcela[i] = Math.max(r, 0) ** 2;
  }
  const total = parcela.reduce((a, b) => a + b, 0);

  const porAcao = new Map(ordem.map((c, i) => [c, {
    prioridadeExecucao: criticas[i] / K,
    prioridadeRevisao: total > 0 ? parcela[i] / total : 0,
  }]));

  const ordenados = Float64Array.from(fins).sort();
  const limite = prazoFinal ? calendario.diasUteisAte(prazoFinal) : null;
  return {
    versaoCalculo: VERSAO_CALCULO, semente, simulacoes,
    p50: quantil(ordenados, 0.5), p80: quantil(ordenados, 0.8), p95: quantil(ordenados, 0.95),
    chancePrazo: limite == null ? null : fins.filter((f) => f <= limite + 1e-9).length / K,
    fins, porAcao,
  };
}

/**
 * Chave da simulação (22/10/2026, teste de velocidade com planos grandes): junta só o que muda o
 * resultado. Duas chaves iguais dão exatamente a mesma simulação; por isso a tela pode reaproveitar
 * o resultado anterior quando muda só o nome, a descrição, os responsáveis ou as notas de uma ação.
 * @param {object[]} acoes
 * @param {{hoje: string, semente: number, simulacoes: number, prazoFinal?: string, inicio: string, datasExcluidas: {data: string}[]}} opcoes
 */
export function chaveDaSimulacao(acoes, { hoje, semente, simulacoes, prazoFinal, inicio, datasExcluidas }) {
  return JSON.stringify([
    VERSAO_CALCULO, hoje, semente, simulacoes, prazoFinal ?? null, inicio, (datasExcluidas ?? []).map((d) => d.data).sort(),
    acoes.map((a) => [a.numero, a.ordem ?? 0, a.dependeDe ?? [], estimativaVigente(a), a.concluidaEm ?? null, a.naoAntesDe ?? null]),
  ]);
}
