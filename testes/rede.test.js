import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { readFileSync } from "node:fs";
import { montarRede, abrirEspaco, caminhoDaSeta, MEDIDAS } from "../js/rede.js";

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

  it("cada ação fica logo depois da anterior mais distante; sem anteriores, todas na primeira coluna (27/10/2026)", async () => {
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
      const r = montarRede(acoes, { porAcao: new Map() }, { pontas: true, ...(marcos ? { marcos, marcoDe: (a) => a.etapa } : {}) });
      const caixas = [...r.pos].map(([n, p]) => ({ n, ...p }));
      for (const a of caixas) for (const b of caixas) {
        if (a.n >= b.n) continue;
        const separadas = a.x + MEDIDAS.largura <= b.x || b.x + MEDIDAS.largura <= a.x || a.y + MEDIDAS.altura <= b.y || b.y + MEDIDAS.altura <= a.y;
        assert.ok(separadas, `cartões ${a.n} e ${b.n}`);
      }
      if (marcos) {
        /* cercas (27/10/2026): uma por etapa, em volta dos seus cartões, sem encostar em cartão de outra etapa */
        assert.equal(r.cercas.length, new Set(acoes.map((a) => a.etapa)).size);
        for (const c of r.cercas) {
          for (const a of acoes) {
            const p = r.pos.get(a.numero);
            const dentro = p.x >= c.x && p.x + MEDIDAS.largura <= c.x + c.largura && p.y >= c.y && p.y + MEDIDAS.altura <= c.y + c.altura;
            const toca = p.x < c.x + c.largura && p.x + MEDIDAS.largura > c.x && p.y < c.y + c.altura && p.y + MEDIDAS.altura > c.y;
            if (a.etapa === c.id) assert.ok(dentro, `ação ${a.numero} fora da cerca ${c.id}`);
            else assert.ok(!toca, `ação ${a.numero} dentro da cerca ${c.id}`);
          }
        }
        for (const c of r.cercas) for (const d of r.cercas) {
          if (c === d) continue;
          assert.ok(c.x + c.largura <= d.x || d.x + d.largura <= c.x || c.y + c.altura <= d.y || d.y + d.altura <= c.y, `cercas ${c.id} e ${d.id} se sobrepõem`);
        }
      }
      /* nenhuma linha sobre outra (27/10/2026) */
      const trechos = r.arestas.flatMap((ar, i) => ar.pontos.slice(0, -1).map((p, k) => {
        const q = ar.pontos[k + 1];
        const h = p[1] === q[1];
        return { i, h, f: h ? p[1] : p[0], a: Math.min(h ? p[0] : p[1], h ? q[0] : q[1]), b: Math.max(h ? p[0] : p[1], h ? q[0] : q[1]) };
      }));
      for (const s of trechos) for (const t of trechos) {
        if (s.i >= t.i || s.h !== t.h || Math.abs(s.f - t.f) >= 2) continue;
        assert.ok(Math.min(s.b, t.b) - Math.max(s.a, t.a) <= 2, `setas ${r.arestas[s.i].de}→${r.arestas[s.i].para} e ${r.arestas[t.i].de}→${r.arestas[t.i].para} se sobrepõem`);
      }
      for (const ar of r.arestas) {
        if (ar.volta) continue;
        if (!ar.ligacao) assert.equal(ar.pontos[0][0], r.pos.get(ar.de).x + MEDIDAS.largura);
        if (!ar.ligacao) assert.equal(ar.pontos.at(-1)[0], r.pos.get(ar.para).x);
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

  it("a etapa não muda a coluna: quem depende fica à direita, mesmo de etapa anterior (27/10/2026)", () => {
    const acoes = [{ numero: 1, etapa: "A", dependeDe: [2] }, { numero: 2, etapa: "B", dependeDe: [] }];
    const r = montarRede(acoes, { porAcao: new Map() }, { marcos: [{ id: "A", nome: "A" }, { id: "B", nome: "B" }], marcoDe: (a) => a.etapa });
    assert.ok(r.pos.get(2).x < r.pos.get(1).x);
    assert.ok(r.arestas.every((a) => !a.volta));
  });

  it("início, término e linhas de fim de fase", async () => {
    const { acoes } = await exemplo();
    const marcos = [...new Set(acoes.map((a) => a.etapa))].map((e, i) => ({ id: e, nome: e, fase: i < 2 ? "F1" : "F2", faseNome: i < 2 ? "Fase 1" : "Fase 2" }));
    const r = montarRede(acoes, { porAcao: new Map() }, { pontas: true, marcos, marcoDe: (a) => a.etapa });
    const xs = [...r.pos.values()];
    assert.ok(r.pontas.inicio.x < Math.min(...xs.map((p) => p.x)));
    assert.ok(r.pontas.termino.x > Math.max(...xs.map((p) => p.x + MEDIDAS.largura)));
    assert.equal(r.fases.length, 2);
    /* a linha da fase não passa por cartão nem por cerca */
    for (const f of r.fases) {
      for (const p of xs) assert.ok(f.x < p.x || f.x > p.x + MEDIDAS.largura);
      for (const c of r.cercas) assert.ok(f.x <= c.x || f.x >= c.x + c.largura, `linha da ${f.nome} na cerca ${c.id}`);
    }
  });

  /* ---------- 11/11/2026: fases em faixas, compactação e posições mantidas ---------- */
  const duasFases = [
    { id: "E11", nome: "1.1", fase: "F1", faseNome: "Fase 1" }, { id: "E21", nome: "2.1", fase: "F2", faseNome: "Fase 2" },
    { id: "E22", nome: "2.2", fase: "F2", faseNome: "Fase 2" },
  ];
  const op = { pontas: true, marcos: duasFases, marcoDe: (a) => a.etapa };

  it("fases em faixas: a ação da fase 2 que só depende do começo fica depois do fim da fase 1", () => {
    /* 1 → 2 → 3 na fase 1; a 4 (fase 2) depende só da 1: antes, ficava na segunda coluna, dentro da fase 1 */
    const acoes = [
      { numero: 1, etapa: "E11", dependeDe: [] }, { numero: 2, etapa: "E11", dependeDe: [1] }, { numero: 3, etapa: "E11", dependeDe: [2] },
      { numero: 4, etapa: "E21", dependeDe: [1] }, { numero: 5, etapa: "E21", dependeDe: [4] },
    ];
    const r = montarRede(acoes, { porAcao: new Map() }, op);
    assert.equal(r.coluna.get(4), r.coluna.get(3) + 1);
    const [f1, f2] = r.fases;
    assert.deepEqual([f1.nome, f2.nome], ["Fase 1", "Fase 2"]);
    assert.equal(f2.x0, f1.x1, "a fase seguinte começa onde a anterior termina");
    for (const a of acoes) {
      const f = a.etapa === "E11" ? f1 : f2;
      const x = r.pos.get(a.numero).x;
      assert.ok(x >= f.x0 && x + MEDIDAS.largura <= f.x1, `ação ${a.numero} dentro da faixa da ${f.nome}`);
    }
    assert.ok(r.arestas.every((a) => !a.volta));
  });

  it("fases em faixas: quem depende de uma ação de fase posterior acompanha a fase dela", () => {
    const acoes = [{ numero: 1, etapa: "E21", dependeDe: [] }, { numero: 2, etapa: "E11", dependeDe: [1] }, { numero: 3, etapa: "E11", dependeDe: [] }];
    const r = montarRede(acoes, { porAcao: new Map() }, op);
    assert.ok(r.coluna.get(2) > r.coluna.get(1) && r.coluna.get(1) > r.coluna.get(3));
    assert.ok(r.arestas.every((a) => !a.volta), "nenhuma seta para trás");
  });

  it("compactação: a etapa sobe até encostar no que há acima dela, nas suas colunas", () => {
    /* fase 1: uma etapa alta (três ações em paralelo); fase 2: duas etapas em paralelo, uma acima da outra.
       Sem compactar, a segunda etapa da fase 2 ficaria abaixo da altura da etapa da fase 1. */
    const acoes = [
      { numero: 1, etapa: "E11", dependeDe: [] }, { numero: 2, etapa: "E11", dependeDe: [] }, { numero: 3, etapa: "E11", dependeDe: [] }, { numero: 4, etapa: "E11", dependeDe: [] },
      { numero: 5, etapa: "E21", dependeDe: [1] }, { numero: 6, etapa: "E22", dependeDe: [1] },
    ];
    const r = montarRede(acoes, { porAcao: new Map() }, op);
    const [c21, c22] = ["E21", "E22"].map((id) => r.cercas.find((c) => c.id === id));
    const acima = c21.y < c22.y ? c21 : c22;
    const abaixo = acima === c21 ? c22 : c21;
    assert.ok(abaixo.y - (acima.y + acima.altura) < 40, "a etapa de baixo encosta na de cima");
    assert.ok(abaixo.y < r.cercas.find((c) => c.id === "E11").y + r.cercas.find((c) => c.id === "E11").altura, "sem esperar o fim da etapa alta da outra fase");
    for (const a of r.cercas) for (const b of r.cercas) {
      if (a === b) continue;
      const separadas = a.x + a.largura <= b.x || b.x + b.largura <= a.x || a.y + a.altura <= b.y || b.y + b.altura <= a.y;
      assert.ok(separadas, `cercas ${a.id} e ${b.id} não se sobrepõem`);
    }
  });

  describe("posições mantidas (abrirEspaco)", () => {
    const base = [
      { numero: 1, etapa: "E11", dependeDe: [] }, { numero: 2, etapa: "E11", dependeDe: [1] },
      { numero: 3, etapa: "E11", dependeDe: [1] }, { numero: 4, etapa: "E21", dependeDe: [2, 3] },
    ];
    const antes = () => { const r = montarRede(base, { porAcao: new Map() }, op); return { r, anterior: { coluna: r.coluna, pos: r.pos, etapas: new Map(base.map((a) => [a.numero, a.etapa])) } }; };
    const centro = (r, n) => r.pos.get(n).y + MEDIDAS.altura / 2;

    it("inserir entre duas ações abre uma coluna: o que está à direita desliza, e nada sobe nem desce", () => {
      const { r, anterior } = antes();
      const acoes = [...base.map((a) => (a.numero === 4 ? { ...a, dependeDe: [5, 3] } : a)), { numero: 5, etapa: "E11", dependeDe: [2] }];
      const fixos = abrirEspaco(anterior, acoes, op);
      assert.ok(fixos);
      assert.equal(fixos.get(5).coluna, r.coluna.get(2) + 1);
      assert.equal(fixos.get(5).y, centro(r, 2), "a nova fica na altura da vizinha da mesma etapa");
      assert.equal(fixos.get(4).coluna, r.coluna.get(4) + 1, "a seguinte deslizou uma coluna");
      for (const n of [1, 2, 3]) assert.equal(fixos.get(n).coluna, r.coluna.get(n));
      for (const n of [1, 2, 3, 4]) assert.equal(fixos.get(n).y, centro(r, n), `a ação ${n} não subiu nem desceu`);
      const novo = montarRede(acoes, { porAcao: new Map() }, { ...op, fixos });
      for (const n of [1, 2, 3, 4]) assert.equal(centro(novo, n), centro(r, n));
      assert.ok(novo.pos.get(4).x > r.pos.get(4).x);
      assert.ok(novo.arestas.every((a) => !a.volta));
      /* as setas retraçadas não passam por cima de cartões */
      for (const ar of novo.arestas) for (let k = 0; k + 1 < ar.pontos.length; k++) {
        const [[x0, y0], [x1, y1]] = [ar.pontos[k], ar.pontos[k + 1]];
        for (const [n, c] of novo.pos) {
          const dentroX = Math.max(x0, x1) > c.x + 0.5 && Math.min(x0, x1) < c.x + MEDIDAS.largura - 0.5;
          const dentroY = Math.max(y0, y1) > c.y + 0.5 && Math.min(y0, y1) < c.y + MEDIDAS.altura - 0.5;
          assert.ok(!(dentroX && dentroY), `seta ${ar.de}→${ar.para} passa pelo cartão ${n}`);
        }
      }
    });

    it("criar a próxima num lugar livre não desloca ninguém", () => {
      const { r, anterior } = antes();
      const acoes = [...base, { numero: 5, etapa: "E21", dependeDe: [4] }];
      const fixos = abrirEspaco(anterior, acoes, op);
      for (const a of base) assert.equal(fixos.get(a.numero).coluna, r.coluna.get(a.numero));
      assert.deepEqual(fixos.get(5), { coluna: r.coluna.get(4) + 1, y: centro(r, 4) });
    });

    it("criar a próxima num lugar ocupado abre uma coluna", () => {
      const { r, anterior } = antes();
      const acoes = [...base, { numero: 5, etapa: "E11", dependeDe: [1] }];
      const fixos = abrirEspaco(anterior, acoes, op);
      assert.equal(fixos.get(5).coluna, r.coluna.get(1) + 1);
      for (const n of [2, 3, 4]) assert.equal(fixos.get(n).coluna, r.coluna.get(n) + 1);
    });

    it("inserir antes da primeira (\"+\" na linha do início) abre uma coluna no começo, na altura da seguinte", () => {
      const { r, anterior } = antes();
      const acoes = [...base.map((a) => (a.numero === 1 ? { ...a, dependeDe: [5] } : a)), { numero: 5, etapa: "E11", dependeDe: [] }];
      const fixos = abrirEspaco(anterior, acoes, op);
      assert.ok(fixos);
      assert.deepEqual(fixos.get(5), { coluna: r.coluna.get(1), y: centro(r, 1) });
      for (const a of base) {
        assert.equal(fixos.get(a.numero).coluna, r.coluna.get(a.numero) + 1, `a ação ${a.numero} deslizou uma coluna`);
        assert.equal(fixos.get(a.numero).y, centro(r, a.numero));
      }
      const novo = montarRede(acoes, { porAcao: new Map() }, { ...op, fixos });
      assert.ok(novo.arestas.every((a) => !a.volta));
    });

    it("ação solta pelo \"+\" do início, numa etapa ainda sem ações, entra na primeira coluna, abaixo de tudo", () => {
      const { r, anterior } = antes();
      const acoes = [...base, { numero: 5, etapa: "E22", dependeDe: [] }];
      const fixos = abrirEspaco(anterior, acoes, op);
      assert.ok(fixos);
      assert.equal(fixos.get(5).coluna, r.coluna.get(1));
      assert.ok(fixos.get(5).y > Math.max(...base.map((a) => centro(r, a.numero))));
      for (const a of base) assert.deepEqual(fixos.get(a.numero), { coluna: r.coluna.get(a.numero), y: centro(r, a.numero) });
    });

    it("sem ação nova (ligar, desligar, renomear), tudo fica onde estava", () => {
      const { r, anterior } = antes();
      const acoes = base.map((a) => (a.numero === 4 ? { ...a, dependeDe: [2] } : a));
      const fixos = abrirEspaco(anterior, acoes, op);
      for (const a of base) assert.deepEqual(fixos.get(a.numero), { coluna: r.coluna.get(a.numero), y: centro(r, a.numero) });
    });

    it("pede a arrumação completa quando não dá para manter", () => {
      const { anterior } = antes();
      assert.equal(abrirEspaco(anterior, base.map((a) => (a.numero === 2 ? { ...a, dependeDe: [1, 4] } : a)), op), null, "seta para trás");
      assert.equal(abrirEspaco(anterior, base.map((a) => (a.numero === 3 ? { ...a, etapa: "E22" } : a)), op), null, "mudança de etapa");
      assert.equal(abrirEspaco(anterior, [...base, { numero: 5, etapa: "E11", dependeDe: [] }], op), null, "ação solta numa etapa que já tem ações");
      assert.equal(abrirEspaco(anterior, [...base, { numero: 5, etapa: "E11", dependeDe: [1] }, { numero: 6, etapa: "E11", dependeDe: [1] }], op), null, "duas ações novas");
      assert.equal(abrirEspaco(null, base, op), null, "sem desenho anterior");
    });
  });
});
