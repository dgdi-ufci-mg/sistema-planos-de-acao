/**
 * Tipos de espaço (documentação técnica, seção 16.1; passo 2.4a). Regras puras, sem tela nem banco.
 * - Plano de Ação: derivado do PEI/PDI; exige o Programa que o prevê e o documento que o aprovou.
 *   Até o catálogo do passo 2.5, o Programa é digitado (texto livre provisório; decisão do responsável, 23/10/2026).
 * - Projeto: propósito geral, sem vínculo ao PEI/PDI. É o tipo de quem não tem o campo `tipo`
 *   (os espaços criados antes do passo 2.4a, como a PI²; decisão do responsável, 23/10/2026).
 * O Quadro de tarefas entra na fase 3 (passo 3.1).
 */

/** Na ordem em que aparecem na criação e no menu lateral. */
export const TIPOS = Object.freeze({
  planoDeAcao: Object.freeze({
    nome: "Plano de Ação",
    plural: "Planos de Ação",
    explicacao: "Plano formalizado, derivado do PEI/PDI. Pede o Programa que o prevê e o documento que o aprovou.",
  }),
  projeto: Object.freeze({
    nome: "Projeto",
    plural: "Projetos",
    explicacao: "Projeto de propósito geral, sem vínculo obrigatório com o PEI/PDI.",
  }),
});

export const TIPO_PADRAO = "projeto";

/** Tipo do espaço, com o padrão para quem não tem o campo. */
export const tipoDe = (espaco) => (espaco?.tipo && TIPOS[espaco.tipo] ? espaco.tipo : TIPO_PADRAO);

/**
 * Problema do tipo e dos campos que ele exige, ou null.
 * @param {{tipo?: string|null, programa?: string|null, aprovacao?: {identificacao?: string, link?: string}|null}} espaco
 * @returns {{codigo: string, mensagem: string}|null}
 */
export function problemaDoTipo(espaco) {
  if (espaco.tipo != null && !TIPOS[espaco.tipo]) return { codigo: "tipo-invalido", mensagem: `Tipo de espaço desconhecido: "${espaco.tipo}".` };
  const link = espaco.aprovacao?.link;
  if (link && !/^https?:\/\/\S+$/i.test(link)) return { codigo: "link-invalido", mensagem: "O link do documento de aprovação deve começar com https:// ou http://." };
  if (tipoDe(espaco) !== "planoDeAcao") return null;
  /* o Programa vem do catálogo da estratégia (`vinculos`, passo 2.5); o texto livre fica para os planos de antes e para o catálogo vazio */
  if (!espaco.vinculos?.length && !espaco.programa?.trim()) return { codigo: "programa-vazio", mensagem: "Informe o Programa do PEI/PDI que prevê este Plano de Ação." };
  if (!espaco.aprovacao?.identificacao?.trim()) {
    return { codigo: "aprovacao-vazia", mensagem: "Informe a identificação do documento que aprovou o Plano de Ação (SIPAC ou Protocolo)." };
  }
  return null;
}

/**
 * Espaços agrupados por tipo, na ordem de TIPOS, só os tipos que existem (menu lateral).
 * @template T
 * @param {T[]} espacos
 * @returns {{tipo: string, titulo: string, espacos: T[]}[]}
 */
export function agruparPorTipo(espacos) {
  return Object.entries(TIPOS)
    .map(([tipo, t]) => ({ tipo, titulo: t.plural, espacos: espacos.filter((e) => tipoDe(e) === tipo) }))
    .filter((g) => g.espacos.length);
}
