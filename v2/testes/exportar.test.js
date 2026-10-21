import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { simular } from "../js/simulacao.js";
import { montarLinhas } from "../js/lista.js";
import { dataBr } from "../js/formato.js";
import { planilhaDoEspaco, mermaidDoEspaco } from "../js/exportar.js";

const HOJE = "2026-10-20";
async function exemplo() {
  const store = criarStore(criarBancoLocal(), { usuario: "ana.souza@ufci.edu.br" });
  const id = await carregarExemplo(store, new Date(`${HOJE}T12:00:00Z`));
  const dados = async () => ({
    espaco: await store.lerEspaco(id), acoes: await store.listarAcoes(id),
    responsaveis: await store.listarResponsaveis(id), geral: await store.lerCalendarioGeral(), hoje: HOJE,
  });
  return { store, id, dados };
}

describe("Exportação e cópia de segurança (passo 1.19a)", () => {
  it("planilha: uma linha por ação ativa, colunas alinhadas e a conclusão igual à da lista", async () => {
    const { dados } = await exemplo();
    const d = await dados();
    const linhas = planilhaDoEspaco(d).split("\n").map((l) => l.split("\t"));
    const [titulos, ...corpo] = linhas;
    assert.equal(corpo.length, d.acoes.length);
    for (const l of corpo) assert.equal(l.length, titulos.length);
    assert.ok(titulos.includes("Fase") && titulos.includes("Descrição") && !titulos.includes("Código")); // conforme os campos opcionais do exemplo
    const cal = criarCalendario(d.espaco, HOJE);
    const caminho = caminhoCritico(d.acoes, cal, { hoje: HOJE });
    const sim = simular(d.acoes, cal, { hoje: HOJE, semente: d.espaco.semente, simulacoes: 100 });
    const conclusao = new Map(montarLinhas(d.acoes, caminho, sim, cal, HOJE).map((l) => [String(l.acao.numero), dataBr(l.conclusao)]));
    const col = (nome) => titulos.indexOf(nome);
    for (const l of corpo) assert.equal(l[col("Conclusão prevista")], conclusao.get(l[col("Número")]));
    const lev = corpo.find((l) => l[col("Ação")] === "Levantar requisitos com as áreas");
    assert.equal(lev[col("Situação")], "Concluída");
    assert.equal(lev[col("Otimista")], "5");
    const lic = corpo.find((l) => l[col("Ação")] === "Contratar licenças e suporte");
    assert.equal(lic[col("Depende de")], lev[col("Número")]);
    assert.equal(lic[col("Responsáveis")], "DRO; DTI");
  });

  it("planilha: com códigos ligados, as dependências usam os códigos", async () => {
    const { dados } = await exemplo();
    const d = await dados();
    d.espaco.camposOpcionais = { ...d.espaco.camposOpcionais, codigos: true };
    const [titulos, ...corpo] = planilhaDoEspaco(d).split("\n").map((l) => l.split("\t"));
    const lic = corpo.find((l) => l[titulos.indexOf("Código")] === "LIC");
    assert.equal(lic[titulos.indexOf("Depende de")], "LEV");
  });

  it("fluxograma Mermaid: uma caixa por ação, uma seta por dependência, grupos por fase e etapa", async () => {
    const { dados } = await exemplo();
    const d = await dados();
    const m = mermaidDoEspaco(d);
    assert.match(m, /^flowchart LR/);
    const setas = m.split("\n").filter((l) => l.includes("-->"));
    assert.equal(setas.length, d.acoes.reduce((s, a) => s + a.dependeDe.length, 0));
    for (const a of d.acoes) assert.equal(m.split("\n").filter((l) => l.trim().startsWith(`A${a.numero}[`)).length, 1);
    assert.equal(m.split("\n").filter((l) => l.trim().startsWith("subgraph")).length, 3 + 6);
    assert.equal(m.split("\n").filter((l) => l.trim() === "end").length, 3 + 6);
    assert.match(m, /class .* critica/);
  });

  it("a ação excluída não aparece nas exportações, mas aparece na cópia de segurança", async () => {
    const { store, id, dados } = await exemplo();
    const [hom] = (await store.listarAcoes(id)).filter((a) => a.rotulo === "Homologar com as áreas");
    await store.excluirAcao(id, hom.numero, { religar: true });
    const d = await dados();
    assert.ok(!planilhaDoEspaco(d).includes("Homologar com as áreas"));
    assert.ok(!mermaidDoEspaco(d).includes("Homologar com as áreas"));
    const copia = await store.copiaDeSeguranca();
    const doEspaco = copia.espacos.find((e) => e.espaco.id === id);
    const naCopia = doEspaco.acoes.find((a) => a.numero === hom.numero);
    assert.ok(naCopia.excluidaEm);
    assert.equal(doEspaco.acoes.length, d.acoes.length + 1);
  });

  it("cópia de segurança: formato identificado, espaços excluídos, responsáveis e calendário geral", async () => {
    const { store, id } = await exemplo();
    await store.alterarCalendarioGeral([{ data: "2026-12-08", motivo: "Teste" }]);
    const outro = await store.criarEspaco({ nome: "Outro", inicio: HOJE });
    await store.excluirEspaco(outro);
    const copia = JSON.parse(JSON.stringify(await store.copiaDeSeguranca()));
    assert.equal(copia.formato, "sextante-copia-de-seguranca");
    assert.equal(copia.versao, 1);
    assert.equal(copia.geradaPor, "ana.souza@ufci.edu.br");
    assert.equal(copia.espacos.length, 2);
    assert.ok(copia.espacos.find((e) => e.espaco.id === outro).espaco.excluidoEm);
    assert.equal(copia.espacos.find((e) => e.espaco.id === id).responsaveis.length, 7);
    assert.equal(copia.calendarioGeral.datasExcluidas[0].data, "2026-12-08");
  });
});
