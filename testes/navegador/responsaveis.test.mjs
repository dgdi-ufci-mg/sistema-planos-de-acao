/**
 * Visualização "Responsáveis" no navegador (documentação técnica, seção 8.4): uma linha por responsável, com as ações
 * ao mesmo tempo em cada semana; a linha abre as ações da pessoa, e a ação abre a janela dela. No computador e no celular.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, camadasAbertas } from "./apoio.mjs";

describe("Visualização Responsáveis", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("computador: linhas por responsável, abrir as ações de um deles e abrir uma ação", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="responsaveis"]').first().click();
    await p.waitForSelector(".carga");
    const linhas = await p.locator(".carga-grupo").count();
    assert.ok(linhas >= 4, "uma linha por responsável com ação em aberto");
    const semanas = await p.locator(".carga-linha.topo .carga-sem").count();
    assert.equal(await p.locator(".carga-grupo").first().locator(".carga-cel").count(), semanas, "uma célula por semana");
    assert.equal(await p.locator(".carga-acoes").count(), 0, "as ações começam recolhidas");
    const botao = p.locator("[data-carga-abrir]").first();
    await botao.click();
    await assentar(p);
    assert.equal(await p.locator("[data-carga-abrir]").first().getAttribute("aria-expanded"), "true");
    const resumo = await p.locator(".carga-grupo").first().locator(".carga-quem small").innerText();
    assert.equal(await p.locator(".carga-grupo").first().locator(".carga-barra").count(), Number(resumo.match(/^(\d+) em aberto/)[1]), "uma barra por ação em aberto");
    await p.locator(".carga-barra").first().click();
    await assentar(p);
    assert.equal(await camadasAbertas(p), 1, "a barra abre a janela da ação");
    await p.keyboard.press("Escape");
    await assentar(p);
    assert.equal(await p.locator("[data-carga-abrir]").first().getAttribute("aria-expanded"), "true", "continua aberta depois de fechar a janela");
    await p.locator("[data-carga-abrir]").first().click();
    await assentar(p);
    assert.equal(await p.locator(".carga-acoes").count(), 0, "fecha de novo");
    assert.deepEqual(p.erros, []);
  });

  test("celular: existe em \"Filtros e exibição\", a faixa rola para o lado e a página não", async () => {
    const p = await sessao.abrir();
    await p.click('[data-inferior="filtros"]');
    await assentar(p);
    await p.locator('.camada [data-modo="responsaveis"]').click();
    await assentar(p);
    await p.getByRole("button", { name: "Pronto" }).click();
    await assentar(p);
    await p.waitForSelector(".carga");
    const m = await p.evaluate(() => {
      const r = document.querySelector(".carga-rolagem");
      return { pagina: document.documentElement.scrollWidth > innerWidth + 1, faixa: r.scrollWidth > r.clientWidth };
    });
    assert.deepEqual(m, { pagina: false, faixa: true });
    assert.deepEqual(p.erros, []);
  });
});
