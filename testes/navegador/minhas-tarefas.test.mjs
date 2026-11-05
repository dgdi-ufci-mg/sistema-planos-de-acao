/**
 * Minhas tarefas (documentação técnica, seção 8, "Minhas tarefas"; 05/11/2026): o item da barra lateral só aparece com
 * login; a tela junta as tarefas de quem entrou, por prazo; tocar abre o espaço com a janela da tarefa, e Voltar volta.
 *
 * Login simulado: o `config.js` devolve uma configuração qualquer e o `js/banco/firebase.js` é trocado por um módulo de
 * teste que usa o banco em memória, com os três espaços de exemplo, e diz que entrou a Ana Souza. Nada sai para a internet.
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

describe("Minhas tarefas", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("sem login, o item não aparece na barra lateral", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    assert.equal(await p.locator(".lateral [data-item=minhasTarefas]").count(), 0);
    assert.deepEqual(p.erros, []);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px: com login, o item fica abaixo de "Novo espaço", com o número das atrasadas e de hoje`, async () => {
      const p = await sessao.abrir({ largura, exemplo: false, rotas: comLogin });
      await p.waitForSelector(".lateral [data-item=minhasTarefas] .n");
      assert.equal(await p.locator(".lateral-novo + [data-item=minhasTarefas]").count(), 1);
      assert.equal(await p.locator(".lateral [data-item=minhasTarefas] .n").textContent(), "1");
      assert.deepEqual(p.erros, []);
    });

    test(`${largura} px: a tela agrupa por prazo, e tocar abre a tarefa no espaço; Voltar volta à lista`, async () => {
      const p = await sessao.abrir({ largura, exemplo: false, rotas: comLogin });
      if (largura <= 640) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
      await p.locator(".lateral [data-item=minhasTarefas]").click();
      await p.waitForSelector(".minhas-item");
      assert.equal(new URL(p.url()).hash, "#/minhas-tarefas");
      assert.equal(await p.locator(".lateral [data-item=minhasTarefas][aria-current=page]").count(), 1);
      const titulos = await p.locator(".minhas-grupo h2").evaluateAll((hs) => hs.map((h) => h.firstChild.textContent.trim()));
      assert.equal(titulos[0], "Atrasadas");
      assert.ok(titulos.includes("Sem prazo"));
      assert.equal(await p.locator(".minhas-atrasadas .minhas-nome").first().textContent(), "Responder o ofício da Auditoria Interna");
      /* nada da Carla nem do Bruno */
      const nomes = await p.locator(".minhas-nome").allTextContents();
      assert.ok(!nomes.includes("Enviar a frequência do mês"));
      assert.ok(!nomes.includes("Revisar a consulta de matrículas"));
      /* nenhuma linha passa da largura da tela */
      const larguraDaPagina = await p.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(larguraDaPagina <= largura, `sem rolagem para o lado (${larguraDaPagina} px)`);

      await p.locator(".minhas-atrasadas .minhas-item").first().click();
      await p.waitForSelector(".camada.aberta");
      await assentar(p);
      assert.match(new URL(p.url()).hash, /^#\/espaco\//);
      /* a janela aberta é a da tarefa tocada (o nome pode estar num campo editável) */
      const naJanela = await p.locator(".camada.aberta").evaluate((c) => c.textContent + [...c.querySelectorAll("input, textarea")].map((i) => i.value).join(" "));
      assert.ok(naJanela.includes("Responder o ofício da Auditoria Interna"));

      /* Voltar fecha a janela; Voltar de novo volta a Minhas tarefas */
      await p.goBack();
      await assentar(p);
      assert.equal(await p.locator(".camada.aberta").count(), 0);
      await p.goBack();
      await p.waitForSelector(".minhas-item");
      assert.equal(new URL(p.url()).hash, "#/minhas-tarefas");
      assert.deepEqual(p.erros, []);
    });
  }

  test("recarregar no endereço de Minhas tarefas abre a mesma tela", async () => {
    const p = await sessao.abrir({ largura: 1280, exemplo: false, rotas: comLogin });
    await p.locator(".lateral [data-item=minhasTarefas]").click();
    await p.waitForSelector(".minhas-item");
    await p.reload();
    await p.waitForSelector(".minhas-item");
    assert.equal(await p.locator("[data-titulo]").textContent(), "Minhas tarefas");
    assert.deepEqual(p.erros, []);
  });
});
