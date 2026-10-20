/**
 * Banco em memória: guarda os dados só enquanto a página está aberta.
 * Usado no espaço de exemplo, nos testes e, até o passo 1.14, em toda a versão 2.
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
  const espacos = new Map();
  /** @type {Map<string, Map<string, object>>} */
  const acoesPorEspaco = new Map();
  /** @type {Map<string, object>} */
  const responsaveis = new Map();
  /** @type {Map<string, Set<Function>>} */
  const ouvintes = new Map();

  const acoesDo = (espacoId) => {
    if (!acoesPorEspaco.has(espacoId)) acoesPorEspaco.set(espacoId, new Map());
    return acoesPorEspaco.get(espacoId);
  };

  const exigirEspaco = (espacoId) => {
    if (!espacos.has(espacoId)) throw new ErroDeDados("nao-encontrado", `Espaço ${espacoId} não encontrado.`);
  };

  const fotografia = (espacoId) => ({
    espaco: copia(espacos.get(espacoId)),
    acoes: [...acoesDo(espacoId).values()].map(copia),
  });

  const avisar = (espacoId) => {
    for (const aoMudar of ouvintes.get(espacoId) ?? []) aoMudar(fotografia(espacoId));
  };

  return {
    // --- espaços ---
    async criarEspaco(id, dados) {
      if (espacos.has(id)) throw new ErroDeDados("id-ocupado", `Já existe um espaço com o id ${id}.`);
      espacos.set(id, copia({ ...dados, id }));
      return id;
    },
    async lerEspaco(id) {
      return espacos.has(id) ? copia(espacos.get(id)) : null;
    },
    async listarEspacos() {
      return [...espacos.values()].map(copia);
    },
    async alterarEspaco(id, campos) {
      exigirEspaco(id);
      espacos.set(id, { ...espacos.get(id), ...copia(campos) });
      avisar(id);
    },

    // --- ações ---
    /** Cria a ação só se o código estiver livre no espaço (especificação, seção 4.6). */
    async criarAcao(espacoId, acao) {
      exigirEspaco(espacoId);
      const acoes = acoesDo(espacoId);
      if (acoes.has(acao.codigo)) {
        throw new ErroDeDados("codigo-ocupado", `Já existe uma ação com o código ${acao.codigo}. Escolha outro.`);
      }
      acoes.set(acao.codigo, copia(acao));
      avisar(espacoId);
    },
    async lerAcao(espacoId, codigo) {
      const acao = acoesDo(espacoId).get(codigo);
      return acao ? copia(acao) : null;
    },
    async listarAcoes(espacoId) {
      return [...acoesDo(espacoId).values()].map(copia);
    },
    /** Grava só os campos informados; os demais ficam como estão (seção 4.6). */
    async alterarAcao(espacoId, codigo, campos) {
      const acoes = acoesDo(espacoId);
      if (!acoes.has(codigo)) throw new ErroDeDados("nao-encontrado", `Ação ${codigo} não encontrada.`);
      acoes.set(codigo, { ...acoes.get(codigo), ...copia(campos) });
      avisar(espacoId);
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
     * Avisa `aoMudar` agora e a cada mudança no espaço ou nas ações dele.
     * Devolve a função que para de avisar.
     */
    acompanharEspaco(espacoId, aoMudar) {
      exigirEspaco(espacoId);
      if (!ouvintes.has(espacoId)) ouvintes.set(espacoId, new Set());
      ouvintes.get(espacoId).add(aoMudar);
      aoMudar(fotografia(espacoId));
      return () => ouvintes.get(espacoId).delete(aoMudar);
    },
  };
}
