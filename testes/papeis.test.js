/** Papéis por espaço e espaço aberto ou fechado (passo 2.1; documentação técnica, seções 4.1.10 e 16.3). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { permissoes, acessosAoAssumir, problemaDosAcessos, papelDe } from "../js/papeis.js";

describe("Papéis: regras", () => {
  const espaco = {
    acessos: {
      "ana@x.br": { papel: "administrador", responsavel: null },
      "bia@x.br": { papel: "usuario", responsavel: "rb" },
      "caio@x.br": { papel: "leitor", responsavel: "rc" },
    },
  };
  it("cada papel pode o que a seção 16.3 diz", () => {
    const [adm, usu, lei, nada] = ["ana@x.br", "bia@x.br", "caio@x.br", "zé@x.br"].map((e) => permissoes(espaco, e));
    assert.deepEqual([adm.configurar, usu.configurar, lei.configurar, nada.configurar], [true, false, false, false]);
    assert.deepEqual([adm.criarAcao, usu.criarAcao], [true, false]);
    assert.deepEqual([adm.atualizar({}), usu.atualizar({ responsaveis: [] }), lei.atualizar({}), nada.atualizar({})], [true, true, false, false]);
    assert.deepEqual([adm.comentar, usu.comentar, lei.comentar, nada.comentar], [true, true, true, false]);
    assert.deepEqual([adm.apagarComentarioAlheio, usu.apagarComentarioAlheio], [true, false]);
    assert.equal(papelDe(espaco, " BIA@x.br "), "usuario");
  });
  it("fechado: o usuário atualiza só as ações em que é responsável, e não reordena a prioridade", () => {
    const usu = permissoes({ ...espaco, fechado: true }, "bia@x.br");
    assert.equal(usu.atualizar({ responsaveis: ["rb"] }), true);
    assert.equal(usu.atualizar({ responsaveis: ["outro"] }), false);
    assert.equal(usu.priorizar, false);
    assert.equal(permissoes({ ...espaco, fechado: true }, "ana@x.br").atualizar({ responsaveis: [] }), true);
  });
  it("sem administração (espaço antigo): quem tem login pode tudo; sem login, nada", () => {
    assert.equal(permissoes({}, "qualquer@x.br").configurar, true);
    assert.equal(permissoes({}, null).configurar, false);
  });
  it("assumir: quem assume vira administrador; as pessoas com e-mail, usuárias", () => {
    const resp = [{ id: "r1", tipo: "pessoa", usuario: "bia@x.br" }, { id: "r2", tipo: "pessoa", usuario: "ana@x.br" }, { id: "r3", tipo: "unidade" }];
    assert.deepEqual(acessosAoAssumir("ANA@x.br", resp), {
      "bia@x.br": { papel: "usuario", responsavel: "r1" },
      "ana@x.br": { papel: "administrador", responsavel: "r2" },
    });
  });
  it("recusa acessos sem administrador, papel desconhecido ou e-mail fora do padrão", () => {
    assert.equal(problemaDosAcessos(espaco), null);
    assert.equal(problemaDosAcessos({ acessos: { "bia@x.br": { papel: "usuario" } } }).codigo, "sem-administrador");
    assert.equal(problemaDosAcessos({ acessos: { "ana@x.br": { papel: "dono" } } }).codigo, "papel-invalido");
    assert.equal(problemaDosAcessos({ acessos: { "Ana@x.br": { papel: "administrador" } } }).codigo, "login-invalido");
  });
});

for (const [nome, criarBanco] of [
  ["memória", () => criarBancoLocal()],
  ["Firestore (falso)", () => criarBancoFirestore(criarFirestoreFalso())],
]) {
  describe(`Papéis no Store, banco em ${nome}`, () => {
    async function cenario({ fechado = false } = {}) {
      const banco = criarBanco();
      let n = 0;
      const opcoes = { exigirLogin: true, hoje: () => "2026-10-24", novoId: () => `id${++n}` };
      const como = (email) => criarStore(banco, { ...opcoes, usuario: email });
      const ana = como("ana@ufci.edu.br");
      const id = await ana.criarEspaco({ nome: "E", inicio: "2026-10-01" });
      const rBia = await ana.criarResponsavel(id, { tipo: "pessoa", nome: "Bia", usuario: "bia@ufci.edu.br" });
      const rCaio = await ana.criarResponsavel(id, { tipo: "pessoa", nome: "Caio", usuario: "caio@ufci.edu.br" });
      await ana.definirPapel(id, "caio@ufci.edu.br", "leitor");
      if (fechado) await ana.alterarEspaco(id, { fechado: true });
      const daBia = await ana.criarAcao(id, { rotulo: "Da Bia", responsaveis: [rBia] });
      const outra = await ana.criarAcao(id, { rotulo: "Outra" });
      return { banco, como, ana, bia: como("bia@ufci.edu.br"), caio: como("caio@ufci.edu.br"), ze: como("ze@ufci.edu.br"), id, rBia, rCaio, daBia, outra };
    }

    it("quem cria é administrador; pessoas com e-mail ganham papel (Usuário por padrão)", async () => {
      const { ana, id, rBia } = await cenario();
      const { acessos } = await ana.lerEspaco(id);
      assert.deepEqual(acessos["ana@ufci.edu.br"], { papel: "administrador", responsavel: null });
      assert.deepEqual(acessos["bia@ufci.edu.br"], { papel: "usuario", responsavel: rBia });
      assert.equal(acessos["caio@ufci.edu.br"].papel, "leitor");
      await assert.rejects(ana.alterarEspaco(id, { acessos: {} }), { codigo: "campo-fixo" });
    });

    it("usuário atualiza e comenta; não configura, não cria nem exclui ações; cria responsável sem login e etiqueta", async () => {
      const { bia, id, outra } = await cenario();
      await bia.alterarAcao(id, outra, { descricao: "Mudou" });
      await bia.comentar(id, outra, "Feito.");
      await bia.criarResponsavel(id, { tipo: "unidade", nome: "DTI" });
      await bia.etiquetarAcao(id, outra, "Compras");
      await assert.rejects(bia.alterarEspaco(id, { nome: "X" }), { codigo: "sem-permissao" });
      await assert.rejects(bia.criarAcao(id, { rotulo: "Nova" }), { codigo: "sem-permissao" });
      await assert.rejects(bia.excluirAcao(id, outra), { codigo: "sem-permissao" });
      await assert.rejects(bia.criarResponsavel(id, { tipo: "pessoa", nome: "Davi", usuario: "davi@ufci.edu.br" }), { codigo: "sem-permissao" });
      await assert.rejects(bia.definirPapel(id, "bia@ufci.edu.br", "administrador"), { codigo: "sem-permissao" });
    });

    it("leitor só comenta; sem papel, nada", async () => {
      const { caio, ze, id, outra } = await cenario();
      await caio.comentar(id, outra, "Pergunta.");
      await assert.rejects(caio.alterarAcao(id, outra, { descricao: "X" }), { message: /Leitor/ });
      await assert.rejects(caio.concluir(id, outra, "2026-10-24"), { codigo: "sem-permissao" });
      await assert.rejects(ze.comentar(id, outra, "Oi"), { message: /não tem papel/ });
    });

    it("fechado: o usuário atualiza só as suas ações e não reordena", async () => {
      const { bia, id, daBia, outra } = await cenario({ fechado: true });
      await bia.alterarAcao(id, daBia, { descricao: "Minha" });
      await assert.rejects(bia.alterarAcao(id, outra, { descricao: "Alheia" }), { message: /fechado/ });
      await assert.rejects(bia.priorizar(id, daBia, { antesDe: outra }), { codigo: "sem-permissao" });
    });

    it("o administrador apaga comentário alheio, marcado como do administrador", async () => {
      const { ana, bia, id, outra } = await cenario();
      const c = await bia.comentar(id, outra, "Texto");
      await ana.apagarComentario(id, c);
      const [x] = await ana.listarComentarios(id, outra);
      assert.equal(x.apagadoComo, "administrador");
      assert.equal(x.apagadoPor, "ana@ufci.edu.br");
    });

    it("o último administrador não sai; com outro administrador, pode sair", async () => {
      const { ana, id } = await cenario();
      await assert.rejects(ana.definirPapel(id, "ana@ufci.edu.br", "usuario"), { codigo: "ultimo-administrador" });
      await ana.definirPapel(id, "bia@ufci.edu.br", "administrador");
      await ana.definirPapel(id, "ana@ufci.edu.br", null);
      assert.equal((await ana.lerEspaco(id)).acessos["ana@ufci.edu.br"], undefined);
      await assert.rejects(ana.alterarEspaco(id, { nome: "Sem papel" }), { codigo: "sem-permissao" });
    });

    it("trocar o e-mail de um responsável leva o papel para o e-mail novo; excluir tira o acesso", async () => {
      const { ana, id, rBia, rCaio } = await cenario();
      await ana.alterarResponsavel(id, rCaio, { usuario: "caio.novo@ufci.edu.br" });
      let { acessos } = await ana.lerEspaco(id);
      assert.equal(acessos["caio@ufci.edu.br"], undefined);
      assert.deepEqual(acessos["caio.novo@ufci.edu.br"], { papel: "leitor", responsavel: rCaio });
      await ana.excluirResponsavel(id, rBia);
      ({ acessos } = await ana.lerEspaco(id));
      assert.equal(acessos["bia@ufci.edu.br"], undefined);
      await ana.restaurarResponsavel(id, rBia);
      ({ acessos } = await ana.lerEspaco(id));
      assert.equal(acessos["bia@ufci.edu.br"].papel, "usuario");
    });

    it("espaço sem administração: quem tem login altera tudo e pode assumir", async () => {
      const banco = criarBanco();
      const semLogin = criarStore(banco, {});
      const antigo = await semLogin.criarEspaco({ nome: "PI²", inicio: "2026-10-01" }); // sem login: sem acessos, como os espaços antigos
      await semLogin.criarResponsavel(antigo, { tipo: "pessoa", nome: "Bia", usuario: "bia@ufci.edu.br" });
      const ze = criarStore(banco, { exigirLogin: true, usuario: "ze@ufci.edu.br" });
      await ze.alterarEspaco(antigo, { nome: "PI² (ainda livre)" });
      await ze.assumirAdministracao(antigo);
      const e = await ze.lerEspaco(antigo);
      assert.equal(e.acessos["ze@ufci.edu.br"].papel, "administrador");
      assert.equal(e.acessos["bia@ufci.edu.br"].papel, "usuario");
      assert.equal(e.administracaoAssumidaPor, "ze@ufci.edu.br");
      await assert.rejects(ze.assumirAdministracao(antigo), { codigo: "ja-administrado" });
      const outro = criarStore(banco, { exigirLogin: true, usuario: "outro@ufci.edu.br" });
      await assert.rejects(outro.alterarEspaco(antigo, { nome: "X" }), { codigo: "sem-permissao" });
    });

    it("o exemplo, sem login e sem exigir login, continua sem controle", async () => {
      const exemplo = criarStore(criarBanco(), {});
      const id = await exemplo.criarEspaco({ nome: "Exemplo" });
      await exemplo.criarAcao(id, { rotulo: "A" });
      assert.equal(exemplo.permissoesEm(await exemplo.lerEspaco(id)).configurar, true);
    });
  });
}
