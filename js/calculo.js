/**
 * Cálculo determinístico: estimativa PERT e caminho crítico (documentação técnica, seções 5.1 e 5.2).
 *
 * Passada de ida: cada ação é liberada quando todas as anteriores terminam e a
 * data mínima ("Não começa antes de") chega. Passada de volta: a data mais tarde
 * em que cada ação pode terminar sem atrasar a conclusão; a diferença é a folga.
 * Tempo em dias úteis desde o primeiro dia útil do espaço (js/calendario.js).
 * Funções puras: não acessam a tela nem o banco.
 */

/** Erro de cálculo com um código fixo, para a tela saber o que aconteceu. */
export class ErroDeCalculo extends Error {
  /** @param {string} codigo @param {string} mensagem @param {string[]} [acoes] */
  constructor(codigo, mensagem, acoes = []) {
    super(mensagem);
    this.codigo = codigo;
    this.acoes = acoes;
  }
}

/** Duração esperada pela fórmula PERT, média da beta-PERT: (O + 4M + P) / 6. */
export const duracaoPert = ({ o, m, p }) => (o + 4 * m + p) / 6;

/** Estimativa vigente: a mais recente (seção 5.6). Sem estimativa, duração zero. */
export const estimativaVigente = (acao) => acao.estimativas?.at(-1) ?? null;

/**
 * Ordem em que as ações podem ser calculadas: cada uma depois das suas anteriores.
 * Dependências de ações inexistentes são ignoradas e devolvidas como aviso.
 * As ações são identificadas pelo número (seção 4.2).
 * @param {{numero: number, ordem?: number, dependeDe?: number[]}[]} acoes
 */
export function ordenarPorDependencia(acoes) {
  const lista = [...acoes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || (a.numero > b.numero) - (a.numero < b.numero));
  const existe = new Set(lista.map((a) => a.numero));
  const avisos = [];
  const anteriores = new Map();
  for (const a of lista) {
    const validas = [];
    for (const d of new Set(a.dependeDe ?? [])) {
      if (d === a.numero) continue;
      if (existe.has(d)) validas.push(d);
      else avisos.push({ codigo: "dependencia-inexistente", acao: a.numero, dependeDe: d });
    }
    anteriores.set(a.numero, validas);
  }
  const seguintes = new Map(lista.map((a) => [a.numero, []]));
  for (const [c, ds] of anteriores) for (const d of ds) seguintes.get(d).push(c);
  const faltam = new Map([...anteriores].map(([c, ds]) => [c, ds.length]));
  const fila = lista.filter((a) => faltam.get(a.numero) === 0).map((a) => a.numero);
  const ordem = [];
  while (fila.length) {
    const c = fila.shift();
    ordem.push(c);
    for (const s of seguintes.get(c)) if (faltam.set(s, faltam.get(s) - 1).get(s) === 0) fila.push(s);
  }
  if (ordem.length < lista.length) {
    const emCiclo = lista.map((a) => a.numero).filter((c) => !ordem.includes(c));
    throw new ErroDeCalculo("ciclo",
      `As ações ${emCiclo.join(", ")} dependem umas das outras em círculo, e assim nenhuma pode começar.`, emCiclo);
  }
  return { ordem, anteriores, seguintes, avisos };
}

/**
 * Caminho crítico, situações e carimbo Atrasada.
 *
 * Regras (documentação técnica, seções 5 e 6):
 * - Ação concluída: entra com a duração real, da liberação à data de conclusão (5.4).
 * - Estimativa vigente que conta da liberação: conclusão = liberação + PERT.
 *   Reestimativa (conta do dia em que foi feita): conclusão = dia da reestimativa + PERT (5.3).
 * - Com `hoje`: ação liberada e não concluída cuja conclusão prevista já passou é
 *   considerada concluída a partir de hoje, sem alterar o que o usuário registrou (5.5).
 * - Com `hoje`: situação Concluída, Liberada ou Não liberada, e carimbo Atrasada (6).
 *
 * @param {object[]} acoes ações do espaço (dicionário de dados, 4.2)
 * @param {ReturnType<import("./calendario.js").criarCalendario>} calendario
 * @param {{hoje?: string}} [opcoes] sem `hoje`, só o cálculo pelas estimativas e conclusões
 */
export function caminhoCritico(acoes, calendario, { hoje } = {}) {
  const { ordem, anteriores, seguintes, avisos } = ordenarPorDependencia(acoes);
  const porNumero = new Map(acoes.map((a) => [a.numero, a]));
  const indiceDeHoje = hoje ? calendario.diasUteisAntes(hoje) : null;
  const porAcao = new Map();
  let fim = 0;

  for (const numero of ordem) {
    const acao = porNumero.get(numero);
    const antes = anteriores.get(numero);
    let liberacao = 0;
    for (const d of antes) liberacao = Math.max(liberacao, porAcao.get(d).conclusao);
    if (acao.naoAntesDe) liberacao = Math.max(liberacao, calendario.diasUteisAntes(acao.naoAntesDe));

    const r = { liberacao, regraDoPassado: false };
    if (acao.concluidaEm) {
      r.conclusao = calendario.diasUteisAte(acao.concluidaEm);
      r.liberacao = Math.min(liberacao, r.conclusao); // registro anterior à liberação calculada: vale o registro
    } else {
      const vigente = estimativaVigente(acao);
      if (!vigente) avisos.push({ codigo: "sem-estimativa", acao: numero });
      const duracao = vigente ? duracaoPert(vigente) : 0;
      const contaDe = vigente?.contaDe === "data" ? calendario.diasUteisAntes(vigente.em) : liberacao;
      r.conclusao = Math.max(liberacao, contaDe + duracao);
    }

    if (hoje) {
      const anterioresConcluidas = antes.every((d) => porNumero.get(d).concluidaEm);
      const dataMinimaChegou = !acao.naoAntesDe || acao.naoAntesDe <= hoje;
      r.situacao = acao.concluidaEm ? "concluida" : anterioresConcluidas && dataMinimaChegou ? "liberada" : "naoLiberada";
      const semEstimativa = !acao.concluidaEm && !estimativaVigente(acao);
      const noPassado = r.situacao === "liberada" && calendario.dataDeConclusao(r.conclusao, r.liberacao) < hoje;
      /* sem estimativa não há prazo para vencer: "Falta estimar", e não "Atrasada" (seção 5.2) */
      r.atrasada = noPassado && !semEstimativa;
      if (noPassado) {
        r.vencidaEm = calendario.dataDeConclusao(r.conclusao, r.liberacao); // dia em que a previsão venceu
        r.conclusao = indiceDeHoje + 1; // nada termina no passado: termina, no mínimo, hoje
        r.regraDoPassado = !semEstimativa; // o aviso "prazo vencido sem reestimativa" só vale com estimativa
      }
    }
    porAcao.set(numero, r);
    fim = Math.max(fim, r.conclusao);
  }

  for (const numero of [...ordem].reverse()) {
    const r = porAcao.get(numero);
    let conclusaoTardia = fim;
    for (const s of seguintes.get(numero)) conclusaoTardia = Math.min(conclusaoTardia, porAcao.get(s).liberacaoTardia);
    r.conclusaoTardia = conclusaoTardia;
    r.liberacaoTardia = conclusaoTardia - (r.conclusao - r.liberacao);
    r.folga = r.liberacaoTardia - r.liberacao;
    r.critica = r.folga < 1e-6 && !porNumero.get(numero).concluidaEm;
  }
  return { fim, porAcao, avisos };
}
