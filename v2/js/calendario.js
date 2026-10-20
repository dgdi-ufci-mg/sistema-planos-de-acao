/**
 * Calendário de dias úteis do espaço (especificação, seção 5.1).
 *
 * O tempo dos cálculos é contado em dias úteis, a partir do primeiro dia útil
 * do espaço, que é o índice 0. Um índice fracionário, como 3,5, cai no dia 3.
 * Datas são textos AAAA-MM-DD (dicionário de dados, convenções).
 * Funções puras: não acessam a tela nem o banco.
 */

const UM_DIA = 864e5;
const paraData = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? "")) return null;
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const paraIso = (data) => data.toISOString().slice(0, 10);
const somarDias = (data, n) => new Date(data.getTime() + n * UM_DIA);

/**
 * @param {{inicio?: string, datasExcluidas?: {data: string}[]}} espaco
 * @param {string} [hoje] usado só quando o espaço não tem início
 */
export function criarCalendario({ inicio, datasExcluidas = [] }, hoje = paraIso(new Date())) {
  const excluidas = new Set(datasExcluidas.map((d) => d.data));
  const ehDiaUtil = (data) => {
    const semana = data.getUTCDay();
    return semana !== 0 && semana !== 6 && !excluidas.has(paraIso(data));
  };

  let cursor = paraData(inicio) ?? paraData(hoje);
  while (!ehDiaUtil(cursor)) cursor = somarDias(cursor, 1);
  /** Dias úteis já conhecidos, em ordem; a lista cresce conforme a necessidade. */
  const dias = [];
  const estender = (quantos) => {
    while (dias.length < quantos) {
      if (ehDiaUtil(cursor)) dias.push(cursor);
      cursor = somarDias(cursor, 1);
    }
  };
  estender(300);

  /** Quantos dias úteis há antes da data (do primeiro dia útil até a véspera). */
  const diasUteisAntes = (iso) => {
    const alvo = paraData(iso);
    if (!alvo) return null;
    if (alvo <= dias[0]) return 0;
    while (dias[dias.length - 1] < alvo) estender(dias.length + 300);
    let baixo = 0, alto = dias.length;
    while (baixo < alto) {
      const meio = (baixo + alto) >> 1;
      if (dias[meio] < alvo) baixo = meio + 1; else alto = meio;
    }
    return baixo;
  };

  /** Data do dia útil de índice `i` (a parte fracionária é desprezada). */
  const data = (i) => {
    const n = Math.max(0, Math.floor(i + 1e-9));
    if (n >= dias.length) estender(n + 300);
    return paraIso(dias[n]);
  };

  return {
    primeiroDia: paraIso(dias[0]),
    ehDiaUtil: (iso) => ehDiaUtil(paraData(iso)),
    diasUteisAntes,
    /** Dias úteis até a data, incluindo ela. */
    diasUteisAte: (iso) => {
      const alvo = paraData(iso);
      return alvo ? diasUteisAntes(paraIso(somarDias(alvo, 1))) : null;
    },
    data,
    /** Dia em que algo que termina no índice `fim` é concluído: o último dia trabalhado. */
    dataDeConclusao: (fim, inicio = 0) => data(Math.max(inicio, Math.ceil(fim - 1e-9) - 1)),
  };
}
