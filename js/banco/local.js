/**
 * Banco em memória: guarda os dados só enquanto a página está aberta.
 * Usado no espaço de exemplo, nos testes e, até o passo 1.14, em toda a versão 2.
 *
 * Cada banco (este, o Firebase e, no futuro, o PostgreSQL) oferece as mesmas
 * operações, com os mesmos nomes e as mesmas garantias. Os testes de
 * `testes/contrato-banco.js` conferem isso (documentação técnica, seção 3.4).
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
  /** Responsáveis de cada espaço (seção 4.5): espacoId → (id → responsável). */
  /** @type {Map<string, Map<string, object>>} */
  const responsaveisPorEspaco = new Map();
  /** @type {Map<string, Set<Function>>} */
  const ouvintes = new Map();
  /** Calendário geral, o mesmo para todos os espaços. */
  let calendario = null;
  let administradoresDoSistema = null;
  /** Usuários cadastrados pela tela (27/10/2026; seção 4.1.13): e-mail → cadastro. */
  const usuarios = new Map();
  /** Estratégia (passo 2.5): o modelo (camadas) e as coleções do catálogo, comuns a todos os espaços. */
  let modeloEstrategia = null;
  const preferenciasDoMapa = new Map(); // e-mail → preferência pessoal do Mapa (lote 6)
  const colecoes = { instrumentos: new Map(), itensEstrategicos: new Map() };
  const colecao = (nome) => {
    if (!colecoes[nome]) throw new ErroDeDados("colecao-desconhecida", `Coleção ${nome} desconhecida.`);
    return colecoes[nome];
  };
  /** Histórico de alterações das ações (passo 1.16): espacoId → registros, só de acréscimo. */
  const historicoPorEspaco = new Map();
  /** Retratos (passo 1.18): espacoId → (id → {cabecalho, acoes}); só leitura depois de criados. */
  const retratosPorEspaco = new Map();
  const retratosDo = (espacoId) => {
    if (!retratosPorEspaco.has(espacoId)) retratosPorEspaco.set(espacoId, new Map());
    return retratosPorEspaco.get(espacoId);
  };
  /** Comentários das ações (passo 2.9): espacoId → (id → comentário); nunca apagados, só escondidos. */
  const comentariosPorEspaco = new Map();
  const comentariosDo = (espacoId) => {
    if (!comentariosPorEspaco.has(espacoId)) comentariosPorEspaco.set(espacoId, new Map());
    return comentariosPorEspaco.get(espacoId);
  };
  /** Entregas do Plano de Ação e registros de alcance (passo 2.6): espacoId → nome da coleção → (id → documento). */
  const NO_ESPACO = ["entregas", "alcances"];
  const noEspacoPorEspaco = new Map();
  const noEspaco = (espacoId, nome) => {
    if (!NO_ESPACO.includes(nome)) throw new ErroDeDados("colecao-desconhecida", `Coleção ${nome} desconhecida.`);
    if (!noEspacoPorEspaco.has(espacoId)) noEspacoPorEspaco.set(espacoId, Object.fromEntries(NO_ESPACO.map((n) => [n, new Map()])));
    return noEspacoPorEspaco.get(espacoId)[nome];
  };
  /** Quem acompanha os comentários de uma ação: "espacoId|numero" → funções. */
  const ouvintesDeComentarios = new Map();
  const daAcao = (espacoId, numero) => [...comentariosDo(espacoId).values()].filter((c) => c.acao === numero).map(copia);
  const avisarComentarios = (espacoId, numero) => {
    for (const f of ouvintesDeComentarios.get(`${espacoId}|${numero}`) ?? []) f(daAcao(espacoId, numero));
  };
  const historicoDo = (espacoId) => {
    if (!historicoPorEspaco.has(espacoId)) historicoPorEspaco.set(espacoId, []);
    return historicoPorEspaco.get(espacoId);
  };
  /** Grava os registros do histórico, se a operação os pediu (`historico(antes, depois)`). */
  const registrar = (espacoId, historico, antes, depois) => {
    if (historico) historicoDo(espacoId).push(...copia(historico(copia(antes), copia(depois))));
  };

  const acoesDo = (espacoId) => {
    if (!acoesPorEspaco.has(espacoId)) acoesPorEspaco.set(espacoId, new Map());
    return acoesPorEspaco.get(espacoId);
  };

  const responsaveisDo = (espacoId) => {
    if (!responsaveisPorEspaco.has(espacoId)) responsaveisPorEspaco.set(espacoId, new Map());
    return responsaveisPorEspaco.get(espacoId);
  };

  const exigirEspaco = (espacoId) => {
    if (!espacos.has(espacoId)) throw new ErroDeDados("nao-encontrado", `Espaço ${espacoId} não encontrado.`);
  };

  const fotografia = (espacoId) => ({
    espaco: copia(espacos.get(espacoId)),
    acoes: [...acoesDo(espacoId).values()].map(copia),
    responsaveis: [...responsaveisDo(espacoId).values()].map(copia),
  });

  const avisar = (espacoId) => {
    for (const aoMudar of ouvintes.get(espacoId) ?? []) aoMudar(fotografia(espacoId));
  };
  const avisarTodos = () => { for (const espacoId of ouvintes.keys()) avisar(espacoId); };

  /**
   * Lê, calcula e grava a ação de uma vez, sem espera no meio, com os registros do histórico
   * (`historico`, opcional: recebe a ação antes e depois e devolve os registros).
   */
  const mudarAcao = (espacoId, numero, mudanca, historico) => {
    const acoes = acoesDo(espacoId);
    if (!acoes.has(numero)) throw new ErroDeDados("nao-encontrado", `Ação ${numero} não encontrada.`);
    const atual = acoes.get(numero);
    const nova = { ...atual, ...copia(mudanca(copia(atual))) };
    registrar(espacoId, historico, atual, nova); // calcula antes de gravar: se falhar, nada muda
    acoes.set(numero, nova);
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
    async criarAcao(espacoId, acao, historico) {
      exigirEspaco(espacoId);
      const acoes = acoesDo(espacoId);
      if (acoes.has(acao.numero)) {
        throw new ErroDeDados("numero-ocupado", `Já existe uma ação com o número ${acao.numero}.`);
      }
      registrar(espacoId, historico, null, acao);
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
    async alterarAcao(espacoId, numero, campos, historico) {
      mudarAcao(espacoId, numero, () => campos, historico);
    },

    /**
     * Acrescenta itens a uma lista da ação, sem repetir os que já estão (seção 4.6):
     * duas pessoas acrescentando ao mesmo tempo não apagam uma à outra.
     * `extra`: outros campos gravados junto, como a data e o autor da alteração.
     * Lê e grava de uma vez, sem espera no meio (no Firebase: arrayUnion).
     */
    async acrescentarNaLista(espacoId, numero, campo, itens, extra = {}, historico) {
      mudarAcao(espacoId, numero, (a) => {
        const lista = a[campo] ?? [];
        return { ...extra, [campo]: [...lista, ...itens.filter((i) => !lista.includes(i))] };
      }, historico);
    },
    /** Retira itens de uma lista da ação, sem regravar os demais (seção 4.6; no Firebase: arrayRemove). */
    async retirarDaLista(espacoId, numero, campo, itens, extra = {}, historico) {
      mudarAcao(espacoId, numero, (a) => ({ ...extra, [campo]: (a[campo] ?? []).filter((i) => !itens.includes(i)) }), historico);
    },
    /**
     * Muda o checklist da ação (passo 2.8): `mudanca` recebe a lista atual e devolve a nova.
     * Lê e grava de uma vez: duas pessoas marcando itens ao mesmo tempo não apagam uma à outra.
     */
    async mudarChecklist(espacoId, numero, mudanca, extra = {}, historico) {
      mudarAcao(espacoId, numero, (a) => ({ ...extra, checklist: mudanca(a.checklist ?? []) }), historico);
    },
    /** Muda os documentos da ação (passo 2.10a), como o checklist: lê e grava de uma vez. */
    async mudarDocumentos(espacoId, numero, mudanca, extra = {}, historico) {
      mudarAcao(espacoId, numero, (a) => ({ ...extra, documentos: mudanca(a.documentos ?? []) }), historico);
    },
    /** Acrescenta uma estimativa no fim do histórico, sem regravar as anteriores (seção 4.6). */
    async acrescentarEstimativa(espacoId, numero, estimativa, extra = {}, historico) {
      mudarAcao(espacoId, numero, (a) => ({ ...extra, estimativas: [...(a.estimativas ?? []), estimativa] }), historico);
    },
    /**
     * Troca a estimativa mais recente (correção, seção 4.3), só se a ação ainda tiver
     * `quantas` estimativas: se alguém acrescentou outra nesse meio-tempo, recusa
     * (no Firebase: transação).
     */
    async trocarUltimaEstimativa(espacoId, numero, estimativa, quantas, extra = {}, historico) {
      mudarAcao(espacoId, numero, (a) => {
        const lista = a.estimativas ?? [];
        if (!quantas || lista.length !== quantas) {
          throw new ErroDeDados("estimativa-mudou", "Alguém registrou outra estimativa nesta ação agora. Confira o histórico antes de corrigir.");
        }
        return { ...extra, estimativas: [...lista.slice(0, -1), estimativa] };
      }, historico);
    },

    // --- retratos (passo 1.18) ---
    /** Grava o cabeçalho e as ações do retrato de uma vez. O id não se repete; ninguém altera depois. */
    async criarRetrato(espacoId, cabecalho, acoes) {
      exigirEspaco(espacoId);
      const lista = retratosDo(espacoId);
      if (lista.has(cabecalho.id)) throw new ErroDeDados("id-ocupado", `Já existe um retrato com o id ${cabecalho.id}.`);
      lista.set(cabecalho.id, { cabecalho: copia(cabecalho), acoes: copia(acoes) });
      return cabecalho.id;
    },
    /** Cabeçalhos dos retratos do espaço (sem as ações). */
    async listarRetratos(espacoId) {
      return [...retratosDo(espacoId).values()].map((r) => copia(r.cabecalho));
    },
    async listarAcoesDoRetrato(espacoId, retratoId) {
      const r = retratosDo(espacoId).get(retratoId);
      return r ? copia(r.acoes) : [];
    },

    // --- histórico de alterações (passo 1.16) ---
    /** Registros de uma ação, do mais antigo ao mais recente. Ninguém altera nem apaga. */
    async listarHistorico(espacoId, numero) {
      return historicoDo(espacoId).filter((r) => r.chave === numero).map(copia);
    },
    /** Registros já prontos, vindos de uma cópia de segurança (restauração, passo 1.19b). */
    async gravarHistorico(espacoId, registros) {
      exigirEspaco(espacoId);
      historicoDo(espacoId).push(...copia(registros));
    },
    /** Todos os registros do espaço (cópia de segurança). */
    async listarHistoricoDoEspaco(espacoId) {
      return historicoDo(espacoId).map(copia);
    },

    // --- comentários das ações (passo 2.9): nunca apagados do banco ---
    async criarComentario(espacoId, comentario) {
      exigirEspaco(espacoId);
      const lista = comentariosDo(espacoId);
      if (lista.has(comentario.id)) throw new ErroDeDados("id-ocupado", `Já existe um comentário com o id ${comentario.id}.`);
      lista.set(comentario.id, copia(comentario));
      avisarComentarios(espacoId, comentario.acao);
    },
    /** Muda um comentário: `mudanca` recebe o atual e devolve os campos novos. */
    async mudarComentario(espacoId, id, mudanca) {
      const atual = comentariosDo(espacoId).get(id);
      if (!atual) throw new ErroDeDados("nao-encontrado", "Comentário não encontrado.");
      const novo = { ...atual, ...copia(mudanca(copia(atual))) };
      comentariosDo(espacoId).set(id, novo);
      avisarComentarios(espacoId, atual.acao);
    },
    async listarComentarios(espacoId, numero) {
      return daAcao(espacoId, numero);
    },
    async listarComentariosDoEspaco(espacoId) {
      return [...comentariosDo(espacoId).values()].map(copia);
    },
    /** Avisa a cada mudança nos comentários da ação, já com a lista atual. Devolve a função que para. */
    acompanharComentarios(espacoId, numero, aoMudar) {
      const chave = `${espacoId}|${numero}`;
      if (!ouvintesDeComentarios.has(chave)) ouvintesDeComentarios.set(chave, new Set());
      ouvintesDeComentarios.get(chave).add(aoMudar);
      aoMudar(daAcao(espacoId, numero));
      return () => ouvintesDeComentarios.get(chave)?.delete(aoMudar);
    },

    // --- entregas e registros de alcance de cada espaço (passo 2.6): `nome` é "entregas" ou "alcances" ---
    async listarDoEspaco(espacoId, nome) {
      return [...noEspaco(espacoId, nome).values()].map(copia);
    },
    async criarNoEspaco(espacoId, nome, id, dados) {
      exigirEspaco(espacoId);
      const lista = noEspaco(espacoId, nome);
      if (lista.has(id)) throw new ErroDeDados("id-ocupado", `Já existe ${id} em ${nome}.`);
      lista.set(id, { ...copia(dados), id });
    },
    /** Lê e muda de uma vez (`mudanca` recebe o atual e devolve os campos novos). */
    async mudarNoEspaco(espacoId, nome, id, mudanca) {
      const lista = noEspaco(espacoId, nome);
      const atual = lista.get(id);
      if (!atual) throw new ErroDeDados("nao-encontrado", "Item não encontrado.");
      lista.set(id, { ...atual, ...copia(mudanca(copia(atual))) });
    },

    // --- responsáveis: de cada espaço (seção 4.5) ---
    async criarResponsavel(espacoId, id, dados) {
      exigirEspaco(espacoId);
      const lista = responsaveisDo(espacoId);
      if (lista.has(id)) throw new ErroDeDados("id-ocupado", `Já existe um responsável com o id ${id}.`);
      lista.set(id, copia({ ...dados, id }));
      avisar(espacoId);
      return id;
    },
    async listarResponsaveis(espacoId) {
      return [...responsaveisDo(espacoId).values()].map(copia);
    },
    async alterarResponsavel(espacoId, id, campos) {
      const lista = responsaveisDo(espacoId);
      if (!lista.has(id)) throw new ErroDeDados("nao-encontrado", `Responsável ${id} não encontrado.`);
      lista.set(id, { ...lista.get(id), ...copia(campos) });
      avisar(espacoId);
    },

    // --- calendário geral (seção 4.1.5) ---
    async lerCalendarioGeral() {
      return calendario ? copia(calendario) : null;
    },
    async gravarCalendarioGeral(dados) {
      calendario = copia(dados);
      avisarTodos(); // vale para todos os espaços
    },
    /**
     * Administradores do Sistema (passo 2.3): no Firebase, um documento editado só no console.
     * Aqui, na memória, `gravarAdministradoresDoSistema` existe só para os testes.
     */
    async lerAdministradoresDoSistema() {
      return administradoresDoSistema ? copia(administradoresDoSistema) : null;
    },
    async gravarAdministradoresDoSistema(dados) {
      administradoresDoSistema = copia(dados);
    },
    // --- usuários cadastrados pela tela (27/10/2026; seção 4.1.13) ---
    async listarUsuarios() {
      return [...usuarios.values()].map(copia);
    },
    async gravarUsuario(email, dados) {
      usuarios.set(email, copia({ ...dados, email }));
    },

    // --- preferência pessoal do Mapa (lote 6; seção 4.11.5) ---
    async lerPreferenciaDoMapa(email) {
      return preferenciasDoMapa.has(email) ? copia(preferenciasDoMapa.get(email)) : null;
    },
    async gravarPreferenciaDoMapa(email, dados) {
      preferenciasDoMapa.set(email, copia(dados));
    },
    async apagarPreferenciaDoMapa(email) {
      preferenciasDoMapa.delete(email);
    },

    // --- estratégia: catálogo do desdobramento (passo 2.5; seção 4.11) ---
    async lerModeloEstrategia() {
      return modeloEstrategia ? copia(modeloEstrategia) : null;
    },
    async gravarModeloEstrategia(dados) {
      modeloEstrategia = copia(dados);
    },
    /** Coleções comuns do catálogo: "instrumentos" e "itensEstrategicos". */
    async listarColecao(nome) {
      return [...colecao(nome).values()].map(copia);
    },
    async criarNaColecao(nome, id, dados) {
      if (colecao(nome).has(id)) throw new ErroDeDados("id-ocupado", `Já existe ${id} em ${nome}.`);
      colecao(nome).set(id, { ...copia(dados), id });
    },
    /** Lê e muda de uma vez (`mudanca` recebe o atual e devolve os campos novos): duas gravações não se apagam. */
    async mudarNaColecao(nome, id, mudanca) {
      const atual = colecao(nome).get(id);
      if (!atual) throw new ErroDeDados("nao-encontrado", "Item não encontrado.");
      colecao(nome).set(id, { ...atual, ...copia(mudanca(copia(atual))) });
    },

    // --- tempo real ---
    /**
     * Avisa `aoMudar` agora e a cada mudança no espaço, nas ações ou nos responsáveis dele
     * (e no calendário geral), com {espaco, acoes, responsaveis}.
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
