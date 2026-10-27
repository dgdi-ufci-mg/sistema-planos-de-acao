/**
 * Celular, no navegador (avaliação de celular de 25/10/2026; documentação técnica, seções 8.7 e 3.2).
 * Tela de 390 × 800 px, com toque, sobre o exemplo, só na memória.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, camadasAbertas, dedo, centro } from "./apoio.mjs";

describe("Celular no navegador", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  /** Primeiro cartão de ação que ainda pode ser concluído (sem a marca de feita). */
  const cartaoLiberado = (p) => p.locator(".item:not(.feita) .linha[data-abrir-acao]").first();

  test("barra de baixo no celular, com Espaços, Buscar, (+), Filtros e Ajuda; sem ela no tablet", async () => {
    const p = await sessao.abrir();
    const barra = p.locator(".barra-inferior");
    assert.ok(await barra.isVisible());
    for (const chave of ["espacos", "buscar", "nova", "filtros", "ajuda"]) {
      assert.ok(await barra.locator(`[data-inferior="${chave}"]`).isVisible(), `falta ${chave}`);
    }
    const tablet = await sessao.abrir({ largura: 700 });
    assert.equal(await tablet.locator(".barra-inferior").isVisible(), false);
    assert.deepEqual([...p.erros, ...tablet.erros], []);
  });

  test("alvos de toque de pelo menos 44 px na barra de baixo", async () => {
    const p = await sessao.abrir();
    for (const b of await p.locator(".barra-inferior [data-inferior]:visible").all()) {
      const r = await b.boundingBox();
      assert.ok(r.height >= 44, `altura ${r.height}`);
    }
  });

  test("faixa do prazo no alto da lista abre a Linha do tempo", async () => {
    const p = await sessao.abrir();
    const faixa = p.locator(".resumo-prazo");
    assert.match(await faixa.innerText(), /Conclusão prevista/);
    await faixa.click();
    await assentar(p);
    assert.equal(await p.locator(".resumo-prazo").count(), 0);
    assert.match(await p.locator("#principal").innerText(), /Data segura|data segura/);
  });

  test("Voltar fecha \"Filtros e exibição\" e continua no espaço", async () => {
    const p = await sessao.abrir();
    const endereco = p.url();
    await p.click('[data-inferior="filtros"]');
    await assentar(p);
    assert.equal(await camadasAbertas(p), 1);
    await p.goBack();
    await assentar(p);
    assert.equal(await camadasAbertas(p), 0);
    assert.equal(p.url(), endereco);
  });

  test("Voltar fecha a janela da ação e não sai do sistema", async () => {
    const p = await sessao.abrir();
    const endereco = p.url();
    await cartaoLiberado(p).click();
    await assentar(p);
    assert.equal(await p.locator(".camada.janela.aberta").count(), 1);
    await p.goBack();
    await assentar(p);
    assert.equal(await camadasAbertas(p), 0);
    assert.equal(p.url(), endereco);
    /* fechar pelo botão devolve a entrada do histórico: um Voltar depois não deve "sobrar" */
    await cartaoLiberado(p).click();
    await assentar(p);
    await p.locator(".camada.aberta .painel > header [data-fechar]").click();
    await assentar(p);
    assert.equal(await p.evaluate(() => history.state?.sextanteCamada ?? false), false);
  });

  test("Voltar depois de trocar de espaço reabre o espaço anterior", async () => {
    const p = await sessao.abrir();
    const primeiro = p.url();
    await p.click('[data-inferior="espacos"]');
    await assentar(p);
    await p.locator(".lateral [data-espaco]").first().click();
    await p.waitForURL((u) => u.href !== primeiro);
    await assentar(p);
    assert.notEqual(p.url(), primeiro);
    await p.goBack();
    await p.waitForURL(primeiro);
    await assentar(p);
    assert.equal(p.url(), primeiro);
    assert.deepEqual(p.erros, []);
  });

  test("segurar o cartão abre o menu do cartão", async () => {
    const p = await sessao.abrir();
    const { x, y } = await centro(cartaoLiberado(p));
    const d = await dedo(p);
    /* O Chromium sem tela não reconhece o toque longo e gera um clique ao soltar o dedo, que cai no fundo escurecido
       do menu recém-aberto. No Android o toque longo não gera esse clique; por isso o teste confere o menu com o dedo
       ainda na tela (ver documentação, seção 3.2). */
    await d.encostar(x, y);
    await p.waitForTimeout(700);
    await assentar(p, 300);
    const menu = p.locator(".camada.aberta .menu-cartao");
    assert.equal(await menu.count(), 1);
    assert.match(await menu.innerText(), /Abrir/);
    await d.cancelar();
  });

  test("deslizar o cartão para a direita abre o registro da conclusão; para a esquerda, o menu", async () => {
    const p = await sessao.abrir();
    const d = await dedo(p);
    let { x, y } = await centro(cartaoLiberado(p));
    await d.arrastar(x - 100, y, 150, 0);
    await assentar(p);
    assert.equal(await p.locator(".camada.janela.aberta").count(), 1, "a janela da ação abre");
    assert.match(await p.locator(".camada.janela.aberta").innerText(), /conclus/i);
    await p.goBack();
    await assentar(p);
    ({ x, y } = await centro(cartaoLiberado(p)));
    await d.arrastar(x + 100, y, -150, 0);
    await assentar(p);
    assert.equal(await p.locator(".camada.aberta .menu-cartao").count(), 1);
  });

  test("deslizar na vertical rola a lista, sem abrir nada", async () => {
    const p = await sessao.abrir();
    const d = await dedo(p);
    const { x, y } = await centro(cartaoLiberado(p));
    await d.arrastar(x, y, 4, -150);
    await assentar(p);
    assert.equal(await camadasAbertas(p), 0);
  });

  test("puxar a janela para baixo fecha; puxar pouco, não", async () => {
    const p = await sessao.abrir();
    const d = await dedo(p);
    await cartaoLiberado(p).click();
    await assentar(p);
    const alca = p.locator(".camada.aberta .alca");
    let { x, y } = await centro(alca);
    await d.arrastar(x, y, 0, 40);
    await assentar(p);
    assert.equal(await camadasAbertas(p), 1, "puxando 40 px, a janela volta ao lugar");
    ({ x, y } = await centro(alca));
    await d.arrastar(x, y, 0, 200);
    await assentar(p);
    assert.equal(await camadasAbertas(p), 0, "puxando 200 px, a janela fecha");
  });

  test("com o teclado aberto, \"Criar ação\" fica acima dele", async () => {
    const p = await sessao.abrir();
    await p.click('[data-inferior="nova"]');
    await assentar(p);
    /* teclado de 320 px simulado: a área visível do navegador encolhe (visualViewport), como no iPhone */
    await p.evaluate(() => {
      const altura = innerHeight - 320;
      Object.defineProperty(visualViewport, "height", { configurable: true, get: () => altura });
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await assentar(p);
    assert.equal(await p.evaluate(() => document.documentElement.style.getPropertyValue("--teclado")), "320px");
    const criar = p.locator(".camada.aberta").getByRole("button", { name: /^Criar/ });
    const r = await criar.boundingBox();
    assert.ok(r.y + r.height <= 800 - 320, `o botão termina em ${Math.round(r.y + r.height)} px, atrás do teclado`);
  });

  test("campos de digitar com 16 px no toque (sem o zoom do iPhone)", async () => {
    const p = await sessao.abrir();
    await p.click('[data-inferior="nova"]');
    await assentar(p);
    const tamanhos = await p.locator(".camada.aberta").locator("input:visible, textarea:visible, select:visible")
      .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
    assert.ok(tamanhos.length > 0);
    for (const t of tamanhos) assert.ok(t >= 16, `campo com ${t} px`);
  });
});
