/**
 * Barra do topo no computador (documentação técnica, seções 8.0 e 3.2): os nomes dos menus aparecem sempre que
 * couberem e, quando não cabem, ficam só os ícones, sem nada encostar nem ser cortado. A decisão é medida na hora
 * (ajustarBarra, em js/telas/espaco.js); estes testes conferem de 700 a 1.366 px, com a barra lateral aberta e
 * recolhida.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, irParaVisualizacao } from "./apoio.mjs";

/** Controles da barra que se encostam ou cortam, pelas mesmas regras do sistema (8 px entre grupos). */
const problemas = (p) => p.evaluate(() => {
  const els = [...document.querySelectorAll(".topo .titulo-barra, .topo .aba-visao, .topo .menu-topo, .topo .chip-atrasadas, .topo .botao[data-nova]")]
    .filter((el) => el.getBoundingClientRect().width > 2);
  const grupo = (el) => el.closest(".abas-visao, .topo-esquerda, .topo-centro, .topo-direita");
  const nome = (el) => el.textContent.trim().replace(/\s+/g, " ") || el.className;
  /* barra em duas linhas (12/11/2026): compara só controles da mesma linha */
  const linhas = new Map();
  for (const el of els) {
    const b = el.getBoundingClientRect(), meio = b.top + b.height / 2;
    const chave = [...linhas.keys()].find((k) => Math.abs(k - meio) < 14) ?? meio;
    linhas.set(chave, [...(linhas.get(chave) ?? []), { el, g: grupo(el), ...b.toJSON() }]);
  }
  const achados = [];
  for (const l of linhas.values()) {
    const r = l.sort((a, b) => a.left - b.left);
    r.forEach((a, i) => {
      const antes = r[i - 1];
      if (antes && (antes.right > a.left || (antes.g !== a.g && antes.right + 8 > a.left))) achados.push(`"${nome(antes.el)}" encosta em "${nome(a.el)}"`);
    });
  }
  for (const el of els) if (!el.matches(".titulo-barra") && el.scrollWidth > el.clientWidth + 1) achados.push(`"${nome(el)}" cortado`);
  if (document.querySelector(".topo").getBoundingClientRect().right > innerWidth + 1) achados.push("a barra passa da tela");
  return achados;
});
const classe = (p) => p.evaluate(() => document.querySelector(".topo").className);
/** Recolhe ou abre a barra lateral (Ctrl+B) e espera a animação. */
const alternarLateral = async (p) => { await p.keyboard.press("Control+b"); await assentar(p, 600); };

describe("Barra do topo no computador", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  for (const largura of [700, 800, 900, 1024, 1180, 1280, 1366]) {
    test(`${largura} px: nada encosta nem é cortado, com a barra lateral aberta e recolhida`, async () => {
      const p = await sessao.abrir({ largura, altura: 760 });
      assert.deepEqual(await problemas(p), [], "barra lateral aberta");
      await alternarLateral(p);
      assert.deepEqual(await problemas(p), [], "barra lateral recolhida");
      assert.deepEqual(p.erros, []);
    });
  }

  test("1.366 px: os nomes dos menus aparecem", async () => {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    assert.doesNotMatch(await classe(p), /barra-icones|barra-curta/);
    assert.match(await p.locator(".menu-topo").first().innerText(), /\S/);
  });

  test("clicar num menu não faz os nomes sumirem (correção da versão 184)", async () => {
    for (const largura of [1024, 1366]) {
      const p = await sessao.abrir({ largura, altura: 760 });
      const antes = await classe(p);
      for (const menu of await p.locator(".topo .menu-topo").all()) {
        await menu.click();
        await assentar(p, 250);
        assert.equal(await classe(p), antes, `${largura} px, menu "${(await menu.innerText()).trim()}"`);
        await p.keyboard.press("Escape");
        await assentar(p, 250);
      }
    }
  });

  test("recolher e reabrir a barra lateral refaz a medida da barra do topo (correção de 27/10/2026)", async () => {
    for (const largura of [900, 1024, 1180]) {
      const p = await sessao.abrir({ largura, altura: 760 });
      await alternarLateral(p);
      await alternarLateral(p);
      assert.deepEqual(await problemas(p), [], `${largura} px, depois de reabrir a barra lateral`);
    }
  });
});

/**
 * Barra do topo nas visualizações sem filtro (12/11/2026, decisão do responsável; seção 8.0): o chip das atrasadas
 * leva à Lista já filtrada, em vez de ligar um filtro que a tela não aplica; nas Entregas, o botão principal
 * é "Nova entrega" (e não há outro dentro da tela).
 */
describe("Barra do topo nas visualizações", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const irPara = async (p, modo) => {
    await irParaVisualizacao(p, modo);
    await assentar(p, 600);
  };

  for (const modo of ["rede", "cronograma", "planilha", "linha", "responsaveis", "entregas"]) {
    test(`${modo}: o chip das atrasadas abre a Lista só com as atrasadas`, async () => {
      const p = await sessao.abrir({ largura: 1366, altura: 760 });
      await irPara(p, modo);
      const chip = p.locator(".topo .chip-atrasadas");
      assert.equal(await chip.count(), 1, "o exemplo tem ações atrasadas");
      assert.equal(await chip.getAttribute("aria-pressed"), null, "não finge ser um filtro desta tela");
      assert.equal(await chip.getAttribute("title"), "Ver as atrasadas na Lista");
      await chip.click();
      await assentar(p, 600);
      assert.equal(await p.evaluate(() => document.body.dataset.vistaAtual), "lista");
      assert.equal(await p.locator(".topo .chip-atrasadas").getAttribute("aria-pressed"), "true");
      const linhas = p.locator(".linha[data-abrir-acao]");
      assert.ok(await linhas.count() > 0);
      assert.deepEqual(p.erros, []);
    });
  }

  test("lista: o chip continua ligando e desligando o filtro na própria tela", async () => {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    const chip = p.locator(".topo .chip-atrasadas");
    assert.equal(await chip.getAttribute("aria-pressed"), "false");
    await chip.click();
    await assentar(p, 600);
    assert.equal(await p.locator(".topo .chip-atrasadas").getAttribute("aria-pressed"), "true");
    await p.locator(".topo .chip-atrasadas").click();
    await assentar(p, 600);
    assert.equal(await p.locator(".topo .chip-atrasadas").getAttribute("aria-pressed"), "false");
  });

  test("entregas: o botão do topo é \"Nova entrega\", único, e abre o cadastro da entrega", async () => {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    await irPara(p, "entregas");
    await p.waitForSelector(".lista-entregas");
    const botao = p.locator(".topo .botao[data-nova]");
    assert.match((await botao.innerText()).trim(), /^Nova entrega$/);
    assert.equal(await p.locator("main .botao.principal, .lista .botao.principal").count(), 0, "sem segundo botão principal na tela");
    await botao.click();
    await assentar(p);
    assert.equal(await p.locator("[data-form-cadastro]").count(), 1, "abre o cadastro da entrega");
    await p.keyboard.press("Escape");
    await assentar(p);
    await p.keyboard.press("n");
    await assentar(p);
    assert.equal(await p.locator("[data-form-cadastro]").count(), 1, "a tecla N faz o mesmo");
    assert.deepEqual(p.erros, []);
  });

  test("ao sair das Entregas, o botão volta a ser \"Nova ação\"", async () => {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    await irPara(p, "entregas");
    await irPara(p, "lista");
    assert.match((await p.locator(".topo .botao[data-nova]").innerText()).trim(), /^Nova ação$/);
  });
});

/** Barra em duas linhas, com as visualizações em abas (proposta de 12/11/2026, ramo claude/barra-em-abas). */
describe("Barra do topo em abas", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("no Plano de Ação: Lista, Quadro, Rede, Cronograma e Entregas à vista; as demais em \"Mais\"", async () => {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    const abas = await p.locator(".aba-visao[data-modo]").evaluateAll((els) => els.map((e) => e.dataset.modo));
    assert.deepEqual(abas, ["lista", "quadro", "rede", "cronograma", "entregas"]);
    assert.equal(await p.locator('.aba-visao[aria-pressed="true"]').getAttribute("data-modo"), "lista");
    await p.click(".aba-mais");
    await assentar(p);
    const noMais = await p.locator("[data-popover] [data-modo]").evaluateAll((els) => els.map((e) => e.dataset.modo));
    assert.deepEqual(noMais, ["planilha", "linha", "responsaveis"]);
    await p.locator('[data-popover] [data-modo="planilha"]').click();
    await assentar(p, 600);
    assert.match((await p.locator(".aba-mais").innerText()).trim(), /^Planilha/, "\"Mais\" mostra o nome da visualização atual");
    assert.equal(await p.locator(".aba-mais").getAttribute("aria-pressed"), "true");
    assert.deepEqual(p.erros, []);
  });

  test("o nome do espaço fica na barra, e não no alto do conteúdo", async () => {
    const p = await sessao.abrir({ largura: 1366, altura: 760 });
    assert.ok(await p.locator(".topo .titulo-barra").isVisible());
    assert.equal(await p.locator("#principal .titulo-conteudo").isVisible(), false);
    const titulo = await p.locator(".topo .titulo-barra").boundingBox();
    const aba = await p.locator(".aba-visao").first().boundingBox();
    assert.ok(aba.y > titulo.y + titulo.height - 4, "as abas ficam na linha de baixo");
  });

  for (const largura of [720, 1024]) {
    test(`${largura} px: em todas as visualizações, nada se sobrepõe e "Mais" mantém o nome`, async () => {
      const p = await sessao.abrir({ largura, altura: 760 });
      for (const modo of ["lista", "quadro", "rede", "cronograma", "planilha", "linha", "responsaveis", "entregas"]) {
        await irParaVisualizacao(p, modo);
        await assentar(p, 500);
        const sobrepostos = await p.evaluate(() => {
          const els = [...document.querySelectorAll(".topo .titulo-barra, .topo .aba-visao, .topo .menu-topo, .topo .chip-atrasadas, .topo .botao[data-nova]")]
            .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 2);
          return els.some((a, i) => els.some((b, j) => j > i && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1));
        });
        assert.equal(sobrepostos, false, `${modo}: controles sobrepostos`);
        assert.ok((await p.locator(".aba-mais").innerText()).trim().length > 0, `${modo}: "Mais" sem nome`);
      }
      assert.deepEqual(p.erros, []);
    });
  }
});
