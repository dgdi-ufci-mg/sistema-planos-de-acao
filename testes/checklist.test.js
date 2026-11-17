/** Checklist da ação (passo 2.8; documentação técnica, seções 4.2.2 e 16.5). */
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

    it("reordena: anda um lugar, vai ao fim e ao começo, e fora da lista fica nas pontas", async () => {
      const { store, id, a } = await novo();
      const ids = [];
      for (const t of ["A", "B", "C"]) ids.push(await store.acrescentarItemNoChecklist(id, a, t));
      const textos = async () => (await store.listarAcoes(id)).find((x) => x.numero === a).checklist.map((i) => i.texto).join("");
      await store.moverItemDoChecklist(id, a, ids[0], 1);
      assert.equal(await textos(), "BAC");
      await store.moverItemDoChecklist(id, a, ids[2], 0);
      assert.equal(await textos(), "CBA");
      await store.moverItemDoChecklist(id, a, ids[2], 99);
      assert.equal(await textos(), "BAC");
      await store.moverItemDoChecklist(id, a, ids[2], -5);
      assert.equal(await textos(), "CBA");
      /* mesmo lugar, ou item que não existe mais: nada muda */
      await store.moverItemDoChecklist(id, a, ids[2], 0);
      await store.moverItemDoChecklist(id, a, "inexistente", 1);
      assert.equal(await textos(), "CBA");
    });

    it("reordenar mantém marcas e responsáveis dos itens e entra no histórico", async () => {
      const { store, id, a } = await novo();
      const r = await store.criarResponsavel(id, { nome: "Beatriz Lima", tipo: "pessoa" });
      const i1 = await store.acrescentarItemNoChecklist(id, a, "A");
      const i2 = await store.acrescentarItemNoChecklist(id, a, "B");
      await store.marcarItemDoChecklist(id, a, i1, true);
      await store.atribuirItemDoChecklist(id, a, i1, r);
      await store.moverItemDoChecklist(id, a, i1, 1);
      const acao = (await store.listarAcoes(id)).find((x) => x.numero === a);
      assert.deepEqual(acao.checklist, [{ id: i2, texto: "B", feito: false }, { id: i1, texto: "A", feito: true, responsavel: r }]);
      const rs = (await store.listarHistorico(id, a)).filter((x) => x.campo === "checklist");
      assert.equal(descreverRegistro(rs.at(-1), { acao: String, responsavel: String, etapa: String }), "Reordenou o checklist.");
    });

    it("atribui e tira o responsável de um item, só de quem existe no espaço", async () => {
      const { store, id, a } = await novo();
      const r = await store.criarResponsavel(id, { nome: "Beatriz Lima", tipo: "pessoa" });
      const i1 = await store.acrescentarItemNoChecklist(id, a, "Enviar minuta");
      await store.atribuirItemDoChecklist(id, a, i1, r);
      let acao = (await store.listarAcoes(id)).find((x) => x.numero === a);
      assert.equal(acao.checklist[0].responsavel, r);
      await assert.rejects(store.atribuirItemDoChecklist(id, a, i1, "naoexiste"), { codigo: "nao-encontrado" });
      await store.atribuirItemDoChecklist(id, a, i1, null);
      acao = (await store.listarAcoes(id)).find((x) => x.numero === a);
      assert.deepEqual(acao.checklist, [{ id: i1, texto: "Enviar minuta", feito: false }]); // sem a chave, e não `responsavel: null`
      const nomes = { acao: String, responsavel: (x) => (x === r ? "Beatriz Lima" : x), etapa: String };
      const frases = (await store.listarHistorico(id, a)).filter((x) => x.campo === "checklist").map((x) => descreverRegistro(x, nomes));
      assert.deepEqual(frases.slice(-2), [
        "Checklist: passou “Enviar minuta” para Beatriz Lima.",
        "Checklist: tirou o responsável de “Enviar minuta”.",
      ]);
    });

    it("não atribui a responsável já excluído", async () => {
      const { store, id, a } = await novo();
      const r = await store.criarResponsavel(id, { nome: "Beatriz Lima", tipo: "pessoa" });
      const i1 = await store.acrescentarItemNoChecklist(id, a, "Item");
      await store.excluirResponsavel(id, r);
      await assert.rejects(store.atribuirItemDoChecklist(id, a, i1, r), { codigo: "nao-encontrado" });
    });

    it("excluir o responsável tira dos itens, ou passa ao substituto", async () => {
      const { store, id, a } = await novo();
      const r1 = await store.criarResponsavel(id, { nome: "Beatriz Lima", tipo: "pessoa" });
      const r2 = await store.criarResponsavel(id, { nome: "Carlos Souza", tipo: "pessoa" });
      const r3 = await store.criarResponsavel(id, { nome: "Daniela Reis", tipo: "pessoa" });
      const i1 = await store.acrescentarItemNoChecklist(id, a, "Um");
      const i2 = await store.acrescentarItemNoChecklist(id, a, "Dois");
      const i3 = await store.acrescentarItemNoChecklist(id, a, "Três");
      await store.atribuirItemDoChecklist(id, a, i1, r1);
      await store.atribuirItemDoChecklist(id, a, i2, r2);
      await store.atribuirItemDoChecklist(id, a, i3, r1);
      await store.excluirResponsavel(id, r1, { substituto: r3 });
      let it = (await store.listarAcoes(id)).find((x) => x.numero === a).checklist;
      assert.deepEqual(it.map((i) => i.responsavel), [r3, r2, r3]);
      await store.excluirResponsavel(id, r2);
      it = (await store.listarAcoes(id)).find((x) => x.numero === a).checklist;
      assert.deepEqual(it.map((i) => i.responsavel), [r3, undefined, r3]);
    });

    it("sem permissão de gravar, não reordena nem atribui", async () => {
      const semLogin = criarStore(criarBanco(), { exigirLogin: true });
      await assert.rejects(semLogin.moverItemDoChecklist("x", 1, "i", 0));
      await assert.rejects(semLogin.atribuirItemDoChecklist("x", 1, "i", null));
    });

    it("sem login, não grava", async () => {
      const { store, id, a } = await novo();
      const semLogin = criarStore(criarBanco(), { exigirLogin: true });
      void store; void id; void a;
      await assert.rejects(semLogin.acrescentarItemNoChecklist("x", 1, "Item"));
    });
  });
}
