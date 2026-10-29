/**
 * Data-limite na janela da tarefa (29/10/2026, pedido do responsável): digitar a data por partes (dia, mês, ano)
 * não grava a cada parte; a gravação acontece só ao sair do campo (ou com Enter), com a data inteira.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

async function abrirTarefa(sessao, nome) {
  const p = await sessao.abrir({ largura: 1280 });
  await p.locator(".lateral [data-espaco]").filter({ hasText: "tarefas da equipe" }).click();
  await p.waitForSelector(".quadro-tarefas");
  await assentar(p);
  await p.locator(".cartao-quadro").filter({ hasText: nome }).locator(".rotulo").click();
  await assentar(p);
  return p;
}

describe("Data-limite na janela da tarefa", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("digitar dia, mês e ano grava uma vez só, ao sair do campo", async () => {
    const p = await abrirTarefa(sessao, "Responder o ofício");
    const janela = p.locator(".camada.aberta");
    const campo = () => janela.locator('input[type="date"][name="dataLimite"]');
    /* clica no começo do campo, onde fica o dia (dd/mm/aaaa) */
    await campo().click({ position: { x: 8, y: 10 } });
    /* 12/12/2026: dá a mesma data na ordem dia/mês e na ordem mês/dia (o Chromium de teste pode usar qualquer uma) */
    await p.keyboard.type("12", { delay: 80 });
    await p.waitForTimeout(600);
    /* o foco continua no mesmo campo, e nada foi gravado ainda */
    assert.equal(await p.evaluate(() => document.activeElement?.getAttribute("name")), "dataLimite");
    assert.equal(await janela.locator('[data-status="dataLimite"]').innerText(), "", "nada foi gravado no meio da digitação");
    await p.keyboard.type("122026", { delay: 80 });
    await p.waitForTimeout(600);
    assert.equal(await campo().inputValue(), "2026-12-12", "a data inteira foi digitada sem o campo voltar ao dia");
    /* Tab só anda entre dia, mês e ano; sair do campo é clicar fora dele */
    await janela.locator("h2, .janela-nome").first().click();
    await assentar(p);
    assert.equal(await campo().inputValue(), "2026-12-12");
    assert.match(await janela.locator('[data-status="dataLimite"]').innerText(), /Salvo/);
    /* a gravação chegou ao banco: reaberta, a janela mostra a data nova */
    await p.keyboard.press("Escape");
    await assentar(p);
    await p.locator(".cartao-quadro").filter({ hasText: "Responder o ofício" }).locator(".rotulo").click();
    await assentar(p);
    assert.equal(await p.locator('.camada.aberta input[type="date"][name="dataLimite"]').inputValue(), "2026-12-12");
    assert.deepEqual(p.erros, []);
  });

  test("Enter grava a data digitada", async () => {
    const p = await abrirTarefa(sessao, "Revisar a consulta");
    const janela = p.locator(".camada.aberta");
    const campo = janela.locator('input[type="date"][name="dataLimite"]');
    await campo.click({ position: { x: 8, y: 10 } });
    await p.keyboard.type("12122026", { delay: 60 });
    await p.keyboard.press("Enter");
    await assentar(p);
    assert.match(await janela.locator('[data-status="dataLimite"]').innerText(), /Salvo/);
    assert.equal(await campo.inputValue(), "2026-12-12");
    assert.equal(await p.locator(".camada.aberta").count(), 1, "Enter não fecha a janela");
    /* depois de gravar, o campo já conhece o valor novo: sair dele não grava de novo */
    assert.equal(await campo.getAttribute("data-original"), "2026-12-12");
  });

  test("fechar a janela com a data digitada grava antes de fechar", async () => {
    const p = await abrirTarefa(sessao, "Atualizar o dicionário");
    const campo = p.locator('.camada.aberta input[type="date"][name="dataLimite"]');
    await campo.click({ position: { x: 8, y: 10 } });
    await p.keyboard.type("12122026", { delay: 60 });
    /* fecha sem tirar o foco do campo (como o Voltar do celular): clique por script no botão de fechar */
    await p.locator(".camada.aberta .painel header [data-fechar]").evaluate((b) => b.click());
    await assentar(p);
    assert.equal(await p.locator(".camada.aberta").count(), 0);
    await p.locator(".cartao-quadro").filter({ hasText: "Atualizar o dicionário" }).locator(".rotulo").click();
    await assentar(p);
    assert.equal(await p.locator('.camada.aberta input[type="date"][name="dataLimite"]').inputValue(), "2026-12-12");
    assert.deepEqual(p.erros, []);
  });
});
