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
import { problemaDoTipo } from "./tipos.js";
import { problemaDoModelo, modeloDe } from "./modelos.js";
import { problemaDasSituacoes, personalizadasDe } from "./situacoes.js";
import { chaveValida, planejarMovimento } from "./prioridade.js";
import { problemaDasEtiquetas, etiquetasDe, proximaCor, etiquetaPorNome, TAMANHO_DO_NOME } from "./etiquetas.js";

export { ErroDeDados };

/** Padrões de um espaço novo (documentação técnica, seções 4.1 e 5.7). */
export const SIMULACOES_PADRAO = 10000;
export const SEMENTE_PADRAO = 20261014;

/** Código mnemônico da ação, opcional: de 2 a 8 letras maiúsculas ou números (seções 4.2 e 8.3). */
const CODIGO_VALIDO = /^[A-Z0-9]{2,8}$/;

/** Campos que não mudam depois de criados. */
const FIXOS_DO_ESPACO = ["id", "semente", "simulacoes", "criadoEm", "tons", "proximoNumero", "modelo"]; // modelo: fixo depois de criado (passo 2.4b) // tons e proximoNumero: o sistema cuida deles
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
      validarEspaco(dados, recusarDesconhecidos);
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
      const atual = await banco.lerEspaco(id);
      if (!atual) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      validarEspaco({ ...atual, ...campos }, recusarDesconhecidos);
      const mudanca = { ...campos };
      if ("nome" in mudanca) mudanca.nome = mudanca.nome.trim();
      await banco.alterarEspaco(id, { ...mudanca, alteradoEm: agora(), alteradoPor: usuario });
    },

    // --- ações ---
    /**
     * Cria uma ação no fim da ordem do espaço e devolve o número dela (identificador,
     * reservado pelo banco). O código mnemônico é opcional e, se houver, não pode repetir.
     */
    async criarAcao(espacoId, dados) {
      recusarDesconhecidos(dados, "acao");
      recusarFixos(dados, FIXOS_DA_ACAO);
      const { rotulo, codigo, ...outros } = dados;
      if (!rotulo?.trim()) throw new ErroDeDados("rotulo-vazio", "Informe o nome da ação.");
      await conferirModelo(espacoId, outros);
      await conferirEtiquetas(espacoId, outros);
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
      recusarDesconhecidos(campos, "acao");
      recusarFixos(campos, FIXOS_DA_ACAO);
      if ("situacaoPersonalizada" in campos) throw new ErroDeDados("campo-fixo", "A situação muda por mudarSituacao.");
      /* data mínima no futuro: a ação deixa de estar liberada e sai da situação personalizada (passo 2.7) */
      if (campos.naoAntesDe && campos.naoAntesDe > hoje()) campos = { ...campos, situacaoPersonalizada: null };
      await conferirModelo(espacoId, campos);
      await conferirEtiquetas(espacoId, campos);
      conferirDocumentos(campos);
      conferirPosicao(campos);
      if (campos.codigo) validarCodigo(campos.codigo, (await banco.listarAcoes(espacoId)).filter((a) => a.numero !== numero));
      await banco.alterarAcao(espacoId, numero, { ...campos, alteradaEm: agora(), alteradaPor: usuario }, hist);
      if ("responsaveis" in campos) await arrumarTons(espacoId);
    },

    // --- listas da ação: item a item (seção 4.6) ---
    async acrescentarResponsavelNaAcao(espacoId, numero, responsavelId) {
      await banco.acrescentarNaLista(espacoId, numero, "responsaveis", [responsavelId], carimbo(), hist);
      await arrumarTons(espacoId);
    },
    async retirarResponsavelDaAcao(espacoId, numero, responsavelId) {
      await banco.retirarDaLista(espacoId, numero, "responsaveis", [responsavelId], carimbo(), hist);
      await arrumarTons(espacoId);
    },
    // --- etiquetas (passo 2.10a; seção 16.8): catálogo do espaço e etiquetas da ação, uma a uma ---
    /** Cria uma etiqueta no catálogo do espaço e devolve o id. Sem cor, a menos usada. */
    async criarEtiqueta(espacoId, { nome, cor } = {}) {
      const espaco = await banco.lerEspaco(espacoId);
      if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      const n = String(nome ?? "").trim();
      const id = novoId();
      await store.alterarEspaco(espacoId, { etiquetas: [...etiquetasDe(espaco), { id, nome: n, cor: cor ?? proximaCor(espaco) }] });
      return id;
    },
    /** Muda o nome ou a cor de uma etiqueta do catálogo. */
    async alterarEtiqueta(espacoId, id, campos) {
      recusarDesconhecidos(campos, "etiqueta");
      recusarFixos(campos, ["id"]);
      const espaco = await banco.lerEspaco(espacoId);
      if (!etiquetasDe(espaco).some((x) => x.id === id)) throw new ErroDeDados("nao-encontrado", "Etiqueta não encontrada neste espaço.");
      const mudanca = { ...campos, ...("nome" in campos ? { nome: String(campos.nome ?? "").trim() } : {}) };
      await store.alterarEspaco(espacoId, { etiquetas: etiquetasDe(espaco).map((x) => (x.id === id ? { ...x, ...mudanca } : x)) });
    },
    /** Retira a etiqueta do catálogo e das ações que a usam. Devolve em quantas ações ativas ela estava. */
    async retirarEtiqueta(espacoId, id) {
      const espaco = await banco.lerEspaco(espacoId);
      if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      const com = (await banco.listarAcoes(espacoId)).filter((a) => (a.etiquetas ?? []).includes(id));
      for (const a of com) await banco.retirarDaLista(espacoId, a.numero, "etiquetas", [id], carimbo(), hist);
      await store.alterarEspaco(espacoId, { etiquetas: etiquetasDe(espaco).filter((x) => x.id !== id) });
      return com.filter(ativa).length;
    },
    async acrescentarEtiquetaNaAcao(espacoId, numero, id) {
      const espaco = await banco.lerEspaco(espacoId);
      if (!etiquetasDe(espaco).some((x) => x.id === id)) throw new ErroDeDados("nao-encontrado", "Etiqueta não encontrada neste espaço.");
      await exigirAcao(espacoId, numero);
      await banco.acrescentarNaLista(espacoId, numero, "etiquetas", [id], carimbo(), hist);
    },
    async retirarEtiquetaDaAcao(espacoId, numero, id) {
      await banco.retirarDaLista(espacoId, numero, "etiquetas", [id], carimbo(), hist);
    },
    /**
     * Acrescenta à ação a etiqueta com este nome; se ela não existir, cria no catálogo antes.
     * Devolve o id. É o "+ Acrescentar" da janela da ação.
     */
    async etiquetarAcao(espacoId, numero, nome) {
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
      const doc = documentoValido(dados);
      await exigirAcao(espacoId, numero);
      const id = novoId();
      await banco.mudarDocumentos(espacoId, numero, (lista) => [...lista, { id, ...doc }], carimbo(), hist);
      return id;
    },
    /** Troca os dados de um documento da ação (os campos ausentes são apagados). */
    async alterarDocumentoDaAcao(espacoId, numero, id, dados) {
      const doc = documentoValido(dados);
      await banco.mudarDocumentos(espacoId, numero, (lista) => {
        if (!lista.some((d) => d.id === id)) throw new ErroDeDados("nao-encontrado", "Documento não encontrado nesta ação.");
        return lista.map((d) => (d.id === id ? { id, ...doc } : d));
      }, carimbo(), hist);
    },
    async retirarDocumentoDaAcao(espacoId, numero, id) {
      await banco.mudarDocumentos(espacoId, numero, (lista) => lista.filter((d) => d.id !== id), carimbo(), hist);
    },
    // --- checklist da ação (passo 2.8; seção 16.5): item a item, sem regravar os demais ---
    async acrescentarItemNoChecklist(espacoId, numero, texto) {
      const t = String(texto ?? "").trim();
      if (!t) throw new ErroDeDados("checklist-vazio", "Escreva o item do checklist.");
      await exigirAcao(espacoId, numero);
      const id = novoId();
      await banco.mudarChecklist(espacoId, numero, (lista) => [...lista, { id, texto: t, feito: false }], carimbo(), hist);
      return id;
    },
    async marcarItemDoChecklist(espacoId, numero, id, feito) {
      await banco.mudarChecklist(espacoId, numero, (lista) => lista.map((i) => (i.id === id ? { ...i, feito: Boolean(feito) } : i)), carimbo(), hist);
    },
    async alterarItemDoChecklist(espacoId, numero, id, texto) {
      const t = String(texto ?? "").trim();
      if (!t) throw new ErroDeDados("checklist-vazio", "Escreva o item do checklist.");
      await banco.mudarChecklist(espacoId, numero, (lista) => lista.map((i) => (i.id === id ? { ...i, texto: t } : i)), carimbo(), hist);
    },
    async retirarItemDoChecklist(espacoId, numero, id) {
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
      const t = textoDoComentario(texto);
      if (!usuario) throw new ErroDeDados("sem-login", "Entre com seu e-mail e senha para comentar.");
      await exigirAcao(espacoId, numero);
      const id = novoId();
      await banco.criarComentario(espacoId, { id, acao: numero, autor: usuario, texto: t, criadoEm: agora(), versoes: [] });
      return id;
    },
    /** Edita o próprio comentário; a versão anterior fica guardada em `versoes`. */
    async editarComentario(espacoId, id, texto) {
      const t = textoDoComentario(texto);
      await banco.mudarComentario(espacoId, id, (c) => {
        exigirAutor(c);
        if (c.texto === t) return {};
        return { texto: t, editadoEm: agora(), versoes: [...(c.versoes ?? []), { texto: c.texto, em: c.editadoEm ?? c.criadoEm }] };
      });
    },
    /** "Apaga" o próprio comentário: some da tela, mas fica no banco, com todas as versões. */
    async apagarComentario(espacoId, id) {
      await banco.mudarComentario(espacoId, id, (c) => {
        exigirAutor(c);
        return { apagadoEm: agora(), apagadoPor: usuario, apagadoComo: "autor" };
      });
    },

    /** Acrescenta uma ação anterior. Recusa a própria ação, código inexistente e ciclo. */
    async acrescentarDependencia(espacoId, numero, anterior) {
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
      await banco.retirarDaLista(espacoId, numero, "dependeDe", [anterior], carimbo(), hist);
    },

    // --- estimativas e conclusão (seções 4.3, 5.3 e 5.4) ---
    /** Reestimativa: tempo que falta, a partir de hoje; entra no fim do histórico. */
    async reestimar(espacoId, numero, { o, m, p, motivo = "" }) {
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? "")) throw new ErroDeDados("data-invalida", "Informe a data de conclusão.");
      if (data > hoje()) throw new ErroDeDados("data-futura", "A data de conclusão não pode ser depois de hoje.");
      const atual = await exigirAcao(espacoId, numero);
      /* concluída, sai da personalizada: se a conclusão for desfeita, volta à inicial (passo 2.7) */
      await banco.alterarAcao(espacoId, numero, { concluidaEm: data, ...(atual.situacaoPersonalizada ? { situacaoPersonalizada: null } : {}), ...carimbo() }, hist);
    },
    async desfazerConclusao(espacoId, numero) {
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
      if (login) validarLogin(login, (await banco.listarResponsaveis(espacoId)).filter(ativo));
      return banco.criarResponsavel(espacoId, novoId(), {
        ...outros, nome: nome.trim(), sigla: sigla.trim(), ...(login ? { usuario: login.trim().toLowerCase() } : {}),
        criadoEm: agora(), alteradoEm: agora(), alteradoPor: usuario,
      });
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
      await banco.alterarResponsavel(espacoId, id, { ...mudanca, alteradoEm: agora(), alteradoPor: usuario });
    },

    // --- calendário geral (seções 4.1.5 e 5.1) ---
    /** Calendário geral; sem cadastro ainda, lista vazia. */
    async lerCalendarioGeral() {
      return (await banco.lerCalendarioGeral()) ?? { datasExcluidas: [] };
    },
    /** Grava a lista inteira de datas do calendário geral, em ordem de data. */
    async alterarCalendarioGeral(datasExcluidas) {
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
      const todos = (await banco.listarResponsaveis(espacoId)).filter(ativo);
      if (!todos.some((r) => r.id === id)) throw new ErroDeDados("nao-encontrado", "Responsável não encontrado.");
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
      if (r.usuario) validarLogin(r.usuario, todos.filter((x) => x.id !== id && ativo(x)));
      await banco.alterarResponsavel(espacoId, id, { excluidoEm: null, excluidoPor: null, alteradoEm: agora(), alteradoPor: usuario });
    },
    /**
     * Retira fases ou etapas que têm ações: as ações vão para `destino` (id de uma etapa que fica)
     * ou ficam sem fase nem etapa (destino null). `ids`: as etapas e, se for o caso, a fase.
     */
    async excluirEtapas(espacoId, ids, { destino = null } = {}) {
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
      if (!(await store.lerEspaco(id))) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      await banco.alterarEspaco(id, { excluidoEm: agora(), excluidoPor: usuario, alteradoEm: agora(), alteradoPor: usuario });
    },
    async restaurarEspaco(id) {
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
      if (copia?.formato !== "sextante-copia-de-seguranca" || ![1, 2].includes(copia.versao) || !Array.isArray(copia.espacos)) {
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
      for (const e of copia.espacos) {
        const id = e.espaco.id;
        await banco.criarEspaco(id, e.espaco);
        for (const r of e.responsaveis) await banco.criarResponsavel(id, r.id, r);
        for (const a of e.acoes) await banco.criarAcao(id, a);
        if (e.historico?.length) await banco.gravarHistorico(id, e.historico);
        for (const c of e.comentarios ?? []) await banco.criarComentario(id, c);
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

    // --- retratos (seção 4.4; passo 1.18) ---
    /**
     * Salva um retrato manual: a cópia integral do espaço agora, com os resultados calculados.
     * Só leitura depois de salvo. Devolve o id.
     */
    async salvarRetrato(espacoId, nome) {
      if (!nome?.trim()) throw new ErroDeDados("nome-vazio", "Dê um nome ao retrato, como “Plano aprovado”.");
      const espaco = await store.lerEspaco(espacoId);
      if (!espaco) throw new ErroDeDados("nao-encontrado", "Espaço não encontrado.");
      const { cabecalho, acoes } = montarRetrato({
        espaco, acoes: await store.listarAcoes(espacoId), responsaveis: await store.listarResponsaveis(espacoId),
        geral: await store.lerCalendarioGeral(), hoje: hoje(),
      });
      const id = novoId();
      await banco.criarRetrato(espacoId, { id, nome: nome.trim().slice(0, 120), origem: "manual", criadoEm: agora(), criadoPor: usuario, ...cabecalho }, acoes);
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
    async copiaDeSeguranca() {
      const espacos = (await banco.listarEspacos()).sort((a, b) => a.id.localeCompare(b.id));
      return {
        formato: "sextante-copia-de-seguranca",
        versao: 2, // 2: com o histórico de alterações (passo 1.16), os retratos (passo 1.18) e os comentários (passo 2.9)
        geradaEm: agora(),
        geradaPor: usuario ?? null,
        calendarioGeral: (await banco.lerCalendarioGeral()) ?? null,
        espacos: await Promise.all(espacos.map(async (espaco) => ({
          espaco,
          acoes: (await banco.listarAcoes(espaco.id)).sort((a, b) => a.numero - b.numero),
          responsaveis: (await banco.listarResponsaveis(espaco.id)).sort((a, b) => a.id.localeCompare(b.id)),
          historico: (await banco.listarHistoricoDoEspaco(espaco.id)).sort((a, b) => a.em.localeCompare(b.em) || a.id.localeCompare(b.id)),
          /* comentários, inclusive os apagados e as versões anteriores (passo 2.9) */
          comentarios: (await banco.listarComentariosDoEspaco(espaco.id)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id)),
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
    "acrescentarDocumentoNaAcao", "alterarDocumentoDaAcao", "retirarDocumentoDaAcao", "priorizar"];
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
