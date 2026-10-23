/**
 * Ensaio da migração (preparação do passo 1.20; especificação, seção 11). Não faz parte dos testes
 * automáticos e não grava em banco nenhum: lê a cópia de segurança da versão atual (o texto do botão
 * "Copiar cópia de segurança", salvo num arquivo) e escreve a cópia de segurança da versão 2, para
 * conferir e, na troca, restaurar num banco vazio pela própria versão 2.
 *
 * Uso, dentro de v2/:
 *   node testes/migrar-copia.mjs copia-versao-atual.json saida-versao-2.json [--unidades id1,id2]
 * --unidades: ids das pessoas da versão atual que são unidades (setores), e não pessoas.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { migrarCopiaV1 } from "../js/migracao.js";

const [entrada, saida, ...resto] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error("Uso: node testes/migrar-copia.mjs copia-versao-atual.json saida-versao-2.json [--unidades id1,id2]");
  process.exit(1);
}
const i = resto.indexOf("--unidades");
const unidades = i >= 0 ? String(resto[i + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : [];
const { copia, relatorio } = migrarCopiaV1(JSON.parse(readFileSync(entrada, "utf8")), { unidades });
writeFileSync(saida, JSON.stringify(copia, null, 1));
for (const e of relatorio.espacos) {
  console.log(`\n${e.nome} (${e.id}): ${e.acoes} ações, ${e.etapas} etapas, ${e.responsaveis} responsáveis, ${e.retratos} retrato(s)`);
  for (const a of e.avisos) console.log(`  - ${a}`);
}
for (const a of relatorio.avisos) console.log(`\n- ${a}`);
console.log(`\nCópia da versão 2 escrita em ${saida}. Nada foi gravado em banco.`);
