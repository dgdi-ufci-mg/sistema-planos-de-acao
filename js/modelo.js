/**
 * Campos de cada entidade gravada no banco.
 *
 * Esta lista é o lado "código" do dicionário de dados (documentação técnica, seção 4).
 * O teste `testes/dicionario.test.js` falha se ela divergir das tabelas do
 * dicionário, e o Store recusa gravar campos que não estejam aqui.
 * Mudou um campo? Mude aqui e no dicionário, no mesmo commit.
 */
export const CAMPOS = Object.freeze({
  espaco: [
    "id", "nome", "tipo", "programa", "aprovacao", "modelo", "acessos", "fechado", "visibilidade", "administracaoAssumidaPor", "administracaoAssumidaEm", "encerradoEm", "encerradoPor", "nomeacoes", "vinculos", "nomeInicial", "situacoes", "etiquetas", "inicio", "prazoFinal", "datasExcluidas", "datasGeraisDesconsideradas", "documentos",
    "simulacoes", "semente", "estrutura", "camposOpcionais", "tons", "proximoNumero",
    "criadoEm", "alteradoEm", "alteradoPor", "excluidoEm", "excluidoPor",
  ],
  dataExcluida: ["data", "motivo"],
  calendarioGeral: ["datasExcluidas", "alteradoEm", "alteradoPor"],
  documento: ["nome", "data", "identificacao", "link"],
  /** Documento ou link de uma ação (passo 2.10a): como o do espaço, com id, porque muda item a item. */
  documentoDaAcao: ["id", "nome", "data", "identificacao", "link"],
  /** Documento que aprovou o Plano de Ação (passo 2.4a). */
  aprovacao: ["identificacao", "link"],
  /** Situação personalizada do espaço, uma coluna do quadro (passo 2.7). */
  situacao: ["id", "nome"],
  /** Nomeação de administrador num espaço órfão, pelo Administrador do Sistema (passo 2.3). */
  nomeacao: ["email", "por", "em"],
  /** Administradores do Sistema (passo 2.3): documento sistema/administradores, editado só no console. */
  administradoresDoSistema: ["emails"],
  /** Estratégia (passo 2.5): modelo do catálogo, documento sistema/estrategia. */
  modeloEstrategia: ["camadas", "alteradoEm", "alteradoPor"],
  camada: ["id", "nome", "plural", "opcional"],
  /** Instrumento da estratégia (PEI, PDI, uma política…): coleção instrumentos. */
  instrumento: ["id", "nome", "inicio", "fim", "aprovacao", "prorrogacoes", "criadoEm", "alteradoEm", "alteradoPor", "excluidoEm", "excluidoPor"],
  prorrogacao: ["fimAnterior", "fim", "em", "por", "aprovacao"],
  /** Item do catálogo da estratégia: coleção itensEstrategicos. */
  itemEstrategico: ["id", "camada", "codigo", "nome", "instrumento", "superiores", "criadoEm", "alteradoEm", "alteradoPor", "excluidoEm", "excluidoPor"],
  /** Acesso de um e-mail ao espaço (passo 2.1): o papel e o responsável ligado ao e-mail. */
  acesso: ["papel", "responsavel"],
  /** Etiqueta do catálogo do espaço (passo 2.10a): a ação guarda só o id. */
  etiqueta: ["id", "nome", "cor"],
  /** Modelo de configuração do espaço, fixo depois de criado (passo 2.4b). */
  modelo: ["nome", "prazos", "dependencias", "simulacao"],
  fase: ["id", "nome", "etapas"],
  etapa: ["id", "nome"],
  camposOpcionais: ["fasesEtapas", "descricao", "notas", "codigos", "etiquetas", "documentos", "justificativa", "local", "prioridade"],
  acao: [
    "numero", "codigo", "ordem", "etapa", "rotulo", "descricao", "justificativa", "local",
    "dependeDe", "responsaveis", "estimativas", "dataLimite", "situacaoPersonalizada", "concluidaEm", "naoAntesDe", "notas", "checklist", "etiquetas", "documentos", "posicaoPrioridade",
    "criadaEm", "alteradaEm", "alteradaPor", "excluidaEm", "excluidaPor",
  ],
  estimativa: ["em", "por", "o", "m", "p", "contaDe", "motivo"],
  /** Comentário de uma ação (passo 2.9): nunca apagado do banco; editar guarda a versão anterior. */
  comentario: ["id", "acao", "autor", "texto", "criadoEm", "editadoEm", "versoes", "apagadoEm", "apagadoPor", "apagadoComo"],
  comentarioVersao: ["texto", "em"],
  /** Item do checklist da ação (passo 2.8). */
  checklistItem: ["id", "texto", "feito"],
  /** Histórico de alterações das ações (passo 1.16): só de acréscimo. */
  historico: ["id", "entidade", "chave", "tipo", "campo", "antes", "depois", "em", "por"],
  retrato: [
    "id", "nome", "origem", "criadoEm", "criadoPor",
    "semente", "simulacoes", "versaoCalculo", "espaco", "datasExcluidasEfetivas", "responsaveis", "resumo",
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
