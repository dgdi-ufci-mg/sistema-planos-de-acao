/** Testes do Store: regras que valem para qualquer banco. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore, SEMENTE_PADRAO, SIMULACOES_PADRAO } from "../js/dados.js";

/** Store sobre um banco em memória, com relógio e ids previsíveis. */
function storeDeTeste() {
  let n = 0;
  let minuto = 0;
  return criarStore(criarBancoLocal(), {
    usuario: "ana@ufci.edu.br",
    novoId: () => `id${++n}`,
    agora: () => `2026-10-19T10:${String(minuto++).padStart(2, "0")}:00.000Z`,
  });
}

describe("Store: espaços", () => {
  it("cria o espaço com semente e número de simulações padrão", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: " PI² ", inicio: "2026-08-03", prazoFinal: "2027-04-14" });
    const espaco = await store.lerEspaco(id);
    assert.equal(espaco.nome, "PI²");
    assert.equal(espaco.semente, SEMENTE_PADRAO);
    assert.equal(espaco.simulacoes, SIMULACOES_PADRAO);
    assert.equal(espaco.alteradoPor, "ana@ufci.edu.br");
  });

  it("não deixa mudar a semente nem o número de simulações depois da criação", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: "Espaço" });
    await assert.rejects(store.alterarEspaco(id, { semente: 1 }), { codigo: "campo-fixo" });
    await assert.rejects(store.alterarEspaco(id, { simulacoes: 500 }), { codigo: "campo-fixo" });
  });

  it("exige nome", async () => {
    await assert.rejects(storeDeTeste().criarEspaco({ nome: "  " }), { codigo: "nome-vazio" });
  });
});

describe("Store: ações", () => {
  async function comEspaco() {
    const store = storeDeTeste();
    const espacoId = await store.criarEspaco({ nome: "Espaço" });
    return { store, espacoId };
  }

  it("cria ações numeradas, na ordem do espaço, com listas vazias e carimbos", async () => {
    const { store, espacoId } = await comEspaco();
    assert.equal(await store.criarAcao(espacoId, { codigo: "LEV", rotulo: "Levantar requisitos" }), 1);
    assert.equal(await store.criarAcao(espacoId, { rotulo: "Validar requisitos" }), 2);
    const [lev, req] = await store.listarAcoes(espacoId);
    assert.deepEqual([lev.numero, lev.codigo, lev.ordem, req.numero, req.codigo, req.ordem], [1, "LEV", 1, 2, undefined, 2]);
    assert.deepEqual(lev.dependeDe, []);
    assert.equal(lev.alteradaPor, "ana@ufci.edu.br");
    assert.ok(lev.criadaEm);
  });

  it("valida o código, quando houver: de 2 a 8 letras maiúsculas ou números", async () => {
    const { store, espacoId } = await comEspaco();
    for (const codigo of ["A", "ABCDEFGHI", "AB-1", "AÇÃO", "ab12"]) {
      await assert.rejects(store.criarAcao(espacoId, { codigo, rotulo: "x" }), { codigo: "codigo-invalido" });
    }
    await store.criarAcao(espacoId, { codigo: "AB12", rotulo: "x" });
    await store.criarAcao(espacoId, { codigo: "", rotulo: "sem código" });
  });

  it("recusa código repetido", async () => {
    const { store, espacoId } = await comEspaco();
    await store.criarAcao(espacoId, { codigo: "LEV", rotulo: "x" });
    await assert.rejects(store.criarAcao(espacoId, { codigo: "LEV", rotulo: "y" }), { codigo: "codigo-ocupado" });
  });

  it("não deixa mudar o número nem a data de criação", async () => {
    const { store, espacoId } = await comEspaco();
    const n = await store.criarAcao(espacoId, { codigo: "LEV", rotulo: "x" });
    await assert.rejects(store.alterarAcao(espacoId, n, { numero: 9 }), { codigo: "campo-fixo" });
    await assert.rejects(store.alterarAcao(espacoId, n, { criadaEm: "2020-01-01" }), { codigo: "campo-fixo" });
    await assert.rejects(store.alterarEspaco(espacoId, { proximoNumero: 1 }), { codigo: "campo-fixo" });
  });

  it("alterar renova a data e o autor da alteração", async () => {
    const { store, espacoId } = await comEspaco();
    const n = await store.criarAcao(espacoId, { codigo: "LEV", rotulo: "x" });
    const antes = (await store.lerAcao(espacoId, n)).alteradaEm;
    await store.alterarAcao(espacoId, n, { rotulo: "y" });
    const depois = await store.lerAcao(espacoId, n);
    assert.equal(depois.rotulo, "y");
    assert.notEqual(depois.alteradaEm, antes);
  });
});

describe("Store: responsáveis do espaço", () => {
  it("cria e lista responsáveis, com carimbos", async () => {
    const store = storeDeTeste();
    const e = await store.criarEspaco({ nome: "P" });
    await store.criarResponsavel(e, { tipo: "pessoa", nome: "Ana Souza", sigla: "ANA", setor: "DGDI" });
    const [ana] = await store.listarResponsaveis(e);
    assert.deepEqual([ana.nome, ana.sigla, ana.setor], ["Ana Souza", "ANA", "DGDI"]);
    assert.ok(ana.criadoEm);
    assert.equal(ana.alteradoPor, "ana@ufci.edu.br");
  });

  it("exige o tipo (pessoa ou unidade) e só aceita login de pessoa", async () => {
    const store = storeDeTeste();
    const e = await store.criarEspaco({ nome: "P" });
    await assert.rejects(store.criarResponsavel(e, { nome: "Ana" }), { codigo: "tipo-invalido" });
    await assert.rejects(store.criarResponsavel(e, { tipo: "grupo", nome: "Ana" }), { codigo: "tipo-invalido" });
    await assert.rejects(store.criarResponsavel(e, { tipo: "unidade", nome: "DTI", usuario: "dti@ufci.edu.br" }), { codigo: "unidade-com-login" });
    const dti = await store.criarResponsavel(e, { tipo: "unidade", nome: "Diretoria de TI", sigla: "DTI" });
    await assert.rejects(store.alterarResponsavel(e, dti, { usuario: "dti@ufci.edu.br" }), { codigo: "unidade-com-login" });
    const ana = await store.criarResponsavel(e, { tipo: "pessoa", nome: "Ana", usuario: "ana@ufci.edu.br" });
    await assert.rejects(store.alterarResponsavel(e, ana, { tipo: "unidade" }), { codigo: "campo-fixo" });
    await assert.rejects(store.alterarResponsavel(e, dti, { tipo: "pessoa" }), { codigo: "campo-fixo" });
  });

  it("cada espaço tem a sua lista; o mesmo e-mail de login pode estar em espaços diferentes, mas não repetido num espaço", async () => {
    const store = storeDeTeste();
    const a = await store.criarEspaco({ nome: "A" });
    const b = await store.criarEspaco({ nome: "B" });
    await store.criarResponsavel(a, { tipo: "pessoa", nome: "Ana", usuario: "ana@ufci.edu.br" });
    assert.equal((await store.listarResponsaveis(b)).length, 0);
    await store.criarResponsavel(b, { tipo: "pessoa", nome: "Ana", usuario: "ana@ufci.edu.br" });
    await assert.rejects(store.criarResponsavel(a, { tipo: "pessoa", nome: "Ana 2", usuario: "ana@ufci.edu.br" }), { codigo: "login-ocupado" });
    assert.equal((await store.listarResponsaveis(a)).length, 1);
  });
});

describe("Store: só grava campos do dicionário de dados", () => {
  it("recusa campo desconhecido no espaço, na ação e no responsável", async () => {
    const store = storeDeTeste();
    await assert.rejects(store.criarEspaco({ nome: "P", custo: 10 }), { codigo: "campo-desconhecido" });
    const espacoId = await store.criarEspaco({ nome: "P" });
    await assert.rejects(store.alterarEspaco(espacoId, { nearCrit: 10 }), { codigo: "campo-desconhecido" });
    await assert.rejects(store.criarAcao(espacoId, { codigo: "LEV", rotulo: "x", pct: 50 }), { codigo: "campo-desconhecido" });
    const n = await store.criarAcao(espacoId, { codigo: "LEV", rotulo: "x" });
    await assert.rejects(store.alterarAcao(espacoId, n, { name: "y" }), { codigo: "campo-desconhecido" });
    await assert.rejects(store.criarResponsavel(espacoId, { tipo: "pessoa", nome: "Ana", email: "a@b" }), { codigo: "campo-desconhecido" });
  });
});

describe("Store: regras do espaço (configuração)", () => {
  const novo = async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: "P", inicio: "2026-10-01", prazoFinal: "2026-12-01" });
    return { store, id };
  };

  it("recusa prazo final antes do início, também quando só um dos dois muda", async () => {
    const { store, id } = await novo();
    await assert.rejects(store.alterarEspaco(id, { prazoFinal: "2026-09-01" }), { codigo: "prazo-antes-do-inicio" });
    await assert.rejects(store.alterarEspaco(id, { inicio: "2027-01-01" }), { codigo: "prazo-antes-do-inicio" });
    await store.alterarEspaco(id, { inicio: "2026-11-01", nome: "  Novo nome  " });
    assert.equal((await store.lerEspaco(id)).nome, "Novo nome");
  });

  it("datas excluídas: data válida, sem repetir, só com os campos do dicionário", async () => {
    const { store, id } = await novo();
    await assert.rejects(store.alterarEspaco(id, { datasExcluidas: [{ data: "2026-11-20" }, { data: "2026-11-20" }] }), { codigo: "data-repetida" });
    await assert.rejects(store.alterarEspaco(id, { datasExcluidas: [{ data: "20/11/2026" }] }), { codigo: "data-invalida" });
    await assert.rejects(store.alterarEspaco(id, { datasExcluidas: [{ data: "2026-11-20", obs: "x" }] }), { codigo: "campo-desconhecido" });
    await store.alterarEspaco(id, { datasExcluidas: [{ data: "2026-11-20", motivo: "Consciência Negra" }] });
  });

  it("fases e etapas: nome obrigatório e identificadores únicos", async () => {
    const { store, id } = await novo();
    await assert.rejects(store.alterarEspaco(id, { estrutura: [{ id: "f1", nome: "", etapas: [] }] }), { codigo: "nome-vazio" });
    await assert.rejects(store.alterarEspaco(id, { estrutura: [{ id: "f1", nome: "F", etapas: [{ id: "f1", nome: "E" }] }] }), { codigo: "id-repetido" });
    await store.alterarEspaco(id, { estrutura: [{ id: "f1", nome: "F", etapas: [{ id: "e1", nome: "E" }] }] });
  });

  it("documentos: nome obrigatório e link só http ou https", async () => {
    const { store, id } = await novo();
    await assert.rejects(store.alterarEspaco(id, { documentos: [{ nome: "Plano", link: "javascript:alert(1)" }] }), { codigo: "link-invalido" });
    await assert.rejects(store.alterarEspaco(id, { documentos: [{ nome: " " }] }), { codigo: "nome-vazio" });
    await store.alterarEspaco(id, { documentos: [{ nome: "Plano aprovado", identificacao: "23062.001234/2026-11", link: "https://sipac.ufci.edu.br/x" }] });
  });

  it("campos opcionais: só os do dicionário", async () => {
    const { store, id } = await novo();
    await assert.rejects(store.alterarEspaco(id, { camposOpcionais: { cores: true } }), { codigo: "campo-desconhecido" });
    await store.alterarEspaco(id, { camposOpcionais: { codigos: true, notas: false } });
  });
});

describe("Store: calendário geral", () => {
  it("começa vazio, grava em ordem e recusa datas repetidas ou inválidas", async () => {
    const store = storeDeTeste();
    assert.deepEqual((await store.lerCalendarioGeral()).datasExcluidas, []);
    await assert.rejects(store.alterarCalendarioGeral([{ data: "2027-04-21" }, { data: "2027-04-21" }]), { codigo: "data-repetida" });
    await assert.rejects(store.alterarCalendarioGeral([{ data: "21/04/2027" }]), { codigo: "data-invalida" });
    await store.alterarCalendarioGeral([{ data: "2027-12-25", motivo: "Natal" }, { data: "2027-04-21", motivo: "Tiradentes" }]);
    const c = await store.lerCalendarioGeral();
    assert.deepEqual(c.datasExcluidas.map((d) => d.data), ["2027-04-21", "2027-12-25"]);
    assert.equal(c.alteradoPor, "ana@ufci.edu.br");
  });

  it("o espaço pode desconsiderar datas gerais, informadas como datas válidas", async () => {
    const store = storeDeTeste();
    const id = await store.criarEspaco({ nome: "P" });
    await assert.rejects(store.alterarEspaco(id, { datasGeraisDesconsideradas: ["08/02/2027"] }), { codigo: "data-invalida" });
    await store.alterarEspaco(id, { datasGeraisDesconsideradas: ["2027-02-08"] });
  });
});

describe("Store: login (passo 1.14)", () => {
  it("com exigirLogin, recusa gravar sem login e grava com o autor depois de entrar", async () => {
    const store = criarStore(criarBancoLocal(), { exigirLogin: true });
    assert.equal(store.podeGravar, false);
    await assert.rejects(store.criarEspaco({ nome: "X" }), { codigo: "sem-login" });
    store.definirUsuario("ana@ufci.edu.br");
    const id = await store.criarEspaco({ nome: "X" });
    assert.equal((await store.lerEspaco(id)).alteradoPor, "ana@ufci.edu.br");
    store.definirUsuario(null);
    await assert.rejects(store.alterarEspaco(id, { nome: "Y" }), { codigo: "sem-login" });
    assert.equal((await store.listarEspacos()).length, 1); // leitura continua livre
  });
});

describe("Store sem conexão (22/10/2026)", () => {
  it("recusa gravações com aviso claro e volta a gravar quando a conexão volta", async () => {
    const { criarStore } = await import("../js/dados.js");
    const { criarBancoLocal } = await import("../js/banco/local.js");
    const store = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", exigirLogin: true });
    const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
    store.definirConexao(false);
    assert.equal(store.podeGravar, false);
    await assert.rejects(store.criarAcao(id, { rotulo: "X" }), { codigo: "sem-conexao" });
    assert.equal((await store.listarAcoes(id)).length, 0); // leitura continua
    store.definirConexao(true);
    assert.equal(store.podeGravar, true);
    await store.criarAcao(id, { rotulo: "X" });
    assert.equal((await store.listarAcoes(id)).length, 1);
  });
});
