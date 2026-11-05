/**
 * Campos personalizados (passo 3.6; documentação técnica, seções 4.1.14 e 8, "Campos personalizados"): o administrador
 * cria os campos em "Configurar este espaço"; na janela da ação, os vazios ficam em "Mais campos" e, preenchidos, gravam
 * ao sair do campo ou ao escolher, com o histórico pelo nome do campo.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Campos personalizados no navegador", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  /** Abre "Configurar este espaço" na seção dos campos personalizados. */
  async function abrirSecao(p, largura) {
    if (largura <= 640) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
    await p.locator(".lateral .espaco-item.atual [data-configurar]").click();
    await assentar(p);
    await p.click('[data-ir-aba="personalizados"]');
    await assentar(p);
    return p.locator('.camada.aberta [data-secao="personalizados"]');
  }
  async function criar(p, secao, nome, tipo = "texto") {
    const form = secao.locator("[data-novo-campo]");
    await form.locator("input[name=nome]").fill(nome);
    await form.locator("select[name=tipo]").selectOption(tipo);
    await form.locator("button[type=submit]").click();
    await p.waitForTimeout(500);
  }

  for (const largura of [1280, 390]) {
    test(`cria campos, preenche na janela da ação e registra no histórico (${largura} px)`, async () => {
      const p = await sessao.abrir({ largura });
      const secao = await abrirSecao(p, largura);
      await criar(p, secao, "Nº do processo SEI");
      await criar(p, secao, "Unidade demandante", "opcao");
      for (const o of ["DGDI", "PROGRAD"]) {
        const nova = secao.locator("[data-nova-opcao]").last();
        await nova.fill(o);
        await nova.press("Enter");
        await p.waitForTimeout(400);
      }
      await criar(p, secao, "Situação");
      assert.equal(await secao.locator(".lista-campos > li").count(), 2, "nome de campo do sistema é recusado");
      assert.deepEqual(await secao.locator(".opcao-campo input").evaluateAll((els) => els.map((e) => e.value)), ["DGDI", "PROGRAD"]);
      const larguraDaPagina = await p.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(larguraDaPagina <= largura, "sem rolagem lateral");
      await p.keyboard.press("Escape");
      await assentar(p);

      await p.locator(".linha[data-abrir-acao]").first().click();
      await p.waitForSelector(".camada.aberta .janela-grade");
      await assentar(p);
      const j = p.locator(".camada.aberta .painel");
      /* os campos ficam na coluna de atributos, cada um com a sua janelinha (05/11/2026) */
      const linhas = j.locator('.janela-lado [data-atributo^="cp-"]');
      assert.deepEqual((await linhas.allInnerTexts()).map((t) => t.trim().split("\n")[0]), largura <= 640
        ? ["Adicionar Nº do processo SEI", "Unidade demandante"] : ["Nº do processo SEI", "Unidade demandante"]);
      await linhas.first().click();
      await assentar(p);
      const sei = j.locator("[data-popover] .popover-entrada");
      await sei.fill("23062.004512/2026-10");
      await sei.press("Enter");
      await p.waitForTimeout(600);
      assert.equal(await j.locator("[data-popover]").count(), 0, "Enter grava e fecha");
      await linhas.nth(1).click();
      await assentar(p);
      await j.locator("[data-popover] [data-escolher]").filter({ hasText: "PROGRAD" }).click();
      await p.waitForTimeout(600);

      await p.keyboard.press("Escape");
      await assentar(p);
      await p.locator(".linha[data-abrir-acao]").first().click();
      await p.waitForSelector(".camada.aberta .janela-grade");
      await assentar(p);
      assert.match(await linhas.first().innerText(), /23062\.004512\/2026-10/, "o valor ficou gravado");
      assert.match(await linhas.nth(1).innerText(), /PROGRAD/);
      await j.locator("header [data-menu-janela]").click();
      await j.locator("[data-ver-historico]").click();
      await p.waitForTimeout(600);
      const historico = j.locator("[data-historico]");
      assert.match(await historico.innerText(), /Mudou “Unidade demandante” para “PROGRAD”/);
      assert.deepEqual(p.erros, []);
    });
  }

  test("número com vírgula, recusa de texto no número e link que abre em outra aba", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    const secao = await abrirSecao(p, 1280);
    await criar(p, secao, "Valor", "numero");
    await criar(p, secao, "Branch", "link");
    await p.keyboard.press("Escape");
    await assentar(p);
    await p.locator(".linha[data-abrir-acao]").nth(1).click();
    await p.waitForSelector(".camada.aberta .janela-grade");
    await assentar(p);
    const j = p.locator(".camada.aberta .painel");
    const linha = (nome) => j.locator('.janela-lado [data-atributo^="cp-"]').filter({ hasText: nome });
    await linha("Valor").click();
    await assentar(p);
    const valor = j.locator('[data-popover] input[inputmode="decimal"]');
    await valor.fill("muito");
    await valor.press("Enter");
    await p.waitForTimeout(500);
    assert.match(await linha("Valor").locator(".status-campo.erro").innerText(), /informe um número/);
    assert.equal(await j.locator("[data-popover]").count(), 1, "com erro, a janelinha fica aberta");
    await valor.fill("1250,5");
    await valor.press("Enter");
    await p.waitForTimeout(600);
    assert.match(await linha("Valor").innerText(), /1\.250,5/, "mostrado no formato brasileiro");
    await linha("Branch").click();
    await assentar(p);
    const link = j.locator('[data-popover] input[type="url"]');
    await link.fill("https://github.com/dgdi-ufci-mg/sistema-planos-de-acao/tree/campos");
    await link.press("Enter");
    await p.waitForTimeout(600);
    await linha("Branch").click();
    await assentar(p);
    const abrir = j.locator("[data-popover] .abrir-link");
    assert.equal(await abrir.getAttribute("target"), "_blank");
    assert.equal(await abrir.getAttribute("href"), "https://github.com/dgdi-ufci-mg/sistema-planos-de-acao/tree/campos");
    assert.deepEqual(p.erros, []);
  });
});
