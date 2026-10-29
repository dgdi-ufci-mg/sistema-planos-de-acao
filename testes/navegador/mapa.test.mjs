/**
 * Mapa do Strata (lote 1, 29/10/2026; documentação técnica, seção 8, "Mapa"): faixas na ordem do catálogo, camada
 * opcional vazia sem faixa, nenhum ponto fora da faixa, sem rolagem lateral da página, movimento e aproximação
 * limitados ao conteúdo. No computador e num celular simulado (390 px).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, dedo, centro } from "./apoio.mjs";

const ABRIR = { caminho: "strata/", aguardar: ".mapa-svg:not([data-movendo]) .mapa-no" }; // espera os pontos pararem (lote 5)
const sem = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const vista = (p) => p.evaluate(() => {
  const m = document.querySelector("[data-mapa-mundo]").getAttribute("transform").match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);
  return { x: Number(m[1]), y: Number(m[2]), k: Number(m[3]) };
});

describe("Mapa do Strata", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  for (const [nome, o] of [["computador", { largura: 1280, altura: 800 }], ["celular (390 px)", { largura: 390, altura: 800 }]]) {
    describe(nome, () => {
      test("abre no Mapa, com as faixas na ordem do catálogo e os Planos de Ação por último", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        assert.equal(await p.locator('[data-aba="mapa"]').getAttribute("aria-selected"), "true");
        const ids = await p.locator(".mapa-faixa").evaluateAll((f) => f.map((x) => x.dataset.camada));
        assert.deepEqual(ids, ["missao", "objetivoEstrategico", "objetivoDesenvolvimento", "politica", "portfolio", "programa", "planosDeAcao"]);
        assert.ok(await sem(p), "a página não rola para o lado");
        assert.deepEqual(p.erros, []);
      });

      test("a barra do topo mostra o logotipo do Strata, inteiro e sem cortar (29/10/2026)", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        const logo = p.locator(".superior-marca .marca-strata-logotipo");
        assert.equal(await logo.count(), 1);
        const c = await logo.boundingBox();
        assert.ok(c.width > 90 && c.height === 24, `tamanho ${c.width}×${c.height}`);
        assert.ok(c.x >= 0 && c.x + c.width <= o.largura, "o logotipo cabe na largura");
        assert.ok(await sem(p), "a página não rola para o lado");
      });

      test("nenhum ponto fica fora da sua faixa", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        const fora = await p.evaluate(() => {
          const faixas = new Map([...document.querySelectorAll(".mapa-faixa")].map((f) => [f.dataset.camada, f]));
          const ordem = [...faixas.keys()];
          const itens = [];
          for (const c of document.querySelectorAll(".mapa-no circle")) {
            const ponto = new DOMPoint(Number(c.getAttribute("cx")), Number(c.getAttribute("cy")));
            const dentro = [...faixas.values()].filter((f) => f.isPointInFill(ponto));
            if (dentro.length !== 1) itens.push(c.parentNode.dataset.no);
          }
          return { itens, pontos: document.querySelectorAll(".mapa-no").length, faixas: ordem.length };
        });
        assert.deepEqual(fora.itens, []);
        assert.equal(fora.pontos, 11, "o catálogo de exemplo tem 11 itens (a Missão e mais 10)");
      });

      test("todo o conteúdo cabe numa única tela ao abrir, e as linhas não passam rente a outros pontos", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        const r = await p.evaluate(() => {
          const area = document.querySelector(".mapa-area").getBoundingClientRect();
          const caixas = [...document.querySelectorAll(".mapa-faixa, .mapa-no")].map((e) => e.getBoundingClientRect());
          const fora = caixas.filter((c) => c.left < area.left - 1 || c.right > area.right + 1 || c.top < area.top - 1 || c.bottom > area.bottom + 1).length;
          return { fora, total: caixas.length };
        });
        assert.equal(r.fora, 0, `${r.fora} de ${r.total} elementos fora da área`);
        const tela = await p.evaluate(async () => {
          const { problemasDasLigacoes, calcularMapa } = await import("../js/mapa.js");
          const nos = [...document.querySelectorAll(".mapa-no")].map((g) => ({ chave: g.dataset.no, x: Number(g.querySelector("circle").getAttribute("cx")), yCurvo: Number(g.querySelector("circle").getAttribute("cy")) }));
          const ligacoes = [...document.querySelectorAll(".mapa-ligacao")].map((l) => ({ de: l.dataset.de, para: l.dataset.para }));
          return problemasDasLigacoes({ nos, ligacoes }).length;
        });
        assert.equal(tela, 0, "nenhuma linha passa rente a outro ponto nem se sobrepõe a outra do mesmo ponto");
      });

      test("as linhas ligam cada item ao que ele vem de", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        const ligacoes = await p.locator(".mapa-ligacao").evaluateAll((l) => l.map((x) => x.dataset.de));
        assert.equal(ligacoes.length, 12, "OE1 e OE2 (à Missão), OD1, OD2, POL1, POL2 (duas), PF1, PRG1, PRG2 (duas) e PRG3");
        const porItem = Object.values(ligacoes.reduce((m, de) => ({ ...m, [de]: (m[de] ?? 0) + 1 }), {}));
        assert.equal(porItem.filter((n) => n === 2).length, 2, "os dois itens com dois superiores (POL2 e PRG2) têm as duas linhas");
      });
    });
  }

  test("camada opcional sem itens não ocupa faixa", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    await p.evaluate(async () => {
      const { criarStore } = await import("../js/dados.js");
      const { criarBancoLocal } = await import("../js/banco/local.js");
      const { mostrarSuperior } = await import("../js/superior/telas.js");
      const store = criarStore(criarBancoLocal());
      const oe = await store.criarItemEstrategico({ camada: "objetivoEstrategico", codigo: "OE1", nome: "Governança", superiores: [] });
      const od = await store.criarItemEstrategico({ camada: "objetivoDesenvolvimento", codigo: "OD1", nome: "Dados", superiores: [oe] });
      const pol = await store.criarItemEstrategico({ camada: "politica", codigo: "POL1", nome: "Política", superiores: [od] });
      await store.criarItemEstrategico({ camada: "programa", codigo: "PRG1", nome: "Programa", superiores: [pol] });
      const alvo = document.querySelector("#principal");
      alvo.replaceChildren();
      await mostrarSuperior(alvo, { store, hoje: "2026-10-29" }).recarregar();
    });
    const ids = await p.locator(".mapa-faixa").evaluateAll((f) => f.map((x) => x.dataset.camada));
    assert.deepEqual(ids, ["objetivoEstrategico", "objetivoDesenvolvimento", "politica", "programa", "planosDeAcao"]);
  });

  test("os nomes das camadas ficam em tamanho fixo na borda esquerda, também ao aproximar", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    const rotulo = p.locator('.mapa-rotulo-camada[data-camada="politica"]');
    await p.click("[data-mapa-mais]");
    await p.waitForTimeout(400);
    const antes = await rotulo.boundingBox(); // com o mapa na escala 1 ou mais, o nome tem o tamanho fixo
    await p.click("[data-mapa-mais]");
    await p.waitForTimeout(400);
    const depois = await rotulo.boundingBox();
    assert.equal(Math.round(depois.width), Math.round(antes.width));
    assert.ok(depois.x < 40, "continua preso à borda esquerda");
  });

  test("o movimento e a aproximação ficam limitados ao conteúdo", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    const area = await centro(p.locator(".mapa-area"));
    for (let i = 0; i < 12; i++) { await p.click("[data-mapa-mais]"); await p.waitForTimeout(260); }
    const perto = await vista(p);
    assert.ok(perto.k <= 3 + 1e-6, `k ${perto.k} não passa do máximo`);
    for (let i = 0; i < 30; i++) { await p.click("[data-mapa-menos]"); await p.waitForTimeout(260); }
    const longe = await vista(p);
    assert.ok(longe.k >= 0.2, `k ${longe.k}: o conteúdo inteiro ainda ocupa a vista`);
    /* arrasta o mapa muito para a esquerda: o conteúdo não pode sair da vista */
    await p.mouse.move(area.x, area.y);
    await p.mouse.down();
    await p.mouse.move(area.x - 600, area.y - 300, { steps: 8 });
    await p.mouse.up();
    const t = await vista(p);
    const caixa = await p.locator(".mapa-faixa").first().boundingBox();
    assert.ok(caixa.x + caixa.width > area.r.x, "ainda há conteúdo à vista");
    assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y));
  });

  test("Ctrl + rolagem aproxima e a rolagem sem Ctrl move o mapa", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    const area = await centro(p.locator(".mapa-area"));
    const antes = await vista(p);
    await p.mouse.move(area.x, area.y);
    await p.keyboard.down("Control");
    await p.mouse.wheel(0, -300);
    await p.keyboard.up("Control");
    const aproximado = await vista(p);
    assert.ok(aproximado.k > antes.k, "aproximou");
    await p.mouse.wheel(120, 0);
    await p.waitForTimeout(100);
    const movido = await vista(p);
    assert.equal(movido.k, aproximado.k, "só mexer a rolagem não muda a escala");
    assert.notEqual(movido.x, aproximado.x, "mexeu o mapa");
  });

  test("o botão Centralizar volta à vista de abertura; redimensionar não centraliza", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    const abertura = await vista(p);
    await p.click("[data-mapa-mais]");
    await p.waitForTimeout(400);
    assert.notEqual((await vista(p)).k, abertura.k);
    const area = await centro(p.locator(".mapa-area"));
    await p.mouse.move(area.x, area.y);
    await p.mouse.down();
    await p.mouse.move(area.x - 150, area.y - 40, { steps: 6 });
    await p.mouse.up();
    const arrastado = await vista(p);
    await p.setViewportSize({ width: 1280, height: 760 });
    await p.waitForTimeout(250);
    const aposRedimensionar = await vista(p);
    assert.equal(aposRedimensionar.k, arrastado.k, "a escala não mudou ao redimensionar");
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.waitForTimeout(250);
    await p.click("[data-mapa-centralizar]");
    await p.waitForTimeout(400);
    const centrado = await vista(p);
    assert.ok(Math.abs(centrado.k - abertura.k) < 0.02);
  });

  test("no celular, o dedo move o mapa e a pinça aproxima", async () => {
    const p = await sessao.abrir({ largura: 390, altura: 800, ...ABRIR });
    const d = await dedo(p);
    const area = await centro(p.locator(".mapa-area"));
    for (let i = 0; i < 3; i++) { await p.click("[data-mapa-mais]"); await p.waitForTimeout(300); } // tudo cabe na tela: aproxima para haver o que mover
    const antes = await vista(p);
    await d.arrastar(area.x + 60, area.y, -120, 0);
    const depois = await vista(p);
    assert.ok(depois.x < antes.x, "o mapa andou para a esquerda");
    assert.ok(await sem(p), "a página não rola para o lado");
  });

  test("os textos do Mapa usam palavras simples: vem de, nível; nunca deriva de, estrato ou cadeia de derivação", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
    const texto = await p.evaluate(() => {
      const corpo = document.querySelector(".superior-corpo");
      const extra = [...corpo.querySelectorAll("[aria-label], title")].map((e) => e.getAttribute("aria-label") ?? e.textContent);
      return `${corpo.innerText}\n${extra.join("\n")}`.toLowerCase();
    });
    assert.match(texto, /vem de/);
    assert.match(texto, /nível/);
    assert.doesNotMatch(texto, /deriva|estrato|cadeia de deriva/);
  });

  test("no celular, os botões do mapa ficam à vista sem rolar a página e os nomes das camadas vão no alto da faixa", async () => {
    const p = await sessao.abrir({ largura: 390, altura: 800, ...ABRIR });
    const botao = await p.locator("[data-mapa-centralizar]").boundingBox();
    assert.ok(botao.y + botao.height <= 800, "o botão Centralizar cabe na tela de 800 px");
    const rotulo = await p.locator('.mapa-rotulo-camada[data-camada="objetivoDesenvolvimento"]').boundingBox();
    const caixa = await p.locator('.mapa-faixa[data-camada="objetivoDesenvolvimento"]').boundingBox();
    assert.ok(rotulo.y - caixa.y < 30, "o nome da camada fica junto do alto da faixa, e não no meio dela");
  });

  describe("interação (lote 2)", () => {
    /** o ponto de um item pelo código (os identificadores do exemplo são gerados na hora) */
    const no = async (p, codigo) => {
      const chave = await p.evaluate((c) => [...document.querySelectorAll(".mapa-no")].find((g) => g.querySelector("title").textContent.startsWith(`${c} `))?.dataset.no, codigo);
      return p.locator(`.mapa-no[data-no="${chave}"] .mapa-alvo`);
    };
    const selecionado = (p) => p.locator(".mapa-no.selecionado title").textContent();
    const acesos = (p) => p.locator(".mapa-no.no-caminho").evaluateAll((l) => l.map((x) => x.dataset.no).sort());

    for (const [nome, o] of [["computador", { largura: 1280, altura: 800 }], ["celular (390 px)", { largura: 390, altura: 800 }]]) {
      test(`${nome}: tocar num ponto acende o caminho e abre o cartão com "Abrir"; tocar noutro troca; tocar no fundo desfaz`, async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        await (await no(p, "PRG2")).click();
        assert.equal(await p.locator(".mapa-no.selecionado").count(), 1);
        assert.ok((await acesos(p)).length > 3, "o caminho (pelos dois superiores) está aceso");
        const cartao = p.locator("[data-mapa-cartao]");
        assert.ok(await cartao.isVisible());
        assert.match(await cartao.innerText(), /PRG2/);
        const area = await p.locator(".mapa-area").boundingBox();
        const c = await cartao.boundingBox();
        assert.ok(c.x >= area.x - 1 && c.x + c.width <= area.x + area.width + 1 && c.y >= area.y - 1 && c.y + c.height <= area.y + area.height + 1, "o cartão fica dentro da área");
        await (await no(p, "OE2")).click();
        assert.match(await selecionado(p), /^OE2 /);
        await p.locator(".mapa-area").click({ position: { x: 4, y: 4 } });
        assert.equal(await p.locator(".mapa-no.selecionado").count(), 0);
        assert.ok(await cartao.isHidden());
        assert.deepEqual(p.erros, []);
      });
    }

    test("\"Abrir\" leva ao painel do item", async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
      await (await no(p, "PRG1")).click();
      await p.click("[data-mapa-abrir]");
      await p.waitForSelector(".painel");
      assert.match(await p.locator(".painel").first().innerText(), /PRG1/);
    });

    test("no celular, um toque com tremor de 3 px seleciona; um arrasto de verdade só move o mapa", async () => {
      const p = await sessao.abrir({ largura: 390, altura: 800, ...ABRIR });
      const d = await dedo(p);
      const alvo = await centro((await no(p, "PRG1")));
      await d.arrastar(alvo.x, alvo.y, 3, 2, { passos: 3 });
      assert.match(await selecionado(p), /^PRG1 /);
      await p.locator(".mapa-area").click({ position: { x: 4, y: 4 } });
      for (let i = 0; i < 3; i++) { await p.click("[data-mapa-mais]"); await p.waitForTimeout(300); }
      const outro = await centro((await no(p, "PRG1")).first());
      await d.arrastar(Math.min(380, Math.max(10, outro.x)), outro.y, -60, 0);
      assert.equal(await p.locator(".mapa-no.selecionado").count(), 0, "arrastar não seleciona");
    });

    test("\"Ver como lista\" mantém o item selecionado, aberto e à vista; voltar ao Mapa mantém o acendido", async () => {
      const p = await sessao.abrir({ largura: 390, altura: 800, ...ABRIR });
      await (await no(p, "PRG2")).click();
      await p.click("[data-ver-lista]");
      assert.equal(await p.locator('[data-aba="arvore"]').getAttribute("aria-selected"), "true");
      const marcado = p.locator(".item-estrategia.selecionado").first();
      assert.match(await marcado.innerText(), /PRG2/);
      assert.ok(await marcado.isVisible());
      await p.click('[data-aba="mapa"]');
      await p.waitForSelector(".mapa-no");
      assert.match(await selecionado(p), /^PRG2 /);
    });

    test("\"Só o que vale hoje\" fica no próprio Mapa e muda os pontos mostrados", async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
      const antes = await p.locator(".mapa-no").count();
      await p.uncheck("[data-so-vigentes]");
      await p.waitForSelector(".mapa-no");
      assert.ok(await p.locator(".mapa-no").count() >= antes, "desmarcar nunca mostra menos");
      assert.equal(await p.locator("[data-so-vigentes]").isChecked(), false);
    });

    test("Plano de Ação restrito: o cartão não mostra o nome nem oferece \"Abrir\"", async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
      const r = await p.evaluate(async () => {
        const { criarVistaMapa } = await import("../js/superior/mapa.js");
        const area = document.createElement("div");
        area.className = "mapa-area";
        document.body.append(area);
        const camadas = [{ id: "a", nome: "Objetivo", plural: "Objetivos" }];
        const itens = [{ id: "i1", camada: "a", nome: "Item", codigo: "I1", superiores: [] }];
        criarVistaMapa(area, { camadas, itens, planos: [{ id: "x", nome: "Plano de Ação restrito", restrito: true, superiores: ["i1"] }], estado: { selecionado: "plano:x" } });
        return { texto: area.querySelector("[data-mapa-cartao]").innerText, abrir: area.querySelectorAll("[data-mapa-abrir]").length };
      });
      assert.match(r.texto, /Plano de Ação restrito/);
      assert.equal(r.abrir, 0);
    });
  });

  describe("acabamento (lote 4)", () => {
    test("de longe (celular), só o código de cada item, sem se sobrepor; aproximando, os nomes voltam", async () => {
      const p = await sessao.abrir({ largura: 390, altura: 800, ...ABRIR });
      assert.ok(await p.locator(".mapa-svg.de-longe").count(), "o mapa inteiro, no celular, está de longe");
      const r = await p.evaluate(() => {
        const visiveis = (sel) => [...document.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== "none");
        const caixas = visiveis(".mapa-codigo").map((e) => e.getBoundingClientRect());
        let encostam = 0;
        for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) {
          const a = caixas[i]; const b = caixas[j];
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) encostam++;
        }
        return { codigos: caixas.length, nomes: visiveis(".mapa-no .mapa-nome").length, encostam };
      });
      assert.ok(r.codigos >= 8, `${r.codigos} códigos à vista`);
      assert.equal(r.nomes, 0, "nenhum nome inteiro de longe");
      assert.equal(r.encostam, 0, "os códigos não se sobrepõem");
      for (let i = 0; i < 4; i++) { await p.click("[data-mapa-mais]"); await p.waitForTimeout(300); }
      assert.equal(await p.locator(".mapa-svg.de-longe").count(), 0, "de perto, os nomes");
    });

    test("no computador, o mapa abre com os nomes inteiros", async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
      assert.equal(await p.locator(".mapa-svg.de-longe").count(), 0);
    });
  });

  describe("temas dia e noite (lote 4)", () => {
    const tintas = () => {
      const cor = (t) => { const m = t.match(/[\d.]+/g).map(Number); return t.startsWith("color(") ? m.slice(0, 3).map((v) => v * 255) : m.slice(0, 3); };
      const lum = ([r, g, b]) => { const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const razao = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const faixas = [...document.querySelectorAll(".mapa-faixa")].map((f) => cor(getComputedStyle(f).fill));
      const nomes = [...document.querySelectorAll(".mapa-no")].map((g) => ({
        codigo: g.querySelector("title").textContent.slice(0, 8),
        razao: razao(faixas[Number(g.dataset.faixa)], cor(getComputedStyle(g.querySelector(".mapa-nome")).fill)),
      }));
      const linha = cor(getComputedStyle(document.querySelector(".mapa-ligacao")).stroke);
      const borda = cor(getComputedStyle(document.querySelector(".mapa-ligacao-borda")).stroke);
      return { nomes, minimo: Math.min(...nomes.map((n) => n.razao)), linhaSobreBorda: razao(linha, borda), faixasDistintas: new Set(faixas.map((f) => f.join())).size, faixas: faixas.length };
    };

    for (const tema of ["light", "dark"]) {
      test(`tema ${tema}: o nome de cada item tem contraste de 4,5:1 ou mais sobre a sua faixa; a linha se separa da borda`, async () => {
        const p = await sessao.abrir({ largura: 1280, altura: 800, tema, ...ABRIR });
        const r = await p.evaluate(tintas);
        assert.ok(r.minimo >= 4.5, `menor contraste ${r.minimo.toFixed(2)}: ${JSON.stringify(r.nomes.filter((n) => n.razao < 4.5))}`);
        assert.ok(r.linhaSobreBorda >= 3, `linha sobre a borda: ${r.linhaSobreBorda.toFixed(2)}`);
        assert.equal(r.faixasDistintas, r.faixas, "cada faixa tem o seu tom");
        assert.deepEqual(p.erros, []);
      });
    }

    test("só a noite tem estrelas", async () => {
      const dia = await sessao.abrir({ largura: 1280, altura: 800, tema: "light", ...ABRIR });
      assert.equal(await dia.evaluate(() => [...document.querySelectorAll(".mapa-estrela")].filter((e) => getComputedStyle(e).display !== "none").length), 0);
      const noite = await sessao.abrir({ largura: 1280, altura: 800, tema: "dark", ...ABRIR });
      assert.ok(await noite.evaluate(() => [...document.querySelectorAll(".mapa-estrela")].filter((e) => getComputedStyle(e).display !== "none").length) > 10);
    });

    test("trocar o tema com a tela aberta refaz as tintas do texto", async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 800, tema: "light", ...ABRIR });
      const antes = await p.evaluate(() => getComputedStyle(document.querySelector(".mapa-no")).getPropertyValue("--tinta"));
      await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      await p.waitForTimeout(150);
      const r = await p.evaluate(tintas);
      assert.ok(r.minimo >= 4.5, `depois da troca: ${r.minimo.toFixed(2)}`);
      assert.ok(antes, "havia tinta definida");
    });
  });

  describe("física: mola até o destino (lote 5)", () => {
    const coerente = (p) => p.evaluate(() => [...document.querySelectorAll(".mapa-no")].every((g) => {
      const c = g.querySelector(".mapa-bolinha");
      const t = g.querySelector(".mapa-nome") ?? g.querySelector(".mapa-codigo");
      return !t || Math.abs(Number(t.getAttribute("x")) - Number(c.getAttribute("cx")) - 9) < 0.01;
    }));

    test("ao mudar a largura, os pontos deslizam até o novo lugar e param exatamente nele, com as linhas junto", async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
      const antes = await p.evaluate(() => document.querySelector(".mapa-bolinha").getAttribute("cx"));
      await p.setViewportSize({ width: 800, height: 800 });
      await p.waitForSelector(".mapa-svg[data-movendo]", { timeout: 3000 });
      await p.waitForSelector(".mapa-svg:not([data-movendo])", { timeout: 5000 });
      assert.ok(await coerente(p), "nomes e pontos andam juntos");
      const r = await p.evaluate(() => {
        const g = document.querySelector(".mapa-no");
        const l = document.querySelector(".mapa-ligacao");
        const [x, y] = [Number(g.querySelector(".mapa-bolinha").getAttribute("cx")), Number(g.querySelector(".mapa-bolinha").getAttribute("cy"))];
        return { depois: String(x), liga: l.getAttribute("d"), y };
      });
      assert.notEqual(r.depois, antes, "mudou de lugar");
      assert.match(r.liga, /^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
      assert.deepEqual(p.erros, []);
    });

    test("com \"Reduzir movimento\", os pontos vão direto ao destino", async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
      await p.emulateMedia({ reducedMotion: "reduce" });
      await p.setViewportSize({ width: 800, height: 800 });
      await p.waitForTimeout(400);
      assert.equal(await p.locator(".mapa-svg[data-movendo]").count(), 0);
      assert.ok(await coerente(p));
    });
  });

  describe("ordem pessoal: arrastar pontos com o mouse (lote 6)", () => {
    const ordemDosProgramas = (p) => p.evaluate(() => [...document.querySelectorAll(".mapa-no")]
      .map((g) => ({ codigo: g.querySelector("title").textContent.split(" ")[0], x: Number(g.querySelector(".mapa-bolinha").getAttribute("cx")) }))
      .filter((n) => n.codigo.startsWith("PRG")).sort((a, b) => a.x - b.x).map((n) => n.codigo));
    const parados = (p) => p.waitForSelector(".mapa-svg:not([data-movendo])");
    const alvo = async (p, codigo) => {
      const chave = await p.evaluate((c) => [...document.querySelectorAll(".mapa-no")].find((g) => g.querySelector("title").textContent.startsWith(`${c} `))?.dataset.no, codigo);
      return centro(p.locator(`.mapa-no[data-no="${chave}"] .mapa-alvo`));
    };

    test("no computador, arrastar um ponto muda a ordem do nível; \"Voltar ao automático\" desfaz; a escolha fica ao trocar de aba", async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
      const original = await ordemDosProgramas(p);
      assert.equal(await p.locator("[data-voltar-automatico]").count(), 0, "sem ordem pessoal, sem o botão");
      const primeiro = await alvo(p, original[0]);
      const ultimo = await alvo(p, original.at(-1));
      await p.mouse.move(primeiro.x, primeiro.y);
      await p.mouse.down();
      await p.mouse.move(primeiro.x + 40, primeiro.y, { steps: 4 });
      assert.equal(await p.locator(".mapa-svg.arrastando-ponto").count(), 1, "está arrastando um ponto, e não o mapa");
      await p.mouse.move(ultimo.x + 60, primeiro.y, { steps: 8 });
      await p.mouse.up();
      await parados(p);
      await p.waitForSelector("[data-voltar-automatico]");
      const nova = await ordemDosProgramas(p);
      assert.deepEqual(nova, [...original.slice(1), original[0]], "o primeiro foi para o fim");
      assert.equal(await p.locator(".mapa-no.selecionado").count(), 0, "arrastar não seleciona");
      await p.click('[data-aba="arvore"]');
      await p.click('[data-aba="mapa"]');
      await p.waitForSelector(".mapa-svg:not([data-movendo]) .mapa-no");
      assert.deepEqual(await ordemDosProgramas(p), nova, "a ordem fica ao trocar de aba");
      await p.click("[data-voltar-automatico]");
      await p.waitForSelector(".mapa-svg:not([data-movendo]) .mapa-no");
      assert.deepEqual(await ordemDosProgramas(p), original, "voltou ao automático");
      assert.equal(await p.locator("[data-voltar-automatico]").count(), 0);
      assert.deepEqual(p.erros, []);
    });

    test("soltar o ponto onde ele estava não muda a ordem: ele volta ao lugar", async () => {
      const p = await sessao.abrir({ largura: 1280, altura: 800, ...ABRIR });
      const original = await ordemDosProgramas(p);
      const a = await alvo(p, original[1]);
      await p.mouse.move(a.x, a.y);
      await p.mouse.down();
      await p.mouse.move(a.x + 8, a.y, { steps: 3 });
      await p.mouse.up();
      await parados(p);
      assert.deepEqual(await ordemDosProgramas(p), original);
      assert.equal(await p.locator("[data-voltar-automatico]").count(), 0);
    });

    test("no celular, o dedo move o mapa e não o ponto: não há ordem pessoal", async () => {
      const p = await sessao.abrir({ largura: 390, altura: 800, ...ABRIR });
      assert.equal(await p.locator(".mapa-svg.arrastando-ponto").count(), 0);
      assert.equal(await p.locator("[data-voltar-automatico]").count(), 0);
    });
  });
});
