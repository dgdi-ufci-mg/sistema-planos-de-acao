/**
 * Contrato dos bancos: as garantias que todo banco precisa cumprir.
 * O banco em memória roda estes testes hoje; o Firebase (passo 1.14) e o
 * PostgreSQL (Fase 4) vão rodar os mesmos (documentação técnica, seção 3.4).
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

    it("checklist: mudanças simultâneas em itens diferentes não se apagam (passo 2.8)", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao(1, { checklist: [{ id: "a", texto: "A", feito: false }, { id: "b", texto: "B", feito: false }] }));
      await Promise.all([
        banco.mudarChecklist("p1", 1, (l) => l.map((i) => (i.id === "a" ? { ...i, feito: true } : i))),
        banco.mudarChecklist("p1", 1, (l) => [...l, { id: "c", texto: "C", feito: false }]),
        banco.mudarChecklist("p1", 1, (l) => l.map((i) => (i.id === "b" ? { ...i, texto: "B2" } : i)), { alteradaPor: "x" }),
      ]);
      const lida = await banco.lerAcao("p1", 1);
      assert.deepEqual(lida.checklist, [{ id: "a", texto: "A", feito: true }, { id: "b", texto: "B2", feito: false }, { id: "c", texto: "C", feito: false }]);
      await assert.rejects(banco.mudarChecklist("p1", 9, (l) => l), { codigo: "nao-encontrado" });
    });

    it("estratégia: modelo e coleções do catálogo; criar não sobrescreve; mudar lê e grava de uma vez (passo 2.5)", async () => {
      const banco = criarBanco();
      assert.equal(await banco.lerModeloEstrategia(), null);
      await banco.gravarModeloEstrategia({ camadas: [{ id: "a", nome: "A", plural: "As", opcional: false }] });
      assert.equal((await banco.lerModeloEstrategia()).camadas[0].id, "a");
      await banco.criarNaColecao("itensEstrategicos", "i1", { camada: "a", nome: "Um", superiores: [] });
      await assert.rejects(banco.criarNaColecao("itensEstrategicos", "i1", { nome: "Outro" }), { codigo: "id-ocupado" });
      await Promise.all([
        banco.mudarNaColecao("itensEstrategicos", "i1", (x) => ({ superiores: [...x.superiores, "s1"] })),
        banco.mudarNaColecao("itensEstrategicos", "i1", (x) => ({ superiores: [...x.superiores, "s2"] })),
      ]);
      const [lido] = await banco.listarColecao("itensEstrategicos");
      assert.deepEqual([...lido.superiores].sort(), ["s1", "s2"]);
      assert.equal(lido.id, "i1");
      await assert.rejects(banco.mudarNaColecao("instrumentos", "x", () => ({})), { codigo: "nao-encontrado" });
    });

    it("documentos da ação: mudanças simultâneas em itens diferentes não se apagam (passo 2.10a)", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarAcao("p1", acao(1, { documentos: [{ id: "a", nome: "A" }] }));
      await Promise.all([
        banco.mudarDocumentos("p1", 1, (l) => l.map((d) => (d.id === "a" ? { ...d, link: "https://a" } : d))),
        banco.mudarDocumentos("p1", 1, (l) => [...l, { id: "b", nome: "B" }]),
      ]);
      assert.deepEqual((await banco.lerAcao("p1", 1)).documentos, [{ id: "a", nome: "A", link: "https://a" }, { id: "b", nome: "B" }]);
      await assert.rejects(banco.mudarDocumentos("p1", 9, (l) => l), { codigo: "nao-encontrado" });
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

    it("responsáveis são de cada espaço: avisa só quem acompanha aquele espaço", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarEspaco("p2", { nome: "Espaço 2" });
      let avisos = 0;
      let outros = 0;
      let ultima = null;
      const parar = banco.acompanharEspaco("p1", (foto) => { avisos++; ultima = foto; });
      const parar2 = banco.acompanharEspaco("p2", () => outros++);
      await new Promise((r) => setTimeout(r, 0));
      await banco.criarResponsavel("p1", "r1", { nome: "Ana", tipo: "pessoa" });
      await banco.alterarResponsavel("p1", "r1", { sigla: "ANA" });
      await new Promise((r) => setTimeout(r, 0));
      parar(); parar2();
      assert.equal(avisos, 3); // ao começar a acompanhar, ao criar e ao alterar
      assert.equal(outros, 1); // só ao começar
      assert.deepEqual(ultima.responsaveis.map((r) => r.sigla), ["ANA"]);
      assert.deepEqual(await banco.listarResponsaveis("p2"), []);
      await assert.rejects(banco.alterarResponsavel("p2", "r1", { sigla: "X" }), { codigo: "nao-encontrado" });
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

    it("grava o histórico junto com a mudança da ação, e nada se a mudança falhar (passo 1.16)", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      let n = 0;
      const historico = (antes, depois) => [{ id: `r${++n}`, chave: depois.numero, antes: antes?.rotulo ?? null, depois: depois.rotulo, em: `2026-10-21T00:00:0${n}Z` }];
      await banco.criarAcao("p1", acao(1, { estimativas: [{ o: 1, m: 2, p: 3 }] }), historico);
      await banco.alterarAcao("p1", 1, { rotulo: "Outro" }, historico);
      await banco.acrescentarNaLista("p1", 1, "dependeDe", [7], {}, historico);
      await assert.rejects(banco.trocarUltimaEstimativa("p1", 1, { o: 1, m: 1, p: 1 }, 5, {}, historico), { codigo: "estimativa-mudou" });
      await assert.rejects(banco.alterarAcao("p1", 2, { rotulo: "x" }, historico), { codigo: "nao-encontrado" });
      const rs = (await banco.listarHistorico("p1", 1)).sort((a, b) => a.em.localeCompare(b.em));
      assert.deepEqual(rs.map((r) => [r.antes, r.depois]), [[null, "Ação 1"], ["Ação 1", "Outro"], ["Outro", "Outro"]]);
      assert.equal((await banco.listarHistoricoDoEspaco("p1")).length, 3);
      assert.deepEqual(await banco.listarHistorico("p1", 2), []);
    });

    it("retrato: grava cabeçalho e ações de uma vez, sem repetir o id (passo 1.18)", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      await banco.criarRetrato("p1", { id: "r1", nome: "Base", criadoEm: "2026-10-21T00:00:00Z" }, [acao(1), acao(2)]);
      await assert.rejects(banco.criarRetrato("p1", { id: "r1", nome: "Outro" }, []), { codigo: "id-ocupado" });
      await assert.rejects(banco.criarRetrato("nao-existe", { id: "r2", nome: "X" }, []), { codigo: "nao-encontrado" });
      assert.deepEqual((await banco.listarRetratos("p1")).map((r) => r.nome), ["Base"]);
      assert.deepEqual((await banco.listarAcoesDoRetrato("p1", "r1")).map((a) => a.numero).sort(), [1, 2]);
      assert.deepEqual(await banco.listarAcoesDoRetrato("p1", "r9"), []);
    });

    it("comentários: cria, lista por ação, muda e avisa quem acompanha (passo 2.9)", async () => {
      const banco = criarBanco();
      await banco.criarEspaco("p1", { nome: "Espaço 1" });
      const c = (id, acaoN, texto) => ({ id, acao: acaoN, autor: "ana@ufci.edu.br", texto, criadoEm: `2026-10-23T10:0${id.at(-1)}:00Z`, versoes: [] });
      const vistos = [];
      const parar = banco.acompanharComentarios("p1", 1, (lista) => vistos.push(lista.map((x) => x.texto).sort()));
      await banco.criarComentario("p1", c("c1", 1, "Primeiro"));
      await banco.criarComentario("p1", c("c2", 2, "De outra ação"));
      await assert.rejects(banco.criarComentario("p1", c("c1", 1, "Repetido")), { codigo: "id-ocupado" });
      await banco.mudarComentario("p1", "c1", (atual) => ({ texto: `${atual.texto} (editado)` }));
      await assert.rejects(banco.mudarComentario("p1", "c9", () => ({})), { codigo: "nao-encontrado" });
      assert.deepEqual((await banco.listarComentarios("p1", 1)).map((x) => x.texto), ["Primeiro (editado)"]);
      assert.equal((await banco.listarComentariosDoEspaco("p1")).length, 2);
      await new Promise((r) => setTimeout(r, 10));
      parar();
      assert.deepEqual(vistos.at(-1), ["Primeiro (editado)"]);
    });
  });
}
