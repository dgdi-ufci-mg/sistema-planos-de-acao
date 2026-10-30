/**
 * Tema claro ou escuro escolhido em cada aparelho, no menu da conta (27/10/2026, pedido do responsável;
 * documentação técnica, seção 8.0). A escolha vale depois de recarregar e "Automático" volta a seguir o sistema.
 * Desde 30/10/2026, cada aplicativo tem a sua escolha e o seu padrão: Sextante claro, Strata escuro.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Tema deste aparelho", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  /* sem login nos testes: a barra lateral é montada de novo como com alguém entrado */
  const comConta = (p) => p.evaluate(async () => {
    const { mostrarNavegacao } = await import("../js/telas/navegacao.js");
    const nada = () => {};
    mostrarNavegacao({ espacos: [], usuario: { email: "ana@ufci.edu.br", nome: "Ana Souza" }, podeConfigurar: () => false,
      aoAbrir: nada, aoConfigurar: nada, aoNovo: nada, aoAjuda: nada, aoSistema: nada, aoEntrar: nada, aoTrocarSenha: nada, aoSair: nada });
  });
  const fundo = (p) => p.evaluate(() => getComputedStyle(document.body).backgroundColor);

  test("Escuro e Claro trocam na hora, ficam guardados e Automático volta ao sistema", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 760, tema: "light" });
    const claro = await fundo(p);
    await comConta(p);
    await p.click("[data-abrir-conta]");
    assert.equal(await p.locator('[data-tema="automatico"]').getAttribute("aria-pressed"), "true");
    await p.click('[data-tema="escuro"]');
    await assentar(p, 100);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), "dark");
    assert.notEqual(await fundo(p), claro, "o fundo ficou escuro");
    assert.ok(await p.locator("[data-menu-conta]").isVisible(), "o menu continua aberto");
    assert.equal(await p.locator('[data-tema="escuro"]').getAttribute("aria-pressed"), "true");
    /* recarregar: o tema vem antes do primeiro desenho */
    await p.reload();
    await p.waitForSelector(".lateral");
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), "dark");
    await comConta(p);
    await p.click("[data-abrir-conta]");
    assert.equal(await p.locator('[data-tema="escuro"]').getAttribute("aria-pressed"), "true");
    await p.click('[data-tema="automatico"]');
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme ?? null), null);
    assert.equal(await fundo(p), claro);
    assert.equal(await p.evaluate(() => localStorage.getItem("sextante.tema")), "automatico");
    assert.deepEqual(p.erros, []);
  });

  test("com o sistema escuro, Claro força o tema claro", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 760, tema: "dark" });
    const escuro = await fundo(p);
    await comConta(p);
    await p.click("[data-abrir-conta]");
    await p.click('[data-tema="claro"]');
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), "light");
    assert.notEqual(await fundo(p), escuro);
    assert.deepEqual(p.erros, []);
  });

  describe("cada aplicativo com a sua escolha (30/10/2026)", () => {
    const STRATA = { caminho: "strata/", aguardar: ".mapa-svg .mapa-no" };
    const cor = (p) => p.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content));

    test("sem escolha guardada, o Sextante abre claro e o Strata escuro, mesmo com o sistema no outro tema", async () => {
      const sextante = await sessao.abrir({ largura: 1280, altura: 760, tema: "dark", temaGuardado: null });
      assert.equal(await sextante.evaluate(() => document.documentElement.dataset.theme), "light");
      assert.deepEqual(await cor(sextante), ["#F5F3EF", "#F5F3EF"], "a barra do navegador acompanha");
      const strata = await sessao.abrir({ largura: 1280, altura: 760, tema: "light", temaGuardado: null, ...STRATA });
      assert.equal(await strata.evaluate(() => document.documentElement.dataset.theme), "dark");
      assert.deepEqual(await cor(strata), ["#0E1424", "#0E1424"]);
      assert.equal(await strata.locator('[data-tema="escuro"]').getAttribute("aria-pressed"), "true", "o menu mostra Noite");
      assert.deepEqual([...sextante.erros, ...strata.erros], []);
    });

    test("escolher no Strata não muda o Sextante, e vice-versa", async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 760, temaGuardado: null, ...STRATA });
      await p.evaluate(async () => { const { escolherTema } = await import("../js/tema.js"); escolherTema("claro"); });
      assert.equal(await p.evaluate(() => localStorage.getItem("strata.tema")), "claro");
      assert.equal(await p.evaluate(() => localStorage.getItem("sextante.tema")), null, "a escolha do Sextante não foi tocada");
      await p.goto(p.url().replace("strata/", "sextante/"));
      await p.waitForSelector("[data-acao=exemplo]");
      assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), "light", "o Sextante segue no padrão");
      await p.evaluate(async () => { const { escolherTema } = await import("../js/tema.js"); escolherTema("escuro"); });
      await p.goto(p.url().replace("sextante/", "strata/"));
      await p.waitForSelector(".mapa-svg .mapa-no");
      assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), "light", "o Strata guardou o Dia");
      assert.equal(await p.evaluate(() => localStorage.getItem("sextante.tema")), "escuro");
      assert.deepEqual(p.erros, []);
    });
  });
});
