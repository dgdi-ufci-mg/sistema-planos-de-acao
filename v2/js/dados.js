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

/** Código da ação: de 2 a 8 letras ou números (especificação, seção 8.3). */
const CODIGO_VALIDO = /^[A-Za-z0-9]{2,8}$/;

/** Campos que não mudam depois de criados. */
const FIXOS_DO_ESPACO = ["id", "semente", "simulacoes", "criadoEm", "tons"]; // tons: o Store cuida deles
const FIXOS_DA_ACAO = ["codigo", "criadaEm"];

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
  const exigirAcao = async (espacoId, codigo) => {
    const acao = await banco.lerAcao(espacoId, codigo);
    if (!acao) throw new ErroDeDados("nao-encontrado", `Ação ${codigo} não encontrada.`);
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
      const { nome, semente = SEMENTE_PADRAO, simulacoes = SIMULACOES_PADRAO, ...outros } = dados;
      if (!nome?.trim()) throw new ErroDeDados("nome-vazio", "Informe o nome do espaço.");
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
      await banco.alterarEspaco(id, { ...campos, alteradoEm: agora(), alteradoPor: usuario });
    },

    // --- ações ---
    /** Cria uma ação no fim da ordem do espaço. O código precisa estar livre. */
    async criarAcao(espacoId, dados) {
      recusarDesconhecidos(dados, "acao");
      const { codigo, rotulo, ...outros } = dados;
      if (!CODIGO_VALIDO.test(codigo ?? "")) {
        throw new ErroDeDados("codigo-invalido", "O código deve ter de 2 a 8 letras ou números.");
      }
      if (!rotulo?.trim()) throw new ErroDeDados("rotulo-vazio", "Informe o rótulo da ação.");
      for (const e of outros.estimativas ?? []) validarEstimativa(e);
      const acoes = await banco.listarAcoes(espacoId);
      const inexistente = (outros.dependeDe ?? []).find((c) => !acoes.some((a) => a.codigo === c));
      if (inexistente) throw new ErroDeDados("nao-encontrado", `Ação ${inexistente} não encontrada.`);
      const ordem = Math.max(0, ...acoes.map((a) => a.ordem ?? 0)) + 1;
      await banco.criarAcao(espacoId, {
        dependeDe: [], responsaveis: [], estimativas: [],
        ...outros,
        codigo, rotulo: rotulo.trim(), ordem,
        criadaEm: agora(), alteradaEm: agora(), alteradaPor: usuario,
      });
      if (outros.responsaveis?.length) await arrumarTons(espacoId);
    },
    lerAcao: (espacoId, codigo) => banco.lerAcao(espacoId, codigo),
    /** Ações do espaço, na ordem do espaço. */
    async listarAcoes(espacoId) {
      const acoes = await banco.listarAcoes(espacoId);
      return acoes.sort((a, b) => a.ordem - b.ordem);
    },
    /** Grava só os campos informados, com data e autor da alteração. */
    async alterarAcao(espacoId, codigo, campos) {
      recusarDesconhecidos(campos, "acao");
      recusarFixos(campos, FIXOS_DA_ACAO);
      await banco.alterarAcao(espacoId, codigo, { ...campos, alteradaEm: agora(), alteradaPor: usuario });
      if ("responsaveis" in campos) await arrumarTons(espacoId);
    },

    // --- listas da ação: item a item (seção 4.6) ---
    async acrescentarResponsavelNaAcao(espacoId, codigo, responsavelId) {
      await banco.acrescentarNaLista(espacoId, codigo, "responsaveis", [responsavelId], carimbo());
      await arrumarTons(espacoId);
    },
    async retirarResponsavelDaAcao(espacoId, codigo, responsavelId) {
      await banco.retirarDaLista(espacoId, codigo, "responsaveis", [responsavelId], carimbo());
      await arrumarTons(espacoId);
    },
    /** Acrescenta uma ação anterior. Recusa a própria ação, código inexistente e ciclo. */
    async acrescentarDependencia(espacoId, codigo, anterior) {
      const acoes = await banco.listarAcoes(espacoId);
      if (anterior === codigo) throw new ErroDeDados("ciclo", "Uma ação não pode depender dela mesma.");
      if (!acoes.some((a) => a.codigo === anterior)) throw new ErroDeDados("nao-encontrado", `Ação ${anterior} não encontrada.`);
      const hipotese = acoes.map((a) => (a.codigo === codigo ? { ...a, dependeDe: [...(a.dependeDe ?? []), anterior] } : a));
      try {
        ordenarPorDependencia(hipotese);
      } catch {
        throw new ErroDeDados("ciclo", `${anterior} já depende de ${codigo}, direta ou indiretamente. A dependência criaria um ciclo.`);
      }
      await banco.acrescentarNaLista(espacoId, codigo, "dependeDe", [anterior], carimbo());
    },
    async retirarDependencia(espacoId, codigo, anterior) {
      await banco.retirarDaLista(espacoId, codigo, "dependeDe", [anterior], carimbo());
    },

    // --- estimativas e conclusão (seções 4.3, 5.3 e 5.4) ---
    /** Reestimativa: tempo que falta, a partir de hoje; entra no fim do histórico. */
    async reestimar(espacoId, codigo, { o, m, p, motivo = "" }) {
      validarEstimativa({ o, m, p });
      await exigirAcao(espacoId, codigo);
      const estimativa = { em: hoje(), por: usuario, o, m, p, contaDe: "data", ...(motivo.trim() ? { motivo: motivo.trim() } : {}) };
      await banco.acrescentarEstimativa(espacoId, codigo, estimativa, carimbo());
    },
    /**
     * Ajusta a estimativa sem criar histórico: ainda é planejamento, ou é correção de digitação.
     * Quem chama decide se pode (estimativaLivre, em js/acao.js). Sem estimativa, cria a primeira.
     */
    async corrigirEstimativa(espacoId, codigo, { o, m, p }) {
      validarEstimativa({ o, m, p });
      const { estimativas = [] } = await exigirAcao(espacoId, codigo);
      const ultima = estimativas.at(-1);
      const estimativa = { ...ultima, em: hoje(), por: usuario, o, m, p, contaDe: ultima?.contaDe ?? "liberacao" };
      if (!ultima) await banco.acrescentarEstimativa(espacoId, codigo, estimativa, carimbo());
      else await banco.trocarUltimaEstimativa(espacoId, codigo, estimativa, estimativas.length, carimbo());
    },
    /** Registra a conclusão. A data não pode ser futura. */
    async concluir(espacoId, codigo, data) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? "")) throw new ErroDeDados("data-invalida", "Informe a data de conclusão.");
      if (data > hoje()) throw new ErroDeDados("data-futura", "A data de conclusão não pode ser depois de hoje.");
      await exigirAcao(espacoId, codigo);
      await banco.alterarAcao(espacoId, codigo, { concluidaEm: data, ...carimbo() });
    },
    async desfazerConclusao(espacoId, codigo) {
      await exigirAcao(espacoId, codigo);
      await banco.alterarAcao(espacoId, codigo, { concluidaEm: null, ...carimbo() });
    },

    // --- responsáveis ---
    async criarResponsavel(dados) {
      recusarDesconhecidos(dados, "responsavel");
      const { nome, sigla = "", ...outros } = dados;
      if (!nome?.trim()) throw new ErroDeDados("nome-vazio", "Informe o nome do responsável.");
      validarTipo(dados);
      return banco.criarResponsavel(novoId(), {
        ...outros, nome: nome.trim(), sigla: sigla.trim(),
        criadoEm: agora(), alteradoEm: agora(), alteradoPor: usuario,
      });
    },
    listarResponsaveis: () => banco.listarResponsaveis(),
    async alterarResponsavel(id, campos) {
      recusarDesconhecidos(campos, "responsavel");
      recusarFixos(campos, ["id", "criadoEm"]);
      if ("tipo" in campos || campos.usuario) {
        const atual = (await banco.listarResponsaveis()).find((r) => r.id === id);
        validarTipo({ ...atual, ...campos });
      }
      await banco.alterarResponsavel(id, { ...campos, alteradoEm: agora(), alteradoPor: usuario });
    },

    // --- tempo real ---
    acompanharEspaco: (espacoId, aoMudar) => banco.acompanharEspaco(espacoId, aoMudar),
  };
}
