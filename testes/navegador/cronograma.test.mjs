/**
 * Cronograma (Gantt) no navegador: zoom com os botões e com Ctrl + rolagem do mouse (27/10/2026; documentação
 * técnica, seção 8.4), mantendo parada a data sob o ponteiro.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Cronograma: zoom", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const largura = (p) => p.evaluate(() => document.querySelector(".crono-trilho").getBoundingClientRect().width);

  test("botões − e + e Ctrl + rolagem mudam o zoom; a data sob o ponteiro fica parada", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 760 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="cronograma"]').first().click();
    await p.waitForSelector(".crono-trilho");
    const l0 = await largura(p);
    await p.click('[data-zoom="1"]');
    await assentar(p, 200);
    const l1 = await largura(p);
    assert.ok(l1 > l0, "+ aproxima");
    await p.click('[data-zoom="-1"]');
    await assentar(p, 200);
    assert.equal(Math.round(await largura(p)), Math.round(l0), "− volta");
    /* Ctrl + rolagem para baixo afasta, no ponto do ponteiro */
    const r = await p.locator("[data-rolagem]").boundingBox();
    const px = r.x + r.width * 0.7;
    const dataSob = () => p.evaluate((x) => {
      const t = document.querySelector(".crono-trilho").getBoundingClientRect();
      return (x - t.left) / t.width;
    }, px);
    const antes = await dataSob();
    await p.mouse.move(px, r.y + 120);
    await p.keyboard.down("Control");
    await p.mouse.wheel(0, 120);
    await p.keyboard.up("Control");
    await assentar(p, 300);
    assert.ok(await largura(p) < l0, "afastou");
    assert.ok(Math.abs((await dataSob()) - antes) < 0.02, "a data sob o ponteiro ficou no lugar");
    assert.deepEqual(p.erros, []);
  });

  test("rolagem no próprio cronograma: cabeçalho parado e barra horizontal sempre à vista (27/10/2026)", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 700 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="cronograma"]').first().click();
    await p.waitForSelector(".crono-trilho");
    await assentar(p, 300);
    const medidas = () => p.evaluate(() => {
      const r = document.querySelector("[data-rolagem]");
      const caixa = r.getBoundingClientRect();
      return { topo: document.querySelector(".crono-topo").getBoundingClientRect().top - caixa.top, base: caixa.bottom, alto: innerHeight,
        rolaY: r.scrollHeight > r.clientHeight, rolaX: r.scrollWidth > r.clientWidth };
    });
    const antes = await medidas();
    assert.ok(antes.rolaY && antes.rolaX, "o cronograma rola nos dois sentidos");
    assert.ok(antes.base <= antes.alto, "a barra horizontal fica dentro da tela");
    await p.evaluate(() => { document.querySelector("[data-rolagem]").scrollTop = 200; });
    await assentar(p, 100);
    assert.ok(Math.abs((await medidas()).topo) < 1, "cabeçalho das datas parado no alto");
    assert.deepEqual(p.erros, []);
  });
});
