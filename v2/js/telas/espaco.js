/**
 * Espaço aberto: lista de ações (especificação, seção 8.3; passo 1.6).
 * Cartões, fases e etapas recolhíveis, filtros, ordenação, "Minhas ações", legenda e
 * animações; no celular, painel "Filtros e ordem" e botão (+).
 * A conclusão prevista, a data segura e a chance ficam numa linha provisória no alto,
 * até a linha do tempo da aba Visualização (passo 1.17).
 */
import { criarCalendario } from "../calendario.js";
import { caminhoCritico } from "../calculo.js";
import { simular } from "../simulacao.js";
import { ICONES } from "../icones.js";
import { esc, dataBr, plural } from "../formato.js";
import { montarLinhas, contar, filtrar, ordenar, agrupar, resumir } from "../lista.js";
import { abrirPainel, avisar } from "./painel.js";
import { donosHtml } from "./pessoas.js";
import { abrirAcao } from "./janela-acao.js";
import { abrirNovaAcao } from "./nova-acao.js";

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
 * @param {{store: object, espacoId: string, hoje: string, usuario?: string|null}} opcoes
 *   usuario: e-mail de quem entrou; sem ele, "Minhas ações" não aparece
 * @returns {() => void} para de acompanhar (ao trocar de espaço)
 */
export function mostrarEspaco(alvo, { store, espacoId, hoje, usuario = null }) {
  const ui = { modo: "lista", situacao: "todas", responsavel: "", minhas: false, ordem: "espaco", recolhidos: new Set(), legenda: false };
  let espaco, acoes, responsaveis, cal, sim, linhas, pessoas, meus, usaFases, usaCodigos, etapaDe, caminho;
  let janela = null;
  let comAcoes = null;
  let ferramentas, lista, legenda, cabeca;

  /** Recalcula tudo o que depende dos dados. */
  function derivar(dados, todos) {
    espaco = dados.espaco;
    acoes = [...dados.acoes].sort((a, b) => a.ordem - b.ordem);
    responsaveis = todos;
    cal = criarCalendario(espaco, hoje);
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

  const agrupado = () => usaFases && ui.ordem === "espaco" && ui.modo === "lista";
  const ativos = () => (ui.responsavel ? 1 : 0) + (ui.minhas ? 1 : 0) + (ui.ordem !== "espaco" ? 1 : 0);
  const visiveis = () => ordenar(filtrar(linhas, {
    situacao: ui.situacao, responsavel: ui.responsavel, minhas: ui.minhas ? meus : undefined,
  }), ui.ordem);

  function cabecaHtml() {
    return `<h1>${esc(espaco.nome)}</h1>
      <p class="tec">Início em ${dataBr(espaco.inicio)}${espaco.prazoFinal ? ` · prazo final em ${dataBr(espaco.prazoFinal)}` : ""}</p>
      ${acoes.length ? `<p class="resumo-espaco">
        <span>Conclusão prevista <b class="mono">${dataBr(cal.dataDeConclusao(sim.p50, 0))}</b></span>
        <span>Data segura <b class="mono">${dataBr(cal.dataDeConclusao(sim.p80, 0))}</b> <a href="#" class="oque" data-termo="dataSegura">o que é?</a></span>
        ${sim.chancePrazo == null ? "" : `<span>Chance de cumprir o prazo <b class="mono">${Math.round(sim.chancePrazo * 100)}%</b></span>`}
      </p>` : ""}`;
  }

  /** Monta a estrutura da tela; refeita só quando o espaço passa a ter ou deixa de ter ações. */
  function montar() {
    comAcoes = acoes.length > 0;
    alvo.innerHTML = `
      <section class="cabeca-espaco" data-cabeca></section>
      ${comAcoes ? `
        <div class="ferramentas" data-ferramentas></div>
        <div class="legenda" data-legenda hidden>${legendaHtml()}</div>
        <div class="lista" data-lista></div>
        <button class="botao-flutuante so-celular" type="button" aria-label="Nova ação" data-nova>${ICONES.mais}</button>`
      : `<section class="cartao"><p>Este espaço ainda não tem ações.</p>
          <div class="botoes"><button class="botao principal" type="button" data-nova>${ICONES.mais}Nova ação</button></div></section>`}`;
    cabeca = alvo.querySelector("[data-cabeca]");
    ferramentas = alvo.querySelector("[data-ferramentas]");
    lista = alvo.querySelector("[data-lista]");
    legenda = alvo.querySelector("[data-legenda]");
    if (!comAcoes) return;
    ferramentas.addEventListener("change", aoMudarControle);
    ligarArraste();
    lista.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-abrir-acao]")) { e.preventDefault(); e.target.click(); }
    });
  }

  function desenhar() {
    if (comAcoes !== acoes.length > 0) montar();
    cabeca.innerHTML = cabecaHtml();
    if (!comAcoes) return;
    desenharFerramentas();
    desenharLista();
  }

  /* ---------- ferramentas: filtros de situação, controles e Nova ação ---------- */
  function controlesHtml() {
    return `
      <div class="segmentos" role="group" aria-label="Exibir como">
        <button type="button" data-modo="lista" aria-pressed="${ui.modo === "lista"}">Lista</button>
        <button type="button" data-modo="quadro" aria-pressed="${ui.modo === "quadro"}">Quadro</button>
      </div>
      ${meus ? `<label class="alternar"><input type="checkbox" data-ctl="minhas"${ui.minhas ? " checked" : ""}> Minhas ações</label>` : ""}
      <select data-ctl="responsavel" aria-label="Responsável">
        <option value="">Todos os responsáveis</option>
        ${responsaveis.map((r) => `<option value="${esc(r.id)}"${ui.responsavel === r.id ? " selected" : ""}>${esc(r.sigla ? `${r.sigla} · ${r.nome}` : r.nome)}</option>`).join("")}
      </select>
      <select data-ctl="ordem" aria-label="Ordenar">
        ${ORDENS.map(([v, t]) => `<option value="${v}"${ui.ordem === v ? " selected" : ""}>${t}</option>`).join("")}
      </select>`;
  }
  const botaoRecolherHtml = () => agrupado()
    ? `<button class="botao discreto" type="button" data-recolher-tudo>${ui.recolhidos.size ? "Expandir tudo" : "Recolher fases"}</button>` : "";

  function desenharFerramentas() {
    const n = contar(linhas);
    ferramentas.innerHTML = `
      <div class="chips" role="group" aria-label="Filtrar por situação">
        ${BOTOES_DE_FILTRO.filter(([v]) => ui.modo === "lista" || v === "todas" || v === "atrasada").map(([v, t, icone, classe]) => `<button class="chip" type="button" data-filtro="${v}" aria-pressed="${ui.situacao === v}">
          ${icone ? `<span class="${classe}">${ICONES[icone]}</span>` : ""}${t} <span class="n">${n[v]}</span></button>`).join("")}
      </div>
      <div class="controles so-computador">
        ${controlesHtml()}
        ${botaoRecolherHtml()}
        <button class="botao discreto" type="button" data-alternar-legenda aria-pressed="${ui.legenda}">Legenda</button>
        <button class="botao principal" type="button" data-nova>${ICONES.mais}Nova ação</button>
      </div>
      <button class="botao so-celular" type="button" data-opcoes>${ICONES.filtros}Filtros e ordem${ativos() ? ` <span class="contador">${ativos()}</span>` : ""}</button>`;
    legenda.hidden = !ui.legenda;
  }

  /* ---------- lista ---------- */
  function medidor(valor, titulo, cor, texto) {
    if (valor == null) return `<span class="medidor vazio">—</span>`;
    return `<span class="medidor" title="${titulo}"><span class="barra-medidor"><i style="width:${Math.max(2, Math.round(valor * 100))}%;background:${cor}"></i></span><span class="num">${texto}</span></span>`;
  }
  const corDe = (l) => (l.situacao === "concluida" ? "var(--ok)" : `color-mix(in oklab, var(--crit) ${Math.round(l.execucao * 100)}%, var(--neutral))`);

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
        <div class="conc"><span class="mlab">${l.situacao === "concluida" ? "Concluída em" : "Conclusão prevista"}</span><span class="data${l.atrasada ? " atrasada" : ""}">${dataBr(l.conclusao)}</span>${nota ? `<small>${nota}</small>` : ""}</div>
        <div class="ex"><span class="mlab">Prioridade de execução</span>${medidor(l.execucao, "Prioridade de execução", "var(--calor)", l.execucao == null ? "" : `${Math.round(l.execucao * 100)}%`)}</div>
        <div class="rv"><span class="mlab">Prioridade de revisão</span>${medidor(l.revisao, `Responde por ${revisao} da incerteza do prazo final`, "var(--accent)", revisao)}</div>
        <span class="seta">${ICONES.seguir}</span>
      </div>
    </div>`;
  }

  function grupoHtml(nivel, id, titulo, ls, miolo) {
    const r = resumir(ls);
    const fechado = ui.recolhidos.has(id);
    return `<section class="grupo ${nivel}${fechado ? " fechado" : ""}" data-grupo="${esc(id)}">
      <button class="grupo-cabeca" type="button" aria-expanded="${!fechado}" data-alternar-grupo="${esc(id)}">
        <span class="grupo-seta">${ICONES.seguir}</span><span class="grupo-titulo">${esc(titulo)}</span>
        <span class="grupo-info"><span class="grupo-resumo">${r.total} ${plural(r.total, "ação", "ações")} · ${r.concluidas} ${plural(r.concluidas, "concluída", "concluídas")}${r.atrasadas ? ` · <span class="grupo-atrasadas">${r.atrasadas} ${plural(r.atrasadas, "atrasada", "atrasadas")}</span>` : ""} · ${r.concluidas === r.total ? "concluído em" : "termina em"} <span class="mono">${dataBr(r.termina)}</span></span>
        ${r.atrasadas ? `<span class="icone-atrasada grupo-alerta so-celular" title="${r.atrasadas} ${plural(r.atrasadas, "ação atrasada", "ações atrasadas")}">${ICONES.atrasada}</span>` : ""}
        <span class="grupo-progresso" title="Ações concluídas"><i style="width:${Math.round((100 * r.concluidas) / r.total)}%"></i></span></span>
      </button>
      <div class="grupo-corpo"><div class="grupo-dentro">${miolo}</div></div>
    </section>`;
  }

  function desenharLista({ animar = false } = {}) {
    const antes = new Map();
    if (animar) for (const el of lista.querySelectorAll(".item")) antes.set(el.dataset.numero, el.getBoundingClientRect());
    const ls = visiveis();
    let corpo;
    if (ui.modo === "quadro") corpo = quadroHtml(ls);
    else if (!ls.length) corpo = `<p class="lista-vazia">Nenhuma ação com esses filtros.</p>`;
    else if (agrupado()) {
      const g = agrupar(ls, espaco.estrutura);
      corpo = g.fases.map(({ fase, etapas, linhas: daFase }) => grupoHtml("fase", fase.id, fase.nome, daFase,
        etapas.map(({ etapa, linhas: daEtapa }) => grupoHtml("etapa", etapa.id, etapa.nome, daEtapa, daEtapa.map(linhaHtml).join(""))).join(""))).join("")
        + (g.semEtapa.length ? grupoHtml("fase", "sem-etapa", "Sem fase nem etapa", g.semEtapa, g.semEtapa.map(linhaHtml).join("")) : "");
    } else {
      corpo = ls.map(linhaHtml).join("")
        + (usaFases ? `<p class="tec">Em "Ordem do espaço", as ações aparecem separadas por fases e etapas.</p>` : "");
    }
    lista.innerHTML = corpo;
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
        <div class="cartao-base"><div class="donos">${donos}</div><span class="data${l.atrasada ? " atrasada" : ""}">${dataBr(l.conclusao)}</span></div>
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
    desenharFerramentas();
    desenharLista({ animar: true });
    if (painelOpcoes?.isConnected) preencherOpcoes();
  }

  function mudarModo(modo) {
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
  }

  function recolherOuExpandirTudo() {
    if (ui.recolhidos.size) ui.recolhidos.clear();
    else for (const s of lista.querySelectorAll(".grupo.fase")) ui.recolhidos.add(s.dataset.grupo);
    for (const s of lista.querySelectorAll(".grupo")) {
      const fechado = ui.recolhidos.has(s.dataset.grupo);
      s.classList.toggle("fechado", fechado);
      s.querySelector(":scope > .grupo-cabeca").setAttribute("aria-expanded", String(!fechado));
    }
    desenharFerramentas();
    if (painelOpcoes?.isConnected) preencherOpcoes();
  }

  /* ---------- celular: painel "Filtros e ordem" ---------- */
  let painelOpcoes = null;
  function preencherOpcoes() {
    painelOpcoes.innerHTML = `
      <section class="opcoes">${controlesHtml()}</section>
      ${agrupado() ? `<section>${botaoRecolherHtml()}</section>` : ""}
      <section><h3>Legenda</h3>${legendaHtml()}</section>
      ${ativos() ? `<section><button class="botao discreto" type="button" data-limpar>Limpar filtros e ordem</button></section>` : ""}`;
  }
  function abrirOpcoes() {
    painelOpcoes = abrirPainel("Filtros e ordem", "", { deBaixo: true, botao: "Pronto" });
    preencherOpcoes();
    painelOpcoes.addEventListener("change", aoMudarControle);
    painelOpcoes.addEventListener("click", (e) => {
      const modo = e.target.closest("[data-modo]");
      if (modo) mudarModo(modo.dataset.modo);
      if (e.target.closest("[data-recolher-tudo]")) recolherOuExpandirTudo();
      if (e.target.closest("[data-limpar]")) { ui.responsavel = ""; ui.minhas = false; mudar("ordem", "espaco"); }
    });
  }

  function aoMudarControle(e) {
    const ctl = e.target.dataset.ctl;
    if (ctl) mudar(ctl, e.target.type === "checkbox" ? e.target.checked : e.target.value);
  }

  /* ---------- eventos ---------- */
  alvo.onclick = (e) => { // onclick, e não addEventListener: cada espaço aberto substitui o anterior
    const t = e.target;
    const modo = t.closest("[data-modo]");
    if (modo) return mudarModo(modo.dataset.modo);
    const filtro = t.closest("[data-filtro]");
    if (filtro) return mudar("situacao", filtro.dataset.filtro);
    const grupo = t.closest("[data-alternar-grupo]");
    if (grupo) return alternarGrupo(grupo.dataset.alternarGrupo);
    if (t.closest("[data-recolher-tudo]")) return recolherOuExpandirTudo();
    if (t.closest("[data-alternar-legenda]")) { ui.legenda = !ui.legenda; return desenharFerramentas(); }
    if (t.closest("[data-opcoes]")) return abrirOpcoes();
    if (t.closest("[data-nova]")) return abrirNova();
    const item = t.closest("[data-abrir-acao]");
    if (item) return abrirJanela(Number(item.closest("[data-numero]").dataset.numero));
  };

  function abrirNova() {
    abrirNovaAcao({
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
      derivar(dados, await store.listarResponsaveis());
      desenhar();
      janela?.atualizar(dadosDaJanela());
    }).catch((e) => avisar(e.message));
  });
  return () => { parar(); janela?.fechar(); };
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
