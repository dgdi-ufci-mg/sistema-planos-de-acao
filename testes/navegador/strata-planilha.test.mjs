/**
 * Strata: Planilha (30/10/2026; documentação técnica, seção 8, "Strata", "Planilha"). Abre por cima do Mapa escurecido,
 * edita na célula com o teclado e com listas, marca o que não foi salvo, desfaz, aponta problemas, salva, pergunta antes
 * de fechar com alterações pendentes, filtra, ordena, esconde colunas e, no celular, só consulta.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

const ABRIR = { caminho: "strata/", aguardar: ".mapa-svg:not([data-movendo]) .mapa-no" };
const COMPUTADOR = { largura: 1280, altura: 800 };
async function abrirPlanilha(p) {
  await p.click("[data-alternar-menu]");
  await p.waitForSelector(".strata-menu.aberto");
  await p.click("[data-ver-planilha]");
  await p.waitForSelector(".strata-grade-camada.aberta");
  await assentar(p);
}
const linha = (p, codigo) => p.locator("tr.grade-linha", { has: p.locator(`td.col-codigo:text-is("${codigo}")`) });
const celula = (p, codigo, coluna) => linha(p, codigo).locator(`td[data-coluna="${coluna}"]`);

describe("Strata: Planilha", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("abre pelo menu, por cima do mapa escurecido, numa janela grande com margem; agrupada por camada", async () => {
    const p = await sessao.abrir({ ...COMPUTADOR, ...ABRIR });
    await abrirPlanilha(p);
    const caixa = await p.locator(".strata-grade").boundingBox();
    assert.ok(caixa.x > 10 && caixa.y > 20 && caixa.width > 1100, "quase a tela toda, com margem: o mapa aparece em volta");
    assert.equal(await p.locator(".strata-grade-camada .fundo-escuro").evaluate((e) => getComputedStyle(e).opacity), "1");
    const grupos = await p.locator(".grade-grupo-botao").allInnerTexts();
    assert.ok(grupos[0].startsWith("Missão"), grupos.join("|"));
    assert.equal(await p.locator("tr.grade-linha").count(), 11);
    assert.deepEqual(p.erros, []);
  });

  test("edita pelo teclado: digitar começa a alterar, Enter grava e desce; a célula fica marcada até salvar", async () => {
    const p = await sessao.abrir({ ...COMPUTADOR, ...ABRIR });
    await abrirPlanilha(p);
    await celula(p, "OE1", "nome").click();
    await p.keyboard.type("Governança renovada");
    await p.keyboard.press("Enter");
    assert.equal((await celula(p, "OE1", "nome").innerText()).trim(), "Governança renovada");
    assert.ok(await celula(p, "OE1", "nome").evaluate((e) => e.classList.contains("alterada")));
    assert.equal(await p.locator("td.celula-ativa").getAttribute("data-coluna"), "nome", "desce na mesma coluna");
    assert.match(await p.locator("[data-salvar]").innerText(), /Salvar 1 alteração/);
    await p.keyboard.press("Control+z");
    assert.equal(await p.locator("td.alterada").count(), 0, "Ctrl+Z desfaz");
    await p.keyboard.press("Control+y");
    assert.equal(await p.locator("td.alterada").count(), 1, "Ctrl+Y refaz");
    await p.click("[data-salvar]");
    await p.waitForSelector("[data-salvar][disabled]");
    assert.equal(await p.locator("td.alterada").count(), 0, "salvo: nada pendente");
    assert.equal((await celula(p, "OE1", "nome").innerText()).trim(), "Governança renovada");
    assert.deepEqual(p.erros, []);
  });

  test("Esc cancela a edição da célula; outro Esc fecha; com alteração pendente, pergunta antes", async () => {
    const p = await sessao.abrir({ ...COMPUTADOR, ...ABRIR });
    await abrirPlanilha(p);
    await celula(p, "OE2", "codigo").click();
    await p.keyboard.press("Enter");
    await p.keyboard.type("XYZ");
    await p.keyboard.press("Escape");
    assert.equal((await celula(p, "OE2", "codigo").innerText()).trim(), "OE2", "a edição foi cancelada");
    assert.equal(await p.locator(".strata-grade-camada").count(), 1, "o primeiro Esc não fecha");
    await p.keyboard.type("OE9");
    await p.keyboard.press("Enter");
    await p.keyboard.press("Escape");
    await p.waitForSelector(".grade-confirmar");
    assert.match(await p.locator(".grade-confirmar").innerText(), /1 alteração não salva/);
    await p.click("[data-continuar]");
    assert.equal(await p.locator("td.alterada").count(), 1, "continuar editando mantém a alteração");
    await p.keyboard.press("Escape");
    await p.click("[data-descartar]");
    await assentar(p);
    assert.equal(await p.locator(".strata-grade-camada").count(), 0, "fechou");
    assert.deepEqual(p.erros, []);
  });

  test("instrumento por lista; superiores por várias opções; código repetido fica marcado e segura o Salvar", async () => {
    const p = await sessao.abrir({ ...COMPUTADOR, ...ABRIR });
    await abrirPlanilha(p);
    await celula(p, "PRG3", "instrumento").dblclick();
    await p.selectOption("select[data-editor]", { label: "PDI 2024–2028" });
    assert.equal((await celula(p, "PRG3", "instrumento").innerText()).trim(), "PDI 2024–2028");
    await celula(p, "PRG3", "superiores").dblclick();
    await p.waitForSelector("[data-escolha]:not([hidden]) [data-escolha-lista]");
    await p.locator(".grade-escolha-opcao", { hasText: "PF1" }).click();
    await p.click("[data-escolha-aplicar]");
    assert.match(await celula(p, "PRG3", "superiores").innerText(), /PF1/);
    await celula(p, "PRG2", "codigo").dblclick();
    await p.keyboard.press("Control+a");
    await p.keyboard.type("PRG1");
    await p.keyboard.press("Enter");
    assert.ok(await celula(p, "PRG1", "codigo").first().evaluate((e) => e.classList.contains("com-erro")));
    await p.click("[data-salvar]");
    await p.waitForSelector(".aviso-curto");
    assert.match(await p.locator(".aviso-curto").innerText(), /Corrija/);
    assert.equal(await p.locator("td.alterada").count(), 3, "nada foi gravado");
    assert.deepEqual(p.erros, []);
  });

  test("copiar e colar: o instrumento colado pelo nome", async () => {
    const p = await sessao.abrir({ ...COMPUTADOR, ...ABRIR });
    await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await abrirPlanilha(p);
    await celula(p, "OE1", "instrumento").click();
    await p.keyboard.press("Control+c");
    await celula(p, "POL1", "instrumento").click();
    await p.keyboard.press("Control+v");
    assert.equal((await celula(p, "POL1", "instrumento").innerText()).trim(), "PEI 2021–2030");
    assert.deepEqual(p.erros, []);
  });

  test("filtro, busca, ordem e colunas", async () => {
    const p = await sessao.abrir({ ...COMPUTADOR, ...ABRIR });
    await abrirPlanilha(p);
    await p.fill("[data-grade-busca]", "programa");
    assert.equal(await p.locator("tr.grade-linha").count(), 3);
    await p.fill("[data-grade-busca]", "");
    await p.selectOption("[data-grade-vigencia]", "vigente");
    assert.equal(await p.locator("tr.grade-linha").count(), 11, "no exemplo, tudo vale hoje");
    await p.selectOption("[data-grade-vigencia]", "encerrado");
    assert.equal(await p.locator("tr.grade-linha").count(), 0);
    await p.selectOption("[data-grade-vigencia]", "");
    await p.selectOption("[data-grade-camada]", "objetivoEstrategico");
    assert.equal(await p.locator("tr.grade-linha").count(), 2);
    await p.click('[data-ordenar="codigo"]');
    await p.click('[data-ordenar="codigo"]');
    assert.deepEqual((await p.locator("tr.grade-linha td.col-codigo").allInnerTexts()).map((t) => t.trim()), ["OE2", "OE1"]);
    await p.selectOption("[data-grade-camada]", "");
    await p.click('[data-ordenar="codigo"]');
    await p.click("[data-abrir-colunas]");
    await p.uncheck('[data-coluna-visivel="camada"]');
    assert.equal(await p.locator('th.col-camada').count(), 0);
    assert.ok(await p.locator('[data-coluna-visivel="codigo"]').isDisabled(), "código não se esconde");
    await p.click("[data-colunas-padrao]");
    assert.equal(await p.locator('th.col-camada').count(), 1);
    await p.keyboard.press("Escape");
    assert.equal(await p.locator(".strata-grade-camada").count(), 1, "o Esc fecha só a lista de colunas");
    await p.click('[data-recolher="programa"]');
    assert.equal(await p.locator("tr.grade-linha").count(), 8, "grupo recolhido");
    assert.deepEqual(p.erros, []);
  });

  test("a linha escolhida acende o ponto dela no Mapa, ao fundo", async () => {
    const p = await sessao.abrir({ ...COMPUTADOR, ...ABRIR });
    await abrirPlanilha(p);
    await celula(p, "POL2", "nome").click();
    const aceso = await p.locator(".mapa-no.selecionado .mapa-rotulo, .mapa-no.selecionado").first().getAttribute("data-no");
    const id = await linha(p, "POL2").getAttribute("data-linha");
    assert.equal(aceso, id);
    assert.deepEqual(p.erros, []);
  });

  test("tema escuro: abre sem erro e com as cores do tema", async () => {
    const p = await sessao.abrir({ ...COMPUTADOR, ...ABRIR, tema: "dark" });
    await abrirPlanilha(p);
    const fundo = await p.locator(".strata-grade-rolagem").evaluate((e) => getComputedStyle(e).backgroundColor);
    assert.notEqual(fundo, "rgb(255, 255, 255)");
    assert.deepEqual(p.erros, []);
  });

  test("celular (390 px): a tela toda, só consulta; tocar numa linha abre o painel do item por cima", async () => {
    const p = await sessao.abrir({ largura: 390, altura: 800, ...ABRIR });
    await abrirPlanilha(p);
    const caixa = await p.locator(".strata-grade").boundingBox();
    assert.deepEqual([caixa.x, caixa.width], [0, 390]);
    assert.equal(await p.locator("[data-salvar]").count(), 0, "sem salvar no celular");
    assert.equal(await p.locator("td.editavel").count(), 0);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), "a página não rola para o lado");
    await celula(p, "OE1", "nome").tap();
    await p.waitForSelector(".camada.aberta:not([data-planilha]) .painel");
    assert.match(await p.locator(".camada.aberta:not([data-planilha]) .painel h2").innerText(), /OE1/);
    assert.deepEqual(p.erros, []);
  });
});
