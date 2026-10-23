/** Formatação para a tela: texto seguro em HTML, datas e plurais. */

/** Escapa texto para entrar no HTML sem virar marcação. */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** "2026-10-20" → "20/10/2026"; vazio → "—". */
export const dataBr = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");

/** "2026-10-20" → "20/10". */
export const dataCurta = (iso) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "—");

/** plural(1, "ação", "ações") → "ação". */
export const plural = (n, um, varios) => (n === 1 ? um : varios);
