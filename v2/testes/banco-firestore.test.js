/**
 * O banco do Firestore cumpre o mesmo contrato do banco em memória (seção 3.4),
 * rodando sobre um Firestore falso, em memória (nada é gravado no Firebase de verdade).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { testarContratoDoBanco } from "./contrato-banco.js";
import { criarFirestoreFalso, criarAuthFalso, FieldValueFalso } from "./firebase-falso.js";

testarContratoDoBanco("Firestore (falso, em memória)", () => criarBancoFirestore(criarFirestoreFalso(), FieldValueFalso));

describe("Banco do Firestore: detalhes", () => {
  it("guarda os responsáveis dentro do espaço: espacos/{id}/responsaveis/{id}", async () => {
    const db = criarFirestoreFalso();
    const banco = criarBancoFirestore(db, FieldValueFalso);
    await banco.criarEspaco("p1", { nome: "Espaço 1" });
    await banco.criarResponsavel("p1", "r1", { nome: "Ana", tipo: "pessoa" });
    assert.ok(db._docs.has("espacos/p1/responsaveis/r1"));
  });

  it("guarda as ações em espacos/{id}/acoes/{numero}", async () => {
    const db = criarFirestoreFalso();
    const banco = criarBancoFirestore(db, FieldValueFalso);
    await banco.criarEspaco("p1", { nome: "Espaço 1" });
    await banco.criarAcao("p1", { numero: 7, rotulo: "Sete", ordem: 1 });
    assert.ok(db._docs.has("espacos/p1/acoes/7"));
  });

  it("mantém duas estimativas iguais no histórico", async () => {
    const banco = criarBancoFirestore(criarFirestoreFalso(), FieldValueFalso);
    await banco.criarEspaco("p1", { nome: "Espaço 1" });
    await banco.criarAcao("p1", { numero: 1, rotulo: "Um", ordem: 1, estimativas: [] });
    const e = { em: "2026-10-21", o: 1, m: 2, p: 3 };
    await Promise.all([banco.acrescentarEstimativa("p1", 1, e), banco.acrescentarEstimativa("p1", 1, e)]);
    assert.equal((await banco.lerAcao("p1", 1)).estimativas.length, 2);
  });

  it("sem login, recusa a gravação com mensagem clara", async () => {
    const auth = criarAuthFalso({});
    const banco = criarBancoFirestore(criarFirestoreFalso({ auth, exigirLogin: true }), FieldValueFalso);
    await assert.rejects(banco.criarEspaco("p1", { nome: "Espaço 1" }), { codigo: "sem-permissao" });
    assert.deepEqual(await banco.listarEspacos(), []);
  });

  it("responsável criado aparece na hora para quem acompanha", async () => {
    const banco = criarBancoFirestore(criarFirestoreFalso(), FieldValueFalso);
    await banco.criarEspaco("p1", { nome: "Espaço 1" });
    const parar = banco.acompanharEspaco("p1", () => {});
    await new Promise((r) => setTimeout(r, 0));
    await banco.criarResponsavel("p1", "r1", { nome: "Ana", tipo: "pessoa" });
    assert.deepEqual((await banco.listarResponsaveis("p1")).map((r) => r.nome), ["Ana"]);
    parar();
  });
});
