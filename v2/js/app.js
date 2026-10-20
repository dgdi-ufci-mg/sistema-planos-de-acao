/**
 * Partida da versão 2. Por enquanto (passo 0.5): identidade, barra do topo
 * e a vitrine da base visual na página provisória.
 */
import { NOME, INSTITUICAO } from "./identidade.js";
import { ICONES } from "./icones.js";

document.title = `${NOME} (versão 2, em construção)`;
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

/* vitrine: símbolos, cores e botões */
const SITUACOES = [
  ["concluida", "Concluída"], ["liberada", "Liberada"], ["naoLiberada", "Não liberada"], ["atrasada", "Atrasada"],
];
const classe = (nome) => nome.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);
document.querySelector("#situacoes").innerHTML = SITUACOES
  .map(([chave, texto]) => `<li><span class="icone-${classe(chave)}">${ICONES[chave]}</span>${texto}</li>`).join("");

const CORES = [
  ["--accent", "Destaque"], ["--crit", "Crítico, atraso"], ["--warn", "Atenção"], ["--ok", "Concluído"],
  ["--laranja", "Laranja do logotipo"], ["--bg", "Fundo"], ["--surface", "Superfície"], ["--ink", "Texto"],
];
document.querySelector("#amostras").innerHTML = CORES
  .map(([variavel, nome]) => `<div class="amostra"><span style="background:var(${variavel})"></span><p>${nome}<br><small class="mono">${variavel}</small></p></div>`).join("");

for (const botao of document.querySelectorAll("[data-icone]")) botao.insertAdjacentHTML("afterbegin", ICONES[botao.dataset.icone]);
document.querySelector("#enchimento").textContent = "Texto de preenchimento. ".repeat(160);
