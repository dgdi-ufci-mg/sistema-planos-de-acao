/**
 * Indicador em "Exibir" (12/11/2026, pedido do responsável; documentação técnica, seção 8.4): na Lista, no Quadro e na
 * Rede, o indicador sai do menu Indicador da barra do topo e vai para "Exibir", com "Nenhum" como primeira opção.
 * A escolha vale junto para as três; o Cronograma tem a sua (cronograma.test.mjs).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Indicador em Exibir, com Nenhum (12/11/2026)", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const irPara = async (p, modo) => {
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator(`[data-modo="${modo}"]`).first().click();
    await assentar(p, 400);
  };
  const escolher = async (p, v) => {
    if (!(await p.locator(".popover [data-barra]").first().isVisible())) await p.click('.menu-topo[data-pop="exibir"]');
    await p.locator(`.popover [data-barra="${v}"]`).first().click();
    await assentar(p, 400);
  };

  test("Lista: sem o menu Indicador e sem a coluna Indicador; Nenhum tira a barra", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800 });
    assert.equal(await p.locator('.menu-topo[data-pop="indicador"]').count(), 0, "sem o menu Indicador no topo");
    await p.click('.menu-topo[data-pop="exibir"]');
    assert.deepEqual(await p.locator(".popover [data-barra]").evaluateAll((bs) => bs.map((b) => b.dataset.barra)), ["nenhum", "tempo", "execucao", "revisao"]);
    assert.equal(await p.locator('.popover [data-coluna="barras"]').count(), 0, "a coluna Indicador virou a opção Nenhum");
    assert.ok(await p.locator(".linha .pr .barra-icone").count() >= 3, "começa com a barra de tempo");
    await escolher(p, "nenhum");
    assert.equal(await p.locator(".linha .pr .barra-icone").count(), 0, "sem barra");
    assert.equal(await p.locator(".legenda-barra").count(), 0);
    assert.equal(await p.evaluate(() => localStorage.getItem("sextante.barra")), "nenhum");
    assert.deepEqual(p.erros, []);
  });

  test("Quadro: Nenhum tira a barra dos cartões, e a escolha vale junto com a Lista", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800 });
    await escolher(p, "nenhum");
    await p.keyboard.press("Escape");
    await irPara(p, "quadro");
    assert.equal(await p.locator(".cartao-quadro .barra-icone").count(), 0, "a escolha da Lista vale no Quadro");
    await escolher(p, "execucao");
    assert.ok(await p.locator(".cartao-quadro .barra-icone.execucao").count() >= 3);
    await p.keyboard.press("Escape");
    await irPara(p, "lista");
    assert.ok(await p.locator(".linha .pr .barra-icone.execucao").count() >= 3, "e a do Quadro vale na Lista");
    assert.deepEqual(p.erros, []);
  });

  test("quem tinha desligado a coluna Indicador da Lista fica com Nenhum", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, exemplo: false });
    await p.evaluate(() => {
      localStorage.setItem("sextante.colunas", JSON.stringify({ descricao: false, participantes: true, barras: false }));
      localStorage.setItem("sextante.barra", "execucao");
    });
    await p.reload();
    await p.click("[data-acao=exemplo]");
    await p.waitForSelector(".linha[data-abrir-acao]");
    await assentar(p, 400);
    assert.equal(await p.locator(".linha .pr .barra-icone").count(), 0);
    await p.click('.menu-topo[data-pop="exibir"]');
    assert.equal(await p.locator('.popover [data-barra="nenhum"]').getAttribute("aria-pressed"), "true");
    assert.deepEqual(p.erros, []);
  });

  test("celular: o indicador aparece em Exibir, no painel", async () => {
    const p = await sessao.abrir({ largura: 390, altura: 800 });
    await p.click('[data-inferior="filtros"]');
    await assentar(p, 400);
    await p.locator("[data-ir-exibicao]").click();
    await assentar(p, 400);
    assert.equal(await p.locator('.painel [data-barra="nenhum"]').count(), 1);
    await p.locator('.painel [data-barra="nenhum"]').click();
    await assentar(p, 400);
    assert.equal(await p.locator('.painel [data-barra="nenhum"]').getAttribute("aria-pressed"), "true");
    assert.deepEqual(p.erros, []);
  });

  /* ---------- organização do Exibir e legenda (12/11/2026) ---------- */
  test("Exibir da Lista: indicador no alto, escolhas curtas lado a lado e sem a caixa travada; cabe sem rolar", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 900 });
    await p.click('.menu-topo[data-pop="exibir"]');
    await assentar(p, 300);
    const titulos = await p.locator(".popover h3").allInnerTexts();
    assert.deepEqual(titulos.map((t) => t.toLowerCase()), ["indicador", "colunas", "identificador antes do nome", "mostrar até", "ajuda na tela"]);
    assert.equal(await p.locator(".popover .segmentos [data-identificador-op]").count() >= 2, true);
    assert.equal(await p.locator(".popover .segmentos [data-nivel]").count(), 3);
    assert.equal(await p.locator(".popover .segmentos.recuo [data-tempo-num]").count(), 2, "dias ou data logo abaixo de Tempo restante");
    assert.equal(await p.locator(".popover label.fixa").count(), 0, "sem Nome e situação");
    /* chaves no lugar das caixinhas (13/11/2026) */
    assert.equal(await p.locator('.popover input[data-coluna]:not(.chave)').count(), 0, "colunas como chave");
    assert.equal(await p.locator('.popover input.chave[role="switch"][data-coluna]').count() >= 1, true);
    const chave = await p.locator(".popover input.chave").first().evaluate((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, depoisDoTexto: r.left > e.parentElement.getBoundingClientRect().left + 100 }; });
    assert.deepEqual(chave, { w: 32, h: 18, depoisDoTexto: true }, "chave à direita do texto");
    const pop = await p.locator(".popover").evaluate((e) => ({ rola: e.scrollHeight > e.clientHeight + 1 }));
    assert.equal(pop.rola, false, "o menu cabe sem rolar");
    /* os botões lado a lado funcionam como as opções em lista */
    await p.locator('.popover [data-nivel="fases"]').click();
    await assentar(p, 400);
    assert.equal(await p.locator('.popover [data-nivel="fases"]').getAttribute("aria-pressed"), "true");
    await p.locator('.popover [data-tempo-num="data"]').click();
    await assentar(p, 300);
    assert.equal(await p.evaluate(() => localStorage.getItem("sextante.tempoNumero")), "data");
    await escolher(p, "execucao");
    assert.equal(await p.locator(".popover [data-tempo-num]").count(), 0, "dias ou data só com o tempo restante");
    assert.deepEqual(p.erros, []);
  });

  for (const [modo, seletor] of [["rede", ".rede-legenda"], ["cronograma", ".crono + .crono-legendas"]]) {
    test(`${modo}: "Legenda dos símbolos" liga e desliga a legenda própria, ligada de início`, async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 800 });
      await irPara(p, modo);
      assert.ok(await p.locator(seletor).isVisible(), "começa ligada");
      await p.click('.menu-topo[data-pop="exibir"]');
      assert.equal(await p.locator(".popover [data-legenda-op]").getAttribute("aria-checked"), "true");
      assert.equal(await p.locator(".popover [data-legenda-op]").getAttribute("role"), "switch", "chave, não caixinha");
      await p.locator(".popover [data-legenda-op]").click();
      await assentar(p, 400);
      assert.equal(await p.locator(seletor).isVisible().catch(() => false), false, "desligada");
      assert.equal(await p.locator("[data-legenda]").isVisible(), false, "e sem a legenda geral");
      if (!(await p.locator(".popover [data-legenda-op]").isVisible())) await p.click('.menu-topo[data-pop="exibir"]');
      await p.locator(".popover [data-legenda-op]").click();
      await assentar(p, 400);
      assert.ok(await p.locator(seletor).isVisible(), "ligada de novo");
      assert.deepEqual(p.erros, []);
    });
  }
});
