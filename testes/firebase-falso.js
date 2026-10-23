/**
 * Firebase falso, em memória, só para testes: imita a parte da API compat usada pelo sistema
 * (Firestore: documentos, coleções, transações, onSnapshot, arrayUnion e arrayRemove;
 * Auth: entrar, sair, trocar e redefinir senha). Nada sai do computador.
 *
 * Usado de dois jeitos:
 * - no Node, pelos testes de contrato do banco (`firestore.test.js`);
 * - no navegador, nos testes com Playwright: o teste serve este arquivo, sem as palavras
 *   `export`, no lugar do SDK do jsDelivr, e chama `criarFirebaseFalso()`.
 *
 * Não confere as regras do `firestore.rules`; com `exigirLogin`, só recusa gravações sem login,
 * como as regras do passo 1.14.
 */

const clonar = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Operação sobre lista. Classe, como no SDK: uma cópia (structuredClone) perde a classe e vira objeto comum. */
class OperacaoFalsa {
  constructor(tipo, itens) { this.tipo = tipo; this.itens = itens; }
}

export function criarFirestoreFalso({ auth = null, exigirLogin = false } = {}) {
  /** caminho do documento → dados */
  const docs = new Map();
  /** caminho → ouvintes (de documento ou de coleção) */
  const ouvintesDoc = new Map();
  const ouvintesColecao = new Map();
  let fila = Promise.resolve();

  const pai = (caminho) => caminho.split("/").slice(0, -1).join("/");
  const instantaneoDoc = (caminho) => {
    const dados = docs.get(caminho);
    return { exists: dados !== undefined, id: caminho.split("/").at(-1), data: () => clonar(dados) };
  };
  const instantaneoColecao = (caminho) => ({
    docs: [...docs.keys()].filter((c) => pai(c) === caminho).sort().map(instantaneoDoc),
  });

  function avisar(caminho) {
    for (const f of ouvintesDoc.get(caminho) ?? []) f(instantaneoDoc(caminho));
    for (const f of ouvintesColecao.get(pai(caminho)) ?? []) f(instantaneoColecao(pai(caminho)));
  }
  function exigirPermissao() {
    if (exigirLogin && !auth?.currentUser) throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
  }
  /** Aplica os campos, resolvendo arrayUnion e arrayRemove. */
  function aplicar(atual, campos) {
    const novo = { ...atual };
    for (const [k, v] of Object.entries(campos)) {
      if (v === undefined) continue;
      if (v instanceof OperacaoFalsa && v.tipo === "uniao") {
        const lista = Array.isArray(novo[k]) ? [...novo[k]] : [];
        for (const i of v.itens) if (!lista.some((x) => igual(x, i))) lista.push(clonar(i));
        novo[k] = lista;
      } else if (v instanceof OperacaoFalsa && v.tipo === "retirada") {
        novo[k] = (Array.isArray(novo[k]) ? novo[k] : []).filter((x) => !v.itens.some((i) => igual(x, i)));
      } else novo[k] = clonar(v);
    }
    return novo;
  }
  function gravar(caminho, dados) {
    docs.set(caminho, dados);
    avisar(caminho);
  }
  function alterar(caminho, campos) {
    if (!docs.has(caminho)) throw Object.assign(new Error(`No document to update: ${caminho}`), { code: "not-found" });
    gravar(caminho, aplicar(docs.get(caminho), campos));
  }
  function ouvir(mapa, caminho, f, inicial) {
    if (!mapa.has(caminho)) mapa.set(caminho, new Set());
    let ativo = true;
    const embrulho = (s) => { if (ativo) f(s); };
    mapa.get(caminho).add(embrulho);
    queueMicrotask(() => embrulho(inicial()));
    return () => { ativo = false; mapa.get(caminho).delete(embrulho); };
  }

  function docRef(caminho) {
    return {
      id: caminho.split("/").at(-1),
      path: caminho,
      collection: (nome) => colecaoRef(`${caminho}/${nome}`),
      async get() { await null; return instantaneoDoc(caminho); },
      async set(dados) { exigirPermissao(); await null; gravar(caminho, aplicar({}, dados)); },
      async update(campos) { exigirPermissao(); await null; alterar(caminho, campos); },
      onSnapshot: (f) => ouvir(ouvintesDoc, caminho, f, () => instantaneoDoc(caminho)),
    };
  }
  function colecaoRef(caminho) {
    return {
      path: caminho,
      doc: (id) => docRef(`${caminho}/${id}`),
      async get() { await null; return instantaneoColecao(caminho); },
      onSnapshot: (f) => ouvir(ouvintesColecao, caminho, f, () => instantaneoColecao(caminho)),
      /** Consulta simples por igualdade, como a usada no histórico. */
      where: (campo, operador, valor) => {
        if (operador !== "==") throw new Error(`Operador não imitado: ${operador}`);
        return {
          async get() {
            await null;
            const todos = instantaneoColecao(caminho).docs;
            return { docs: todos.filter((d) => igual(d.data()[campo], valor)) };
          },
        };
      },
    };
  }

  return {
    settings() {},
    collection: (nome) => colecaoRef(nome),
    /** Uma transação por vez; as gravações só valem se a função terminar sem erro. */
    runTransaction(funcao) {
      const executar = async () => {
        exigirPermissao();
        const gravacoes = [];
        const t = {
          get: (ref) => ref.get(),
          set: (ref, dados) => { gravacoes.push(() => gravar(ref.path, aplicar({}, dados))); return t; },
          update: (ref, campos) => { gravacoes.push(() => alterar(ref.path, campos)); return t; },
        };
        const resultado = await funcao(t);
        for (const g of gravacoes) g();
        return resultado;
      };
      const r = fila.then(executar);
      fila = r.catch(() => {});
      return r;
    },
    /** Só para os testes: o que está guardado, sem passar pela API. */
    _docs: docs,
  };
}

export const FieldValueFalso = {
  arrayUnion: (...itens) => new OperacaoFalsa("uniao", clonar(itens)),
  arrayRemove: (...itens) => new OperacaoFalsa("retirada", clonar(itens)),
};

/**
 * Auth falso. `usuarios`: e-mail → senha (valores de teste, nunca senhas reais).
 */
export function criarAuthFalso(usuarios = {}, enviados = []) {
  const ouvintes = new Set();
  const avisar = () => { for (const f of ouvintes) f(auth.currentUser); };
  const erro = (code) => Object.assign(new Error(code), { code });
  const usuario = (email) => ({
    email,
    async reauthenticateWithCredential(cred) {
      if (usuarios[email] !== cred.senha) throw erro("auth/invalid-credential");
    },
    async updatePassword(nova) {
      if (nova.length < 6) throw erro("auth/weak-password");
      usuarios[email] = nova;
    },
  });
  const auth = {
    currentUser: null,
    async setPersistence() {},
    onAuthStateChanged(f) {
      ouvintes.add(f);
      queueMicrotask(() => f(auth.currentUser));
      return () => ouvintes.delete(f);
    },
    async signInWithEmailAndPassword(email, senha) {
      await null;
      if (!email.includes("@")) throw erro("auth/invalid-email");
      if (usuarios[email] !== senha) throw erro("auth/invalid-credential");
      auth.currentUser = usuario(email);
      avisar();
    },
    async signOut() { auth.currentUser = null; avisar(); },
    async sendPasswordResetEmail(email) {
      if (!email.includes("@")) throw erro("auth/invalid-email");
      enviados.push(email);
    },
    async createUserWithEmailAndPassword(email, senha) {
      await null;
      if (!email.includes("@")) throw erro("auth/invalid-email");
      if (email in usuarios) throw erro("auth/email-already-in-use");
      usuarios[email] = senha;
      auth.currentUser = usuario(email);
      avisar();
    },
    /** Só para os testes: e-mails de redefinição de senha "enviados". */
    _enviados: enviados,
  };
  return auth;
}

/** Objeto global `firebase`, como o SDK compat, para o navegador. */
export function criarFirebaseFalso({ usuarios = {}, exigirLogin = true } = {}) {
  const auth = criarAuthFalso(usuarios);
  const db = criarFirestoreFalso({ auth, exigirLogin });
  const firestore = () => db;
  firestore.FieldValue = FieldValueFalso;
  /* cada instância (app) tem a sua sessão, com os mesmos usuários, como no SDK */
  const outras = new Map();
  const authFn = (app) => {
    if (!app?.name || app.name === "[DEFAULT]") return auth;
    if (!outras.has(app.name)) outras.set(app.name, criarAuthFalso(usuarios, auth._enviados));
    return outras.get(app.name);
  };
  authFn.EmailAuthProvider = { credential: (email, senha) => ({ email, senha }) };
  authFn.Auth = { Persistence: { LOCAL: "local", NONE: "none" } };
  return { initializeApp: (config, name = "[DEFAULT]") => ({ options: config, name }), firestore, auth: authFn, _db: db, _auth: auth, _usuarios: usuarios };
}
