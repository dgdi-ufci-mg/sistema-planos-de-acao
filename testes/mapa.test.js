/** Mapa do Strata: faixas, ordem, posição, curvatura e limites do movimento (documentação técnica, seção 8, "Mapa"). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CAMADAS_PADRAO } from "../js/estrategia.js";
import {
  FAIXA_PLANOS, faixasDoMapa, calcularMapa, rotuloDoPonto, deslocamentoCurvo, caminhoDaFaixa, caminhoDaLigacao,
  escalaMinima, limitarTransformacao, transformacaoInicial,
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

  it("nenhum nome encosta noutro, nenhum ponto sai das pontas e a largura cresce com os itens", () => {
    const muitos = Array.from({ length: 30 }, (_, i) => item(`p${i}`, "programa", `Programa de nome comprido número ${i}`, [], `PRG${i}`));
    const pequeno = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo() });
    const grande = calcularMapa({ camadas: CAMADAS_PADRAO, itens: [...catalogo(), ...muitos] });
    assert.ok(grande.largura > pequeno.largura);
    for (const m of [pequeno, grande]) {
      for (const f of m.faixas) {
        const nos = f.nos.map((k) => m.nos.find((n) => n.chave === k));
        nos.forEach((n, i) => {
          assert.ok(n.x - n.largura / 2 >= 0 && n.x + n.largura / 2 <= m.largura, `${n.chave} dentro da largura`);
          if (i) assert.ok(n.x - nos[i - 1].x >= (n.largura + nos[i - 1].largura) / 2, `${n.chave} não encosta no vizinho`);
        });
      }
    }
  });

  it("usa a largura medida do nome, e não um número por letra", () => {
    const itens = [item("a", "objetivoEstrategico", "Aa", [], ""), item("b", "objetivoEstrategico", "Bb", [], "")];
    const estreito = calcularMapa({ camadas: CAMADAS_PADRAO, itens, medir: () => 30, larguraMinima: 100 });
    const largo = calcularMapa({ camadas: CAMADAS_PADRAO, itens, medir: () => 400, larguraMinima: 100 });
    const dist = (m) => Math.abs(m.nos[1].x - m.nos[0].x);
    assert.ok(dist(largo) >= 400 + 18);
    assert.ok(dist(estreito) < dist(largo));
  });

  it("a curva é (x − centro)² ÷ (2R): zero no centro, para baixo nas pontas, igual para ponto e faixa", () => {
    assert.equal(deslocamentoCurvo(500, 500, 3000), 0);
    assert.equal(deslocamentoCurvo(0, 500, 3000), 250000 / 6000);
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo() });
    for (const n of m.nos) {
      const f = m.faixas[n.faixa];
      const sag = deslocamentoCurvo(n.x, m.centro, m.raio);
      assert.ok(n.yCurvo - sag > f.topo && n.yCurvo - sag < f.base, `${n.chave} dentro da faixa, sem a curva`);
      assert.ok(Math.abs(n.yCurvo - (n.y + sag)) < 0.1);
    }
    assert.equal(m.altura, Math.ceil(m.faixas.length * m.alturaFaixa + deslocamentoCurvo(0, m.centro, m.raio)));
  });

  it("o contorno da faixa é uma curva fechada, e a ligação sai e chega na vertical", () => {
    const m = calcularMapa({ camadas: CAMADAS_PADRAO, itens: catalogo() });
    const d = caminhoDaFaixa(m.faixas[0], m);
    assert.match(d, /^M0 [\d.]+ Q[\d.]+ [-\d.]+ [\d.]+ [\d.]+ L[\d.]+ [\d.]+ Q[\d.]+ [-\d.]+ 0 [\d.]+ Z$/);
    const [filho, superior] = [m.nos.find((n) => n.id === "od1"), m.nos.find((n) => n.id === "oe1")];
    const l = caminhoDaLigacao(filho, superior);
    assert.ok(l.startsWith(`M${filho.x} ${filho.yCurvo} C${filho.x} `));
    assert.ok(l.endsWith(`${superior.x} ${superior.yCurvo}`));
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

  it("a vista de abertura cabe na altura e fica no meio", () => {
    const t = transformacaoInicial({ conteudo, vista });
    assert.ok(Math.abs(t.k - (500 - 48) / 600) < 1e-9);
    assert.ok(Math.abs(t.x - (400 - 2000 * t.k) / 2) < 1e-9);
  });
});
