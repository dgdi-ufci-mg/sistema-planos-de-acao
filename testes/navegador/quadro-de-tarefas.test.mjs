/**
 * Quadro de tarefas no navegador (revisão de 27/10/2026, decisão do responsável; documentação técnica, seção 8,
 * "Quadro de tarefas"): só a visualização Quadro, colunas todas iguais e sem ícones fixos, sem a coluna Concluídas,
 * caixinha de concluída que não move o cartão e filtro para mostrar ou esconder as concluídas.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, dedo, centro } from "./apoio.mjs";

/** Abre o exemplo e vai para o Quadro de tarefas de exemplo. */
async function abrirQuadro(sessao, opcoes = {}) {
  const p = await sessao.abrir(opcoes);
  const celular = (opcoes.largura ?? 390) <= 640;
  if (celular) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
  await p.locator(".lateral [data-espaco]").filter({ hasText: "tarefas da equipe" }).click();
  await p.waitForSelector(".quadro-tarefas");
  await assentar(p);
  return p;
}
const cartao = (p, nome) => p.locator(".cartao-quadro").filter({ hasText: nome });
const colunaDe = (p, nome) => cartao(p, nome).evaluate((c) => c.closest(".coluna").dataset.coluna);

describe("Quadro de tarefas no navegador", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("colunas próprias, sem Concluídas, sem ícones fixos e sem o menu de visualizações", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    const titulos = await p.locator(".quadro-tarefas .coluna > header").allInnerTexts();
    assert.deepEqual(titulos.map((t) => t.split("\n")[0].trim()), ["A fazer", "Fazendo", "Em revisão"]);
    assert.equal(await p.locator(".quadro-tarefas .coluna > header svg:not(.menu-coluna svg)").count(), 0);
    assert.equal(await p.locator('.menu-topo[data-pop="modo"]').count(), 0);
    /* todas as colunas têm o menu "⋯", inclusive a primeira */
    assert.equal(await p.locator(".quadro-tarefas [data-menu-coluna]").count(), 3);
    assert.deepEqual(p.erros, []);
  });

  test("marcar a caixinha conclui a tarefa e ela fica na mesma coluna; desmarcar volta", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    const nome = "Responder o ofício";
    const antes = await colunaDe(p, nome);
    await cartao(p, nome).locator("[data-marcar]").click();
    await assentar(p);
    assert.equal(await cartao(p, nome).locator("[data-marcar]").getAttribute("aria-checked"), "true");
    assert.equal(await colunaDe(p, nome), antes);
    assert.equal(await p.locator(".camada.aberta").count(), 0, "a caixinha não abre a tarefa");
    /* concluída, não fica atrasada */
    assert.equal(await p.locator(".chip-atrasadas").count(), 0);
    await cartao(p, nome).locator("[data-marcar]").click();
    await assentar(p);
    assert.equal(await cartao(p, nome).locator("[data-marcar]").getAttribute("aria-checked"), "false");
  });

  test("o filtro esconde e mostra as concluídas", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    assert.equal(await cartao(p, "Publicar o boletim").count(), 1, "por padrão, as concluídas ficam à vista");
    await p.click('.menu-topo[data-pop="classificar"]');
    await p.locator('[data-ctl="concluidas"]').uncheck();
    await assentar(p);
    assert.equal(await cartao(p, "Publicar o boletim").count(), 0);
    await p.locator('[data-ctl="concluidas"]').check();
    await assentar(p);
    assert.equal(await cartao(p, "Publicar o boletim").count(), 1);
  });

  test("na janela da tarefa: Marcar como concluída, sem data, e o momento da marcação", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    await cartao(p, "Marcar reunião").locator(".rotulo").click();
    await assentar(p);
    const janela = p.locator(".camada.aberta");
    assert.equal(await janela.getByRole("button", { name: /Registrar conclusão/ }).count(), 0);
    await janela.getByRole("button", { name: /Marcar como concluída/ }).click();
    await assentar(p);
    assert.match(await janela.innerText(), /Marcada como concluída/);
    assert.equal(await janela.locator('input[type="date"][name="data"]').count(), 0);
  });

  test("celular: segurar o cartão abre o menu com marcar e mover para outra coluna", async () => {
    const p = await abrirQuadro(sessao);
    const { x, y } = await centro(cartao(p, "Marcar reunião").locator(".rotulo"));
    const d = await dedo(p);
    await d.encostar(x, y);
    await p.waitForTimeout(700);
    await assentar(p, 300);
    const menu = p.locator(".camada.aberta .menu-cartao");
    assert.match(await menu.innerText(), /Marcar como concluída/);
    assert.match(await menu.innerText(), /Mover para[\s\S]*Fazendo/);
    await d.cancelar();
    await menu.getByRole("button", { name: "Fazendo" }).click();
    await assentar(p);
    assert.equal(await colunaDe(p, "Marcar reunião"), await p.locator(".coluna").filter({ has: p.locator("header", { hasText: "Fazendo" }) }).getAttribute("data-coluna"));
    assert.deepEqual(p.erros, []);
  });
});
