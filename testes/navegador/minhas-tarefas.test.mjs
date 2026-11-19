/**
 * Meu trabalho, antes Minhas tarefas (documentação técnica, seção 8, "Meu trabalho"; 05/11/2026 e 19/11/2026): o item da
 * barra lateral só aparece com login; a tela junta as tarefas de quem entrou; tocar abre a janela da tarefa por cima da
 * lista, sem sair dela (18/11/2026), e o nome do espaço, no cabeçalho da janela, abre o espaço; Voltar volta. Desde
 * 19/11/2026: "Filtros e exibição" (agrupar, ordenar, colunas, ocultar), arrastar na minha ordem, o círculo de concluir
 * e a explicação dos avisos.
 *
 * Login simulado: o `config.js` devolve uma configuração qualquer e o `js/banco/firebase.js` é trocado por um módulo de
 * teste que usa o banco em memória, com os três espaços de exemplo, e diz que entrou a Ana Souza. Nada sai para a internet.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, dedo } from "./apoio.mjs";

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

describe("Meu trabalho", { skip: pular }, () => {
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

    test(`${largura} px: a tela agrupa por prazo em "Filtros e exibição", e tocar abre a tarefa por cima da lista; Voltar fecha a janela`, async () => {
      const p = await sessao.abrir({ largura, exemplo: false, rotas: comLogin });
      if (largura <= 640) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
      await p.locator(".lateral [data-item=minhasTarefas]").click();
      await p.waitForSelector(".minhas-item");
      assert.equal(new URL(p.url()).hash, "#/meu-trabalho");
      assert.equal(await p.locator(".lateral [data-item=minhasTarefas][aria-current=page]").count(), 1);
      /* padrão: minha ordem, sem agrupamento (sem títulos de grupo) */
      assert.equal(await p.locator(".mt-grupo-nome").count(), 0);
      await p.click("[data-painel-mt]");
      await p.click('[data-agrupar="prazo"]');
      await p.keyboard.press("Escape");
      await assentar(p);
      const titulos = await p.locator(".mt-grupo-nome").allTextContents();
      assert.equal(titulos[0], "Vencidas ou em risco");
      assert.ok(titulos.includes("Sem data"));
      assert.equal(await p.locator(".minhas-vencidas .minhas-nome").first().textContent(), "Responder o ofício da Auditoria Interna");
      assert.equal(await p.locator(".minhas-vencidas .mt-aviso").first().textContent(), "Prazo vencido");
      assert.match(await p.locator(".minhas-vencidas .minhas-prazo").first().textContent(), /^até \d{2}\/\d{2}$/);
      /* nada da Carla nem do Bruno */
      const nomes = await p.locator(".minhas-nome").allTextContents();
      assert.ok(!nomes.includes("Enviar a frequência do mês"));
      assert.ok(!nomes.includes("Revisar a consulta de matrículas"));
      /* nenhuma linha passa da largura da tela */
      const larguraDaPagina = await p.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(larguraDaPagina <= largura, `sem rolagem para o lado (${larguraDaPagina} px)`);

      await p.locator(".minhas-vencidas .minhas-item").first().click();
      await p.waitForSelector(".camada.aberta");
      await assentar(p);
      /* a janela abre por cima da lista, sem ir ao espaço (18/11/2026) */
      assert.equal(new URL(p.url()).hash, "#/meu-trabalho");
      assert.ok(await p.locator(".minhas-item").count() > 0);
      /* a janela aberta é a da tarefa tocada (o nome pode estar num campo editável) */
      const naJanela = await p.locator(".camada.aberta").evaluate((c) => c.textContent + [...c.querySelectorAll("input, textarea")].map((i) => i.value).join(" "));
      assert.ok(naJanela.includes("Responder o ofício da Auditoria Interna"));
      /* o nome do espaço, no cabeçalho, é o link para o espaço */
      assert.equal(await p.locator(".camada.aberta header h2 [data-abrir-espaco]").textContent(), "Exemplo: tarefas da equipe de dados");

      /* Voltar fecha a janela, e a lista continua */
      await p.goBack();
      await assentar(p);
      assert.equal(await p.locator(".camada.aberta").count(), 0);
      assert.equal(new URL(p.url()).hash, "#/meu-trabalho");
      assert.ok(await p.locator(".minhas-item").count() > 0);
      assert.deepEqual(p.erros, []);
    });
  }

  test("as setas da janela seguem a ordem da lista, de um espaço a outro", async () => {
    const p = await sessao.abrir({ largura: 1280, exemplo: false, rotas: comLogin });
    await p.locator(".lateral [data-item=minhasTarefas]").click();
    await p.waitForSelector(".minhas-item");
    const ordem = await p.locator(".minhas-nome").allTextContents();
    await p.locator(".minhas-item").first().click();
    await p.waitForSelector(".camada.aberta");
    await assentar(p);
    assert.ok(await p.locator('.camada.aberta [data-ir="-1"]').isDisabled(), "a primeira da lista não tem anterior");
    const espacoAntes = await p.locator(".camada.aberta header h2").textContent();
    await p.locator('.camada.aberta [data-ir="1"]').click();
    await p.waitForFunction((nome) => document.querySelector(".camada.aberta [name=rotulo]")?.value === nome, ordem[1]);
    assert.notEqual(await p.locator(".camada.aberta header h2").textContent(), espacoAntes, "a segunda da lista é de outro espaço");
    await p.keyboard.press("Alt+ArrowUp");
    await p.waitForFunction((nome) => document.querySelector(".camada.aberta [name=rotulo]")?.value === nome, ordem[0]);
    assert.equal(await p.locator(".camada.aberta header h2").textContent(), espacoAntes);
    assert.deepEqual(p.erros, []);
  });

  test("concluir na janela tira a tarefa da lista ao fechar", async () => {
    const p = await sessao.abrir({ largura: 1280, exemplo: false, rotas: comLogin });
    await p.locator(".lateral [data-item=minhasTarefas]").click();
    await p.waitForSelector(".minhas-item");
    const nome = "Responder o ofício da Auditoria Interna";
    await p.locator(".minhas-item", { hasText: nome }).click();
    await p.waitForSelector(".camada.aberta");
    await assentar(p);
    await p.locator(".camada.aberta [data-marcar-janela]").click();
    await assentar(p);
    await p.locator(".camada.aberta [data-fechar]").last().click();
    await p.waitForFunction((n) => ![...document.querySelectorAll(".minhas-nome")].some((e) => e.textContent === n), nome);
    assert.equal(new URL(p.url()).hash, "#/meu-trabalho");
    assert.deepEqual(p.erros, []);
  });

  test("o nome do espaço na janela abre o espaço com a tarefa; Voltar volta à lista", async () => {
    const p = await sessao.abrir({ largura: 1280, exemplo: false, rotas: comLogin });
    await p.locator(".lateral [data-item=minhasTarefas]").click();
    await p.waitForSelector(".minhas-item");
    await p.locator(".minhas-item").first().click();
    await p.waitForSelector(".camada.aberta");
    await assentar(p);
    await p.locator(".camada.aberta header h2 [data-abrir-espaco]").click();
    await p.waitForURL(/#\/espaco\//);
    await p.waitForSelector(".camada.aberta");
    await assentar(p);
    const naJanela = await p.locator(".camada.aberta").evaluate((c) => [...c.querySelectorAll("input, textarea")].map((i) => i.value).join(" "));
    assert.ok(naJanela.includes("Responder o ofício da Auditoria Interna"));
    /* na tela do espaço, o nome no cabeçalho volta a ser texto */
    assert.equal(await p.locator(".camada.aberta header h2 [data-abrir-espaco]").count(), 0);
    await p.goBack();
    await assentar(p);
    assert.equal(await p.locator(".camada.aberta").count(), 0);
    await p.goBack();
    await p.waitForSelector(".minhas-item");
    assert.equal(new URL(p.url()).hash, "#/meu-trabalho");
    assert.deepEqual(p.erros, []);
  });

  test("recarregar no endereço de Meu trabalho abre a mesma tela; o endereço antigo também", async () => {
    const p = await sessao.abrir({ largura: 1280, exemplo: false, rotas: comLogin });
    await p.locator(".lateral [data-item=minhasTarefas]").click();
    await p.waitForSelector(".minhas-item");
    await p.reload();
    await p.waitForSelector(".minhas-item");
    assert.equal(await p.locator("[data-titulo]").textContent(), "Meu trabalho");
    await p.goto(p.url().replace("#/meu-trabalho", "#/minhas-tarefas"));
    await p.reload();
    await p.waitForSelector(".minhas-item");
    assert.equal(await p.locator("[data-titulo]").textContent(), "Meu trabalho");
    assert.deepEqual(p.erros, []);
  });

  test("Filtros e exibição: por espaço, colunas, ocultar as não liberadas e Limpar; a escolha fica ao reabrir", async () => {
    const p = await sessao.abrir({ largura: 1280, exemplo: false, rotas: comLogin });
    await p.locator(".lateral [data-item=minhasTarefas]").click();
    await p.waitForSelector(".minhas-item");
    const total = await p.locator(".mt-linha").count();
    await p.click("[data-painel-mt]");
    await p.click('[data-agrupar="espaco"]');
    assert.equal(await p.locator("[data-popover]").count(), 1, "o painel continua aberto depois da escolha");
    await p.click('[data-ocultar="naoLiberadas"]');
    await p.click("[data-painel-mt]");
    await assentar(p);
    assert.equal(await p.locator("[data-popover]").count(), 0);
    const nomes = await p.locator(".mt-grupo-nome").allTextContents();
    assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")), "espaços em ordem alfabética");
    assert.equal(await p.locator(".mt-linha.nao-liberada").count(), 0);
    assert.ok(await p.locator(".mt-linha").count() < total);
    assert.equal(await p.locator("[data-painel-mt] .contador").textContent(), "2");
    /* colunas: os grupos lado a lado, sem rolagem da página para o lado */
    await p.click("[data-painel-mt]");
    await p.click('[data-exibir="colunas"]');
    await p.keyboard.press("Escape");
    await assentar(p);
    assert.equal(await p.locator(".minhas-tarefas.em-colunas").count(), 1);
    const tops = await p.locator(".em-colunas .minhas-grupo").evaluateAll((gs) => gs.map((g) => Math.round(g.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, "colunas na mesma altura");
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 1280);
    /* reabrir a tela mantém a escolha (guardada no aparelho) */
    await p.reload();
    await p.waitForSelector(".minhas-item");
    assert.equal(await p.locator(".minhas-tarefas.em-colunas").count(), 1);
    await p.click("[data-limpar]");
    await assentar(p);
    assert.equal(await p.locator(".em-colunas").count(), 0);
    assert.equal(await p.locator(".mt-grupo-nome").count(), 0);
    assert.equal(await p.locator(".mt-linha").count(), total);
    assert.equal(await p.locator("[data-limpar]").count(), 0);
    assert.deepEqual(p.erros, []);
  });

  test("minha ordem: arrastar pelo puxador muda a ordem e ela vale ao refazer a tela; setas também", async () => {
    const p = await sessao.abrir({ largura: 1280, exemplo: false, rotas: comLogin });
    await p.locator(".lateral [data-item=minhasTarefas]").click();
    await p.waitForSelector(".minhas-item");
    const antes = await p.locator(".minhas-nome").allTextContents();
    const puxador = p.locator(".mt-linha").nth(0).locator("[data-puxar]");
    const destino = await p.locator(".mt-linha").nth(2).boundingBox();
    const de = await puxador.boundingBox();
    await p.mouse.move(de.x + de.width / 2, de.y + de.height / 2);
    await p.mouse.down();
    for (let i = 1; i <= 12; i++) await p.mouse.move(de.x + de.width / 2, de.y + de.height / 2 + ((destino.y + destino.height * 0.75 - de.y) * i) / 12);
    await p.mouse.up();
    await assentar(p);
    const depois = await p.locator(".minhas-nome").allTextContents();
    assert.deepEqual(depois.slice(0, 3), [antes[1], antes[2], antes[0]]);
    /* a ordem vale depois de refazer a tela (trocar a ordenação e voltar) */
    await p.click("[data-painel-mt]");
    await p.click('[data-ordenar="data"]');
    assert.equal(await p.locator("[data-puxar]").count(), 0, "por data, sem puxadores");
    await p.click('[data-ordenar="minha"]');
    await p.keyboard.press("Escape");
    await assentar(p);
    assert.deepEqual(await p.locator(".minhas-nome").allTextContents(), depois);
    /* seta para cima no puxador sobe uma posição */
    await p.locator(".mt-linha").nth(2).locator("[data-puxar]").focus();
    await p.keyboard.press("ArrowUp");
    await assentar(p);
    assert.deepEqual((await p.locator(".minhas-nome").allTextContents()).slice(0, 3), [depois[0], depois[2], depois[1]]);
    assert.equal(await p.evaluate(() => document.activeElement?.closest(".mt-linha")?.querySelector(".minhas-nome")?.textContent), depois[2], "o foco fica no puxador movido");
    assert.deepEqual(p.erros, []);
  });

  test("390 px: o dedo arrasta pelo puxador, sem rolar a página", async () => {
    const p = await sessao.abrir({ largura: 390, exemplo: false, rotas: comLogin });
    await p.click('[data-inferior="espacos"]');
    await assentar(p);
    await p.locator(".lateral [data-item=minhasTarefas]").click();
    await p.waitForSelector(".minhas-item");
    await assentar(p);
    const antes = await p.locator(".minhas-nome").allTextContents();
    const de = await p.locator(".mt-linha").nth(0).locator("[data-puxar]").boundingBox();
    const alvo = await p.locator(".mt-linha").nth(1).boundingBox();
    const toque = await dedo(p);
    await toque.arrastar(de.x + de.width / 2, de.y + de.height / 2, 0, alvo.y + alvo.height * 0.8 - de.y, { passos: 14 });
    await assentar(p);
    assert.deepEqual((await p.locator(".minhas-nome").allTextContents()).slice(0, 2), [antes[1], antes[0]]);
    assert.equal(await p.evaluate(() => scrollY), 0);
    assert.deepEqual(p.erros, []);
  });

  test("o círculo conclui a tarefa do quadro, com Desfazer; no plano, abre a janela", async () => {
    const p = await sessao.abrir({ largura: 1280, exemplo: false, rotas: comLogin });
    await p.locator(".lateral [data-item=minhasTarefas]").click();
    await p.waitForSelector(".minhas-item");
    const nome = "Marcar reunião com a PROGRAD";
    await p.locator(".mt-linha", { hasText: nome }).locator("[data-concluir]").click();
    await p.waitForFunction((n) => ![...document.querySelectorAll(".minhas-nome")].some((e) => e.textContent === n), nome);
    await p.locator(".aviso-curto .aviso-acao", { hasText: "Desfazer" }).click();
    await p.waitForFunction((n) => [...document.querySelectorAll(".minhas-nome")].some((e) => e.textContent === n), nome);
    /* ação de plano: a conclusão pede a data, e o círculo abre a janela */
    await p.locator(".mt-linha", { hasText: "Modelar os dados de ensino" }).locator("[data-concluir]").click();
    await p.waitForSelector(".camada.aberta");
    assert.deepEqual(p.erros, []);
  });

  test("o aviso mostra a explicação, com o link do glossário", async () => {
    const p = await sessao.abrir({ largura: 390, exemplo: false, rotas: comLogin });
    await p.click('[data-inferior="espacos"]');
    await assentar(p);
    await p.locator(".lateral [data-item=minhasTarefas]").click();
    await p.waitForSelector(".minhas-item");
    const dica = p.locator(".mt-dica").first();
    assert.equal(await dica.isVisible(), false);
    await p.locator(".mt-aviso").first().tap();
    assert.equal(await dica.isVisible(), true);
    assert.match(await dica.textContent(), /data-limite/);
    await dica.locator("[data-termo]").tap();
    await p.waitForSelector("#termo-prazoVencido");
    assert.equal(new URL(p.url()).hash, "#/meu-trabalho", "o aviso não abre a ação");
    assert.deepEqual(p.erros, []);
  });
});
