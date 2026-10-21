/** Testes dos feriados nacionais e das datas efetivas do espaço. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pascoa, feriadosNacionais, AVISO_PONTE } from "../js/feriados.js";
import { datasEfetivas } from "../js/calendario.js";

describe("Feriados nacionais", () => {
  it("calcula a Páscoa", () => {
    assert.equal(pascoa(2026).toISOString().slice(0, 10), "2026-04-05");
    assert.equal(pascoa(2027).toISOString().slice(0, 10), "2027-03-28");
    assert.equal(pascoa(2025).toISOString().slice(0, 10), "2025-04-20");
  });

  it("2026: as 19 datas da portaria do MGI, mais a ponte provável de 2 de janeiro (excesso de zelo)", () => {
    const f = feriadosNacionais(2026);
    const datas = f.map((x) => x.data);
    const mgi2026 = ["2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-04-03", "2026-04-20", "2026-04-21",
      "2026-05-01", "2026-06-04", "2026-06-05", "2026-09-07", "2026-10-12", "2026-10-28", "2026-11-02", "2026-11-15",
      "2026-11-20", "2026-12-24", "2026-12-25", "2026-12-31"];
    assert.deepEqual(datas, [...mgi2026, "2026-01-02"].sort());
    assert.deepEqual(f.filter((x) => x.motivo === AVISO_PONTE).map((x) => x.data), ["2026-01-02", "2026-04-20", "2026-06-05"]);
    assert.ok(f.every((x) => x.motivo === AVISO_PONTE ? x.motivo.startsWith("⚠️") : !x.motivo.startsWith("⚠️")));
  });

  it("2027: móveis pela Páscoa, em ordem, sem datas repetidas", () => {
    const datas = feriadosNacionais(2027).map((x) => x.data);
    for (const d of ["2027-02-08", "2027-02-09", "2027-02-10", "2027-03-26", "2027-05-27", "2027-05-28"]) assert.ok(datas.includes(d), d);
    assert.deepEqual(datas, [...datas].sort());
    assert.equal(new Set(datas).size, datas.length);
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
