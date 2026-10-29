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

  test("com outra ordem, o cartão assenta onde vai ficar: nada salta ao redesenhar (correção de 29/10/2026)", async () => {
    const p = await abrirQuadro(sessao, { largura: 1280 });
    await p.click('.menu-topo[data-pop="classificar"]');
    await p.click('[data-ordem="espaco"]');
    await p.keyboard.press("Escape");
    await assentar(p, 600);
    /* posição de cada cartão logo depois de assentar e depois do redesenho de segurança (0,7 s) */
    const posicoes = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll(".quadro-tarefas .cartao-quadro")]
      .map((x) => { const r = x.getBoundingClientRect(); return [x.dataset.numero, [Math.round(r.left), Math.round(r.top)]]; })));
    const gesto = async (volta) => {
      const a = await centro(cartaoDe(p, 0, 0).locator(".rotulo"));
      const b = await coluna(p, 1).boundingBox();
      await p.mouse.move(a.x, a.y);
      await p.mouse.down();
      await p.mouse.move(a.x + 4, a.y + 4, { steps: 2 });
      await p.mouse.move(b.x + b.width / 2, b.y + 90, { steps: 12 });
      await assentar(p, 300);
      if (volta) { await p.mouse.move(a.x, a.y, { steps: 12 }); await assentar(p, 300); }
      await p.mouse.up();
      await assentar(p, 450);
      const logo = await posicoes();
      await assentar(p, 1000);
      assert.deepEqual(await posicoes(), logo, volta ? "de volta à coluna de origem" : "noutra coluna");
    };
    await gesto(true);
    await gesto(false);
    assert.deepEqual(p.erros, []);
  });

  test("ao trocar de coluna, as colunas mudam de altura aos poucos e nenhum cartão fica cortado (correção de 29/10/2026)", async () => {
    const p = await abrirQuadro(sessao, { largura: 1366, altura: 768 });
    const a = await centro(cartaoDe(p, 0, 0).locator(".rotulo"));
    const b = await coluna(p, 1).boundingBox();
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
    await p.mouse.move(a.x + 4, a.y + 4, { steps: 2 });
    await assentar(p, 300);
    /* a cada quadro de animação: altura de cada coluna e cartões além da borda de baixo da sua coluna */
    await p.evaluate(() => {
      window.__medidas = [];
      const fim = performance.now() + 600;
      const medir = () => {
        const colunas = [...document.querySelectorAll(".quadro-tarefas .coluna-cartoes")].map((c) => {
          const r = c.getBoundingClientRect();
          const cortados = [...c.querySelectorAll(":scope > .item:not(.levantado)")].filter((x) => x.getBoundingClientRect().bottom > r.bottom + 1).length;
          return { altura: r.height, cortados };
        });
        window.__medidas.push(colunas);
        if (performance.now() < fim) requestAnimationFrame(medir);
      };
      medir();
    });
    await p.mouse.move(b.x + b.width / 2, b.y + 90, { steps: 4 });
    await assentar(p, 700);
    const medidas = await p.evaluate(() => window.__medidas);
    await p.mouse.up();
    await assentar(p, 700);
    assert.ok(medidas.length > 10);
    for (const [i, quadro] of medidas.entries()) {
      for (const [k, c] of quadro.entries()) {
        assert.equal(c.cortados, 0, `cartão cortado na coluna ${k}, quadro ${i}`);
        if (i) assert.ok(Math.abs(c.altura - medidas[i - 1][k].altura) < 60, `a coluna ${k} mudou de altura de uma vez (quadro ${i})`);
      }
    }
    assert.deepEqual(p.erros, []);
  });

  test("coluna vazia: o aviso some aos poucos quando a vaga entra e volta aos poucos quando a coluna esvazia (correção de 29/10/2026)", async () => {
    const p = await abrirQuadro(sessao, { largura: 1366, altura: 768 });
    const vazio = (i) => coluna(p, i).locator(".coluna-cartoes > .vazio").evaluate((v) => {
      const cs = getComputedStyle(v);
      return { altura: v.getBoundingClientRect().height, opacidade: Number(cs.opacity) };
    }).catch(() => null);
    const posicoes = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll(".quadro-tarefas .cartao-quadro")]
      .map((x) => { const r = x.getBoundingClientRect(); return [x.dataset.numero, [Math.round(r.left), Math.round(r.top)]]; })));
    /** Leva o primeiro cartão da coluna `de` até a coluna `para`; `durante` roda com o cartão ainda no ar. */
    const levar = async (de, para, durante) => {
      const a = await centro(cartaoDe(p, de, 0).locator(".rotulo"));
      const b = await coluna(p, para).boundingBox();
      await p.mouse.move(a.x, a.y);
      await p.mouse.down();
      await p.mouse.move(a.x + 4, a.y + 4, { steps: 2 });
      await p.mouse.move(b.x + b.width / 2, b.y + 60, { steps: 10 });
      await assentar(p, 350);
      await durante?.();
      await p.mouse.up();
      await assentar(p, 450);
      const logo = await posicoes();
      await assentar(p, 1000);
      assert.deepEqual(await posicoes(), logo, "nada salta depois de soltar");
    };
    const total = await coluna(p, 2).locator(".cartao-quadro").count();
    assert.ok(total >= 1);
    for (let i = 1; i < total; i++) await levar(2, 1);
    /* o último cartão sai: a coluna esvazia e o aviso aparece ainda durante o arrasto */
    await levar(2, 1, async () => {
      const v = await vazio(2);
      assert.ok(v && v.altura > 10 && v.opacidade > 0.9, "aviso de coluna vazia à vista na coluna que esvaziou");
    });
    assert.equal(await coluna(p, 2).locator(".cartao-quadro").count(), 0);
    /* um cartão entra na coluna vazia: o aviso some durante o arrasto, e não volta para baixo do cartão */
    await levar(0, 2, async () => {
      const v = await vazio(2);
      assert.ok(!v || v.altura < 1 || v.opacidade < 0.05, "aviso escondido com a vaga na coluna");
    });
    assert.equal(await coluna(p, 2).locator(".cartao-quadro").count(), 1);
    assert.equal(await coluna(p, 2).locator(".coluna-cartoes > .vazio").count(), 0);
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
