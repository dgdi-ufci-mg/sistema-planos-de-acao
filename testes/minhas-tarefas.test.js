/** Testes de Meu trabalho, antes Minhas tarefas (js/minhas-tarefas.js), com os três espaços de exemplo em 20/10/2026. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo, carregarExemploDeQuadro, carregarExemploDeLista } from "../js/exemplo.js";
import { montarMinhasTarefas, tarefasDoEspaco, grupoDe, somarDias, GRUPOS, avisoDe, emMinhaOrdem, moverNaOrdem, chaveDoItem, compararPorData } from "../js/minhas-tarefas.js";

const ANA = "ana.souza@ufci.edu.br";
const CARLA = "carla.mendes@ufci.edu.br";

describe("Meu trabalho", async () => {
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
    const r = montarMinhasTarefas(fontes, ANA, hoje, { agrupar: "prazo" });
    assert.deepEqual(chaves(r), ["vencidas", "semana", "adiante", "semData"]);
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

  it("a data-limite vencida vai para Vencidas ou em risco, com o aviso Prazo vencido; sem data, para Sem data", () => {
    const r = montarMinhasTarefas(fontes, CARLA, hoje, { agrupar: "prazo", ordenar: "data" });
    const vencidas = r.grupos.find((g) => g.chave === "vencidas").itens;
    assert.deepEqual(vencidas.map((i) => i.rotulo), ["Enviar a frequência do mês"]);
    assert.equal(vencidas[0].aviso, "prazoVencido");
    assert.equal(vencidas[0].prazo, lista.acoes.find((a) => a.rotulo === "Enviar a frequência do mês").dataLimite, "mostra a data-limite que venceu");
    const semData = r.grupos.find((g) => g.chave === "semData").itens;
    assert.deepEqual(semData.map((i) => i.rotulo), ["Agendar a reunião de planejamento", "Responder a pesquisa de clima"]);
    assert.deepEqual(r.avisos, { prazoVencido: 1, atrasada: 0, emRisco: 0 });
  });

  it("conta como urgentes as com aviso e as de hoje", () => {
    const r = montarMinhasTarefas(fontes, CARLA, hoje, { agrupar: "prazo" });
    const n = (c) => r.grupos.find((g) => g.chave === c)?.itens.length ?? 0;
    assert.equal(r.urgentes, n("vencidas") + n("hoje"));
    assert.equal(r.urgentes, 1);
  });

  it("sem e-mail, ou com e-mail sem responsável ligado, não mostra nada", () => {
    assert.equal(montarMinhasTarefas(fontes, null, hoje).total, 0);
    const r = montarMinhasTarefas(fontes, "ninguem@ufci.edu.br", hoje);
    assert.deepEqual([r.grupos, r.total, r.urgentes], [[], 0, 0]);
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

  it("por data, ordena cada grupo por prazo, depois pelo espaço e pela ordem do espaço", () => {
    const r = montarMinhasTarefas(fontes, ANA, hoje, { agrupar: "prazo", ordenar: "data" });
    for (const g of r.grupos) {
      const prazos = g.itens.map((i) => i.prazo ?? "9999");
      assert.deepEqual(prazos, [...prazos].sort());
    }
  });

  it("grupos por prazo: com aviso, hoje, os 7 dias corridos seguintes, depois e sem data", () => {
    assert.equal(grupoDe({ atrasada: true, prazo: "2026-10-30" }, hoje), "vencidas");
    assert.equal(grupoDe({ aviso: "emRisco", prazo: "2026-12-30" }, hoje), "vencidas");
    assert.equal(grupoDe({ atrasada: false, prazo: null }, hoje), "semData");
    assert.equal(grupoDe({ atrasada: false, prazo: hoje }, hoje), "hoje");
    assert.equal(grupoDe({ atrasada: false, prazo: "2026-10-21" }, hoje), "semana");
    assert.equal(grupoDe({ atrasada: false, prazo: "2026-10-27" }, hoje), "semana");
    assert.equal(grupoDe({ atrasada: false, prazo: "2026-10-28" }, hoje), "adiante");
    assert.equal(somarDias("2026-12-28", 7), "2027-01-04");
    assert.deepEqual(GRUPOS.map(([c]) => c), ["vencidas", "hoje", "semana", "adiante", "semData"]);
  });

  it("avisos: Prazo vencido pela data-limite, Atrasada pela data planejada, Em risco quando a previsão passa da data-limite", () => {
    assert.equal(avisoDe({ atrasada: true, tipoDePrazo: "limite" }, hoje), "prazoVencido");
    assert.equal(avisoDe({ atrasada: true, tipoDePrazo: "previsao" }, hoje), "atrasada");
    assert.equal(avisoDe({ atrasada: false, tipoDePrazo: "previsao" }, hoje), null);
    /* quando a ação puder ter as duas datas (pendência de 06/11/2026) */
    assert.equal(avisoDe({ atrasada: false, tipoDePrazo: "previsao", dataLimite: "2026-11-30", previsao: "2026-12-04" }, hoje), "emRisco");
    assert.equal(avisoDe({ atrasada: false, tipoDePrazo: "previsao", dataLimite: "2026-10-19", previsao: "2026-12-04" }, hoje), "prazoVencido", "vale o mais grave");
    assert.equal(avisoDe({ atrasada: false, tipoDePrazo: "previsao", dataLimite: "2026-11-30", previsao: "2026-11-20" }, hoje), null);
  });

  it("ação atrasada de plano mostra a data planejada que venceu, e não a previsão empurrada para hoje", () => {
    const depois = "2027-06-01"; // bem depois do exemplo: há ações do plano com a previsão vencida
    const itens = tarefasDoEspaco(plano, ANA, depois).filter((i) => i.atrasada);
    assert.ok(itens.length > 0);
    for (const i of itens) {
      assert.equal(i.aviso, "atrasada");
      assert.ok(i.prazo < depois, `${i.rotulo}: ${i.prazo} é a data planejada, no passado`);
    }
  });

  it("checklist: conta os itens feitos e o total; sem checklist, nada", () => {
    for (const f of fontes) for (const i of tarefasDoEspaco(f, ANA, hoje)) {
      const c = f.acoes.find((a) => a.numero === i.numero).checklist ?? [];
      assert.deepEqual(i.checklist, c.length ? { feitos: c.filter((x) => x.feito).length, total: c.length } : null);
    }
  });

  it("sem agrupamento, um grupo só; por espaço, um grupo por espaço, em ordem alfabética", () => {
    const sem = montarMinhasTarefas(fontes, ANA, hoje);
    assert.deepEqual(chaves(sem), ["todas"]);
    assert.equal(sem.grupos[0].itens.length, sem.total);
    const por = montarMinhasTarefas(fontes, ANA, hoje, { agrupar: "espaco" });
    const nomes = por.grupos.map((g) => g.titulo);
    assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
    for (const g of por.grupos) assert.ok(g.itens.every((i) => i.espacoId === g.chave));
  });

  it("minha ordem: segue a ordem guardada; as tarefas que ela não lista vêm no alto, por data", () => {
    const todas = montarMinhasTarefas(fontes, ANA, hoje).grupos[0].itens;
    const porData = [...todas].sort(compararPorData).map((i) => i.chave);
    assert.deepEqual(todas.map((i) => i.chave), porData, "sem ordem guardada, a ordem por data");
    const guardada = [...porData].reverse().slice(0, 3);
    const r = montarMinhasTarefas(fontes, ANA, hoje, { ordemPessoal: guardada });
    const chavesVistas = r.grupos[0].itens.map((i) => i.chave);
    assert.deepEqual(chavesVistas.slice(-3), guardada, "as guardadas, na ordem guardada");
    assert.deepEqual(chavesVistas.slice(0, -3), porData.filter((k) => !guardada.includes(k)), "as novas no alto, por data");
    assert.deepEqual(r.ordem, chavesVistas);
    /* agrupado, cada grupo segue a mesma ordem pessoal */
    const porEspaco = montarMinhasTarefas(fontes, ANA, hoje, { agrupar: "espaco", ordemPessoal: guardada });
    for (const g of porEspaco.grupos) assert.deepEqual(g.itens.map((i) => i.chave), chavesVistas.filter((k) => g.itens.some((i) => i.chave === k)));
  });

  it("mover: depois da vizinha de cima; sem ela, antes da de baixo; chaves que sumiram não atrapalham", () => {
    const o = ["a:1", "a:2", "b:1", "b:2"];
    assert.deepEqual(moverNaOrdem(o, "b:2", { depoisDe: "a:1" }), ["a:1", "b:2", "a:2", "b:1"]);
    assert.deepEqual(moverNaOrdem(o, "a:1", { antesDe: "b:2" }), ["a:2", "b:1", "a:1", "b:2"]);
    assert.deepEqual(moverNaOrdem(o, "b:1", { depoisDe: null, antesDe: "a:1" }), ["b:1", "a:1", "a:2", "b:2"]);
    assert.deepEqual(moverNaOrdem(o, "a:2", {}), ["a:2", "a:1", "b:1", "b:2"]);
    assert.deepEqual(moverNaOrdem(o, "a:2", { depoisDe: "x:9", antesDe: "b:2" }), ["a:1", "b:1", "a:2", "b:2"]);
    assert.equal(chaveDoItem("e1", 7), "e1:7");
    assert.deepEqual(emMinhaOrdem([], ["a:1"]), []);
  });

  it("ocultar: as não liberadas e espaços inteiros saem da vista, mas contam no total e na ordem", () => {
    const tudo = montarMinhasTarefas(fontes, ANA, hoje);
    const naoLib = tudo.grupos[0].itens.filter((i) => i.naoLiberada).length;
    assert.ok(naoLib > 0, "o exemplo tem não liberadas da Ana");
    const sem = montarMinhasTarefas(fontes, ANA, hoje, { ocultarNaoLiberadas: true });
    assert.equal(sem.visiveis, tudo.total - naoLib);
    assert.equal(sem.ocultas, naoLib);
    assert.equal(sem.ordem.length, tudo.total);
    const semQuadro = montarMinhasTarefas(fontes, ANA, hoje, { espacosOcultos: [quadro.espaco.id] });
    assert.ok(semQuadro.grupos.every((g) => g.itens.every((i) => i.espacoId !== quadro.espaco.id)));
    assert.deepEqual(semQuadro.espacos.map((e) => e.id).sort(), [plano.espaco.id, quadro.espaco.id].sort(), "o filtro continua listando todos os espaços");
  });
});

describe("Meu trabalho: ordem pessoal no Store (19/11/2026)", () => {
  it("cada pessoa tem a sua; recusa formato errado, sem login e sem conexão", async () => {
    const banco = criarBancoLocal();
    const ana = criarStore(banco, { exigirLogin: true, usuario: ANA });
    const carla = criarStore(banco, { exigirLogin: true, usuario: CARLA });
    assert.equal(await ana.lerOrdemDoMeuTrabalho(), null, "sem ordem guardada");
    await ana.gravarOrdemDoMeuTrabalho(["e1:2", "e1:1", "e1:2"]);
    assert.deepEqual(await ana.lerOrdemDoMeuTrabalho(), ["e1:2", "e1:1"], "sem repetir");
    assert.equal(await carla.lerOrdemDoMeuTrabalho(), null, "a da outra não aparece");
    for (const ruim of [null, "a", { a: 1 }, [1], ["semnumero"], ["e1:x"], [":1"]]) {
      await assert.rejects(ana.gravarOrdemDoMeuTrabalho(ruim), { codigo: "ordem-invalida" });
    }
    const anonimo = criarStore(banco, { exigirLogin: true, usuario: null });
    assert.equal(await anonimo.lerOrdemDoMeuTrabalho(), null);
    await assert.rejects(anonimo.gravarOrdemDoMeuTrabalho(["e1:1"]), { codigo: "sem-login" });
    ana.definirConexao(false);
    await assert.rejects(ana.gravarOrdemDoMeuTrabalho(["e1:1"]), { codigo: "sem-conexao" });
  });
});
