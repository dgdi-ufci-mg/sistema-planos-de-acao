/** Modelos de configuração do espaço e prazos por data-limite (passo 2.4b). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { montarLinhas } from "../js/lista.js";
import { montarRetrato } from "../js/retrato.js";
import { MODELOS, modeloDe, montarModelo, problemaDoModelo, usaSimulacao, usaDataLimite } from "../js/modelos.js";

const storeDeTeste = () => {
  let n = 0;
  return criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", novoId: () => `id${++n}`, hoje: () => "2026-11-10" });
};

describe("Modelos: regras", () => {
  it("três modelos, e o espaço sem modelo vale como estruturado", () => {
    assert.deepEqual(Object.keys(MODELOS), ["estruturado", "aberto", "personalizado"]);
    assert.deepEqual(modeloDe({}), { nome: "estruturado", prazos: "estimativa", dependencias: true, simulacao: true });
    assert.equal(usaSimulacao({}), true);
  });

  it("monta os modelos prontos e o personalizado; data-limite nunca tem simulação", () => {
    assert.deepEqual(montarModelo("aberto"), { nome: "aberto", prazos: "dataLimite", dependencias: false, simulacao: false });
    assert.deepEqual(montarModelo("personalizado", { prazos: "dataLimite", dependencias: true, simulacao: true }),
      { nome: "personalizado", prazos: "dataLimite", dependencias: true, simulacao: false });
    assert.deepEqual(montarModelo("personalizado", { prazos: "estimativa", dependencias: false, simulacao: true }),
      { nome: "personalizado", prazos: "estimativa", dependencias: false, simulacao: true });
  });

  it("recusa modelo incoerente", () => {
    assert.equal(problemaDoModelo(null), null);
    assert.equal(problemaDoModelo(montarModelo("aberto")), null);
    assert.equal(problemaDoModelo({ nome: "aberto", prazos: "estimativa", dependencias: false, simulacao: false }).codigo, "modelo-invalido");
    assert.equal(problemaDoModelo({ nome: "personalizado", prazos: "dataLimite", dependencias: true, simulacao: true }).codigo, "modelo-invalido");
    assert.equal(problemaDoModelo({ nome: "personalizado", prazos: "ambos", dependencias: true, simulacao: false }).codigo, "modelo-invalido");
    assert.equal(problemaDoModelo({ nome: "outro", prazos: "estimativa", dependencias: true, simulacao: true }).codigo, "modelo-invalido");
  });
});

describe("Cálculo com prazos por data-limite", () => {
  const cal = criarCalendario({ inicio: "2026-11-02" }, "2026-11-10");
  const acoes = [
    { numero: 1, ordem: 1, dependeDe: [], estimativas: [], dataLimite: "2026-11-06" }, // vencida
    { numero: 2, ordem: 2, dependeDe: [1], estimativas: [], dataLimite: "2026-11-20" }, // não liberada, no prazo
    { numero: 3, ordem: 3, dependeDe: [1], estimativas: [], dataLimite: "2026-11-05" }, // não liberada e vencida
    { numero: 4, ordem: 4, dependeDe: [], estimativas: [], dataLimite: "2026-11-04", concluidaEm: "2026-11-09" }, // concluída depois do prazo
    { numero: 5, ordem: 5, dependeDe: [], estimativas: [] }, // sem prazo
  ];

  it("Atrasada = data-limite vencida e ação não concluída, liberada ou não; sem caminho crítico", () => {
    const c = caminhoCritico(acoes, cal, { hoje: "2026-11-10", prazos: "dataLimite", dependencias: true });
    const r = (n) => c.porAcao.get(n);
    assert.deepEqual([1, 2, 3, 4, 5].map((n) => r(n).situacao), ["liberada", "naoLiberada", "naoLiberada", "concluida", "liberada"]);
    assert.deepEqual([1, 2, 3, 4, 5].map((n) => r(n).atrasada), [true, false, true, false, false]);
    assert.equal(r(1).vencidaEm, "2026-11-06");
    assert.ok([1, 2, 3, 4, 5].every((n) => r(n).critica === false && r(n).folga === null));
  });

  it("sem dependências, as anteriores gravadas são ignoradas", () => {
    const c = caminhoCritico(acoes, cal, { hoje: "2026-11-10", prazos: "dataLimite", dependencias: false });
    assert.equal(c.porAcao.get(2).situacao, "liberada");
  });

  it("na lista, a conclusão é a data-limite, sem 'Falta estimar' e sem prioridades", () => {
    const c = caminhoCritico(acoes, cal, { hoje: "2026-11-10", prazos: "dataLimite" });
    const linhas = montarLinhas(acoes, c, null, cal, "2026-11-10", { prazos: "dataLimite" });
    assert.deepEqual(linhas.map((l) => l.conclusao), ["2026-11-06", "2026-11-20", "2026-11-05", "2026-11-09", null]);
    assert.ok(linhas.every((l) => !l.semEstimativa && l.execucao === null && l.revisao === null));
  });

  it("o retrato do espaço sem simulação fica sem chance nem datas estatísticas", () => {
    const espaco = { id: "e", nome: "Aberto", inicio: "2026-11-02", semente: 1, simulacoes: 100, modelo: montarModelo("aberto") };
    const { cabecalho, acoes: registros } = montarRetrato({ espaco, acoes, responsaveis: [], geral: {}, hoje: "2026-11-10" });
    assert.deepEqual(cabecalho.resumo, { conclusaoPrevista: null, dataSegura: null, p95: null, chancePrazo: null });
    assert.equal(registros[0].conclusaoPrevista, "2026-11-06");
    assert.equal(registros[0].prioridadeExecucao, null);
  });
});

describe("Modelos: Store", () => {
  it("grava o modelo na criação e não deixa mudar depois", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: "Aberto", modelo: montarModelo("aberto") });
    assert.equal(usaDataLimite(await store.lerEspaco(id)), true);
    await assert.rejects(store.alterarEspaco(id, { modelo: montarModelo("estruturado") }), { codigo: "campo-fixo" });
  });

  it("no espaço com data-limite, recusa estimativas e dependências e aceita a data-limite", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: "Aberto", modelo: montarModelo("aberto") });
    const n = await store.criarAcao(id, { rotulo: "Migrar servidor", dataLimite: "2026-11-30" });
    const outra = await store.criarAcao(id, { rotulo: "Testar" });
    assert.equal((await store.lerAcao(id, n)).dataLimite, "2026-11-30");
    await assert.rejects(store.corrigirEstimativa(id, n, { o: 1, m: 2, p: 3 }), { codigo: "recurso-desligado" });
    await assert.rejects(store.criarAcao(id, { rotulo: "X", estimativas: [{ o: 1, m: 2, p: 3 }] }), { codigo: "recurso-desligado" });
    await assert.rejects(store.acrescentarDependencia(id, outra, n), { codigo: "recurso-desligado" });
    await assert.rejects(store.alterarAcao(id, n, { dataLimite: "30/11/2026" }), { codigo: "data-invalida" });
    await store.alterarAcao(id, n, { dataLimite: null }); // apagar a data-limite é permitido
    assert.equal((await store.lerAcao(id, n)).dataLimite, null);
  });

  it("no espaço com estimativas (inclusive o antigo, sem modelo), recusa a data-limite", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: "PI²" });
    const n = await store.criarAcao(id, { rotulo: "Levantar" });
    await assert.rejects(store.alterarAcao(id, n, { dataLimite: "2026-11-30" }), { codigo: "recurso-desligado" });
    await store.corrigirEstimativa(id, n, { o: 1, m: 2, p: 3 });
  });

  it("recusa modelo incoerente na criação", async () => {
    const store = storeDeTeste();
    await assert.rejects(store.criarEspaco({ nome: "X", modelo: { nome: "aberto", prazos: "estimativa", dependencias: false, simulacao: false } }), { codigo: "modelo-invalido" });
  });
});

describe("Modelos: importação e exportação", async () => {
  const { planejarImportacao } = await import("../js/importar.js");
  const { planilhaDoEspaco } = await import("../js/exportar.js");
  const aberto = { id: "e", nome: "Aberto", inicio: "2026-11-02", modelo: montarModelo("aberto") };

  it("no espaço aberto, importa a data-limite e deixa de fora estimativa e dependências, com aviso", () => {
    const texto = "Ação\tData-limite\tOtimista\tMais provável\tPessimista\tDepende de\nPublicar\t30/11/2026\t1\t2\t3\t\nRevisar\t\t\t\t\tPublicar";
    const plano = planejarImportacao({ texto, espaco: aberto, acoes: [], responsaveis: [], hoje: "2026-11-10", situacaoDe: () => "liberada", modo: "criar" });
    const [a, b] = plano.linhas;
    assert.equal(a.campos.dataLimite, "2026-11-30");
    assert.equal(a.campos.estimativa, undefined);
    assert.ok(a.avisos.some((x) => x.includes("estimativa fica de fora")));
    assert.ok(b.avisos.some((x) => x.includes("Depende de fica de fora")));
  });

  it("no espaço estruturado, a coluna Data-limite fica de fora, com aviso", () => {
    const plano = planejarImportacao({ texto: "Ação\tData-limite\nX\t30/11/2026", espaco: { nome: "E" }, acoes: [], responsaveis: [], hoje: "2026-11-10", situacaoDe: () => "liberada", modo: "criar" });
    assert.equal(plano.linhas[0].campos.dataLimite, undefined);
    assert.ok(plano.linhas[0].avisos.some((x) => x.includes("Data-limite fica de fora")));
  });

  it("a planilha exportada do espaço aberto tem Data-limite e não tem estimativas, dependências nem folga", () => {
    const acoes = [{ numero: 1, ordem: 1, rotulo: "Publicar", dependeDe: [], responsaveis: [], estimativas: [], dataLimite: "2026-11-30" }];
    const [titulos, linha] = planilhaDoEspaco({ espaco: aberto, acoes, responsaveis: [], geral: {}, hoje: "2026-11-10" }).split("\n").map((l) => l.split("\t"));
    assert.deepEqual(titulos, ["Número", "Ação", "Descrição", "Data-limite", "Responsáveis", "Prioridade da equipe", "Situação", "Atrasada"]); // a prioridade da equipe vem ligada por padrão (29/10/2026)
    assert.equal(linha[3], "30/11/2026");
  });
});
