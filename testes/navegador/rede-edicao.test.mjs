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
