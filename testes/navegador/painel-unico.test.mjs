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

  test("um botão só no topo; na Lista, as três colunas lado a lado, sem passar sob a barra lateral", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 900 });
    assert.equal(await p.locator('.menu-topo[data-pop="classificar"], .menu-topo[data-pop="exibir"]').count(), 0, "sem os dois menus antigos");
    assert.equal(await p.locator('.menu-topo[data-pop="painel"]').count(), 1);
    await abrirPainel(p);
    assert.deepEqual(await p.locator(".popover-painel .painel-coluna").evaluateAll((cs) => cs.map((c) => c.getAttribute("aria-label"))), ["Filtrar", "Classificar", "Exibir"]);
    const tops = await p.locator(".popover-painel .painel-coluna").evaluateAll((cs) => cs.map((c) => Math.round(c.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, "lado a lado");
    const painel = await p.locator(".popover-painel").evaluate((e) => ({ esquerda: e.getBoundingClientRect().left, lateral: document.querySelector(".lateral").getBoundingClientRect().right, rola: e.scrollHeight > e.clientHeight + 1 }));
    assert.ok(painel.esquerda >= painel.lateral, "não passa sob a barra lateral");
    assert.equal(painel.rola, false, "cabe sem rolar");
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

  test("janela estreita: Filtrar e Classificar em cima, Exibir embaixo", async () => {
    const p = await sessao.abrir({ largura: 960, altura: 900 });
    await abrirPainel(p);
    const [f, c, e] = await p.locator(".popover-painel .painel-coluna").evaluateAll((cs) => cs.map((x) => Math.round(x.getBoundingClientRect().top)));
    assert.equal(f, c);
    assert.ok(e > f + 100, "Exibir embaixo");
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
