/** Painel público do Plano de Ação ou do Projeto (18/11/2026; documentação técnica, seção 4.13). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { montarLinhas } from "../js/lista.js";
import {
  montarResumo, numerosDoResumo, tempoDecorrido, responsaveisParaOPublico, gerarCodigoDoPainel, codigoValido, enderecoDoPainel,
  temPainel, painelLigado, problemaDaConfiguracao, TAMANHO_DA_APRESENTACAO, TAMANHO_DO_CODIGO,
} from "../js/painel-publico.js";
import { pecasDasVisoes } from "../js/painel-publico.js";
import { htmlDoPainel, visoesDoResumo, visaoDoEndereco } from "../js/telas/painel-publico.js";
import { montarCronograma } from "../js/cronograma.js";
import { montarRede } from "../js/rede.js";

const HOJE = "2026-11-18";
const espacoBase = {
  id: "e1", nome: "Plano de Ação da Gestão de Riscos", tipo: "planoDeAcao", codigo: "PA-GR", inicio: "2026-11-02", prazoFinal: "2027-12-31",
  aprovacao: { identificacao: "Resolução CGOV 1/2026", link: "https://exemplo.br/res1" },
  estrutura: [
    { id: "f1", nome: "Preparação", etapas: [{ id: "t1", nome: "Comitê" }] },
    { id: "f2", nome: "Mapeamento", etapas: [{ id: "t2", nome: "Áreas" }] },
  ],
  painelPublico: { ligado: true, codigo: "A".repeat(TAMANHO_DO_CODIGO), apresentacao: " Para que serve. ", mostrarNomes: false },
  acessos: { "ana@x.br": { papel: "administrador", responsavel: "r1" } },
};
const responsaveis = [
  { id: "r1", tipo: "pessoa", nome: "Ana Ribeiro", setor: "Governança", usuario: "ana@x.br" },
  { id: "r2", tipo: "pessoa", nome: "Bia Lima" },
  { id: "r3", tipo: "unidade", nome: "Diretoria de TI", sigla: "DTI" },
];
const acoes = [
  { numero: 1, rotulo: "Instituir o comitê", ordem: 1, etapa: "t1", dependeDe: [], responsaveis: ["r1"], concluidaEm: "2026-11-10",
    estimativas: [{ em: "2026-11-02", o: 2, m: 3, p: 5, contaDe: "liberacao" }], notas: "anotação interna" },
  { numero: 2, rotulo: "Mapear os riscos de TI", ordem: 2, etapa: "t2", dependeDe: [1], responsaveis: ["r2", "r3"],
    estimativas: [{ em: "2026-11-02", o: 1, m: 1, p: 1, contaDe: "liberacao" }] },
  { numero: 3, rotulo: "Consolidar a matriz", ordem: 3, etapa: "t2", dependeDe: [2], responsaveis: [],
    estimativas: [{ em: "2026-11-02", o: 5, m: 10, p: 20, contaDe: "liberacao" }] },
];

function linhasDe(espaco, lista = acoes, hoje = HOJE) {
  const cal = criarCalendario(espaco, hoje);
  const caminho = caminhoCritico(lista, cal, { hoje });
  return montarLinhas(lista, caminho, null, cal, hoje, { espaco });
}
/** Resumo como o Sextante monta: com o caminho crítico de hoje e o calendário (js/telas/espaco.js). */
function resumoDe(espaco = espacoBase, lista = acoes, hoje = HOJE, extras = {}) {
  const cal = criarCalendario(espaco, hoje);
  const caminho = caminhoCritico(lista, cal, { hoje });
  const linhas = montarLinhas(lista, caminho, null, cal, hoje, { espaco });
  return montarResumo({ espaco, linhas, responsaveis, entregas: [], caminho, cal, ...extras });
}

describe("Painel público: o resumo", () => {
  it("leva só o combinado: sem anotações, sem e-mails, sem estimativas", () => {
    const r = montarResumo({ espaco: espacoBase, linhas: linhasDe(espacoBase), responsaveis, entregas: [], programa: "PDGRI · Programa" });
    const texto = JSON.stringify(r);
    for (const proibido of ["anotação interna", "ana@x.br", "estimativas", "acessos", "Bia Lima"]) assert.ok(!texto.includes(proibido), proibido);
    assert.equal(r.apresentacao, "Para que serve.");
    assert.equal(r.codigo, "PA-GR");
    assert.equal(r.programa, "PDGRI · Programa");
    assert.deepEqual(r.aprovacao, { identificacao: "Resolução CGOV 1/2026", link: "https://exemplo.br/res1" });
    assert.equal(r.acoes.length, 3);
  });

  it("só concluída ou não concluída: a atrasada e a não liberada não vão a público (19/11/2026)", () => {
    const r = resumoDe();
    const [a1, a2, a3] = r.acoes;
    assert.equal(a1.situacao, "concluida");
    assert.equal(a1.data, "2026-11-10");
    assert.equal(a2.situacao, "naoConcluida", "no Sextante, atrasada: liberada em 10/11, um dia de duração");
    assert.equal(a3.situacao, "naoConcluida", "no Sextante, não liberada");
    assert.ok(!("rotulo" in a1));
    assert.equal(a1.fase, "f1");
    assert.equal(a2.fase, "f2");
    assert.equal(r.prazos, "estimativa");
  });

  it("datas planejadas: sem a regra \"nada termina no passado\", e iguais em qualquer dia (19/11/2026)", () => {
    const r = resumoDe();
    const a2 = r.acoes[1];
    assert.ok(a2.data < HOJE, `a data planejada fica no passado (${a2.data}); no Sextante, a previsão vai a hoje`);
    const depois = resumoDe(espacoBase, acoes, "2027-02-01");
    assert.deepEqual(depois.acoes.map((a) => a.data), r.acoes.map((a) => a.data), "a data não anda com o dia");
    assert.equal(depois.conclusaoPlanejada, r.conclusaoPlanejada);
    assert.equal(r.conclusaoPlanejada, r.acoes.map((a) => a.data).sort().at(-1));
    assert.ok(!("conclusaoPrevista" in r));
  });

  it("sem estimativa, sem data; sem o calendário, sem datas planejadas", () => {
    const semEstimativa = acoes.map((a) => (a.numero === 3 ? { ...a, estimativas: [] } : a));
    assert.equal(resumoDe(espacoBase, semEstimativa).acoes[2].data, null);
    const r = montarResumo({ espaco: espacoBase, linhas: linhasDe(espacoBase), responsaveis });
    assert.deepEqual(r.acoes.map((a) => a.data), ["2026-11-10", null, null], "a concluída mantém a data registrada");
  });

  it("espaço com data-limite (cronograma aberto): a data é a data-limite, sem conclusão planejada", () => {
    const aberto = { ...espacoBase, modelo: { prazos: "dataLimite", dependencias: false, simulacao: false } };
    const lista = [
      { numero: 1, rotulo: "Uma", ordem: 1, etapa: "t1", responsaveis: [], dataLimite: "2026-11-05" },
      { numero: 2, rotulo: "Duas", ordem: 2, etapa: "t2", responsaveis: [] },
    ];
    const r = resumoDe(aberto, lista);
    assert.equal(r.prazos, "dataLimite");
    assert.deepEqual(r.acoes.map((a) => [a.situacao, a.data]), [["naoConcluida", "2026-11-05"], ["naoConcluida", null]]);
    assert.equal(r.conclusaoPlanejada, null);
    assert.ok(!r.visoes.includes("tempo"));
    const html = htmlDoPainel({ resumo: r }, { abertos: new Set(["acoes"]), hoje: HOJE });
    assert.ok(html.includes("Até 05/11/2026"));
    assert.ok(!html.includes("Atrasada"));
  });

  it("ação contínua: não concluída, marcada como contínua", () => {
    const lista = [...acoes, { numero: 4, rotulo: "Apoio técnico", ordem: 4, etapa: "t2", responsaveis: [], comecaCom: { tipo: "projeto" }, terminaCom: { tipo: "projeto" } }];
    const r = resumoDe(espacoBase, lista);
    assert.deepEqual([r.acoes[3].situacao, r.acoes[3].continua], ["naoConcluida", true]);
    assert.equal(r.acoes[0].continua, false);
    const html = htmlDoPainel({ resumo: r }, { abertos: new Set(["acoes"]), hoje: HOJE });
    assert.ok(html.includes("Durante o trecho que acompanha"));
  });

  it("fases: contagem por fase, na ordem do espaço; sem fases ligadas, nenhuma", () => {
    const r = montarResumo({ espaco: espacoBase, linhas: linhasDe(espacoBase), responsaveis });
    assert.deepEqual(r.fases, [{ id: "f1", nome: "Preparação", total: 1, concluidas: 1 }, { id: "f2", nome: "Mapeamento", total: 2, concluidas: 0 }]);
    const sem = { ...espacoBase, camposOpcionais: { fasesEtapas: false } };
    const r2 = montarResumo({ espaco: sem, linhas: linhasDe(sem), responsaveis });
    assert.deepEqual(r2.fases, []);
    assert.ok(r2.acoes.every((a) => a.fase === null));
  });

  it("responsáveis: só a área por padrão (pessoa sem setor some); com nomes, nome e setor", () => {
    const pessoas = new Map(responsaveis.map((r) => [r.id, r]));
    assert.deepEqual(responsaveisParaOPublico(["r1", "r2", "r3"], pessoas, false), ["Governança", "Diretoria de TI"]);
    assert.deepEqual(responsaveisParaOPublico(["r1", "r2", "r3"], pessoas, true), ["Ana Ribeiro · Governança", "Bia Lima", "Diretoria de TI"]);
  });

  it("Projeto: sem código, Programa, aprovação nem entregas", () => {
    const projeto = { ...espacoBase, tipo: "projeto" };
    const r = montarResumo({ espaco: projeto, linhas: linhasDe(projeto), responsaveis, entregas: [{ id: "x", titulo: "X", situacao: "alcancada" }], programa: "P" });
    assert.equal(r.codigo, null);
    assert.equal(r.programa, null);
    assert.equal(r.aprovacao, null);
    assert.deepEqual(r.entregas, []);
  });

  it("entregas ativas, na ordem, com o nome da situação; os números do alto", () => {
    const entregas = [
      { id: "b", ordem: 2, titulo: "Matriz", situacao: "emAndamento", prazo: "2027-01-30" },
      { id: "a", ordem: 1, titulo: "Política aprovada", situacao: "alcancada" },
      { id: "c", ordem: 3, titulo: "Excluída", situacao: "naoIniciada", excluidaEm: "2026-11-01" },
    ];
    const r = montarResumo({ espaco: espacoBase, linhas: linhasDe(espacoBase), responsaveis, entregas });
    assert.deepEqual(r.entregas.map((e) => [e.titulo, e.rotulo]), [["Política aprovada", "Alcançada"], ["Matriz", "Em andamento"]]);
    assert.deepEqual(numerosDoResumo(r), { acoes: 3, concluidas: 1, pctConcluidas: 33, entregas: 2, alcancadas: 1, pctAlcancadas: 50 });
  });

  it("código: 20 letras e algarismos sem os que se confundem; endereço na pasta painel", () => {
    const codigo = gerarCodigoDoPainel();
    assert.equal(codigo.length, TAMANHO_DO_CODIGO);
    assert.ok(codigoValido(codigo));
    assert.ok(!/[0O1lI]/.test(codigo));
    assert.ok(!codigoValido("curto"));
    assert.ok(!codigoValido("../".padEnd(TAMANHO_DO_CODIGO, "a")));
    assert.equal(enderecoDoPainel("Abc", "https://x.br/s/"), "https://x.br/s/painel/?p=Abc");
  });

  it("quem tem painel; ligado só com código; apresentação até o limite", () => {
    assert.equal(temPainel({ tipo: "quadro" }), false);
    assert.equal(temPainel({ tipo: "projeto" }), true);
    assert.equal(painelLigado({ tipo: "projeto", painelPublico: { ligado: true } }), false);
    assert.equal(problemaDaConfiguracao({ apresentacao: "x".repeat(TAMANHO_DA_APRESENTACAO) }), null);
    assert.equal(problemaDaConfiguracao({ apresentacao: "x".repeat(TAMANHO_DA_APRESENTACAO + 1) }).codigo, "apresentacao-longa");
  });
});

describe("Painel público: a página", () => {
  const resumo = montarResumo({ espaco: espacoBase, linhas: linhasDe(espacoBase), responsaveis, entregas: [{ id: "a", titulo: "Política <b>", situacao: "alcancada" }] });
  it("mostra título, código, apresentação, aprovação e os blocos recolhidos", () => {
    const html = htmlDoPainel({ resumo, atualizadoEm: "2026-11-18T13:42:00.000Z" }, { hoje: HOJE });
    for (const t of ["Plano de Ação da Gestão de Riscos", "PA-GR", "Para que serve.", "Resolução CGOV 1/2026", "Ações concluídas", "Entregas alcançadas", "Tempo decorrido até o prazo", "Andamento das ações por fase"]) {
      assert.ok(html.includes(t), t);
    }
    assert.ok(html.includes("Política &lt;b&gt;"), "o texto vem escapado");
    assert.ok(!/data-bloco="\w+" open/.test(html), "os blocos começam recolhidos");
    for (const t of ["Sextante", "Atrasad", "Liberad", "Conclusão prevista"]) assert.ok(!html.includes(t), t);
  });
  it("legenda das fases e filtros: só concluídas e não concluídas", () => {
    const html = htmlDoPainel({ resumo }, { abertos: new Set(["fases", "acoes"]), hoje: HOJE });
    assert.ok(html.includes("Não concluídas"));
    assert.deepEqual([...html.matchAll(/data-filtro="(\w+)"/g)].map((m) => m[1]), ["todas", "concluida", "naoConcluida"]);
  });
  it("resumo antigo, com as situações de antes: tudo o que não é concluída conta como não concluída", () => {
    const antigo = { ...resumo, acoes: resumo.acoes.map((a, i) => ({ ...a, situacao: ["concluida", "atrasada", "naoLiberada"][i], rotulo: "Atrasada" })) };
    const html = htmlDoPainel({ resumo: antigo }, { abertos: new Set(["acoes"]), filtro: "naoConcluida", hoje: HOJE });
    assert.ok(html.includes("Mapear os riscos de TI") && html.includes("Consolidar a matriz"));
    assert.ok(!html.includes("Atrasada"));
  });
  it("uma fase só ou nenhuma entrega: os blocos somem", () => {
    const html = htmlDoPainel({ resumo: { ...resumo, fases: resumo.fases.slice(0, 1), entregas: [] }, atualizadoEm: null }, {});
    assert.ok(!html.includes("Andamento das ações por fase"));
    assert.ok(!html.includes("Entregas alcançadas"));
  });
  it("aberto, mostra as ações agrupadas por fase e o filtro escolhido", () => {
    const html = htmlDoPainel({ resumo, atualizadoEm: null }, { abertos: new Set(["acoes"]), filtro: "naoConcluida", hoje: HOJE });
    assert.ok(html.includes("Mapear os riscos de TI"));
    assert.ok(!html.includes("Instituir o comitê"), "o filtro esconde as concluídas");
  });
});

describe("Painel público: o Store", () => {
  /** Ana administra; Bia é Usuária; Caio, Leitor. Todos no mesmo banco. */
  async function cenario() {
    const banco = criarBancoLocal();
    let k = 0;
    const aleatorio = (n) => Uint8Array.from({ length: n }, () => k++ % 256);
    const ana = criarStore(banco, { exigirLogin: true, usuario: "ana@x.br", aleatorio, hoje: () => HOJE });
    const id = await ana.criarEspaco({ nome: "Plano", tipo: "projeto", inicio: "2026-11-02" });
    for (const [nome, usuario, papel] of [["Bia", "bia@x.br", "usuario"], ["Caio", "caio@x.br", "leitor"]]) {
      await ana.criarResponsavel(id, { tipo: "pessoa", nome, usuario });
      await ana.definirPapel(id, usuario, papel);
    }
    const loja = (u) => criarStore(banco, { exigirLogin: true, usuario: u, hoje: () => HOJE });
    return { banco, id, ana, bia: loja("bia@x.br"), caio: loja("caio@x.br"), anonimo: criarStore(banco, { exigirLogin: true }) };
  }
  const resumo = { nome: "Plano", codigo: null, tipo: "projeto", apresentacao: "", programa: null, aprovacao: null, inicio: null, prazoFinal: null, prazos: "estimativa", conclusaoPlanejada: null, acoes: [], fases: [], entregas: [] };

  it("só o administrador liga; o código é sorteado uma vez e o endereço muda só quando pedido", async () => {
    const { id, ana, bia } = await cenario();
    await assert.rejects(bia.configurarPainelPublico(id, { ligado: true }), { codigo: "sem-permissao" });
    const c1 = await ana.configurarPainelPublico(id, { ligado: true, apresentacao: "  Oi  " });
    assert.ok(codigoValido(c1.codigo));
    assert.equal(c1.apresentacao, "Oi");
    const c2 = await ana.configurarPainelPublico(id, { mostrarNomes: true });
    assert.equal(c2.codigo, c1.codigo, "ajustar não troca o endereço");
    assert.equal(c2.apresentacao, "Oi");
    const c3 = await ana.gerarNovoEnderecoDoPainel(id);
    assert.notEqual(c3.codigo, c1.codigo);
    await assert.rejects(ana.alterarEspaco(id, { painelPublico: { ligado: false } }), { codigo: "campo-fixo" });
    await assert.rejects(ana.configurarPainelPublico(id, { apresentacao: "x".repeat(TAMANHO_DA_APRESENTACAO + 1) }), { codigo: "apresentacao-longa" });
  });

  it("Usuário publica; Leitor e quem não entrou, não; igual não regrava; qualquer pessoa lê pelo código", async () => {
    const { id, ana, bia, caio, anonimo } = await cenario();
    const { codigo } = await ana.configurarPainelPublico(id, { ligado: true });
    assert.equal(await bia.publicarPainelPublico(id, resumo), true);
    assert.equal(await bia.publicarPainelPublico(id, resumo), false, "o mesmo resumo não é gravado de novo");
    await assert.rejects(caio.publicarPainelPublico(id, { ...resumo, nome: "Outro" }), { codigo: "sem-permissao" });
    assert.equal(await anonimo.publicarPainelPublico(id, resumo), false, "sem login, não grava nem dá erro");
    const lido = await anonimo.lerPainelPublico(codigo);
    assert.equal(lido.resumo.nome, "Plano");
    assert.equal(lido.ligado, true);
    assert.equal(lido.espacoId, undefined, "a página não recebe o id do espaço");
    assert.equal(await anonimo.lerPainelPublico("../espacos"), null);
  });

  it("recusa campos fora do combinado no resumo", async () => {
    const { id, ana } = await cenario();
    await ana.configurarPainelPublico(id, { ligado: true });
    await assert.rejects(ana.publicarPainelPublico(id, { ...resumo, notas: "x" }), { codigo: "campo-desconhecido" });
    await assert.rejects(ana.publicarPainelPublico(id, { ...resumo, acoes: [{ numero: 1, email: "a@x.br" }] }), { codigo: "campo-desconhecido" });
  });

  it("desligar ou trocar o endereço esvazia a cópia antiga na hora", async () => {
    const { id, ana, anonimo } = await cenario();
    const { codigo } = await ana.configurarPainelPublico(id, { ligado: true });
    await ana.publicarPainelPublico(id, resumo);
    await ana.configurarPainelPublico(id, { ligado: false });
    assert.deepEqual([(await anonimo.lerPainelPublico(codigo)).ligado, (await anonimo.lerPainelPublico(codigo)).resumo], [false, null]);
    assert.equal(await ana.publicarPainelPublico(id, resumo), false, "desligado, não publica");
    await ana.configurarPainelPublico(id, { ligado: true });
    assert.equal(await ana.publicarPainelPublico(id, resumo), true, "religado: o mesmo endereço volta a ter o resumo");
    const novo = await ana.gerarNovoEnderecoDoPainel(id);
    assert.equal((await anonimo.lerPainelPublico(codigo)).resumo, null);
    assert.equal(await ana.publicarPainelPublico(id, resumo), true);
    assert.equal((await anonimo.lerPainelPublico(novo.codigo)).resumo.nome, "Plano");
  });

  it("Quadros e Listas de tarefas não têm painel", async () => {
    const { ana } = await cenario();
    const q = await ana.criarEspaco({ nome: "Quadro", tipo: "quadro" });
    await assert.rejects(ana.configurarPainelPublico(q, { ligado: true }), { codigo: "sem-painel" });
  });
});

describe("Painel público: as visões só de leitura (parte 2)", () => {
  const comVisoes = (espaco = espacoBase, lista = acoes) => {
    const cal = criarCalendario(espaco, HOJE);
    const caminho = caminhoCritico(lista, cal, { hoje: HOJE });
    const linhas = montarLinhas(lista, caminho, null, cal, HOJE, { espaco });
    return { cal, caminho, linhas, resumo: montarResumo({ espaco, linhas, responsaveis, entregas: [], caminho, cal }) };
  };

  it("sem caminho crítico, o resumo não oferece visões nem leva os dados delas", () => {
    const r = montarResumo({ espaco: espacoBase, linhas: linhasDe(espacoBase), responsaveis });
    assert.deepEqual(r.visoes, []);
    assert.deepEqual(r.etapas, []);
    assert.ok(!("dependeDe" in r.acoes[0]) && !("inicio" in r.acoes[0]));
    assert.deepEqual(visoesDoResumo(r), []);
  });

  it("com o caminho crítico, leva as visões, as etapas e, por ação, etapa, ligações, início, duração e folga", () => {
    const { resumo: r, cal } = comVisoes();
    assert.deepEqual(r.visoes, ["tempo", "rede"]);
    assert.deepEqual(r.etapas, [{ id: "t1", nome: "Comitê", fase: "f1" }, { id: "t2", nome: "Áreas", fase: "f2" }]);
    const [a1, a2, a3] = r.acoes;
    assert.equal(a2.etapa, "t2");
    assert.deepEqual(a3.dependeDe, [2]);
    assert.equal(a2.inicio, cal.data(caminhoCritico(acoes, cal).porAcao.get(2).liberacao));
    assert.equal(a3.critica, true);
    assert.equal(a3.folga, 0);
    assert.equal(a1.comecaCom, null);
    assert.ok(a3.conclusao > a3.liberacao);
    assert.deepEqual(visoesDoResumo(r), ["tempo", "rede"]);
    assert.equal(visaoDoEndereco("#em-rede", r), "rede");
    assert.equal(visaoDoEndereco("#qualquer", r), null);
  });

  it("o Store publica o resumo com as visões e recusa campo estranho nos marcos", async () => {
    const ana = criarStore(criarBancoLocal(), { exigirLogin: true, usuario: "ana@x.br", hoje: () => HOJE });
    const id = await ana.criarEspaco({ nome: "Plano", tipo: "projeto", inicio: "2026-11-02" });
    await ana.configurarPainelPublico(id, { ligado: true });
    const { resumo } = comVisoes();
    assert.equal(await ana.publicarPainelPublico(id, resumo), true);
    const acoesComMarco = [{ ...resumo.acoes[0], comecaCom: { tipo: "projeto", extra: 1 } }];
    await assert.rejects(ana.publicarPainelPublico(id, { ...resumo, acoes: acoesComMarco }), { codigo: "campo-desconhecido" });
  });

  it("refeitas pelo painel, as peças dão ao Cronograma e à Rede as datas planejadas e as ligações do Sextante", () => {
    const { resumo, cal } = comVisoes();
    const caminho = caminhoCritico(acoes, cal); // planejado: sem a data de hoje (19/11/2026)
    const pecas = pecasDasVisoes(resumo);
    const original = montarCronograma(acoes, caminho, cal, { estrutura: espacoBase.estrutura, usaFases: true });
    const publico = montarCronograma(pecas.acoes, pecas.caminho, pecas.cal, { estrutura: pecas.estrutura, usaFases: pecas.usaFases });
    const barras = (m) => m.linhas.filter((l) => l.tipo === "acao").map(({ barra: b }) => [b.numero, b.inicio, b.fim, b.duracao, b.critica, b.dependeDe.join()]);
    assert.deepEqual(barras(publico), barras(original));
    assert.deepEqual(publico.linhas.map((l) => l.tipo === "grupo" ? l.nome : l.barra.numero), original.linhas.map((l) => l.tipo === "grupo" ? l.nome : l.barra.numero));
    const marcos = pecas.estrutura.flatMap((f) => f.etapas.map((e) => ({ id: e.id, nome: e.nome, fase: f.id })));
    const rede = montarRede(pecas.acoes, pecas.caminho, { pontas: true, marcos, marcoDe: (a) => a.etapa });
    const original2 = montarRede(acoes, caminho, { pontas: true, marcos, marcoDe: (a) => a.etapa });
    const setas = (r) => r.arestas.filter((a) => !a.ligacao).map((a) => `${a.de}>${a.para}${a.critica ? " sem folga" : ""}`).sort();
    assert.deepEqual(setas(rede), setas(original2));
    assert.ok(setas(rede).some((t) => t.endsWith("sem folga")), "a seta sem folga continua pintada");
  });
});

describe("Painel público: tempo decorrido (19/11/2026)", () => {
  it("até o prazo, quando existe; sem prazo, até a conclusão planejada; sem os dois, só desde quando", () => {
    assert.deepEqual(tempoDecorrido({ inicio: "2026-11-06", prazoFinal: "2027-12-31", conclusaoPlanejada: "2028-07-17" }, "2026-11-19"),
      { referencia: "prazo", inicio: "2026-11-06", fim: "2027-12-31", decorridos: 13, total: 420, pct: 3, antesDoInicio: false });
    assert.equal(tempoDecorrido({ inicio: "2026-11-06", conclusaoPlanejada: "2026-12-06" }, "2026-11-21").referencia, "planejada");
    assert.equal(tempoDecorrido({ inicio: "2026-11-06", conclusaoPlanejada: "2026-12-06" }, "2026-11-21").pct, 50);
    const sem = tempoDecorrido({ inicio: "2026-11-06" }, "2026-11-19");
    assert.deepEqual([sem.referencia, sem.pct, sem.decorridos], [null, null, 13]);
    assert.equal(tempoDecorrido({}, "2026-11-19"), null);
  });
  it("depois da referência, a barra fica cheia; antes do início, nada decorreu", () => {
    const t = tempoDecorrido({ inicio: "2026-11-06", prazoFinal: "2026-11-16" }, "2027-01-01");
    assert.deepEqual([t.pct, t.decorridos, t.total], [100, 10, 10]);
    const antes = tempoDecorrido({ inicio: "2026-12-01", prazoFinal: "2027-01-01" }, "2026-11-19");
    assert.deepEqual([antes.antesDoInicio, antes.pct], [true, 0]);
  });
  it("na página: o cartão com a conclusão planejada embaixo; sem referência, Em andamento desde", () => {
    const r = { nome: "P", acoes: [], fases: [], entregas: [], inicio: "2026-11-06", prazoFinal: "2027-12-31", conclusaoPlanejada: "2028-07-17" };
    const html = htmlDoPainel({ resumo: r }, { hoje: "2026-11-19" });
    assert.ok(html.includes("Tempo decorrido até o prazo") && html.includes("13 de 420 dias") && html.includes("Conclusão planejada: <b>17/07/2028</b>"));
    const semPrazo = htmlDoPainel({ resumo: { ...r, prazoFinal: null, conclusaoPlanejada: null } }, { hoje: "2026-11-19" });
    assert.ok(semPrazo.includes("Em andamento desde") && semPrazo.includes("06/11/2026"));
  });
});
