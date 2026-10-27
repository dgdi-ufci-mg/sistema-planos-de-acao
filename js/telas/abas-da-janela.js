/**
 * Janela central em abas (27/10/2026), com o mesmo desenho de "Configurar este espaço" (seção 8.1): no computador
 * (a partir de 900 px), as seções numa lista à esquerda e só a escolhida à direita; no celular e em telas médias, a
 * lista das seções, como nos Ajustes do iPhone, e tocar numa abre só ela, com "‹ Configurações" no alto (o Voltar
 * do aparelho também volta à lista). Usada por "Configurar o sistema".
 *
 * As seções são `details.config` com `data-secao` e um `<summary><h3>` com o nome. O que não for seção fica acima.
 */
import { ICONES } from "../icones.js";
import { esc } from "../formato.js";
import { abrirCamada } from "./voltar.js";

/**
 * @param {HTMLElement} corpo corpo da janela, já com as seções desenhadas
 * @param {{atual: string|null}} estado aba escolhida, mantida entre redesenhos
 * @returns {() => void} desliga o acompanhamento da largura da tela
 */
export function montarAbasDaJanela(corpo, estado) {
  const largo = matchMedia("(min-width: 900px)");
  const filhos = [...corpo.children];
  const grade = document.createElement("div");
  grade.className = "config-abas";
  const lista = document.createElement("nav");
  lista.className = "config-nav";
  lista.setAttribute("aria-label", "Seções da configuração");
  const conteudo = document.createElement("div");
  conteudo.className = "config-conteudo";
  conteudo.innerHTML = `<button type="button" class="config-voltar" data-config-voltar>${ICONES.seguir}Configurações</button><h3 class="config-titulo-aba" data-titulo-aba></h3>`;
  const topo = filhos.filter((el) => !el.matches("details.config"));
  for (const el of filhos) if (el.matches("details.config")) { el.dataset.aba = el.dataset.secao; conteudo.append(el); }
  const abas = [...conteudo.querySelectorAll(":scope > [data-aba]")];
  const nome = (el) => el.querySelector(":scope > summary h3")?.textContent ?? "";
  lista.innerHTML = abas.map((el) => `<button type="button" class="config-aba" data-ir-aba="${esc(el.dataset.aba)}"><span>${esc(nome(el))}</span>${ICONES.seguir}</button>`).join("");
  grade.append(lista, conteudo);
  corpo.replaceChildren(...topo, grade);
  if (!abas.some((el) => el.dataset.aba === estado.atual)) estado.atual = abas[0]?.dataset.aba ?? null;

  let soltar = null;
  const entrar = () => {
    estado.naSecao = true;
    grade.classList.add("na-secao");
    if (!soltar) soltar = abrirCamada(() => { soltar = null; sair(); });
  };
  const sair = () => {
    estado.naSecao = false;
    grade.classList.remove("na-secao");
    if (soltar) { const s = soltar; soltar = null; s(); }
    corpo.scrollTop = 0;
  };
  const aplicar = () => {
    for (const b of lista.querySelectorAll("[data-ir-aba]")) {
      if (b.dataset.irAba === estado.atual) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    }
    let titulo = "";
    for (const el of abas) {
      const atual = el.dataset.aba === estado.atual;
      el.classList.toggle("aba-atual", atual);
      if (atual) titulo = nome(el);
      if (atual && (largo.matches || estado.naSecao)) el.open = true;
    }
    grade.querySelector("[data-titulo-aba]").textContent = titulo;
  };
  lista.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ir-aba]");
    if (!b) return;
    estado.atual = b.dataset.irAba;
    if (!largo.matches) entrar();
    aplicar();
    conteudo.scrollTop = 0;
    corpo.scrollTop = 0;
  });
  conteudo.querySelector("[data-config-voltar]").addEventListener("click", sair);
  if (estado.naSecao && !largo.matches) entrar();
  largo.addEventListener("change", aplicar);
  aplicar();
  return () => { largo.removeEventListener("change", aplicar); if (soltar) { const s = soltar; soltar = null; s(); } };
}
