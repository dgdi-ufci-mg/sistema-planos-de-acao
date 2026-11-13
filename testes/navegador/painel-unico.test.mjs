/**
 * Painel único "Filtros e exibição" (13/11/2026, pedido do responsável; documentação técnica, seção 8, barra do topo):
 * no computador, Filtrar, Classificar e Exibir ficam lado a lado num painel largo, por cima do conteúdo, no lugar dos
 * menus "Classificar e filtrar" e "Exibir".
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, irParaVisualizacao } from "./apoio.mjs";

describe("Painel único Filtros e exibição (13/11/2026)", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });
  const abrirPainel = async (p) => { await p.click('.menu-topo[data-pop="painel"]'); await assentar(p, 400); };

  test("um botão só no topo; na Lista, o painel encosta à direita, sob a barra, com as três partes uma embaixo da outra, e o conteúdo encolhe", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 900 });
    assert.equal(await p.locator('.menu-topo[data-pop="classificar"], .menu-topo[data-pop="exibir"]').count(), 0, "sem os dois menus antigos");
    assert.equal(await p.locator('.menu-topo[data-pop="painel"]').count(), 1);
    await abrirPainel(p);
    assert.deepEqual(await p.locator(".popover-painel .painel-coluna").evaluateAll((cs) => cs.map((c) => c.getAttribute("aria-label"))), ["Filtrar", "Classificar", "Exibir"]);
    const tops = await p.locator(".popover-painel .painel-coluna").evaluateAll((cs) => cs.map((c) => Math.round(c.getBoundingClientRect().top)));
    assert.ok(tops[0] < tops[1] && tops[1] < tops[2], "uma embaixo da outra");
    const m = await p.evaluate(() => {
      const r = document.querySelector(".popover-painel").getBoundingClientRect();
      return { esquerda: r.left, direita: r.right, topo: r.top, base: r.bottom, barra: document.querySelector(".topo").getBoundingClientRect().bottom,
        conteudo: document.querySelector(".conteudo").getBoundingClientRect().right, janela: innerWidth, altura: innerHeight };
    });
    assert.equal(Math.round(m.direita), m.janela, "encosta à direita");
    assert.ok(Math.abs(m.topo - m.barra) <= 1, "começa logo abaixo da barra do topo");
    assert.equal(Math.round(m.base), m.altura, "vai até o pé da janela");
    assert.ok(m.conteudo <= m.esquerda + 1, "o conteúdo fica ao lado, sem ser coberto");
    assert.deepEqual(p.erros, []);
  });

  test("filtrar e classificar pelo painel; o número de filtros fica no botão; o painel continua aberto", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 900 });
    await abrirPainel(p);
    await p.locator('.popover-painel [data-filtro="atrasada"]').click();
    await assentar(p, 400);
    assert.equal(await p.locator('.menu-topo[data-pop="painel"] .contador').innerText(), "1");
    assert.ok(await p.locator(".popover-painel").isVisible(), "segue aberto");
    await p.locator(".popover-painel [data-ordem]").nth(2).click();
    await assentar(p, 400);
    assert.equal(await p.locator('.menu-topo[data-pop="painel"] .ponto-menu').count(), 1, "ponto da ordem diferente");
    await p.locator(".popover-painel [data-limpar-filtros]").click();
    await assentar(p, 400);
    assert.equal(await p.locator('.menu-topo[data-pop="painel"] .contador').count(), 0);
    assert.deepEqual(p.erros, []);
  });

  test("janela estreita: o painel continua à direita, e a Rede termina onde ele começa", async () => {
    const p = await sessao.abrir({ largura: 960, altura: 900 });
    await irParaVisualizacao(p, "rede");
    await assentar(p, 500);
    await abrirPainel(p);
    const m = await p.evaluate(() => ({ painel: document.querySelector(".popover-painel").getBoundingClientRect().left,
      rede: document.querySelector(".rede").getBoundingClientRect().right, zoom: document.querySelector(".rede-controles").getBoundingClientRect().right }));
    assert.ok(m.rede <= m.painel + 1, "a Rede não passa por baixo do painel");
    assert.ok(m.zoom <= m.painel, "os botões de zoom ficam à vista");
    assert.deepEqual(p.erros, []);
  });

  test("Rede e Planilha: só a coluna Exibir", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 900 });
    for (const modo of ["rede", "planilha"]) {
      await irParaVisualizacao(p, modo);
      await assentar(p, 500);
      await abrirPainel(p);
      assert.deepEqual(await p.locator(".popover-painel .painel-coluna").evaluateAll((cs) => cs.map((c) => c.getAttribute("aria-label"))), ["Exibir"], modo);
      await p.keyboard.press("Escape");
      await assentar(p, 300);
    }
    assert.deepEqual(p.erros, []);
  });
});
