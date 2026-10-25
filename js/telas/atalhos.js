/**
 * Atalhos de teclado (item 8 da avaliação de usabilidade de 24/10/2026; documentação técnica, seção 8.0), para quem
 * usa o sistema o dia todo, como no Linear e no GitHub. Teclas de uma letra só valem fora de campos de texto e com
 * nenhuma janela aberta, para nunca atrapalhar a digitação.
 *
 * Quem conhece a tela registra a tecla (`registrarTecla`): a partida liga "/" (buscar); o espaço aberto liga "N"
 * (nova ação). "?" mostra a lista. Ctrl+K (js/telas/busca.js) e Ctrl+B (js/telas/navegacao.js) ficam onde estão.
 */
import { abrirPainel } from "./painel.js";
import { atalhoDaBusca } from "./busca.js";

/** A lista mostrada em "?", na ordem da tela. */
export const LISTA_DE_ATALHOS = () => [
  ["Em qualquer tela", [
    [[atalhoDaBusca(), "/"], "Buscar ações, espaços e comandos"],
    [["N"], "Nova ação (ou tarefa) no espaço aberto"],
    [[/Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘B" : "Ctrl B"], "Mostrar ou recolher a barra lateral"],
    [["?"], "Esta lista de atalhos"],
    [["Esc"], "Fechar a janela, o painel ou o menu aberto"],
  ]],
  ["Na lista e no quadro", [
    [["↑", "↓"], "Andar entre os cartões"],
    [["←", "→"], "No quadro, passar para a coluna ao lado"],
    [["Enter"], "Abrir a ação escolhida"],
    [["Alt + clique"], "Editar o nome, a descrição ou os participantes ali mesmo"],
  ]],
  ["Na planilha", [
    [["↑", "↓", "←", "→"], "Andar entre as células"],
    [["Enter", "Shift + Enter"], "Descer ou subir uma linha"],
  ]],
  ["Na janela da ação", [
    [["Esc"], "Desfazer a edição de um campo; com nada em edição, fechar"],
  ]],
];

/** @type {Map<string, () => void>} */
const teclas = new Map();

/** Liga uma tecla de uma letra (ou "/", "?"); devolve a função que a desliga. */
export function registrarTecla(tecla, fazer) {
  teclas.set(tecla, fazer);
  return () => { if (teclas.get(tecla) === fazer) teclas.delete(tecla); };
}

/** Há algo por cima da página (painel, janela, diálogo, busca) ou o cursor está num campo? */
function ocupado(e) {
  const t = e.target;
  if (t.isContentEditable || t.closest?.("input, textarea, select, [contenteditable]")) return true;
  return Boolean(document.querySelector(".camada, .dialogo-camada, .busca-camada, details[open].menu-colunas, .menu-da-coluna"));
}

export function mostrarAtalhos() {
  abrirPainel("Atalhos de teclado", `<div class="atalhos">${LISTA_DE_ATALHOS().map(([titulo, itens]) => `
    <section><h3>${titulo}</h3><dl>${itens.map(([ks, o]) => `<div><dt>${ks.map((k) => `<kbd>${k}</kbd>`).join(" ")}</dt><dd>${o}</dd></div>`).join("")}</dl></section>`).join("")}
    <p class="tec">As teclas de uma letra não valem enquanto se digita num campo.</p></div>`);
}

export function ligarAtalhos() {
  registrarTecla("?", mostrarAtalhos);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || ocupado(e)) return;
    const tecla = e.key.length === 1 ? e.key.toLowerCase() : null;
    const fazer = tecla && teclas.get(tecla);
    if (!fazer) return;
    e.preventDefault();
    fazer();
  });
}
