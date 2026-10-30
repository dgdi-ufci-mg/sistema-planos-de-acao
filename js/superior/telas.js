/**
 * Telas do Strata, antes módulo Superior (passo 2.5; documentação técnica, seções 4.11 e 8): a gestão da estratégia.
 * Desde 29/10/2026, tarde (decisão do responsável), o **Mapa ocupa a tela toda e é a porta de entrada**; nada tira a
 * pessoa do mapa: o resto abre por cima dele e, ao fechar, volta ao mesmo ponto, com o item ainda aceso.
 * - no alto, à esquerda, o título e a universidade (na página); à direita, os **Filtros** (camadas e vigência, desde
 *   30/10/2026; antes, "Só o que vale hoje") e o **menu**;
 * - o menu leva às **folhas**, que abrem por cima do mapa:
 *   - Ver como lista (o Desdobramento): a árvore do catálogo, com os Planos de Ação e as entregas (passo 2.6);
 *   - Instrumentos: PEI, PDI, políticas…, com vigência e prorrogações;
 *   - Camadas: o modelo do desdobramento;
 *   - Importar: a carga por planilha;
 *   e também a "Novo item", "Voltar ao automático", "Como usar o mapa", ao tema e à conta;
 * - cada item abre um painel (camada, instrumento, superiores, subordinados e Planos de Ação), também por cima.
 * Todos consultam; só o Gestor da Estratégia (provisoriamente, o Administrador do Sistema) altera.
 */
import { esc, dataBr, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { normalizar } from "../acao.js";
import { lerColagem } from "../planilha.js";
import { abrirPainel, fecharPainel, avisar } from "../telas/painel.js";
import { abrirCamada } from "../telas/voltar.js";
import { tipoDe } from "../tipos.js";
import { NOME } from "../identidade.js";
import { lerTema, escolherTema } from "../tema.js";
import { alcanceAtual, textoDoValor } from "../entregas.js";
import { seloDaSituacao } from "../telas/entregas.js";
import { esqueletoHtml } from "../telas/esqueleto.js";
import { criarVistaMapa } from "./mapa.js";
import { FAIXA_PLANOS } from "../mapa.js";
import { FILTRO_PADRAO, VIGENCIAS, filtrarParaOMapa, mudancasDoFiltro, normalizarFiltro } from "../filtro-do-mapa.js";
import {
  avisoDaMissao, camadasAcima, instrumentoVigente, itemVigente, rotuloDoItem, caminhoAteOTopo, subordinadosDe, itensPorCamada, planejarCatalogo,
} from "../estrategia.js";

/** Folhas que abrem por cima do mapa: chave → título. */
const FOLHAS = { arvore: "Desdobramento", instrumentos: "Instrumentos", camadas: "Camadas", importar: "Importar" };
/** Onde o navegador guarda os filtros do Mapa: preferência desta pessoa neste aparelho (não vai ao banco). */
const CHAVE_DOS_FILTROS = "strata:filtrosDoMapa";
function lerFiltrosGuardados() {
  try { return normalizarFiltro(JSON.parse(localStorage.getItem(CHAVE_DOS_FILTROS) ?? "null")); } catch { return normalizarFiltro(null); }
}
function guardarFiltros(filtro) {
  try { localStorage.setItem(CHAVE_DOS_FILTROS, JSON.stringify(filtro)); } catch { /* navegador sem armazenamento: vale só até recarregar */ }
}

/** Tema do aparelho, com os nomes do Strata (o céu de dia e de noite); os valores são os do Sextante (js/tema.js). */
const TEMAS_DO_STRATA = [["automatico", "Automático"], ["claro", "Dia"], ["escuro", "Noite"]];

/**
 * @param {HTMLElement} alvo
 * @param {{store: object, hoje: string, conta?: object, comandos?: HTMLElement, avisos?: HTMLElement, cima?: HTMLElement}} contexto
 *   `conta`: {usuario(), podeEntrar(), entrar(), trocarSenha(), sair()}; `comandos`: onde vão o filtro e o menu, no alto à
 *   direita; `avisos`: os avisos por cima do mapa; `cima`: o alto da tela (título e menu), que o mapa deixa livre
 * @returns {{recarregar: () => Promise<void>}}
 */
export function mostrarSuperior(alvo, { store, hoje, conta = null, comandos = null, avisos = null, cima = null }) {
  /** `folha`: a folha aberta por cima do mapa (chave de FOLHAS), ou null; `menu`: o menu aberto */
  const ui = { folha: null, menu: false, filtros: false, filtro: lerFiltrosGuardados(), soVigentes: true, busca: "", recolhidos: new Set(), mapa: {}, ordemDoMapa: null };
  /** vista do Mapa montada na tela (para desfazer os ouvintes ao trocar de aba ou desenhar de novo) */
  let vistaMapa = null;
  let cat = { camadas: [], instrumentos: [], itens: [] };
  let gestor = false;
  let planos = [];
  /** entregas e registros de alcance de cada Plano de Ação que a pessoa consulta (passo 2.6): id → {entregas, alcances} */
  let entregasDe = new Map();
  /** rascunho das camadas, editado até "Salvar camadas" */
  let rascunho = null;
  let planoImportacao = null;

  /* a tela: o mapa embaixo de tudo, a mensagem de vazio sobre o céu e a folha por cima */
  alvo.innerHTML = `
    <div class="mapa-area strata-mapa" data-mapa-area></div>
    <div class="strata-vazio" data-vazio hidden></div>
    <section class="strata-folha" data-folha role="dialog" aria-modal="false" aria-labelledby="strata-folha-titulo" hidden>
      <header class="strata-folha-cabeca"><h2 id="strata-folha-titulo" tabindex="-1"></h2>
        <button type="button" class="botao" data-fechar-folha>Voltar ao mapa</button></header>
      <div class="strata-folha-corpo superior-corpo" data-folha-corpo>${esqueletoHtml("lista", 6)}</div>
    </section>`;
  const areaDoMapa = alvo.querySelector("[data-mapa-area]");
  const vazio = alvo.querySelector("[data-vazio]");
  const folha = alvo.querySelector("[data-folha]");
  const folhaCorpo = folha.querySelector("[data-folha-corpo]");
  const avisoMissao = document.createElement("div");
  avisos?.append(avisoMissao);

  async function recarregar() {
    [cat, gestor, ui.ordemDoMapa] = await Promise.all([store.lerCatalogo(), store.ehGestorDaEstrategia().catch(() => false), store.lerOrdemDoMapa().catch(() => null)]);
    const espacos = await store.listarEspacos().catch(() => []);
    planos = espacos.filter((e) => tipoDe(e) === "planoDeAcao" && e.vinculos?.length);
    entregasDe = new Map(await Promise.all(planos.filter((e) => store.podeVerEspaco(e)).map(async (e) => {
      try { return [e.id, { entregas: await store.listarEntregas(e.id), alcances: await store.listarAlcances(e.id) }]; } catch { return [e.id, null]; }
    })));
    rascunho = structuredClone(cat.camadas);
    desenhar();
  }

  const camadaDe = (id) => cat.camadas.find((c) => c.id === id);
  const instrumentoDe = (id) => cat.instrumentos.find((x) => x.id === id);
  const itemDe = (id) => cat.itens.find((x) => x.id === id);
  const vale = (item) => !ui.soVigentes || itemVigente(item, cat.instrumentos, hoje);
  const planosDe = (id) => planos.filter((e) => e.vinculos.includes(id));
  const recebePlanos = (item) => camadasAcima(cat.camadas, null).includes(item.camada);
  const posicaoDaCamada = (id) => cat.camadas.findIndex((c) => c.id === id);
  const ordem = (a, b) => posicaoDaCamada(a.camada) - posicaoDaCamada(b.camada)
    || String(a.codigo ?? "").localeCompare(String(b.codigo ?? ""), "pt-BR", { numeric: true }) || a.nome.localeCompare(b.nome, "pt-BR");

  /** Desenha tudo: o mapa, o filtro e o menu e, se houver, a folha aberta. */
  function desenhar() {
    desenharMapa();
    desenharComandos();
    desenharFolha();
  }

  /** O mapa, a tela inteira, e o que fica sobre o céu: o aviso da Missão e a mensagem de vazio. */
  function desenharMapa() {
    vistaMapa?.destruir();
    vistaMapa = null;
    avisoMissao.innerHTML = avisoMissaoHtml();
    /* filtros (30/10/2026): camadas e vigência; as linhas passam pelos itens escondidos (js/filtro-do-mapa.js) */
    const f = filtrarParaOMapa({ camadas: cat.camadas, instrumentos: cat.instrumentos, itens: cat.itens, planos: planosDoMapa(), hoje, filtro: ui.filtro });
    vistaMapa = criarVistaMapa(areaDoMapa, {
      camadas: f.camadas, itens: f.itens, planos: f.planos, semPlanos: f.semPlanos, estado: ui.mapa, aoAbrir: abrirDoMapa, ordemPessoal: ui.ordemDoMapa ?? {},
      podeOrdenar: store.podeGravar, aoReordenar: reordenarNoMapa, folga: folgaDoMapa,
    });
    const mostrados = f.itens.length + f.planos.length;
    const mensagem = mostrados ? "" : cat.itens.some((x) => !x.excluidoEm) ? "Nada a mostrar com estes filtros. Abra “Filtros”, no alto, para ver mais."
      : gestor ? "O catálogo está vazio. Comece por “Novo item” ou por “Importar”." : "O catálogo ainda está vazio.";
    vazio.hidden = !mensagem;
    vazio.innerHTML = mensagem ? `<p>${mensagem}</p>${!cat.itens.length && gestor ? `<div class="botoes">
      <button type="button" class="botao principal" data-novo-item>${ICONES.mais}Novo item</button>
      <button type="button" class="botao" data-abrir-folha="importar">Importar</button></div>` : ""}` : "";
  }
  /** O alto da tela (título, menu e avisos) fica por cima do mapa: o conteúdo do mapa não vai para baixo dele. */
  function folgaDoMapa() {
    const topoDaArea = areaDoMapa.getBoundingClientRect().top;
    const baixo = Math.max(cima?.getBoundingClientRect().bottom ?? 0, ...[...(avisos?.children ?? [])].filter((e) => e.offsetHeight).map((e) => e.getBoundingClientRect().bottom));
    /* os botões +, − e Centralizar em fila (celular) ocupam o pé da tela: o mapa também o deixa livre */
    const area = areaDoMapa.getBoundingClientRect();
    const botoes = areaDoMapa.querySelector(".mapa-controles")?.getBoundingClientRect();
    const base = botoes && botoes.width > botoes.height ? Math.max(0, Math.round(area.bottom - botoes.top + 4)) : 0;
    return { topo: Math.max(0, Math.round(baixo - topoDaArea)), base };
  }

  /* ---------- comandos: o filtro, sempre à vista, e o menu ---------- */
  function desenharComandos() {
    if (!comandos) return;
    const usuario = conta?.usuario() ?? null;
    const item = (atributos, texto) => `<button type="button" class="strata-menu-item" ${atributos}>${texto}</button>`;
    const tema = lerTema();
    comandos.innerHTML = `
      <button type="button" class="strata-filtro" data-alternar-filtros aria-expanded="${ui.filtros}" aria-controls="strata-filtros">${botaoDeFiltrosHtml()}</button>
      <div class="strata-filtros${ui.filtros ? " aberto" : ""}" id="strata-filtros" role="group" aria-label="Filtros do mapa" data-painel-filtros${ui.filtros ? "" : " inert"}>${filtrosHtml()}</div>
      <button type="button" class="strata-menu-botao" data-alternar-menu aria-expanded="${ui.menu}" aria-controls="strata-menu">${ICONES.menu}<span>Menu</span></button>
      <div class="strata-menu${ui.menu ? " aberto" : ""}" id="strata-menu" data-menu${ui.menu ? "" : " inert"}>
        <p class="tec strata-menu-nota">${gestor ? "Você é Gestor da Estratégia: pode alterar o catálogo." : "Só o Gestor da Estratégia altera o catálogo; aqui você consulta."}</p>
        <div class="strata-menu-grupo">
          ${item('data-abrir-folha="arvore"', "Ver como lista")}
          ${gestor ? item("data-novo-item", "Novo item") : ""}
          ${item('data-abrir-folha="instrumentos"', "Instrumentos")}
          ${item('data-abrir-folha="camadas"', "Camadas")}
          ${gestor ? item('data-abrir-folha="importar"', "Importar") : ""}
          ${temOrdemPessoal() ? item("data-voltar-automatico", "Voltar ao automático") : ""}
          ${item("data-como-usar", "Como usar o mapa")}
        </div>
        <div class="strata-menu-grupo">
          <span class="strata-menu-rotulo">Tema</span>
          <div class="strata-temas" role="group" aria-label="Tema">${TEMAS_DO_STRATA.map(([v, t]) => `<button type="button" class="strata-tema" data-tema="${v}" aria-pressed="${tema === v}">${t}</button>`).join("")}</div>
        </div>
        <div class="strata-menu-grupo">
          ${usuario ? `<span class="tec strata-menu-email">${esc(usuario)}</span>${item("data-conta-acao=\"senha\"", "Trocar senha")}${item("data-conta-acao=\"sair\"", "Sair")}`
            : conta?.podeEntrar() ? item("data-conta-acao=\"entrar\"", "Entrar") : ""}
          <a class="strata-menu-item" href="../sextante/">${esc(NOME)}: planos</a>
        </div>
      </div>`;
  }
  /* ---------- filtros do Mapa (30/10/2026): camadas e vigência, num painel como o do menu ---------- */
  const camadasDoFiltro = () => [...cat.camadas.map((c) => ({ id: c.id, nome: c.plural || c.nome })), { id: FAIXA_PLANOS, nome: "Planos de Ação" }];
  const item2 = (atributos, texto, desligado) => `<button type="button" class="strata-menu-item" ${atributos}${desligado ? " disabled" : ""}>${texto}</button>`;
  function botaoDeFiltrosHtml() {
    const n = mudancasDoFiltro(ui.filtro, camadasDoFiltro().map((c) => c.id));
    return `${ICONES.filtros}<span>Filtros</span>${n ? `<span class="strata-filtro-conta" title="${n} ${plural(n, "mudança", "mudanças")} em relação ao padrão">${n}<span class="so-leitor"> ${plural(n, "mudança", "mudanças")}</span></span>` : ""}`;
  }
  function filtrosHtml() {
    const caixa = (atributo, marcado, texto) => `<label class="strata-filtro-linha"><input type="checkbox" ${atributo}${marcado ? " checked" : ""}><span>${esc(texto)}</span></label>`;
    const ocultas = new Set(ui.filtro.ocultas);
    return `
      <div class="strata-menu-grupo"><span class="strata-menu-rotulo">Mostrar os níveis</span>
        ${camadasDoFiltro().map((c) => caixa(`data-filtro-camada="${esc(c.id)}"`, !ocultas.has(c.id), c.nome)).join("")}
        <p class="tec strata-menu-nota">Escondido um nível, a linha passa por ele, <b>tracejada</b>, e liga direto ao de cima.</p>
      </div>
      <div class="strata-menu-grupo"><span class="strata-menu-rotulo">Vigência</span>
        ${Object.entries(VIGENCIAS).map(([k, texto]) => caixa(`data-filtro-vigencia="${k}"`, ui.filtro.vigencias[k], texto)).join("")}
        <p class="tec strata-menu-nota">Fora da vigência, mas com algo vigente ligado abaixo: o item aparece <b>apagado</b>, com um sinal de atenção.</p>
      </div>
      <div class="strata-menu-grupo">${item2("data-filtro-padrao", "Voltar ao padrão", !mudancasDoFiltro(ui.filtro, camadasDoFiltro().map((c) => c.id)))}</div>`;
  }
  /** Uma escolha mudou: o mapa se refaz na hora (os pontos deslizam, entram e saem aos poucos) e o filtro fica guardado. */
  function mudarFiltro(novo) {
    ui.filtro = normalizarFiltro(novo);
    guardarFiltros(ui.filtro);
    desenharMapa();
    const botao = comandos.querySelector("[data-alternar-filtros]");
    botao.innerHTML = botaoDeFiltrosHtml();
    const padrao = comandos.querySelector("[data-filtro-padrao]");
    if (padrao) padrao.disabled = !mudancasDoFiltro(ui.filtro, camadasDoFiltro().map((c) => c.id));
  }
  let soltarFiltros = null;
  function alternarFiltros(aberto = !ui.filtros) {
    if (aberto === ui.filtros) return;
    if (aberto) alternarMenu(false);
    ui.filtros = aberto;
    const painel = comandos.querySelector("[data-painel-filtros]");
    painel.classList.toggle("aberto", aberto);
    painel.inert = !aberto;
    comandos.querySelector("[data-alternar-filtros]").setAttribute("aria-expanded", String(aberto));
    if (aberto) {
      soltarFiltros = abrirCamada(() => alternarFiltros(false)); // Voltar (celular) fecha o painel
      painel.querySelector("input")?.focus({ preventScroll: true });
    } else { soltarFiltros?.(); soltarFiltros = null; }
  }

  let soltarMenu = null;
  function alternarMenu(aberto = !ui.menu) {
    if (aberto === ui.menu) return;
    if (aberto) alternarFiltros(false);
    ui.menu = aberto;
    const menu = comandos.querySelector("[data-menu]");
    menu.classList.toggle("aberto", aberto);
    menu.inert = !aberto;
    comandos.querySelector("[data-alternar-menu]").setAttribute("aria-expanded", String(aberto));
    if (aberto) {
      soltarMenu = abrirCamada(() => alternarMenu(false)); // Voltar (celular) fecha o menu
      menu.querySelector("button, a")?.focus({ preventScroll: true });
    } else { soltarMenu?.(); soltarMenu = null; }
  }

  /* ---------- folhas: abrem por cima do mapa; ao fechar, o mapa está onde estava ---------- */
  let soltarFolha = null;
  function abrirFolha(chave) {
    alternarMenu(false);
    const nova = !ui.folha;
    ui.folha = chave;
    desenharFolha();
    if (nova) soltarFolha = abrirCamada(() => fecharFolha({ peloVoltar: true }));
    folha.querySelector("h2").focus({ preventScroll: true });
  }
  function fecharFolha({ peloVoltar = false } = {}) {
    if (!ui.folha) return;
    ui.folha = null;
    if (!peloVoltar) soltarFolha?.();
    soltarFolha = null;
    folha.classList.remove("aberta");
    const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzir) folha.hidden = true;
    else setTimeout(() => { if (!ui.folha) folha.hidden = true; }, 260); // depois da transição (--mov)
    desenharMapa(); // o item aberto na lista fica aceso no mapa
    comandos?.querySelector("[data-alternar-menu]")?.focus({ preventScroll: true });
  }
  function desenharFolha() {
    if (!ui.folha) return;
    if (ui.folha === "importar" && !gestor) { fecharFolha(); return; }
    folha.querySelector("h2").textContent = FOLHAS[ui.folha];
    folhaCorpo.innerHTML = { arvore: arvoreHtml, instrumentos: instrumentosHtml, camadas: camadasHtml, importar: importarHtml }[ui.folha]();
    if (folha.hidden) {
      folha.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => { if (ui.folha) folha.classList.add("aberta"); }));
    } else folha.classList.add("aberta");
    const busca = folha.querySelector("[data-busca-arvore]");
    if (busca && ui.busca) { busca.focus(); busca.setSelectionRange(ui.busca.length, ui.busca.length); }
  }

  /** "Como usar o mapa": o texto de ajuda que ficava sob o mapa. */
  function abrirComoUsar() {
    alternarMenu(false);
    abrirPainel("Como usar o mapa", `<div class="strata-ajuda">
      <p>Cada ponto é um item. As linhas ligam cada item ao que ele <b>vem de</b>, do nível de baixo para o de cima; embaixo ficam os Planos de Ação.</p>
      <p>Toque num ponto para acender o caminho dele e ver o cartão com “Abrir”; toque no fundo para desfazer.</p>
      <p>Arraste para mover o mapa. Para aproximar, use a pinça, Ctrl + rolagem ou os botões + e −; “Centralizar” mostra o mapa inteiro.</p>
      <p>Em “Filtros”, no alto, escolha os níveis e a vigência que aparecem. Ao abrir, só o que vale hoje. Com um nível escondido, a linha passa por ele <b>tracejada</b>; tocando no ponto, o cartão diz por quais itens ela passa.</p>
      <p>Um item fora da vigência que ainda tem algo vigente ligado abaixo dele aparece <b>apagado</b>, com um sinal de atenção; o cartão explica.</p>
      ${store.podeGravar ? "<p>No computador, arraste um ponto para os lados para mudar a ordem dele no nível; a ordem vale só para você, e “Voltar ao automático”, no menu, a desfaz.</p>" : store.conectado ? "<p>Entre para mudar a ordem dos pontos no computador.</p>" : ""}
    </div>`);
  }

  /* ---------- mapa ---------- */
  /** Planos de Ação do mapa: os ligados a itens; o que a pessoa não pode consultar entra como "restrito", sem o nome. */
  function planosDoMapa() {
    return planos.map((e) => {
      const visivel = store.podeVerEspaco(e);
      return { id: e.id, nome: visivel ? e.nome : "Plano de Ação restrito", restrito: !visivel, superiores: e.vinculos, encerradoEm: e.encerradoEm ?? null };
    });
  }
  /** "Abrir" do cartão do Mapa: o painel do item, ou o espaço do Plano de Ação (que o restrito nunca oferece). */
  function abrirDoMapa(no) {
    if (no.tipo === "item") abrirItem(no.id);
    else if (!no.restrito) location.assign(`../#/espaco/${encodeURIComponent(no.id)}`);
  }
  const temOrdemPessoal = () => Object.values(ui.ordemDoMapa ?? {}).some((l) => l.length);
  /**
   * O mouse soltou um ponto em outro lugar: o mapa é refeito **na hora**, com os pontos deslizando, e a ordem do nível
   * (só desta pessoa) é guardada em seguida, sem fazer a pessoa esperar o servidor. Se a gravação falhar, avisa e
   * volta à ordem de antes.
   */
  async function reordenarNoMapa(camada, chaves) {
    const antes = ui.ordemDoMapa;
    const nova = { ...(antes ?? {}), [camada]: chaves };
    ui.ordemDoMapa = nova;
    desenhar();
    try {
      await store.gravarOrdemDoMapa(nova);
    } catch (f) {
      if (ui.ordemDoMapa === nova) ui.ordemDoMapa = antes;
      avisar(f.message);
      desenhar();
    }
  }
  /** Aviso quando há mais de um item na Missão (a Missão é uma só). */
  function avisoMissaoHtml() {
    const aviso = avisoDaMissao(cat.camadas, cat.itens);
    return aviso ? `<p class="aviso-papel">${esc(aviso)}</p>` : "";
  }
  /** "Ver como lista": o Desdobramento, com o item selecionado no Mapa aberto e à vista (o Plano de Ação, no lugar dele). */
  function verComoLista() {
    const chave = ui.mapa.selecionado ?? null;
    ui.busca = "";
    if (chave && !chave.startsWith("plano:")) {
      const acima = new Set();
      const subir = (id) => { for (const sup of itemDe(id)?.superiores ?? []) if (!acima.has(sup)) { acima.add(sup); subir(sup); } };
      subir(chave);
      for (const k of [...ui.recolhidos]) if (acima.has(k.split("/").pop())) ui.recolhidos.delete(k); // abre o caminho até o item
    }
    abrirFolha("arvore");
    const el = folha.querySelector(".selecionado");
    el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  /* ---------- desdobramento ---------- */
  function itemHtml(item) {
    const instr = instrumentoDe(item.instrumento);
    const fora = !itemVigente(item, cat.instrumentos, hoje);
    const n = recebePlanos(item) ? planosDe(item.id).length : 0;
    return `<button type="button" class="item-estrategia${ui.mapa.selecionado === item.id ? " selecionado" : ""}" data-item="${esc(item.id)}">
      <span class="item-estrategia-nome">${item.codigo ? `<b class="mono">${esc(item.codigo)}</b> ` : ""}${esc(item.nome)}</span>
      <small class="tec">${esc(camadaDe(item.camada)?.nome ?? "")}${instr ? ` · ${esc(instr.nome)}` : ""}${fora ? " · fora da vigência" : ""}${n ? ` · ${n} ${plural(n, "Plano de Ação", "Planos de Ação")}` : ""}</small>
    </button>`;
  }
  function noHtml(item, caminho) {
    const filhos = subordinadosDe(item.id, cat.itens).filter(vale).filter((x) => !caminho.has(x.id)).sort(ordem);
    const ligados = recebePlanos(item) ? planosDe(item.id) : [];
    const temFilhos = filhos.length || ligados.length;
    const chave = [...caminho, item.id].join("/");
    const fechado = ui.recolhidos.has(chave);
    const proximo = new Set([...caminho, item.id]);
    return `<li class="no-estrategia${fechado ? " fechado" : ""}">
      <div class="no-linha">${temFilhos ? `<button type="button" class="no-seta" data-alternar-no="${esc(chave)}" aria-expanded="${!fechado}" aria-label="${fechado ? "Abrir" : "Fechar"} ${esc(item.nome)}">${ICONES.seguir}</button>` : '<span class="no-seta vazia"></span>'}${itemHtml(item)}</div>
      ${temFilhos && !fechado ? `<ul>${filhos.map((f) => noHtml(f, proximo)).join("")}${ligados.map(planoHtml).join("")}</ul>` : ""}
    </li>`;
  }
  /** Entregas de um Plano de Ação, sob ele na árvore (passo 2.6): situação e alcance; sem entregas, "rascunho". */
  function entregasDoPlanoHtml(e) {
    const dados = entregasDe.get(e.id);
    if (!dados) return "";
    if (!dados.entregas.length) return "";
    return `<ul class="entregas-no-plano">${dados.entregas.map((x) => {
      const a = alcanceAtual(x, dados.alcances);
      return `<li><span class="entrega-no-plano-nome">${esc(x.titulo)}</span> ${seloDaSituacao(x.situacao ?? "naoIniciada")}
        <small class="tec">${a ? `${esc(textoDoValor(x, a.valor))}${x.tipoMeta === "padrao" ? "" : ` (${Math.round(a.fracao * 100)}%)`}` : "sem alcance registrado"}</small></li>`;
    }).join("")}</ul>`;
  }
  function planoHtml(e) {
    const visivel = store.podeVerEspaco(e);
    const dados = entregasDe.get(e.id);
    const rascunho = dados && !dados.entregas.length;
    return `<li class="no-estrategia no-plano"><div class="no-linha"><span class="no-seta vazia"></span>
      ${visivel ? `<a class="item-estrategia plano${ui.mapa.selecionado === `plano:${e.id}` ? " selecionado" : ""}" href="../#/espaco/${esc(e.id)}"><span class="item-estrategia-nome">${esc(e.nome)}</span><small class="tec">Plano de Ação${e.encerradoEm ? " · encerrado" : ""}${rascunho ? " · rascunho, sem entregas" : dados ? ` · ${dados.entregas.length} ${plural(dados.entregas.length, "entrega", "entregas")}` : ""}</small></a>`
        : `<span class="item-estrategia plano${ui.mapa.selecionado === `plano:${e.id}` ? " selecionado" : ""}"><span class="item-estrategia-nome">Plano de Ação restrito</span><small class="tec">Só quem participa dele vê o nome.</small></span>`}</div>
      ${visivel ? entregasDoPlanoHtml(e) : ""}</li>`;
  }
  function arvoreHtml() {
    const ativos = cat.itens.filter(vale);
    /* raízes: os itens sem superior ativo (os da camada mais alta e os que ainda não foram ligados) */
    const raizes = ativos.filter((x) => !(x.superiores ?? []).some((s) => itemDe(s))).sort(ordem);
    const termo = normalizar(ui.busca).trim();
    const achados = termo ? ativos.filter((x) => normalizar(`${x.codigo ?? ""} ${x.nome}`).includes(termo)).sort(ordem) : [];
    return `${avisoMissaoHtml()}
      <div class="superior-ferramentas">
        <input type="search" data-busca-arvore placeholder="Buscar pelo código ou pelo nome" aria-label="Buscar no catálogo" value="${esc(ui.busca)}">
        <label class="alternar"><input type="checkbox" data-so-vigentes${ui.soVigentes ? " checked" : ""}> Só o que vale hoje</label>
        ${termo ? "" : `<button type="button" class="botao discreto" data-recolher-tudo>${ui.recolhidos.size ? "Abrir tudo" : "Recolher tudo"}</button>`}
        ${gestor ? `<button type="button" class="botao principal" data-novo-item>${ICONES.mais}Novo item</button>` : ""}
      </div>
      ${termo ? `<ul class="arvore-estrategia busca">${achados.map((x) => `<li class="no-estrategia"><div class="no-linha"><span class="no-seta vazia"></span>${itemHtml(x)}</div>
          <small class="tec caminho-estrategia">${caminhoAteOTopo(x, cat.itens).slice(0, -1).map((c) => esc(rotuloDoItem(c))).join(" › ")}</small></li>`).join("") || '<li class="vazio">Nada encontrado.</li>'}</ul>`
        : raizes.length ? `<ul class="arvore-estrategia">${raizes.map((r) => noHtml(r, new Set())).join("")}</ul>`
        : `<p class="vazio">${cat.itens.length ? "Nada vale hoje. Desmarque “Só o que vale hoje” para ver tudo." : gestor ? "O catálogo está vazio. Comece por “Novo item” ou por “Importar”, no menu." : "O catálogo ainda está vazio."}</p>`}
      <p class="tec">${cat.camadas.map((c) => esc(c.plural) + (c.opcional ? " (opcional)" : "")).join(" › ")} › Planos de Ação. Um item pode estar sob mais de um superior; nesse caso, aparece sob cada um.</p>`;
  }

  /** Painel de um item: onde fica, superiores, subordinados, Planos de Ação e, para o gestor, edição. */
  function abrirItem(id) {
    const item = itemDe(id);
    if (!item) return;
    const corpo = abrirPainel(rotuloDoItem(item), "");
    let confirmandoExclusao = false;
    const desenharPainel = () => {
      const atual = itemDe(id);
      if (!atual) { fecharPainel(); return; }
      const instr = instrumentoDe(atual.instrumento);
      const supPermitidos = camadasAcima(cat.camadas, atual.camada);
      const candidatos = cat.itens.filter((x) => supPermitidos.includes(x.camada) && !(atual.superiores ?? []).includes(x.id)).sort(ordem);
      const subCamadas = cat.camadas.filter((c) => camadasAcima(cat.camadas, c.id).includes(atual.camada));
      const subs = subordinadosDe(atual.id, cat.itens).sort(ordem);
      const lista = (itens, comTirar) => itens.length ? `<ul class="lista-estrategia">${itens.map((x) => `<li>${itemHtml(x)}${comTirar && gestor ? `<button type="button" class="tirar" data-desligar="${esc(x.id)}" aria-label="Desligar de ${esc(x.nome)}">${ICONES.fechar}</button>` : ""}</li>`).join("")}</ul>` : "";
      corpo.innerHTML = `
        <dl class="ficha-estrategia">
          <div><dt>Camada</dt><dd>${esc(camadaDe(atual.camada)?.nome ?? "")}</dd></div>
          <div><dt>Instrumento</dt><dd>${instr ? `${esc(instr.nome)} <small class="tec">${vigenciaTexto(instr)}</small>` : '<span class="tec">Sem instrumento: vale sempre.</span>'}</dd></div>
        </dl>
        ${caminhoAteOTopo(atual, cat.itens).length > 1 ? `<p class="tec caminho-estrategia">${caminhoAteOTopo(atual, cat.itens).map((c) => esc(rotuloDoItem(c))).join(" › ")}</p>` : ""}
        <h4>Superiores</h4>
        ${lista((atual.superiores ?? []).map(itemDe).filter(Boolean), true) || `<p class="vazio">${supPermitidos.length ? "Nenhum: ainda não está ligado a um superior." : "Nenhum: é a camada mais alta."}</p>`}
        ${gestor && candidatos.length ? `<div class="linha-config linha-ligar"><select data-novo-superior aria-label="Superior para ligar">${candidatos.map((x) => `<option value="${esc(x.id)}">${esc(rotuloDoItem(x))} (${esc(camadaDe(x.camada)?.nome)})</option>`).join("")}</select>
          <button type="button" class="botao" data-ligar>Ligar</button></div>` : ""}
        <h4>Subordinados</h4>
        ${lista(subs, false) || '<p class="vazio">Nenhum.</p>'}
        ${gestor && subCamadas.length ? `<button type="button" class="botao-texto" data-novo-subordinado>${ICONES.mais}Novo subordinado</button>` : ""}
        ${recebePlanos(atual) ? `<h4>Planos de Ação</h4>${planosDe(atual.id).length ? `<ul class="lista-estrategia">${planosDe(atual.id).map((e) => `<li>${store.podeVerEspaco(e) ? `<a href="../#/espaco/${esc(e.id)}">${esc(e.nome)}</a>` : "Plano de Ação restrito"}</li>`).join("")}</ul>` : '<p class="vazio">Nenhum Plano de Ação ligado.</p>'}` : ""}
        ${gestor ? `<h4>Editar</h4>
          <form class="editor" data-editar-item>
            <div class="campos-lado-a-lado">
              <label class="campo"><span>Código</span><input name="codigo" maxlength="20" value="${esc(atual.codigo ?? "")}"></label>
              <label class="campo"><span>Instrumento</span>${instrumentoSelect(atual.instrumento)}</label>
            </div>
            <label class="campo"><span>Nome</span><input name="nome" maxlength="200" required value="${esc(atual.nome)}"></label>
            <div class="botoes"><button class="botao principal" type="submit">Salvar</button></div>
          </form>
          <div class="zona-exclusao">${confirmandoExclusao ? `<div class="aviso-confirmar"><p>Excluir “${esc(rotuloDoItem(atual))}”? Ele sai do catálogo (fica registrado como excluído).</p>
            <div class="botoes"><button class="botao principal" type="button" data-confirmar-excluir>Excluir</button><button class="botao" type="button" data-cancelar-excluir>Cancelar</button></div></div>`
            : '<button class="botao-excluir" type="button" data-excluir-item>Excluir item</button>'}</div>` : ""}`;
    };
    const gravar = async (operacao, mensagem) => {
      try { await operacao(); await recarregar(); desenharPainel(); if (mensagem) avisar(mensagem); } catch (e) { avisar(e.message); }
    };
    corpo.addEventListener("click", (e) => {
      const t = e.target.closest("button, a");
      if (!t) return;
      if (t.dataset.item) { abrirItem(t.dataset.item); return; }
      if (t.dataset.desligar) { gravar(() => store.desligarSuperior(id, t.dataset.desligar), "Ligação desfeita."); return; }
      if (t.matches("[data-ligar]")) { gravar(() => store.ligarSuperior(id, corpo.querySelector("[data-novo-superior]").value), "Ligado."); return; }
      if (t.matches("[data-novo-subordinado]")) { abrirNovoItem({ superior: id }); return; }
      if (t.matches("[data-excluir-item]")) { confirmandoExclusao = true; desenharPainel(); return; }
      if (t.matches("[data-cancelar-excluir]")) { confirmandoExclusao = false; desenharPainel(); return; }
      if (t.matches("[data-confirmar-excluir]")) {
        store.excluirItemEstrategico(id).then(async () => { fecharPainel(); await recarregar(); avisar("Item excluído."); }).catch((f) => { confirmandoExclusao = false; desenharPainel(); avisar(f.message); });
      }
    });
    corpo.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      gravar(() => store.alterarItemEstrategico(id, { codigo: f.get("codigo"), nome: f.get("nome"), instrumento: f.get("instrumento") || null }), "Item salvo.");
    });
    desenharPainel();
  }

  function instrumentoSelect(atual) {
    return `<select name="instrumento"><option value="">Sem instrumento (vale sempre)</option>${cat.instrumentos.map((x) =>
      `<option value="${esc(x.id)}"${x.id === atual ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}</select>`;
  }

  /** Novo item: camada, código, nome, instrumento e, se houver, o superior (os da camada permitida). */
  function abrirNovoItem({ superior = null } = {}) {
    const sup = itemDe(superior);
    const camadas = sup ? cat.camadas.filter((c) => camadasAcima(cat.camadas, c.id).includes(sup.camada)) : cat.camadas;
    const corpo = abrirPainel(sup ? `Novo subordinado de ${rotuloDoItem(sup)}` : "Novo item", "");
    const desenharForm = (camadaId = camadas[0]?.id) => {
      const permitidas = camadasAcima(cat.camadas, camadaId);
      const candidatos = cat.itens.filter((x) => permitidas.includes(x.camada)).sort(ordem);
      corpo.innerHTML = `<form class="editor" data-novo-item-form>
        <label class="campo"><span>Camada</span><select name="camada">${camadas.map((c) => `<option value="${esc(c.id)}"${c.id === camadaId ? " selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label>
        <div class="campos-lado-a-lado">
          <label class="campo"><span>Código <small>(opcional)</small></span><input name="codigo" maxlength="20"></label>
          <label class="campo"><span>Instrumento</span>${instrumentoSelect(sup?.instrumento ?? null)}</label>
        </div>
        <label class="campo"><span>Nome</span><input name="nome" maxlength="200" required></label>
        ${permitidas.length ? `<label class="campo"><span>Superior</span><select name="superior">${sup ? "" : '<option value="">Ligar depois</option>'}${candidatos.map((x) =>
          `<option value="${esc(x.id)}"${x.id === superior ? " selected" : ""}>${esc(rotuloDoItem(x))} (${esc(camadaDe(x.camada)?.nome)})</option>`).join("")}</select>
          <small class="tec">Pode ficar sob ${permitidas.map((c) => `“${esc(camadaDe(c)?.nome)}”`).join(" ou ")}. Outros superiores se ligam depois, no item.</small></label>`
          : '<p class="tec">Camada mais alta: sem superior.</p>'}
        <div class="botoes"><button class="botao principal" type="submit">Criar</button></div>
      </form>`;
      corpo.querySelector('[name="nome"]').focus();
    };
    corpo.addEventListener("change", (e) => { if (e.target.name === "camada") desenharForm(e.target.value); });
    corpo.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const novo = await store.criarItemEstrategico({ camada: f.get("camada"), codigo: f.get("codigo"), nome: f.get("nome"), instrumento: f.get("instrumento") || null, superiores: f.get("superior") ? [f.get("superior")] : [] });
        await recarregar();
        avisar("Item criado.");
        abrirItem(novo);
      } catch (falha) { avisar(falha.message); }
    });
    desenharForm();
  }

  /* ---------- instrumentos ---------- */
  function vigenciaTexto(x) {
    const estado = instrumentoVigente(x, hoje) ? "vigente" : x.inicio > hoje ? "ainda não começou" : "encerrado";
    return `${dataBr(x.inicio)} a ${x.fim ? dataBr(x.fim) : "sem fim definido"} · ${estado}`;
  }
  function instrumentosHtml() {
    const ordenados = [...cat.instrumentos].sort((a, b) => b.inicio.localeCompare(a.inicio) || a.nome.localeCompare(b.nome, "pt-BR"));
    return `
      <p class="tec">Os documentos que criam os itens do catálogo, como o PEI, o PDI ou uma política. Um item vale enquanto o instrumento dele vale.
        A prorrogação muda o fim e fica registrada.</p>
      ${gestor ? `<div class="superior-ferramentas"><button type="button" class="botao principal" data-novo-instrumento>${ICONES.mais}Novo instrumento</button></div>` : ""}
      <ul class="lista-instrumentos">${ordenados.map((x) => {
        const n = cat.itens.filter((i) => i.instrumento === x.id).length;
        return `<li class="cartao-instrumento${instrumentoVigente(x, hoje) ? " vigente" : ""}">
          <div><b>${esc(x.nome)}</b> <small class="tec">${vigenciaTexto(x)}</small></div>
          <small class="tec">${n} ${plural(n, "item", "itens")} no catálogo${x.aprovacao?.identificacao ? ` · aprovado por ${x.aprovacao.link ? `<a href="${esc(x.aprovacao.link)}" target="_blank" rel="noopener noreferrer">${esc(x.aprovacao.identificacao)}</a>` : esc(x.aprovacao.identificacao)}` : ""}</small>
          ${(x.prorrogacoes ?? []).length ? `<ul class="prorrogacoes">${x.prorrogacoes.map((p) => `<li class="tec">Prorrogado de ${p.fimAnterior ? dataBr(p.fimAnterior) : "sem fim"} para ${dataBr(p.fim)}${p.aprovacao?.identificacao ? ` (${esc(p.aprovacao.identificacao)})` : ""}, registrado${p.por ? ` por ${esc(p.por)}` : ""} em ${dataBr(p.em.slice(0, 10))}</li>`).join("")}</ul>` : ""}
          ${gestor ? `<div class="botoes"><button type="button" class="botao-texto" data-editar-instrumento="${esc(x.id)}">Editar</button>
            <button type="button" class="botao-texto" data-prorrogar="${esc(x.id)}">Prorrogar</button>
            ${n ? "" : `<button type="button" class="botao-texto perigo" data-excluir-instrumento="${esc(x.id)}">Excluir</button>`}</div>` : ""}
        </li>`;
      }).join("") || '<li class="vazio">Nenhum instrumento cadastrado.</li>'}</ul>`;
  }
  function abrirInstrumento(id = null) {
    const x = id ? instrumentoDe(id) : null;
    const corpo = abrirPainel(x ? `Editar ${x.nome}` : "Novo instrumento", `<form class="editor" data-form-instrumento>
      <label class="campo"><span>Nome</span><input name="nome" maxlength="120" required value="${esc(x?.nome ?? "")}" placeholder="Por exemplo, PDI 2024–2028"></label>
      <div class="campos-lado-a-lado">
        <label class="campo"><span>Início da vigência</span><input name="inicio" type="date" required value="${esc(x?.inicio ?? "")}"></label>
        <label class="campo"><span>Fim <small>(opcional)</small></span><input name="fim" type="date" value="${esc(x?.fim ?? "")}"${x ? " disabled" : ""}></label>
      </div>
      ${x ? '<p class="tec">Para mudar o fim, use “Prorrogar”, que registra a mudança.</p>' : ""}
      <div class="campos-lado-a-lado">
        <label class="campo"><span>Documento de aprovação <small>(SIPAC/Protocolo)</small></span><input name="identificacao" value="${esc(x?.aprovacao?.identificacao ?? "")}"></label>
        <label class="campo"><span>Link <small>(opcional)</small></span><input name="link" type="url" value="${esc(x?.aprovacao?.link ?? "")}" placeholder="https://…"></label>
      </div>
      <div class="botoes"><button class="botao principal" type="submit">${x ? "Salvar" : "Criar"}</button></div>
    </form>`);
    corpo.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const aprovacao = f.get("identificacao").trim() ? { identificacao: f.get("identificacao").trim(), ...(f.get("link").trim() ? { link: f.get("link").trim() } : {}) } : null;
      try {
        if (x) await store.alterarInstrumento(x.id, { nome: f.get("nome"), inicio: f.get("inicio"), aprovacao });
        else await store.criarInstrumento({ nome: f.get("nome"), inicio: f.get("inicio"), fim: f.get("fim") || null, ...(aprovacao ? { aprovacao } : {}) });
        fecharPainel();
        await recarregar();
        avisar(x ? "Instrumento salvo." : "Instrumento criado.");
      } catch (falha) { avisar(falha.message); }
    });
  }
  function abrirProrrogacao(id) {
    const x = instrumentoDe(id);
    const corpo = abrirPainel(`Prorrogar ${x.nome}`, `<form class="editor" data-form-prorrogar>
      <p class="tec">Fim atual: ${x.fim ? dataBr(x.fim) : "sem fim definido"}. A prorrogação fica registrada, com você e a data.</p>
      <label class="campo"><span>Novo fim</span><input name="fim" type="date" required min="${esc(x.fim ?? x.inicio)}"></label>
      <div class="campos-lado-a-lado">
        <label class="campo"><span>Documento que aprovou <small>(opcional)</small></span><input name="identificacao"></label>
        <label class="campo"><span>Link <small>(opcional)</small></span><input name="link" type="url" placeholder="https://…"></label>
      </div>
      <div class="botoes"><button class="botao principal" type="submit">Prorrogar</button></div>
    </form>`);
    corpo.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const aprovacao = f.get("identificacao").trim() ? { identificacao: f.get("identificacao").trim(), ...(f.get("link").trim() ? { link: f.get("link").trim() } : {}) } : null;
      try {
        await store.prorrogarInstrumento(id, { fim: f.get("fim"), aprovacao });
        fecharPainel();
        await recarregar();
        avisar("Prorrogação registrada.");
      } catch (falha) { avisar(falha.message); }
    });
  }

  /* ---------- camadas ---------- */
  function camadasHtml() {
    const r = rascunho;
    const n = (id) => cat.itens.filter((x) => x.camada === id).length;
    return `
      <p class="tec">As camadas do desdobramento, de cima para baixo. Um item fica sob um da camada logo acima ou, se ela for <b>opcional</b>,
        de uma camada acima dela: com o Portfólio opcional, um Programa fica sob um Portfólio ou direto sob uma Política. Abaixo da última camada vêm os Planos de Ação.</p>
      ${gestor ? `<p class="tec">Cada camada tem dois nomes: no singular, para um item (“um Programa”), e no plural, para os títulos das listas (“Programas”).</p>` : ""}
      <ol class="lista-camadas">${r.map((c, i) => `<li>
        ${gestor ? `<label class="campo-camada"><small class="tec">Nome no singular</small><input data-camada="${i}" data-campo="nome" value="${esc(c.nome)}" placeholder="Ex.: Programa"></label>
          <label class="campo-camada"><small class="tec">Nome no plural</small><input data-camada="${i}" data-campo="plural" value="${esc(c.plural)}" placeholder="Ex.: Programas"></label>
          <label class="alternar"><input type="checkbox" data-camada="${i}" data-campo="opcional"${c.opcional ? " checked" : ""}> Opcional</label>
          <span class="botoes-situacao"><button type="button" class="tirar" data-mover-camada="${i}" data-sentido="-1" aria-label="Subir"${i === 0 ? " disabled" : ""}>↑</button>
          <button type="button" class="tirar" data-mover-camada="${i}" data-sentido="1" aria-label="Descer"${i === r.length - 1 ? " disabled" : ""}>↓</button>
          <button type="button" class="tirar" data-tirar-camada="${i}" aria-label="Retirar ${esc(c.nome)}"${n(c.id) ? ` disabled title="Tem ${n(c.id)} ${plural(n(c.id), "item", "itens")}"` : ""}>${ICONES.fechar}</button></span>`
          : `<b>${esc(c.nome)}</b> <small class="tec">${esc(c.plural)}${c.opcional ? " · opcional" : ""} · ${n(c.id)} ${plural(n(c.id), "item", "itens")}</small>`}
      </li>`).join("")}<li class="tec">Planos de Ação</li></ol>
      ${gestor ? `<div class="botoes"><button type="button" class="botao" data-nova-camada>${ICONES.mais}Camada</button><button type="button" class="botao principal" data-salvar-camadas>Salvar camadas</button></div>` : ""}`;
  }

  /* ---------- importar ---------- */
  function importarHtml() {
    return `
      <p class="tec">Cole as linhas do Google Planilhas ou do Excel, com a linha de títulos. Colunas: <b>Camada</b> e <b>Nome</b> (obrigatórias),
        <b>Código</b>, <b>Superiores</b> (códigos separados por “;”) e <b>Instrumento</b> (o nome de um instrumento cadastrado).
        Um item que já tem o mesmo código na mesma camada é atualizado. Os superiores podem citar outras linhas da planilha.</p>
      <textarea class="texto-exportado" data-importar-catalogo rows="8" aria-label="Linhas coladas da planilha"></textarea>
      <div class="botoes"><button type="button" class="botao" data-conferir-catalogo>Conferir</button></div>
      <div data-previa-catalogo>${previaHtml()}</div>`;
  }
  function previaHtml() {
    const p = planoImportacao;
    if (!p) return "";
    if (p.erro) return `<p class="erro">${esc(p.erro)}</p>`;
    const conta = (t) => p.linhas.filter((l) => l.tipo === t).length;
    const nomes = { novo: "Novo", atualiza: "Atualiza", igual: "Sem mudança", erro: "Fica de fora" };
    return `<div class="previa-importacao">
      <p><b>${conta("novo")} ${plural(conta("novo"), "item novo", "itens novos")}</b> e <b>${conta("atualiza")} ${plural(conta("atualiza"), "atualização", "atualizações")}</b>.
        ${p.ignoradas.length ? `<span class="tec">Colunas ignoradas: ${p.ignoradas.map(esc).join(", ")}.</span>` : ""}</p>
      <ul>${p.linhas.map((l) => `<li class="${l.tipo === "erro" ? "erro" : l.tipo === "novo" ? "nova" : l.tipo}"><span class="tec">Linha ${l.linha}</span>
        <b>${esc([l.codigo, l.nome].filter(Boolean).join(" · ") || "(sem nome)")}</b> <span>${nomes[l.tipo]}${l.erro ? `: ${esc(l.erro)}` : ""}</span>
        ${l.avisos.map((a) => `<span class="aviso-linha">${esc(a)}</span>`).join("")}</li>`).join("")}</ul>
      ${conta("novo") + conta("atualiza") ? '<div class="botoes"><button type="button" class="botao principal" data-gravar-catalogo>Gravar</button></div>' : ""}
    </div>`;
  }

  /* ---------- eventos ---------- */
  /** Comandos que existem no menu e também sobre o mapa ou numa folha. Devolve true se tratou o botão. */
  async function comandoComum(t) {
    if (t.dataset.abrirFolha) { if (t.dataset.abrirFolha === "arvore") verComoLista(); else abrirFolha(t.dataset.abrirFolha); return true; }
    if (t.matches("[data-novo-item]")) { alternarMenu(false); abrirNovoItem(); return true; }
    if (t.matches("[data-voltar-automatico]")) {
      alternarMenu(false);
      const antes = ui.ordemDoMapa;
      ui.ordemDoMapa = null; // na hora; se o servidor recusar, volta
      desenharMapa(); desenharComandos();
      try { await store.voltarAoAutomaticoNoMapa(); avisar("O Mapa voltou à ordem automática."); } catch (f) { ui.ordemDoMapa = antes; avisar(f.message); desenharMapa(); desenharComandos(); }
      return true;
    }
    return false;
  }
  comandos?.addEventListener("click", async (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    if (t.matches("[data-alternar-menu]")) { alternarMenu(); return; }
    if (t.matches("[data-alternar-filtros]")) { alternarFiltros(); return; }
    if (t.matches("[data-filtro-padrao]")) {
      mudarFiltro(FILTRO_PADRAO);
      comandos.querySelector("[data-painel-filtros]").innerHTML = filtrosHtml();
      comandos.querySelector("[data-painel-filtros] input")?.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.tema) {
      const escolhido = escolherTema(t.dataset.tema); // troca na hora, sem fechar o menu
      for (const b of comandos.querySelectorAll("[data-tema]")) b.setAttribute("aria-pressed", String(b.dataset.tema === escolhido));
      return;
    }
    if (t.matches("[data-como-usar]")) { abrirComoUsar(); return; }
    if (t.dataset.contaAcao) {
      alternarMenu(false);
      if (t.dataset.contaAcao === "entrar") conta.entrar();
      if (t.dataset.contaAcao === "senha") conta.trocarSenha();
      if (t.dataset.contaAcao === "sair") conta.sair();
      return;
    }
    await comandoComum(t);
  });
  comandos?.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.filtroCamada) {
      const ocultas = new Set(ui.filtro.ocultas);
      if (t.checked) ocultas.delete(t.dataset.filtroCamada); else ocultas.add(t.dataset.filtroCamada);
      mudarFiltro({ ...ui.filtro, ocultas: [...ocultas] });
    } else if (t.dataset.filtroVigencia) mudarFiltro({ ...ui.filtro, vigencias: { ...ui.filtro.vigencias, [t.dataset.filtroVigencia]: t.checked } });
  });
  /* o menu e os filtros fecham com Esc e com um toque fora deles */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (ui.menu) { e.preventDefault(); alternarMenu(false); comandos.querySelector("[data-alternar-menu]")?.focus(); return; }
    if (ui.filtros) { e.preventDefault(); alternarFiltros(false); comandos.querySelector("[data-alternar-filtros]")?.focus(); return; }
    if (ui.folha && !document.querySelector(".camada")) { e.preventDefault(); fecharFolha(); }
  });
  document.addEventListener("pointerdown", (e) => {
    if (ui.menu && !e.target.closest?.("[data-menu], [data-alternar-menu]")) alternarMenu(false);
    if (ui.filtros && !e.target.closest?.("[data-painel-filtros], [data-alternar-filtros]")) alternarFiltros(false);
  }, true);

  alvo.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t || t.disabled) return;
    if (t.matches("[data-fechar-folha]")) { fecharFolha(); return; }
    if (await comandoComum(t)) return;
    if (t.dataset.item) { ui.mapa.selecionado = t.dataset.item; return abrirItem(t.dataset.item); } // o mesmo ponto fica aceso no Mapa
    if (t.dataset.alternarNo) { if (ui.recolhidos.has(t.dataset.alternarNo)) ui.recolhidos.delete(t.dataset.alternarNo); else ui.recolhidos.add(t.dataset.alternarNo); return desenharFolha(); }
    if (t.matches("[data-recolher-tudo]")) {
      if (ui.recolhidos.size) ui.recolhidos.clear();
      else for (const el of alvo.querySelectorAll("[data-alternar-no]")) ui.recolhidos.add(el.dataset.alternarNo);
      return desenharFolha();
    }
    if (t.matches("[data-novo-instrumento]")) return abrirInstrumento();
    if (t.dataset.editarInstrumento) return abrirInstrumento(t.dataset.editarInstrumento);
    if (t.dataset.prorrogar) return abrirProrrogacao(t.dataset.prorrogar);
    if (t.dataset.excluirInstrumento) {
      try { await store.excluirInstrumento(t.dataset.excluirInstrumento); await recarregar(); avisar("Instrumento excluído."); } catch (f) { avisar(f.message); }
      return;
    }
    if (t.dataset.moverCamada != null) {
      const i = Number(t.dataset.moverCamada);
      const j = i + Number(t.dataset.sentido);
      [rascunho[i], rascunho[j]] = [rascunho[j], rascunho[i]];
      return desenharFolha();
    }
    if (t.dataset.tirarCamada != null) { rascunho.splice(Number(t.dataset.tirarCamada), 1); return desenharFolha(); }
    if (t.matches("[data-nova-camada]")) {
      rascunho.push({ id: `c${Date.now().toString(36)}`, nome: "", plural: "", opcional: false });
      desenharFolha();
      const campos = alvo.querySelectorAll('[data-campo="nome"]');
      return campos[campos.length - 1]?.focus();
    }
    if (t.matches("[data-salvar-camadas]")) {
      try { await store.alterarCamadas(rascunho); await recarregar(); avisar("Camadas salvas."); } catch (f) { avisar(f.message); }
      return;
    }
    if (t.matches("[data-conferir-catalogo]")) {
      planoImportacao = planejarCatalogo({ texto: alvo.querySelector("[data-importar-catalogo]").value, ...cat, normalizar, lerColagem });
      alvo.querySelector("[data-previa-catalogo]").innerHTML = previaHtml();
      return;
    }
    if (t.matches("[data-gravar-catalogo]")) {
      t.disabled = true;
      try {
        const r = await store.importarCatalogo(planoImportacao);
        planoImportacao = null;
        await recarregar();
        avisar(`Catálogo gravado: ${r.criados} ${plural(r.criados, "item novo", "itens novos")}, ${r.atualizados} ${plural(r.atualizados, "atualização", "atualizações")}.`
          + (r.falhas.length ? ` ${r.falhas.length} ${plural(r.falhas.length, "linha falhou", "linhas falharam")}: ${r.falhas.map((x) => `linha ${x.linha}, ${x.mensagem}`).join("; ")}` : ""));
      } catch (f) { t.disabled = false; avisar(f.message); }
    }
  });
  alvo.addEventListener("input", (e) => {
    if (e.target.matches("[data-busca-arvore]")) { ui.busca = e.target.value; desenharFolha(); return; }
    const i = e.target.dataset.camada;
    if (i != null && e.target.type !== "checkbox") rascunho[Number(i)][e.target.dataset.campo] = e.target.value;
  });
  alvo.addEventListener("change", (e) => {
    if (e.target.matches("[data-so-vigentes]")) { ui.soVigentes = e.target.checked; desenhar(); return; }
    const i = e.target.dataset.camada;
    if (i != null && e.target.type === "checkbox") rascunho[Number(i)].opcional = e.target.checked;
  });

  return { recarregar };
}
