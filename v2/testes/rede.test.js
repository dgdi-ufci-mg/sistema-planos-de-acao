import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { montarRede } from "../js/rede.js";

const HOJE = "2026-10-20";
async function exemplo() {
  const store = criarStore(criarBancoLocal());
  const id = await carregarExemplo(store, new Date(`${HOJE}T12:00:00Z`));
  const espaco = await store.lerEspaco(id);
  const acoes = (await store.listarAcoes(id)).sort((a, b) => a.ordem - b.ordem);
  const cal = criarCalendario(espaco, HOJE);
  return { acoes, caminho: caminhoCritico(acoes, cal, { hoje: HOJE }) };
}

/** Conta cruzamentos entre setas de colunas vizinhas. */
function cruzamentos(colunas, arestas, coluna) {
  const pos = new Map(colunas.flatMap((c) => c.map((n, i) => [n, i])));
  const vizinhas = arestas.filter((a) => coluna.get(a.para) - coluna.get(a.de) === 1);
  let n = 0;
  for (const a of vizinhas) for (const b of vizinhas) {
    if (coluna.get(a.de) !== coluna.get(b.de) || a === b) continue;
    if ((pos.get(a.de) - pos.get(b.de)) * (pos.get(a.para) - pos.get(b.para)) < 0) n++;
  }
  return n / 2;
}

describe("Rede (passo 1.17c)", () => {
  it("cada ação aparece uma vez, e toda seta vai para uma coluna à direita", async () => {
    const { acoes, caminho } = await exemplo();
    const { colunas, arestas, coluna } = montarRede(acoes, caminho);
    assert.deepEqual(colunas.flat().sort((a, b) => a - b), acoes.map((a) => a.numero).sort((a, b) => a - b));
    assert.equal(arestas.length, acoes.reduce((s, a) => s + a.dependeDe.length, 0));
    for (const a of arestas) assert.ok(coluna.get(a.para) > coluna.get(a.de));
    for (const c of colunas) assert.ok(c.length > 0);
  });

  it("ações sem anteriores na primeira coluna; cada uma logo depois da anterior mais distante", async () => {
    const { acoes, caminho } = await exemplo();
    const { coluna } = montarRede(acoes, caminho);
    for (const a of acoes) {
      const esperada = a.dependeDe.length ? Math.max(...a.dependeDe.map((d) => coluna.get(d))) + 1 : 0;
      assert.equal(coluna.get(a.numero), esperada, a.rotulo);
    }
  });

  it("as setas críticas formam uma cadeia de ações sem folga", async () => {
    const { acoes, caminho } = await exemplo();
    const { arestas } = montarRede(acoes, caminho);
    const criticas = arestas.filter((a) => a.critica);
    assert.ok(criticas.length > 0);
    for (const a of criticas) assert.ok(caminho.porAcao.get(a.de).critica && caminho.porAcao.get(a.para).critica);
  });

  it("a arrumação não cruza mais setas do que a ordem do espaço", async () => {
    const { acoes, caminho } = await exemplo();
    const r = montarRede(acoes, caminho);
    const naOrdem = r.colunas.map((c) => [...c].sort((a, b) => a - b));
    assert.ok(cruzamentos(r.colunas, r.arestas, r.coluna) <= cruzamentos(naOrdem, r.arestas, r.coluna));
  });

  it("não trava com dependência circular nem com espaço vazio", () => {
    const acoes = [{ numero: 1, dependeDe: [2] }, { numero: 2, dependeDe: [1] }];
    const r = montarRede(acoes, { porAcao: new Map() });
    assert.equal(r.colunas.flat().length, 2);
    assert.deepEqual(montarRede([], { porAcao: new Map() }).colunas, []);
  });
});
