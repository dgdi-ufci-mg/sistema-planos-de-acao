/**
 * Configuração do Firebase da versão 2: projeto "sextante-v2", separado do sistema em uso
 * (especificação, seção 3.3). Estes valores são públicos por desenho do Firebase e não dão
 * acesso a nada: quem protege os dados são as regras (v2/firestore.rules) e o login.
 * Com `null`, a versão 2 funciona só na memória (testes e desenvolvimento sem internet).
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA_Mz37rAbaLS_xbMbgDX39CpqIUpvtHoc",
  authDomain: "sextante-v2.firebaseapp.com",
  projectId: "sextante-v2",
  storageBucket: "sextante-v2.firebasestorage.app",
  messagingSenderId: "382720871237",
  appId: "1:382720871237:web:ed822c49149a9255b58c2c",
};
