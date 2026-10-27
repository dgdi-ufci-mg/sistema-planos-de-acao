/**
 * Planilha no navegador (27/10/2026, pedido do responsável; documentação técnica, seção 8.3): classificar e filtrar
 * nas colunas, como no Excel, e escolha de vários itens em Responsáveis, como no Google Planilhas.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Planilha: classificar, filtrar e escolher vários", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  async function abrirPlanilha() {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="planilha"]').first().click();
    await p.waitForSelector(".planilha");
    return p;
  }
  const linhas = (p) => p.locator(".planilha tbody tr:not(.linha-nova)");
  const filtroDa = (p, titulo) => p.locator(".planilha th").filter({ hasText: titulo }).locator("[data-filtro-col]");

  test("filtrar Responsáveis por uma pessoa mostra só as ações dela; limpar volta tudo", async () => {
    const p = await abrirPlanilha();
    const total = await linhas(p).count();
    await filtroDa(p, "Responsáveis").click();
    const itens = await p.locator(".caixa-planilha .caixa-item:not(.caixa-todos) span").allInnerTexts();
    assert.ok(itens.includes("ANA") && !itens.some((t) => t.includes(";")), "cada responsável aparece sozinho na lista");
    await p.locator(".caixa-planilha [data-todos]").uncheck();
    await p.locator(".caixa-planilha .caixa-item").filter({ hasText: /^ANA$/ }).locator("input").check();
    await p.click("[data-aplicar-filtro]");
    await assentar(p, 200);
    const visiveis = await linhas(p).locator('[data-chave="responsaveis"]').evaluateAll((els) => els.map((e) => e.value));
    assert.ok(visiveis.length > 0 && visiveis.length < total && visiveis.every((v) => v.split("; ").includes("ANA")));
    assert.match(await p.locator(".planilha-filtrada").innerText(), /escondidas? pelos filtros/);
    await p.click("[data-limpar-tudo]");
    await assentar(p, 200);
    assert.equal(await linhas(p).count(), total);
  });

  test("classificar a coluna da ação de Z a A", async () => {
    const p = await abrirPlanilha();
    await filtroDa(p, "Ação").first().click();
    await p.click('[data-ordenar="-1"]');
    await assentar(p, 200);
    const nomes = await linhas(p).locator('[data-chave="rotulo"]').evaluateAll((els) => els.map((e) => e.value));
    const esperado = [...nomes].sort((a, b) => b.localeCompare(a, "pt-BR"));
    assert.deepEqual(nomes, esperado);
  });

  test("escolher mais um responsável pela lista grava na hora", async () => {
    const p = await abrirPlanilha();
    const linha = linhas(p).nth(2);
    const antes = (await linha.locator('[data-chave="responsaveis"]').inputValue()).split("; ").filter(Boolean);
    await linha.locator('[data-chave="responsaveis"]').focus();
    await p.keyboard.press("Alt+ArrowDown");
    await assentar(p, 200);
    await p.locator(".caixa-planilha .caixa-lista input:not(:checked)").first().check();
    await assentar(p, 500);
    const depois = (await linhas(p).nth(2).locator('[data-chave="responsaveis"]').inputValue()).split("; ").filter(Boolean);
    assert.equal(depois.length, antes.length + 1);
    assert.deepEqual(p.erros, []);
  });
});
