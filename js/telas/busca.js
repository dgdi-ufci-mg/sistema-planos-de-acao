/**
 * Busca e paleta de comandos (item 7 da avaliação de usabilidade de 24/10/2026; documentação técnica, seção 8),
 * como no Linear, no Notion e no GitHub: Ctrl+K (⌘K no Mac), ou "Buscar" no alto da barra lateral, abre uma
 * caixa no alto da tela; digitar filtra, as setas escolhem, Enter executa e Esc fecha.
 *
 * Os itens vêm de "fontes" registradas por quem conhece cada parte: a partida (js/app.js) dá os espaços e os
 * comandos gerais; o espaço aberto (js/telas/espaco.js) dá as suas ações e os seus comandos. Cada fonte devolve
 * itens {grupo, titulo, detalhe?, icone?, palavras?, executar}. A regra de combinar e ordenar é js/busca.js.
 */
import { ICONES } from "../icones.js";
import { esc } from "../formato.js";
import { filtrarItens } from "../busca.js";

/** @type {Map<string, () => Promise<object[]>|object[]>} */
const fontes = new Map();

/** Registra uma fonte de itens; devolve a função que a retira. */
export function registrarFonte(chave, fonte) {
  fontes.set(chave, fonte);
  return () => { if (fontes.get(chave) === fonte) fontes.delete(chave); };
}

const ehMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** Texto do atalho para mostrar na tela: "Ctrl K" ou "⌘K". */
export const atalhoDaBusca = () => (ehMac() ? "⌘K" : "Ctrl K");

let aberta = null;

/** Abre a caixa de busca (se já estiver aberta, só devolve o cursor a ela). */
export async function abrirBusca() {
  if (aberta) { aberta.querySelector("input").focus(); return; }
  const anterior = document.activeElement;
  const camada = document.createElement("div");
  camada.className = "busca-camada";
  camada.innerHTML = `
    <div class="fundo-escuro" data-fechar-busca></div>
    <div class="busca" role="dialog" aria-modal="true" aria-label="Buscar">
      <div class="busca-campo">${ICONES.buscar}
        <input type="text" role="combobox" aria-expanded="true" aria-controls="busca-lista" aria-autocomplete="list"
          placeholder="Buscar ações, espaços e comandos" autocomplete="off" spellcheck="false" aria-label="Buscar ações, espaços e comandos">
        <kbd class="busca-esc">Esc</kbd><button type="button" class="busca-cancelar" data-fechar-busca>Cancelar</button></div>
      <div class="busca-lista" id="busca-lista" role="listbox" aria-label="Resultados"></div>
      <p class="busca-rodape tec"><span><kbd>↑</kbd><kbd>↓</kbd> escolher</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></p>
    </div>`;
  document.body.append(camada);
  aberta = camada;
  requestAnimationFrame(() => requestAnimationFrame(() => camada.classList.add("aberta")));
  const campo = camada.querySelector("input");
  const lista = camada.querySelector(".busca-lista");
  campo.focus();

  let itens = [];
  let mostrados = [];
  let ativo = 0;
  /* lê as fontes uma vez por abertura; uma fonte que falhar não impede as outras */
  /* o espaço aberto vem primeiro: os comandos dele ("Nova ação") e as suas ações abrem a lista */
  const ordem = [...fontes.entries()].sort(([a], [b]) => (a === "espaco" ? 0 : 1) - (b === "espaco" ? 0 : 1)).map(([, f]) => f);
  const lidos = await Promise.all(ordem.map(async (f) => { try { return await f(); } catch { return []; } }));
  itens = lidos.flat();

  function desenhar() {
    mostrados = filtrarItens(itens, campo.value);
    ativo = Math.min(ativo, Math.max(0, mostrados.length - 1));
    if (!mostrados.length) {
      lista.innerHTML = `<p class="busca-vazio">Nada encontrado para “${esc(campo.value.trim())}”.</p>`;
      campo.removeAttribute("aria-activedescendant");
      return;
    }
    let grupo = null;
    lista.innerHTML = mostrados.map((item, i) => {
      const cabeca = item.grupo !== grupo ? `<div class="busca-grupo" role="presentation">${esc(item.grupo)}</div>` : "";
      grupo = item.grupo;
      return `${cabeca}<div class="busca-item" role="option" id="busca-op-${i}" data-indice="${i}" aria-selected="${i === ativo}">
        <span class="busca-icone">${ICONES[item.icone] ?? ""}</span>
        <span class="busca-texto"><span class="busca-titulo">${esc(item.titulo)}</span>${item.detalhe ? `<small>${esc(item.detalhe)}</small>` : ""}</span>
      </div>`;
    }).join("");
    marcar(false);
  }
  function marcar(rolar = true) {
    for (const el of lista.querySelectorAll(".busca-item")) el.setAttribute("aria-selected", String(Number(el.dataset.indice) === ativo));
    const el = lista.querySelector(`#busca-op-${ativo}`);
    if (el) campo.setAttribute("aria-activedescendant", el.id);
    if (rolar) el?.scrollIntoView({ block: "nearest" });
  }
  function fechar({ devolverFoco = true } = {}) {
    if (aberta !== camada) return;
    aberta = null;
    window.removeEventListener("keydown", aoTeclar, true);
    camada.classList.remove("aberta");
    setTimeout(() => camada.remove(), 250);
    if (devolverFoco) anterior?.focus?.({ preventScroll: true });
  }
  function executar(i) {
    const item = mostrados[i];
    if (!item) return;
    fechar({ devolverFoco: false });
    item.executar();
  }
  /* fase de captura: Esc e as setas são da busca, e não do painel que estiver por baixo */
  function aoTeclar(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return fechar(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (!mostrados.length) return;
      ativo = (ativo + (e.key === "ArrowDown" ? 1 : -1) + mostrados.length) % mostrados.length;
      return marcar();
    }
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); e.stopPropagation(); return executar(ativo); }
  }
  window.addEventListener("keydown", aoTeclar, true);
  campo.addEventListener("input", () => { ativo = 0; desenhar(); lista.scrollTop = 0; });
  camada.addEventListener("click", (e) => {
    if (e.target.closest("[data-fechar-busca]")) return fechar();
    const item = e.target.closest("[data-indice]");
    if (item) executar(Number(item.dataset.indice));
  });
  lista.addEventListener("mousemove", (e) => {
    const item = e.target.closest("[data-indice]");
    if (item && Number(item.dataset.indice) !== ativo) { ativo = Number(item.dataset.indice); marcar(false); }
  });
  desenhar();
}

/** Liga o atalho Ctrl+K (⌘K), em qualquer tela, mesmo com o cursor num campo. */
export function ligarAtalhoDaBusca() {
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      abrirBusca();
    }
  });
}
