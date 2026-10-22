/**
 * Espaço aberto: lista de ações (especificação, seção 8.3; passo 1.6).
 * Cartões, fases e etapas recolhíveis, filtros, ordenação, "Minhas ações", legenda e animações.
 * Ferramentas na barra do topo, à direita (21/10/2026): seletor de modo, Filtrar e Ordenar (painéis
 * pequenos que abrem sob o botão) e Nova ação; no celular, um botão abre "Filtros e ordem" e o (+) cria.
 * No alto do conteúdo, só os avisos: previsão incompleta e ações atrasadas.
 */
import { criarCalendario, datasEfetivas } from "../calendario.js";
import { caminhoCritico } from "../calculo.js";
import { simular } from "../simulacao.js";
import { ICONES } from "../icones.js";
import { esc, dataBr, plural } from "../formato.js";
import { montarLinhas, contar, filtrar, ordenar, agrupar, resumir } from "../lista.js";
import { abrirPainel, avisar } from "./painel.js";
import { surgir } from "./movimento.js";
import { donosHtml } from "./pessoas.js";
import { abrirAcao } from "./janela-acao.js";
import { abrirNovaAcao, dataMinimaPadrao } from "./nova-acao.js";
import { criarPlanilha } from "./editar-planilha.js";
import { desenharLinhaDoTempo } from "./linha-do-tempo.js";
import { desenharCronograma } from "./cronograma.js";
import { desenharRede } from "./rede.js";

const SITUACOES = {
  concluida: { texto: "Concluída", icone: "concluida", classe: "icone-concluida" },
  liberada: { texto: "Liberada", icone: "liberada", classe: "icone-liberada" },
  naoLiberada: { texto: "Não liberada", icone: "naoLiberada", classe: "icone-nao-liberada" },
};
const BOTOES_DE_FILTRO = [
  ["todas", "Todas"],
  ["liberada", "Liberadas", "liberada", "icone-liberada"],
  ["atrasada", "Atrasadas", "atrasada", "icone-atrasada"],
  ["naoLiberada", "Não liberadas", "naoLiberada", "icone-nao-liberada"],
  ["concluida", "Concluídas", "concluida", "icone-concluida"],
];
const ORDENS = [
  ["espaco", "Ordem do espaço"],
  ["execucao", "Prioridade de execução"],
  ["revisao", "Prioridade de revisão"],
  ["conclusao", "Conclusão prevista"],
];
const reduzirMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Mostra o espaço e acompanha as mudanças no banco: a cada gravação (de quem quer que seja),
 * recalcula e redesenha a lista e a janela aberta, mantendo filtros, ordem e grupos recolhidos.
 * @param {HTMLElement} alvo
 * @param {{store: object, espacoId: string, hoje: string, usuario?: string|null, barra: HTMLElement}} opcoes
 *   usuario: e-mail de quem entrou; sem ele, "Minhas ações" não aparece;
 *   barra: lugar das ferramentas na barra do topo
 * @returns {() => void} para de acompanhar (ao trocar de espaço)
 */
export function mostrarEspaco(alvo, { store, espacoId, hoje, usuario = null, barra }) {
  const ui = { modo: "lista", situacao: "todas", responsavel: "", minhas: false, ordem: "espaco", recolhidos: new Set(), legenda: false,
    /** painel aberto sob um botão da barra: "filtrar", "ordenar" ou null */
    pop: null,
    /** aproximação do cronograma: "semanas" ou "meses" */
    escalaCrono: "semanas",
    /** comparação do cronograma com um retrato (passo 1.18): lista (null: a carregar), escolhido e datas dele */
    retratos: null, comparar: null, base: null,
    /** tamanho da rede: "normal" ou "tudo" (reduzida para caber na largura) */
    escalaRede: "normal",
    /** linha de criação rápida com o cursor (chave) e o texto digitado, preservados entre redesenhos */
    rapida: null, rapidaTexto: "" };
  let espaco, acoes, responsaveis, cal, sim, linhas, pessoas, meus, usaFases, usaCodigos, etapaDe, caminho;
  let janela = null;
  /** janela "Nova ação" aberta: fica aberta entre criações e recebe as mudanças do banco */
  let novaJanela = null;
  const planilha = criarPlanilha({ store, espacoId, hoje, usuario });
  let comAcoes = null;
  let ferramentas, lista, legenda, cabeca;

  /** Recalcula tudo o que depende dos dados. */
  function derivar(dados, todos, geral) {
    espaco = dados.espaco;
    acoes = [...dados.acoes].sort((a, b) => a.ordem - b.ordem);
    responsaveis = todos;
    cal = criarCalendario({ ...espaco, datasExcluidas: datasEfetivas(espaco, geral) }, hoje);
    caminho = caminhoCritico(acoes, cal, { hoje });
    sim = simular(acoes, cal, { hoje, semente: espaco.semente, simulacoes: espaco.simulacoes, prazoFinal: espaco.prazoFinal });
    linhas = montarLinhas(acoes, caminho, sim, cal, hoje);
    pessoas = new Map(responsaveis.map((r) => [r.id, r]));
    meus = usuario ? responsaveis.filter((r) => r.usuario === usuario).map((r) => r.id) : null;
    usaFases = espaco.camposOpcionais?.fasesEtapas !== false && Boolean(espaco.estrutura?.length);
    usaCodigos = espaco.camposOpcionais?.codigos === true; // desligado por padrão (seção 4.2)
    etapaDe = new Map((espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => [e.id, e.nome])));
  }

  /** Dados prontos para a janela da ação. */
  const dadosDaJanela = () => ({
    espaco, acoes, responsaveis, cal, caminho, pessoas, meus, usaFases,
    linhaDe: new Map(linhas.map((l) => [l.acao.numero, l])),
    usaCodigos,
  });

  /* separadores de fases e etapas em qualquer ordenação: a ordem escolhida vale dentro de cada etapa.
     Só somem ao desligar "Fases e etapas" em Campos opcionais (decisão do responsável, 22/10/2026) */
  const agrupado = () => usaFases && ui.modo === "lista";
  const ativos = () => (ui.situacao !== "todas" ? 1 : 0) + (ui.responsavel ? 1 : 0) + (ui.minhas ? 1 : 0) + (ui.ordem !== "espaco" ? 1 : 0);
  const visiveis = () => ordenar(filtrar(linhas, {
    situacao: ui.situacao, responsavel: ui.responsavel, minhas: ui.minhas ? meus : undefined,
  }), ui.ordem);

  const faltam = () => linhas.filter((l) => l.semEstimativa).length;
  /* o nome do espaço fica só na barra do topo (passo 1.14c); datas e chance saíram do alto (21/10/2026): vão para a linha do tempo e o cronograma (passos 1.17a e 1.17b);
     o aviso de previsão incompleta fica sempre à vista, em qualquer modo */
  function cabecaHtml() {
    const atrasadas = linhas.filter((l) => l.atrasada).length;
    /* alerta de atrasadas e "Mostrar até" na mesma linha (22/10/2026, pedido do responsável) */
    const alerta = atrasadas ? `<button type="button" class="alerta-atrasadas" data-filtro="${ui.situacao === "atrasada" ? "todas" : "atrasada"}">${ICONES.atrasada}<span>${ui.situacao === "atrasada"
        ? `Mostrando só ${plural(atrasadas, "a ação atrasada", `as ${atrasadas} ações atrasadas`)}. <u>Mostrar todas</u>`
        : `<b>${atrasadas} ${plural(atrasadas, "ação atrasada", "ações atrasadas")}.</b> <u>Ver</u>`}</span></button>` : "";
    return `${alerta || agrupado() ? `<div class="cabeca-linha">${alerta || "<span></span>"}${agrupado() ? niveisHtml() : ""}</div>` : ""}
      ${faltam() ? `<p class="previsao-incompleta">${ICONES.atrasada}<span><b>Previsão incompleta:</b> ${faltam()} ${plural(faltam(), "ação sem estimativa conta", "ações sem estimativa contam")} como zero dias.</span></p>` : ""}`;
  }

  /** Monta a estrutura da tela; refeita só quando o espaço passa a ter ou deixa de ter ações. */
  /**
   * Estrutura fixa da tela: cabeçalho e ações. Sem abas desde 21/10/2026: os responsáveis
   * são do espaço e ficam em "Configurar este espaço" (seções 4.5 e 8.2).
   */
  let base = false;
  let painelAcoes;
  function montarBase() {
    base = true;
    alvo.innerHTML = `
      <section class="cabeca-espaco" data-cabeca></section>
      <div data-painel="acoes"></div>`;
    cabeca = alvo.querySelector("[data-cabeca]");
    painelAcoes = alvo.querySelector('[data-painel="acoes"]');
  }

  /** Painel da aba Ações, montado uma vez: ferramentas, legenda e lista, mesmo com o espaço vazio. */
  function montar() {
    comAcoes = true;
    painelAcoes.innerHTML = `
        <div class="legenda" data-legenda hidden>${legendaHtml()}</div>
        <div class="lista" data-lista></div>
        <button class="botao-flutuante so-celular" type="button" aria-label="Nova ação" data-nova>${ICONES.mais}</button>`;
    ferramentas = barra;
    lista = painelAcoes.querySelector("[data-lista]");
    legenda = painelAcoes.querySelector("[data-legenda]");
    ligarRapida();
    /* propriedades, e não addEventListener: a barra é a mesma para todos os espaços */
    ferramentas.onchange = aoMudarControle;
    ferramentas.onclick = aoClicarNaBarra;
    ligarArraste();
    lista.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-abrir-acao]")) { e.preventDefault(); e.target.click(); }
    });
  }

  function desenhar() {
    if (!base) montarBase();
    if (!comAcoes) montar();
    cabeca.innerHTML = cabecaHtml();
    desenharFerramentas();
    desenharLista();
  }

  /* ---------- ferramentas: filtros de situação, controles e Nova ação ---------- */
  /**
   * Seletor de modo: só ícones; o modo ativo mostra também o nome, e os demais o mostram ao
   * passar o mouse (decisão do responsável, 21/10/2026). No celular, só Lista e Quadro.
   */
  const MODOS = [["lista", "Lista", "modoLista", ""], ["quadro", "Quadro", "modoQuadro", ""], ["planilha", "Planilha", "modoPlanilha", "so-computador"],
    ["cronograma", "Cronograma", "modoCronograma", "so-computador"],
    ["rede", "Rede", "modoRede", "so-computador"],
    ["linha", "Linha do tempo", "modoLinha", "so-computador"]];
  /** Modos sem filtros nem ordem: mostram o espaço inteiro (no cronograma, as setas ligariam ações escondidas). */
  const semFiltros = () => ["planilha", "cronograma", "rede", "linha"].includes(ui.modo);
  let modoDesenhado = null;
  function modosHtml() {
    const trocou = modoDesenhado !== null && modoDesenhado !== ui.modo;
    return `<div class="modos" role="group" aria-label="Exibir como">
      ${MODOS.map(([v, nome, icone, classe]) => `<button type="button" class="modo ${classe}" data-modo="${v}" aria-pressed="${ui.modo === v}" title="${nome}" aria-label="${nome}">
        ${ICONES[icone]}<span class="modo-nome${ui.modo === v && trocou ? " entrando" : ""}" aria-hidden="true">${nome}</span></button>`).join("")}
    </div>`;
  }
  function controlesHtml() {
    return `
      ${semFiltros() ? "" : `
      ${meus ? `<label class="alternar"><input type="checkbox" data-ctl="minhas"${ui.minhas ? " checked" : ""}> Minhas ações</label>` : ""}
      <select data-ctl="responsavel" aria-label="Responsável">
        <option value="">Todos os responsáveis</option>
        ${responsaveis.map((r) => `<option value="${esc(r.id)}"${ui.responsavel === r.id ? " selected" : ""}>${esc(r.sigla ? `${r.sigla} · ${r.nome}` : r.nome)}</option>`).join("")}
      </select>
      <select data-ctl="ordem" aria-label="Ordenar">
        ${ORDENS.map(([v, t]) => `<option value="${v}"${ui.ordem === v ? " selected" : ""}>${t}</option>`).join("")}
      </select>`}`;
  }
  /**
   * Até onde abrir a lista agrupada (22/10/2026, pedido do responsável): só as fases, até as etapas,
   * ou tudo, até as ações. Fica acima da lista, à vista, no computador e no celular.
   */
  const NIVEIS = [["fases", "Fases"], ["etapas", "Etapas"], ["acoes", "Ações"]];
  const idsDe = (nivel) => [...lista.querySelectorAll(`.grupo.${nivel}`)].map((g) => g.dataset.grupo);
  function nivelAtual() {
    const [fases, etapas] = [idsDe("fase"), idsDe("etapa")];
    if (!ui.recolhidos.size) return "acoes";
    if (fases.length && fases.every((id) => ui.recolhidos.has(id))) return "fases";
    if (fases.every((id) => !ui.recolhidos.has(id)) && etapas.length && etapas.every((id) => ui.recolhidos.has(id))) return "etapas";
    return null;
  }
  const niveisHtml = () => `<div class="niveis" role="group" aria-label="Mostrar até">
      <span class="niveis-rotulo">Mostrar até</span>
      ${NIVEIS.map(([v, nome]) => `<button type="button" data-nivel="${v}" aria-pressed="false">${nome}</button>`).join("")}
    </div>`;
  function marcarNivel() {
    const atual = nivelAtual();
    for (const b of alvo.querySelectorAll("[data-nivel]")) b.setAttribute("aria-pressed", String(b.dataset.nivel === atual));
  }
  function mostrarAte(nivel) {
    ui.recolhidos.clear();
    if (nivel === "fases") for (const id of idsDe("fase")) ui.recolhidos.add(id);
    if (nivel === "etapas") for (const id of idsDe("etapa")) ui.recolhidos.add(id);
    for (const g of lista.querySelectorAll(".grupo")) {
      const fechado = ui.recolhidos.has(g.dataset.grupo);
      g.classList.toggle("fechado", fechado);
      g.querySelector(":scope > .grupo-cabeca").setAttribute("aria-expanded", String(!fechado));
    }
    marcarNivel();
  }

  /** Filtros ativos (situação, responsável, "Minhas ações"), para o número no funil. */
  const filtrosAtivos = () => (ui.situacao !== "todas" ? 1 : 0) + (ui.responsavel ? 1 : 0) + (ui.minhas ? 1 : 0);

  function situacoesHtml() {
    const n = contar(linhas);
    return BOTOES_DE_FILTRO.filter(([v]) => ui.modo === "lista" || v === "todas" || v === "atrasada").map(([v, t, icone, classe]) =>
      `<button class="opcao" type="button" data-filtro="${v}" aria-pressed="${ui.situacao === v}">
        <span class="opcao-icone ${classe ?? ""}">${icone ? ICONES[icone] : ""}</span><span class="opcao-texto">${t}</span><span class="n">${n[v]}</span></button>`).join("");
  }
  function responsavelHtml() {
    return `${meus ? `<label class="alternar"><input type="checkbox" data-ctl="minhas"${ui.minhas ? " checked" : ""}> Minhas ações</label>` : ""}
      <label class="campo-pop"><span>Responsável</span><select data-ctl="responsavel">
        <option value="">Todos</option>
        ${responsaveis.map((r) => `<option value="${esc(r.id)}"${ui.responsavel === r.id ? " selected" : ""}>${esc(r.sigla ? `${r.sigla} · ${r.nome}` : r.nome)}</option>`).join("")}
      </select></label>`;
  }
  function ordensHtml() {
    return ORDENS.map(([v, t]) => `<button class="opcao" type="button" data-ordem="${v}" aria-pressed="${ui.ordem === v}"><span class="opcao-icone">${ui.ordem === v ? ICONES.marcado : ""}</span><span class="opcao-texto">${t}</span></button>`).join("");
  }
  function popoverHtml() {
    if (ui.pop === "filtrar") {
      return `<div class="popover" data-popover role="dialog" aria-label="Filtrar">
        <h3>Situação</h3><div class="opcoes-lista">${situacoesHtml()}</div>
        ${responsavelHtml()}
        ${filtrosAtivos() ? '<button class="botao discreto" type="button" data-limpar-filtros>Limpar filtros</button>' : ""}
      </div>`;
    }
    if (ui.pop === "ordenar") {
      return `<div class="popover" data-popover role="dialog" aria-label="Ordenar">
        <h3>Ordenar por</h3><div class="opcoes-lista">${ordensHtml()}</div>
      </div>`;
    }
    return "";
  }

  /** Ferramentas na barra do topo: modo, Filtrar, Ordenar e Nova ação (celular: "Filtros e ordem"). */
  function desenharFerramentas({ abriu = false } = {}) {
    const planilha = semFiltros();
    const nf = filtrosAtivos();
    ferramentas.innerHTML = `
      <div class="so-computador">${modosHtml()}</div>
      ${planilha ? "" : `
      <button class="icone-barra so-computador" type="button" data-pop="filtrar" aria-label="Filtrar" title="Filtrar" aria-expanded="${ui.pop === "filtrar"}">
        ${ICONES.funil}${nf ? `<span class="contador">${nf}</span>` : ""}</button>
      <button class="icone-barra so-computador" type="button" data-pop="ordenar" aria-label="Ordenar" title="Ordenar" aria-expanded="${ui.pop === "ordenar"}">
        ${ICONES.ordenar}${ui.ordem !== "espaco" ? '<span class="ponto" aria-hidden="true"></span>' : ""}</button>`}
      <button class="icone-barra so-celular" type="button" data-opcoes aria-label="Filtros e ordem" title="Filtros e ordem">
        ${ICONES.funil}${ativos() ? `<span class="contador">${ativos()}</span>` : ""}</button>
      <button class="botao principal so-computador" type="button" data-nova>${ICONES.mais}Nova ação</button>
      ${planilha ? "" : popoverHtml()}`;
    modoDesenhado = ui.modo;
    legenda.hidden = !ui.legenda || planilha;
    if (abriu) surgir(ferramentas.querySelector("[data-popover]"));
  }

  function aoClicarNaBarra(e) {
    const t = e.target;
    const pop = t.closest("[data-pop]");
    if (pop) { ui.pop = ui.pop === pop.dataset.pop ? null : pop.dataset.pop; return desenharFerramentas({ abriu: Boolean(ui.pop) }); }
    const modo = t.closest("[data-modo]");
    if (modo) { ui.pop = null; return mudarModo(modo.dataset.modo); }
    const filtro = t.closest("[data-filtro]");
    if (filtro) return mudar("situacao", filtro.dataset.filtro);
    const ordem = t.closest("[data-ordem]");
    if (ordem) return mudar("ordem", ordem.dataset.ordem);
    if (t.closest("[data-limpar-filtros]")) { ui.responsavel = ""; ui.minhas = false; return mudar("situacao", "todas"); }
    if (t.closest("[data-opcoes]")) return abrirOpcoes();
    if (t.closest("[data-nova]")) { ui.pop = null; desenharFerramentas(); return abrirNova(); }
  }
  /* clique fora do painel aberto, ou Esc, fecha o painel */
  const fecharPop = (e) => {
    if (!ui.pop) return;
    /* composedPath: o botão clicado pode já ter sido trocado pelo redesenho da barra */
    if (e.type === "keydown" ? e.key !== "Escape" : e.composedPath().includes(ferramentas)) return;
    ui.pop = null;
    desenharFerramentas();
  };
  document.addEventListener("click", fecharPop);
  document.addEventListener("keydown", fecharPop);
  /* legenda: item do menu lateral (passo 1.14c) */
  const alternarLegenda = () => { ui.legenda = !ui.legenda; desenharFerramentas(); };
  document.addEventListener("sextante:alternar-legenda", alternarLegenda);

  /* ---------- lista ---------- */
  function medidor(valor, titulo, cor, texto) {
    if (valor == null) return `<span class="medidor vazio">—</span>`;
    return `<span class="medidor" title="${titulo}"><span class="barra-medidor"><i style="width:${Math.max(2, Math.round(valor * 100))}%;background:${cor}"></i></span><span class="num">${texto}</span></span>`;
  }
  const corDe = (l) => (l.situacao === "concluida" ? "var(--ok)" : l.execucao == null ? "var(--neutral)" : `color-mix(in oklab, var(--crit) ${Math.round(l.execucao * 100)}%, var(--neutral))`);

  const FALTA_ESTIMAR = `<span class="falta-estimar">Falta estimar</span>`;

  /* ---------- criação rápida (passo 1.14a): nome e Enter, no fim de cada etapa e da coluna Liberadas ---------- */
  /** Sem filtros: com filtro, a ação criada poderia sumir da tela logo ao nascer. */
  const comRapida = () => store.podeGravar !== false && ui.situacao === "todas" && !ui.responsavel && !ui.minhas;
  function rapidaHtml(chave, etapa = "", ondeTexto = "") {
    return `<form class="linha-rapida" data-rapida="${esc(chave)}" data-etapa="${esc(etapa)}">${ICONES.mais}
      <input name="rotulo" maxlength="120" autocomplete="off" placeholder="Adicionar ação${ondeTexto}" aria-label="Adicionar ação${ondeTexto}: digite o nome e tecle Enter"></form>`;
  }
  function ligarRapida() {
    lista.addEventListener("submit", async (e) => {
      const form = e.target.closest("[data-rapida]");
      if (!form) return;
      e.preventDefault();
      const rotulo = form.rotulo.value.trim();
      if (!rotulo) return;
      ui.rapida = form.dataset.rapida;
      ui.rapidaTexto = "";
      form.rotulo.value = "";
      const naoAntesDe = dataMinimaPadrao(espaco, hoje);
      try {
        await store.criarAcao(espacoId, {
          rotulo,
          ...(form.dataset.etapa ? { etapa: form.dataset.etapa } : {}),
          ...(naoAntesDe ? { naoAntesDe } : {}),
        });
      } catch (falha) {
        ui.rapidaTexto = rotulo;
        const atual = lista.querySelector(`[data-rapida="${CSS.escape(ui.rapida)}"] input`);
        if (atual) atual.value = rotulo;
        avisar(falha.message);
      }
    });
    lista.addEventListener("input", (e) => { if (e.target.closest("[data-rapida]")) ui.rapidaTexto = e.target.value; });
    lista.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && e.target.closest("[data-rapida]")) { e.target.value = ""; ui.rapidaTexto = ""; e.target.blur(); }
    });
    lista.addEventListener("focusin", (e) => {
      const form = e.target.closest("[data-rapida]");
      if (form && ui.rapida !== form.dataset.rapida) { ui.rapida = form.dataset.rapida; ui.rapidaTexto = e.target.value; }
    });
    /* o cursor foi para outro lugar (e não sumiu num redesenho): esquece a linha */
    lista.addEventListener("focusout", (e) => {
      if (e.target.closest("[data-rapida]") && e.relatedTarget && !e.relatedTarget.closest("[data-rapida]")) ui.rapida = null;
    });
  }
  /** Depois de redesenhar, devolve o cursor e o texto à linha rápida que estava em uso. */
  function restaurarRapida() {
    if (!ui.rapida) return;
    const input = lista.querySelector(`[data-rapida="${CSS.escape(ui.rapida)}"] input`);
    if (!input) return;
    input.value = ui.rapidaTexto;
    input.focus({ preventScroll: true });
  }

  /**
   * Dias úteis que faltam para a conclusão prevista, em vez da data (22/10/2026, decisão do responsável);
   * na atrasada, há quantos dias úteis a previsão venceu. A data aparece ao parar o mouse e na janela da ação.
   */
  function prazoTexto(l) {
    if (l.atrasada) {
      const n = Math.max(1, cal.diasUteisAte(hoje) - cal.diasUteisAte(l.vencidaEm));
      return `Venceu há ${n} ${plural(n, "dia útil", "dias úteis")}`;
    }
    const n = Math.max(0, cal.diasUteisAte(l.conclusao) - cal.diasUteisAte(hoje));
    return n === 0 ? "Conclui hoje" : `${plural(n, "Falta", "Faltam")} ${n} ${plural(n, "dia útil", "dias úteis")}`;
  }

  function linhaHtml(l) {
    const a = l.acao;
    const s = SITUACOES[l.situacao];
    const donos = donosHtml(a.responsaveis.map((id) => pessoas.get(id)).filter(Boolean), { tons: espaco.tons, meus });
    const revisao = l.revisao == null ? null : l.revisao < 0.01 ? "<1%" : `${Math.round(l.revisao * 100)}%`;
    const nota = l.situacao !== "concluida" && l.reprogramacoes
      ? `${l.reprogramacoes} ${plural(l.reprogramacoes, "reprogramação", "reprogramações")}` : "";
    return `<div class="item${l.situacao === "concluida" ? " feita" : ""}" data-numero="${a.numero}" style="--calor:${corDe(l)}">
      <div class="linha" role="button" tabindex="0" data-abrir-acao>
        <div class="acao-nome">${usaCodigos && a.codigo ? `<span class="codigo">${esc(a.codigo)}</span>` : ""}<span class="rotulo">${esc(a.rotulo)}</span>${!agrupado() && etapaDe.get(a.etapa) ? `<span class="etapa">${esc(etapaDe.get(a.etapa))}</span>` : ""}</div>
        <div class="sit"><span class="${s.classe}">${ICONES[s.icone]}</span><span>${s.texto}</span>${l.aPartirDe ? `<span class="tec">a partir de ${dataBr(l.aPartirDe)}</span>` : ""}${l.atrasada ? `<span class="carimbo"><span class="icone-atrasada">${ICONES.atrasada}</span>Atrasada</span>` : ""}</div>
        <div class="donos">${donos}</div>
        ${l.situacao === "concluida" ? `<div class="conc"></div>` /* concluída: sem data na lista, que é minimalista (22/10/2026) */
          : `<div class="conc"><span class="mlab">Conclusão prevista</span>${l.semEstimativa ? FALTA_ESTIMAR
          : `<span class="data${l.atrasada ? " atrasada" : ""}" title="${l.atrasada ? `Venceu em ${dataBr(l.vencidaEm)}` : `Conclusão prevista em ${dataBr(l.conclusao)}`}">${prazoTexto(l)}</span>`}${nota ? `<small>${nota}</small>` : ""}</div>`}
        <div class="ex"><span class="mlab">Prioridade de execução</span>${medidor(l.execucao, "Prioridade de execução", "var(--calor)", l.execucao == null ? "" : `${Math.round(l.execucao * 100)}%`)}</div>
        <div class="rv"><span class="mlab">Prioridade de revisão</span>${medidor(l.revisao, `Responde por ${revisao} da incerteza do prazo final`, "var(--accent)", revisao)}</div>
        <span class="seta">${ICONES.seguir}</span>
      </div>
    </div>`;
  }

  function grupoHtml(nivel, id, titulo, ls, miolo) {
    const r = resumir(ls);
    const fechado = ui.recolhidos.has(id);
    const resumo = r.total
      ? `${r.total} ${plural(r.total, "ação", "ações")} · ${r.concluidas} ${plural(r.concluidas, "concluída", "concluídas")}${r.atrasadas ? ` · <span class="grupo-atrasadas">${r.atrasadas} ${plural(r.atrasadas, "atrasada", "atrasadas")}</span>` : ""} · ${r.concluidas === r.total ? "concluído em" : "termina em"} <span class="mono">${dataBr(r.termina)}</span>`
      : "Nenhuma ação";
    return `<section class="grupo ${nivel}${fechado ? " fechado" : ""}" data-grupo="${esc(id)}">
      <button class="grupo-cabeca" type="button" aria-expanded="${!fechado}" data-alternar-grupo="${esc(id)}">
        <span class="grupo-seta">${ICONES.seguir}</span><span class="grupo-titulo">${esc(titulo)}</span>
        <span class="grupo-info"><span class="grupo-resumo">${resumo}</span>
        ${r.atrasadas ? `<span class="icone-atrasada grupo-alerta so-celular" title="${r.atrasadas} ${plural(r.atrasadas, "ação atrasada", "ações atrasadas")}">${ICONES.atrasada}</span>` : ""}
        <span class="grupo-progresso" title="Ações concluídas"><i style="width:${r.total ? Math.round((100 * r.concluidas) / r.total) : 0}%"></i></span></span>
      </button>
      <div class="grupo-corpo"><div class="grupo-dentro">${miolo}</div></div>
    </section>`;
  }

  function desenharLista({ animar = false } = {}) {
    const antes = new Map();
    if (animar) for (const el of lista.querySelectorAll(".item")) antes.set(el.dataset.numero, el.getBoundingClientRect());
    const ls = visiveis();
    let corpo;
    if (ui.modo === "planilha") { planilha.desenhar(lista, dadosDaJanela()); return; }
    if (ui.modo === "cronograma") {
      desenharCronograma(lista, { espaco, acoes, caminho, cal, hoje, usaFases, usaCodigos, escala: ui.escalaCrono,
        aoMudarEscala: (escala) => { ui.escalaCrono = escala; desenharLista(); },
        retratos: ui.retratos, comparar: ui.comparar, base: ui.base, aoComparar: compararCom });
      if (ui.retratos === null) carregarRetratos();
      return;
    }
    if (ui.modo === "rede") {
      desenharRede(lista, { acoes, caminho, linhas, etapaDe, usaCodigos, escala: ui.escalaRede,
        aoMudarEscala: (escala) => { ui.escalaRede = escala; desenharLista(); } });
      return;
    }
    if (ui.modo === "linha") { desenharLinhaDoTempo(lista, { espaco, cal, sim, hoje, temAcoes: acoes.length > 0 }); return; }
    const rapida = comRapida();
    if (ui.modo === "quadro") corpo = quadroHtml(ls);
    else if (!ls.length && !rapida) corpo = `<p class="lista-vazia">Nenhuma ação com esses filtros.</p>`;
    else if (agrupado()) {
      const g = agrupar(ls, espaco.estrutura, { vazias: rapida });
      corpo = g.fases.map(({ fase, etapas, linhas: daFase }) => grupoHtml("fase", fase.id, fase.nome, daFase,
        etapas.map(({ etapa, linhas: daEtapa }) => grupoHtml("etapa", etapa.id, etapa.nome, daEtapa,
          daEtapa.map(linhaHtml).join("") + (rapida ? rapidaHtml(etapa.id, etapa.id, ` em ${etapa.nome}`) : ""))).join(""))).join("")
        + (g.semEtapa.length ? grupoHtml("fase", "sem-etapa", "Sem fase nem etapa", g.semEtapa, g.semEtapa.map(linhaHtml).join("")) : "");
    } else {
      corpo = (ls.length ? "" : `<p class="lista-vazia">Este espaço ainda não tem ações. Digite o nome da primeira abaixo e tecle Enter, ou use "Nova ação".</p>`)
        + ls.map(linhaHtml).join("") + (rapida ? rapidaHtml("lista") : "");
    }
    lista.innerHTML = corpo;
    if (agrupado()) marcarNivel();
    restaurarRapida();
    if (animar && !reduzirMovimento()) animarMudanca(antes);
  }

  /* as ações que continuam deslizam até a nova posição; as que entram surgem suavemente */
  function animarMudanca(antes) {
    for (const el of lista.querySelectorAll(".item")) {
      const r0 = antes.get(el.dataset.numero);
      const r1 = el.getBoundingClientRect();
      const inicio = r0 ? [{ transform: `translateY(${r0.top - r1.top}px)` }, { transform: "none" }]
        : [{ opacity: 0, transform: "scale(.98)" }, { opacity: 1, transform: "none" }];
      if (r0 && Math.abs(r0.top - r1.top) < 1) continue;
      el.animate(inicio, { duration: r0 ? 320 : 260, easing: "cubic-bezier(.2,.7,.2,1)" });
    }
  }

  /* ---------- quadro (seção 8.3): colunas por situação; "Atrasada" é carimbo, não coluna ---------- */
  const COLUNAS = [
    ["naoLiberada", "Não liberadas", "icone-nao-liberada", "Liberadas sozinhas quando as anteriores terminam e a data mínima chega."],
    ["liberada", "Liberadas", "icone-liberada", "Arraste para Concluídas ao terminar."],
    ["concluida", "Concluídas", "icone-concluida", "Arraste de volta para Liberadas para desfazer a conclusão."],
  ];
  function cartaoHtml(l) {
    const a = l.acao;
    const donos = donosHtml(a.responsaveis.map((id) => pessoas.get(id)).filter(Boolean), { tons: espaco.tons, meus });
    const arrastavel = l.situacao !== "naoLiberada";
    return `<article class="item cartao-quadro${l.situacao === "concluida" ? " feita" : ""}" data-numero="${a.numero}" style="--calor:${corDe(l)}"${arrastavel ? ' draggable="true"' : ""}>
      <div class="linha" role="button" tabindex="0" data-abrir-acao>
        <div class="acao-nome">${usaCodigos && a.codigo ? `<span class="codigo">${esc(a.codigo)}</span>` : ""}<span class="rotulo">${esc(a.rotulo)}</span>${etapaDe.get(a.etapa) ? `<span class="etapa">${esc(etapaDe.get(a.etapa))}</span>` : ""}</div>
        ${l.atrasada ? `<span class="carimbo"><span class="icone-atrasada">${ICONES.atrasada}</span>Atrasada</span>` : ""}
        <div class="cartao-base"><div class="donos">${donos}</div>${l.semEstimativa ? FALTA_ESTIMAR : `<span class="data${l.atrasada ? " atrasada" : ""}">${dataBr(l.conclusao)}</span>`}</div>
        ${l.execucao == null ? "" : medidor(l.execucao, "Prioridade de execução", "var(--calor)", `${Math.round(l.execucao * 100)}%`)}
      </div>
    </article>`;
  }
  function quadroHtml(ls) {
    return `<div class="quadro">${COLUNAS.map(([situacao, titulo, classe, dica]) => {
      const daColuna = ls.filter((l) => l.situacao === situacao);
      return `<section class="coluna" data-coluna="${situacao}" aria-label="${titulo}">
        <header><span class="${classe}">${ICONES[SITUACOES[situacao].icone]}</span><b>${titulo}</b><span class="n">${daColuna.length}</span></header>
        <p class="tec so-computador">${dica}</p>
        <div class="coluna-cartoes">${daColuna.map(cartaoHtml).join("") || `<p class="vazio">Nenhuma ação.</p>`}</div>
        ${situacao === "liberada" && comRapida() ? rapidaHtml("quadro") : ""}
      </section>`;
    }).join("")}</div>`;
  }

  /* arrastar no quadro (computador): Liberadas → Concluídas registra a conclusão; Concluídas → Liberadas desfaz */
  let arrastada = null;
  const situacaoDe = (numero) => linhas.find((l) => l.acao.numero === numero)?.situacao;
  const destinoValido = (coluna, numero) => {
    const s = situacaoDe(numero);
    return (s === "liberada" && coluna === "concluida") || (s === "concluida" && coluna === "liberada");
  };
  function ligarArraste() {
    lista.addEventListener("dragstart", (e) => {
      const cartao = e.target.closest?.(".cartao-quadro");
      if (!cartao) return;
      arrastada = Number(cartao.dataset.numero);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(arrastada));
      cartao.classList.add("arrastando");
    });
    lista.addEventListener("dragend", (e) => {
      e.target.closest?.(".cartao-quadro")?.classList.remove("arrastando");
      for (const c of lista.querySelectorAll(".coluna.alvo")) c.classList.remove("alvo");
      arrastada = null;
    });
    lista.addEventListener("dragover", (e) => {
      const coluna = e.target.closest?.(".coluna");
      if (!coluna || arrastada == null || !destinoValido(coluna.dataset.coluna, arrastada)) return;
      e.preventDefault();
      coluna.classList.add("alvo");
    });
    lista.addEventListener("dragleave", (e) => {
      const coluna = e.target.closest?.(".coluna");
      if (coluna && !coluna.contains(e.relatedTarget)) coluna.classList.remove("alvo");
    });
    lista.addEventListener("drop", async (e) => {
      const coluna = e.target.closest?.(".coluna");
      if (!coluna || arrastada == null) return;
      e.preventDefault();
      const numero = arrastada;
      coluna.classList.remove("alvo");
      if (coluna.dataset.coluna === "concluida") abrirJanela(numero, "concluir");
      else {
        try {
          await store.desfazerConclusao(espacoId, numero);
          avisar("Conclusão desfeita. A ação voltou a ser liberada.");
        } catch (falha) {
          avisar(falha.message);
        }
      }
    });
  }

  /* ---------- mudanças ---------- */
  function mudar(campo, valor) {
    ui[campo] = valor;
    cabeca.innerHTML = cabecaHtml();
    desenharFerramentas();
    desenharLista({ animar: true });
    if (painelOpcoes?.isConnected) preencherOpcoes();
  }

  /* ---------- retratos para o cronograma (passo 1.18) ---------- */
  let carregandoRetratos = false;
  async function carregarRetratos() {
    if (carregandoRetratos) return;
    carregandoRetratos = true;
    try {
      ui.retratos = await store.listarRetratos(espacoId);
    } catch {
      ui.retratos = [];
    }
    carregandoRetratos = false;
    if (ui.modo === "cronograma") desenharLista();
  }
  async function compararCom(id) {
    ui.comparar = id;
    ui.base = null;
    if (id) {
      try {
        ui.base = new Map((await store.listarAcoesDoRetrato(espacoId, id)).map((a) => [a.numero, { inicio: a.liberacaoPrevista, fim: a.conclusaoPrevista }]));
      } catch (e) {
        ui.comparar = null;
        avisar(e.message);
      }
    }
    if (ui.modo === "cronograma") desenharLista();
  }

  function mudarModo(modo) {
    if (modo === "cronograma") ui.retratos = null; // relê a lista: pode haver retrato novo
    if (modo === "quadro" && ui.situacao !== "atrasada") ui.situacao = "todas"; // no quadro, as colunas já separam as situações
    mudar("modo", modo);
  }

  function alternarGrupo(id) {
    const fechar = !ui.recolhidos.has(id);
    if (fechar) ui.recolhidos.add(id); else ui.recolhidos.delete(id);
    const secao = lista.querySelector(`[data-grupo="${CSS.escape(id)}"]`);
    secao.classList.toggle("fechado", fechar);
    secao.querySelector(":scope > .grupo-cabeca").setAttribute("aria-expanded", String(!fechar));
    desenharFerramentas();
    marcarNivel();
  }

  /* ---------- celular: painel "Filtros e ordem" ---------- */
  let painelOpcoes = null;
  function preencherOpcoes() {
    painelOpcoes.innerHTML = `
      <section class="opcoes">${modosHtml()}</section>
      ${semFiltros() ? "" : `<section class="opcoes"><h3>Situação</h3><div class="opcoes-lista">${situacoesHtml()}</div></section>
      <section class="opcoes">${controlesHtml()}</section>`}
      ${ativos() ? `<section><button class="botao discreto" type="button" data-limpar>Limpar filtros e ordem</button></section>` : ""}`;
  }
  function abrirOpcoes() {
    painelOpcoes = abrirPainel("Filtros e ordem", "", { deBaixo: true, botao: "Pronto" });
    preencherOpcoes();
    painelOpcoes.addEventListener("change", aoMudarControle);
    painelOpcoes.addEventListener("click", (e) => {
      const modo = e.target.closest("[data-modo]");
      if (modo) mudarModo(modo.dataset.modo);
      const filtro = e.target.closest("[data-filtro]");
      if (filtro) mudar("situacao", filtro.dataset.filtro);
      if (e.target.closest("[data-limpar]")) { ui.responsavel = ""; ui.minhas = false; ui.situacao = "todas"; mudar("ordem", "espaco"); }
    });
  }

  function aoMudarControle(e) {
    const ctl = e.target.dataset.ctl;
    if (ctl) mudar(ctl, e.target.type === "checkbox" ? e.target.checked : e.target.value);
  }

  /* ---------- eventos ---------- */
  alvo.onclick = (e) => { // onclick, e não addEventListener: cada espaço aberto substitui o anterior
    const t = e.target;
    const filtro = t.closest("[data-filtro]");
    if (filtro) return mudar("situacao", filtro.dataset.filtro);
    const grupo = t.closest("[data-alternar-grupo]");
    if (grupo) return alternarGrupo(grupo.dataset.alternarGrupo);
    const nivel = t.closest("[data-nivel]");
    if (nivel) return mostrarAte(nivel.dataset.nivel);
    if (t.closest("[data-nova]")) return abrirNova();
    const item = t.closest("[data-abrir-acao]");
    if (item) return abrirJanela(Number(item.closest("[data-numero]").dataset.numero));
  };

  function abrirNova() {
    novaJanela = abrirNovaAcao({
      aoFechar: () => { novaJanela = null; },
      store, espacoId, hoje, usuario, dados: dadosDaJanela(),
      aoCriar: (numero) => requestAnimationFrame(() => {
        const item = lista?.querySelector(`[data-numero="${numero}"]`);
        if (!item) return;
        item.scrollIntoView({ block: "center", behavior: reduzirMovimento() ? "auto" : "smooth" });
        item.classList.add("recem-criada");
        setTimeout(() => item.classList.remove("recem-criada"), 2000);
      }),
    });
  }

  function abrirJanela(numero, abrirCom = null) {
    janela = abrirAcao({
      store, espacoId, numero, hoje, usuario, dados: dadosDaJanela(), abrirCom,
      aoFechar: () => {
        janela = null;
        lista?.querySelector(`[data-numero="${numero}"] [data-abrir-acao]`)?.focus();
      },
    });
  }

  /* ---------- acompanhamento: cada mudança no banco recalcula e redesenha ---------- */
  let fila = Promise.resolve();
  const parar = store.acompanharEspaco(espacoId, (dados) => {
    fila = fila.then(async () => {
      derivar(dados, dados.responsaveis, await store.lerCalendarioGeral());
      desenhar();
      janela?.atualizar(dadosDaJanela());
      novaJanela?.atualizar(dadosDaJanela());
    }).catch((e) => avisar(e.message));
  });
  return () => {
    parar();
    janela?.fechar();
    document.removeEventListener("click", fecharPop);
    document.removeEventListener("keydown", fecharPop);
    document.removeEventListener("sextante:alternar-legenda", alternarLegenda);
    barra.innerHTML = "";
    barra.onclick = null;
    barra.onchange = null;
  };
}

function legendaHtml() {
  return `<div class="legenda-itens">
    <span>Cor à esquerda: menos prioritária <span class="gradiente" aria-hidden="true"></span> mais prioritária</span>
    <span><span class="amostra-ok" aria-hidden="true"></span> concluída</span>
    <span>Barras: <a href="#" class="oque" data-termo="exec">prioridade de execução</a> e <a href="#" class="oque" data-termo="rev">prioridade de revisão</a></span>
    <span class="simbolos">
      <span><span class="icone-concluida">${ICONES.concluida}</span>Concluída</span>
      <span><span class="icone-liberada">${ICONES.liberada}</span>Liberada</span>
      <span><span class="icone-nao-liberada">${ICONES.naoLiberada}</span>Não liberada</span>
      <span><span class="icone-atrasada">${ICONES.atrasada}</span>Atrasada</span>
    </span>
  </div>`;
}
