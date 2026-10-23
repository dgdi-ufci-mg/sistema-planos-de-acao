/** Testes da simulação de Monte Carlo e das duas prioridades. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criarCalendario } from "../js/calendario.js";
import { mulberry32, sortearBetaPert, simular, VERSAO_CALCULO } from "../js/simulacao.js";

const cal = criarCalendario({ inicio: "2026-10-05" });
const est = (o, m, p) => ({ o, m, p, contaDe: "liberacao" });
const opcoes = { hoje: "2026-10-05", semente: 20261014, simulacoes: 4000 };
const soma = (r, campo) => [...r.porAcao.values()].reduce((s, x) => s + x[campo], 0);

describe("Sorteios", () => {
  it("mulberry32 é reprodutível e fica entre 0 e 1", () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = Array.from({ length: 1000 }, a);
    assert.deepEqual(xs.slice(0, 5), Array.from({ length: 5 }, b));
    assert.ok(xs.every((x) => x >= 0 && x < 1));
  });

  it("beta-PERT: média (O + 4M + P)/6 e valores entre O e P", () => {
    const aleatorio = mulberry32(7);
    const xs = Array.from({ length: 40000 }, () => sortearBetaPert({ o: 2, m: 5, p: 14 }, aleatorio));
    const media = xs.reduce((a, b) => a + b, 0) / xs.length;
    assert.ok(Math.abs(media - 6) < 0.05, `média ${media}`);
    assert.ok(xs.every((x) => x >= 2 && x <= 14));
  });

  it("estimativa sem incerteza (O = P) não sorteia", () => {
    assert.equal(sortearBetaPert({ o: 3, m: 3, p: 3 }, mulberry32(1)), 3);
  });
});

describe("Simulação", () => {
  it("mesma semente, mesmo resultado; outra semente, resultado parecido", () => {
    const acoes = [{ numero: "A", dependeDe: [], estimativas: [est(2, 5, 14)] }];
    const r1 = simular(acoes, cal, opcoes), r2 = simular(acoes, cal, opcoes);
    assert.deepEqual([...r1.fins], [...r2.fins]);
    const r3 = simular(acoes, cal, { ...opcoes, semente: 1 });
    assert.notDeepEqual([...r1.fins], [...r3.fins]);
    assert.ok(Math.abs(r1.p50 - r3.p50) < 0.5);
  });

  it("devolve a versão do cálculo, a semente e o número de simulações", () => {
    const r = simular([{ numero: "A", dependeDe: [], estimativas: [est(1, 2, 3)] }], cal, opcoes);
    assert.deepEqual([r.versaoCalculo, r.semente, r.simulacoes], [VERSAO_CALCULO, 20261014, 4000]);
  });

  it("sequência sem incerteza: todas críticas, nenhuma incerteza a repartir", () => {
    const r = simular([
      { numero: "A", dependeDe: [], estimativas: [est(3, 3, 3)] },
      { numero: "B", dependeDe: ["A"], estimativas: [est(2, 2, 2)] },
    ], cal, opcoes);
    assert.equal(r.p50, 5);
    assert.deepEqual([...r.porAcao.values()].map((x) => x.prioridadeExecucao), [1, 1]);
    assert.equal(soma(r, "prioridadeRevisao"), 0);
  });

  it("caminhos em paralelo: a mais incerta pesa mais, e as parcelas somam 100%", () => {
    const r = simular([
      { numero: "INC", dependeDe: [], estimativas: [est(5, 10, 30)] }, // muito incerta
      { numero: "EST", dependeDe: [], estimativas: [est(10, 11, 12)] }, // quase certa
    ], cal, opcoes);
    const inc = r.porAcao.get("INC"), estv = r.porAcao.get("EST");
    assert.ok(Math.abs(inc.prioridadeExecucao + estv.prioridadeExecucao - 1) < 1e-9);
    assert.ok(inc.prioridadeExecucao > estv.prioridadeExecucao);
    assert.ok(inc.prioridadeRevisao > 0.9);
    assert.ok(Math.abs(soma(r, "prioridadeRevisao") - 1) < 1e-9);
  });

  it("ação concluída não tem prioridade nem incerteza", () => {
    const r = simular([
      { numero: "A", dependeDe: [], estimativas: [est(1, 2, 3)], concluidaEm: "2026-10-06" },
      { numero: "B", dependeDe: ["A"], estimativas: [est(1, 2, 6)] },
    ], cal, { ...opcoes, hoje: "2026-10-07" });
    assert.deepEqual(r.porAcao.get("A"), { prioridadeExecucao: 0, prioridadeRevisao: 0 });
    assert.equal(r.porAcao.get("B").prioridadeExecucao, 1);
  });

  it("nada termina no passado: nenhum cenário termina antes de hoje", () => {
    const r = simular([{ numero: "A", dependeDe: [], estimativas: [est(1, 2, 3)] }], cal, { ...opcoes, hoje: "2026-10-20" });
    const idxHoje = cal.diasUteisAntes("2026-10-20");
    assert.ok([...r.fins].every((f) => f >= idxHoje + 1));
  });

  it("chance de cumprir o prazo: 100% com folga, 0% sem tempo", () => {
    const acoes = [{ numero: "A", dependeDe: [], estimativas: [est(5, 10, 15)] }];
    assert.equal(simular(acoes, cal, { ...opcoes, prazoFinal: "2026-12-31" }).chancePrazo, 1);
    assert.equal(simular(acoes, cal, { ...opcoes, prazoFinal: "2026-10-07" }).chancePrazo, 0);
    assert.equal(simular(acoes, cal, opcoes).chancePrazo, null);
  });
});

describe("Referência da PI² com a beta-PERT (seção 3.2)", () => {
  // Valores registrados na especificação. Se este teste falhar depois de mudar o
  // cálculo, a mesma semente passou a dar outro resultado: aumente VERSAO_CALCULO
  // em js/simulacao.js e registre os novos valores.
  const pi2 = JSON.parse(readFileSync(new URL("./dados/pi2-fase1.json", import.meta.url), "utf8"));
  const datas = pi2.holidays.split(/,\s*/).map((s) => { const [d, m, a] = s.split("/"); return { data: `${a}-${m}-${d}` }; });
  const calPi2 = criarCalendario({ inicio: pi2.start, datasExcluidas: datas });
  const acoes = pi2.tasks.map((t) => ({ numero: t.id, ordem: t.order, dependeDe: t.preds,
    estimativas: [{ o: t.o, m: t.m, p: t.p, contaDe: "liberacao" }] }));
  const r = simular(acoes, calPi2, { hoje: pi2.start, semente: 20261014, simulacoes: 10000, prazoFinal: pi2.target });

  it("versão do cálculo 1: P50 30/03/2027, P80 08/04/2027, P95 22/04/2027, chance 89,5%", () => {
    assert.equal(VERSAO_CALCULO, 1);
    assert.deepEqual([r.p50, r.p80, r.p95].map((x) => calPi2.dataDeConclusao(x, 0)), ["2027-03-30", "2027-04-08", "2027-04-22"]);
    assert.equal(r.chancePrazo, 0.8948);
  });
});

describe("Chave da simulação (22/10/2026)", async () => {
  const { chaveDaSimulacao } = await import("../js/simulacao.js");
  const base = [{ numero: 1, ordem: 1, rotulo: "A", dependeDe: [], estimativas: [{ o: 1, m: 2, p: 3, em: "2026-10-01" }], responsaveis: [] },
    { numero: 2, ordem: 2, rotulo: "B", dependeDe: [1], estimativas: [{ o: 2, m: 3, p: 5, em: "2026-10-01" }], responsaveis: [] }];
  const op = { hoje: "2026-10-22", semente: 20261014, simulacoes: 10000, inicio: "2026-10-01", datasExcluidas: [{ data: "2026-11-02" }] };
  const chave = (acoes, o = op) => chaveDaSimulacao(acoes, o);
  it("não muda com nome, descrição, responsáveis ou notas", () => {
    const outra = base.map((a) => ({ ...a, rotulo: a.rotulo + "!", descricao: "x", responsaveis: ["r1"], notas: "y" }));
    assert.equal(chave(outra), chave(base));
  });
  it("muda com estimativa, dependência, conclusão, data mínima, ordem, calendário, hoje e semente", () => {
    const k = chave(base);
    const troca = (i, campos) => base.map((a, j) => (j === i ? { ...a, ...campos } : a));
    assert.notEqual(chave(troca(1, { estimativas: [...base[1].estimativas, { o: 2, m: 4, p: 6, em: "2026-10-20" }] })), k);
    assert.notEqual(chave(troca(1, { dependeDe: [] })), k);
    assert.notEqual(chave(troca(0, { concluidaEm: "2026-10-10" })), k);
    assert.notEqual(chave(troca(0, { naoAntesDe: "2026-10-05" })), k);
    assert.notEqual(chave(troca(0, { ordem: 3 })), k);
    assert.notEqual(chave(base, { ...op, datasExcluidas: [] }), k);
    assert.notEqual(chave(base, { ...op, hoje: "2026-10-23" }), k);
    assert.notEqual(chave(base, { ...op, semente: 1 }), k);
  });
});

