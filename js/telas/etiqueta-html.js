/**
 * Desenho de uma etiqueta (passo 2.10a; seção 4.1.9): um rótulo pequeno, com o fundo e o texto do tom
 * da cor dela (`--tom-N` e `--tom-N-texto`, que existem nos temas claro e escuro).
 */
import { esc } from "../formato.js";
import { tomDaCor } from "../etiquetas.js";

/** Estilo com as duas variáveis da cor da etiqueta. */
export const estiloDaEtiqueta = (cor) => `--etq:var(--tom-${tomDaCor(cor)});--etq-texto:var(--tom-${tomDaCor(cor)}-texto)`;

/**
 * @param {{nome: string, cor: string}} etiqueta
 * @param {string} [depois] HTML depois do nome (por exemplo, o × de retirar)
 */
export const etiquetaHtml = (etiqueta, depois = "") =>
  `<span class="etq" style="${estiloDaEtiqueta(etiqueta.cor)}">${esc(etiqueta.nome)}${depois}</span>`;
