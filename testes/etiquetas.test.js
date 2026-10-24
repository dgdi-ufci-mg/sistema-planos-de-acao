/** Etiquetas (passo 2.10a; documentação técnica, seções 4.1.9 e 16.8). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { descreverRegistro } from "../js/historico.js";
import { filtrar } from "../js/lista.js";
import { CORES_ETIQUETA, proximaCor, etiquetasDaAcao, etiquetaPorNome, problemaDasEtiquetas, usaEtiquetas, tomDaCor } from "../js/etiquetas.js";
import { planejarImportacao } from "../js/importar.js";
import { planilhaDoEspaco } from "../js/exportar.js";

describe("Etiquetas: regras", () => {
  it("desligadas por padrão; cor sugerida é a menos usada, na ordem da lista", () => {
    assert.equal(usaEtiquetas({}), false);
    assert.equal(usaEtiquetas({ camposOpcionais: { etiquetas: true } }), true);
    assert.equal(proximaCor({}), "verde");
    assert.equal(proximaCor({ etiquetas: [{ id: "a", nome: "A", cor: "verde" }] }), "azul");
    const todas = CORES_ETIQUETA.map(([cor], i) => ({ id: `t${i}`, nome: `T${i}`, cor }));
    assert.equal(proximaCor({ etiquetas: [...todas, { id: "x", nome: "X", cor: "verde" }] }), "azul");
    assert.equal(tomDaCor("lilas"), 4);
    assert.equal(tomDaCor("inexistente"), 6);
  });

  it("a ação mostra as etiquetas na ordem do catálogo, sem as retiradas", () => {
    const espaco = { etiquetas: [{ id: "a", nome: "Compras", cor: "verde" }, { id: "b", nome: "TI", cor: "azul" }] };
    assert.deepEqual(etiquetasDaAcao(espaco, { etiquetas: ["b", "sumiu", "a"] }).map((e) => e.nome), ["Compras", "TI"]);
    assert.equal(etiquetaPorNome(espaco, "  compras ").id, "a");
    assert.equal(etiquetaPorNome(espaco, "outra"), null);
  });

  it("recusa nome vazio, longo ou repetido, id repetido e cor desconhecida", () => {
    const ok = { id: "a", nome: "Compras", cor: "verde" };
    assert.equal(problemaDasEtiquetas({ etiquetas: [ok] }), null);
    assert.equal(problemaDasEtiquetas({ etiquetas: [{ ...ok, nome: " " }] }).codigo, "nome-vazio");
    assert.equal(problemaDasEtiquetas({ etiquetas: [{ ...ok, nome: "x".repeat(31) }] }).codigo, "nome-longo");
    assert.equal(problemaDasEtiquetas({ etiquetas: [ok, { ...ok, id: "b", nome: "COMPRAS" }] }).codigo, "nome-repetido");
    assert.equal(problemaDasEtiquetas({ etiquetas: [ok, { ...ok, nome: "Outra" }] }).codigo, "id-repetido");
    assert.equal(problemaDasEtiquetas({ etiquetas: [{ ...ok, cor: "#ff0000" }] }).codigo, "cor-invalida");
  });

  it("filtro por etiqueta", () => {
    const linhas = [{ acao: { responsaveis: [], etiquetas: ["a"] }, situacao: "liberada" }, { acao: { responsaveis: [] }, situacao: "liberada" }];
    assert.equal(filtrar(linhas, { etiqueta: "a" }).length, 1);
    assert.equal(filtrar(linhas, { etiqueta: "" }).length, 2);
  });
});

for (const [nome, criarBanco] of [
  ["memória", () => criarBancoLocal()],
  ["Firestore (falso)", () => criarBancoFirestore(criarFirestoreFalso())],
]) {
  describe(`Etiquetas no Store, banco em ${nome}`, () => {
    const novo = async () => {
      let relogio = 0;
      let n = 0;
      const store = criarStore(criarBanco(), {
        usuario: "ana@ufci.edu.br", hoje: () => "2026-10-24", novoId: () => `id${++n}`,
        agora: () => new Date(Date.UTC(2026, 9, 24, 10, 0, relogio++)).toISOString(),
      });
      const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
      const a = await store.criarAcao(id, { rotulo: "Primeira" });
      return { store, id, a };
    };

    it("cria no catálogo, com cor sugerida, e recusa nome repetido", async () => {
      const { store, id } = await novo();
      const t1 = await store.criarEtiqueta(id, { nome: " Compras " });
      await store.criarEtiqueta(id, { nome: "TI", cor: "rosa" });
      assert.deepEqual((await store.lerEspaco(id)).etiquetas, [{ id: t1, nome: "Compras", cor: "verde" }, { id: (await store.lerEspaco(id)).etiquetas[1].id, nome: "TI", cor: "rosa" }]);
      await assert.rejects(store.criarEtiqueta(id, { nome: "compras" }), { codigo: "nome-repetido" });
      await assert.rejects(store.alterarEtiqueta(id, t1, { cor: "preto" }), { codigo: "cor-invalida" });
      await store.alterarEtiqueta(id, t1, { nome: "Aquisições", cor: "laranja" });
      assert.deepEqual((await store.lerEspaco(id)).etiquetas[0], { id: t1, nome: "Aquisições", cor: "laranja" });
    });

    it("etiqueta a ação uma a uma; etiquetarAcao reaproveita pelo nome ou cria", async () => {
      const { store, id, a } = await novo();
      const t1 = await store.etiquetarAcao(id, a, "Compras");
      const t2 = await store.etiquetarAcao(id, a, "Urgente");
      assert.equal(await store.etiquetarAcao(id, a, "compras"), t1); // já existe e já está na ação
      assert.deepEqual((await store.lerAcao(id, a)).etiquetas, [t1, t2]);
      assert.equal((await store.lerEspaco(id)).etiquetas.length, 2);
      await store.retirarEtiquetaDaAcao(id, a, t1);
      assert.deepEqual((await store.lerAcao(id, a)).etiquetas, [t2]);
      await assert.rejects(store.acrescentarEtiquetaNaAcao(id, a, "sumiu"), { codigo: "nao-encontrado" });
      await assert.rejects(store.etiquetarAcao(id, a, " "), { codigo: "nome-vazio" });
      await assert.rejects(store.criarAcao(id, { rotulo: "X", etiquetas: ["sumiu"] }), { codigo: "nao-encontrado" });
      const b = await store.criarAcao(id, { rotulo: "Segunda", etiquetas: [t1] });
      assert.deepEqual((await store.lerAcao(id, b)).etiquetas, [t1]);
    });

    it("retirar do catálogo retira das ações e conta as ativas", async () => {
      const { store, id, a } = await novo();
      const t1 = await store.etiquetarAcao(id, a, "Compras");
      const b = await store.criarAcao(id, { rotulo: "Segunda", etiquetas: [t1] });
      await store.excluirAcao(id, b);
      assert.equal(await store.retirarEtiqueta(id, t1), 1);
      assert.deepEqual((await store.lerAcao(id, a)).etiquetas, []);
      assert.deepEqual((await store.lerAcao(id, b)).etiquetas, []);
      assert.deepEqual((await store.lerEspaco(id)).etiquetas, []);
    });

    it("cada mudança entra no histórico, com o nome da etiqueta", async () => {
      const { store, id, a } = await novo();
      const t1 = await store.etiquetarAcao(id, a, "Compras");
      await store.retirarEtiquetaDaAcao(id, a, t1);
      const espaco = await store.lerEspaco(id);
      const nomes = { etiqueta: (x) => espaco.etiquetas.find((e) => e.id === x)?.nome };
      const rs = (await store.listarHistorico(id, a)).filter((r) => r.campo === "etiquetas");
      assert.deepEqual(rs.map((r) => descreverRegistro(r, nomes)), ["Etiquetas: acrescentou “Compras”.", "Etiquetas: retirou “Compras”."]);
      assert.equal(descreverRegistro(rs[0], {}), "Etiquetas: acrescentou “etiqueta retirada”.");
    });

    it("sem login, não grava", async () => {
      const semLogin = criarStore(criarBanco(), { exigirLogin: true });
      await assert.rejects(semLogin.criarEtiqueta("x", { nome: "A" }), { codigo: "sem-login" });
      await assert.rejects(semLogin.etiquetarAcao("x", 1, "A"), { codigo: "sem-login" });
    });
  });
}

describe("Etiquetas: importação e exportação", () => {
  const espaco = { id: "e", nome: "E", inicio: "2026-10-01", camposOpcionais: { etiquetas: true }, etiquetas: [{ id: "t1", nome: "Compras", cor: "verde" }] };
  const plano = (texto, acoes = []) => planejarImportacao({ texto, espaco, acoes, responsaveis: [], hoje: "2026-10-24", situacaoDe: () => "liberada", modo: "atualizar" });

  it("lê os nomes separados por ponto e vírgula; as que faltam serão criadas", () => {
    const p = plano("Ação\tEtiquetas\nComprar\tcompras; Obras, reformas\nPintar\tobras, reformas;Compras");
    assert.deepEqual(p.etiquetasNovas, ["Obras, reformas"]);
    assert.deepEqual(p.linhas[0].campos.etiquetas, [{ id: "t1" }, { nova: 0 }]);
    assert.deepEqual(p.linhas[1].campos.etiquetas, [{ nova: 0 }, { id: "t1" }]);
  });

  it("na atualização, as mesmas etiquetas não mudam nada", () => {
    const acoes = [{ numero: 1, ordem: 1, rotulo: "Comprar", dependeDe: [], responsaveis: [], estimativas: [], etiquetas: ["t1"] }];
    assert.equal(plano("Ação\tEtiquetas\nComprar\tCompras", acoes).linhas[0].tipo, "ignorada");
  });

  it("o Store cria as novas, liga o campo e grava os ids", async () => {
    const store = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", hoje: () => "2026-10-24" });
    const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
    const p = planejarImportacao({ texto: "Ação\tEtiquetas\nComprar\tCompras; TI", espaco: await store.lerEspaco(id), acoes: [], responsaveis: [], hoje: "2026-10-24", situacaoDe: () => "liberada", modo: "criar" });
    await store.importarAcoes(id, p);
    const e = await store.lerEspaco(id);
    assert.equal(e.camposOpcionais.etiquetas, true);
    assert.deepEqual(e.etiquetas.map((x) => [x.nome, x.cor]), [["Compras", "verde"], ["TI", "azul"]]);
    const [acao] = await store.listarAcoes(id);
    assert.deepEqual(acao.etiquetas, e.etiquetas.map((x) => x.id));
  });

  it("a planilha exportada tem a coluna Etiquetas só com o campo ligado", () => {
    const acoes = [{ numero: 1, ordem: 1, rotulo: "Comprar", dependeDe: [], responsaveis: [], estimativas: [], etiquetas: ["t1"] }];
    const [titulos, linha] = planilhaDoEspaco({ espaco, acoes, responsaveis: [], geral: {}, hoje: "2026-10-24" }).split("\n").map((l) => l.split("\t"));
    const i = titulos.indexOf("Etiquetas");
    assert.ok(i > 0);
    assert.equal(linha[i], "Compras");
    const sem = planilhaDoEspaco({ espaco: { ...espaco, camposOpcionais: {} }, acoes, responsaveis: [], geral: {}, hoje: "2026-10-24" });
    assert.ok(!sem.split("\n")[0].includes("Etiquetas"));
  });
});
