/**
 * Rede como prancheta (13/11/2026, pedido do responsável; documentação técnica, seção 8.4): o plano pode ser concebido
 * pela Rede. No plano vazio, o início e o término aparecem ligados, com um "+" que cria a primeira ação; o círculo de
 * início tem o seu "+"; e as linhas do início e do término também têm o "+" de inserir.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar, irParaVisualizacao } from "./apoio.mjs";

describe("Rede: prancheta do plano", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  /** cria um projeto vazio (sem fases) e abre a Rede */
  const planoVazio = async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 860, exemplo: false });
    await p.click("[data-acao=criar]");
    await assentar(p);
    await p.fill("[name=nome]", "Plano novo");
    await p.check("[name=tipo][value=projeto]");
    await p.check("[name=modelo][value=estruturado]");
    await p.click("form button[type=submit]");
    await p.waitForSelector(".aba-visao[data-modo=rede], .aba-mais");
    await irParaVisualizacao(p, "rede");
    await p.waitForSelector("[data-prancheta-mais]");
    return p;
  };
  const digitarNome = async (p, nome) => {
    await p.waitForSelector(".rede [data-editando]");
    await p.keyboard.type(nome);
    await p.keyboard.press("Enter");
    await assentar(p, 600);
    await p.keyboard.press("Escape"); // a caixinha de prazos fica para depois
    await assentar(p, 500);
  };
  const numeroDe = (p, nome) => p.locator(".rede-no", { hasText: nome }).getAttribute("data-numero").then(Number);

  test("plano vazio: o \"+\" entre o início e o término cria a primeira ação", async () => {
    const p = await planoVazio();
    assert.equal(await p.locator(".rede-prancheta .rede-ponto").count(), 2);
    await p.click("[data-prancheta-mais]");
    await digitarNome(p, "Levantar requisitos");
    assert.equal(await p.locator(".rede-no").count(), 1);
    assert.equal(await p.locator(".rede-prancheta").count(), 0, "a prancheta vazia dá lugar à rede");
    assert.deepEqual(p.erros, []);
  });

  test("o \"+\" do início cria uma ação no começo; o \"+\" das linhas insere antes da primeira e depois da última", async () => {
    const p = await planoVazio();
    await p.click("[data-prancheta-mais]");
    await digitarNome(p, "Levantar requisitos");
    const primeira = await numeroDe(p, "Levantar requisitos");

    await p.hover(".rede-ponto.inicio");
    await assentar(p, 250);
    assert.ok(await p.locator("[data-rede-inicio]").isVisible(), "o + aparece ao passar o mouse no início");
    await p.click("[data-rede-inicio]");
    await digitarNome(p, "Ação paralela");
    const paralela = await numeroDe(p, "Ação paralela");
    assert.equal(await p.locator(`.rede-ligacao[data-de="-1"][data-para="${paralela}"]`).count(), 1, "ligada ao início");
    assert.equal(await p.locator(`.rede-ligacao[data-de="${paralela}"][data-para="-2"]`).count(), 1, "ligada ao término");

    const antes = p.locator(`[data-inserir-de="-1"][data-inserir-para="${primeira}"]`);
    await antes.evaluate((el) => el.classList.add("visivel"));
    await antes.click();
    await digitarNome(p, "Antes de tudo");
    const nova = await numeroDe(p, "Antes de tudo");
    assert.equal(await p.locator(`.rede-seta[data-de="${nova}"][data-para="${primeira}"]`).count(), 1, "a primeira passa a depender da nova");
    assert.equal(await p.locator(`.rede-ligacao[data-de="-1"][data-para="${primeira}"]`).count(), 0);

    const fim = p.locator(`[data-inserir-de="${primeira}"][data-inserir-para="-2"]`);
    await fim.evaluate((el) => el.classList.add("visivel"));
    await fim.click();
    await digitarNome(p, "Fechar o plano");
    const ultima = await numeroDe(p, "Fechar o plano");
    assert.equal(await p.locator(`.rede-seta[data-de="${primeira}"][data-para="${ultima}"]`).count(), 1);
    assert.equal(await p.locator(".rede-no").count(), 4);

    /* Ctrl+Z desfaz o nome e, depois, a criação da última */
    await p.keyboard.press("Control+z");
    await assentar(p, 700);
    await p.keyboard.press("Control+z");
    await assentar(p, 700);
    assert.equal(await p.locator(".rede-no").count(), 3);
    assert.deepEqual(p.erros, []);
  });

  test("com fases, o \"+\" do início pergunta a etapa", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 860 });
    await irParaVisualizacao(p, "rede");
    await p.waitForSelector(".rede-no");
    await assentar(p);
    const antes = await p.locator(".rede-no").count();
    await p.hover(".rede-ponto.inicio");
    await assentar(p, 250);
    await p.click("[data-rede-inicio]");
    await p.waitForSelector(".rede-escolha");
    const opcoes = await p.locator(".rede-escolha [data-escolher-etapa]").allTextContents();
    assert.ok(opcoes.length >= 4 && opcoes.at(-2) === "Sem etapa" && opcoes.at(-1) === "Nova etapa…", "todas as etapas, \"Sem etapa\" e \"Nova etapa…\"");
    await p.locator(".rede-escolha [data-escolher-etapa]").nth(1).click();
    await digitarNome(p, "Nova no começo");
    assert.equal(await p.locator(".rede-no").count(), antes + 1);
    const no = p.locator(".rede-no", { hasText: "Nova no começo" });
    assert.ok((await no.getAttribute("data-etapa")).length > 0, "fica na etapa escolhida");
    assert.deepEqual(p.erros, []);
  });

  /* ---------- fases e etapas pela Rede (17/11/2026) ---------- */
  test("plano sem fases: botão direito, Etapa, \"Nova etapa…\" cria a fase e a etapa e põe a ação nela", async () => {
    const p = await planoVazio();
    await p.click("[data-prancheta-mais]");
    await digitarNome(p, "Levantar requisitos");
    const card = p.locator(".rede-no", { hasText: "Levantar requisitos" });
    await card.click({ button: "right" });
    await assentar(p, 300);
    await p.locator(".rede-menu button", { hasText: "Etapa" }).click();
    await assentar(p, 300);
    assert.deepEqual(await p.locator(".rede-campo-etapa [data-opcao]").allTextContents(), ["Sem etapa", "Nova etapa…"]);
    await p.locator(".rede-campo-etapa .rede-opcao-nova").click();
    await p.waitForSelector(".rede-nova-etapa");
    assert.equal(await p.locator(".rede-nova-etapa [name=fase]").count(), 0, "sem fases, não há lista de fases");
    await p.press(".rede-nova-etapa [name=etapa]", "Enter");
    assert.equal(await p.locator(".rede-nova-etapa .rede-estimar-erro").textContent(), "Dê um nome à etapa.");
    await p.fill(".rede-nova-etapa [name=etapa]", "Diagnóstico");
    await p.press(".rede-nova-etapa [name=etapa]", "Enter");
    assert.equal(await p.locator(".rede-nova-etapa .rede-estimar-erro").textContent(), "Dê um nome à fase.");
    await p.fill(".rede-nova-etapa [name=novaFase]", "Planejamento");
    await p.press(".rede-nova-etapa [name=novaFase]", "Enter");
    await p.waitForSelector(".rede-cerca-nome:has-text('Diagnóstico')");
    await assentar(p, 600);
    assert.deepEqual(await p.locator(".rede-fase-nome").allTextContents(), ["Planejamento"]);
    assert.equal(await card.getAttribute("data-etapa") !== "", true);
    assert.deepEqual(p.erros, []);
  });

  test("\"+\" do início com \"Nova etapa…\"; clique duplo renomeia etapa e fase; Ctrl+Z desfaz", async () => {
    const p = await sessao.abrir({ largura: 1440, altura: 860 });
    await irParaVisualizacao(p, "rede");
    await p.waitForSelector(".rede-no");
    await assentar(p);
    await p.hover(".rede-ponto.inicio");
    await assentar(p, 250);
    await p.click("[data-rede-inicio]");
    await p.waitForSelector(".rede-escolha");
    assert.equal(await p.locator(".rede-escolha [data-escolher-etapa]").last().textContent(), "Nova etapa…");
    await p.locator(".rede-escolha .rede-opcao-nova").click();
    await p.waitForSelector(".rede-nova-etapa");
    const fases = await p.locator(".rede-nova-etapa [name=fase] option").allTextContents();
    assert.equal(fases.at(-1), "Nova fase…");
    await p.fill(".rede-nova-etapa [name=etapa]", "Sondagem");
    await p.press(".rede-nova-etapa [name=etapa]", "Enter");
    await digitarNome(p, "Ouvir as áreas");
    const nova = p.locator(".rede-no", { hasText: "Ouvir as áreas" });
    const etapa = await nova.getAttribute("data-etapa");
    assert.ok(etapa, "a ação nasce na etapa nova");
    assert.equal(await p.locator(".rede-cerca-nome", { hasText: "Sondagem" }).count(), 1);

    /* renomear a etapa */
    await p.locator(".rede-cerca-nome", { hasText: "Sondagem" }).dblclick();
    await p.waitForSelector(".rede-rotulo-campo");
    await p.fill(".rede-rotulo-campo", "Escuta das áreas");
    await p.press(".rede-rotulo-campo", "Enter");
    await p.waitForSelector(".rede-cerca-nome:has-text('Escuta das áreas')");
    /* renomear a fase, na régua; Esc desiste */
    const fase = p.locator(".rede-fase-nome").first();
    const nomeFase = await fase.textContent();
    await fase.dblclick();
    await p.waitForSelector(".rede-rotulo-campo");
    await p.fill(".rede-rotulo-campo", "Outro nome");
    await p.press(".rede-rotulo-campo", "Escape");
    assert.equal(await fase.textContent(), nomeFase, "Esc mantém o nome");
    await fase.dblclick();
    await p.fill(".rede-rotulo-campo", "Fase 1 · Concepção");
    await p.press(".rede-rotulo-campo", "Enter");
    await p.waitForSelector(".rede-fase-nome:has-text('Fase 1 · Concepção')");

    /* Ctrl+Z: o nome da fase, depois o da etapa */
    await p.locator(".rede-rolagem").click({ position: { x: 40, y: 600 } });
    await p.keyboard.press("Control+z");
    await p.waitForSelector(`.rede-fase-nome:has-text('${nomeFase}')`);
    await p.keyboard.press("Control+z");
    await p.waitForSelector(".rede-cerca-nome:has-text('Sondagem')");
    assert.deepEqual(p.erros, []);
  });
});
