/**
 * Banco no Firestore (versão 2, segundo projeto do Firebase; especificação, seções 3.3, 3.4 e 4.9).
 * Oferece as mesmas operações do banco em memória (`local.js`), com as mesmas garantias,
 * conferidas pelos testes de `testes/contrato-banco.js`.
 *
 * Só este arquivo conhece termos do Firestore (coleção, documento, transação, onSnapshot,
 * arrayUnion). Onde fica cada entidade:
 *   espacos/{id}                    espaço
 *   espacos/{id}/acoes/{numero}     ação
 *   responsaveis/{id}               responsável
 *   sistema/calendario              calendário geral
 *
 * Recebe o Firestore já iniciado (`db`, API compat) e `FieldValue`, para os testes
 * poderem usar um Firestore falso, em memória (`testes/firestore-falso.js`).
 */
import { ErroDeDados } from "./local.js";

/* Cópia só ao gravar documentos inteiros. Em `update`, nunca: copiar transforma o arrayUnion e o
 * arrayRemove em objetos comuns, que seriam gravados no lugar da lista (falha encontrada em 21/10/2026). */
const copia = (valor) => structuredClone(valor);

/** Traduz os erros do Firestore para mensagens do sistema. */
function traduzir(erro) {
  if (erro instanceof ErroDeDados) return erro;
  if (erro?.code === "permission-denied") {
    return new ErroDeDados("sem-permissao", "Sem permissão no banco de dados. Entre com seu e-mail e senha.");
  }
  if (erro?.code === "unavailable") {
    return new ErroDeDados("sem-conexao", "Sem conexão com o banco de dados. Confira a internet e tente de novo.");
  }
  if (erro?.code === "not-found") return new ErroDeDados("nao-encontrado", "Item não encontrado.");
  return new ErroDeDados("banco", `Não foi possível gravar: ${erro?.message ?? erro}`);
}

/** Executa a operação e devolve o erro já traduzido. */
const protegido = (operacao) => async (...args) => {
  try {
    return await operacao(...args);
  } catch (e) {
    throw traduzir(e);
  }
};

/**
 * @param {any} db         Firestore (API compat): firebase.firestore()
 * @param {any} FieldValue firebase.firestore.FieldValue
 */
export function criarBancoFirestore(db, FieldValue) {
  const espacoRef = (id) => db.collection("espacos").doc(id);
  const acoesRef = (espacoId) => espacoRef(espacoId).collection("acoes");
  const acaoRef = (espacoId, numero) => acoesRef(espacoId).doc(String(numero));
  const responsaveisRef = () => db.collection("responsaveis");
  const calendarioRef = () => db.collection("sistema").doc("calendario");

  /* ---------- tempo real ----------
   * Responsáveis e calendário geral valem para todos os espaços. Ficam guardados aqui,
   * acompanhados por um só ouvinte cada, para não reler tudo a cada mudança. */
  let responsaveis = null; // Map id → responsável, quando acompanhado
  let calendario; // undefined: ainda não acompanhado
  let pararGerais = null;
  /** espacoId → conjunto de funções que avisam a tela */
  const ouvintes = new Map();
  const avisarTodos = () => { for (const avisos of ouvintes.values()) for (const avisar of avisos) avisar(); };

  /**
   * Os ouvintes dos responsáveis e do calendário ficam ligados enquanto a página estiver aberta,
   * sem parar e recomeçar a cada troca de espaço. A cópia guardada só é aceita quando confirmada
   * pelo servidor (fromCache falso): uma leitura parcial, só com o que o aparelho já tinha, faria
   * responsáveis sumirem da tela (falha vista em 21/10/2026). Sem cópia válida, ou se o ouvinte
   * falhar, as leituras vão direto ao banco.
   */
  function acompanharGerais() {
    if (pararGerais) return;
    const daServidor = (s) => !s.metadata?.fromCache;
    const falhou = (erro) => {
      console.error("Ouvinte geral do Firestore falhou:", erro);
      pararGerais?.();
    };
    /* a primeira leitura confirmada não avisa: a tela já leu esses dados ao abrir o espaço */
    const p1 = responsaveisRef().onSnapshot((s) => {
      if (!daServidor(s)) return;
      const primeira = !responsaveis;
      responsaveis = new Map(s.docs.map((d) => [d.id, d.data()]));
      if (!primeira) avisarTodos();
    }, falhou);
    const p2 = calendarioRef().onSnapshot((s) => {
      if (!daServidor(s)) return;
      const primeira = calendario === undefined;
      calendario = s.exists ? s.data() : null;
      if (!primeira) avisarTodos();
    }, falhou);
    pararGerais = () => { p1(); p2(); pararGerais = null; responsaveis = null; calendario = undefined; };
  }

  /** Lê dentro de uma transação e recusa se a ação não existir. */
  async function lerNaTransacao(t, ref, numero) {
    const s = await t.get(ref);
    if (!s.exists) throw new ErroDeDados("nao-encontrado", `Ação ${numero} não encontrada.`);
    return s.data();
  }

  const banco = {
    // --- espaços ---
    async criarEspaco(id, dados) {
      await db.runTransaction(async (t) => {
        if ((await t.get(espacoRef(id))).exists) throw new ErroDeDados("id-ocupado", `Já existe um espaço com o id ${id}.`);
        t.set(espacoRef(id), { ...copia(dados), id });
      });
      return id;
    },
    async lerEspaco(id) {
      const s = await espacoRef(id).get();
      return s.exists ? s.data() : null;
    },
    async listarEspacos() {
      return (await db.collection("espacos").get()).docs.map((d) => d.data());
    },
    async alterarEspaco(id, campos) {
      try {
        await espacoRef(id).update(campos);
      } catch (e) {
        if (e?.code === "not-found") throw new ErroDeDados("nao-encontrado", `Espaço ${id} não encontrado.`);
        throw e;
      }
    },

    // --- ações ---
    /** Contador do espaço, numa transação: cada número sai uma vez só (seção 4.6). */
    async reservarNumero(espacoId) {
      return db.runTransaction(async (t) => {
        const s = await t.get(espacoRef(espacoId));
        if (!s.exists) throw new ErroDeDados("nao-encontrado", `Espaço ${espacoId} não encontrado.`);
        const numero = s.data().proximoNumero ?? 1;
        t.update(espacoRef(espacoId), { proximoNumero: numero + 1 });
        return numero;
      });
    },
    async criarAcao(espacoId, acao) {
      await db.runTransaction(async (t) => {
        if (!(await t.get(espacoRef(espacoId))).exists) throw new ErroDeDados("nao-encontrado", `Espaço ${espacoId} não encontrado.`);
        const ref = acaoRef(espacoId, acao.numero);
        if ((await t.get(ref)).exists) throw new ErroDeDados("numero-ocupado", `Já existe uma ação com o número ${acao.numero}.`);
        t.set(ref, copia(acao));
      });
    },
    async lerAcao(espacoId, numero) {
      const s = await acaoRef(espacoId, numero).get();
      return s.exists ? s.data() : null;
    },
    async listarAcoes(espacoId) {
      return (await acoesRef(espacoId).get()).docs.map((d) => d.data());
    },
    async alterarAcao(espacoId, numero, campos) {
      try {
        await acaoRef(espacoId, numero).update(campos);
      } catch (e) {
        if (e?.code === "not-found") throw new ErroDeDados("nao-encontrado", `Ação ${numero} não encontrada.`);
        throw e;
      }
    },
    /** Acréscimo item a item, sem regravar a lista (arrayUnion; seção 4.6). */
    async acrescentarNaLista(espacoId, numero, campo, itens, extra = {}) {
      await banco.alterarAcao(espacoId, numero, { ...extra, [campo]: FieldValue.arrayUnion(...itens) });
    },
    async retirarDaLista(espacoId, numero, campo, itens, extra = {}) {
      await banco.alterarAcao(espacoId, numero, { ...extra, [campo]: FieldValue.arrayRemove(...itens) });
    },
    /**
     * Estimativa no fim do histórico. Por transação, e não por arrayUnion: este juntaria
     * duas estimativas idênticas numa só.
     */
    async acrescentarEstimativa(espacoId, numero, estimativa, extra = {}) {
      const ref = acaoRef(espacoId, numero);
      await db.runTransaction(async (t) => {
        const a = await lerNaTransacao(t, ref, numero);
        t.update(ref, { ...copia(extra), estimativas: [...(a.estimativas ?? []), copia(estimativa)] });
      });
    },
    async trocarUltimaEstimativa(espacoId, numero, estimativa, quantas, extra = {}) {
      const ref = acaoRef(espacoId, numero);
      await db.runTransaction(async (t) => {
        const lista = (await lerNaTransacao(t, ref, numero)).estimativas ?? [];
        if (!quantas || lista.length !== quantas) {
          throw new ErroDeDados("estimativa-mudou", "Alguém registrou outra estimativa nesta ação agora. Confira o histórico antes de corrigir.");
        }
        t.update(ref, { ...copia(extra), estimativas: [...lista.slice(0, -1), copia(estimativa)] });
      });
    },

    // --- responsáveis ---
    /**
     * Gravação simples, sem transação: o id é um UUID novo, e assim o ouvinte recebe o
     * responsável na hora, antes da confirmação do servidor (quem cadastra e já escolhe
     * o responsável numa ação precisa encontrá-lo na lista).
     */
    async criarResponsavel(id, dados) {
      await responsaveisRef().doc(id).set({ ...copia(dados), id });
      return id;
    },
    async listarResponsaveis() {
      if (responsaveis) return [...responsaveis.values()].map(copia);
      return (await responsaveisRef().get()).docs.map((d) => d.data());
    },
    async alterarResponsavel(id, campos) {
      try {
        await responsaveisRef().doc(id).update(campos);
      } catch (e) {
        if (e?.code === "not-found") throw new ErroDeDados("nao-encontrado", `Responsável ${id} não encontrado.`);
        throw e;
      }
    },

    // --- calendário geral ---
    async lerCalendarioGeral() {
      if (calendario !== undefined) return calendario ? copia(calendario) : null;
      const s = await calendarioRef().get();
      return s.exists ? s.data() : null;
    },
    async gravarCalendarioGeral(dados) {
      await calendarioRef().set(copia(dados));
    },

    // --- tempo real ---
    /**
     * Avisa `aoMudar` quando o espaço e as ações chegam e a cada mudança neles,
     * nos responsáveis ou no calendário geral. Devolve a função que para de avisar.
     */
    acompanharEspaco(espacoId, aoMudar) {
      acompanharGerais();
      let espaco;
      let acoes;
      const avisar = () => {
        if (espaco !== undefined && acoes !== undefined && espaco !== null) aoMudar({ espaco: copia(espaco), acoes: acoes.map(copia) });
      };
      if (!ouvintes.has(espacoId)) ouvintes.set(espacoId, new Set());
      ouvintes.get(espacoId).add(avisar);
      const falhou = (erro) => console.error("Ouvinte do espaço falhou:", erro);
      const p1 = espacoRef(espacoId).onSnapshot((s) => { espaco = s.exists ? s.data() : null; avisar(); }, falhou);
      const p2 = acoesRef(espacoId).onSnapshot((s) => { acoes = s.docs.map((d) => d.data()); avisar(); }, falhou);
      return () => {
        p1(); p2();
        ouvintes.get(espacoId)?.delete(avisar);
        if (!ouvintes.get(espacoId)?.size) ouvintes.delete(espacoId);
      };
    },
  };

  /* toda operação assíncrona devolve erros já traduzidos */
  for (const [nome, operacao] of Object.entries(banco)) {
    if (nome !== "acompanharEspaco") banco[nome] = protegido(operacao);
  }
  return banco;
}
