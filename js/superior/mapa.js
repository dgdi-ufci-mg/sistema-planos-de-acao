/**
 * Tela do Mapa do Strata (lote 1 de 29/10/2026; documentação técnica, seção 8, "Mapa"). Desenha em SVG a geometria
 * calculada por `js/mapa.js` e cuida do movimento e da aproximação: arrastar com o dedo ou o mouse, pinça,
 * Ctrl + rolagem, rolagem sem Ctrl para mover, botões + e − e "Centralizar". Sem biblioteca externa (regra do
 * repositório: nada de dependências novas); os gestos usam eventos de ponteiro.
 *
 * Regras de comportamento (atalhos do esboço que não entram):
 * - o mapa só se centraliza ao abrir e no botão, nunca a cada mudança de tamanho (no celular, a barra de endereço
 *   dispara essa mudança); ao mudar de tamanho, apenas reaplica os limites;
 * - o movimento só começa depois de `LIMIAR_DO_TOQUE` pixels, para um toque com tremor continuar sendo toque
 *   (a seleção de pontos entra no lote 2);
 * - o movimento e a aproximação ficam limitados ao conteúdo, nos dois sentidos (`limitarTransformacao`);
 * - os nomes das camadas ficam presos à borda esquerda, em tamanho fixo, e não encolhem com o zoom.
 */
import {
  calcularMapa, caminhoDaFaixa, caminhoDaLigacao, deslocamentoCurvo, limitarTransformacao, transformacaoInicial,
} from "../mapa.js";

const NS = "http://www.w3.org/2000/svg";
const LIMIAR_DO_TOQUE = 6;
const ESCALA_MAXIMA = 3;
/** Até esta largura da área, o nome da camada vai acima da faixa, e não no meio dela. */
const LARGURA_DE_CELULAR = 640;

const criar = (nome, atributos = {}) => {
  const e = document.createElementNS(NS, nome);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, v);
  return e;
};

/**
 * @param {HTMLElement} area  contêiner do mapa (com altura definida pelo CSS)
 * @param {{camadas: object[], itens: object[], planos: object[], estado: {t?: {k: number, x: number, y: number}}}} contexto
 *   `estado` guarda a vista do mapa entre um desenho e outro da tela
 * @returns {{destruir: () => void}}
 */
export function criarVistaMapa(area, { camadas, itens, planos, estado }) {
  area.innerHTML = `
    <svg class="mapa-svg" role="group" aria-label="Mapa do desdobramento: do alto, o que vem primeiro; embaixo, os Planos de Ação" focusable="false">
      <g data-mapa-mundo></g>
      <text class="mapa-nome mapa-medida" x="0" y="0" aria-hidden="true"></text>
    </svg>
    <div class="mapa-rotulos" aria-hidden="true"></div>
    <div class="mapa-controles" role="group" aria-label="Aproximar e afastar o mapa">
      <button type="button" class="botao" data-mapa-mais aria-label="Aproximar">+</button>
      <button type="button" class="botao" data-mapa-menos aria-label="Afastar">−</button>
      <button type="button" class="botao" data-mapa-centralizar>Centralizar</button>
    </div>`;
  const svg = area.querySelector(".mapa-svg");
  const mundo = svg.querySelector("[data-mapa-mundo]");
  const medidor = svg.querySelector(".mapa-medida");
  const rotulos = area.querySelector(".mapa-rotulos");
  const reduzirMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  let mapa = null;
  let vista = { w: area.clientWidth, h: area.clientHeight };
  let t = null;
  let quadro = 0;

  const conteudo = () => ({ w: mapa.largura, h: mapa.altura });
  const limites = () => ({ conteudo: conteudo(), vista, escalaMaxima: ESCALA_MAXIMA });

  /* ---------- desenho ---------- */
  function desenhar() {
    const medir = (texto) => { medidor.textContent = texto; return medidor.getComputedTextLength(); };
    mapa = calcularMapa({ camadas, itens, planos, medir });
    mundo.replaceChildren();
    const grupoFaixas = criar("g");
    const grupoLigacoes = criar("g");
    const grupoNos = criar("g");
    mundo.append(grupoFaixas, grupoLigacoes, grupoNos);

    const quantas = mapa.faixas.length;
    mapa.faixas.forEach((f, i) => {
      const p = criar("path", { class: "mapa-faixa", "data-camada": f.id, d: caminhoDaFaixa(f, mapa) });
      p.style.setProperty("--tom", `${8 + (quantas > 1 ? 16 * (1 - i / (quantas - 1)) : 8)}%`); // mais forte no alto
      grupoFaixas.append(p);
    });
    const porChave = new Map(mapa.nos.map((n) => [n.chave, n]));
    for (const l of mapa.ligacoes) {
      grupoLigacoes.append(criar("path", { class: "mapa-ligacao", "data-de": l.de, "data-para": l.para, d: caminhoDaLigacao(porChave.get(l.de), porChave.get(l.para)) }));
    }
    for (const n of mapa.nos) {
      const g = criar("g", { class: `mapa-no${n.tipo === "plano" ? " plano" : ""}${n.restrito ? " restrito" : ""}`, "data-no": n.chave, "data-tipo": n.tipo });
      const titulo = criar("title");
      titulo.textContent = n.tipo === "plano" ? n.nome : `${n.codigo ? `${n.codigo} · ` : ""}${n.nome}`;
      const ponto = criar("circle", { cx: n.x, cy: n.yCurvo, r: 6 });
      const nome = criar("text", { class: "mapa-nome", x: n.x, y: n.yCurvo - 12, "text-anchor": "middle" });
      nome.textContent = n.rotulo;
      g.append(titulo, ponto, nome);
      grupoNos.append(g);
    }

    rotulos.replaceChildren(...mapa.faixas.map((f) => {
      const s = document.createElement("span");
      s.className = "mapa-rotulo-camada";
      s.dataset.camada = f.id;
      s.textContent = f.plural;
      return s;
    }));
  }

  /* ---------- vista (movimento e aproximação) ---------- */
  function aplicar(nova) {
    t = limitarTransformacao(nova, limites());
    estado.t = t;
    mundo.setAttribute("transform", `translate(${t.x.toFixed(2)} ${t.y.toFixed(2)}) scale(${t.k.toFixed(4)})`);
    posicionarRotulos();
  }

  /** Nome de cada camada, preso à borda esquerda, em tamanho fixo; some quando a faixa sai da vista. */
  function posicionarRotulos() {
    const estreito = vista.w <= LARGURA_DE_CELULAR;
    const xMundo = Math.min(mapa.largura, Math.max(0, (12 - t.x) / t.k));
    const curva = deslocamentoCurvo(xMundo, mapa.centro, mapa.raio);
    for (const s of rotulos.children) {
      const f = mapa.faixas.find((x) => x.id === s.dataset.camada);
      const topo = t.y + t.k * (f.topo + curva);
      const base = t.y + t.k * (f.base + curva);
      const de = Math.max(topo, 0);
      const ate = Math.min(base, vista.h);
      const cabe = ate - de >= 16;
      s.hidden = !cabe;
      if (cabe) s.style.transform = `translate(12px, ${(estreito ? de + 4 : (de + ate) / 2 - 8).toFixed(1)}px)`;
    }
  }

  const pontoNaArea = (e) => { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  /** Aproxima ou afasta mantendo parado o ponto do mundo que está sob `p` (em pixels da área). */
  const zoomEm = (p, fator, base = t) => ({ k: base.k * fator, x: p.x - (p.x - base.x) * fator, y: p.y - (p.y - base.y) * fator });

  function animarPara(alvo) {
    cancelAnimationFrame(quadro);
    const fim = limitarTransformacao(alvo, limites());
    if (reduzirMovimento()) { aplicar(fim); return; }
    const de = { ...t };
    const inicio = performance.now();
    const passo = (agora) => {
      const u = Math.min(1, (agora - inicio) / 220);
      const e = 1 - (1 - u) ** 3;
      aplicar({ k: de.k + (fim.k - de.k) * e, x: de.x + (fim.x - de.x) * e, y: de.y + (fim.y - de.y) * e });
      if (u < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
  }

  /* ---------- gestos ---------- */
  const ponteiros = new Map();
  let pinca = null; // {distancia, meio} do último passo
  const medidaDaPinca = () => {
    const [a, b] = [...ponteiros.values()];
    const r = svg.getBoundingClientRect();
    return { distancia: Math.hypot(a.x - b.x, a.y - b.y) || 1, meio: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top } };
  };

  svg.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cancelAnimationFrame(quadro);
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, movido: false });
    if (ponteiros.size === 2) pinca = medidaDaPinca();
  });
  svg.addEventListener("pointermove", (e) => {
    const p = ponteiros.get(e.pointerId);
    if (!p) return;
    if (ponteiros.size >= 2) {
      p.x = e.clientX; p.y = e.clientY; p.movido = true;
      const agora = medidaDaPinca();
      const movido = zoomEm(agora.meio, agora.distancia / pinca.distancia);
      aplicar({ ...movido, x: movido.x + (agora.meio.x - pinca.meio.x), y: movido.y + (agora.meio.y - pinca.meio.y) });
      pinca = agora;
      return;
    }
    if (!p.movido) {
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < LIMIAR_DO_TOQUE) return; // ainda é um toque
      p.movido = true;
      p.x = p.x0; p.y = p.y0;
      try { svg.setPointerCapture(e.pointerId); } catch { /* o ponteiro já acabou */ }
      svg.classList.add("arrastando");
    }
    aplicar({ ...t, x: t.x + (e.clientX - p.x), y: t.y + (e.clientY - p.y) });
    p.x = e.clientX; p.y = e.clientY;
  });
  const soltar = (e) => {
    if (!ponteiros.delete(e.pointerId)) return;
    pinca = null;
    for (const p of ponteiros.values()) { p.movido = true; } // o dedo que sobra continua movendo o mapa
    if (!ponteiros.size) svg.classList.remove("arrastando");
  };
  svg.addEventListener("pointerup", soltar);
  svg.addEventListener("pointercancel", soltar);
  svg.addEventListener("lostpointercapture", soltar);

  /* Ctrl + rolagem (e a pinça do touchpad) aproxima; rolagem sem Ctrl move o mapa */
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    cancelAnimationFrame(quadro);
    const passo = e.deltaMode === 1 ? 16 : 1;
    if (e.ctrlKey) aplicar(zoomEm(pontoNaArea(e), Math.exp(-e.deltaY * passo * 0.0022)));
    else aplicar({ ...t, x: t.x - e.deltaX * passo, y: t.y - e.deltaY * passo });
  }, { passive: false });

  const meioDaVista = () => ({ x: vista.w / 2, y: vista.h / 2 });
  area.addEventListener("click", (e) => {
    const botao = e.target.closest("button");
    if (!botao) return;
    if (botao.matches("[data-mapa-mais]")) animarPara(zoomEm(meioDaVista(), 1.3));
    else if (botao.matches("[data-mapa-menos]")) animarPara(zoomEm(meioDaVista(), 1 / 1.3));
    else if (botao.matches("[data-mapa-centralizar]")) animarPara(transformacaoInicial(limites()));
  });

  /* ---------- tamanho: só reaplica os limites; centraliza apenas na primeira vez ---------- */
  const observador = new ResizeObserver(() => {
    const novo = { w: area.clientWidth, h: area.clientHeight };
    if (!novo.w || !novo.h) return;
    vista = novo;
    aplicar(t ?? estado.t ?? transformacaoInicial(limites()));
  });

  desenhar();
  if (vista.w && vista.h) aplicar(estado.t ?? transformacaoInicial(limites()));
  observador.observe(area);
  /* as fontes mudam a largura dos nomes: desenha de novo quando carregarem, sem mexer na vista */
  document.fonts?.ready.then(() => { if (area.isConnected) { desenhar(); if (t) aplicar(t); } });

  return { destruir() { observador.disconnect(); cancelAnimationFrame(quadro); } };
}
