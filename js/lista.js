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
      conclusao: concluida ? acao.concluidaEm ?? null : porDataLimite ? acao.dataLimite ?? null : calendario.dataDeConclusao(c.conclusao, c.liberacao),
      reprogramacoes: Math.max(0, (acao.estimativas?.length ?? 0) - 1),
      execucao: semPrioridade ? null : s.prioridadeExecucao,
      revisao: semPrioridade ? null : s.prioridadeRevisao,
      vigente: estimativaVigente(acao),
      /** ação ainda sem estimativa: conta como zero dias no cálculo (seção 5.2); a contínua não tem estimativa (seção 5.9) */
      semEstimativa: !porDataLimite && !concluida && !c.continua && !estimativaVigente(acao),
      /** ação contínua (seção 5.9): datas pelos marcos; fora do caminho crítico e da simulação */
      continua: Boolean(c.continua),
      /** contínua não concluída cujo marco de fim já foi concluído: "Pode ser encerrada" */
      podeEncerrar: Boolean(c.podeEncerrar),
      /** contínua com marco que não existe mais (vale o projeto) ou com o início depois do fim */
      problemaDosMarcos: c.marcoInexistente ? "inexistente" : c.marcosInvertidos ? "invertidos" : null,
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

const DIAS_DA_SEMANA = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
/** Dias corridos de `de` até `ate` (datas ISO), sem efeito de fuso nem de horário de verão. */
const diasEntre = (de, ate) => Math.round((Date.UTC(...ate.split("-").map((n, i) => n - (i === 1))) - Date.UTC(...de.split("-").map((n, i) => n - (i === 1)))) / 86400000);

/**
 * Prazo da tarefa como texto curto, no lugar da barra de tempo, na Lista de tarefas (04/11/2026, pedido do
 * responsável, como no Todoist). Conta dias corridos, porque a pessoa pensa em "amanhã", e não em dias úteis.
 * - hoje: "Hoje"; amanhã: "Amanhã"; ontem: "Ontem";
 * - nos próximos 6 dias: o dia da semana ("sex.");
 * - mais longe, para a frente ou para trás: dia e mês ("7 nov."), com o ano se não for o ano de hoje ("7 nov. 2027").
 * Tom: "vencida" (antes de hoje e não concluída), "hoje", "breve" (amanhã até 6 dias) ou "depois".
 * @param {string|null} data  data-limite, ISO
 * @param {string} hoje  data ISO
 * @param {{concluida?: boolean}} [opcoes]  concluída: nunca vencida (o tom é "depois")
 * @returns {{texto: string, tom: "vencida"|"hoje"|"breve"|"depois", dias: number}|null}
 */
export function prazoDaTarefa(data, hoje, { concluida = false } = {}) {
  if (!data) return null;
  const dias = diasEntre(hoje, data);
  const [ano, mes, dia] = data.split("-").map(Number);
  const semana = DIAS_DA_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  const texto = dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : dias === -1 ? "Ontem"
    : dias > 1 && dias <= 6 ? semana
    : `${dia} ${MESES[mes - 1]}${ano !== Number(hoje.slice(0, 4)) ? ` ${ano}` : ""}`;
  const tom = concluida ? "depois" : dias < 0 ? "vencida" : dias === 0 ? "hoje" : dias <= 6 ? "breve" : "depois";
  return { texto, tom, dias };
}

/**
 * Atalhos da data-limite na janela da tarefa (05/11/2026, pedido do responsável, na comparação com o Todoist): "Hoje",
 * "Amanhã" e "Próxima segunda" (a segunda-feira depois de hoje; se hoje é segunda, a da semana que vem), em dias
 * corridos, como o prazo da lista.
 * @param {string} hoje  data ISO
 * @returns {{rotulo: string, data: string}[]}
 */
export function atalhosDeData(hoje) {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const mais = (n) => new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10);
  const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return [
    { rotulo: "Hoje", data: hoje },
    { rotulo: "Amanhã", data: mais(1) },
    { rotulo: "Próxima segunda", data: mais(((8 - semana) % 7) || 7) },
  ];
}

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** Dia da semana abreviado ("qui") de uma data ISO. */
export function diaDaSemana(data) {
  const [ano, mes, dia] = data.split("-").map(Number);
  return DIAS_CURTOS[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
}

/**
 * Atalhos da janelinha de data na coluna de atributos da tarefa (05/11/2026, pedido do responsável, como no Todoist):
 * "Hoje", "Amanhã", "Este fim de semana" (o sábado da semana; só de segunda a sexta, porque no sábado e no domingo
 * o nome ficaria ambíguo) e "Próxima semana" (a segunda-feira seguinte). Cada um traz o dia ao lado, para a pessoa
 * não precisar calcular: o dia da semana ("qui") e, na próxima semana, também o dia e o mês ("seg 9 nov").
 * @param {string} hoje  data ISO
 * @returns {{rotulo: string, data: string, dia: string}[]}
 */
export function atalhosDoVencimento(hoje) {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const mais = (n) => new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10);
  const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  const segunda = mais(((8 - semana) % 7) || 7);
  const [, mSeg, dSeg] = segunda.split("-").map(Number);
  return [
    { rotulo: "Hoje", data: hoje, dia: diaDaSemana(hoje) },
    { rotulo: "Amanhã", data: mais(1), dia: diaDaSemana(mais(1)) },
    ...(semana >= 1 && semana <= 5 ? [{ rotulo: "Este fim de semana", data: mais(6 - semana), dia: "sáb" }] : []),
    { rotulo: "Próxima semana", data: segunda, dia: `seg ${dSeg} ${MESES_CURTOS[mSeg - 1]}` },
  ];
}

/**
 * Data como aparece na coluna de atributos: "Hoje", "Amanhã" e "Ontem" pelo nome; as demais com o dia da semana,
 * como "09/11/2026 · seg".
 */
export function rotuloDaData(data, hoje) {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const mais = (n) => new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10);
  if (data === hoje) return "Hoje";
  if (data === mais(1)) return "Amanhã";
  if (data === mais(-1)) return "Ontem";
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a} · ${diaDaSemana(data)}`;
}
