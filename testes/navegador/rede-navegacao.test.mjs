/**
 * Rede em tela cheia, navegada como um mapa (09/11/2026, pedido do responsável; documentação técnica, seção 8.4):
 * a Rede ocupa a área à direita do menu lateral, por trás da barra do topo; rolar o mouse aproxima e afasta em volta
 * do ponteiro; arrastar o fundo move a vista; os botões flutuantes ajustam à tela, voltam a 100% e explicam o uso.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Rede: navegação como num mapa", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const abrirRede = async (o = {}) => {
    const p = await sessao.abrir({ largura: 1440, altura: 860, ...o });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="rede"]').first().click();
    await p.waitForSelector(".rede-no");
    await assentar(p);
    return p;
  };
  const zoom = async (p) => Number((await p.locator("[data-zoom-valor]").textContent()).replace("%", ""));
  const caixa = (p, seletor) => p.locator(seletor).first().boundingBox();

  test("a rede ocupa a tela à direita do menu, por trás da barra do topo, e acompanha o menu recolhido", async () => {
    const p = await abrirRede();
    const r = await caixa(p, ".rede");
    assert.deepEqual([r.x, r.y, r.width, r.height].map(Math.round), [264, 0, 1176, 860]);
    assert.equal(await p.evaluate(() => getComputedStyle(document.body).overflow), "hidden");
    await p.click(".botao-lateral");
    await p.waitForTimeout(400);
    assert.equal(Math.round((await caixa(p, ".rede")).x), 0);
    assert.deepEqual(p.erros, []);
  });

  test("rolar o mouse aproxima e afasta, sem Ctrl, mantendo o ponto sob o ponteiro", async () => {
    const p = await abrirRede();
    assert.equal(await zoom(p), 100);
    const antes = await caixa(p, ".rede-no");
    const [ax, ay] = [antes.x + 30, antes.y + 20];
    await p.mouse.move(ax, ay);
    for (let i = 0; i < 3; i++) await p.mouse.wheel(0, 100);
    await p.waitForTimeout(100);
    const depois = await caixa(p, ".rede-no");
    const f = depois.width / antes.width;
    assert.ok(await zoom(p) < 100, "afastou");
    assert.ok(Math.abs(depois.x + 30 * f - ax) < 2 && Math.abs(depois.y + 20 * f - ay) < 2, "o ponto sob o ponteiro não saiu do lugar");
    assert.equal(await p.evaluate(() => scrollY), 0, "a página não rolou");
    assert.deepEqual(p.erros, []);
  });

  test("arrastar o fundo move a vista", async () => {
    const p = await abrirRede();
    const antes = await caixa(p, ".rede-no");
    await p.mouse.move(800, 760);
    await p.mouse.down();
    await p.mouse.move(700, 700, { steps: 6 });
    await p.mouse.up();
    const depois = await caixa(p, ".rede-no");
    assert.equal(Math.round(depois.x - antes.x), -100);
    assert.equal(Math.round(depois.y - antes.y), -60);
  });

  test("ajustar à tela cabe a rede na área livre dos controles; o valor em % volta a 100%", async () => {
    const p = await abrirRede();
    await p.click('[data-escala="tudo"]');
    await assentar(p);
    assert.ok(await zoom(p) < 100);
    const conteudo = await caixa(p, "[data-conteudo]");
    const controles = await caixa(p, "[data-rede-controles]");
    const legenda = await caixa(p, ".rede-legenda");
    const titulo = await caixa(p, "#principal .titulo-conteudo");
    assert.ok(conteudo.x >= 264 && conteudo.x + conteudo.width <= controles.x, "não passa por baixo dos botões");
    assert.ok(conteudo.y >= titulo.y + titulo.height && conteudo.y + conteudo.height <= legenda.y, "nem do título, nem da legenda");
    await p.click('[data-escala="normal"]');
    assert.equal(await zoom(p), 100);
    await p.click('[data-zoom-passo="1"]');
    assert.equal(await zoom(p), 125);
  });

  test("o ? abre e fecha a explicação", async () => {
    const p = await abrirRede({ tema: "dark" });
    const cartao = p.locator("[data-rede-ajuda-cartao]");
    assert.equal(await cartao.isVisible(), false);
    await p.click("[data-rede-ajuda]");
    assert.ok(await cartao.isVisible());
    await p.click('[data-escala="tudo"]');
    assert.equal(await zoom(p) < 100, true, "com a explicação aberta, os demais botões seguem funcionando");
    await p.click("[data-rede-ajuda]");
    await p.waitForTimeout(400);
    assert.equal(await cartao.isVisible(), false);
    assert.deepEqual(p.erros, []);
  });
});
