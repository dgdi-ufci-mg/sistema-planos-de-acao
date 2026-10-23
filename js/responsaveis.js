/**
 * Como os responsáveis aparecem na tela (documentação técnica, seção 8.3): pessoa num círculo
 * com as iniciais, no tom guardado para ela no espaço; unidade num quadrado com a sigla.
 */

/**
 * Número de tons da paleta das pessoas (variáveis --tom-1 a --tom-15, em css/estilo.css).
 * A numeração segue a ordem de distribuição: os 8 primeiros são bem distantes entre si.
 */
export const TONS = 15;

const LIGACOES = new Set(["da", "das", "de", "do", "dos", "e"]);

/** Iniciais do primeiro e do último nome: "Ana Maria de Souza" → "AS"; nome único, as duas primeiras letras: "Hebert" → "HE" (22/10/2026). */
export function iniciais(nome) {
  const partes = String(nome ?? "").trim().split(/\s+/).filter((p) => p && !LIGACOES.has(p.toLowerCase()));
  if (!partes.length) return "?";
  const primeira = partes[0][0];
  return (partes.length > 1 ? primeira + partes.at(-1)[0] : [...partes[0]].slice(0, 2).join("")).toLocaleUpperCase("pt-BR");
}

/**
 * Tom tirado do nome, de 1 a TONS. Só para quem ainda não tem tom guardado no espaço
 * (por exemplo, quem passou de unidade a pessoa), até a próxima gravação de uma ação.
 */
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

/**
 * Tons das pessoas de um espaço (documentação técnica, seção 4.1): cada pessoa responsável por
 * alguma ação tem um tom só seu, que não muda enquanto ela continuar no espaço.
 * - quem deixou de ser responsável por todas as ações sai, e o tom fica livre;
 * - quem chega recebe o menor tom livre; acima de TONS pessoas, o tom menos usado (o menor, no empate).
 * @param {Record<string, number>} tons  tons atuais (id do responsável → tom)
 * @param {string[]} emUso  ids das pessoas responsáveis, na ordem em que aparecem nas ações
 * @returns {Record<string, number>} novos tons
 */
export function ajustarTons(tons = {}, emUso = []) {
  const novos = Object.fromEntries(Object.entries(tons).filter(([id]) => emUso.includes(id)));
  for (const id of emUso) {
    if (novos[id]) continue;
    const usos = Array(TONS + 1).fill(0);
    for (const t of Object.values(novos)) usos[t]++;
    let escolhido = 1;
    for (let t = 2; t <= TONS; t++) if (usos[t] < usos[escolhido]) escolhido = t;
    novos[id] = escolhido;
  }
  return novos;
}
