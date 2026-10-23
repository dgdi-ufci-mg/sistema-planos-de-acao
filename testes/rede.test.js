import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { readFileSync } from "node:fs";
import { montarRede, caminhoDaSeta, MEDIDAS } from "../js/rede.js";

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

  /* 22/10/2026: desenho sem sobreposição, com raias e setas em ângulo reto, conferido no exemplo e na PI² real */
  const pi2 = () => {
    const dados = JSON.parse(readFileSync(new URL("./dados/pi2-fase1.json", import.meta.url), "utf8"));
    const ids = new Map(dados.tasks.map((t, i) => [t.id, i + 1]));
    const etapas = [...new Set(dados.tasks.sort((a, b) => a.order - b.order).map((t) => t.stage))];
    return {
      acoes: dados.tasks.map((t) => ({ numero: ids.get(t.id), etapa: t.stage, dependeDe: t.preds.map((p) => ids.get(p)) })),
      marcos: etapas.map((e) => ({ id: e, nome: e })),
    };
  };
  const casos = [
    ["exemplo", async () => { const { acoes } = await exemplo(); return { acoes, marcos: [...new Set(acoes.map((a) => a.etapa))].map((e) => ({ id: e, nome: e })) }; }],
    ["PI²", async () => pi2()],
    ["exemplo sem marcos", async () => ({ acoes: (await exemplo()).acoes, marcos: null })],
  ];
  for (const [nome, carregar] of casos) {
    it(`${nome}: cartões sem sobreposição, nos seus marcos; setas em ângulo reto, sem passar por cima de cartões`, async () => {
      const { acoes, marcos } = await carregar();
      const r = montarRede(acoes, { porAcao: new Map() }, marcos ? { marcos, marcoDe: (a) => a.etapa } : {});
      const caixas = [...r.pos].map(([n, p]) => ({ n, ...p }));
      for (const a of caixas) for (const b of caixas) {
        if (a.n >= b.n) continue;
        const separadas = a.x + MEDIDAS.largura <= b.x || b.x + MEDIDAS.largura <= a.x || a.y + MEDIDAS.altura <= b.y || b.y + MEDIDAS.altura <= a.y;
        assert.ok(separadas, `cartões ${a.n} e ${b.n}`);
      }
      if (marcos) {
        assert.equal(r.marcos.length, new Set(acoes.map((a) => a.etapa)).size);
        r.marcos.forEach((m, i) => { if (i) assert.ok(m.x >= r.marcos[i - 1].x + r.marcos[i - 1].largura - 0.5, "marcos fora de ordem"); });
        for (const a of acoes) {
          const faixa = r.marcos.find((x) => x.id === a.etapa);
          const p = r.pos.get(a.numero);
          assert.ok(p.x >= faixa.x && p.x + MEDIDAS.largura <= faixa.x + faixa.largura, `ação ${a.numero} fora do marco`);
          assert.ok(p.y >= MEDIDAS.margem + MEDIDAS.cabecaMarco, `ação ${a.numero} sobre o nome do marco`);
        }
      }
      for (const ar of r.arestas) {
        if (ar.volta) continue;
        assert.equal(ar.pontos[0][0], r.pos.get(ar.de).x + MEDIDAS.largura);
        assert.equal(ar.pontos.at(-1)[0], r.pos.get(ar.para).x);
        for (let k = 0; k + 1 < ar.pontos.length; k++) {
          const [[x0, y0], [x1, y1]] = [ar.pontos[k], ar.pontos[k + 1]];
          assert.ok(x0 === x1 || y0 === y1, `seta ${ar.de}→${ar.para} não está em ângulo reto`);
          for (const c of caixas) {
            const dentroX = Math.max(x0, x1) > c.x + 0.5 && Math.min(x0, x1) < c.x + MEDIDAS.largura - 0.5;
            const dentroY = Math.max(y0, y1) > c.y + 0.5 && Math.min(y0, y1) < c.y + MEDIDAS.altura - 0.5;
            assert.ok(!(dentroX && dentroY), `seta ${ar.de}→${ar.para} passa pelo cartão ${c.n}`);
          }
        }
      }
      assert.ok(r.largura > 0 && r.altura > 0);
    });
  }

  it("seta que cruza outra ganha um salto no ponto de cruzamento", () => {
    /* 1→4 e 2→3 se cruzam obrigatoriamente quando 1 fica acima de 2 e 4 abaixo de 3 */
    const acoes = [{ numero: 1, dependeDe: [] }, { numero: 2, dependeDe: [] }, { numero: 3, dependeDe: [2] }, { numero: 4, dependeDe: [1, 3] }, { numero: 5, dependeDe: [1] }];
    const r = montarRede(acoes, { porAcao: new Map() });
    for (const ar of r.arestas) for (const [sx, sy] of ar.saltos) {
      const outra = r.arestas.find((o) => o !== ar && o.pontos.some((p, k) => k > 0 && p[0] === sx && o.pontos[k - 1][0] === sx));
      assert.ok(outra, `salto em ${sx},${sy} sem seta vertical`);
    }
    assert.match(caminhoDaSeta([[0, 0], [100, 0]], [[50, 0]]), /A4,4 0 0 1 54,0/);
  });

  it("seta para uma etapa anterior passa por baixo de tudo", () => {
    const acoes = [{ numero: 1, etapa: "A", dependeDe: [2] }, { numero: 2, etapa: "B", dependeDe: [] }];
    const r = montarRede(acoes, { porAcao: new Map() }, { marcos: [{ id: "A", nome: "A" }, { id: "B", nome: "B" }], marcoDe: (a) => a.etapa });
    assert.ok(r.pos.get(1).x < r.pos.get(2).x);
    const [seta] = r.arestas;
    assert.equal(seta.volta, true);
    const fundo = Math.max(...[...r.pos.values()].map((p) => p.y + MEDIDAS.altura));
    assert.ok(seta.pontos.some(([, y]) => y > fundo));
  });
});
