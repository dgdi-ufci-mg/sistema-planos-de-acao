/** Checklist da ação (passo 2.8; especificação, seções 4.2.2 e 16.5). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { descreverRegistro } from "../js/historico.js";

for (const [nome, criarBanco] of [
  ["memória", () => criarBancoLocal()],
  ["Firestore (falso)", () => criarBancoFirestore(criarFirestoreFalso())],
]) {
  describe(`Checklist no Store, banco em ${nome}`, () => {
    const novo = async (opcoes = {}) => {
      let relogio = 0;
      const store = criarStore(criarBanco(), {
        usuario: "ana@ufci.edu.br", hoje: () => "2026-10-22",
        agora: () => new Date(Date.UTC(2026, 9, 22, 10, 0, relogio++)).toISOString(), ...opcoes,
      });
      const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
      const a = await store.criarAcao(id, { rotulo: "Primeira" });
      return { store, id, a };
    };

    it("acrescenta, marca, renomeia e retira itens, um de cada vez", async () => {
      const { store, id, a } = await novo();
      const i1 = await store.acrescentarItemNoChecklist(id, a, "  Enviar minuta ");
      const i2 = await store.acrescentarItemNoChecklist(id, a, "Publicar");
      await store.marcarItemDoChecklist(id, a, i1, true);
      await store.alterarItemDoChecklist(id, a, i2, "Publicar no site");
      let acao = (await store.listarAcoes(id)).find((x) => x.numero === a);
      assert.deepEqual(acao.checklist, [{ id: i1, texto: "Enviar minuta", feito: true }, { id: i2, texto: "Publicar no site", feito: false }]);
      await store.retirarItemDoChecklist(id, a, i1);
      acao = (await store.listarAcoes(id)).find((x) => x.numero === a);
      assert.deepEqual(acao.checklist.map((i) => i.id), [i2]);
      assert.equal(acao.alteradaPor, "ana@ufci.edu.br");
    });

    it("recusa item vazio e ação inexistente", async () => {
      const { store, id, a } = await novo();
      await assert.rejects(store.acrescentarItemNoChecklist(id, a, "  "), { codigo: "checklist-vazio" });
      await assert.rejects(store.acrescentarItemNoChecklist(id, 99, "X"), { codigo: "nao-encontrado" });
    });

    it("cada mudança entra no histórico, descrita em frase simples", async () => {
      const { store, id, a } = await novo();
      const i1 = await store.acrescentarItemNoChecklist(id, a, "Enviar minuta");
      await store.marcarItemDoChecklist(id, a, i1, true);
      await store.retirarItemDoChecklist(id, a, i1);
      const rs = (await store.listarHistorico(id, a)).filter((r) => r.campo === "checklist");
      const nomes = { acao: String, responsavel: String, etapa: String };
      assert.deepEqual(rs.map((r) => descreverRegistro(r, nomes)), [
        "Checklist: acrescentou “Enviar minuta”.",
        "Checklist: marcou “Enviar minuta” como feito.",
        "Checklist: retirou “Enviar minuta”.",
      ]);
    });

    it("sem login, não grava", async () => {
      const { store, id, a } = await novo();
      const semLogin = criarStore(criarBanco(), { exigirLogin: true });
      void store; void id; void a;
      await assert.rejects(semLogin.acrescentarItemNoChecklist("x", 1, "Item"));
    });
  });
}
