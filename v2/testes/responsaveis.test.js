/** Testes do desenho dos responsáveis (js/responsaveis.js). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { iniciais, tomDe, separar, TONS } from "../js/responsaveis.js";

describe("Responsáveis na tela", () => {
  it("usa as iniciais do primeiro e do último nome, sem \"de\", \"da\" etc.", () => {
    assert.equal(iniciais("Ana Souza"), "AS");
    assert.equal(iniciais("Ana Maria de Souza"), "AS");
    assert.equal(iniciais("  joão   da silva "), "JS");
    assert.equal(iniciais("Ana"), "A");
    assert.equal(iniciais("Ênio Ávila"), "ÊÁ");
    assert.equal(iniciais(""), "?");
  });

  it("dá sempre o mesmo tom ao mesmo nome, dentro da paleta", () => {
    assert.equal(tomDe("Ana Souza"), tomDe("Ana Souza"));
    for (const n of ["Ana Souza", "Bruno Lima", "Carla Mendes", "Diego Rocha", ""]) {
      assert.ok(tomDe(n) >= 1 && tomDe(n) <= TONS);
    }
  });

  it("põe as pessoas antes das unidades, mantendo a ordem de cada grupo", () => {
    const r = [{ id: 1, tipo: "unidade" }, { id: 2, tipo: "pessoa" }, { id: 3, tipo: "unidade" }, { id: 4, tipo: "pessoa" }];
    const { pessoas, unidades } = separar(r);
    assert.deepEqual(pessoas.map((x) => x.id), [2, 4]);
    assert.deepEqual(unidades.map((x) => x.id), [1, 3]);
  });
});
