/**
 * Rede em tela cheia, navegada como um mapa (09/11/2026, pedido do responsável; documentação técnica, seção 8.4):
 * a Rede ocupa a área à direita do menu lateral, por trás da barra do topo; rolar o mouse aproxima e afasta em volta
 * do ponteiro; arrastar o fundo move a vista; os botões flutuantes ajustam à tela, voltam a 100% e explicam o uso.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Rede: navegação como num mapa", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const abrirRede = async (o = {}) => {
    const p = await sessao.abrir({ largura: 1440, altura: 860, ...o });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="rede"]').first().click();
    await p.waitForSelector(".rede-no");
    await assentar(p);
    return p;
  };
  const zoom = async (p) => Number((await p.locator("[data-zoom-valor]").textContent()).replace("%", ""));
  const caixa = (p, seletor) => p.locator(seletor).first().boundingBox();

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

  test("rolar o mouse aproxima e afasta, sem Ctrl, mantendo o ponto sob o ponteiro", async () => {
    const p = await abrirRede();
    await p.click('[data-escala="normal"]');
    assert.equal(await zoom(p), 100);
    const antes = await caixa(p, ".rede-no");
    const [ax, ay] = [antes.x + 30, antes.y + 20];
    await p.mouse.move(ax, ay);
    for (let i = 0; i < 3; i++) await p.mouse.wheel(0, 100);
    await p.waitForTimeout(100);
    const depois = await caixa(p, ".rede-no");
    const f = depois.width / antes.width;
    assert.ok(await zoom(p) < 100, "afastou");
    assert.ok(Math.abs(depois.x + 30 * f - ax) < 2 && Math.abs(depois.y + 20 * f - ay) < 2, "o ponto sob o ponteiro não saiu do lugar");
    assert.equal(await p.evaluate(() => scrollY), 0, "a página não rolou");
    assert.deepEqual(p.erros, []);
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
    await p.click('[data-escala="tudo"]');
    await assentar(p);
    assert.ok(await zoom(p) < 100);
    const conteudo = await caixa(p, "[data-conteudo]");
    const controles = await caixa(p, "[data-rede-controles]");
    const legenda = await caixa(p, ".rede-legenda");
    const titulo = await caixa(p, "#principal .titulo-conteudo");
    assert.ok(conteudo.x >= 264 && conteudo.x + conteudo.width <= controles.x, "não passa por baixo dos botões");
    assert.ok(conteudo.y >= titulo.y + titulo.height && conteudo.y + conteudo.height <= legenda.y, "nem do título, nem da legenda");
    await p.click('[data-escala="normal"]');
    assert.equal(await zoom(p), 100);
    await p.click('[data-zoom-passo="1"]');
    assert.equal(await zoom(p), 125);
  });

  test("o ? abre e fecha a explicação", async () => {
    const p = await abrirRede({ tema: "dark" });
    const cartao = p.locator("[data-rede-ajuda-cartao]");
    assert.equal(await cartao.isVisible(), false);
    await p.click("[data-rede-ajuda]");
    assert.ok(await cartao.isVisible());
    await p.click('[data-escala="tudo"]');
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
    await p.click('[data-escala="normal"]');
    assert.equal(await rede.getAttribute("data-detalhe"), "completo");
    assert.ok(await p.locator(".rede-base").first().isVisible());
    for (let i = 0; i < 6; i++) await p.click('[data-zoom-passo="-1"]');
    assert.equal(await rede.getAttribute("data-detalhe"), "cor");
    assert.deepEqual(p.erros, []);
  });

  test("cores e legenda: término sem o vermelho de sem folga; ação liberada com a pílula da situação; ajuda em lista", async () => {
    const p = await abrirRede();
    await p.click('[data-escala="normal"]');
    const cores = await p.evaluate(() => ({
      termino: getComputedStyle(document.querySelector(".rede-ponto.termino")).backgroundColor,
      critica: getComputedStyle(document.querySelector(".rede-seta.critica")).stroke,
    }));
    assert.notEqual(cores.termino, cores.critica);
    assert.ok(await p.locator(".rede-no.agora .rede-agora").count() >= 1, "pílula nas ações liberadas");
    assert.equal(await p.locator(".rede-no.concluida .rede-agora").count(), 0);
    assert.match(await p.locator(".rede-legenda").innerText(), /pode ser feita agora[\s\S]*Etapa[\s\S]*Fim da fase/);
    await p.click("[data-rede-ajuda]");
    assert.ok(await p.locator(".rede-gestos li").count() >= 8, "um gesto por linha");
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
    assert.equal(await p.locator(".rede.editavel").count(), 0, "sem edição no celular");
    assert.ok(await zoom(p) >= 50, "abre legível, a partir do início");
    const [controles, barra] = await Promise.all([caixa(p, "[data-rede-controles]"), caixa(p, ".barra-inferior")]);
    assert.ok(controles.y + controles.height <= barra.y, "botões acima da barra de baixo");
    await p.locator(".rede-no .rede-cartao").first().tap();
    await p.waitForTimeout(600);
    assert.ok(await p.locator(".camada.aberta").count() >= 1, "tocar abre a ação");
    assert.deepEqual(p.erros, []);
  });
});
