/**
 * Store: o único caminho entre as telas e o banco (especificação, seção 3.4).
 *
 * Oferece operações com nomes do próprio sistema e aplica as regras que valem
 * para qualquer banco: validação, carimbos de data e autor, campos imutáveis.
 * Quem executa as operações é o banco recebido (por enquanto, o banco em memória).
 */
import { ErroDeDados } from "./banco/local.js";
import { CAMPOS } from "./modelo.js";

export { ErroDeDados };

/** Padrões de um espaço novo (especificação, seções 4.1 e 5.7). */
export const SIMULACOES_PADRAO = 10000;
export const SEMENTE_PADRAO = 20261014;

/** Código da ação: de 2 a 8 letras ou números (especificação, seção 8.3). */
const CODIGO_VALIDO = /^[A-Za-z0-9]{2,8}$/;

/** Campos que não mudam depois de criados. */
const FIXOS_DO_ESPACO = ["id", "semente", "simulacoes", "criadoEm"];
const FIXOS_DA_ACAO = ["codigo", "criadaEm"];

/**
 * @typedef {object} OpcoesDoStore
 * @property {() => string} [agora]   momento atual, em ISO 8601 (substituível nos testes)
 * @property {string|null} [usuario]  quem está gravando
 * @property {() => string} [novoId]  gerador de identificadores
 */

/**
 * @param {ReturnType<import("./banco/local.js").criarBancoLocal>} banco
 * @param {OpcoesDoStore} [opcoes]
 */
export function criarStore(banco, opcoes = {}) {
  const agora = opcoes.agora ?? (() => new Date().toISOString());
  const usuario = opcoes.usuario ?? null;
  const novoId = opcoes.novoId ?? (() => globalThis.crypto.randomUUID());

  /** Recusa campos fora do dicionário de dados (especificação, seção 4). */
  const recusarDesconhecidos = (campos, entidade) => {
    const desconhecido = Object.keys(campos).find((campo) => !CAMPOS[entidade].includes(campo));
    if (desconhecido) throw new ErroDeDados("campo-desconhecido", `O campo "${desconhecido}" não existe em ${entidade}.`);
  };

  const recusarFixos = (campos, fixos) => {
    const proibido = Object.keys(campos).find((campo) => fixos.includes(campo));
    if (proibido) throw new ErroDeDados("campo-fixo", `O campo "${proibido}" não pode ser alterado.`);
  };

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
      const acoes = await banco.listarAcoes(espacoId);
      const ordem = Math.max(0, ...acoes.map((a) => a.ordem ?? 0)) + 1;
      await banco.criarAcao(espacoId, {
        dependeDe: [], responsaveis: [], estimativas: [],
        ...outros,
        codigo, rotulo: rotulo.trim(), ordem,
        criadaEm: agora(), alteradaEm: agora(), alteradaPor: usuario,
      });
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
    },

    // --- responsáveis ---
    async criarResponsavel(dados) {
      recusarDesconhecidos(dados, "responsavel");
      const { nome, sigla = "", ...outros } = dados;
      if (!nome?.trim()) throw new ErroDeDados("nome-vazio", "Informe o nome do responsável.");
      return banco.criarResponsavel(novoId(), {
        ...outros, nome: nome.trim(), sigla: sigla.trim(),
        criadoEm: agora(), alteradoEm: agora(), alteradoPor: usuario,
      });
    },
    listarResponsaveis: () => banco.listarResponsaveis(),
    async alterarResponsavel(id, campos) {
      recusarDesconhecidos(campos, "responsavel");
      recusarFixos(campos, ["id", "criadoEm"]);
      await banco.alterarResponsavel(id, { ...campos, alteradoEm: agora(), alteradoPor: usuario });
    },

    // --- tempo real ---
    acompanharEspaco: (espacoId, aoMudar) => banco.acompanharEspaco(espacoId, aoMudar),
  };
}
