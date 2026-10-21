/**
 * Store: o único caminho entre as telas e o banco (especificação, seção 3.4).
 *
 * Oferece operações com nomes do próprio sistema e aplica as regras que valem
 * para qualquer banco: validação, carimbos de data e autor, campos imutáveis.
 * Quem executa as operações é o banco recebido (por enquanto, o banco em memória).
 */
import { ErroDeDados } from "./banco/local.js";
import { CAMPOS } from "./modelo.js";
import { ajustarTons } from "./responsaveis.js";
import { ordenarPorDependencia } from "./calculo.js";

export { ErroDeDados };

/** Padrões de um espaço novo (especificação, seções 4.1 e 5.7). */
export const SIMULACOES_PADRAO = 10000;
export const SEMENTE_PADRAO = 20261014;

/** Código mnemônico da ação, opcional: de 2 a 8 letras maiúsculas ou números (seções 4.2 e 8.3). */
const CODIGO_VALIDO = /^[A-Z0-9]{2,8}$/;

/** Campos que não mudam depois de criados. */
const FIXOS_DO_ESPACO = ["id", "semente", "simulacoes", "criadoEm", "tons", "proximoNumero"]; // tons e proximoNumero: o sistema cuida deles
const FIXOS_DA_ACAO = ["numero", "criadaEm"];

/** Código mnemônico: de 2 a 8 letras maiúsculas ou números, sem repetir no espaço. */
function validarCodigo(codigo, outrasAcoes) {
  if (!CODIGO_VALIDO.test(codigo)) throw new ErroDeDados("codigo-invalido", "O código deve ter de 2 a 8 letras maiúsculas ou números.");
  if (outrasAcoes.some((a) => a.codigo === codigo)) throw new ErroDeDados("codigo-ocupado", `Já existe uma ação com o código ${codigo}. Escolha outro.`);
}

/**
 * @typedef {object} OpcoesDoStore
 * @property {() => string} [agora]   momento atual, em ISO 8601 (substituível nos testes)
 * @property {string|null} [usuario]  quem está gravando
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
  const usuario = opcoes.usuario ?? null;
  const novoId = opcoes.novoId ?? (() => globalThis.crypto.randomUUID());
  const hoje = opcoes.hoje ?? hojeLocal;
  const carimbo = () => ({ alteradaEm: agora(), alteradaPor: usuario });
  const exigirAcao = async (espacoId, numero) => {
    const acao = await banco.lerAcao(espacoId, numero);
    if (!acao) throw new ErroDeDados("nao-encontrado", `Ação ${numero} não encontrada.`);
    return acao;
  };

  /** Recusa campos fora do dicionário de dados (especificação, seção 4). */
  const recusarDesconhecidos = (campos, entidade) => {
    const desconhecido = Object.keys(campos).find((campo) => !CAMPOS[entidade].includes(campo));
    if (desconhecido) throw new ErroDeDados("campo-desconhecido", `O campo "${desconhecido}" não existe em ${entidade}.`);
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
      banco.lerEspaco(espacoId), banco.listarAcoes(espacoId), banco.listarResponsaveis(),
    ]);
    const pessoas = new Set(responsaveis.filter((r) => r.tipo === "pessoa").map((r) => r.id));
    const emUso = [...new Set(acoes.sort((a, b) => a.ordem - b.ordem).flatMap((a) => a.responsaveis ?? []))].filter((id) => pessoas.has(id));
    const tons = ajustarTons(espaco.tons, emUso);
    if (JSON.stringify(tons) !== JSON.stringify(espaco.tons ?? {})) await banco.alterarEspaco(espacoId, { tons });
  }

  return {
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
    lerEspaco: (id) => banco.lerEspaco(id),
    listarEspacos: () => banco.listarEspacos(),
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
      if (!rotulo?.trim()) throw new ErroDeDados("rotulo-vazio", "Informe o rótulo da ação.");
      for (const e of outros.estimativas ?? []) validarEstimativa(e);
      const acoes = await banco.listarAcoes(espacoId);
      if (codigo) validarCodigo(codigo, acoes);
      const inexistente = (outros.dependeDe ?? []).find((n) => !acoes.some((a) => a.numero === n));
      if (inexistente) throw new ErroDeDados("nao-encontrado", `Ação ${inexistente} não encontrada.`);
      const ordem = Math.max(0, ...acoes.map((a) => a.ordem ?? 0)) + 1;
      const numero = await banco.reservarNumero(espacoId);
      await banco.criarAcao(espacoId, {
        dependeDe: [], responsaveis: [], estimativas: [],
        ...outros,
        ...(codigo ? { codigo } : {}),
        numero, rotulo: rotulo.trim(), ordem,
        criadaEm: agora(), alteradaEm: agora(), alteradaPor: usuario,
      });
      if (outros.responsaveis?.length) await arrumarTons(espacoId);
      return numero;
    },
    lerAcao: (espacoId, numero) => banco.lerAcao(espacoId, numero),
    /** Ações do espaço, na ordem do espaço. */
    async listarAcoes(espacoId) {
      const acoes = await banco.listarAcoes(espacoId);
      return acoes.sort((a, b) => a.ordem - b.ordem);
    },
    /** Grava só os campos informados, com data e autor da alteração. */
    async alterarAcao(espacoId, numero, campos) {
      recusarDesconhecidos(campos, "acao");
      recusarFixos(campos, FIXOS_DA_ACAO);
      if (campos.codigo) validarCodigo(campos.codigo, (await banco.listarAcoes(espacoId)).filter((a) => a.numero !== numero));
      await banco.alterarAcao(espacoId, numero, { ...campos, alteradaEm: agora(), alteradaPor: usuario });
      if ("responsaveis" in campos) await arrumarTons(espacoId);
    },

    // --- listas da ação: item a item (seção 4.6) ---
    async acrescentarResponsavelNaAcao(espacoId, numero, responsavelId) {
      await banco.acrescentarNaLista(espacoId, numero, "responsaveis", [responsavelId], carimbo());
      await arrumarTons(espacoId);
    },
    async retirarResponsavelDaAcao(espacoId, numero, responsavelId) {
      await banco.retirarDaLista(espacoId, numero, "responsaveis", [responsavelId], carimbo());
      await arrumarTons(espacoId);
    },
    /** Acrescenta uma ação anterior. Recusa a própria ação, código inexistente e ciclo. */
    async acrescentarDependencia(espacoId, numero, anterior) {
      const acoes = await banco.listarAcoes(espacoId);
      if (anterior === numero) throw new ErroDeDados("ciclo", "Uma ação não pode depender dela mesma.");
      if (!acoes.some((a) => a.numero === anterior)) throw new ErroDeDados("nao-encontrado", `Ação ${anterior} não encontrada.`);
      const hipotese = acoes.map((a) => (a.numero === numero ? { ...a, dependeDe: [...(a.dependeDe ?? []), anterior] } : a));
      try {
        ordenarPorDependencia(hipotese);
      } catch {
        const nome = (n) => `“${acoes.find((a) => a.numero === n)?.rotulo ?? n}”`;
        throw new ErroDeDados("ciclo", `${nome(anterior)} já depende de ${nome(numero)}, direta ou indiretamente. A dependência criaria um ciclo.`);
      }
      await banco.acrescentarNaLista(espacoId, numero, "dependeDe", [anterior], carimbo());
    },
    async retirarDependencia(espacoId, numero, anterior) {
      await banco.retirarDaLista(espacoId, numero, "dependeDe", [anterior], carimbo());
    },

    // --- estimativas e conclusão (seções 4.3, 5.3 e 5.4) ---
    /** Reestimativa: tempo que falta, a partir de hoje; entra no fim do histórico. */
    async reestimar(espacoId, numero, { o, m, p, motivo = "" }) {
      validarEstimativa({ o, m, p });
      await exigirAcao(espacoId, numero);
      const estimativa = { em: hoje(), por: usuario, o, m, p, contaDe: "data", ...(motivo.trim() ? { motivo: motivo.trim() } : {}) };
      await banco.acrescentarEstimativa(espacoId, numero, estimativa, carimbo());
    },
    /**
     * Ajusta a estimativa sem criar histórico: ainda é planejamento, ou é correção de digitação.
     * Quem chama decide se pode (estimativaLivre, em js/acao.js). Sem estimativa, cria a primeira.
     */
    async corrigirEstimativa(espacoId, numero, { o, m, p }) {
      validarEstimativa({ o, m, p });
      const { estimativas = [] } = await exigirAcao(espacoId, numero);
      const ultima = estimativas.at(-1);
      const estimativa = { ...ultima, em: hoje(), por: usuario, o, m, p, contaDe: ultima?.contaDe ?? "liberacao" };
      if (!ultima) await banco.acrescentarEstimativa(espacoId, numero, estimativa, carimbo());
      else await banco.trocarUltimaEstimativa(espacoId, numero, estimativa, estimativas.length, carimbo());
    },
    /** Registra a conclusão. A data não pode ser futura. */
    async concluir(espacoId, numero, data) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? "")) throw new ErroDeDados("data-invalida", "Informe a data de conclusão.");
      if (data > hoje()) throw new ErroDeDados("data-futura", "A data de conclusão não pode ser depois de hoje.");
      await exigirAcao(espacoId, numero);
      await banco.alterarAcao(espacoId, numero, { concluidaEm: data, ...carimbo() });
    },
    async desfazerConclusao(espacoId, numero) {
      await exigirAcao(espacoId, numero);
      await banco.alterarAcao(espacoId, numero, { concluidaEm: null, ...carimbo() });
    },

    // --- responsáveis ---
    async criarResponsavel(dados) {
      recusarDesconhecidos(dados, "responsavel");
      const { nome, sigla = "", usuario: login, ...outros } = dados;
      if (!nome?.trim()) throw new ErroDeDados("nome-vazio", "Informe o nome do responsável.");
      validarTipo(dados);
      if (login) validarLogin(login, await banco.listarResponsaveis());
      return banco.criarResponsavel(novoId(), {
        ...outros, nome: nome.trim(), sigla: sigla.trim(), ...(login ? { usuario: login.trim().toLowerCase() } : {}),
        criadoEm: agora(), alteradoEm: agora(), alteradoPor: usuario,
      });
    },
    listarResponsaveis: () => banco.listarResponsaveis(),
    /**
     * Altera um responsável. O tipo é fixo: um cadastro feito com o tipo errado é corrigido
     * criando outro e excluindo este com "substituir por" (seções 4.5 e 4.7).
     */
    async alterarResponsavel(id, campos) {
      recusarDesconhecidos(campos, "responsavel");
      recusarFixos(campos, ["id", "tipo", "criadoEm"]);
      const todos = await banco.listarResponsaveis();
      const atual = todos.find((r) => r.id === id);
      if (!atual) throw new ErroDeDados("nao-encontrado", "Responsável não encontrado.");
      if ("nome" in campos && !campos.nome?.trim()) throw new ErroDeDados("nome-vazio", "Informe o nome do responsável.");
      const mudanca = { ...campos };
      if ("nome" in mudanca) mudanca.nome = mudanca.nome.trim();
      if ("sigla" in mudanca) mudanca.sigla = (mudanca.sigla ?? "").trim();
      if (mudanca.usuario) {
        mudanca.usuario = mudanca.usuario.trim().toLowerCase();
        validarLogin(mudanca.usuario, todos.filter((r) => r.id !== id));
      } else if ("usuario" in mudanca) mudanca.usuario = null;
      validarTipo({ ...atual, ...mudanca });
      await banco.alterarResponsavel(id, { ...mudanca, alteradoEm: agora(), alteradoPor: usuario });
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
    acompanharEspaco: (espacoId, aoMudar) => banco.acompanharEspaco(espacoId, aoMudar),
  };
}
