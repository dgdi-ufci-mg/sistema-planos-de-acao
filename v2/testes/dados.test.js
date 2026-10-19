/** Testes do Store: regras que valem para qualquer banco. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore, SEMENTE_PADRAO, SIMULACOES_PADRAO } from "../js/dados.js";

/** Store sobre um banco em memória, com relógio e ids previsíveis. */
function storeDeTeste() {
  let n = 0;
  let minuto = 0;
  return criarStore(criarBancoLocal(), {
    usuario: "ana@ufci.edu.br",
    novoId: () => `id${++n}`,
    agora: () => `2026-10-19T10:${String(minuto++).padStart(2, "0")}:00.000Z`,
  });
}

describe("Store: planos", () => {
  it("cria o plano com semente e número de simulações padrão", async () => {
    const store = storeDeTeste();
    const id = await store.criarPlano({ nome: " PI² ", inicio: "2026-08-03", prazoFinal: "2027-04-14" });
    const plano = await store.lerPlano(id);
    assert.equal(plano.nome, "PI²");
    assert.equal(plano.semente, SEMENTE_PADRAO);
    assert.equal(plano.simulacoes, SIMULACOES_PADRAO);
    assert.equal(plano.alteradoPor, "ana@ufci.edu.br");
  });

  it("não deixa mudar a semente nem o número de simulações depois da criação", async () => {
    const store = storeDeTeste();
    const id = await store.criarPlano({ nome: "Plano" });
    await assert.rejects(store.alterarPlano(id, { semente: 1 }), { codigo: "campo-fixo" });
    await assert.rejects(store.alterarPlano(id, { simulacoes: 500 }), { codigo: "campo-fixo" });
  });

  it("exige nome", async () => {
    await assert.rejects(storeDeTeste().criarPlano({ nome: "  " }), { codigo: "nome-vazio" });
  });
});

describe("Store: ações", () => {
  async function comPlano() {
    const store = storeDeTeste();
    const planoId = await store.criarPlano({ nome: "Plano" });
    return { store, planoId };
  }

  it("cria ações na ordem do plano, com listas vazias e carimbos", async () => {
    const { store, planoId } = await comPlano();
    await store.criarAcao(planoId, { codigo: "LEV", rotulo: "Levantar requisitos" });
    await store.criarAcao(planoId, { codigo: "REQ", rotulo: "Validar requisitos" });
    const [lev, req] = await store.listarAcoes(planoId);
    assert.deepEqual([lev.codigo, lev.ordem, req.codigo, req.ordem], ["LEV", 1, "REQ", 2]);
    assert.deepEqual(lev.dependeDe, []);
    assert.equal(lev.alteradaPor, "ana@ufci.edu.br");
    assert.ok(lev.criadaEm);
  });

  it("valida o código: de 2 a 8 letras ou números", async () => {
    const { store, planoId } = await comPlano();
    for (const codigo of ["", "A", "ABCDEFGHI", "AB-1", "AÇÃO"]) {
      await assert.rejects(store.criarAcao(planoId, { codigo, rotulo: "x" }), { codigo: "codigo-invalido" });
    }
    await store.criarAcao(planoId, { codigo: "Ab12", rotulo: "x" });
  });

  it("recusa código repetido", async () => {
    const { store, planoId } = await comPlano();
    await store.criarAcao(planoId, { codigo: "LEV", rotulo: "x" });
    await assert.rejects(store.criarAcao(planoId, { codigo: "LEV", rotulo: "y" }), { codigo: "codigo-ocupado" });
  });

  it("não deixa mudar o código nem a data de criação", async () => {
    const { store, planoId } = await comPlano();
    await store.criarAcao(planoId, { codigo: "LEV", rotulo: "x" });
    await assert.rejects(store.alterarAcao(planoId, "LEV", { codigo: "NOVO" }), { codigo: "campo-fixo" });
    await assert.rejects(store.alterarAcao(planoId, "LEV", { criadaEm: "2020-01-01" }), { codigo: "campo-fixo" });
  });

  it("alterar renova a data e o autor da alteração", async () => {
    const { store, planoId } = await comPlano();
    await store.criarAcao(planoId, { codigo: "LEV", rotulo: "x" });
    const antes = (await store.lerAcao(planoId, "LEV")).alteradaEm;
    await store.alterarAcao(planoId, "LEV", { rotulo: "y" });
    const depois = await store.lerAcao(planoId, "LEV");
    assert.equal(depois.rotulo, "y");
    assert.notEqual(depois.alteradaEm, antes);
  });
});

describe("Store: responsáveis", () => {
  it("cria e lista responsáveis, com carimbos", async () => {
    const store = storeDeTeste();
    await store.criarResponsavel({ nome: "Ana Souza", sigla: "ANA", setor: "DGDI" });
    const [ana] = await store.listarResponsaveis();
    assert.deepEqual([ana.nome, ana.sigla, ana.setor], ["Ana Souza", "ANA", "DGDI"]);
    assert.ok(ana.criadoEm);
    assert.equal(ana.alteradoPor, "ana@ufci.edu.br");
  });
});

describe("Store: só grava campos do dicionário de dados", () => {
  it("recusa campo desconhecido no plano, na ação e no responsável", async () => {
    const store = storeDeTeste();
    await assert.rejects(store.criarPlano({ nome: "P", custo: 10 }), { codigo: "campo-desconhecido" });
    const planoId = await store.criarPlano({ nome: "P" });
    await assert.rejects(store.alterarPlano(planoId, { nearCrit: 10 }), { codigo: "campo-desconhecido" });
    await assert.rejects(store.criarAcao(planoId, { codigo: "LEV", rotulo: "x", pct: 50 }), { codigo: "campo-desconhecido" });
    await store.criarAcao(planoId, { codigo: "LEV", rotulo: "x" });
    await assert.rejects(store.alterarAcao(planoId, "LEV", { name: "y" }), { codigo: "campo-desconhecido" });
    await assert.rejects(store.criarResponsavel({ nome: "Ana", email: "a@b" }), { codigo: "campo-desconhecido" });
  });
});
