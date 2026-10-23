import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { planejarResponsaveis } from "../js/importar-responsaveis.js";

describe("Importação de responsáveis com contas de acesso (passos 1.14d e 1.19b)", () => {
  it("com e-mail é pessoa e ganha conta; sem e-mail precisa do tipo; erros antes de gravar", async () => {
    const store = criarStore(criarBancoLocal(), { usuario: "admin@ufci.edu.br" });
    const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
    await store.criarResponsavel(id, { tipo: "pessoa", nome: "Ana Souza", sigla: "ANA" });
    await store.criarResponsavel(id, { tipo: "pessoa", nome: "Bruno Lima", sigla: "BRL", usuario: "bruno@ufci.edu.br" });
    const texto = ["Tipo\tNome\tSigla\tSetor\tE-mail",
      "\tCarla Mendes\tCAM\tDGDI\tCarla@UFCI.edu.br", // pessoa nova, com conta
      "unidade\tPró-Reitoria de Graduação\tPROGRAD\t\t",  // unidade nova
      "\tDiego Rocha\tDRO\tDTI\t",                        // sem e-mail e sem tipo: erro
      "Unidade\tDTI\tDTI\t\tdti@ufci.edu.br",             // unidade com e-mail: erro
      "\tAna Souza\tANA\t\tana@ufci.edu.br",              // existente: liga o e-mail
      "\tBruno Lima\tBRL\t\tbruno@ufci.edu.br",           // existente com o mesmo e-mail: confere a conta
      "\tCarla M.\tCAM\t\t",                              // repete a sigla da linha 2
      "chefe\tFulano\t\t\t",                              // tipo desconhecido
      "\tSem arroba\t\t\tsem-arroba"].join("\n");
    const plano = planejarResponsaveis({ texto, responsaveis: await store.listarResponsaveis(id) });
    assert.deepEqual(plano.linhas.map((l) => l.tipo), ["novo", "novo", "erro", "erro", "liga", "ignorada", "erro", "erro", "erro"]);
    assert.equal(plano.linhas[0].dados.tipo, "pessoa");
    assert.equal(plano.linhas[0].dados.usuario, "carla@ufci.edu.br");
    const contas = [];
    const r = await store.importarResponsaveis(id, plano, { criarConta: async (e) => { contas.push(e); return e === "bruno@ufci.edu.br" ? "existente" : "criada"; } });
    assert.deepEqual(r, { criados: 2, ligados: 1, contasCriadas: 2, contasExistentes: 1, falhas: [] });
    assert.deepEqual(contas.sort(), ["ana@ufci.edu.br", "bruno@ufci.edu.br", "carla@ufci.edu.br"]);
    const todos = await store.listarResponsaveis(id);
    assert.equal(todos.find((x) => x.sigla === "ANA").usuario, "ana@ufci.edu.br");
    assert.equal(todos.find((x) => x.sigla === "PROGRAD").tipo, "unidade");
    assert.equal(todos.length, 4);
  });

  it("sem banco compartilhado, cadastra os responsáveis e não cria contas", async () => {
    const store = criarStore(criarBancoLocal());
    const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
    const plano = planejarResponsaveis({ texto: "Nome\tE-mail\nCarla\tcarla@ufci.edu.br", responsaveis: [] });
    const r = await store.importarResponsaveis(id, plano);
    assert.deepEqual(r, { criados: 1, ligados: 0, contasCriadas: 0, contasExistentes: 0, falhas: [] });
    assert.match(planejarResponsaveis({ texto: "Sigla\nX\nY", responsaveis: [] }).erro, /Nome/);
  });
});
