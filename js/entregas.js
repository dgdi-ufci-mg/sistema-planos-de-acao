/**
 * Entregas do Plano de Ação e registro do alcance (passo 2.6; documentação técnica, seções 4.12 e 16.7).
 * Regras puras: recebem dados e devolvem resultados, sem tela nem banco.
 *
 * - A entrega é um resultado do Plano de Ação como um todo, com um tipo de meta, como no PGD da instituição:
 *   percentual, quantitativa ou entrega padrão (sim ou não).
 * - O alcance é registrado pelo administrador do espaço, com evidência; os registros se acumulam (o mais
 *   recente é o alcance atual) e ninguém os altera.
 * - A situação é escolhida pelo administrador numa lista única de seis valores, válida a qualquer momento.
 * - Encerrar o Plano de Ação exige completar o registro das entregas que ficaram pelo caminho.
 */

/** Tipos de meta (seção 16.7). */
export const TIPOS_DE_META = Object.freeze({
  percentual: { nome: "Percentual", explicacao: "Taxas e proporções. Exemplo: 95% dos pedidos atendidos em até 24 horas." },
  quantitativa: { nome: "Quantitativa", explicacao: "Número absoluto. Exemplo: 10 Procedimentos-Padrão publicados." },
  padrao: { nome: "Entrega padrão", explicacao: "Sim ou não. Exemplo: Relatório de Gestão homologado." },
});

/**
 * Situações da entrega, na ordem da tabela de decisão (seção 16.7).
 * exigeAlcance: só com pelo menos um registro de alcance (que sempre tem evidência);
 * exigeJustificativa: sempre; justificativaAoEncerrar / alcanceAoEncerrar: só para encerrar o espaço.
 */
export const SITUACOES_DA_ENTREGA = Object.freeze({
  naoIniciada: { nome: "Não iniciada", termina: false, justificativaAoEncerrar: true, explicacao: "Nada foi feito ainda." },
  emAndamento: { nome: "Em andamento", termina: false, alcanceAoEncerrar: true, explicacao: "Algo foi feito e a busca continua." },
  alcancada: { nome: "Alcançada", termina: true, exigeAlcance: true, explicacao: "Tudo foi obtido." },
  parcialmenteAlcancada: { nome: "Parcialmente alcançada", termina: true, exigeAlcance: true, exigeJustificativa: true, explicacao: "Parte foi obtida e a busca terminou." },
  naoAlcancada: { nome: "Não alcançada", termina: true, exigeJustificativa: true, explicacao: "Algo foi feito, nada foi obtido e a busca terminou." },
  cancelada: { nome: "Cancelada", termina: true, exigeJustificativa: true, explicacao: "A busca foi interrompida por decisão, como uma mudança de estratégia." },
});
export const SITUACAO_INICIAL_DA_ENTREGA = "naoIniciada";

export const TAMANHO_DO_TITULO = 200;
export const TAMANHO_DA_DESCRICAO = 2000;
export const TAMANHO_DA_UNIDADE = 40;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const LINK = /^https?:\/\/\S+$/i;
const numero = (v) => typeof v === "number" && Number.isFinite(v);
const problema = (codigo, mensagem) => ({ codigo, mensagem });

/** Entregas ativas (sem exclusão lógica), na ordem do espaço. */
export const entregasAtivas = (entregas) => entregas.filter((e) => !e.excluidaEm).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.id.localeCompare(b.id));

/**
 * Confere uma entrega (cadastro). Devolve null ou {codigo, mensagem}.
 * @param {object} e
 */
export function problemaDaEntrega(e) {
  const titulo = String(e.titulo ?? "").trim();
  if (!titulo) return problema("titulo-vazio", "Informe o título da entrega.");
  if (titulo.length > TAMANHO_DO_TITULO) return problema("titulo-longo", `O título passa de ${TAMANHO_DO_TITULO} caracteres.`);
  if (e.descricao && String(e.descricao).length > TAMANHO_DA_DESCRICAO) return problema("descricao-longa", `A descrição passa de ${TAMANHO_DA_DESCRICAO} caracteres.`);
  if (!TIPOS_DE_META[e.tipoMeta]) return problema("tipo-de-meta", "Escolha o tipo de meta: percentual, quantitativa ou entrega padrão.");
  if (e.tipoMeta === "padrao") {
    if (e.meta != null) return problema("meta-na-padrao", "A entrega padrão não tem meta numérica: é sim ou não.");
    if (e.unidade) return problema("unidade-na-padrao", "A entrega padrão não tem unidade.");
  } else {
    if (!numero(e.meta) || e.meta <= 0) return problema("meta-invalida", "Informe a meta, um número maior que zero.");
    if (e.tipoMeta === "percentual" && e.meta > 100) return problema("meta-invalida", "A meta percentual vai até 100%.");
    if (e.tipoMeta === "percentual" && e.unidade) return problema("unidade-no-percentual", "A meta percentual já está em %: sem unidade.");
    if (e.unidade && String(e.unidade).length > TAMANHO_DA_UNIDADE) return problema("unidade-longa", `A unidade passa de ${TAMANHO_DA_UNIDADE} caracteres.`);
  }
  if (e.prazo != null && !DATA.test(e.prazo)) return problema("prazo-invalido", "Prazo inválido.");
  if (e.responsaveis != null && (!Array.isArray(e.responsaveis) || new Set(e.responsaveis).size !== e.responsaveis.length)) return problema("responsaveis-invalidos", "Lista de responsáveis inválida.");
  return null;
}

/** Confere uma evidência: descrição e pelo menos um entre identificação e link. */
export function problemaDaEvidencia(v) {
  if (!String(v?.descricao ?? "").trim()) return problema("evidencia-sem-descricao", "Descreva a evidência.");
  const identificacao = String(v.identificacao ?? "").trim();
  const link = String(v.link ?? "").trim();
  if (!identificacao && !link) return problema("evidencia-sem-referencia", "Informe a identificação no SIPAC/Protocolo ou o link da evidência.");
  if (link && !LINK.test(link)) return problema("link-invalido", "O link da evidência precisa começar com https:// ou http://.");
  return null;
}

/**
 * Confere um registro de alcance da entrega: data, valor conforme o tipo de meta, descrição e pelo menos uma evidência.
 * @param {object} r  registro
 * @param {object} entrega
 */
export function problemaDoRegistro(r, entrega) {
  if (!DATA.test(r.data ?? "")) return problema("data-invalida", "Informe a data do alcance.");
  if (entrega.tipoMeta === "padrao") {
    if (typeof r.valor !== "boolean") return problema("valor-invalido", "Informe se a entrega foi feita (sim ou não).");
  } else {
    if (!numero(r.valor) || r.valor < 0) return problema("valor-invalido", "Informe o valor alcançado, um número a partir de zero.");
    if (entrega.tipoMeta === "percentual" && r.valor > 100) return problema("valor-invalido", "O valor percentual vai até 100%.");
  }
  const descricao = String(r.descricao ?? "").trim();
  if (!descricao) return problema("descricao-vazia", "Descreva o que foi alcançado.");
  if (descricao.length > TAMANHO_DA_DESCRICAO) return problema("descricao-longa", `A descrição passa de ${TAMANHO_DA_DESCRICAO} caracteres.`);
  if (!Array.isArray(r.evidencias) || !r.evidencias.length) return problema("sem-evidencia", "Informe pelo menos uma evidência.");
  for (const v of r.evidencias) {
    const p = problemaDaEvidencia(v);
    if (p) return p;
  }
  if (r.realizadores != null && (!Array.isArray(r.realizadores) || new Set(r.realizadores).size !== r.realizadores.length)) return problema("realizadores-invalidos", "Lista de quem realizou inválida.");
  return null;
}

/** Registros de uma entrega, do mais antigo ao mais recente (data do alcance; no mesmo dia, ordem de registro). */
export const registrosDa = (entregaId, registros) => registros
  .filter((r) => r.entrega === entregaId)
  .sort((a, b) => a.data.localeCompare(b.data) || a.registradoEm.localeCompare(b.registradoEm) || a.id.localeCompare(b.id));

/**
 * Alcance atual: o registro mais recente. Fração da meta: valor ÷ meta (percentual e quantitativa; pode
 * passar de 1), ou 1 e 0 (padrão). Sem registro, null.
 * @returns {{registro: object, valor: number|boolean, fracao: number}|null}
 */
export function alcanceAtual(entrega, registros) {
  const lista = registrosDa(entrega.id, registros);
  const registro = lista[lista.length - 1];
  if (!registro) return null;
  const fracao = entrega.tipoMeta === "padrao" ? (registro.valor ? 1 : 0) : registro.valor / entrega.meta;
  return { registro, valor: registro.valor, fracao };
}

/**
 * Confere a mudança de situação: as exigências que valem a qualquer momento (seção 16.7).
 * @param {object} entrega
 * @param {{situacao: string, justificativa?: string|null}} mudanca
 * @param {object[]} registros  todos os registros de alcance do espaço
 */
export function problemaDaSituacao(entrega, { situacao, justificativa }, registros) {
  const s = SITUACOES_DA_ENTREGA[situacao];
  if (!s) return problema("situacao-invalida", "Situação inválida.");
  if (s.exigeAlcance && !registrosDa(entrega.id, registros).length) return problema("sem-alcance", `Para marcar como “${s.nome}”, registre antes o alcance, com evidência.`);
  if (s.exigeJustificativa && !String(justificativa ?? "").trim()) return problema("sem-justificativa", `Para marcar como “${s.nome}”, escreva a justificativa.`);
  if (justificativa && String(justificativa).length > TAMANHO_DA_DESCRICAO) return problema("justificativa-longa", `A justificativa passa de ${TAMANHO_DA_DESCRICAO} caracteres.`);
  return null;
}

/**
 * Aviso (não impede gravar) quando a situação e o valor alcançado não combinam (seção 16.7).
 * @returns {string|null}
 */
export function avisoDeCoerencia(entrega, situacao, registros) {
  const a = alcanceAtual(entrega, registros);
  if (situacao === "naoIniciada" && a) return "Há registro de alcance, então algo já foi feito: “Não iniciada” é só quando nada foi feito.";
  if (!a) return null;
  if (situacao === "alcancada" && a.fracao < 1) return "O valor alcançado está abaixo da meta, mas a situação diz “Alcançada”.";
  if (situacao === "parcialmenteAlcancada" && a.fracao >= 1) return "O valor alcançado já chega à meta, mas a situação diz “Parcialmente alcançada”.";
  if (situacao === "parcialmenteAlcancada" && a.fracao === 0) return "O valor alcançado é zero, mas a situação diz “Parcialmente alcançada”.";
  if (situacao === "naoAlcancada" && a.fracao > 0) return "Há valor alcançado, mas a situação diz “Não alcançada”.";
  return null;
}

/**
 * O que falta para encerrar um Plano de Ação (seção 16.7): pelo menos uma entrega; justificativa nas
 * "Não iniciada"; registro de alcance (com evidência) nas "Em andamento".
 * @returns {{entrega: object|null, mensagem: string}[]}  vazio: pode encerrar
 */
export function pendenciasParaEncerrar(entregas, registros) {
  const ativas = entregasAtivas(entregas);
  if (!ativas.length) return [{ entrega: null, mensagem: "Cadastre pelo menos uma entrega do Plano de Ação." }];
  const faltas = [];
  for (const e of ativas) {
    const s = SITUACOES_DA_ENTREGA[e.situacao ?? SITUACAO_INICIAL_DA_ENTREGA];
    if (s.justificativaAoEncerrar && !String(e.justificativa ?? "").trim()) faltas.push({ entrega: e, mensagem: `“${e.titulo}” está Não iniciada: escreva a justificativa.` });
    if (s.alcanceAoEncerrar && !registrosDa(e.id, registros).length) faltas.push({ entrega: e, mensagem: `“${e.titulo}” está Em andamento: registre o alcance, com evidência.` });
  }
  return faltas;
}

/** Texto do valor: "150 de 200 processos", "80% de 95%", "Sim"/"Não". */
export function textoDoValor(entrega, valor) {
  if (entrega.tipoMeta === "padrao") return valor ? "Feita" : "Não feita";
  const n = (x) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return entrega.tipoMeta === "percentual" ? `${n(valor)}% de ${n(entrega.meta)}%` : `${n(valor)} de ${n(entrega.meta)}${entrega.unidade ? ` ${entrega.unidade}` : ""}`;
}

/** Texto da meta: "95%", "200 processos", "Sim ou não". */
export function textoDaMeta(entrega) {
  if (entrega.tipoMeta === "padrao") return "Feita ou não feita";
  const n = entrega.meta.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return entrega.tipoMeta === "percentual" ? `${n}%` : `${n}${entrega.unidade ? ` ${entrega.unidade}` : ""}`;
}
