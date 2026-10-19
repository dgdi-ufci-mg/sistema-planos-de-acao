/**
 * Teste do dicionário de dados: o código (js/modelo.js) e o dicionário
 * (especificação, seção 4) precisam listar exatamente os mesmos campos.
 * Roda em toda mudança (AGENTS.md, seção 5).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMPOS } from "../js/modelo.js";

const CAMINHO_DO_DICIONARIO = new URL("../../docs/especificacao-reescrita.md", import.meta.url);

/**
 * Lê as tabelas marcadas com `<!-- dicionario: entidade -->`.
 * @returns {Map<string, {campo: string, tipo: string, obrigatorio: string}[]>}
 */
function lerDicionario() {
  const linhas = readFileSync(CAMINHO_DO_DICIONARIO, "utf8").split("\n");
  const tabelas = new Map();
  for (let i = 0; i < linhas.length; i++) {
    const marca = linhas[i].match(/^<!-- dicionario: (\w+) -->$/);
    if (!marca) continue;
    const entidade = marca[1];
    assert.ok(!tabelas.has(entidade), `Entidade "${entidade}" marcada duas vezes no dicionário.`);
    const linhasDaTabela = [];
    // pula o cabeçalho e a linha separadora da tabela
    for (let j = i + 3; j < linhas.length && linhas[j].startsWith("|"); j++) {
      const [campo, tipo, obrigatorio] = linhas[j].split("|").slice(1).map((c) => c.trim());
      linhasDaTabela.push({ campo: campo.replace(/`/g, ""), tipo, obrigatorio });
    }
    tabelas.set(entidade, linhasDaTabela);
  }
  return tabelas;
}

describe("Dicionário de dados", () => {
  const dicionario = lerDicionario();

  it("tem as mesmas entidades que o código", () => {
    assert.deepEqual([...dicionario.keys()].sort(), Object.keys(CAMPOS).sort());
  });

  for (const [entidade, campos] of Object.entries(CAMPOS)) {
    it(`"${entidade}": mesmos campos no código e no dicionário`, () => {
      const documentados = (dicionario.get(entidade) ?? []).map((l) => l.campo);
      const semDocumentacao = campos.filter((c) => !documentados.includes(c));
      const semCodigo = documentados.filter((c) => !campos.includes(c));
      assert.deepEqual(semDocumentacao, [], `Campos no código sem linha no dicionário: ${semDocumentacao}`);
      assert.deepEqual(semCodigo, [], `Campos no dicionário que o código não usa: ${semCodigo}`);
    });
  }

  it("toda linha informa tipo e se o campo é obrigatório", () => {
    for (const [entidade, linhas] of dicionario) {
      for (const { campo, tipo, obrigatorio } of linhas) {
        assert.ok(tipo, `${entidade}.${campo}: falta o tipo.`);
        assert.ok(["sim", "não"].includes(obrigatorio), `${entidade}.${campo}: "Obrig." deve ser sim ou não.`);
      }
    }
  });
});
