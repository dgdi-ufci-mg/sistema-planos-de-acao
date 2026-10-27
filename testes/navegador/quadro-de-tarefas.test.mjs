/**
 * Quadro de tarefas no navegador (revisão de 27/10/2026, decisão do responsável; documentação técnica, seção 8,
 * "Quadro de tarefas"): só a visualização Quadro, colunas todas iguais e sem ícones fixos, sem a coluna Concluídas,
 * caixinha de concluída que não move o cartão e filtro para mostrar ou esconder as concluídas.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, dedo, centro } from "./apoio.mjs";

/** Abre o exemplo e vai para o Quadro (ou, com `nome`, outro espaço de exemplo). */
async function abrirQuadro(sessao, opcoes = {}, nome = "tarefas da equipe", espera = ".quadro-tarefas") {
  const p = await sessao.abrir(opcoes);
  const celular = (opcoes.largura ?? 390) <= 640;
  if (celular) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
  await p.locator(".lateral [data-espaco]").filter({ hasText: nome }).click();
  await p.waitForSelector(espera);
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
    assert.equal(await p.locator('.menu-topo[data-pop="indicador"]').count(), 0, "sem o menu Indicador (27/10/2026)");
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

  /* ---------- Lista de tarefas (passo 3.4) ---------- */
  const abrirLista = (opcoes) => abrirQuadro(sessao, opcoes, "minhas tarefas", ".item [data-marcar]");
  const item = (p, nome) => p.locator(".item").filter({ hasText: nome });

  test("Lista de tarefas: só a Lista; a tarefa marcada some na hora e o filtro a mostra de volta", async () => {
    const p = await abrirLista({ largura: 1100 });
    assert.equal(await p.locator('.menu-topo[data-pop="modo"]').count(), 0);
    assert.equal(await item(p, "Atualizar o currículo").count(), 0, "as concluídas começam escondidas");
    await item(p, "Agendar a reunião").locator("[data-marcar]").click();
    await assentar(p);
    assert.equal(await item(p, "Agendar a reunião").count(), 0);
    assert.match(await p.locator(".aviso-curto").innerText(), /concluída/);
    await p.click('.menu-topo[data-pop="classificar"]');
    await p.locator('[data-ctl="concluidas"]').check();
    await assentar(p);
    assert.equal(await item(p, "Agendar a reunião").locator("[data-marcar]").getAttribute("aria-checked"), "true");
    assert.equal(await item(p, "Atualizar o currículo").count(), 1);
    assert.deepEqual(p.erros, []);
  });

  test("Lista de tarefas no celular: deslizar para a direita marca a tarefa", async () => {
    const p = await abrirLista();
    const { x, y } = await centro(item(p, "Responder a pesquisa").locator(".rotulo"));
    const d = await dedo(p);
    await d.arrastar(x - 60, y, 150, 0);
    await assentar(p);
    assert.equal(await item(p, "Responder a pesquisa").count(), 0);
    assert.equal(await p.locator(".camada.aberta").count(), 0, "marca direto, sem abrir janela");
  });

  test("trocar a Lista por Quadro em Configurar este espaço, e de volta", async () => {
    const p = await abrirLista({ largura: 1280 });
    const trocar = async (tipo) => {
      await p.locator(".lateral .espaco-item.atual [data-configurar]").click();
      await assentar(p);
      const painel = p.locator(".camada.aberta");
      /* a configuração grava sozinha, ao mudar a escolha (24/10/2026) */
      await painel.locator(`input[name="tipo"][value="${tipo}"]`).check();
      await p.waitForTimeout(1200);
      await p.keyboard.press("Escape");
      await assentar(p);
    };
    await trocar("quadro");
    await p.waitForSelector(".quadro-tarefas");
    const titulos = await p.locator(".quadro-tarefas .coluna > header").allInnerTexts();
    assert.deepEqual(titulos.map((t) => t.split("\n")[0].trim()), ["A fazer", "Fazendo"]);
    assert.ok(await cartao(p, "Atualizar o currículo").count(), "no quadro, as concluídas ficam à vista");
    await trocar("lista");
    await p.waitForSelector(".item [data-marcar]");
    assert.equal(await p.locator(".quadro-tarefas").count(), 0);
    assert.equal(await item(p, "Atualizar o currículo").count(), 0, "na lista, voltam a ficar escondidas");
    assert.deepEqual(p.erros, []);
  });

  test("colunas como no Trello: largura fixa, rolagem própria e arrastar a coluna para outro lugar", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280, altura: 640 });
    const primeira = await p.locator(".coluna").first().getAttribute("data-coluna");
    for (let i = 1; i <= 9; i++) {
      const campo = p.locator(`[data-rapida="quadro-${primeira}"] input`).first();
      await campo.fill(`Tarefa extra ${i}`);
      await campo.press("Enter");
      await p.waitForTimeout(100);
    }
    await assentar(p);
    const medidas = await p.evaluate(() => {
      const c = document.querySelector(".quadro .coluna");
      const cartoes = c.querySelector(".coluna-cartoes");
      return { largura: c.getBoundingClientRect().width, rola: cartoes.scrollHeight > cartoes.clientHeight + 10,
        cabe: c.getBoundingClientRect().bottom <= innerHeight, cartao: c.querySelector(".cartao-quadro").getBoundingClientRect().height };
    });
    assert.equal(Math.round(medidas.largura), 272);
    assert.ok(medidas.rola, "os cartões rolam dentro da coluna");
    assert.ok(medidas.cabe, "a coluna termina dentro da tela");
    assert.ok(medidas.cartao > 50, "os cartões não são espremidos");
    /* arrastar o título de A fazer para depois de Fazendo */
    const h = await p.locator(".quadro .coluna > header").first().boundingBox();
    await p.mouse.move(h.x + 30, h.y + h.height / 2);
    await p.mouse.down();
    for (let i = 1; i <= 20; i++) { await p.mouse.move(h.x + 30 + i * 18, h.y + h.height / 2 + 4); await p.waitForTimeout(16); }
    assert.equal(await p.locator(".coluna.levantada").count(), 1, "a coluna se levanta enquanto é arrastada");
    await p.mouse.up();
    await assentar(p, 700);
    const titulos = (await p.locator(".quadro .coluna > header").allInnerTexts()).map((t) => t.split("\n")[0].trim());
    assert.deepEqual(titulos, ["Fazendo", "A fazer", "Em revisão"]);
    assert.equal(await p.locator(".camada.aberta, .nome-coluna").count(), 0, "soltar não abre o nome para renomear");
    assert.deepEqual(p.erros, []);
  });
});
