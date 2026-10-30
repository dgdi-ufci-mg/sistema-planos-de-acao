/** Regras novas da planilha do Sextante (30/10/2026; documentação técnica, seção 8.3): grupos, colunas, busca e desfazer. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { agruparPorFaseEEtapa, ordenarColunas, moverColuna, passaNaBusca, criarDesfazer } from "../js/planilha.js";

const estrutura = [
  { id: "f1", nome: "Planejamento", etapas: [{ id: "e1", nome: "Requisitos" }, { id: "e2", nome: "Contratação" }] },
  { id: "f2", nome: "Execução", etapas: [{ id: "e3", nome: "Infraestrutura" }] },
  { id: "f3", nome: "Vazia", etapas: [{ id: "e4", nome: "Nada" }] },
];

describe("Planilha do Sextante: regras", () => {
  it("agrupa por fase e etapa, na ordem da estrutura, mantendo a ordem das ações; sem etapa no fim", () => {
    const acoes = [{ numero: 3, etapa: "e3" }, { numero: 1, etapa: "e1" }, { numero: 2, etapa: null }, { numero: 4, etapa: "e1" }, { numero: 5, etapa: "sumiu" }];
    const g = agruparPorFaseEEtapa(acoes, estrutura);
    assert.deepEqual(g.map((x) => x.fase.nome), ["Planejamento", "Execução", "Sem etapa"]);
    assert.deepEqual(g[0].etapas.map((e) => [e.etapa.nome, e.acoes.map((a) => a.numero)]), [["Requisitos", [1, 4]]], "etapa sem ação fica de fora");
    assert.deepEqual(g[2].etapas[0].acoes.map((a) => a.numero), [2, 5]);
    assert.deepEqual(agruparPorFaseEEtapa([], estrutura), []);
  });

  it("colunas: as fixas na frente; a ordem escolhida; coluna nova no fim; mover entre as não fixas", () => {
    const cols = [{ chave: "numero", fixa: true }, { chave: "rotulo", fixa: true }, { chave: "a" }, { chave: "b" }, { chave: "c" }];
    assert.deepEqual(ordenarColunas(cols, ["c", "x", "a"]).map((c) => c.chave), ["numero", "rotulo", "c", "a", "b"]);
    assert.deepEqual(ordenarColunas(cols, ["rotulo", "b"]).map((c) => c.chave), ["numero", "rotulo", "b", "a", "c"], "fixa não sai do lugar");
    assert.deepEqual(moverColuna(cols, [], "b", -1), ["b", "a", "c"]);
    assert.deepEqual(moverColuna(cols, [], "a", -1), ["a", "b", "c"], "não passa para antes das fixas");
  });

  it("busca: sem acentos e maiúsculas, em qualquer célula", () => {
    assert.ok(passaNaBusca(["Levantar requisitos", "ANA"], "REQUISITO"));
    assert.ok(passaNaBusca(["Contratação"], "contratacao"));
    assert.ok(!passaNaBusca(["Contratação"], "servidor"));
    assert.ok(passaNaBusca(["x"], "  "));
  });

  it("desfazer e refazer: passos de uma ou várias células; sem mudança não conta; passo novo apaga o refazer", () => {
    const h = criarDesfazer(2);
    h.registrar({ numero: 1, chave: "rotulo", antes: "A", depois: "A" });
    assert.equal(h.podeDesfazer, false);
    h.registrar({ numero: 1, chave: "rotulo", antes: "A", depois: "B" });
    h.registrar([{ numero: 2, chave: "o", antes: "1", depois: "2" }, { numero: 3, chave: "o", antes: "", depois: "4" }]);
    assert.equal(h.desfazer().length, 2);
    assert.ok(h.podeRefazer);
    const p = h.refazer();
    h.devolver(p, true);
    assert.ok(h.podeRefazer, "regravar falhou: o passo volta");
    h.registrar({ numero: 9, chave: "rotulo", antes: "X", depois: "Y" });
    assert.equal(h.podeRefazer, false);
    h.registrar({ numero: 9, chave: "rotulo", antes: "Y", depois: "Z" });
    h.desfazer(); h.desfazer();
    assert.equal(h.desfazer(), null, "no máximo 2 passos");
  });
});
