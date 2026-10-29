/**
 * Strata: Mapa em tela cheia como porta de entrada (29/10/2026, tarde; documentação técnica, seção 8, "Strata").
 * Confere a tabela do levantamento: cada função que o Strata tinha continua alcançável pelo menu, pelo painel ou por
 * um botão sobre o mapa, e tudo abre por cima do mapa, que volta ao mesmo ponto ao fechar. No computador e num
 * celular simulado (390 px).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar } from "./apoio.mjs";

const ABRIR = { caminho: "strata/", aguardar: ".mapa-svg:not([data-movendo]) .mapa-no" };
const vista = (p) => p.locator("[data-mapa-mundo]").getAttribute("transform");
const abrirMenu = async (p) => { await p.click("[data-alternar-menu]"); await p.waitForSelector(".strata-menu.aberto"); };
const semRolagem = (p) => p.evaluate(() => {
  const r = document.documentElement;
  return r.scrollWidth <= r.clientWidth && r.scrollHeight <= r.clientHeight;
});

describe("Strata: Mapa em tela cheia como porta de entrada", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  for (const [nome, o] of [["computador", { largura: 1280, altura: 800 }], ["celular (390 px)", { largura: 390, altura: 800 }]]) {
    describe(nome, () => {
      test("abre no Mapa, que ocupa a tela toda; a página não rola para nenhum lado", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        const r = await p.evaluate(() => { const a = document.querySelector(".mapa-area").getBoundingClientRect(); return [a.width, a.height]; });
        assert.deepEqual(r, [o.largura, o.altura]);
        assert.ok(await semRolagem(p));
        assert.deepEqual(p.erros, []);
      });

      test("no alto: o título e a universidade à esquerda, o filtro e o menu à direita; nenhum ponto fica sob eles nem sob os botões", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        const instituicao = await p.locator("[data-instituicao]").innerText();
        assert.equal(instituicao.trim(), o.largura > 640 ? "Universidade Federal de Ciência e Inovação de Minas Gerais" : "UFCI-MG");
        const marca = await p.locator(".strata-cima .superior-marca").boundingBox();
        const menu = await p.locator("[data-alternar-menu]").boundingBox();
        const filtro = await p.locator("[data-alternar-vigentes]").boundingBox();
        assert.ok(marca.x < 40 && marca.y < 40, "título no alto, à esquerda");
        assert.ok(menu.x + menu.width > o.largura - 40 && menu.y < 40, "menu no alto, à direita");
        assert.ok(filtro.x + filtro.width > o.largura * 0.75 && filtro.y < 120, "filtro no alto, à direita, sempre à vista");
        const cobertos = await p.evaluate(() => {
          const caixas = [".strata-cima", ".strata-avisos", ".mapa-controles"].map((s) => document.querySelector(s).getBoundingClientRect());
          const [cima, avisos, botoes] = caixas;
          const baixoDoAlto = Math.max(cima.bottom, avisos.height ? avisos.bottom : 0);
          return [...document.querySelectorAll(".mapa-no .mapa-bolinha")].filter((c) => {
            const b = c.getBoundingClientRect();
            const sobBotoes = b.right > botoes.left && b.left < botoes.right && b.bottom > botoes.top && b.top < botoes.bottom;
            return b.top < baixoDoAlto || sobBotoes;
          }).length;
        });
        assert.equal(cobertos, 0, "ao abrir, nenhum ponto fica sob o título, o menu, os avisos ou os botões");
      });

      test("o menu tem, com nomes escritos, todas as funções que ficavam nas abas e na barra do topo", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        assert.equal(await p.locator("[data-alternar-menu]").getAttribute("aria-expanded"), "false");
        await abrirMenu(p);
        assert.equal(await p.locator("[data-alternar-menu]").getAttribute("aria-expanded"), "true");
        const textos = (await p.locator(".strata-menu .strata-menu-item, .strata-menu .strata-tema").allInnerTexts()).map((t) => t.trim());
        for (const t of ["Ver como lista", "Novo item", "Instrumentos", "Camadas", "Importar", "Como usar o mapa", "Automático", "Dia", "Noite", "Sextante: planos"]) {
          assert.ok(textos.includes(t), `"${t}" no menu`);
        }
        assert.equal(await p.locator('.strata-menu a[href="../sextante/"]').count(), 1, "volta ao Sextante");
        const caixa = await p.locator(".strata-menu").boundingBox();
        assert.ok(caixa.x >= 0 && caixa.x + caixa.width <= o.largura, "o menu cabe na largura");
        assert.ok(await semRolagem(p));
      });

      test("Esc ou um toque fora fecham o menu", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        await abrirMenu(p);
        await p.keyboard.press("Escape");
        await p.waitForSelector(".strata-menu:not(.aberto)", { state: "attached" });
        await abrirMenu(p);
        await p.mouse.click(o.largura / 2, o.altura - 60);
        await p.waitForSelector(".strata-menu:not(.aberto)", { state: "attached" });
        assert.equal(await p.locator("[data-alternar-menu]").getAttribute("aria-expanded"), "false");
      });

      for (const [chave, titulo, conteudo] of [["arvore", "Desdobramento", "[data-busca-arvore]"], ["instrumentos", "Instrumentos", "[data-novo-instrumento]"], ["camadas", "Camadas", "[data-salvar-camadas]"], ["importar", "Importar", "[data-conferir-catalogo]"]]) {
        test(`"${titulo}" abre por cima do mapa e, ao fechar, o mapa está no mesmo ponto, com o item aceso`, async () => {
          const p = await sessao.abrir({ ...o, ...ABRIR });
          await p.click("[data-mapa-mais]");
          await p.waitForTimeout(350);
          const ponto = p.locator(".mapa-no:not(.plano) .mapa-alvo").nth(2);
          await ponto.click({ force: true });
          const aceso = await p.locator(".mapa-no.selecionado").getAttribute("data-no");
          const antes = await vista(p);
          await abrirMenu(p);
          await p.click(`[data-abrir-folha="${chave}"]`);
          await p.waitForSelector(".strata-folha.aberta");
          assert.equal(await p.locator("#strata-folha-titulo").innerText(), titulo);
          assert.equal(await p.locator(`.strata-folha ${conteudo}`).count(), 1);
          const folha = await p.locator(".strata-folha").boundingBox();
          if (o.largura <= 640) assert.equal(Math.round(folha.width), o.largura, "no celular, a folha ocupa a largura toda");
          else assert.ok(folha.width < o.largura * 0.6, "no computador, a folha fica ao lado, com o mapa à vista");
          assert.equal(await p.locator(".mapa-area").count(), 1, "o mapa continua lá, por baixo");
          await p.click("[data-fechar-folha]");
          await p.waitForSelector(".strata-folha", { state: "hidden" });
          assert.equal(await vista(p), antes, "o mapa volta ao mesmo ponto");
          assert.equal(await p.locator(".mapa-no.selecionado").getAttribute("data-no"), aceso, "o item continua aceso");
          assert.ok(await semRolagem(p));
          assert.deepEqual(p.erros, []);
        });
      }

      test("Voltar (celular) e Esc fecham a folha", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        await abrirMenu(p);
        await p.click('[data-abrir-folha="instrumentos"]');
        await p.waitForSelector(".strata-folha.aberta");
        await p.goBack();
        await p.waitForSelector(".strata-folha", { state: "hidden" });
        assert.match(p.url(), /strata\/$/, "não saiu do Strata");
        await abrirMenu(p);
        await p.click('[data-abrir-folha="camadas"]');
        await p.waitForSelector(".strata-folha.aberta");
        await p.keyboard.press("Escape");
        await p.waitForSelector(".strata-folha", { state: "hidden" });
      });

      test("\"Novo item\", \"Como usar o mapa\" e \"Abrir\" do cartão abrem um painel por cima do mapa", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        await abrirMenu(p);
        await p.click(".strata-menu [data-novo-item]");
        await p.waitForSelector(".camada.aberta [data-novo-item-form]");
        await p.click(".camada.aberta [data-fechar] >> visible=true");
        await p.waitForSelector(".camada", { state: "detached" });
        await abrirMenu(p);
        await p.click("[data-como-usar]");
        assert.match(await p.locator(".camada .painel").innerText(), /vem de/);
        await p.click(".camada.aberta [data-fechar] >> visible=true");
        await p.waitForSelector(".camada", { state: "detached" });
        await p.locator(".mapa-no:not(.plano) .mapa-alvo").first().click({ force: true });
        await p.click("[data-mapa-abrir]");
        await p.waitForSelector(".camada.aberta .ficha-estrategia");
        assert.equal(await p.locator(".mapa-area").count(), 1);
      });

      test("céu e solo: as faixas continuam até as bordas da tela, o solo fica abaixo dos Planos de Ação e as estrelas do céu, só à noite", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR, tema: "dark" });
        const r = await p.evaluate(() => {
          const caixa = (s) => document.querySelector(s).getBoundingClientRect();
          const alem = [...document.querySelectorAll(".mapa-faixa-alem")].map((f) => f.getBoundingClientRect());
          const solo = caixa(".mapa-solo");
          const planos = caixa('.mapa-faixa[data-camada="planosDeAcao"]');
          const visiveis = [...document.querySelectorAll(".mapa-estrela")].filter((e) => getComputedStyle(e).display !== "none").length;
          return { faixas: alem.length, cobrem: alem.every((f) => f.left <= 0 && f.right >= innerWidth), soloAbaixo: solo.top >= planos.top + planos.height / 2, visiveis };
        });
        assert.equal(r.faixas, await p.locator(".mapa-faixa").count(), "uma continuação por faixa");
        assert.ok(r.cobrem, "as faixas vão de uma borda à outra da tela, sem emenda");
        assert.ok(r.soloAbaixo, "o solo começa na base dos Planos de Ação");
        assert.ok(r.visiveis > 0, "estrelas à noite");
        const dia = await sessao.abrir({ ...o, ...ABRIR, tema: "light" });
        assert.equal(await dia.evaluate(() => [...document.querySelectorAll(".mapa-estrela")].filter((e) => getComputedStyle(e).display !== "none").length), 0, "de dia, sem estrelas");
      });

      test("o tema escolhido no menu troca na hora e fica neste aparelho", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        await abrirMenu(p);
        await p.click('[data-tema="escuro"]');
        assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), "dark");
        assert.equal(await p.locator('[data-tema="escuro"]').getAttribute("aria-pressed"), "true");
        await p.click('[data-tema="claro"]');
        assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), "light");
        await p.click('[data-tema="automatico"]');
        assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), undefined);
      });
    });
  }
});
