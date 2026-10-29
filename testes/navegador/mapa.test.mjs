/**
 * Mapa do Strata (lote 1, 29/10/2026; documentação técnica, seção 8, "Mapa"): faixas na ordem do catálogo, camada
 * opcional vazia sem faixa, nenhum ponto fora da faixa, sem rolagem lateral da página, movimento e aproximação
 * limitados ao conteúdo. No computador e num celular simulado (390 px).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, dedo, centro } from "./apoio.mjs";

const ABRIR = { caminho: "strata/", aguardar: ".mapa-no" };
const sem = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const vista = (p) => p.evaluate(() => {
  const m = document.querySelector("[data-mapa-mundo]").getAttribute("transform").match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);
  return { x: Number(m[1]), y: Number(m[2]), k: Number(m[3]) };
});

describe("Mapa do Strata", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  for (const [nome, o] of [["computador", { largura: 1280, altura: 800 }], ["celular (390 px)", { largura: 390, altura: 800 }]]) {
    describe(nome, () => {
      test("abre no Mapa, com as faixas na ordem do catálogo e os Planos de Ação por último", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        assert.equal(await p.locator('[data-aba="mapa"]').getAttribute("aria-selected"), "true");
        const ids = await p.locator(".mapa-faixa").evaluateAll((f) => f.map((x) => x.dataset.camada));
        assert.deepEqual(ids, ["objetivoEstrategico", "objetivoDesenvolvimento", "politica", "portfolio", "programa", "planosDeAcao"]);
        assert.ok(await sem(p), "a página não rola para o lado");
        assert.deepEqual(p.erros, []);
      });

      test("nenhum ponto fica fora da sua faixa", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        const fora = await p.evaluate(() => {
          const faixas = new Map([...document.querySelectorAll(".mapa-faixa")].map((f) => [f.dataset.camada, f]));
          const ordem = [...faixas.keys()];
          const itens = [];
          for (const c of document.querySelectorAll(".mapa-no circle")) {
            const ponto = new DOMPoint(Number(c.getAttribute("cx")), Number(c.getAttribute("cy")));
            const dentro = [...faixas.values()].filter((f) => f.isPointInFill(ponto));
            if (dentro.length !== 1) itens.push(c.parentNode.dataset.no);
          }
          return { itens, pontos: document.querySelectorAll(".mapa-no").length, faixas: ordem.length };
        });
        assert.deepEqual(fora.itens, []);
        assert.equal(fora.pontos, 10, "o catálogo de exemplo tem 10 itens");
      });

      test("as linhas ligam cada item ao que ele vem de", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        const ligacoes = await p.locator(".mapa-ligacao").evaluateAll((l) => l.map((x) => x.dataset.de));
        assert.equal(ligacoes.length, 10, "OD1, OD2, POL1, POL2 (duas), PF1, PRG1, PRG2 (duas) e PRG3");
        const porItem = Object.values(ligacoes.reduce((m, de) => ({ ...m, [de]: (m[de] ?? 0) + 1 }), {}));
        assert.equal(porItem.filter((n) => n === 2).length, 2, "os dois itens com dois superiores (POL2 e PRG2) têm as duas linhas");
      });
    });
  }

  test("camada opcional sem itens não ocupa faixa", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    await p.evaluate(async () => {
      const { criarStore } = await import("../js/dados.js");
      const { criarBancoLocal } = await import("../js/banco/local.js");
      const { mostrarSuperior } = await import("../js/superior/telas.js");
      const store = criarStore(criarBancoLocal());
      const oe = await store.criarItemEstrategico({ camada: "objetivoEstrategico", codigo: "OE1", nome: "Governança", superiores: [] });
      const od = await store.criarItemEstrategico({ camada: "objetivoDesenvolvimento", codigo: "OD1", nome: "Dados", superiores: [oe] });
      const pol = await store.criarItemEstrategico({ camada: "politica", codigo: "POL1", nome: "Política", superiores: [od] });
      await store.criarItemEstrategico({ camada: "programa", codigo: "PRG1", nome: "Programa", superiores: [pol] });
      const alvo = document.querySelector("#principal");
      alvo.replaceChildren();
      await mostrarSuperior(alvo, { store, hoje: "2026-10-29" }).recarregar();
    });
    const ids = await p.locator(".mapa-faixa").evaluateAll((f) => f.map((x) => x.dataset.camada));
    assert.deepEqual(ids, ["objetivoEstrategico", "objetivoDesenvolvimento", "politica", "programa", "planosDeAcao"]);
  });

  test("os nomes das camadas ficam em tamanho fixo na borda esquerda, também ao aproximar", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    const rotulo = p.locator('.mapa-rotulo-camada[data-camada="politica"]');
    const antes = await rotulo.boundingBox();
    await p.click("[data-mapa-mais]");
    await p.waitForTimeout(400);
    const depois = await rotulo.boundingBox();
    assert.equal(Math.round(depois.width), Math.round(antes.width));
    assert.ok(depois.x < 40, "continua preso à borda esquerda");
  });

  test("o movimento e a aproximação ficam limitados ao conteúdo", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    const area = await centro(p.locator(".mapa-area"));
    for (let i = 0; i < 12; i++) { await p.click("[data-mapa-mais]"); await p.waitForTimeout(260); }
    const perto = await vista(p);
    assert.ok(perto.k <= 3 + 1e-6, `k ${perto.k} não passa do máximo`);
    for (let i = 0; i < 30; i++) { await p.click("[data-mapa-menos]"); await p.waitForTimeout(260); }
    const longe = await vista(p);
    assert.ok(longe.k >= 0.2, `k ${longe.k}: o conteúdo inteiro ainda ocupa a vista`);
    /* arrasta o mapa muito para a esquerda: o conteúdo não pode sair da vista */
    await p.mouse.move(area.x, area.y);
    await p.mouse.down();
    await p.mouse.move(area.x - 600, area.y - 300, { steps: 8 });
    await p.mouse.up();
    const t = await vista(p);
    const caixa = await p.locator(".mapa-faixa").first().boundingBox();
    assert.ok(caixa.x + caixa.width > area.r.x, "ainda há conteúdo à vista");
    assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y));
  });

  test("Ctrl + rolagem aproxima e a rolagem sem Ctrl move o mapa", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    const area = await centro(p.locator(".mapa-area"));
    const antes = await vista(p);
    await p.mouse.move(area.x, area.y);
    await p.keyboard.down("Control");
    await p.mouse.wheel(0, -300);
    await p.keyboard.up("Control");
    const aproximado = await vista(p);
    assert.ok(aproximado.k > antes.k, "aproximou");
    await p.mouse.wheel(120, 0);
    await p.waitForTimeout(100);
    const movido = await vista(p);
    assert.equal(movido.k, aproximado.k, "só mexer a rolagem não muda a escala");
    assert.notEqual(movido.x, aproximado.x, "mexeu o mapa");
  });

  test("o botão Centralizar volta à vista de abertura; redimensionar não centraliza", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    const abertura = await vista(p);
    await p.click("[data-mapa-mais]");
    await p.waitForTimeout(400);
    assert.notEqual((await vista(p)).k, abertura.k);
    const area = await centro(p.locator(".mapa-area"));
    await p.mouse.move(area.x, area.y);
    await p.mouse.down();
    await p.mouse.move(area.x - 150, area.y - 40, { steps: 6 });
    await p.mouse.up();
    const arrastado = await vista(p);
    await p.setViewportSize({ width: 1280, height: 760 });
    await p.waitForTimeout(250);
    const aposRedimensionar = await vista(p);
    assert.equal(aposRedimensionar.k, arrastado.k, "a escala não mudou ao redimensionar");
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.waitForTimeout(250);
    await p.click("[data-mapa-centralizar]");
    await p.waitForTimeout(400);
    const centrado = await vista(p);
    assert.ok(Math.abs(centrado.k - abertura.k) < 0.02);
  });

  test("no celular, o dedo move o mapa e a pinça aproxima", async () => {
    const p = await sessao.abrir({ largura: 390, altura: 800, ...ABRIR });
    const d = await dedo(p);
    const area = await centro(p.locator(".mapa-area"));
    const antes = await vista(p);
    await d.arrastar(area.x + 60, area.y, -120, 0);
    const depois = await vista(p);
    assert.ok(depois.x < antes.x, "o mapa andou para a esquerda");
    assert.ok(await sem(p), "a página não rola para o lado");
  });
});
