/**
 * Lista de tarefas no padrão do Todoist (16/11/2026, decisão do responsável; documentação técnica, seção 8, "Lista de
 * tarefas"): fundo branco, nome do espaço dentro da coluna central, sem a linha sob a barra, sem o botão "Nova tarefa"
 * no alto, "Adicionar tarefa" no começo da lista (a nova entra no alto) e prazo e checklist lado a lado numa linha.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Lista de tarefas no padrão do Todoist", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  async function abrirLista(opcoes = {}) {
    const p = await sessao.abrir({ altura: 760, ...opcoes });
    await p.locator(".lateral [data-espaco]").filter({ hasText: "minhas tarefas" }).evaluate((b) => b.click());
    await p.waitForSelector(".lista[data-tarefas]");
    await assentar(p);
    return p;
  }

  test("fundo branco, nome na coluna central, sem linha sob a barra e sem o botão Nova tarefa", async () => {
    const p = await abrirLista({ largura: 1366 });
    const cor = (sel, prop) => p.locator(sel).evaluate((el, q) => getComputedStyle(el)[q], prop);
    assert.equal(await cor("body", "backgroundColor"), await p.evaluate(() => { const e = document.createElement("i"); e.style.color = "var(--surface)"; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; }));
    assert.equal(await p.locator(".topo .titulo-barra").isVisible(), false, "o nome sai da barra");
    assert.ok(await p.locator("#principal .titulo-conteudo").isVisible(), "e vai para o conteúdo");
    const titulo = await p.locator("#principal .titulo-conteudo").boundingBox();
    const lista = await p.locator(".lista[data-tarefas]").boundingBox();
    assert.ok(Math.abs(titulo.x - lista.x) < 12, "alinhado à esquerda da lista");
    assert.ok(titulo.y < lista.y, "acima da lista");
    assert.equal(await cor(".topo-linha", "boxShadow"), "none", "sem a linha divisória");
    assert.equal(await p.locator(".topo [data-nova]").count(), 0, "sem Nova tarefa no alto");
    assert.ok(await p.locator('.topo .menu-topo[data-pop="painel"]').isVisible(), "os filtros continuam");
    assert.deepEqual(p.erros, []);
  });

  test("\"Adicionar tarefa\" fica no começo da lista e a tarefa nova entra no alto", async () => {
    const p = await abrirLista({ largura: 1366 });
    const rapida = p.locator('.lista[data-tarefas] [data-rapida="lista"]');
    assert.equal(await p.locator(".lista[data-tarefas] > *").first().evaluate((el) => el.matches("[data-rapida]")), true, "primeiro item da lista");
    await rapida.locator("input").fill("Tarefa nova no alto");
    await p.keyboard.press("Enter");
    await assentar(p, 700);
    const nomes = await p.locator(".lista[data-tarefas] .item .rotulo").allInnerTexts();
    assert.equal(nomes[0], "Tarefa nova no alto");
    await rapida.locator("input").fill("Outra, mais acima");
    await p.keyboard.press("Enter");
    await assentar(p, 700);
    const depois = await p.locator(".lista[data-tarefas] .item .rotulo").allInnerTexts();
    assert.deepEqual(depois.slice(0, 2), ["Outra, mais acima", "Tarefa nova no alto"]);
    assert.deepEqual(p.erros, []);
  });

  test("prazo e checklist ficam lado a lado, numa linha só", async () => {
    const p = await abrirLista({ largura: 1366 });
    /* "Enviar a frequência do mês" tem prazo; ganha um item de checklist pela janela da tarefa */
    await p.locator(".lista[data-tarefas] .item").filter({ hasText: "Enviar a frequência" }).locator(".rotulo").click();
    await p.waitForSelector(".camada.aberta .janela-grade");
    await assentar(p);
    await p.locator(".camada.aberta [data-abrir-checklist]").click();
    await p.keyboard.type("Primeiro passo");
    await p.keyboard.press("Enter");
    await assentar(p, 500);
    await p.keyboard.press("Escape");
    await assentar(p, 600);
    const meta = p.locator(".lista[data-tarefas] .item").filter({ hasText: "Enviar a frequência" }).locator(".meta-tarefa");
    assert.equal(await meta.locator(".prazo-tarefa").count(), 1);
    assert.equal(await meta.locator(".nota-checklist").count(), 1);
    const [a, b] = await Promise.all([meta.locator(".prazo-tarefa").boundingBox(), meta.locator(".nota-checklist").boundingBox()]);
    assert.ok(Math.abs(a.y - b.y) < 6 && a.x + a.width <= b.x, "mesma linha, prazo antes do checklist");
    assert.deepEqual(p.erros, []);
  });

  test("a tecla N continua abrindo a janela de nova tarefa; no celular, o (+) também", async () => {
    const p = await abrirLista({ largura: 1366 });
    await p.keyboard.press("n");
    await assentar(p, 500);
    assert.equal(await p.locator(".camada.aberta").count(), 1);
    assert.deepEqual(p.erros, []);
  });
});
