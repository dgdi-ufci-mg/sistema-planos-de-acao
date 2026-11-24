/**
 * Painel lateral das ligações externas (passo 3.8, parte 2; documentação técnica, seção 8, "Painel lateral das ligações
 * externas"): a extensão abre #/ligacoes?tipo=…&id=…&titulo=…; a tela mostra o item, as tarefas ligadas, a busca para
 * ligar e "Criar tarefa". Login simulado como em minhas-tarefas.test.mjs (banco em memória com os exemplos; a Ana entrou).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

const FIREBASE_DE_TESTE = `
import { criarBancoLocal } from "./local.js";
import { criarStore } from "../dados.js";
import { carregarExemplo, carregarExemploDeQuadro, carregarExemploDeLista } from "../exemplo.js";
export const VERSAO_SDK = "teste";
export async function conectarFirebase() {
  const banco = criarBancoLocal();
  const semeador = criarStore(banco);
  semeador.definirUsuario("ana.souza@ufci.edu.br");
  await carregarExemplo(semeador);
  await carregarExemploDeQuadro(semeador);
  await carregarExemploDeLista(semeador);
  let ouvinte = null;
  const acesso = {
    aoMudarUsuario(f) { ouvinte = f; f("ana.souza@ufci.edu.br"); },
    async sair() { ouvinte?.(null); },
    criarConta: null,
  };
  return { banco, acesso };
}`;

/** Simula o login da Ana, sem Firebase. */
const comLogin = async (contexto) => {
  await contexto.route("**/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: "export const FIREBASE_CONFIG = { teste: true };" }));
  await contexto.route("**/js/banco/firebase.js", (r) => r.fulfill({ contentType: "text/javascript", body: FIREBASE_DE_TESTE }));
};

const ITEM = "#/ligacoes?tipo=processo&id=23062.054143%2F2026-50&titulo=" + encodeURIComponent("Relatório de gestão de 2026");

describe("Painel lateral das ligações externas", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  for (const largura of [360, 1280]) {
    test(`${largura} px: mostra o item, liga uma tarefa pela busca, abre a tarefa e cria outra já ligada`, async () => {
      const p = await sessao.abrir({ largura, exemplo: false, rotas: comLogin, caminho: `sextante/${ITEM}`, aguardar: ".painel-ligacoes .pl-busca" });
      const tela = p.locator(".painel-ligacoes");
      assert.equal(await tela.locator(".pl-item h2").textContent(), "Relatório de gestão de 2026");
      assert.match(await tela.locator(".pl-tipo").textContent(), /Processo \(SIPAC\) · NUP 23062\.054143\/2026-50/);
      assert.match(await tela.locator(".pl-abrir").getAttribute("href"), /#sextante-processo=23062\.054143%2F2026-50$/);
      assert.match(await tela.locator("[data-pl-ligadas]").innerText(), /Nenhuma tarefa ligada a este processo/);

      /* busca sem acento e sem maiúscula; Ligar grava e a tarefa passa para "Tarefas ligadas" */
      await tela.locator("[data-pl-busca]").fill("MODELAR ensino");
      const resultado = tela.locator("[data-pl-resultados] .pl-linha");
      assert.equal(await resultado.count(), 1);
      assert.match(await resultado.innerText(), /Modelar os dados de ensino/);
      await resultado.locator("[data-pl-ligar]").click();
      await p.waitForSelector("[data-pl-ligadas] .pl-linha");
      assert.match(await tela.locator("[data-pl-ligadas]").innerText(), /Modelar os dados de ensino/);
      await tela.locator("[data-pl-busca]").fill("modelar");
      assert.equal(await tela.locator("[data-pl-resultados] .pl-linha").count(), 0, "a já ligada sai da busca");

      /* tocar na ligada abre a janela da tarefa, com a ligação nela */
      await tela.locator("[data-pl-ligadas] .pl-tarefa").first().click();
      await p.waitForSelector(".camada.aberta .janela-grade");
      await assentar(p);
      assert.match(await p.locator('.camada.aberta [data-campo="ligacoesExternas"]').innerText(), /Relatório de gestão de 2026/);
      await p.keyboard.press("Escape");
      await assentar(p);

      /* Criar tarefa: o nome vem do título do item */
      await p.locator("[data-pl-novo]").click();
      const form = p.locator("[data-pl-criar]");
      assert.equal(await form.locator('[name="nome"]').inputValue(), "Relatório de gestão de 2026");
      await form.locator('[type="submit"]').click();
      await p.waitForFunction(() => document.querySelectorAll("[data-pl-ligadas] .pl-linha").length === 2);

      const larguraDaPagina = await p.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(larguraDaPagina <= largura, "sem rolagem lateral");
      assert.deepEqual(p.erros, []);
    });
  }

  test("a extensão troca o item: o painel acompanha o endereço; sem item, explica", async () => {
    const p = await sessao.abrir({ largura: 360, exemplo: false, rotas: comLogin, caminho: `sextante/${ITEM}`, aguardar: ".painel-ligacoes .pl-busca" });
    await p.evaluate(() => { location.hash = "#/ligacoes?tipo=chamado&id=1234&titulo=Impressora&link=" + encodeURIComponent("https://glpi.cefetmg.br/front/ticket.form.php?id=1234"); });
    await p.waitForFunction(() => document.querySelector(".pl-item h2")?.textContent === "Impressora");
    assert.match(await p.locator(".pl-tipo").textContent(), /Chamado \(GLPI\)/);
    await p.evaluate(() => { location.hash = "#/ligacoes"; });
    await p.waitForSelector(".pl-vazio-geral");
    assert.deepEqual(p.erros, []);
  });
});
