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
    const acao = (numero, extra = {}) => ({ numero, rotulo: `Ação ${numero}`, ordem: numero, ...extra });

    it("cria, lê e lista espaços", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      assert.equal((await banco.lerEspaco("p1")).nome, "Espaço 1");
      assert.equal((await banco.listarEspacos()).length, 1);
      assert.equal(await banco.lerEspaco("nao-existe"), null);
    });

    it("não cria ação com número já usado no espaço", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao(1));
      await assert.rejects(banco.criarAcao("p1", acao(1)), { codigo: "numero-ocupado" });
    });

    it("reserva números em sequência, sem repetir, mesmo ao mesmo tempo", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarEspaco("p2", { nome: "Espaço 2" });
      const numeros = await Promise.all([1, 2, 3].map(() => banco.reservarNumero("p1")));
      assert.deepEqual([...numeros].sort(), [1, 2, 3]);
      assert.equal(await banco.reservarNumero("p1"), 4);
      assert.equal(await banco.reservarNumero("p2"), 1);
    });

    it("aceita o mesmo número em espaços diferentes", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarEspaco("p2", { nome: "Espaço 2" });
      await banco.criarAcao("p1", acao(1));
      await banco.criarAcao("p2", acao(1));
      assert.equal((await banco.listarAcoes("p2")).length, 1);
    });

    it("alterar uma ação grava só os campos informados", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao(1, { descricao: "original" }));
      await banco.alterarAcao("p1", 1, { rotulo: "Novo rótulo" });
      const lida = await banco.lerAcao("p1", 1);
      assert.equal(lida.rotulo, "Novo rótulo");
      assert.equal(lida.descricao, "original");
    });

    it("quem lê recebe uma cópia, e não o dado guardado", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao(1, { dependeDe: [] }));
      const lida = await banco.lerAcao("p1", 1);
      lida.dependeDe.push("XYZ");
      assert.deepEqual((await banco.lerAcao("p1", 1)).dependeDe, []);
    });

    it("avisa quem acompanha o espaço a cada mudança, e para quando pedido", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      const avisos = [];
      const parar = banco.acompanharEspaco("p1", (foto) => avisos.push(foto.acoes.length));
      await banco.criarAcao("p1", acao(1));
      parar();
      await banco.criarAcao("p1", acao(2));
      assert.deepEqual(avisos, [0, 1]);
    });

    it("listas: acrescentar e retirar item a item, sem perder o que outra pessoa acrescentou", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao(1, { responsaveis: ["a"] }));
      await Promise.all([
        banco.acrescentarNaLista("p1", 1, "responsaveis", ["b"]),
        banco.acrescentarNaLista("p1", 1, "responsaveis", ["c"]),
      ]);
      await banco.acrescentarNaLista("p1", 1, "responsaveis", ["a"], { alteradaPor: "x" });
      let lida = await banco.lerAcao("p1", 1);
      assert.deepEqual([...lida.responsaveis].sort(), ["a", "b", "c"]);
      assert.equal(lida.alteradaPor, "x");
      await banco.retirarDaLista("p1", 1, "responsaveis", ["b"]);
      lida = await banco.lerAcao("p1", 1);
      assert.deepEqual([...lida.responsaveis].sort(), ["a", "c"]);
    });

    it("estimativas: acrescenta no fim e só corrige a última se ninguém acrescentou outra", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao(1, { estimativas: [{ o: 1, m: 2, p: 3 }] }));
      await banco.trocarUltimaEstimativa("p1", 1, { o: 2, m: 3, p: 4 }, 1);
      await banco.acrescentarEstimativa("p1", 1, { o: 5, m: 6, p: 7 });
      assert.deepEqual((await banco.lerAcao("p1", 1)).estimativas.map((e) => e.o), [2, 5]);
      await assert.rejects(banco.trocarUltimaEstimativa("p1", 1, { o: 9, m: 9, p: 9 }, 1), { codigo: "estimativa-mudou" });
      assert.deepEqual((await banco.lerAcao("p1", 1)).estimativas.map((e) => e.o), [2, 5]);
    });

    it("avisa quem acompanha qualquer espaço quando um responsável é criado ou alterado", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      let avisos = 0;
      const parar = banco.acompanharEspaco("p1", () => avisos++);
      await banco.criarResponsavel("r1", { nome: "Ana", tipo: "pessoa" });
      await banco.alterarResponsavel("r1", { sigla: "ANA" });
      parar();
      assert.equal(avisos, 3); // ao começar a acompanhar, ao criar e ao alterar
    });

    it("guarda o calendário geral e avisa todos os espaços acompanhados", async () => {
      const banco = criarBanco();
      assert.equal(await banco.lerCalendarioGeral(), null);
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      let avisos = 0;
      const parar = banco.acompanharEspaco("p1", () => avisos++);
      await banco.gravarCalendarioGeral({ datasExcluidas: [{ data: "2027-04-21", motivo: "Tiradentes" }] });
      parar();
      assert.equal((await banco.lerCalendarioGeral()).datasExcluidas[0].data, "2027-04-21");
      assert.equal(avisos, 2);
    });

    it("recusa alterar o que não existe", async () => {
      const banco = criarBanco();
      await assert.rejects(banco.alterarEspaco("nao-existe", { nome: "x" }), { codigo: "nao-encontrado" });
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await assert.rejects(banco.alterarAcao("p1", 99, { rotulo: "x" }), { codigo: "nao-encontrado" });
    });
  });
}
