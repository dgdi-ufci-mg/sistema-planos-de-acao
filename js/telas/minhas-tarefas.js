/**
 * Tela "Meu trabalho", antes "Minhas tarefas" (documentação técnica, seção 8, "Meu trabalho"; 05/11/2026 e nova tela
 * de 19/11/2026, sobre o esboço aprovado pelo responsável): as ações e tarefas atribuídas a quem entrou, de todos os
 * espaços (regras em js/minhas-tarefas.js).
 *
 * - "Filtros e exibição", à direita da barra do topo, como nos espaços: ordenar (minha ordem ou data), agrupar
 *   (nenhum, espaço ou prazo), exibir como lista ou colunas, ocultar as não liberadas e espaços, o que mostrar na
 *   linha e a densidade. As escolhas ficam neste aparelho (localStorage, "sextante.meuTrabalho").
 * - Minha ordem: arrastar pelo puxador (mouse ou dedo), ou setas no puxador; só dentro do mesmo grupo ou coluna.
 * - Cada linha: o círculo de concluir, o nome (abre a janela da ação por cima da lista, 18/11/2026), o espaço e, à
 *   direita, o aviso (Prazo vencido, Atrasada ou Em risco, com a explicação e o link do glossário) e a data, com o tipo
 *   escrito ("até" a data-limite, "previsão" da conclusão, "planejada para" a data que venceu).
 */
import { esc, dataBr, plural } from "../formato.js";
import { prazoDaTarefa } from "../lista.js";
import { ICONES } from "../icones.js";
import { esqueletoHtml } from "./esqueleto.js";
import { abrirSuave, fecharSuave, reduzirMovimento, DURACAO, CURVA } from "./movimento.js";
import { AVISOS, AGRUPAR, ORDENAR } from "../minhas-tarefas.js";

/* ---------- escolhas de exibição, guardadas neste aparelho ---------- */
const CHAVE = "sextante.meuTrabalho";
/** Padrão (decisão do responsável, 19/11/2026): minha ordem, sem agrupamento, lista. */
export const VER_PADRAO = Object.freeze({
  ordenar: "minha", agrupar: "nenhum", exibir: "lista", ocultarNaoLiberadas: false, espacosOcultos: [],
  mostrar: { espaco: true, data: true, checklist: true, descricao: false }, densidade: "confortavel", recolhidos: [],
});

/** As escolhas guardadas, completadas pelo padrão. */
export function lerVer() {
  let g = {};
  try { g = JSON.parse(localStorage.getItem(CHAVE) || "{}") ?? {}; } catch { /* sem armazenamento */ }
  const v = { ...VER_PADRAO, ...g, mostrar: { ...VER_PADRAO.mostrar, ...(g.mostrar ?? {}) } };
  if (!ORDENAR.includes(v.ordenar)) v.ordenar = VER_PADRAO.ordenar;
  if (!AGRUPAR.includes(v.agrupar)) v.agrupar = VER_PADRAO.agrupar;
  if (!["lista", "colunas"].includes(v.exibir)) v.exibir = VER_PADRAO.exibir;
  if (!["confortavel", "compacta"].includes(v.densidade)) v.densidade = VER_PADRAO.densidade;
  if (!Array.isArray(v.espacosOcultos)) v.espacosOcultos = [];
  if (!Array.isArray(v.recolhidos)) v.recolhidos = [];
  v.ocultarNaoLiberadas = Boolean(v.ocultarNaoLiberadas);
  return v;
}
export function gravarVer(v) {
  try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ }
}
/** O que foge do padrão em ordem, grupos, exibição e filtros (o número do botão e a linha com "Limpar"). */
export function foraDoPadrao(v, espacos = []) {
  const nomes = new Map(espacos.map((e) => [e.id, e.nome]));
  const ocultos = v.espacosOcultos.filter((id) => nomes.has(id));
  return [
    v.ordenar === "data" && "Por data",
    v.agrupar === "espaco" && "Agrupado por espaço",
    v.agrupar === "prazo" && "Agrupado por prazo",
    v.exibir === "colunas" && "Em colunas",
    v.ocultarNaoLiberadas && "Sem as não liberadas",
    ocultos.length && `${ocultos.length} ${plural(ocultos.length, "espaço oculto", "espaços ocultos")}`,
  ].filter(Boolean);
}

/* ---------- datas, no formato da Lista de tarefas ("Hoje", "Amanhã", "qui.", "19 nov."), com o tipo escrito ---------- */
/** "Hoje" → "hoje", para vir depois de "até", "previsão" ou "planejada para"; dias e meses já vêm em minúscula. */
/* depois de "até" ou "previsão", o dia da semana vai por extenso: "previsão sex." se lê mal */
const POR_EXTENSO = { "dom.": "domingo", "seg.": "segunda", "ter.": "terça", "qua.": "quarta", "qui.": "quinta", "sex.": "sexta", "sáb.": "sábado" };
const minuscula = (t) => (/^(Hoje|Amanhã|Ontem)$/.test(t) ? t.toLowerCase() : POR_EXTENSO[t] ?? t);
/** Texto e tom da data (19/11/2026; formato da Lista de tarefas, 23/11/2026, pedido do responsável). */
function dataDe(item, hoje) {
  if (!item.prazo) return null;
  const p = prazoDaTarefa(item.prazo, hoje);
  const d = minuscula(p.texto);
  if (item.aviso === "atrasada") return { texto: `planejada para ${d}`, tom: "atrasada" };
  if (item.tipoDePrazo === "limite") return { texto: `até ${d}`, tom: p.tom };
  return { texto: `previsão ${d}`, tom: p.tom === "vencida" ? "atrasada" : p.tom };
}

/* ---------- avisos ---------- */
const NOME_DO_AVISO = Object.fromEntries(AVISOS);
const EXPLICACAO = {
  prazoVencido: (i) => `A data-limite (${dataBr(i.prazo)}) passou e a ${i.termo} não foi concluída.`,
  atrasada: (i) => `A data planejada para a conclusão (${dataBr(i.prazo)}), pela estimativa mais recente, já passou. Uma reestimativa tira o aviso.`,
  emRisco: () => "A previsão de conclusão passa da data-limite. O prazo ainda não venceu: há tempo de agir.",
};
/** O aviso como texto colorido com ícone, ao lado da data (23/11/2026: sem etiqueta de fundo, como a Lista). */
function avisoHtml(item) {
  if (!item.aviso) return "";
  const id = `dica-${item.chave.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  return `<span class="mt-aviso-caixa">
      <button type="button" class="mt-aviso ${item.aviso}" aria-describedby="${id}">${ICONES[item.aviso]}${NOME_DO_AVISO[item.aviso]}</button>
      <span class="mt-dica" role="tooltip" id="${id}"><b>${NOME_DO_AVISO[item.aviso]}</b>
        <span>${esc(EXPLICACAO[item.aviso](item))}</span>
        <a href="#" data-termo="${item.aviso}">Saiba mais no glossário</a></span>
    </span>`;
}

/* ---------- linhas, com a anatomia da Lista de tarefas (23/11/2026) ---------- */
function linhaHtml(item, hoje, ver, podeOrdenar) {
  const m = ver.mostrar;
  const data = m.data ? dataDe(item, hoje) : null;
  /* linha de baixo, como a da Lista: data e aviso, espaço, checklist e "não liberada", lado a lado */
  const meta = [
    data ? `<span class="prazo-tarefa ${data.tom}">${ICONES.barraTempo}<span>${data.texto}</span></span>` : "",
    avisoHtml(item),
    /* agrupado por espaço, o nome do espaço já está no título do grupo */
    m.espaco && ver.agrupar !== "espaco" ? `<span class="minhas-espaco">${esc(item.espacoNome)}</span>` : "",
    m.checklist && item.checklist ? `<span class="mt-checklist" title="Itens do checklist feitos">${ICONES.checklist}${item.checklist.feitos}/${item.checklist.total}</span>` : "",
    item.naoLiberada ? `<span class="mt-nao-liberada">${ICONES.naoLiberada}não liberada${item.aPartirDe ? `, a partir de ${minuscula(prazoDaTarefa(item.aPartirDe, hoje).texto)}` : ""}</span>` : "",
  ].join("");
  const deTarefas = ["quadro", "lista"].includes(item.tipo);
  return `<li class="mt-linha${item.naoLiberada ? " nao-liberada" : ""}" data-chave="${esc(item.chave)}">
    ${podeOrdenar ? `<button type="button" class="mt-puxador" data-puxar aria-label="Mudar a posição de ${esc(item.rotulo)}: arraste, ou use as setas para cima e para baixo" title="Arraste para mudar a ordem">${ICONES.puxador}</button>` : ""}
    <button type="button" class="caixa-concluida mt-concluir" data-concluir role="${deTarefas ? "checkbox" : "button"}"${deTarefas ? ' aria-checked="false"' : ""}
      aria-label="${deTarefas ? `Concluir ${esc(item.rotulo)}` : `Registrar a conclusão de ${esc(item.rotulo)}`}" title="${deTarefas ? "Marcar como concluída" : "Abrir para registrar a conclusão"}">${ICONES.marcado}</button>
    <div class="mt-texto">
      <button type="button" class="minhas-item" data-espaco="${esc(item.espacoId)}" data-numero="${item.numero}">
        <span class="minhas-nome">${esc(item.rotulo)}</span>
        ${m.descricao && item.descricao ? `<span class="mt-descricao">${esc(item.descricao.replace(/\s+/g, " "))}</span>` : ""}
      </button>
      ${meta ? `<span class="meta-tarefa mt-meta">${meta}</span>` : ""}
    </div>
  </li>`;
}

function grupoHtml(g, hoje, ver, podeOrdenar) {
  const lista = `<ul class="mt-itens" data-grupo="${esc(g.chave)}">${g.itens.map((i) => linhaHtml(i, hoje, ver, podeOrdenar)).join("")}</ul>`;
  if (!g.titulo) return `<section class="minhas-grupo mt-sem-titulo">${lista}</section>`;
  const recolhido = ver.exibir === "lista" && ver.recolhidos.includes(`${ver.agrupar}:${g.chave}`);
  const id = `grupo-${ver.agrupar}-${g.chave}`.replace(/[^A-Za-z0-9_-]/g, "-");
  return `<section class="minhas-grupo minhas-${esc(g.chave)}" aria-labelledby="${id}">
    <h2 id="${id}"><button type="button" class="mt-grupo-botao" data-recolher="${esc(g.chave)}" aria-expanded="${!recolhido}">${ICONES.abrir}<span class="mt-grupo-nome">${esc(g.titulo)}</span> <span class="n">${g.itens.length}</span></button></h2>
    <div class="mt-grupo-corpo"${recolhido ? " hidden" : ""}>${lista}</div>
  </section>`;
}

/* ---------- Filtros e exibição ---------- */
const segmentos = (atributo, opcoes, atual, rotulo) => `<div class="segmentos" role="group" aria-label="${rotulo}">${opcoes.map(([v, nome]) =>
  `<button type="button" ${atributo}="${v}" aria-pressed="${atual === v}">${nome}</button>`).join("")}</div>`;
const chave = (atributo, v, nome, ligado) => `<button class="opcao opcao-chave" type="button" role="switch" ${atributo}="${esc(v)}" aria-checked="${ligado}">
  <span class="opcao-texto">${nome}</span><span class="chave-visual" aria-hidden="true"></span></button>`;
function painelHtml(ver, espacos) {
  return `<div class="popover popover-painel mt-painel" data-popover role="dialog" aria-label="Filtros e exibição" style="--colunas: 3">
    <section class="painel-coluna" aria-label="Classificar"><h2>Classificar</h2>
      <h3>Ordenar por</h3>${segmentos("data-ordenar", [["minha", "Minha ordem"], ["data", "Data"]], ver.ordenar, "Ordenar por")}
      <h3>Agrupar por</h3>${segmentos("data-agrupar", [["nenhum", "Nenhum"], ["espaco", "Espaço"], ["prazo", "Prazo"]], ver.agrupar, "Agrupar por")}
      ${ver.ordenar === "minha" ? '<p class="tec">Arraste pelos seis pontos para mudar a ordem. Ela fica guardada na sua conta.</p>' : ""}
    </section>
    <section class="painel-coluna" aria-label="Filtrar"><h2>Filtrar</h2>
      <h3>Ocultar</h3><div class="opcoes-lista">${chave("data-ocultar", "naoLiberadas", "Não liberadas", ver.ocultarNaoLiberadas)}</div>
      ${espacos.length > 1 ? `<h3>Espaços</h3><div class="opcoes-lista">${espacos.map((e) =>
        chave("data-espaco-visivel", e.id, `${esc(e.nome)} <span class="n">${e.n}</span>`, !ver.espacosOcultos.includes(e.id))).join("")}</div>` : ""}
    </section>
    <section class="painel-coluna" aria-label="Exibir"><h2>Exibir</h2>
      <h3>Exibir como</h3>${segmentos("data-exibir", [["lista", "Lista"], ["colunas", "Colunas"]], ver.exibir, "Exibir como")}
      <h3>Mostrar na linha</h3><div class="opcoes-lista">
        ${chave("data-mostrar", "espaco", "Espaço", ver.mostrar.espaco)}
        ${chave("data-mostrar", "data", "Data", ver.mostrar.data)}
        ${chave("data-mostrar", "checklist", "Checklist", ver.mostrar.checklist)}
        ${chave("data-mostrar", "descricao", "Descrição", ver.mostrar.descricao)}</div>
      <h3>Densidade</h3>${segmentos("data-densidade", [["confortavel", "Confortável"], ["compacta", "Compacta"]], ver.densidade, "Densidade")}
    </section>
  </div>`;
}

/** Enquanto lê os espaços: blocos cinza (o título fica na barra do topo). */
export function mostrarCarregandoMinhas(alvo) {
  alvo.innerHTML = `<section class="minhas-tarefas">${esqueletoHtml("lista", 6)}</section>`;
}

/**
 * @param {HTMLElement} alvo
 * @param {{resultado: object, hoje: string, ver: object, barra: HTMLElement|null, podeOrdenar: boolean,
 *   aoAbrir: (espacoId: string, numero: number) => void, aoMudarVer: (ver: object) => void,
 *   aoMover: (chave: string, vizinhas: {depoisDe: string|null, antesDe: string|null}) => void,
 *   aoConcluir: (item: object, linha: HTMLElement) => void, painelAberto?: boolean}} opcoes
 * @returns {() => void} desliga a tela (tira os ouvintes do documento e esvazia a barra)
 */
export function mostrarMinhasTarefas(alvo, opcoes) {
  const { resultado, hoje, ver, barra, aoAbrir, aoMudarVer, aoMover, aoConcluir } = opcoes;
  const { grupos, total, espacos, avisos } = resultado;
  const podeOrdenar = opcoes.podeOrdenar && ver.ordenar === "minha";
  const itens = new Map(grupos.flatMap((g) => g.itens.map((i) => [i.chave, i])));
  const fora = foraDoPadrao(ver, espacos);
  const colunas = ver.exibir === "colunas";

  /* resumo discreto sob o título (23/11/2026): quantas de cada aviso, e o total */
  const resumo = [
    ...AVISOS.filter(([c]) => avisos[c]).map(([c, nome]) => `<span class="${c}">${avisos[c]} ${nome.toLowerCase()}</span>`),
    `<span>${total} ${plural(total, "tarefa", "tarefas")}</span>`,
  ].join('<span aria-hidden="true"> · </span>');
  alvo.innerHTML = `<section class="minhas-tarefas${colunas ? " em-colunas" : ""}${ver.densidade === "compacta" ? " compacta" : ""}">
    <h2 class="titulo-conteudo" data-titulo-conteudo>Meu trabalho</h2>
    ${total ? `<p class="mt-resumo">${resumo}</p>` : ""}
    ${fora.length ? `<div class="mt-fora">${fora.map((f) => `<span class="mt-fora-item">${esc(f)}</span>`).join("")}
      ${resultado.ocultas ? `<span class="mt-fora-item">${resultado.ocultas} ${plural(resultado.ocultas, "oculta", "ocultas")}</span>` : ""}
      <button type="button" class="botao-texto" data-limpar>Limpar</button></div>` : ""}
    ${total ? (grupos.length ? `<div class="mt-grupos">${grupos.map((g) => grupoHtml(g, hoje, ver, podeOrdenar)).join("")}</div>`
      : '<div class="minhas-vazio"><p><b>Nada à vista com estes filtros.</b></p><p>Use "Limpar" para ver todas as suas tarefas.</p></div>')
    : `<div class="minhas-vazio"><p><b>Nenhuma tarefa sua em aberto.</b></p>
        <p>Aqui aparecem as ações e tarefas em que você é responsável, de todos os espaços de que participa.</p></div>`}
  </section>`;
  const tela = alvo.querySelector(".minhas-tarefas");

  /* botão "Filtros e exibição" na barra do topo, à direita, como nos espaços */
  let painelAberto = Boolean(opcoes.painelAberto);
  const desenharBarra = ({ abriu = false } = {}) => {
    if (!barra) return;
    barra.innerHTML = `<div class="topo-direita mt-barra">
      <button class="menu-topo" type="button" data-painel-mt aria-expanded="${painelAberto}" aria-haspopup="dialog" title="Filtros e exibição">
        ${ICONES.filtros}<span class="menu-topo-nome">Filtros e exibição</span>${fora.length ? `<span class="contador" aria-label="${fora.length} ${plural(fora.length, "escolha", "escolhas")} fora do padrão">${fora.length}</span>` : ""}<span class="menu-topo-seta" aria-hidden="true">${ICONES.abrir}</span></button>
      ${painelAberto ? painelHtml(ver, espacos) : ""}
    </div>`;
    const pop = barra.querySelector("[data-popover]");
    if (abriu && pop && !reduzirMovimento()) pop.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: DURACAO, easing: CURVA });
  };
  desenharBarra();
  const mudar = (parcial) => aoMudarVer({ ...ver, ...parcial }, { painelAberto });
  const aoClicarNaBarra = (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches("[data-painel-mt]")) { painelAberto = !painelAberto; desenharBarra({ abriu: painelAberto }); if (painelAberto) barra.querySelector("[data-popover] button")?.focus({ preventScroll: true }); return; }
    if (t.dataset.ordenar) return mudar({ ordenar: t.dataset.ordenar });
    if (t.dataset.agrupar) return mudar({ agrupar: t.dataset.agrupar, ...(t.dataset.agrupar === "nenhum" && ver.exibir === "colunas" ? { exibir: "lista" } : {}) });
    /* colunas são os grupos: sem agrupamento, as colunas passam a ser os prazos */
    if (t.dataset.exibir) return mudar({ exibir: t.dataset.exibir, ...(t.dataset.exibir === "colunas" && ver.agrupar === "nenhum" ? { agrupar: "prazo" } : {}) });
    if (t.dataset.densidade) return mudar({ densidade: t.dataset.densidade });
    if (t.dataset.ocultar) return mudar({ ocultarNaoLiberadas: !ver.ocultarNaoLiberadas });
    if (t.dataset.mostrar) return mudar({ mostrar: { ...ver.mostrar, [t.dataset.mostrar]: !ver.mostrar[t.dataset.mostrar] } });
    if (t.dataset.espacoVisivel) {
      const id = t.dataset.espacoVisivel;
      return mudar({ espacosOcultos: ver.espacosOcultos.includes(id) ? ver.espacosOcultos.filter((x) => x !== id) : [...ver.espacosOcultos, id] });
    }
  };
  barra?.addEventListener("click", aoClicarNaBarra);
  /* fora do painel, ou Esc, fecha */
  const aoClicarFora = (e) => {
    if (!painelAberto || !barra || barra.contains(e.target)) return;
    painelAberto = false;
    desenharBarra();
  };
  const aoTeclar = (e) => {
    if (e.key !== "Escape") return;
    if (painelAberto) { painelAberto = false; desenharBarra(); barra?.querySelector("[data-painel-mt]")?.focus(); e.stopPropagation(); }
  };
  document.addEventListener("pointerdown", aoClicarFora, true);
  document.addEventListener("keydown", aoTeclar);

  /* cliques na lista: abrir, concluir, recolher grupo, limpar */
  tela.addEventListener("click", (e) => {
    if (e.target.closest("[data-limpar]")) {
      return mudar({ ordenar: VER_PADRAO.ordenar, agrupar: VER_PADRAO.agrupar, exibir: VER_PADRAO.exibir, ocultarNaoLiberadas: false, espacosOcultos: [] });
    }
    const rec = e.target.closest("[data-recolher]");
    if (rec) {
      if (colunas) return;
      const corpo = rec.closest(".minhas-grupo").querySelector(".mt-grupo-corpo");
      const k = `${ver.agrupar}:${rec.dataset.recolher}`;
      const abrir = corpo.hidden;
      rec.setAttribute("aria-expanded", String(abrir));
      ver.recolhidos = abrir ? ver.recolhidos.filter((x) => x !== k) : [...ver.recolhidos, k];
      gravarVer(ver);
      if (abrir) { corpo.hidden = false; abrirSuave(corpo); } else fecharSuave(corpo).then(() => { corpo.hidden = true; corpo.getAnimations().forEach((a) => a.cancel()); });
      return;
    }
    const concluir = e.target.closest("[data-concluir]");
    if (concluir) {
      const linha = concluir.closest(".mt-linha");
      const item = itens.get(linha.dataset.chave);
      if (item) aoConcluir(item, linha);
      return;
    }
    if (e.target.closest(".mt-aviso-caixa, [data-puxar], a")) return; // o aviso mostra a explicação (no foco), e não abre a ação
    /* a linha toda abre a ação, como na Lista de tarefas */
    const b = e.target.closest(".mt-linha")?.querySelector(".minhas-item");
    if (b) aoAbrir(b.dataset.espaco, Number(b.dataset.numero));
  });

  /* ---------- arrastar (minha ordem), só dentro do mesmo grupo ou coluna ---------- */
  const vizinhas = (li) => ({
    depoisDe: li.previousElementSibling?.dataset.chave ?? null,
    antesDe: li.nextElementSibling?.dataset.chave ?? null,
  });
  /** Desliza os irmãos do lugar antigo para o novo (técnica FLIP: anota, muda, inverte e anima). */
  const comFlip = (lista, mudar, exceto) => {
    const antes = new Map([...lista.children].filter((x) => x !== exceto).map((x) => [x, x.getBoundingClientRect().top]));
    mudar();
    if (reduzirMovimento()) return;
    for (const [x, topo] of antes) {
      const dy = topo - x.getBoundingClientRect().top;
      if (dy) x.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 180, easing: CURVA });
    }
  };
  let arr = null;
  tela.addEventListener("pointerdown", (e) => {
    const p = e.target.closest("[data-puxar]");
    if (!p || e.button > 0 || arr) return;
    e.preventDefault();
    const li = p.closest(".mt-linha");
    const lista = li.parentElement;
    const r = li.getBoundingClientRect();
    arr = { li, lista, p, id: e.pointerId, y0: e.clientY, dy: e.clientY - r.top, proximo: li.nextElementSibling, ativo: false };
    p.setPointerCapture?.(e.pointerId);
  });
  /* no documento, e não na tela: o puxador fica na margem, fora da coluna, e a captura se perde quando a linha muda de lugar */
  const aoMoverPonteiro = (e) => {
    if (!arr || e.pointerId !== arr.id) return;
    if (!arr.ativo) {
      if (Math.abs(e.clientY - arr.y0) < 4) return;
      arr.ativo = true;
      arr.li.classList.add("arrastando");
      document.body.classList.add("arrastando-mt");
    }
    /* posição de destino: antes do primeiro irmão cujo meio está abaixo do ponteiro */
    /* pela posição de layout (offsetTop), e não pela da tela: as irmãs ainda podem estar deslizando (FLIP) */
    const irmaos = [...arr.lista.children].filter((x) => x !== arr.li);
    const yNaLista = e.clientY - arr.lista.getBoundingClientRect().top;
    const base = arr.lista.firstElementChild?.offsetTop ?? 0;
    const alvoAntes = irmaos.find((x) => yNaLista < x.offsetTop - base + x.offsetHeight / 2) ?? null;
    if (alvoAntes !== arr.li.nextElementSibling) comFlip(arr.lista, () => arr.lista.insertBefore(arr.li, alvoAntes), arr.li);
    arr.li.style.transform = "none";
    const natural = arr.li.getBoundingClientRect().top;
    arr.li.style.transform = `translateY(${e.clientY - arr.dy - natural}px)`;
  };
  document.addEventListener("pointermove", aoMoverPonteiro);
  const soltar = (cancelar) => {
    if (!arr) return;
    const { li, lista, proximo, ativo } = arr;
    arr = null;
    document.body.classList.remove("arrastando-mt");
    if (!ativo) return;
    if (cancelar) comFlip(lista, () => lista.insertBefore(li, proximo), li);
    const desvio = li.style.transform;
    li.style.transform = "";
    li.classList.remove("arrastando");
    if (desvio && !reduzirMovimento()) li.animate([{ transform: desvio }, { transform: "none" }], { duration: 160, easing: CURVA });
    if (!cancelar && li.nextElementSibling !== proximo) aoMover(li.dataset.chave, vizinhas(li));
  };
  const aoSoltarPonteiro = (e) => { if (arr && e.pointerId === arr.id) soltar(e.type === "pointercancel"); };
  document.addEventListener("pointerup", aoSoltarPonteiro);
  document.addEventListener("pointercancel", aoSoltarPonteiro);
  const aoEscArrastando = (e) => { if (e.key === "Escape" && arr?.ativo) { e.stopPropagation(); soltar(true); } };
  document.addEventListener("keydown", aoEscArrastando, true);
  /* setas no puxador: uma posição para cima ou para baixo, dentro do grupo */
  tela.addEventListener("keydown", (e) => {
    const p = e.target.closest?.("[data-puxar]");
    if (!p || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const li = p.closest(".mt-linha");
    const lista = li.parentElement;
    const alvo = e.key === "ArrowUp" ? li.previousElementSibling : li.nextElementSibling?.nextElementSibling ?? null;
    if (e.key === "ArrowUp" && !alvo) return;
    if (e.key === "ArrowDown" && !li.nextElementSibling) return;
    comFlip(lista, () => lista.insertBefore(li, alvo), null);
    p.focus({ preventScroll: true });
    aoMover(li.dataset.chave, vizinhas(li));
  });

  return () => {
    document.removeEventListener("pointerdown", aoClicarFora, true);
    document.removeEventListener("keydown", aoTeclar);
    document.removeEventListener("keydown", aoEscArrastando, true);
    document.removeEventListener("pointermove", aoMoverPonteiro);
    document.removeEventListener("pointerup", aoSoltarPonteiro);
    document.removeEventListener("pointercancel", aoSoltarPonteiro);
    barra?.removeEventListener("click", aoClicarNaBarra);
    if (barra) barra.innerHTML = "";
  };
}
