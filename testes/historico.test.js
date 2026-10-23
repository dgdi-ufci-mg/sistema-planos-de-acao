import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { registrosDaMudanca } from "../js/historico.js";

let n = 0;
const quem = { em: "2026-10-21T10:00:00.000Z", por: "ana@ufci.edu.br", novoId: () => `h${++n}` };

describe("Histórico de alterações: regras (passo 1.16)", () => {
  it("criação: um registro, sem valores", () => {
    const [r] = registrosDaMudanca(null, { numero: 3, rotulo: "A" }, quem);
    assert.deepEqual({ ...r, id: "x" }, { id: "x", entidade: "acao", chave: 3, em: quem.em, por: quem.por, tipo: "criacao", campo: null, antes: null, depois: null });
  });
  it("alteração: um registro por campo que mudou, sem os carimbos da gravação", () => {
    const antes = { numero: 3, rotulo: "A", dependeDe: [1], alteradaEm: "x", alteradaPor: "y" };
    const depois = { ...antes, rotulo: "B", dependeDe: [1, 2], concluidaEm: "2026-10-20", alteradaEm: "z", alteradaPor: "w" };
    const rs = registrosDaMudanca(antes, depois, quem);
    assert.deepEqual(rs.map((r) => [r.campo, r.antes, r.depois]), [
      ["rotulo", "A", "B"], ["dependeDe", [1], [1, 2]], ["concluidaEm", null, "2026-10-20"],
    ]);
  });
  it("sem mudança no conteúdo, nenhum registro", () => {
    assert.deepEqual(registrosDaMudanca({ numero: 1, rotulo: "A" }, { numero: 1, rotulo: "A", alteradaEm: "z" }, quem), []);
  });
});

for (const [nome, criarBanco] of [
  ["memória", () => criarBancoLocal()],
  ["Firestore (falso)", () => criarBancoFirestore(criarFirestoreFalso())],
]) {
  describe(`Histórico de alterações no Store, banco em ${nome}`, () => {
    const novo = async () => {
      let relogio = 0;
      const store = criarStore(criarBanco(), {
        usuario: "ana@ufci.edu.br", hoje: () => "2026-10-21",
        agora: () => new Date(Date.UTC(2026, 9, 21, 10, 0, relogio++)).toISOString(),
      });
      const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
      const a = await store.criarAcao(id, { rotulo: "Primeira", estimativas: [{ em: "2026-10-01", por: null, o: 1, m: 2, p: 3, contaDe: "liberacao" }] });
      const b = await store.criarAcao(id, { rotulo: "Segunda", dependeDe: [a] });
      const c = await store.criarAcao(id, { rotulo: "Terceira", dependeDe: [b] });
      return { store, id, a, b, c };
    };
    const campos = (rs) => rs.map((r) => r.tipo === "criacao" ? "criacao" : r.campo);

    it("registra a criação e cada alteração, na ordem, com quem e quando", async () => {
      const { store, id, a } = await novo();
      await store.alterarAcao(id, a, { rotulo: "Primeira ação", descricao: "Texto" });
      await store.concluir(id, a, "2026-10-20");
      await store.desfazerConclusao(id, a);
      const rs = await store.listarHistorico(id, a);
      assert.deepEqual(campos(rs), ["criacao", "rotulo", "descricao", "concluidaEm", "concluidaEm"]);
      assert.equal(rs[1].antes, "Primeira");
      assert.equal(rs[1].depois, "Primeira ação");
      assert.deepEqual([rs[4].antes, rs[4].depois], ["2026-10-20", null]);
      assert.ok(rs.every((r) => r.por === "ana@ufci.edu.br" && r.em && r.chave === a && r.entidade === "acao"));
      assert.ok(rs.every((r, i) => i === 0 || rs[i - 1].em <= r.em));
    });

    it("listas e estimativas: valor antigo e novo inteiros", async () => {
      const { store, id, a, b } = await novo();
      const resp = await store.criarResponsavel(id, { tipo: "unidade", nome: "DTI", sigla: "DTI" });
      await store.acrescentarResponsavelNaAcao(id, b, resp);
      await store.retirarDependencia(id, b, a);
      await store.reestimar(id, a, { o: 2, m: 3, p: 5, motivo: "Atraso" });
      const rb = await store.listarHistorico(id, b);
      assert.deepEqual(rb.slice(1).map((r) => [r.campo, r.antes, r.depois]), [["responsaveis", [], [resp]], ["dependeDe", [a], []]]);
      const [, est] = await store.listarHistorico(id, a);
      assert.equal(est.campo, "estimativas");
      assert.equal(est.antes.length, 1);
      assert.equal(est.depois.length, 2);
      assert.equal(est.depois[1].motivo, "Atraso");
    });

    it("exclusão encadeada: registra a exclusão e a mudança nas dependentes", async () => {
      const { store, id, a, b, c } = await novo();
      await store.excluirAcao(id, b, { religar: true });
      assert.deepEqual(campos(await store.listarHistorico(id, b)), ["criacao", "excluidaEm"]);
      const rc = await store.listarHistorico(id, c);
      assert.deepEqual(rc.slice(1).map((r) => [r.campo, r.antes, r.depois]), [["dependeDe", [b], []], ["dependeDe", [], [a]]]);
      await store.restaurarAcao(id, b);
      assert.deepEqual(campos(await store.listarHistorico(id, b)), ["criacao", "excluidaEm", "excluidaEm"]);
    });

    it("se a alteração é recusada, o histórico não muda (um não existe sem o outro)", async () => {
      const { store, id, a } = await novo();
      const antes = (await store.listarHistorico(id, a)).length;
      await assert.rejects(store.alterarAcao(id, 999, { rotulo: "X" }), { codigo: "nao-encontrado" });
      await assert.rejects(store.reestimar(id, a, { o: 5, m: 1, p: 2 }));
      assert.equal((await store.listarHistorico(id, a)).length, antes);
      assert.deepEqual(await store.listarHistorico(id, 999), []);
    });
  });
}

import { descreverRegistro } from "../js/historico.js";
describe("Histórico de alterações: frases da janela (passo 1.16)", () => {
  const nomes = { acao: (n) => `“A${n}”`, responsavel: (id) => id.toUpperCase(), etapa: (id) => `Etapa ${id}` };
  const r = (campo, antes, depois) => descreverRegistro({ tipo: "alteracao", campo, antes, depois }, nomes);
  it("descreve cada tipo de mudança em linguagem simples", () => {
    assert.equal(descreverRegistro({ tipo: "criacao" }, nomes), "Criou a ação.");
    assert.equal(r("rotulo", "A", "B"), "Mudou o nome da ação de “A” para “B”.");
    assert.equal(r("dependeDe", [1], [1, 2]), "Depende de: acrescentou “A2”.");
    assert.equal(r("dependeDe", [1, 3], [2]), "Depende de: acrescentou “A2”; retirou “A1”, “A3”.");
    assert.equal(r("responsaveis", ["dti"], []), "Responsáveis: retirou DTI.");
    assert.equal(r("concluidaEm", null, "2026-10-20"), "Registrou a conclusão em 20/10/2026.");
    assert.equal(r("concluidaEm", "2026-10-20", null), "Desfez a conclusão.");
    assert.equal(r("excluidaEm", null, "2026-10-21T10:00:00Z"), "Excluiu a ação (foi para a lixeira).");
    assert.equal(r("etapa", "e1", null), "Mudou a etapa de “Etapa e1” para sem fase nem etapa.");
    const e = (o, m, p, motivo) => ({ o, m, p, ...(motivo ? { motivo } : {}) });
    assert.equal(r("estimativas", [], [e(1, 2, 3)]), "Estimou: 1 · 2 · 3 dias úteis.");
    assert.equal(r("estimativas", [e(1, 2, 3)], [e(1, 2, 3), e(2, 3, 5, "Atraso")]), "Reestimou: 2 · 3 · 5 dias úteis (motivo: Atraso).");
    assert.equal(r("estimativas", [e(1, 2, 3)], [e(1, 2, 4)]), "Corrigiu a estimativa de 1 · 2 · 3 para 1 · 2 · 4 dias úteis.");
  });
});
