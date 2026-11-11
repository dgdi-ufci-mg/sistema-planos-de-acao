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
    const semanas = await p.locator(".carga-linha.carga-cabeca .carga-sem").count();
    assert.equal(await p.locator(".carga-grupo").first().locator(".carga-cel").count(), semanas, "uma célula por semana");
    /* o cabeçalho não herda nada da barra do alto da página (11/11/2026): mesma largura das linhas, semanas sobre as células */
    const alinhado = await p.evaluate(() => {
      const cab = document.querySelector(".carga-linha.carga-cabeca");
      const linha = document.querySelector(".carga-linha.dono");
      const R = (e) => e.getBoundingClientRect();
      return { cabeca: [R(cab).left, R(cab).width], linha: [R(linha).left, R(linha).width], margem: getComputedStyle(cab).marginLeft, posicao: getComputedStyle(cab).position,
        semana: R(cab.querySelector(".carga-sem")).left, celula: R(linha.querySelector(".carga-cel")).left, trilhoCab: R(cab.querySelector(".carga-trilho")).left, trilho: R(linha.querySelector(".carga-trilho")).left };
    });
    assert.deepEqual(alinhado.cabeca, alinhado.linha, "o cabeçalho tem a largura das linhas");
    assert.equal(alinhado.margem, "0px");
    assert.equal(alinhado.posicao, "static");
    assert.equal(alinhado.trilhoCab, alinhado.trilho, "as semanas começam onde começam as células");
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
