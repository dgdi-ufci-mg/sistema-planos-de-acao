/** Aplicativo instalável pelo navegador (documentação técnica, seções 8 e 13.2). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { NOME } from "../js/identidade.js";

describe("Aplicativo instalável", () => {
  const manifesto = JSON.parse(readFileSync("sextante/manifest.webmanifest", "utf8"));

  it("o manifesto tem nome, início, tela cheia e os ícones, que existem", () => {
    assert.equal(manifesto.start_url, "./");
    assert.equal(manifesto.display, "standalone");
    for (const tamanho of ["192x192", "512x512"]) assert.ok(manifesto.icons.some((i) => i.sizes === tamanho && i.purpose === "any"), tamanho);
    assert.ok(manifesto.icons.some((i) => i.purpose === "maskable"));
    for (const i of manifesto.icons) assert.ok(existsSync("sextante/" + i.src), i.src);
    assert.ok(existsSync("icones/apple-touch-icon.png"));
  });

  it("o nome nos arquivos estáticos é o de js/identidade.js", () => {
    assert.equal(manifesto.name, NOME);
    assert.equal(manifesto.short_name, NOME);
    for (const pagina of ["sextante/index.html"]) {
      const html = readFileSync(pagina, "utf8");
      assert.match(html, new RegExp(`<meta name="apple-mobile-web-app-title" content="${NOME}">`), pagina);
      assert.match(html, /<link rel="manifest" href="(\.\.\/)?manifest\.webmanifest">/, pagina);
    }
  });

  it("o Strata tem aplicativo próprio: manifesto, ícones e nome iguais aos de js/superior/app.js (27/10/2026)", () => {
    const m = JSON.parse(readFileSync("strata/manifest.webmanifest", "utf8"));
    const app = readFileSync("js/superior/app.js", "utf8");
    const nome = app.match(/NOME_DO_MODULO = "([^"]+)"/)[1];
    assert.equal(m.name, nome);
    assert.equal(m.short_name, nome);
    assert.equal(m.scope, "./");
    for (const i of m.icons) assert.ok(existsSync("strata/" + i.src), i.src);
    assert.ok(m.icons.some((i) => i.purpose === "maskable"));
    const html = readFileSync("strata/index.html", "utf8");
    assert.match(html, new RegExp(`<meta name="apple-mobile-web-app-title" content="${nome}">`));
    assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
    assert.ok(existsSync("strata/icones/apple-touch-icon.png"));
    assert.match(readFileSync("superior/index.html", "utf8"), /location\.replace\("\.\.\/strata\/"/, "o endereço antigo leva ao novo");
  });

  it("Sextante e Strata têm identidades diferentes (29/10/2026): o id é caminho absoluto, porque o Chrome o resolve pela raiz do site", () => {
    const sextante = JSON.parse(readFileSync("sextante/manifest.webmanifest", "utf8"));
    const strata = JSON.parse(readFileSync("strata/manifest.webmanifest", "utf8"));
    assert.equal(sextante.id, "/sistema-planos-de-acao/sextante/");
    assert.equal(strata.id, "/sistema-planos-de-acao/strata/");
    assert.notEqual(sextante.id, strata.id);
  });

  it("Sextante e Strata lado a lado, cada um com o seu escopo (27/10/2026): a raiz leva ao Sextante", () => {
    assert.equal(manifesto.scope, "./");
    assert.match(readFileSync("index.html", "utf8"), /location\.replace\("sextante\/"/);
    assert.match(readFileSync("v2/index.html", "utf8"), /\.\.\/sextante\//);
  });

  it("o service worker não guarda nada em cache", () => {
    const sw = readFileSync("sw.js", "utf8");
    assert.doesNotMatch(sw, /caches\./);
  });
});
