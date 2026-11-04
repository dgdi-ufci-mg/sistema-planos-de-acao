/**
 * Janela da tarefa (revisão de 04/11/2026, pedido do responsável, tomando o Todoist como referência; documentação técnica,
 * seção 8, "Ação"): a data-limite aparece uma vez só; sem atividade, uma coluna só, com o histórico no fim; ajuda no "?", e não em frases fixas; descrição com cara de texto, e não de caixa.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

/** Abre o exemplo "minhas tarefas" e a tarefa `nome`. */
async function abrirTarefa(sessao, nome, opcoes = {}, espaco = "minhas tarefas", linha = ".item") {
  const p = await sessao.abrir(opcoes);
  if ((opcoes.largura ?? 390) <= 640) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
  await p.locator(".lateral [data-espaco]").filter({ hasText: espaco }).click();
  await p.waitForSelector(`${linha} [data-marcar]`);
  await assentar(p);
  await p.locator(linha).filter({ hasText: nome }).locator(".rotulo").first().click();
  await p.waitForSelector(".camada.aberta .janela-grade");
  await assentar(p);
  return p;
}
const janela = (p) => p.locator(".camada.aberta .painel");

describe("Janela da tarefa no navegador", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("a data-limite aparece só no campo, e vencida fica em vermelho nele", async () => {
    const p = await abrirTarefa(sessao, "Enviar a frequência", { largura: 1280 });
    const j = janela(p);
    assert.doesNotMatch(await j.locator(".janela-resumo").innerText(), /Data-limite/);
    assert.equal(await j.locator('[data-campo="dataLimite"] input[type="date"]').count(), 1);
    assert.equal(await j.locator('[data-campo="dataLimite"]').evaluate((el) => el.classList.contains("atrasada")), true);
    assert.deepEqual(p.erros, []);
  });

  for (const largura of [1280, 390]) {
    test(`sem comentários nem estimativas: uma coluna, sem abas, com o histórico no fim (${largura} px)`, async () => {
      const p = await abrirTarefa(sessao, "Ler o relatório", { largura });
      const j = janela(p);
      assert.equal(await j.locator(".janela-grade.uma-coluna").count(), 1);
      assert.equal(await j.locator(".janela-abas").count(), 0);
      assert.equal(await j.locator(".janela-atividade").count(), 0);
      assert.equal(await j.locator(".janela-principal [data-historico]").count(), 1);
      if (largura > 640) assert.ok((await j.boundingBox()).width <= 760, "janela mais estreita");
      assert.deepEqual(p.erros, []);
    });
  }

  test("no plano com estimativas, as duas colunas continuam", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    await p.locator(".linha[data-abrir-acao]").first().click();
    await p.waitForSelector(".camada.aberta .janela-grade");
    await assentar(p);
    assert.equal(await janela(p).locator(".janela-grade.uma-coluna").count(), 0);
    assert.equal(await janela(p).locator(".janela-atividade [data-historico]").count(), 1);
    assert.deepEqual(p.erros, []);
  });

  test("a ajuda da data-limite fica no \"?\", que abre o glossário, e não numa frase fixa", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    const campo = janela(p).locator('[data-campo="dataLimite"]');
    assert.equal(await campo.locator(".tec").count(), 0);
    await campo.locator('[data-termo="dataLimite"]').click();
    await assentar(p);
    assert.match(await p.locator(".camada.aberta").last().innerText(), /Data-limite/);
    assert.deepEqual(p.erros, []);
  });

  test("a descrição parece texto: sem borda nem alça, até passar o mouse ou editar", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    const caixa = janela(p).locator('[data-campo="descricao"] textarea');
    const estilo = () => caixa.evaluate((el) => { const c = getComputedStyle(el); return { borda: c.borderTopColor, fundo: c.backgroundColor, alca: c.resize }; });
    const parada = await estilo();
    assert.equal(parada.alca, "none");
    assert.equal(parada.fundo, "rgba(0, 0, 0, 0)");
    await caixa.click();
    await assentar(p, 300);
    assert.notEqual((await estilo()).fundo, "rgba(0, 0, 0, 0)", "ao editar, ganha fundo");
    assert.deepEqual(p.erros, []);
  });
});
