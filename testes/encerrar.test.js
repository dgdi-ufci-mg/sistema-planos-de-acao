/** Encerrar e reabrir; Administrador do Sistema e espaço órfão (passo 2.3; documentação técnica, seções 4.1.11, 4.1.12 e 16.3). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { permissoes } from "../js/papeis.js";

describe("Encerrado: regras", () => {
  it("só leitura para todos; o administrador só reabre", () => {
    const espaco = { encerradoEm: "2027-04-15T18:00:00.000Z", acessos: { "ana@x.br": { papel: "administrador" }, "bia@x.br": { papel: "usuario" }, "caio@x.br": { papel: "leitor" } } };
    const [adm, usu, lei] = ["ana@x.br", "bia@x.br", "caio@x.br"].map((e) => permissoes(espaco, e));
    assert.deepEqual([adm.configurar, adm.criarAcao, adm.atualizar({}), adm.comentar, adm.reabrir], [false, false, false, false, true]);
    assert.deepEqual([usu.atualizar({ responsaveis: [] }), usu.comentar, usu.reabrir, usu.priorizar], [false, false, false, false]);
    assert.equal(lei.comentar, false);
  });
});

for (const [nome, criarBanco, definirAdmins] of [
  ["memória", () => criarBancoLocal(), (banco, emails) => banco.gravarAdministradoresDoSistema({ emails })],
  ["Firestore (falso)", () => { const db = criarFirestoreFalso(); const b = criarBancoFirestore(db); b.__db = db; return b; },
    (banco, emails) => banco.__db.collection("sistema").doc("administradores").set({ emails })],
]) {
  describe(`Encerrar, reabrir e Administrador do Sistema, banco em ${nome}`, () => {
    async function cenario() {
      const banco = criarBanco();
      let n = 0;
      const como = (email) => criarStore(banco, { exigirLogin: true, usuario: email, hoje: () => "2026-10-24", novoId: () => `id${++n}` });
      const ana = como("ana@ufci.edu.br");
      const id = await ana.criarEspaco({ nome: "E", inicio: "2026-10-01" });
      await ana.criarResponsavel(id, { tipo: "pessoa", nome: "Bia", usuario: "bia@ufci.edu.br" });
      const a = await ana.criarAcao(id, { rotulo: "A" });
      return { banco, como, ana, bia: como("bia@ufci.edu.br"), wes: como("wesley@ufci.edu.br"), id, a };
    }

    it("encerrado: ninguém altera nem comenta; só o administrador reabre", async () => {
      const { ana, bia, id, a } = await cenario();
      await assert.rejects(bia.encerrarEspaco(id), { codigo: "sem-permissao" });
      await ana.encerrarEspaco(id);
      const e = await ana.lerEspaco(id);
      assert.ok(e.encerradoEm);
      assert.equal(e.encerradoPor, "ana@ufci.edu.br");
      await assert.rejects(ana.alterarAcao(id, a, { descricao: "X" }), { codigo: "espaco-encerrado" });
      await assert.rejects(bia.comentar(id, a, "Oi"), { codigo: "espaco-encerrado" });
      await assert.rejects(ana.alterarEspaco(id, { nome: "Y" }), { codigo: "espaco-encerrado" });
      await assert.rejects(ana.alterarEspaco(id, { encerradoEm: null }), { codigo: "campo-fixo" });
      await assert.rejects(bia.reabrirEspaco(id), { codigo: "sem-permissao" });
      await ana.reabrirEspaco(id);
      assert.equal((await ana.lerEspaco(id)).encerradoEm, null);
      await ana.alterarAcao(id, a, { descricao: "De novo" });
      await assert.rejects(ana.reabrirEspaco(id), { codigo: "nao-encerrado" });
    });

    it("o Administrador do Sistema muda o calendário geral e nomeia administrador, com registro", async () => {
      const { banco, ana, wes, id } = await cenario();
      await assert.rejects(wes.alterarCalendarioGeral([]), { codigo: "sem-permissao" });
      await assert.rejects(wes.nomearAdministrador(id, "carla@ufci.edu.br"), { codigo: "sem-permissao" });
      assert.equal(await ana.ehAdministradorDoSistema(), false);
      await definirAdmins(banco, ["Wesley@ufci.edu.br"]);
      assert.equal(await wes.ehAdministradorDoSistema(), true);
      await wes.alterarCalendarioGeral([{ data: "2026-12-08", motivo: "Teste" }]);
      await assert.rejects(ana.alterarCalendarioGeral([]), { codigo: "sem-permissao" });
      await wes.nomearAdministrador(id, " Carla@ufci.edu.br ");
      const e = await wes.lerEspaco(id);
      assert.equal(e.acessos["carla@ufci.edu.br"].papel, "administrador");
      assert.equal(e.nomeacoes.length, 1);
      assert.equal(e.nomeacoes[0].email, "carla@ufci.edu.br");
      assert.equal(e.nomeacoes[0].por, "wesley@ufci.edu.br");
      /* sem passe livre: nomear não dá ao Administrador do Sistema papel no espaço */
      await assert.rejects(wes.alterarEspaco(id, { nome: "Outro" }), { codigo: "sem-permissao" });
    });

    it("no exemplo (sem exigir login), encerrado também é só leitura, e o calendário é livre", async () => {
      const exemplo = criarStore(criarBanco(), {});
      const id = await exemplo.criarEspaco({ nome: "Exemplo" });
      await exemplo.encerrarEspaco(id);
      await assert.rejects(exemplo.criarAcao(id, { rotulo: "A" }), { codigo: "espaco-encerrado" });
      assert.equal(exemplo.permissoesEm(await exemplo.lerEspaco(id)).reabrir, true);
      await exemplo.reabrirEspaco(id);
      await exemplo.alterarCalendarioGeral([]);
    });
  });
}
