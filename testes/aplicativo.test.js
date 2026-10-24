/** Aplicativo instalável pelo navegador (documentação técnica, seções 8 e 13.2). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { NOME } from "../js/identidade.js";

describe("Aplicativo instalável", () => {
  const manifesto = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));

  it("o manifesto tem nome, início, tela cheia e os ícones, que existem", () => {
    assert.equal(manifesto.start_url, "./");
    assert.equal(manifesto.display, "standalone");
    for (const tamanho of ["192x192", "512x512"]) assert.ok(manifesto.icons.some((i) => i.sizes === tamanho && i.purpose === "any"), tamanho);
    assert.ok(manifesto.icons.some((i) => i.purpose === "maskable"));
    for (const i of manifesto.icons) assert.ok(existsSync(i.src), i.src);
    assert.ok(existsSync("icones/apple-touch-icon.png"));
  });

  it("o nome nos arquivos estáticos é o de js/identidade.js", () => {
    assert.equal(manifesto.name, NOME);
    assert.equal(manifesto.short_name, NOME);
    for (const pagina of ["index.html", "superior/index.html"]) {
      const html = readFileSync(pagina, "utf8");
      assert.match(html, new RegExp(`<meta name="apple-mobile-web-app-title" content="${NOME}">`), pagina);
      assert.match(html, /<link rel="manifest" href="(\.\.\/)?manifest\.webmanifest">/, pagina);
    }
  });

  it("o service worker não guarda nada em cache", () => {
    const sw = readFileSync("sw.js", "utf8");
    assert.doesNotMatch(sw, /caches\./);
  });
});
