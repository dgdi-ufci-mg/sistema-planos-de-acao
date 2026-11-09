/** Testes das ações contínuas (seção 5.9; termo técnico: atividade hammock). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { simular, chaveDaSimulacao } from "../js/simulacao.js";
import { acoesParaCalculo } from "../js/modelos.js";
import { montarLinhas } from "../js/lista.js";
import { problemaDosMarcos, marcosPossiveis, nomeDoMarco, marcosSugeridos, normalizarMarco } from "../js/continuas.js";
import { descreverRegistro } from "../js/historico.js";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";

const cal = criarCalendario({ inicio: "2026-10-05" }); // segunda-feira
const acao = (numero, dias, dependeDe = [], extra = {}) =>
  ({ numero, ordem: numero, rotulo: `A${numero}`, dependeDe, estimativas: [{ o: dias, m: dias, p: dias }], ...extra });
const estrutura = [
  { id: "f1", nome: "Fase 1", etapas: [{ id: "e1", nome: "Etapa 1.1" }, { id: "e2", nome: "Etapa 1.2" }] },
  { id: "f2", nome: "Fase 2", etapas: [{ id: "e3", nome: "Etapa 2.1" }] },
];
const espaco = { estrutura }; // sem `modelo`: cronograma estruturado (estimativas, dependências e simulação)
const P = { tipo: "projeto" };
const E = (id) => ({ tipo: "etapa", id });
const F = (id) => ({ tipo: "fase", id });
const A = (numero) => ({ tipo: "acao", numero });

/*
 * 1 (3 dias, e1) → 2 (2, e1) → 4 (4, e3); 1 → 3 (1, e2) → 4.
 * Liberação e conclusão, em dias úteis: 1: 0–3; 2: 3–5; 3: 3–4; 4: 5–9. Fim do projeto: 9.
 */
const rede = () => [
  acao(1, 3, [], { etapa: "e1" }), acao(2, 2, [1], { etapa: "e1" }),
  acao(3, 1, [1], { etapa: "e2" }), acao(4, 4, [2, 3], { etapa: "e3" }),
];
const continua = (numero, comecaCom, terminaCom, extra = {}) =>
  ({ numero, ordem: numero, rotulo: `C${numero}`, dependeDe: [], estimativas: [], comecaCom, terminaCom, ...extra });
const calcular = (acoes, opcoes = {}) => caminhoCritico(acoes, cal, { estrutura, ...opcoes });

describe("Ação contínua: datas pelos marcos (seção 5.9)", () => {
  it("projeto a projeto: do dia 0 ao fim do projeto, sem mudar o fim", () => {
    const r = calcular([...rede(), continua(9, P, P)]);
    assert.equal(r.fim, 9);
    const c = r.porAcao.get(9);
    assert.deepEqual([c.liberacao, c.conclusao, c.folga, c.critica, c.continua], [0, 9, null, false, true]);
  });

  it("marcos de etapa e de fase: a liberação mais cedo e a conclusão mais tardia das ações comuns", () => {
    const r = calcular([...rede(), continua(9, E("e1"), E("e1")), continua(10, F("f1"), F("f2")), continua(11, E("e2"), E("e3"))]);
    assert.deepEqual([r.porAcao.get(9).liberacao, r.porAcao.get(9).conclusao], [0, 5]);
    assert.deepEqual([r.porAcao.get(10).liberacao, r.porAcao.get(10).conclusao], [0, 9]);
    assert.deepEqual([r.porAcao.get(11).liberacao, r.porAcao.get(11).conclusao], [3, 9]);
  });

  it("marcos de ação: começa na liberação de uma e termina na conclusão de outra (hammock clássico)", () => {
    const r = calcular([...rede(), continua(9, A(2), A(3))]);
    assert.deepEqual([r.porAcao.get(9).liberacao, r.porAcao.get(9).conclusao], [3, 4]);
    const r2 = calcular([...rede(), continua(9, A(3), A(4))]);
    assert.deepEqual([r2.porAcao.get(9).liberacao, r2.porAcao.get(9).conclusao], [3, 9]);
  });

  it("não muda o caminho crítico, a folga nem as datas das ações comuns", () => {
    const sem = calcular(rede());
    const com = calcular([...rede(), continua(9, E("e1"), P), continua(10, A(1), A(4), { etapa: "e1" })]);
    for (const n of [1, 2, 3, 4]) {
      const a = sem.porAcao.get(n), b = com.porAcao.get(n);
      assert.deepEqual([b.liberacao, b.conclusao, b.folga, b.critica], [a.liberacao, a.conclusao, a.folga, a.critica], `ação ${n}`);
    }
  });

  it("a contínua dentro da etapa que acompanha não entra nas datas da etapa", () => {
    const r = calcular([...rede(), continua(9, E("e2"), E("e2"), { etapa: "e2" })]);
    assert.deepEqual([r.porAcao.get(9).liberacao, r.porAcao.get(9).conclusao], [3, 4]);
  });

  it("dependências que apontem para uma contínua são ignoradas, com aviso", () => {
    const acoes = [...rede(), continua(9, P, P), acao(5, 2, [9])];
    const r = calcular(acoes);
    assert.deepEqual([r.porAcao.get(5).liberacao, r.porAcao.get(5).conclusao], [0, 2]);
    assert.ok(r.avisos.some((a) => a.codigo === "dependencia-de-continua" && a.acao === 5 && a.dependeDe === 9));
  });

  it("marco que não existe mais vale o projeto, com aviso; início depois do fim vira duração zero, com aviso", () => {
    const r = calcular([...rede(), continua(9, E("sumiu"), A(77)), continua(10, A(4), A(1))]);
    const c9 = r.porAcao.get(9);
    assert.deepEqual([c9.liberacao, c9.conclusao, c9.marcoInexistente], [0, 9, true]);
    assert.deepEqual(r.avisos.filter((a) => a.codigo === "marco-inexistente").map((a) => a.lado), ["inicio", "fim"]);
    const c10 = r.porAcao.get(10);
    assert.deepEqual([c10.liberacao, c10.conclusao, c10.marcosInvertidos], [5, 5, true]);
  });

  it("outra contínua como marco não vale: vale o projeto, com aviso", () => {
    const r = calcular([...rede(), continua(9, A(2), A(3)), continua(10, A(9), A(9))]);
    assert.deepEqual([r.porAcao.get(10).liberacao, r.porAcao.get(10).conclusao, r.porAcao.get(10).marcoInexistente], [0, 9, true]);
  });

  it("no espaço com data-limite ou sem dependências, os marcos são ignorados", () => {
    const r = calcular([...rede(), continua(9, A(2), A(3))], { dependencias: false });
    assert.equal(r.porAcao.get(9).continua, undefined);
    const r2 = calcular([...rede(), continua(9, A(2), A(3))], { prazos: "dataLimite" });
    assert.equal(r2.porAcao.get(9).continua, undefined);
  });
});

describe("Ação contínua: situação, atraso e encerramento", () => {
  // hoje: 15/10/2026 = índice 8 (dias úteis desde 05/10)
  const hoje = "2026-10-15";
  it("fica liberada quando o marco de início é alcançado; nunca recebe o carimbo Atrasada", () => {
    const acoes = [...rede(), continua(9, A(2), A(4)), continua(10, A(1), A(1))];
    const r = calcular(acoes, { hoje });
    assert.equal(r.porAcao.get(9).situacao, "naoLiberada"); // 2 depende de 1, ainda não concluída
    assert.equal(r.porAcao.get(10).situacao, "liberada");
    assert.equal(r.porAcao.get(10).atrasada, false);
    assert.equal(r.porAcao.get(1).atrasada, true); // o atraso aparece no marco
    /* a contínua se estende com o marco atrasado: a ação 1 passa a terminar amanhã (seção 5.5) */
    assert.equal(r.porAcao.get(10).conclusao, r.porAcao.get(1).conclusao);
  });

  it("\"Pode ser encerrada\" quando o marco de fim está concluído; não se conclui sozinha", () => {
    const acoes = [acao(1, 3, [], { concluidaEm: "2026-10-07" }), acao(2, 5, [1]), continua(9, A(1), A(1))];
    const r = calcular(acoes, { hoje });
    assert.equal(r.porAcao.get(9).situacao, "liberada");
    assert.equal(r.porAcao.get(9).podeEncerrar, true);
    const linhas = montarLinhas(acoes, r, null, cal, hoje, { espaco });
    const l9 = linhas.find((l) => l.acao.numero === 9);
    assert.deepEqual([l9.continua, l9.podeEncerrar, l9.semEstimativa, l9.atrasada], [true, true, false, false]);
  });

  it("concluída: vale a data registrada", () => {
    const acoes = [...rede(), continua(9, P, P, { concluidaEm: "2026-10-09" })];
    const r = calcular(acoes, { hoje });
    assert.deepEqual([r.porAcao.get(9).situacao, r.porAcao.get(9).conclusao, r.porAcao.get(9).podeEncerrar], ["concluida", 5, false]);
  });
});

describe("Ação contínua fora da simulação (versão 2 do cálculo)", () => {
  it("a simulação e a chave dela são as mesmas com e sem as contínuas", () => {
    const op = { hoje: "2026-10-05", semente: 20261014, simulacoes: 500, prazoFinal: "2026-10-20" };
    const base = rede().map((a) => ({ ...a, estimativas: [{ o: 1, m: 3, p: 6 }] }));
    const com = [...base, continua(9, P, P, { estimativas: [{ o: 1, m: 2, p: 9 }] })];
    const s1 = simular(acoesParaCalculo(espaco, base), cal, op);
    const s2 = simular(acoesParaCalculo(espaco, com), cal, op);
    assert.deepEqual([s2.p50, s2.p80, s2.chancePrazo], [s1.p50, s1.p80, s1.chancePrazo]);
    assert.equal(s2.porAcao.has(9), false);
    const k = { ...op, inicio: "2026-10-05", datasExcluidas: [] };
    assert.equal(chaveDaSimulacao(acoesParaCalculo(espaco, com), k), chaveDaSimulacao(acoesParaCalculo(espaco, base), k));
  });
});

describe("Marcos: regras (js/continuas.js)", () => {
  const acoes = [...rede(), continua(9, A(2), A(3))];
  const ok = (a) => problemaDosMarcos(a, acoes, espaco);
  it("aceita os quatro tipos de marco e a ação sem marcos", () => {
    assert.equal(ok({ numero: 5, comecaCom: P, terminaCom: F("f2") }), null);
    assert.equal(ok({ numero: 5, comecaCom: E("e1"), terminaCom: A(4) }), null);
    assert.equal(ok({ numero: 5 }), null);
  });
  it("exige os dois marcos e a forma certa", () => {
    assert.equal(ok({ numero: 5, comecaCom: P }).codigo, "marcos-incompletos");
    assert.equal(ok({ numero: 5, comecaCom: P, terminaCom: { tipo: "etapa" } }).codigo, "marco-invalido");
    assert.equal(ok({ numero: 5, comecaCom: P, terminaCom: { tipo: "projeto", id: "x" } }).codigo, "marco-invalido");
    assert.equal(ok({ numero: 5, comecaCom: E("zz"), terminaCom: P }).codigo, "marco-invalido");
    assert.equal(ok({ numero: 5, comecaCom: A(5), terminaCom: P }).codigo, "marco-invalido");
    assert.equal(ok({ numero: 5, comecaCom: A(99), terminaCom: P }).codigo, "marco-invalido");
  });
  it("uma contínua não é marco de outra, nem vira contínua se outra a usa como marco", () => {
    assert.equal(ok({ numero: 5, comecaCom: A(9), terminaCom: P }).codigo, "marco-continua");
    assert.equal(ok({ ...acoes[1], comecaCom: P, terminaCom: P, dependeDe: [] }).codigo, "continua-com-seguintes");
    const comMarco4 = [...acoes, continua(10, A(4), A(4))];
    assert.equal(problemaDosMarcos({ ...acoes[3], comecaCom: P, terminaCom: P, dependeDe: [] }, comMarco4, espaco).codigo, "marco-continua");
  });
  it("não tem anteriores nem seguintes", () => {
    assert.equal(ok({ numero: 5, comecaCom: P, terminaCom: P, dependeDe: [1] }).codigo, "continua-com-anteriores");
    assert.equal(ok({ ...acoes[0], comecaCom: P, terminaCom: P }).codigo, "continua-com-seguintes");
  });
  it("só no espaço com estimativas e dependências", () => {
    const aberto = { estrutura, modelo: { nome: "aberto", prazos: "dataLimite", dependencias: false, simulacao: false } };
    assert.equal(problemaDosMarcos({ numero: 5, comecaCom: P, terminaCom: P }, acoes, aberto).codigo, "recurso-desligado");
  });
  it("lista os marcos possíveis: projeto, fases, etapas e ações comuns (sem ela mesma)", () => {
    const m = marcosPossiveis(espaco, acoes, 1);
    assert.deepEqual(m.map((x) => x.grupo), ["Projeto", "Fases", "Fases", "Etapas", "Etapas", "Etapas", "Ações", "Ações", "Ações"]);
    assert.ok(!m.some((x) => x.marco.numero === 1 || x.marco.numero === 9));
    assert.equal(m.find((x) => x.marco.id === "e3").nome, "Etapa 2.1 (Fase 2)");
  });
  it("nomes, sugestão e forma gravada", () => {
    assert.equal(nomeDoMarco(E("e1"), "inicio", espaco, acoes), "Início da etapa “Etapa 1.1”");
    assert.equal(nomeDoMarco(A(2), "fim", espaco, acoes), "Fim da ação “A2”");
    assert.equal(nomeDoMarco(F("zz"), "fim", espaco, acoes), "Fim da fase (fase excluída)");
    assert.deepEqual(marcosSugeridos({ etapa: "e2" }, espaco), { comecaCom: E("e2"), terminaCom: E("e2") });
    assert.deepEqual(marcosSugeridos({}, espaco), { comecaCom: P, terminaCom: P });
    assert.deepEqual(normalizarMarco({ tipo: "acao", numero: 3, id: "x" }), A(3));
  });
  it("histórico em palavras", () => {
    const nomes = { acao: (n) => `“A${n}”`, etapa: (id) => id, fase: (id) => id };
    assert.equal(descreverRegistro({ tipo: "alteracao", campo: "comecaCom", antes: null, depois: E("e1") }, nomes), "“Começa com” passou a ser o início da etapa “e1”.");
    assert.equal(descreverRegistro({ tipo: "alteracao", campo: "terminaCom", antes: A(2), depois: null }, nomes), "Retirou “Termina com” (era o fim da ação “A2”).");
  });
});

describe("Store: ações contínuas", () => {
  async function montar() {
    let n = 0;
    const store = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", novoId: () => `id${++n}` });
    const espacoId = await store.criarEspaco({ nome: "Espaço", inicio: "2026-10-05" });
    await store.alterarEspaco(espacoId, { estrutura });
    const a1 = await store.criarAcao(espacoId, { rotulo: "Um", etapa: "e1" });
    const a2 = await store.criarAcao(espacoId, { rotulo: "Dois", etapa: "e1", dependeDe: [a1] });
    return { store, espacoId, a1, a2 };
  }
  it("grava e retira os marcos, com histórico", async () => {
    const { store, espacoId, a1, a2 } = await montar();
    const c = await store.criarAcao(espacoId, { rotulo: "Apoio", comecaCom: E("e1"), terminaCom: A(a2) });
    assert.deepEqual((await store.lerAcao(espacoId, c)).terminaCom, A(a2));
    await store.alterarAcao(espacoId, c, { terminaCom: P });
    await store.alterarAcao(espacoId, c, { comecaCom: null, terminaCom: null });
    const lida = await store.lerAcao(espacoId, c);
    assert.equal(lida.comecaCom ?? null, null);
    assert.ok(a1);
  });
  it("recusa marco incompleto, anteriores e seguintes", async () => {
    const { store, espacoId, a1, a2 } = await montar();
    await assert.rejects(store.criarAcao(espacoId, { rotulo: "X", comecaCom: P }), { codigo: "marcos-incompletos" });
    await assert.rejects(store.alterarAcao(espacoId, a2, { comecaCom: P, terminaCom: P }), { codigo: "continua-com-anteriores" });
    await assert.rejects(store.alterarAcao(espacoId, a1, { comecaCom: P, terminaCom: P }), { codigo: "continua-com-seguintes" });
    const c = await store.criarAcao(espacoId, { rotulo: "Apoio", comecaCom: P, terminaCom: P });
    await assert.rejects(store.acrescentarDependencia(espacoId, c, a1), { codigo: "continua-sem-dependencias" });
    await assert.rejects(store.acrescentarDependencia(espacoId, a1, c), { codigo: "continua-sem-dependencias" });
    await assert.rejects(store.alterarAcao(espacoId, c, { dependeDe: [a1] }), { codigo: "continua-com-anteriores" });
  });
  it("recusa no espaço sem dependências", async () => {
    const store = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br" });
    const espacoId = await store.criarEspaco({ nome: "Aberto", modelo: { nome: "aberto", prazos: "dataLimite", dependencias: false, simulacao: false } });
    await assert.rejects(store.criarAcao(espacoId, { rotulo: "X", comecaCom: P, terminaCom: P }), { codigo: "recurso-desligado" });
  });
});
