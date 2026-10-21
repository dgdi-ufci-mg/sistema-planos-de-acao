/**
 * Partida da versão 2: identidade, barra do topo e abertura do sistema
 * (especificação, passos 1.4 a 1.6):
 * - quem chega por um link de espaço (#/espaco/<id>) abre esse espaço;
 * - senão, abre o último espaço aberto neste aparelho, se ele ainda existir;
 * - senão, vê as boas-vindas.
 * Até o passo 1.14, os dados ficam só na memória: ao recarregar, tudo recomeça.
 */
import { NOME, INSTITUICAO } from "./identidade.js";
import { criarBancoLocal } from "./banco/local.js";
import { criarStore, hojeLocal } from "./dados.js";
import { carregarExemplo } from "./exemplo.js";
import { mostrarBoasVindas } from "./telas/abertura.js";
import { mostrarEspaco } from "./telas/espaco.js";
import { mostrarTopo } from "./telas/topo.js";
import { mostrarAjuda } from "./telas/ajuda.js";
import { avisar } from "./telas/painel.js";
import { abrirConfiguracao } from "./telas/configurar.js";
import { abrirConfiguracaoDoSistema } from "./telas/configurar-sistema.js";

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
const store = criarStore(criarBancoLocal());
const principal = document.querySelector("#principal");
const menus = document.querySelector(".menus");

async function atualizarTopo(abertoId = null) {
  mostrarTopo(menus, {
    espacos: await store.listarEspacos(),
    abertoId,
    aoAbrir: abrirEspaco,
    aoConfigurar: () => abrirConfiguracao({ store, espacoId: abertoId }),
    aoNovo: () => boasVindas({ comFormulario: true }),
    aoBoasVindas: () => boasVindas(),
    aoAjuda: () => ajuda(),
    aoSistema: () => abrirConfiguracaoDoSistema({ store, hoje }),
    aoEntrar: () => avisar("A entrada com e-mail e senha chega no passo 1.14."),
  });
}

/** Ajuda; com `foco`, destaca um termo do glossário (links "o que é?"). */
function ajuda(foco) {
  mostrarAjuda({ foco, aoVerExemplo: verExemplo });
}

async function verExemplo() {
  await abrirEspaco(await carregarExemplo(store));
}

/** Para de acompanhar o espaço que estava aberto. */
let pararEspaco = () => {};

async function abrirEspaco(id) {
  const espaco = await store.lerEspaco(id);
  if (!espaco) return false;
  lembrar(id);
  if (location.hash !== `#/espaco/${id}`) history.replaceState(null, "", `#/espaco/${id}`);
  pararEspaco();
  const pararTela = mostrarEspaco(principal, { store, espacoId: id, hoje });
  /* o nome do espaço no topo acompanha as mudanças (por exemplo, ao renomear em "Configurar este espaço") */
  let nome = espaco.nome;
  const pararTopo = store.acompanharEspaco(id, ({ espaco: atual }) => {
    if (atual.nome !== nome) { nome = atual.nome; atualizarTopo(id); }
  });
  pararEspaco = () => { pararTela(); pararTopo(); };
  await atualizarTopo(id);
  window.scrollTo(0, 0);
  return true;
}

function boasVindas({ comFormulario = false } = {}) {
  pararEspaco();
  pararEspaco = () => {};
  esquecer();
  history.replaceState(null, "", location.pathname + location.search);
  mostrarBoasVindas(principal, {
    aoCriar: async (dados) => abrirEspaco(await store.criarEspaco(dados)),
    aoVerExemplo: verExemplo,
    comFormulario,
  });
  atualizarTopo();
  window.scrollTo(0, 0);
}

/* links "o que é?" em qualquer tela: <a data-termo="chave">o que é?</a> */
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-termo]");
  if (link) { e.preventDefault(); ajuda(link.dataset.termo); }
});

async function partida() {
  const doLink = location.hash.match(/^#\/espaco\/([\w-]+)$/)?.[1];
  for (const id of [doLink, ultimo()]) if (id && await abrirEspaco(id)) return;
  boasVindas();
}
partida();
