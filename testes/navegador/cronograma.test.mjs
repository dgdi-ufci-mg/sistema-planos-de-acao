/**
 * Cronograma (Gantt) no navegador: zoom com os botões e com Ctrl + rolagem do mouse (27/10/2026; documentação
 * técnica, seção 8.4), mantendo parada a data sob o ponteiro.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Cronograma: zoom", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const largura = (p) => p.evaluate(() => document.querySelector(".crono-trilho").getBoundingClientRect().width);

  test("botões − e + e Ctrl + rolagem mudam o zoom; a data sob o ponteiro fica parada", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 760 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="cronograma"]').first().click();
    await p.waitForSelector(".crono-trilho");
    const l0 = await largura(p);
    await p.click('[data-zoom="1"]');
    await assentar(p, 200);
    const l1 = await largura(p);
    assert.ok(l1 > l0, "+ aproxima");
    await p.click('[data-zoom="-1"]');
    await assentar(p, 200);
    assert.equal(Math.round(await largura(p)), Math.round(l0), "− volta");
    /* Ctrl + rolagem para baixo afasta, no ponto do ponteiro */
    const r = await p.locator("[data-rolagem]").boundingBox();
    const px = r.x + r.width * 0.7;
    const dataSob = () => p.evaluate((x) => {
      const t = document.querySelector(".crono-trilho").getBoundingClientRect();
      return (x - t.left) / t.width;
    }, px);
    const antes = await dataSob();
    await p.mouse.move(px, r.y + 120);
    await p.keyboard.down("Control");
    await p.mouse.wheel(0, 120);
    await p.keyboard.up("Control");
    await assentar(p, 300);
    assert.ok(await largura(p) < l0, "afastou");
    assert.ok(Math.abs((await dataSob()) - antes) < 0.02, "a data sob o ponteiro ficou no lugar");
    assert.deepEqual(p.erros, []);
  });

  test("rolagem no próprio cronograma: cabeçalho parado e barra horizontal sempre à vista (27/10/2026)", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 700 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="cronograma"]').first().click();
    await p.waitForSelector(".crono-trilho");
    await assentar(p, 300);
    const medidas = () => p.evaluate(() => {
      const r = document.querySelector("[data-rolagem]");
      const caixa = r.getBoundingClientRect();
      return { topo: document.querySelector(".crono-topo").getBoundingClientRect().top - caixa.top, base: caixa.bottom, alto: innerHeight,
        rolaY: r.scrollHeight > r.clientHeight, rolaX: r.scrollWidth > r.clientWidth, paginaRola: document.documentElement.scrollHeight > innerHeight + 1 };
    });
    const antes = await medidas();
    assert.ok(antes.rolaY && antes.rolaX, "o cronograma rola nos dois sentidos");
    assert.ok(antes.base <= antes.alto, "a barra horizontal fica dentro da tela");
    assert.ok(!antes.paginaRola, "a página não rola; quem rola é o cronograma");
    await p.evaluate(() => { document.querySelector("[data-rolagem]").scrollTop = 200; });
    await assentar(p, 100);
    assert.ok(Math.abs((await medidas()).topo) < 1, "cabeçalho das datas parado no alto");
    assert.deepEqual(p.erros, []);
  });
});

describe("Cronograma: escala das datas alinhada às barras (10/11/2026)", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("a escala do cabeçalho e a área das barras começam no mesmo ponto", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 760 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="cronograma"]').first().click();
    await p.waitForSelector(".crono-trilho");
    await assentar(p, 300);
    const m = await p.evaluate(() => ({
      escala: document.querySelector(".crono-escala").getBoundingClientRect().left,
      trilho: document.querySelector(".crono-trilho").getBoundingClientRect().left,
    }));
    assert.ok(Math.abs(m.escala - m.trilho) < 1, `escala em ${m.escala}, barras em ${m.trilho}`);
    assert.deepEqual(p.erros, []);
  });
});

describe("Cronograma: navegação e edição na tela (10/11/2026)", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  async function abrir() {
    const p = await sessao.abrir({ largura: 1440, altura: 860 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="cronograma"]').first().click();
    await p.waitForSelector(".crono-trilho");
    await assentar(p, 400);
    return p;
  }
  const linha = (p, nome) => p.locator(`.crono-linha[data-numero]:has-text("${nome}")`);
  const ordem = (p) => p.evaluate(() => [...document.querySelectorAll(".crono-linha")].map((l) => (l.classList.contains("grupo") ? `[${l.querySelector(".crono-grupo-nome").textContent}]` : l.querySelector(".rotulo").textContent)));
  const rolar = (p) => p.evaluate(() => { const r = document.querySelector("[data-rolagem]"); return { x: r.scrollLeft, largo: r.scrollWidth, vista: r.clientWidth }; });
  /** Arrasta do centro de `de` até o ponto (x, y), com o botão apertado. */
  async function arrastar(p, x0, y0, x1, y1) {
    await p.mouse.move(x0, y0);
    await p.mouse.down();
    await p.mouse.move(x1, y1, { steps: 8 });
    await p.mouse.up();
    await assentar(p, 800);
  }

  test("Ver tudo encaixa o plano na tela; Hoje traz a vista de volta; arrastar o fundo desloca", async () => {
    const p = await abrir();
    await p.click("[data-ver-tudo]");
    await assentar(p, 400);
    const tudo = await rolar(p);
    assert.ok(tudo.largo <= tudo.vista + 1, `cabe na tela (${tudo.largo} em ${tudo.vista})`);
    await p.click('[data-zoom="1"]');
    await p.click('[data-zoom="1"]');
    await assentar(p, 300);
    await p.evaluate(() => { document.querySelector("[data-rolagem]").scrollLeft = 0; });
    await p.click("[data-ir-hoje]");
    await assentar(p, 900);
    const hoje = await p.evaluate(() => { const m = document.querySelector(".crono-marca.hoje").getBoundingClientRect(); const r = document.querySelector("[data-rolagem]").getBoundingClientRect(); return { x: m.left, de: r.left + 300, ate: r.right }; });
    assert.ok(hoje.x > hoje.de && hoje.x < hoje.ate, "a linha de hoje está à vista");
    const antes = (await rolar(p)).x;
    const r = await p.locator("[data-rolagem]").boundingBox();
    await arrastar(p, r.x + 900, r.y + 60, r.x + 780, r.y + 60);
    assert.equal(Math.round((await rolar(p)).x - antes), 120, "o fundo arrastado 120 px desloca 120 px");
    assert.deepEqual(p.erros, []);
  });

  test("clicar na fase recolhe e abre as linhas dela", async () => {
    const p = await abrir();
    const n = await p.locator(".crono-linha").count();
    await p.locator(".crono-linha.grupo.fase .crono-nome").first().click();
    await assentar(p, 500);
    assert.ok(await p.locator(".crono-linha").count() < n, "recolheu");
    assert.equal(await p.locator(".crono-linha.grupo.fase.recolhido .crono-conta").count(), 1, "mostra quantas ações ficaram dentro");
    await p.locator(".crono-linha.grupo.fase .crono-nome").first().click();
    await assentar(p, 500);
    assert.equal(await p.locator(".crono-linha").count(), n, "abriu de novo");
    assert.deepEqual(p.erros, []);
  });

  test("prazo: clicar na barra abre os três prazos; arrastar a borda muda o fim, abre a caixinha e Ctrl+Z desfaz", async () => {
    const p = await abrir();
    await p.click("[data-ver-tudo]");
    await assentar(p, 400);
    const barra = linha(p, "Ingerir os dados").locator("[data-barra]");
    await barra.click();
    await assentar(p, 300);
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll(".rede-estimar input")].map((i) => i.value)), ["8", "10", "18"]);
    await p.keyboard.press("Escape");
    await assentar(p, 200);
    const antes = await barra.getAttribute("aria-label");
    const b = await linha(p, "Ingerir os dados").locator("[data-borda]").boundingBox();
    await arrastar(p, b.x + 5, b.y + 8, b.x + 35, b.y + 8);
    const depois = await barra.getAttribute("aria-label");
    assert.notEqual(depois, antes, "a ação termina em outro dia");
    assert.equal(depois.slice(0, 40), antes.slice(0, 40), "o começo não muda");
    assert.equal(await p.locator(".rede-estimar").count(), 1, "a caixinha abre para conferir os números");
    const novos = await p.evaluate(() => [...document.querySelectorAll(".rede-estimar input")].map((i) => Number(i.value)));
    assert.ok(novos[0] <= novos[1] && novos[1] <= novos[2] && novos[1] > 10, `prazos maiores e em ordem: ${novos}`);
    await p.keyboard.press("Escape");
    await assentar(p, 200);
    await p.locator(".crono").focus();
    await p.keyboard.press("Control+z");
    await assentar(p, 800);
    assert.equal(await barra.getAttribute("aria-label"), antes, "Ctrl+Z volta ao prazo de antes");
    assert.deepEqual(p.erros, []);
  });

  test("ligações: arrastar a bolinha liga duas ações; a seta selecionada sai com Delete; Desfazer repõe", async () => {
    const p = await abrir();
    await p.click("[data-ver-tudo]");
    await assentar(p, 400);
    const setas = () => p.locator(".crono-seta").count();
    const n = await setas();
    await linha(p, "Contratar licenças").hover();
    const a = await linha(p, "Contratar licenças").locator("[data-alca]").boundingBox();
    const d = await linha(p, "Modelar os dados").locator("[data-barra]").boundingBox();
    await arrastar(p, a.x + 6, a.y + 6, d.x + 10, d.y + 8);
    assert.equal(await setas(), n + 1, "ligou");
    await p.locator('.crono-seta-alvo').first().click({ force: true });
    assert.equal(await p.locator(".crono-seta.selecionada").count(), 1);
    await p.keyboard.press("Delete");
    await assentar(p, 800);
    assert.equal(await setas(), n, "retirou a selecionada");
    await p.click("[data-crono-desfazer]");
    await assentar(p, 800);
    assert.equal(await setas(), n + 1, "Desfazer repôs");
    assert.deepEqual(p.erros, []);
  });

  test("criar pelo + da etapa, dar nome e prazo sem sair da tela; duplo clique renomeia; botão direito abre o menu", async () => {
    const p = await abrir();
    const n = await p.locator(".crono-linha[data-numero]").count();
    await p.locator("[data-nova-em]").first().click();
    await assentar(p, 800);
    assert.equal(await p.locator(".crono-linha[data-numero]").count(), n + 1);
    assert.equal(await p.locator(".crono [data-editando]").count(), 1, "o nome já abre para digitar");
    await p.keyboard.type("Ação de teste");
    await p.keyboard.press("Enter");
    await assentar(p, 700);
    assert.equal(await p.locator(".rede-estimar").count(), 1, "em seguida, os três prazos");
    for (const v of ["2", "3", "5"]) { await p.keyboard.type(v); if (v !== "5") await p.keyboard.press("Tab"); }
    await p.keyboard.press("Enter");
    await assentar(p, 800);
    assert.equal(await linha(p, "Ação de teste").locator("[data-barra].sem-estimativa").count(), 0, "a barra tem prazo");
    await linha(p, "Ação de teste").locator(".crono-nome").dblclick();
    await assentar(p, 400);
    assert.equal(await p.locator(".crono [data-editando]").count(), 1, "duplo clique renomeia");
    assert.equal(await p.locator(".camada.aberta").count(), 0, "sem abrir a janela da ação");
    await p.keyboard.press("Escape");
    await assentar(p, 300);
    await linha(p, "Ação de teste").locator(".crono-nome").click({ button: "right" });
    await assentar(p, 300);
    const itens = await p.evaluate(() => [...document.querySelectorAll(".rede-menu button span")].map((b) => b.textContent));
    for (const item of ["Abrir a ação", "Renomear", "Nova ação depois desta", "Excluir a ação"]) assert.ok(itens.includes(item), item);
    await p.keyboard.press("Escape");
    await linha(p, "Capacitar").locator(".crono-nome").click();
    await assentar(p, 700);
    assert.equal(await p.locator(".camada.aberta").count(), 1, "o clique simples no nome continua abrindo a ação");
    assert.deepEqual(p.erros, []);
  });

  test("arrastar o nome muda a ordem e a etapa; Ctrl+Z desfaz", async () => {
    const p = await abrir();
    const antes = await ordem(p);
    const i = antes.findIndex((t) => t.startsWith("Redigir"));
    const j = antes.findIndex((t) => t.startsWith("Contratar"));
    assert.equal(i, j + 1);
    const meio = async (nome, dy) => { const r = await linha(p, nome).locator(".crono-nome").boundingBox(); return [r.x + 80, r.y + dy]; };
    await arrastar(p, ...(await meio("Redigir a norma", 17)), ...(await meio("Contratar licenças", 6)));
    let agora = await ordem(p);
    assert.equal(agora.findIndex((t) => t.startsWith("Redigir")), j, "subiu uma linha, na mesma etapa");
    assert.equal(await p.locator(".camada.aberta").count(), 0, "soltar não abre a ação");
    /* para outra etapa: logo abaixo de "Preparar os servidores" */
    await arrastar(p, ...(await meio("Redigir a norma", 17)), ...(await meio("Preparar os servidores", 28)));
    agora = await ordem(p);
    assert.equal(agora[agora.findIndex((t) => t.startsWith("Preparar")) + 1].slice(0, 7), "Redigir", "foi para a outra etapa");
    /* no título de uma etapa: vai para o começo dela */
    const titulo = await p.locator('.crono-linha.grupo.etapa:has-text("Etapa 2.2") .crono-nome').boundingBox();
    await arrastar(p, ...(await meio("Redigir a norma", 17)), titulo.x + 80, titulo.y + 17);
    agora = await ordem(p);
    assert.equal(agora[agora.findIndex((t) => t.startsWith("[Etapa 2.2")) + 1].slice(0, 7), "Redigir", "primeira da etapa");
    await p.locator(".crono").focus();
    for (let k = 0; k < 3; k++) { await p.keyboard.press("Control+z"); await assentar(p, 800); }
    assert.deepEqual(await ordem(p), antes, "três Ctrl+Z voltam ao começo");
    assert.deepEqual(p.erros, []);
  });
});
