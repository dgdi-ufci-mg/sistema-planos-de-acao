/** Filtros do Mapa do Strata: camadas, vigência, ligações por itens escondidos e alerta (documentação técnica, seção 8, "Mapa", "Filtros"). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CAMADAS_PADRAO } from "../js/estrategia.js";
import { calcularMapa, FAIXA_PLANOS } from "../js/mapa.js";
import {
  FILTRO_PADRAO, filtrarParaOMapa, fraseDoAlerta, mudancasDoFiltro, normalizarFiltro, vigenciaDoItem, vigenciaDoPlano,
} from "../js/filtro-do-mapa.js";

const HOJE = "2026-10-30";
const instrumentos = [
  { id: "pei", nome: "PEI", inicio: "2021-01-01", fim: "2030-12-31" },
  { id: "pdiVelho", nome: "PDI antigo", inicio: "2019-01-01", fim: "2025-12-31" },
  { id: "pdiNovo", nome: "PDI novo", inicio: "2029-01-01", fim: "2033-12-31" },
];
const item = (id, camada, superiores = [], instrumento = null, codigo = id.toUpperCase()) => ({ id, camada, codigo, nome: `Nome ${id}`, instrumento, superiores });
const catalogo = () => [
  item("oe1", "objetivoEstrategico", [], "pei"),
  item("od1", "objetivoDesenvolvimento", ["oe1"], "pei"),
  item("odVelho", "objetivoDesenvolvimento", ["oe1"], "pdiVelho"),
  item("odNovo", "objetivoDesenvolvimento", ["oe1"], "pdiNovo"),
  item("pol1", "politica", ["od1"]),
  item("pol2", "politica", ["odVelho"]),
  item("pol3", "politica", ["odNovo"]),
  item("prg1", "programa", ["pol1", "pol2"]),
  item("prg2", "programa", ["pol3"]),
];
const planos = () => [
  { id: "p1", nome: "Plano 1", superiores: ["prg1"] },
  { id: "p2", nome: "Plano 2", superiores: ["prg2"], encerradoEm: "2026-05-01" },
];
const filtrar = (filtro, extra = {}) => filtrarParaOMapa({ camadas: CAMADAS_PADRAO, instrumentos, itens: catalogo(), planos: planos(), hoje: HOJE, filtro, ...extra });
const ids = (r) => [...r.itens.map((x) => x.id), ...r.planos.map((x) => `plano:${x.id}`)].sort();
const porId = (r, id) => [...r.itens, ...r.planos].find((x) => x.id === id);

describe("Filtros do Mapa: vigência de cada ponto", () => {
  it("o item vale pelo instrumento: vigente, encerrado ou ainda não começou; sem instrumento, sempre vigente", () => {
    assert.equal(vigenciaDoItem(item("a", "x", [], "pei"), instrumentos, HOJE), "vigente");
    assert.equal(vigenciaDoItem(item("a", "x", [], "pdiVelho"), instrumentos, HOJE), "encerrado");
    assert.equal(vigenciaDoItem(item("a", "x", [], "pdiNovo"), instrumentos, HOJE), "futuro");
    assert.equal(vigenciaDoItem(item("a", "x"), instrumentos, HOJE), "vigente");
    assert.equal(vigenciaDoItem(item("a", "x", [], "sumiu"), instrumentos, HOJE), "encerrado", "instrumento que não existe mais: fora da vigência");
  });
  it("o Plano de Ação está encerrado só com encerradoEm", () => {
    assert.equal(vigenciaDoPlano({ id: "p" }), "vigente");
    assert.equal(vigenciaDoPlano({ id: "p", encerradoEm: "2026-01-01" }), "encerrado");
  });
});

describe("Filtros do Mapa: o filtro guardado", () => {
  it("padrão: todas as camadas, só o que vale hoje; valores estranhos voltam ao padrão", () => {
    assert.deepEqual(normalizarFiltro(null), { ocultas: [], vigencias: { vigentes: true, encerrados: false, futuros: false } });
    assert.deepEqual(normalizarFiltro({ ocultas: ["politica", 3, "politica"], vigencias: { encerrados: true, futuros: "sim" } }),
      { ocultas: ["politica"], vigencias: { vigentes: true, encerrados: true, futuros: false } });
  });
  it("conta as mudanças em relação ao padrão, só das camadas que existem", () => {
    assert.equal(mudancasDoFiltro(FILTRO_PADRAO), 0);
    assert.equal(mudancasDoFiltro({ ocultas: ["politica", "apagada"], vigencias: { vigentes: true, encerrados: true, futuros: false } }, ["politica", "programa"]), 2);
  });
});

describe("Filtros do Mapa: vigência", () => {
  it("padrão: some o que não vale e não tem nada vigente abaixo; o Plano de Ação encerrado some", () => {
    const r = filtrar(FILTRO_PADRAO);
    assert.ok(!ids(r).includes("plano:p2"), "plano encerrado fora do padrão");
    const semNada = filtrar(FILTRO_PADRAO, { itens: [...catalogo(), item("odSo", "objetivoDesenvolvimento", ["oe1"], "pdiVelho")] });
    assert.ok(!ids(semNada).includes("odSo"), "encerrado sem nada abaixo some");
  });

  it("encerrado com descendente vigente aparece apagado, com a frase; o caminho não mente", () => {
    const r = filtrar(FILTRO_PADRAO);
    const velho = porId(r, "odVelho");
    assert.ok(velho, "o OD do PDI encerrado continua, porque prg1 e o Plano 1 são vigentes e estão abaixo dele");
    assert.equal(velho.esmaecido, true);
    assert.equal(velho.alerta, "Encerrado em 31/12/2025, mas ainda tem 1 Plano de Ação e 2 itens vigentes ligados a ele.");
    assert.deepEqual(porId(r, "pol2").via, { odVelho: [] }, "ligação direta ao item apagado");
  });

  it("com Encerrados marcado, o item encerrado aparece normal, mas o alerta continua", () => {
    const r = filtrar({ ocultas: [], vigencias: { vigentes: true, encerrados: true, futuros: false } });
    const velho = porId(r, "odVelho");
    assert.equal(velho.esmaecido, false);
    assert.match(velho.alerta, /^Encerrado em 31\/12\/2025/);
    assert.ok(ids(r).includes("plano:p2"));
  });

  it("sem Vigentes marcado, nada é mantido apagado: só o que está marcado", () => {
    const r = filtrar({ ocultas: [], vigencias: { vigentes: false, encerrados: true, futuros: false } });
    assert.deepEqual(ids(r), ["odVelho", "plano:p2"]);
    assert.ok(r.itens.every((x) => !x.esmaecido));
  });

  it("frase de quem ainda não começou e de quem perdeu o instrumento", () => {
    assert.equal(fraseDoAlerta("futuro", instrumentos[2], { itens: 0, planos: 2 }), "Começa em 01/01/2029, mas já tem 2 Planos de Ação vigentes ligados a ele.");
    assert.equal(fraseDoAlerta("encerrado", null, { itens: 1, planos: 0 }), "Fora da vigência, mas ainda tem 1 item vigente ligado a ele.");
  });
});

describe("Filtros do Mapa: camadas escondidas e ligações indiretas", () => {
  it("esconder Políticas liga os Programas aos Objetivos de Desenvolvimento, guardando quem ficou escondido", () => {
    const r = filtrar({ ocultas: ["politica"], vigencias: FILTRO_PADRAO.vigencias });
    assert.ok(!r.camadas.some((c) => c.id === "politica"));
    assert.ok(!r.itens.some((x) => x.camada === "politica"));
    assert.deepEqual(porId(r, "prg1").via, { od1: ["POL1 · Nome pol1"], odVelho: ["POL2 · Nome pol2"] });
  });

  it("várias camadas escondidas seguidas: sobe até o primeiro visível", () => {
    const r = filtrar({ ocultas: ["objetivoDesenvolvimento", "politica", "programa"], vigencias: FILTRO_PADRAO.vigencias });
    assert.deepEqual(porId(r, "p1").via, { oe1: ["PRG1 · Nome prg1", "POL1 · Nome pol1", "OD1 · Nome od1"] });
  });

  it("dois caminhos escondidos até o mesmo ponto dão uma linha só; a direta vence a indireta", () => {
    const itens = [
      item("oe1", "objetivoEstrategico"),
      item("od1", "objetivoDesenvolvimento", ["oe1"]),
      item("od2", "objetivoDesenvolvimento", ["oe1"]),
      item("pol1", "politica", ["od1", "od2", "oe1"].filter((x) => x !== "oe1")),
      item("prg1", "programa", ["pol1"]),
    ];
    const r = filtrarParaOMapa({ camadas: CAMADAS_PADRAO, instrumentos, itens, hoje: HOJE, filtro: { ocultas: ["objetivoDesenvolvimento"] } });
    assert.deepEqual(Object.keys(porId(r, "pol1").via), ["oe1"], "dois caminhos (od1 e od2), uma linha");
    const mapa = calcularMapa({ camadas: r.camadas, itens: r.itens, planos: r.planos });
    assert.equal(mapa.ligacoes.filter((l) => l.de === "pol1").length, 1);
    const direta = filtrarParaOMapa({ camadas: CAMADAS_PADRAO, instrumentos, itens: [item("oe1", "objetivoEstrategico"), item("od1", "objetivoDesenvolvimento", ["oe1"]), item("pol1", "politica", ["od1", "oe1"])], hoje: HOJE });
    assert.deepEqual(porId(direta, "pol1").via, { od1: [], oe1: [] }, "sem nada escondido, as duas são diretas");
    const so = filtrarParaOMapa({ camadas: CAMADAS_PADRAO, instrumentos, itens: [item("oe1", "objetivoEstrategico"), item("od1", "objetivoDesenvolvimento", ["oe1"]), item("pol1", "politica", ["od1", "oe1"])], hoje: HOJE, filtro: { ocultas: ["objetivoDesenvolvimento"] } });
    assert.deepEqual(porId(so, "pol1").via, { oe1: [] }, "a direta vence a que passa pelo escondido");
  });

  it("sem nenhum ponto visível acima, o ponto fica solto, mas aparece", () => {
    const r = filtrar({ ocultas: ["objetivoEstrategico", "objetivoDesenvolvimento", "politica", "programa"], vigencias: FILTRO_PADRAO.vigencias });
    assert.deepEqual(ids(r), ["plano:p1"]);
    assert.deepEqual(r.planos[0].superiores, []);
    const mapa = calcularMapa({ camadas: r.camadas, itens: r.itens, planos: r.planos });
    assert.ok(mapa.nos.some((n) => n.chave === "plano:p1"), "o plano com manter aparece sem linha");
    assert.equal(mapa.ligacoes.length, 0);
  });

  it("esconder os Planos de Ação tira a faixa deles", () => {
    const r = filtrar({ ocultas: [FAIXA_PLANOS], vigencias: FILTRO_PADRAO.vigencias });
    assert.equal(r.semPlanos, true);
    assert.equal(r.planos.length, 0);
    const mapa = calcularMapa({ camadas: r.camadas, itens: r.itens, planos: r.planos, semPlanos: r.semPlanos });
    assert.ok(!mapa.faixas.some((f) => f.id === FAIXA_PLANOS));
  });

  it("o item escondido pela vigência também é atravessado, com linha indireta", () => {
    const r = filtrar({ ocultas: [], vigencias: { vigentes: true, encerrados: false, futuros: false } }, {
      planos: [{ id: "p3", nome: "Plano 3", superiores: ["prg2"] }], // prg2 vem de pol3, que vem de odNovo (ainda não começou)
    });
    const mapa = calcularMapa({ camadas: r.camadas, itens: r.itens, planos: r.planos });
    assert.ok(porId(r, "odNovo").esmaecido, "odNovo tem plano vigente abaixo: fica, apagado");
    assert.match(porId(r, "odNovo").alerta, /^Começa em 01\/01\/2029/);
    const l = mapa.ligacoes.find((x) => x.de === "pol3");
    assert.deepEqual({ para: l.para, indireta: l.indireta }, { para: "odNovo", indireta: false });
  });

  it("no mapa, a ligação indireta é marcada e leva os nomes; o ponto leva apagado e alerta", () => {
    const r = filtrar({ ocultas: ["politica"], vigencias: FILTRO_PADRAO.vigencias });
    const mapa = calcularMapa({ camadas: r.camadas, itens: r.itens, planos: r.planos });
    const l = mapa.ligacoes.find((x) => x.de === "prg1" && x.para === "od1");
    assert.deepEqual({ indireta: l.indireta, via: l.via }, { indireta: true, via: ["POL1 · Nome pol1"] });
    const direta = mapa.ligacoes.find((x) => x.de === "plano:p1");
    assert.equal(direta.indireta, false);
    const velho = mapa.nos.find((n) => n.chave === "odVelho");
    assert.equal(velho.esmaecido, true);
    assert.ok(velho.alerta);
  });
});
