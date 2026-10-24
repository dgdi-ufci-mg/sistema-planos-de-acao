/**
 * Store: o único caminho entre as telas e o banco (documentação técnica, seção 3.4).
 *
 * Oferece operações com nomes do próprio sistema e aplica as regras que valem
 * para qualquer banco: validação, carimbos de data e autor, campos imutáveis.
 * Quem executa as operações é o banco recebido (por enquanto, o banco em memória).
 */
import { ErroDeDados } from "./banco/local.js";
import { CAMPOS } from "./modelo.js";
import { ajustarTons } from "./responsaveis.js";
import { ordenarPorDependencia } from "./calculo.js";
import { registrosDaMudanca } from "./historico.js";
import { montarRetrato } from "./retrato.js";
import { problemaDoTipo, tipoDe } from "./tipos.js";
import { problemaDaEntrega, problemaDoRegistro, problemaDaSituacao, pendenciasParaEncerrar, entregasAtivas, registrosDa, SITUACAO_INICIAL_DA_ENTREGA } from "./entregas.js";
import { problemaDoModelo, modeloDe } from "./modelos.js";
import { problemaDasSituacoes, personalizadasDe } from "./situacoes.js";
import { chaveValida, planejarMovimento } from "./prioridade.js";
import { camadasDe, problemaDasCamadas, problemaDoInstrumento, problemaDoItem, problemaDosVinculos, subordinadosDe } from "./estrategia.js";
import { encerrado, podeVer, participa, problemaDaVisibilidade, permissoes, problemaDosAcessos, semAdministracao, acessosAoAssumir, administradores, papelValido, emailNormal, nomeDoPapel } from "./papeis.js";
import { problemaDasEtiquetas, etiquetasDe, proximaCor, etiquetaPorNome, TAMANHO_DO_NOME } from "./etiquetas.js";

export { ErroDeDados };

/** Padrões de um espaço novo (documentação técnica, seções 4.1 e 5.7). */
export const SIMULACOES_PADRAO = 10000;
export const SEMENTE_PADRAO = 20261014;

/** Código mnemônico da ação, opcional: de 2 a 8 letras maiúsculas ou números (seções 4.2 e 8.3). */
const CODIGO_VALIDO = /^[A-Z0-9]{2,8}$/;

/** Campos que não mudam depois de criados. */
const FIXOS_DO_ESPACO = ["id", "semente", "simulacoes", "criadoEm", "tons", "proximoNumero", "modelo", "acessos", "administracaoAssumidaPor", "administracaoAssumidaEm", "encerradoEm", "encerradoPor", "nomeacoes"]; // acessos: por definirPapel e assumirAdministracao (passo 2.1); encerramento e nomeações: operações próprias (passo 2.3) // modelo: fixo depois de criado (passo 2.4b) // tons e proximoNumero: o sistema cuida deles
const FIXOS_DA_ACAO = ["numero", "criadaEm"];

/** Código mnemônico: de 2 a 8 letras maiúsculas ou números, sem repetir no espaço. */
function validarCodigo(codigo, outrasAcoes) {
  if (!CODIGO_VALIDO.test(codigo)) throw new ErroDeDados("codigo-invalido", "O código deve ter de 2 a 8 letras maiúsculas ou números.");
  const dona = outrasAcoes.find((a) => a.codigo === codigo);
  /* o código de uma ação excluída continua reservado (seção 4.7) */
  if (dona?.excluidaEm) throw new ErroDeDados("codigo-ocupado", `O código ${codigo} é de uma ação na lixeira ("${dona.rotulo}"). Restaure-a ou escolha outro código.`);
  if (dona) throw new ErroDeDados("codigo-ocupado", `Já existe uma ação com o código ${codigo}. Escolha outro.`);
}

/** Exclusão lógica (seção 4.7): itens excluídos ficam no banco, fora das operações comuns. */
const ativa = (a) => !a.excluidaEm;
const ativo = (x) => !x.excluidoEm;

/**
 * @typedef {object} OpcoesDoStore
 * @property {() => string} [agora]   momento atual, em ISO 8601 (substituível nos testes)
 * @property {string|null} [usuario]  quem está gravando (muda com definirUsuario, ao entrar e sair)
 * @property {boolean} [exigirLogin]  recusa gravações sem login (banco compartilhado; no exemplo, não)
 * @property {() => string} [novoId]  gerador de identificadores
 * @property {() => string} [hoje]    data de hoje, ISO, no fuso do aparelho (substituível nos testes)
 */

/** Data de hoje no fuso do aparelho, em ISO (AAAA-MM-DD). */
export function hojeLocal() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

/** Três pontos em dias úteis inteiros: 0 ≤ otimista ≤ mais provável ≤ pessimista, pessimista > 0. */
function validarEstimativa({ o, m, p }) {
  if (![o, m, p].every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0)) {
    throw new ErroDeDados("estimativa-invalida", "Informe os três prazos em dias úteis, com números a partir de zero.");
  }
  if (![o, m, p].every(Number.isInteger)) {
    throw new ErroDeDados("estimativa-fracionada", "Use números inteiros de dias úteis.");
  }
  if (!(o <= m && m <= p)) {
    throw new ErroDeDados("estimativa-fora-de-ordem", "O otimista não pode passar do mais provável, nem este do pessimista.");
  }
  if (p === 0) throw new ErroDeDados("estimativa-zerada", "O prazo pessimista precisa ser maior que zero.");
}

/**
 * @param {ReturnType<import("./banco/local.js").criarBancoLocal>} banco
 * @param {OpcoesDoStore} [opcoes]
 */
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Regras do espaço (seção 4.1), conferidas no espaço inteiro, como ficaria depois da gravação:
 * nome; datas; prazo final não antes do início; datas excluídas sem repetir; fases e etapas com
 * nome e identificadores únicos; documentos com nome e link seguro; campos de cada item no dicionário.
 */
function validarEspaco(e, recusarDesconhecidos) {
  if (!e.nome?.trim()) throw new ErroDeDados("nome-vazio", "Informe o nome do espaço.");
  for (const campo of ["inicio", "prazoFinal"]) {
    if (e[campo] && !DATA_ISO.test(e[campo])) throw new ErroDeDados("data-invalida", "Data inválida.");
  }
  if (e.inicio && e.prazoFinal && e.prazoFinal < e.inicio) {
    throw new ErroDeDados("prazo-antes-do-inicio", "O prazo final não pode ser antes do início.");
  }
  validarDatasExcluidas(e.datasExcluidas, recusarDesconhecidos);
  for (const d of e.datasGeraisDesconsideradas ?? []) {
    if (!DATA_ISO.test(d)) throw new ErroDeDados("data-invalida", "Data desconsiderada inválida.");
  }
  const ids = new Set();
  for (const f of e.estrutura ?? []) {
    recusarDesconhecidos(f, "fase");
    for (const item of [f, ...(f.etapas ?? [])]) {
      if (item !== f) recusarDesconhecidos(item, "etapa");
      if (!item.id || ids.has(item.id)) throw new ErroDeDados("id-repetido", "Fase ou etapa com identificador repetido.");
      ids.add(item.id);
      if (!item.nome?.trim()) throw new ErroDeDados("nome-vazio", "Toda fase e toda etapa precisam de nome.");
    }
  }
  for (const doc of e.documentos ?? []) {
    recusarDesconhecidos(doc, "documento");
    if (!doc.nome?.trim()) throw new ErroDeDados("nome-vazio", "Todo documento precisa de nome.");
    if (doc.data && !DATA_ISO.test(doc.data)) throw new ErroDeDados("data-invalida", "Data do documento inválida.");
    if (doc.link && !/^https?:\/\/\S+$/i.test(doc.link)) throw new ErroDeDados("link-invalido", "O link do documento deve começar com https:// ou http://.");
  }
  if (e.camposOpcionais) recusarDesconhecidos(e.camposOpcionais, "camposOpcionais");
  if (e.aprovacao) recusarDesconhecidos(e.aprovacao, "aprovacao");
  const tipo = problemaDoTipo(e); // tipo de espaço e o que ele exige (passo 2.4a)
  if (tipo) throw new ErroDeDados(tipo.codigo, tipo.mensagem);
  if (e.modelo) recusarDesconhecidos(e.modelo, "modelo");
  const modelo = problemaDoModelo(e.modelo); // passo 2.4b
  if (modelo) throw new ErroDeDados(modelo.codigo, modelo.mensagem);
  for (const s of e.situacoes ?? []) recusarDesconhecidos(s, "situacao"); // passo 2.7
  for (const a of Object.values(e.acessos ?? {})) recusarDesconhecidos(a ?? {}, "acesso"); // passo 2.1
  const acessos = problemaDosAcessos(e);
  if (acessos) throw new ErroDeDados(acessos.codigo, acessos.mensagem);
  for (const n of e.nomeacoes ?? []) recusarDesconhecidos(n, "nomeacao"); // passo 2.3
  const visibilidade = problemaDaVisibilidade(e); // passo 2.2
  if (visibilidade) throw new ErroDeDados(visibilidade.codigo, visibilidade.mensagem);
  if (e.fechado != null && typeof e.fechado !== "boolean") throw new ErroDeDados("valor-invalido", "Aberto ou fechado: informe sim ou não.");
  const situacoes = problemaDasSituacoes(e);
  if (situacoes) throw new ErroDeDados(situacoes.codigo, situacoes.mensagem);
  for (const x of e.etiquetas ?? []) recusarDesconhecidos(x, "etiqueta"); // passo 2.10a
  const etiquetas = problemaDasEtiquetas(e);
  if (etiquetas) throw new ErroDeDados(etiquetas.codigo, etiquetas.mensagem);
}

/** Lista de datas excluídas: data válida, sem repetir, só com os campos do dicionário. */
function validarDatasExcluidas(lista, recusarDesconhecidos) {
  const vistas = new Set();
  for (const d of lista ?? []) {
    recusarDesconhecidos(d, "dataExcluida");
    if (!DATA_ISO.test(d.data ?? "")) throw new ErroDeDados("data-invalida", "Informe a data excluída.");
    if (vistas.has(d.data)) throw new ErroDeDados("data-repetida", `A data ${d.data.split("-").reverse().join("/")} aparece duas vezes.`);
    vistas.add(d.data);
  }
}

/** Login ligado a um responsável: um e-mail, e de um responsável só (seção 4.5). */
function validarLogin(login, outros) {
  const email = login.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroDeDados("login-invalido", "Informe o e-mail de login, como nome@ufci.edu.br.");
  const dono = outros.find((r) => r.usuario === email);
  if (dono) throw new ErroDeDados("login-ocupado", `Este e-mail já está ligado a ${dono.nome}.`);
}

/** Responsável: tipo "pessoa" ou "unidade"; só pessoa pode ter login (seção 4.5). */
function validarTipo({ tipo, usuario }) {
  if (tipo !== "pessoa" && tipo !== "unidade") {
    throw new ErroDeDados("tipo-invalido", 'Informe se o responsável é "pessoa" ou "unidade".');
  }
  if (tipo === "unidade" && usuario) throw new ErroDeDados("unidade-com-login", "Só uma pessoa pode ter login.");
}

export function criarStore(banco, opcoes = {}) {
  const agora = opcoes.agora ?? (() => new Date().toISOString());
  let usuario = opcoes.usuario ?? null;
  let conectado = true;
  const novoId = opcoes.novoId ?? (() => globalThis.crypto.randomUUID());
  const hoje = opcoes.hoje ?? hojeLocal;
  const carimbo = () => ({ alteradaEm: agora(), alteradaPor: usuario });
  /** Histórico de alterações (passo 1.16): o banco chama com a ação antes e depois, e grava os registros junto. */
  const hist = (antes, depois) => registrosDaMudanca(antes, depois, { em: agora(), por: usuario, novoId });
  const exigirAcao = async (espacoId, numero) => {
    const acao = await banco.lerAcao(espacoId, numero);
    if (!acao) throw new ErroDeDados("nao-encontrado", `Ação ${numero} não encontrada.`);
    return acao;
  };

  /** Recusa campos fora do dicionário de dados (documentação técnica, seção 4). */
  const recusarDesconhecidos = (campos, entidade) => {
    const desconhecido = Object.keys(campos).find((campo) => !CAMPOS[entidade].includes(campo));
    if (desconhecido) throw new ErroDeDados("campo-desconhecido", `O campo "${desconhecido}" não existe em ${entidade}.`);
  };

  /**
   * O que o modelo do espaço desliga não pode ser gravado (passo 2.4b): estimativas no espaço com
   * data-limite, data-limite no espaço com estimativas, dependências no espaço sem elas.
   */
  async function conferirModelo(espacoId, campos) {
    if (campos.dataLimite != null && !DATA_ISO.test(campos.dataLimite)) throw new ErroDeDados("data-invalida", "Data-limite inválida.");
    const usa = [campos.estimativas?.length, campos.dataLimite != null, campos.dependeDe?.length].some(Boolean);
    if (!usa) return;
    const m = modeloDe(await banco.lerEspaco(espacoId));
    if (campos.estimativas?.length && m.prazos !== "estimativa") throw new ErroDeDados("recurso-desligado", "Este espaço usa data-limite, e não estimativas.");
    if (campos.dataLimite != null && m.prazos !== "dataLimite") throw new ErroDeDados("recurso-desligado", "Este espaço usa estimativas, e não data-limite.");
    if (campos.dependeDe?.length && !m.dependencias) throw new ErroDeDados("recurso-desligado", "Este espaço não usa dependências entre ações.");
  }

  /**
   * Documento da ação (passo 2.10a): nome obrigatório, até 120 caracteres; identificação ou link;
   * data válida; link seguro (https:// ou http://). Devolve só os campos preenchidos, sem espaços nas pontas.
   */
  const documentoValido = (dados) => {
    const { id: _id, ...campos } = dados ?? {};
    recusarDesconhecidos(campos, "documentoDaAcao");
    const doc = Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, String(v ?? "").trim()]).filter(([, v]) => v));
    if (!doc.nome) throw new ErroDeDados("nome-vazio", "Informe o nome do documento.");
    if (doc.nome.length > 120) throw new ErroDeDados("nome-longo", "O nome do documento passa de 120 caracteres.");
    if (!doc.identificacao && !doc.link) throw new ErroDeDados("documento-vazio", "Informe a identificação no SIPAC/Protocolo ou o link.");
    if (doc.data && !DATA_ISO.test(doc.data)) throw new ErroDeDados("data-invalida", "Data do documento inválida.");
    if (doc.link && !/^https?:\/\/\S+$/i.test(doc.link)) throw new ErroDeDados("link-invalido", "O link deve começar com https:// ou http://.");
    return doc;
  };

  /** Documentos gravados com a ação inteira (restauração, cópias): cada um válido e com id único (passo 2.10a). */
  const conferirDocumentos = (campos) => {
    if (!("documentos" in campos)) return;
    const ids = new Set();
    for (const d of campos.documentos ?? []) {
      documentoValido(d);
      if (!d.id || ids.has(d.id)) throw new ErroDeDados("id-repetido", "Documento da ação com identificador repetido.");
      ids.add(d.id);
    }
  };

  /** Posição na prioridade da equipe (passo 2.10a): chave fracionária válida, ou vazia. */
  const conferirPosicao = (campos) => {
    if (campos.posicaoPrioridade != null && !chaveValida(campos.posicaoPrioridade)) throw new ErroDeDados("posicao-invalida", "Posição de prioridade inválida.");
  };

  /** Etiquetas gravadas na ação inteira (criação, importação): só as do catálogo do espaço, sem repetir (passo 2.10a). */
  async function conferirEtiquetas(espacoId, campos) {
    if (!("etiquetas" in campos)) return;
    const lista = campos.etiquetas ?? [];
    if (!Array.isArray(lista) || new Set(lista).size !== lista.length) throw new ErroDeDados("etiqueta-invalida", "Lista de etiquetas inválida.");
    const catalogo = new Set(etiquetasDe(await banco.lerEspaco(espacoId)).map((x) => x.id));
    if (lista.some((id) => !catalogo.has(id))) throw new ErroDeDados("nao-encontrado", "Etiqueta não encontrada neste espaço.");
  }

  /**
   * Papéis por espaço (passo 2.1; js/papeis.js): recusa o que o papel de quem grava não permite.
   * Sem login e sem exigir login (o exemplo, sem ninguém entrar), não há controle, como antes.
   * @param {"configurar"|"criarAcao"|"excluirAcao"|"priorizar"|"comentar"|"criarResponsavel"|"criarEtiqueta"|"salvarRetrato"|"atualizar"} permissao
   */
  async function exigir(espacoId, permissao, numero = null) {
    const espaco = await banco.lerEspaco(espacoId);
    if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
    /* encerrado (passo 2.3): só leitura para todos, também no exemplo; só reabrir */
    if (encerrado(espaco) && permissao !== "reabrir") throw new ErroDeDados("espaco-encerrado", "Este espaço está encerrado: só consulta. Um administrador do espaço pode reabri-lo.");
    if (!opcoes.exigirLogin) return; // papéis só no banco compartilhado; no exemplo e no modo só na memória, uma pessoa só
    const p = permissoes(espaco, usuario);
    const ok = permissao === "atualizar" ? p.atualizar(numero == null ? null : await banco.lerAcao(espacoId, numero)) : p[permissao];
    if (ok) return;
    if (!p.papel) throw new ErroDeDados("sem-permissao", "Você não tem papel neste espaço. Peça a um administrador do espaço.");
    if (p.papel === "leitor") throw new ErroDeDados("sem-permissao", "Você é Leitor neste espaço: pode consultar e comentar, sem alterar.");
    if (permissao === "atualizar") throw new ErroDeDados("sem-permissao", "Este espaço é fechado: você só atualiza as ações em que é responsável.");
    if (permissao === "priorizar") throw new ErroDeDados("sem-permissao", "Neste espaço fechado, só o administrador muda a prioridade da equipe.");
    throw new ErroDeDados("sem-permissao", "Só o administrador do espaço pode fazer isso.");
  }
  /** Catálogo da estratégia (passo 2.5): camadas, instrumentos e itens ativos. */
  async function catalogo() {
    const [modelo, instrumentos, itens] = await Promise.all([banco.lerModeloEstrategia(), banco.listarColecao("instrumentos"), banco.listarColecao("itensEstrategicos")]);
    return { modelo, camadas: camadasDe(modelo), instrumentos: instrumentos.filter(ativo), itens: itens.filter(ativo) };
  }
  /** Vínculos do Plano de Ação com o catálogo (passo 2.5): itens ativos da camada mais baixa. */
  async function conferirVinculos(campos) {
    if (campos.vinculos == null) return;
    const p = problemaDosVinculos(campos.vinculos, await catalogo());
    if (p) throw new ErroDeDados(p.codigo, p.mensagem);
  }
  /** O Gestor da Estratégia mantém o catálogo; provisoriamente, é o Administrador do Sistema (decisão do responsável, 24/10/2026). */
  async function exigirGestor() {
    if (!(await store.ehGestorDaEstrategia())) throw new ErroDeDados("sem-permissao", "Só o Gestor da Estratégia altera o catálogo.");
  }

  /** Grava campos do espaço, com a validação e o carimbo; sem conferir o papel (uso interno). */
  async function gravarEspaco(id, campos) {
    recusarDesconhecidos(campos, "espaco");
    const atual = await banco.lerEspaco(id);
    if (!atual) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
    validarEspaco({ ...atual, ...campos }, recusarDesconhecidos);
    const mudanca = { ...campos };
    if ("nome" in mudanca) mudanca.nome = mudanca.nome.trim();
    await banco.alterarEspaco(id, { ...mudanca, alteradoEm: agora(), alteradoPor: usuario });
  }
  /**
   * Acessos depois de uma mudança, conferindo que sobra administrador (o último não sai; seção 16.3).
   * Espaço sem administração não muda: lá ainda não há papéis.
   */
  async function mudarAcessos(espacoId, mudanca) {
    const espaco = await banco.lerEspaco(espacoId);
    if (semAdministracao(espaco)) return;
    const acessos = mudanca(structuredClone(espaco.acessos));
    if (!administradores({ acessos }).length) throw new ErroDeDados("ultimo-administrador", "O espaço ficaria sem administrador. Escolha outro administrador antes.");
    await gravarEspaco(espacoId, { acessos });
  }

  /** Texto de um comentário: sem espaços nas pontas, não vazio, até 4.000 caracteres. */
  const textoDoComentario = (texto) => {
    const t = String(texto ?? "").trim();
    if (!t) throw new ErroDeDados("comentario-vazio", "Escreva o comentário.");
    if (t.length > 4000) throw new ErroDeDados("comentario-longo", "O comentário passa de 4.000 caracteres.");
    return t;
  };
  /** Só o autor edita ou apaga; o administrador do espaço também apagará, com os papéis (passo 2.1). */
  const exigirAutor = (c) => {
    if (c.apagadoEm) throw new ErroDeDados("comentario-apagado", "Este comentário foi apagado.");
    if (!usuario || c.autor !== usuario) throw new ErroDeDados("sem-permissao", "Só quem escreveu o comentário pode mudá-lo.");
  };

  /** Campos do cadastro da entrega, aparados; `parcial`: só os que vieram (alteração). */
  const limparEntrega = (d, parcial = false) => {
    const texto = (v) => { const t = String(v ?? "").trim(); return t || null; };
    const e = {
      titulo: String(d.titulo ?? "").trim(), descricao: texto(d.descricao), tipoMeta: d.tipoMeta,
      meta: d.tipoMeta === "padrao" ? null : d.meta ?? null, unidade: d.tipoMeta === "quantitativa" ? texto(d.unidade) : null,
      prazo: d.prazo || null, responsaveis: d.responsaveis ?? [], ...(d.ordem != null ? { ordem: d.ordem } : {}),
      ...(d.continuaDe ? { continuaDe: { espaco: d.continuaDe.espaco, entrega: d.continuaDe.entrega } } : {}),
    };
    if (!parcial) return e;
    const vieram = new Set(Object.keys(d));
    if (vieram.has("tipoMeta")) { vieram.add("meta"); vieram.add("unidade"); }
    return Object.fromEntries(Object.entries(e).filter(([c]) => vieram.has(c)));
  };
  /** Responsáveis citados na entrega ou no registro: os do espaço, ativos. */
  async function conferirResponsaveisDaEntrega(espacoId, ids) {
    if (!ids?.length) return;
    const ativos = new Set((await banco.listarResponsaveis(espacoId)).filter(ativo).map((r) => r.id));
    if (ids.some((id) => !ativos.has(id))) throw new ErroDeDados("responsavel-invalido", "Responsável não encontrado neste espaço.");
  }
  /** Entrega do Plano de Ação a que a ação contribui (passo 2.6): uma entrega ativa do mesmo espaço. */
  async function conferirEntregaDaAcao(espacoId, campos) {
    if (campos.entregaDoPlano == null) return;
    const ativas = entregasAtivas(await banco.listarDoEspaco(espacoId, "entregas"));
    if (!ativas.some((e) => e.id === campos.entregaDoPlano)) throw new ErroDeDados("entrega-invalida", "Entrega do Plano de Ação não encontrada neste espaço.");
  }
  /**
   * Continuação de uma entrega de outro Plano de Ação (passo 2.6, caminho A da seção 16.7): a entrega
   * de origem existe, é de outro Plano de Ação e ainda não foi continuada neste espaço.
   */
  async function conferirContinuacao(espacoId, continuaDe) {
    if (continuaDe == null) return;
    recusarDesconhecidos(continuaDe, "continuacao");
    if (!continuaDe.espaco || !continuaDe.entrega) throw new ErroDeDados("continuacao-invalida", "Continuação inválida.");
    if (continuaDe.espaco === espacoId) throw new ErroDeDados("continuacao-invalida", "A entrega continuada é de outro Plano de Ação.");
    const origem = await banco.lerEspaco(continuaDe.espaco);
    if (!origem || !ativo(origem) || tipoDe(origem) !== "planoDeAcao") throw new ErroDeDados("nao-encontrado", "Plano de Ação de origem não encontrado.");
    if (!entregasAtivas(await banco.listarDoEspaco(continuaDe.espaco, "entregas")).some((e) => e.id === continuaDe.entrega)) {
      throw new ErroDeDados("nao-encontrado", "Entrega de origem não encontrada.");
    }
    const aqui = entregasAtivas(await banco.listarDoEspaco(espacoId, "entregas"));
    if (aqui.some((e) => e.continuaDe?.espaco === continuaDe.espaco && e.continuaDe?.entrega === continuaDe.entrega)) {
      throw new ErroDeDados("ja-continuada", "Esta entrega já é continuada neste Plano de Ação.");
    }
  }
  async function conferirEntrega(espacoId, entrega) {
    const p = problemaDaEntrega(entrega);
    if (p) throw new ErroDeDados(p.codigo, p.mensagem);
    await conferirResponsaveisDaEntrega(espacoId, entrega.responsaveis);
  }

  const recusarFixos = (campos, fixos) => {
    const proibido = Object.keys(campos).find((campo) => fixos.includes(campo));
    if (proibido) throw new ErroDeDados("campo-fixo", `O campo "${proibido}" não pode ser alterado.`);
  };

  /**
   * Refaz os tons das pessoas do espaço depois de mudar quem é responsável (seção 4.1).
   * Grava só o campo `tons`, sem carimbo de alteração: é arrumação do sistema, não edição de alguém.
   */
  async function arrumarTons(espacoId) {
    const [espaco, acoes, responsaveis] = await Promise.all([
      banco.lerEspaco(espacoId), banco.listarAcoes(espacoId), banco.listarResponsaveis(espacoId),
    ]);
    const pessoas = new Set(responsaveis.filter((r) => ativo(r) && r.tipo === "pessoa").map((r) => r.id));
    const emUso = [...new Set(acoes.filter(ativa).sort((a, b) => a.ordem - b.ordem).flatMap((a) => a.responsaveis ?? []))].filter((id) => pessoas.has(id));
    const tons = ajustarTons(espaco.tons, emUso);
    if (JSON.stringify(tons) !== JSON.stringify(espaco.tons ?? {})) await banco.alterarEspaco(espacoId, { tons });
  }

  const store = {
    /** Quem está gravando: o e-mail de quem entrou, ou null. */
    definirUsuario(email) { usuario = email ?? null; },
    get usuario() { return usuario; },
    /** Se este Store aceita gravações agora. */
    get podeGravar() { return conectado && (!opcoes.exigirLogin || Boolean(usuario)); },
    /** Conexão com a internet (só importa no banco compartilhado): sem ela, as gravações são recusadas com aviso. */
    definirConexao(sim) { conectado = Boolean(sim); },
    get conectado() { return conectado; },

    // --- espaços ---
    /** Cria um espaço. Semente e número de simulações ficam fixos daqui em diante. */
    async criarEspaco(dados) {
      recusarDesconhecidos(dados, "espaco");
      recusarFixos(dados, ["acessos", "administracaoAssumidaPor", "administracaoAssumidaEm"]);
      /* quem cria é o primeiro administrador (passo 2.1); sem login (o exemplo), o espaço fica sem papéis */
      if (usuario) dados = { ...dados, acessos: { [emailNormal(usuario)]: { papel: "administrador", responsavel: null } } };
      /* espaço novo é restrito, até o administrador abri-lo (passo 2.2; decisão do responsável, 24/10/2026) */
      dados = { visibilidade: "restrita", ...dados };
      validarEspaco(dados, recusarDesconhecidos);
      await conferirVinculos(dados);
      const { nome, semente = SEMENTE_PADRAO, simulacoes = SIMULACOES_PADRAO, ...outros } = dados;
      const id = novoId();
      await banco.criarEspaco(id, {
        ...outros, nome: nome.trim(), semente, simulacoes,
        criadoEm: agora(), alteradoEm: agora(), alteradoPor: usuario,
      });
      return id;
    },
    /** Espaço ativo; um espaço na lixeira só é lido pela lixeira (null aqui). */
    async lerEspaco(id) {
      const e = await banco.lerEspaco(id);
      return e && ativo(e) ? e : null;
    },
    /** Espaços ativos (seção 4.7: o filtro dos excluídos fica só aqui, no Store). */
    listarEspacos: async () => (await banco.listarEspacos()).filter(ativo),
    async alterarEspaco(id, campos) {
      recusarDesconhecidos(campos, "espaco");
      recusarFixos(campos, FIXOS_DO_ESPACO);
      await exigir(id, "configurar");
      await conferirVinculos(campos);
      await gravarEspaco(id, campos);
    },

    // --- papéis por espaço (passo 2.1; seção 16.3) ---
    /** O que quem está gravando pode fazer neste espaço (para a tela esconder o que não pode). */
    permissoesEm(espaco) {
      if (!opcoes.exigirLogin) return { ...permissoes({ encerradoEm: espaco?.encerradoEm }, "exemplo@local"), livre: false }; // exemplo e modo só na memória: tudo, sem papéis nem aviso (mas encerrado é só leitura)
      return permissoes(espaco, usuario);
    },
    /**
     * Espaço sem administração (criado antes dos papéis): quem tem login assume. Vira administrador;
     * as demais pessoas com e-mail entre os responsáveis viram usuários. Fica registrado quem e quando.
     */
    async assumirAdministracao(espacoId) {
      if (!usuario) throw new ErroDeDados("sem-login", "Entre com seu e-mail e senha para assumir a administração.");
      const espaco = await banco.lerEspaco(espacoId);
      if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      if (!semAdministracao(espaco)) throw new ErroDeDados("ja-administrado", "Este espaço já tem administração.");
      const responsaveis = (await banco.listarResponsaveis(espacoId)).filter(ativo);
      await gravarEspaco(espacoId, { acessos: acessosAoAssumir(usuario, responsaveis), administracaoAssumidaPor: usuario, administracaoAssumidaEm: agora() });
    },
    // --- encerrar e reabrir; Administrador do Sistema e espaço órfão (passo 2.3; seção 16.3) ---
    /** Encerra o espaço: fica só para leitura, sai da lista principal e continua acessível. */
    async encerrarEspaco(espacoId) {
      await exigir(espacoId, "configurar");
      /* Plano de Ação (passo 2.6, seção 16.7): só com as entregas em dia */
      if (tipoDe(await banco.lerEspaco(espacoId)) === "planoDeAcao") {
        const faltas = pendenciasParaEncerrar(await banco.listarDoEspaco(espacoId, "entregas"), await banco.listarDoEspaco(espacoId, "alcances"));
        if (faltas.length) throw new ErroDeDados("entregas-pendentes", `Antes de encerrar, complete o registro das entregas: ${faltas.map((f) => f.mensagem).join(" ")}`);
      }
      await gravarEspaco(espacoId, { encerradoEm: agora(), encerradoPor: usuario });
    },
    async reabrirEspaco(espacoId) {
      const espaco = await banco.lerEspaco(espacoId);
      if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      if (!encerrado(espaco)) throw new ErroDeDados("nao-encerrado", "Este espaço não está encerrado.");
      if (opcoes.exigirLogin && !permissoes(espaco, usuario).reabrir) throw new ErroDeDados("sem-permissao", "Só o administrador do espaço pode reabri-lo.");
      await gravarEspaco(espacoId, { encerradoEm: null, encerradoPor: null });
    },
    /**
     * Se quem está usando é Administrador do Sistema: o e-mail está em sistema/administradores, editado só
     * no console do Firebase. Fora do banco compartilhado (exemplo, modo só na memória), sim.
     */
    async ehAdministradorDoSistema() {
      if (!opcoes.exigirLogin) return true;
      if (!usuario) return false;
      const lista = (await banco.lerAdministradoresDoSistema())?.emails ?? [];
      return lista.map(emailNormal).includes(emailNormal(usuario));
    },
    /**
     * Espaço órfão (seção 16.3): o Administrador do Sistema nomeia um administrador do espaço, a única
     * exceção à regra de que ele não tem passe livre. O sistema não sabe quando um administrador deixou de
     * poder administrar (por exemplo, saiu da instituição): quem nomeia declara, e a nomeação fica registrada
     * no espaço, para sempre, em `nomeacoes` (quem nomeou, quem foi nomeado e quando).
     */
    async nomearAdministrador(espacoId, email) {
      if (!(await store.ehAdministradorDoSistema())) throw new ErroDeDados("sem-permissao", "Só o Administrador do Sistema nomeia administradores para espaços órfãos.");
      const e = emailNormal(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ErroDeDados("login-invalido", "Informe o e-mail de login, como nome@ufci.edu.br.");
      const espaco = await banco.lerEspaco(espacoId);
      if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      const ligado = (await banco.listarResponsaveis(espacoId)).find((r) => ativo(r) && r.usuario === e);
      await gravarEspaco(espacoId, {
        acessos: { ...(espaco.acessos ?? {}), [e]: { papel: "administrador", responsavel: ligado?.id ?? null } },
        nomeacoes: [...(espaco.nomeacoes ?? []), { email: e, por: usuario, em: agora() }],
      });
    },
    // --- estratégia: catálogo do desdobramento do PEI/PDI (passo 2.5; seção 4.11) ---
    /** Gestor da Estratégia: provisoriamente, o Administrador do Sistema. */
    ehGestorDaEstrategia: () => store.ehAdministradorDoSistema(),
    /** Catálogo inteiro: modelo (ou null), camadas (as gravadas ou as de partida), instrumentos e itens ativos. */
    lerCatalogo: () => catalogo(),
    async alterarCamadas(camadas) {
      await exigirGestor();
      for (const c of camadas ?? []) recusarDesconhecidos(c, "camada");
      const p = problemaDasCamadas(camadas);
      if (p) throw new ErroDeDados(p.codigo, p.mensagem);
      const { itens, instrumentos } = await catalogo();
      /* nenhum item fica numa camada retirada, nem com uma ligação que o modelo novo não permite */
      const orfao = itens.find((x) => !camadas.some((c) => c.id === x.camada));
      if (orfao) throw new ErroDeDados("camada-com-itens", `A camada de “${orfao.nome}” ainda tem itens. Mova ou exclua os itens antes de retirá-la.`);
      for (const item of itens) {
        const problema = problemaDoItem(item, { camadas, itens, instrumentos });
        if (problema) throw new ErroDeDados("ligacao-invalida", `Com essas camadas, a ligação de “${item.nome}” deixaria de valer: ${problema.mensagem}`);
      }
      const limpas = camadas.map((c) => ({ id: c.id, nome: c.nome.trim(), plural: c.plural.trim(), opcional: c.opcional }));
      await banco.gravarModeloEstrategia({ camadas: limpas, alteradoEm: agora(), alteradoPor: usuario });
    },
    async criarInstrumento(dados) {
      await exigirGestor();
      recusarDesconhecidos(dados, "instrumento");
      if (dados.aprovacao) recusarDesconhecidos(dados.aprovacao, "aprovacao");
      const p = problemaDoInstrumento(dados);
      if (p) throw new ErroDeDados(p.codigo, p.mensagem);
      const id = novoId();
      await banco.criarNaColecao("instrumentos", id, { ...dados, nome: dados.nome.trim(), fim: dados.fim ?? null, prorrogacoes: [], criadoEm: agora(), alteradoEm: agora(), alteradoPor: usuario });
      return id;
    },
    /** Muda nome, início, fim ou documento de aprovação (para prorrogar, `prorrogarInstrumento`, que registra). */
    async alterarInstrumento(id, campos) {
      await exigirGestor();
      recusarDesconhecidos(campos, "instrumento");
      recusarFixos(campos, ["id", "prorrogacoes", "criadoEm", "excluidoEm", "excluidoPor"]);
      if (campos.aprovacao) recusarDesconhecidos(campos.aprovacao, "aprovacao");
      await banco.mudarNaColecao("instrumentos", id, (atual) => {
        const p = problemaDoInstrumento({ ...atual, ...campos });
        if (p) throw new ErroDeDados(p.codigo, p.mensagem);
        return { ...campos, ...("nome" in campos ? { nome: campos.nome.trim() } : {}), alteradoEm: agora(), alteradoPor: usuario };
      });
    },
    /** Prorroga: muda o fim e registra o fim anterior, quem, quando e o documento que aprovou. */
    async prorrogarInstrumento(id, { fim, aprovacao = null }) {
      await exigirGestor();
      if (aprovacao) recusarDesconhecidos(aprovacao, "aprovacao");
      await banco.mudarNaColecao("instrumentos", id, (atual) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fim ?? "")) throw new ErroDeDados("data-invalida", "Informe a nova data de fim.");
        if (atual.fim && fim <= atual.fim) throw new ErroDeDados("prorrogacao-invalida", "A prorrogação leva o fim para depois do atual.");
        const p = problemaDoInstrumento({ ...atual, fim });
        if (p) throw new ErroDeDados(p.codigo, p.mensagem);
        const registro = { fimAnterior: atual.fim ?? null, fim, em: agora(), por: usuario, ...(aprovacao?.identificacao?.trim() ? { aprovacao } : {}) };
        return { fim, prorrogacoes: [...(atual.prorrogacoes ?? []), registro], alteradoEm: agora(), alteradoPor: usuario };
      });
    },
    async excluirInstrumento(id) {
      await exigirGestor();
      const { itens } = await catalogo();
      const n = itens.filter((x) => x.instrumento === id).length;
      if (n) throw new ErroDeDados("instrumento-com-itens", `O instrumento tem ${n} ${n === 1 ? "item" : "itens"}. Mude ou exclua os itens antes.`);
      await banco.mudarNaColecao("instrumentos", id, () => ({ excluidoEm: agora(), excluidoPor: usuario }));
    },
    async criarItemEstrategico(dados) {
      await exigirGestor();
      recusarDesconhecidos(dados, "itemEstrategico");
      const cat = await catalogo();
      const item = { camada: dados.camada, codigo: String(dados.codigo ?? "").trim(), nome: String(dados.nome ?? "").trim(), instrumento: dados.instrumento ?? null, superiores: dados.superiores ?? [] };
      const p = problemaDoItem(item, cat);
      if (p) throw new ErroDeDados(p.codigo, p.mensagem);
      const id = novoId();
      await banco.criarNaColecao("itensEstrategicos", id, { ...item, criadoEm: agora(), alteradoEm: agora(), alteradoPor: usuario });
      return id;
    },
    /** Muda código, nome ou instrumento (a camada não muda: um item noutra camada é outro item). */
    async alterarItemEstrategico(id, campos) {
      await exigirGestor();
      recusarDesconhecidos(campos, "itemEstrategico");
      recusarFixos(campos, ["id", "camada", "superiores", "criadoEm", "excluidoEm", "excluidoPor"]);
      const cat = await catalogo();
      await banco.mudarNaColecao("itensEstrategicos", id, (atual) => {
        const mudanca = { ...campos, ...("nome" in campos ? { nome: String(campos.nome ?? "").trim() } : {}), ...("codigo" in campos ? { codigo: String(campos.codigo ?? "").trim() } : {}) };
        const p = problemaDoItem({ ...atual, ...mudanca }, cat);
        if (p) throw new ErroDeDados(p.codigo, p.mensagem);
        return { ...mudanca, alteradoEm: agora(), alteradoPor: usuario };
      });
    },
    /** Liga o item a um superior, sem regravar as demais ligações (seção 4.6). */
    async ligarSuperior(id, superior) {
      await exigirGestor();
      const cat = await catalogo();
      await banco.mudarNaColecao("itensEstrategicos", id, (atual) => {
        if ((atual.superiores ?? []).includes(superior)) return {};
        const superiores = [...(atual.superiores ?? []), superior];
        const p = problemaDoItem({ ...atual, superiores }, cat);
        if (p) throw new ErroDeDados(p.codigo, p.mensagem);
        return { superiores, alteradoEm: agora(), alteradoPor: usuario };
      });
    },
    async desligarSuperior(id, superior) {
      await exigirGestor();
      await banco.mudarNaColecao("itensEstrategicos", id, (atual) => ({ superiores: (atual.superiores ?? []).filter((x) => x !== superior), alteradoEm: agora(), alteradoPor: usuario }));
    },
    /** Exclusão lógica; recusa o item com subordinados ou com Planos de Ação ligados a ele. */
    async excluirItemEstrategico(id) {
      await exigirGestor();
      const { itens } = await catalogo();
      const n = subordinadosDe(id, itens).length;
      if (n) throw new ErroDeDados("item-com-subordinados", `O item tem ${n} ${n === 1 ? "subordinado" : "subordinados"}. Desligue-os antes.`);
      const planos = (await banco.listarEspacos()).filter((e) => ativo(e) && (e.vinculos ?? []).includes(id)).length;
      if (planos) throw new ErroDeDados("item-com-planos", `${planos} ${planos === 1 ? "Plano de Ação se liga" : "Planos de Ação se ligam"} a este item. Mude o vínculo deles antes.`);
      await banco.mudarNaColecao("itensEstrategicos", id, () => ({ excluidoEm: agora(), excluidoPor: usuario }));
    },
    /**
     * Grava a importação do catálogo (planejarCatalogo, em js/estrategia.js): primeiro cria e atualiza os itens,
     * depois as ligações, que podem citar linhas novas. Cada linha sozinha: uma que falhe não impede as outras.
     * @returns {{criados: number, atualizados: number, falhas: {linha: number, mensagem: string}[]}}
     */
    async importarCatalogo(plano) {
      await exigirGestor();
      const falhas = [];
      const idDaLinha = new Map();
      let criados = 0;
      let atualizados = 0;
      for (const l of plano.linhas) {
        if (l.tipo !== "novo" && l.tipo !== "atualiza") { if (l.id) idDaLinha.set(l.linha, l.id); continue; }
        try {
          if (l.tipo === "novo") {
            idDaLinha.set(l.linha, await store.criarItemEstrategico({ camada: l.camada, codigo: l.codigo, nome: l.nome, instrumento: l.instrumento ?? null }));
            criados++;
          } else {
            idDaLinha.set(l.linha, l.id);
            await store.alterarItemEstrategico(l.id, { nome: l.nome, ...(l.instrumento ? { instrumento: l.instrumento } : {}) });
            atualizados++;
          }
        } catch (e) { falhas.push({ linha: l.linha, mensagem: e.message }); }
      }
      for (const l of plano.linhas) {
        const id = idDaLinha.get(l.linha);
        if (!id || !l.refs || l.tipo === "igual") continue;
        const desejados = l.refs.map((r) => r.id ?? idDaLinha.get(r.linha)).filter(Boolean);
        try {
          const atual = (await banco.listarColecao("itensEstrategicos")).find((x) => x.id === id);
          for (const s of desejados) if (!(atual.superiores ?? []).includes(s)) await store.ligarSuperior(id, s);
          if (l.tipo === "atualiza") for (const s of atual.superiores ?? []) if (!desejados.includes(s)) await store.desligarSuperior(id, s);
        } catch (e) { falhas.push({ linha: l.linha, mensagem: e.message }); }
      }
      return { criados, atualizados, falhas };
    },

    /** Muda o papel de um e-mail no espaço; null tira o acesso. O último administrador não sai. */
    async definirPapel(espacoId, email, papel) {
      await exigir(espacoId, "configurar");
      const e = emailNormal(email);
      if (papel != null && !papelValido(papel)) throw new ErroDeDados("papel-invalido", `Papel desconhecido: “${papel}”.`);
      const espaco = await banco.lerEspaco(espacoId);
      if (semAdministracao(espaco)) throw new ErroDeDados("sem-administracao", "Assuma a administração do espaço antes de definir papéis.");
      const ligado = (await banco.listarResponsaveis(espacoId)).find((r) => ativo(r) && r.usuario === e);
      if (!espaco.acessos[e] && !ligado) throw new ErroDeDados("nao-encontrado", "Este e-mail não está entre os responsáveis do espaço.");
      await mudarAcessos(espacoId, (acessos) => {
        if (papel == null) delete acessos[e];
        else acessos[e] = { papel, responsavel: ligado?.id ?? acessos[e]?.responsavel ?? null };
        return acessos;
      });
    },

    // --- ações ---
    /**
     * Cria uma ação no fim da ordem do espaço e devolve o número dela (identificador,
     * reservado pelo banco). O código mnemônico é opcional e, se houver, não pode repetir.
     */
    async criarAcao(espacoId, dados) {
      await exigir(espacoId, "criarAcao");
      recusarDesconhecidos(dados, "acao");
      recusarFixos(dados, FIXOS_DA_ACAO);
      const { rotulo, codigo, ...outros } = dados;
      if (!rotulo?.trim()) throw new ErroDeDados("rotulo-vazio", "Informe o nome da ação.");
      await conferirModelo(espacoId, outros);
      await conferirEtiquetas(espacoId, outros);
      await conferirEntregaDaAcao(espacoId, outros);
      conferirDocumentos(outros);
      conferirPosicao(outros);
      for (const e of outros.estimativas ?? []) validarEstimativa(e);
      const acoes = await banco.listarAcoes(espacoId);
      if (codigo) validarCodigo(codigo, acoes);
      const inexistente = (outros.dependeDe ?? []).find((n) => !acoes.some((a) => a.numero === n && ativa(a)));
      if (inexistente) throw new ErroDeDados("nao-encontrado", `Ação ${inexistente} não encontrada.`);
      const ordem = Math.max(0, ...acoes.map((a) => a.ordem ?? 0)) + 1;
      const numero = await banco.reservarNumero(espacoId);
      await banco.criarAcao(espacoId, {
        dependeDe: [], responsaveis: [], estimativas: [],
        ...outros,
        ...(codigo ? { codigo } : {}),
        numero, rotulo: rotulo.trim(), ordem,
        criadaEm: agora(), alteradaEm: agora(), alteradaPor: usuario,
      }, hist);
      if (outros.responsaveis?.length) await arrumarTons(espacoId);
      return numero;
    },
    lerAcao: (espacoId, numero) => banco.lerAcao(espacoId, numero),
    /** Ações do espaço, na ordem do espaço. */
    async listarAcoes(espacoId) {
      const acoes = (await banco.listarAcoes(espacoId)).filter(ativa);
      return acoes.sort((a, b) => a.ordem - b.ordem);
    },
    /** Grava só os campos informados, com data e autor da alteração. */
    async alterarAcao(espacoId, numero, campos) {
      await exigir(espacoId, "atualizar", numero);
      recusarDesconhecidos(campos, "acao");
      recusarFixos(campos, FIXOS_DA_ACAO);
      if ("situacaoPersonalizada" in campos) throw new ErroDeDados("campo-fixo", "A situação muda por mudarSituacao.");
      /* data mínima no futuro: a ação deixa de estar liberada e sai da situação personalizada (passo 2.7) */
      if (campos.naoAntesDe && campos.naoAntesDe > hoje()) campos = { ...campos, situacaoPersonalizada: null };
      await conferirModelo(espacoId, campos);
      await conferirEtiquetas(espacoId, campos);
      await conferirEntregaDaAcao(espacoId, campos);
      conferirDocumentos(campos);
      conferirPosicao(campos);
      if (campos.codigo) validarCodigo(campos.codigo, (await banco.listarAcoes(espacoId)).filter((a) => a.numero !== numero));
      await banco.alterarAcao(espacoId, numero, { ...campos, alteradaEm: agora(), alteradaPor: usuario }, hist);
      if ("responsaveis" in campos) await arrumarTons(espacoId);
    },

    // --- listas da ação: item a item (seção 4.6) ---
    async acrescentarResponsavelNaAcao(espacoId, numero, responsavelId) {
      await exigir(espacoId, "atualizar", numero);
      await banco.acrescentarNaLista(espacoId, numero, "responsaveis", [responsavelId], carimbo(), hist);
      await arrumarTons(espacoId);
    },
    async retirarResponsavelDaAcao(espacoId, numero, responsavelId) {
      await exigir(espacoId, "atualizar", numero);
      await banco.retirarDaLista(espacoId, numero, "responsaveis", [responsavelId], carimbo(), hist);
      await arrumarTons(espacoId);
    },
    // --- etiquetas (passo 2.10a; seção 16.8): catálogo do espaço e etiquetas da ação, uma a uma ---
    /** Cria uma etiqueta no catálogo do espaço e devolve o id. Sem cor, a menos usada. */
    async criarEtiqueta(espacoId, { nome, cor } = {}) {
      await exigir(espacoId, "criarEtiqueta");
      const espaco = await banco.lerEspaco(espacoId);
      if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      const n = String(nome ?? "").trim();
      const id = novoId();
      /* o usuário também cria etiquetas, pela ação: o catálogo só cresce (passo 2.1) */
      await gravarEspaco(espacoId, { etiquetas: [...etiquetasDe(espaco), { id, nome: n, cor: cor ?? proximaCor(espaco) }] });
      return id;
    },
    /** Muda o nome ou a cor de uma etiqueta do catálogo. */
    async alterarEtiqueta(espacoId, id, campos) {
      await exigir(espacoId, "configurar");
      recusarDesconhecidos(campos, "etiqueta");
      recusarFixos(campos, ["id"]);
      const espaco = await banco.lerEspaco(espacoId);
      if (!etiquetasDe(espaco).some((x) => x.id === id)) throw new ErroDeDados("nao-encontrado", "Etiqueta não encontrada neste espaço.");
      const mudanca = { ...campos, ...("nome" in campos ? { nome: String(campos.nome ?? "").trim() } : {}) };
      await store.alterarEspaco(espacoId, { etiquetas: etiquetasDe(espaco).map((x) => (x.id === id ? { ...x, ...mudanca } : x)) });
    },
    /** Retira a etiqueta do catálogo e das ações que a usam. Devolve em quantas ações ativas ela estava. */
    async retirarEtiqueta(espacoId, id) {
      await exigir(espacoId, "configurar");
      const espaco = await banco.lerEspaco(espacoId);
      if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      const com = (await banco.listarAcoes(espacoId)).filter((a) => (a.etiquetas ?? []).includes(id));
      for (const a of com) await banco.retirarDaLista(espacoId, a.numero, "etiquetas", [id], carimbo(), hist);
      await store.alterarEspaco(espacoId, { etiquetas: etiquetasDe(espaco).filter((x) => x.id !== id) });
      return com.filter(ativa).length;
    },
    async acrescentarEtiquetaNaAcao(espacoId, numero, id) {
      await exigir(espacoId, "atualizar", numero);
      const espaco = await banco.lerEspaco(espacoId);
      if (!etiquetasDe(espaco).some((x) => x.id === id)) throw new ErroDeDados("nao-encontrado", "Etiqueta não encontrada neste espaço.");
      await exigirAcao(espacoId, numero);
      await banco.acrescentarNaLista(espacoId, numero, "etiquetas", [id], carimbo(), hist);
    },
    async retirarEtiquetaDaAcao(espacoId, numero, id) {
      await exigir(espacoId, "atualizar", numero);
      await banco.retirarDaLista(espacoId, numero, "etiquetas", [id], carimbo(), hist);
    },
    /**
     * Acrescenta à ação a etiqueta com este nome; se ela não existir, cria no catálogo antes.
     * Devolve o id. É o "+ Acrescentar" da janela da ação.
     */
    async etiquetarAcao(espacoId, numero, nome) {
      await exigir(espacoId, "atualizar", numero);
      const n = String(nome ?? "").trim();
      if (!n) throw new ErroDeDados("nome-vazio", "Escreva o nome da etiqueta.");
      if (n.length > TAMANHO_DO_NOME) throw new ErroDeDados("nome-longo", `O nome da etiqueta passa de ${TAMANHO_DO_NOME} caracteres.`);
      const existente = etiquetaPorNome(await banco.lerEspaco(espacoId), n);
      const id = existente?.id ?? await store.criarEtiqueta(espacoId, { nome: n });
      await store.acrescentarEtiquetaNaAcao(espacoId, numero, id);
      return id;
    },
    // --- prioridade da equipe (passo 2.10a; seção 16.8): chave fracionária, grava só a ação movida ---
    /**
     * Põe a ação entre `depoisDe` e `antesDe` (números das vizinhas na ordem de prioridade; null nas pontas).
     * Na primeira vez, as ações sem posição até a vizinha de cima também recebem a sua (planejarMovimento).
     */
    async priorizar(espacoId, numero, vizinhas = {}) {
      await exigir(espacoId, "priorizar");
      const acoes = (await banco.listarAcoes(espacoId)).filter(ativa);
      if (!acoes.some((a) => a.numero === numero)) throw new ErroDeDados("nao-encontrado", `Ação ${numero} não encontrada.`);
      for (const v of [vizinhas.depoisDe, vizinhas.antesDe]) {
        if (v != null && (v === numero || !acoes.some((a) => a.numero === v))) throw new ErroDeDados("nao-encontrado", `Ação ${v} não encontrada.`);
      }
      for (const g of planejarMovimento(acoes, numero, vizinhas)) {
        await banco.alterarAcao(espacoId, g.numero, { posicaoPrioridade: g.posicaoPrioridade, ...carimbo() }, hist);
      }
    },
    // --- documentos e links da ação (passo 2.10a; seção 16.8): item a item, como o checklist ---
    /** Acrescenta um documento à ação e devolve o id. Precisa de nome e de identificação ou link. */
    async acrescentarDocumentoNaAcao(espacoId, numero, dados) {
      await exigir(espacoId, "atualizar", numero);
      const doc = documentoValido(dados);
      await exigirAcao(espacoId, numero);
      const id = novoId();
      await banco.mudarDocumentos(espacoId, numero, (lista) => [...lista, { id, ...doc }], carimbo(), hist);
      return id;
    },
    /** Troca os dados de um documento da ação (os campos ausentes são apagados). */
    async alterarDocumentoDaAcao(espacoId, numero, id, dados) {
      await exigir(espacoId, "atualizar", numero);
      const doc = documentoValido(dados);
      await banco.mudarDocumentos(espacoId, numero, (lista) => {
        if (!lista.some((d) => d.id === id)) throw new ErroDeDados("nao-encontrado", "Documento não encontrado nesta ação.");
        return lista.map((d) => (d.id === id ? { id, ...doc } : d));
      }, carimbo(), hist);
    },
    async retirarDocumentoDaAcao(espacoId, numero, id) {
      await exigir(espacoId, "atualizar", numero);
      await banco.mudarDocumentos(espacoId, numero, (lista) => lista.filter((d) => d.id !== id), carimbo(), hist);
    },
    // --- checklist da ação (passo 2.8; seção 16.5): item a item, sem regravar os demais ---
    async acrescentarItemNoChecklist(espacoId, numero, texto) {
      await exigir(espacoId, "atualizar", numero);
      const t = String(texto ?? "").trim();
      if (!t) throw new ErroDeDados("checklist-vazio", "Escreva o item do checklist.");
      await exigirAcao(espacoId, numero);
      const id = novoId();
      await banco.mudarChecklist(espacoId, numero, (lista) => [...lista, { id, texto: t, feito: false }], carimbo(), hist);
      return id;
    },
    async marcarItemDoChecklist(espacoId, numero, id, feito) {
      await exigir(espacoId, "atualizar", numero);
      await banco.mudarChecklist(espacoId, numero, (lista) => lista.map((i) => (i.id === id ? { ...i, feito: Boolean(feito) } : i)), carimbo(), hist);
    },
    async alterarItemDoChecklist(espacoId, numero, id, texto) {
      await exigir(espacoId, "atualizar", numero);
      const t = String(texto ?? "").trim();
      if (!t) throw new ErroDeDados("checklist-vazio", "Escreva o item do checklist.");
      await banco.mudarChecklist(espacoId, numero, (lista) => lista.map((i) => (i.id === id ? { ...i, texto: t } : i)), carimbo(), hist);
    },
    async retirarItemDoChecklist(espacoId, numero, id) {
      await exigir(espacoId, "atualizar", numero);
      await banco.mudarChecklist(espacoId, numero, (lista) => lista.filter((i) => i.id !== id), carimbo(), hist);
    },
    // --- comentários da ação (passo 2.9; seção 16.5): com autor e data; nunca apagados do banco ---
    /** Comentários da ação, do mais antigo ao mais novo, inclusive os apagados (a tela mostra só o aviso). */
    async listarComentarios(espacoId, numero) {
      return (await banco.listarComentarios(espacoId, numero)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));
    },
    acompanharComentarios(espacoId, numero, aoMudar) {
      return banco.acompanharComentarios(espacoId, numero, (lista) =>
        aoMudar(lista.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id))));
    },
    async comentar(espacoId, numero, texto) {
      await exigir(espacoId, "comentar");
      const t = textoDoComentario(texto);
      if (!usuario) throw new ErroDeDados("sem-login", "Entre com seu e-mail e senha para comentar.");
      await exigirAcao(espacoId, numero);
      const id = novoId();
      await banco.criarComentario(espacoId, { id, acao: numero, autor: usuario, texto: t, criadoEm: agora(), versoes: [] });
      return id;
    },
    /** Edita o próprio comentário; a versão anterior fica guardada em `versoes`. */
    async editarComentario(espacoId, id, texto) {
      await exigir(espacoId, "comentar");
      const t = textoDoComentario(texto);
      await banco.mudarComentario(espacoId, id, (c) => {
        exigirAutor(c);
        if (c.texto === t) return {};
        return { texto: t, editadoEm: agora(), versoes: [...(c.versoes ?? []), { texto: c.texto, em: c.editadoEm ?? c.criadoEm }] };
      });
    },
    /** "Apaga" o próprio comentário: some da tela, mas fica no banco, com todas as versões. */
    async apagarComentario(espacoId, id) {
      await exigir(espacoId, "comentar");
      const espaco = await banco.lerEspaco(espacoId);
      await banco.mudarComentario(espacoId, id, (c) => {
        /* o administrador do espaço também apaga (esconde) comentários alheios (passo 2.1; seção 16.5) */
        if (!c.apagadoEm && usuario && c.autor !== usuario && permissoes(espaco, usuario).apagarComentarioAlheio) {
          return { apagadoEm: agora(), apagadoPor: usuario, apagadoComo: "administrador" };
        }
        exigirAutor(c);
        return { apagadoEm: agora(), apagadoPor: usuario, apagadoComo: "autor" };
      });
    },

    /** Acrescenta uma ação anterior. Recusa a própria ação, código inexistente e ciclo. */
    async acrescentarDependencia(espacoId, numero, anterior) {
      await exigir(espacoId, "atualizar", numero);
      await conferirModelo(espacoId, { dependeDe: [anterior] });
      const acoes = (await banco.listarAcoes(espacoId)).filter(ativa);
      if (anterior === numero) throw new ErroDeDados("ciclo", "Uma ação não pode depender dela mesma.");
      if (!acoes.some((a) => a.numero === anterior)) throw new ErroDeDados("nao-encontrado", `Ação ${anterior} não encontrada.`);
      const hipotese = acoes.map((a) => (a.numero === numero ? { ...a, dependeDe: [...(a.dependeDe ?? []), anterior] } : a));
      try {
        ordenarPorDependencia(hipotese);
      } catch {
        const nome = (n) => `“${acoes.find((a) => a.numero === n)?.rotulo ?? n}”`;
        throw new ErroDeDados("ciclo", `${nome(anterior)} já depende de ${nome(numero)}, direta ou indiretamente. A dependência criaria um ciclo.`);
      }
      /* anterior ainda não concluída: a ação deixa de estar liberada e volta à situação inicial (passo 2.7; seção 16.2) */
      const sai = !acoes.find((a) => a.numero === anterior).concluidaEm && acoes.find((a) => a.numero === numero)?.situacaoPersonalizada;
      await banco.acrescentarNaLista(espacoId, numero, "dependeDe", [anterior], { ...carimbo(), ...(sai ? { situacaoPersonalizada: null } : {}) }, hist);
    },
    async retirarDependencia(espacoId, numero, anterior) {
      await exigir(espacoId, "atualizar", numero);
      await banco.retirarDaLista(espacoId, numero, "dependeDe", [anterior], carimbo(), hist);
    },

    // --- estimativas e conclusão (seções 4.3, 5.3 e 5.4) ---
    /** Reestimativa: tempo que falta, a partir de hoje; entra no fim do histórico. */
    async reestimar(espacoId, numero, { o, m, p, motivo = "" }) {
      await exigir(espacoId, "atualizar", numero);
      validarEstimativa({ o, m, p });
      await conferirModelo(espacoId, { estimativas: [{ o, m, p }] });
      await exigirAcao(espacoId, numero);
      const estimativa = { em: hoje(), por: usuario, o, m, p, contaDe: "data", ...(motivo.trim() ? { motivo: motivo.trim() } : {}) };
      await banco.acrescentarEstimativa(espacoId, numero, estimativa, carimbo(), hist);
    },
    /**
     * Ajusta a estimativa sem criar histórico: ainda é planejamento, ou é correção de digitação.
     * Quem chama decide se pode (estimativaLivre, em js/acao.js). Sem estimativa, cria a primeira.
     */
    async corrigirEstimativa(espacoId, numero, { o, m, p }) {
      await exigir(espacoId, "atualizar", numero);
      validarEstimativa({ o, m, p });
      await conferirModelo(espacoId, { estimativas: [{ o, m, p }] });
      const { estimativas = [] } = await exigirAcao(espacoId, numero);
      const ultima = estimativas.at(-1);
      const estimativa = { ...ultima, em: hoje(), por: usuario, o, m, p, contaDe: ultima?.contaDe ?? "liberacao" };
      if (!ultima) await banco.acrescentarEstimativa(espacoId, numero, estimativa, carimbo(), hist);
      else await banco.trocarUltimaEstimativa(espacoId, numero, estimativa, estimativas.length, carimbo(), hist);
    },
    /** Registra a conclusão. A data não pode ser futura. */
    async concluir(espacoId, numero, data) {
      await exigir(espacoId, "atualizar", numero);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? "")) throw new ErroDeDados("data-invalida", "Informe a data de conclusão.");
      if (data > hoje()) throw new ErroDeDados("data-futura", "A data de conclusão não pode ser depois de hoje.");
      const atual = await exigirAcao(espacoId, numero);
      /* concluída, sai da personalizada: se a conclusão for desfeita, volta à inicial (passo 2.7) */
      await banco.alterarAcao(espacoId, numero, { concluidaEm: data, ...(atual.situacaoPersonalizada ? { situacaoPersonalizada: null } : {}), ...carimbo() }, hist);
    },
    async desfazerConclusao(espacoId, numero) {
      await exigir(espacoId, "atualizar", numero);
      await exigirAcao(espacoId, numero);
      await banco.alterarAcao(espacoId, numero, { concluidaEm: null, ...carimbo() }, hist);
      /* as seguintes ainda não concluídas deixam de estar liberadas e voltam à inicial (passo 2.7) */
      const seguintes = (await banco.listarAcoes(espacoId)).filter((a) => ativa(a) && !a.concluidaEm && a.situacaoPersonalizada && (a.dependeDe ?? []).includes(numero));
      for (const a of seguintes) await banco.alterarAcao(espacoId, a.numero, { situacaoPersonalizada: null, ...carimbo() }, hist);
    },

    // --- situações personalizadas (passo 2.7; seção 16.2) ---
    /**
     * Põe a ação numa situação personalizada (id) ou de volta na inicial (null). Só para ação liberada:
     * não concluída, com as anteriores concluídas (se o espaço usa dependências) e a data mínima já chegada.
     */
    async mudarSituacao(espacoId, numero, id) {
      await exigir(espacoId, "atualizar", numero);
      const espaco = await banco.lerEspaco(espacoId);
      if (id != null && !personalizadasDe(espaco).some((s) => s.id === id)) throw new ErroDeDados("nao-encontrado", "Situação não encontrada neste espaço.");
      const acoes = (await banco.listarAcoes(espacoId)).filter(ativa);
      const acao = acoes.find((a) => a.numero === numero);
      if (!acao) throw new ErroDeDados("nao-encontrado", `Ação ${numero} não encontrada.`);
      if (acao.concluidaEm) throw new ErroDeDados("situacao-invalida", "A ação já foi concluída. Desfaça a conclusão antes.");
      const anteriores = modeloDe(espaco).dependencias ? acao.dependeDe ?? [] : [];
      const pendente = anteriores.some((n) => !acoes.find((a) => a.numero === n)?.concluidaEm) || (acao.naoAntesDe && acao.naoAntesDe > hoje());
      if (pendente) throw new ErroDeDados("situacao-invalida", "A ação ainda não foi liberada.");
      if ((acao.situacaoPersonalizada ?? null) === (id ?? null)) return;
      await banco.alterarAcao(espacoId, numero, { situacaoPersonalizada: id ?? null, ...carimbo() }, hist);
    },
    /** Retira uma situação personalizada; as ações nela voltam à inicial. Devolve quantas voltaram. */
    async retirarSituacao(espacoId, id) {
      await exigir(espacoId, "configurar");
      const espaco = await banco.lerEspaco(espacoId);
      if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      const nela = (await banco.listarAcoes(espacoId)).filter((a) => a.situacaoPersonalizada === id);
      for (const a of nela) await banco.alterarAcao(espacoId, a.numero, { situacaoPersonalizada: null, ...carimbo() }, hist);
      await store.alterarEspaco(espacoId, { situacoes: personalizadasDe(espaco).filter((s) => s.id !== id) });
      return nela.filter(ativa).length;
    },

    // --- responsáveis: de cada espaço (seção 4.5) ---
    /** Cadastra um responsável no espaço; o e-mail de login não se repete dentro do espaço. */
    async criarResponsavel(espacoId, dados) {
      recusarDesconhecidos(dados, "responsavel");
      const { nome, sigla = "", usuario: login, ...outros } = dados;
      if (!nome?.trim()) throw new ErroDeDados("nome-vazio", "Informe o nome do responsável.");
      validarTipo(dados);
      /* com login, dá acesso ao espaço: só o administrador; sem login, também o usuário (pela janela da ação) */
      await exigir(espacoId, login ? "configurar" : "criarResponsavel");
      if (login) validarLogin(login, (await banco.listarResponsaveis(espacoId)).filter(ativo));
      const id = await banco.criarResponsavel(espacoId, novoId(), {
        ...outros, nome: nome.trim(), sigla: sigla.trim(), ...(login ? { usuario: login.trim().toLowerCase() } : {}),
        criadoEm: agora(), alteradoEm: agora(), alteradoPor: usuario,
      });
      /* pessoa com e-mail ganha papel no espaço: Usuário, ou o que o e-mail já tinha (passo 2.1) */
      if (login) await mudarAcessos(espacoId, (acessos) => ({ ...acessos, [emailNormal(login)]: { papel: acessos[emailNormal(login)]?.papel ?? "usuario", responsavel: id } }));
      return id;
    },
    listarResponsaveis: async (espacoId) => (await banco.listarResponsaveis(espacoId)).filter(ativo),
    /**
     * Altera um responsável. O tipo é fixo: um cadastro feito com o tipo errado é corrigido
     * criando outro e excluindo este com "substituir por" (seções 4.5 e 4.7).
     */
    async alterarResponsavel(espacoId, id, campos) {
      recusarDesconhecidos(campos, "responsavel");
      recusarFixos(campos, ["id", "tipo", "criadoEm"]);
      const todos = await banco.listarResponsaveis(espacoId);
      const atual = todos.find((r) => r.id === id);
      if (!atual) throw new ErroDeDados("nao-encontrado", "Responsável não encontrado.");
      if ("nome" in campos && !campos.nome?.trim()) throw new ErroDeDados("nome-vazio", "Informe o nome do responsável.");
      const mudanca = { ...campos };
      if ("nome" in mudanca) mudanca.nome = mudanca.nome.trim();
      if ("sigla" in mudanca) mudanca.sigla = (mudanca.sigla ?? "").trim();
      if (mudanca.usuario) {
        mudanca.usuario = mudanca.usuario.trim().toLowerCase();
        validarLogin(mudanca.usuario, todos.filter((r) => r.id !== id && ativo(r)));
      } else if ("usuario" in mudanca) mudanca.usuario = null;
      validarTipo({ ...atual, ...mudanca });
      await exigir(espacoId, "configurar");
      /* e-mail trocado: o papel passa para o e-mail novo; o antigo perde o acesso (passo 2.1) */
      const antigo = atual.usuario ? emailNormal(atual.usuario) : null;
      const novo = "usuario" in mudanca ? (mudanca.usuario ? emailNormal(mudanca.usuario) : null) : antigo;
      if (novo !== antigo) {
        await mudarAcessos(espacoId, (acessos) => {
          const papel = (antigo && acessos[antigo]?.responsavel === id ? acessos[antigo].papel : null) ?? acessos[novo]?.papel ?? "usuario";
          if (antigo && acessos[antigo]?.responsavel === id) delete acessos[antigo];
          if (novo) acessos[novo] = { papel, responsavel: id };
          return acessos;
        });
      }
      await banco.alterarResponsavel(espacoId, id, { ...mudanca, alteradoEm: agora(), alteradoPor: usuario });
    },

    // --- calendário geral (seções 4.1.5 e 5.1) ---
    /** Calendário geral; sem cadastro ainda, lista vazia. */
    async lerCalendarioGeral() {
      return (await banco.lerCalendarioGeral()) ?? { datasExcluidas: [] };
    },
    /** Grava a lista inteira de datas do calendário geral, em ordem de data. */
    async alterarCalendarioGeral(datasExcluidas) {
      /* do Administrador do Sistema (passo 2.3; decisão do responsável, 24/10/2026): vale para todos os espaços */
      if (!(await store.ehAdministradorDoSistema())) throw new ErroDeDados("sem-permissao", "Só o Administrador do Sistema muda o calendário geral.");
      validarDatasExcluidas(datasExcluidas, recusarDesconhecidos);
      const ordenadas = [...datasExcluidas].sort((a, b) => a.data.localeCompare(b.data));
      await banco.gravarCalendarioGeral({ datasExcluidas: ordenadas, alteradoEm: agora(), alteradoPor: usuario });
    },

    // --- tempo real ---
    /** Acompanha o espaço; a tela recebe só ações e responsáveis ativos. */
    acompanharEspaco: (espacoId, aoMudar) => banco.acompanharEspaco(espacoId, (foto) => aoMudar({
      ...foto, acoes: foto.acoes.filter(ativa), responsaveis: (foto.responsaveis ?? []).filter(ativo),
    })),

    // --- exclusão lógica e lixeira (seção 4.7; passo 1.15) ---
    /**
     * Exclui a ação. As que dependem dela: com `religar`, passam a depender das anteriores
     * da excluída (a sequência continua); sem, só perdem a dependência.
     */
    async excluirAcao(espacoId, numero, { religar = false } = {}) {
      await exigir(espacoId, "excluirAcao");
      const acoes = (await banco.listarAcoes(espacoId)).filter(ativa);
      const acao = acoes.find((a) => a.numero === numero);
      if (!acao) throw new ErroDeDados("nao-encontrado", `Ação ${numero} não encontrada.`);
      const anteriores = (acao.dependeDe ?? []).filter((n) => acoes.some((a) => a.numero === n));
      for (const d of acoes.filter((a) => (a.dependeDe ?? []).includes(numero))) {
        await banco.retirarDaLista(espacoId, d.numero, "dependeDe", [numero], carimbo(), hist);
        const novas = religar ? anteriores.filter((n) => !(d.dependeDe ?? []).includes(n)) : [];
        if (novas.length) await banco.acrescentarNaLista(espacoId, d.numero, "dependeDe", novas, carimbo(), hist);
      }
      await banco.alterarAcao(espacoId, numero, { excluidaEm: agora(), excluidaPor: usuario, ...carimbo() }, hist);
      if (acao.responsaveis?.length) await arrumarTons(espacoId);
    },
    /** Volta a ação da lixeira; as ligações alteradas na exclusão não são refeitas. */
    async restaurarAcao(espacoId, numero) {
      await exigir(espacoId, "excluirAcao");
      const acoes = await banco.listarAcoes(espacoId);
      const acao = acoes.find((a) => a.numero === numero);
      if (!acao) throw new ErroDeDados("nao-encontrado", `Ação ${numero} não encontrada.`);
      /* anteriores que também foram para a lixeira deixam de valer */
      const vivas = new Set(acoes.filter(ativa).map((a) => a.numero));
      const sobra = (acao.dependeDe ?? []).filter((n) => !vivas.has(n));
      if (sobra.length) await banco.retirarDaLista(espacoId, numero, "dependeDe", sobra, carimbo(), hist);
      await banco.alterarAcao(espacoId, numero, { excluidaEm: null, excluidaPor: null, ...carimbo() }, hist);
      if (acao.responsaveis?.length) await arrumarTons(espacoId);
    },
    /** Exclui o responsável do espaço; nas ações dele, `substituto` entra no lugar ou ele só sai. */
    async excluirResponsavel(espacoId, id, { substituto = null } = {}) {
      await exigir(espacoId, "configurar");
      const todos = (await banco.listarResponsaveis(espacoId)).filter(ativo);
      const excluido = todos.find((r) => r.id === id);
      if (!excluido) throw new ErroDeDados("nao-encontrado", "Responsável não encontrado.");
      /* excluído, perde o acesso ao espaço (passo 2.1); o último administrador não sai */
      if (excluido.usuario) await mudarAcessos(espacoId, (acessos) => { if (acessos[emailNormal(excluido.usuario)]?.responsavel === id) delete acessos[emailNormal(excluido.usuario)]; return acessos; });
      if (substituto && (substituto === id || !todos.some((r) => r.id === substituto))) {
        throw new ErroDeDados("nao-encontrado", "Escolha outro responsável para a substituição.");
      }
      for (const a of (await banco.listarAcoes(espacoId)).filter((x) => ativa(x) && (x.responsaveis ?? []).includes(id))) {
        await banco.retirarDaLista(espacoId, a.numero, "responsaveis", [id], carimbo(), hist);
        if (substituto) await banco.acrescentarNaLista(espacoId, a.numero, "responsaveis", [substituto], carimbo(), hist);
      }
      await banco.alterarResponsavel(espacoId, id, { excluidoEm: agora(), excluidoPor: usuario, alteradoEm: agora(), alteradoPor: usuario });
      await arrumarTons(espacoId);
    },
    async restaurarResponsavel(espacoId, id) {
      const todos = await banco.listarResponsaveis(espacoId);
      const r = todos.find((x) => x.id === id);
      if (!r) throw new ErroDeDados("nao-encontrado", "Responsável não encontrado.");
      await exigir(espacoId, "configurar");
      if (r.usuario) validarLogin(r.usuario, todos.filter((x) => x.id !== id && ativo(x)));
      await banco.alterarResponsavel(espacoId, id, { excluidoEm: null, excluidoPor: null, alteradoEm: agora(), alteradoPor: usuario });
      /* restaurado, volta como Usuário, se o e-mail não tiver outro papel (passo 2.1) */
      if (r.usuario) await mudarAcessos(espacoId, (acessos) => ({ ...acessos, [emailNormal(r.usuario)]: { papel: acessos[emailNormal(r.usuario)]?.papel ?? "usuario", responsavel: id } }));
    },
    /**
     * Retira fases ou etapas que têm ações: as ações vão para `destino` (id de uma etapa que fica)
     * ou ficam sem fase nem etapa (destino null). `ids`: as etapas e, se for o caso, a fase.
     */
    async excluirEtapas(espacoId, ids, { destino = null } = {}) {
      await exigir(espacoId, "configurar");
      const espaco = await banco.lerEspaco(espacoId);
      const fora = new Set(ids);
      const estrutura = (espaco.estrutura ?? [])
        .filter((f) => !fora.has(f.id))
        .map((f) => ({ ...f, etapas: f.etapas.filter((e) => !fora.has(e.id)) }));
      const etapasDeFora = new Set((espaco.estrutura ?? []).flatMap((f) => (fora.has(f.id) ? f.etapas.map((e) => e.id) : f.etapas.filter((e) => fora.has(e.id)).map((e) => e.id))));
      if (destino && (etapasDeFora.has(destino) || !estrutura.some((f) => f.etapas.some((e) => e.id === destino)))) {
        throw new ErroDeDados("nao-encontrado", "Escolha uma etapa que continua no espaço.");
      }
      for (const a of (await banco.listarAcoes(espacoId)).filter((x) => etapasDeFora.has(x.etapa))) {
        await banco.alterarAcao(espacoId, a.numero, { etapa: destino, ...carimbo() }, hist);
      }
      await banco.alterarEspaco(espacoId, { estrutura, alteradoEm: agora(), alteradoPor: usuario });
    },
    async excluirEspaco(id) {
      await exigir(id, "configurar");
      if (!(await store.lerEspaco(id))) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      await banco.alterarEspaco(id, { excluidoEm: agora(), excluidoPor: usuario, alteradoEm: agora(), alteradoPor: usuario });
    },
    async restaurarEspaco(id) {
      await exigir(id, "configurar");
      await banco.alterarEspaco(id, { excluidoEm: null, excluidoPor: null, alteradoEm: agora(), alteradoPor: usuario });
    },
    /** Histórico de alterações de uma ação (passo 1.16), do mais antigo ao mais recente. */
    async listarHistorico(espacoId, numero) {
      /* registros da mesma gravação têm o mesmo momento: ficam na ordem dos campos da ação */
      const posicao = (r) => (r.campo ? CAMPOS.acao.indexOf(r.campo) + 1 : 0);
      return (await banco.listarHistorico(espacoId, numero)).sort((a, b) => a.em.localeCompare(b.em) || posicao(a) - posicao(b));
    },
    // --- restauração da cópia de segurança (passo 1.19b) ---
    /**
     * Confere uma cópia de segurança sem gravar nada e devolve o resumo, ou recusa com o motivo.
     * @returns {{espacos: number, acoes: number, responsaveis: number, retratos: number, registros: number, geradaEm: string}}
     */
    conferirCopia(copia) {
      if (copia?.formato !== "sextante-copia-de-seguranca" || ![1, 2, 3, 4].includes(copia.versao) || !Array.isArray(copia.espacos)) {
        throw new ErroDeDados("copia-invalida", "Este arquivo não é uma cópia de segurança do sistema.");
      }
      const resumo = { espacos: 0, acoes: 0, responsaveis: 0, retratos: 0, registros: 0, geradaEm: copia.geradaEm };
      for (const e of copia.espacos) {
        if (!e?.espaco?.id || !Array.isArray(e.acoes) || !Array.isArray(e.responsaveis)) {
          throw new ErroDeDados("copia-invalida", "A cópia de segurança está incompleta ou danificada.");
        }
        recusarDesconhecidos(e.espaco, "espaco");
        for (const a of e.acoes) recusarDesconhecidos(a, "acao");
        for (const r of e.responsaveis) recusarDesconhecidos(r, "responsavel");
        for (const x of e.entregas ?? []) recusarDesconhecidos(x, "entrega");
        for (const x of e.alcances ?? []) recusarDesconhecidos(x, "registroDeAlcance");
        resumo.espacos++;
        resumo.acoes += e.acoes.length;
        resumo.responsaveis += e.responsaveis.length;
        resumo.retratos += e.retratos?.length ?? 0;
        resumo.registros += e.historico?.length ?? 0;
      }
      return resumo;
    },
    /**
     * Restaura a cópia de segurança, exatamente como estava (ids, números, lixeira, histórico e retratos).
     * Só num banco sem nenhum espaço, nem na lixeira: nunca mistura nem sobrescreve dados.
     */
    async restaurarCopia(copia) {
      const resumo = store.conferirCopia(copia);
      if ((await banco.listarEspacos()).length) {
        throw new ErroDeDados("banco-com-dados", "A restauração só é feita num banco sem nenhum espaço, para não misturar nem sobrescrever dados.");
      }
      if (copia.calendarioGeral && !(await banco.lerCalendarioGeral())) await banco.gravarCalendarioGeral(copia.calendarioGeral);
      /* catálogo da estratégia (passo 2.5): só num banco sem catálogo, como os espaços */
      if (copia.estrategia && !(await banco.listarColecao("itensEstrategicos")).length) {
        if (copia.estrategia.modelo) await banco.gravarModeloEstrategia(copia.estrategia.modelo);
        for (const i of copia.estrategia.instrumentos ?? []) await banco.criarNaColecao("instrumentos", i.id, i);
        for (const i of copia.estrategia.itens ?? []) await banco.criarNaColecao("itensEstrategicos", i.id, i);
      }
      for (const e of copia.espacos) {
        const id = e.espaco.id;
        await banco.criarEspaco(id, e.espaco);
        for (const r of e.responsaveis) await banco.criarResponsavel(id, r.id, r);
        for (const a of e.acoes) await banco.criarAcao(id, a);
        if (e.historico?.length) await banco.gravarHistorico(id, e.historico);
        for (const c of e.comentarios ?? []) await banco.criarComentario(id, c);
        for (const x of e.entregas ?? []) await banco.criarNoEspaco(id, "entregas", x.id, x);
        for (const x of e.alcances ?? []) await banco.criarNoEspaco(id, "alcances", x.id, x);
        for (const { acoes, ...cabecalho } of e.retratos ?? []) await banco.criarRetrato(id, cabecalho, acoes ?? []);
      }
      return resumo;
    },

    // --- importação de responsáveis, com as contas de acesso (passos 1.14d e 1.19b) ---
    /**
     * Grava o plano conferido (js/importar-responsaveis.js): cria os responsáveis novos e liga os e-mails.
     * `criarConta(email)`, quando há banco compartilhado, cria a conta de acesso (devolve "criada" ou
     * "existente"); sem ela (exemplo, memória), as contas ficam de fora. Uma linha que falhe não impede as outras.
     */
    async importarResponsaveis(espacoId, plano, { criarConta = null } = {}) {
      await exigir(espacoId, "configurar");
      const r = { criados: 0, ligados: 0, contasCriadas: 0, contasExistentes: 0, falhas: [] };
      for (const l of plano.linhas) {
        try {
          if (l.tipo === "novo") { await store.criarResponsavel(espacoId, l.dados); r.criados++; }
          else if (l.tipo === "liga") { await store.alterarResponsavel(espacoId, l.id, { usuario: l.usuario }); r.ligados++; }
          else if (l.tipo !== "ignorada") continue;
          const email = l.dados?.usuario ?? l.usuario ?? (l.conta ? (await banco.listarResponsaveis(espacoId)).find((x) => x.id === l.id)?.usuario : null);
          if (l.conta && email && criarConta) {
            if ((await criarConta(email)) === "criada") r.contasCriadas++; else r.contasExistentes++;
          }
        } catch (e) {
          r.falhas.push({ linha: l.linha, mensagem: e.message });
        }
      }
      return r;
    },

    // --- importação por planilha (passo 1.19b) ---
    /**
     * Grava o plano conferido (js/importar.js): cria as fases e etapas que faltam, cria as ações novas,
     * atualiza as existentes e, por fim, acerta as dependências (que podem citar ações recém-criadas).
     * Cada ação é gravada pelas operações comuns, com validação e histórico. Uma linha que falhe não
     * impede as outras; o resultado diz quais falharam e por quê.
     * @returns {Promise<{criadas: number, atualizadas: number, falhas: {linha: number, mensagem: string}[]}>}
     */
    async importarAcoes(espacoId, plano) {
      await exigir(espacoId, "configurar");
      const falhas = [];
      const tentar = async (linha, f) => { try { await f(); return true; } catch (e) { falhas.push({ linha, mensagem: e.message }); return false; } };
      /* fases e etapas novas */
      const idDaNova = [];
      if (plano.etapasNovas.length) {
        const espaco = await store.lerEspaco(espacoId);
        const estrutura = structuredClone(espaco.estrutura ?? []);
        for (const { fase, etapa } of plano.etapasNovas) {
          let f = estrutura.find((x) => x.nome.trim().toLowerCase() === fase.trim().toLowerCase());
          if (!f) { f = { id: novoId(), nome: fase, etapas: [] }; estrutura.push(f); }
          const e = { id: novoId(), nome: etapa };
          f.etapas.push(e);
          idDaNova.push(e.id);
        }
        await store.alterarEspaco(espacoId, { estrutura, camposOpcionais: { ...(espaco.camposOpcionais ?? {}), fasesEtapas: true } });
      }
      const etapaId = (ref) => (ref == null ? undefined : ref.id ?? idDaNova[ref.nova]);
      /* etiquetas novas (passo 2.10a): criadas no catálogo, e o campo Etiquetas é ligado */
      const idDaEtiqueta = [];
      const usaColunaEtiquetas = plano.linhas.some((l) => l.campos?.etiquetas);
      if ((plano.etiquetasNovas ?? []).length || usaColunaEtiquetas) {
        const espaco = await store.lerEspaco(espacoId);
        const etiquetas = structuredClone(etiquetasDe(espaco));
        for (const nome of plano.etiquetasNovas ?? []) {
          const nova = { id: novoId(), nome: nome.trim(), cor: proximaCor({ etiquetas }) };
          etiquetas.push(nova);
          idDaEtiqueta.push(nova.id);
        }
        await store.alterarEspaco(espacoId, { etiquetas, camposOpcionais: { ...(espaco.camposOpcionais ?? {}), etiquetas: true } });
      }
      /* justificativa e local (passo 2.10a): a coluna na planilha liga o campo opcional, como as etapas */
      const ligar = ["justificativa", "local"].filter((c) => plano.linhas.some((l) => l.campos?.[c]));
      if (ligar.length) {
        const espaco = await store.lerEspaco(espacoId);
        await store.alterarEspaco(espacoId, { camposOpcionais: { ...(espaco.camposOpcionais ?? {}), ...Object.fromEntries(ligar.map((c) => [c, true])) } });
      }
      const etiquetaIds = (refs) => refs.map((r) => r.id ?? idDaEtiqueta[r.nova]).filter(Boolean);
      const numeroDaLinha = new Map();
      let criadas = 0;
      let atualizadas = 0;
      for (const l of plano.linhas) {
        const { rotulo, codigo, descricao, justificativa, local, etapa, naoAntesDe, dataLimite, responsaveis: resp, estimativa, etiquetas: etq } = l.campos;
        const comuns = {
          ...(codigo ? { codigo } : {}), ...(descricao ? { descricao } : {}), ...(justificativa ? { justificativa } : {}), ...(local ? { local } : {}), ...(etapa ? { etapa: etapaId(etapa) } : {}),
          ...(naoAntesDe !== undefined ? { naoAntesDe } : {}), ...(dataLimite !== undefined ? { dataLimite } : {}), ...(resp ? { responsaveis: resp } : {}),
          ...(etq ? { etiquetas: etiquetaIds(etq) } : {}),
        };
        if (l.tipo === "nova") {
          await tentar(l.linha, async () => {
            const numero = await store.criarAcao(espacoId, {
              rotulo, ...comuns,
              ...(estimativa ? { estimativas: [{ em: hoje(), por: usuario, ...estimativa, contaDe: "liberacao" }] } : {}),
            });
            numeroDaLinha.set(l.linha, numero);
            criadas++;
          });
        } else if (l.tipo === "atualiza") {
          const ok = await tentar(l.linha, async () => {
            const campos = { ...(rotulo ? { rotulo } : {}), ...comuns };
            if (Object.keys(campos).length) await store.alterarAcao(espacoId, l.numero, campos);
            if (estimativa) await store.corrigirEstimativa(espacoId, l.numero, estimativa);
          });
          if (ok) atualizadas++;
        }
      }
      /* dependências, depois de todas as ações existirem */
      for (const l of plano.linhas) {
        if (!l.campos.dependeDe || (l.tipo !== "nova" && l.tipo !== "atualiza")) continue;
        const numero = l.tipo === "nova" ? numeroDaLinha.get(l.linha) : l.numero;
        if (numero == null) continue;
        const desejadas = l.campos.dependeDe.map((r) => r.numero ?? numeroDaLinha.get(r.linha)).filter((n) => n != null);
        const atuais = (await banco.lerAcao(espacoId, numero))?.dependeDe ?? [];
        for (const n of atuais.filter((x) => !desejadas.includes(x))) await tentar(l.linha, () => store.retirarDependencia(espacoId, numero, n));
        for (const n of desejadas.filter((x) => !atuais.includes(x))) await tentar(l.linha, () => store.acrescentarDependencia(espacoId, numero, n));
      }
      return { criadas, atualizadas, falhas };
    },

    // --- entregas do Plano de Ação e registro do alcance (passo 2.6; seções 4.12 e 16.7) ---
    /** Entregas ativas do espaço, na ordem. */
    async listarEntregas(espacoId) {
      return entregasAtivas(await banco.listarDoEspaco(espacoId, "entregas"));
    },
    /** Registros de alcance do espaço, do mais antigo ao mais recente (de cada entrega, o último é o alcance atual). */
    async listarAlcances(espacoId) {
      return (await banco.listarDoEspaco(espacoId, "alcances"))
        .sort((a, b) => a.data.localeCompare(b.data) || a.registradoEm.localeCompare(b.registradoEm) || a.id.localeCompare(b.id));
    },
    /** Cadastra uma entrega (só o administrador; só no Plano de Ação). Começa "Não iniciada". Devolve o id. */
    async criarEntrega(espacoId, dados) {
      await exigir(espacoId, "configurar");
      recusarDesconhecidos(dados, "entrega");
      recusarFixos(dados, ["id", "situacao", "justificativa", "mudancasDeSituacao", "criadaEm", "alteradaEm", "alteradaPor", "excluidaEm", "excluidaPor"]);
      if (tipoDe(await banco.lerEspaco(espacoId)) !== "planoDeAcao") throw new ErroDeDados("so-plano-de-acao", "Entregas são do Plano de Ação.");
      const entrega = limparEntrega(dados);
      await conferirEntrega(espacoId, entrega);
      await conferirContinuacao(espacoId, dados.continuaDe ?? null);
      const existentes = await banco.listarDoEspaco(espacoId, "entregas");
      const id = novoId();
      await banco.criarNoEspaco(espacoId, "entregas", id, {
        ...entrega, ordem: Math.max(0, ...existentes.map((e) => e.ordem ?? 0)) + 1,
        situacao: SITUACAO_INICIAL_DA_ENTREGA, justificativa: null, mudancasDeSituacao: [],
        criadaEm: agora(), alteradaEm: agora(), alteradaPor: usuario,
      });
      return id;
    },
    /** Muda o cadastro (título, descrição, meta, prazo, responsáveis, ordem). Com alcance registrado, a meta e o tipo não mudam. */
    async alterarEntrega(espacoId, id, campos) {
      await exigir(espacoId, "configurar");
      recusarDesconhecidos(campos, "entrega");
      recusarFixos(campos, ["id", "situacao", "justificativa", "mudancasDeSituacao", "continuaDe", "criadaEm", "excluidaEm", "excluidaPor"]);
      const temAlcance = registrosDa(id, await banco.listarDoEspaco(espacoId, "alcances")).length > 0;
      let conferir = null;
      await banco.mudarNoEspaco(espacoId, "entregas", id, (atual) => {
        if (atual.excluidaEm) throw new ErroDeDados("nao-encontrado", "Entrega não encontrada.");
        const mudanca = limparEntrega({ ...campos }, true);
        if (temAlcance && ["tipoMeta", "meta", "unidade"].some((c) => c in mudanca && mudanca[c] !== atual[c])) {
          throw new ErroDeDados("meta-com-alcance", "A entrega já tem alcance registrado: a meta e o tipo de meta não mudam mais.");
        }
        const p = problemaDaEntrega({ ...atual, ...mudanca });
        if (p) throw new ErroDeDados(p.codigo, p.mensagem);
        conferir = { ...atual, ...mudanca };
        return { ...mudanca, alteradaEm: agora(), alteradaPor: usuario };
      });
      if (conferir) await conferirResponsaveisDaEntrega(espacoId, conferir.responsaveis);
    },
    /**
     * Muda a situação (só o administrador), com as exigências que valem a qualquer momento: alcance registrado
     * para "Alcançada" e "Parcialmente alcançada"; justificativa para "Parcialmente alcançada", "Não alcançada"
     * e "Cancelada". Na "Não iniciada", a justificativa é opcional (exigida ao encerrar). Cada mudança fica em
     * `mudancasDeSituacao`.
     */
    async mudarSituacaoDaEntrega(espacoId, id, { situacao, justificativa = null }) {
      await exigir(espacoId, "configurar");
      const registros = await banco.listarDoEspaco(espacoId, "alcances");
      const texto = String(justificativa ?? "").trim() || null;
      await banco.mudarNoEspaco(espacoId, "entregas", id, (atual) => {
        if (atual.excluidaEm) throw new ErroDeDados("nao-encontrado", "Entrega não encontrada.");
        const p = problemaDaSituacao(atual, { situacao, justificativa: texto }, registros);
        if (p) throw new ErroDeDados(p.codigo, p.mensagem);
        const em = agora();
        return {
          situacao, justificativa: texto,
          mudancasDeSituacao: [...(atual.mudancasDeSituacao ?? []), { situacao, justificativa: texto, em, por: usuario }],
          alteradaEm: em, alteradaPor: usuario,
        };
      });
    },
    /**
     * Entregas de outros Planos de Ação que podem ser continuadas aqui (caminho A da seção 16.7): as "Em andamento"
     * dos Planos de Ação que quem está usando pode consultar, menos as já continuadas neste espaço.
     * @returns {Promise<{espaco: {id: string, nome: string, encerradoEm?: string}, entrega: object}[]>}
     */
    async listarEntregasParaContinuar(espacoId) {
      const aqui = entregasAtivas(await banco.listarDoEspaco(espacoId, "entregas"));
      const jaContinuada = (espaco, entrega) => aqui.some((e) => e.continuaDe?.espaco === espaco && e.continuaDe?.entrega === entrega);
      const planos = (await banco.listarEspacos()).filter((e) => ativo(e) && e.id !== espacoId && tipoDe(e) === "planoDeAcao" && store.podeVerEspaco(e));
      const listas = await Promise.all(planos.map(async (e) => {
        try {
          return entregasAtivas(await banco.listarDoEspaco(e.id, "entregas"))
            .filter((x) => x.situacao === "emAndamento" && !jaContinuada(e.id, x.id))
            .map((entrega) => ({ espaco: { id: e.id, nome: e.nome, ...(e.encerradoEm ? { encerradoEm: e.encerradoEm } : {}) }, entrega }));
        } catch { return []; } // sem permissão de leitura: fica de fora
      }));
      return listas.flat().sort((a, b) => a.espaco.nome.localeCompare(b.espaco.nome, "pt-BR") || (a.entrega.ordem ?? 0) - (b.entrega.ordem ?? 0));
    },
    /** Exclusão lógica, só da entrega sem alcance registrado (a que já tem alcance se cancela, com justificativa). */
    async excluirEntrega(espacoId, id) {
      await exigir(espacoId, "configurar");
      if (registrosDa(id, await banco.listarDoEspaco(espacoId, "alcances")).length) {
        throw new ErroDeDados("entrega-com-alcance", "A entrega já tem alcance registrado: em vez de excluir, marque como Cancelada, com a justificativa.");
      }
      await banco.mudarNoEspaco(espacoId, "entregas", id, () => ({ excluidaEm: agora(), excluidaPor: usuario }));
    },
    /**
     * Registra o alcance de uma entrega (só o administrador): data, valor, descrição, evidências e quem realizou.
     * Só de acréscimo: nada se altera depois; o registro mais recente é o alcance atual. Devolve o id.
     */
    async registrarAlcance(espacoId, entregaId, dados) {
      await exigir(espacoId, "configurar");
      recusarDesconhecidos(dados, "registroDeAlcance");
      for (const v of dados.evidencias ?? []) recusarDesconhecidos(v, "evidencia");
      const entrega = (await banco.listarDoEspaco(espacoId, "entregas")).find((e) => e.id === entregaId && !e.excluidaEm);
      if (!entrega) throw new ErroDeDados("nao-encontrado", "Entrega não encontrada.");
      const limpa = (v) => Object.fromEntries(Object.entries({ descricao: String(v.descricao ?? "").trim(), identificacao: String(v.identificacao ?? "").trim(), link: String(v.link ?? "").trim() }).filter(([, x]) => x));
      const registro = {
        entrega: entregaId, data: dados.data, valor: dados.valor, descricao: String(dados.descricao ?? "").trim(),
        evidencias: (dados.evidencias ?? []).map(limpa), realizadores: dados.realizadores ?? [],
      };
      const p = problemaDoRegistro(registro, entrega);
      if (p) throw new ErroDeDados(p.codigo, p.mensagem);
      await conferirResponsaveisDaEntrega(espacoId, registro.realizadores);
      const id = novoId();
      await banco.criarNoEspaco(espacoId, "alcances", id, { ...registro, registradoEm: agora(), registradoPor: usuario });
      return id;
    },

    // --- retratos (seção 4.4; passo 1.18) ---
    /**
     * Salva um retrato manual: a cópia integral do espaço agora, com os resultados calculados.
     * Só leitura depois de salvo. Devolve o id.
     */
    async salvarRetrato(espacoId, nome) {
      await exigir(espacoId, "salvarRetrato");
      if (!nome?.trim()) throw new ErroDeDados("nome-vazio", "Dê um nome ao retrato, como “Plano aprovado”.");
      const espaco = await store.lerEspaco(espacoId);
      if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      const { cabecalho, acoes } = montarRetrato({
        espaco, acoes: await store.listarAcoes(espacoId), responsaveis: await store.listarResponsaveis(espacoId),
        geral: await store.lerCalendarioGeral(), hoje: hoje(),
      });
      const id = novoId();
      /* entregas e registros de alcance do Plano de Ação (passo 2.6), também congelados */
      const entregas = await store.listarEntregas(espacoId);
      const alcances = await store.listarAlcances(espacoId);
      await banco.criarRetrato(espacoId, {
        id, nome: nome.trim().slice(0, 120), origem: "manual", criadoEm: agora(), criadoPor: usuario, ...cabecalho,
        entregas, alcances,
      }, acoes);
      return id;
    },
    /** Retratos do espaço, do mais recente ao mais antigo (só os cabeçalhos). */
    async listarRetratos(espacoId) {
      return (await banco.listarRetratos(espacoId)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    },
    /** Ações de um retrato, na ordem do espaço naquele momento. */
    async listarAcoesDoRetrato(espacoId, retratoId) {
      return (await banco.listarAcoesDoRetrato(espacoId, retratoId)).sort((a, b) => a.ordem - b.ordem);
    },
    /** Lixeira de um espaço: ações e responsáveis excluídos, os mais recentes primeiro. */
    async listarLixeira(espacoId) {
      const recentes = (campo) => (a, b) => (b[campo] ?? "").localeCompare(a[campo] ?? "");
      return {
        acoes: (await banco.listarAcoes(espacoId)).filter((a) => !ativa(a)).sort(recentes("excluidaEm")),
        responsaveis: (await banco.listarResponsaveis(espacoId)).filter((r) => !ativo(r)).sort(recentes("excluidoEm")),
      };
    },
    async listarEspacosExcluidos() {
      return (await banco.listarEspacos()).filter((e) => !ativo(e)).sort((a, b) => (b.excluidoEm ?? "").localeCompare(a.excluidoEm ?? ""));
    },
    /**
     * Cópia de segurança (passo 1.19a): tudo o que está no banco, inclusive o que está na lixeira,
     * num formato próprio, independente do banco (seção 3.3, "A cópia de segurança é a ponte").
     * Só leitura. Formato documentado em `docs/registro-de-execucao.md` (passo 1.19a).
     */
    /**
     * Dados para a extração personalizada (passo 2.10; seção 16.6): dos espaços escolhidos que quem está usando
     * pode consultar, as ações ativas, todos os responsáveis (para os nomes no histórico), o histórico (se pedido)
     * e, nos Planos de Ação, as entregas ativas e os registros de alcance. Só leitura.
     * @param {string[]} ids
     * @param {{historico?: boolean}} [opcoesDaExtracao]
     */
    async dadosParaExtracao(ids, { historico = false } = {}) {
      const espacos = (await banco.listarEspacos()).filter((e) => ativo(e) && ids.includes(e.id) && store.podeVerEspaco(e));
      return Promise.all(espacos.map(async (espaco) => {
        const plano = tipoDe(espaco) === "planoDeAcao";
        return {
          espaco,
          acoes: (await banco.listarAcoes(espaco.id)).filter(ativa),
          responsaveis: await banco.listarResponsaveis(espaco.id),
          ...(historico ? { historico: await banco.listarHistoricoDoEspaco(espaco.id) } : {}),
          ...(plano ? { entregas: entregasAtivas(await banco.listarDoEspaco(espaco.id, "entregas")), alcances: await banco.listarDoEspaco(espaco.id, "alcances") } : {}),
        };
      }));
    },
    /** Se quem está usando pode consultar o espaço (passo 2.2); fora do banco compartilhado, sempre. */
    podeVerEspaco(espaco) {
      return !opcoes.exigirLogin || podeVer(espaco, usuario);
    },
    /** Se quem está usando participa do espaço (tem papel, ou o espaço ainda não tem administração). */
    participaDoEspaco(espaco) {
      return !opcoes.exigirLogin || participa(espaco, usuario);
    },
    /**
     * Cópia de segurança. Só leva os espaços que quem a gera pode consultar (passo 2.2): os restritos
     * dos quais não participa ficam de fora, e `omitidos` diz quantos (limitação até o Administrador do Sistema).
     */
    async copiaDeSeguranca() {
      const todos = (await banco.listarEspacos()).sort((a, b) => a.id.localeCompare(b.id));
      const espacos = todos.filter((e) => !opcoes.exigirLogin || podeVer(e, usuario));
      const omitidos = todos.length - espacos.length;
      return {
        formato: "sextante-copia-de-seguranca",
        versao: 4, // 2: com o histórico de alterações (passo 1.16), os retratos (passo 1.18) e os comentários (passo 2.9); 3: com o catálogo da estratégia (passo 2.5); 4: com as entregas e os registros de alcance (passo 2.6)
        geradaEm: agora(),
        geradaPor: usuario ?? null,
        ...(omitidos ? { omitidos } : {}),
        calendarioGeral: (await banco.lerCalendarioGeral()) ?? null,
        /* catálogo da estratégia (passo 2.5), inclusive o excluído */
        estrategia: {
          modelo: (await banco.lerModeloEstrategia()) ?? null,
          instrumentos: (await banco.listarColecao("instrumentos")).sort((a, b) => a.id.localeCompare(b.id)),
          itens: (await banco.listarColecao("itensEstrategicos")).sort((a, b) => a.id.localeCompare(b.id)),
        },
        espacos: await Promise.all(espacos.map(async (espaco) => ({
          espaco,
          acoes: (await banco.listarAcoes(espaco.id)).sort((a, b) => a.numero - b.numero),
          responsaveis: (await banco.listarResponsaveis(espaco.id)).sort((a, b) => a.id.localeCompare(b.id)),
          historico: (await banco.listarHistoricoDoEspaco(espaco.id)).sort((a, b) => a.em.localeCompare(b.em) || a.id.localeCompare(b.id)),
          /* comentários, inclusive os apagados e as versões anteriores (passo 2.9) */
          comentarios: (await banco.listarComentariosDoEspaco(espaco.id)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id)),
          /* entregas, inclusive as excluídas, e registros de alcance (passo 2.6) */
          entregas: (await banco.listarDoEspaco(espaco.id, "entregas")).sort((a, b) => a.id.localeCompare(b.id)),
          alcances: (await banco.listarDoEspaco(espaco.id, "alcances")).sort((a, b) => a.id.localeCompare(b.id)),
          retratos: await Promise.all((await banco.listarRetratos(espaco.id)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).map(async (r) => ({
            ...r, acoes: (await banco.listarAcoesDoRetrato(espaco.id, r.id)).sort((a, b) => a.numero - b.numero),
          }))),
        }))),
      };
    },
  };

  /* sem login, nenhuma gravação sai daqui (as regras do banco também recusam) */
  const GRAVACOES = ["criarEspaco", "alterarEspaco", "criarAcao", "alterarAcao", "acrescentarResponsavelNaAcao",
    "retirarResponsavelDaAcao", "acrescentarDependencia", "retirarDependencia", "reestimar", "corrigirEstimativa",
    "concluir", "desfazerConclusao", "criarResponsavel", "alterarResponsavel", "alterarCalendarioGeral",
    "excluirAcao", "restaurarAcao", "excluirResponsavel", "restaurarResponsavel", "excluirEtapas", "excluirEspaco", "restaurarEspaco",
    "salvarRetrato", "importarAcoes", "restaurarCopia", "importarResponsaveis",
    "acrescentarItemNoChecklist", "marcarItemDoChecklist", "alterarItemDoChecklist", "retirarItemDoChecklist",
    "criarEtiqueta", "alterarEtiqueta", "retirarEtiqueta", "acrescentarEtiquetaNaAcao", "retirarEtiquetaDaAcao", "etiquetarAcao",
    "acrescentarDocumentoNaAcao", "alterarDocumentoDaAcao", "retirarDocumentoDaAcao", "priorizar",
    /* faltavam (24/10/2026): sem eles, mudar a situação ou comentar sem conexão não dava o aviso de "sem conexão" */
    "mudarSituacao", "retirarSituacao", "comentar", "editarComentario", "apagarComentario",
    "assumirAdministracao", "definirPapel", "encerrarEspaco", "reabrirEspaco", "nomearAdministrador",
    "alterarCamadas", "criarInstrumento", "alterarInstrumento", "prorrogarInstrumento", "excluirInstrumento",
    "criarItemEstrategico", "alterarItemEstrategico", "ligarSuperior", "desligarSuperior", "excluirItemEstrategico", "importarCatalogo",
    "criarEntrega", "alterarEntrega", "mudarSituacaoDaEntrega", "excluirEntrega", "registrarAlcance"];
  for (const nome of GRAVACOES) {
    const operacao = store[nome];
    store[nome] = async (...args) => {
      if (!conectado) throw new ErroDeDados("sem-conexao", "Sem conexão com a internet. A alteração não foi gravada; tente de novo quando a conexão voltar.");
      if (!store.podeGravar) throw new ErroDeDados("sem-login", "Entre com seu e-mail e senha para fazer alterações.");
      return operacao(...args);
    };
  }
  return store;
}
