/**
 * Partida do Strata, antes módulo Superior (passo 2.5): a gestão da estratégia, com telas próprias, o mesmo banco, o mesmo
 * login e a mesma aparência do sistema de planos (decisão do responsável, 24/10/2026: módulo separado, nome
 * provisório "Superior"). Sem o Firebase, roda na memória, com um catálogo de exemplo.
 */
import { FIREBASE_CONFIG } from "../../config.js";
import { conectarFirebase } from "../banco/firebase.js";
import { criarBancoLocal } from "../banco/local.js";
import { criarStore, hojeLocal } from "../dados.js";
import { INSTITUICAO, INSTITUICAO_POR_EXTENSO } from "../identidade.js";
import { strataLogotipoSvg } from "../marca.js";
import { abrirEntrar, abrirTrocarSenha } from "../telas/acesso.js";
import { avisar } from "../telas/painel.js";
import { mostrarSuperior } from "./telas.js";
import { carregarCatalogoDeExemplo } from "./exemplo.js";
import { criarVigiaDeConexao, sondaDoSite } from "../conexao.js";
import { registrarAplicativo } from "../telas/instalar.js";

registrarAplicativo("../sw.js"); // o mesmo service worker; o manifesto é o do Strata (strata/manifest.webmanifest)

/** Nome do módulo, num lugar só (antes "Superior"; Strata desde 27/10/2026, decisão do responsável). Por serem
 * arquivos estáticos, o nome também está em `strata/index.html` e `strata/manifest.webmanifest` (teste em
 * testes/aplicativo.test.js). */
export const NOME_DO_MODULO = "Strata";
document.title = NOME_DO_MODULO;
document.querySelector("[data-logotipo]")?.insertAdjacentHTML("afterbegin", strataLogotipoSvg(24)); // logotipo do Strata, nas cores do tema (29/10/2026)
/* sob o título, o nome da universidade: por extenso; na tela estreita, a sigla (tela cheia, 29/10/2026) */
document.querySelector("[data-instituicao]")?.insertAdjacentHTML("afterbegin",
  `<span class="extenso">${INSTITUICAO_POR_EXTENSO}</span><span class="sigla" aria-hidden="true">${INSTITUICAO}</span>`);

const hoje = hojeLocal();
const principal = document.querySelector("#principal");
let store = null;
let acesso = null;
let usuario = null;
let tela = null;

/* sem conexão: o mesmo aviso e a mesma recusa de gravar do sistema de planos (js/conexao.js) */
const avisoConexao = document.querySelector("[data-sem-conexao]");
const vigia = criarVigiaDeConexao({
  sondar: sondaDoSite(new URL("../config.js", location.href).href),
  temRede: () => navigator.onLine,
  aoMudar: (on) => {
    if (!acesso) return;
    store.definirConexao(on);
    avisoConexao.hidden = on;
    if (on) avisar("Conexão restabelecida. As alterações voltam a ser gravadas.");
  },
});
window.addEventListener("offline", () => vigia.verificar());
window.addEventListener("online", () => vigia.verificar());
document.addEventListener("visibilitychange", () => { if (!document.hidden) vigia.verificar(); });

/* a conta (entrar, trocar senha, sair) fica no menu do Mapa (tela cheia, 29/10/2026), desenhado por js/superior/telas.js */
const conta = {
  usuario: () => usuario,
  podeEntrar: () => Boolean(acesso),
  entrar: () => abrirEntrar({ acesso }),
  trocarSenha: () => abrirTrocarSenha({ acesso }),
  sair: async () => { try { await acesso.sair(); avisar("Você saiu."); } catch (falha) { avisar(falha.message); } },
};

async function partida() {
  if (FIREBASE_CONFIG) {
    try {
      const conexao = await conectarFirebase(FIREBASE_CONFIG);
      acesso = conexao.acesso;
      store = criarStore(conexao.banco, { exigirLogin: true });
    } catch (e) {
      console.error(e);
      avisar("Não foi possível conectar ao banco de dados. O módulo abriu com um catálogo de exemplo, sem gravar.");
    }
  }
  if (!store) {
    store = criarStore(criarBancoLocal());
    await carregarCatalogoDeExemplo(store);
    document.querySelector("[data-avisos]").insertAdjacentHTML("beforeend", '<p class="aviso-papel superior-aviso-exemplo">Catálogo de exemplo, na memória: nada é gravado.</p>');
  }
  tela = mostrarSuperior(principal, { store, hoje, conta, comandos: document.querySelector("[data-comandos]"), avisos: document.querySelector("[data-avisos]"), cima: document.querySelector(".strata-cima") });
  if (!acesso) return tela.recarregar();
  vigia.verificar();
  acesso.aoMudarUsuario(async (email) => {
    usuario = email;
    store.definirUsuario(email);
    await tela.recarregar();
  });
}
partida();
