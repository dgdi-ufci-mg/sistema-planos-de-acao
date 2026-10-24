/** Situações personalizadas (passo 2.7; seção 16.2). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { montarModelo } from "../js/modelos.js";
import { nomeInicial, fluxoDe, nomeDoFluxo, colunasDoQuadro, problemaDasSituacoes } from "../js/situacoes.js";

const SITUACOES = [{ id: "s1", nome: "Em andamento" }, { id: "s2", nome: "Em teste" }];
const storeDeTeste = () => {
  let n = 0;
  return criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", novoId: () => `id${++n}`, hoje: () => "2026-11-10" });
};

describe("Situações: regras", () => {
  it("a inicial é Liberada com dependências e A fazer, editável, sem elas", () => {
    assert.equal(nomeInicial({}), "Liberada");
    const aberto = { modelo: montarModelo("aberto") };
    assert.equal(nomeInicial(aberto), "A fazer");
    assert.equal(nomeInicial({ ...aberto, nomeInicial: " Para fazer " }), "Para fazer");
  });

  it("a personalizada só vale enquanto a ação está liberada", () => {
    const espaco = { situacoes: SITUACOES };
    const acao = { situacaoPersonalizada: "s2" };
    assert.equal(fluxoDe(acao, "liberada", espaco), "s2");
    assert.equal(fluxoDe(acao, "naoLiberada", espaco), "naoLiberada");
    assert.equal(fluxoDe(acao, "concluida", espaco), "concluida");
    assert.equal(fluxoDe({ situacaoPersonalizada: "sumiu" }, "liberada", espaco), "inicial");
    assert.equal(nomeDoFluxo(espaco, "s2"), "Em teste");
  });

  it("colunas do quadro: não liberadas só com dependências, a inicial, as personalizadas e concluídas", () => {
    assert.deepEqual(colunasDoQuadro({ situacoes: SITUACOES }).map((c) => c.titulo), ["Não liberadas", "Liberadas", "Em andamento", "Em teste", "Concluídas"]);
    assert.deepEqual(colunasDoQuadro({ modelo: montarModelo("aberto") }).map((c) => c.titulo), ["A fazer", "Concluídas"]);
  });

  it("recusa nomes vazios, longos ou repetidos (também com as fixas)", () => {
    assert.equal(problemaDasSituacoes({ situacoes: SITUACOES }), null);
    assert.equal(problemaDasSituacoes({ situacoes: [{ id: "a", nome: " " }] }).codigo, "nome-vazio");
    assert.equal(problemaDasSituacoes({ situacoes: [{ id: "a", nome: "x".repeat(41) }] }).codigo, "nome-longo");
    assert.equal(problemaDasSituacoes({ situacoes: [{ id: "a", nome: "Teste" }, { id: "b", nome: "teste" }] }).codigo, "nome-repetido");
    assert.equal(problemaDasSituacoes({ situacoes: [{ id: "a", nome: "Concluída" }] }).codigo, "nome-repetido");
    assert.equal(problemaDasSituacoes({ nomeInicial: "  " }).codigo, "nome-vazio");
  });
});

describe("Situações: Store", () => {
  async function cenario() {
    const store = storeDeTeste();
    const e = await store.criarEspaco({ nome: "E", inicio: "2026-11-02" });
    await store.alterarEspaco(e, { situacoes: SITUACOES });
    const a = await store.criarAcao(e, { rotulo: "A" });
    const b = await store.criarAcao(e, { rotulo: "B" });
    return { store, e, a, b };
  }

  it("muda a ação liberada de situação e volta à inicial", async () => {
    const { store, e, a } = await cenario();
    await store.mudarSituacao(e, a, "s2");
    assert.equal((await store.lerAcao(e, a)).situacaoPersonalizada, "s2");
    await store.mudarSituacao(e, a, null);
    assert.equal((await store.lerAcao(e, a)).situacaoPersonalizada, null);
    await assert.rejects(store.mudarSituacao(e, a, "s9"), { codigo: "nao-encontrado" });
    await assert.rejects(store.alterarAcao(e, a, { situacaoPersonalizada: "s1" }), { codigo: "campo-fixo" });
  });

  it("não muda a situação de ação não liberada ou concluída", async () => {
    const { store, e, a, b } = await cenario();
    await store.acrescentarDependencia(e, b, a);
    await assert.rejects(store.mudarSituacao(e, b, "s1"), { codigo: "situacao-invalida" });
    await store.concluir(e, a, "2026-11-05");
    await assert.rejects(store.mudarSituacao(e, a, "s1"), { codigo: "situacao-invalida" });
  });

  it("nova anterior não concluída, conclusão e conclusão desfeita devolvem à inicial", async () => {
    const { store, e, a, b } = await cenario();
    await store.mudarSituacao(e, b, "s1");
    await store.acrescentarDependencia(e, b, a); // anterior ainda não concluída
    assert.equal((await store.lerAcao(e, b)).situacaoPersonalizada, null);
    await store.mudarSituacao(e, a, "s2");
    await store.concluir(e, a, "2026-11-05");
    assert.equal((await store.lerAcao(e, a)).situacaoPersonalizada, null);
    await store.mudarSituacao(e, b, "s1"); // b liberada: a concluída
    await store.desfazerConclusao(e, a);
    assert.equal((await store.lerAcao(e, b)).situacaoPersonalizada, null);
  });

  it("retirar a situação devolve as ações dela à inicial", async () => {
    const { store, e, a, b } = await cenario();
    await store.mudarSituacao(e, a, "s2");
    await store.mudarSituacao(e, b, "s2");
    assert.equal(await store.retirarSituacao(e, "s2"), 2);
    assert.deepEqual((await store.lerEspaco(e)).situacoes, [SITUACOES[0]]);
    assert.equal((await store.lerAcao(e, a)).situacaoPersonalizada, null);
  });
});

describe("Situações: sem conexão", () => {
  it("mudar e retirar situação dão o aviso de sem conexão, como as demais gravações", async () => {
    const store = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", hoje: () => "2026-11-10" });
    const id = await store.criarEspaco({ nome: "E", situacoes: SITUACOES });
    const n = await store.criarAcao(id, { rotulo: "A" });
    store.definirConexao(false);
    await assert.rejects(store.mudarSituacao(id, n, "s1"), { codigo: "sem-conexao" });
    await assert.rejects(store.retirarSituacao(id, "s1"), { codigo: "sem-conexao" });
    await assert.rejects(store.comentar(id, n, "Oi"), { codigo: "sem-conexao" });
  });
});
