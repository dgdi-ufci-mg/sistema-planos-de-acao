/** Testes do caminho crítico. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico, duracaoPert, ErroDeCalculo } from "../js/calculo.js";

const cal = criarCalendario({ inicio: "2026-10-05" }); // segunda-feira
/** Ação com duração fixa (o = m = p). */
const acao = (codigo, dias, dependeDe = [], extra = {}) =>
  ({ codigo, dependeDe, estimativas: [{ o: dias, m: dias, p: dias }], ...extra });

describe("Estimativa PERT", () => {
  it("é (O + 4M + P) / 6", () => {
    assert.equal(duracaoPert({ o: 2, m: 5, p: 14 }), 6);
  });
});

describe("Caminho crítico", () => {
  // A(3) → B(2) → D(4); A → C(1) → D. Caminho crítico: A, B, D (9 dias); C tem folga 1.
  const rede = [acao("A", 3), acao("B", 2, ["A"]), acao("C", 1, ["A"]), acao("D", 4, ["B", "C"])];
  const { fim, porAcao } = caminhoCritico(rede, cal);

  it("calcula liberação, conclusão e fim", () => {
    assert.equal(fim, 9);
    assert.deepEqual(["A", "B", "C", "D"].map((c) => [porAcao.get(c).liberacao, porAcao.get(c).conclusao]),
      [[0, 3], [3, 5], [3, 4], [5, 9]]);
  });

  it("calcula folga e marca as ações críticas", () => {
    assert.equal(porAcao.get("C").folga, 1);
    assert.deepEqual(["A", "B", "C", "D"].filter((c) => porAcao.get(c).critica), ["A", "B", "D"]);
  });

  it("usa a estimativa mais recente", () => {
    const r = caminhoCritico([{ codigo: "X", estimativas: [{ o: 1, m: 1, p: 1 }, { o: 7, m: 7, p: 7 }] }], cal);
    assert.equal(r.fim, 7);
  });

  it("respeita a data mínima \"Não começa antes de\"", () => {
    // 2026-10-12 é o 5º dia útil (índice 5) a partir de 05/10
    const r = caminhoCritico([acao("A", 1), acao("B", 2, ["A"], { naoAntesDe: "2026-10-12" })], cal);
    assert.equal(r.porAcao.get("B").liberacao, 5);
    assert.equal(r.fim, 7);
    // data mínima já passada pela anterior não muda nada
    const r2 = caminhoCritico([acao("A", 8), acao("B", 2, ["A"], { naoAntesDe: "2026-10-06" })], cal);
    assert.equal(r2.porAcao.get("B").liberacao, 8);
  });

  it("recusa dependências em círculo", () => {
    assert.throws(() => caminhoCritico([acao("A", 1, ["B"]), acao("B", 1, ["A"])], cal),
      (e) => e instanceof ErroDeCalculo && e.codigo === "ciclo" && e.acoes.length === 2);
  });

  it("avisa sobre dependência inexistente e ação sem estimativa", () => {
    const r = caminhoCritico([{ codigo: "A", dependeDe: ["ZZZ"] }], cal);
    assert.deepEqual(r.avisos.map((a) => a.codigo).sort(), ["dependencia-inexistente", "sem-estimativa"]);
    assert.equal(r.fim, 0);
  });
});
