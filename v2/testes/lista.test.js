/** Testes da lista de ações (js/lista.js), com o espaço de exemplo em 20/10/2026. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { simular } from "../js/simulacao.js";
import { montarLinhas, contar, filtrar, ordenar, agrupar, resumir } from "../js/lista.js";

describe("Lista de ações", async () => {
  const hoje = "2026-10-20";
  const store = criarStore(criarBancoLocal());
  const id = await carregarExemplo(store, new Date(`${hoje}T12:00:00Z`));
  const espaco = await store.lerEspaco(id);
  const acoes = await store.listarAcoes(id);
  const cal = criarCalendario(espaco, hoje);
  const caminho = caminhoCritico(acoes, cal, { hoje });
  const sim = simular(acoes, cal, { hoje, semente: espaco.semente, simulacoes: 2000, prazoFinal: espaco.prazoFinal });
  const linhas = montarLinhas(acoes, caminho, sim, cal, hoje);
  const numeros = (ls) => ls.map((l) => l.acao.numero);

  it("conta as situações e o carimbo como no resumo do exemplo", () => {
    assert.deepEqual(contar(linhas), { todas: 12, liberada: 4, atrasada: 1, naoLiberada: 6, concluida: 2 });
  });

  it("ação concluída mostra a data registrada e não tem barras", () => {
    const l = linhas.find((x) => x.situacao === "concluida");
    assert.equal(l.conclusao, l.acao.concluidaEm);
    assert.equal(l.execucao, null);
    assert.equal(l.revisao, null);
  });

  it("ação atrasada termina, no mínimo, amanhã (regra do prazo vencido)", () => {
    const l = linhas.find((x) => x.atrasada);
    assert.ok(l.conclusao >= hoje);
  });

  it("filtra por situação, carimbo e responsável", () => {
    assert.equal(filtrar(linhas, { situacao: "atrasada" }).length, 1);
    assert.ok(filtrar(linhas, { situacao: "liberada" }).every((l) => l.situacao === "liberada"));
    const pessoa = acoes[0].responsaveis[0];
    const dela = filtrar(linhas, { responsavel: pessoa });
    assert.ok(dela.length > 0 && dela.every((l) => l.acao.responsaveis.includes(pessoa)));
  });

  it("\"Minhas ações\" mostra as ações de qualquer responsável ligado ao usuário", () => {
    const ids = [acoes[0].responsaveis[0]];
    assert.deepEqual(numeros(filtrar(linhas, { minhas: ids })), numeros(filtrar(linhas, { responsavel: ids[0] })));
    assert.equal(filtrar(linhas, { minhas: [] }).length, 0);
  });

  it("ordena por prioridade (concluídas no fim) e por conclusão prevista, sem mexer na lista original", () => {
    const antes = numeros(linhas);
    const porExecucao = ordenar(linhas, "execucao");
    for (let i = 1; i < porExecucao.length; i++) assert.ok((porExecucao[i - 1].execucao ?? -1) >= (porExecucao[i].execucao ?? -1));
    assert.equal(porExecucao.at(-1).situacao, "concluida");
    const porData = ordenar(linhas, "conclusao");
    for (let i = 1; i < porData.length; i++) assert.ok(porData[i - 1].conclusao <= porData[i].conclusao);
    assert.deepEqual(numeros(ordenar(linhas, "espaco")), antes);
    assert.deepEqual(numeros(linhas), antes);
  });

  it("agrupa por fase e etapa, sem grupos vazios, e manda o resto para \"Sem fase nem etapa\"", () => {
    const g = agrupar(linhas, espaco.estrutura);
    assert.equal(g.fases.length, 3);
    assert.equal(g.fases.reduce((n, f) => n + f.linhas.length, 0) + g.semEtapa.length, 12);
    const so = filtrar(linhas, { situacao: "atrasada" });
    assert.equal(agrupar(so, espaco.estrutura).fases.length, 1);
    const solta = { ...linhas[0], acao: { ...linhas[0].acao, etapa: "nao-existe" } };
    assert.equal(agrupar([solta], espaco.estrutura).semEtapa.length, 1);
  });

  it("resume o grupo com total, concluídas, atrasadas e data de término", () => {
    const r = resumir(linhas);
    assert.deepEqual([r.total, r.concluidas, r.atrasadas], [12, 2, 1]);
    assert.equal(r.termina, linhas.map((l) => l.conclusao).sort().at(-1));
  });
});

describe("Agrupar com etapas vazias (passo 1.14a)", () => {
  it("com vazias, mostra as etapas sem ações, para a criação rápida", () => {
    const estrutura = [{ id: "f1", nome: "Fase", etapas: [{ id: "e1", nome: "Etapa 1" }, { id: "e2", nome: "Etapa 2" }] }];
    assert.equal(agrupar([], estrutura).fases.length, 0);
    const g = agrupar([], estrutura, { vazias: true });
    assert.deepEqual(g.fases[0].etapas.map((e) => e.etapa.id), ["e1", "e2"]);
  });
});
