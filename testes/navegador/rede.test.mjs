/**
 * Rede no navegador (27/10/2026, pedido do responsável; documentação técnica, seção 8.4): círculos de início e de
 * término com as datas, cercas em volta das ações de cada etapa e linha vertical no fim de cada fase.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Rede: início, término, cercas das etapas e marcos das fases", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("círculos com as datas, uma faixa por fase e tracejado entre as etapas", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 820 });
    await p.click('.menu-topo[data-pop="modo"]');
    await p.locator('[data-modo="rede"]').first().click();
    await p.waitForSelector(".rede-no");
    await assentar(p);
    assert.match(await p.locator(".rede-ponto.inicio").innerText(), /Início\s+\d{2}\/\d{2}\/\d{4}/i);
    assert.match(await p.locator(".rede-ponto.termino").innerText(), /Término\s+\d{2}\/\d{2}\/\d{4}/i);
    assert.equal(await p.locator(".rede-marco").count(), 0, "sem os marcos antigos");
    /* 27/10/2026: uma cerca por etapa, em volta dos cartões, e uma linha no fim de cada fase */
    const fases = await p.locator(".rede-fase-nome").allInnerTexts();
    assert.ok(fases.length >= 2 && fases.every((f) => /^Fase/.test(f)));
    assert.ok(await p.locator(".rede-cerca").count() >= 4, "uma cerca por etapa");
    assert.equal(await p.locator(".rede-fase, .rede-etapa").count(), 0, "sem as faixas antigas");
    /* o círculo de início fica antes de tudo e o de término depois de tudo */
    const xs = await p.evaluate(() => {
      const r = (el) => el.getBoundingClientRect();
      const nos = [...document.querySelectorAll(".rede-no")].map(r);
      return { inicio: r(document.querySelector(".rede-ponto.inicio")).right, termino: r(document.querySelector(".rede-ponto.termino")).left,
        min: Math.min(...nos.map((n) => n.left)), max: Math.max(...nos.map((n) => n.right)) };
    });
    assert.ok(xs.inicio < xs.min && xs.termino > xs.max);
    assert.ok(await p.locator(".rede-ligacao").count() >= 2);
    assert.deepEqual(p.erros, []);
  });
});
