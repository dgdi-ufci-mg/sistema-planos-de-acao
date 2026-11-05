/** Campos personalizados (passo 3.6; documentação técnica, seções 4.1.14 e 16.8). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { descreverRegistro, registrosDaMudanca } from "../js/historico.js";
import {
  valorDoCampo, valorGuardadoValido, textoDoValor, valoresDaAcao, problemaDosCampos, problemaDosValores,
  lerNumero, camposAtivos, nomeReservado, LIMITE_DE_CAMPOS,
} from "../js/campos-personalizados.js";
import { planilhaDoEspaco } from "../js/exportar.js";
import { planejarImportacao } from "../js/importar.js";
import { montarExtracao } from "../js/extracao.js";

const OPCOES = [{ id: "o1", nome: "DGDI" }, { id: "o2", nome: "PROGRAD" }];
const campo = (tipo, extra = {}) => ({ id: `c-${tipo}`, nome: `Campo ${tipo}`, tipo, ...(tipo === "opcao" ? { opcoes: OPCOES } : {}), ...extra });

describe("Campos personalizados: regras", () => {
  it("lê números no formato brasileiro e com ponto decimal", () => {
    assert.equal(lerNumero("1.250,50"), 1250.5);
    assert.equal(lerNumero("1250.5"), 1250.5);
    assert.equal(lerNumero("1.250.000"), 1250000);
    assert.equal(lerNumero("-3"), -3);
    assert.ok(Number.isNaN(lerNumero("abc")));
    assert.ok(Number.isNaN(lerNumero("")));
  });

  it("converte a entrada de cada tipo no valor guardado; vazio vira null", () => {
    assert.deepEqual(valorDoCampo(campo("texto"), "  23062.004512/2026-10  "), { valor: "23062.004512/2026-10" });
    assert.deepEqual(valorDoCampo(campo("numero"), "1.250,50"), { valor: 1250.5 });
    assert.deepEqual(valorDoCampo(campo("data"), "2026-11-04"), { valor: "2026-11-04" });
    assert.deepEqual(valorDoCampo(campo("opcao"), "o2"), { valor: "o2" });
    assert.deepEqual(valorDoCampo(campo("opcao"), " dgdi "), { valor: "o1" }, "também pelo nome");
    assert.deepEqual(valorDoCampo(campo("simNao"), false), { valor: false });
    assert.deepEqual(valorDoCampo(campo("simNao"), "sim"), { valor: true });
    assert.deepEqual(valorDoCampo(campo("link"), "https://github.com/x/y/tree/b"), { valor: "https://github.com/x/y/tree/b" });
    for (const tipo of ["texto", "numero", "data", "opcao", "simNao", "link"]) assert.deepEqual(valorDoCampo(campo(tipo), ""), { valor: null });
  });

  it("recusa o que não é do tipo, com o nome do campo na mensagem", () => {
    assert.equal(valorDoCampo(campo("numero"), "três").problema.codigo, "numero-invalido");
    assert.equal(valorDoCampo(campo("data"), "2026-02-31").problema.codigo, "data-invalida");
    assert.equal(valorDoCampo(campo("opcao"), "DTI").problema.codigo, "opcao-inexistente");
    assert.equal(valorDoCampo(campo("simNao"), "talvez").problema.codigo, "valor-invalido");
    assert.equal(valorDoCampo(campo("link"), "javascript:alert(1)").problema.codigo, "link-invalido");
    assert.equal(valorDoCampo(campo("texto"), "x".repeat(201)).problema.codigo, "texto-longo");
    assert.match(valorDoCampo(campo("link"), "www.x").problema.mensagem, /Campo link/);
  });

  it("mostra o valor como texto, em português", () => {
    assert.equal(textoDoValor(campo("numero"), 1250.5), "1.250,5");
    assert.equal(textoDoValor(campo("data"), "2026-11-04"), "04/11/2026");
    assert.equal(textoDoValor(campo("opcao"), "o1"), "DGDI");
    assert.equal(textoDoValor(campo("opcao"), "sumiu"), "(opção retirada)");
    assert.equal(textoDoValor(campo("simNao"), false), "Não");
    assert.equal(textoDoValor(campo("texto"), null), "");
  });

  it("confere o catálogo: nome, tipo, opções e limite de campos ativos", () => {
    const ok = campo("texto");
    assert.equal(problemaDosCampos({ camposPersonalizados: [ok, campo("opcao")] }), null);
    assert.equal(problemaDosCampos({ camposPersonalizados: [{ ...ok, nome: " " }] }).codigo, "nome-vazio");
    assert.equal(problemaDosCampos({ camposPersonalizados: [{ ...ok, nome: "x".repeat(41) }] }).codigo, "nome-longo");
    assert.equal(problemaDosCampos({ camposPersonalizados: [ok, { ...ok, id: "b", nome: "CAMPO TEXTO" }] }).codigo, "nome-repetido");
    assert.equal(problemaDosCampos({ camposPersonalizados: [ok, { ...ok, nome: "Outro" }] }).codigo, "id-repetido");
    assert.equal(problemaDosCampos({ camposPersonalizados: [{ ...ok, tipo: "formula" }] }).codigo, "tipo-invalido");
    assert.equal(problemaDosCampos({ camposPersonalizados: [{ ...ok, opcoes: [] }] }).codigo, "opcoes-fora-do-tipo");
    assert.equal(problemaDosCampos({ camposPersonalizados: [campo("opcao", { opcoes: [{ id: "a", nome: "X" }, { id: "b", nome: "x" }] })] }).codigo, "nome-repetido");
    assert.equal(problemaDosCampos({ camposPersonalizados: [{ ...ok, nome: "Responsáveis" }] }).codigo, "nome-reservado");
    assert.ok(nomeReservado(" data-limite ") && nomeReservado("SITUAÇÃO") && !nomeReservado("Nº do processo SEI"));
    const muitos = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, nome: `C${i}`, tipo: "texto", ...extra }));
    assert.equal(problemaDosCampos({ camposPersonalizados: muitos(LIMITE_DE_CAMPOS) }), null);
    assert.equal(problemaDosCampos({ camposPersonalizados: muitos(LIMITE_DE_CAMPOS + 1) }).codigo, "campos-demais");
    assert.equal(problemaDosCampos({ camposPersonalizados: [...muitos(LIMITE_DE_CAMPOS), { id: "z", nome: "Z", tipo: "data", arquivado: true }] }), null, "arquivados não contam");
  });

  it("confere os valores gravados de uma vez (criação, restauração)", () => {
    const espaco = { camposPersonalizados: [campo("numero"), campo("opcao"), campo("simNao"), campo("data")] };
    assert.equal(problemaDosValores(espaco, { "c-numero": 3, "c-opcao": "o1", "c-simNao": false, "c-data": "2026-11-04" }), null);
    assert.equal(problemaDosValores(espaco, { "c-numero": "3" }).codigo, "valor-invalido");
    assert.equal(problemaDosValores(espaco, { "c-opcao": "sumiu" }).codigo, "valor-invalido");
    assert.equal(problemaDosValores(espaco, { outro: 1 }).codigo, "nao-encontrado");
    assert.equal(problemaDosValores(espaco, [1]).codigo, "valor-invalido");
    assert.equal(valorGuardadoValido(campo("texto"), "  com espaço "), false, "o texto guardado já vem sem espaços nas pontas");
  });

  it("a ação mostra só os campos ativos com valor, na ordem do catálogo", () => {
    const espaco = { camposPersonalizados: [campo("texto"), campo("numero", { arquivado: true }), campo("opcao")] };
    const acao = { valoresPersonalizados: { "c-opcao": "o2", "c-numero": 5, "c-texto": "SEI 1" } };
    assert.deepEqual(valoresDaAcao(espaco, acao).map((v) => [v.campo.id, v.texto]), [["c-texto", "SEI 1"], ["c-opcao", "PROGRAD"]]);
    assert.deepEqual(camposAtivos(espaco).map((c) => c.id), ["c-texto", "c-opcao"]);
  });

  it("histórico: um registro por campo personalizado que mudou", () => {
    const quem = { em: "2026-11-04T10:00:00.000Z", por: "ana@ufci.edu.br", novoId: (() => { let n = 0; return () => `h${++n}`; })() };
    const antes = { numero: 1, valoresPersonalizados: { a: "x", b: 2 } };
    const depois = { numero: 1, valoresPersonalizados: { a: "x", b: 3, c: true } };
    const rs = registrosDaMudanca(antes, depois, quem);
    assert.deepEqual(rs.map((r) => [r.campo, r.antes, r.depois]), [["valoresPersonalizados.b", 2, 3], ["valoresPersonalizados.c", null, true]]);
    const nomes = { campoPersonalizado: (id) => ({ b: { nome: "Valor", texto: (v) => `R$ ${v}` } })[id] };
    assert.equal(descreverRegistro(rs[0], nomes), "Mudou “Valor” para “R$ 3” (era “R$ 2”).");
    assert.equal(descreverRegistro({ ...rs[0], depois: null }, nomes), "Apagou “Valor”.");
    assert.equal(descreverRegistro(rs[1], {}), "Mudou “campo retirado” para “true”.");
  });
});

for (const [nome, criarBanco] of [
  ["memória", () => criarBancoLocal()],
  ["Firestore (falso)", () => criarBancoFirestore(criarFirestoreFalso())],
]) {
  describe(`Campos personalizados no Store, banco em ${nome}`, () => {
    const novo = async () => {
      let relogio = 0;
      let n = 0;
      const store = criarStore(criarBanco(), {
        usuario: "ana@ufci.edu.br", hoje: () => "2026-11-04", novoId: () => `id${++n}`,
        agora: () => new Date(Date.UTC(2026, 10, 4, 10, 0, relogio++)).toISOString(),
      });
      const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
      const a = await store.criarAcao(id, { rotulo: "Primeira" });
      return { store, id, a };
    };

    it("cria campos no catálogo; o tipo não muda; nome repetido é recusado", async () => {
      const { store, id } = await novo();
      const sei = await store.criarCampoPersonalizado(id, { nome: "  Nº do processo   SEI ", tipo: "texto" });
      const uni = await store.criarCampoPersonalizado(id, { nome: "Unidade", tipo: "opcao", opcoes: ["DGDI", " ", "PROGRAD"] });
      const espaco = await store.lerEspaco(id);
      assert.deepEqual(espaco.camposPersonalizados.map((c) => [c.nome, c.tipo]), [["Nº do processo SEI", "texto"], ["Unidade", "opcao"]]);
      assert.deepEqual(espaco.camposPersonalizados[1].opcoes.map((o) => o.nome), ["DGDI", "PROGRAD"]);
      await assert.rejects(store.criarCampoPersonalizado(id, { nome: "unidade", tipo: "texto" }), { codigo: "nome-repetido" });
      await assert.rejects(store.criarCampoPersonalizado(id, { nome: "X", tipo: "formula" }), { codigo: "tipo-invalido" });
      await assert.rejects(store.alterarCampoPersonalizado(id, sei, { tipo: "numero" }), { codigo: "campo-fixo" });
      await assert.rejects(store.alterarCampoPersonalizado(id, sei, { opcoes: [] }), { codigo: "opcoes-fora-do-tipo" });
      await store.alterarCampoPersonalizado(id, uni, { nome: "Unidade demandante" });
      assert.equal((await store.lerEspaco(id)).camposPersonalizados[1].nome, "Unidade demandante");
    });

    it("grava um valor de cada vez, conferido pelo tipo; vazio apaga", async () => {
      const { store, id, a } = await novo();
      const n = await store.criarCampoPersonalizado(id, { nome: "Valor", tipo: "numero" });
      const s = await store.criarCampoPersonalizado(id, { nome: "Precisa de parecer", tipo: "simNao" });
      await store.definirValorPersonalizado(id, a, n, "1.250,50");
      await store.definirValorPersonalizado(id, a, s, false);
      assert.deepEqual((await store.lerAcao(id, a)).valoresPersonalizados, { [n]: 1250.5, [s]: false });
      await assert.rejects(store.definirValorPersonalizado(id, a, n, "muito"), { codigo: "numero-invalido" });
      await assert.rejects(store.definirValorPersonalizado(id, a, "sumiu", "1"), { codigo: "nao-encontrado" });
      await assert.rejects(store.alterarAcao(id, a, { valoresPersonalizados: {} }), { codigo: "campo-fixo" });
      await store.definirValorPersonalizado(id, a, n, "");
      await store.definirValorPersonalizado(id, a, s, null);
      assert.equal((await store.lerAcao(id, a)).valoresPersonalizados ?? null, null, "sem valores, o mapa fica vazio");
    });

    it("arquivar guarda os valores e impede preencher; restaurar os traz de volta", async () => {
      const { store, id, a } = await novo();
      const c = await store.criarCampoPersonalizado(id, { nome: "Branch", tipo: "link" });
      await store.definirValorPersonalizado(id, a, c, "https://github.com/dgdi/sextante/tree/campos");
      await store.alterarCampoPersonalizado(id, c, { arquivado: true });
      await assert.rejects(store.definirValorPersonalizado(id, a, c, "https://x"), { codigo: "campo-arquivado" });
      assert.equal((await store.lerAcao(id, a)).valoresPersonalizados[c], "https://github.com/dgdi/sextante/tree/campos");
      await store.alterarCampoPersonalizado(id, c, { arquivado: false });
      assert.equal((await store.lerEspaco(id)).camposPersonalizados[0].arquivado, undefined);
    });

    it(`no máximo ${LIMITE_DE_CAMPOS} campos em uso: o nono pede arquivar antes`, async () => {
      const { store, id } = await novo();
      const ids = [];
      for (let i = 0; i < LIMITE_DE_CAMPOS; i++) ids.push(await store.criarCampoPersonalizado(id, { nome: `C${i}`, tipo: "texto" }));
      await assert.rejects(store.criarCampoPersonalizado(id, { nome: "Nono", tipo: "texto" }), { codigo: "campos-demais" });
      await store.alterarCampoPersonalizado(id, ids[0], { arquivado: true });
      await store.criarCampoPersonalizado(id, { nome: "Nono", tipo: "texto" });
      await assert.rejects(store.alterarCampoPersonalizado(id, ids[0], { arquivado: false }), { codigo: "campos-demais" });
    });

    it("retirar uma opção limpa as ações que a usavam, com histórico, e conta as ativas", async () => {
      const { store, id, a } = await novo();
      const c = await store.criarCampoPersonalizado(id, { nome: "Unidade", tipo: "opcao", opcoes: ["DGDI", "PROGRAD"] });
      const [o1, o2] = (await store.lerEspaco(id)).camposPersonalizados[0].opcoes;
      const b = await store.criarAcao(id, { rotulo: "Segunda" });
      const x = await store.criarAcao(id, { rotulo: "Excluída" });
      await store.definirValorPersonalizado(id, a, c, o1.id);
      await store.definirValorPersonalizado(id, b, c, "PROGRAD");
      await store.definirValorPersonalizado(id, x, c, o1.id);
      await store.excluirAcao(id, x);
      assert.equal(await store.alterarCampoPersonalizado(id, c, { opcoes: [{ ...o2, nome: "Pró-Reitoria de Graduação" }, { nome: "DTI" }] }), 1);
      const opcoes = (await store.lerEspaco(id)).camposPersonalizados[0].opcoes;
      assert.deepEqual(opcoes.map((o) => o.nome), ["Pró-Reitoria de Graduação", "DTI"]);
      assert.equal(opcoes[0].id, o2.id, "renomear mantém o id");
      assert.equal((await store.lerAcao(id, a)).valoresPersonalizados ?? null, null);
      assert.equal((await store.lerAcao(id, b)).valoresPersonalizados[c], o2.id);
      assert.equal((await store.lerAcao(id, x)).valoresPersonalizados ?? null, null, "também na lixeira");
      const rs = (await store.listarHistorico(id, a)).filter((r) => r.campo === `valoresPersonalizados.${c}`);
      assert.deepEqual(rs.map((r) => r.depois), [o1.id, null]);
      await assert.rejects(store.alterarCampoPersonalizado(id, c, { opcoes: [{ nome: "A" }, { nome: "a" }] }), { codigo: "nome-repetido" });
      assert.equal((await store.lerAcao(id, b)).valoresPersonalizados[c], o2.id, "recusada a mudança, nenhuma ação muda");
    });

    it("criar a ação com valores confere cada um", async () => {
      const { store, id } = await novo();
      const c = await store.criarCampoPersonalizado(id, { nome: "Prazo legal", tipo: "data" });
      const b = await store.criarAcao(id, { rotulo: "Com valor", valoresPersonalizados: { [c]: "2026-12-01" } });
      assert.equal((await store.lerAcao(id, b)).valoresPersonalizados[c], "2026-12-01");
      await assert.rejects(store.criarAcao(id, { rotulo: "X", valoresPersonalizados: { [c]: "01/12/2026" } }), { codigo: "valor-invalido" });
    });

    it("sem login, não grava", async () => {
      const semLogin = criarStore(criarBanco(), { exigirLogin: true });
      await assert.rejects(semLogin.criarCampoPersonalizado("x", { nome: "A", tipo: "texto" }), { codigo: "sem-login" });
      await assert.rejects(semLogin.definirValorPersonalizado("x", 1, "c", "A"), { codigo: "sem-login" });
    });
  });
}

describe("Campos personalizados: papéis", () => {
  it("o administrador cria campos; o usuário só preenche", async () => {
    const banco = criarBancoLocal();
    let n = 0;
    const opcoes = { exigirLogin: true, novoId: () => `id${++n}`, hoje: () => "2026-11-04" };
    const adm = criarStore(banco, { ...opcoes, usuario: "adm@ufci.edu.br" });
    const id = await adm.criarEspaco({ nome: "E", inicio: "2026-10-01" });
    const r = await adm.criarResponsavel(id, { nome: "Bia", tipo: "pessoa", usuario: "bia@ufci.edu.br" });
    await adm.definirPapel(id, "bia@ufci.edu.br", "usuario");
    const a = await adm.criarAcao(id, { rotulo: "Tarefa", responsaveis: [r] });
    const c = await adm.criarCampoPersonalizado(id, { nome: "SEI", tipo: "texto" });
    const bia = criarStore(banco, { ...opcoes, usuario: "bia@ufci.edu.br" });
    await assert.rejects(bia.criarCampoPersonalizado(id, { nome: "Outro", tipo: "texto" }), { codigo: "sem-permissao" });
    await assert.rejects(bia.alterarCampoPersonalizado(id, c, { arquivado: true }), { codigo: "sem-permissao" });
    await bia.definirValorPersonalizado(id, a, c, "23062.000001/2026-01");
    assert.equal((await bia.lerAcao(id, a)).valoresPersonalizados[c], "23062.000001/2026-01");
  });
});

describe("Campos personalizados: exportação, importação e extração", () => {
  const espaco = {
    id: "e", nome: "E", inicio: "2026-10-01", modelo: { nome: "aberto", prazos: "dataLimite", dependencias: false, simulacao: false },
    camposPersonalizados: [{ id: "c1", nome: "Prazo", tipo: "data" }, { id: "c2", nome: "Unidade", tipo: "opcao", opcoes: OPCOES }, { id: "c3", nome: "Antigo", tipo: "texto", arquivado: true }],
  };
  const acoes = [{ numero: 1, ordem: 1, rotulo: "A", dependeDe: [], responsaveis: [], estimativas: [], valoresPersonalizados: { c1: "2026-12-01", c2: "o2", c3: "x" } }];

  it("Copiar para planilha leva uma coluna por campo ativo", () => {
    const [titulos, linha] = planilhaDoEspaco({ espaco, acoes, responsaveis: [], geral: {}, hoje: "2026-11-04" }).split("\n").map((l) => l.split("\t"));
    const i = titulos.indexOf("Prazo");
    assert.ok(i > 0 && !titulos.includes("Antigo"));
    assert.equal(linha[i], "01/12/2026");
    assert.equal(linha[titulos.indexOf("Unidade")], "PROGRAD");
  });

  it("a importação ignora as colunas dos campos, mesmo com nome de coluna conhecida (“Prazo”)", () => {
    const texto = "Ação\tPrazo\tUnidade\nNova\t01/12/2026\tDGDI";
    const p = planejarImportacao({ texto, espaco, acoes: [], responsaveis: [], hoje: "2026-11-04", situacaoDe: () => "liberada", modo: "criar" });
    assert.equal(p.erro, null);
    assert.deepEqual(p.ignoradas, ["Prazo", "Unidade"]);
    assert.equal(p.linhas[0].campos.dataLimite, undefined);
  });

  it("a extração junta os campos numa coluna, “Nome: valor”, e descreve o histórico", () => {
    const historico = [{ id: "h1", entidade: "acao", chave: 1, tipo: "alteracao", campo: "valoresPersonalizados.c2", antes: "o1", depois: "o2", em: "2026-11-04T10:00:00.000Z", por: "ana@ufci.edu.br" }];
    const [tab, hist] = montarExtracao({
      espacos: [{ espaco, acoes, responsaveis: [], historico }], geral: { datasExcluidas: [] }, hoje: "2026-11-04",
      escolha: { acoes: { campos: ["numero", "valoresPersonalizados"] }, historico: true },
    });
    assert.deepEqual(tab.linhas[0], ["E", 1, "Prazo: 01/12/2026; Unidade: PROGRAD"]);
    assert.equal(hist.linhas[0][4], "Mudou “Unidade” para “PROGRAD” (era “DGDI”).");
  });
});
