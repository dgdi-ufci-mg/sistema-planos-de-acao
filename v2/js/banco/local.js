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
  /** Calendário geral, o mesmo para todos os espaços. */
  let calendario = null;

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
  const avisarTodos = () => { for (const espacoId of ouvintes.keys()) avisar(espacoId); };

  /** Lê, calcula e grava a ação de uma vez, sem espera no meio. */
  const mudarAcao = (espacoId, numero, mudanca) => {
    const acoes = acoesDo(espacoId);
    if (!acoes.has(numero)) throw new ErroDeDados("nao-encontrado", `Ação ${numero} não encontrada.`);
    const atual = acoes.get(numero);
    acoes.set(numero, { ...atual, ...copia(mudanca(copia(atual))) });
    avisar(espacoId);
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
    /**
     * Reserva o próximo número de ação do espaço: 1, 2, 3… Cada número sai uma vez só,
     * mesmo com duas pessoas criando ações ao mesmo tempo, e nunca é reaproveitado
     * (seção 4.2; no Firebase: transação sobre o contador do espaço).
     */
    async reservarNumero(espacoId) {
      exigirEspaco(espacoId);
      const espaco = espacos.get(espacoId);
      const numero = espaco.proximoNumero ?? 1;
      espacos.set(espacoId, { ...espaco, proximoNumero: numero + 1 });
      return numero;
    },
    /** Cria a ação só se o número estiver livre no espaço (seção 4.6). */
    async criarAcao(espacoId, acao) {
      exigirEspaco(espacoId);
      const acoes = acoesDo(espacoId);
      if (acoes.has(acao.numero)) {
        throw new ErroDeDados("numero-ocupado", `Já existe uma ação com o número ${acao.numero}.`);
      }
      acoes.set(acao.numero, copia(acao));
      avisar(espacoId);
    },
    async lerAcao(espacoId, numero) {
      const acao = acoesDo(espacoId).get(numero);
      return acao ? copia(acao) : null;
    },
    async listarAcoes(espacoId) {
      return [...acoesDo(espacoId).values()].map(copia);
    },
    /** Grava só os campos informados; os demais ficam como estão (seção 4.6). */
    async alterarAcao(espacoId, numero, campos) {
      mudarAcao(espacoId, numero, () => campos);
    },

    /**
     * Acrescenta itens a uma lista da ação, sem repetir os que já estão (seção 4.6):
     * duas pessoas acrescentando ao mesmo tempo não apagam uma à outra.
     * `extra`: outros campos gravados junto, como a data e o autor da alteração.
     * Lê e grava de uma vez, sem espera no meio (no Firebase: arrayUnion).
     */
    async acrescentarNaLista(espacoId, numero, campo, itens, extra = {}) {
      mudarAcao(espacoId, numero, (a) => {
        const lista = a[campo] ?? [];
        return { ...extra, [campo]: [...lista, ...itens.filter((i) => !lista.includes(i))] };
      });
    },
    /** Retira itens de uma lista da ação, sem regravar os demais (seção 4.6; no Firebase: arrayRemove). */
    async retirarDaLista(espacoId, numero, campo, itens, extra = {}) {
      mudarAcao(espacoId, numero, (a) => ({ ...extra, [campo]: (a[campo] ?? []).filter((i) => !itens.includes(i)) }));
    },
    /** Acrescenta uma estimativa no fim do histórico, sem regravar as anteriores (seção 4.6). */
    async acrescentarEstimativa(espacoId, numero, estimativa, extra = {}) {
      mudarAcao(espacoId, numero, (a) => ({ ...extra, estimativas: [...(a.estimativas ?? []), estimativa] }));
    },
    /**
     * Troca a estimativa mais recente (correção, seção 4.3), só se a ação ainda tiver
     * `quantas` estimativas: se alguém acrescentou outra nesse meio-tempo, recusa
     * (no Firebase: transação).
     */
    async trocarUltimaEstimativa(espacoId, numero, estimativa, quantas, extra = {}) {
      mudarAcao(espacoId, numero, (a) => {
        const lista = a.estimativas ?? [];
        if (!quantas || lista.length !== quantas) {
          throw new ErroDeDados("estimativa-mudou", "Alguém registrou outra estimativa nesta ação agora. Confira o histórico antes de corrigir.");
        }
        return { ...extra, estimativas: [...lista.slice(0, -1), estimativa] };
      });
    },

    // --- responsáveis ---
    async criarResponsavel(id, dados) {
      if (responsaveis.has(id)) throw new ErroDeDados("id-ocupado", `Já existe um responsável com o id ${id}.`);
      responsaveis.set(id, copia({ ...dados, id }));
      avisarTodos(); // responsáveis são de todos os espaços
      return id;
    },
    async listarResponsaveis() {
      return [...responsaveis.values()].map(copia);
    },
    async alterarResponsavel(id, campos) {
      if (!responsaveis.has(id)) throw new ErroDeDados("nao-encontrado", `Responsável ${id} não encontrado.`);
      responsaveis.set(id, { ...responsaveis.get(id), ...copia(campos) });
      avisarTodos();
    },

    // --- calendário geral (seção 4.1.5) ---
    async lerCalendarioGeral() {
      return calendario ? copia(calendario) : null;
    },
    async gravarCalendarioGeral(dados) {
      calendario = copia(dados);
      avisarTodos(); // vale para todos os espaços
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
