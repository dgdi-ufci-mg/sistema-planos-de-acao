/** Mapa do Strata: faixas, ordem, posição, curvatura e limites do movimento (documentação técnica, seção 8, "Mapa"). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CAMADAS_PADRAO } from "../js/estrategia.js";
import {
  FAIXA_PLANOS, faixasDoMapa, calcularMapa, rotuloDoPonto, deslocamentoCurvo, caminhoDaFaixa, caminhoDaLigacao, problemasDasLigacoes,
  escalaMinima, limitarTransformacao, transformacaoInicial, caminhoDoNo, caminhoAlem, linhaDoSolo, estrelasDoCeu, puxaoDosVizinhos, alturaPuxada, passoDaInercia, velocidadeDeSaida, PUXAO, INERCIA, lerCor, razaoDeContraste, melhorTinta, estrelasDoMapa, MOLA, passoDaMola, emRepouso,
} from "../js/mapa.js";

const item = (id, camada, nome, superiores = [], codigo = "") => ({ id, camada, nome, codigo, superiores });
/** Catálogo pequeno: o Portfólio (opcional) fica vazio e um Programa se liga a duas Políticas. */
const catalogo = () => [
  item("oe1", "objetivoEstrategico", "Governança", [], "OE1"),
  item("oe2", "objetivoEstrategico", "Inovação", [], "OE2"),
  item("od1", "objetivoDesenvolvimento", "Dados", ["oe1"], "OD1"),
  item("od2", "objetivoDesenvolvimento", "Setor produtivo", ["oe2"], "OD2"),
  item("pol1", "politica", "Política de dados", ["od1"], "POL1"),
  item("pol2", "politica", "Política de inovação", ["od2"], "POL2"),
  item("prg1", "programa", "Repositório", ["pol1"], "PRG1"),
  item("prg2", "programa", "Painéis", ["pol1", "pol2"], "PRG2"),
];

describe("Mapa: faixas", () => {
  it("seguem a ordem do catálogo, com os Planos de Ação por último; a camada opcional vazia não ocupa faixa", () => {
    const faixas = faixasDoMapa(CAMADAS_PADRAO, catalogo());
    assert.deepEqual(faixas.map((f) => f.id), ["objetivoEstrategico", "objetivoDesenvolvimento", "politica", "programa", FAIXA_PLANOS]);
  });

  it("a camada opcional com itens ganha faixa, no seu lugar", () => {
    const itens = [...catalogo(), item("pf1", "portfolio", "Portfólio", ["pol1"], "PF1")];
    assert.deepEqual(faixasDoMapa(CAMADAS_PADRAO, itens).map((f) => f.id),
      ["objetivoEstrategico", "objetivoDesenvolvimento", "politica", "portfolio", "programa", FAIXA_PLANOS]);
  });

  it("a camada que não é opcional ocupa faixa mesmo vazia (o catálogo manda)", () => {
    const so = [item("oe1", "objetivoEstrategico", "Governança")];
    assert.equal(faixasDoMapa(CAMADAS_PADRAO, so).length, 5); // 4 não opcionais + Planos de Ação
  });
});

describe("Mapa: pontos e ligações", () => {
  it("um ponto por item ativo, uma ligação por superior; excluído e superior que não aparece ficam de fora", () => {
    const itens = [...catalogo(), { ...item("x", "programa", "Excluído", ["pol1"]), excluidoEm: "2026-01-01" }];
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: itens.filter((i) => i.id !== "pol2") });
    assert.equal(m.nos.length, 7);
    assert.ok(!m.nos.some((n) => n.id === "x"));
    const prg2 = m.ligacoes.filter((l) => l.de === "prg2");
    assert.deepEqual(prg2.map((l) => l.para), ["pol1"], "pol2 não aparece, então a ligação some");
    assert.equal(m.ligacoes.filter((l) => l.de === "od1").length, 1);
  });

  it("Planos de Ação: ponto na última faixa, ligado aos itens; restrito sem o nome; sem item mostrado, não aparece", () => {
    const planos = [
      { id: "p1", nome: "Plano A", superiores: ["prg1"] },
      { id: "p2", nome: "Plano restrito", superiores: ["prg1", "prg2"], restrito: true },
      { id: "p3", nome: "Plano de item que não vale", superiores: ["fora"] },
    ];
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), planos });
    const nosPlanos = m.nos.filter((n) => n.tipo === "plano");
    assert.deepEqual(nosPlanos.map((n) => n.id).sort(), ["p1", "p2"]);
    assert.ok(nosPlanos.every((n) => n.faixa === m.faixas.length - 1));
    assert.deepEqual(m.ligacoes.filter((l) => l.de === "plano:p2").map((l) => l.para).sort(), ["prg1", "prg2"]);
    assert.equal(nosPlanos.find((n) => n.id === "p2").restrito, true);
  });

  it("o nome comprido ganha reticências no ponto e o nome inteiro continua no ponto", () => {
    assert.equal(rotuloDoPonto("PRG1", "Repositório"), "PRG1 · Repositório");
    assert.equal(rotuloDoPonto("", "Nome"), "Nome");
    const longo = rotuloDoPonto("", "a".repeat(80));
    assert.equal(longo.length, 34);
    assert.ok(longo.endsWith("…"));
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: [item("a", "objetivoEstrategico", "b".repeat(80))] });
    assert.equal(m.nos[0].nome.length, 80);
  });
});

describe("Mapa: ordem, posição e curva", () => {
  /** Dois pares que se cruzariam na ordem de código: o baricentro desfaz o cruzamento. */
  it("a ordem na faixa reduz os cruzamentos de linhas", () => {
    const itens = [
      item("a", "objetivoEstrategico", "A", [], "A"), item("b", "objetivoEstrategico", "B", [], "B"),
      item("x", "objetivoDesenvolvimento", "X", ["b"], "X"), item("y", "objetivoDesenvolvimento", "Y", ["a"], "Y"),
    ];
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens });
    const x = (id) => m.nos.find((n) => n.id === id).x;
    assert.ok(x("a") < x("b"));
    assert.ok(x("y") < x("x"), "Y vem de A, que está à esquerda: fica à esquerda de X");
  });

  it("é determinística: a mesma entrada dá o mesmo mapa", () => {
    const um = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo() });
    const outro = calcularMapa({ camadas: CAMADAS_PADRAO, itens: [...catalogo()].reverse() });
    assert.deepEqual(um.nos.map((n) => [n.chave, n.x]), outro.nos.map((n) => [n.chave, n.x]));
  });

  const planosDe = (n, pais = ["prg1", "prg2"]) => Array.from({ length: n }, (_, i) => ({ id: `pa${i}`, nome: `Plano de Ação número ${i}`, superiores: [pais[i % pais.length]] }));
  const caixaDoNome = (n, m) => ({ x0: n.x + m.recuo, x1: n.x + m.recuo + n.largura, y0: n.yCurvo - 7, y1: n.yCurvo + 7 });
  const cruzam = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

  it("a largura é a da área (tudo cabe numa tela); nenhum ponto sai das pontas, e nomes e pontos não se cobrem", () => {
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), planos: planosDe(12), vista: { w: 1000, h: 600 } });
    assert.equal(m.largura, 1000);
    for (const f of m.faixas) {
      const nos = f.nos.map((k) => m.nos.find((n) => n.chave === k));
      for (const n of nos) {
        assert.ok(n.x >= 0 && n.x + m.recuo + n.largura <= m.largura, `${n.chave} dentro da largura`);
        const ponto = { x0: n.x - 6, x1: n.x + 6, y0: n.yCurvo - 6, y1: n.yCurvo + 6 };
        for (const o of nos) {
          if (o === n) continue;
          assert.ok(!cruzam(ponto, caixaDoNome(o, m)), `o ponto ${n.chave} não fica sobre o nome de ${o.chave}`);
          if (o.chave > n.chave) assert.ok(!cruzam(caixaDoNome(n, m), caixaDoNome(o, m)), `os nomes de ${n.chave} e ${o.chave} não se sobrepõem`);
        }
      }
    }
  });

  it("faixa cheia demais cresce para baixo, em fileiras, e não para os lados (lote 4)", () => {
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), planos: planosDe(80), vista: { w: 400, h: 600 } });
    assert.equal(m.largura, 400, "a largura continua a da área");
    const pa = m.faixas.at(-1);
    const nos = m.nos.filter((n) => n.faixa === m.faixas.length - 1).sort((a, b) => a.x - b.x);
    assert.ok(pa.niveis >= 8, `${pa.niveis} fileiras`);
    assert.ok(pa.altura >= 40 + 8 * 19, "a faixa fica mais alta");
    const porFileira = new Map();
    for (const n of nos) porFileira.set(n.nivel, [...(porFileira.get(n.nivel) ?? []), n]);
    for (const fila of porFileira.values()) for (let i = 1; i < fila.length; i++) assert.ok(fila[i].x - fila[i - 1].x >= 26 - 1e-6, "26 entre vizinhos da mesma fileira");
    for (const n of nos) assert.ok(n.y > pa.topo && n.y < pa.base, "cada ponto dentro da faixa");
    const outras = m.faixas.slice(0, -1).filter((f) => f.nos.length <= 3);
    assert.ok(outras.every((f) => f.altura < pa.altura), "as faixas com poucos itens ficam baixas, com a altura mínima");
  });

  it("só passa da largura da área quando nem 8 fileiras bastam", () => {
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), planos: planosDe(200), vista: { w: 400, h: 600 } });
    assert.ok(m.largura > 400);
    assert.ok(m.largura >= 2 * 28 + 60 + (199 * 26) / 8 - 1);
    assert.equal(m.faixas.at(-1).niveis, 8);
  });

  it("faixa cheia alterna os pontos em níveis; o nome que não cabe é cortado com reticências", () => {
    const largos = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), vista: { w: 1000, h: 600 }, medir: () => 400 });
    assert.ok(largos.faixas[0].niveis >= 2, "dois objetivos com nomes de 400 não cabem lado a lado");
    const curtos = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), vista: { w: 1000, h: 600 }, medir: () => 10 });
    assert.ok(curtos.faixas.every((f) => f.niveis === 1));
    const longo = calcularMapa({ camadas: CAMADAS_PADRAO, itens: [item("a", "objetivoEstrategico", "x".repeat(120), [], "OE1")], vista: { w: 300, h: 600 } });
    assert.ok(longo.nos[0].rotulo.endsWith("…") && longo.nos[0].rotulo.length < 120);
    assert.equal(longo.nos[0].nome.length, 120, "o nome inteiro continua no ponto");
  });

  it("a curva é (x − centro)² ÷ (2R): zero no centro, para baixo nas pontas, igual para ponto e faixa", () => {
    assert.equal(deslocamentoCurvo(500, 500, 3000), 0);
    assert.equal(deslocamentoCurvo(0, 500, 3000), 250000 / 6000);
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), planos: planosDe(6) });
    for (const n of m.nos) {
      const f = m.faixas[n.faixa];
      const sag = deslocamentoCurvo(n.x, m.centro, m.raio);
      assert.ok(n.yCurvo - sag > f.topo && n.yCurvo - sag < f.base, `${n.chave} dentro da faixa, sem a curva`);
      assert.ok(Math.abs(n.yCurvo - (n.y + sag)) < 0.1);
    }
    const ultima = m.faixas[m.faixas.length - 1];
    assert.equal(m.altura, Math.ceil(ultima.base + deslocamentoCurvo(0, m.centro, m.raio)));
  });

  it("o contorno da faixa é uma curva fechada e a ligação é uma reta entre o ponto e o que ele vem de", () => {
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo() });
    assert.match(caminhoDaFaixa(m.faixas[0], m), /^M0 [\d.]+ Q[\d.]+ [-\d.]+ [\d.]+ [\d.]+ L[\d.]+ [\d.]+ Q[\d.]+ [-\d.]+ 0 [\d.]+ Z$/);
    const [filho, superior] = [m.nos.find((n) => n.id === "od1"), m.nos.find((n) => n.id === "oe1")];
    assert.equal(caminhoDaLigacao(filho, superior), `M${filho.x} ${filho.yCurvo} L${superior.x} ${superior.yCurvo}`);
  });

  it("as linhas não passam rente a outro ponto nem saem do mesmo ponto na mesma direção", () => {
    for (const w of [1236, 358]) {
      const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), planos: planosDe(6), vista: { w, h: 560 } });
      assert.deepEqual(problemasDasLigacoes(m).map((p) => [p.tipo, p.ligacao.de]), [], `largura ${w}`);
    }
    /* o verificador enxerga os dois problemas */
    const fake = {
      nos: [{ chave: "a", x: 0, yCurvo: 0 }, { chave: "b", x: 100, yCurvo: 0 }, { chave: "c", x: 50, yCurvo: 2 }, { chave: "d", x: 300, yCurvo: 3 }],
      ligacoes: [{ de: "a", para: "b" }, { de: "a", para: "d" }],
    };
    assert.deepEqual(problemasDasLigacoes(fake).map((p) => p.tipo).sort(), ["ponto", "ponto", "ponto", "sobreposta"]);
  });
});

describe("Mapa: limites do movimento e do zoom", () => {
  const conteudo = { w: 2000, h: 600 };
  const vista = { w: 400, h: 500 };

  it("não afasta além de ver o conteúdo inteiro nem aproxima além do máximo", () => {
    const minima = escalaMinima({ conteudo, vista });
    assert.ok(Math.abs(minima - (400 - 48) / 2000) < 1e-9);
    assert.equal(limitarTransformacao({ k: 0.001, x: 0, y: 0 }, { conteudo, vista }).k, minima);
    assert.equal(limitarTransformacao({ k: 99, x: 0, y: 0 }, { conteudo, vista }).k, 3);
  });

  it("não deixa o conteúdo sair da vista, para nenhum lado", () => {
    const k = 1;
    const longe = limitarTransformacao({ k, x: 5000, y: 5000 }, { conteudo, vista });
    assert.equal(longe.x, 24);
    assert.equal(longe.y, 24);
    const alem = limitarTransformacao({ k, x: -99999, y: -99999 }, { conteudo, vista });
    assert.equal(alem.x, 400 - 2000 - 24);
    assert.equal(alem.y, 500 - 600 - 24);
  });

  it("conteúdo menor que a vista fica no meio", () => {
    const t = limitarTransformacao({ k: 1, x: 0, y: 0 }, { conteudo: { w: 100, h: 100 }, vista });
    assert.deepEqual(t, { k: 1, x: 150, y: 200 });
  });

  it("a vista de abertura mostra o conteúdo inteiro, no meio", () => {
    const t = transformacaoInicial({ conteudo, vista });
    assert.ok(Math.abs(t.k - escalaMinima({ conteudo, vista })) < 1e-9);
    assert.ok(conteudo.w * t.k <= vista.w && conteudo.h * t.k <= vista.h, "cabe nas duas direções");
    assert.ok(Math.abs(t.x - (400 - 2000 * t.k) / 2) < 1e-9);
  });

  it("tela cheia: a folga do alto e do pé fica livre ao abrir e ao mover (o título e o menu ficam por cima)", () => {
    const folga = { topo: 80, base: 20 };
    const t = transformacaoInicial({ conteudo: { w: 300, h: 800 }, vista, folga });
    assert.ok(t.y >= 80 + 24 - 1e-9, "o conteúdo começa abaixo do título");
    assert.ok(t.y + 800 * t.k <= 500 - 20 - 24 + 1e-9, "e termina acima do pé");
    assert.ok(Math.abs(t.k - (500 - 100 - 48) / 800) < 1e-9, "a escala usa só a faixa útil");
    const longe = limitarTransformacao({ k: 1, x: 0, y: 5000 }, { conteudo, vista, folga });
    assert.equal(longe.y, 80 + 24);
    const alem = limitarTransformacao({ k: 1, x: 0, y: -99999 }, { conteudo, vista, folga });
    assert.equal(alem.y, 500 - 20 - 600 - 24);
    const pequeno = limitarTransformacao({ k: 1, x: 0, y: 0 }, { conteudo: { w: 100, h: 100 }, vista, folga });
    assert.equal(pequeno.y, 80 + (400 - 100) / 2, "conteúdo pequeno fica no meio da faixa útil");
    assert.deepEqual(limitarTransformacao({ k: 1, x: 0, y: 0 }, { conteudo: { w: 100, h: 100 }, vista, folga: { topo: 0, base: 0 } }), { k: 1, x: 150, y: 200 }, "sem folga, como antes");
  });
});

describe("Mapa: ordem pessoal (lote 6)", () => {
  const ordemDe = (mapa, camada) => mapa.nos.filter((n) => n.faixa === mapa.faixas.findIndex((f) => f.id === camada)).sort((a, b) => a.x - b.x).map((n) => n.chave);

  it("a ordem pessoal vale: os pontos da camada ficam na ordem escolhida, da esquerda para a direita", () => {
    const automatica = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo() });
    const [a, b] = ordemDe(automatica, "programa");
    const invertida = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), ordemPessoal: { programa: [b, a] } });
    assert.deepEqual(ordemDe(invertida, "programa"), [b, a]);
    assert.deepEqual(ordemDe(invertida, "politica"), ordemDe(automatica, "politica"), "as outras camadas não mudam");
  });

  it("ponto que a ordem não conhece (item novo) vai ao fim; chave que não existe mais é ignorada", () => {
    const automatica = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo() });
    const [a, b] = ordemDe(automatica, "programa");
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), ordemPessoal: { programa: ["sumiu", b] } });
    assert.deepEqual(ordemDe(m, "programa"), [b, a]);
  });

  it("sem ordem pessoal, ou com ela vazia, o resultado é o automático (o mesmo para todos)", () => {
    const base = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo() });
    assert.deepEqual(calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), ordemPessoal: {} }).nos, base.nos);
    assert.deepEqual(calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), ordemPessoal: { programa: [] } }).nos, base.nos);
  });

  it("com a ordem pessoal, ainda não há nome nem ponto encostando", () => {
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), ordemPessoal: { politica: ["pol2", "pol1"], programa: ["prg2", "prg1"] } });
    for (const f of m.faixas) {
      const ns = f.nos.map((k) => m.nos.find((n) => n.chave === k)).sort((a, b) => a.x - b.x);
      for (let i = 1; i < ns.length; i++) if (ns[i].nivel === ns[i - 1].nivel) assert.ok(ns[i].x - ns[i - 1].x >= 26 - 1e-9);
    }
  });
});

describe("Mapa: caminho de um ponto (lote 2)", () => {
  const mapa = () => calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), planos: [{ id: "pa1", nome: "Plano", superiores: ["prg2"] }] });

  it("acende o que o ponto vem de até o topo e o que vem dele até os Planos de Ação, por todos os superiores", () => {
    const c = caminhoDoNo(mapa(), "prg2"); // Programa com duas Políticas
    assert.deepEqual([...c.nos].sort(), ["od1", "od2", "oe1", "oe2", "plano:pa1", "pol1", "pol2", "prg2"]);
    assert.ok(c.ligacoes.has("prg2|pol1") && c.ligacoes.has("prg2|pol2") && c.ligacoes.has("plano:pa1|prg2"));
    assert.ok(!c.nos.has("prg1"), "o irmão não acende");
  });

  it("um ponto do topo acende só o que desce dele; chave desconhecida não acende nada", () => {
    const c = caminhoDoNo(mapa(), "oe1");
    assert.deepEqual([...c.nos].sort(), ["od1", "oe1", "plano:pa1", "pol1", "prg1", "prg2"]);
    assert.equal(caminhoDoNo(mapa(), "nada").nos.size, 0);
  });
});

describe("Mapa: cores e contraste (lote 4)", () => {
  it("lê as formas de cor que o navegador devolve", () => {
    assert.deepEqual(lerCor("rgb(10, 20, 30)"), [10, 20, 30]);
    assert.deepEqual(lerCor("rgba(10 20 30 / 0.5)"), [10, 20, 30]);
    assert.deepEqual(lerCor("color(srgb 1 0.5 0)"), [255, 127.5, 0]);
    assert.deepEqual(lerCor("#0000FF"), [0, 0, 255]);
    assert.equal(lerCor("azul"), null);
  });

  it("razão de contraste: preto sobre branco é 21; a mesma cor é 1", () => {
    assert.ok(Math.abs(razaoDeContraste([0, 0, 0], [255, 255, 255]) - 21) < 1e-9);
    assert.equal(razaoDeContraste([90, 90, 90], [90, 90, 90]), 1);
  });

  it("a tinta é a de maior contraste sobre o fundo", () => {
    const [clara, escura] = [[244, 247, 255], [18, 32, 61]];
    assert.equal(melhorTinta([220, 235, 250], clara, escura), "escura");
    assert.equal(melhorTinta([47, 60, 140], clara, escura), "clara");
    assert.equal(melhorTinta([3, 5, 11], clara, escura), "clara");
  });

  it("estrelas: sempre as mesmas, nas faixas de cima e dentro delas", () => {
    const mapa = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo() });
    const a = estrelasDoMapa(mapa);
    assert.deepEqual(a, estrelasDoMapa(mapa), "sem aleatoriedade");
    assert.ok(a.length > 10);
    const limite = mapa.faixas[Math.ceil(mapa.faixas.length / 2) - 1];
    for (const e of a) {
      assert.ok(e.x >= 0 && e.x <= mapa.largura);
      assert.ok(e.y >= mapa.faixas[0].topo + deslocamentoCurvo(e.x, mapa.centro, mapa.raio) - 1);
      assert.ok(e.y <= limite.base + deslocamentoCurvo(e.x, mapa.centro, mapa.raio) + 1);
    }
  });
});

describe("Mapa: mola (lote 5)", () => {
  const simular = (de, alvo, vmax = 10, dt = 1 / 60) => {
    let e = { x: de, v: 0 };
    let passos = 0; let maior = de;
    while (!emRepouso(e, alvo) && passos++ < 600) { e = passoDaMola(e, alvo, dt); maior = Math.max(maior, e.x); }
    return { e, passos, maior };
  };

  it("chega ao alvo em menos de 1,5 s, quase sem passar dele (amortecimento perto do crítico)", () => {
    const r = simular(0, 100);
    assert.ok(r.passos / 60 < 1.5, `${r.passos / 60} s`);
    assert.ok(r.maior < 101.5, `passou até ${r.maior}`);
    assert.ok(Math.abs(r.e.x - 100) < MOLA.repouso);
  });

  it("é determinística: a mesma partida dá o mesmo caminho; parado no alvo, fica parado", () => {
    assert.deepEqual(simular(5, 80), simular(5, 80));
    assert.deepEqual(passoDaMola({ x: 7, v: 0 }, 7, 1 / 60), { x: 7, v: 0 });
    assert.ok(emRepouso({ x: 7, v: 0 }, 7));
  });

  it("anda também para trás (do alto para o baixo, da direita para a esquerda)", () => {
    const r = simular(300, 20);
    assert.ok(Math.abs(r.e.x - 20) < MOLA.repouso);
  });
});

describe("Mapa: céu e solo da tela cheia", () => {
  const mapa = { largura: 400, centro: 200, raio: 1600, faixas: [{ topo: 0, base: 60 }, { topo: 60, base: 140 }] };
  const numeros = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);

  /** pontos de um caminho feito de M, Q e L: as pontas de cada parte e os pontos de controle */
  const partes = (d) => [...d.matchAll(/([MQL])([^MQLZ]+)/g)].map(([, letra, resto]) => [letra, resto.trim().split(/\s+/).map(Number)]);
  const naCurva = (x, y, base) => Math.abs(y - (base + deslocamentoCurvo(x, 200, 1600))) < 0.11;

  it("a faixa estendida segue a mesma curva, em partes exatas, de −além a largura + além", () => {
    const p = partes(caminhoAlem(mapa.faixas[0], mapa, 300));
    assert.deepEqual(p[0], ["M", [-300, Math.round(deslocamentoCurvo(-300, 200, 1600) * 10) / 10]]);
    const qs = p.filter(([l]) => l === "Q");
    assert.ok(qs.length >= 8, "várias partes, para não sair facetada");
    for (const [, [cx, cy, x, y]] of qs) {
      assert.ok(naCurva(x, y, 0) || naCurva(x, y, 60), `ponta (${x}, ${y}) sobre a curva do topo ou da base`);
      assert.ok(Number.isFinite(cx) && Number.isFinite(cy));
    }
    const xs = qs.map(([, v]) => v[2]);
    assert.equal(Math.max(...xs), 700); assert.equal(Math.min(...xs), -300);
    /* a parte do meio da curva, avaliada na Bézier, cai sobre a parábola (exata, sem facetas) */
    const [, [cx, cy, x1, y1]] = qs[3];
    const [, ant] = qs[2];
    const [x0, y0] = [ant[2], ant[3]];
    const meio = { x: 0.25 * x0 + 0.5 * cx + 0.25 * x1, y: 0.25 * y0 + 0.5 * cy + 0.25 * y1 };
    assert.ok(naCurva(meio.x, meio.y, 0), "o meio de cada parte também está na curva");
  });

  it("a linha do solo é a borda de baixo da última faixa", () => {
    const p = partes(linhaDoSolo(mapa, 0));
    assert.equal(p[0][0], "M");
    assert.deepEqual(p[0][1], [0, Math.round((140 + deslocamentoCurvo(0, 200, 1600)) * 10) / 10]);
    for (const [l, v] of p.slice(1)) { assert.equal(l, "Q"); assert.ok(naCurva(v[2], v[3], 140)); }
  });

  it("as estrelas do céu ficam acima da faixa mais alta, sempre nos mesmos lugares", () => {
    const a = estrelasDoCeu(mapa, { alem: 200, altura: 300 });
    assert.ok(a.length > 50);
    assert.deepEqual(estrelasDoCeu(mapa, { alem: 200, altura: 300 }), a, "determinístico");
    for (const e of a) {
      assert.ok(e.y < deslocamentoCurvo(e.x, 200, 1600), "acima da curva do topo");
      assert.ok(e.x >= -200 && e.x <= 600);
    }
  });
});

describe("Mapa: física, vizinhos que reagem e inércia (lote 5)", () => {
  const mapa = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo(), vista: { w: 1000, h: 600 } });
  const prg = mapa.nos.find((n) => n.tipo === "item" && n.superiores.length === 2) ?? mapa.nos.find((n) => n.superiores.length);

  it("os ligados por 'vem de' acompanham uma fração do puxão; o próprio ponto não entra", () => {
    const p = puxaoDosVizinhos(mapa, prg.chave, 100, 20);
    assert.ok(!p.has(prg.chave));
    for (const sup of prg.superiores) assert.deepEqual(p.get(sup), { dx: 100 * PUXAO.ligados, dy: 20 * PUXAO.ligadosNaAltura });
  });

  it("os da mesma faixa perto da posição de agora abrem espaço, para o lado de onde estão, mais quanto mais perto", () => {
    const faixa = mapa.faixas[prg.faixa];
    const outro = mapa.nos.find((n) => n.faixa === prg.faixa && n.chave !== prg.chave && !prg.superiores.includes(n.chave));
    const dx = outro.x - prg.x - 10; // passa a 10 do outro, pela esquerda dele
    const p = puxaoDosVizinhos(mapa, prg.chave, dx, 0);
    assert.ok(faixa.nos.includes(outro.chave));
    assert.ok(Math.abs(p.get(outro.chave).dx - (PUXAO.raio - 10) * PUXAO.abrir) < 1e-9);
    assert.ok(p.get(outro.chave).dx > 0, "abre para a direita, o lado em que está");
    const longe = puxaoDosVizinhos(mapa, prg.chave, outro.x - prg.x - 200, 0);
    assert.ok(!longe.has(outro.chave), "a mais de um raio, não se mexe");
  });

  it("sem puxão, ninguém se mexe; um ponto que não existe, nada", () => {
    for (const d of puxaoDosVizinhos(mapa, prg.chave, 0, 0).values()) assert.equal(d.dx, 0);
    assert.equal(puxaoDosVizinhos(mapa, "nao-existe", 50, 0).size, 0);
  });

  it("o ponto puxado cede na altura só uma fração e não sai da faixa", () => {
    const f = mapa.faixas[prg.faixa];
    assert.ok(Math.abs(alturaPuxada(prg, f, prg.yCurvo + 20) - 20 * PUXAO.folgaNaAltura) < 1e-9);
    assert.equal(alturaPuxada(prg, f, prg.yCurvo + 5000), f.altura / 2 - 8);
    assert.equal(alturaPuxada(prg, f, prg.yCurvo - 5000), -(f.altura / 2 - 8));
  });

  it("inércia: a velocidade decai exponencialmente, o deslocamento é a integral exata, e para abaixo do mínimo", () => {
    let v = { vx: 1000, vy: 0 };
    let total = 0;
    for (let i = 0; i < 200; i++) { const r = passoDaInercia(v, 1 / 60); total += r.dx; v = r; if (r.parou) break; }
    assert.ok(Math.abs(total - (1000 - v.vx) * INERCIA.tempo) < 1e-6, "soma dos passos = v0 × tempo, menos o que sobrou");
    assert.ok(Math.hypot(v.vx, v.vy) < INERCIA.minima);
    const meio = passoDaInercia({ vx: 1000, vy: 0 }, INERCIA.tempo * Math.LN2);
    assert.ok(Math.abs(meio.vx - 500) < 1e-9, "meia-vida de tempo × ln 2");
  });

  it("velocidade de saída: abaixo da partida, sem inércia; acima do máximo, limitada", () => {
    assert.equal(velocidadeDeSaida({ vx: 50, vy: 50 }), null);
    assert.equal(velocidadeDeSaida({ vx: NaN, vy: 0 }), null);
    const r = velocidadeDeSaida({ vx: 30000, vy: 40000 });
    assert.ok(Math.abs(Math.hypot(r.vx, r.vy) - INERCIA.maxima) < 1e-6);
    assert.deepEqual(velocidadeDeSaida({ vx: 300, vy: 0 }), { vx: 300, vy: 0 });
  });
});

