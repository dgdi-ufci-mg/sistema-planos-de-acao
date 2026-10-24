/**
 * Lista de ações (documentação técnica, seção 8.3): o que cada linha mostra, filtros,
 * ordenação e agrupamento por fases e etapas. Só regras, sem tela, para ser testado.
 */
import { estimativaVigente } from "./calculo.js";
import { fluxoDe } from "./situacoes.js";
import { compararPrioridade } from "./prioridade.js";

/** Situações dos filtros, na ordem dos botões. "atrasada" é carimbo, não situação. */
export const FILTROS = ["todas", "liberada", "atrasada", "naoLiberada", "concluida"];

/** Ordenações oferecidas. "espaco" é a ordem cadastrada, com fases e etapas. */
export const ORDENS = ["espaco", "prioridade", "execucao", "revisao", "conclusao"];

/**
 * Junta o cadastro de cada ação com o que foi calculado para ela.
 * @param {object[]} acoes  ações do espaço, já na ordem do espaço
 * @param {{porAcao: Map}} caminho  resultado de caminhoCritico, com `hoje`
 * @param {{porAcao: Map}|null} simulacao  resultado de simular; null no espaço sem simulação
 * @param {object} calendario
 * @param {string} hoje  data ISO
 * @param {{prazos?: "estimativa"|"dataLimite", espaco?: object}} [opcoes]  como o espaço define os prazos (js/modelos.js);
 *   espaco: para as situações personalizadas (js/situacoes.js)
 */
export function montarLinhas(acoes, caminho, simulacao, calendario, hoje, { prazos = "estimativa", espaco = {} } = {}) {
  const porDataLimite = prazos === "dataLimite"; // passo 2.4b: sem estimativas, a data prevista é a data-limite
  return acoes.map((acao) => {
    const c = caminho.porAcao.get(acao.numero);
    const s = simulacao?.porAcao.get(acao.numero); // sem simulação no espaço, sem prioridades
    const concluida = c.situacao === "concluida";
    /* sem estimativa, as prioridades sairiam de uma duração zero: não são mostradas (passo 1.14a) */
    const semPrioridade = concluida || !s || !estimativaVigente(acao);
    return {
      acao,
      situacao: c.situacao,
      /** onde está no fluxo: "naoLiberada", "inicial", id de situação personalizada ou "concluida" (passo 2.7) */
      fluxo: fluxoDe(acao, c.situacao, espaco),
      atrasada: Boolean(c.atrasada),
      /** atrasada: dia em que a conclusão prevista venceu */
      vencidaEm: c.atrasada ? c.vencidaEm : null,
      /** data mínima ainda por vir, para "a partir de" */
      aPartirDe: c.situacao === "naoLiberada" && acao.naoAntesDe > hoje ? acao.naoAntesDe : null,
      conclusao: concluida ? acao.concluidaEm : porDataLimite ? acao.dataLimite ?? null : calendario.dataDeConclusao(c.conclusao, c.liberacao),
      reprogramacoes: Math.max(0, (acao.estimativas?.length ?? 0) - 1),
      execucao: semPrioridade ? null : s.prioridadeExecucao,
      revisao: semPrioridade ? null : s.prioridadeRevisao,
      vigente: estimativaVigente(acao),
      /** ação ainda sem estimativa: conta como zero dias no cálculo (seção 5.2) */
      semEstimativa: !porDataLimite && !concluida && !estimativaVigente(acao),
    };
  });
}

/** Conta as linhas de cada filtro de situação. */
export function contar(linhas) {
  const n = Object.fromEntries(FILTROS.map((f) => [f, 0]));
  for (const l of linhas) {
    n.todas++;
    n[l.situacao]++;
    if (l.atrasada) n.atrasada++;
    /* situações personalizadas (passo 2.7): "fluxo:<id>" e "fluxo:inicial" */
    if (l.situacao === "liberada" && l.fluxo) n[`fluxo:${l.fluxo}`] = (n[`fluxo:${l.fluxo}`] ?? 0) + 1;
  }
  return n;
}

/**
 * @param {object[]} linhas
 * @param {{situacao?: string, responsavel?: string, minhas?: string[], etiqueta?: string}} filtros
 *   minhas: ids dos responsáveis ligados ao usuário ("Minhas ações"); ausente: filtro desligado
 *   etiqueta: id de uma etiqueta do espaço (passo 2.10a); vazio: filtro desligado
 */
export function filtrar(linhas, { situacao = "todas", responsavel = "", minhas, etiqueta = "" } = {}) {
  return linhas.filter((l) =>
    (!etiqueta || (l.acao.etiquetas ?? []).includes(etiqueta)) &&
    (situacao === "todas" || (situacao === "atrasada" ? l.atrasada : situacao.startsWith("fluxo:") ? `fluxo:${l.fluxo}` === situacao : l.situacao === situacao)) &&
    (!responsavel || l.acao.responsaveis.includes(responsavel)) &&
    (!minhas || l.acao.responsaveis.some((id) => minhas.includes(id))));
}

/** Ordena sem alterar a lista recebida. Empates seguem a ordem do espaço. */
export function ordenar(linhas, ordem = "espaco") {
  const pos = (l) => l.acao.ordem;
  const desc = (campo) => (a, b) => (b[campo] ?? -1) - (a[campo] ?? -1) || pos(a) - pos(b);
  const comparar = {
    espaco: (a, b) => pos(a) - pos(b),
    execucao: desc("execucao"),
    revisao: desc("revisao"),
    /* sem data (ação sem data-limite, passo 2.4b): vai para o fim */
    conclusao: (a, b) => (a.conclusao ?? "\uffff").localeCompare(b.conclusao ?? "\uffff") || pos(a) - pos(b),
    /* prioridade da equipe (passo 2.10a): pela chave; sem chave, no fim, na ordem do espaço */
    prioridade: (a, b) => compararPrioridade(a.acao, b.acao),
  }[ordem];
  return [...linhas].sort(comparar);
}

/**
 * Agrupa por fase e etapa, na ordem da estrutura do espaço. Grupos vazios ficam de fora;
 * ações sem etapa (ou com etapa que não existe mais) vão para "Sem fase nem etapa".
 * vazias: inclui as etapas sem ações (para a linha de criação rápida de cada etapa).
 * @returns {{fases: {fase: object, linhas: object[], etapas: {etapa: object, linhas: object[]}[]}[], semEtapa: object[]}}
 */
export function agrupar(linhas, estrutura = [], { vazias = false } = {}) {
  const conhecidas = new Set(estrutura.flatMap((f) => f.etapas.map((e) => e.id)));
  const fases = estrutura.map((fase) => {
    const etapas = fase.etapas
      .map((etapa) => ({ etapa, linhas: linhas.filter((l) => l.acao.etapa === etapa.id) }))
      .filter((e) => vazias || e.linhas.length);
    return { fase, etapas, linhas: etapas.flatMap((e) => e.linhas) };
  }).filter((f) => (vazias ? f.etapas.length : f.linhas.length));
  return { fases, semEtapa: linhas.filter((l) => !conhecidas.has(l.acao.etapa)) };
}

/** Resumo de um grupo: total, concluídas, atrasadas e a data em que o grupo termina. */
export function resumir(linhas) {
  return {
    total: linhas.length,
    concluidas: linhas.filter((l) => l.situacao === "concluida").length,
    atrasadas: linhas.filter((l) => l.atrasada).length,
    termina: linhas.reduce((max, l) => (l.conclusao > max ? l.conclusao : max), ""),
  };
}
