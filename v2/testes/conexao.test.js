import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarVigiaDeConexao } from "../js/conexao.js";

/** Vigia com sondas controladas pelo teste e sem relógio. */
function vigia(respostas, { rede = true } = {}) {
  const avisos = [];
  const agendadas = [];
  const v = criarVigiaDeConexao({
    sondar: async () => { const r = respostas.shift(); if (r instanceof Error) throw r; return r; },
    aoMudar: (c) => avisos.push(c),
    temRede: () => rede,
    agendar: (f, ms) => { agendadas.push(ms); return agendadas.length; },
    cancelar: () => {},
  });
  return { v, avisos, agendadas, semRede: () => { rede = false; }, comRede: () => { rede = true; } };
}

describe("Vigia da conexão", () => {
  it("rede ligada sem internet: duas sondas sem resposta declaram a queda", async () => {
    const { v, avisos, agendadas } = vigia([false, new Error("falhou"), true]);
    await v.verificar();
    assert.deepEqual(avisos, []); // uma falha só pode ser lentidão
    assert.equal(agendadas.at(-1), 3000); // repete logo
    await v.verificar();
    assert.deepEqual(avisos, [false]);
    assert.equal(agendadas.at(-1), 5000); // sem conexão, sonda mais vezes para perceber a volta
    await v.verificar();
    assert.deepEqual(avisos, [false, true]);
    assert.equal(agendadas.at(-1), 10000);
  });

  it("sem rede no aparelho: queda na hora, sem sondar", async () => {
    const t = vigia([]);
    t.semRede();
    await t.v.verificar();
    assert.deepEqual(t.avisos, [false]);
    assert.equal(t.v.conectado, false);
  });

  it("com internet, nada muda", async () => {
    const { v, avisos } = vigia([true, true]);
    await v.verificar();
    await v.verificar();
    assert.deepEqual(avisos, []);
    assert.equal(v.conectado, true);
  });
});
