/**
 * Ação contínua no navegador (09/11/2026, pedido do responsável; documentação técnica, seção 5.9): tornar contínua pelo
 * menu "…", escolher os marcos na coluna de atributos, selo na lista, barra listrada no cronograma e recusa da ação
 * que tem anteriores.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

const janela = (p) => p.locator(".camada.aberta .painel");

/** Cria uma ação sem anteriores pelo "Nova ação" e abre a janela dela. */
async function criarEAbrir(p, nome) {
  /* no computador, o botão "Nova ação" do topo; no celular, o (+) da barra de baixo */
  await p.click((p.viewportSize().width <= 640) ? '.barra-inferior [data-inferior="nova"]' : ".botao[data-nova]");
  await p.waitForSelector(".nova-acao .rotulo-novo");
  await p.fill(".nova-acao .rotulo-novo", nome);
  await p.click('.nova-acao button[type="submit"]');
  await assentar(p);
  await p.keyboard.press("Escape");
  await assentar(p);
  await p.locator(".item").filter({ hasText: nome }).locator(".rotulo").first().click();
  await p.waitForSelector(".camada.aberta .janela-grade");
  await assentar(p);
}

async function escolherNoMenu(p, texto) {
  await janela(p).locator("[data-menu-janela]").click();
  await janela(p).locator(".menu-da-janela button").filter({ hasText: texto }).click();
  await assentar(p);
}

describe("Ação contínua no navegador", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  for (const largura of [1280, 390]) {
    test(`tornar contínua, trocar o marco de fim e voltar a comum (${largura} px)`, async () => {
      const p = await sessao.abrir({ largura, altura: 820 });
      await criarEAbrir(p, "Apoio técnico às áreas");
      const j = janela(p);
      await escolherNoMenu(p, "Tornar ação contínua");
      assert.match(await j.locator(".bloco-prazo .continua-tipo").innerText(), /Ação contínua/);
      assert.match(await j.locator(".bloco-prazo .continua-tipo").innerText(), /hammock/i);
      assert.equal(await j.locator(".bloco-prazo [data-campo=\"estimativa\"]").count(), 0, "sem estimativa");
      assert.equal(await j.locator("[data-abrir-form=\"reestimar\"]").count(), 0, "sem Reestimar");
      const atributos = await j.locator(".janela-lado [data-atributo]").evaluateAll((els) => els.map((el) => el.dataset.atributo));
      assert.ok(atributos.includes("comecaCom") && atributos.includes("terminaCom"));
      assert.ok(!atributos.includes("dependeDe") && !atributos.includes("naoAntesDe"), "sem Depende de nem Não começa antes de");
      assert.match(await j.locator('[data-atributo="comecaCom"]').innerText(), /Início do projeto/);

      /* marco de fim: uma ação do exemplo */
      await j.locator('[data-atributo="terminaCom"]').click();
      await assentar(p);
      const pop = p.locator('.camada.aberta [data-popover="terminaCom"]');
      assert.deepEqual(await pop.locator(".popover-grupo").allInnerTexts(), ["Projeto", "Fases", "Etapas", "Ações"]);
      await pop.locator(".popover-opcao").filter({ hasText: "Capacitar os usuários" }).click();
      await assentar(p);
      assert.match(await j.locator('[data-atributo="terminaCom"]').innerText(), /Fim da ação “Capacitar os usuários”/);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth) <= largura, "sem rolagem lateral");

      /* selo na lista */
      await p.keyboard.press("Escape");
      await assentar(p);
      const item = p.locator(".item").filter({ hasText: "Apoio técnico às áreas" });
      assert.equal(await item.locator(".tag-continua").count(), 1);
      assert.equal(await item.locator(".falta-estimar").count(), 0, "a contínua não leva \"Falta estimar\"");

      /* de volta a comum */
      await item.locator(".rotulo").first().click();
      await p.waitForSelector(".camada.aberta .janela-grade");
      await assentar(p);
      await escolherNoMenu(p, "Tornar ação comum");
      assert.equal(await j.locator(".continua-tipo").count(), 0);
      assert.equal(await j.locator('[data-atributo="comecaCom"]').count(), 0);
      assert.deepEqual(p.erros, []);
    });
  }

  test("a ação com anteriores não vira contínua: o aviso explica", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 820 });
    await p.locator(".item").filter({ hasText: "Capacitar os usuários" }).locator(".rotulo").first().click();
    await p.waitForSelector(".camada.aberta .janela-grade");
    await assentar(p);
    await escolherNoMenu(p, "Tornar ação contínua");
    assert.match(await p.locator(".aviso-curto").innerText(), /Retire as ações anteriores/);
    assert.equal(await janela(p).locator(".continua-tipo").count(), 0);
    assert.deepEqual(p.erros, []);
  });

  test("no cronograma, barra listrada e a legenda \"Contínua\"", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 820 });
    await criarEAbrir(p, "Divulgação do projeto");
    await escolherNoMenu(p, "Tornar ação contínua");
    await p.keyboard.press("Escape");
    await assentar(p);
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="cronograma"]').first().click();
    await p.waitForSelector(".crono-barra-acao");
    await assentar(p);
    const barra = p.locator(".crono-barra-acao.continua");
    assert.equal(await barra.count(), 1);
    const largura = (await barra.boundingBox()).width;
    assert.ok(largura > 100, `acompanha o projeto inteiro (largura ${largura})`);
    assert.match(await p.locator(".crono-legenda").filter({ hasText: "Contínua" }).innerText(), /Contínua/);
    assert.deepEqual(p.erros, []);
  });

  test("na rede: caixa como as outras, ligações tracejadas aos marcos e o filtro \"Ocultar ações contínuas\"", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 860 });
    await criarEAbrir(p, "Apoio aos dados");
    await escolherNoMenu(p, "Tornar ação contínua");
    for (const [campo, alvo] of [["comecaCom", "Modelar os dados de ensino"], ["terminaCom", "Ingerir os dados de ensino"]]) {
      await janela(p).locator(`[data-atributo="${campo}"]`).click();
      await assentar(p);
      await p.locator(`.camada.aberta [data-popover="${campo}"] .popover-opcao`).filter({ hasText: alvo }).click();
      await assentar(p);
    }
    await p.keyboard.press("Escape");
    await assentar(p);
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="rede"]').first().click();
    await p.waitForSelector(".rede-no");
    await assentar(p);
    assert.equal(await p.locator(".rede-no.continua").count(), 1);
    assert.equal(await p.locator(".rede-continua-ligacao").count(), 2);
    assert.equal(await p.locator('.rede-continua-ligacao[data-acao]').count(), 2, "as duas encostam em ações");
    /* destaque: apontar a contínua acende as duas ações que são marcos */
    await p.locator(".rede-no.continua .rede-cartao").hover();
    await assentar(p, 200);
    assert.equal(await p.locator(".rede-no.ligada").count(), 2);
    await p.click("[data-ocultar-continuas]");
    await assentar(p);
    assert.equal(await p.locator(".rede-no.continua").count(), 0);
    assert.equal(await p.locator(".rede-continua-ligacao").count(), 0);
    assert.match(await p.locator("[data-ocultar-continuas]").innerText(), /Mostrar/);
    assert.deepEqual(p.erros, []);
  });
});
