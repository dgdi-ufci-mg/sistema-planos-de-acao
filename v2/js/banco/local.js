/**
 * Banco em memória: guarda os dados só enquanto a página está aberta.
 * Usado no plano de exemplo, nos testes e, até o passo 1.14, em toda a versão 2.
 *
 * Cada banco (este, o Firebase e, no futuro, o PostgreSQL) oferece as mesmas
 * operações, com os mesmos nomes e as mesmas garantias. Os testes de
 * `testes/contrato-banco.js` conferem isso (especificação, seção 3.4).
 */

/** Erro de dados com um código fixo, para a tela saber o que aconteceu. */
export class ErroDeDados extends Error {
  /** @param {string} codigo @param {string} mensagem */
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

const copia = (valor) => structuredClone(valor);

/** Cria um banco em memória vazio. */
export function criarBancoLocal() {
  /** @type {Map<string, object>} */
  const planos = new Map();
  /** @type {Map<string, Map<string, object>>} */
  const acoesPorPlano = new Map();
  /** @type {Map<string, object>} */
  const responsaveis = new Map();
  /** @type {Map<string, Set<Function>>} */
  const ouvintes = new Map();

  const acoesDo = (planoId) => {
    if (!acoesPorPlano.has(planoId)) acoesPorPlano.set(planoId, new Map());
    return acoesPorPlano.get(planoId);
  };

  const exigirPlano = (planoId) => {
    if (!planos.has(planoId)) throw new ErroDeDados("nao-encontrado", `Plano ${planoId} não encontrado.`);
  };

  const fotografia = (planoId) => ({
    plano: copia(planos.get(planoId)),
    acoes: [...acoesDo(planoId).values()].map(copia),
  });

  const avisar = (planoId) => {
    for (const aoMudar of ouvintes.get(planoId) ?? []) aoMudar(fotografia(planoId));
  };

  return {
    // --- planos ---
    async criarPlano(id, dados) {
      if (planos.has(id)) throw new ErroDeDados("id-ocupado", `Já existe um plano com o id ${id}.`);
      planos.set(id, copia({ ...dados, id }));
      return id;
    },
    async lerPlano(id) {
      return planos.has(id) ? copia(planos.get(id)) : null;
    },
    async listarPlanos() {
      return [...planos.values()].map(copia);
    },
    async alterarPlano(id, campos) {
      exigirPlano(id);
      planos.set(id, { ...planos.get(id), ...copia(campos) });
      avisar(id);
    },

    // --- ações ---
    /** Cria a ação só se o código estiver livre no plano (especificação, seção 4.6). */
    async criarAcao(planoId, acao) {
      exigirPlano(planoId);
      const acoes = acoesDo(planoId);
      if (acoes.has(acao.codigo)) {
        throw new ErroDeDados("codigo-ocupado", `Já existe uma ação com o código ${acao.codigo}. Escolha outro.`);
      }
      acoes.set(acao.codigo, copia(acao));
      avisar(planoId);
    },
    async lerAcao(planoId, codigo) {
      const acao = acoesDo(planoId).get(codigo);
      return acao ? copia(acao) : null;
    },
    async listarAcoes(planoId) {
      return [...acoesDo(planoId).values()].map(copia);
    },
    /** Grava só os campos informados; os demais ficam como estão (seção 4.6). */
    async alterarAcao(planoId, codigo, campos) {
      const acoes = acoesDo(planoId);
      if (!acoes.has(codigo)) throw new ErroDeDados("nao-encontrado", `Ação ${codigo} não encontrada.`);
      acoes.set(codigo, { ...acoes.get(codigo), ...copia(campos) });
      avisar(planoId);
    },

    // --- responsáveis ---
    async criarResponsavel(id, dados) {
      if (responsaveis.has(id)) throw new ErroDeDados("id-ocupado", `Já existe um responsável com o id ${id}.`);
      responsaveis.set(id, copia({ ...dados, id }));
      return id;
    },
    async listarResponsaveis() {
      return [...responsaveis.values()].map(copia);
    },
    async alterarResponsavel(id, campos) {
      if (!responsaveis.has(id)) throw new ErroDeDados("nao-encontrado", `Responsável ${id} não encontrado.`);
      responsaveis.set(id, { ...responsaveis.get(id), ...copia(campos) });
    },

    // --- tempo real ---
    /**
     * Avisa `aoMudar` agora e a cada mudança no plano ou nas ações dele.
     * Devolve a função que para de avisar.
     */
    acompanharPlano(planoId, aoMudar) {
      exigirPlano(planoId);
      if (!ouvintes.has(planoId)) ouvintes.set(planoId, new Set());
      ouvintes.get(planoId).add(aoMudar);
      aoMudar(fotografia(planoId));
      return () => ouvintes.get(planoId).delete(aoMudar);
    },
  };
}
