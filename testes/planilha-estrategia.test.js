/** Regras da Planilha do Strata (documentação técnica, seção 8, "Strata", "Planilha"). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CAMADAS_PADRAO } from "../js/estrategia.js";
import { normalizar } from "../js/acao.js";
import {
  COLUNAS, colunasVisiveis, registrarValor, contarPendencias, criarHistoricoDeEdicao, linhasDaPlanilha, filtrarEOrdenar,
  agruparPorCamada, candidatosASuperior, lerValorDaCelula, planoDeGravacao,
} from "../js/planilha-estrategia.js";

const instrumentos = [{ id: "pei", nome: "PEI 2021–2030", inicio: "2021-01-01", fim: "2030-12-31" }, { id: "velho", nome: "Plano Antigo", inicio: "2010-01-01", fim: "2015-12-31" }];
const itens = [
  { id: "m", camada: "missao", codigo: "", nome: "Missão", superiores: [] },
  { id: "oe1", camada: "objetivoEstrategico", codigo: "OE1", nome: "Governança", instrumento: "pei", superiores: ["m"] },
  { id: "oe10", camada: "objetivoEstrategico", codigo: "OE10", nome: "Inovação", instrumento: "pei", superiores: ["m"] },
  { id: "oe2", camada: "objetivoEstrategico", codigo: "OE2", nome: "Ensino", instrumento: "velho", superiores: [] },
  { id: "od1", camada: "objetivoDesenvolvimento", codigo: "OD1", nome: "Dados", superiores: ["oe1"] },
  { id: "x", camada: "objetivoDesenvolvimento", codigo: "OD9", nome: "Excluído", superiores: ["oe1"], excluidoEm: "2026-01-01" },
];
const cat = { camadas: CAMADAS_PADRAO, instrumentos, itens };
const hoje = "2026-10-30";

describe("Planilha do Strata: regras", () => {
  it("colunas: as fixas sempre aparecem; a ordem e as ocultas vêm da preferência; coluna nova entra no fim", () => {
    assert.deepEqual(colunasVisiveis().map((c) => c.id), COLUNAS.map((c) => c.id));
    const v = colunasVisiveis({ ordem: ["nome", "codigo", "sumiu"], ocultas: ["codigo", "vigencia"] });
    assert.equal(v[0].id, "nome");
    assert.equal(v[1].id, "codigo", "fixa não se esconde");
    assert.ok(!v.some((c) => c.id === "vigencia"));
    assert.equal(v.at(-1).id, "planos");
  });

  it("pendências: registram por campo; voltar ao valor gravado tira a pendência", () => {
    let p = registrarValor(new Map(), itens[1], "nome", "Governança e gestão");
    p = registrarValor(p, itens[1], "codigo", "OE01");
    assert.equal(contarPendencias(p), 2);
    p = registrarValor(p, itens[1], "codigo", "OE1");
    assert.deepEqual(p.get("oe1"), { nome: "Governança e gestão" });
    p = registrarValor(p, itens[1], "superiores", ["m"]);
    assert.equal(contarPendencias(p), 1, "lista igual à gravada não conta");
    assert.throws(() => registrarValor(p, itens[1], "camada", "x"));
  });

  it("desfazer e refazer andam pelas células; um passo novo apaga o refazer", () => {
    const h = criarHistoricoDeEdicao();
    h.registrar({ id: "a", campo: "nome", antes: "A", depois: "B" });
    h.registrar({ id: "a", campo: "nome", antes: "B", depois: "B" }); // sem mudança: ignorado
    h.registrar({ id: "a", campo: "codigo", antes: "", depois: "X" });
    assert.equal(h.desfazer().campo, "codigo");
    assert.ok(h.podeRefazer);
    assert.equal(h.refazer().depois, "X");
    h.desfazer();
    h.registrar({ id: "b", campo: "nome", antes: "1", depois: "2" });
    assert.equal(h.podeRefazer, false);
  });

  it("linhas: sem os excluídos; com as pendências; problemas que bloqueiam e avisos", () => {
    let p = registrarValor(new Map(), itens[2], "codigo", "oe1"); // repete OE1 na camada (sem diferenciar maiúsculas)
    p = registrarValor(p, itens[4], "nome", "  ");
    const linhas = linhasDaPlanilha(cat, { pendentes: p, hoje, planos: [{ id: "e", vinculos: ["od1"] }] });
    assert.equal(linhas.length, 5);
    const de = (id) => linhas.find((l) => l.id === id);
    assert.ok(de("oe1").problemas.some((x) => x.campo === "codigo" && x.bloqueia), "o código repetido aparece também na linha que já tinha o código");
    assert.ok(de("oe10").problemas.some((x) => x.campo === "codigo" && x.bloqueia));
    assert.ok(de("oe10").alterados.has("codigo"));
    assert.ok(de("od1").problemas.some((x) => x.campo === "nome" && x.bloqueia));
    assert.deepEqual(de("oe2").problemas.map((x) => [x.campo, x.bloqueia]), [["superiores", false]], "sem superior: só aviso");
    assert.deepEqual(de("m").problemas, [], "a camada mais alta não tem superior");
    assert.equal(de("oe2").texto.vigencia, "Encerrado");
    assert.equal(de("oe1").texto.vigencia, "Vigente");
    assert.equal(de("oe1").texto.superiores, "Missão");
    assert.equal(de("oe1").texto.subordinados, "1", "o excluído não conta");
    assert.equal(de("od1").texto.planos, "", "Planos de Ação só na última camada");
  });

  it("filtro e ordem: busca sem acentos, por camada, por instrumento, por vigência, só com problema; ordem natural e vazios no fim", () => {
    const linhas = linhasDaPlanilha(cat, { hoje });
    const ids = (f) => filtrarEOrdenar(linhas, f, normalizar).map((l) => l.id);
    assert.deepEqual(ids({}), ["m", "oe1", "oe2", "oe10", "od1"], "padrão: camada, depois código em ordem natural");
    assert.deepEqual(ids({ busca: "INOVACAO" }), ["oe10"]);
    assert.deepEqual(ids({ camada: "objetivoEstrategico" }), ["oe1", "oe2", "oe10"]);
    assert.deepEqual(ids({ instrumento: "" }), ["m", "od1"], "sem instrumento");
    assert.deepEqual(ids({ soProblemas: true }), ["oe2"]);
    assert.deepEqual(ids({ vigencia: "encerrado" }), ["oe2"]);
    assert.equal(ids({ vigencia: "vigente" }).length, 4);
    const desc = ids({ ordem: { coluna: "codigo", sentido: -1 } });
    assert.equal(desc.at(-1), "m", "vazio no fim também na ordem decrescente");
    assert.deepEqual(desc.slice(0, 3), ["oe10", "oe2", "oe1"]);
    assert.deepEqual(ids({ ordem: { coluna: "subordinados", sentido: -1 } })[0], "m");
  });

  it("agrupa por camada, na ordem das camadas", () => {
    const grupos = agruparPorCamada(linhasDaPlanilha(cat, { hoje }), CAMADAS_PADRAO);
    assert.deepEqual(grupos.map((g) => [g.camada.id, g.linhas.length]), [["missao", 1], ["objetivoEstrategico", 3], ["objetivoDesenvolvimento", 1]]);
  });

  it("colar: instrumento pelo nome; superiores por código ou nome, só entre os permitidos", () => {
    const ler = (col, t, item = itens[4]) => lerValorDaCelula(col, t, item, cat, normalizar);
    assert.deepEqual(ler("instrumento", "pei 2021–2030"), { valor: "pei" });
    assert.deepEqual(ler("instrumento", ""), { valor: null });
    assert.ok(ler("instrumento", "PDI").erro);
    assert.deepEqual(ler("superiores", "oe1; Inovação\n"), { valor: ["oe1", "oe10"] });
    assert.ok(ler("superiores", "Missão").erro, "Missão não é camada permitida para Objetivo de Desenvolvimento");
    assert.deepEqual(ler("codigo", " OD2 \n"), { valor: "OD2" });
    assert.ok(ler("codigo", "X".repeat(21)).erro);
    assert.ok(ler("camada", "Política").erro);
    assert.deepEqual(candidatosASuperior(itens[4], cat).map((x) => x.id), ["oe1", "oe10", "oe2"]);
  });

  it("plano de gravação: campos primeiro, e as ligações a fazer e a desfazer", () => {
    let p = registrarValor(new Map(), itens[4], "superiores", ["oe10"]);
    p = registrarValor(p, itens[4], "nome", "Dados abertos");
    p = registrarValor(p, itens[1], "instrumento", null);
    assert.deepEqual(planoDeGravacao(itens, p), [
      { id: "od1", campos: { nome: "Dados abertos" }, ligar: ["oe10"], desligar: ["oe1"] },
      { id: "oe1", campos: { instrumento: null }, ligar: [], desligar: [] },
    ]);
  });
});
