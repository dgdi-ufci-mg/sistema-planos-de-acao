/**
 * Partida do módulo Superior (passo 2.5): a gestão da estratégia, com telas próprias, o mesmo banco, o mesmo
 * login e a mesma aparência do sistema de planos (decisão do responsável, 24/10/2026: módulo separado, nome
 * provisório "Superior"). Sem o Firebase, roda na memória, com um catálogo de exemplo.
 */
import { FIREBASE_CONFIG } from "../../config.js";
import { conectarFirebase } from "../banco/firebase.js";
import { criarBancoLocal } from "../banco/local.js";
import { criarStore, hojeLocal } from "../dados.js";
import { NOME } from "../identidade.js";
import { simboloSvg } from "../marca.js";
import { esc } from "../formato.js";
import { abrirEntrar, abrirTrocarSenha } from "../telas/acesso.js";
import { avisar } from "../telas/painel.js";
import { mostrarSuperior } from "./telas.js";
import { carregarCatalogoDeExemplo } from "./exemplo.js";
import { criarVigiaDeConexao, sondaDoSite } from "../conexao.js";
import { registrarAplicativo } from "../telas/instalar.js";

registrarAplicativo("../sw.js"); // o mesmo aplicativo instalável do sistema de planos

/** Nome provisório do módulo, num lugar só. */
export const NOME_DO_MODULO = "Superior";
document.title = NOME_DO_MODULO;
document.querySelector("[data-simbolo]")?.insertAdjacentHTML("afterbegin", simboloSvg(26)); // símbolo do sistema, nas cores do tema

const hoje = hojeLocal();
const principal = document.querySelector("#principal");
const conta = document.querySelector("[data-conta]");
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

/* barra do topo: vidro ao rolar, como no sistema de planos */
const topo = document.querySelector(".topo");
window.addEventListener("scroll", () => topo.classList.toggle("rolou", window.scrollY > 4), { passive: true });

function desenharConta() {
  conta.innerHTML = `
    <a class="botao discreto" href="../">← ${esc(NOME)}: planos</a>
    ${usuario ? `<span class="tec superior-email">${esc(usuario)}</span>
      <button class="botao discreto" type="button" data-conta-acao="senha">Trocar senha</button>
      <button class="botao discreto" type="button" data-conta-acao="sair">Sair</button>`
      : acesso ? '<button class="botao" type="button" data-conta-acao="entrar">Entrar</button>' : ""}`;
}
conta.addEventListener("click", async (e) => {
  const acao = e.target.closest("[data-conta-acao]")?.dataset.contaAcao;
  if (acao === "entrar") abrirEntrar({ acesso });
  if (acao === "senha") abrirTrocarSenha({ acesso });
  if (acao === "sair") { try { await acesso.sair(); avisar("Você saiu."); } catch (falha) { avisar(falha.message); } }
});

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
    principal.insertAdjacentHTML("beforebegin", '<p class="aviso-papel superior-aviso-exemplo">Catálogo de exemplo, na memória: nada é gravado.</p>');
  }
  tela = mostrarSuperior(principal, { store, hoje });
  desenharConta();
  if (!acesso) return tela.recarregar();
  vigia.verificar();
  acesso.aoMudarUsuario(async (email) => {
    usuario = email;
    store.definirUsuario(email);
    desenharConta();
    await tela.recarregar();
  });
}
partida();
