/**
 * Prioridade da equipe no navegador (29/10/2026, decisão do responsável; documentação técnica, seção 8,
 * "Prioridade da equipe"): campo ligado por padrão, tipos de tarefas abrindo por prioridade. Na lista, arrasta-se
 * pelo puxador; no Quadro não há puxador: o cartão inteiro se arrasta (mouse ao mexer, dedo depois de segurar),
 * dentro da coluna ou para outra, com uma vaga no lugar do cartão, como no Trello.
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

/** Arrasta um cartão (ou o puxador dele) com o mouse, até a borda de cima ou de baixo de um cartão de destino. */
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

  test("ligada por padrão: o Quadro de tarefas abre por prioridade e o cartão não tem puxador", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    const cartoes = await p.locator(".quadro-tarefas .cartao-quadro").count();
    assert.ok(cartoes > 3);
    assert.equal(await p.locator(".quadro-tarefas .puxador").count(), 0);
    assert.equal(await p.locator(".quadro-tarefas .cartao-quadro[data-arrasta]").count(), cartoes);
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
    await arrastarComMouse(p, cartaoDe(p, 0, 0).locator(".rotulo"), cartaoDe(p, 0, antes.length - 1), "depois");
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
    await arrastarComMouse(p, cartaoDe(p, 0, 0).locator(".rotulo"), cartaoDe(p, 1, 0), "antes");
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

  test("durante o arrasto há vaga no lugar do cartão e o cartão acompanha o ponteiro", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    const c = cartaoDe(p, 0, 0);
    const a = await centro(c.locator(".rotulo"));
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
    await p.mouse.move(a.x + 30, a.y + 60, { steps: 5 });
    await assentar(p, 300);
    assert.equal(await p.locator(".espaco-solto").count(), 1);
    assert.equal(await p.locator(".item.levantado").count(), 1);
    const r = await p.locator(".item.levantado").boundingBox();
    assert.ok(Math.abs(r.x + 30 - (a.r.x + 30)) < 400 && Math.abs((r.y + r.height / 2) - (a.y + 60)) < 80, "o cartão está sob o ponteiro");
    await p.mouse.up();
    await assentar(p, 600);
    assert.equal(await p.locator(".espaco-solto").count(), 0);
    assert.equal(await p.locator(".item.levantado").count(), 0);
    assert.deepEqual(p.erros, []);
  });

  test("clicar no cartão do quadro, sem arrastar, continua abrindo a ação", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    await cartaoDe(p, 0, 0).locator(".rotulo").click();
    await assentar(p);
    assert.ok(await p.locator(".camada.aberta").count() > 0);
  });

  test("celular: segurar o cartão e arrastar muda a posição na coluna; rolar sem segurar não move nada", async () => {
    const p = await abrirQuadro(sessao, { largura: 390 });
    const antes = await nomesDe(p, 0);
    assert.ok(antes.length >= 2);
    const g = await dedo(p);
    const a = await centro(cartaoDe(p, 0, 0).locator(".rotulo"));
    const alvo = await cartaoDe(p, 0, antes.length - 1).boundingBox();
    await g.arrastar(a.x, a.y, 0, alvo.y + alvo.height - 3 - a.y, { passos: 16, pausaInicial: 520 });
    await assentar(p, 700);
    assert.deepEqual(await nomesDe(p, 0), [...antes.slice(1), antes[0]]);
    /* sem segurar: é rolagem, a ordem não muda */
    const b = await centro(cartaoDe(p, 0, 0).locator(".rotulo"));
    await g.arrastar(b.x, b.y, 0, 60, { passos: 8 });
    await assentar(p, 500);
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
    assert.equal(await p.locator(".cartao-quadro .puxador").count(), 0, "no quadro não há puxador");
    assert.ok(await p.locator(".cartao-quadro[data-arrasta]").count() > 0, "mas os cartões se arrastam");
    assert.deepEqual(p.erros, []);
  });

  test("lista: arrastar pelo puxador muda a ordem; as setas também", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    await p.click('.menu-topo[data-pop="classificar"]');
    await p.click('[data-ordem="prioridade"]');
    await assentar(p);
    const nomes = () => p.locator(".lista .item .rotulo").allInnerTexts();
    const antes = await nomes();
    const a = await centro(p.locator(".lista .item").nth(0).locator(".puxador"));
    /* a ação só muda de lugar entre as irmãs (mesma etapa): o alvo é a última irmã da primeira */
    const irmas = p.locator(".lista .item").nth(0).locator("xpath=..").locator(":scope > .item");
    const total = await irmas.count();
    assert.ok(total >= 2, "o exemplo precisa de duas ações na primeira etapa");
    const b = await irmas.nth(total - 1).boundingBox();
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
    await p.mouse.move(a.x + 2, a.y + 6, { steps: 2 });
    await p.mouse.move(b.x + b.width / 2, b.y + b.height - 3, { steps: 14 });
    await p.mouse.up();
    await assentar(p, 700);
    const depois = await nomes();
    assert.notDeepEqual(depois, antes);
    assert.equal(depois.indexOf(antes[0]), total - 1, "a ação foi para o fim da etapa");
    await p.locator(".lista .item").nth(total - 1).locator(".puxador").focus();
    await p.keyboard.press("ArrowUp");
    await assentar(p, 700);
    assert.equal((await nomes()).indexOf(antes[0]), total - 2);
    assert.deepEqual(p.erros, []);
  });
});
