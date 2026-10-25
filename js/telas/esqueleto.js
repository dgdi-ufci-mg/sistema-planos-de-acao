/**
 * Blocos cinza no formato do conteúdo enquanto ele é lido (revisão de usabilidade, 24/10/2026; item 15), como no
 * Linear, no Notion e no GitHub. Só aparecem se a leitura passar de 0,3 s, para não piscar quando é rápida.
 * "Reduzir movimento": sem o brilho que passa, só os blocos.
 */
const bloco = (largura, classe = "") => `<span class="esqueleto-bloco ${classe}" style="width:${largura}"></span>`;

/**
 * @param {"lista"|"texto"|"cartoes"} forma  lista de cartões, linhas de texto ou cartões em grade
 * @param {number} [quantas]
 */
export function esqueletoHtml(forma = "lista", quantas = 5) {
  const larguras = ["72%", "55%", "64%", "48%", "68%", "58%", "40%"];
  const itens = Array.from({ length: quantas }, (_, i) => larguras[i % larguras.length]);
  const miolo = forma === "texto"
    ? itens.map((l) => `<span class="esqueleto-linha">${bloco(l)}</span>`).join("")
    : forma === "cartoes"
      ? `<span class="esqueleto-grade">${itens.map((l) => `<span class="esqueleto-cartao">${bloco(l, "grosso")}${bloco("100%", "barra")}${bloco("35%")}</span>`).join("")}</span>`
      : itens.map((l) => `<span class="esqueleto-cartao linha">${bloco("18px", "redondo")}${bloco(l, "grosso")}${bloco("60px", "redondo-largo")}</span>`).join("");
  return `<div class="esqueleto esqueleto-${forma}" role="status" aria-label="Carregando">${miolo}</div>`;
}
