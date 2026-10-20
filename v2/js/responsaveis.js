/**
 * Como os responsáveis aparecem na tela (especificação, seção 8.3): pessoa num círculo
 * com as iniciais, num tom tirado do nome; unidade num quadrado com a sigla.
 */

/** Número de tons da paleta das pessoas (variáveis --tom-1 a --tom-N, em css/estilo.css). */
export const TONS = 6;

const LIGACOES = new Set(["da", "das", "de", "do", "dos", "e"]);

/** Iniciais do primeiro e do último nome: "Ana Maria de Souza" → "AS"; "Ana" → "A". */
export function iniciais(nome) {
  const partes = String(nome ?? "").trim().split(/\s+/).filter((p) => p && !LIGACOES.has(p.toLowerCase()));
  if (!partes.length) return "?";
  const primeira = partes[0][0];
  return (partes.length > 1 ? primeira + partes.at(-1)[0] : primeira).toLocaleUpperCase("pt-BR");
}

/** Tom fixo da pessoa, de 1 a TONS, tirado do nome: o mesmo nome dá sempre o mesmo tom. */
export function tomDe(nome) {
  let h = 0;
  for (const c of String(nome ?? "")) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return (h % TONS) + 1;
}

/** Separa os responsáveis de uma ação: pessoas primeiro, depois unidades, cada grupo na ordem recebida. */
export function separar(responsaveis) {
  return {
    pessoas: responsaveis.filter((r) => r.tipo !== "unidade"),
    unidades: responsaveis.filter((r) => r.tipo === "unidade"),
  };
}
