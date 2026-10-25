/**
 * Regras da busca e paleta de comandos (Ctrl+K; item 7 da avaliação de usabilidade de 24/10/2026; documentação
 * técnica, seção 8). Regra pura: recebe os itens e o que foi digitado e devolve os itens que combinam, em ordem.
 *
 * Como combina: o texto do item (título e palavras extras) e o digitado são comparados sem maiúsculas e sem
 * acentos; cada palavra digitada precisa aparecer no texto do item, em qualquer ordem e em qualquer ponto.
 * Ordem: primeiro os itens cujo título começa pelo que foi digitado; depois, os que têm uma palavra do título
 * começando pela primeira palavra digitada; por fim, os demais. Empates mantêm a ordem recebida, e o resultado
 * é agrupado na ordem em que cada grupo aparece pela primeira vez. Sem nada digitado, saem os itens marcados
 * com `soAoDigitar` (por exemplo, os termos do glossário), para a lista inicial não ficar longa demais.
 */

/** Texto sem maiúsculas, sem acentos e com os espaços resumidos. */
export function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * @template {{grupo: string, titulo: string, palavras?: string, soAoDigitar?: boolean}} T
 * @param {T[]} itens
 * @param {string} consulta
 * @param {number} [limite] máximo de itens devolvidos
 * @returns {T[]}
 */
export function filtrarItens(itens, consulta, limite = 60) {
  const q = normalizar(consulta);
  if (!q) return agrupar(itens.filter((i) => !i.soAoDigitar)).slice(0, limite);
  const termos = q.split(" ");
  const pontuados = [];
  itens.forEach((item, ordem) => {
    const titulo = normalizar(item.titulo);
    const texto = `${titulo} ${normalizar(item.palavras)}`;
    if (!termos.every((t) => texto.includes(t))) return;
    const nota = titulo.startsWith(q) ? 0 : titulo.split(/[\s·:/(),.-]+/).some((p) => p.startsWith(termos[0])) ? 1 : 2;
    pontuados.push({ item, nota, ordem });
  });
  pontuados.sort((a, b) => a.nota - b.nota || a.ordem - b.ordem);
  return agrupar(pontuados.map((p) => p.item)).slice(0, limite);
}

/** Junta os itens de cada grupo, na ordem em que o grupo aparece pela primeira vez, sem mudar a ordem dentro dele. */
function agrupar(itens) {
  const grupos = new Map();
  for (const item of itens) {
    if (!grupos.has(item.grupo)) grupos.set(item.grupo, []);
    grupos.get(item.grupo).push(item);
  }
  return [...grupos.values()].flat();
}
