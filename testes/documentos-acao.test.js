/** Documentos e links da ação (passo 2.10a; documentação técnica, seções 4.2.4 e 16.8). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { descreverRegistro } from "../js/historico.js";
import { planilhaDoEspaco } from "../js/exportar.js";

for (const [nome, criarBanco] of [
  ["memória", () => criarBancoLocal()],
  ["Firestore (falso)", () => criarBancoFirestore(criarFirestoreFalso())],
]) {
  describe(`Documentos da ação no Store, banco em ${nome}`, () => {
    const novo = async () => {
      let relogio = 0;
      let n = 0;
      const store = criarStore(criarBanco(), {
        usuario: "ana@ufci.edu.br", hoje: () => "2026-10-24", novoId: () => `id${++n}`,
        agora: () => new Date(Date.UTC(2026, 9, 24, 10, 0, relogio++)).toISOString(),
      });
      const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
      const a = await store.criarAcao(id, { rotulo: "Contratar" });
      return { store, id, a };
    };

    it("acrescenta, altera e retira um a um, guardando só o que foi preenchido", async () => {
      const { store, id, a } = await novo();
      const d1 = await store.acrescentarDocumentoNaAcao(id, a, { nome: " Termo de referência ", identificacao: "23062.004512/2026-10", data: "", link: "" });
      const d2 = await store.acrescentarDocumentoNaAcao(id, a, { nome: "Painel", link: "https://exemplo.gov.br/painel" });
      assert.deepEqual((await store.lerAcao(id, a)).documentos, [
        { id: d1, nome: "Termo de referência", identificacao: "23062.004512/2026-10" },
        { id: d2, nome: "Painel", link: "https://exemplo.gov.br/painel" },
      ]);
      await store.alterarDocumentoDaAcao(id, a, d1, { nome: "Termo de referência", identificacao: "23062.004512/2026-10", data: "2026-10-20" });
      assert.equal((await store.lerAcao(id, a)).documentos[0].data, "2026-10-20");
      await store.retirarDocumentoDaAcao(id, a, d2);
      assert.deepEqual((await store.lerAcao(id, a)).documentos.map((d) => d.id), [d1]);
    });

    it("recusa sem nome, sem identificação nem link, link inseguro, data inválida e campo desconhecido", async () => {
      const { store, id, a } = await novo();
      await assert.rejects(store.acrescentarDocumentoNaAcao(id, a, { nome: " ", link: "https://a" }), { codigo: "nome-vazio" });
      await assert.rejects(store.acrescentarDocumentoNaAcao(id, a, { nome: "X" }), { codigo: "documento-vazio" });
      await assert.rejects(store.acrescentarDocumentoNaAcao(id, a, { nome: "X", link: "javascript:alert(1)" }), { codigo: "link-invalido" });
      await assert.rejects(store.acrescentarDocumentoNaAcao(id, a, { nome: "X", identificacao: "1", data: "20/10/2026" }), { codigo: "data-invalida" });
      await assert.rejects(store.acrescentarDocumentoNaAcao(id, a, { nome: "X", identificacao: "1", arquivo: "x.pdf" }), { codigo: "campo-desconhecido" });
      await assert.rejects(store.alterarDocumentoDaAcao(id, a, "sumiu", { nome: "X", identificacao: "1" }), { codigo: "nao-encontrado" });
      await assert.rejects(store.acrescentarDocumentoNaAcao(id, 99, { nome: "X", identificacao: "1" }), { codigo: "nao-encontrado" });
      await assert.rejects(store.criarAcao(id, { rotulo: "Y", documentos: [{ nome: "Sem id", identificacao: "1" }] }), { codigo: "id-repetido" });
    });

    it("cada mudança entra no histórico", async () => {
      const { store, id, a } = await novo();
      const d1 = await store.acrescentarDocumentoNaAcao(id, a, { nome: "Termo", identificacao: "1" });
      await store.alterarDocumentoDaAcao(id, a, d1, { nome: "Termo de referência", identificacao: "1" });
      await store.retirarDocumentoDaAcao(id, a, d1);
      const rs = (await store.listarHistorico(id, a)).filter((r) => r.campo === "documentos");
      assert.deepEqual(rs.map((r) => descreverRegistro(r, {})), [
        "Documentos: acrescentou “Termo”.",
        "Documentos: alterou “Termo” (agora “Termo de referência”).",
        "Documentos: retirou “Termo de referência”.",
      ]);
    });

    it("sem login, não grava", async () => {
      const semLogin = criarStore(criarBanco(), { exigirLogin: true });
      await assert.rejects(semLogin.acrescentarDocumentoNaAcao("x", 1, { nome: "A", identificacao: "1" }), { codigo: "sem-login" });
    });
  });
}

describe("Documentos da ação: exportação", () => {
  it("coluna Documentos só com o campo ligado: nome e link (ou identificação)", () => {
    const espaco = { id: "e", nome: "E", inicio: "2026-10-01", camposOpcionais: { documentos: true } };
    const acoes = [{ numero: 1, ordem: 1, rotulo: "Contratar", dependeDe: [], responsaveis: [], estimativas: [],
      documentos: [{ id: "d1", nome: "TR", identificacao: "23062.1" }, { id: "d2", nome: "Painel", link: "https://p" }] }];
    const [titulos, linha] = planilhaDoEspaco({ espaco, acoes, responsaveis: [], geral: {}, hoje: "2026-10-24" }).split("\n").map((l) => l.split("\t"));
    assert.equal(linha[titulos.indexOf("Documentos")], "TR (23062.1); Painel (https://p)");
    assert.ok(!planilhaDoEspaco({ espaco: { ...espaco, camposOpcionais: {} }, acoes, responsaveis: [], geral: {}, hoje: "2026-10-24" }).includes("Documentos"));
  });
});
