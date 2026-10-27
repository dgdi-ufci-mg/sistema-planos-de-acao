/*
 * Tema escolhido neste aparelho (27/10/2026, pedido do responsável; documentação técnica, seção 8.0).
 * Script comum (não módulo), carregado no <head>, para aplicar o tema antes do primeiro desenho, sem piscar.
 * As regras de escolha e gravação ficam em js/tema.js; a chave e os valores precisam ser os mesmos.
 */
(function () {
  var tema = null;
  try { tema = localStorage.getItem("sextante.tema"); } catch (e) { /* sem armazenamento: segue o sistema */ }
  if (tema === "claro") document.documentElement.dataset.theme = "light";
  else if (tema === "escuro") document.documentElement.dataset.theme = "dark";
})();
