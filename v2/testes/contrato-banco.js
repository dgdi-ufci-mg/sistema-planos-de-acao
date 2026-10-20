/**
 * Contrato dos bancos: as garantias que todo banco precisa cumprir.
 * O banco em memória roda estes testes hoje; o Firebase (passo 1.14) e o
 * PostgreSQL (Fase 4) vão rodar os mesmos (especificação, seção 3.4).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * @param {string} nome
 * @param {() => any} criarBanco devolve um banco novo e vazio a cada chamada
 */
export function testarContratoDoBanco(nome, criarBanco) {
  describe(`Contrato do banco: ${nome}`, () => {
    const acao = (codigo, extra = {}) => ({ codigo, rotulo: `Ação ${codigo}`, ordem: 1, ...extra });

    it("cria, lê e lista espaços", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      assert.equal((await banco.lerEspaco("p1")).nome, "Espaço 1");
      assert.equal((await banco.listarEspacos()).length, 1);
      assert.equal(await banco.lerEspaco("nao-existe"), null);
    });

    it("não cria ação com código já usado no espaço", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao("LEV"));
      await assert.rejects(banco.criarAcao("p1", acao("LEV")), { codigo: "codigo-ocupado" });
    });

    it("aceita o mesmo código em espaços diferentes", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarEspaco("p2", { nome: "Espaço 2" });
      await banco.criarAcao("p1", acao("LEV"));
      await banco.criarAcao("p2", acao("LEV"));
      assert.equal((await banco.listarAcoes("p2")).length, 1);
    });

    it("alterar uma ação grava só os campos informados", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao("LEV", { descricao: "original" }));
      await banco.alterarAcao("p1", "LEV", { rotulo: "Novo rótulo" });
      const lida = await banco.lerAcao("p1", "LEV");
      assert.equal(lida.rotulo, "Novo rótulo");
      assert.equal(lida.descricao, "original");
    });

    it("quem lê recebe uma cópia, e não o dado guardado", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao("LEV", { dependeDe: [] }));
      const lida = await banco.lerAcao("p1", "LEV");
      lida.dependeDe.push("XYZ");
      assert.deepEqual((await banco.lerAcao("p1", "LEV")).dependeDe, []);
    });

    it("avisa quem acompanha o espaço a cada mudança, e para quando pedido", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      const avisos = [];
      const parar = banco.acompanharEspaco("p1", (foto) => avisos.push(foto.acoes.length));
      await banco.criarAcao("p1", acao("LEV"));
      parar();
      await banco.criarAcao("p1", acao("REQ"));
      assert.deepEqual(avisos, [0, 1]);
    });

    it("listas: acrescentar e retirar item a item, sem perder o que outra pessoa acrescentou", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao("LEV", { responsaveis: ["a"] }));
      await Promise.all([
        banco.acrescentarNaLista("p1", "LEV", "responsaveis", ["b"]),
        banco.acrescentarNaLista("p1", "LEV", "responsaveis", ["c"]),
      ]);
      await banco.acrescentarNaLista("p1", "LEV", "responsaveis", ["a"], { alteradaPor: "x" });
      let lida = await banco.lerAcao("p1", "LEV");
      assert.deepEqual([...lida.responsaveis].sort(), ["a", "b", "c"]);
      assert.equal(lida.alteradaPor, "x");
      await banco.retirarDaLista("p1", "LEV", "responsaveis", ["b"]);
      lida = await banco.lerAcao("p1", "LEV");
      assert.deepEqual([...lida.responsaveis].sort(), ["a", "c"]);
    });

    it("estimativas: acrescenta no fim e só corrige a última se ninguém acrescentou outra", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao("LEV", { estimativas: [{ o: 1, m: 2, p: 3 }] }));
      await banco.trocarUltimaEstimativa("p1", "LEV", { o: 2, m: 3, p: 4 }, 1);
      await banco.acrescentarEstimativa("p1", "LEV", { o: 5, m: 6, p: 7 });
      assert.deepEqual((await banco.lerAcao("p1", "LEV")).estimativas.map((e) => e.o), [2, 5]);
      await assert.rejects(banco.trocarUltimaEstimativa("p1", "LEV", { o: 9, m: 9, p: 9 }, 1), { codigo: "estimativa-mudou" });
      assert.deepEqual((await banco.lerAcao("p1", "LEV")).estimativas.map((e) => e.o), [2, 5]);
    });

    it("recusa alterar o que não existe", async () => {
      const banco = criarBanco();
      await assert.rejects(banco.alterarEspaco("nao-existe", { nome: "x" }), { codigo: "nao-encontrado" });
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await assert.rejects(banco.alterarAcao("p1", "NADA", { rotulo: "x" }), { codigo: "nao-encontrado" });
    });
  });
}
