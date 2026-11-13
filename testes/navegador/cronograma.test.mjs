/**
 * Cronograma (Gantt) no navegador: zoom com os botões e com Ctrl + rolagem do mouse (27/10/2026; documentação
 * técnica, seção 8.4), mantendo parada a data sob o ponteiro.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, irParaVisualizacao } from "./apoio.mjs";

describe("Cronograma: zoom", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const largura = (p) => p.evaluate(() => document.querySelector(".crono-trilho").getBoundingClientRect().width);

  test("botões − e + e Ctrl + rolagem mudam o zoom; a data sob o ponteiro fica parada", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 760 });
    await irParaVisualizacao(p, "cronograma");
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
    await irParaVisualizacao(p, "cronograma");
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
    await irParaVisualizacao(p, "cronograma");
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
    await irParaVisualizacao(p, "cronograma");
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

describe("Cronograma: responsável, filtros, legenda, setas de borda, teclado, impressão e celular (11/11/2026)", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  async function abrir() {
    const p = await sessao.abrir({ largura: 1440, altura: 860 });
    await irParaVisualizacao(p, "cronograma");
    await p.waitForSelector(".crono-trilho");
    await assentar(p, 400);
    return p;
  }
  const linha = (p, nome) => p.locator(`.crono-linha[data-numero]:has-text("${nome}")`);
  const exibir = async (p, opcao) => {
    await p.locator('.menu-topo[data-pop="painel"]').click();
    await assentar(p, 250);
    await p.locator(`[data-crono-op="${opcao}"]`).click();
    await assentar(p, 500);
    await p.keyboard.press("Escape");
    await assentar(p, 250);
  };

  test("o responsável aparece ao lado da barra, fora dela, e sai pelo menu Exibir", async () => {
    const p = await abrir();
    const quem = linha(p, "Contratar licenças").locator(".crono-quem");
    assert.match(await quem.textContent(), /^\S.* \+1$/, "primeiro nome da lista e +1");
    const m = await p.evaluate(() => {
      const l = [...document.querySelectorAll(".crono-linha[data-numero]")].find((x) => x.textContent.includes("Contratar licenças"));
      return { barra: l.querySelector("[data-barra]").getBoundingClientRect().right, nome: l.querySelector(".crono-quem").getBoundingClientRect().left };
    });
    assert.ok(m.nome >= m.barra, "o nome começa depois do fim da barra");
    await exibir(p, "cronoResponsavel");
    assert.equal(await p.locator(".crono-quem").count(), 0);
    assert.equal(await p.evaluate(() => localStorage.getItem("sextante.cronoResponsavel")), "0", "a escolha fica lembrada");
    assert.deepEqual(p.erros, []);
  });

  test("esconder as concluídas: as linhas saem, a etapa avisa, e \"Mostrar\" traz de volta", async () => {
    const p = await abrir();
    const n = await p.locator(".crono-linha[data-numero]").count();
    const grupos = await p.locator(".crono-linha.grupo").count();
    await exibir(p, "cronoSemConcluidas");
    assert.equal(await p.locator(".crono-linha[data-numero]").count(), n - 2);
    assert.equal(await p.locator("[data-barra].concluida").count(), 0);
    assert.equal(await p.locator(".crono-linha.grupo").count(), grupos, "fases e etapas continuam todas");
    assert.match(await p.locator("[data-ocultas]").textContent(), /Escondidas: 2 concluídas/);
    assert.equal(await p.locator('.crono-linha.grupo.etapa:has-text("Etapa 1.1") .crono-ocultas').textContent(), "2 ocultas");
    await p.click("[data-mostrar-todas]");
    await assentar(p, 500);
    assert.equal(await p.locator(".crono-linha[data-numero]").count(), n);
    assert.equal(await p.locator("[data-ocultas]").count(), 0);
    assert.deepEqual(p.erros, []);
  });

  test("legenda completa no botão ?; Hoje e Prazo final escritos no cabeçalho", async () => {
    const p = await abrir();
    assert.equal(await p.locator("[data-crono-ajuda-cartao]").isVisible(), false, "a legenda começa guardada");
    await p.click("[data-crono-ajuda]");
    assert.ok(await p.locator("[data-crono-ajuda-cartao]").isVisible(), "o ? abre a legenda");
    const itens = await p.evaluate(() => [...document.querySelectorAll("[data-crono-ajuda-cartao] .crono-legenda")].map((e) => e.textContent.replace("o que é?", "").trim()));
    for (const item of ["Sem folga", "Com folga", "Ainda não liberada", "Atrasada", "Concluída", "Fase ou etapa, do começo ao fim", "Ligação: só começa quando a anterior termina", "Hoje", "Dias que já passaram", "Prazo final"]) {
      assert.ok(itens.includes(item), `falta na legenda: ${item} (${itens.join(" | ")})`);
    }
    assert.equal(await p.locator(".crono ~ .crono-legendas").count(), 0, "nada de legenda sob o cronograma");
    await p.click("[data-crono-ajuda]");
    await assentar(p, 400);
    assert.equal(await p.locator("[data-crono-ajuda-cartao]").isVisible(), false, "o ? fecha a legenda");
    await p.click("[data-crono-ajuda]");
    await p.mouse.click(400, 300);
    await assentar(p, 400);
    assert.equal(await p.locator("[data-crono-ajuda-cartao]").isVisible(), false, "clicar fora também fecha");
    assert.equal(await p.locator(".crono-escala .crono-pino.hoje").textContent(), "Hoje");
    assert.equal(await p.locator(".crono-escala .crono-pino.prazo").textContent(), "Prazo final");
    const x = await p.evaluate(() => ({ pino: document.querySelector(".crono-pino.hoje").getBoundingClientRect(), linha: document.querySelector(".crono-marca.hoje").getBoundingClientRect().left }));
    assert.ok(Math.abs(x.pino.left + x.pino.width / 2 - x.linha) < 2, "o nome fica em cima da linha de hoje");
    assert.deepEqual(p.erros, []);
  });

  test("controles sobre o gráfico, como na Rede: nada de linha de ferramentas nem de legenda abaixo; a área vai ao pé da tela (13/11/2026)", async () => {
    const p = await abrir();
    assert.equal(await p.locator(".crono-ferramentas").count(), 0, "sem a linha de ferramentas");
    const m = await p.evaluate(() => {
      const c = document.querySelector(".crono").getBoundingClientRect();
      const ctl = document.querySelector("[data-crono-controles]").getBoundingClientRect();
      return { pe: innerHeight - c.bottom, dentro: ctl.right <= c.right && ctl.bottom <= c.bottom && ctl.top >= c.top, rola: document.documentElement.scrollHeight - innerHeight };
    });
    assert.ok(m.dentro, "os controles ficam dentro do cronograma");
    assert.ok(m.pe <= 24, `o cronograma vai até perto do pé da tela (sobram ${m.pe} px)`);
    assert.ok(m.rola <= 1, "a página não rola");
    assert.equal(await p.locator("[data-crono-desfazer]").isVisible(), false, "Desfazer só aparece quando há o que desfazer");
    assert.deepEqual(p.erros, []);
  });

  test("linhas compactas, em Exibir: mais linhas por tela, e a escolha fica lembrada", async () => {
    const p = await abrir();
    const altura = () => p.evaluate(() => document.querySelector(".crono-linha").getBoundingClientRect().height);
    assert.equal(await altura(), 34);
    await exibir(p, "cronoCompacto");
    assert.equal(await altura(), 26);
    assert.equal(await p.locator(".crono.compacta").count(), 1);
    assert.equal(await p.evaluate(() => localStorage.getItem("sextante.cronoCompacto")), "1");
    await exibir(p, "cronoCompacto");
    assert.equal(await altura(), 34);
    assert.deepEqual(p.erros, []);
  });

  test("arrastar a borda da coluna dos nomes muda a largura, lembrada; duplo clique volta ao normal", async () => {
    const p = await abrir();
    const nomes = () => p.evaluate(() => document.querySelector(".crono-linha .crono-nome").getBoundingClientRect().width);
    assert.equal(Math.round(await nomes()), 300);
    const b = await p.locator("[data-nomes-borda]").boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await p.mouse.down();
    await p.mouse.move(b.x + 80, b.y + b.height / 2, { steps: 5 });
    await p.mouse.up();
    await assentar(p, 400);
    const larga = Math.round(await nomes());
    assert.ok(larga > 360 && larga < 390, `alargou (${larga})`);
    assert.equal(await p.evaluate(() => localStorage.getItem("sextante.cronoNomes")), String(larga));
    const t = await p.evaluate(() => [document.querySelector(".crono-escala").getBoundingClientRect().left, document.querySelector(".crono-trilho").getBoundingClientRect().left]);
    assert.ok(Math.abs(t[0] - t[1]) < 1, "o cabeçalho das datas acompanha");
    await p.locator("[data-nomes-borda]").dblclick();
    await assentar(p, 400);
    assert.equal(Math.round(await nomes()), 300);
    assert.equal(await p.evaluate(() => localStorage.getItem("sextante.cronoNomes")), null);
    assert.deepEqual(p.erros, []);
  });

  test("barra fora do trecho à vista: a linha ganha uma seta, e clicar leva até a barra", async () => {
    const p = await abrir();
    /* a tela abre perto de hoje: as duas concluídas ficaram para trás */
    assert.equal(await p.locator(".crono-fora.antes").count(), 2);
    const alvo = await p.evaluate(() => {
      const b = document.querySelector(".crono-fora.antes");
      const l = document.querySelector(`.crono-linha[data-numero="${b.dataset.fora}"]`).getBoundingClientRect();
      const r = b.getBoundingClientRect();
      return { numero: b.dataset.fora, naLinha: r.top >= l.top && r.bottom <= l.bottom };
    });
    assert.ok(alvo.naLinha, "a seta fica na altura da linha da ação");
    await p.locator(".crono-fora.antes").first().click();
    await assentar(p, 900);
    const v = await p.evaluate((n) => {
      const b = document.querySelector(`[data-barra="${n}"]`).getBoundingClientRect();
      const t = document.querySelector(".crono-nome.crono-cabeca").getBoundingClientRect().right;
      const r = document.querySelector("[data-rolagem]").getBoundingClientRect();
      return b.left >= t && b.left < r.right;
    }, alvo.numero);
    assert.ok(v, "a barra ficou à vista");
    assert.equal(await p.locator(`.crono-fora[data-fora="${alvo.numero}"]`).count(), 0, "a seta dela some");
    assert.deepEqual(p.erros, []);
  });

  test("a dica da barra aparece também pelo teclado, com o responsável", async () => {
    const p = await abrir();
    await linha(p, "Ingerir os dados").locator(".crono-nome").focus();
    await p.keyboard.press("Tab");
    await assentar(p, 200);
    const dica = p.locator(".crono [data-dica]");
    assert.equal(await dica.isVisible(), true);
    const texto = await dica.innerText();
    assert.match(texto, /Ingerir os dados/);
    assert.match(texto, /Responsáve(l|is): \S/);
    await p.keyboard.press("Tab");
    await assentar(p, 200);
    assert.doesNotMatch(await dica.isVisible() ? await dica.innerText() : "", /Ingerir os dados/, "sai ao deixar a barra");
    assert.deepEqual(p.erros, []);
  });

  test("impressão: páginas deitadas com cabeçalho e legenda, tema claro, e tudo volta depois", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 860, tema: "dark" });
    await irParaVisualizacao(p, "cronograma");
    await p.waitForSelector(".crono-trilho");
    await assentar(p, 400);
    const temaAntes = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await p.evaluate(() => dispatchEvent(new Event("beforeprint")));
    await p.emulateMedia({ media: "print" });
    await assentar(p, 300); // a folha muda a altura da página, e a barra de rolagem pode aparecer ou sumir: espera o desenho assentar
    const m = await p.evaluate(() => {
      const paginas = [...document.querySelectorAll(".crono-impressao .crono-pagina")];
      return {
        paginas: paginas.length,
        linhasPorPagina: paginas.map((pg) => Math.round(pg.querySelector(".crono-recorte").getBoundingClientRect().height / 34)),
        largura: Math.max(...paginas.map((pg) => pg.querySelector(".crono-conteudo").getBoundingClientRect().width)),
        altura: Math.max(...paginas.map((pg) => pg.getBoundingClientRect().height)),
        cabecalhos: document.querySelectorAll(".crono-impressao .crono-topo").length,
        legendas: document.querySelectorAll(".crono-impressao .crono-legendas").length,
        titulo: paginas[0].querySelector(".crono-pagina-titulo").textContent,
        restoEscondido: [...document.body.children].filter((el) => !el.classList.contains("crono-impressao") && getComputedStyle(el).display !== "none").length,
        tema: document.documentElement.getAttribute("data-theme"),
        barraPintada: getComputedStyle(document.querySelector(".crono-impressao [data-barra].critica")).backgroundColor,
        botoes: [...document.querySelectorAll(".crono-impressao .crono-mais, .crono-impressao .crono-borda, .crono-impressao .crono-alca")].filter((el) => getComputedStyle(el).display !== "none").length,
        total: document.querySelectorAll(".crono:not(.impresso) .crono-linha").length,
      };
    });
    assert.equal(m.paginas, Math.ceil(m.total / 18));
    assert.equal(m.linhasPorPagina.reduce((s, n) => s + n, 0), m.total, "todas as linhas, uma vez cada");
    assert.ok(m.linhasPorPagina.every((n) => n <= 18));
    assert.ok(m.largura <= 1047, `cabe na largura da folha A4 deitada (${m.largura})`);
    assert.ok(m.altura <= 718, `cada página cabe na altura da folha (${m.altura})`);
    assert.equal(m.cabecalhos, m.paginas);
    assert.equal(m.legendas, m.paginas);
    assert.match(m.titulo, /Exemplo: repositório de dados acadêmicos/);
    assert.match(m.titulo, /página 1 de 2/);
    assert.equal(m.restoEscondido, 0, "só a folha aparece na impressão");
    assert.equal(m.tema, "light");
    assert.notEqual(m.barraPintada, "rgba(0, 0, 0, 0)");
    assert.equal(m.botoes, 0, "sem botões de edição no papel");
    await p.emulateMedia({ media: "screen" });
    await p.evaluate(() => dispatchEvent(new Event("afterprint")));
    assert.equal(await p.locator(".crono-impressao").count(), 0);
    assert.equal(await p.evaluate(() => document.documentElement.getAttribute("data-theme")), temaAntes);
    assert.equal(await p.evaluate(() => document.body.classList.contains("imprimindo-cronograma")), false);
    assert.deepEqual(p.erros, []);
  });

  test("celular: cronograma só para consulta, sem rolar a página de lado; tocar abre a ação e a pinça muda o zoom", async () => {
    const p = await sessao.abrir({ largura: 390, altura: 800 });
    await p.click('[data-inferior="filtros"]');
    await assentar(p, 500);
    await p.locator('.camada.aberta [data-modo="cronograma"]').click();
    await assentar(p, 400);
    await p.locator('.camada.aberta button:has-text("Pronto")').click();
    await assentar(p, 600);
    const m = await p.evaluate(() => {
      const r = document.querySelector("[data-rolagem]").getBoundingClientRect();
      const hoje = document.querySelector(".crono-marca.hoje").getBoundingClientRect().left;
      return { editavel: document.querySelectorAll(".crono.editavel, .crono-mais, [data-alca], [data-borda]").length, pagina: document.documentElement.scrollWidth, tela: innerWidth,
        nomes: document.querySelector(".crono-nome.crono-cabeca").getBoundingClientRect().width, hojeAVista: hoje > r.left + 132 && hoje < r.right, altura: r.height };
    });
    assert.equal(m.editavel, 0, "nada de edição no celular");
    assert.ok(m.pagina <= m.tela, "a página não rola de lado");
    assert.equal(Math.round(m.nomes), 132, "a coluna dos nomes encolhe");
    assert.ok(m.hojeAVista, "abre com o dia de hoje à vista");
    assert.ok(m.altura >= 320);
    /* pinça fechando: um nível de zoom a menos (de 18 para 12 px por dia) */
    const r = await p.locator("[data-rolagem]").boundingBox();
    const cdp = await p.context().newCDPSession(p);
    const dedos = (type, pontos) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pontos.map(([x, y], id) => ({ x, y, id })) });
    const cx = r.x + 260;
    const cy = r.y + 200;
    await dedos("touchStart", [[cx - 60, cy], [cx + 60, cy]]);
    for (let i = 1; i <= 8; i++) { await dedos("touchMove", [[cx - 60 + i * 5, cy], [cx + 60 - i * 5, cy]]); await p.waitForTimeout(16); }
    await dedos("touchEnd", []);
    await assentar(p, 400);
    assert.equal(await p.evaluate(() => localStorage.getItem("sextante.zoomCronograma")), "12");
    await p.locator(".crono-linha[data-numero] .crono-nome").first().tap();
    await assentar(p, 700);
    assert.equal(await p.locator(".camada.aberta").count(), 1, "tocar no nome abre a ação");
    assert.deepEqual(p.erros, []);
  });
});

describe("Cronograma: indicador ao lado dos nomes (12/11/2026)", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  async function abrir(largura = 1440) {
    const p = await sessao.abrir({ largura, altura: 860 });
    await irParaVisualizacao(p, "cronograma");
    await p.waitForSelector(".crono-trilho");
    await assentar(p, 400);
    return p;
  }
  const escolher = async (p, v) => {
    if (!(await p.locator(".popover [data-crono-ind]").first().isVisible())) await p.click('.menu-topo[data-pop="painel"]');
    await p.locator(`.popover [data-crono-ind="${v}"]`).first().click();
    await assentar(p, 400);
  };

  test("o indicador fica em Exibir: Nenhum, criticidade ou incerteza; sem o menu Indicador", async () => {
    const p = await abrir();
    assert.equal(await p.locator('.menu-topo[data-pop="indicador"]').count(), 0, "no Cronograma, sem o menu Indicador");
    assert.equal(await p.locator(".crono.com-indicador").count(), 0, "começa sem indicador");
    await p.click('.menu-topo[data-pop="painel"]');
    assert.deepEqual(await p.locator(".popover [data-crono-ind]").evaluateAll((bs) => bs.map((b) => b.dataset.cronoInd)), ["nenhum", "execucao", "revisao"]);
    assert.equal(await p.locator('.popover [data-crono-ind="nenhum"]').getAttribute("aria-pressed"), "true");
    await escolher(p, "execucao");
    assert.ok(await p.locator(".crono.com-indicador").count() === 1);
    assert.ok(await p.locator(".crono-linha .crono-ind .barra-medidor").count() >= 5, "barra nas ações não concluídas");
    assert.equal(await p.locator(".crono-cabeca .crono-ind-titulo .barra-icone.execucao").count(), 1);
    const largura = await p.evaluate(() => document.querySelector(".crono-nome.crono-cabeca").getBoundingClientRect().width);
    assert.equal(Math.round(largura), 404);
    await escolher(p, "revisao");
    assert.equal(await p.locator(".crono-cabeca .barra-icone.revisao").count(), 1);
    assert.equal(await p.evaluate(() => localStorage.getItem("sextante.cronoIndicador")), "revisao");
    await escolher(p, "nenhum");
    assert.equal(await p.locator(".crono-ind").count(), 0);
    assert.equal(await p.locator(".crono.com-indicador").count(), 0);
    assert.deepEqual(p.erros, []);
  });
});
