/** Testes de Minhas tarefas (js/minhas-tarefas.js), com os três espaços de exemplo em 20/10/2026. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo, carregarExemploDeQuadro, carregarExemploDeLista } from "../js/exemplo.js";
import { montarMinhasTarefas, tarefasDoEspaco, grupoDe, somarDias, GRUPOS } from "../js/minhas-tarefas.js";

const ANA = "ana.souza@ufci.edu.br";
const CARLA = "carla.mendes@ufci.edu.br";

describe("Minhas tarefas", async () => {
  const hoje = "2026-10-20";
  const dia = new Date(`${hoje}T12:00:00Z`);
  const store = criarStore(criarBancoLocal());
  const ids = [await carregarExemplo(store, dia), await carregarExemploDeQuadro(store, dia), await carregarExemploDeLista(store, dia)];
  const ler = () => Promise.all(ids.map(async (id) => ({
    espaco: await store.lerEspaco(id), acoes: await store.listarAcoes(id), responsaveis: await store.listarResponsaveis(id), geral: null,
  })));
  const fontes = await ler();
  const [plano, quadro, lista] = fontes;
  const chaves = (r) => r.grupos.map((g) => g.chave);

  it("junta as tarefas de quem entrou de todos os espaços, agrupadas por prazo", () => {
    const r = montarMinhasTarefas(fontes, ANA, hoje);
    assert.deepEqual(chaves(r), ["atrasadas", "semana", "adiante", "semPrazo"]);
    assert.equal(r.total, 7);
    const espacos = new Set(r.grupos.flatMap((g) => g.itens.map((i) => i.espacoId)));
    assert.deepEqual([...espacos].sort(), [plano.espaco.id, quadro.espaco.id].sort());
  });

  it("só entram as ações em que um responsável ligado ao e-mail está entre os responsáveis", () => {
    const r = montarMinhasTarefas(fontes, ANA, hoje);
    const ana = new Map(fontes.map((f) => [f.espaco.id, f.responsaveis.find((x) => x.usuario === ANA)?.id]));
    for (const g of r.grupos) for (const i of g.itens) {
      const acao = fontes.find((f) => f.espaco.id === i.espacoId).acoes.find((a) => a.numero === i.numero);
      assert.ok(acao.responsaveis.includes(ana.get(i.espacoId)), `${i.rotulo} é da Ana`);
    }
  });

  it("deixa de fora as concluídas", () => {
    const concluidas = new Set(quadro.acoes.filter((a) => a.conclusaoMarcadaEm).map((a) => a.numero));
    assert.ok(concluidas.size > 0);
    const doQuadro = tarefasDoEspaco(quadro, ANA, hoje);
    assert.ok(doQuadro.every((i) => !concluidas.has(i.numero)));
    const doPlano = tarefasDoEspaco(plano, ANA, hoje);
    const concluidasDoPlano = new Set(plano.acoes.filter((a) => a.concluidaEm).map((a) => a.numero));
    assert.ok(doPlano.every((i) => !concluidasDoPlano.has(i.numero)));
  });

  it("usa a data-limite nos espaços de tarefas e a conclusão prevista nos planos", () => {
    const doQuadro = tarefasDoEspaco(quadro, ANA, hoje);
    for (const i of doQuadro) {
      assert.equal(i.tipoDePrazo, "limite");
      assert.equal(i.termo, "tarefa");
      assert.equal(i.prazo, quadro.acoes.find((a) => a.numero === i.numero).dataLimite ?? null);
    }
    const doPlano = tarefasDoEspaco(plano, ANA, hoje);
    assert.ok(doPlano.length > 0);
    for (const i of doPlano) {
      assert.equal(i.tipoDePrazo, "previsao");
      assert.equal(i.termo, "ação");
      assert.match(i.prazo, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("a data-limite vencida vai para Atrasadas; sem data, para Sem prazo", () => {
    const r = montarMinhasTarefas(fontes, CARLA, hoje);
    const atrasadas = r.grupos.find((g) => g.chave === "atrasadas").itens;
    assert.deepEqual(atrasadas.map((i) => i.rotulo), ["Enviar a frequência do mês"]);
    const semPrazo = r.grupos.find((g) => g.chave === "semPrazo").itens;
    assert.deepEqual(semPrazo.map((i) => i.rotulo), ["Agendar a reunião de planejamento", "Responder a pesquisa de clima"]);
  });

  it("conta como urgentes as atrasadas e as de hoje", () => {
    const r = montarMinhasTarefas(fontes, CARLA, hoje);
    const n = (c) => r.grupos.find((g) => g.chave === c)?.itens.length ?? 0;
    assert.equal(r.urgentes, n("atrasadas") + n("hoje"));
    assert.equal(r.urgentes, 1);
  });

  it("sem e-mail, ou com e-mail sem responsável ligado, não mostra nada", () => {
    assert.equal(montarMinhasTarefas(fontes, null, hoje).total, 0);
    const r = montarMinhasTarefas(fontes, "ninguem@ufci.edu.br", hoje);
    assert.deepEqual(r, { grupos: [], total: 0, urgentes: 0 });
  });

  it("ignora espaços encerrados e responsáveis excluídos", () => {
    const encerrado = { ...lista, espaco: { ...lista.espaco, encerradoEm: "2026-10-19T10:00:00.000Z" } };
    assert.equal(tarefasDoEspaco(encerrado, CARLA, hoje).length, 0);
    const semCarla = { ...lista, responsaveis: lista.responsaveis.map((r) => ({ ...r, excluidoEm: "2026-10-19T10:00:00.000Z" })) };
    assert.equal(tarefasDoEspaco(semCarla, CARLA, hoje).length, 0);
  });

  it("ação sem responsável não entra, nem para quem cria", async () => {
    const n = await store.criarAcao(lista.espaco.id, { rotulo: "Tarefa sem responsável", dataLimite: hoje });
    const [, , atual] = await ler();
    assert.ok(!tarefasDoEspaco(atual, CARLA, hoje).some((i) => i.numero === n));
  });

  it("ordena cada grupo por prazo, depois pelo espaço e pela ordem do espaço", () => {
    const r = montarMinhasTarefas(fontes, ANA, hoje);
    for (const g of r.grupos) {
      const prazos = g.itens.map((i) => i.prazo ?? "9999");
      assert.deepEqual(prazos, [...prazos].sort());
    }
  });

  it("grupos por prazo: hoje, os 7 dias corridos seguintes e depois", () => {
    assert.equal(grupoDe({ atrasada: true, prazo: "2026-10-30" }, hoje), "atrasadas");
    assert.equal(grupoDe({ atrasada: false, prazo: null }, hoje), "semPrazo");
    assert.equal(grupoDe({ atrasada: false, prazo: hoje }, hoje), "hoje");
    assert.equal(grupoDe({ atrasada: false, prazo: "2026-10-21" }, hoje), "semana");
    assert.equal(grupoDe({ atrasada: false, prazo: "2026-10-27" }, hoje), "semana");
    assert.equal(grupoDe({ atrasada: false, prazo: "2026-10-28" }, hoje), "adiante");
    assert.equal(somarDias("2026-12-28", 7), "2027-01-04");
    assert.deepEqual(GRUPOS.map(([c]) => c), ["atrasadas", "hoje", "semana", "adiante", "semPrazo"]);
  });
});
