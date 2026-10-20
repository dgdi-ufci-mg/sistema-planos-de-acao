/** Testes do caminho crítico. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico, duracaoPert, ErroDeCalculo } from "../js/calculo.js";

const cal = criarCalendario({ inicio: "2026-10-05" }); // segunda-feira
/** Ação com duração fixa (o = m = p). */
const acao = (numero, dias, dependeDe = [], extra = {}) =>
  ({ numero, dependeDe, estimativas: [{ o: dias, m: dias, p: dias }], ...extra });

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
    const r = caminhoCritico([{ numero: "X", estimativas: [{ o: 1, m: 1, p: 1 }, { o: 7, m: 7, p: 7 }] }], cal);
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
    const r = caminhoCritico([{ numero: "A", dependeDe: ["ZZZ"] }], cal);
    assert.deepEqual(r.avisos.map((a) => a.codigo).sort(), ["dependencia-inexistente", "sem-estimativa"]);
    assert.equal(r.fim, 0);
  });
});

describe("Situações, carimbo Atrasada e regras do mundo real", () => {
  // calendário a partir de segunda, 05/10/2026; índices: 05/10=0, 06=1, 07=2, 08=3, 09=4, 12=5, 13=6 ...
  const hoje = "2026-10-14"; // índice 7
  const est = (o, m, p, extra = {}) => ({ o, m, p, contaDe: "liberacao", ...extra });

  it("concluída entra com a duração real e libera as seguintes", () => {
    const r = caminhoCritico([
      { numero: "A", dependeDe: [], estimativas: [est(2, 2, 2)], concluidaEm: "2026-10-08" }, // terminou no índice 3 (4 dias)
      { numero: "B", dependeDe: ["A"], estimativas: [est(3, 3, 3)] },
    ], cal, { hoje });
    assert.equal(r.porAcao.get("A").conclusao, 4);
    assert.equal(r.porAcao.get("A").situacao, "concluida");
    assert.equal(r.porAcao.get("A").critica, false);
    assert.equal(r.porAcao.get("B").liberacao, 4);
    assert.equal(r.porAcao.get("B").situacao, "liberada");
  });

  it("não liberada enquanto alguma anterior não termina ou a data mínima não chega", () => {
    const r = caminhoCritico([
      { numero: "A", dependeDe: [], estimativas: [est(20, 20, 20)] },
      { numero: "B", dependeDe: ["A"], estimativas: [est(1, 1, 1)] },
      { numero: "C", dependeDe: [], estimativas: [est(1, 1, 1)], naoAntesDe: "2026-10-30" },
    ], cal, { hoje });
    assert.equal(r.porAcao.get("B").situacao, "naoLiberada");
    assert.equal(r.porAcao.get("C").situacao, "naoLiberada");
    assert.equal(r.porAcao.get("A").situacao, "liberada");
  });

  it("prazo vencido sem reestimativa: carimbo Atrasada e conclusão a partir de hoje", () => {
    const r = caminhoCritico([{ numero: "A", dependeDe: [], estimativas: [est(3, 3, 3)] }], cal, { hoje });
    const a = r.porAcao.get("A");
    assert.equal(a.atrasada, true);
    assert.equal(a.regraDoPassado, true);
    assert.equal(cal.dataDeConclusao(a.conclusao, a.liberacao), hoje);
  });

  it("reestimativa conta do dia em que foi feita e tira o carimbo", () => {
    const r = caminhoCritico([{ numero: "A", dependeDe: [],
      estimativas: [est(3, 3, 3), est(4, 4, 4, { contaDe: "data", em: "2026-10-13" })] }], cal, { hoje });
    const a = r.porAcao.get("A");
    assert.equal(a.conclusao, 6 + 4); // 13/10 é o índice 6
    assert.equal(a.atrasada, false);
    assert.equal(a.regraDoPassado, false);
  });

  it("conclusão prevista para hoje não é atraso", () => {
    const r = caminhoCritico([{ numero: "A", dependeDe: [], estimativas: [est(7.5, 7.5, 7.5)] }], cal, { hoje });
    assert.equal(cal.dataDeConclusao(r.porAcao.get("A").conclusao, 0), hoje);
    assert.equal(r.porAcao.get("A").atrasada, false);
  });

  it("não liberada nunca recebe o carimbo, porque as anteriores não ficam no passado", () => {
    const r = caminhoCritico([
      { numero: "A", dependeDe: [], estimativas: [est(2, 2, 2)] },
      { numero: "B", dependeDe: ["A"], estimativas: [est(1, 1, 1)] },
    ], cal, { hoje });
    assert.equal(r.porAcao.get("A").atrasada, true);
    assert.equal(r.porAcao.get("B").atrasada, false);
    assert.ok(r.porAcao.get("B").liberacao >= 8); // depois de hoje
  });
});
