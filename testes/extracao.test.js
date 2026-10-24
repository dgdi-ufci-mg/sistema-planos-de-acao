/** Extração personalizada e arquivos de planilha (passo 2.10; documentação técnica, seções 8 e 16.6). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { CAMPOS } from "../js/modelo.js";
import { montarExtracao, CAMPOS_DA_ACAO, CAMPOS_PADRAO_DA_ACAO } from "../js/extracao.js";
import { csv, xlsx, ods, lerZip, zip, crc32, nomesDasAbas, textoDaCelula } from "../js/arquivo-planilha.js";

const texto = (bytes) => new TextDecoder().decode(bytes);

describe("Arquivos de planilha", () => {
  it("CRC-32 conhecido e ZIP que se lê de volta", () => {
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
    const z = zip([{ nome: "a.txt", conteudo: "olá" }, { nome: "pasta/b.xml", conteudo: "<x/>" }]);
    const lido = lerZip(z);
    assert.deepEqual([...lido.keys()], ["a.txt", "pasta/b.xml"]);
    assert.equal(texto(lido.get("a.txt")), "olá");
  });

  it("CSV com ponto e vírgula, BOM, vírgula decimal, datas dd/mm/aaaa e aspas quando precisa", () => {
    const t = { nome: "T", colunas: ["a", "b", "c", "d", "e"], linhas: [["x;y", 2.5, { data: "2026-10-24" }, true, { fracao: 0.5 }], ['diz "oi"', null, null, false, null]] };
    const s = csv(t);
    assert.ok(s.startsWith("﻿a;b;c;d;e\r\n"));
    assert.match(s, /"x;y";2,5;24\/10\/2026;sim;50%\r\n/);
    assert.match(s, /"diz ""oi""";;;não;\r\n$/);
    assert.equal(textoDaCelula(null), "");
  });

  it("nomes de aba válidos e sem repetir", () => {
    assert.deepEqual(nomesDasAbas(["Ações", "Ações", "a/b:c", "x".repeat(40)]), ["Ações", "Ações 2", "a b c", "x".repeat(31)]);
  });

  it("xlsx: pacote com as partes do Excel, uma aba por tabela, células com tipo", () => {
    const z = lerZip(xlsx([{ nome: "Ações", colunas: ["n", "d"], linhas: [[1, { data: "2026-10-24" }], ["<&>", null]] }, { nome: "Outra", colunas: ["x"], linhas: [] }]));
    for (const parte of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) assert.ok(z.has(parte), parte);
    assert.match(texto(z.get("xl/workbook.xml")), /<sheet name="Ações" sheetId="1"/);
    const aba = texto(z.get("xl/worksheets/sheet1.xml"));
    assert.match(aba, /<c r="A2"><v>1<\/v><\/c><c r="B2" s="2"><v>46319<\/v><\/c>/);
    assert.match(aba, /&lt;&amp;&gt;/);
  });

  it("ods: mimetype primeiro e o conteúdo com as abas", () => {
    const z = lerZip(ods([{ nome: "Ações", colunas: ["n"], linhas: [[3]] }]));
    assert.equal([...z.keys()][0], "mimetype");
    assert.equal(texto(z.get("mimetype")), "application/vnd.oasis.opendocument.spreadsheet");
    assert.match(texto(z.get("content.xml")), /<table:table table:name="Ações">[\s\S]*office:value="3"/);
  });
});

describe("Extração personalizada", () => {
  async function exemplo() {
    const store = criarStore(criarBancoLocal(), { hoje: () => "2026-10-24" });
    const id = await carregarExemplo(store, new Date("2026-10-24T12:00:00"));
    return { store, id };
  }

  it("os campos das ações são os do dicionário (4.2) ou os calculados do retrato (4.4.1)", () => {
    for (const [campo] of CAMPOS_DA_ACAO) assert.ok(CAMPOS.acao.includes(campo) || CAMPOS.retratoAcaoCalculos.includes(campo), campo);
  });

  it("ações com os campos escolhidos, entregas, alcances e histórico", async () => {
    const { store, id } = await exemplo();
    const espacos = await store.dadosParaExtracao([id], { historico: true });
    const tabelas = montarExtracao({ espacos, geral: null, hoje: "2026-10-24", escolha: { acoes: { campos: CAMPOS_PADRAO_DA_ACAO }, entregas: true, alcances: true, historico: true } });
    assert.deepEqual(tabelas.map((t) => t.nome), ["Ações", "Entregas", "Registros de alcance", "Histórico"]);
    const [acoes, entregas, alcances, historico] = tabelas;
    assert.deepEqual(acoes.colunas, ["espaco", ...CAMPOS_PADRAO_DA_ACAO]);
    assert.equal(acoes.linhas.length, 12);
    assert.equal(acoes.linhas[0][0], "Exemplo: repositório de dados acadêmicos");
    const situacao = acoes.colunas.indexOf("situacao");
    assert.ok(acoes.linhas.some((l) => l[situacao] === "Concluída"));
    assert.equal(entregas.linhas.length, 3);
    assert.equal(alcances.linhas.length, 1);
    assert.ok(historico.linhas.length >= 12);
    for (const t of tabelas) for (const l of t.linhas) assert.equal(l.length, t.colunas.length, t.nome);
  });

  it("filtro por situação e só os campos escolhidos", async () => {
    const { store, id } = await exemplo();
    const espacos = await store.dadosParaExtracao([id]);
    const [t] = montarExtracao({ espacos, geral: null, hoje: "2026-10-24", escolha: { acoes: { campos: ["rotulo", "concluidaEm"], situacao: "concluidas" } } });
    assert.deepEqual(t.colunas, ["espaco", "rotulo", "concluidaEm"]);
    assert.ok(t.linhas.length > 0 && t.linhas.every((l) => l[2]?.data));
  });
});
