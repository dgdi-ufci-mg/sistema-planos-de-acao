/**
 * Rede em tela cheia (09/11/2026, pedido do responsável; documentação técnica, seção 8.4): a Rede ocupa a área à
 * direita do menu lateral, por trás da barra do topo; os botões flutuantes ajustam à tela, voltam a 100% e explicam o uso.
 * Navegação (11/11/2026): rolar move a vista; Ctrl + rolar (e a pinça do touchpad) aproxima e afasta em volta do
 * ponteiro, com transição suave; arrastar o fundo também move.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, irParaVisualizacao } from "./apoio.mjs";

describe("Rede: navegação como num mapa", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const abrirRede = async (o = {}) => {
    const p = await sessao.abrir({ largura: 1440, altura: 860, ...o });
    await irParaVisualizacao(p, "rede");
    await p.waitForSelector(".rede-no");
    await assentar(p);
    return p;
  };
  const zoom = async (p) => Number((await p.locator("[data-zoom-valor]").textContent()).replace("%", ""));
  const caixa = (p, seletor) => p.locator(seletor).first().boundingBox();
  /** espera a transição do zoom terminar */
  const parar = (p) => p.waitForTimeout(450);
  const clicar = async (p, seletor) => { await p.click(seletor); await parar(p); };

  test("a rede ocupa a tela à direita do menu, por trás da barra do topo, e acompanha o menu recolhido", async () => {
    const p = await abrirRede();
    const r = await caixa(p, ".rede");
    assert.deepEqual([r.x, r.y, r.width, r.height].map(Math.round), [264, 0, 1176, 860]);
    assert.equal(await p.evaluate(() => getComputedStyle(document.body).overflow), "hidden");
    await p.click(".botao-lateral");
    await p.waitForTimeout(400);
    assert.equal(Math.round((await caixa(p, ".rede")).x), 0);
    assert.deepEqual(p.erros, []);
  });

  test("rolar move a vista, sem mexer no zoom", async () => {
    const p = await abrirRede();
    await clicar(p, '[data-escala="normal"]');
    assert.equal(await zoom(p), 100);
    const antes = await caixa(p, ".rede-no");
    await p.mouse.move(800, 500);
    await p.mouse.wheel(0, 120);
    await p.waitForTimeout(350);
    const desceu = await caixa(p, ".rede-no");
    assert.equal(await zoom(p), 100, "o zoom não mudou");
    assert.equal(Math.round(desceu.y - antes.y), -120, "a rede subiu o que foi rolado");
    assert.equal(Math.round(desceu.x - antes.x), 0);
    await p.mouse.wheel(90, 0);
    await p.waitForTimeout(350);
    assert.equal(Math.round((await caixa(p, ".rede-no")).x - desceu.x), -90, "dois dedos para o lado movem para o lado");
    assert.equal(await p.evaluate(() => scrollY), 0, "a página não rolou");
    assert.deepEqual(p.erros, []);
  });

  test("Ctrl + rolar aproxima e afasta, com transição, mantendo o ponto sob o ponteiro", async () => {
    const p = await abrirRede();
    await clicar(p, '[data-escala="normal"]');
    const antes = await caixa(p, ".rede-no");
    const [ax, ay] = [antes.x + 30, antes.y + 20];
    await p.mouse.move(ax, ay);
    await p.keyboard.down("Control");
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(40);
    const meio = await zoom(p);
    for (let i = 0; i < 2; i++) await p.mouse.wheel(0, 100);
    await p.keyboard.up("Control");
    await parar(p);
    const depois = await caixa(p, ".rede-no");
    const f = depois.width / antes.width;
    assert.ok(await zoom(p) < 100, "afastou");
    assert.ok(meio > await zoom(p), "passou por valores intermediários (transição suave)");
    assert.ok(Math.abs(depois.x + 30 * f - ax) < 2 && Math.abs(depois.y + 20 * f - ay) < 2, "o ponto sob o ponteiro não saiu do lugar");
    assert.equal(await p.evaluate(() => scrollY), 0, "a página não rolou");
    assert.deepEqual(p.erros, []);
  });

  test("com Reduzir movimento, o zoom muda de uma vez", async () => {
    const p = await abrirRede();
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.click('[data-escala="normal"]');
    assert.equal(await zoom(p), 100);
    await p.click('[data-zoom-passo="1"]');
    assert.equal(await zoom(p), 125);
  });

  test("arrastar o fundo move a vista", async () => {
    const p = await abrirRede();
    const antes = await caixa(p, ".rede-no");
    await p.mouse.move(800, 760);
    await p.mouse.down();
    await p.mouse.move(700, 700, { steps: 6 });
    await p.mouse.up();
    const depois = await caixa(p, ".rede-no");
    assert.equal(Math.round(depois.x - antes.x), -100);
    assert.equal(Math.round(depois.y - antes.y), -60);
  });

  test("ajustar à tela cabe a rede na área livre dos controles; o valor em % volta a 100%", async () => {
    const p = await abrirRede();
    await clicar(p, '[data-escala="tudo"]');
    assert.ok(await zoom(p) < 100);
    const conteudo = await caixa(p, "[data-conteudo]");
    const controles = await caixa(p, "[data-rede-controles]");
    const legenda = await caixa(p, ".rede-legenda");
    const titulo = await caixa(p, ".topo"); // o nome do espaço fica na barra do topo desde a barra em abas (12/11/2026)
    assert.ok(conteudo.x >= 264 && conteudo.x + conteudo.width <= controles.x, "não passa por baixo dos botões");
    assert.ok(conteudo.y >= titulo.y + titulo.height && conteudo.y + conteudo.height <= legenda.y, "nem da barra do topo, nem da legenda");
    await clicar(p, '[data-escala="normal"]');
    assert.equal(await zoom(p), 100);
    await clicar(p, '[data-zoom-passo="1"]');
    assert.equal(await zoom(p), 125);
  });

  test("o ? abre e fecha a explicação", async () => {
    const p = await abrirRede({ tema: "dark" });
    const cartao = p.locator("[data-rede-ajuda-cartao]");
    assert.equal(await cartao.isVisible(), false);
    await p.click("[data-rede-ajuda]");
    assert.ok(await cartao.isVisible());
    await clicar(p, '[data-escala="tudo"]');
    assert.equal(await zoom(p) < 100, true, "com a explicação aberta, os demais botões seguem funcionando");
    await p.click("[data-rede-ajuda]");
    await p.waitForTimeout(400);
    assert.equal(await cartao.isVisible(), false);
    assert.deepEqual(p.erros, []);
  });
  /* ---------- ajustes da avaliação de 10/11/2026 ---------- */
  test("abre com o plano inteiro na tela e com o nome legível; os níveis de detalhe seguem o zoom", async () => {
    const p = await abrirRede();
    assert.ok(await zoom(p) < 100, "abre ajustada à tela");
    const v = await caixa(p, ".rede");
    const cantos = await p.locator(".rede-no, .rede-ponto").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }));
    for (const [l, r, t, b] of cantos) assert.ok(l >= v.x && r <= v.x + v.width && t >= v.y && b <= v.y + v.height, "tudo dentro da tela");
    const rede = p.locator("[data-rede]");
    assert.equal(await rede.getAttribute("data-detalhe"), "nome");
    assert.ok(!(await p.locator(".rede-base").first().isVisible()), "sem responsáveis e datas no nível do nome");
    const letra = await p.locator(".rede-rotulo").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize) * el.getBoundingClientRect().width / el.offsetWidth);
    assert.ok(letra >= 10, `nome legível na tela (${letra.toFixed(1)} px)`);
    await clicar(p, '[data-escala="normal"]');
    assert.equal(await rede.getAttribute("data-detalhe"), "completo");
    assert.ok(await p.locator(".rede-base").first().isVisible());
    for (let i = 0; i < 6; i++) await p.click('[data-zoom-passo="-1"]');
    await parar(p);
    assert.equal(await rede.getAttribute("data-detalhe"), "cor");
    assert.deepEqual(p.erros, []);
  });

  test("cores e legenda: término sem o vermelho do caminho crítico; ação liberada com a pílula da situação; ajuda em lista", async () => {
    const p = await abrirRede();
    await clicar(p, '[data-escala="normal"]');
    const cores = await p.evaluate(() => ({
      termino: getComputedStyle(document.querySelector(".rede-ponto.termino")).backgroundColor,
      critica: getComputedStyle(document.querySelector(".rede-seta")).stroke,
    }));
    assert.notEqual(cores.termino, cores.critica);
    assert.ok(await p.locator(".rede-no.agora .rede-agora").count() >= 1, "pílula nas ações liberadas");
    assert.equal(await p.locator(".rede-no.concluida .rede-agora").count(), 0);
    assert.match(await p.locator(".rede-legenda").innerText(), /pode ser feita agora[\s\S]*Etapa[\s\S]*Fim da fase/);
    await p.click("[data-rede-ajuda]");
    assert.ok(await p.locator(".rede-gestos li").count() >= 8, "um gesto por linha");
    assert.deepEqual(p.erros, []);
  });

  /* ---------- 11/11/2026: fundo branco, fases em faixas, índice de criticidade e acabamento ---------- */
  /* 12/11/2026: borda neutra, barra do indicador no cartão e setas num só matiz, sem cinza e sem graus */
  test("índice de criticidade: borda neutra, barra do indicador no cartão, setas contínuas num só matiz, legenda", async () => {
    const p = await abrirRede();
    await clicar(p, '[data-escala="normal"]');
    await p.click('.menu-topo[data-pop="painel"]');
    await p.locator('.popover [data-barra="execucao"]').first().click();
    await p.keyboard.press("Escape");
    /* o ponteiro fica onde estava a opção de Exibir, que cai sobre um cartão e destacaria as setas dele */
    await p.mouse.move(5, 5);
    await assentar(p);
    const nos = await p.locator(".rede-no.indice").evaluateAll((els) => els.map((e) => ({
      indice: Number(e.dataset.indice), borda: getComputedStyle(e.querySelector(".rede-cartao")).borderLeftColor,
      barra: e.querySelector(".rede-indicador .barra-medidor i")?.getBoundingClientRect().width ?? 0 })));
    assert.ok(nos.length >= 5, "ações não concluídas marcadas pelo índice");
    assert.equal(await p.locator(".rede-no.critica, .rede-no.folga").count(), 0, "sem as classes da folga onde há simulação");
    const bordas = await p.locator(".rede-no.indice:not(.agora) .rede-cartao").evaluateAll((els) => els.map((e) => getComputedStyle(e).borderLeftColor));
    assert.equal(new Set(bordas).size, 1, "a borda é a mesma em todas as não liberadas: sem limiar");
    const larguras = await p.locator(".rede-no:not(.agora) .rede-cartao").evaluateAll((els) => els.map((e) => getComputedStyle(e).borderLeftWidth));
    assert.ok(larguras.every((w) => w === "1px"), "sem a faixa lateral");
    const [menor, maior] = [nos.reduce((a, b) => (b.indice < a.indice ? b : a)), nos.reduce((a, b) => (b.indice > a.indice ? b : a))];
    assert.ok(maior.indice > menor.indice && maior.barra > menor.barra, "índice maior, barra maior");
    const setas = await p.locator(".rede-seta.indice").evaluateAll((els) => els.map((e) => ({ v: Number(e.dataset.indice), cor: getComputedStyle(e).stroke, largura: parseFloat(getComputedStyle(e).strokeWidth) })));
    const [fraca, forte] = [setas.reduce((a, b) => (b.v < a.v ? b : a)), setas.reduce((a, b) => (b.v > a.v ? b : a))];
    assert.ok(forte.v > fraca.v && forte.cor !== fraca.cor && forte.largura > fraca.largura, "seta mais forte e mais grossa onde o índice é maior");
    assert.equal(await p.locator(".rede-seta.critica, [class*='grau-']").count(), 0, "sem o vermelho e sem graus");
    const legenda = await p.locator(".rede-legenda").innerText();
    assert.match(legenda, /Quanto maior a barra, mais pesa no prazo/);
    assert.match(legenda, /Quanto mais forte a seta, mais pesa no prazo/);
    assert.doesNotMatch(legenda, /Sem folga/);
    assert.match(await p.locator(".rede-no.indice .rede-cartao").first().getAttribute("title"), /Índice de criticidade: \d+%/);
    assert.match(await p.locator(".rede-no.indice .rede-data small").first().innerText(), /folga/, "a folga em dias continua no cartão");
    assert.deepEqual(p.erros, []);
  });

  test("a barra do cartão segue o indicador em Exibir; Nenhum a tira; de longe, fica só a barra", async () => {
    const p = await abrirRede();
    await clicar(p, '[data-escala="normal"]');
    const escolher = async (v) => {
      if (!(await p.locator(".popover [data-barra]").first().isVisible())) await p.click('.menu-topo[data-pop="painel"]');
      await p.locator(`.popover [data-barra="${v}"]`).first().click();
      await assentar(p);
    };
    await escolher("revisao");
    assert.ok(await p.locator('.rede-indicador[data-indicador="revisao"] .barra-icone.revisao').count() >= 1);
    assert.match(await p.locator(".rede-legenda").innerText(), /mais pesa na incerteza do prazo/);
    assert.equal(await p.locator(".rede-seta.indice").count(), 0, "fora do índice de criticidade, setas uniformes");
    assert.equal(new Set(await p.locator(".rede-seta:not(.volta)").evaluateAll((els) => els.map((e) => getComputedStyle(e).stroke))).size, 1);
    assert.doesNotMatch(await p.locator(".rede-legenda").innerText(), /mais forte a seta/);
    await escolher("tempo");
    assert.ok(await p.locator('.rede-indicador[data-indicador="tempo"] .prazo-barra').count() >= 1, "tempo restante, como na lista");
    assert.doesNotMatch(await p.locator(".rede-legenda").innerText(), /Quanto maior a barra/);
    /* na Rede, o tempo restante é sempre em dias úteis: a data já está no cartão */
    assert.equal(await p.locator(".popover [data-tempo-num]").count(), 0, "sem a escolha dias/data na Rede");
    assert.equal(await p.locator(".rede-indicador .prazo-num.data").count(), 0);
    /* "Nenhum" (12/11/2026): sem barra no cartão e setas uniformes */
    await escolher("nenhum");
    assert.equal(await p.locator(".rede-indicador .barra-icone, .rede-indicador .prazo-barra").count(), 0, "sem barra");
    assert.equal(await p.locator(".rede-seta.indice").count(), 0);
    assert.equal(await p.locator('.menu-topo[data-pop="indicador"]').count(), 0, "sem o menu Indicador no topo");
    await escolher("execucao");
    await p.keyboard.press("Escape");
    for (let i = 0; i < 6; i++) await p.click('[data-zoom-passo="-1"]');
    await parar(p);
    const longe = p.locator(".rede-no.indice .rede-indicador").first();
    assert.ok(await longe.locator(".barra-medidor").isVisible(), "a barra continua de longe");
    assert.ok(!(await longe.locator(".num").isVisible()), "sem o número de longe");
    /* liberadas: o alvo a procurar; de longe, fundo e contorno do destaque */
    const [livre, outra] = await p.evaluate(() => [".rede-no.agora .rede-cartao", ".rede-no:not(.agora):not(.concluida) .rede-cartao"]
      .map((sel) => { const c = getComputedStyle(document.querySelector(sel)); return { fundo: c.backgroundColor, borda: parseFloat(c.borderTopWidth) }; }));
    assert.notEqual(livre.fundo, outra.fundo, "a liberada tem fundo próprio de longe");
    assert.ok(livre.borda > outra.borda, "e contorno mais grosso");
    assert.deepEqual(p.erros, []);
  });

  test("fundo branco no tema claro; datas na letra do cartão; responsáveis sem cobrir a data", async () => {
    const p = await abrirRede();
    await clicar(p, '[data-escala="normal"]');
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".rede")).backgroundColor), "rgb(255, 255, 255)");
    const [data, nome] = await p.evaluate(() => [".rede-data .mono", ".rede-rotulo"].map((s) => getComputedStyle(document.querySelector(s)).fontFamily));
    assert.equal(data, nome, "a data usa a mesma letra do nome");
    const livres = await p.locator(".rede-base").evaluateAll((els) => els.every((b) => b.querySelector(".donos").getBoundingClientRect().right <= b.querySelector(".rede-data").getBoundingClientRect().left + 1));
    assert.ok(livres, "os responsáveis não passam por cima da data");
    const escuro = await abrirRede({ tema: "dark" });
    assert.notEqual(await escuro.evaluate(() => getComputedStyle(document.querySelector(".rede")).backgroundColor), "rgb(255, 255, 255)");
  });

  test("fases em faixas: régua fixa com o nome no meio do trecho visível; nenhuma ação na faixa de outra fase", async () => {
    const p = await abrirRede();
    const faixas = async () => p.locator(".rede-fase-faixa:not([hidden])").evaluateAll((els) => els.map((e) => {
      const [f, n] = [e.getBoundingClientRect(), e.querySelector(".rede-fase-nome").getBoundingClientRect()];
      return { nome: e.textContent.trim(), l: f.left, r: f.right, meio: n.left + n.width / 2, topo: f.top };
    }));
    const todas = await faixas();
    assert.deepEqual(todas.map((f) => f.nome), ["Fase 1 · Planejamento", "Fase 2 · Execução", "Fase 3 · Entrega"]);
    for (const f of todas) assert.ok(Math.abs(f.meio - (f.l + f.r) / 2) < 2, "nome centralizado na faixa");
    /* cada cartão dentro da faixa da fase da sua etapa (o nome da cerca começa por "Etapa F.E") */
    const cartoes = await p.locator(".rede-no").evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      const cerca = [...document.querySelectorAll(".rede-cerca")].find((c) => { const q = c.getBoundingClientRect(); return r.left >= q.left && r.right <= q.right && r.top >= q.top && r.bottom <= q.bottom; });
      return { fase: cerca?.querySelector(".rede-cerca-nome").textContent.trim().match(/Etapa (\d)/)?.[1], l: r.left, r: r.right };
    }));
    assert.ok(cartoes.length >= 12);
    for (const c of cartoes) {
      const f = todas[Number(c.fase) - 1];
      assert.ok(c.l >= f.l - 1 && c.r <= f.r + 1, `ação da fase ${c.fase} dentro da faixa dela`);
    }
    /* rolando, a régua não sai do lugar e o nome segue à vista */
    await clicar(p, '[data-escala="normal"]');
    const topo = (await faixas())[0].topo;
    await p.mouse.move(800, 500);
    await p.mouse.wheel(300, 200);
    await p.waitForTimeout(350);
    const depois = await faixas();
    assert.equal(Math.round(depois[0].topo), Math.round(topo), "a régua fica no alto, mesmo rolando para baixo");
    const v = await caixa(p, ".rede");
    for (const f of depois) assert.ok(f.meio > v.x && f.meio < v.x + v.width, "o nome da fase visível está dentro da tela");
    assert.deepEqual(p.erros, []);
  });

  test("a régua das fases acompanha a altura da barra do topo (nome do espaço e largura da janela)", async () => {
    const p = await abrirRede();
    const distancia = () => p.evaluate(() => document.querySelector("[data-fases-topo]").getBoundingClientRect().top - document.querySelector(".topo").getBoundingClientRect().bottom);
    const inicial = await distancia();
    assert.ok(inicial >= 0 && inicial <= 14, `régua logo abaixo da barra (${inicial})`);
    const alternarNome = async () => {
      await p.click(".topo", { button: "right", position: { x: 700, y: 20 } });
      await p.waitForTimeout(300);
      await p.click("[data-nome-barra]");
      await p.waitForTimeout(400);
    };
    await alternarNome(); // esconde o nome: a barra fica numa linha só
    assert.equal(Math.round(await distancia()), Math.round(inicial), "sem vão ao esconder o nome do espaço");
    await alternarNome(); // mostra de novo: a régua não fica atrás da barra
    assert.equal(Math.round(await distancia()), Math.round(inicial), "visível ao mostrar o nome do espaço");
    await p.setViewportSize({ width: 520, height: 800 }); // janela estreita: barra do celular
    await p.waitForTimeout(500);
    const estreita = await distancia();
    assert.ok(estreita >= 0 && estreita <= 14, `régua logo abaixo da barra na janela estreita (${estreita})`);
    assert.deepEqual(p.erros, []);
  });

  test("no celular, a Rede é só de consulta: sem edição, e tocar numa ação a abre", async () => {
    const p = await sessao.abrir({ largura: 390, altura: 800 });
    await p.locator('.barra-inferior button:has-text("Filtros")').click();
    await p.waitForTimeout(450);
    await p.locator('[data-modo="rede"]').last().click();
    await p.waitForSelector(".rede-no");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(600);
    assert.equal(await p.locator(".rede.rede-editavel").count(), 0, "sem edição no celular");
    assert.ok(await zoom(p) >= 50, "abre legível, a partir do início");
    const [controles, barra] = await Promise.all([caixa(p, "[data-rede-controles]"), caixa(p, ".barra-inferior")]);
    assert.ok(controles.y + controles.height <= barra.y, "botões acima da barra de baixo");
    await p.locator(".rede-no .rede-cartao").first().tap();
    await p.waitForTimeout(600);
    assert.ok(await p.locator(".camada.aberta").count() >= 1, "tocar abre a ação");
    assert.deepEqual(p.erros, []);
  });
});
