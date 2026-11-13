/**
 * Tema claro ou escuro escolhido em cada aparelho (27/10/2026, pedido do responsável; documentação técnica, seção 8.0).
 * Três opções: "automatico" (segue o sistema do aparelho), "claro" e "escuro". A escolha fica no armazenamento do
 * navegador, e não no banco: vale só neste aparelho e neste navegador.
 *
 * Cada aplicativo tem a sua escolha (30/10/2026, pedido do responsável): o Sextante e o Strata ficam no mesmo endereço
 * base e, com uma chave só, trocar o tema num trocava no outro. Agora cada um tem chave, tema padrão (sem escolha
 * guardada) e cor da barra do navegador próprios. O Strata é reconhecido pela classe "strata" no <html>.
 * O primeiro desenho usa js/tema-inicial.js, com as mesmas chaves e os mesmos padrões.
 *
 * Paleta (desde 11/11/2026, pedido do responsável): além do modo (claro, escuro ou automático), o Sextante
 * tem a escolha da paleta, guardada à parte ("sextante.paleta") e aplicada pelo atributo data-paleta na raiz:
 * "ufcimg", a identidade visual da UFCI-MG (padrão), "original", a paleta verde-azulada de sempre, ou, desde
 * 12/11/2026, "neutro", "papel" e "alto-contraste". O Strata não
 * recebe as paletas por enquanto. A cor da barra do navegador acompanha a paleta e o modo.
 */
export const TEMAS = Object.freeze([["automatico", "Automático"], ["claro", "Claro"], ["escuro", "Escuro"]]);

/** Paletas do Sextante: valor e nome no menu. Os nomes são provisórios. */
export const PALETAS = Object.freeze([["ufcimg", "UFCIMG"], ["original", "Original"], ["neutro", "Neutro"], ["papel", "Papel"], ["alto-contraste", "Alto contraste"]]);
const PALETA_PADRAO = "ufcimg";
const CHAVE_PALETA = "sextante.paleta";
const BARRA_POR_PALETA = Object.freeze({
  ufcimg: { claro: "#F4F6F8", escuro: "#1B1F27" }, original: { claro: "#F5F3EF", escuro: "#0F1A19" },
  neutro: { claro: "#F5F5F5", escuro: "#1C1D1F" }, papel: { claro: "#F6F1E7", escuro: "#24201C" },
  "alto-contraste": { claro: "#FFFFFF", escuro: "#000000" } }); /* Neutro, Papel e Alto contraste: 12/11/2026 */
const PALETAS_VALIDAS = new Set(PALETAS.map(([v]) => v));

const POR_APLICATIVO = Object.freeze({
  sextante: { chave: "sextante.tema", padrao: "claro", barra: BARRA_POR_PALETA.original },
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

/** Cores da barra do navegador para a paleta em uso (o Strata tem as suas). */
const barraAtual = (raiz) => raiz.classList.contains("strata") ? aplicativo().barra : (BARRA_POR_PALETA[raiz.dataset.paleta] ?? BARRA_POR_PALETA.original);

/** Aplica o tema à página: data-theme na raiz e a cor da barra do navegador no celular. No automático, cada
    <meta name="theme-color"> recebe a cor do modo da sua consulta de mídia (claro ou escuro). */
export function aplicarTema(tema, raiz = document.documentElement) {
  if (tema === "claro") raiz.dataset.theme = "light";
  else if (tema === "escuro") raiz.dataset.theme = "dark";
  else delete raiz.dataset.theme;
  const barra = barraAtual(raiz);
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.content = barra[tema] ?? (/dark/.test(meta.media) ? barra.escuro : barra.claro);
  }
}

/** @returns {"ufcimg"|"original"|"neutro"|"papel"|"alto-contraste"} a paleta guardada neste aparelho ou, sem ela, a padrão */
export function lerPaleta() {
  try {
    const p = localStorage.getItem(CHAVE_PALETA);
    return PALETAS_VALIDAS.has(p) ? p : PALETA_PADRAO;
  } catch { return PALETA_PADRAO; }
}

/** Aplica a paleta: data-paleta na raiz (só no Sextante) e, de novo, o tema, para a barra do navegador acompanhar. */
export function aplicarPaleta(paleta, raiz = document.documentElement) {
  if (raiz.classList.contains("strata")) return;
  raiz.dataset.paleta = PALETAS_VALIDAS.has(paleta) ? paleta : PALETA_PADRAO;
  aplicarTema(lerTema(), raiz);
}

/** Grava a paleta neste aparelho e aplica. */
export function escolherPaleta(paleta) {
  const valida = PALETAS_VALIDAS.has(paleta) ? paleta : PALETA_PADRAO;
  try { localStorage.setItem(CHAVE_PALETA, valida); } catch { /* sem armazenamento: vale até fechar a página */ }
  aplicarPaleta(valida);
  return valida;
}

/** Grava a escolha deste aplicativo neste aparelho e aplica. "Automático" também é gravado, porque o padrão pode não ser ele. */
export function escolherTema(tema) {
  const { chave, padrao } = aplicativo();
  const valido = VALIDOS.has(tema) ? tema : padrao;
  try { localStorage.setItem(chave, valido); } catch { /* sem armazenamento: vale até fechar a página */ }
  aplicarTema(valido);
  return valido;
}
