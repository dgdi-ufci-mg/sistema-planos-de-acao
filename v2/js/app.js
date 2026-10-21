/**
 * Partida da versão 2: identidade, banco, login, barra do topo e abertura do sistema
 * (especificação, passos 1.4 a 1.6 e 1.14):
 * - os espaços ficam no Firebase da versão 2 (v2/config.js); sem configuração, ou se o banco
 *   não carregar, ficam só na memória;
 * - o espaço de exemplo fica sempre na memória, num banco à parte: nunca vai para o Firebase;
 * - quem chega por um link de espaço (#/espaco/<id>) abre esse espaço;
 * - senão, abre o último espaço aberto neste aparelho, se ele ainda existir;
 * - senão, vê as boas-vindas.
 */
import { NOME, INSTITUICAO } from "./identidade.js";
import { FIREBASE_CONFIG } from "../config.js";
import { criarBancoLocal } from "./banco/local.js";
import { conectarFirebase } from "./banco/firebase.js";
import { criarStore, hojeLocal } from "./dados.js";
import { carregarExemplo } from "./exemplo.js";
import { mostrarBoasVindas } from "./telas/abertura.js";
import { mostrarEspaco } from "./telas/espaco.js";
import { mostrarTopo } from "./telas/topo.js";
import { mostrarAjuda } from "./telas/ajuda.js";
import { avisar } from "./telas/painel.js";
import { abrirConfiguracao } from "./telas/configurar.js";
import { abrirConfiguracaoDoSistema } from "./telas/configurar-sistema.js";
import { abrirEntrar, abrirTrocarSenha } from "./telas/acesso.js";

document.title = NOME;
document.querySelector("[data-nome]").textContent = NOME;
document.querySelector("[data-instituicao]").textContent = INSTITUICAO;

/* barra do topo: "rolou" liga o vidro (especificação, seção 8.1) */
const topo = document.querySelector(".topo");
let pendente = false;
const marcarRolagem = () => {
  pendente = false;
  const rolou = window.scrollY > 4;
  topo.classList.toggle("rolou", rolou);
  document.body.classList.toggle("rolou", rolou);
};
window.addEventListener("scroll", () => {
  if (!pendente) { pendente = true; requestAnimationFrame(marcarRolagem); }
}, { passive: true });
marcarRolagem();

/* lembrança do último espaço, só neste aparelho; sem armazenamento, segue sem ela */
const CHAVE_ULTIMO = "sextante.ultimoEspaco";
const lembrar = (id) => { try { localStorage.setItem(CHAVE_ULTIMO, id); } catch { /* sem armazenamento */ } };
const esquecer = () => { try { localStorage.removeItem(CHAVE_ULTIMO); } catch { /* sem armazenamento */ } };
const ultimo = () => { try { return localStorage.getItem(CHAVE_ULTIMO); } catch { return null; } };

const hoje = hojeLocal();
const principal = document.querySelector("#principal");
const menus = document.querySelector(".menus");

/** Banco dos espaços (Firebase ou memória) e acesso (login), definidos na partida. */
let store = null;
let acesso = null;
/** E-mail de quem entrou, ou null. */
let usuario = null;
/** Exemplo: banco em memória à parte, criado na primeira vez que é aberto. */
let exemplo = null;
let exemploId = null;
let abertoId = null;

const storeDe = (id) => (id && id === exemploId ? exemplo : store);
const tentar = async (f, padrao) => { try { return await f(); } catch (e) { avisar(e.message); return padrao; } };

async function atualizarTopo() {
  const espacos = [
    ...await tentar(() => store.listarEspacos(), []),
    ...(exemplo ? await exemplo.listarEspacos() : []),
  ];
  const ligado = usuario ? (await tentar(() => store.listarResponsaveis(), [])).find((r) => r.usuario === usuario) : null;
  mostrarTopo(menus, {
    espacos,
    abertoId,
    usuario: usuario ? { email: usuario, nome: ligado?.nome } : null,
    comLogin: Boolean(acesso),
    podeConfigurar: Boolean(abertoId) && storeDe(abertoId).podeGravar,
    podeCriar: store.podeGravar,
    aoAbrir: abrirEspaco,
    aoConfigurar: () => abrirConfiguracao({ store: storeDe(abertoId), espacoId: abertoId }),
    aoNovo: () => boasVindas({ comFormulario: true }),
    aoBoasVindas: () => boasVindas(),
    aoAjuda: () => ajuda(),
    aoSistema: () => abrirConfiguracaoDoSistema({ store, hoje }),
    aoEntrar: entrar,
    aoTrocarSenha: () => abrirTrocarSenha({ acesso }),
    aoSair: () => tentar(async () => { await acesso.sair(); avisar("Você saiu."); }),
  });
}

const entrar = () => abrirEntrar({ acesso });

/** Ajuda; com `foco`, destaca um termo do glossário (links "o que é?"). */
function ajuda(foco) {
  mostrarAjuda({ foco, aoVerExemplo: verExemplo });
}

async function verExemplo() {
  if (!exemplo) {
    exemplo = criarStore(criarBancoLocal());
    exemploId = await carregarExemplo(exemplo);
  }
  await abrirEspaco(exemploId);
}

/** Para de acompanhar o espaço que estava aberto. */
let pararEspaco = () => {};

async function abrirEspaco(id) {
  const daqui = storeDe(id);
  const espaco = await tentar(() => daqui.lerEspaco(id), null);
  if (!espaco) return false;
  abertoId = id;
  if (id !== exemploId) lembrar(id);
  if (location.hash !== `#/espaco/${id}`) history.replaceState(null, "", `#/espaco/${id}`);
  pararEspaco();
  /* sem login, a tela esconde "Nova ação"; as demais gravações são recusadas com aviso */
  document.body.classList.toggle("so-leitura", !daqui.podeGravar);
  const pararTela = mostrarEspaco(principal, { store: daqui, espacoId: id, hoje, usuario });
  /* o nome do espaço no topo acompanha as mudanças (por exemplo, ao renomear em "Configurar este espaço") */
  let nome = espaco.nome;
  const pararTopo = daqui.acompanharEspaco(id, ({ espaco: atual }) => {
    if (atual.nome !== nome) { nome = atual.nome; atualizarTopo(); }
  });
  pararEspaco = () => { pararTela(); pararTopo(); };
  await atualizarTopo();
  window.scrollTo(0, 0);
  return true;
}

function boasVindas({ comFormulario = false } = {}) {
  pararEspaco();
  pararEspaco = () => {};
  abertoId = null;
  document.body.classList.remove("so-leitura");
  esquecer();
  history.replaceState(null, "", location.pathname + location.search);
  mostrarBoasVindas(principal, {
    aoCriar: async (dados) => abrirEspaco(await store.criarEspaco(dados)),
    aoVerExemplo: verExemplo,
    comFormulario,
    podeCriar: store.podeGravar,
    aoEntrar: entrar,
  });
  atualizarTopo();
  window.scrollTo(0, 0);
}

/* links "o que é?" em qualquer tela: <a data-termo="chave">o que é?</a> */
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-termo]");
  if (link) { e.preventDefault(); ajuda(link.dataset.termo); }
});

/** Abre o espaço do link, o último aberto ou as boas-vindas. */
async function abrirInicio() {
  const doLink = location.hash.match(/^#\/espaco\/([\w-]+)$/)?.[1];
  for (const id of [doLink, ultimo()]) if (id && await abrirEspaco(id)) return;
  boasVindas();
}

async function partida() {
  if (FIREBASE_CONFIG) {
    try {
      const conexao = await conectarFirebase(FIREBASE_CONFIG);
      acesso = conexao.acesso;
      store = criarStore(conexao.banco, { exigirLogin: true });
    } catch (e) {
      console.error(e);
      acesso = null;
      store = criarStore(criarBancoLocal());
      avisar("Não foi possível conectar ao banco de dados. O sistema abriu sem gravar: tudo se perde ao recarregar a página.");
    }
  } else {
    store = criarStore(criarBancoLocal());
  }
  if (!acesso) return abrirInicio();

  /* a primeira resposta do login abre o sistema; as seguintes (entrar, sair) refazem a tela aberta */
  let primeira = true;
  acesso.aoMudarUsuario(async (email) => {
    usuario = email;
    store.definirUsuario(email);
    exemplo?.definirUsuario(email);
    if (primeira) { primeira = false; return abrirInicio(); }
    if (abertoId) await abrirEspaco(abertoId);
    else boasVindas();
  });
}
partida();
