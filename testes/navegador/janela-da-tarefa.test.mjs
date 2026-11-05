/**
 * Janela da tarefa (revisão de 04/11/2026, pedido do responsável, tomando o Todoist como referência; documentação técnica,
 * seção 8, "Ação"): a data-limite aparece uma vez só; sem atividade, uma coluna só, com o histórico no fim; ajuda no "?", e não em frases fixas; descrição com cara de texto, e não de caixa; título com o nome da lista; círculo de concluída antes do nome; situação sem o cadeado.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

/** Abre o exemplo "minhas tarefas" e a tarefa `nome`. */
async function abrirTarefa(sessao, nome, opcoes = {}, espaco = "minhas tarefas", linha = ".item") {
  const p = await sessao.abrir(opcoes);
  if ((opcoes.largura ?? 390) <= 640) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
  await p.locator(".lateral [data-espaco]").filter({ hasText: espaco }).click();
  await p.waitForSelector(`${linha} [data-marcar]`);
  await assentar(p);
  await p.locator(linha).filter({ hasText: nome }).locator(".rotulo").first().click();
  await p.waitForSelector(".camada.aberta .janela-grade");
  await assentar(p);
  return p;
}
const janela = (p) => p.locator(".camada.aberta .painel");

describe("Janela da tarefa no navegador", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  test("a data-limite aparece só no campo, e vencida fica em vermelho nele", async () => {
    const p = await abrirTarefa(sessao, "Enviar a frequência", { largura: 1280 });
    const j = janela(p);
    assert.doesNotMatch(await j.locator(".janela-resumo").innerText(), /Data-limite/);
    assert.equal(await j.locator('[data-campo="dataLimite"] input[type="date"]').count(), 1);
    assert.equal(await j.locator('[data-campo="dataLimite"]').evaluate((el) => el.classList.contains("atrasada")), true);
    assert.deepEqual(p.erros, []);
  });

  for (const largura of [1280, 390]) {
    test(`sem comentários nem estimativas: uma coluna, sem abas, com o histórico no fim (${largura} px)`, async () => {
      const p = await abrirTarefa(sessao, "Ler o relatório", { largura });
      const j = janela(p);
      assert.equal(await j.locator(".janela-grade.uma-coluna").count(), 1);
      assert.equal(await j.locator(".janela-abas").count(), 0);
      assert.equal(await j.locator(".janela-atividade").count(), 0);
      assert.equal(await j.locator(".janela-principal [data-historico]").count(), 1);
      if (largura > 640) assert.ok((await j.boundingBox()).width <= 760, "janela mais estreita");
      assert.deepEqual(p.erros, []);
    });
  }

  test("no plano com estimativas, as duas colunas continuam", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    await p.locator(".linha[data-abrir-acao]").first().click();
    await p.waitForSelector(".camada.aberta .janela-grade");
    await assentar(p);
    assert.equal(await janela(p).locator(".janela-grade.uma-coluna").count(), 0);
    assert.equal(await janela(p).locator(".janela-atividade [data-historico]").count(), 1);
    assert.deepEqual(p.erros, []);
  });

  test("a ajuda da data-limite fica no \"?\", que abre o glossário, e não numa frase fixa", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    const campo = janela(p).locator('[data-campo="dataLimite"]');
    assert.equal(await campo.locator(".tec").count(), 0);
    await campo.locator('[data-termo="dataLimite"]').click();
    await assentar(p);
    assert.match(await p.locator(".camada.aberta").last().innerText(), /Data-limite/);
    assert.deepEqual(p.erros, []);
  });

  test("a descrição parece texto: sem borda nem alça, até passar o mouse ou editar", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    const caixa = janela(p).locator('[data-campo="descricao"] textarea');
    const estilo = () => caixa.evaluate((el) => { const c = getComputedStyle(el); return { borda: c.borderTopColor, fundo: c.backgroundColor, alca: c.resize }; });
    const parada = await estilo();
    assert.equal(parada.alca, "none");
    assert.equal(parada.fundo, "rgba(0, 0, 0, 0)");
    await caixa.click();
    await assentar(p, 300);
    assert.notEqual((await estilo()).fundo, "rgba(0, 0, 0, 0)", "ao editar, ganha fundo");
    assert.deepEqual(p.erros, []);
  });

  test("o título da janela é o nome da lista, e não \"Tarefa\"", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    assert.equal((await janela(p).locator("header h2").innerText()).trim(), "Exemplo: minhas tarefas");
    assert.deepEqual(p.erros, []);
  });

  test("o círculo de concluída fica antes do nome, na mesma linha, e o plano continua com Registrar conclusão", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    const j = janela(p);
    const circulo = await j.locator(".caixa-janela").boundingBox();
    const nome = await j.locator(".janela-nome").boundingBox();
    assert.ok(circulo.x < nome.x, "círculo à esquerda do nome");
    assert.ok(circulo.y >= nome.y && circulo.y + circulo.height <= nome.y + nome.height, "na altura do nome");
    const plano = await sessao.abrir({ largura: 1280 });
    await plano.locator(".linha[data-abrir-acao]").first().click();
    await plano.waitForSelector(".camada.aberta .janela-grade");
    assert.equal(await janela(plano).locator(".caixa-janela").count(), 0);
    assert.deepEqual(p.erros, []);
  });

  test("nas tarefas, a situação não tem o ícone de cadeado; no plano, continua", async () => {
    const p = await abrirTarefa(sessao, "Marcar reunião", { largura: 1280 }, "tarefas da equipe", ".cartao-quadro");
    const sit = janela(p).locator(".janela-resumo dd.sit");
    assert.equal(await sit.locator(".icone-liberada, svg").count(), 0);
    assert.match(await sit.innerText(), /A fazer/);
    const plano = await sessao.abrir({ largura: 1280 });
    await plano.locator(".linha[data-abrir-acao]").first().click();
    await plano.waitForSelector(".camada.aberta .janela-grade");
    assert.ok(await janela(plano).locator(".janela-resumo dd.sit svg").count() >= 1);
    assert.deepEqual(p.erros, []);
  });

  test("em uma coluna, a janela tem a altura do conteúdo e rola quando a tela é baixa", async () => {
    const alta = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280, altura: 900 });
    assert.ok((await janela(alta).boundingBox()).height < 900 * 0.85, "não ocupa a altura toda à toa");
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280, altura: 520 });
    const corpo = janela(p).locator(".painel-corpo");
    await corpo.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await assentar(p, 200);
    const excluir = await janela(p).locator("[data-excluir-acao]").boundingBox();
    assert.ok(excluir.y + excluir.height <= 520, "o fim da janela é alcançável rolando");
    assert.deepEqual(p.erros, []);
  });
  test("nas tarefas, a situação é uma linha discreta, sem caixa; no plano, o resumo continua em caixas", async () => {
    const p = await abrirTarefa(sessao, "Marcar reunião", { largura: 1280 }, "tarefas da equipe", ".cartao-quadro");
    const resumo = janela(p).locator(".janela-resumo");
    assert.equal(await resumo.evaluate((el) => el.classList.contains("compacto")), true);
    const caixa = await resumo.locator(":scope > div").first().evaluate((el) => { const c = getComputedStyle(el); return { fundo: c.backgroundColor, borda: c.borderTopWidth }; });
    assert.deepEqual(caixa, { fundo: "rgba(0, 0, 0, 0)", borda: "0px" });
    assert.ok((await resumo.boundingBox()).height < 44, "uma linha só");
    assert.equal(await resumo.locator("select.escolha-situacao").count(), 1, "com situações personalizadas, a lista para escolher continua");
    const plano = await sessao.abrir({ largura: 1280 });
    await plano.locator(".linha[data-abrir-acao]").first().click();
    await plano.waitForSelector(".camada.aberta .janela-grade");
    assert.equal(await janela(plano).locator(".janela-resumo.compacto").count(), 0);
    assert.deepEqual(p.erros, []);
  });
});
