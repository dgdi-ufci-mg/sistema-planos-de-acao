/**
 * Edição dentro da Rede (09/11/2026, pedido do responsável; documentação técnica, seção 8.4): clique seleciona,
 * o "+" cria a próxima ação já ligada e com o nome aberto, a bolinha arrastada liga duas ações, Delete numa seta
 * a retira, duplo clique renomeia e Enter abre a ação.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, centro, irParaVisualizacao } from "./apoio.mjs";

const SCREENSHOTS = process.env.REDE_CAPTURAS ?? null;

describe("Rede: edição fluida", { skip: pular }, () => {
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
    /* a 100%: com o plano inteiro na tela (abertura desde 10/11/2026), a ação nova pode nascer junto à borda, e a caixa é trazida para dentro da tela */
    await p.click('[data-escala="normal"]');
    await assentar(p);
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
  /* ---------- ajustes da avaliação de 10/11/2026 ---------- */
  test("o botão de abrir, ao lado do cartão selecionado, abre a ação com o mouse", async () => {
    const p = await abrirRede();
    const no = p.locator(".rede-no").nth(1);
    await no.locator(".rede-cartao").click();
    await assentar(p);
    assert.ok(await no.locator(".rede-abrir").isVisible());
    await no.locator(".rede-abrir").click();
    await assentar(p);
    assert.ok(await p.locator(".camada.aberta").count() >= 1, "abriu a janela da ação");
    assert.deepEqual(p.erros, []);
  });

  test("Ctrl+Z desfaz, em ordem, o nome e a criação; o botão de desfazer aparece só quando há o que desfazer", async () => {
    const p = await abrirRede();
    const antes = await p.locator(".rede-no").count();
    assert.ok(!(await p.locator("[data-rede-desfazer]").isVisible()), "sem nada a desfazer, sem botão");
    const origem = p.locator(".rede-no").nth(1);
    await origem.locator(".rede-cartao").click();
    await origem.locator(".rede-mais").click();
    await p.waitForSelector(".rede [data-editando]");
    await p.keyboard.type("Ação a desfazer");
    await p.keyboard.press("Enter");
    await assentar(p, 700);
    await p.keyboard.press("Escape"); // fecha a caixinha de prazos
    await assentar(p);
    assert.equal(await p.locator(".rede-no").count(), antes + 1);
    assert.ok(await p.locator("[data-rede-desfazer]").isVisible());
    await p.keyboard.press("Control+z");
    await assentar(p, 700);
    assert.equal(await p.locator(".rede-no", { hasText: "Ação a desfazer" }).count(), 0, "o nome voltou ao anterior");
    assert.equal(await p.locator(".rede-no").count(), antes + 1, "a ação ainda existe");
    await p.click("[data-rede-desfazer]");
    await assentar(p, 700);
    assert.equal(await p.locator(".rede-no").count(), antes, "a ação criada saiu");
    assert.match(await p.locator(".aviso-curto").textContent(), /Desfeito/);
    assert.ok(!(await p.locator("[data-rede-desfazer]").isVisible()));
    assert.deepEqual(p.erros, []);
  });

  test("Ctrl+Z desfaz a ligação criada e a ligação retirada", async () => {
    const p = await abrirRede();
    await p.click('[data-escala="normal"]');
    await assentar(p);
    const antes = await setas(p);
    const alvo = p.locator(".rede-seta-alvo").first();
    const [de, para] = [await alvo.getAttribute("data-seta-de"), await alvo.getAttribute("data-seta-para")];
    await alvo.evaluate((el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await p.keyboard.press("Delete");
    await assentar(p, 700);
    assert.equal(await p.locator(`.rede-seta[data-de="${de}"][data-para="${para}"]`).count(), 0, "ligação retirada");
    await p.keyboard.press("Control+z");
    await assentar(p, 700);
    assert.equal(await p.locator(`.rede-seta[data-de="${de}"][data-para="${para}"]`).count(), 1, "ligação de volta");
    assert.equal(await setas(p), antes);
    assert.deepEqual(p.erros, []);
  });

  /* ---------- 11/11/2026: posições mantidas, botão Arrumar e caixinhas de um campo só ---------- */
  const posicoes = (p) => p.locator(".rede-no").evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.numero, [parseFloat(e.style.left), parseFloat(e.style.top)]])));
  /* espera a transição do zoom (320 ms) e a rolagem assentarem: o menu do botão direito fecha quando a rede rola */
  const aCem = async (p) => { await p.click('[data-escala="normal"]'); await p.waitForTimeout(800); };

  test("criar num lugar ocupado só abre espaço: o que está à direita desliza, nada sobe nem desce; Arrumar reorganiza", async () => {
    const p = await abrirRede();
    await aCem(p);
    assert.equal(await p.locator("[data-rede-arrumar]").isVisible(), false, "rede recém-aberta: nada a arrumar");
    const antes = await posicoes(p);
    /* a primeira ação tem três seguintes na coluna ao lado: o lugar da nova está ocupado */
    const origem = p.locator(".rede-no").first();
    const n = await origem.getAttribute("data-numero");
    await origem.locator(".rede-cartao").click();
    await origem.locator(".rede-mais").click();
    await p.waitForSelector(".rede [data-editando]");
    await p.keyboard.type("No meio do caminho");
    await p.keyboard.press("Enter");
    await p.keyboard.press("Escape"); // deixa os prazos para depois
    await assentar(p, 900);
    const depois = await posicoes(p);
    const nova = await p.locator(".rede-no", { hasText: "No meio do caminho" }).getAttribute("data-numero");
    for (const k of Object.keys(antes)) assert.equal(depois[k][1], antes[k][1], `a ação ${k} não subiu nem desceu`);
    assert.equal(depois[n][0], antes[n][0], "a de origem ficou onde estava");
    assert.equal(depois[nova][1], antes[n][1], "a nova fica na altura da de origem");
    assert.ok(depois[nova][0] > antes[n][0]);
    const aDireita = Object.keys(antes).filter((k) => antes[k][0] > antes[n][0]);
    assert.ok(aDireita.length >= 3 && aDireita.every((k) => depois[k][0] > antes[k][0]), "o que estava à direita deslizou");
    const arrumar = p.locator("[data-rede-arrumar]");
    assert.ok(await arrumar.isVisible(), "há o que arrumar");
    if (SCREENSHOTS) await p.screenshot({ path: `${SCREENSHOTS}/15-espaco-aberto.png` });
    await arrumar.click();
    await assentar(p, 900);
    const arrumada = await posicoes(p);
    assert.ok(Object.keys(antes).some((k) => arrumada[k][1] !== depois[k][1] || arrumada[k][0] !== depois[k][0]), "a arrumação mexeu no desenho");
    assert.equal(await arrumar.isVisible(), false, "depois de arrumar, o botão some");
    assert.deepEqual(p.erros, []);
  });

  test("caixinha de prazos: sempre abaixo do cartão, campos brancos e a data em que a ação terminaria", async () => {
    const p = await abrirRede();
    await aCem(p);
    /* uma ação que ainda espera outra: a estimativa dela pode ser corrigida sem histórico (js/acao.js) */
    const alvo = p.locator(".rede-no.indice:not(.agora)").first();
    await alvo.locator(".rede-cartao").click();
    await alvo.locator(".rede-data").click();
    await p.waitForSelector(".rede-estimar input[name=o]");
    await assentar(p, 300);
    const [caixa, cartao] = await Promise.all([p.locator(".rede-estimar").boundingBox(), alvo.boundingBox()]);
    assert.ok(caixa.y >= cartao.y + cartao.height, "abaixo do cartão");
    const fundos = await p.locator(".rede-estimar input").evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    assert.deepEqual([...new Set(fundos)], ["rgb(255, 255, 255)"], "os três campos com fundo branco");
    const previsao = p.locator(".rede-estimar [data-previsao]");
    assert.match(await previsao.innerText(), /termina em \d{2}\/\d{2}\/\d{4}/, "com os prazos atuais, já mostra a data");
    const antes = await previsao.innerText();
    await p.locator(".rede-estimar input[name=o]").fill("40");
    await p.locator(".rede-estimar input[name=m]").fill("60");
    await p.locator(".rede-estimar input[name=p]").fill("90");
    assert.notEqual(await previsao.innerText(), antes, "a data acompanha o que se digita");
    await p.locator(".rede-estimar input[name=m]").fill("10");
    assert.equal(await previsao.isVisible(), false, "prazos fora de ordem: sem data");
    await p.keyboard.press("Escape");
    assert.deepEqual(p.erros, []);
  });

  test("perto do fim da tela, a caixinha continua abaixo: a rede sobe o que falta", async () => {
    const p = await abrirRede();
    await aCem(p);
    /* uma ação que ainda espera outra (estimativa livre), levada para junto da borda de baixo, no meio da largura */
    const alvo = p.locator(".rede-no.indice:not(.agora)").first();
    const r = await alvo.boundingBox();
    await p.mouse.move(700, 300);
    await p.mouse.wheel(r.x - 600, -(760 - r.y - r.height));
    await p.waitForTimeout(800);
    /* clique direto do mouse: o clique do Playwright poderia rolar a rede, e o menu fecha quando ela rola */
    const c = await alvo.boundingBox();
    assert.ok(c.y + c.height > 700, "o cartão está junto da borda de baixo");
    await p.mouse.click(c.x + c.width / 2, c.y + 30, { button: "right" });
    await p.locator('.rede-menu button:has-text("Prazo")').click();
    await p.waitForSelector(".rede-estimar");
    await assentar(p, 300);
    const [caixa, cartao] = await Promise.all([p.locator(".rede-estimar").boundingBox(), alvo.boundingBox()]);
    assert.ok(caixa.y >= cartao.y + cartao.height - 1 && caixa.y + caixa.height <= 860, "abaixo do cartão e dentro da tela");
    assert.deepEqual(p.erros, []);
  });

  test("menu do botão direito: situação e etapa numa caixinha; Ctrl+Z desfaz", async () => {
    const p = await abrirRede();
    await aCem(p);
    const alvo = p.locator(".rede-no.agora").first();
    const n = await alvo.getAttribute("data-numero");
    const no = p.locator(`.rede-no[data-numero="${n}"]`);
    const menu = async (item) => { await assentar(p, 400); await no.locator(".rede-cartao").click({ button: "right" }); await p.locator(`.rede-menu button:has-text("${item}")`).click(); await assentar(p, 250); };
    assert.deepEqual(await (async () => { await no.locator(".rede-cartao").click({ button: "right" }); const t = await p.locator(".rede-menu button").allInnerTexts(); await p.keyboard.press("Escape"); return ["Responsáveis", "Situação", "Etapa"].map((x) => t.some((y) => y.startsWith(x))); })(), [true, true, true]);
    /* situação: a lista do espaço, com a atual marcada, e "Concluída…" */
    await menu("Situação");
    const opcoes = await p.locator(".rede-campo-situacao [role=option]").allInnerTexts();
    assert.equal(opcoes[0], "Liberada");
    assert.equal(opcoes.at(-1), "Concluída…");
    assert.equal(await p.locator('.rede-campo-situacao [aria-selected="true"]').innerText(), "Liberada");
    const [caixa, cartao] = await Promise.all([p.locator(".rede-campo-situacao").boundingBox(), no.boundingBox()]);
    assert.ok(caixa.y >= cartao.y + cartao.height, "abaixo do cartão");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator(".rede-campo").count(), 0);
    await assentar(p, 300); // o foco volta ao cartão, e a rede pode rolar para mostrá-lo
    /* etapa: muda a etapa da ação; a rede é arrumada de novo, porque a cerca muda */
    const etapaAntes = await no.getAttribute("data-etapa");
    await menu("Etapa");
    const atual = await p.locator('.rede-campo-etapa [aria-selected="true"]').innerText();
    const outra = p.locator('.rede-campo-etapa [role=option][aria-selected="false"]').first();
    const nomeDaOutra = await outra.innerText();
    assert.notEqual(nomeDaOutra, atual);
    await outra.click();
    await assentar(p, 900);
    assert.notEqual(await no.getAttribute("data-etapa"), etapaAntes, "a etapa mudou");
    assert.equal(await p.locator("[data-rede-arrumar]").isVisible(), false, "mudança de etapa já vem arrumada");
    await p.locator(".rede").focus();
    await p.keyboard.press("Control+z");
    await assentar(p, 900);
    assert.equal(await no.getAttribute("data-etapa"), etapaAntes, "Ctrl+Z devolve a etapa");
    assert.deepEqual(p.erros, []);
  });

  test("a pílula da situação abre a caixinha da situação", async () => {
    const p = await abrirRede();
    await aCem(p);
    await p.locator(".rede-no.agora .rede-agora").first().click();
    await p.waitForSelector(".rede-campo-situacao");
    assert.ok(await p.locator(".rede-no.agora").first().evaluate((el) => el.classList.contains("selecionada")));
    await p.keyboard.press("Escape");
    assert.deepEqual(p.erros, []);
  });

  test("clique nos responsáveis da ação selecionada abre a escolha; quem não cabe vira +N, sem cobrir a data", async () => {
    const p = await abrirRede();
    await aCem(p);
    const alvo = p.locator(".rede-no.agora").first();
    const n = await alvo.getAttribute("data-numero");
    const no = p.locator(`.rede-no[data-numero="${n}"]`);
    /* o primeiro clique só seleciona */
    await no.locator(".donos").click();
    await assentar(p, 200);
    assert.equal(await p.locator(".escolher-participantes").count(), 0);
    await no.locator(".donos").click();
    await p.waitForSelector(".escolher-participantes");
    assert.equal(await p.locator(".rede [data-editando]").count(), 0, "o duplo clique nos responsáveis não abre o nome");
    /* marca todos os responsáveis do espaço */
    const caixas = p.locator(".escolher-participantes input[type=checkbox]");
    const total = await caixas.count();
    assert.ok(total >= 5);
    for (let i = 0; i < total; i++) {
      const c = p.locator(".escolher-participantes input[type=checkbox]").nth(i);
      if (!(await c.isChecked())) { await c.check(); await assentar(p, 250); }
    }
    await p.keyboard.press("Escape");
    await p.mouse.click(700, 820);
    await assentar(p, 500);
    const medido = await no.evaluate((el) => {
      const donos = el.querySelector(".donos");
      const [d, data] = [donos.getBoundingClientRect(), el.querySelector(".rede-data").getBoundingClientRect()];
      const visiveis = [...donos.querySelectorAll(".avatar:not(.mais), .unidade")].filter((s) => !s.hidden).length;
      return { mais: donos.querySelector(".rede-mais-donos")?.textContent ?? "", visiveis, total: donos.querySelectorAll(".avatar:not(.mais), .unidade").length,
        cabe: donos.scrollWidth <= donos.clientWidth + 1, semCobrir: d.right <= data.left + 1, dica: donos.querySelector(".rede-mais-donos")?.title ?? "" };
    });
    assert.equal(medido.total, total, "todos os responsáveis estão no cartão");
    assert.match(medido.mais, /^\+\d+$/);
    assert.equal(medido.visiveis + Number(medido.mais.slice(1)), total);
    assert.ok(medido.cabe && medido.semCobrir, "nada cortado, e a data livre");
    assert.ok(medido.dica.length > 5, "os nomes de quem ficou de fora estão na dica");
    if (SCREENSHOTS) await no.screenshot({ path: `${SCREENSHOTS}/16-responsaveis.png` });
    assert.deepEqual(p.erros, []);
  });
});
