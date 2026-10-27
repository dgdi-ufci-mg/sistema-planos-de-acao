/**
 * Tema claro ou escuro escolhido em cada aparelho (27/10/2026, pedido do responsável; documentação técnica, seção 8.0).
 * Três opções: "automatico" (segue o sistema do aparelho, o padrão), "claro" e "escuro". A escolha fica no
 * armazenamento do navegador (chave "sextante.tema"), e não no banco: vale só neste aparelho e neste navegador.
 * O primeiro desenho usa js/tema-inicial.js, com a mesma chave.
 */
export const TEMAS = Object.freeze([["automatico", "Automático"], ["claro", "Claro"], ["escuro", "Escuro"]]);
const CHAVE = "sextante.tema";
const COR_DA_BARRA = { claro: "#F5F3EF", escuro: "#0F1A19" };

/** @returns {"automatico"|"claro"|"escuro"} */
export function lerTema() {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "automatico";
  } catch { return "automatico"; }
}

/** Aplica o tema à página: data-theme na raiz e a cor da barra do navegador no celular. */
export function aplicarTema(tema, raiz = document.documentElement) {
  if (tema === "claro") raiz.dataset.theme = "light";
  else if (tema === "escuro") raiz.dataset.theme = "dark";
  else delete raiz.dataset.theme;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    if (!meta.dataset.original) meta.dataset.original = meta.content;
    meta.content = COR_DA_BARRA[tema] ?? meta.dataset.original;
  }
}

/** Grava a escolha neste aparelho e aplica. */
export function escolherTema(tema) {
  const valido = TEMAS.some(([v]) => v === tema) ? tema : "automatico";
  try {
    if (valido === "automatico") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, valido);
  } catch { /* sem armazenamento: vale até fechar a página */ }
  aplicarTema(valido);
  return valido;
}
