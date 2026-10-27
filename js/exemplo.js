/**
 * Espaço de exemplo, com dados fictícios, para "Ver um exemplo" e para os testes.
 *
 * As datas são relativas ao dia de hoje, para o exemplo ter sempre a mesma
 * forma: ações concluídas, liberadas (uma delas atrasada) e não liberadas.
 * Inspirado num projeto de dados da instituição, mas sem dados reais.
 */

/** Feriados nacionais de data fixa (mês-dia). Os móveis, como o Carnaval, ficam fora do exemplo. */
const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

/** Dias de trabalho antes de hoje em que o exemplo começa. */
const DIAS_ANTES_DE_HOJE = 35;

const dataIso = (d) => d.toISOString().slice(0, 10);

/**
 * Monta as datas do exemplo: `dia(n)` é o n-ésimo dia útil a partir do início.
 * @param {Date} hoje
 */
function calendarioDoExemplo(hoje) {
  const ano = hoje.getUTCFullYear();
  const datasExcluidas = [ano - 1, ano, ano + 1].flatMap((a) =>
    FERIADOS_FIXOS.map((md) => ({ data: `${a}-${md}`, motivo: "Feriado nacional" })),
  );
  const excluida = new Set(datasExcluidas.map((d) => d.data));
  const util = (d) => d.getUTCDay() % 6 !== 0 && !excluida.has(dataIso(d));
  const passo = (d, sentido) => {
    const r = new Date(d);
    do r.setUTCDate(r.getUTCDate() + sentido); while (!util(r));
    return r;
  };
  let inicio = new Date(Date.UTC(ano, hoje.getUTCMonth(), hoje.getUTCDate()));
  if (!util(inicio)) inicio = passo(inicio, 1);
  for (let n = 0; n < DIAS_ANTES_DE_HOJE; n++) inicio = passo(inicio, -1);
  const dias = [inicio];
  const dia = (n) => {
    while (dias.length <= n) dias.push(passo(dias[dias.length - 1], 1));
    return dataIso(dias[n]);
  };
  return { datasExcluidas, dia };
}

const RESPONSAVEIS = [
  { tipo: "pessoa", sigla: "ANA", nome: "Ana Souza", setor: "DGDI", usuario: "ana.souza@ufci.edu.br" },
  { tipo: "pessoa", sigla: "BRL", nome: "Bruno Lima", setor: "DTI", usuario: "bruno.lima@ufci.edu.br" },
  { tipo: "pessoa", sigla: "CAM", nome: "Carla Mendes", setor: "DGDI", usuario: "carla.mendes@ufci.edu.br" },
  { tipo: "pessoa", sigla: "DRO", nome: "Diego Rocha", setor: "DTI", usuario: "diego.rocha@ufci.edu.br" },
  { tipo: "unidade", sigla: "DTI", nome: "Diretoria de Tecnologia da Informação" },
  { tipo: "unidade", sigla: "PF", nome: "Procuradoria Federal junto à UFCI-MG" },
  { tipo: "unidade", sigla: "PROGRAD", nome: "Pró-Reitoria de Graduação" },
];

const ESTRUTURA = [
  { id: "F1", nome: "Fase 1 · Planejamento", etapas: [
    { id: "E11", nome: "Etapa 1.1 · Requisitos e arquitetura" },
    { id: "E12", nome: "Etapa 1.2 · Contratações e normas" },
  ] },
  { id: "F2", nome: "Fase 2 · Execução", etapas: [
    { id: "E21", nome: "Etapa 2.1 · Infraestrutura" },
    { id: "E22", nome: "Etapa 2.2 · Dados" },
  ] },
  { id: "F3", nome: "Fase 3 · Entrega", etapas: [
    { id: "E31", nome: "Etapa 3.1 · Painéis e homologação" },
    { id: "E32", nome: "Etapa 3.2 · Implantação" },
  ] },
];

/**
 * Estimativa no formato do exemplo: [o, m, p, dia em que foi feita, conta de, quem, motivo].
 * O dia é contado em dias úteis desde o início do exemplo.
 */
const ACOES = [
  { codigo: "LEV", rotulo: "Levantar requisitos com as áreas", etapa: "E11", resp: ["ANA", "CAM"],
    descricao: "Entrevistar as pró-reitorias e a secretaria acadêmica para listar indicadores, fontes de dados e restrições de acesso. Entrega esperada: documento de requisitos aprovado.",
    dependeDe: [], est: [[5, 8, 12, 0, "liberacao", "ANA"]], concluidaEm: 8,
    notas: "Requisitos validados em reunião. Ata registrada no SIPAC/Protocolo." },
  { codigo: "ARQ", rotulo: "Definir a arquitetura técnica", etapa: "E11", resp: ["BRL"],
    descricao: "Escolher armazenamento, formato de tabelas, motor de consulta e ferramenta de catálogo.",
    dependeDe: ["LEV"], est: [[6, 9, 15, 8, "liberacao", "BRL"]], concluidaEm: 18 },
  { codigo: "LIC", rotulo: "Contratar licenças e suporte", etapa: "E12", resp: ["DRO", "DTI"],
    descricao: "Instruir o processo de contratação das licenças do catálogo de dados e do suporte técnico.",
    dependeDe: ["LEV"],
    est: [[15, 25, 45, 8, "liberacao", "DRO"], [3, 5, 10, 30, "data", "DRO", "Parecer jurídico pediu ajuste no termo de referência."]],
    notas: "Processo **23001.004512/2026**. Aguardando assinatura da Direção-Geral.\n- Termo de referência ajustado\n- Parecer favorável recebido" },
  { codigo: "INF", rotulo: "Preparar os servidores", etapa: "E21", resp: ["DTI"],
    descricao: "Instalar e configurar os servidores de armazenamento e processamento no datacenter.",
    dependeDe: ["ARQ"], est: [[8, 12, 20, 18, "liberacao", "BRL"]],
    notas: "Depende da liberação de rack pela *DTI*." },
  { codigo: "MOD", rotulo: "Modelar os dados de ensino", etapa: "E22", resp: ["ANA", "BRL"],
    descricao: "Definir as tabelas das camadas bronze, prata e ouro para alunos, cursos e disciplinas.",
    dependeDe: ["ARQ"], est: [[12, 20, 30, 18, "liberacao", "ANA"]] },
  { codigo: "REG", rotulo: "Redigir a norma de uso dos dados", etapa: "E12", resp: ["CAM", "PF"],
    descricao: "Minuta de resolução sobre acesso, anonimização e publicação dos dados acadêmicos.",
    dependeDe: ["LEV"],
    est: [[20, 30, 50, 8, "liberacao", "CAM"], [10, 15, 25, 20, "data", "CAM", "Procuradoria pediu revisão da LGPD."],
      [5, 8, 15, 33, "data", "CAM", "Nova rodada de ajustes após reunião com a PF."]] },
  { codigo: "ING", rotulo: "Ingerir os dados de ensino", etapa: "E22", resp: ["BRL"],
    descricao: "Construir os fluxos de carga do sistema acadêmico para a camada bronze.",
    dependeDe: ["INF", "MOD"], est: [[8, 10, 18, 0, "liberacao", "BRL"]] },
  { codigo: "SEG", rotulo: "Configurar perfis de acesso", etapa: "E21", resp: ["DRO"],
    descricao: "Criar perfis e políticas de acesso por unidade.",
    dependeDe: ["INF"], est: [[5, 8, 12, 0, "liberacao", "DRO"]] },
  { codigo: "PAI", rotulo: "Construir os painéis de indicadores", etapa: "E31", resp: ["ANA", "PROGRAD"],
    descricao: "Painéis de evasão, retenção e conclusão por curso.",
    dependeDe: ["ING", "LIC"], est: [[15, 20, 35, 0, "liberacao", "ANA"]] },
  { codigo: "CAP", rotulo: "Capacitar os usuários", etapa: "E32", resp: ["CAM"],
    descricao: "Oficinas com coordenadores de curso e secretarias.",
    dependeDe: ["PAI", "SEG"], est: [[5, 8, 12, 0, "liberacao", "CAM"]] },
  { codigo: "HOM", rotulo: "Homologar com as áreas", etapa: "E31", resp: ["PROGRAD", "ANA"],
    descricao: "Validação dos números com a PROGRAD e as coordenações.",
    dependeDe: ["PAI"], est: [[5, 10, 20, 0, "liberacao", "ANA"]] },
  { codigo: "LAN", rotulo: "Lançar o repositório", etapa: "E32", resp: ["ANA"],
    descricao: "Evento de lançamento e abertura do acesso à comunidade.",
    dependeDe: ["HOM", "CAP", "REG"], est: [[1, 2, 3, 0, "liberacao", "ANA"]] },
];

/** Prazo final do exemplo, em dias úteis desde o início. */
const PRAZO_FINAL = 88;

/**
 * Grava o espaço de exemplo no Store e devolve o id dele.
 * @param {ReturnType<import("./dados.js").criarStore>} store
 * @param {Date} [hoje]
 */
export async function carregarExemplo(store, hoje = new Date()) {
  const { datasExcluidas, dia } = calendarioDoExemplo(hoje);
  const espacoId = await store.criarEspaco({
    nome: "Exemplo: repositório de dados acadêmicos",
    /* Plano de Ação desde o passo 2.6, para mostrar as entregas; Programa e aprovação fictícios */
    tipo: "planoDeAcao",
    programa: "Programa de Governança de Dados (exemplo)",
    aprovacao: { identificacao: "23001.000123/2026 (fictício)" },
    inicio: dia(0),
    prazoFinal: dia(PRAZO_FINAL),
    datasExcluidas,
    estrutura: ESTRUTURA,
    camposOpcionais: { fasesEtapas: true, descricao: true, notas: true, codigos: false },
  });

  const idPorSigla = {};
  const usuarioPorSigla = {};
  for (const r of RESPONSAVEIS) {
    idPorSigla[r.sigla] = await store.criarResponsavel(espacoId, r);
    usuarioPorSigla[r.sigla] = r.usuario ?? null;
  }

  /* os códigos ficam guardados (aparecem se alguém ligar "Códigos das ações"); as dependências usam os números */
  const numeroPorCodigo = {};
  for (const a of ACOES) {
    numeroPorCodigo[a.codigo] = await store.criarAcao(espacoId, {
      codigo: a.codigo,
      rotulo: a.rotulo,
      etapa: a.etapa,
      descricao: a.descricao,
      dependeDe: a.dependeDe.map((c) => numeroPorCodigo[c]),
      responsaveis: a.resp.map((s) => idPorSigla[s]),
      estimativas: a.est.map(([o, m, p, em, contaDe, sigla, motivo]) => ({
        em: dia(em), por: usuarioPorSigla[sigla], o, m, p, contaDe, ...(motivo ? { motivo } : {}),
      })),
      ...(a.concluidaEm != null ? { concluidaEm: dia(a.concluidaEm) } : {}),
      ...(a.notas ? { notas: a.notas } : {}),
    });
  }

  /* entregas do Plano de Ação (passo 2.6): uma em andamento com alcance, uma padrão e uma ainda não iniciada */
  const paineis = await store.criarEntrega(espacoId, {
    titulo: "Painéis de indicadores acadêmicos publicados", tipoMeta: "quantitativa", meta: 3, unidade: "painéis",
    descricao: "Evasão, retenção e conclusão por curso, abertos às coordenações.", prazo: dia(PRAZO_FINAL), responsaveis: [idPorSigla.ANA, idPorSigla.PROGRAD],
  });
  await store.mudarSituacaoDaEntrega(espacoId, paineis, { situacao: "emAndamento" });
  await store.registrarAlcance(espacoId, paineis, {
    data: dia(30), valor: 1, descricao: "Painel de evasão publicado para as coordenações, em versão de homologação.",
    evidencias: [{ descricao: "Ata da reunião de homologação com a PROGRAD", identificacao: "23001.004600/2026 (fictício)" }],
    realizadores: [idPorSigla.ANA, idPorSigla.PROGRAD],
  });
  const norma = await store.criarEntrega(espacoId, {
    titulo: "Norma de uso dos dados acadêmicos aprovada", tipoMeta: "padrao", prazo: dia(60), responsaveis: [idPorSigla.CAM, idPorSigla.PF],
  });
  await store.mudarSituacaoDaEntrega(espacoId, norma, { situacao: "emAndamento" });
  await store.criarEntrega(espacoId, {
    titulo: "Coordenadores de curso capacitados", tipoMeta: "percentual", meta: 80, prazo: dia(PRAZO_FINAL), responsaveis: [idPorSigla.CAM],
    descricao: "Percentual dos coordenadores de curso que participaram das oficinas.",
  });
  return espacoId;
}

/**
 * Quadro de tarefas de exemplo (passo 3.1): tarefas do dia a dia de uma equipe, nas colunas A fazer, Fazendo,
 * Em revisão e Concluídas, algumas com data-limite (uma vencida). Fictício. Devolve o id.
 * @param {ReturnType<import("./dados.js").criarStore>} store
 * @param {Date} [hoje]
 */
export async function carregarExemploDeQuadro(store, hoje = new Date()) {
  const { dia } = calendarioDoExemplo(hoje);
  const espacoId = await store.criarEspaco({ nome: "Exemplo: tarefas da equipe de dados", inicio: dia(0), tipo: "quadro" });
  const espaco = await store.lerEspaco(espacoId);
  const fazendo = espaco.situacoes.find((s) => s.nome === "Fazendo").id;
  await store.alterarEspaco(espacoId, { situacoes: [...espaco.situacoes, { id: "revisao", nome: "Em revisão" }] });
  const ana = await store.criarResponsavel(espacoId, { tipo: "pessoa", sigla: "ANA", nome: "Ana Souza", usuario: "ana.souza@ufci.edu.br" });
  const bruno = await store.criarResponsavel(espacoId, { tipo: "pessoa", sigla: "BRL", nome: "Bruno Lima", usuario: "bruno.lima@ufci.edu.br" });
  const tarefas = [
    { rotulo: "Responder o ofício da Auditoria Interna", resp: [ana], limite: dia(DIAS_ANTES_DE_HOJE - 2) },
    { rotulo: "Atualizar o dicionário de dados do painel de evasão", resp: [bruno], limite: dia(DIAS_ANTES_DE_HOJE + 5) },
    { rotulo: "Marcar reunião com a PROGRAD", resp: [ana] },
    { rotulo: "Revisar a consulta de matrículas", resp: [bruno], coluna: fazendo, limite: dia(DIAS_ANTES_DE_HOJE + 2) },
    { rotulo: "Preparar a apresentação para o Comitê", resp: [ana, bruno], coluna: fazendo },
    { rotulo: "Relatório mensal de acessos", resp: [bruno], coluna: "revisao" },
    /* concluída: marcada, sem data, e continua na coluna em que estava, como no Trello (revisão de 27/10/2026) */
    { rotulo: "Publicar o boletim de indicadores", resp: [ana], coluna: "revisao", concluida: true },
  ];
  for (const t of tarefas) {
    const n = await store.criarAcao(espacoId, { rotulo: t.rotulo, responsaveis: t.resp, ...(t.limite ? { dataLimite: t.limite } : {}) });
    if (t.coluna) await store.mudarSituacao(espacoId, n, t.coluna);
    if (t.concluida) await store.marcarConclusao(espacoId, n, true);
  }
  return espacoId;
}

/**
 * Exemplo de Lista de tarefas (passo 3.4): tarefas pessoais do dia a dia, uma com data-limite vencida e duas já
 * marcadas como concluídas (escondidas por padrão na lista; o filtro "Mostrar as concluídas" as traz de volta).
 */
export async function carregarExemploDeLista(store, hoje = new Date()) {
  const { dia } = calendarioDoExemplo(hoje);
  const espacoId = await store.criarEspaco({ nome: "Exemplo: minhas tarefas", inicio: dia(0), tipo: "lista" });
  const carla = await store.criarResponsavel(espacoId, { tipo: "pessoa", sigla: "CAR", nome: "Carla Mendes", usuario: "carla.mendes@ufci.edu.br" });
  const tarefas = [
    { rotulo: "Enviar a frequência do mês", limite: dia(DIAS_ANTES_DE_HOJE - 1) },
    { rotulo: "Ler o relatório da CGU", limite: dia(DIAS_ANTES_DE_HOJE + 3) },
    { rotulo: "Agendar a reunião de planejamento" },
    { rotulo: "Responder a pesquisa de clima" },
    { rotulo: "Atualizar o currículo Lattes", concluida: true },
    { rotulo: "Pedir o material de escritório", concluida: true },
  ];
  for (const t of tarefas) {
    const n = await store.criarAcao(espacoId, { rotulo: t.rotulo, responsaveis: [carla], ...(t.limite ? { dataLimite: t.limite } : {}) });
    if (t.concluida) await store.marcarConclusao(espacoId, n, true);
  }
  return espacoId;
}
