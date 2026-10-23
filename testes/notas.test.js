/** Testes das notas em Markdown seguro (js/notas.js). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { markdownParaHtml, htmlParaMarkdown, linkSeguro } from "../js/notas.js";

/** Árvore mínima, no formato que htmlParaMarkdown lê (sem navegador). */
const t = (texto) => ({ nodeType: 3, nodeValue: texto });
const el = (tagName, filhos = [], atributos = {}, style = {}) => ({
  nodeType: 1, tagName, childNodes: filhos, style, getAttribute: (k) => atributos[k] ?? null,
});
const raiz = (...filhos) => ({ childNodes: filhos });

describe("Notas: Markdown para HTML", () => {
  it("converte negrito, itálico, quebras de linha, parágrafos e listas", () => {
    assert.equal(markdownParaHtml("**a** e *b*\nc\n\nd"), "<p><strong>a</strong> e <em>b</em><br>c</p><p>d</p>");
    assert.equal(markdownParaHtml("Antes\n- um\n- dois\nDepois"), "<p>Antes</p><ul><li>um</li><li>dois</li></ul><p>Depois</p>");
  });

  it("converte links e endereços da web, abrindo em nova aba", () => {
    assert.equal(markdownParaHtml("[SIPAC](https://sipac.ufci.edu.br)"),
      '<p><a href="https://sipac.ufci.edu.br" target="_blank" rel="noopener noreferrer">SIPAC</a></p>');
    assert.equal(markdownParaHtml("Veja https://exemplo.org/a."),
      '<p>Veja <a href="https://exemplo.org/a" target="_blank" rel="noopener noreferrer">https://exemplo.org/a</a>.</p>');
    assert.match(markdownParaHtml("[fale](mailto:dgdi@ufci.edu.br)"), /href="mailto:dgdi@ufci.edu.br"/);
  });

  it("nenhum HTML digitado é executado, e links perigosos viram texto", () => {
    const html = markdownParaHtml('<script>alert(1)</script> <img src=x onerror="alert(1)">');
    assert.ok(!html.includes("<script") && !html.includes("<img"));
    assert.match(html, /&lt;script&gt;/);
    const js = markdownParaHtml("[clique](javascript:alert(1))");
    assert.ok(!js.includes("<a"));
    const aspas = markdownParaHtml('[x](https://a.org/"onmouseover="alert(1))');
    assert.ok(!/href="[^"]*"onmouseover/.test(aspas));
  });

  it("aceita só http, https e mailto como link", () => {
    assert.equal(linkSeguro("https://a.org"), true);
    assert.equal(linkSeguro("mailto:a@b.org"), true);
    assert.equal(linkSeguro("javascript:alert(1)"), false);
    assert.equal(linkSeguro("data:text/html,x"), false);
    assert.equal(linkSeguro("https://a.org/x y"), false);
  });
});

describe("Notas: editor visual para Markdown", () => {
  it("guarda negrito, itálico, links seguros, listas e quebras", () => {
    const md = htmlParaMarkdown(raiz(
      t("Processo "), el("B", [t("123")]), t(" e "), el("I", [t("urgente")]), el("BR"),
      el("A", [t("SIPAC")], { href: "https://sipac.ufci.edu.br" }),
      el("UL", [el("LI", [t("um")]), el("LI", [t("dois")])]),
    ));
    assert.equal(md, "Processo **123** e *urgente*\n[SIPAC](https://sipac.ufci.edu.br)\n- um\n- dois");
  });

  it("descarta formatação e links não permitidos, ficando com o texto", () => {
    const md = htmlParaMarkdown(raiz(el("SPAN", [t("cor")], {}, { color: "red" }), t(" "), el("A", [t("isca")], { href: "javascript:alert(1)" })));
    assert.equal(md, "cor isca");
  });

  it("negrito por estilo e espaços nas pontas ficam fora das marcas", () => {
    assert.equal(htmlParaMarkdown(raiz(el("SPAN", [t("forte ")], {}, { fontWeight: "700" }), t("fim"))), "**forte** fim");
  });

  it("ida e volta: o Markdown gerado pelo editor volta ao mesmo HTML", () => {
    const md = "**a** e *b*\n- um\n- dois";
    assert.equal(markdownParaHtml(md), "<p><strong>a</strong> e <em>b</em></p><ul><li>um</li><li>dois</li></ul>");
  });
});
