/**
 * Tema claro ou escuro escolhido em cada aparelho (27/10/2026, pedido do responsável; documentação técnica, seção 8.0).
 * Três opções: "automatico" (segue o sistema do aparelho), "claro" e "escuro". A escolha fica no armazenamento do
 * navegador, e não no banco: vale só neste aparelho e neste navegador.
 *
 * Cada aplicativo tem a sua escolha (30/10/2026, pedido do responsável): o Sextante e o Strata ficam no mesmo endereço
 * base e, com uma chave só, trocar o tema num trocava no outro. Agora cada um tem chave, tema padrão (sem escolha
 * guardada) e cor da barra do navegador próprios. O Strata é reconhecido pela classe "strata" no <html>.
 * O primeiro desenho usa js/tema-inicial.js, com as mesmas chaves e os mesmos padrões.
 */
export const TEMAS = Object.freeze([["automatico", "Automático"], ["claro", "Claro"], ["escuro", "Escuro"]]);

const POR_APLICATIVO = Object.freeze({
  sextante: { chave: "sextante.tema", padrao: "claro", barra: { claro: "#F5F3EF", escuro: "#0F1A19" } },
  strata: { chave: "strata.tema", padrao: "escuro", barra: { claro: "#F3F5F9", escuro: "#0E1424" } },
});
const VALIDOS = new Set(TEMAS.map(([v]) => v));

/** Configuração do aplicativo desta página. */
const aplicativo = () => POR_APLICATIVO[document.documentElement.classList.contains("strata") ? "strata" : "sextante"];

/** @returns {"automatico"|"claro"|"escuro"} a escolha guardada neste aparelho ou, sem ela, o padrão do aplicativo */
export function lerTema() {
  const { chave, padrao } = aplicativo();
  try {
    const t = localStorage.getItem(chave);
    return VALIDOS.has(t) ? t : padrao;
  } catch { return padrao; }
}

/** Aplica o tema à página: data-theme na raiz e a cor da barra do navegador no celular. */
export function aplicarTema(tema, raiz = document.documentElement) {
  if (tema === "claro") raiz.dataset.theme = "light";
  else if (tema === "escuro") raiz.dataset.theme = "dark";
  else delete raiz.dataset.theme;
  const { barra } = aplicativo();
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    if (!meta.dataset.original) meta.dataset.original = meta.content;
    meta.content = barra[tema] ?? meta.dataset.original;
  }
}

/** Grava a escolha deste aplicativo neste aparelho e aplica. "Automático" também é gravado, porque o padrão pode não ser ele. */
export function escolherTema(tema) {
  const { chave, padrao } = aplicativo();
  const valido = VALIDOS.has(tema) ? tema : padrao;
  try { localStorage.setItem(chave, valido); } catch { /* sem armazenamento: vale até fechar a página */ }
  aplicarTema(valido);
  return valido;
}
