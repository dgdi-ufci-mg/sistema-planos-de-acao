/** Testes dos feriados nacionais e das datas efetivas do espaço. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pascoa, feriadosNacionais } from "../js/feriados.js";
import { datasEfetivas } from "../js/calendario.js";

describe("Feriados nacionais", () => {
  it("calcula a Páscoa", () => {
    assert.equal(pascoa(2026).toISOString().slice(0, 10), "2026-04-05");
    assert.equal(pascoa(2027).toISOString().slice(0, 10), "2027-03-28");
    assert.equal(pascoa(2025).toISOString().slice(0, 10), "2025-04-20");
  });

  it("traz os fixos e os móveis de 2027, em ordem", () => {
    const f = feriadosNacionais(2027);
    const datas = f.map((x) => x.data);
    assert.equal(f.length, 13);
    for (const d of ["2027-01-01", "2027-02-08", "2027-02-09", "2027-03-26", "2027-04-21", "2027-05-27", "2027-11-20", "2027-12-25"]) {
      assert.ok(datas.includes(d), d);
    }
    assert.deepEqual(datas, [...datas].sort());
  });
});

describe("Datas efetivas do espaço", () => {
  it("calendário geral, menos as desconsideradas, mais as do espaço, sem repetir", () => {
    const geral = { datasExcluidas: [{ data: "2027-02-08", motivo: "Carnaval" }, { data: "2027-04-21", motivo: "Tiradentes" }] };
    const espaco = {
      datasExcluidas: [{ data: "2027-03-19", motivo: "São José (local)" }, { data: "2027-04-21", motivo: "Tiradentes" }],
      datasGeraisDesconsideradas: ["2027-02-08"],
    };
    assert.deepEqual(datasEfetivas(espaco, geral).map((d) => d.data), ["2027-03-19", "2027-04-21"]);
    assert.deepEqual(datasEfetivas({}, null), []);
  });
});
