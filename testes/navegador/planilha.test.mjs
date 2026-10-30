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
  const linhas = (p) => p.locator(".planilha tbody tr[data-numero]");
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

  test("classificar a coluna da ação de Z a A (sem agrupar)", async () => {
    const p = await abrirPlanilha();
    await p.click("[data-agrupar-planilha]");
    await filtroDa(p, "Ação").first().click();
    await p.click('[data-ordenar="-1"]');
    await assentar(p, 200);
    const nomes = await linhas(p).locator('[data-chave="rotulo"]').evaluateAll((els) => els.map((e) => e.value));
    const esperado = [...nomes].sort((a, b) => b.localeCompare(a, "pt-BR"));
    assert.deepEqual(nomes, esperado);
  });

  test("agrupada por fase e etapa: a classificação vale dentro de cada etapa; o grupo se recolhe", async () => {
    const p = await abrirPlanilha();
    const total = await linhas(p).count();
    assert.ok(await p.locator(".planilha-grupo.nivel-fase").count() >= 2);
    await filtroDa(p, "Ação").first().click();
    await p.click('[data-ordenar="1"]');
    await assentar(p, 200);
    const porEtapa = await p.evaluate(() => {
      const grupos = [];
      for (const tr of document.querySelectorAll(".planilha tbody tr")) {
        if (tr.matches(".nivel-etapa")) grupos.push([]);
        else if (tr.dataset.numero) grupos.at(-1).push(tr.querySelector('[data-chave="rotulo"]').value);
      }
      return grupos;
    });
    for (const g of porEtapa) assert.deepEqual(g, [...g].sort((a, b) => a.localeCompare(b, "pt-BR")));
    const primeiraFase = p.locator(".planilha-grupo.nivel-fase [data-recolher-grupo]").first();
    await primeiraFase.click();
    assert.equal(await primeiraFase.getAttribute("aria-expanded"), "false");
    assert.ok(await linhas(p).count() < total);
    await p.locator(".planilha-grupo.nivel-fase [data-recolher-grupo]").first().click();
    assert.equal(await linhas(p).count(), total);
    assert.deepEqual(p.erros, []);
  });

  test("busca na barra, sem acentos; Limpar volta tudo", async () => {
    const p = await abrirPlanilha();
    const total = await linhas(p).count();
    await p.fill("[data-busca-planilha]", "SERVIDORES");
    assert.equal(await linhas(p).count(), 1);
    assert.equal(await p.locator("[data-busca-planilha]").evaluate((e) => e === document.activeElement), true, "a busca continua com o cursor");
    await p.click("[data-limpar-tudo]");
    assert.equal(await linhas(p).count(), total);
  });

  test("alterar e desfazer: Ctrl+Z regrava o valor anterior; Refazer volta a alteração", async () => {
    const p = await abrirPlanilha();
    const celula = () => linhas(p).first().locator('[data-chave="rotulo"]');
    const antes = await celula().inputValue();
    await celula().fill("Nome novo");
    await p.keyboard.press("Enter");
    await assentar(p, 400);
    assert.equal(await celula().inputValue(), "Nome novo");
    assert.equal(await p.locator("[data-desfazer-planilha]").isDisabled(), false);
    await celula().focus();
    await p.keyboard.press("Control+z");
    await assentar(p, 500);
    assert.equal(await celula().inputValue(), antes);
    await p.click("[data-refazer-planilha]");
    await assentar(p, 500);
    assert.equal(await celula().inputValue(), "Nome novo");
    assert.deepEqual(p.erros, []);
  });

  test("célula que não pôde ser gravada fica marcada, com o motivo, mesmo depois de redesenhar", async () => {
    const p = await abrirPlanilha();
    const celula = linhas(p).nth(1).locator('[data-chave="dependeDe"]');
    await celula.fill("999");
    await p.keyboard.press("Enter");
    await assentar(p, 400);
    const td = linhas(p).nth(1).locator('td:has([data-chave="dependeDe"])');
    assert.ok(await td.evaluate((e) => e.classList.contains("com-erro")));
    assert.match(await td.getAttribute("title"), /999/);
    await p.click("[data-agrupar-planilha]"); // redesenha
    await p.click("[data-agrupar-planilha]");
    assert.equal(await p.locator("td.com-erro").count(), 1);
  });

  test("Colunas: esconder e mudar a ordem; as fixas ficam na frente; Voltar ao padrão", async () => {
    const p = await abrirPlanilha();
    const titulos = () => p.locator(".planilha thead .titulo-coluna-planilha").allInnerTexts();
    const antes = await titulos();
    await p.click("[data-colunas-planilha]");
    await p.uncheck('[data-coluna-visivel="descricao"]');
    assert.ok(!(await titulos()).includes("Descrição"));
    await p.click('[data-mover-coluna="responsaveis"][data-sentido="-1"]');
    const depois = await titulos();
    assert.ok(depois.indexOf("Responsáveis") < depois.indexOf("Depende de"));
    assert.deepEqual(depois.slice(0, 2), antes.slice(0, 2), "número e ação continuam na frente");
    await p.click("[data-colunas-padrao]");
    assert.deepEqual(await titulos(), antes);
    assert.deepEqual(p.erros, []);
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
