/**
 * "Configurar o sistema" em janela central, em abas (27/10/2026; documentação técnica, seção 8.1): calendário,
 * cópia de segurança, usuários e espaços; cadastrar um usuário o põe na lista.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Configurar o sistema", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("janela no centro, com as abas, e o cadastro de usuário na lista", async () => {
    const p = await sessao.abrir({ largura: 1280, altura: 800 });
    await p.click('[data-item="sistema"]');
    await assentar(p);
    const caixa = await p.locator(".camada.configuracao .painel").boundingBox();
    assert.ok(Math.abs(caixa.x + caixa.width / 2 - 640) < 4, "centralizada");
    const abas = await p.locator(".config-aba").allTextContents();
    assert.deepEqual(abas.map((t) => t.trim()), ["Calendário geral", "Cópia de segurança", "Usuários", "Espaços"]);
    await p.click('[data-ir-aba="usuarios"]');
    await p.fill('[data-cadastrar-usuario] input[name="email"]', "Ana@UFCI.edu.br");
    await p.fill('[data-cadastrar-usuario] input[name="nome"]', "Ana Lima");
    await p.click('[data-cadastrar-usuario] button[type="submit"]');
    await assentar(p);
    const lista = await p.locator(".usuarios-sistema").textContent();
    assert.match(lista, /Ana Lima/);
    assert.match(lista, /ana@ufci\.edu\.br/);
    assert.equal(await p.locator('[data-ir-aba="usuarios"][aria-current="true"]').count(), 1, "continua na aba Usuários");
    assert.deepEqual(p.erros, []);
  });

  test("no celular, a lista das seções e uma de cada vez", async () => {
    const p = await sessao.abrir({ largura: 390, altura: 800 });
    await p.click('[data-inferior="espacos"]');
    await assentar(p);
    await p.locator('.lateral [data-item="sistema"]').click();
    await assentar(p);
    assert.ok(await p.locator(".config-nav").isVisible(), "a lista das seções");
    await p.click('[data-ir-aba="copia"]');
    await assentar(p, 200);
    assert.ok(await p.locator("[data-copia]").isVisible(), "a cópia de segurança aberta");
    assert.ok(!(await p.locator(".config-nav").isVisible()), "a lista some");
  });
});
