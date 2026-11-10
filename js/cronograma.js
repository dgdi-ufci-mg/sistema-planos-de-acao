/**
 * Cronograma do espaço (documentação técnica, seção 8.4; passo 1.17b): regras, sem tela.
 * Monta as linhas do cronograma (Gantt) a partir do caminho crítico: em que dia útil cada
 * ação começa e termina, se está no caminho crítico, a folga e as dependências.
 * Agrupa por fase e etapa quando o espaço as usa.
 * Desde 10/11/2026 (edição no cronograma): grupos recolhidos, encaixe do zoom na tela e a estimativa que faz a
 * ação terminar no dia em que a borda da barra foi solta.
 */
import { duracaoPert } from "./calculo.js";

/**
 * Barra de uma ação.
 * @param {object} acao
 * @param {object} c resultado do caminho crítico para a ação (calculo.js)
 * @param {object} cal calendário do espaço
 */
function barraDe(acao, c, cal) {
  const concluida = c.situacao === "concluida";
  const inicio = cal.data(c.liberacao);
  const fim = concluida ? acao.concluidaEm : cal.dataDeConclusao(c.conclusao, c.liberacao);
  return {
    numero: acao.numero,
    acao,
    inicio,
    /** último dia trabalhado (inclusive) */
    fim: fim < inicio ? inicio : fim,
    /** dias úteis de duração prevista (zero: sem estimativa) */
    duracao: Math.max(0, c.conclusao - c.liberacao),
    /** índice (em dias úteis, com fração) em que a ação é liberada: base da conta ao arrastar a borda */
    liberacao: c.liberacao,
    critica: Boolean(c.critica),
    folga: Math.max(0, Math.round(c.folga ?? 0)),
    situacao: c.situacao,
    atrasada: Boolean(c.atrasada),
    /** ação contínua (seção 5.9): barra própria, sem setas de dependência */
    continua: Boolean(c.continua),
    dependeDe: c.continua ? [] : acao.dependeDe ?? [],
  };
}

/**
 * @param {object[]} acoes ações ativas, na ordem do espaço
 * @param {{porAcao: Map}} caminho resultado de caminhoCritico
 * @param {object} cal calendário do espaço
 * @param {{estrutura?: object[], usaFases?: boolean, recolhidos?: Set<string>}} [opcoes]
 *   recolhidos: ids das fases e etapas recolhidas (10/11/2026); as linhas de dentro não entram, mas a linha do
 *   grupo continua, com `recolhido: true`, e as datas de resumo não mudam
 * @returns {{linhas: ({tipo: "grupo", nivel: "fase"|"etapa", id: string, nome: string, inicio: string|null, fim: string|null,
 *   recolhido: boolean, acoes: number}|{tipo: "acao", barra: object})[], inicio: string|null, fim: string|null}}
 */
export function montarCronograma(acoes, caminho, cal, { estrutura = [], usaFases = false, recolhidos = new Set() } = {}) {
  const barras = acoes.map((a) => barraDe(a, caminho.porAcao.get(a.numero), cal));
  /* as ações contínuas não entram nas datas dos grupos, como no cálculo dos marcos (seção 5.9); só um grupo apenas
     com contínuas usa as delas, para não ficar sem barra de resumo */
  const extremos = (todas) => {
    const comuns = todas.filter((b) => !b.continua);
    const bs = comuns.length ? comuns : todas;
    return bs.length
      ? { inicio: bs.map((b) => b.inicio).sort()[0], fim: bs.map((b) => b.fim).sort().at(-1) }
      : { inicio: null, fim: null };
  };
  const linhas = [];
  if (usaFases && estrutura.length) {
    const daEtapa = new Map();
    for (const b of barras) {
      if (!daEtapa.has(b.acao.etapa)) daEtapa.set(b.acao.etapa, []);
      daEtapa.get(b.acao.etapa).push(b);
    }
    const conhecidas = new Set();
    for (const fase of estrutura) {
      const daFase = fase.etapas.flatMap((e) => daEtapa.get(e.id) ?? []);
      if (!daFase.length) continue;
      const faseRecolhida = recolhidos.has(fase.id);
      linhas.push({ tipo: "grupo", nivel: "fase", id: fase.id, nome: fase.nome, recolhido: faseRecolhida, acoes: daFase.length, ...extremos(daFase) });
      for (const etapa of fase.etapas) {
        conhecidas.add(etapa.id);
        const bs = daEtapa.get(etapa.id) ?? [];
        if (!bs.length || faseRecolhida) continue;
        const etapaRecolhida = recolhidos.has(etapa.id);
        linhas.push({ tipo: "grupo", nivel: "etapa", id: etapa.id, nome: etapa.nome, recolhido: etapaRecolhida, acoes: bs.length, ...extremos(bs) });
        if (!etapaRecolhida) for (const b of bs) linhas.push({ tipo: "acao", barra: b });
      }
    }
    const soltas = barras.filter((b) => !conhecidas.has(b.acao.etapa));
    if (soltas.length) {
      const recolhida = recolhidos.has("sem-etapa");
      linhas.push({ tipo: "grupo", nivel: "fase", id: "sem-etapa", nome: "Sem fase nem etapa", recolhido: recolhida, acoes: soltas.length, ...extremos(soltas) });
      if (!recolhida) for (const b of soltas) linhas.push({ tipo: "acao", barra: b });
    }
  } else {
    for (const b of barras) linhas.push({ tipo: "acao", barra: b });
  }
  return { linhas, ...extremos(barras) };
}

/**
 * Zoom que faz o cronograma inteiro caber na largura disponível ("Ver tudo", 10/11/2026): pixels por dia de
 * calendário, entre 1 e 40, com duas casas.
 * @param {number} dias dias de calendário do eixo
 * @param {number} largura pixels disponíveis para as barras
 */
export function zoomQueCabe(dias, largura) {
  if (!(dias > 0) || !(largura > 0)) return 1;
  return Math.max(1, Math.min(40, Math.floor((largura / dias) * 100) / 100));
}

/**
 * Estimativa de três pontos que faz a ação terminar no dia útil de índice `dia`, o mais perto possível da
 * proporção da estimativa atual (arrastar a borda direita da barra; 10/11/2026, decisão do responsável).
 *
 * A ação termina no dia `ceil(base + duração) − 1` (seção 5.1), em que a duração é a média PERT (o + 4m + p) / 6.
 * Para terminar no dia `dia`, a duração precisa ficar no intervalo (dia − base, dia + 1 − base]. Os três prazos são
 * multiplicados pelo mesmo fator (o que leva a duração ao meio do intervalo) e arredondados para inteiros; entre os
 * trios inteiros vizinhos (até 2 dias de cada valor) que respeitam otimista ≤ mais provável ≤ pessimista e caem no
 * intervalo, vale o mais próximo dos valores proporcionais.
 * @param {{o: number, m: number, p: number}} tres estimativa atual
 * @param {number} base índice (dias úteis, com fração) de onde a estimativa conta: a liberação ou a data da estimativa
 * @param {number} dia índice do dia útil em que a ação deve terminar
 * @returns {{o: number, m: number, p: number}|null} null quando não há como (terminar antes de começar)
 */
export function estimativaParaTerminarEm(tres, base, dia) {
  const minimo = dia - base;
  const maximo = dia + 1 - base;
  const atual = duracaoPert(tres);
  if (!(maximo > 0) || !(atual > 0)) return null;
  const alvo = (Math.max(0, minimo) + maximo) / 2;
  const fator = alvo / atual;
  const real = { o: tres.o * fator, m: tres.m * fator, p: tres.p * fator };
  let melhor = null;
  let menor = Infinity;
  const perto = (v) => [-2, -1, 0, 1, 2].map((d) => Math.round(v) + d).filter((x) => x >= 0);
  for (const o of perto(real.o)) for (const m of perto(real.m)) for (const p of perto(real.p)) {
    if (o > m || m > p || p === 0) continue;
    const d = duracaoPert({ o, m, p });
    if (d <= minimo + 1e-9 || d > maximo + 1e-9) continue;
    const distancia = (o - real.o) ** 2 + (m - real.m) ** 2 + (p - real.p) ** 2;
    if (distancia < menor) { menor = distancia; melhor = { o, m, p }; }
  }
  return melhor;
}
