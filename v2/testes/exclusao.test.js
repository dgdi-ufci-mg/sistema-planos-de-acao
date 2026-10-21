/**
 * Exclusão lógica e lixeira (especificação, seção 4.7; passo 1.15): nada é apagado; o item
 * excluído sai das operações comuns (lista, cálculo, simulação) e aparece na lixeira.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { simular } from "../js/simulacao.js";

async function exemplo() {
  const store = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br" });
  const id = await carregarExemplo(store, new Date("2026-10-20T12:00:00Z"));
  const acoes = await store.listarAcoes(id);
  const por = (codigo) => acoes.find((a) => a.codigo === codigo);
  return { store, id, por };
}

describe("Exclusão lógica: ações", () => {
  it("a ação excluída some da lista, do cálculo e da simulação, e aparece na lixeira com autor e data", async () => {
    const { store, id, por } = await exemplo();
    const cap = por("CAP");
    await store.excluirAcao(id, cap.numero);
    const acoes = await store.listarAcoes(id);
    assert.ok(!acoes.some((a) => a.numero === cap.numero));
    const espaco = await store.lerEspaco(id);
    const cal = criarCalendario(espaco, "2026-10-20");
    assert.ok(!caminhoCritico(acoes, cal, { hoje: "2026-10-20" }).porAcao.has(cap.numero));
    assert.ok(!simular(acoes, cal, { hoje: "2026-10-20", semente: 1, simulacoes: 50 }).porAcao.has(cap.numero));
    const { acoes: lixo } = await store.listarLixeira(id);
    assert.deepEqual(lixo.map((a) => a.numero), [cap.numero]);
    assert.equal(lixo[0].excluidaPor, "ana@ufci.edu.br");
    assert.ok(lixo[0].excluidaEm);
    let foto;
    const parar = store.acompanharEspaco(id, (f) => { foto = f; });
    parar();
    assert.ok(!foto.acoes.some((a) => a.numero === cap.numero));
  });

  it("religar: as dependentes passam a depender das anteriores da excluída", async () => {
    const { store, id, por } = await exemplo();
    const lic = por("LIC"); // depende de LEV; PAI depende de LIC
    const inf = por("PAI");
    assert.ok(inf.dependeDe.includes(lic.numero));
    await store.excluirAcao(id, lic.numero, { religar: true });
    const depois = (await store.listarAcoes(id)).find((a) => a.numero === inf.numero);
    assert.ok(!depois.dependeDe.includes(lic.numero));
    for (const n of lic.dependeDe) assert.ok(depois.dependeDe.includes(n));
  });

  it("sem religar: as dependentes só perdem a dependência; restaurar não refaz a ligação", async () => {
    const { store, id, por } = await exemplo();
    const lic = por("LIC");
    const inf = por("PAI");
    await store.excluirAcao(id, lic.numero);
    let depois = (await store.listarAcoes(id)).find((a) => a.numero === inf.numero);
    assert.ok(!depois.dependeDe.includes(lic.numero));
    assert.ok(!lic.dependeDe.some((n) => depois.dependeDe.includes(n) && !inf.dependeDe.includes(n)));
    await store.restaurarAcao(id, lic.numero);
    depois = (await store.listarAcoes(id)).find((a) => a.numero === inf.numero);
    assert.ok(!depois.dependeDe.includes(lic.numero));
    assert.ok((await store.listarAcoes(id)).some((a) => a.numero === lic.numero));
  });

  it("o código de uma ação excluída continua reservado", async () => {
    const { store, id, por } = await exemplo();
    await store.excluirAcao(id, por("CAP").numero);
    await assert.rejects(store.criarAcao(id, { rotulo: "Outra", codigo: "CAP" }), { codigo: "codigo-ocupado", message: /lixeira/ });
  });
});

describe("Exclusão lógica: responsáveis, etapas e espaços", () => {
  it("responsável: substituir por outro nas ações, ou só retirar", async () => {
    const { store, id } = await exemplo();
    const rs = await store.listarResponsaveis(id);
    const dro = rs.find((r) => r.sigla === "DRO").id;
    const brl = rs.find((r) => r.sigla === "BRL").id;
    const cam = rs.find((r) => r.sigla === "CAM").id;
    await store.excluirResponsavel(id, dro, { substituto: brl });
    let acoes = await store.listarAcoes(id);
    assert.ok(!acoes.some((a) => a.responsaveis.includes(dro)));
    assert.ok(acoes.filter((a) => a.responsaveis.includes(brl)).length >= 3);
    await store.excluirResponsavel(id, cam);
    acoes = await store.listarAcoes(id);
    assert.ok(!acoes.some((a) => a.responsaveis.includes(cam)));
    assert.ok(!(await store.listarResponsaveis(id)).some((r) => r.id === dro || r.id === cam));
    assert.equal((await store.listarLixeira(id)).responsaveis.length, 2);
    const tons = (await store.lerEspaco(id)).tons;
    assert.equal(tons[dro], undefined);
    await store.restaurarResponsavel(id, cam);
    assert.ok((await store.listarResponsaveis(id)).some((r) => r.id === cam));
  });

  it("etapa com ações: mover para outra etapa ou deixar sem etapa", async () => {
    const { store, id } = await exemplo();
    const nas = async (etapa) => (await store.listarAcoes(id)).filter((a) => a.etapa === etapa).length;
    const antes = await nas("E12");
    await store.excluirEtapas(id, ["E12"], { destino: "E11" });
    assert.equal(await nas("E12"), 0);
    assert.ok((await nas("E11")) >= antes);
    const e = await store.lerEspaco(id);
    assert.ok(!e.estrutura.some((f) => f.etapas.some((x) => x.id === "E12")));
    const fase = e.estrutura.find((f) => f.etapas.some((x) => x.id === "E21"));
    await store.excluirEtapas(id, [fase.id, ...fase.etapas.map((x) => x.id)]);
    assert.equal((await store.listarAcoes(id)).filter((a) => a.etapa === "E21").length, 0);
    assert.ok((await store.listarAcoes(id)).some((a) => a.etapa === null));
  });

  it("espaço: sai da lista e da leitura comum, vai para a lixeira e volta", async () => {
    const { store, id } = await exemplo();
    await store.excluirEspaco(id);
    assert.equal(await store.lerEspaco(id), null);
    assert.deepEqual(await store.listarEspacos(), []);
    assert.deepEqual((await store.listarEspacosExcluidos()).map((e) => e.id), [id]);
    await store.restaurarEspaco(id);
    assert.ok(await store.lerEspaco(id));
  });
});
