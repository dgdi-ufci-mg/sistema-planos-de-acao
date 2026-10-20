/** Testes das regras da janela da ação (js/acao.js) e das operações do Store usadas por ela. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimativaLivre, dependentes, anterioresPossiveis, buscar, resumoDasEstimativas, pendencias } from "../js/acao.js";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";

const est = (o, m, p, em, contaDe = "liberacao") => ({ o, m, p, em, contaDe });
const A = { codigo: "A", dependeDe: [] };
const B = { codigo: "B", dependeDe: ["A"] };
const C = { codigo: "C", dependeDe: ["B"] };
const D = { codigo: "D", dependeDe: [] };

describe("Janela da ação: regras", () => {
  it("estimativa livre: não liberada sempre; liberada só no dia da única estimativa; concluída nunca", () => {
    const uma = { estimativas: [est(1, 2, 3, "2026-10-20")] };
    assert.equal(estimativaLivre(uma, "naoLiberada", "2026-10-25"), true);
    assert.equal(estimativaLivre(uma, "liberada", "2026-10-20"), true);
    assert.equal(estimativaLivre(uma, "liberada", "2026-10-21"), false);
    assert.equal(estimativaLivre({ estimativas: [...uma.estimativas, est(1, 2, 3, "2026-10-20", "data")] }, "liberada", "2026-10-20"), false);
    assert.equal(estimativaLivre({ estimativas: [] }, "liberada", "2026-10-20"), true);
    assert.equal(estimativaLivre(uma, "concluida", "2026-10-20"), false);
  });

  it("anteriores possíveis: fora a própria ação, as que já são anteriores e as que dependem dela", () => {
    const acoes = [A, B, C, D];
    assert.deepEqual([...dependentes(acoes, "A")].sort(), ["B", "C"]);
    assert.deepEqual(anterioresPossiveis(acoes, "A").map((a) => a.codigo), ["D"]);
    assert.deepEqual(anterioresPossiveis(acoes, "C").map((a) => a.codigo), ["A", "D"]);
  });

  it("busca sem diferenciar acentos e maiúsculas, em vários textos", () => {
    const itens = [{ nome: "Pró-Reitoria de Graduação", sigla: "PROGRAD" }, { nome: "Ana Souza", sigla: "ANA" }];
    const textos = (x) => [x.nome, x.sigla];
    assert.deepEqual(buscar(itens, "graduacao", textos).map((x) => x.sigla), ["PROGRAD"]);
    assert.deepEqual(buscar(itens, "an", textos).map((x) => x.sigla), ["ANA"]);
    assert.equal(buscar(itens, "  ", textos).length, 2);
  });

  it("resumo das estimativas: original, reprogramações e quanto o término andou", () => {
    const acao = { estimativas: [est(3, 5, 7, "2026-10-01"), est(2, 4, 6, "2026-10-10", "data")] };
    assert.deepEqual(resumoDasEstimativas(acao, { liberacao: 10, conclusao: 18 }), { original: 5, reprogramacoes: 1, deslocamento: 3 });
    assert.equal(resumoDasEstimativas({ estimativas: [] }, { liberacao: 0, conclusao: 0 }), null);
  });

  it("pendências da ação não liberada: anteriores não concluídas e data mínima futura", () => {
    const acoes = [{ ...A, concluidaEm: "2026-10-01" }, { ...D }, { codigo: "E", dependeDe: ["A", "D"], naoAntesDe: "2026-11-01" }];
    assert.deepEqual(pendencias(acoes[2], acoes, "2026-10-20"), { anteriores: ["D"], dataMinima: "2026-11-01" });
    assert.deepEqual(pendencias(acoes[2], acoes, "2026-11-05"), { anteriores: ["D"], dataMinima: null });
  });
});

describe("Janela da ação: operações do Store", async () => {
  const novo = async () => {
    const store = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", hoje: () => "2026-10-20" });
    const id = await store.criarEspaco({ nome: "P", inicio: "2026-10-01" });
    for (const [codigo, dependeDe] of [["AA", []], ["BB", ["AA"]], ["CC", ["BB"]]]) {
      await store.criarAcao(id, { codigo, rotulo: codigo, dependeDe, estimativas: [est(1, 2, 3, "2026-10-01")] });
    }
    return { store, id };
  };

  it("acrescenta e retira dependências, recusando ciclo, a própria ação e código inexistente", async () => {
    const { store, id } = await novo();
    await assert.rejects(store.acrescentarDependencia(id, "AA", "CC"), { codigo: "ciclo" });
    await assert.rejects(store.acrescentarDependencia(id, "AA", "AA"), { codigo: "ciclo" });
    await assert.rejects(store.acrescentarDependencia(id, "AA", "ZZ"), { codigo: "nao-encontrado" });
    await store.acrescentarDependencia(id, "CC", "AA");
    assert.deepEqual((await store.lerAcao(id, "CC")).dependeDe, ["BB", "AA"]);
    await store.retirarDependencia(id, "CC", "BB");
    const c = await store.lerAcao(id, "CC");
    assert.deepEqual(c.dependeDe, ["AA"]);
    assert.equal(c.alteradaPor, "ana@ufci.edu.br");
  });

  it("acrescenta e retira responsáveis, mantendo os tons do espaço", async () => {
    const { store, id } = await novo();
    const ana = await store.criarResponsavel({ tipo: "pessoa", nome: "Ana Souza" });
    await store.acrescentarResponsavelNaAcao(id, "AA", ana);
    assert.deepEqual((await store.lerAcao(id, "AA")).responsaveis, [ana]);
    assert.equal((await store.lerEspaco(id)).tons[ana], 1);
    await store.retirarResponsavelDaAcao(id, "AA", ana);
    assert.deepEqual((await store.lerEspaco(id)).tons, {});
  });

  it("reestima a partir de hoje, no fim do histórico, e valida os três pontos", async () => {
    const { store, id } = await novo();
    await store.reestimar(id, "AA", { o: 2, m: 3, p: 5, motivo: " Atraso do fornecedor " });
    const ultima = (await store.lerAcao(id, "AA")).estimativas.at(-1);
    assert.deepEqual(ultima, { em: "2026-10-20", por: "ana@ufci.edu.br", o: 2, m: 3, p: 5, contaDe: "data", motivo: "Atraso do fornecedor" });
    await assert.rejects(store.reestimar(id, "AA", { o: 5, m: 3, p: 6 }), { codigo: "estimativa-fora-de-ordem" });
    await assert.rejects(store.reestimar(id, "AA", { o: 0, m: 0, p: 0 }), { codigo: "estimativa-zerada" });
    await assert.rejects(store.reestimar(id, "AA", { o: -1, m: 1, p: 2 }), { codigo: "estimativa-invalida" });
    await assert.rejects(store.reestimar(id, "AA", { o: 1, m: 2.5, p: 4 }), { codigo: "estimativa-fracionada" });
    await assert.rejects(store.corrigirEstimativa(id, "AA", { o: 0.5, m: 1, p: 2 }), { codigo: "estimativa-fracionada" });
  });

  it("corrige a estimativa sem criar histórico e cria a primeira quando não há", async () => {
    const { store, id } = await novo();
    await store.corrigirEstimativa(id, "AA", { o: 4, m: 5, p: 9 });
    const lista = (await store.lerAcao(id, "AA")).estimativas;
    assert.equal(lista.length, 1);
    assert.deepEqual([lista[0].o, lista[0].m, lista[0].p, lista[0].contaDe], [4, 5, 9, "liberacao"]);
    await store.criarAcao(id, { codigo: "NN", rotulo: "Nova" });
    await store.corrigirEstimativa(id, "NN", { o: 1, m: 1, p: 2 });
    assert.equal((await store.lerAcao(id, "NN")).estimativas.length, 1);
  });

  it("registra e desfaz a conclusão, sem aceitar data futura", async () => {
    const { store, id } = await novo();
    await assert.rejects(store.concluir(id, "AA", "2026-10-21"), { codigo: "data-futura" });
    await assert.rejects(store.concluir(id, "AA", ""), { codigo: "data-invalida" });
    await store.concluir(id, "AA", "2026-10-19");
    assert.equal((await store.lerAcao(id, "AA")).concluidaEm, "2026-10-19");
    await store.desfazerConclusao(id, "AA");
    assert.equal((await store.lerAcao(id, "AA")).concluidaEm, null);
  });
});
