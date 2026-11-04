/**
 * Código do Plano de Ação (04/11/2026, pedido do responsável; documentação técnica, seção 4.1, campo `codigo` do
 * espaço): o campo aparece com os outros dados do Plano de Ação em "Configurar este espaço", grava sozinho ao sair dele
 * e volta preenchido; no Projeto, some.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Código do Plano de Ação", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const abrirConfiguracao = async (p) => {
    await p.locator(".lateral .espaco-item.atual [data-configurar]").click();
    await assentar(p);
    return p.locator(".camada.aberta");
  };

  test("em Configurar este espaço, o Plano de Ação tem o campo Código, que grava e volta preenchido; no Projeto, o campo some", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    let painel = await abrirConfiguracao(p);
    const campo = painel.locator('[data-tipo-plano] input[name="codigo"]');
    assert.equal(await painel.locator('input[name="tipo"][value="planoDeAcao"]').isChecked(), true, "o exemplo é um Plano de Ação");
    assert.equal(await campo.isVisible(), true, "o Plano de Ação mostra o campo Código");
    await campo.fill("PA-07");
    await campo.press("Tab"); // grava ao sair do campo
    await p.waitForTimeout(1200);
    await p.keyboard.press("Escape");
    await assentar(p);
    painel = await abrirConfiguracao(p);
    assert.equal(await painel.locator('[data-tipo-plano] input[name="codigo"]').inputValue(), "PA-07", "o código ficou gravado");
    await painel.locator('input[name="tipo"][value="projeto"]').check();
    await assentar(p, 700);
    assert.equal(await painel.locator('[data-tipo-plano] input[name="codigo"]').isVisible(), false, "no Projeto, sem o campo");
    assert.deepEqual(p.erros, []);
  });
});
