/**
 * Modo "Rede" do espaço, o fluxo das ações (documentação técnica, seção 8.4; passo 1.17c, primeira versão).
 * Cada ação é um cartão; as setas ligam cada ação às que dependem dela. Colunas da esquerda
 * para a direita, na ordem em que as ações podem acontecer (regras em `js/rede.js`).
 * Interativa: passar o mouse num cartão destaca tudo o que vem antes e depois dele; clicar abre
 * a ação; em tela cheia, navegada como um editor de fluxo (11/11/2026: rolar move a rede; Ctrl + rolar, ou a pinça
 * do touchpad, dá zoom em volta do ponteiro, com transição suave; arrastar o fundo também move).
 * Posições mantidas (11/11/2026): enquanto a Rede está na tela, uma mudança feita nela só abre espaço; a arrumação
 * completa acontece ao abrir a Rede e pelo botão "Arrumar".
 * No celular (10/11/2026), só para consulta: arrastar move, a pinça aproxima e afasta, tocar numa ação a abre.
 * Níveis de detalhe (10/11/2026): afastando, o cartão mostra só o nome, em letra maior; mais longe, vira um bloco de cor.
 */
import { montarRede, abrirEspaco, caminhoDaSeta, MEDIDAS } from "../rede.js";
import { esc, dataBr, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { surgir, DURACAO as MOV_DURACAO, CURVA as MOV_CURVA } from "./movimento.js";

/**
 * @param {HTMLElement} alvo
 * @param {{acoes: object[], caminho: object, linhas: object[], etapaDe: Map<string, string>, identificador: (acao: object) => string,
 *   donos: (acao: object) => string, situacao: (linha: object) => string,
 *   marcos: {id: string, nome: string, titulo?: string}[]|null, escala: string, aoMudarEscala: (escala: string) => void}} dados
 *   linhas: as linhas da lista (lista.js), para as datas e situações já calculadas;
 *   donos e situacao: o mesmo desenho dos cartões do quadro (22/10/2026)
 */
/** Ajuste da altura ao redimensionar a janela: um só por vez, trocado a cada desenho. */
let aoRedimensionar = null;
/** Ctrl+Z na Rede (10/11/2026): um só ouvinte no documento, trocado a cada desenho. */
let aoTeclarDesfazer = null;
/** Régua das fases (13/11/2026): observa a barra do topo e a área da Rede; um só observador, trocado a cada desenho. */
let observadorDaRegua = null;
/**
 * Níveis de detalhe do cartão conforme o zoom (10/11/2026): "completo" de 60% para cima; "nome" de 35% a 60%
 * (só o nome, em letra maior); "cor" abaixo de 35% (bloco preenchido com a cor da situação, nome onde couber).
 */
export const DETALHE = Object.freeze({ nome: 0.6, cor: 0.35 });
export const nivelDeDetalhe = (fator) => (fator >= DETALHE.nome ? "completo" : fator >= DETALHE.cor ? "nome" : "cor");
/** Letra do nome nos níveis reduzidos: cerca de 10,5 px na tela, sem passar de 30 px no desenho. */
const LETRA_NA_TELA = 10.5;
const LETRA_MAXIMA = 30;

/**
 * Seleção na Rede (09/11/2026): sobrevive aos redesenhos que cada gravação provoca.
 * `{tipo: "no", numero}` ou `{tipo: "seta", de, para}`. `renomearAoDesenhar` é a ação recém-criada pelo "+",
 * que abre o nome para edição assim que aparece.
 */
let selecao = null;
let renomearAoDesenhar = null;
/** Renomear no desenho mais recente: a resposta do "+" pode chegar depois de um redesenho. */
let renomearNoAtual = () => false;
/** Depois do nome da ação recém-criada, abrir a caixinha de prazos (09/11/2026). */
let estimarDepois = false;
let abrirEstimativaNoAtual = () => {};
/**
 * Animação do rearranjo (09/11/2026): onde a próxima ação criada aparece (ponto do "+", nas coordenadas do desenho)
 * antes de deslizar até o lugar que a montagem lhe deu.
 */
let nascerEm = null;
/**
 * Arranjo que está na tela (11/11/2026): a coluna, a posição e a etapa de cada ação no último desenho. Serve para
 * manter as posições no desenho seguinte (`abrirEspaco`, em js/rede.js). `arrumarAgora` pede a arrumação completa.
 */
let arranjo = null;
let arrumarAgora = false;
const DURACAO = 420;
const CURVA = "cubic-bezier(.2, 0, 0, 1)";
const reduzirMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Caixa solta sobre a página (menu do botão direito, caixinha de prazos, escolha da etapa): uma por vez, fora do
 * desenho, para sobreviver aos redesenhos. Fecha com Esc, com clique fora ou quando a Rede some.
 * Usada também pelo Cronograma (10/11/2026), que é outro modo do mesmo espaço: só um dos dois está na tela.
 * @type {{el: HTMLElement, fechar: (motivo?: string) => void, posicionar: (el: HTMLElement) => void, rolagem: boolean}|null}
 */
let flutuante = null;
/** A caixa solta aberta, se houver (para quem a abriu de fora deste arquivo reposicioná-la ou fechá-la). */
export const flutuanteAberto = () => flutuante;
export function abrirFlutuante(html, { classe, posicionar, aoFechar = null, rotulo = "", papel = "dialog", fechaAoRolar = false }) {
  flutuante?.fechar("outra");
  const el = document.createElement("div");
  el.className = `rede-flutuante ${classe}`;
  el.setAttribute("role", papel);
  if (rotulo) el.setAttribute("aria-label", rotulo);
  el.innerHTML = html;
  document.body.append(el);
  const fora = (e) => { if (!el.contains(e.target)) fechar("fora"); };
  const tecla = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar("esc"); } };
  const fechar = (motivo) => {
    if (flutuante?.el !== el) return;
    flutuante = null;
    el.remove();
    document.removeEventListener("pointerdown", fora, true);
    document.removeEventListener("keydown", tecla, true);
    aoFechar?.(motivo);
  };
  document.addEventListener("pointerdown", fora, true);
  document.addEventListener("keydown", tecla, true);
  flutuante = { el, fechar, posicionar, rolagem: fechaAoRolar };
  posicionar(el);
  return el;
}
/** Põe a caixa no ponto (x, y) da tela, sem sair dela. */
export function colocar(el, x, y) {
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  el.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
}

/**
 * Animação do rearranjo (09/11/2026, pedido do responsável: o reposicionamento automático precisa ser visível):
 * cada cartão desliza da posição anterior para a nova; a ação recém-criada nasce pequena no ponto do "+" e cresce
 * até o seu lugar; cercas e círculos de início e término acompanham; setas e linhas das fases somem durante o
 * movimento e voltam no fim, já no traçado novo. Sem desenho anterior, ou com "Reduzir movimento", nada se anima.
 */
function animarRearranjo(caixa, { posAntes, caixasAntes }) {
  const nascer = nascerEm;
  nascerEm = null;
  if (!posAntes.size || reduzirMovimento()) return;
  const mexem = [];
  for (const el of caixa.querySelectorAll(".rede-no")) {
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    const antes = posAntes.get(el.dataset.numero);
    if (antes) {
      const [dx, dy] = [antes[0] - x, antes[1] - y];
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    } else {
      el.style.opacity = "0";
      if (nascer) el.style.transform = `translate(${nascer.x - x - el.offsetWidth / 2}px, ${nascer.y - y - el.offsetHeight / 2}px) scale(.3)`;
    }
    mexem.push(el);
  }
  for (const el of caixa.querySelectorAll("[data-anima]")) {
    const antes = caixasAntes.get(el.dataset.anima);
    if (!antes) { el.style.opacity = "0"; mexem.push(el); continue; }
    const novo = el.getAttribute("style");
    if (antes === novo) continue;
    el.dataset.estiloNovo = novo;
    el.setAttribute("style", antes);
    mexem.push(el);
  }
  if (!mexem.length) return;
  const linhas = [...caixa.querySelectorAll(".rede-setas, .rede-fase-marco")];
  for (const el of linhas) el.style.opacity = "0";
  void caixa.offsetWidth; // fixa o estado inicial antes da transição
  const trans = ["transform", "opacity", "left", "top", "width", "height"].map((p) => `${p} ${DURACAO}ms ${CURVA}`).join(", ");
  requestAnimationFrame(() => {
    for (const el of mexem) {
      if (el.dataset.estiloNovo != null) {
        el.setAttribute("style", `${el.dataset.estiloNovo};transition:${trans}`);
        delete el.dataset.estiloNovo;
      } else {
        el.style.transition = trans;
        el.style.transform = "";
        el.style.opacity = "";
      }
    }
    for (const el of linhas) { el.style.transition = `opacity 220ms ${CURVA} ${Math.round(DURACAO * 0.75)}ms`; el.style.opacity = ""; }
    setTimeout(() => { for (const el of [...mexem, ...linhas]) el.style.transition = ""; }, DURACAO + 320);
  });
}

/**
 * Responsáveis que não cabem no cartão (11/11/2026): pessoas e unidades somem do fim para o começo, até caber, e um
 * "+N" no fim diz quantos ficaram de fora, com os nomes na dica. A data do cartão nunca é coberta.
 */
function ajustarResponsaveis(raiz) {
  for (const caixa of raiz.querySelectorAll(".rede-base .donos")) {
    caixa.querySelector(".rede-mais-donos")?.remove();
    const selos = [...caixa.querySelectorAll(".avatar, .unidade")];
    for (const s of selos) s.hidden = false;
    if (selos.length < 2 || caixa.scrollWidth <= caixa.clientWidth + 1) continue;
    const mais = document.createElement("span");
    mais.className = "avatar mais rede-mais-donos";
    mais.setAttribute("role", "img");
    caixa.append(mais);
    for (let fora = 1; fora < selos.length; fora++) {
      selos[selos.length - fora].hidden = true;
      const nomes = selos.slice(selos.length - fora).map((s) => s.title).join(", ");
      mais.textContent = `+${fora}`;
      mais.title = nomes;
      mais.setAttribute("aria-label", `Mais ${fora}: ${nomes}`);
      if (caixa.scrollWidth <= caixa.clientWidth + 1) break;
    }
  }
}

/** Raio dos círculos de início e de término (27/10/2026). */
const RAIO = MEDIDAS.raioPonta;
/**
 * Cor da seta pelo índice de criticidade (12/11/2026, pedido do responsável): um só matiz, o violeta da barra do
 * índice, misturado ao fundo da Rede, sem passar pelo cinza. O piso (30%) deixa visível a seta de índice zero.
 */
const corDaSeta = (v) => `color-mix(in oklab, var(--execucao) ${Math.round(30 + 70 * v)}%, var(--rede-fundo))`;
/** Pontas de seta prontas: a da seta é a mais próxima do índice dela (diferença de até 2,5%, imperceptível). */
const PONTAS = 20;
/** Legenda da barra, conforme o indicador escolhido (12/11/2026). */
const amostra = (classe, largura) => `<i class="rede-leg-barra ${classe}"><b style="width:${largura}%"></b></i>`;
const legendaDaBarra = {
  execucao: `<span class="crono-legenda">${amostra("execucao", 70)}Quanto maior a barra, mais pesa no prazo</span>`,
  revisao: `<span class="crono-legenda">${amostra("revisao", 70)}Quanto maior a barra, mais pesa na incerteza do prazo</span>`,
};

export function desenharRede(alvo, { acoes: todas, caminho, linhas, etapaDe, identificador, donos, situacao, marcos: etapas = null, escala, aoMudarEscala,
  inicio = null, termino = null, prazoFinal = null, continuas = false, ocultarContinuas = false, aoOcultarContinuas = () => {}, edicao = null, nomeDaSituacao = () => "", nomeLiberada = "Liberada", toque = false,
  porCriticidade = false, aoArrumar = () => {}, indicador = "tempo", barra = () => "", legenda = true }) {
  /* ações contínuas (seção 5.9; 09/11/2026): caixa como as outras, com ligações tracejadas aos marcos; o filtro as esconde */
  const linhaDaAcao = new Map(linhas.map((l) => [l.acao.numero, l]));
  const temContinuas = continuas && todas.some((a) => linhaDaAcao.get(a.numero)?.continua);
  const acoes = temContinuas && ocultarContinuas ? todas.filter((a) => !linhaDaAcao.get(a.numero)?.continua) : todas;
  if (!acoes.length) {
    alvo.innerHTML = `<p class="lista-vazia">Este espaço ainda não tem ações. A rede aparece quando houver ações.</p>`;
    arranjo = null;
    return;
  }
  /*
   * Cercas e marcos (27/10/2026, pedido do responsável): as ações ficam nas colunas pelas dependências; cada etapa
   * ganha uma cerca em volta só dos seus cartões, com o nome no alto; cada fase, uma linha vertical onde termina.
   * Início e término entram na montagem como nós, para as linhas deles seguirem as mesmas regras das setas.
   */
  const opcoesDaRede = { pontas: true, continuas, ...(etapas ? { marcos: etapas, marcoDe: (a) => a.etapa } : {}) };
  /*
   * Posições mantidas (11/11/2026, pedido do responsável): com a Rede já na tela, a mudança só abre espaço (uma ação
   * nova empurra uma coluna para a direita; nada sobe nem desce). A arrumação completa acontece ao abrir a Rede e
   * pelo botão "Arrumar", que só aparece quando o desenho mantido difere do arrumado.
   */
  let desenho = null;
  let desarrumada = false;
  if (arranjo && !arrumarAgora && alvo.querySelector("[data-rede]")) {
    const fixos = abrirEspaco(arranjo, acoes, opcoesDaRede);
    if (fixos) {
      const arrumado = montarRede(acoes, caminho, opcoesDaRede);
      desarrumada = acoes.some((a) => arrumado.coluna.get(a.numero) !== fixos.get(a.numero).coluna
        || Math.abs(arrumado.pos.get(a.numero).y + MEDIDAS.altura / 2 - fixos.get(a.numero).y) > 1);
      desenho = desarrumada ? montarRede(acoes, caminho, { ...opcoesDaRede, fixos }) : arrumado;
    }
  }
  arrumarAgora = false;
  desenho ??= montarRede(acoes, caminho, opcoesDaRede);
  arranjo = { coluna: desenho.coluna, pos: desenho.pos, etapas: new Map(acoes.map((a) => [a.numero, a.etapa ?? null])) };
  const { pos, arestas, cercas, fases, pontas, topo, largura, altura, ligacoesContinuas } = desenho;
  const cercasHtml = cercas.map((c) => `<div class="rede-cerca" data-anima="cerca:${esc(c.id)}" style="left:${c.x}px;top:${c.y}px;width:${c.largura}px;height:${c.altura}px">
      <span class="rede-cerca-nome" title="${esc(c.titulo)}">${esc(c.nome)}</span></div>`).join("");
  /* fases em faixas (11/11/2026, como os milestones do Bizagi): uma linha onde cada fase termina; o nome fica numa
     régua fixa no alto da tela, centralizado no trecho visível da faixa (mais abaixo, `atualizarFases`) */
  const fasesHtml = [...new Set(fases.map((f) => f.x))].map((x) => `<div class="rede-fase-marco" style="left:${x}px;top:${topo}px;height:${altura - topo * 2}px"></div>`).join("");
  const reguaDasFases = fases.length ? `<div class="rede-fases-topo" data-fases-topo aria-hidden="true">${fases.map((f) => `<div class="rede-fase-faixa" data-x0="${f.x0}" data-x1="${f.x1}"><span class="rede-fase-nome" title="${esc(f.nome)}">${esc(f.nome)}</span></div>`).join("")}</div>` : "";

  const linhaDe = new Map(linhas.map((l) => [l.acao.numero, l]));

  /* cartões no padrão do quadro (22/10/2026): situação e nome, etapa, responsáveis e data */
  const cartoes = acoes.map((a) => {
    const { x, y } = pos.get(a.numero);
    const l = linhaDe.get(a.numero);
    const c = caminho.porAcao.get(a.numero);
    /* cor pelo índice de criticidade onde há simulação (11/11/2026); sem ela, pela folga zero */
    const classe = l.situacao === "concluida" ? "concluida" : l.continua ? "continua" : l.semEstimativa ? "sem-estimativa"
      : porCriticidade ? "indice" : c.critica ? "critica" : "folga";
    const indice = classe === "indice" ? Math.round((l.execucao ?? 0) * 100) : null;
    const data = l.situacao === "concluida" ? `Concluída ${dataBr(l.conclusao)}`
      : l.semEstimativa ? "Falta estimar" : l.conclusao ? `Até ${dataBr(l.conclusao)}` : "Sem data-limite";
    /* espaço com data-limite (passo 2.4b): sem caminho crítico, sem folga */
    const folga = l.continua && l.situacao !== "concluida" ? (l.podeEncerrar ? "pode ser encerrada" : "contínua")
      : l.situacao === "concluida" || l.semEstimativa || c.folga == null ? ""
      : c.critica ? "sem folga" : `folga ${Math.round(c.folga)} ${plural(Math.round(c.folga), "dia", "dias")}`;
    /* "agora" (10/11/2026): a ação liberada e ainda não concluída é a que pode ser feita neste momento */
    const agora = l.situacao === "liberada";
    const pilula = agora ? nomeDaSituacao(l) : "";
    const dica = `${etapaDe.get(a.etapa) ? `${etapaDe.get(a.etapa)}: ${a.rotulo}` : a.rotulo}${indice != null && l.execucao != null ? `\nÍndice de criticidade: ${indice}%` : ""}`;
    /* barra do indicador (12/11/2026, pedido do responsável): a mesma da lista e do quadro, escolhida no menu Indicador */
    const barraHtml = barra(l);
    return `<div class="rede-no ${classe}${agora ? " agora" : ""}" style="left:${x}px;top:${y}px;width:${MEDIDAS.largura}px;height:${MEDIDAS.altura}px" data-numero="${a.numero}" data-etapa="${esc(a.etapa ?? "")}"${indice != null ? ` data-indice="${indice}"` : ""}>
      <div class="rede-cartao" role="button" tabindex="0" data-abrir-acao data-rede-no="${a.numero}"
        title="${esc(dica)}">
        <span class="rede-topo">${situacao(l)}<span class="rede-rotulo">${identificador(a)}<span data-editar="rotulo">${esc(a.rotulo)}</span></span></span>
        <span class="rede-base"><span class="donos">${donos(a)}</span>
          <span class="rede-data${l.atrasada ? " atrasada" : ""}"><span class="mono">${l.atrasada ? `<span class="icone-atrasada">${ICONES.atrasada}</span>` : ""}${data}</span>${folga ? `<small>${folga}</small>` : ""}</span></span>
        <span class="rede-indicador" data-indicador="${indicador}">${barraHtml.replace(/^<div class="pr">|<\/div>$/g, "")}</span>
      </div>${pilula ? `<span class="rede-agora" aria-hidden="true"${edicao ? ` data-rede-situacao="${a.numero}" title="Mudar a situação"` : ""}>${esc(pilula)}</span>` : ""}${edicao ? `
      <button type="button" class="rede-abrir" data-rede-abrir="${a.numero}" title="Abrir a ${esc(edicao.nomeAcao)} (Enter)" aria-label="Abrir ${esc(a.rotulo)}">${ICONES.expandir}</button>
      ${edicao.podeCriar ? `<button type="button" class="rede-mais" data-rede-mais="${a.numero}" title="Criar a próxima ação, ligada a esta" aria-label="Criar a próxima ação depois de ${esc(a.rotulo)}">${ICONES.mais}</button>` : ""}
      <span class="rede-alca" data-rede-alca="${a.numero}" title="Arraste até outra ação para ligá-las"></span>` : ""}
    </div>`;
  }).join("");

  /* início e término (27/10/2026, pedido do responsável): círculos verdes e vermelhos com as datas */
  const circulo = (classe, { x: cx, y: cy }, rotulo, data, extra = "") => `<div class="rede-ponto ${classe}" data-anima="ponto:${classe}" style="left:${cx - RAIO}px;top:${cy - RAIO}px;width:${RAIO * 2}px;height:${RAIO * 2}px">
      <span class="rede-ponto-rotulo">${rotulo}</span><span class="rede-ponto-data mono">${data ? dataBr(data) : "—"}</span>${extra}</div>`;
  const pontosHtml = circulo("inicio", pontas.inicio, "Início", inicio)
    + circulo("termino", pontas.termino, "Término", termino, prazoFinal ? `<span class="rede-ponto-prazo">prazo ${dataBr(prazoFinal)}</span>` : "");

  /* seta pelo índice (11/11/2026): o menor índice entre as duas ações ligadas; é uma aproximação, porque o índice é
     calculado por ação, e não por ligação. Desde 12/11/2026 (pedido do responsável), sem graus nem cinza: a cor e a
     espessura variam de forma contínua, num só matiz (o violeta da barra), do claro ao forte */
  const indiceDe = (n) => { const l = linhaDe.get(n); return !l || l.situacao === "concluida" || l.continua || l.semEstimativa ? 0 : l.execucao ?? 0; };
  const indiceDaSeta = (de, para) => Math.min(indiceDe(de), indiceDe(para));
  const setasPeloIndice = porCriticidade && indicador === "execucao";
  const setas = arestas.map(({ de, para, critica, volta, ligacao, pontos, saltos }) => {
    if (ligacao) return `<path class="rede-ligacao" data-de="${de}" data-para="${para}" d="${caminhoDaSeta(pontos, saltos)}" marker-end="url(#rede-ponta)"/>`;
    /* só com o índice de criticidade no menu Indicador (12/11/2026, pedido do responsável); com os outros, setas
       uniformes: a contribuição para a incerteza é da ação e o tempo restante, da data, e não da ligação */
    const v = setasPeloIndice ? indiceDaSeta(de, para) : null;
    if (v == null && porCriticidade) return `<path class="rede-seta${volta ? " volta" : ""}" data-de="${de}" data-para="${para}"
      d="${caminhoDaSeta(pontos, saltos)}" marker-end="url(#rede-ponta)"/>${edicao ? `
      <path class="rede-seta-alvo" data-seta-de="${de}" data-seta-para="${para}" d="${caminhoDaSeta(pontos, saltos)}"><title>Clique para selecionar; Delete retira a ligação</title></path>` : ""}`;
    const [classe, ponta] = v != null ? [" indice", `-indice-${Math.round(v * PONTAS)}`] : [critica ? " critica" : "", critica ? "-critica" : ""];
    const estilo = v != null ? ` style="--seta-cor:${corDaSeta(v)};--seta-largura:${(1.2 + 1.4 * v).toFixed(2)}" data-indice="${Math.round(v * 100)}"` : "";
    return `<path class="rede-seta${classe}${volta ? " volta" : ""}" data-de="${de}" data-para="${para}"${estilo}
      d="${caminhoDaSeta(pontos, saltos)}" marker-end="url(#rede-ponta${ponta})"/>${edicao ? `
      <path class="rede-seta-alvo" data-seta-de="${de}" data-seta-para="${para}" d="${caminhoDaSeta(pontos, saltos)}"><title>Clique para selecionar; Delete retira a ligação</title></path>` : ""}`;
  }).join("")
    + ligacoesContinuas.map((g) => `<path class="rede-continua-ligacao ${g.lado}" data-continua="${g.continua}"${g.acao != null ? ` data-acao="${g.acao}"` : ""}
      d="M${g.pontos.map(([x, y]) => `${x},${y}`).join(" L")}" marker-end="url(#rede-ponta-continua)"/>`).join("");

  /* inserir entre duas ações (09/11/2026): um "+" no meio do trecho mais longo de cada seta */
  const meioDaSeta = (pontos) => {
    let melhor = null;
    for (let k = 1; k < pontos.length; k++) {
      const [[x0, y0], [x1, y1]] = [pontos[k - 1], pontos[k]];
      const tam = Math.hypot(x1 - x0, y1 - y0);
      if (!melhor || tam > melhor.tam) melhor = { tam, x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    }
    return melhor;
  };
  const insercoes = edicao?.podeCriar ? arestas.filter((a) => !a.ligacao).map(({ de, para, pontos }) => {
    const { x, y } = meioDaSeta(pontos);
    return `<button type="button" class="rede-inserir" data-inserir-de="${de}" data-inserir-para="${para}" style="left:${x}px;top:${y}px"
      title="Inserir uma ação entre estas duas" aria-label="Inserir uma ação entre a ${de} e a ${para}">${ICONES.mais}</button>`;
  }).join("") : "";

  const anterior = alvo.querySelector("[data-rede-rolagem]");
  const focoDentro = alvo.contains(document.activeElement);
  /* posições do desenho anterior, para animar o rearranjo (09/11/2026) */
  const posAntes = new Map([...alvo.querySelectorAll(".rede-no")].map((el) => [el.dataset.numero, [parseFloat(el.style.left), parseFloat(el.style.top)]]));
  const caixasAntes = new Map([...alvo.querySelectorAll("[data-anima]")].map((el) => [el.dataset.anima, el.getAttribute("style")]));
  const rolagemAnterior = anterior ? [anterior.scrollLeft, anterior.scrollTop] : null;
  /* ajuda em lista, um gesto por linha (10/11/2026) */
  const gestos = toque ? [
    ["Arraste", "move a rede"],
    ["Pinça com dois dedos", "aproxima e afasta"],
    ["Toque numa ação", "abre a ação"],
  ] : [
    ["Role (roda do mouse ou dois dedos)", "move a rede; com Shift, para os lados"],
    ["Ctrl + rolar, ou pinça no touchpad", "aproxima e afasta, em volta do ponteiro"],
    ["Arraste o fundo", "também move a rede"],
    ["Passe o mouse numa ação", "destaca o que vem antes e depois dela"],
    ...(edicao ? [
      ["Clique numa ação", "seleciona; aparecem os botões ao lado dela"],
      ["Clique nos responsáveis ou na data da ação selecionada", "muda só aquele campo, numa caixinha"],
      ["Botão de abrir, ou Enter", "abre a ação"],
      ...(edicao.podeCriar ? [["+ ao lado da ação", "cria a próxima, já ligada"], ["+ no meio de uma seta", "insere uma ação entre as duas"]] : []),
      ["Bolinha, arrastada até outra ação", "liga as duas"],
      ["Duplo clique", "muda o nome"],
      ["Clique numa seta e Delete", "retira a ligação"],
      ["Ctrl+Z", "desfaz a última mudança feita aqui"],
      ["Botão direito", "mostra as opções, com uma caixinha para cada campo"],
      ["Botão Arrumar", "aparece depois de uma mudança; reorganiza a rede inteira"],
    ] : [["Clique numa ação", "abre a ação"]]),
  ];
  const explicacao = `<p>Da esquerda para a direita, na ordem em que as ações podem acontecer.</p>
    <ul class="rede-gestos">${gestos.map(([g, r]) => `<li><b>${g}</b><span>${r}</span></li>`).join("")}</ul>`;
  /* Rede em tela cheia, como um mapa (09/11/2026, pedido do responsável): os controles flutuam sobre ela */
  const ajudaAberta = alvo.dataset.redeAjudaAberta === "1";
  /* a classe da edição é "rede-editavel", não "editavel": a regra genérica `.editavel` (campos de texto) dava à Rede um
     padding que empurrava o desenho 6 px e o descolava da régua das fases (12/11/2026) */
  alvo.innerHTML = `
    <div class="rede${edicao ? " rede-editavel" : ""}" data-rede tabindex="-1">
      <div class="rede-rolagem" data-rede-rolagem>
        <div class="rede-tamanho" data-tamanho>
          <div class="rede-conteudo" data-conteudo style="width:${largura}px;height:${altura}px">
            ${cercasHtml}${fasesHtml}
            <svg class="rede-setas" width="${largura}" height="${altura}" aria-hidden="true">
              <defs>
                <marker id="rede-ponta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker>
                <marker id="rede-ponta-critica" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker>
                ${setasPeloIndice ? Array.from({ length: PONTAS + 1 }, (_, k) => `<marker id="rede-ponta-indice-${k}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:${corDaSeta(k / PONTAS)}"/></marker>`).join("") : ""}
                <marker id="rede-ponta-continua" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6"><circle cx="4" cy="4" r="3"/></marker>
              </defs>
              ${setas}
            </svg>
            ${cartoes}
            ${pontosHtml}
            ${insercoes}
            ${edicao ? `<svg class="rede-ligando" width="${largura}" height="${altura}" aria-hidden="true"><path data-ligando d=""/></svg>` : ""}
          </div>
        </div>
      </div>
      ${reguaDasFases}
      <div class="rede-legenda rede-sobre"${legenda || temContinuas ? "" : " hidden"}>${legenda ? `
        ${legendaDaBarra[indicador] ?? ""}
        ${setasPeloIndice ? `<span class="crono-legenda"><i class="rede-leg-indice"></i>Quanto mais forte a seta, mais pesa no prazo <a href="#" class="oque" data-termo="exec">o que é?</a></span>`
    : porCriticidade ? "" : `<span class="crono-legenda"><i class="rede-leg-seta-critica"></i>Sem folga <a href="#" class="oque" data-termo="folga">o que é?</a></span>`}
        <span class="crono-legenda rede-leg-icone">${ICONES.concluida}Concluída</span>
        <span class="crono-legenda"><i class="rede-leg-agora"></i>${esc(nomeLiberada)}: pode ser feita agora</span>
        <span class="crono-legenda rede-leg-icone">${ICONES.naoLiberada}Espera outra ação</span>
        ${cercas.length ? `<span class="crono-legenda"><i class="rede-leg-etapa"></i>Etapa</span>` : ""}
        ${fases.length ? `<span class="crono-legenda"><i class="rede-leg-fase"></i>Fim da fase</span>` : ""}
        ${temContinuas && !ocultarContinuas ? `<span class="crono-legenda"><i class="continua"></i>Contínua <a href="#" class="oque" data-termo="continua">o que é?</a></span>` : ""}` : "" /* legenda desligada em Exibir (12/11/2026): fica só o botão das contínuas */}
        ${temContinuas ? `<button type="button" class="rede-legenda-botao" data-ocultar-continuas aria-pressed="${ocultarContinuas}">${ocultarContinuas ? "Mostrar ações contínuas" : "Ocultar ações contínuas"}</button>` : ""}
      </div>
      <div class="rede-ajuda rede-sobre" data-rede-ajuda-cartao${ajudaAberta ? "" : " hidden"}>
        ${explicacao}
        <p class="tec">Termo técnico: diagrama de rede PERT/CPM (<a href="#" class="oque" data-termo="rede">o que é?</a>).</p>
      </div>
      <div class="rede-controles" data-rede-controles>
        ${edicao ? `<button type="button" class="rede-controle rede-sobre redondo" data-rede-desfazer title="Desfazer a última mudança (Ctrl+Z)" aria-label="Desfazer a última mudança"${edicao.podeDesfazer() ? "" : " hidden"}>${ICONES.desfazer}</button>` : ""}
        ${edicao ? `<button type="button" class="rede-controle rede-sobre rede-arrumar" data-rede-arrumar title="Arrumar a rede: reorganiza todas as ações" aria-label="Arrumar a rede"${desarrumada ? "" : " hidden"}>${ICONES.arrumar}<span>Arrumar</span></button>` : ""}
        <button type="button" class="rede-controle rede-sobre redondo" data-rede-ajuda aria-expanded="${ajudaAberta}" title="Como usar a rede" aria-label="Como usar a rede">${ICONES.ajuda}</button>
        <div class="rede-controles-grupo rede-sobre" role="group" aria-label="Zoom">
          <button type="button" class="rede-controle" data-zoom-passo="1" title="Aproximar (Ctrl + rolar)" aria-label="Aproximar">${ICONES.mais}</button>
          <button type="button" class="rede-controle rede-zoom-valor mono" data-escala="normal" data-zoom-valor title="Voltar ao tamanho normal (100%)"></button>
          <button type="button" class="rede-controle" data-zoom-passo="-1" title="Afastar (Ctrl + rolar)" aria-label="Afastar">${ICONES.menos}</button>
        </div>
        <button type="button" class="rede-controle rede-sobre" data-escala="tudo" title="Ajustar à tela: ver a rede inteira" aria-label="Ajustar à tela">${ICONES.enquadrar}</button>
      </div>
    </div>`;

  /* ---------- navegação (09/11/2026: Rede em tela cheia; 11/11/2026, pedido do responsável: a regra dos editores de
     fluxo, igual para mouse e touchpad, sem adivinhar o aparelho): a Rede ocupa a tela inteira, por trás da barra do
     topo; rolar move a vista (com Shift, para os lados); Ctrl + rolar, que é como a pinça do touchpad chega ao
     navegador, aproxima e afasta em volta do ponteiro, com transição suave; arrastar o fundo também move a vista. Em volta do desenho há uma margem livre (70% da área visível de cada lado),
     para que qualquer parte da rede possa ser trazida para o meio da tela, longe dos controles flutuantes.
     "Ajustar à tela" cabe o desenho na área que os controles deixam livre; o valor em % volta a 100% ---------- */
  const rolagem = alvo.querySelector("[data-rede-rolagem]");
  const tamanho = alvo.querySelector("[data-tamanho]");
  const conteudo = alvo.querySelector("[data-conteudo]");
  const valor = alvo.querySelector("[data-zoom-valor]");
  const MAX = 2.5;
  if (aoRedimensionar) removeEventListener("resize", aoRedimensionar);
  aoRedimensionar = null;
  let mx = 0;
  let my = 0;
  const fasesTopo = alvo.querySelector("[data-fases-topo]");
  const REGUA = 26;
  /* área livre: o que sobra da tela tirando a barra do topo, o título, a legenda e os botões */
  const areaLivre = () => {
    const v = rolagem.getBoundingClientRect();
    let topo = 0;
    for (const el of [document.querySelector(".topo"), document.querySelector("#principal .titulo-conteudo"), document.querySelector("#principal .cabeca-espaco")]) {
      if (!el || !el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      if (r.height) topo = Math.max(topo, r.bottom - v.top);
    }
    const caixaLegenda = alvo.querySelector(".rede-legenda");
    const legenda = caixaLegenda.hidden ? { top: v.bottom } : caixaLegenda.getBoundingClientRect();
    const controles = alvo.querySelector("[data-rede-controles]").getBoundingClientRect();
    const folga = 24;
    /* a régua das fases fica logo abaixo do título e conta como área ocupada */
    return { l: folga, t: topo + folga + (fasesTopo ? REGUA : 0), r: v.right - controles.left + folga, b: v.bottom - legenda.top + folga, w: v.width, h: v.height, regua: topo + 6 };
  };
  const caber = () => {
    const a = areaLivre();
    return Math.min(1, (a.w - a.l - a.r) / largura, (a.h - a.t - a.b) / altura);
  };
  const MIN = Math.min(0.2, caber());
  const medir = () => {
    mx = Math.round(rolagem.clientWidth * 0.7);
    my = Math.round(rolagem.clientHeight * 0.7);
    conteudo.style.left = `${mx}px`;
    conteudo.style.top = `${my}px`;
    if (fasesTopo) fasesTopo.style.top = `${areaLivre().regua}px`;
  };
  /* a régua acompanha a altura da barra do topo (13/11/2026, defeito relatado pelo responsável): antes, a posição era
     medida só ao abrir a Rede; mostrar ou esconder o nome do espaço (botão direito na barra) ou mudar a largura da
     janela mudava a altura da barra, e a régua ficava escondida atrás dela ou com um vão grande embaixo */
  observadorDaRegua?.disconnect();
  observadorDaRegua = null;
  if (fasesTopo && typeof ResizeObserver === "function") {
    observadorDaRegua = new ResizeObserver(() => {
      if (!fasesTopo.isConnected) { observadorDaRegua?.disconnect(); return; }
      fasesTopo.style.top = `${areaLivre().regua}px`;
      atualizarFases();
    });
    for (const el of [document.querySelector(".topo"), document.querySelector("#principal .titulo-conteudo"), document.querySelector("#principal .cabeca-espaco"), rolagem]) {
      if (el) observadorDaRegua.observe(el);
    }
  }
  /* régua das fases: cada nome fica no meio do trecho da sua faixa que está na tela, sempre à vista */
  const atualizarFases = () => {
    if (!fasesTopo) return;
    const w = rolagem.clientWidth;
    for (const el of fasesTopo.children) {
      const l = mx + Number(el.dataset.x0) * fator - rolagem.scrollLeft;
      const r = mx + Number(el.dataset.x1) * fator - rolagem.scrollLeft;
      const [a, b] = [Math.max(l, 0), Math.min(r, w)];
      el.hidden = b - a < 28;
      if (el.hidden) continue;
      el.style.left = `${l}px`;
      el.style.width = `${r - l}px`;
      el.firstElementChild.style.maxWidth = `${b - a - 16}px`;
      el.firstElementChild.style.left = `${(a + b) / 2 - l}px`;
    }
  };
  let fator = alvo.dataset.redeZoom ? Number(alvo.dataset.redeZoom) : 1;
  let donosAjustados = false;
  /* põe o zoom em `f`, com o ponto (px, py) do desenho no ponto (cx, cy) da área visível */
  const por = (f, px, py, cx, cy) => {
    fator = f;
    conteudo.style.transform = fator !== 1 ? `scale(${fator})` : "";
    tamanho.style.width = `${largura * fator + mx * 2}px`;
    tamanho.style.height = `${altura * fator + my * 2}px`;
    rolagem.scrollLeft = mx + px * fator - cx;
    rolagem.scrollTop = my + py * fator - cy;
    valor.textContent = `${Math.round(fator * 100)}%`;
    atualizarFases();
    /* nível de detalhe (10/11/2026): a letra do nome cresce no desenho para ficar legível na tela */
    const nivel = nivelDeDetalhe(fator);
    const redeEl = alvo.querySelector("[data-rede]");
    redeEl.dataset.detalhe = nivel;
    const letra = Math.min(LETRA_MAXIMA, LETRA_NA_TELA / fator);
    redeEl.style.setProperty("--rede-letra", `${letra.toFixed(1)}px`);
    redeEl.style.setProperty("--rede-linhas", String(Math.max(1, Math.floor((MEDIDAS.altura - 12 - 8 * Math.min(1.8, Math.max(1, 1 / fator)) - 6) / (letra * 1.15)))));
    /* botões do cartão (abrir, +, bolinha, + da seta) não encolhem junto: até 1,8 vez no desenho */
    redeEl.style.setProperty("--rede-inv", String(Math.min(1.8, Math.max(1, 1 / fator)).toFixed(3)));
    /* responsáveis que não cabem viram "+N" (11/11/2026); medido na primeira vez em que o cartão aparece completo */
    if (nivel === "completo" && !donosAjustados) { donosAjustados = true; ajustarResponsaveis(redeEl); }
  };
  const limitar = (f) => Math.min(MAX, Math.max(MIN, f));
  const pontoSob = (cx, cy) => ({ x: (rolagem.scrollLeft + cx - mx) / fator, y: (rolagem.scrollTop + cy - my) / fator });
  const aplicar = (novo, cx = rolagem.clientWidth / 2, cy = rolagem.clientHeight / 2) => {
    const p = pontoSob(cx, cy); // ponto da rede sob o ponteiro
    por(limitar(novo), p.x, p.y, cx, cy);
  };
  /*
   * Zoom com transição suave (11/11/2026, pedido do responsável: como no Google Maps): o zoom vai do valor atual ao
   * de destino em `duracao` ms, desacelerando no fim; o ponto `ate` do desenho (ou o que já estava sob (cx, cy))
   * termina em (cx, cy). Um pedido novo durante a transição parte de onde ela está. Com "Reduzir movimento", de uma vez.
   */
  let voo = 0;
  let destino = fator;
  const parar = () => { if (voo) cancelAnimationFrame(voo); voo = 0; destino = fator; };
  const voar = (novo, cx, cy, ate = null, duracao = 170) => {
    const f1 = limitar(novo);
    if (voo) cancelAnimationFrame(voo);
    voo = 0;
    const f0 = fator;
    const p0 = pontoSob(cx, cy);
    const p1 = ate ?? p0;
    destino = f1;
    alvo.dataset.redeZoom = String(f1);
    if (reduzirMovimento() || (Math.abs(f1 - f0) < 0.0005 && Math.hypot(p1.x - p0.x, p1.y - p0.y) * f0 < 1)) return por(f1, p1.x, p1.y, cx, cy);
    const t0 = performance.now();
    const passo = (agora) => {
      const t = Math.min(1, Math.max(0, (agora - t0) / duracao));
      const k = 1 - (1 - t) ** 3;
      por(t < 1 ? f0 * (f1 / f0) ** k : f1, p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k, cx, cy);
      voo = t < 1 ? requestAnimationFrame(passo) : 0;
    };
    voo = requestAnimationFrame(passo);
  };
  /* põe o desenho na área livre: centrado (ajustar) ou encostado no canto de cima, à esquerda (100%) */
  const enquadrar = (centrar) => {
    const a = areaLivre();
    rolagem.scrollLeft = centrar ? mx + (largura * fator) / 2 - (a.l + (a.w - a.l - a.r) / 2) : mx - a.l;
    rolagem.scrollTop = centrar ? my + (altura * fator) / 2 - (a.t + (a.h - a.t - a.b) / 2) : my - a.t;
  };
  const zoomLivre = (novo, cx, cy) => {
    parar();
    aplicar(novo, cx, cy);
    destino = fator;
    alvo.dataset.redeZoom = String(fator);
  };
  medir();
  if (rolagemAnterior && alvo.dataset.redeZoom) {
    aplicar(fator, 0, 0);
    [rolagem.scrollLeft, rolagem.scrollTop] = rolagemAnterior;
  } else {
    /* a Rede abre com o plano inteiro na tela (10/11/2026); no celular, sem descer de 50%, a partir do início */
    const inteiro = escala === "tudo" && !(toque && caber() < 0.5);
    if (escala === "tudo") fator = toque ? Math.max(0.5, caber()) : caber();
    aplicar(fator, 0, 0);
    enquadrar(inteiro);
    if (escala === "tudo" && !inteiro) { const a = areaLivre(); rolagem.scrollTop = my + (altura * fator) / 2 - (a.t + (a.h - a.t - a.b) / 2); }
    alvo.dataset.redeZoom = String(fator);
  }
  alvo.dataset.redeEscala = escala;
  destino = fator;

  /* rolar move a rede (rolagem do próprio navegador, em qualquer direção; com Shift, para os lados);
     Ctrl (ou Cmd) + rolar, e a pinça do touchpad, aproximam e afastam em volta do ponteiro */
  rolagem.addEventListener("wheel", (e) => {
    const pixels = (d) => (e.deltaMode === 1 ? d * 33 : e.deltaMode === 2 ? d * 800 : d);
    if (!(e.ctrlKey || e.metaKey)) {
      parar();
      if (e.shiftKey && !e.deltaX && e.deltaY) { e.preventDefault(); rolagem.scrollLeft += pixels(e.deltaY); }
      return;
    }
    e.preventDefault();
    const r = rolagem.getBoundingClientRect();
    /* a pinça manda passos pequenos e muitos; a roda, passos grandes e poucos */
    const passo = pixels(e.deltaY);
    voar(destino * Math.exp(-passo * (Math.abs(passo) < 40 ? 0.01 : 0.0022)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  rolagem.addEventListener("scroll", atualizarFases, { passive: true });
  /* arrastar o fundo (fora dos cartões) move a rede; um arrasto não conta como clique no fundo */
  let moveuFundo = false;
  rolagem.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return; // no toque, o próprio navegador rola a rede
    if ((e.button !== 0 && e.button !== 1) || e.target.closest("[data-rede-no], [data-rede-mais], [data-rede-abrir], [data-rede-alca], [data-rede-situacao], .rede-seta-alvo, [data-inserir-de]")) return;
    if (e.button === 1) e.preventDefault(); // botão do meio também arrasta, sem a rolagem automática do navegador
    parar();
    const inicio = { x: e.clientX, y: e.clientY, l: rolagem.scrollLeft, t: rolagem.scrollTop };
    rolagem.setPointerCapture(e.pointerId);
    rolagem.classList.add("arrastando");
    moveuFundo = false;
    const mover = (ev) => { if (Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > 3) moveuFundo = true; rolagem.scrollLeft = inicio.l - (ev.clientX - inicio.x); rolagem.scrollTop = inicio.t - (ev.clientY - inicio.y); };
    const soltar = () => {
      rolagem.classList.remove("arrastando");
      rolagem.removeEventListener("pointermove", mover);
      rolagem.removeEventListener("pointerup", soltar);
      rolagem.removeEventListener("pointercancel", soltar);
    };
    rolagem.addEventListener("pointermove", mover);
    rolagem.addEventListener("pointerup", soltar);
    rolagem.addEventListener("pointercancel", soltar);
  });

  /* pinça com dois dedos (10/11/2026): aproxima e afasta em volta do meio dos dedos */
  let pinca = null;
  const dedos = (e) => {
    const [a, b] = e.touches;
    const r = rolagem.getBoundingClientRect();
    return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2 - r.left, y: (a.clientY + b.clientY) / 2 - r.top };
  };
  rolagem.addEventListener("touchstart", (e) => { pinca = e.touches.length === 2 ? { ...dedos(e), fator } : null; }, { passive: true });
  rolagem.addEventListener("touchmove", (e) => {
    if (!pinca || e.touches.length !== 2) return;
    e.preventDefault();
    const agora = dedos(e);
    zoomLivre(pinca.fator * (agora.d / pinca.d), agora.x, agora.y);
  }, { passive: false });
  rolagem.addEventListener("touchend", () => { pinca = null; }, { passive: true });

  /* legenda flutuante: mostrar ou ocultar as ações contínuas */
  alvo.querySelector(".rede-legenda").onclick = (e) => {
    if (e.target.closest("[data-ocultar-continuas]")) aoOcultarContinuas(!ocultarContinuas);
  };
  /* botões flutuantes: + e − em volta do centro da área livre; % volta a 100%; os cantos ajustam à tela; ? explica */
  alvo.querySelector("[data-rede-controles]").onclick = (e) => {
    const z = e.target.closest("[data-zoom-passo]");
    const a = areaLivre();
    const [cx, cy] = [a.l + (a.w - a.l - a.r) / 2, a.t + (a.h - a.t - a.b) / 2];
    if (z) return voar(destino * (Number(z.dataset.zoomPasso) > 0 ? 1.25 : 1 / 1.25), cx, cy, null, 220);
    if (e.target.closest("[data-rede-desfazer]")) return edicao?.desfazer();
    if (e.target.closest("[data-rede-arrumar]")) { arrumarAgora = true; return aoArrumar(); }
    const ajuda = e.target.closest("[data-rede-ajuda]");
    if (ajuda) {
      const cartao = alvo.querySelector("[data-rede-ajuda-cartao]");
      const abrir = cartao.hidden;
      if (abrir) { cartao.hidden = false; surgir(cartao); }
      else if (reduzirMovimento()) cartao.hidden = true;
      else cartao.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(3px)" }], { duration: MOV_DURACAO, easing: MOV_CURVA }).finished.then(() => { cartao.hidden = true; }, () => {});
      ajuda.setAttribute("aria-expanded", String(abrir));
      alvo.dataset.redeAjudaAberta = abrir ? "1" : "";
      return;
    }
    const b = e.target.closest("[data-escala]");
    if (!b) return;
    /* ajustar: o meio do desenho no meio da área livre; 100%: o canto de cima, à esquerda, no canto da área livre */
    if (b.dataset.escala === "tudo") voar(caber(), cx, cy, { x: largura / 2, y: altura / 2 }, 320);
    else voar(1, cx, cy, { x: cx - a.l, y: cy - a.t }, 320);
  };
  /* ---------- destaque: tudo o que vem antes e depois da ação apontada ---------- */
  const antes = new Map(acoes.map((a) => [a.numero, []]));
  const depois = new Map(acoes.map((a) => [a.numero, []]));
  for (const { de, para, ligacao } of arestas) if (!ligacao) { antes.get(para).push(de); depois.get(de).push(para); }
  const alcance = (inicio, mapa) => {
    const vistos = new Set();
    const pilha = [...mapa.get(inicio)];
    while (pilha.length) {
      const n = pilha.pop();
      if (vistos.has(n)) continue;
      vistos.add(n);
      pilha.push(...mapa.get(n));
    }
    return vistos;
  };
  const caixa = alvo.querySelector("[data-rede]");
  const limpar = () => {
    caixa.classList.remove("destacando");
    for (const el of caixa.querySelectorAll(".ligada, .apontada")) el.classList.remove("ligada", "apontada");
  };
  const destacar = (numero) => {
    limpar();
    const cadeia = new Set([numero, ...alcance(numero, antes), ...alcance(numero, depois)]);
    caixa.classList.add("destacando");
    for (const n of cadeia) caixa.querySelector(`.rede-no[data-numero="${n}"]`)?.classList.add(n === numero ? "apontada" : "ligada");
    for (const s of caixa.querySelectorAll(".rede-seta")) {
      if (cadeia.has(Number(s.dataset.de)) && cadeia.has(Number(s.dataset.para))) s.classList.add("ligada");
    }
    /* contínua apontada: as ligações e as ações que são marcos; ação apontada: as contínuas que a têm como marco */
    for (const g of caixa.querySelectorAll(".rede-continua-ligacao")) {
      const da = Number(g.dataset.continua) === numero;
      if (!da && Number(g.dataset.acao) !== numero) continue;
      g.classList.add("ligada");
      const outro = da ? g.dataset.acao : g.dataset.continua;
      if (outro) caixa.querySelector(`.rede-no[data-numero="${outro}"]`)?.classList.add("ligada");
    }
  };
  caixa.addEventListener("pointerover", (e) => {
    const no = e.target.closest("[data-rede-no]");
    if (no) destacar(Number(no.dataset.redeNo));
  });
  caixa.addEventListener("pointerout", (e) => {
    if (e.target.closest("[data-rede-no]") && !e.relatedTarget?.closest?.("[data-rede-no]")) limpar();
  });
  caixa.addEventListener("focusin", (e) => {
    const no = e.target.closest("[data-rede-no]");
    if (no) destacar(Number(no.dataset.redeNo));
  });
  caixa.addEventListener("focusout", limpar);

  /* Ctrl+Z (ou Cmd+Z) desfaz a última mudança feita na Rede (10/11/2026); fora de campos de texto e de janelas abertas */
  if (aoTeclarDesfazer) document.removeEventListener("keydown", aoTeclarDesfazer);
  aoTeclarDesfazer = edicao ? (e) => {
    if (!document.body.contains(caixa)) { document.removeEventListener("keydown", aoTeclarDesfazer); aoTeclarDesfazer = null; return; }
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") return;
    if (e.target.closest?.("input, textarea, select, [contenteditable], [data-editando], .camada, .rede-flutuante")) return;
    if (!edicao.podeDesfazer()) return;
    e.preventDefault();
    edicao.desfazer();
  } : null;
  if (aoTeclarDesfazer) document.addEventListener("keydown", aoTeclarDesfazer);

  animarRearranjo(caixa, { posAntes, caixasAntes });
  if (!edicao) flutuante?.fechar("redesenho");
  if (edicao) ativarEdicao({ acoes, etapas, caixa, rolagem, conteudo, fator: () => fator, edicao, destacar, limpar, focoDentro, moveuFundo: () => moveuFundo });
}

/**
 * Edição dentro da Rede (09/11/2026, pedido do responsável; documentação técnica, seção 8.4).
 * Clique seleciona (não abre); duplo clique ou F2 renomeia; Enter abre a ação; o "+" cria a próxima ação, já
 * ligada e com o nome aberto para digitar; a bolinha, arrastada até outro cartão, cria a dependência; uma seta
 * selecionada sai com Delete. Esc tira a seleção.
 */
function ativarEdicao({ acoes, etapas, caixa, rolagem, conteudo, fator, edicao, destacar, limpar, focoDentro, moveuFundo }) {
  const no = (n) => caixa.querySelector(`.rede-no[data-numero="${n}"]`);
  const seta = (de, para) => caixa.querySelector(`.rede-seta[data-de="${de}"][data-para="${para}"]`);
  const inserir = (de, para) => caixa.querySelector(`[data-inserir-de="${de}"][data-inserir-para="${para}"]`);
  const marcar = () => {
    for (const el of caixa.querySelectorAll(".selecionada")) el.classList.remove("selecionada");
    if (selecao?.tipo === "no") no(selecao.numero)?.classList.add("selecionada");
    if (selecao?.tipo === "seta") {
      seta(selecao.de, selecao.para)?.classList.add("selecionada");
      inserir(selecao.de, selecao.para)?.classList.add("selecionada");
    }
    if (selecao && !caixa.querySelector(".selecionada")) selecao = null; // sumiu depois de uma mudança
    caixa.classList.toggle("com-selecao", Boolean(selecao));
  };
  const selecionarNo = (n, focar = true) => {
    selecao = { tipo: "no", numero: n };
    marcar();
    if (focar) no(n)?.querySelector("[data-rede-no]")?.focus({ preventScroll: true });
  };
  const selecionarSeta = (de, para) => { selecao = { tipo: "seta", de, para }; marcar(); caixa.focus({ preventScroll: true }); };
  const desmarcar = () => { selecao = null; marcar(); };
  /* traz o cartão para dentro da área visível, se estiver fora */
  const mostrar = (n) => {
    const el = no(n);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const v = rolagem.getBoundingClientRect();
    const folga = 40;
    if (r.right > v.right - folga) rolagem.scrollLeft += r.right - v.right + folga;
    else if (r.left < v.left + folga) rolagem.scrollLeft -= v.left + folga - r.left;
    if (r.bottom > v.bottom - folga) rolagem.scrollTop += r.bottom - v.bottom + folga;
    else if (r.top < v.top + folga) rolagem.scrollTop -= v.top + folga - r.top;
  };
  /* com `depois`, abre a caixinha de prazos quando o nome termina (menos com Esc, que desiste) */
  const renomear = (n, depois = false) => {
    const campo = no(n)?.querySelector('[data-editar="rotulo"]');
    if (!campo) return false;
    selecionarNo(n, false);
    setTimeout(() => mostrar(n), reduzirMovimento() ? 0 : DURACAO + 40); // depois do deslize
    edicao.renomear(campo);
    if (depois && edicao.usaEstimativas) {
      let desistiu = false;
      campo.addEventListener("keydown", (e) => { if (e.key === "Escape") desistiu = true; });
      campo.addEventListener("focusout", () => { if (!desistiu) setTimeout(() => abrirEstimativaNoAtual(n), 80); }, { once: true });
    }
    return true;
  };
  /* ponto de um botão nas coordenadas do desenho: de onde a ação nova nasce */
  const pontoDe = (botao) => {
    const r = botao.getBoundingClientRect();
    const b = conteudo.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - b.left) / fator(), y: (r.top + r.height / 2 - b.top) / fator() };
  };

  /* depois de criar pelo "+" (no cartão ou na seta): a nova fica selecionada, com o nome aberto */
  const criarE = (botao, criar) => {
    nascerEm = pontoDe(botao);
    botao.disabled = true;
    criar().then((numero) => {
      botao.disabled = false;
      if (numero == null) { nascerEm = null; return; }
      /* o redesenho pode chegar antes ou depois da resposta */
      if (!renomearNoAtual(numero, true)) { renomearAoDesenhar = numero; estimarDepois = true; selecao = { tipo: "no", numero }; }
    });
  };
  renomearNoAtual = renomear;
  abrirEstimativaNoAtual = abrirEstimativa;
  marcar();
  if (renomearAoDesenhar != null && renomear(renomearAoDesenhar, estimarDepois)) { renomearAoDesenhar = null; estimarDepois = false; }
  else if (focoDentro && selecao?.tipo === "no") no(selecao.numero)?.querySelector("[data-rede-no]")?.focus({ preventScroll: true });
  else if (focoDentro && selecao?.tipo === "seta") caixa.focus({ preventScroll: true });

  /* a ação que já estava selecionada antes do toque: nela, o clique num campo abre a caixinha desse campo */
  let selecionadaAntes = null;
  caixa.addEventListener("pointerdown", () => { selecionadaAntes = selecao?.tipo === "no" ? selecao.numero : null; }, true);
  /* cliques: na fase de captura, para que o clique num cartão selecione em vez de abrir a janela */
  caixa.addEventListener("click", (e) => {
    if (e.target.closest("[data-editando]")) return e.stopPropagation();
    const pilula = e.target.closest("[data-rede-situacao]");
    if (pilula) {
      e.stopPropagation();
      selecionarNo(Number(pilula.dataset.redeSituacao), false);
      return abrirSituacao(Number(pilula.dataset.redeSituacao));
    }
    const mais = e.target.closest("[data-rede-mais]");
    if (mais) {
      e.stopPropagation();
      return criarE(mais, () => edicao.criarDepois(Number(mais.dataset.redeMais)));
    }
    const abrir = e.target.closest("[data-rede-abrir]");
    if (abrir) {
      e.stopPropagation();
      return edicao.abrir(Number(abrir.dataset.redeAbrir));
    }
    const entre = e.target.closest("[data-inserir-de]");
    if (entre) {
      e.stopPropagation();
      return inserirEntre(entre);
    }
    if (e.target.closest("[data-rede-alca]")) return e.stopPropagation();
    const alvoSeta = e.target.closest(".rede-seta-alvo");
    if (alvoSeta) { e.stopPropagation(); return selecionarSeta(Number(alvoSeta.dataset.setaDe), Number(alvoSeta.dataset.setaPara)); }
    const cartao = e.target.closest("[data-rede-no]");
    if (cartao) {
      if (e.altKey) return; // Alt+clique continua editando no lugar (22/10/2026)
      e.stopPropagation();
      const n = Number(cartao.dataset.redeNo);
      /* caixinhas de um campo só (11/11/2026): na ação já selecionada, o clique nos responsáveis ou na data */
      if (selecionadaAntes === n && edicao.podeAlterar(n)) {
        if (e.target.closest(".donos")) return abrirResponsaveis(n);
        if (e.target.closest(".rede-data")) return edicao.usaDataLimite ? abrirDataLimite(n) : abrirEstimativa(n);
      }
      return selecionarNo(n);
    }
    if (e.target.closest(".rede-rolagem") && !moveuFundo()) desmarcar();
  }, true);
  caixa.addEventListener("dblclick", (e) => {
    const cartao = e.target.closest("[data-rede-no]");
    if (!cartao || e.target.closest("[data-editando], .donos, .rede-data")) return;
    e.preventDefault();
    renomear(Number(cartao.dataset.redeNo));
  });
  caixa.addEventListener("keydown", (e) => {
    if (e.target.closest("[data-editando]")) return;
    if (e.key === "Escape" && selecao) { e.stopPropagation(); desmarcar(); return caixa.focus({ preventScroll: true }); }
    if (selecao?.tipo === "seta" && (e.key === "Enter" || e.key === "Insert")) {
      const botao = inserir(selecao.de, selecao.para);
      if (botao) { e.preventDefault(); e.stopPropagation(); botao.click(); }
      return;
    }
    if (selecao?.tipo === "seta" && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      e.stopPropagation();
      const { de, para } = selecao;
      selecao = null;
      edicao.desligar(de, para);
      return;
    }
    if (selecao && (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) {
      e.preventDefault();
      e.stopPropagation();
      const el = selecao.tipo === "no" ? no(selecao.numero) : inserir(selecao.de, selecao.para) ?? seta(selecao.de, selecao.para);
      const r = el.getBoundingClientRect();
      return abrirMenu(selecao, r.left + 12, r.top + r.height / 2);
    }
    const cartao = e.target.closest("[data-rede-no]");
    if (!cartao) return;
    const n = Number(cartao.dataset.redeNo);
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); return edicao.abrir(n); }
    if (e.key === "F2") { e.preventDefault(); e.stopPropagation(); return renomear(n); }
  }, true);
  /* o "+" do meio da seta aparece ao passar o mouse na seta e fica enquanto o mouse estiver nele */
  let sobSeta = null;
  let esconder = 0;
  const mostrarInserir = (botao) => {
    clearTimeout(esconder);
    if (sobSeta && sobSeta !== botao) sobSeta.classList.remove("visivel");
    sobSeta = botao;
    botao?.classList.add("visivel");
  };
  caixa.addEventListener("pointerover", (e) => {
    const alvoSeta = e.target.closest(".rede-seta-alvo");
    if (alvoSeta) return mostrarInserir(inserir(alvoSeta.dataset.setaDe, alvoSeta.dataset.setaPara));
    const botao = e.target.closest("[data-inserir-de]");
    if (botao) mostrarInserir(botao);
  });
  caixa.addEventListener("pointerout", (e) => {
    if (!e.target.closest(".rede-seta-alvo, [data-inserir-de]")) return;
    clearTimeout(esconder);
    esconder = setTimeout(() => { sobSeta?.classList.remove("visivel"); sobSeta = null; }, 350);
  });
  /* ---------- inserir entre duas ações: em etapas diferentes, a pessoa escolhe a etapa (09/11/2026) ---------- */
  const etapaDe = new Map(acoes.map((a) => [a.numero, a.etapa || null]));
  const infoEtapa = new Map((etapas ?? []).map((e) => [e.id, e]));
  const nomeEtapa = (id) => (id ? infoEtapa.get(id)?.titulo ?? infoEtapa.get(id)?.nome ?? "Etapa" : "Sem etapa");
  function inserirEntre(botao) {
    const de = Number(botao.dataset.inserirDe);
    const para = Number(botao.dataset.inserirPara);
    const [ea, eb] = [etapaDe.get(de) ?? null, etapaDe.get(para) ?? null];
    if (!etapas || ea === eb) return criarE(botao, () => edicao.inserirEntre(de, para, ea));
    /* como no Bizagi: a caixa da ação aparece no ponto da seta, e a pessoa diz em qual etapa ela fica */
    const ponto = botao.getBoundingClientRect();
    const el = abrirFlutuante(`
      <div class="rede-fantasma" aria-hidden="true">Nova ${esc(edicao.nomeAcao)}</div>
      <p class="rede-escolha-titulo">Em qual etapa ela fica?</p>
      <div class="rede-escolha-opcoes">${[ea, eb].map((id) => `<button type="button" data-escolher-etapa="${esc(id ?? "")}">${esc(nomeEtapa(id))}</button>`).join("")}</div>`, {
      classe: "rede-escolha", rotulo: `Em qual etapa fica a nova ${edicao.nomeAcao}?`, fechaAoRolar: true,
      posicionar: (caixaEl) => colocar(caixaEl, ponto.left + ponto.width / 2 - caixaEl.offsetWidth / 2, ponto.top - 14),
    });
    el.querySelector("button")?.focus();
    el.addEventListener("keydown", (e) => {
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      const bs = [...el.querySelectorAll("button")];
      bs[(bs.indexOf(document.activeElement) + 1) % bs.length].focus();
    });
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-escolher-etapa]");
      if (!b) return;
      flutuante?.fechar("escolha");
      criarE(botao, () => edicao.inserirEntre(de, para, b.dataset.escolherEtapa || null));
    });
  }

  /* as caixinhas abrem sempre no mesmo lugar, logo abaixo do cartão (11/11/2026, decisão do responsável); se não
     couber na tela, a rede sobe o que falta */
  const abaixoDe = (n) => (caixaEl) => {
    const cartao = document.querySelector(`.rede .rede-no[data-numero="${n}"]`);
    if (!cartao) return flutuante?.fechar("sumiu");
    let r = cartao.getBoundingClientRect();
    const falta = r.bottom + 8 + caixaEl.offsetHeight - (innerHeight - 8);
    if (falta > 0) { rolagem.scrollTop += falta; r = cartao.getBoundingClientRect(); }
    colocar(caixaEl, r.left, r.bottom + 8);
  };
  const focarCartao = (n) => no(n)?.querySelector("[data-rede-no]")?.focus({ preventScroll: true });
  const rotuloDe = (n) => acoes.find((a) => a.numero === n)?.rotulo ?? "";
  /* ---------- caixinhas de um campo só (11/11/2026, pedido do responsável): situação, etapa, data-limite e
     responsáveis, pelo menu do botão direito ou pelo clique no campo da ação selecionada ---------- */
  function abrirLista(n, { titulo, itens, classe, escolher }) {
    if (!no(n) || !itens.length) return;
    const el = abrirFlutuante(`
      <p class="rede-escolha-titulo">${esc(titulo)}</p>
      <div class="rede-escolha-opcoes" role="listbox">${itens.map((i, k) => `<button type="button" role="option" aria-selected="${Boolean(i.atual)}" data-opcao="${k}">${esc(i.nome)}</button>`).join("")}</div>`, {
      classe: `rede-escolha rede-campo ${classe}`, rotulo: `${titulo}: ${rotuloDe(n)}`, posicionar: abaixoDe(n),
      aoFechar: (motivo) => { if (motivo === "esc" || motivo === "escolha") focarCartao(n); },
    });
    (el.querySelector('[aria-selected="true"]') ?? el.querySelector("button"))?.focus({ preventScroll: true });
    el.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const bs = [...el.querySelectorAll("button")];
      bs[(bs.indexOf(document.activeElement) + (e.key === "ArrowDown" ? 1 : bs.length - 1)) % bs.length].focus();
    });
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-opcao]");
      if (!b) return;
      flutuante?.fechar("escolha");
      escolher(itens[Number(b.dataset.opcao)]);
    });
  }
  function abrirSituacao(n) {
    if (!edicao.podeAlterar(n)) return;
    abrirLista(n, { titulo: "Situação", classe: "rede-campo-situacao", itens: edicao.situacoesDe(n), escolher: (i) => { if (!i.atual) edicao.mudarSituacao(n, i.id); } });
  }
  function abrirEtapa(n) {
    if (!edicao.podeAlterar(n)) return;
    const atual = edicao.etapaDe(n);
    abrirLista(n, { titulo: "Etapa", classe: "rede-campo-etapa", itens: [...edicao.etapas.map((e) => ({ ...e, atual: e.id === atual })), { id: null, nome: "Sem etapa", atual: atual == null }],
      escolher: (i) => edicao.mudarEtapa(n, i.id) });
  }
  function abrirResponsaveis(n) {
    if (!edicao.podeAlterar(n) || !no(n)) return;
    flutuante?.fechar("outra");
    edicao.responsaveis(no(n), n);
  }
  function abrirDataLimite(n) {
    if (!edicao.usaDataLimite || !edicao.podeAlterar(n) || !no(n)) return;
    const el = abrirFlutuante(`
      <form class="rede-estimar-forma" novalidate>
        <p class="rede-estimar-titulo">Data-limite</p>
        <div class="rede-estimar-campos um"><label><span>Dia</span><input name="data" type="date" value="${esc(edicao.dataLimiteDe(n) ?? "")}"></label></div>
        <p class="rede-estimar-erro" role="alert" hidden></p>
        <p class="rede-estimar-dica">Enter grava · vazio tira a data · Esc desiste</p>
      </form>`, { classe: "rede-estimar rede-campo rede-campo-data", rotulo: `Data-limite de ${rotuloDe(n)}`, posicionar: abaixoDe(n),
      aoFechar: (motivo) => { if (motivo === "esc" || motivo === "gravou") focarCartao(n); } });
    const forma = el.querySelector("form");
    const erro = el.querySelector(".rede-estimar-erro");
    forma.data.focus({ preventScroll: true });
    forma.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const falha = await edicao.mudarDataLimite(n, forma.data.value);
      if (falha) { erro.textContent = falha; erro.hidden = false; flutuante?.posicionar(el); return; }
      flutuante?.fechar("gravou");
    });
  }

  /* ---------- caixinha de prazos junto ao cartão (09/11/2026) ---------- */
  function abrirEstimativa(n) {
    if (!edicao.usaEstimativas || !edicao.podeEstimar(n) || !no(n)) return;
    const atual = edicao.estimativaDe(n);
    const rotulo = acoes.find((a) => a.numero === n)?.rotulo ?? "";
    const campo = (nome, texto) => `<label><span>${texto}</span><input name="${nome}" type="number" min="0" step="1" inputmode="numeric" value="${atual?.[nome] ?? ""}"></label>`;
    const el = abrirFlutuante(`
      <form class="rede-estimar-forma" novalidate>
        <p class="rede-estimar-titulo">Prazo em dias úteis</p>
        <div class="rede-estimar-campos">${campo("o", "Otimista")}${campo("m", "Mais provável")}${campo("p", "Pessimista")}</div>
        <p class="rede-estimar-previsao" data-previsao hidden></p>
        <p class="rede-estimar-erro" role="alert" hidden></p>
        <p class="rede-estimar-dica">Enter grava · Esc deixa para depois</p>
      </form>`, {
      classe: "rede-estimar", rotulo: `Prazo de ${rotulo}`, posicionar: abaixoDe(n),
      aoFechar: (motivo) => { if (motivo === "esc" || motivo === "gravou") focarCartao(n); },
    });
    const forma = el.querySelector("form");
    const erro = el.querySelector(".rede-estimar-erro");
    /* com os três prazos preenchidos, a data em que a ação terminaria (11/11/2026) */
    const previsao = el.querySelector("[data-previsao]");
    const prever = () => {
      const [o, m, p] = ["o", "m", "p"].map((k) => (forma[k].value.trim() === "" ? NaN : Number(forma[k].value)));
      const data = edicao.previsaoCom?.(n, { o, m, p }) ?? null;
      previsao.hidden = !data;
      if (data) previsao.innerHTML = `Com estes prazos, termina em <b>${dataBr(data)}</b>`;
      flutuante?.posicionar(el);
    };
    forma.addEventListener("input", prever);
    prever();
    forma.o.focus({ preventScroll: true });
    forma.o.select();
    forma.addEventListener("focusin", (e) => e.target.select?.());
    forma.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const valores = ["o", "m", "p"].map((k) => forma[k].value.trim());
      if (valores.every((v) => v === "")) return flutuante?.fechar("vazio");
      const [o, m, p] = valores.map((v) => (v === "" ? NaN : Number(v)));
      const falha = await edicao.estimar(n, { o, m, p });
      if (falha) { erro.textContent = falha; erro.hidden = false; flutuante?.posicionar(el); return; }
      flutuante?.fechar("gravou");
    });
  }

  /* ---------- menu do botão direito (09/11/2026, pedido do responsável) ---------- */
  function itensDoMenu(alvoMenu) {
    const t = edicao.nomeAcao;
    if (alvoMenu.tipo === "no") {
      const n = alvoMenu.numero;
      const mais = no(n)?.querySelector("[data-rede-mais]");
      return [
        { rotulo: `Abrir a ${t}`, tecla: "Enter", fazer: () => edicao.abrir(n) },
        { rotulo: "Renomear", tecla: "F2", fazer: () => renomear(n) },
        edicao.usaEstimativas && edicao.podeEstimar(n) && { rotulo: "Prazo em dias úteis", fazer: () => abrirEstimativa(n) },
        edicao.usaDataLimite && edicao.podeAlterar(n) && { rotulo: "Data-limite", fazer: () => abrirDataLimite(n) },
        edicao.podeAlterar(n) && { rotulo: "Responsáveis", fazer: () => abrirResponsaveis(n) },
        edicao.podeAlterar(n) && edicao.situacoesDe(n).length && { rotulo: "Situação", fazer: () => abrirSituacao(n) },
        edicao.podeAlterar(n) && edicao.etapas.length && { rotulo: "Etapa", fazer: () => abrirEtapa(n) },
        mais && { rotulo: `Nova ${t} depois desta`, fazer: () => mais.click() },
        edicao.podeExcluir && { rotulo: `Excluir a ${t}`, perigo: true, fazer: () => edicao.excluir(n) },
      ].filter(Boolean);
    }
    const { de, para } = alvoMenu;
    const botao = inserir(de, para);
    return [
      botao && { rotulo: `Inserir uma ${t} no meio`, tecla: "Enter", fazer: () => inserirEntre(botao) },
      { rotulo: "Retirar a ligação", tecla: "Delete", perigo: true, fazer: () => { selecao = null; edicao.desligar(de, para); } },
    ].filter(Boolean);
  }
  function abrirMenu(alvoMenu, x, y) {
    const itens = itensDoMenu(alvoMenu);
    const el = abrirFlutuante(itens.map((i, k) => `<button type="button" role="menuitem" data-item="${k}"${i.perigo ? ' class="perigo"' : ""}>
      <span>${esc(i.rotulo)}</span>${i.tecla ? `<kbd>${i.tecla}</kbd>` : ""}</button>`).join(""), {
      classe: "menu-da-janela rede-menu", papel: "menu", rotulo: "Opções", fechaAoRolar: true,
      posicionar: (caixaEl) => colocar(caixaEl, x, y),
    });
    el.querySelector("button")?.focus();
    el.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const bs = [...el.querySelectorAll("button")];
      const i = bs.indexOf(document.activeElement);
      bs[(i + (e.key === "ArrowDown" ? 1 : bs.length - 1)) % bs.length].focus();
    });
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-item]");
      if (!b) return;
      flutuante?.fechar("escolha");
      itens[Number(b.dataset.item)].fazer();
    });
  }
  caixa.addEventListener("contextmenu", (e) => {
    if (e.target.closest("[data-editando]")) return;
    const cartao = e.target.closest("[data-rede-no]");
    const naSeta = e.target.closest(".rede-seta-alvo, [data-inserir-de]");
    let alvoMenu = null;
    if (cartao) { selecionarNo(Number(cartao.dataset.redeNo), false); alvoMenu = selecao; }
    else if (naSeta) {
      const de = Number(naSeta.dataset.setaDe ?? naSeta.dataset.inserirDe);
      const para = Number(naSeta.dataset.setaPara ?? naSeta.dataset.inserirPara);
      selecionarSeta(de, para);
      alvoMenu = selecao;
    }
    if (!alvoMenu) return; // no fundo, o menu do navegador
    e.preventDefault();
    abrirMenu(alvoMenu, e.clientX, e.clientY);
  });
  /* as caixas soltas acompanham a rolagem da rede (o menu e a escolha fecham) */
  rolagem.addEventListener("scroll", () => {
    if (!flutuante) return;
    if (flutuante.rolagem) flutuante.fechar("rolagem");
    else flutuante.posicionar(flutuante.el);
  }, { passive: true });
  if (flutuante && !flutuante.rolagem) requestAnimationFrame(() => flutuante?.posicionar(flutuante.el));
  else flutuante?.fechar("redesenho");

  /* o foco por teclado também seleciona */
  caixa.addEventListener("focusin", (e) => {
    const cartao = e.target.closest("[data-rede-no]");
    if (cartao && !(selecao?.tipo === "no" && selecao.numero === Number(cartao.dataset.redeNo))) selecionarNo(Number(cartao.dataset.redeNo), false);
  });

  /* ---------- ligar arrastando a bolinha até outro cartão ---------- */
  const linha = caixa.querySelector("[data-ligando]");
  caixa.addEventListener("pointerdown", (e) => {
    const alca = e.target.closest("[data-rede-alca]");
    if (!alca || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const origem = Number(alca.dataset.redeAlca);
    const base = conteudo.getBoundingClientRect();
    const local = (x, y) => [(x - base.left) / fator(), (y - base.top) / fator()];
    const r = alca.getBoundingClientRect();
    const [x0, y0] = local(r.left + r.width / 2, r.top + r.height / 2);
    alca.setPointerCapture(e.pointerId);
    caixa.classList.add("ligando");
    destacar(origem);
    let destino = null;
    let ultimo = { clientX: e.clientX, clientY: e.clientY };
    /* perto da borda, a rede rola sozinha, para alcançar ações fora da tela */
    let rolando = 0;
    const rolarNaBorda = () => {
      const v = rolagem.getBoundingClientRect();
      const borda = 48;
      const passo = (d) => (d < borda ? Math.ceil((borda - d) / 4) : 0);
      const dx = passo(ultimo.clientX - v.left) * -1 + passo(v.right - ultimo.clientX);
      const dy = passo(ultimo.clientY - v.top) * -1 + passo(v.bottom - ultimo.clientY);
      if (dx || dy) { rolagem.scrollLeft += dx; rolagem.scrollTop += dy; mover(ultimo); }
      rolando = requestAnimationFrame(rolarNaBorda);
    };
    rolando = requestAnimationFrame(rolarNaBorda);
    const mover = (ev) => {
      ultimo = { clientX: ev.clientX, clientY: ev.clientY };
      const base = conteudo.getBoundingClientRect();
      const local = (x, y) => [(x - base.left) / fator(), (y - base.top) / fator()];
      const [x, y] = local(ev.clientX, ev.clientY);
      const meio = x0 + Math.max(24, (x - x0) / 2);
      linha.setAttribute("d", `M${x0},${y0} C${meio},${y0} ${x - Math.max(24, (x - x0) / 2)},${y} ${x},${y}`);
      const sob = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".rede-no");
      const n = sob ? Number(sob.dataset.numero) : null;
      if (n !== destino) {
        caixa.querySelector(".rede-no.alvo-ligacao")?.classList.remove("alvo-ligacao");
        destino = n !== origem ? n : null;
        if (destino != null) sob.classList.add("alvo-ligacao");
      }
    };
    const soltar = () => {
      cancelAnimationFrame(rolando);
      alca.removeEventListener("pointermove", mover);
      alca.removeEventListener("pointerup", soltar);
      alca.removeEventListener("pointercancel", soltar);
      caixa.classList.remove("ligando");
      caixa.querySelector(".rede-no.alvo-ligacao")?.classList.remove("alvo-ligacao");
      linha.setAttribute("d", "");
      limpar();
      if (destino != null) { selecao = { tipo: "no", numero: destino }; edicao.ligar(origem, destino); }
    };
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);
  });
}
