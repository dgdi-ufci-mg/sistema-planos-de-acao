/**
 * Partida da versão 2: identidade, barra do topo e abertura do sistema
 * (especificação, passo 1.4):
 * - quem chega por um link de espaço (#/espaco/<id>) abre esse espaço;
 * - senão, abre o último espaço aberto neste aparelho, se ele ainda existir;
 * - senão, vê as boas-vindas.
 * Até o passo 1.14, os dados ficam só na memória: ao recarregar, tudo recomeça.
 */
import { NOME, INSTITUICAO } from "./identidade.js";
import { criarBancoLocal } from "./banco/local.js";
import { criarStore } from "./dados.js";
import { carregarExemplo } from "./exemplo.js";
import { mostrarBoasVindas } from "./telas/abertura.js";
import { mostrarEspaco } from "./telas/espaco.js";

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

const hoje = (() => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
})();
const store = criarStore(criarBancoLocal());
const principal = document.querySelector("#principal");

async function abrirEspaco(id) {
  const espaco = await store.lerEspaco(id);
  if (!espaco) return false;
  lembrar(id);
  if (location.hash !== `#/espaco/${id}`) history.replaceState(null, "", `#/espaco/${id}`);
  mostrarEspaco(principal, espaco, await store.listarAcoes(id), { hoje, aoVoltar: boasVindas });
  window.scrollTo(0, 0);
  return true;
}

function boasVindas() {
  esquecer();
  history.replaceState(null, "", location.pathname + location.search);
  mostrarBoasVindas(principal, {
    aoCriar: async (dados) => abrirEspaco(await store.criarEspaco(dados)),
    aoVerExemplo: async () => abrirEspaco(await carregarExemplo(store)),
  });
}

async function partida() {
  const doLink = location.hash.match(/^#\/espaco\/([\w-]+)$/)?.[1];
  for (const id of [doLink, ultimo()]) if (id && await abrirEspaco(id)) return;
  boasVindas();
}
partida();
