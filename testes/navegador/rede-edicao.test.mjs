/**
 * Edição dentro da Rede (09/11/2026, pedido do responsável; documentação técnica, seção 8.4): clique seleciona,
 * o "+" cria a próxima ação já ligada e com o nome aberto, a bolinha arrastada liga duas ações, Delete numa seta
 * a retira, duplo clique renomeia e Enter abre a ação.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, centro } from "./apoio.mjs";

const SCREENSHOTS = process.env.REDE_CAPTURAS ?? null;

describe("Rede: edição fluida", { skip: pular }, () => {
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
  const setas = (p) => p.locator(".rede-seta").count();

  test("clique seleciona sem abrir; Enter abre", async () => {
    const p = await abrirRede();
    const primeiro = p.locator(".rede-no").first();
    await primeiro.locator(".rede-cartao").click();
    await assentar(p);
    assert.ok(await primeiro.evaluate((el) => el.classList.contains("selecionada")));
    assert.equal(await p.locator(".janela-acao, [role=dialog].aberta").count(), 0, "o clique não abre a janela");
    assert.ok(await primeiro.locator(".rede-mais").isVisible());
    if (SCREENSHOTS) await p.screenshot({ path: `${SCREENSHOTS}/1-selecao.png` });
    await p.keyboard.press("Enter");
    await assentar(p);
    assert.ok(await p.locator(".camada.aberta").count() >= 1, "Enter abre a ação");
    assert.deepEqual(p.erros, []);
  });

  test("o + cria a próxima ação ligada, com o nome aberto para digitar", async () => {
    const p = await abrirRede();
    const antes = await p.locator(".rede-no").count();
    const setasAntes = await setas(p);
    const origem = p.locator(".rede-no").first();
    const numeroOrigem = Number(await origem.getAttribute("data-numero"));
    await origem.locator(".rede-cartao").click();
    await origem.locator(".rede-mais").click();
    await p.waitForFunction((n) => document.querySelectorAll(".rede-no").length > n, antes);
    await p.waitForSelector(".rede [data-editando]");
    await p.keyboard.type("Revisar o texto final");
    await p.keyboard.press("Enter");
    await assentar(p);
    const nova = p.locator(".rede-no", { hasText: "Revisar o texto final" });
    assert.equal(await nova.count(), 1);
    const numeroNova = Number(await nova.getAttribute("data-numero"));
    assert.equal(await p.locator(`.rede-seta[data-de="${numeroOrigem}"][data-para="${numeroNova}"]`).count(), 1, "já vem ligada à de origem");
    assert.ok(await setas(p) > setasAntes);
    assert.ok(await nova.evaluate((el) => el.classList.contains("selecionada")), "a nova fica selecionada");
    if (SCREENSHOTS) await p.screenshot({ path: `${SCREENSHOTS}/2-nova.png` });
    assert.deepEqual(p.erros, []);
  });

  test("arrastar a bolinha até outro cartão cria a ligação; Delete na seta a retira", async () => {
    const p = await abrirRede();
    /* duas ações sem ligação entre elas: a primeira e a última sem caminho de volta */
    /* só ações visíveis na tela, para o arrasto alcançá-las */
    const nos = await p.locator(".rede-no").evaluateAll((els) => {
      const v = document.querySelector("[data-rede-rolagem]").getBoundingClientRect();
      return els.filter((e) => { const r = e.getBoundingClientRect(); return r.left > v.left + 60 && r.right < v.right - 60 && r.top > v.top && r.bottom < v.bottom; })
        .map((e) => Number(e.dataset.numero));
    });
    const existe = async (de, para) => (await p.locator(`.rede-seta[data-de="${de}"][data-para="${para}"]`).count()) > 0;
    let par = null;
    for (const de of nos) {
      for (const para of [...nos].reverse()) {
        if (de !== para && !(await existe(de, para)) && !(await existe(para, de))) { par = [de, para]; break; }
      }
      if (par) break;
    }
    assert.ok(par, "há um par sem ligação");
    const [de, para] = par;
    const origem = p.locator(`.rede-no[data-numero="${de}"]`);
    await origem.hover();
    await assentar(p, 250);
    const alca = await centro(origem.locator(".rede-alca"));
    const destino = await centro(p.locator(`.rede-no[data-numero="${para}"] .rede-cartao`));
    await p.mouse.move(alca.x, alca.y);
    await p.mouse.down();
    await p.mouse.move((alca.x + destino.x) / 2, (alca.y + destino.y) / 2, { steps: 6 });
    await p.mouse.move(destino.x, destino.y, { steps: 6 });
    if (SCREENSHOTS) await p.screenshot({ path: `${SCREENSHOTS}/3-ligando.png` });
    await p.mouse.up();
    await p.waitForSelector(`.rede-seta[data-de="${de}"][data-para="${para}"]`);
    await assentar(p);
    /* seleciona a seta pela área de clique e apaga */
    await p.locator(`.rede-seta-alvo[data-seta-de="${de}"][data-seta-para="${para}"]`).evaluate((el) => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.ok(await p.locator(`.rede-seta[data-de="${de}"][data-para="${para}"]`).evaluate((el) => el.classList.contains("selecionada")));
    await p.keyboard.press("Delete");
    await p.waitForFunction(([a, b]) => !document.querySelector(`.rede-seta[data-de="${a}"][data-para="${b}"]`), [de, para]);
    assert.deepEqual(p.erros, []);
  });

  test("o + no meio de uma seta insere uma ação entre as duas (A → nova → B)", async () => {
    const p = await abrirRede();
    /* uma seta com as duas pontas visíveis */
    const [de, para] = await p.evaluate(() => {
      const v = document.querySelector("[data-rede-rolagem]").getBoundingClientRect();
      const dentro = (el) => { const r = el.getBoundingClientRect(); return r.left > v.left && r.right < v.right && r.top > v.top && r.bottom < v.bottom; };
      const no = (n) => document.querySelector(`.rede-no[data-numero="${n}"]`);
      /* na mesma etapa: entre etapas diferentes, a pessoa escolhe a etapa (teste próprio) */
      const s = [...document.querySelectorAll(".rede-seta")].find((el) => dentro(el) && dentro(no(el.dataset.de)) && dentro(no(el.dataset.para))
        && no(el.dataset.de).dataset.etapa === no(el.dataset.para).dataset.etapa);
      return [Number(s.dataset.de), Number(s.dataset.para)];
    });
    const botao = p.locator(`[data-inserir-de="${de}"][data-inserir-para="${para}"]`);
    assert.equal(await botao.evaluate((el) => getComputedStyle(el).opacity), "0", "escondido até passar o mouse");
    await p.locator(`.rede-seta-alvo[data-seta-de="${de}"][data-seta-para="${para}"]`).dispatchEvent("pointerover");
    await assentar(p, 250);
    assert.ok(await botao.isVisible());
    if (SCREENSHOTS) await p.screenshot({ path: `${SCREENSHOTS}/5-inserir.png` });
    await botao.click();
    await p.waitForSelector(".rede [data-editando]");
    await p.keyboard.type("Etapa intermediária");
    await p.keyboard.press("Enter");
    await assentar(p);
    const nova = Number(await p.locator(".rede-no", { hasText: "Etapa intermediária" }).getAttribute("data-numero"));
    const existe = (a, b) => p.locator(`.rede-seta[data-de="${a}"][data-para="${b}"]`).count();
    assert.equal(await existe(de, nova), 1, "origem → nova");
    assert.equal(await existe(nova, para), 1, "nova → chegada");
    assert.equal(await existe(de, para), 0, "a ligação direta saiu");
    if (SCREENSHOTS) await p.screenshot({ path: `${SCREENSHOTS}/6-inserida.png` });
    assert.deepEqual(p.erros, []);
  });

  test("seta selecionada: Enter insere uma ação no meio", async () => {
    const p = await abrirRede();
    const s = p.locator(".rede-seta-alvo").first();
    const [de, para] = [Number(await s.getAttribute("data-seta-de")), Number(await s.getAttribute("data-seta-para"))];
    await s.evaluate((el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await p.keyboard.press("Enter");
    if (await p.locator(".rede-escolha").count()) await p.keyboard.press("Enter"); // etapas diferentes: a primeira opção
    await p.waitForSelector(".rede [data-editando]");
    await p.keyboard.press("Enter");
    await assentar(p);
    assert.equal(await p.locator(`.rede-seta[data-de="${de}"][data-para="${para}"]`).count(), 0);
    assert.deepEqual(p.erros, []);
  });

  test("entre etapas diferentes, a caixa da nova ação aparece e a pessoa escolhe a etapa", async () => {
    const p = await abrirRede();
    const [de, para, etapaPara] = await p.evaluate(() => {
      const no = (n) => document.querySelector(`.rede-no[data-numero="${n}"]`);
      const s = [...document.querySelectorAll(".rede-seta")].find((el) => no(el.dataset.de).dataset.etapa !== no(el.dataset.para).dataset.etapa);
      return [Number(s.dataset.de), Number(s.dataset.para), no(s.dataset.para).dataset.etapa];
    });
    await p.locator(`[data-inserir-de="${de}"][data-inserir-para="${para}"]`).evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
    await p.locator(`.rede-seta-alvo[data-seta-de="${de}"][data-seta-para="${para}"]`).dispatchEvent("pointerover");
    await assentar(p, 250);
    await p.locator(`[data-inserir-de="${de}"][data-inserir-para="${para}"]`).click();
    await p.waitForSelector(".rede-escolha .rede-fantasma");
    assert.equal(await p.locator(".rede-escolha [data-escolher-etapa]").count(), 2);
    if (SCREENSHOTS) { await assentar(p, 250); await p.screenshot({ path: `${SCREENSHOTS}/7-escolha.png` }); }
    await p.locator(`.rede-escolha [data-escolher-etapa="${etapaPara}"]`).click();
    await p.waitForSelector(".rede [data-editando]");
    await p.keyboard.type("Na etapa de chegada");
    await p.keyboard.press("Enter");
    await p.waitForSelector(".rede-estimar"); // a caixinha de prazos abre em seguida
    await p.keyboard.press("Escape");
    await assentar(p);
    const nova = p.locator(".rede-no", { hasText: "Na etapa de chegada" });
    assert.equal(await nova.getAttribute("data-etapa"), etapaPara);
    assert.deepEqual(p.erros, []);
  });

  test("a ação nova nasce no ponto do + e desliza até o lugar; as outras deslizam também", async () => {
    const p = await abrirRede();
    await p.evaluate(() => {
      window.__movimento = { nasceu: false, deslizou: false };
      new MutationObserver((ms) => {
        for (const m of ms) {
          const el = m.target;
          if (!(el instanceof HTMLElement) || !el.classList.contains("rede-no")) continue;
          if (/scale\(/.test(el.style.transform)) window.__movimento.nasceu = true;
          else if (/translate\(/.test(el.style.transform)) window.__movimento.deslizou = true;
        }
      }).observe(document.querySelector("[data-lista]") ?? document.body, { subtree: true, attributes: true, attributeFilter: ["style"], childList: true });
    });
    const origem = p.locator(".rede-no").first();
    await origem.locator(".rede-cartao").click();
    await origem.locator(".rede-mais").click();
    await p.waitForSelector(".rede [data-editando]");
    const mov = await p.evaluate(() => window.__movimento);
    assert.ok(mov.nasceu, "a nova começa pequena no ponto do +");
    assert.ok(mov.deslizou, "as que mudaram de lugar deslizam");
    await assentar(p, 1100);
    assert.equal(await p.locator(".rede-no[style*='transform']").count(), 0, "no fim, ninguém fica deslocado");
    assert.deepEqual(p.erros, []);
  });

  test("caixinha de prazos ao lado do cartão, logo depois do nome", async () => {
    const p = await abrirRede();
    const origem = p.locator(".rede-no").first();
    await origem.locator(".rede-cartao").click();
    await origem.locator(".rede-mais").click();
    await p.waitForSelector(".rede [data-editando]");
    await p.keyboard.type("Com prazo");
    await p.keyboard.press("Enter");
    await p.waitForSelector(".rede-estimar input[name=o]:focus");
    await assentar(p, 300); // fim da entrada da caixa
    const [caixa, cartao] = await Promise.all([p.locator(".rede-estimar").boundingBox(), p.locator(".rede-no", { hasText: "Com prazo" }).boundingBox()]);
    assert.ok(Math.abs(caixa.x - cartao.x) < 2 && (caixa.y >= cartao.y + cartao.height || caixa.y + caixa.height <= cartao.y), "encostada ao cartão");
    if (SCREENSHOTS) await p.screenshot({ path: `${SCREENSHOTS}/8-prazo.png` });
    /* fora de ordem: erro na própria caixa */
    await p.keyboard.type("5");
    await p.keyboard.press("Tab");
    await p.keyboard.type("3");
    await p.keyboard.press("Tab");
    await p.keyboard.type("8");
    await p.keyboard.press("Enter");
    await p.waitForSelector(".rede-estimar-erro:not([hidden])");
    await p.locator(".rede-estimar input[name=o]").fill("2");
    await p.locator(".rede-estimar input[name=p]").press("Enter");
    await p.waitForFunction(() => !document.querySelector(".rede-estimar"));
    await assentar(p);
    const texto = await p.locator(".rede-no", { hasText: "Com prazo" }).innerText();
    assert.doesNotMatch(texto, /Falta estimar/);
    assert.deepEqual(p.erros, []);
  });

  test("botão direito: menu no cartão e na seta", async () => {
    const p = await abrirRede();
    const no = p.locator(".rede-no").nth(1);
    const numero = await no.getAttribute("data-numero");
    await no.locator(".rede-cartao").click({ button: "right" });
    await p.waitForSelector(".rede-menu");
    const itens = await p.locator(".rede-menu [role=menuitem]").allInnerTexts();
    assert.ok(itens.some((t) => /Abrir/.test(t)) && itens.some((t) => /Renomear/.test(t)) && itens.some((t) => /depois desta/.test(t)));
    if (SCREENSHOTS) { await assentar(p, 250); await p.screenshot({ path: `${SCREENSHOTS}/9-menu.png` }); }
    await p.locator(".rede-menu [role=menuitem]", { hasText: "Renomear" }).click();
    await p.waitForSelector(`.rede-no[data-numero="${numero}"] [data-editando]`);
    await p.keyboard.press("Escape");
    /* na seta */
    const s = p.locator(".rede-seta-alvo").first();
    const [de, para] = [await s.getAttribute("data-seta-de"), await s.getAttribute("data-seta-para")];
    await s.dispatchEvent("contextmenu", { clientX: 400, clientY: 400, button: 2 });
    await p.waitForSelector(".rede-menu");
    assert.ok((await p.locator(".rede-menu").innerText()).includes("Inserir"));
    await p.locator(".rede-menu [role=menuitem]", { hasText: "Retirar a ligação" }).click();
    await p.waitForFunction(([a, b]) => !document.querySelector(`.rede-seta[data-de="${a}"][data-para="${b}"]`), [de, para]);
    /* no fundo, fica o menu do navegador */
    assert.deepEqual(p.erros, []);
  });

  test("duplo clique renomeia; Esc tira a seleção", async () => {
    const p = await abrirRede();
    const no = p.locator(".rede-no").nth(1);
    const numero = await no.getAttribute("data-numero");
    await no.locator(".rede-cartao").dblclick();
    await p.waitForSelector(".rede [data-editando]");
    await p.keyboard.type("Nome trocado na rede");
    await p.keyboard.press("Enter");
    await p.waitForFunction((n) => document.querySelector(`.rede-no[data-numero="${n}"]`)?.textContent.includes("Nome trocado na rede"), numero);
    await p.locator(`.rede-no[data-numero="${numero}"] .rede-cartao`).click();
    await p.keyboard.press("Escape");
    assert.equal(await p.locator(".rede-no.selecionada").count(), 0);
    assert.deepEqual(p.erros, []);
  });

  test("tema escuro: controles visíveis", async () => {
    const p = await abrirRede({ tema: "dark" });
    await p.locator(".rede-no").first().locator(".rede-cartao").click();
    await assentar(p);
    if (SCREENSHOTS) await p.screenshot({ path: `${SCREENSHOTS}/4-escuro.png` });
    assert.ok(await p.locator(".rede-no.selecionada .rede-alca").isVisible());
    assert.deepEqual(p.erros, []);
  });
});
