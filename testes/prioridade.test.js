/** Prioridade da equipe (passo 2.10a; documentação técnica, seções 5.8 e 16.8). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { chaveEntre, chaveValida, compararPrioridade, planejarMovimento, posicoesDaPrioridade } from "../js/prioridade.js";
import { ordenar } from "../js/lista.js";
import { descreverRegistro } from "../js/historico.js";

describe("Prioridade: chave fracionária", () => {
  it("exemplos da documentação (seção 5.8)", () => {
    assert.equal(chaveEntre(null, null), "i");
    assert.equal(chaveEntre("i", null), "r");
    assert.equal(chaveEntre(null, "i"), "9");
    assert.equal(chaveEntre("i", "j"), "ii");
    assert.equal(chaveEntre("az", "b"), "azi");
    assert.equal(chaveEntre(null, "1"), "0i");
    assert.equal(chaveEntre(null, "01"), "00i");
  });

  it("sempre fica estritamente entre as duas e é válida, em milhares de inserções (semente fixa)", () => {
    let s = 20261014; // mulberry32, como na simulação
    const aleatorio = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const chaves = [];
    for (let n = 0; n < 3000; n++) {
      const i = Math.floor(aleatorio() * (chaves.length + 1));
      const k = chaveEntre(chaves[i - 1] ?? null, chaves[i] ?? null);
      assert.ok(chaveValida(k), k);
      if (i > 0) assert.ok(chaves[i - 1] < k);
      if (i < chaves.length) assert.ok(k < chaves[i]);
      chaves.splice(i, 0, k);
    }
    assert.ok(Math.max(...chaves.map((k) => k.length)) < 40);
  });

  it("recusa chaves inválidas ou fora de ordem", () => {
    assert.throws(() => chaveEntre("b", "a"));
    assert.throws(() => chaveEntre("a0", null));
    assert.throws(() => chaveEntre("A", null));
    assert.equal(chaveValida("i"), true);
    assert.equal(chaveValida(""), false);
  });

  it("ordem: com chave antes, pela chave; sem chave, depois, pela ordem do espaço", () => {
    const acoes = [{ numero: 1, ordem: 1 }, { numero: 2, ordem: 2, posicaoPrioridade: "r" }, { numero: 3, ordem: 3, posicaoPrioridade: "i" }, { numero: 4, ordem: 4 }];
    assert.deepEqual([...acoes].sort(compararPrioridade).map((a) => a.numero), [3, 2, 1, 4]);
    assert.deepEqual(ordenar(acoes.map((acao) => ({ acao })), "prioridade").map((l) => l.acao.numero), [3, 2, 1, 4]);
    assert.deepEqual([...posicoesDaPrioridade(acoes)], [[3, 1], [2, 2]]);
  });

  it("mover sem chaves: dá chave às de cima, na primeira vez, e grava a movida por último", () => {
    const acoes = [1, 2, 3, 4].map((n) => ({ numero: n, ordem: n }));
    const g = planejarMovimento(acoes, 4, { depoisDe: 2, antesDe: 3 });
    assert.deepEqual(g.map((x) => x.numero), [1, 2, 4]);
    const comChaves = acoes.map((a) => ({ ...a, posicaoPrioridade: g.find((x) => x.numero === a.numero)?.posicaoPrioridade }));
    assert.deepEqual(comChaves.sort(compararPrioridade).map((a) => a.numero), [1, 2, 4, 3]);
    /* para o topo: só a movida */
    assert.deepEqual(planejarMovimento(acoes, 3, { antesDe: 1 }).map((x) => x.numero), [3]);
  });

  it("vizinhas com chaves iguais: fica logo depois da de cima", () => {
    const acoes = [{ numero: 1, ordem: 1, posicaoPrioridade: "i" }, { numero: 2, ordem: 2, posicaoPrioridade: "i" }, { numero: 3, ordem: 3 }];
    assert.deepEqual(planejarMovimento(acoes, 3, { depoisDe: 1, antesDe: 2 }), [{ numero: 3, posicaoPrioridade: "r" }]);
  });
});

describe("Prioridade: Store", () => {
  it("priorizar grava só o necessário, com histórico, e recusa vizinha inexistente", async () => {
    let relogio = 0;
    const store = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", hoje: () => "2026-10-24", agora: () => new Date(Date.UTC(2026, 9, 24, 10, 0, relogio++)).toISOString() });
    const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
    for (const r of ["A", "B", "C"]) await store.criarAcao(id, { rotulo: r });
    await store.priorizar(id, 3, { antesDe: 1 });
    const ordem = async () => (await store.listarAcoes(id)).sort(compararPrioridade).map((a) => a.rotulo);
    assert.deepEqual(await ordem(), ["C", "A", "B"]);
    await store.priorizar(id, 1, { depoisDe: 2 });
    assert.deepEqual(await ordem(), ["C", "B", "A"]);
    const rs = (await store.listarHistorico(id, 3)).filter((r) => r.campo === "posicaoPrioridade");
    assert.equal(descreverRegistro(rs[0], {}), "Mudou a posição na prioridade da equipe.");
    await assert.rejects(store.priorizar(id, 1, { depoisDe: 9 }), { codigo: "nao-encontrado" });
    await assert.rejects(store.priorizar(id, 1, { depoisDe: 1 }), { codigo: "nao-encontrado" });
    await assert.rejects(store.alterarAcao(id, 1, { posicaoPrioridade: "a0" }), { codigo: "posicao-invalida" });
  });
});
