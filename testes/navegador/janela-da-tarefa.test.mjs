/**
 * Janela da tarefa (revisão de 04/11/2026, pedido do responsável, tomando o Todoist como referência; documentação técnica,
 * seção 8, "Ação"): a data-limite aparece uma vez só.
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
});
