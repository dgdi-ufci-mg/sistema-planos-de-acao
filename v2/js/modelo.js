/**
 * Campos de cada entidade gravada no banco.
 *
 * Esta lista é o lado "código" do dicionário de dados (especificação, seção 4).
 * O teste `testes/dicionario.test.js` falha se ela divergir das tabelas do
 * dicionário, e o Store recusa gravar campos que não estejam aqui.
 * Mudou um campo? Mude aqui e no dicionário, no mesmo commit.
 */
export const CAMPOS = Object.freeze({
  espaco: [
    "id", "nome", "inicio", "prazoFinal", "datasExcluidas", "documentos",
    "simulacoes", "semente", "estrutura", "camposOpcionais", "tons", "proximoNumero",
    "criadoEm", "alteradoEm", "alteradoPor", "excluidoEm", "excluidoPor",
  ],
  dataExcluida: ["data", "motivo"],
  documento: ["nome", "data", "identificacao", "link"],
  fase: ["id", "nome", "etapas"],
  etapa: ["id", "nome"],
  camposOpcionais: ["fasesEtapas", "descricao", "notas", "codigos"],
  acao: [
    "numero", "codigo", "ordem", "etapa", "rotulo", "descricao",
    "dependeDe", "responsaveis", "estimativas", "concluidaEm", "naoAntesDe", "notas",
    "criadaEm", "alteradaEm", "alteradaPor", "excluidaEm", "excluidaPor",
  ],
  estimativa: ["em", "por", "o", "m", "p", "contaDe", "motivo"],
  retrato: [
    "id", "nome", "origem", "criadoEm", "criadoPor",
    "semente", "simulacoes", "versaoCalculo", "espaco", "responsaveis", "resumo",
  ],
  /** Cada ação do retrato: todos os campos de `acao` mais estes valores calculados. */
  retratoAcaoCalculos: [
    "situacao", "atrasada", "liberacaoPrevista", "conclusaoPrevista",
    "folga", "prioridadeExecucao", "prioridadeRevisao",
  ],
  retratoResumo: ["conclusaoPrevista", "dataSegura", "p95", "chancePrazo"],
  responsavel: [
    "id", "tipo", "nome", "sigla", "setor", "usuario",
    "criadoEm", "alteradoEm", "alteradoPor", "excluidoEm", "excluidoPor",
  ],
});
