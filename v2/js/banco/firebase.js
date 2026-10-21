/**
 * Conexão com o Firebase da versão 2 (especificação, seções 3.3 e 3.4; passo 1.14):
 * carrega o SDK pelo jsDelivr, com versão fixa, e devolve o banco (`firestore.js`)
 * e o acesso (entrar, sair, trocar e redefinir senha).
 * O acesso fica neste arquivo para que a troca de banco (Fase 4) troque os dois juntos.
 */
import { criarBancoFirestore } from "./firestore.js";

export const VERSAO_SDK = "10.14.1";
const BASE = `https://cdn.jsdelivr.net/npm/firebase@${VERSAO_SDK}/`;

function carregarScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Não foi possível carregar ${url}`));
    document.head.append(s);
  });
}

/** Mensagens para os erros de login do Firebase. */
const ERROS = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/invalid-email": "O e-mail informado não é válido.",
  "auth/missing-password": "Informe a senha.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet.",
  "auth/user-disabled": "Este usuário foi desativado. Procure o administrador.",
  "auth/weak-password": "A senha nova precisa ter pelo menos 6 caracteres.",
  "auth/requires-recent-login": "Por segurança, saia e entre de novo antes de trocar a senha.",
};
const traduzir = (e) => (!e?.code && e instanceof Error ? e : new Error(ERROS[e?.code] ?? `Não foi possível concluir: ${e?.message ?? e}`));
const protegido = (f) => async (...args) => {
  try { return await f(...args); } catch (e) { throw traduzir(e); }
};

/**
 * @param {object} config configuração do app web (v2/config.js)
 * @returns {Promise<{banco: object, acesso: object}>}
 */
export async function conectarFirebase(config) {
  if (!globalThis.firebase?.firestore) {
    await carregarScript(BASE + "firebase-app-compat.js");
    await Promise.all([carregarScript(BASE + "firebase-auth-compat.js"), carregarScript(BASE + "firebase-firestore-compat.js")]);
  }
  const { firebase } = globalThis;
  const app = firebase.initializeApp(config);
  const db = firebase.firestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  const auth = firebase.auth(app);
  try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch { /* segue com o padrão */ }

  const acesso = {
    /** Avisa o e-mail de quem entrou (ou null) agora e a cada entrada ou saída. */
    aoMudarUsuario: (f) => auth.onAuthStateChanged((u) => f(u?.email?.toLowerCase() ?? null)),
    entrar: protegido((email, senha) => auth.signInWithEmailAndPassword(email.trim(), senha)),
    sair: protegido(() => auth.signOut()),
    /** Confere a senha atual antes de trocar (seção 8.1). */
    trocarSenha: protegido(async (atual, nova) => {
      const u = auth.currentUser;
      try {
        await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, atual));
      } catch (e) {
        if (["auth/invalid-credential", "auth/wrong-password"].includes(e?.code)) throw new Error("A senha atual não confere.");
        throw e;
      }
      await u.updatePassword(nova);
    }),
    redefinirSenha: protegido((email) => auth.sendPasswordResetEmail(email.trim())),
  };
  return { banco: criarBancoFirestore(db, firebase.firestore.FieldValue), acesso };
}
