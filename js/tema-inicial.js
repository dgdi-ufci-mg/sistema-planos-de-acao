/*
 * Tema escolhido neste aparelho (27/10/2026, pedido do responsável; documentação técnica, seção 8.0).
 * Script comum (não módulo), carregado no <head>, depois das <meta name="theme-color">, para aplicar o tema antes do
 * primeiro desenho, sem piscar. As regras de escolha e gravação ficam em js/tema.js; as chaves, os padrões e as cores
 * da barra precisam ser os mesmos de lá.
 * Desde 30/10/2026, cada aplicativo tem a sua escolha: o Strata (classe "strata" no <html>) abre no escuro e o
 * Sextante, no claro, até alguém escolher outro tema naquele aplicativo.
 */
(function () {
  var raiz = document.documentElement;
  var strata = raiz.classList.contains("strata");
  var chave = strata ? "strata.tema" : "sextante.tema";
  var barra = strata ? { claro: "#F3F5F9", escuro: "#0E1424" } : { claro: "#F5F3EF", escuro: "#0F1A19" };
  var tema = null;
  try { tema = localStorage.getItem(chave); } catch (e) { /* sem armazenamento: fica o padrão */ }
  if (tema !== "automatico" && tema !== "claro" && tema !== "escuro") tema = strata ? "escuro" : "claro";
  if (tema === "claro") raiz.dataset.theme = "light";
  else if (tema === "escuro") raiz.dataset.theme = "dark";
  if (tema === "automatico") return;
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) {
    metas[i].dataset.original = metas[i].content;
    metas[i].content = barra[tema];
  }
})();
