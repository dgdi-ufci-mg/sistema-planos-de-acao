/** Testes do desenho dos responsáveis (js/responsaveis.js). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { iniciais, tomDe, separar, ajustarTons, TONS } from "../js/responsaveis.js";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";

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

  it("dá a cada pessoa um tom só seu, o menor livre, na ordem em que aparecem", () => {
    assert.deepEqual(ajustarTons({}, ["a", "b", "c"]), { a: 1, b: 2, c: 3 });
  });

  it("mantém o tom de quem continua e libera o de quem saiu", () => {
    const t = ajustarTons({ a: 1, b: 2, c: 3 }, ["c", "a"]);
    assert.deepEqual(t, { a: 1, c: 3 });
    assert.deepEqual(ajustarTons(t, ["c", "a", "d"]), { a: 1, c: 3, d: 2 });
  });

  it("só repete tom acima de 15 pessoas, começando pelo menos usado", () => {
    const ids = Array.from({ length: 17 }, (_, i) => `p${i}`);
    const t = ajustarTons({}, ids);
    assert.deepEqual(new Set(ids.slice(0, TONS).map((id) => t[id])).size, TONS);
    assert.deepEqual([t.p15, t.p16], [1, 2]);
  });
});

describe("Tons das pessoas no espaço (Store)", async () => {
  const store = criarStore(criarBancoLocal());
  const id = await carregarExemplo(store, new Date("2026-10-20T12:00:00Z"));
  const responsaveis = await store.listarResponsaveis();
  const pessoa = (sigla) => responsaveis.find((r) => r.sigla === sigla).id;

  it("o exemplo tem um tom diferente para cada pessoa, e nenhum para unidades", async () => {
    const { tons } = await store.lerEspaco(id);
    const pessoas = responsaveis.filter((r) => r.tipo === "pessoa").map((r) => r.id);
    assert.deepEqual(Object.keys(tons).sort(), [...pessoas].sort());
    assert.equal(new Set(Object.values(tons)).size, pessoas.length);
  });

  it("quem deixa de ser responsável libera o tom, e quem chega o recebe; os demais não mudam", async () => {
    const antes = (await store.lerEspaco(id)).tons;
    const acoes = await store.listarAcoes(id);
    const dro = pessoa("DRO");
    for (const a of acoes.filter((x) => x.responsaveis.includes(dro))) {
      await store.alterarAcao(id, a.codigo, { responsaveis: a.responsaveis.filter((r) => r !== dro) });
    }
    const sem = (await store.lerEspaco(id)).tons;
    assert.equal(sem[dro], undefined);
    for (const [r, t] of Object.entries(sem)) assert.equal(t, antes[r]);
    const eva = await store.criarResponsavel({ tipo: "pessoa", nome: "Eva Prado" });
    await store.alterarAcao(id, acoes[0].codigo, { responsaveis: [...acoes[0].responsaveis, eva] });
    assert.equal((await store.lerEspaco(id)).tons[eva], antes[dro]);
  });

  it("o tom não pode ser alterado à mão", async () => {
    await assert.rejects(store.alterarEspaco(id, { tons: {} }), { codigo: "campo-fixo" });
  });
});
