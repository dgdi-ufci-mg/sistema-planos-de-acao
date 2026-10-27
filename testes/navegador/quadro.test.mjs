/**
 * Quadro na janela inteira (27/10/2026; documentação técnica, seção 8.4): ocupa toda a largura, vai até o pé da
 * tela, com as colunas centralizadas, e a barra de rolagem para o lado fica colada embaixo; a página não rola.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Quadro: janela inteira", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const medidas = (p) => p.evaluate(() => {
    const q = document.querySelector(".quadro");
    const r = q.getBoundingClientRect();
    const cols = [...q.querySelectorAll(":scope > .coluna")].map((c) => c.getBoundingClientRect());
    return {
      base: r.bottom, alto: innerHeight, largura: r.width, larguraJanela: document.documentElement.clientWidth,
      esquerda: cols[0].left - r.left, direita: r.right - cols.at(-1).right, rolaX: q.scrollWidth > q.clientWidth,
      paginaRola: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });

  test("tela larga: colunas no meio, quadro até o pé da tela, página sem rolar", async () => {
    const p = await sessao.abrir({ largura: 2400, altura: 800 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="quadro"]').first().click();
    await p.waitForSelector(".quadro .coluna");
    await assentar(p, 300);
    const m = await medidas(p);
    assert.ok(m.largura > 1600, "ocupa mais que a antiga largura de leitura");
    assert.ok(!m.rolaX, "as colunas cabem");
    assert.ok(Math.abs(m.esquerda - m.direita) < 4, `colunas centralizadas (${m.esquerda} × ${m.direita})`);
    assert.ok(m.alto - m.base < 12, "o quadro vai até o pé da tela");
    assert.ok(!m.paginaRola, "a página não rola");
    assert.deepEqual(p.erros, []);
  });

  test("tela estreita: as colunas começam da esquerda e a barra para o lado fica no pé da tela", async () => {
    const p = await sessao.abrir({ largura: 900, altura: 700 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="quadro"]').first().click();
    await p.waitForSelector(".quadro .coluna");
    await assentar(p, 300);
    const m = await medidas(p);
    assert.ok(m.rolaX, "as colunas não cabem e o quadro rola para o lado");
    assert.ok(m.esquerda < 4, "começam da esquerda");
    assert.ok(m.alto - m.base < 12, "a barra fica no pé da tela");
    assert.ok(!m.paginaRola, "a página não rola");
  });
});
