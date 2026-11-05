/**
 * Foco preso na janela aberta (05/11/2026, pedido do responsável; documentação técnica, seção 8, "Ação"): Tab e
 * Shift+Tab circulam dentro da janela e do diálogo de confirmação, sem ir para a tela de trás.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

const dentro = (p, sel) => p.evaluate((s) => Boolean(document.activeElement?.closest(s)), sel);

describe("Foco preso nas janelas", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("Tab e Shift+Tab não saem da janela da ação", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    await p.locator(".linha[data-abrir-acao]").first().click();
    await p.waitForSelector(".camada.aberta .janela-grade");
    await assentar(p);
    const total = await p.locator(".camada.aberta .painel").evaluate((el) => el.querySelectorAll("button, input, select, textarea, a[href]").length);
    for (let i = 0; i < total + 5; i++) {
      await p.keyboard.press("Tab");
      assert.equal(await dentro(p, ".camada.aberta .painel"), true, `Tab ${i + 1} ficou na janela`);
    }
    for (let i = 0; i < 6; i++) {
      await p.keyboard.press("Shift+Tab");
      assert.equal(await dentro(p, ".camada.aberta .painel"), true, `Shift+Tab ${i + 1} ficou na janela`);
    }
    /* com o foco perdido (clique no fundo da página), Tab volta para a janela */
    await p.evaluate(() => document.activeElement?.blur());
    await p.keyboard.press("Tab");
    assert.equal(await dentro(p, ".camada.aberta .painel"), true);
    assert.deepEqual(p.erros, []);
  });

  test("no diálogo de confirmação, o foco fica nele; ao fechar, a janela volta a prender", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    await p.locator(".linha[data-abrir-acao]").first().click();
    await p.waitForSelector(".camada.aberta .janela-grade");
    await assentar(p);
    /* a primeira ação do exemplo tem outras que dependem dela: Excluir pergunta antes */
    await p.locator(".camada.aberta header [data-menu-janela]").click();
    await p.locator(".camada.aberta [data-excluir-acao]").click();
    await p.waitForSelector(".dialogo-camada.aberta");
    for (let i = 0; i < 8; i++) {
      await p.keyboard.press("Tab");
      assert.equal(await dentro(p, ".dialogo"), true, `Tab ${i + 1} ficou no diálogo`);
    }
    await p.keyboard.press("Escape");
    await assentar(p);
    assert.equal(await p.locator(".camada.aberta").count(), 1, "Esc cancela só o diálogo");
    await p.keyboard.press("Tab");
    assert.equal(await dentro(p, ".camada.aberta .painel"), true);
    assert.deepEqual(p.erros, []);
  });
});
