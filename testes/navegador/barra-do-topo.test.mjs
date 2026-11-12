/**
 * Barra do topo no computador (documentação técnica, seções 8.0 e 3.2): os nomes dos menus aparecem sempre que
 * couberem e, quando não cabem, ficam só os ícones, sem nada encostar nem ser cortado. A decisão é medida na hora
 * (ajustarBarra, em js/telas/espaco.js); estes testes conferem de 700 a 1.366 px, com a barra lateral aberta e
 * recolhida.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

/** Controles da barra que se encostam ou cortam, pelas mesmas regras do sistema (8 px entre grupos). */
const problemas = (p) => p.evaluate(() => {
  const els = [...document.querySelectorAll(".topo .titulo-barra, .topo .menu-topo, .topo .chip-atrasadas, .topo .botao[data-nova]")]
    .filter((el) => el.getBoundingClientRect().width > 2);
  const grupo = (el) => el.closest(".topo-esquerda, .topo-centro, .topo-direita");
  const nome = (el) => el.textContent.trim().replace(/\s+/g, " ") || el.className;
  const r = els.map((el) => ({ el, g: grupo(el), ...el.getBoundingClientRect().toJSON() })).sort((a, b) => a.left - b.left);
  const achados = [];
  r.forEach((a, i) => {
    const antes = r[i - 1];
    if (antes && (antes.right > a.left || (antes.g !== a.g && antes.right + 8 > a.left))) achados.push(`"${nome(antes.el)}" encosta em "${nome(a.el)}"`);
  });
  for (const el of els) if (!el.matches(".titulo-barra") && el.scrollWidth > el.clientWidth + 1) achados.push(`"${nome(el)}" cortado`);
  if (document.querySelector(".topo").getBoundingClientRect().right > innerWidth + 1) achados.push("a barra passa da tela");
  return achados;
});
const classe = (p) => p.evaluate(() => document.querySelector(".topo").className);
/** Recolhe ou abre a barra lateral (Ctrl+B) e espera a animação. */
const alternarLateral = async (p) => { await p.keyboard.press("Control+b"); await assentar(p, 600); };

describe("Barra do topo no computador", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  for (const largura of [700, 800, 900, 1024, 1180, 1280, 1366]) {
    test(`${largura} px: nada encosta nem é cortado, com a barra lateral aberta e recolhida`, async () => {
      const p = await sessao.abrir({ largura, altura: 760 });
      assert.deepEqual(await problemas(p), [], "barra lateral aberta");
      await alternarLateral(p);
      assert.deepEqual(await problemas(p), [], "barra lateral recolhida");
      assert.deepEqual(p.erros, []);
    });
  }

  test("1.366 px: os nomes dos menus aparecem", async () => {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    assert.doesNotMatch(await classe(p), /barra-icones|barra-curta/);
    assert.match(await p.locator(".menu-topo").first().innerText(), /\S/);
  });

  test("clicar num menu não faz os nomes sumirem (correção da versão 184)", async () => {
    for (const largura of [1024, 1366]) {
      const p = await sessao.abrir({ largura, altura: 760 });
      const antes = await classe(p);
      for (const menu of await p.locator(".topo .menu-topo").all()) {
        await menu.click();
        await assentar(p, 250);
        assert.equal(await classe(p), antes, `${largura} px, menu "${(await menu.innerText()).trim()}"`);
        await p.keyboard.press("Escape");
        await assentar(p, 250);
      }
    }
  });

  test("recolher e reabrir a barra lateral refaz a medida da barra do topo (correção de 27/10/2026)", async () => {
    for (const largura of [900, 1024, 1180]) {
      const p = await sessao.abrir({ largura, altura: 760 });
      await alternarLateral(p);
      await alternarLateral(p);
      assert.deepEqual(await problemas(p), [], `${largura} px, depois de reabrir a barra lateral`);
    }
  });
});

/**
 * Barra do topo nas visualizações sem filtro (12/11/2026, decisão do responsável; seção 8.0): o chip das atrasadas
 * leva à Lista já filtrada, em vez de ligar um filtro que a tela não aplica; nas Entregas, o botão principal
 * é "Nova entrega" (e não há outro dentro da tela).
 */
describe("Barra do topo nas visualizações", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const irPara = async (p, modo) => {
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator(`[data-modo="${modo}"]`).first().click();
    await assentar(p, 600);
  };

  for (const modo of ["rede", "cronograma", "planilha", "linha", "responsaveis", "entregas"]) {
    test(`${modo}: o chip das atrasadas abre a Lista só com as atrasadas`, async () => {
      const p = await sessao.abrir({ largura: 1366, altura: 760 });
      await irPara(p, modo);
      const chip = p.locator(".topo .chip-atrasadas");
      assert.equal(await chip.count(), 1, "o exemplo tem ações atrasadas");
      assert.equal(await chip.getAttribute("aria-pressed"), null, "não finge ser um filtro desta tela");
      assert.equal(await chip.getAttribute("title"), "Ver as atrasadas na Lista");
      await chip.click();
      await assentar(p, 600);
      assert.equal(await p.evaluate(() => document.body.dataset.vistaAtual), "lista");
      assert.equal(await p.locator(".topo .chip-atrasadas").getAttribute("aria-pressed"), "true");
      const linhas = p.locator(".linha[data-abrir-acao]");
      assert.ok(await linhas.count() > 0);
      assert.deepEqual(p.erros, []);
    });
  }

  test("lista: o chip continua ligando e desligando o filtro na própria tela", async () => {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    const chip = p.locator(".topo .chip-atrasadas");
    assert.equal(await chip.getAttribute("aria-pressed"), "false");
    await chip.click();
    await assentar(p, 600);
    assert.equal(await p.locator(".topo .chip-atrasadas").getAttribute("aria-pressed"), "true");
    await p.locator(".topo .chip-atrasadas").click();
    await assentar(p, 600);
    assert.equal(await p.locator(".topo .chip-atrasadas").getAttribute("aria-pressed"), "false");
  });

  test("entregas: o botão do topo é \"Nova entrega\", único, e abre o cadastro da entrega", async () => {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    await irPara(p, "entregas");
    await p.waitForSelector(".lista-entregas");
    const botao = p.locator(".topo .botao[data-nova]");
    assert.match((await botao.innerText()).trim(), /^Nova entrega$/);
    assert.equal(await p.locator("main .botao.principal, .lista .botao.principal").count(), 0, "sem segundo botão principal na tela");
    await botao.click();
    await assentar(p);
    assert.equal(await p.locator("[data-form-cadastro]").count(), 1, "abre o cadastro da entrega");
    await p.keyboard.press("Escape");
    await assentar(p);
    await p.keyboard.press("n");
    await assentar(p);
    assert.equal(await p.locator("[data-form-cadastro]").count(), 1, "a tecla N faz o mesmo");
    assert.deepEqual(p.erros, []);
  });

  test("ao sair das Entregas, o botão volta a ser \"Nova ação\"", async () => {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    await irPara(p, "entregas");
    await irPara(p, "lista");
    assert.match((await p.locator(".topo .botao[data-nova]").innerText()).trim(), /^Nova ação$/);
  });
});
