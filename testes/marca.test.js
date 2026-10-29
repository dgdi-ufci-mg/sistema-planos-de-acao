/** Marca do sistema: símbolo e logotipo em SVG, com as cores do tema (js/marca.js; documentação técnica, seção 3.1). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simboloSvg, logotipoSvg, strataLogotipoSvg } from "../js/marca.js";
import { NOME } from "../js/identidade.js";

describe("marca do sistema", () => {
  it("o símbolo é decorativo e tem o tamanho pedido", () => {
    const svg = simboloSvg(26);
    assert.match(svg, /aria-hidden="true"/);
    assert.match(svg, /width="26" height="26"/);
  });

  it("o logotipo diz o nome ao leitor de tela e guarda a proporção", () => {
    const svg = logotipoSvg(32);
    assert.match(svg, new RegExp(`aria-label="${NOME}"`));
    assert.match(svg, /width="170" height="32"/);
  });

  it("as cores vêm das variáveis do tema, sem cor fixa no desenho", () => {
    const svgs = simboloSvg() + logotipoSvg();
    assert.doesNotMatch(svgs, /#[0-9a-f]{3,6}\b/i);
    const css = readFileSync(new URL("../css/estilo.css", import.meta.url), "utf8");
    for (const classe of ["marca-corpo", "marca-escala", "marca-braco", "marca-ponto", "marca-nome", "marca-nome-traco"]) {
      assert.ok(svgs.includes(`class="${classe}"`), `desenho sem ${classe}`);
      assert.match(css, new RegExp(`\\.${classe}\\b[^{]*\\{[^}]*var\\(--(accent|warn)\\)|\\.${classe}\\b[^{]*\\{[^}]*opacity`), `estilo sem ${classe}`);
    }
  });

  it("o logotipo do Strata diz o nome do módulo ao leitor de tela, guarda a proporção e usa as cores do tema (29/10/2026)", () => {
    const svg = strataLogotipoSvg(24);
    const app = readFileSync(new URL("../js/superior/app.js", import.meta.url), "utf8");
    const nome = app.match(/NOME_DO_MODULO = "([^"]+)"/)[1];
    assert.match(svg, new RegExp(`aria-label="${nome}"`), "o desenho do nome precisa ser refeito se o nome mudar");
    assert.match(svg, /width="104" height="24"/);
    assert.doesNotMatch(svg, /#[0-9a-f]{3,6}\b/i);
    for (const classe of ["strata-camada", "strata-sol", "marca-nome", "marca-nome-traco"]) assert.ok(svg.includes(`class="${classe}"`), `desenho sem ${classe}`);
  });
});
