/**
 * Painel público (18/11/2026; documentação técnica, seções 4.13 e 8.8): em "Configurar este espaço", o administrador
 * liga o painel, vê o endereço, escreve a apresentação e vê a prévia; a página painel/ abre sem login e, sem banco
 * (testes), avisa que o painel não foi encontrado.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Painel público", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const abrirSecao = async (p, largura) => {
    if (largura <= 640) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
    await p.locator(".lateral .espaco-item.atual [data-configurar]").click();
    await assentar(p);
    const painel = p.locator(".camada.aberta");
    await painel.locator('.config-nav button:has-text("Painel público"), [data-secao="painel"] > summary').first().click();
    await assentar(p);
    return painel;
  };

  for (const largura of [1280, 390]) {
    test(`liga, mostra o endereço, grava a apresentação e abre a prévia (${largura} px)`, async () => {
      const p = await sessao.abrir({ largura });
      const painel = await abrirSecao(p, largura);
      const chave = painel.locator("[data-painel-ligado]");
      assert.equal(await chave.isChecked(), false, "começa desligado");
      await chave.check();
      await assentar(p, 600);
      const endereco = await painel.locator("[data-endereco-painel]").inputValue();
      assert.match(endereco, /\/painel\/\?p=[A-Za-z0-9]{20}$/, "endereço com código de 20 caracteres");
      await painel.locator("[data-apresentacao-painel]").fill("Para que serve este plano.");
      await painel.locator("[data-apresentacao-painel]").press("Tab");
      await assentar(p, 600);
      await painel.locator("[data-previa-painel]").click();
      await assentar(p, 600);
      const previa = painel.locator(".pp-previa");
      assert.equal(await previa.isVisible(), true);
      assert.equal(await previa.locator(".pp-apresentacao").textContent(), "Para que serve este plano.");
      assert.ok(await previa.locator(".pp-linha").count() > 0, "a prévia lista as ações");
      if (largura <= 640) {
        const larguraDaPagina = await p.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(larguraDaPagina <= largura + 1, "sem rolagem lateral no celular");
      }
      /* gerar novo endereço pede confirmação e troca o código */
      await painel.locator("[data-novo-endereco]").click();
      await painel.locator("[data-confirmar-endereco]").click();
      await assentar(p, 600);
      assert.notEqual(await painel.locator("[data-endereco-painel]").inputValue(), endereco);
      assert.deepEqual(p.erros, []);
    });
  }

  test("a página do painel abre sem login e avisa quando o painel não existe", async () => {
    const p = await sessao.abrir({ largura: 390, exemplo: false, caminho: "painel/?p=AAAAAAAAAAAAAAAAAAAA", aguardar: ".pp-mensagem" });
    assert.equal((await p.locator(".pp-mensagem h1").textContent()).trim(), "Painel não encontrado");
    assert.equal(await p.locator(".pp-selo").textContent(), "Painel público · somente leitura");
    assert.deepEqual(p.erros, []);
  });
});
