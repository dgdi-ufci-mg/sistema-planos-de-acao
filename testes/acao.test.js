/** Testes das regras da janela da ação (js/acao.js) e das operações do Store usadas por ela. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimativaLivre, dependentes, anterioresPossiveis, buscar, resumoDasEstimativas, pendencias, normalizarCodigo, problemaDoCodigo, sugerirCodigo } from "../js/acao.js";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";

const est = (o, m, p, em, contaDe = "liberacao") => ({ o, m, p, em, contaDe });
const A = { numero: 1, dependeDe: [] };
const B = { numero: 2, dependeDe: [1] };
const C = { numero: 3, dependeDe: [2] };
const D = { numero: 4, dependeDe: [] };

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
    assert.deepEqual([...dependentes(acoes, 1)].sort(), [2, 3]);
    assert.deepEqual(anterioresPossiveis(acoes, 1).map((a) => a.numero), [4]);
    assert.deepEqual(anterioresPossiveis(acoes, 3).map((a) => a.numero), [1, 4]);
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
    const acoes = [{ ...A, concluidaEm: "2026-10-01" }, { ...D }, { numero: 5, dependeDe: [1, 4], naoAntesDe: "2026-11-01" }];
    assert.deepEqual(pendencias(acoes[2], acoes, "2026-10-20"), { anteriores: [4], dataMinima: "2026-11-01" });
    assert.deepEqual(pendencias(acoes[2], acoes, "2026-11-05"), { anteriores: [4], dataMinima: null });
  });
});

describe("Código de uma ação nova", () => {
  it("normaliza o que foi digitado: maiúsculas, sem acentos, espaços ou sinais", () => {
    assert.equal(normalizarCodigo(" pé-1 "), "PE1");
  });

  it("aponta código fora do padrão ou ocupado", () => {
    assert.equal(problemaDoCodigo("LEV", []), "");
    assert.match(problemaDoCodigo("L", []), /2 a 8/);
    assert.match(problemaDoCodigo("ABCDEFGHI", []), /2 a 8/);
    assert.match(problemaDoCodigo("LEV", ["LEV"]), /Já existe/);
  });

  it("sugere as iniciais das palavras que contam e, se ocupado, acrescenta um número", () => {
    assert.equal(sugerirCodigo("Publicar o edital de seleção", []), "PES");
    assert.equal(sugerirCodigo("Publicar o edital de seleção", ["PES"]), "PE2");
    assert.equal(sugerirCodigo("Publicar o edital de seleção", ["PES", "PE2"]), "PE3");
    assert.equal(sugerirCodigo("Homologar", []), "HOM");
    assert.equal(sugerirCodigo("", []), "ACA");
    assert.equal(problemaDoCodigo(sugerirCodigo("Ação número 1", []), []), "");
  });
});

describe("Janela da ação: operações do Store", async () => {
  const novo = async () => {
    const store = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", hoje: () => "2026-10-20" });
    const id = await store.criarEspaco({ nome: "P", inicio: "2026-10-01" });
    // ações 1 ← 2 ← 3 (a 2 depende da 1, a 3 depende da 2); a 1 tem o código AA
    for (const [rotulo, dependeDe, extra] of [["Um", [], { codigo: "AA" }], ["Dois", [1]], ["Três", [2]]]) {
      await store.criarAcao(id, { rotulo, dependeDe, estimativas: [est(1, 2, 3, "2026-10-01")], ...extra });
    }
    return { store, id };
  };

  it("acrescenta e retira dependências, recusando ciclo, a própria ação e código inexistente", async () => {
    const { store, id } = await novo();
    await assert.rejects(store.acrescentarDependencia(id, 1, 3), { codigo: "ciclo" });
    await assert.rejects(store.acrescentarDependencia(id, 1, 1), { codigo: "ciclo" });
    await assert.rejects(store.acrescentarDependencia(id, 1, 99), { codigo: "nao-encontrado" });
    await store.acrescentarDependencia(id, 3, 1);
    assert.deepEqual((await store.lerAcao(id, 3)).dependeDe, [2, 1]);
    await store.retirarDependencia(id, 3, 2);
    const c = await store.lerAcao(id, 3);
    assert.deepEqual(c.dependeDe, [1]);
    assert.equal(c.alteradaPor, "ana@ufci.edu.br");
  });

  it("acrescenta e retira responsáveis, mantendo os tons do espaço", async () => {
    const { store, id } = await novo();
    const ana = await store.criarResponsavel(id, { tipo: "pessoa", nome: "Ana Souza" });
    await store.acrescentarResponsavelNaAcao(id, 1, ana);
    assert.deepEqual((await store.lerAcao(id, 1)).responsaveis, [ana]);
    assert.equal((await store.lerEspaco(id)).tons[ana], 1);
    await store.retirarResponsavelDaAcao(id, 1, ana);
    assert.deepEqual((await store.lerEspaco(id)).tons, {});
  });

  it("reestima a partir de hoje, no fim do histórico, e valida os três pontos", async () => {
    const { store, id } = await novo();
    await store.reestimar(id, 1, { o: 2, m: 3, p: 5, motivo: " Atraso do fornecedor " });
    const ultima = (await store.lerAcao(id, 1)).estimativas.at(-1);
    assert.deepEqual(ultima, { em: "2026-10-20", por: "ana@ufci.edu.br", o: 2, m: 3, p: 5, contaDe: "data", motivo: "Atraso do fornecedor" });
    await assert.rejects(store.reestimar(id, 1, { o: 5, m: 3, p: 6 }), { codigo: "estimativa-fora-de-ordem" });
    await assert.rejects(store.reestimar(id, 1, { o: 0, m: 0, p: 0 }), { codigo: "estimativa-zerada" });
    await assert.rejects(store.reestimar(id, 1, { o: -1, m: 1, p: 2 }), { codigo: "estimativa-invalida" });
    await assert.rejects(store.reestimar(id, 1, { o: 1, m: 2.5, p: 4 }), { codigo: "estimativa-fracionada" });
    await assert.rejects(store.corrigirEstimativa(id, 1, { o: 0.5, m: 1, p: 2 }), { codigo: "estimativa-fracionada" });
  });

  it("corrige a estimativa sem criar histórico e cria a primeira quando não há", async () => {
    const { store, id } = await novo();
    await store.corrigirEstimativa(id, 1, { o: 4, m: 5, p: 9 });
    const lista = (await store.lerAcao(id, 1)).estimativas;
    assert.equal(lista.length, 1);
    assert.deepEqual([lista[0].o, lista[0].m, lista[0].p, lista[0].contaDe], [4, 5, 9, "liberacao"]);
    const nova = await store.criarAcao(id, { rotulo: "Nova" });
    await store.corrigirEstimativa(id, nova, { o: 1, m: 1, p: 2 });
    assert.equal((await store.lerAcao(id, nova)).estimativas.length, 1);
  });

  it("ação nova: número seguinte, sem código obrigatório; recusa estimativa inválida, anterior inexistente e código ocupado", async () => {
    const { store, id } = await novo();
    await assert.rejects(store.criarAcao(id, { rotulo: "x", estimativas: [est(3, 2, 1, "2026-10-20")] }), { codigo: "estimativa-fora-de-ordem" });
    await assert.rejects(store.criarAcao(id, { rotulo: "x", dependeDe: [99] }), { codigo: "nao-encontrado" });
    await assert.rejects(store.criarAcao(id, { codigo: "AA", rotulo: "x" }), { codigo: "codigo-ocupado" });
    await assert.rejects(store.criarAcao(id, { numero: 50, rotulo: "x" }), { codigo: "campo-fixo" });
    const n = await store.criarAcao(id, { rotulo: "x", dependeDe: [3], estimativas: [est(1, 2, 4, "2026-10-20")] });
    const acao = await store.lerAcao(id, n);
    assert.deepEqual([acao.numero, acao.ordem, acao.codigo], [4, 4, undefined]);
  });

  it("código mnemônico: opcional, pode mudar, mas não repetir nem fugir do padrão", async () => {
    const { store, id } = await novo();
    await store.alterarAcao(id, 2, { codigo: "BB" });
    await assert.rejects(store.alterarAcao(id, 3, { codigo: "BB" }), { codigo: "codigo-ocupado" });
    await assert.rejects(store.alterarAcao(id, 3, { codigo: "b-1" }), { codigo: "codigo-invalido" });
    await store.alterarAcao(id, 2, { codigo: "BX" });
    await store.alterarAcao(id, 3, { codigo: "BB" });
    assert.equal((await store.lerAcao(id, 3)).codigo, "BB");
  });

  it("registra e desfaz a conclusão, sem aceitar data futura", async () => {
    const { store, id } = await novo();
    await assert.rejects(store.concluir(id, 1, "2026-10-21"), { codigo: "data-futura" });
    await assert.rejects(store.concluir(id, 1, ""), { codigo: "data-invalida" });
    await store.concluir(id, 1, "2026-10-19");
    assert.equal((await store.lerAcao(id, 1)).concluidaEm, "2026-10-19");
    await store.desfazerConclusao(id, 1);
    assert.equal((await store.lerAcao(id, 1)).concluidaEm, null);
  });
});
