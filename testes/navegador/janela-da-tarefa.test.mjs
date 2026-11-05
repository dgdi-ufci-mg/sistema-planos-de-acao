/**
 * Janela da tarefa (revisão de 04/11/2026, pedido do responsável, tomando o Todoist como referência; documentação técnica,
 * seção 8, "Ação"): a data-limite aparece uma vez só; sem atividade, uma coluna só, com o histórico no fim; ajuda no "?", e não em frases fixas; descrição com cara de texto, e não de caixa; título com o nome da lista; círculo de concluída antes do nome; situação sem o cadeado.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

/** Abre o exemplo "minhas tarefas" e a tarefa `nome`. */
async function abrirTarefa(sessao, nome, opcoes = {}, espaco = "minhas tarefas", linha = ".item") {
  const p = await sessao.abrir(opcoes);
  if ((opcoes.largura ?? 390) <= 640) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
  await p.locator(".lateral [data-espaco]").filter({ hasText: espaco }).click();
  await p.waitForSelector(`${linha} [data-marcar]`);
  await assentar(p);
  await p.locator(linha).filter({ hasText: nome }).locator(".rotulo").first().click();
  await p.waitForSelector(".camada.aberta .janela-grade");
  await assentar(p);
  return p;
}
const janela = (p) => p.locator(".camada.aberta .painel");

describe("Janela da tarefa no navegador", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  /** Abre a janelinha do atributo `campo` na coluna ao lado (05/11/2026). */
  async function abrirAtributo(p, campo) {
    await janela(p).locator(`[data-atributo="${campo}"]`).click();
    await assentar(p);
    return p.locator(`.camada.aberta [data-popover="${campo}"]`);
  }

  test("a data-limite fica na coluna de atributos; vencida, em vermelho, com \"Atrasada\"", async () => {
    const p = await abrirTarefa(sessao, "Enviar a frequência", { largura: 1280 });
    const j = janela(p);
    assert.equal(await j.locator(".janela-resumo").count(), 0, "sem o resumo antigo");
    const linha = j.locator('.janela-lado [data-atributo="dataLimite"]');
    assert.equal(await linha.locator(".atributo-valor .atrasada").count(), 1);
    assert.match(await linha.innerText(), /Atrasada/i);
    assert.equal(await j.locator('input[type="date"]').count(), 0, "o calendário só aparece na janelinha");
    assert.deepEqual(p.erros, []);
  });

  for (const largura of [1280, 390]) {
    test(`conteúdo à esquerda e atributos numa coluna fixa ao lado; no celular, logo abaixo da descrição (${largura} px)`, async () => {
      const p = await abrirTarefa(sessao, "Ler o relatório", { largura });
      const j = janela(p);
      assert.equal(await j.locator(".janela-grade.tarefa").count(), 1);
      assert.equal(await j.locator(".janela-abas").count(), 0);
      const caixa = async (sel) => j.locator(sel).first().boundingBox();
      const lado = await caixa(".janela-lado");
      const nome = await caixa(".janela-nome");
      const descricao = await caixa('[data-campo="descricao"]');
      const checklist = await caixa(".janela-resto");
      if (largura > 640) {
        assert.ok(lado.x > nome.x + nome.width - 2, "a coluna fica à direita do nome");
        assert.ok(lado.y <= nome.y, "e começa no alto");
      } else {
        assert.ok(lado.y > descricao.y && lado.y < checklist.y, "entre a descrição e o resto do conteúdo");
      }
      assert.deepEqual(await j.locator(".janela-lado [data-atributo]").evaluateAll((els) => els.map((el) => el.dataset.atributo).slice(0, 4)),
        ["situacao", "dataLimite", "naoAntesDe", "responsaveis"]);
      assert.equal(await j.locator(".janela-principal [data-historico]").count(), 1);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth) <= largura, "sem rolagem lateral");
      assert.deepEqual(p.erros, []);
    });
  }

  test("no plano com estimativas, as duas colunas de antes continuam", async () => {
    const p = await sessao.abrir({ largura: 1280 });
    await p.locator(".linha[data-abrir-acao]").first().click();
    await p.waitForSelector(".camada.aberta .janela-grade");
    await assentar(p);
    assert.equal(await janela(p).locator(".janela-grade.tarefa, .janela-lado").count(), 0);
    assert.equal(await janela(p).locator(".janela-atividade [data-historico]").count(), 1);
    assert.deepEqual(p.erros, []);
  });

  test("linha vazia mostra \"+\"; a linha inteira abre a janelinha, com a ajuda no \"?\"; clicar fora e Esc fecham", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    const j = janela(p);
    const linha = j.locator('[data-atributo="naoAntesDe"]');
    assert.equal(await linha.locator(".atributo-mais").count(), 1);
    /* clique perto da borda direita da linha, longe do texto: a linha inteira é o alvo */
    const r = await linha.boundingBox();
    await p.mouse.click(r.x + r.width - 30, r.y + r.height - 6);
    await assentar(p);
    const pop = p.locator('.camada.aberta [data-popover="naoAntesDe"]');
    assert.equal(await pop.count(), 1);
    assert.equal(await linha.getAttribute("aria-expanded"), "true");
    assert.equal(await p.evaluate(() => document.activeElement?.name), "naoAntesDe", "o cursor vai para a data");
    const caixaPop = await pop.boundingBox();
    assert.ok(caixaPop.y >= r.y + r.height - 1 || caixaPop.y + caixaPop.height <= r.y + 1, "junto da linha, sem cobri-la");
    /* Esc fecha só a janelinha, e a janela continua aberta */
    await p.keyboard.press("Escape");
    await assentar(p);
    assert.equal(await pop.count(), 0);
    assert.equal(await p.locator(".camada.aberta .janela-grade").count(), 1, "a janela continua aberta");
    /* o que se digitou e não gravou é descartado no Esc */
    await linha.click();
    await assentar(p);
    await p.keyboard.type("12122026", { delay: 40 });
    await p.keyboard.press("Escape");
    await assentar(p);
    assert.equal(await linha.locator(".atributo-mais").count(), 1, "continua vazia");
    await linha.click();
    await assentar(p);
    await j.locator(".janela-nome").click();
    await assentar(p);
    assert.equal(await pop.count(), 0, "clicar fora fecha");
    /* a ajuda fica no "?" da janelinha, que abre o glossário */
    await linha.click();
    await assentar(p);
    await pop.locator('[data-termo="naoAntesDe"]').click();
    await assentar(p);
    assert.match(await p.locator(".camada.aberta").last().innerText(), /antes de/i);
    assert.deepEqual(p.erros, []);
  });

  test("a descrição parece texto: sem borda nem alça, até passar o mouse ou editar", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    const caixa = janela(p).locator('[data-campo="descricao"] textarea');
    const estilo = () => caixa.evaluate((el) => { const c = getComputedStyle(el); return { borda: c.borderTopColor, fundo: c.backgroundColor, alca: c.resize }; });
    const parada = await estilo();
    assert.equal(parada.alca, "none");
    assert.equal(parada.fundo, "rgba(0, 0, 0, 0)");
    await caixa.click();
    await assentar(p, 300);
    assert.notEqual((await estilo()).fundo, "rgba(0, 0, 0, 0)", "ao editar, ganha fundo");
    assert.deepEqual(p.erros, []);
  });

  test("o título da janela é o nome da lista, e não \"Tarefa\"", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    assert.equal((await janela(p).locator("header h2").innerText()).trim(), "Exemplo: minhas tarefas");
    assert.deepEqual(p.erros, []);
  });

  test("o círculo de concluída fica antes do nome, na mesma linha, e o plano continua com Registrar conclusão", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    const j = janela(p);
    const circulo = await j.locator(".caixa-janela").boundingBox();
    const nome = await j.locator(".janela-nome").boundingBox();
    assert.ok(circulo.x < nome.x, "círculo à esquerda do nome");
    assert.ok(circulo.y >= nome.y && circulo.y + circulo.height <= nome.y + nome.height, "na altura do nome");
    const plano = await sessao.abrir({ largura: 1280 });
    await plano.locator(".linha[data-abrir-acao]").first().click();
    await plano.waitForSelector(".camada.aberta .janela-grade");
    assert.equal(await janela(plano).locator(".caixa-janela").count(), 0);
    assert.deepEqual(p.erros, []);
  });

  test("situação: lista com a atual marcada; escolher grava e fecha; sem o ícone de cadeado; no plano, o resumo continua", async () => {
    const p = await abrirTarefa(sessao, "Marcar reunião", { largura: 1280 }, "tarefas da equipe", ".cartao-quadro");
    const linha = janela(p).locator('[data-atributo="situacao"]');
    assert.equal(await linha.locator("svg").count(), 0);
    assert.match(await linha.innerText(), /A fazer/);
    const pop = await abrirAtributo(p, "situacao");
    assert.equal(await pop.locator('[aria-selected="true"]').innerText(), "A fazer");
    const outra = pop.locator('[data-escolher]:not([data-escolher=""])').first();
    const nome = (await outra.innerText()).trim();
    await outra.click();
    await assentar(p);
    assert.equal(await pop.count(), 0, "fecha ao escolher");
    assert.match(await linha.innerText(), new RegExp(nome));
    const plano = await sessao.abrir({ largura: 1280 });
    await plano.locator(".linha[data-abrir-acao]").first().click();
    await plano.waitForSelector(".camada.aberta .janela-grade");
    assert.ok(await janela(plano).locator(".janela-resumo dd.sit svg").count() >= 1);
    assert.deepEqual([...p.erros, ...plano.erros], []);
  });

  test("a janela tem altura fixa no computador, e cada coluna rola sozinha quando a tela é baixa", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280, altura: 520 });
    const principal = janela(p).locator(".janela-principal");
    await principal.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await assentar(p, 200);
    const fim = await janela(p).locator("[data-historico] summary").boundingBox();
    assert.ok(fim.y + fim.height <= 520, "o fim do conteúdo é alcançável rolando");
    assert.deepEqual(p.erros, []);
  });

  test("a descrição fica sempre à vista, logo abaixo do nome, mesmo vazia", async () => {
    const q = await abrirTarefa(sessao, "Marcar reunião", { largura: 1280 }, "tarefas da equipe", ".cartao-quadro");
    const j = janela(q);
    assert.equal(await j.locator('[data-mostrar-campo="descricao"], [data-mostrar-campo="checklist"]').count(), 0);
    const caixa = j.locator('[data-campo="descricao"] textarea');
    assert.equal(await caixa.getAttribute("placeholder"), "Descrição");
    assert.ok((await caixa.boundingBox()).y > (await j.locator(".janela-nome").boundingBox()).y);
    assert.ok((await caixa.boundingBox()).y < (await j.locator("[data-abrir-checklist]").boundingBox()).y);
    assert.deepEqual(q.erros, []);
  });

  test("data: atalhos com o dia ao lado; um atalho grava e fecha; \"Sem data\" retira; datas impossíveis não passam", async () => {
    const p = await abrirTarefa(sessao, "Marcar reunião", { largura: 1280 }, "tarefas da equipe", ".cartao-quadro");
    const linha = janela(p).locator('[data-atributo="dataLimite"]');
    let pop = await abrirAtributo(p, "dataLimite");
    const textos = await pop.locator("[data-atalho-data] .popover-texto").allInnerTexts();
    assert.deepEqual([textos[0], textos[1], textos.at(-1)], ["Hoje", "Amanhã", "Próxima semana"]);
    assert.ok((await pop.locator("[data-atalho-data] .popover-dia").first().innerText()).length >= 3, "o dia da semana ao lado");
    await pop.locator("[data-atalho-data]").nth(1).click();
    await assentar(p);
    assert.equal(await pop.count(), 0, "fecha ao escolher");
    assert.match(await linha.innerText(), /Amanhã/);
    assert.equal(await p.evaluate(() => document.activeElement?.dataset?.atributo), "dataLimite", "o foco volta à linha");
    /* "Não começa antes de" não passa da data-limite: os atalhos depois dela ficam desligados */
    pop = await abrirAtributo(p, "naoAntesDe");
    assert.match(await pop.innerText(), /Não pode passar da data-limite/);
    assert.equal(await pop.locator('[data-atalho-data]:has-text("Próxima semana")').isDisabled(), true);
    await p.keyboard.press("Escape");
    await assentar(p);
    pop = await abrirAtributo(p, "dataLimite");
    await pop.locator('[data-atalho-data=""]').click();
    await assentar(p);
    assert.equal(await linha.locator(".atributo-mais").count(), 1, "sem data, volta ao \"+\"");
    assert.deepEqual(p.erros, []);
  });

  test("responsáveis: marcar e desmarcar na lista, que fica aberta; a busca filtra e cadastra um nome novo", async () => {
    const p = await abrirTarefa(sessao, "Marcar reunião", { largura: 1280 }, "tarefas da equipe", ".cartao-quadro");
    const linha = janela(p).locator('[data-atributo="responsaveis"]');
    const pop = await abrirAtributo(p, "responsaveis");
    const primeira = pop.locator("[data-alternar]").first();
    const nome = (await primeira.innerText()).trim().split("\n").at(-1).trim();
    const antes = await primeira.getAttribute("aria-selected");
    await primeira.click();
    await assentar(p);
    assert.equal(await pop.count(), 1, "continua aberta para marcar outros");
    const depois = pop.locator("[data-alternar]").filter({ hasText: nome });
    assert.notEqual(await depois.getAttribute("aria-selected"), antes);
    assert.equal((await linha.innerText()).includes(nome), antes !== "true");
    await pop.locator('[name="filtroPopover"]').fill("Fulana de Teste");
    assert.equal(await pop.locator("[data-alternar]").count(), 0);
    await pop.locator('[data-criar="pessoa"]').click();
    await assentar(p);
    assert.match(await linha.innerText(), /Fulana de Teste/);
    assert.deepEqual(p.erros, []);
  });

  test("celular: a janelinha cabe na tela e não cria rolagem lateral", async () => {
    const p = await abrirTarefa(sessao, "Marcar reunião", { largura: 390 }, "tarefas da equipe", ".cartao-quadro");
    const pop = await abrirAtributo(p, "dataLimite");
    const c = await pop.boundingBox();
    assert.ok(c.x >= 0 && c.x + c.width <= 390, "dentro da largura");
    assert.ok(c.y >= 0 && c.y + c.height <= 800, "dentro da altura");
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390);
    assert.deepEqual(p.erros, []);
  });
  test("menu \"…\" do cabeçalho: data de criação, Copiar link, Duplicar e Excluir; Excluir saiu do rodapé", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    const j = janela(p);
    assert.equal(await j.locator(".janela-principal [data-excluir-acao]").count(), 0, "sem Excluir no rodapé");
    const botao = j.locator("header [data-menu-janela]");
    await botao.click();
    const menu = j.locator(".menu-da-janela");
    assert.equal(await botao.getAttribute("aria-expanded"), "true");
    assert.match(await menu.locator(".menu-info").innerText(), /^Criada em \d{2}\/\d{2}\/\d{4} às \d{2}h\d{2}$/);
    assert.deepEqual(await menu.locator("button").allInnerTexts(), ["Copiar link", "Duplicar", "Excluir tarefa"]);
    /* Esc fecha só o menu */
    await p.keyboard.press("Escape");
    assert.equal(await menu.count(), 0);
    assert.equal(await p.locator(".camada.aberta").count(), 1);
    /* Duplicar: uma tarefa nova com o mesmo nome, no fim da lista */
    const antes = await p.locator(".item").filter({ hasText: "Ler o relatório" }).count();
    await botao.click();
    await j.locator("[data-duplicar]").click();
    await assentar(p);
    assert.equal(await p.locator(".item").filter({ hasText: "Ler o relatório" }).count(), antes + 1);
    assert.match(await p.locator(".aviso-curto").innerText(), /Tarefa duplicada/);
    /* Excluir, pelo menu, com Desfazer no aviso */
    await botao.click();
    await j.locator("[data-excluir-acao]").click();
    await assentar(p);
    assert.equal(await p.locator(".camada.aberta").count(), 0);
    assert.match(await p.locator(".aviso-curto").innerText(), /excluída/);
    /* no plano, sem Duplicar (estimativas e dependências não se copiam) */
    const plano = await sessao.abrir({ largura: 1280 });
    await plano.locator(".linha[data-abrir-acao]").first().click();
    await plano.waitForSelector(".camada.aberta .janela-grade");
    await janela(plano).locator("header [data-menu-janela]").click();
    assert.deepEqual(await janela(plano).locator(".menu-da-janela button").allInnerTexts(), ["Copiar link", "Excluir ação"]);
    assert.deepEqual([...p.erros, ...plano.erros], []);
  });

  test("Copiar link: o endereço abre a janela da mesma tarefa; um número que não existe avisa", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await janela(p).locator("header [data-menu-janela]").click();
    await janela(p).locator("[data-copiar-link]").click();
    await assentar(p);
    const link = await p.evaluate(() => navigator.clipboard.readText());
    assert.match(link, /#\/espaco\/[\w-]+\/acao\/\d+$/);
    await p.keyboard.press("Escape");
    await assentar(p);
    assert.equal(await p.locator(".camada.aberta").count(), 0);
    await p.evaluate((h) => { location.hash = h; }, new URL(link).hash);
    await p.waitForSelector(".camada.aberta .janela-grade");
    await assentar(p);
    assert.equal(await janela(p).locator(".janela-nome").inputValue(), "Ler o relatório da CGU");
    assert.match(await p.evaluate(() => location.hash), /^#\/espaco\/[\w-]+$/, "o endereço volta a ser o do espaço");
    await p.keyboard.press("Escape");
    await assentar(p);
    await p.evaluate((h) => { location.hash = h.replace(/\d+$/, "9999"); }, new URL(link).hash);
    await assentar(p);
    assert.match(await p.locator(".aviso-curto").innerText(), /não encontrada/);
    assert.deepEqual(p.erros, []);
  });
  test("setas ↑↓ no cabeçalho passam à tarefa anterior e à seguinte da lista, sem fechar a janela", async () => {
    const p = await abrirTarefa(sessao, "Ler o relatório", { largura: 1280 });
    const j = janela(p);
    const nomes = await p.locator(".item .linha[data-abrir-acao]").evaluateAll((els) => els.filter((el) => el.getClientRects().length)
      .map((el) => el.closest("[data-numero]").querySelector(".rotulo").textContent.trim()));
    const i = nomes.findIndex((n) => n.startsWith("Ler o relatório"));
    assert.ok(i > 0 && i < nomes.length - 1, "a tarefa tem vizinhas acima e abaixo");
    const nome = () => j.locator(".janela-nome").inputValue();
    await j.locator('header [data-ir="1"]').click();
    await assentar(p);
    assert.equal(await nome(), nomes[i + 1]);
    assert.equal(await p.locator(".camada.aberta").count(), 1);
    await j.locator('header [data-ir="-1"]').click();
    await assentar(p);
    assert.equal(await nome(), nomes[i]);
    /* Alt+↑ também anda; na primeira, a seta de cima fica desligada */
    for (let k = 0; k < i; k++) { await p.keyboard.press("Alt+ArrowUp"); await assentar(p, 150); }
    assert.equal(await nome(), nomes[0]);
    assert.equal(await j.locator('header [data-ir="-1"]').isDisabled(), true);
    assert.equal(await j.locator('header [data-ir="-1"]').getAttribute("aria-label"), "Tarefa anterior");
    /* o que se digitou grava ao trocar de tarefa */
    await j.locator('[data-campo="descricao"] textarea').click();
    await j.locator('[data-campo="descricao"] textarea').fill("Texto novo");
    await j.locator('header [data-ir="1"]').click();
    await assentar(p);
    await j.locator('header [data-ir="-1"]').click();
    await assentar(p);
    assert.equal(await j.locator('[data-campo="descricao"] textarea').inputValue(), "Texto novo");
    assert.deepEqual(p.erros, []);
  });
});
