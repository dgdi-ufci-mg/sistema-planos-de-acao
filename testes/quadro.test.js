/** Quadro de tarefas (passo 3.1; documentação técnica, seção 16.1). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { problemaDoTipo, TIPOS, agruparPorTipo } from "../js/tipos.js";
import { modeloDe, usaDependencias, usaDataLimite, usaSimulacao } from "../js/modelos.js";
import { termos } from "../js/vocabulario.js";
import { carregarExemploDeQuadro } from "../js/exemplo.js";

describe("Quadro de tarefas", () => {
  it("regras: sem fases, só o modelo aberto, sem Programa", () => {
    assert.ok(TIPOS.quadro);
    assert.equal(problemaDoTipo({ tipo: "quadro" }), null);
    assert.equal(problemaDoTipo({ tipo: "quadro", estrutura: [{ id: "f", nome: "F", etapas: [] }] }).codigo, "quadro-sem-fases");
    assert.equal(problemaDoTipo({ tipo: "quadro", modelo: { nome: "estruturado", prazos: "estimativa", dependencias: true, simulacao: true } }).codigo, "quadro-modelo");
    assert.equal(problemaDoTipo({ tipo: "quadro", programa: "X" }).codigo, "quadro-sem-vinculo");
  });

  it("criado com o modelo aberto, a coluna Fazendo e sem fases; o tipo não muda", async () => {
    let n = 0;
    const store = criarStore(criarBancoLocal(), { novoId: () => `id${++n}` });
    const id = await store.criarEspaco({ nome: "Minhas tarefas", inicio: "2026-10-26", tipo: "quadro" });
    const e = await store.lerEspaco(id);
    assert.equal(modeloDe(e).nome, "aberto");
    assert.ok(usaDataLimite(e) && !usaDependencias(e) && !usaSimulacao(e));
    assert.deepEqual(e.situacoes.map((s) => s.nome), ["Fazendo"]);
    assert.equal(e.camposOpcionais.fasesEtapas, false);
    await assert.rejects(store.alterarEspaco(id, { tipo: "projeto" }), { codigo: "tipo-fixo" });
    const projeto = await store.criarEspaco({ nome: "Projeto", inicio: "2026-10-26" });
    await assert.rejects(store.alterarEspaco(projeto, { tipo: "quadro" }), { codigo: "tipo-fixo" });
    await assert.rejects(store.alterarEspaco(id, { camposOpcionais: { fasesEtapas: true } }), { codigo: "quadro-sem-fases" });
    const t = await store.criarAcao(id, { rotulo: "Responder e-mails", dataLimite: "2026-10-28" });
    await store.mudarSituacao(id, t, e.situacoes[0].id);
    assert.equal((await store.listarAcoes(id))[0].situacaoPersonalizada, e.situacoes[0].id);
    assert.deepEqual(agruparPorTipo([e, await store.lerEspaco(projeto)]).map((g) => g.titulo), ["Projetos", "Quadros de tarefas"]);
  });

  it("vocabulário: tarefa no Quadro, ação nos demais", () => {
    assert.equal(termos({ tipo: "quadro" }).Acao, "Tarefa");
    assert.equal(termos({ tipo: "planoDeAcao" }).acoes, "ações");
    assert.equal(termos(null).acao, "ação");
  });

  it("exemplo: tarefas em A fazer, Fazendo, Em revisão e Concluídas", async () => {
    const store = criarStore(criarBancoLocal());
    const id = await carregarExemploDeQuadro(store);
    const e = await store.lerEspaco(id);
    assert.deepEqual(e.situacoes.map((s) => s.nome), ["Fazendo", "Em revisão"]);
    const acoes = await store.listarAcoes(id);
    assert.equal(acoes.length, 7);
    assert.ok(acoes.some((a) => a.concluidaEm) && acoes.some((a) => a.dataLimite));
  });
});
