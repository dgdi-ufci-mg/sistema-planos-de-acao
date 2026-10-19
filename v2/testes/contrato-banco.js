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

    it("cria, lê e lista planos", async () => {
      const banco = criarBanco();
      await banco.criarPlano("p1", { nome: "Plano 1" });
      assert.equal((await banco.lerPlano("p1")).nome, "Plano 1");
      assert.equal((await banco.listarPlanos()).length, 1);
      assert.equal(await banco.lerPlano("nao-existe"), null);
    });

    it("não cria ação com código já usado no plano", async () => {
      const banco = criarBanco();
      await banco.criarPlano("p1", { nome: "Plano 1" });
      await banco.criarAcao("p1", acao("LEV"));
      await assert.rejects(banco.criarAcao("p1", acao("LEV")), { codigo: "codigo-ocupado" });
    });

    it("aceita o mesmo código em planos diferentes", async () => {
      const banco = criarBanco();
      await banco.criarPlano("p1", { nome: "Plano 1" });
      await banco.criarPlano("p2", { nome: "Plano 2" });
      await banco.criarAcao("p1", acao("LEV"));
      await banco.criarAcao("p2", acao("LEV"));
      assert.equal((await banco.listarAcoes("p2")).length, 1);
    });

    it("alterar uma ação grava só os campos informados", async () => {
      const banco = criarBanco();
      await banco.criarPlano("p1", { nome: "Plano 1" });
      await banco.criarAcao("p1", acao("LEV", { descricao: "original" }));
      await banco.alterarAcao("p1", "LEV", { rotulo: "Novo rótulo" });
      const lida = await banco.lerAcao("p1", "LEV");
      assert.equal(lida.rotulo, "Novo rótulo");
      assert.equal(lida.descricao, "original");
    });

    it("quem lê recebe uma cópia, e não o dado guardado", async () => {
      const banco = criarBanco();
      await banco.criarPlano("p1", { nome: "Plano 1" });
      await banco.criarAcao("p1", acao("LEV", { dependeDe: [] }));
      const lida = await banco.lerAcao("p1", "LEV");
      lida.dependeDe.push("XYZ");
      assert.deepEqual((await banco.lerAcao("p1", "LEV")).dependeDe, []);
    });

    it("avisa quem acompanha o plano a cada mudança, e para quando pedido", async () => {
      const banco = criarBanco();
      await banco.criarPlano("p1", { nome: "Plano 1" });
      const avisos = [];
      const parar = banco.acompanharPlano("p1", (foto) => avisos.push(foto.acoes.length));
      await banco.criarAcao("p1", acao("LEV"));
      parar();
      await banco.criarAcao("p1", acao("REQ"));
      assert.deepEqual(avisos, [0, 1]);
    });

    it("recusa alterar o que não existe", async () => {
      const banco = criarBanco();
      await assert.rejects(banco.alterarPlano("nao-existe", { nome: "x" }), { codigo: "nao-encontrado" });
      await banco.criarPlano("p1", { nome: "Plano 1" });
      await assert.rejects(banco.alterarAcao("p1", "NADA", { rotulo: "x" }), { codigo: "nao-encontrado" });
    });
  });
}
