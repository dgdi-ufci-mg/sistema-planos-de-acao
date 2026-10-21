import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { CAMPOS } from "../js/modelo.js";
import { criarCalendario } from "../js/calendario.js";
import { simular } from "../js/simulacao.js";

const HOJE = "2026-10-20";
for (const [nome, criarBanco] of [
  ["memória", () => criarBancoLocal()],
  ["Firestore (falso)", () => criarBancoFirestore(criarFirestoreFalso())],
]) {
  describe(`Retratos (passo 1.18), banco em ${nome}`, () => {
    const novo = async () => {
      const store = criarStore(criarBanco(), { usuario: "ana.souza@ufci.edu.br", hoje: () => HOJE });
      const id = await carregarExemplo(store, new Date(`${HOJE}T12:00:00Z`));
      return { store, id };
    };

    it("salva a cópia integral: cabeçalho e ações com os campos do dicionário", async () => {
      const { store, id } = await novo();
      const rid = await store.salvarRetrato(id, "  Plano aprovado  ");
      const [r] = await store.listarRetratos(id);
      assert.equal(r.id, rid);
      assert.equal(r.nome, "Plano aprovado");
      assert.equal(r.origem, "manual");
      assert.equal(r.criadoPor, "ana.souza@ufci.edu.br");
      assert.deepEqual(Object.keys(r).sort(), [...CAMPOS.retrato].sort());
      assert.deepEqual(Object.keys(r.resumo).sort(), [...CAMPOS.retratoResumo].sort());
      assert.equal(r.espaco.id, id);
      assert.equal(r.responsaveis.length, 7); // todos citados no exemplo
      const acoes = await store.listarAcoesDoRetrato(id, rid);
      assert.equal(acoes.length, 12);
      for (const a of acoes) {
        for (const c of CAMPOS.retratoAcaoCalculos) assert.ok(c in a, `${a.rotulo}: falta ${c}`);
        for (const c of Object.keys(a)) assert.ok(CAMPOS.acao.includes(c) || CAMPOS.retratoAcaoCalculos.includes(c), `campo estranho ${c}`);
      }
      assert.ok(acoes.every((a, i) => i === 0 || acoes[i - 1].ordem < a.ordem));
    });

    it("refazer o cálculo com o próprio retrato dá o mesmo resultado", async () => {
      const { store, id } = await novo();
      const rid = await store.salvarRetrato(id, "Base");
      const [r] = await store.listarRetratos(id);
      const acoes = (await store.listarAcoesDoRetrato(id, rid)).map(({ situacao, atrasada, liberacaoPrevista, conclusaoPrevista, folga, prioridadeExecucao, prioridadeRevisao, ...a }) => a);
      const cal = criarCalendario({ ...r.espaco, datasExcluidas: r.datasExcluidasEfetivas }, HOJE);
      const sim = simular(acoes, cal, { hoje: HOJE, semente: r.semente, simulacoes: r.simulacoes, prazoFinal: r.espaco.prazoFinal });
      assert.equal(cal.dataDeConclusao(sim.p50, 0), r.resumo.conclusaoPrevista);
      assert.equal(cal.dataDeConclusao(sim.p80, 0), r.resumo.dataSegura);
      assert.equal(sim.chancePrazo, r.resumo.chancePrazo);
    });

    it("o retrato não muda quando o espaço muda depois", async () => {
      const { store, id } = await novo();
      const rid = await store.salvarRetrato(id, "Antes");
      const [lev] = await store.listarAcoes(id);
      await store.alterarAcao(id, lev.numero, { rotulo: "Outro nome" });
      await store.excluirAcao(id, lev.numero);
      const acoes = await store.listarAcoesDoRetrato(id, rid);
      assert.equal(acoes.find((a) => a.numero === lev.numero).rotulo, lev.rotulo);
    });

    it("recusa retrato sem nome; mais recente primeiro; entra na cópia de segurança", async () => {
      const { store, id } = await novo();
      await assert.rejects(store.salvarRetrato(id, "  "), { codigo: "nome-vazio" });
      await store.salvarRetrato(id, "Primeiro");
      await new Promise((r) => setTimeout(r, 5));
      await store.salvarRetrato(id, "Segundo");
      assert.deepEqual((await store.listarRetratos(id)).map((r) => r.nome), ["Segundo", "Primeiro"]);
      const copia = await store.copiaDeSeguranca();
      const doEspaco = copia.espacos.find((e) => e.espaco.id === id);
      assert.deepEqual(doEspaco.retratos.map((r) => r.nome), ["Primeiro", "Segundo"]);
      assert.equal(doEspaco.retratos[0].acoes.length, 12);
    });
  });
}

describe("Retratos sem login", () => {
  it("são recusados num banco que exige login", async () => {
    const store = criarStore(criarBancoLocal(), { exigirLogin: true });
    await assert.rejects(store.salvarRetrato("x", "Nome"), { codigo: "sem-login" });
  });
});
