/*
 * Tema escolhido neste aparelho (27/10/2026, pedido do responsável; documentação técnica, seção 8.0).
 * Script comum (não módulo), carregado no <head>, depois das <meta name="theme-color">, para aplicar o tema antes do
 * primeiro desenho, sem piscar. As regras de escolha e gravação ficam em js/tema.js; as chaves, os padrões e as cores
 * da barra precisam ser os mesmos de lá.
 * Desde 30/10/2026, cada aplicativo tem a sua escolha: o Strata (classe "strata" no <html>) abre no escuro e o
 * Sextante, no claro, até alguém escolher outro tema naquele aplicativo.
 * Desde 11/11/2026, o Sextante tem também a paleta ("sextante.paleta": "ufcimg", o padrão, "original", "neutro", "papel" ou "alto-contraste"),
 * aplicada pelo atributo data-paleta; a cor da barra do navegador acompanha a paleta.
 */
(function () {
  var raiz = document.documentElement;
  var strata = raiz.classList.contains("strata");
  var chave = strata ? "strata.tema" : "sextante.tema";
  var paleta = null;
  /* cor da barra do navegador por paleta: as mesmas de js/tema.js (BARRA_POR_PALETA) */
  var BARRAS = {
    ufcimg: { claro: "#F4F6F8", escuro: "#1B1F27" }, original: { claro: "#F5F3EF", escuro: "#0F1A19" },
    neutro: { claro: "#F5F5F5", escuro: "#1C1D1F" }, papel: { claro: "#F6F1E7", escuro: "#24201C" },
    "alto-contraste": { claro: "#FFFFFF", escuro: "#000000" }
  };
  if (!strata) {
    try { paleta = localStorage.getItem("sextante.paleta"); } catch (e) { /* sem armazenamento: fica a padrão */ }
    if (!Object.prototype.hasOwnProperty.call(BARRAS, paleta)) paleta = "ufcimg";
    raiz.dataset.paleta = paleta;
  }
  var barra = strata ? { claro: "#F3F5F9", escuro: "#0E1424" } : BARRAS[paleta];
  var tema = null;
  try { tema = localStorage.getItem(chave); } catch (e) { /* sem armazenamento: fica o padrão */ }
  if (tema !== "automatico" && tema !== "claro" && tema !== "escuro") tema = strata ? "escuro" : "claro";
  if (tema === "claro") raiz.dataset.theme = "light";
  else if (tema === "escuro") raiz.dataset.theme = "dark";
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) {
    metas[i].content = tema === "automatico" ? (/dark/.test(metas[i].media) ? barra.escuro : barra.claro) : barra[tema];
  }
})();
