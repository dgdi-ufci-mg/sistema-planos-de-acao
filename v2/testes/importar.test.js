import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { planilhaDoEspaco } from "../js/exportar.js";
import { planejarImportacao } from "../js/importar.js";

const HOJE = "2026-10-20";
async function contexto(store, id) {
  const espaco = await store.lerEspaco(id);
  const acoes = await store.listarAcoes(id);
  const caminho = caminhoCritico(acoes, criarCalendario(espaco, HOJE), { hoje: HOJE });
  return { espaco, acoes, responsaveis: await store.listarResponsaveis(id), hoje: HOJE, situacaoDe: (n) => caminho.porAcao.get(n).situacao };
}
async function exemplo() {
  const store = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br", hoje: () => HOJE });
  const id = await carregarExemplo(store, new Date(`${HOJE}T12:00:00Z`));
  return { store, id };
}

describe("Importação por planilha (passo 1.19b)", () => {
  it("ida e volta: o que sai em “Copiar para planilha” entra num espaço vazio igual", async () => {
    const { store, id } = await exemplo();
    const texto = planilhaDoEspaco({ ...(await contexto(store, id)), geral: await store.lerCalendarioGeral() });
    const novo = await store.criarEspaco({ nome: "Cópia", inicio: "2026-09-01" });
    for (const r of await store.listarResponsaveis(id)) await store.criarResponsavel(novo, { tipo: r.tipo, nome: r.nome, sigla: r.sigla });
    const plano = planejarImportacao({ texto, ...(await contexto(store, novo)), modo: "criar" });
    assert.equal(plano.erro, null);
    assert.ok(plano.ignoradas.includes("Situação") && plano.ignoradas.includes("Conclusão prevista"));
    assert.equal(plano.linhas.filter((l) => l.tipo === "nova").length, 12);
    assert.equal(plano.etapasNovas.length, 6);
    const r = await store.importarAcoes(novo, plano);
    assert.deepEqual(r, { criadas: 12, atualizadas: 0, falhas: [] });
    const origem = await store.listarAcoes(id);
    const copia = await store.listarAcoes(novo);
    const porNome = (lista) => new Map(lista.map((a) => [a.rotulo, a]));
    const [po, pc] = [porNome(origem), porNome(copia)];
    const nome = (lista, n) => lista.find((a) => a.numero === n).rotulo;
    for (const [rotulo, a] of po) {
      const b = pc.get(rotulo);
      assert.ok(b, rotulo);
      assert.deepEqual(b.dependeDe.map((n) => nome(copia, n)).sort(), a.dependeDe.map((n) => nome(origem, n)).sort(), rotulo);
      const [va, vb] = [a.estimativas.at(-1), b.estimativas.at(-1)];
      assert.deepEqual([vb.o, vb.m, vb.p], [va.o, va.m, va.p], rotulo);
      assert.equal(b.responsaveis.length, a.responsaveis.length, rotulo);
      assert.equal(b.descricao, a.descricao);
    }
    const espaco = await store.lerEspaco(novo);
    assert.deepEqual(espaco.estrutura.map((f) => f.etapas.length), [2, 2, 2]);
  });

  it("“só criar novas” deixa as existentes como estão; “atualizar” muda só o que veio preenchido", async () => {
    const { store, id } = await exemplo();
    const [lev] = await store.listarAcoes(id);
    const ing = (await store.listarAcoes(id)).find((a) => a.rotulo === "Ingerir os dados de ensino"); // não liberada
    const texto = ["Número\tAção\tOtimista\tMais provável\tPessimista\tDescrição",
      `${lev.numero}\tLevantar requisitos (revisto)\t\t\t\t`,
      `${ing.numero}\tIngerir os dados de ensino\t9\t11\t20\t`,
      `\tNova ação de teste\t1\t2\t3\tCriada pela importação`].join("\n");
    const criar = planejarImportacao({ texto, ...(await contexto(store, id)), modo: "criar" });
    assert.deepEqual(criar.linhas.map((l) => l.tipo), ["ignorada", "ignorada", "nova"]);
    const atualizar = planejarImportacao({ texto, ...(await contexto(store, id)), modo: "atualizar" });
    assert.deepEqual(atualizar.linhas.map((l) => l.tipo), ["atualiza", "atualiza", "nova"]);
    const r = await store.importarAcoes(id, atualizar);
    assert.deepEqual(r, { criadas: 1, atualizadas: 2, falhas: [] });
    const depois = await store.listarAcoes(id);
    assert.equal(depois.find((a) => a.numero === lev.numero).rotulo, "Levantar requisitos (revisto)");
    assert.equal(depois.find((a) => a.numero === lev.numero).descricao, lev.descricao); // célula vazia não muda
    assert.deepEqual(["o", "m", "p"].map((k) => depois.find((a) => a.numero === ing.numero).estimativas.at(-1)[k]), [9, 11, 20]);
    assert.equal(depois.length, 13);
  });

  it("ação já liberada: a estimativa não muda pela importação, com aviso", async () => {
    const { store, id } = await exemplo();
    const lic = (await store.listarAcoes(id)).find((a) => a.rotulo === "Contratar licenças e suporte");
    const texto = `Número\tAção\tOtimista\tMais provável\tPessimista\n${lic.numero}\t${lic.rotulo}\t1\t2\t3`;
    const plano = planejarImportacao({ texto, ...(await contexto(store, id)), modo: "atualizar" });
    assert.equal(plano.linhas[0].tipo, "ignorada");
    assert.match(plano.linhas[0].avisos.join(" "), /Reestimar/);
  });

  it("dependências citam linhas novas pelo nome; erros e avisos claros", async () => {
    const { store, id } = await exemplo();
    const texto = ["Ação\tDepende de\tOtimista\tMais provável\tPessimista\tResponsáveis",
      "Primeira nova\t\t1\t2\t3\tANA",
      "Segunda nova\tPrimeira nova; Lançar o repositório; XYZ\t1\t2\t3\tFulano",
      "Terceira nova\t\t3\t2\t1\t"].join("\n");
    const plano = planejarImportacao({ texto, ...(await contexto(store, id)), modo: "criar" });
    const [a, b, c] = plano.linhas;
    assert.deepEqual(a.avisos, []);
    assert.ok(b.avisos.some((x) => x.includes("XYZ")) && b.avisos.some((x) => x.includes("Fulano")));
    assert.ok(c.avisos.some((x) => x.includes("Estimativa")));
    await store.importarAcoes(id, plano);
    const acoes = await store.listarAcoes(id);
    const seg = acoes.find((x) => x.rotulo === "Segunda nova");
    assert.deepEqual(seg.dependeDe.map((n) => acoes.find((x) => x.numero === n).rotulo).sort(), ["Lançar o repositório", "Primeira nova"]);
    assert.equal(acoes.find((x) => x.rotulo === "Terceira nova").estimativas.length, 0);
    assert.equal(planejarImportacao({ texto: "Fase\tEtapa\nx\ty", ...(await contexto(store, id)), modo: "criar" }).erro, "Falta a coluna com o nome da ação (título “Ação”).");
    assert.match(planejarImportacao({ texto: "Ação", ...(await contexto(store, id)), modo: "criar" }).erro, /Cole a linha de títulos/);
  });

  it("ciclos, códigos inválidos ou repetidos e nomes repetidos aparecem na conferência, e a gravação não falha", async () => {
    const { store, id } = await exemplo();
    await store.alterarEspaco(id, { camposOpcionais: { ...(await store.lerEspaco(id)).camposOpcionais, codigos: true } });
    const lev = (await store.listarAcoes(id)).find((a) => a.codigo === "LEV");
    const texto = ["Número\tCódigo\tAção\tDepende de",
      "\tAA\tAção A\tAção B",
      "\tAA\tAção B\tAção A",
      "\tx\tAção C\t",
      "\tLIC\tAção D\t",
      "\t\tAção A\t",
      `${lev.numero}\tLEV\t${lev.rotulo}\tLAN`].join("\n");
    const plano = planejarImportacao({ texto, ...(await contexto(store, id)), modo: "atualizar" });
    const [a, b, c, d, e, f] = plano.linhas;
    assert.deepEqual(a.avisos, []);
    assert.ok(b.avisos.some((x) => x.includes("ciclo")), "ciclo entre linhas novas");
    assert.ok(b.avisos.some((x) => x.includes("já está na linha 2")), "código repetido na planilha");
    assert.ok(c.avisos.some((x) => x.includes("inválido")));
    assert.ok(d.avisos.some((x) => x.includes("já é de outra ação")));
    assert.ok(e.avisos.some((x) => x.includes("mesmo nome")));
    assert.ok(f.avisos.some((x) => x.includes("ciclo")), "ciclo com ações existentes");
    const r = await store.importarAcoes(id, plano);
    assert.deepEqual(r.falhas, []);
    assert.equal(r.criadas, 5);
  });
});
