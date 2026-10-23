/**
 * Banco no Firestore (versão 2, segundo projeto do Firebase; especificação, seções 3.3, 3.4 e 4.9).
 * Oferece as mesmas operações do banco em memória (`local.js`), com as mesmas garantias,
 * conferidas pelos testes de `testes/contrato-banco.js`.
 *
 * Só este arquivo conhece termos do Firestore (coleção, documento, transação, onSnapshot,
 * arrayUnion). Onde fica cada entidade:
 *   espacos/{id}                    espaço
 *   espacos/{id}/acoes/{numero}     ação
 *   espacos/{id}/responsaveis/{id}  responsável do espaço (seção 4.5)
 *   espacos/{id}/historico/{id}     histórico de alterações das ações (seção 4.2.1), só de acréscimo
 *   espacos/{id}/retratos/{id}      retrato (seção 4.4): cabeçalho; as ações em .../acoes/{numero}
 *   sistema/calendario              calendário geral
 *
 * Recebe o Firestore já iniciado (`db`, API compat), para os testes
 * poderem usar um Firestore falso, em memória (`testes/firebase-falso.js`).
 */
import { ErroDeDados } from "./local.js";

/* Cópia dos dados gravados. Desde o passo 1.16, as ações mudam por transação, com valores comuns;
 * o arrayUnion e o arrayRemove, que uma cópia estragaria (falha encontrada em 21/10/2026), saíram. */
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
 */
export function criarBancoFirestore(db) {
  const espacoRef = (id) => db.collection("espacos").doc(id);
  const acoesRef = (espacoId) => espacoRef(espacoId).collection("acoes");
  const acaoRef = (espacoId, numero) => acoesRef(espacoId).doc(String(numero));
  const responsaveisRef = (espacoId) => espacoRef(espacoId).collection("responsaveis");
  const historicoRef = (espacoId) => espacoRef(espacoId).collection("historico");
  const retratosRef = (espacoId) => espacoRef(espacoId).collection("retratos");

  /** Na mesma transação da mudança, grava os registros do histórico (um não existe sem o outro). */
  const registrar = (t, espacoId, historico, antes, depois) => {
    if (!historico) return;
    for (const r of historico(antes ? copia(antes) : null, copia(depois))) t.set(historicoRef(espacoId).doc(r.id), copia(r));
  };

  /**
   * Muda uma ação numa transação: lê, calcula os campos novos (`mudanca`, que recebe a ação atual),
   * grava só esses campos e, junto, o histórico. Com duas pessoas ao mesmo tempo, o Firestore
   * refaz a transação de quem chegou depois, sobre a ação já atualizada (seção 4.6).
   */
  async function mudarAcao(espacoId, numero, mudanca, historico) {
    const ref = acaoRef(espacoId, numero);
    await db.runTransaction(async (t) => {
      const atual = await lerNaTransacao(t, ref, numero);
      const campos = copia(mudanca(copia(atual)));
      t.update(ref, campos);
      registrar(t, espacoId, historico, atual, { ...atual, ...campos });
    });
  }
  const calendarioRef = () => db.collection("sistema").doc("calendario");

  /* ---------- tempo real ----------
   * O calendário geral vale para todos os espaços: fica guardado aqui, acompanhado por um só
   * ouvinte, ligado enquanto a página estiver aberta. A cópia só é aceita quando confirmada pelo
   * servidor (fromCache falso): uma leitura parcial faria dados sumirem da tela (falha vista em
   * 21/10/2026). Sem cópia válida, ou se o ouvinte falhar, as leituras vão direto ao banco. */
  let calendario; // undefined: ainda não acompanhado
  let pararGerais = null;
  /** espacoId → conjunto de funções que avisam a tela */
  const ouvintes = new Map();
  const avisarTodos = () => { for (const avisos of ouvintes.values()) for (const avisar of avisos) avisar(); };

  function acompanharGerais() {
    if (pararGerais) return;
    const p2 = calendarioRef().onSnapshot((s) => {
      if (s.metadata?.fromCache) return;
      const primeira = calendario === undefined; // a primeira não avisa: a tela já leu ao abrir o espaço
      calendario = s.exists ? s.data() : null;
      if (!primeira) avisarTodos();
    }, (erro) => {
      console.error("Ouvinte do calendário geral falhou:", erro);
      pararGerais?.();
    });
    pararGerais = () => { p2(); pararGerais = null; calendario = undefined; };
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
    async criarAcao(espacoId, acao, historico) {
      await db.runTransaction(async (t) => {
        if (!(await t.get(espacoRef(espacoId))).exists) throw new ErroDeDados("nao-encontrado", `Espaço ${espacoId} não encontrado.`);
        const ref = acaoRef(espacoId, acao.numero);
        if ((await t.get(ref)).exists) throw new ErroDeDados("numero-ocupado", `Já existe uma ação com o número ${acao.numero}.`);
        t.set(ref, copia(acao));
        registrar(t, espacoId, historico, null, acao);
      });
    },
    async lerAcao(espacoId, numero) {
      const s = await acaoRef(espacoId, numero).get();
      return s.exists ? s.data() : null;
    },
    async listarAcoes(espacoId) {
      return (await acoesRef(espacoId).get()).docs.map((d) => d.data());
    },
    /** Grava só os campos informados; os demais ficam como estão (seção 4.6). */
    async alterarAcao(espacoId, numero, campos, historico) {
      await mudarAcao(espacoId, numero, () => campos, historico);
    },
    /** Acréscimo item a item, sem repetir e sem perder o que outra pessoa acrescentou ao mesmo tempo (seção 4.6). */
    async acrescentarNaLista(espacoId, numero, campo, itens, extra = {}, historico) {
      await mudarAcao(espacoId, numero, (a) => {
        const lista = a[campo] ?? [];
        return { ...extra, [campo]: [...lista, ...itens.filter((i) => !lista.includes(i))] };
      }, historico);
    },
    async retirarDaLista(espacoId, numero, campo, itens, extra = {}, historico) {
      await mudarAcao(espacoId, numero, (a) => ({ ...extra, [campo]: (a[campo] ?? []).filter((i) => !itens.includes(i)) }), historico);
    },
    /** Estimativa no fim do histórico de estimativas (duas iguais continuam sendo duas). */
    /** Muda o checklist da ação numa transação (passo 2.8; seção 4.6): `mudanca` recebe a lista atual. */
    async mudarChecklist(espacoId, numero, mudanca, extra = {}, historico) {
      await mudarAcao(espacoId, numero, (a) => ({ ...extra, checklist: mudanca(a.checklist ?? []) }), historico);
    },
    async acrescentarEstimativa(espacoId, numero, estimativa, extra = {}, historico) {
      await mudarAcao(espacoId, numero, (a) => ({ ...extra, estimativas: [...(a.estimativas ?? []), estimativa] }), historico);
    },
    async trocarUltimaEstimativa(espacoId, numero, estimativa, quantas, extra = {}, historico) {
      await mudarAcao(espacoId, numero, (a) => {
        const lista = a.estimativas ?? [];
        if (!quantas || lista.length !== quantas) {
          throw new ErroDeDados("estimativa-mudou", "Alguém registrou outra estimativa nesta ação agora. Confira o histórico antes de corrigir.");
        }
        return { ...extra, estimativas: [...lista.slice(0, -1), estimativa] };
      }, historico);
    },

    // --- retratos (passo 1.18) ---
    /**
     * Cabeçalho e ações numa transação: o retrato aparece inteiro ou não aparece. As ações ficam
     * em documentos próprios, para um espaço grande não passar do limite de 1 MB por documento (seção 4.4).
     */
    async criarRetrato(espacoId, cabecalho, acoes) {
      const ref = retratosRef(espacoId).doc(cabecalho.id);
      await db.runTransaction(async (t) => {
        if (!(await t.get(espacoRef(espacoId))).exists) throw new ErroDeDados("nao-encontrado", `Espaço ${espacoId} não encontrado.`);
        if ((await t.get(ref)).exists) throw new ErroDeDados("id-ocupado", `Já existe um retrato com o id ${cabecalho.id}.`);
        t.set(ref, copia(cabecalho));
        for (const a of acoes) t.set(ref.collection("acoes").doc(String(a.numero)), copia(a));
      });
      return cabecalho.id;
    },
    async listarRetratos(espacoId) {
      return (await retratosRef(espacoId).get()).docs.map((d) => d.data());
    },
    async listarAcoesDoRetrato(espacoId, retratoId) {
      return (await retratosRef(espacoId).doc(retratoId).collection("acoes").get()).docs.map((d) => d.data());
    },

    // --- histórico de alterações (passo 1.16) ---
    /** Registros de uma ação, em qualquer ordem (sem orderBy, para não exigir índice composto). */
    async listarHistorico(espacoId, numero) {
      const s = await historicoRef(espacoId).where("chave", "==", numero).get();
      return s.docs.map((d) => d.data()); // o Store ordena
    },
    /** Registros já prontos, vindos de uma cópia de segurança (restauração, passo 1.19b), em lotes de 400. */
    async gravarHistorico(espacoId, registros) {
      for (let i = 0; i < registros.length; i += 400) {
        await db.runTransaction(async (t) => {
          for (const r of registros.slice(i, i + 400)) t.set(historicoRef(espacoId).doc(r.id), copia(r));
        });
      }
    },
    /** Todos os registros do espaço (cópia de segurança). */
    async listarHistoricoDoEspaco(espacoId) {
      return (await historicoRef(espacoId).get()).docs.map((d) => d.data()).sort((a, b) => a.em.localeCompare(b.em));
    },

    // --- responsáveis: de cada espaço (seção 4.5) ---
    /**
     * Gravação simples, sem transação: o id é um UUID novo, e assim o ouvinte recebe o
     * responsável na hora, antes da confirmação do servidor (quem cadastra e já escolhe
     * o responsável numa ação precisa encontrá-lo na lista).
     */
    async criarResponsavel(espacoId, id, dados) {
      await responsaveisRef(espacoId).doc(id).set({ ...copia(dados), id });
      return id;
    },
    async listarResponsaveis(espacoId) {
      return (await responsaveisRef(espacoId).get()).docs.map((d) => d.data());
    },
    async alterarResponsavel(espacoId, id, campos) {
      try {
        await responsaveisRef(espacoId).doc(id).update(campos);
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
     * Avisa `aoMudar` quando o espaço, as ações e os responsáveis chegam e a cada mudança neles
     * ou no calendário geral, com {espaco, acoes, responsaveis}. Devolve a função que para de avisar.
     */
    acompanharEspaco(espacoId, aoMudar) {
      acompanharGerais();
      let espaco;
      let acoes;
      let responsaveis;
      const avisar = () => {
        if (espaco === undefined || espaco === null || acoes === undefined || responsaveis === undefined) return;
        aoMudar({ espaco: copia(espaco), acoes: acoes.map(copia), responsaveis: responsaveis.map(copia) });
      };
      if (!ouvintes.has(espacoId)) ouvintes.set(espacoId, new Set());
      ouvintes.get(espacoId).add(avisar);
      const falhou = (erro) => console.error("Ouvinte do espaço falhou:", erro);
      const p1 = espacoRef(espacoId).onSnapshot((s) => { espaco = s.exists ? s.data() : null; avisar(); }, falhou);
      const p2 = acoesRef(espacoId).onSnapshot((s) => { acoes = s.docs.map((d) => d.data()); avisar(); }, falhou);
      const p3 = responsaveisRef(espacoId).onSnapshot((s) => { responsaveis = s.docs.map((d) => d.data()); avisar(); }, falhou);
      return () => {
        p1(); p2(); p3();
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
