/**
 * Tema claro ou escuro escolhido em cada aparelho, no menu da conta (27/10/2026, pedido do responsável;
 * documentação técnica, seção 8.0). A escolha vale depois de recarregar e "Automático" volta a seguir o sistema.
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
    const { mostrarNavegacao } = await import("./js/telas/navegacao.js");
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
    assert.equal(await p.evaluate(() => localStorage.getItem("sextante.tema")), null);
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
});
