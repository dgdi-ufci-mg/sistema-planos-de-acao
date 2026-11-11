import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { montarLinhas } from "../js/lista.js";
import { simular } from "../js/simulacao.js";
import { montarCronograma, zoomQueCabe, estimativaParaTerminarEm, paginasDoCronograma } from "../js/cronograma.js";
import { duracaoPert } from "../js/calculo.js";

const HOJE = "2026-10-20";
async function exemplo() {
  const store = criarStore(criarBancoLocal());
  const id = await carregarExemplo(store, new Date(`${HOJE}T12:00:00Z`));
  const espaco = await store.lerEspaco(id);
  const acoes = (await store.listarAcoes(id)).sort((a, b) => a.ordem - b.ordem);
  const cal = criarCalendario(espaco, HOJE);
  const caminho = caminhoCritico(acoes, cal, { hoje: HOJE });
  return { espaco, acoes, cal, caminho };
}

describe("Cronograma (passo 1.17b)", () => {
  it("cada ação aparece uma vez, com início antes do fim e a mesma conclusão da lista", async () => {
    const { espaco, acoes, cal, caminho } = await exemplo();
    const { linhas, inicio, fim } = montarCronograma(acoes, caminho, cal, { estrutura: espaco.estrutura, usaFases: true });
    const barras = linhas.filter((l) => l.tipo === "acao").map((l) => l.barra);
    assert.equal(barras.length, acoes.length);
    assert.equal(new Set(barras.map((b) => b.numero)).size, acoes.length);
    const sim = simular(acoes, cal, { hoje: HOJE, semente: espaco.semente, simulacoes: 200 });
    const daLista = new Map(montarLinhas(acoes, caminho, sim, cal, HOJE).map((l) => [l.acao.numero, l.conclusao]));
    for (const b of barras) {
      assert.ok(b.inicio <= b.fim, `${b.acao.rotulo}: ${b.inicio} > ${b.fim}`);
      assert.equal(b.fim, daLista.get(b.numero), b.acao.rotulo);
      assert.ok(inicio <= b.inicio && b.fim <= fim);
    }
  });

  it("uma ação começa depois que as anteriores terminam (no mesmo dia, se a anterior termina no meio dele)", async () => {
    const { acoes, cal, caminho } = await exemplo();
    const { linhas } = montarCronograma(acoes, caminho, cal);
    const porNumero = new Map(linhas.map((l) => [l.barra.numero, l.barra]));
    for (const b of porNumero.values()) {
      for (const d of b.dependeDe) assert.ok(porNumero.get(d).fim <= b.inicio || b.situacao === "concluida", `${b.acao.rotulo}`);
    }
  });

  it("agrupa por fase e etapa, na ordem da estrutura; sem fases, só as ações", async () => {
    const { espaco, acoes, cal, caminho } = await exemplo();
    const com = montarCronograma(acoes, caminho, cal, { estrutura: espaco.estrutura, usaFases: true }).linhas;
    assert.equal(com[0].tipo, "grupo");
    assert.equal(com[0].nivel, "fase");
    assert.equal(com[1].nivel, "etapa");
    const fases = com.filter((l) => l.nivel === "fase").map((l) => l.id);
    assert.deepEqual(fases, ["F1", "F2", "F3"]);
    const sem = montarCronograma(acoes, caminho, cal).linhas;
    assert.ok(sem.every((l) => l.tipo === "acao"));
  });

  it("as ações críticas do cronograma são as do caminho crítico", async () => {
    const { acoes, cal, caminho } = await exemplo();
    const { linhas } = montarCronograma(acoes, caminho, cal);
    const criticas = linhas.filter((l) => l.barra.critica).map((l) => l.barra.numero).sort();
    const doCaminho = [...caminho.porAcao.entries()].filter(([, c]) => c.critica).map(([n]) => n).sort();
    assert.deepEqual(criticas, doCaminho);
    assert.ok(criticas.length > 0);
  });
});

describe("Cronograma: navegação e edição na tela (10/11/2026)", () => {
  it("fase ou etapa recolhida esconde as linhas de dentro, mas mantém a linha do grupo, a contagem e as datas", async () => {
    const { espaco, acoes, cal, caminho } = await exemplo();
    const aberto = montarCronograma(acoes, caminho, cal, { estrutura: espaco.estrutura, usaFases: true });
    const fase = espaco.estrutura[0];
    const etapa = espaco.estrutura[1].etapas[0];
    const fechado = montarCronograma(acoes, caminho, cal, { estrutura: espaco.estrutura, usaFases: true, recolhidos: new Set([fase.id, etapa.id]) });
    const daFase = acoes.filter((a) => fase.etapas.some((e) => e.id === a.etapa));
    const daEtapa = acoes.filter((a) => a.etapa === etapa.id);
    const etapasDaFase = fase.etapas.filter((e) => acoes.some((a) => a.etapa === e.id)).length;
    assert.equal(fechado.linhas.length, aberto.linhas.length - daFase.length - etapasDaFase - daEtapa.length);
    const linhaDaFase = fechado.linhas.find((l) => l.tipo === "grupo" && l.id === fase.id);
    const linhaAberta = aberto.linhas.find((l) => l.tipo === "grupo" && l.id === fase.id);
    assert.equal(linhaDaFase.recolhido, true);
    assert.equal(linhaDaFase.acoes, daFase.length);
    assert.deepEqual([linhaDaFase.inicio, linhaDaFase.fim], [linhaAberta.inicio, linhaAberta.fim]);
    assert.equal(fechado.linhas.find((l) => l.tipo === "grupo" && l.id === etapa.id).acoes, daEtapa.length);
    assert.ok(!fechado.linhas.some((l) => l.tipo === "acao" && l.barra.acao.etapa === etapa.id));
    assert.deepEqual([fechado.inicio, fechado.fim], [aberto.inicio, aberto.fim], "as datas do cronograma não mudam");
  });

  it("zoomQueCabe: o cronograma inteiro cabe na largura, entre 1 e 40 px por dia", () => {
    assert.equal(zoomQueCabe(100, 832), 8.32);
    assert.ok(Math.ceil(137 * zoomQueCabe(137, 832)) <= 832);
    assert.equal(zoomQueCabe(5, 2000), 40);
    assert.equal(zoomQueCabe(5000, 800), 1);
    assert.equal(zoomQueCabe(0, 800), 1);
  });

  it("estimativaParaTerminarEm: três prazos inteiros, em ordem, que terminam no dia pedido, perto da proporção", () => {
    const tres = { o: 8, m: 10, p: 18 };
    for (const base of [0, 3.4, 12.75]) {
      for (let dia = Math.ceil(base); dia < base + 40; dia++) {
        const nova = estimativaParaTerminarEm(tres, base, dia);
        assert.ok(nova, `base ${base}, dia ${dia}`);
        assert.ok(Number.isInteger(nova.o) && Number.isInteger(nova.m) && Number.isInteger(nova.p));
        assert.ok(nova.o <= nova.m && nova.m <= nova.p && nova.p > 0);
        assert.equal(Math.ceil(base + duracaoPert(nova)) - 1, dia, `base ${base}, dia ${dia}: ${JSON.stringify(nova)}`);
      }
    }
    /* o dobro do prazo mantém a proporção */
    const dobro = estimativaParaTerminarEm(tres, 0, Math.ceil(2 * duracaoPert(tres)) - 1);
    assert.ok(Math.abs(dobro.m / dobro.o - tres.m / tres.o) < 0.3 && Math.abs(dobro.p / dobro.m - tres.p / tres.m) < 0.3);
    assert.equal(estimativaParaTerminarEm(tres, 10, 8), null, "terminar antes de começar não dá");
    assert.equal(estimativaParaTerminarEm({ o: 0, m: 0, p: 0 }, 0, 5), null, "sem estimativa, não há proporção");
  });
});

describe("Cronograma: esconder concluídas e contínuas; páginas da impressão (11/11/2026)", () => {
  it("esconder as concluídas tira as linhas delas, conta as escondidas e não muda as datas", async () => {
    const { espaco, acoes, cal, caminho } = await exemplo();
    const opcoes = { estrutura: espaco.estrutura, usaFases: true };
    const tudo = montarCronograma(acoes, caminho, cal, opcoes);
    const sem = montarCronograma(acoes, caminho, cal, { ...opcoes, ocultar: { concluidas: true } });
    const concluidas = acoes.filter((a) => caminho.porAcao.get(a.numero).situacao === "concluida");
    assert.ok(concluidas.length > 0, "o exemplo tem ações concluídas");
    assert.deepEqual(tudo.ocultas, { concluidas: 0, continuas: 0 });
    assert.deepEqual(sem.ocultas, { concluidas: concluidas.length, continuas: 0 });
    assert.equal(sem.linhas.filter((l) => l.tipo === "acao").length, acoes.length - concluidas.length);
    assert.ok(!sem.linhas.some((l) => l.tipo === "acao" && l.barra.situacao === "concluida"));
    assert.deepEqual([sem.inicio, sem.fim], [tudo.inicio, tudo.fim], "as datas do cronograma não mudam");
    /* os grupos continuam todos, com as mesmas datas de resumo, e dizem quantas ficaram escondidas */
    const grupos = (r) => r.linhas.filter((l) => l.tipo === "grupo");
    assert.deepEqual(grupos(sem).map((g) => [g.id, g.inicio, g.fim]), grupos(tudo).map((g) => [g.id, g.inicio, g.fim]));
    for (const g of grupos(sem)) {
      const antes = grupos(tudo).find((x) => x.id === g.id);
      assert.equal(g.acoes + g.ocultas, antes.acoes, g.nome);
    }
    assert.equal(grupos(sem).filter((g) => g.nivel === "etapa").reduce((s, g) => s + g.ocultas, 0), concluidas.length);
  });

  it("esconder as contínuas: a contínua concluída conta como concluída; sem fases, vale igual", async () => {
    const { acoes, cal, caminho } = await exemplo();
    /* marca duas ações como contínuas no resultado do cálculo: uma em aberto e uma concluída */
    const porAcao = new Map(caminho.porAcao);
    const aberta = acoes.find((a) => porAcao.get(a.numero).situacao !== "concluida");
    const concluida = acoes.find((a) => porAcao.get(a.numero).situacao === "concluida");
    porAcao.set(aberta.numero, { ...porAcao.get(aberta.numero), continua: true });
    porAcao.set(concluida.numero, { ...porAcao.get(concluida.numero), continua: true });
    const r = montarCronograma(acoes, { ...caminho, porAcao }, cal, { ocultar: { continuas: true } });
    assert.deepEqual(r.ocultas, { concluidas: 0, continuas: 1 });
    assert.ok(!r.linhas.some((l) => l.barra.numero === aberta.numero));
    assert.ok(r.linhas.some((l) => l.barra.numero === concluida.numero), "a contínua concluída só sai com as concluídas");
    const dois = montarCronograma(acoes, { ...caminho, porAcao }, cal, { ocultar: { continuas: true, concluidas: true } });
    assert.equal(dois.ocultas.continuas, 1);
    assert.equal(dois.linhas.length, acoes.length - 1 - dois.ocultas.concluidas);
  });

  it("paginasDoCronograma: páginas cheias e a última com o resto; sempre ao menos uma", () => {
    assert.deepEqual(paginasDoCronograma(40, 18), [{ de: 0, quantas: 18 }, { de: 18, quantas: 18 }, { de: 36, quantas: 4 }]);
    assert.deepEqual(paginasDoCronograma(18, 18), [{ de: 0, quantas: 18 }]);
    assert.deepEqual(paginasDoCronograma(0, 18), [{ de: 0, quantas: 1 }]);
    assert.equal(paginasDoCronograma(5, 0).length, 5, "nunca menos de uma linha por página");
  });
});
