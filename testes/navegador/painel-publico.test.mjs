/**
 * Painel público (18/11/2026; documentação técnica, seções 4.13 e 8.8): em "Configurar este espaço", o administrador
 * liga o painel, vê o endereço, escreve a apresentação e vê a prévia; a página painel/ abre sem login e, sem banco
 * (testes), avisa que o painel não foi encontrado.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pular, iniciar, assentar } from "./apoio.mjs";

describe("Painel público", { skip: pular }, () => {
  let sessao;
  before(async () => { sessao = await iniciar(); });
  after(async () => { await sessao?.fechar(); });

  const abrirSecao = async (p, largura) => {
    if (largura <= 640) { await p.click('[data-inferior="espacos"]'); await assentar(p); }
    await p.locator(".lateral .espaco-item.atual [data-configurar]").click();
    await assentar(p);
    const painel = p.locator(".camada.aberta");
    await painel.locator('.config-nav button:has-text("Painel público"), [data-secao="painel"] > summary').first().click();
    await assentar(p);
    return painel;
  };

  for (const largura of [1280, 390]) {
    test(`liga, mostra o endereço, grava a apresentação e abre a prévia (${largura} px)`, async () => {
      const p = await sessao.abrir({ largura });
      const painel = await abrirSecao(p, largura);
      const chave = painel.locator("[data-painel-ligado]");
      assert.equal(await chave.isChecked(), false, "começa desligado");
      await chave.check();
      await assentar(p, 600);
      const endereco = await painel.locator("[data-endereco-painel]").inputValue();
      assert.match(endereco, /\/painel\/\?p=[A-Za-z0-9]{20}$/, "endereço com código de 20 caracteres");
      await painel.locator("[data-apresentacao-painel]").fill("Para que serve este plano.");
      await painel.locator("[data-apresentacao-painel]").press("Tab");
      await assentar(p, 600);
      await painel.locator("[data-previa-painel]").click();
      await assentar(p, 600);
      const previa = painel.locator(".pp-previa");
      assert.equal(await previa.isVisible(), true);
      assert.equal(await previa.locator(".pp-apresentacao").textContent(), "Para que serve este plano.");
      assert.ok(await previa.locator(".pp-linha").count() > 0, "a prévia lista as ações");
      if (largura <= 640) {
        const larguraDaPagina = await p.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(larguraDaPagina <= largura + 1, "sem rolagem lateral no celular");
      }
      /* gerar novo endereço pede confirmação e troca o código */
      await painel.locator("[data-novo-endereco]").click();
      await painel.locator("[data-confirmar-endereco]").click();
      await assentar(p, 600);
      assert.notEqual(await painel.locator("[data-endereco-painel]").inputValue(), endereco);
      assert.deepEqual(p.erros, []);
    });
  }

  test("a página do painel abre sem login e avisa quando o painel não existe", async () => {
    const p = await sessao.abrir({ largura: 390, exemplo: false, caminho: "painel/?p=AAAAAAAAAAAAAAAAAAAA", aguardar: ".pp-mensagem" });
    assert.equal((await p.locator(".pp-mensagem h1").textContent()).trim(), "Painel não encontrado");
    assert.equal(await p.locator(".pp-selo").textContent(), "Painel público · somente leitura");
    assert.deepEqual(p.erros, []);
  });

  /*
   * Parte 2 (18/11/2026): as visões "No tempo" e "Em rede". Sem banco, a página não tem painel; por isso o teste troca a
   * partida da página (js/painel.js) por uma que monta um resumo de verdade, com as mesmas regras do Sextante, e o
   * entrega por um Store falso.
   */
  const PARTIDA = `
    import { criarCalendario } from "./calendario.js";
    import { caminhoCritico } from "./calculo.js";
    import { montarLinhas } from "./lista.js";
    import { montarResumo } from "./painel-publico.js";
    import { mostrarPainelPublico } from "./telas/painel-publico.js";
    const hoje = new Date().toLocaleDateString("sv-SE");
    const espaco = { id: "e1", nome: "Plano de teste", tipo: "projeto", inicio: hoje, prazoFinal: null,
      estrutura: [{ id: "f1", nome: "Preparação", etapas: [{ id: "t1", nome: "Comitê" }] }, { id: "f2", nome: "Execução", etapas: [{ id: "t2", nome: "Áreas" }] }],
      painelPublico: { ligado: true, codigo: "A".repeat(20), apresentacao: "", mostrarNomes: true } };
    const est = (o, m, p) => [{ em: hoje, o, m, p, contaDe: "liberacao" }];
    const acoes = [
      { numero: 1, rotulo: "Instituir o comitê", ordem: 1, etapa: "t1", dependeDe: [], responsaveis: ["r1"], estimativas: est(2, 3, 5) },
      { numero: 2, rotulo: "Mapear os riscos", ordem: 2, etapa: "t2", dependeDe: [1], responsaveis: ["r1"], estimativas: est(3, 5, 8) },
      { numero: 3, rotulo: "Ouvir as áreas", ordem: 3, etapa: "t2", dependeDe: [1], responsaveis: [], estimativas: est(1, 2, 3) },
      { numero: 4, rotulo: "Consolidar a matriz", ordem: 4, etapa: "t2", dependeDe: [2, 3], responsaveis: [], estimativas: est(2, 2, 2) },
    ];
    const cal = criarCalendario(espaco, hoje);
    const caminho = caminhoCritico(acoes, cal, { hoje });
    const linhas = montarLinhas(acoes, caminho, null, cal, hoje, { espaco });
    const resumo = montarResumo({ espaco, linhas, responsaveis: [{ id: "r1", tipo: "pessoa", nome: "Ana Ribeiro", setor: "Governança" }], caminho, cal });
    const store = { lerPainelPublico: async () => ({ ligado: true, resumo, atualizadoEm: new Date().toISOString() }) };
    mostrarPainelPublico(document.getElementById("painel"), { store, codigo: "A".repeat(20) });`;
  const comResumo = async (contexto) => {
    await contexto.route("**/js/painel.js", (r) => r.fulfill({ contentType: "text/javascript", body: PARTIDA }));
  };

  for (const largura of [1280, 390]) {
    test(`"Ver as ações de outro jeito" abre No tempo e Em rede, e Voltar leva ao painel (${largura} px)`, async () => {
      const p = await sessao.abrir({ largura, exemplo: false, caminho: `painel/?p=${"A".repeat(20)}`, aguardar: ".pp-visoes", rotas: comResumo });
      const botoes = p.locator(".pp-visoes-botoes a");
      assert.deepEqual(await botoes.allTextContents(), ["No tempo", "Em rede"]);
      /* identidade da UFCIMG, sem o nome do sistema (19/11/2026) */
      assert.equal(await p.evaluate(() => document.documentElement.dataset.paleta), "ufcimg");
      assert.equal(await p.locator(".pp-topo img.pp-marca").getAttribute("alt"), "UFCIMG");
      assert.equal(await p.locator(".pp-fim img").count(), 1);
      assert.ok(!(await p.locator("body").innerText()).includes("Sextante"), "o nome do sistema não aparece");
      assert.equal(await p.evaluate(() => document.fonts.check('16px "Metropolis"')), true, "Metropolis carregada");
      /* No tempo: o Cronograma do Sextante, sem edição, com as quatro ações e as ligações */
      await botoes.first().click();
      await p.waitForSelector(".crono");
      await assentar(p, 500);
      assert.match(p.url(), /#no-tempo$/);
      assert.equal(await p.locator(".crono .crono-barra-acao").count(), 4);
      assert.equal(await p.locator(".crono .crono-seta").count(), 4);
      assert.equal(await p.locator(".crono.editavel, .crono-borda, .crono-alca").count(), 0, "sem edição");
      assert.equal(await p.locator(".crono-quem").first().textContent(), "Ana Ribeiro · Governança");
      /* só concluída ou não (19/11/2026): sem barra de não liberada nem de atrasada, e sem isso na legenda */
      assert.equal(await p.locator(".crono-barra-acao.aguardando, .crono-barra-acao.atrasada").count(), 0);
      assert.ok(!(await p.locator(".crono-legendas, .crono").first().innerText()).includes("Ainda não liberada"));
      assert.ok(!(await p.locator("body").innerText()).includes("Sextante"), "nem nas visões");
      /* Voltar do navegador: o painel de novo */
      await p.goBack();
      await p.waitForSelector(".pp-visoes");
      /* Em rede: a Rede do Sextante, sem edição, com as cercas das etapas */
      await p.locator('.pp-visoes-botoes a:has-text("Em rede")').click();
      await p.waitForSelector(".rede .rede-no");
      await assentar(p, 600);
      assert.equal(await p.locator(".rede .rede-no").count(), 4);
      assert.equal(await p.locator(".rede-editavel, .rede-mais, .rede-alca, .rede-inserir").count(), 0, "sem edição");
      assert.equal(await p.locator(".rede-cerca").count(), 2);
      assert.ok(await p.locator(".rede-no.critica").count() > 0, "cores pela folga");
      assert.equal(await p.locator(".rede-agora, .rede-no.agora").count(), 0, "sem a etiqueta \"agora\"");
      if (largura <= 640) {
        const larguraDaPagina = await p.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(larguraDaPagina <= largura + 1, "sem rolagem lateral no celular");
      }
      /* o "o que é?" da legenda abre a explicação, e não a Ajuda do Sextante */
      if (largura > 640) {
        await p.locator('.rede-legenda [data-termo="folga"]').click();
        await p.waitForSelector("dialog.pp-termo[open]");
        await p.locator("dialog.pp-termo button").click();
      }
      await p.locator("[data-voltar-painel]").click();
      await p.waitForSelector(".pp-visoes");
      assert.doesNotMatch(p.url(), /#em-rede/);
      assert.deepEqual(p.erros, []);
    });
  }

  test("a paleta escolhida no Sextante não muda o painel (19/11/2026)", async () => {
    const p = await sessao.abrir({ largura: 390, exemplo: false, caminho: "painel/?p=AAAAAAAAAAAAAAAAAAAA", aguardar: ".pp-mensagem",
      rotas: async (contexto) => { await contexto.addInitScript(() => { localStorage.setItem("sextante.paleta", "original"); localStorage.setItem("sextante.tema", "escuro"); }); } });
    assert.equal(await p.evaluate(() => document.documentElement.dataset.paleta), "ufcimg");
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme ?? null), null, "o modo segue o aparelho");
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".pp-topo")).backgroundColor), "rgb(20, 44, 70)");
  });
});
