import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { readFileSync } from "node:fs";
import { montarRede, MEDIDAS } from "../js/rede.js";

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

  it("cada ação fica logo depois da anterior mais distante; sem anteriores, logo antes da primeira seguinte", async () => {
    const { acoes, caminho } = await exemplo();
    const { coluna } = montarRede(acoes, caminho);
    const seguintes = (n) => acoes.filter((a) => a.dependeDe.includes(n)).map((a) => coluna.get(a.numero));
    for (const a of acoes) {
      const esperada = a.dependeDe.length ? Math.max(...a.dependeDe.map((d) => coluna.get(d))) + 1
        : seguintes(a.numero).length ? Math.min(...seguintes(a.numero)) - 1 : 0;
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

  /* 22/10/2026: desenho sem sobreposição, conferido no exemplo e na PI² real */
  const pi2 = () => {
    const dados = JSON.parse(readFileSync(new URL("./dados/pi2-fase1.json", import.meta.url), "utf8"));
    const ids = new Map(dados.tasks.map((t, i) => [t.id, i + 1]));
    return dados.tasks.sort((a, b) => a.order - b.order).map((t) => ({ numero: ids.get(t.id), dependeDe: t.preds.map((p) => ids.get(p)) }));
  };
  for (const [nome, carregar] of [["exemplo", async () => (await exemplo()).acoes], ["PI²", async () => pi2()]]) {
    it(`${nome}: cartões não se sobrepõem e nenhuma seta passa por cima de um cartão`, async () => {
      const acoes = await carregar();
      const r = montarRede(acoes, { porAcao: new Map() });
      const caixas = [...r.pos].map(([n, p]) => ({ n, ...p }));
      for (const a of caixas) for (const b of caixas) {
        if (a.n >= b.n) continue;
        const separadas = a.x + MEDIDAS.largura <= b.x || b.x + MEDIDAS.largura <= a.x || a.y + MEDIDAS.altura <= b.y || b.y + MEDIDAS.altura <= a.y;
        assert.ok(separadas, `cartões ${a.n} e ${b.n}`);
      }
      for (const ar of r.arestas) {
        /* trechos dentro de colunas (pares de pontos de passagem): horizontais, fora da altura de qualquer cartão daquela coluna */
        for (let i = 1; i + 1 < ar.pontos.length - 1; i += 2) {
          const [[x0, y], [x1, y1]] = [ar.pontos[i], ar.pontos[i + 1]];
          assert.equal(y, y1);
          for (const c of caixas) {
            if (c.x !== x0) continue;
            assert.ok(y < c.y || y > c.y + MEDIDAS.altura, `seta ${ar.de}→${ar.para} cruza o cartão ${c.n}`);
          }
          assert.equal(x1 - x0, MEDIDAS.largura);
        }
        /* saída à direita da anterior e chegada à esquerda da seguinte */
        assert.equal(ar.pontos[0][0], r.pos.get(ar.de).x + MEDIDAS.largura);
        assert.equal(ar.pontos.at(-1)[0], r.pos.get(ar.para).x);
      }
      assert.ok(r.largura > 0 && r.altura > 0);
    });
  }
});
