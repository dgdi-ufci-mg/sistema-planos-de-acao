/**
 * Rede como prancheta (13/11/2026, pedido do responsável; documentação técnica, seção 8.4): o plano pode ser concebido
 * pela Rede. No plano vazio, o início e o término aparecem ligados, com um "+" que cria a primeira ação; o círculo de
 * início tem o seu "+"; e as linhas do início e do término também têm o "+" de inserir.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, irParaVisualizacao } from "./apoio.mjs";

describe("Rede: prancheta do plano", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  /** cria um projeto vazio (sem fases) e abre a Rede */
  const planoVazio = async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 860, exemplo: false });
    await p.click("[data-acao=criar]");
    await assentar(p);
    await p.fill("[name=nome]", "Plano novo");
    await p.check("[name=tipo][value=projeto]");
    await p.check("[name=modelo][value=estruturado]");
    await p.click("form button[type=submit]");
    await p.waitForSelector(".aba-visao[data-modo=rede], .aba-mais");
    await irParaVisualizacao(p, "rede");
    await p.waitForSelector("[data-prancheta-mais]");
    return p;
  };
  const digitarNome = async (p, nome) => {
    await p.waitForSelector(".rede [data-editando]");
    await p.keyboard.type(nome);
    await p.keyboard.press("Enter");
    await assentar(p, 600);
    await p.keyboard.press("Escape"); // a caixinha de prazos fica para depois
    await assentar(p, 500);
  };
  const numeroDe = (p, nome) => p.locator(".rede-no", { hasText: nome }).getAttribute("data-numero").then(Number);

  test("plano vazio: o \"+\" entre o início e o término cria a primeira ação", async () => {
    const p = await planoVazio();
    assert.equal(await p.locator(".rede-prancheta .rede-ponto").count(), 2);
    await p.click("[data-prancheta-mais]");
    await digitarNome(p, "Levantar requisitos");
    assert.equal(await p.locator(".rede-no").count(), 1);
    assert.equal(await p.locator(".rede-prancheta").count(), 0, "a prancheta vazia dá lugar à rede");
    assert.deepEqual(p.erros, []);
  });

  test("o \"+\" do início cria uma ação no começo; o \"+\" das linhas insere antes da primeira e depois da última", async () => {
    const p = await planoVazio();
    await p.click("[data-prancheta-mais]");
    await digitarNome(p, "Levantar requisitos");
    const primeira = await numeroDe(p, "Levantar requisitos");

    await p.hover(".rede-ponto.inicio");
    await assentar(p, 250);
    assert.ok(await p.locator("[data-rede-inicio]").isVisible(), "o + aparece ao passar o mouse no início");
    await p.click("[data-rede-inicio]");
    await digitarNome(p, "Ação paralela");
    const paralela = await numeroDe(p, "Ação paralela");
    assert.equal(await p.locator(`.rede-ligacao[data-de="-1"][data-para="${paralela}"]`).count(), 1, "ligada ao início");
    assert.equal(await p.locator(`.rede-ligacao[data-de="${paralela}"][data-para="-2"]`).count(), 1, "ligada ao término");

    const antes = p.locator(`[data-inserir-de="-1"][data-inserir-para="${primeira}"]`);
    await antes.evaluate((el) => el.classList.add("visivel"));
    await antes.click();
    await digitarNome(p, "Antes de tudo");
    const nova = await numeroDe(p, "Antes de tudo");
    assert.equal(await p.locator(`.rede-seta[data-de="${nova}"][data-para="${primeira}"]`).count(), 1, "a primeira passa a depender da nova");
    assert.equal(await p.locator(`.rede-ligacao[data-de="-1"][data-para="${primeira}"]`).count(), 0);

    const fim = p.locator(`[data-inserir-de="${primeira}"][data-inserir-para="-2"]`);
    await fim.evaluate((el) => el.classList.add("visivel"));
    await fim.click();
    await digitarNome(p, "Fechar o plano");
    const ultima = await numeroDe(p, "Fechar o plano");
    assert.equal(await p.locator(`.rede-seta[data-de="${primeira}"][data-para="${ultima}"]`).count(), 1);
    assert.equal(await p.locator(".rede-no").count(), 4);

    /* Ctrl+Z desfaz o nome e, depois, a criação da última */
    await p.keyboard.press("Control+z");
    await assentar(p, 700);
    await p.keyboard.press("Control+z");
    await assentar(p, 700);
    assert.equal(await p.locator(".rede-no").count(), 3);
    assert.deepEqual(p.erros, []);
  });

  test("com fases, o \"+\" do início pergunta a etapa", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 860 });
    await irParaVisualizacao(p, "rede");
    await p.waitForSelector(".rede-no");
    await assentar(p);
    const antes = await p.locator(".rede-no").count();
    await p.hover(".rede-ponto.inicio");
    await assentar(p, 250);
    await p.click("[data-rede-inicio]");
    await p.waitForSelector(".rede-escolha");
    const opcoes = await p.locator(".rede-escolha [data-escolher-etapa]").allTextContents();
    assert.ok(opcoes.length >= 3 && opcoes.at(-1) === "Sem etapa", "todas as etapas e \"Sem etapa\"");
    await p.locator(".rede-escolha [data-escolher-etapa]").nth(1).click();
    await digitarNome(p, "Nova no começo");
    assert.equal(await p.locator(".rede-no").count(), antes + 1);
    const no = p.locator(".rede-no", { hasText: "Nova no começo" });
    assert.ok((await no.getAttribute("data-etapa")).length > 0, "fica na etapa escolhida");
    assert.deepEqual(p.erros, []);
  });
});
