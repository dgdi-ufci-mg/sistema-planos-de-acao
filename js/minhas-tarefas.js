/**
 * Meu trabalho (antes "Minhas tarefas"; documentação técnica, seção 8, "Meu trabalho"; pedido do responsável, 05/11/2026,
 * e nova tela de 19/11/2026): as ações e tarefas atribuídas a quem entrou, de todos os espaços de que participa, numa
 * lista só. Regra pura, sem tela nem banco.
 *
 * - "Minhas": a ação tem, entre os responsáveis, um responsável do espaço ligado ao e-mail de quem entrou (seção 4.5).
 *   Ação sem responsável não entra (decisão do responsável, 05/11/2026: o responsável é opcional e não é preenchido
 *   automaticamente).
 * - Ficam de fora as concluídas, as excluídas e as dos espaços encerrados.
 * - Data mostrada (19/11/2026): nos espaços com data-limite, a data-limite ("até"); nos demais, a conclusão prevista
 *   pelo cálculo determinístico ("previsão"). Na ação atrasada, a data **planejada** que venceu (`vencidaEm`), e não a
 *   previsão recalculada, que a regra "nada termina no passado" (seção 5.5) empurra para hoje.
 * - Avisos (19/11/2026): "Prazo vencido" (a data-limite passou), "Atrasada" (a data planejada passou) e "Em risco" (a
 *   previsão passa da data-limite). O terceiro só existirá quando a ação puder ter data-limite e estimativa ao mesmo
 *   tempo (pendência de 06/11/2026); a regra já o prevê.
 * - Formas de ver (19/11/2026): agrupar por nada, por espaço ou por prazo; ordenar pela ordem pessoal ("Minha ordem",
 *   arrastando) ou pela data; ocultar as não liberadas e espaços inteiros.
 */
import { criarCalendario, datasEfetivas } from "./calendario.js";
import { caminhoCritico } from "./calculo.js";
import { montarLinhas } from "./lista.js";
import { modeloDe, opcoesDoCalculo } from "./modelos.js";
import { tipoDe } from "./tipos.js";
import { termos } from "./vocabulario.js";

/** Grupos por prazo, na ordem: [chave, título]. */
export const GRUPOS = Object.freeze([
  ["vencidas", "Vencidas ou em risco"],
  ["hoje", "Hoje"],
  ["semana", "Próximos 7 dias"],
  ["adiante", "Mais adiante"],
  ["semData", "Sem data"],
]);

/** Avisos, do mais grave para o mais leve: [chave, nome]. */
export const AVISOS = Object.freeze([
  ["prazoVencido", "Prazo vencido"],
  ["atrasada", "Atrasada"],
  ["emRisco", "Em risco"],
]);

/** Formas de ver aceitas, com o padrão primeiro (decisão do responsável, 19/11/2026: minha ordem, sem agrupamento, lista). */
export const AGRUPAR = Object.freeze(["nenhum", "espaco", "prazo"]);
export const ORDENAR = Object.freeze(["minha", "data"]);

/** Dias corridos do grupo "Próximos 7 dias", contados a partir de amanhã. */
export const DIAS_DA_SEMANA = 7;

/** Data ISO somada de `dias` dias corridos. */
export function somarDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Chave de um item na ordem pessoal: o espaço e o número da ação, que nunca muda (seção 4.2). */
export const chaveDoItem = (espacoId, numero) => `${espacoId}:${numero}`;

/**
 * Aviso da tarefa, ou null. Vale o mais grave.
 * @param {{atrasada: boolean, tipoDePrazo: "limite"|"previsao", dataLimite?: string|null, previsao?: string|null}} item
 * @param {string} hoje
 */
export function avisoDe({ atrasada, tipoDePrazo, dataLimite = null, previsao = null }, hoje) {
  if (atrasada) return tipoDePrazo === "limite" ? "prazoVencido" : "atrasada";
  if (dataLimite && dataLimite < hoje) return "prazoVencido";
  if (dataLimite && previsao && previsao > dataLimite) return "emRisco";
  return null;
}

/** Grupo por prazo de uma tarefa: as com aviso, depois pela data mostrada. */
export function grupoDe({ aviso = null, atrasada = false, prazo }, hoje) {
  if (aviso || atrasada) return "vencidas";
  if (!prazo) return "semData";
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
    .map((l) => {
      const tipoDePrazo = prazos === "dataLimite" ? "limite" : "previsao";
      /* atrasada: a data que venceu (a data-limite, ou a planejada pela estimativa vigente), e não a recalculada */
      const prazo = (l.atrasada ? l.vencidaEm : l.conclusao) ?? null;
      const checklist = l.acao.checklist ?? [];
      return {
        chave: chaveDoItem(espaco.id, l.acao.numero),
        espacoId: espaco.id,
        espacoNome: espaco.nome,
        tipo: tipoDe(espaco),
        termo: t.acao,
        numero: l.acao.numero,
        ordem: l.acao.ordem,
        rotulo: l.acao.rotulo,
        descricao: l.acao.descricao ?? "",
        prazo,
        /** "limite": data-limite escolhida pela pessoa; "previsao": conclusão prevista pelo cálculo */
        tipoDePrazo,
        atrasada: l.atrasada,
        aviso: avisoDe({ atrasada: l.atrasada, tipoDePrazo }, hoje),
        naoLiberada: l.situacao === "naoLiberada",
        aPartirDe: l.aPartirDe,
        checklist: checklist.length ? { feitos: checklist.filter((i) => i.feito).length, total: checklist.length } : null,
      };
    });
}

/** Ordem por data: as com aviso primeiro (do mais grave), depois pela data (sem data por último), o espaço e a ordem dele. */
export function compararPorData(a, b) {
  const pa = AVISOS.findIndex(([c]) => c === a.aviso);
  const pb = AVISOS.findIndex(([c]) => c === b.aviso);
  if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  if (a.prazo !== b.prazo) return !a.prazo ? 1 : !b.prazo ? -1 : a.prazo < b.prazo ? -1 : 1;
  const e = a.espacoNome.localeCompare(b.espacoNome, "pt-BR");
  return e || a.ordem - b.ordem;
}

/**
 * Todas as tarefas na ordem pessoal: as que a ordem guardada lista, na ordem dela; as que ela não lista (tarefas
 * novas, ou tudo, quando a pessoa ainda não ordenou), no alto, por data (decisão de 06/11/2026: o item novo entra
 * no topo, porque a primeira coisa a fazer com ele é decidir o destino).
 * @param {object[]} itens
 * @param {string[]|null} ordemPessoal  chaves (chaveDoItem)
 */
export function emMinhaOrdem(itens, ordemPessoal) {
  const posicao = new Map((ordemPessoal ?? []).map((k, i) => [k, i]));
  const novos = itens.filter((i) => !posicao.has(i.chave)).sort(compararPorData);
  const conhecidos = itens.filter((i) => posicao.has(i.chave)).sort((a, b) => posicao.get(a.chave) - posicao.get(b.chave));
  return [...novos, ...conhecidos];
}

/**
 * Nova ordem pessoal depois de arrastar: a lista inteira (todas as tarefas, inclusive as ocultas), com a tarefa
 * movida logo depois de `depoisDe` ou, sem ela, logo antes de `antesDe`. Chaves de tarefas que não existem mais saem.
 * @param {string[]} ordemAtual  todas as chaves, na ordem pessoal em vigor (emMinhaOrdem)
 * @param {string} chave
 * @param {{depoisDe?: string|null, antesDe?: string|null}} vizinhas
 * @returns {string[]}
 */
export function moverNaOrdem(ordemAtual, chave, { depoisDe = null, antesDe = null } = {}) {
  const sem = ordemAtual.filter((k) => k !== chave);
  const d = depoisDe == null ? -1 : sem.indexOf(depoisDe);
  const a = antesDe == null ? -1 : sem.indexOf(antesDe);
  const i = d >= 0 ? d + 1 : a >= 0 ? a : 0;
  return [...sem.slice(0, i), chave, ...sem.slice(i)];
}

/**
 * Meu trabalho, de todos os espaços.
 * @param {Array<{espaco: object, acoes: object[], responsaveis: object[], geral?: object|null}>} fontes
 * @param {string|null} email  quem entrou; sem e-mail, nada
 * @param {string} hoje  data ISO
 * @param {{agrupar?: string, ordenar?: string, ordemPessoal?: string[]|null, ocultarNaoLiberadas?: boolean,
 *   espacosOcultos?: string[]}} [ver]
 * @returns {{grupos: Array<{chave: string, titulo: string, itens: object[]}>, ordem: string[], total: number,
 *   visiveis: number, ocultas: number, urgentes: number, avisos: Record<string, number>,
 *   espacos: Array<{id: string, nome: string, n: number}>}}
 *   grupos: só os que têm tarefas visíveis; ordem: todas as chaves na ordem pessoal em vigor (para mover);
 *   urgentes: com aviso mais as de hoje (o número da barra lateral)
 */
export function montarMinhasTarefas(fontes, email, hoje, ver = {}) {
  const agrupar = AGRUPAR.includes(ver.agrupar) ? ver.agrupar : AGRUPAR[0];
  const ordenar = ORDENAR.includes(ver.ordenar) ? ver.ordenar : ORDENAR[0];
  const todos = fontes.flatMap((fonte) => tarefasDoEspaco(fonte, email, hoje));
  const emOrdem = emMinhaOrdem(todos, ver.ordemPessoal ?? null);
  const ordenados = ordenar === "data" ? [...todos].sort(compararPorData) : emOrdem;
  const ocultos = new Set(ver.espacosOcultos ?? []);
  const visiveis = ordenados.filter((i) => !ocultos.has(i.espacoId) && !(ver.ocultarNaoLiberadas && i.naoLiberada));

  let grupos;
  if (agrupar === "prazo") {
    const por = new Map(GRUPOS.map(([c]) => [c, []]));
    for (const i of visiveis) por.get(grupoDe(i, hoje)).push(i);
    grupos = GRUPOS.map(([chave, titulo]) => ({ chave, titulo, itens: por.get(chave) }));
  } else if (agrupar === "espaco") {
    const por = new Map();
    for (const i of visiveis) {
      if (!por.has(i.espacoId)) por.set(i.espacoId, { chave: i.espacoId, titulo: i.espacoNome, itens: [] });
      por.get(i.espacoId).itens.push(i);
    }
    grupos = [...por.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  } else {
    grupos = [{ chave: "todas", titulo: "", itens: visiveis }];
  }
  grupos = grupos.filter((g) => g.itens.length);

  const avisos = Object.fromEntries(AVISOS.map(([c]) => [c, todos.filter((i) => i.aviso === c).length]));
  const espacos = [];
  for (const i of todos) {
    const e = espacos.find((x) => x.id === i.espacoId);
    if (e) e.n++; else espacos.push({ id: i.espacoId, nome: i.espacoNome, n: 1 });
  }
  espacos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const urgentes = todos.filter((i) => i.aviso || (i.prazo && i.prazo <= hoje)).length;
  return {
    grupos, ordem: emOrdem.map((i) => i.chave), total: todos.length, visiveis: visiveis.length,
    ocultas: todos.length - visiveis.length, urgentes, avisos, espacos,
  };
}
