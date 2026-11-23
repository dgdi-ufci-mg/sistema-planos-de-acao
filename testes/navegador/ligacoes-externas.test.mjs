/**
 * Ligações externas da ação (23/11/2026; documentação técnica, seções 4.2.6 e 8, "Ligações externas da ação"):
 * na janela da tarefa, "Adicionar ligações externas" abre o formulário; colar o link do GLPI escolhe o sistema e o
 * número; Ligar grava; × desfaz; o mesmo chamado não entra duas vezes; Esc desiste sem fechar a janela.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

const GLPI = "https://glpi.ufcimg.edu.br/front/ticket.form.php?id=1234";

describe("Ligações externas no navegador", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  for (const largura of [1280, 390]) {
    test(`liga um chamado colando o link, recusa o repetido e desfaz (${largura} px)`, async () => {
      const p = await sessao.abrir({ largura });
      await p.locator(".linha[data-abrir-acao]").first().click();
      await p.waitForSelector(".camada.aberta .janela-grade");
      await assentar(p);
      const j = p.locator(".camada.aberta .painel");

      await j.locator('[data-mostrar-campo="ligacoesExternas"]').click();
      await assentar(p);
      const form = j.locator("[data-form-ligacao]");
      assert.ok(await form.locator('[name="link"]').evaluate((e) => e === document.activeElement), "o cursor vai para o link");

      /* Esc desiste do formulário sem fechar a janela */
      await p.keyboard.press("Escape");
      await assentar(p);
      assert.equal(await form.count(), 0);
      assert.equal(await p.locator(".camada.aberta .janela-grade").count(), 1, "a janela continua aberta");

      await j.locator('[data-mostrar-campo="ligacoesExternas"]').click();
      await assentar(p);
      await form.locator('[name="link"]').fill(GLPI);
      assert.equal(await form.locator('[name="sistema"]').inputValue(), "glpi", "o sistema vem do endereço");
      assert.equal(await form.locator('[name="identificador"]').inputValue(), "1234", "o número do chamado também");
      await form.locator('[name="titulo"]').fill("Troca da impressora");
      await form.locator('button[type="submit"]').click();
      await p.waitForTimeout(600);

      const itens = j.locator('[data-campo="ligacoesExternas"] .documentos-acao > li');
      assert.equal(await itens.count(), 1);
      assert.match(await itens.first().innerText(), /Troca da impressora[\s\S]*GLPI · Chamado 1234/);
      assert.equal(await itens.first().locator("a").getAttribute("href"), GLPI);

      /* e-mail do Horde: sem identificador, basta o assunto */
      await j.locator("[data-nova-ligacao]").click();
      await assentar(p);
      await form.locator('[name="link"]').fill("https://webmail.ufcimg.edu.br/horde/imp/dynamic.php?page=message&uid=42");
      assert.equal(await form.locator('[name="sistema"]').inputValue(), "horde");
      assert.match(await form.locator('[name="identificador"]').getAttribute("placeholder"), /opcional/);
      await form.locator('[name="titulo"]').fill("Convite para a reunião");
      await form.locator('button[type="submit"]').click();
      await p.waitForTimeout(600);
      assert.equal(await itens.count(), 2);
      assert.match(await itens.nth(1).innerText(), /Convite para a reunião\s*Horde/);
      await itens.nth(1).locator("[data-desligar]").click();
      await p.waitForTimeout(600);

      /* processo do SIPAC: basta escolher o sistema e digitar o NUP; o link é montado pelo Sextante */
      await j.locator("[data-nova-ligacao]").click();
      await assentar(p);
      await form.locator('[name="sistema"]').selectOption("sipac");
      await form.locator('[name="identificador"]').fill("23062.054143/2026-50");
      await form.locator('button[type="submit"]').click();
      await p.waitForTimeout(600);
      assert.equal(await itens.count(), 2);
      assert.match(await itens.nth(1).innerText(), /NUP 23062\.054143\/2026-50[\s\S]*SIPAC\/Protocolo/);
      assert.match(await itens.nth(1).locator("a").getAttribute("href"), /#sextante-nup=23062\.054143%2F2026-50$/);
      await itens.nth(1).locator("[data-desligar]").click();
      await p.waitForTimeout(600);

      /* o mesmo chamado de novo é recusado, com aviso */
      await j.locator("[data-nova-ligacao]").click();
      await assentar(p);
      await form.locator('[name="link"]').fill(GLPI);
      await form.locator('button[type="submit"]').click();
      await p.waitForTimeout(600);
      assert.match(await p.locator(".aviso-curto").innerText(), /já está ligado/);
      assert.equal(await itens.count(), 1);
      await form.locator("[data-cancelar-ligacao]").click();
      await assentar(p);

      const larguraDaPagina = await p.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(larguraDaPagina <= largura, "sem rolagem lateral");

      await itens.first().locator("[data-desligar]").click();
      await p.waitForTimeout(600);
      assert.equal(await itens.count(), 0, "× desfaz a ligação");
    });
  }
});
