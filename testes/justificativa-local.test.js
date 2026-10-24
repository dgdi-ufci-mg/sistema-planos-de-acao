/** Justificativa e local da ação, do 5W2H (passo 2.10a; documentação técnica, seções 4.2 e 16.8). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { descreverRegistro } from "../js/historico.js";
import { planejarImportacao } from "../js/importar.js";
import { planilhaDoEspaco } from "../js/exportar.js";

const novo = async () => {
  let relogio = 0;
  const store = criarStore(criarBancoLocal(), {
    usuario: "ana@ufci.edu.br", hoje: () => "2026-10-24",
    agora: () => new Date(Date.UTC(2026, 9, 24, 10, 0, relogio++)).toISOString(),
  });
  const id = await store.criarEspaco({ nome: "E", inicio: "2026-10-01" });
  return { store, id };
};

describe("Justificativa e local", () => {
  it("gravam como textos da ação e entram no histórico", async () => {
    const { store, id } = await novo();
    const a = await store.criarAcao(id, { rotulo: "Reformar", justificativa: "Acórdão do TCU", local: "Campus I" });
    await store.alterarAcao(id, a, { local: "Campus II" });
    await store.alterarAcao(id, a, { justificativa: "" });
    const rs = (await store.listarHistorico(id, a)).filter((r) => r.tipo === "alteracao");
    assert.deepEqual(rs.map((r) => descreverRegistro(r, {})), ["Mudou o local para “Campus II”.", "Apagou a justificativa."]);
  });

  it("a importação lê as colunas (também “Por quê” e “Onde”) e liga os campos", async () => {
    const { store, id } = await novo();
    const plano = planejarImportacao({ texto: "Ação\tPor quê\tOnde\nReformar\tAcórdão\tCampus I", espaco: await store.lerEspaco(id), acoes: [], responsaveis: [], hoje: "2026-10-24", situacaoDe: () => "liberada", modo: "criar" });
    assert.deepEqual(plano.linhas[0].campos, { rotulo: "Reformar", justificativa: "Acórdão", local: "Campus I" });
    await store.importarAcoes(id, plano);
    const [acao] = await store.listarAcoes(id);
    assert.equal(acao.local, "Campus I");
    const { camposOpcionais } = await store.lerEspaco(id);
    assert.equal(camposOpcionais.justificativa, true);
    assert.equal(camposOpcionais.local, true);
  });

  it("a exportação traz as colunas só com os campos ligados", () => {
    const acoes = [{ numero: 1, ordem: 1, rotulo: "Reformar", dependeDe: [], responsaveis: [], estimativas: [], justificativa: "Acórdão", local: "Campus I" }];
    const espaco = { id: "e", nome: "E", inicio: "2026-10-01", camposOpcionais: { justificativa: true, local: true } };
    const [titulos, linha] = planilhaDoEspaco({ espaco, acoes, responsaveis: [], geral: {}, hoje: "2026-10-24" }).split("\n").map((l) => l.split("\t"));
    assert.equal(linha[titulos.indexOf("Justificativa")], "Acórdão");
    assert.equal(linha[titulos.indexOf("Local")], "Campus I");
    const sem = planilhaDoEspaco({ espaco: { ...espaco, camposOpcionais: {} }, acoes, responsaveis: [], geral: {}, hoje: "2026-10-24" }).split("\n")[0];
    assert.ok(!sem.includes("Justificativa") && !sem.includes("Local"));
  });
});
