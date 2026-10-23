/** Testes das regras do modo "Editar em planilha" (js/planilha.js). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lerReferencias, escreverReferencias, lerResponsaveis, escreverResponsaveis, diferenca, lerColagem, lerData } from "../js/planilha.js";

const acoes = [{ numero: 1, codigo: "LEV" }, { numero: 2 }, { numero: 5, codigo: "ARQ" }];
const responsaveis = [{ id: "a", nome: "Ana Souza", sigla: "ANA" }, { id: "p", nome: "Pró-Reitoria de Graduação", sigla: "PROGRAD" }, { id: "s", nome: "Sem Sigla" }];

describe("Planilha: dependências digitadas", () => {
  it("lê números e, com códigos ligados, também códigos, separados por ; ou ,", () => {
    assert.deepEqual(lerReferencias("1; 5", acoes, false), { numeros: [1, 5], erros: [] });
    assert.deepEqual(lerReferencias("lev, 2", acoes, true), { numeros: [1, 2], erros: [] });
    assert.deepEqual(lerReferencias("", acoes, false), { numeros: [], erros: [] });
  });
  it("aponta o que não existe, e não aceita código com os códigos desligados", () => {
    assert.equal(lerReferencias("9", acoes, false).erros.length, 1);
    assert.equal(lerReferencias("LEV", acoes, false).erros.length, 1);
  });
  it("escreve códigos quando ligados e a ação tem; senão, números", () => {
    assert.equal(escreverReferencias([1, 2, 5], acoes, true), "LEV; 2; ARQ");
    assert.equal(escreverReferencias([1, 2, 5], acoes, false), "1; 2; 5");
  });
});

describe("Planilha: responsáveis digitados", () => {
  it("lê sigla ou nome, sem diferenciar acentos e maiúsculas", () => {
    assert.deepEqual(lerResponsaveis("ana; prograd; sem sigla", responsaveis), { ids: ["a", "p", "s"], erros: [] });
    assert.deepEqual(lerResponsaveis("Pro-Reitoria de Graduacao", responsaveis).ids, ["p"]);
    assert.equal(lerResponsaveis("XYZ", responsaveis).erros.length, 1);
  });
  it("escreve a sigla ou, sem sigla, o nome", () => {
    assert.equal(escreverResponsaveis(["a", "s"], responsaveis), "ANA; Sem Sigla");
  });
});

describe("Planilha: colagem e datas", () => {
  it("diferença entre listas, para gravar item a item", () => {
    assert.deepEqual(diferenca([1, 2, 3], [2, 4]), { acrescentar: [4], retirar: [1, 3] });
  });
  it("lê blocos colados, com células vazias e células entre aspas com quebra de linha", () => {
    assert.deepEqual(lerColagem("a\tb\nc\t\n"), [["a", "b"], ["c", ""]]);
    assert.deepEqual(lerColagem('x\t"linha 1\nlinha 2"\ty'), [["x", "linha 1\nlinha 2", "y"]]);
    assert.deepEqual(lerColagem('"com ""aspas"""'), [['com "aspas"']]);
    assert.deepEqual(lerColagem("só uma"), [["só uma"]]);
  });
  it("lê datas em AAAA-MM-DD e DD/MM/AAAA", () => {
    assert.equal(lerData("2026-10-20"), "2026-10-20");
    assert.equal(lerData("5/1/2027"), "2027-01-05");
    assert.equal(lerData(""), null);
    assert.equal(lerData("amanhã"), undefined);
  });
});
