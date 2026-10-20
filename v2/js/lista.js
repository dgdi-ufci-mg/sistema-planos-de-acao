/**
 * Lista de ações (especificação, seção 8.3): o que cada linha mostra, filtros,
 * ordenação e agrupamento por fases e etapas. Só regras, sem tela, para ser testado.
 */
import { estimativaVigente } from "./calculo.js";

/** Situações dos filtros, na ordem dos botões. "atrasada" é carimbo, não situação. */
export const FILTROS = ["todas", "liberada", "atrasada", "naoLiberada", "concluida"];

/** Ordenações oferecidas. "espaco" é a ordem cadastrada, com fases e etapas. */
export const ORDENS = ["espaco", "execucao", "revisao", "conclusao"];

/**
 * Junta o cadastro de cada ação com o que foi calculado para ela.
 * @param {object[]} acoes  ações do espaço, já na ordem do espaço
 * @param {{porAcao: Map}} caminho  resultado de caminhoCritico, com `hoje`
 * @param {{porAcao: Map}} simulacao  resultado de simular
 * @param {object} calendario
 * @param {string} hoje  data ISO
 */
export function montarLinhas(acoes, caminho, simulacao, calendario, hoje) {
  return acoes.map((acao) => {
    const c = caminho.porAcao.get(acao.codigo);
    const s = simulacao.porAcao.get(acao.codigo);
    const concluida = c.situacao === "concluida";
    return {
      acao,
      situacao: c.situacao,
      atrasada: Boolean(c.atrasada),
      /** data mínima ainda por vir, para "a partir de" */
      aPartirDe: c.situacao === "naoLiberada" && acao.naoAntesDe > hoje ? acao.naoAntesDe : null,
      conclusao: concluida ? acao.concluidaEm : calendario.dataDeConclusao(c.conclusao, c.liberacao),
      reprogramacoes: Math.max(0, (acao.estimativas?.length ?? 0) - 1),
      execucao: concluida ? null : s.prioridadeExecucao,
      revisao: concluida ? null : s.prioridadeRevisao,
      vigente: estimativaVigente(acao),
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
  }
  return n;
}

/**
 * @param {object[]} linhas
 * @param {{situacao?: string, responsavel?: string, minhas?: string[]}} filtros
 *   minhas: ids dos responsáveis ligados ao usuário ("Minhas ações"); ausente: filtro desligado
 */
export function filtrar(linhas, { situacao = "todas", responsavel = "", minhas } = {}) {
  return linhas.filter((l) =>
    (situacao === "todas" || (situacao === "atrasada" ? l.atrasada : l.situacao === situacao)) &&
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
    conclusao: (a, b) => a.conclusao.localeCompare(b.conclusao) || pos(a) - pos(b),
  }[ordem];
  return [...linhas].sort(comparar);
}

/**
 * Agrupa por fase e etapa, na ordem da estrutura do espaço. Grupos vazios ficam de fora;
 * ações sem etapa (ou com etapa que não existe mais) vão para "Sem fase nem etapa".
 * @returns {{fases: {fase: object, linhas: object[], etapas: {etapa: object, linhas: object[]}[]}[], semEtapa: object[]}}
 */
export function agrupar(linhas, estrutura = []) {
  const conhecidas = new Set(estrutura.flatMap((f) => f.etapas.map((e) => e.id)));
  const fases = estrutura.map((fase) => {
    const etapas = fase.etapas
      .map((etapa) => ({ etapa, linhas: linhas.filter((l) => l.acao.etapa === etapa.id) }))
      .filter((e) => e.linhas.length);
    return { fase, etapas, linhas: etapas.flatMap((e) => e.linhas) };
  }).filter((f) => f.linhas.length);
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
