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
    assert.deepEqual(contar(linhas), { todas: 12, liberada: 4, atrasada: 1, naoLiberada: 6, concluida: 2, "fluxo:inicial": 4 });
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
    assert.ok(l.vencidaEm < hoje, "a atrasada guarda o dia em que a previsão venceu");
    assert.ok(linhas.filter((x) => !x.atrasada).every((x) => x.vencidaEm === null));
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

describe("Prioridades da ação sem estimativa (passo 1.14a)", () => {
  it("não são mostradas", () => {
    const cal = criarCalendario({ inicio: "2026-10-01", datasExcluidas: [] }, "2026-10-21");
    const acoes = [
      { numero: 1, rotulo: "Com", ordem: 1, dependeDe: [], responsaveis: [], estimativas: [{ o: 1, m: 2, p: 3, contaDe: "liberacao", em: "2026-10-01" }] },
      { numero: 2, rotulo: "Sem", ordem: 2, dependeDe: [], responsaveis: [], estimativas: [] },
    ];
    const caminho = caminhoCritico(acoes, cal, { hoje: "2026-10-21" });
    const sim = { porAcao: new Map([[1, { prioridadeExecucao: 1, prioridadeRevisao: 1 }], [2, { prioridadeExecucao: 1, prioridadeRevisao: 0 }]]) };
    const [com, sem] = montarLinhas(acoes, caminho, sim, cal, "2026-10-21");
    assert.equal(com.execucao, 1);
    assert.equal(sem.execucao, null);
    assert.equal(sem.revisao, null);
    assert.equal(sem.semEstimativa, true);
  });
});

describe("Prazo da tarefa como texto (Lista de tarefas, 04/11/2026)", async () => {
  const { prazoDaTarefa } = await import("../js/lista.js");
  const hoje = "2026-11-04"; // quarta-feira
  it("hoje, amanhã e ontem", () => {
    assert.deepEqual(prazoDaTarefa("2026-11-04", hoje), { texto: "Hoje", tom: "hoje", dias: 0 });
    assert.deepEqual(prazoDaTarefa("2026-11-05", hoje), { texto: "Amanhã", tom: "breve", dias: 1 });
    assert.deepEqual(prazoDaTarefa("2026-11-03", hoje), { texto: "Ontem", tom: "vencida", dias: -1 });
  });
  it("nos próximos 6 dias, o dia da semana; depois, dia e mês", () => {
    assert.equal(prazoDaTarefa("2026-11-06", hoje).texto, "sex.");
    assert.equal(prazoDaTarefa("2026-11-10", hoje).texto, "ter.");
    assert.deepEqual(prazoDaTarefa("2026-11-11", hoje), { texto: "11 nov.", tom: "depois", dias: 7 });
    assert.deepEqual(prazoDaTarefa("2026-10-28", hoje), { texto: "28 out.", tom: "vencida", dias: -7 });
  });
  it("outro ano leva o ano; virada de mês e de ano contam certo", () => {
    assert.equal(prazoDaTarefa("2027-01-08", hoje).texto, "8 jan. 2027");
    assert.equal(prazoDaTarefa("2027-01-01", "2026-12-31").texto, "Amanhã");
    assert.equal(prazoDaTarefa("2026-12-01", "2026-11-30").texto, "Amanhã");
  });
  it("concluída nunca fica vencida; sem data, nada", () => {
    assert.equal(prazoDaTarefa("2026-11-01", hoje, { concluida: true }).tom, "depois");
    assert.equal(prazoDaTarefa(null, hoje), null);
  });
});

describe("Atalhos da data-limite (janela da tarefa, 05/11/2026)", () => {
  it("hoje, amanhã e a próxima segunda, em dias corridos", async () => {
    const { atalhosDeData } = await import("../js/lista.js");
    /* quinta-feira, 05/11/2026 */
    assert.deepEqual(atalhosDeData("2026-11-05"), [
      { rotulo: "Hoje", data: "2026-11-05" }, { rotulo: "Amanhã", data: "2026-11-06" }, { rotulo: "Próxima segunda", data: "2026-11-09" },
    ]);
    /* segunda-feira: a próxima é a da semana que vem; domingo: a de amanhã; virada de mês e de ano */
    assert.equal(atalhosDeData("2026-11-09")[2].data, "2026-11-16");
    assert.equal(atalhosDeData("2026-11-08")[2].data, "2026-11-09");
    assert.equal(atalhosDeData("2026-12-31")[1].data, "2027-01-01");
    assert.equal(atalhosDeData("2026-12-31")[2].data, "2027-01-04");
  });
});

describe("Atalhos e rótulos da janelinha de data (coluna de atributos da tarefa, 05/11/2026)", () => {
  it("hoje, amanhã, este fim de semana (de segunda a sexta) e próxima semana, com o dia ao lado", async () => {
    const { atalhosDoVencimento } = await import("../js/lista.js");
    /* quinta-feira, 05/11/2026 */
    assert.deepEqual(atalhosDoVencimento("2026-11-05"), [
      { rotulo: "Hoje", data: "2026-11-05", dia: "qui" },
      { rotulo: "Amanhã", data: "2026-11-06", dia: "sex" },
      { rotulo: "Este fim de semana", data: "2026-11-07", dia: "sáb" },
      { rotulo: "Próxima semana", data: "2026-11-09", dia: "seg 9 nov" },
    ]);
    /* sábado e domingo: sem "Este fim de semana"; a próxima semana é a segunda seguinte */
    assert.deepEqual(atalhosDoVencimento("2026-11-07").map((a) => a.rotulo), ["Hoje", "Amanhã", "Próxima semana"]);
    assert.equal(atalhosDoVencimento("2026-11-08").at(-1).data, "2026-11-09");
    /* segunda-feira: a próxima semana é a segunda da semana que vem; virada de ano */
    assert.equal(atalhosDoVencimento("2026-11-09").at(-1).data, "2026-11-16");
    assert.equal(atalhosDoVencimento("2026-12-31").at(-1).dia, "seg 4 jan");
  });
  it("rótulo da data: Hoje, Amanhã, Ontem ou a data com o dia da semana", async () => {
    const { rotuloDaData } = await import("../js/lista.js");
    assert.equal(rotuloDaData("2026-11-05", "2026-11-05"), "Hoje");
    assert.equal(rotuloDaData("2026-11-06", "2026-11-05"), "Amanhã");
    assert.equal(rotuloDaData("2026-11-04", "2026-11-05"), "Ontem");
    assert.equal(rotuloDaData("2026-11-09", "2026-11-05"), "09/11/2026 · seg");
  });
});
