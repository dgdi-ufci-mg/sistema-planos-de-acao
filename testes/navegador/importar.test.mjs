/**
 * Importação de ações (06/11/2026, pedido do responsável; documentação técnica, seção 8.6): enquanto a importação
 * grava, "Configurar este espaço" não fecha por nenhum caminho e mostra o progresso; no fim, o resultado fica no painel.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, camadasAbertas } from "./apoio.mjs";

describe("Importação de ações: painel travado, progresso e fim", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const abrirConfiguracao = async (p) => {
    await p.locator(".lateral .espaco-item.atual [data-configurar]").click();
    await assentar(p);
    return p.locator(".camada.aberta");
  };

  test("travado, o painel não fecha por Esc, pelo fundo nem pelo botão (desativado); solto, fecha", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    const painel = await abrirConfiguracao(p);
    await p.evaluate(async () => {
      const m = await import(new URL("../js/telas/painel.js", location.href).href);
      window.soltarTrava = m.travarPainel("A importação ainda está gravando. Espere terminar para fechar.");
    });
    const fechar = painel.locator(".painel > header [data-fechar]");
    assert.equal(await fechar.isDisabled(), true, "o botão Fechar fica desativado");
    await p.keyboard.press("Escape");
    await assentar(p);
    assert.equal(await camadasAbertas(p), 1, "Esc não fecha");
    await p.mouse.click(5, 400); // o fundo escurecido, fora da janela
    await assentar(p);
    assert.equal(await camadasAbertas(p), 1, "o fundo não fecha");
    assert.match(await p.locator(".aviso-curto").last().textContent(), /Espere terminar para fechar/, "quem tenta fechar recebe o aviso");
    await p.evaluate(() => window.soltarTrava());
    assert.equal(await fechar.isDisabled(), false, "solto, o botão volta");
    await p.keyboard.press("Escape");
    await assentar(p);
    assert.equal(await camadasAbertas(p), 0, "solto, Esc fecha");
    assert.deepEqual(p.erros, []);
  });

  test("importar mostra o progresso e deixa o resultado no painel, que continua aberto", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    const painel = await abrirConfiguracao(p);
    await painel.locator('[data-ir-aba="importar"]').click();
    await assentar(p);
    const linhas = ["Ação\tFase\tEtapa\tChecklist"];
    for (let i = 1; i <= 30; i++) linhas.push(`Ação importada ${i}\tFase nova\tEtapa nova\t"Item A ${i}\nItem B ${i}"`);
    await painel.locator("[data-importar-texto]").fill(linhas.join("\n"));
    await painel.locator("[data-conferir-importacao]").click();
    await painel.locator("[data-importar]").click();
    await painel.locator(".importacao-concluida").waitFor();
    assert.match(await painel.locator(".importacao-concluida").textContent(), /Importação concluída: 30 ações criadas/);
    assert.equal(await camadasAbertas(p), 1, "o painel continua aberto, com o resultado");
    assert.equal(await painel.locator(".painel > header [data-fechar]").isDisabled(), false, "terminada, o painel pode fechar");
    await p.keyboard.press("Escape");
    await assentar(p);
    assert.equal(await camadasAbertas(p), 0);
    /* a etapa criada pela importação sobrevive ao fechar o painel */
    const reaberto = await abrirConfiguracao(p);
    await reaberto.locator('[data-ir-aba="estrutura"]').click();
    await assentar(p);
    assert.ok((await reaberto.locator('[data-secao="estrutura"]').innerHTML()).includes("Etapa nova"), "a etapa nova continua lá");
    assert.deepEqual(p.erros, []);
  });
});
