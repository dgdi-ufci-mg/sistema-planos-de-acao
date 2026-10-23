/** Testes do calendário de dias úteis. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarCalendario } from "../js/calendario.js";

// Outubro de 2026: dia 12 (segunda) é feriado; 17 e 18 são sábado e domingo.
const cal = criarCalendario({ inicio: "2026-10-08", datasExcluidas: [{ data: "2026-10-12", motivo: "Feriado" }] });

describe("Calendário de dias úteis", () => {
  it("começa no primeiro dia útil a partir do início", () => {
    assert.equal(cal.primeiroDia, "2026-10-08");
    assert.equal(criarCalendario({ inicio: "2026-10-10" }).primeiroDia, "2026-10-12"); // sábado → segunda
  });

  it("pula fins de semana e datas excluídas", () => {
    // 08 (qui), 09 (sex), [10, 11 fim de semana], [12 feriado], 13 (ter)
    assert.deepEqual([0, 1, 2, 3].map(cal.data), ["2026-10-08", "2026-10-09", "2026-10-13", "2026-10-14"]);
    assert.equal(cal.ehDiaUtil("2026-10-12"), false);
    assert.equal(cal.ehDiaUtil("2026-10-17"), false);
    assert.equal(cal.ehDiaUtil("2026-10-13"), true);
  });

  it("parte fracionária cai no mesmo dia", () => {
    assert.equal(cal.data(2.9), cal.data(2));
  });

  it("conta dias úteis antes de uma data e até ela", () => {
    assert.equal(cal.diasUteisAntes("2026-10-13"), 2);
    assert.equal(cal.diasUteisAte("2026-10-13"), 3);
    assert.equal(cal.diasUteisAntes("2026-10-12"), 2); // feriado: conta como o próximo dia útil
    assert.equal(cal.diasUteisAntes("2026-01-01"), 0); // antes do início
    assert.equal(cal.diasUteisAntes("data errada"), null);
  });

  it("estende-se sozinho para datas distantes", () => {
    const i = cal.diasUteisAntes("2030-01-07");
    assert.equal(cal.data(i), "2030-01-07");
  });

  it("data de conclusão é o último dia trabalhado", () => {
    // uma ação que vai do índice 0 ao 2 ocupa os dias 0 e 1
    assert.equal(cal.dataDeConclusao(2, 0), cal.data(1));
    assert.equal(cal.dataDeConclusao(2.5, 0), cal.data(2));
    assert.equal(cal.dataDeConclusao(0, 0), cal.data(0)); // duração zero: no próprio dia
  });
});
