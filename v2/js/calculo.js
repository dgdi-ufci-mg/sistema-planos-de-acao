/**
 * Cálculo determinístico: estimativa PERT e caminho crítico (especificação, seções 5.1 e 5.2).
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
 * Dependências de códigos inexistentes são ignoradas e devolvidas como aviso.
 * @param {{codigo: string, ordem?: number, dependeDe?: string[]}[]} acoes
 */
export function ordenarPorDependencia(acoes) {
  const lista = [...acoes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.codigo.localeCompare(b.codigo));
  const existe = new Set(lista.map((a) => a.codigo));
  const avisos = [];
  const anteriores = new Map();
  for (const a of lista) {
    const validas = [];
    for (const d of new Set(a.dependeDe ?? [])) {
      if (d === a.codigo) continue;
      if (existe.has(d)) validas.push(d);
      else avisos.push({ codigo: "dependencia-inexistente", acao: a.codigo, dependeDe: d });
    }
    anteriores.set(a.codigo, validas);
  }
  const seguintes = new Map(lista.map((a) => [a.codigo, []]));
  for (const [c, ds] of anteriores) for (const d of ds) seguintes.get(d).push(c);
  const faltam = new Map([...anteriores].map(([c, ds]) => [c, ds.length]));
  const fila = lista.filter((a) => faltam.get(a.codigo) === 0).map((a) => a.codigo);
  const ordem = [];
  while (fila.length) {
    const c = fila.shift();
    ordem.push(c);
    for (const s of seguintes.get(c)) if (faltam.set(s, faltam.get(s) - 1).get(s) === 0) fila.push(s);
  }
  if (ordem.length < lista.length) {
    const emCiclo = lista.map((a) => a.codigo).filter((c) => !ordem.includes(c));
    throw new ErroDeCalculo("ciclo",
      `As ações ${emCiclo.join(", ")} dependem umas das outras em círculo, e assim nenhuma pode começar.`, emCiclo);
  }
  return { ordem, anteriores, seguintes, avisos };
}

/**
 * Caminho crítico pelas estimativas vigentes.
 * @param {object[]} acoes ações do espaço (dicionário de dados, 4.2)
 * @param {ReturnType<import("./calendario.js").criarCalendario>} calendario
 * @returns {{fim: number, porAcao: Map<string, {liberacao: number, conclusao: number,
 *   liberacaoTardia: number, conclusaoTardia: number, folga: number, critica: boolean}>, avisos: object[]}}
 */
export function caminhoCritico(acoes, calendario) {
  const { ordem, anteriores, seguintes, avisos } = ordenarPorDependencia(acoes);
  const porCodigo = new Map(acoes.map((a) => [a.codigo, a]));
  const porAcao = new Map();
  let fim = 0;

  for (const codigo of ordem) {
    const acao = porCodigo.get(codigo);
    let liberacao = 0;
    for (const d of anteriores.get(codigo)) liberacao = Math.max(liberacao, porAcao.get(d).conclusao);
    if (acao.naoAntesDe) liberacao = Math.max(liberacao, calendario.diasUteisAntes(acao.naoAntesDe));
    const vigente = estimativaVigente(acao);
    if (!vigente) avisos.push({ codigo: "sem-estimativa", acao: codigo });
    const conclusao = liberacao + (vigente ? duracaoPert(vigente) : 0);
    porAcao.set(codigo, { liberacao, conclusao });
    fim = Math.max(fim, conclusao);
  }

  for (const codigo of [...ordem].reverse()) {
    const r = porAcao.get(codigo);
    let conclusaoTardia = fim;
    for (const s of seguintes.get(codigo)) conclusaoTardia = Math.min(conclusaoTardia, porAcao.get(s).liberacaoTardia);
    r.conclusaoTardia = conclusaoTardia;
    r.liberacaoTardia = conclusaoTardia - (r.conclusao - r.liberacao);
    r.folga = r.liberacaoTardia - r.liberacao;
    r.critica = r.folga < 1e-6;
  }
  return { fim, porAcao, avisos };
}
