/**
 * Prioridade da equipe no navegador (29/10/2026, decisão do responsável; documentação técnica, seção 8,
 * "Prioridade da equipe"): campo ligado por padrão, tipos de tarefas abrindo por prioridade, e o puxador também no
 * Quadro, para mudar a posição na coluna ou levar o cartão a outra coluna, com o mouse e com o dedo.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, dedo, centro } from "./apoio.mjs";

async function abrirQuadro(sessao, opcoes = {}) {
  const p = await sessao.abrir(opcoes);
  if ((opcoes.largura ?? 390) <= 640) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
  await p.locator(".lateral [data-espaco]").filter({ hasText: "tarefas da equipe" }).click();
  await p.waitForSelector(".quadro-tarefas");
  await assentar(p);
  return p;
}
const coluna = (p, i) => p.locator(".quadro-tarefas .coluna[data-coluna]").nth(i);
const nomesDe = (p, i) => coluna(p, i).locator(".cartao-quadro .rotulo").allInnerTexts();
const cartaoDe = (p, i, n) => coluna(p, i).locator(".cartao-quadro").nth(n);

/** Arrasta o puxador de um cartão com o mouse, até a borda de cima ou de baixo de um cartão de destino. */
async function arrastarComMouse(p, puxador, destino, lado) {
  const a = await centro(puxador);
  const b = await destino.boundingBox();
  const y = lado === "antes" ? b.y + 3 : b.y + b.height - 3;
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(a.x + 3, a.y + 3, { steps: 2 });
  await p.mouse.move(b.x + b.width / 2, y, { steps: 14 });
  await p.mouse.up();
  await assentar(p, 700);
}

describe("Prioridade da equipe no Quadro", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("ligada por padrão: o Quadro de tarefas abre por prioridade e cada cartão tem o puxador", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    const cartoes = await p.locator(".quadro-tarefas .cartao-quadro").count();
    assert.ok(cartoes > 3);
    assert.equal(await p.locator(".quadro-tarefas .cartao-quadro .puxador").count(), cartoes);
    /* a ordem inicial dos tipos de tarefas não conta como ordem escolhida */
    assert.equal(await p.locator(".menu-topo[data-pop='classificar'] .ponto-menu").count(), 0);
    await p.click('.menu-topo[data-pop="classificar"]');
    assert.equal(await p.locator('[data-ordem="prioridade"][aria-pressed="true"]').count(), 1);
    assert.deepEqual(p.erros, []);
  });

  test("mouse: arrastar para depois do último cartão da mesma coluna muda a posição", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    const antes = await nomesDe(p, 0);
    assert.ok(antes.length >= 2, "o exemplo precisa de dois cartões na primeira coluna");
    await arrastarComMouse(p, cartaoDe(p, 0, 0).locator(".puxador"), cartaoDe(p, 0, antes.length - 1), "depois");
    const depois = await nomesDe(p, 0);
    assert.deepEqual(depois, [...antes.slice(1), antes[0]]);
    assert.deepEqual(p.erros, []);
  });

  test("mouse: arrastar para outra coluna muda a coluna e a posição de uma vez", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    const origem = await nomesDe(p, 0);
    const destino = await nomesDe(p, 1);
    assert.ok(destino.length >= 1);
    const nome = origem[0];
    await arrastarComMouse(p, cartaoDe(p, 0, 0).locator(".puxador"), cartaoDe(p, 1, 0), "antes");
    assert.deepEqual(await nomesDe(p, 0), origem.slice(1));
    assert.deepEqual(await nomesDe(p, 1), [nome, ...destino]);
    /* a posição ficou: depois de redesenhar o espaço, a ordem é a mesma */
    await p.locator(".lateral [data-espaco]").first().click();
    await assentar(p);
    await p.locator(".lateral [data-espaco]").filter({ hasText: "tarefas da equipe" }).click();
    await p.waitForSelector(".quadro-tarefas");
    await assentar(p);
    assert.deepEqual(await nomesDe(p, 1), [nome, ...destino]);
    assert.deepEqual(p.erros, []);
  });

  test("teclado: as setas sobem e descem o cartão dentro da coluna", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    const antes = await nomesDe(p, 0);
    await cartaoDe(p, 0, 0).locator(".puxador").focus();
    await p.keyboard.press("ArrowDown");
    await assentar(p, 700);
    assert.deepEqual(await nomesDe(p, 0), [antes[1], antes[0], ...antes.slice(2)]);
  });

  test("celular: o dedo arrasta o puxador e muda a posição na coluna", async () => {
    const p = await abrirQuadro(sessao, { largura: 390 });
    const antes = await nomesDe(p, 0);
    assert.ok(antes.length >= 2);
    const g = await dedo(p);
    const a = await centro(cartaoDe(p, 0, 0).locator(".puxador"));
    const alvo = await cartaoDe(p, 0, antes.length - 1).boundingBox();
    await g.arrastar(a.x, a.y, 0, alvo.y + alvo.height - 3 - a.y, { passos: 16 });
    await assentar(p, 700);
    assert.deepEqual(await nomesDe(p, 0), [...antes.slice(1), antes[0]]);
    assert.deepEqual(p.erros, []);
  });

  test("Projeto e Plano de Ação: o campo está ligado, mas a ordem inicial continua a do espaço", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    await p.click('.menu-topo[data-pop="classificar"]');
    assert.equal(await p.locator('[data-ordem="prioridade"]').count(), 1, "a opção existe sem ligar nada");
    assert.equal(await p.locator('[data-ordem="espaco"][aria-pressed="true"]').count(), 1);
    assert.equal(await p.locator(".puxador").count(), 0);
    await p.click('[data-ordem="prioridade"]');
    await assentar(p);
    assert.ok(await p.locator(".linha .puxador").count() > 0, "na lista, os puxadores aparecem");
    await p.click('.menu-topo[data-pop="modo"]');
    await p.click('[data-popover] [data-modo="quadro"]');
    await assentar(p);
    assert.ok(await p.locator(".cartao-quadro .puxador").count() > 0, "no quadro, também");
    assert.deepEqual(p.erros, []);
  });
});
