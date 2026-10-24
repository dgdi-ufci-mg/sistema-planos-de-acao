/** Tipos de espaço (passo 2.4a): regras puras e validação no Store. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { TIPOS, tipoDe, problemaDoTipo, agruparPorTipo } from "../js/tipos.js";

const storeDeTeste = () => {
  let n = 0;
  return criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", novoId: () => `id${++n}` });
};
const PLANO = { tipo: "planoDeAcao", programa: "Programa de Governança de Dados", aprovacao: { identificacao: "23062.001234/2026-11" } };

describe("Tipos de espaço: regras", () => {
  it("Plano de Ação, Projeto e Quadro de tarefas, nessa ordem; o padrão é Projeto", () => {
    assert.deepEqual(Object.keys(TIPOS), ["planoDeAcao", "projeto", "quadro"]);
    assert.equal(tipoDe({}), "projeto");
    assert.equal(tipoDe({ tipo: null }), "projeto");
    assert.equal(tipoDe({ tipo: "planoDeAcao" }), "planoDeAcao");
  });

  it("o Plano de Ação exige o Programa e a identificação da aprovação; o Projeto, não", () => {
    assert.equal(problemaDoTipo({}), null);
    assert.equal(problemaDoTipo({ tipo: "projeto" }), null);
    assert.equal(problemaDoTipo(PLANO), null);
    assert.equal(problemaDoTipo({ ...PLANO, programa: "  " }).codigo, "programa-vazio");
    assert.equal(problemaDoTipo({ ...PLANO, aprovacao: null }).codigo, "aprovacao-vazia");
    assert.equal(problemaDoTipo({ ...PLANO, aprovacao: { identificacao: "" } }).codigo, "aprovacao-vazia");
  });

  it("recusa tipo desconhecido e link inseguro", () => {
    assert.equal(problemaDoTipo({ tipo: "lousa" }).codigo, "tipo-invalido");
    assert.equal(problemaDoTipo({ ...PLANO, aprovacao: { identificacao: "1", link: "javascript:alert(1)" } }).codigo, "link-invalido");
    assert.equal(problemaDoTipo({ ...PLANO, aprovacao: { identificacao: "1", link: "https://sipac.ufci.edu.br/x" } }), null);
  });

  it("agrupa por tipo, na ordem dos tipos, só os que existem", () => {
    const espacos = [{ id: "a" }, { id: "b", tipo: "planoDeAcao" }, { id: "c", tipo: "projeto" }];
    assert.deepEqual(agruparPorTipo(espacos).map((g) => [g.titulo, g.espacos.map((e) => e.id)]),
      [["Planos de Ação", ["b"]], ["Projetos", ["a", "c"]]]);
    assert.deepEqual(agruparPorTipo([{ id: "a" }]).map((g) => g.titulo), ["Projetos"]);
    assert.deepEqual(agruparPorTipo([]), []);
  });
});

describe("Tipos de espaço: Store", () => {
  it("cria Plano de Ação com Programa e aprovação", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: "Plano", inicio: "2026-11-03", ...PLANO });
    const e = await store.lerEspaco(id);
    assert.equal(e.tipo, "planoDeAcao");
    assert.equal(e.programa, PLANO.programa);
    assert.deepEqual(e.aprovacao, PLANO.aprovacao);
  });

  it("recusa Plano de Ação sem Programa e campo estranho na aprovação", async () => {
    const store = storeDeTeste();
    await assert.rejects(store.criarEspaco({ nome: "Plano", tipo: "planoDeAcao", aprovacao: { identificacao: "1" } }), { codigo: "programa-vazio" });
    await assert.rejects(store.criarEspaco({ nome: "Plano", ...PLANO, aprovacao: { identificacao: "1", arquivo: "x" } }), { codigo: "campo-desconhecido" });
  });

  it("muda de Plano de Ação para Projeto apagando Programa e aprovação, e volta exigindo-os", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: "Plano", ...PLANO });
    await store.alterarEspaco(id, { tipo: "projeto", programa: null, aprovacao: null });
    const e = await store.lerEspaco(id);
    assert.equal(tipoDe(e), "projeto");
    assert.equal(e.programa, null);
    await assert.rejects(store.alterarEspaco(id, { tipo: "planoDeAcao" }), { codigo: "programa-vazio" });
  });

  it("um espaço antigo, sem tipo, continua valendo como Projeto", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: "PI²" });
    await store.alterarEspaco(id, { nome: "PI² · Fase 1" });
    assert.equal(tipoDe(await store.lerEspaco(id)), "projeto");
  });
});
