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

describe("Store: espaços", () => {
  it("cria o espaço com semente e número de simulações padrão", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: " PI² ", inicio: "2026-08-03", prazoFinal: "2027-04-14" });
    const espaco = await store.lerEspaco(id);
    assert.equal(espaco.nome, "PI²");
    assert.equal(espaco.semente, SEMENTE_PADRAO);
    assert.equal(espaco.simulacoes, SIMULACOES_PADRAO);
    assert.equal(espaco.alteradoPor, "ana@ufci.edu.br");
  });

  it("não deixa mudar a semente nem o número de simulações depois da criação", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: "Espaço" });
    await assert.rejects(store.alterarEspaco(id, { semente: 1 }), { codigo: "campo-fixo" });
    await assert.rejects(store.alterarEspaco(id, { simulacoes: 500 }), { codigo: "campo-fixo" });
  });

  it("exige nome", async () => {
    await assert.rejects(storeDeTeste().criarEspaco({ nome: "  " }), { codigo: "nome-vazio" });
  });
});

describe("Store: ações", () => {
  async function comEspaco() {
    const store = storeDeTeste();
    const espacoId = await store.criarEspaco({ nome: "Espaço" });
    return { store, espacoId };
  }

  it("cria ações na ordem do espaço, com listas vazias e carimbos", async () => {
    const { store, espacoId } = await comEspaco();
    await store.criarAcao(espacoId, { codigo: "LEV", rotulo: "Levantar requisitos" });
    await store.criarAcao(espacoId, { codigo: "REQ", rotulo: "Validar requisitos" });
    const [lev, req] = await store.listarAcoes(espacoId);
    assert.deepEqual([lev.codigo, lev.ordem, req.codigo, req.ordem], ["LEV", 1, "REQ", 2]);
    assert.deepEqual(lev.dependeDe, []);
    assert.equal(lev.alteradaPor, "ana@ufci.edu.br");
    assert.ok(lev.criadaEm);
  });

  it("valida o código: de 2 a 8 letras ou números", async () => {
    const { store, espacoId } = await comEspaco();
    for (const codigo of ["", "A", "ABCDEFGHI", "AB-1", "AÇÃO"]) {
      await assert.rejects(store.criarAcao(espacoId, { codigo, rotulo: "x" }), { codigo: "codigo-invalido" });
    }
    await store.criarAcao(espacoId, { codigo: "Ab12", rotulo: "x" });
  });

  it("recusa código repetido", async () => {
    const { store, espacoId } = await comEspaco();
    await store.criarAcao(espacoId, { codigo: "LEV", rotulo: "x" });
    await assert.rejects(store.criarAcao(espacoId, { codigo: "LEV", rotulo: "y" }), { codigo: "codigo-ocupado" });
  });

  it("não deixa mudar o código nem a data de criação", async () => {
    const { store, espacoId } = await comEspaco();
    await store.criarAcao(espacoId, { codigo: "LEV", rotulo: "x" });
    await assert.rejects(store.alterarAcao(espacoId, "LEV", { codigo: "NOVO" }), { codigo: "campo-fixo" });
    await assert.rejects(store.alterarAcao(espacoId, "LEV", { criadaEm: "2020-01-01" }), { codigo: "campo-fixo" });
  });

  it("alterar renova a data e o autor da alteração", async () => {
    const { store, espacoId } = await comEspaco();
    await store.criarAcao(espacoId, { codigo: "LEV", rotulo: "x" });
    const antes = (await store.lerAcao(espacoId, "LEV")).alteradaEm;
    await store.alterarAcao(espacoId, "LEV", { rotulo: "y" });
    const depois = await store.lerAcao(espacoId, "LEV");
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
  it("recusa campo desconhecido no espaço, na ação e no responsável", async () => {
    const store = storeDeTeste();
    await assert.rejects(store.criarEspaco({ nome: "P", custo: 10 }), { codigo: "campo-desconhecido" });
    const espacoId = await store.criarEspaco({ nome: "P" });
    await assert.rejects(store.alterarEspaco(espacoId, { nearCrit: 10 }), { codigo: "campo-desconhecido" });
    await assert.rejects(store.criarAcao(espacoId, { codigo: "LEV", rotulo: "x", pct: 50 }), { codigo: "campo-desconhecido" });
    await store.criarAcao(espacoId, { codigo: "LEV", rotulo: "x" });
    await assert.rejects(store.alterarAcao(espacoId, "LEV", { name: "y" }), { codigo: "campo-desconhecido" });
    await assert.rejects(store.criarResponsavel({ nome: "Ana", email: "a@b" }), { codigo: "campo-desconhecido" });
  });
});
