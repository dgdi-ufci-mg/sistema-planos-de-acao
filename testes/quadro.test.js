/** Quadro de tarefas (passo 3.1; documentação técnica, seção 16.1). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { problemaDoTipo, TIPOS, agruparPorTipo } from "../js/tipos.js";
import { modeloDe, usaDependencias, usaDataLimite, usaSimulacao } from "../js/modelos.js";
import { termos } from "../js/vocabulario.js";
import { carregarExemploDeQuadro, carregarExemploDeLista } from "../js/exemplo.js";
import { colunasDoQuadro, fluxoDe } from "../js/situacoes.js";
import { caminhoCritico } from "../js/calculo.js";
import { criarCalendario } from "../js/calendario.js";

describe("Quadro de tarefas", () => {
  it("regras: sem fases, só o modelo aberto, sem Programa", () => {
    assert.ok(TIPOS.quadro);
    assert.equal(problemaDoTipo({ tipo: "quadro" }), null);
    assert.equal(problemaDoTipo({ tipo: "quadro", estrutura: [{ id: "f", nome: "F", etapas: [] }] }).codigo, "quadro-sem-fases");
    assert.equal(problemaDoTipo({ tipo: "quadro", modelo: { nome: "estruturado", prazos: "estimativa", dependencias: true, simulacao: true } }).codigo, "quadro-modelo");
    assert.equal(problemaDoTipo({ tipo: "quadro", programa: "X" }).codigo, "quadro-sem-vinculo");
  });

  it("criado com o modelo aberto, as colunas A fazer e Fazendo e sem fases; o tipo não muda", async () => {
    let n = 0;
    const store = criarStore(criarBancoLocal(), { novoId: () => `id${++n}` });
    const id = await store.criarEspaco({ nome: "Minhas tarefas", inicio: "2026-10-26", tipo: "quadro" });
    const e = await store.lerEspaco(id);
    assert.equal(modeloDe(e).nome, "aberto");
    assert.ok(usaDataLimite(e) && !usaDependencias(e) && !usaSimulacao(e));
    assert.deepEqual(e.situacoes.map((s) => s.nome), ["A fazer", "Fazendo"]);
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

  it("exemplo: tarefas em A fazer, Fazendo e Em revisão, uma delas marcada como concluída", async () => {
    const store = criarStore(criarBancoLocal());
    const id = await carregarExemploDeQuadro(store);
    const e = await store.lerEspaco(id);
    assert.deepEqual(e.situacoes.map((s) => s.nome), ["A fazer", "Fazendo", "Em revisão"]);
    const acoes = await store.listarAcoes(id);
    assert.equal(acoes.length, 7);
    const feita = acoes.find((a) => a.conclusaoMarcadaEm);
    assert.ok(feita && !feita.concluidaEm && feita.situacaoPersonalizada === "revisao");
    assert.ok(acoes.some((a) => a.dataLimite));
  });

  describe("caixinha de concluída e colunas livres (revisão de 27/10/2026)", () => {
    const montar = async () => {
      let n = 0;
      let relogio = "2026-10-27T13:00:00.000Z";
      const store = criarStore(criarBancoLocal(), { novoId: () => `id${++n}`, agora: () => relogio, hoje: () => "2026-10-27" });
      const id = await store.criarEspaco({ nome: "Tarefas", inicio: "2026-10-26", tipo: "quadro" });
      const [aFazer, fazendo] = (await store.lerEspaco(id)).situacoes.map((s) => s.id);
      return { store, id, aFazer, fazendo, mudarRelogio: (v) => { relogio = v; } };
    };

    it("marcar guarda só o momento da marcação, sem data de conclusão, e a tarefa fica na coluna", async () => {
      const { store, id, fazendo } = await montar();
      const t = await store.criarAcao(id, { rotulo: "Enviar o relatório", dataLimite: "2026-10-20" });
      await store.mudarSituacao(id, t, fazendo);
      await store.marcarConclusao(id, t, true);
      const a = await store.lerAcao(id, t);
      assert.equal(a.conclusaoMarcadaEm, "2026-10-27T13:00:00.000Z");
      assert.equal(a.concluidaEm ?? null, null);
      assert.equal(a.situacaoPersonalizada, fazendo);
      /* desmarcar apaga a marca e mantém a coluna */
      await store.marcarConclusao(id, t, false);
      const b = await store.lerAcao(id, t);
      assert.equal(b.conclusaoMarcadaEm ?? null, null);
      assert.equal(b.situacaoPersonalizada, fazendo);
    });

    it("a tarefa concluída muda de coluna; a data de conclusão é recusada no quadro", async () => {
      const { store, id, aFazer } = await montar();
      const t = await store.criarAcao(id, { rotulo: "Arquivar processos" });
      await store.marcarConclusao(id, t, true);
      await store.mudarSituacao(id, t, aFazer);
      assert.equal((await store.lerAcao(id, t)).situacaoPersonalizada, aFazer);
      await assert.rejects(store.concluir(id, t, "2026-10-27"), { codigo: "situacao-invalida" });
      await assert.rejects(store.alterarAcao(id, t, { conclusaoMarcadaEm: "2026-10-27T00:00:00.000Z" }), { codigo: "campo-fixo" });
      /* fora do quadro, não se marca */
      const projeto = await store.criarEspaco({ nome: "Projeto", inicio: "2026-10-26" });
      const p = await store.criarAcao(projeto, { rotulo: "X", estimativas: [{ o: 1, m: 2, p: 3 }] });
      await assert.rejects(store.marcarConclusao(projeto, p, true), { codigo: "situacao-invalida" });
    });

    it("concluída, não fica atrasada; o atraso conta até a marcação; desfazer apaga a marca", async () => {
      const { store, id } = await montar();
      const t = await store.criarAcao(id, { rotulo: "Responder ofício", dataLimite: "2026-10-20" });
      const cal = criarCalendario({ inicio: "2026-10-26" }, "2026-10-27");
      const calcular = async () => caminhoCritico(await store.listarAcoes(id), cal, { hoje: "2026-10-27", prazos: "dataLimite", dependencias: false }).porAcao.get(t);
      assert.equal((await calcular()).atrasada, true);
      await store.marcarConclusao(id, t, true);
      const r = await calcular();
      assert.equal(r.situacao, "concluida");
      assert.equal(r.atrasada, false);
      await store.desfazerConclusao(id, t);
      assert.equal((await store.lerAcao(id, t)).conclusaoMarcadaEm ?? null, null);
    });

    it("todas as colunas se renomeiam, mudam de ordem e saem; a tarefa sem coluna vai para a primeira", async () => {
      const { store, id, aFazer, fazendo } = await montar();
      const t = await store.criarAcao(id, { rotulo: "Tarefa" });
      await store.mudarSituacao(id, t, aFazer);
      await store.alterarEspaco(id, { situacoes: [{ id: fazendo, nome: "Em andamento" }, { id: aFazer, nome: "Caixa de entrada" }] });
      const e = await store.lerEspaco(id);
      assert.deepEqual(colunasDoQuadro(e).map((c) => c.titulo), ["Em andamento", "Caixa de entrada"]);
      assert.equal(await store.retirarSituacao(id, aFazer), 1);
      const depois = await store.lerEspaco(id);
      assert.equal(fluxoDe(await store.lerAcao(id, t), "liberada", depois), fazendo);
      await assert.rejects(store.alterarEspaco(id, { situacoes: [] }), { codigo: "sem-colunas" });
      /* no quadro, uma coluna pode se chamar "Concluídas" (não há mais a coluna fixa) */
      await store.alterarEspaco(id, { situacoes: [{ id: fazendo, nome: "Concluídas" }] });
    });
  });
});

describe("Lista de tarefas (passo 3.4)", () => {
  it("criada com o modelo aberto, sem colunas nem fases, palavra tarefa e conclusão marcada sem data", async () => {
    let n = 0;
    const store = criarStore(criarBancoLocal(), { novoId: () => `id${++n}`, agora: () => "2026-10-27T15:00:00.000Z", hoje: () => "2026-10-27" });
    const id = await store.criarEspaco({ nome: "Minhas tarefas", inicio: "2026-10-27", tipo: "lista" });
    const e = await store.lerEspaco(id);
    assert.equal(TIPOS.lista.nome, "Lista de tarefas");
    assert.equal(modeloDe(e).nome, "aberto");
    assert.equal((e.situacoes ?? []).length, 0);
    assert.equal(e.camposOpcionais.fasesEtapas, false);
    assert.equal(termos(e).acao, "tarefa");
    assert.equal(problemaDoTipo({ tipo: "lista", programa: "X" }).codigo, "quadro-sem-vinculo");
    const t = await store.criarAcao(id, { rotulo: "Enviar a frequência" });
    await assert.rejects(store.concluir(id, t, "2026-10-27"), { codigo: "situacao-invalida" });
    await store.marcarConclusao(id, t, true);
    const a = await store.lerAcao(id, t);
    assert.equal(a.conclusaoMarcadaEm, "2026-10-27T15:00:00.000Z");
    assert.equal(a.concluidaEm ?? null, null);
    /* não vira Projeto nem Plano */
    await assert.rejects(store.alterarEspaco(id, { tipo: "projeto" }), { codigo: "tipo-fixo" });
    assert.deepEqual(agruparPorTipo([e]).map((g) => g.titulo), ["Listas de tarefas"]);
  });

  it("exemplo: seis tarefas, duas marcadas como concluídas", async () => {
    const store = criarStore(criarBancoLocal());
    const id = await carregarExemploDeLista(store);
    const acoes = await store.listarAcoes(id);
    assert.equal(acoes.length, 6);
    assert.equal(acoes.filter((a) => a.conclusaoMarcadaEm).length, 2);
  });
});

describe("Troca entre Lista e Quadro de tarefas (passo 3.5)", () => {
  it("da Lista para o Quadro nasce com A fazer e Fazendo; de volta, as colunas ficam guardadas", async () => {
    let n = 0;
    const store = criarStore(criarBancoLocal(), { novoId: () => `id${++n}`, hoje: () => "2026-10-27" });
    const id = await store.criarEspaco({ nome: "Tarefas", inicio: "2026-10-27", tipo: "lista" });
    const t = await store.criarAcao(id, { rotulo: "Uma tarefa" });
    await store.marcarConclusao(id, t, true);
    await store.alterarEspaco(id, { tipo: "quadro" });
    let e = await store.lerEspaco(id);
    assert.deepEqual(e.situacoes.map((s) => s.nome), ["A fazer", "Fazendo"]);
    assert.equal(fluxoDe(await store.lerAcao(id, t), "concluida", e), e.situacoes[0].id);
    const fazendo = e.situacoes[1].id;
    await store.mudarSituacao(id, t, fazendo);
    await store.alterarEspaco(id, { tipo: "lista" });
    await store.alterarEspaco(id, { tipo: "quadro" });
    e = await store.lerEspaco(id);
    assert.deepEqual(e.situacoes.map((s) => s.nome), ["A fazer", "Fazendo"], "as colunas guardadas voltam, sem duplicar");
    const a = await store.lerAcao(id, t);
    assert.equal(a.situacaoPersonalizada, fazendo, "a tarefa volta à coluna em que estava");
    assert.ok(a.conclusaoMarcadaEm, "a marca não muda na troca");
    await assert.rejects(store.alterarEspaco(id, { tipo: "projeto" }), { codigo: "tipo-fixo" });
  });
});
