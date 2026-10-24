/**
 * Tipos de espaço (documentação técnica, seção 16.1; passo 2.4a). Regras puras, sem tela nem banco.
 * - Plano de Ação: derivado do PEI/PDI; exige o Programa que o prevê e o documento que o aprovou.
 *   Até o catálogo do passo 2.5, o Programa é digitado (texto livre provisório; decisão do responsável, 23/10/2026).
 * - Projeto: propósito geral, sem vínculo ao PEI/PDI. É o tipo de quem não tem o campo `tipo`
 *   (os espaços criados antes do passo 2.4a, como a PI²; decisão do responsável, 23/10/2026).
 * - Quadro de tarefas (passo 3.1): tarefas do dia a dia, no estilo Trello e Planner; modelo fixo (o do cronograma
 *   aberto: data-limite opcional, sem dependências nem simulação), sem fases nem etapas e sem vínculo ao PEI/PDI.
 *   O tipo é escolhido na criação e não muda (passa a ter e a deixar de ter fases, modelo e colunas próprias).
 */
import { MODELOS } from "./modelos.js";

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
  quadro: Object.freeze({
    nome: "Quadro de tarefas",
    plural: "Quadros de tarefas",
    explicacao: "Tarefas do dia a dia, em colunas, como no Trello e no Planner, com data-limite opcional. Para uma pessoa ou uma equipe.",
  }),
});

/** Colunas com que um Quadro de tarefas começa, além de "A fazer" e "Concluídas" (decisão do responsável, 24/10/2026). */
export const COLUNAS_INICIAIS_DO_QUADRO = Object.freeze(["Fazendo"]);

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
  if (tipoDe(espaco) === "quadro") return problemaDoQuadro(espaco);
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

/** O que o Quadro de tarefas não tem (passo 3.1): fases e etapas, outro modelo, vínculo ao PEI/PDI. */
function problemaDoQuadro(espaco) {
  if (espaco.estrutura?.length || espaco.camposOpcionais?.fasesEtapas === true) return { codigo: "quadro-sem-fases", mensagem: "O Quadro de tarefas não tem fases nem etapas." };
  const m = espaco.modelo;
  const aberto = MODELOS.aberto.config;
  if (m && (m.prazos !== aberto.prazos || Boolean(m.dependencias) !== aberto.dependencias || Boolean(m.simulacao) !== aberto.simulacao)) {
    return { codigo: "quadro-modelo", mensagem: "O Quadro de tarefas usa só data-limite, sem dependências nem simulação." };
  }
  if (espaco.programa || espaco.aprovacao || espaco.vinculos?.length) return { codigo: "quadro-sem-vinculo", mensagem: "O Quadro de tarefas não tem Programa nem aprovação." };
  return null;
}
