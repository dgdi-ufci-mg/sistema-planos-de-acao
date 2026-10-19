/**
 * Campos de cada entidade gravada no banco.
 *
 * Esta lista é o lado "código" do dicionário de dados (especificação, seção 4).
 * O teste `testes/dicionario.test.js` falha se ela divergir das tabelas do
 * dicionário, e o Store recusa gravar campos que não estejam aqui.
 * Mudou um campo? Mude aqui e no dicionário, no mesmo commit.
 */
export const CAMPOS = Object.freeze({
  plano: [
    "id", "nome", "inicio", "prazoFinal", "datasExcluidas", "documentos",
    "simulacoes", "semente", "estrutura", "camposOpcionais",
    "criadoEm", "alteradoEm", "alteradoPor", "excluidoEm", "excluidoPor",
  ],
  dataExcluida: ["data", "motivo"],
  documento: ["nome", "data", "identificacao", "link"],
  fase: ["id", "nome", "etapas"],
  etapa: ["id", "nome"],
  camposOpcionais: ["fasesEtapas", "descricao", "entrega", "notas"],
  acao: [
    "codigo", "ordem", "etapa", "rotulo", "descricao", "entrega",
    "dependeDe", "responsaveis", "estimativas", "concluidaEm", "naoAntesDe", "notas",
    "criadaEm", "alteradaEm", "alteradaPor", "excluidaEm", "excluidaPor",
  ],
  estimativa: ["em", "por", "o", "m", "p", "contaDe", "motivo"],
  retrato: [
    "id", "nome", "origem", "criadoEm", "criadoPor",
    "semente", "simulacoes", "versaoCalculo", "resumo", "acoes",
  ],
  retratoAcao: [
    "codigo", "rotulo", "o", "m", "p", "dependeDe", "situacao", "atrasada",
    "liberacaoPrevista", "conclusaoPrevista", "prioridadeExecucao", "prioridadeRevisao",
  ],
  retratoResumo: ["conclusaoPrevista", "dataSegura", "p95", "chancePrazo"],
  responsavel: [
    "id", "nome", "sigla", "setor", "usuario",
    "criadoEm", "alteradoEm", "alteradoPor", "excluidoEm", "excluidoPor",
  ],
});
