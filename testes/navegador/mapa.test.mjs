/**
 * Mapa do Strata (lote 1, 29/10/2026; documentação técnica, seção 8, "Mapa"): faixas na ordem do catálogo, camada
 * opcional vazia sem faixa, nenhum ponto fora da faixa, linhas "vem de" e sem rolagem lateral da página. No
 * computador e num celular simulado (390 px).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar } from "./apoio.mjs";

const ABRIR = { caminho: "strata/", aguardar: ".mapa-no" };
const sem = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

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
        assert.deepEqual(ids, ["objetivoEstrategico", "objetivoDesenvolvimento", "politica", "portfolio", "programa", "planosDeAcao"]);
        assert.ok(await sem(p), "a página não rola para o lado");
        assert.deepEqual(p.erros, []);
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
        assert.equal(fora.pontos, 10, "o catálogo de exemplo tem 10 itens");
      });

      test("as linhas ligam cada item ao que ele vem de", async () => {
        const p = await sessao.abrir({ ...o, ...ABRIR });
        const ligacoes = await p.locator(".mapa-ligacao").evaluateAll((l) => l.map((x) => x.dataset.de));
        assert.equal(ligacoes.length, 10, "OD1, OD2, POL1, POL2 (duas), PF1, PRG1, PRG2 (duas) e PRG3");
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
});
