/**
 * Tipos de espaço (documentação técnica, seção 16.1; passo 2.4a). Regras puras, sem tela nem banco.
 * - Plano de Ação: derivado do PEI/PDI; exige o Programa que o prevê e o documento que o aprovou.
 *   Até o catálogo do passo 2.5, o Programa é digitado (texto livre provisório; decisão do responsável, 23/10/2026).
 * - Projeto: propósito geral, sem vínculo ao PEI/PDI. É o tipo de quem não tem o campo `tipo`
 *   (os espaços criados antes do passo 2.4a, como a PI²; decisão do responsável, 23/10/2026).
 * - Quadro de tarefas (passo 3.1): tarefas do dia a dia, no estilo Trello e Planner; modelo fixo (o do cronograma
 *   aberto: data-limite opcional, sem dependências nem simulação), sem fases nem etapas e sem vínculo ao PEI/PDI.
 *   O tipo é escolhido na criação e não muda (passa a ter e a deixar de ter fases, modelo e colunas próprias).
 * - Lista de tarefas (passo 3.4; decisão do responsável, 27/10/2026): como o Quadro de tarefas, mas com uma
 *   visualização só, a Lista, e sem colunas. Quadro e Lista são os **tipos de tarefas**: palavra "tarefa", conclusão
 *   marcada numa caixinha, sem data (seção 8).
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
  lista: Object.freeze({
    nome: "Lista de tarefas",
    plural: "Listas de tarefas",
    explicacao: "Tarefas do dia a dia numa lista simples, para marcar como feitas, como no Todoist e no Microsoft To Do. Para uma pessoa ou uma equipe.",
  }),
});

/** Tipos de tarefas (Quadro e Lista): palavra "tarefa", conclusão marcada sem data, modelo fixo, sem fases. */
export const TIPOS_DE_TAREFAS = Object.freeze(["quadro", "lista"]);
/** Espaço de um tipo de tarefas (Quadro ou Lista de tarefas). */
export const ehDeTarefas = (espaco) => TIPOS_DE_TAREFAS.includes(tipoDe(espaco));

/** Colunas com que um Quadro de tarefas começa, todas editáveis (decisões do responsável de 24 e 27/10/2026; sem Concluídas desde 27/10/2026). */
export const COLUNAS_INICIAIS_DO_QUADRO = Object.freeze(["A fazer", "Fazendo"]);

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
  if (ehDeTarefas(espaco)) return problemaDoQuadro(espaco, tipoDe(espaco) === "lista" ? "A Lista de tarefas" : "O Quadro de tarefas");
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

/** O que o Quadro e a Lista de tarefas não têm (passos 3.1 e 3.4): fases e etapas, outro modelo, vínculo ao PEI/PDI. */
function problemaDoQuadro(espaco, nome = "O Quadro de tarefas") {
  if (espaco.estrutura?.length || espaco.camposOpcionais?.fasesEtapas === true) return { codigo: "quadro-sem-fases", mensagem: `${nome} não tem fases nem etapas.` };
  const m = espaco.modelo;
  const aberto = MODELOS.aberto.config;
  if (m && (m.prazos !== aberto.prazos || Boolean(m.dependencias) !== aberto.dependencias || Boolean(m.simulacao) !== aberto.simulacao)) {
    return { codigo: "quadro-modelo", mensagem: `${nome} usa só data-limite, sem dependências nem simulação.` };
  }
  if (espaco.programa || espaco.aprovacao || espaco.vinculos?.length) return { codigo: "quadro-sem-vinculo", mensagem: `${nome} não tem Programa nem aprovação.` };
  return null;
}
