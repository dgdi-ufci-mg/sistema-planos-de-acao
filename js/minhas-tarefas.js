/**
 * Minhas tarefas (documentação técnica, seção 8, "Minhas tarefas"; pedido do responsável, 05/11/2026): as ações e
 * tarefas atribuídas a quem entrou, de todos os espaços de que participa, numa lista só, agrupada por prazo, como o
 * "Hoje" e o "Em breve" do Todoist. Regra pura, sem tela nem banco.
 *
 * - "Minhas": a ação tem, entre os responsáveis, um responsável do espaço ligado ao e-mail de quem entrou (seção 4.5).
 *   Ação sem responsável não entra (decisão do responsável, 05/11/2026: o responsável é opcional e não é preenchido
 *   automaticamente).
 * - Ficam de fora as concluídas, as excluídas e as dos espaços encerrados.
 * - Prazo: a mesma data que a lista do espaço mostra: nos espaços com data-limite (Quadro, Lista e os de prazos por
 *   data-limite), a data-limite; nos demais, a conclusão prevista pelo cálculo determinístico (seção 5), sem simulação.
 * - Grupos, nesta ordem: Atrasadas (carimbo da seção 6.2), Hoje, Próximos 7 dias (corridos), Mais adiante e Sem prazo.
 */
import { criarCalendario, datasEfetivas } from "./calendario.js";
import { caminhoCritico } from "./calculo.js";
import { montarLinhas } from "./lista.js";
import { modeloDe, opcoesDoCalculo } from "./modelos.js";
import { tipoDe } from "./tipos.js";
import { termos } from "./vocabulario.js";

/** Grupos da tela, na ordem: [chave, título]. */
export const GRUPOS = Object.freeze([
  ["atrasadas", "Atrasadas"],
  ["hoje", "Hoje"],
  ["semana", "Próximos 7 dias"],
  ["adiante", "Mais adiante"],
  ["semPrazo", "Sem prazo"],
]);

/** Dias corridos do grupo "Próximos 7 dias", contados a partir de amanhã. */
export const DIAS_DA_SEMANA = 7;

/** Data ISO somada de `dias` dias corridos. */
export function somarDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Grupo de uma tarefa pelo prazo e pelo carimbo. */
export function grupoDe({ atrasada, prazo }, hoje) {
  if (atrasada) return "atrasadas";
  if (!prazo) return "semPrazo";
  if (prazo <= hoje) return "hoje";
  return prazo <= somarDias(hoje, DIAS_DA_SEMANA) ? "semana" : "adiante";
}

/**
 * As tarefas de quem entrou num espaço.
 * @param {{espaco: object, acoes: object[], responsaveis: object[], geral?: object|null}} fonte  acoes: só as ativas
 * @param {string} email
 * @param {string} hoje  data ISO
 * @returns {object[]} um item por tarefa, ainda sem grupo
 */
export function tarefasDoEspaco({ espaco, acoes, responsaveis, geral = null }, email, hoje) {
  if (!email || espaco.encerradoEm || espaco.excluidoEm) return [];
  const minhas = new Set(responsaveis.filter((r) => !r.excluidoEm && r.usuario === email).map((r) => r.id));
  if (!minhas.size) return [];
  const ativas = [...acoes].filter((a) => !a.excluidaEm).sort((a, b) => a.ordem - b.ordem);
  if (!ativas.some((a) => (a.responsaveis ?? []).some((id) => minhas.has(id)))) return [];
  const cal = criarCalendario({ ...espaco, datasExcluidas: datasEfetivas(espaco, geral) }, hoje);
  const caminho = caminhoCritico(ativas, cal, { hoje, ...opcoesDoCalculo(espaco) });
  const prazos = modeloDe(espaco).prazos;
  const t = termos(espaco);
  return montarLinhas(ativas, caminho, null, cal, hoje, { prazos, espaco })
    .filter((l) => l.situacao !== "concluida" && (l.acao.responsaveis ?? []).some((id) => minhas.has(id)))
    .map((l) => ({
      espacoId: espaco.id,
      espacoNome: espaco.nome,
      tipo: tipoDe(espaco),
      termo: t.acao,
      numero: l.acao.numero,
      ordem: l.acao.ordem,
      rotulo: l.acao.rotulo,
      descricao: l.acao.descricao ?? "",
      prazo: l.conclusao ?? null,
      /** "limite": data-limite escolhida pela pessoa; "previsao": conclusão prevista pelo cálculo */
      tipoDePrazo: prazos === "dataLimite" ? "limite" : "previsao",
      atrasada: l.atrasada,
      naoLiberada: l.situacao === "naoLiberada",
      aPartirDe: l.aPartirDe,
    }));
}

/** Ordem dentro de um grupo: prazo (sem prazo por último), nome do espaço e ordem do espaço. */
function comparar(a, b) {
  if (a.prazo !== b.prazo) return !a.prazo ? 1 : !b.prazo ? -1 : a.prazo < b.prazo ? -1 : 1;
  const e = a.espacoNome.localeCompare(b.espacoNome, "pt-BR");
  return e || a.ordem - b.ordem;
}

/**
 * Minhas tarefas, de todos os espaços.
 * @param {Array<{espaco: object, acoes: object[], responsaveis: object[], geral?: object|null}>} fontes
 * @param {string|null} email  quem entrou; sem e-mail, nada
 * @param {string} hoje  data ISO
 * @returns {{grupos: Array<{chave: string, titulo: string, itens: object[]}>, total: number, urgentes: number}}
 *   grupos: só os que têm tarefas, na ordem de GRUPOS; urgentes: atrasadas mais as de hoje (o número da barra lateral)
 */
export function montarMinhasTarefas(fontes, email, hoje) {
  const porGrupo = new Map(GRUPOS.map(([chave]) => [chave, []]));
  for (const fonte of fontes) {
    for (const item of tarefasDoEspaco(fonte, email, hoje)) porGrupo.get(grupoDe(item, hoje)).push(item);
  }
  const grupos = GRUPOS.map(([chave, titulo]) => ({ chave, titulo, itens: porGrupo.get(chave).sort(comparar) })).filter((g) => g.itens.length);
  const total = grupos.reduce((s, g) => s + g.itens.length, 0);
  const urgentes = porGrupo.get("atrasadas").length + porGrupo.get("hoje").length;
  return { grupos, total, urgentes };
}
