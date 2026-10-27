/**
 * Barra lateral (documentação técnica, seção 8.0): a lista de espaços tem só os espaços e "Novo espaço";
 * "Espaços abertos à consulta" fica no grupo "Mais" (decisão do responsável, 27/10/2026).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Barra lateral", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  for (const largura of [390, 1280]) {
    test(`${largura} px: "Espaços abertos à consulta" fica no "Mais", e não na lista de espaços`, async () => {
      const p = await sessao.abrir({ largura });
      if (largura <= 640) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
      assert.equal(await p.locator(".lateral-espacos [data-item=consulta]").count(), 0);
      assert.equal(await p.locator(".lateral-mais [data-item=consulta]").count(), 1);
      /* abrir o "Mais" e tocar no item abre a página da consulta */
      const mais = p.locator(".lateral-mais");
      if (!(await mais.evaluate((d) => d.open))) await mais.locator("summary").click();
      await p.locator(".lateral-mais [data-item=consulta]").click();
      await assentar(p);
      assert.equal(await p.locator('.camada.aberta [aria-label="Espaços abertos à consulta"]').count(), 1);
      assert.deepEqual(p.erros, []);
    });
  }
});
