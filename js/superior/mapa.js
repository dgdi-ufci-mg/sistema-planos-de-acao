/**
 * Tela do Mapa do Strata (lote 1 de 29/10/2026; documentação técnica, seção 8, "Mapa"). Desenha em SVG a geometria
 * calculada por `js/mapa.js` e cuida do movimento e da aproximação: arrastar com o dedo ou o mouse, pinça,
 * Ctrl + rolagem, rolagem sem Ctrl para mover, botões + e − e "Centralizar". Sem biblioteca externa (regra do
 * repositório: nada de dependências novas); os gestos usam eventos de ponteiro.
 *
 * Regras de comportamento (atalhos do esboço que não entram):
 * - o mapa cabe inteiro na área ao abrir e no botão "Centralizar" (a largura do mapa acompanha a da área);
 *   fora isso, nunca se centraliza, nunca a cada mudança de tamanho (no celular, a barra de endereço
 *   dispara essa mudança); ao mudar de tamanho, apenas reaplica os limites;
 * - o movimento só começa depois de `LIMIAR_DO_TOQUE` pixels, para um toque com tremor continuar sendo toque
 *   (tocar num ponto seleciona: acende o caminho e abre o cartão com "Abrir"; tocar no fundo desfaz);
 * - o movimento e a aproximação ficam limitados ao conteúdo, nos dois sentidos (`limitarTransformacao`);
 * - os nomes das camadas ficam presos à borda esquerda, em tamanho fixo, e não encolhem com o zoom.
 */
import {
  calcularMapa, caminhoAlem, caminhoDaFaixa, caminhoDaLigacao, estrelasDoCeu, linhaDoSolo, caminhoDoNo, deslocamentoCurvo, emRepouso, estrelasDoMapa, lerCor, melhorTinta, MOLA, passoDaMola, limitarTransformacao, transformacaoInicial,
} from "../mapa.js";

const NS = "http://www.w3.org/2000/svg";
const LIMIAR_DO_TOQUE = 6;
const ESCALA_MAXIMA = 3;
/** Abaixo desta escala (o nome de 13 px ficaria com menos de 8,5 px na tela), o mapa mostra só o código de cada item. */
const ESCALA_DOS_NOMES = 0.65;
const TAMANHO_DO_NOME = 13;
const TAMANHO_MAXIMO_DO_CODIGO = 20;
const TAMANHO_APARENTE_DO_CODIGO = 9;
/** Quanto as faixas, o céu e o solo continuam para os lados e para baixo, em larguras do mapa (só desenho). */
const ALEM = 3;

let contador = 0; // identificadores únicos dos gradientes, se houver mais de um mapa na página
const criar = (nome, atributos = {}) => {
  const e = document.createElementNS(NS, nome);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, v);
  return e;
};

/**
 * @param {HTMLElement} area  contêiner do mapa (com altura definida pelo CSS)
 * @param {{camadas: object[], itens: object[], planos: object[], estado: {t?: {k: number, x: number, y: number}, selecionado?: string}, aoAbrir?: (no: object) => void,
 *   ordemPessoal?: Record<string, string[]>, podeOrdenar?: boolean, aoReordenar?: (camada: string, chaves: string[]) => Promise<void>}} contexto
 *   `ordemPessoal`: a ordem da pessoa, camada → chaves; `podeOrdenar`: ela pode arrastar pontos (só com o mouse, no computador); `aoReordenar` recebe a nova ordem de uma camada
 *   `estado` guarda a vista e o ponto selecionado entre um desenho e outro da tela; `aoAbrir` recebe o ponto do cartão
 *   `folga`: pixels reservados no alto e no pé da área, que ficam sob o título e o menu da tela cheia (o conteúdo não vai para baixo deles)
 * @returns {{destruir: () => void}}
 */
export function criarVistaMapa(area, { camadas, itens, planos, estado, aoAbrir = () => {}, ordemPessoal = {}, podeOrdenar = false, aoReordenar = async () => {}, folga = () => ({ topo: 0, base: 0 }) }) {
  area.innerHTML = `
    <svg class="mapa-svg" role="group" aria-label="Mapa do desdobramento: do alto, o que vem primeiro; embaixo, os Planos de Ação" focusable="false">
      <g data-mapa-mundo></g>
      <text class="mapa-nome mapa-medida" x="0" y="0" aria-hidden="true"></text>
    </svg>
    <div class="mapa-rotulos" aria-hidden="true"></div>
    <div class="mapa-cartao" data-mapa-cartao hidden></div>
    <div class="mapa-controles" role="group" aria-label="Aproximar e afastar o mapa">
      <button type="button" class="botao" data-mapa-mais aria-label="Aproximar">+</button>
      <button type="button" class="botao" data-mapa-menos aria-label="Afastar">−</button>
      <button type="button" class="botao" data-mapa-centralizar>Centralizar</button>
    </div>`;
  const svg = area.querySelector(".mapa-svg");
  const mundo = svg.querySelector("[data-mapa-mundo]");
  const medidor = svg.querySelector(".mapa-medida");
  const rotulos = area.querySelector(".mapa-rotulos");
  const cartao = area.querySelector("[data-mapa-cartao]");
  const reduzirMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  let mapa = null;
  let vista = { w: area.clientWidth, h: area.clientHeight };
  let t = null;
  let quadro = 0;

  const conteudo = () => ({ w: mapa.largura, h: mapa.altura });
  const limites = () => ({ conteudo: conteudo(), vista, escalaMaxima: ESCALA_MAXIMA, folga: folga() });

  /* ---------- desenho ---------- */
  function desenhar() {
    const medir = (texto) => { medidor.textContent = texto; return medidor.getComputedTextLength(); };
    mapa = calcularMapa({ camadas, itens, planos, medir, vista, ordemPessoal });
    cancelAnimationFrame(molaId);
    elementos.clear();
    ligacoesVivas.length = 0;
    mundo.replaceChildren();
    const grupoCeu = criar("g", { "aria-hidden": "true" }); // céu e solo da tela cheia: as faixas continuam para os lados, só como desenho
    const grupoFaixas = criar("g");
    const grupoEstrelas = criar("g", { class: "mapa-estrelas", "aria-hidden": "true" });
    const grupoLigacoes = criar("g");
    const grupoNos = criar("g");
    mundo.append(grupoCeu, grupoFaixas, grupoEstrelas, grupoLigacoes, grupoNos);

    const quantas = mapa.faixas.length;
    const alem = ALEM * mapa.largura;
    const posicao = (i) => `${quantas > 1 ? Math.round(100 * (1 - i / (quantas - 1))) : 0}%`; // 0 no chão (claro de dia) até 100 no alto (anil de dia, preto de noite)
    for (const e of estrelasDoCeu(mapa, { alem, altura: 1.5 * mapa.largura })) grupoCeu.append(criar("circle", { class: "mapa-estrela", cx: e.x, cy: e.y, r: e.r, "fill-opacity": e.o }));
    mapa.faixas.forEach((f, i) => {
      const fora = criar("path", { class: "mapa-faixa-alem", d: caminhoAlem(f, mapa, alem) });
      fora.style.setProperty("--pos", posicao(i));
      grupoCeu.append(fora);
    });
    const base = mapa.faixas[quantas - 1].base;
    const gradiente = criar("linearGradient", { id: `mapa-solo-${++contador}`, gradientUnits: "userSpaceOnUse", x1: 0, x2: 0, y1: base, y2: base + mapa.largura });
    gradiente.append(criar("stop", { offset: 0, class: "mapa-solo-cima" }), criar("stop", { offset: 1, class: "mapa-solo-baixo" }));
    grupoCeu.append(criar("defs"));
    grupoCeu.lastChild.append(gradiente);
    grupoCeu.append(
      criar("path", { class: "mapa-solo", fill: `url(#${gradiente.id})`, d: caminhoAlem({ topo: base, base: base + alem }, mapa, alem) }),
      criar("path", { class: "mapa-solo-brilho", d: linhaDoSolo(mapa, alem) }),
      criar("path", { class: "mapa-solo-linha", d: linhaDoSolo(mapa, alem) }),
    );
    mapa.faixas.forEach((f, i) => {
      const p = criar("path", { class: "mapa-faixa", "data-camada": f.id, d: caminhoDaFaixa(f, mapa) });
      p.style.setProperty("--pos", posicao(i));
      grupoFaixas.append(p);
    });
    for (const e of estrelasDoMapa(mapa)) grupoEstrelas.append(criar("circle", { class: "mapa-estrela", cx: e.x, cy: e.y, r: e.r, "fill-opacity": e.o })); // só aparecem no tema noite
    const porChave = new Map(mapa.nos.map((n) => [n.chave, n]));
    for (const l of mapa.ligacoes) { // cada linha tem uma borda de cor oposta, para aparecer sobre o claro e sobre o escuro
      const d = caminhoDaLigacao(porChave.get(l.de), porChave.get(l.para));
      const borda = criar("path", { class: "mapa-ligacao-borda", "data-de": l.de, "data-para": l.para, d });
      const linha = criar("path", { class: "mapa-ligacao", "data-de": l.de, "data-para": l.para, d });
      grupoLigacoes.append(borda, linha);
      ligacoesVivas.push({ de: l.de, para: l.para, borda, linha });
    }
    for (const n of mapa.nos) {
      const g = criar("g", { class: `mapa-no${n.tipo === "plano" ? " plano" : ""}${n.restrito ? " restrito" : ""}`, "data-no": n.chave, "data-tipo": n.tipo, "data-faixa": n.faixa, tabindex: 0, role: "button" });
      g.setAttribute("aria-label", n.tipo === "plano" ? n.nome : `${n.codigo ? `${n.codigo} · ` : ""}${n.nome}`);
      const titulo = criar("title");
      titulo.textContent = n.tipo === "plano" ? n.nome : `${n.codigo ? `${n.codigo} · ` : ""}${n.nome}`;
      const alvo = criar("circle", { class: "mapa-alvo", cx: n.x, cy: n.yCurvo, r: 11 }); // área de toque maior que o ponto
      const ponto = criar("circle", { class: "mapa-bolinha", cx: n.x, cy: n.yCurvo, r: 6 });
      g.append(titulo, alvo, ponto);
      const partes = { alvo, ponto, nome: null, codigo: null };
      elementos.set(n.chave, partes);
      if (n.rotulo) {
        const nome = criar("text", { class: "mapa-nome", x: n.x + mapa.recuo, y: n.yCurvo + 4 });
        partes.nome = nome;
        nome.textContent = n.rotulo;
        g.append(nome);
        if (n.codigo) { // de longe, só o código, no maior tamanho que cabe no espaço do nome
          const codigo = criar("text", { class: "mapa-codigo", x: n.x + mapa.recuo, y: n.yCurvo + 4 });
          codigo.textContent = n.codigo;
          partes.codigo = codigo;
          codigo.dataset.maximo = String(Math.min(TAMANHO_MAXIMO_DO_CODIGO, TAMANHO_DO_NOME * Math.max(1, n.largura / Math.max(1, medir(n.codigo)))));
          g.append(codigo);
        }
      }
      grupoNos.append(g);
    }

    rotulos.replaceChildren(...mapa.faixas.map((f) => {
      const s = document.createElement("span");
      s.className = "mapa-rotulo-camada";
      s.dataset.camada = f.id;
      s.textContent = f.plural;
      return s;
    }));
    escalaDosCodigos = 0;
    marcarSelecao();
    ajustarTintas();
    iniciarMola();
  }

  /* ---------- mola: os pontos deslizam do lugar em que estavam até o destino calculado pelas regras ---------- */
  const elementos = new Map(); // chave → elementos SVG do ponto
  const ligacoesVivas = []; // linhas (com borda), para seguir os pontos
  const atual = new Map(); // chave → {x, y, vx, vy}: onde cada ponto está agora
  let molaId = 0;
  let ultimoQuadro = 0;
  const alvoDe = (chave) => noDe(chave);

  /** Põe cada ponto, e as linhas e nomes dele, na posição de agora. */
  function pintar() {
    for (const [chave, p] of elementos) {
      const a = atual.get(chave);
      p.alvo.setAttribute("cx", a.x); p.alvo.setAttribute("cy", a.y);
      p.ponto.setAttribute("cx", a.x); p.ponto.setAttribute("cy", a.y);
      for (const texto of [p.nome, p.codigo]) if (texto) { texto.setAttribute("x", a.x + mapa.recuo); texto.setAttribute("y", a.y + 4); }
    }
    for (const l of ligacoesVivas) {
      const [f, u] = [atual.get(l.de), atual.get(l.para)];
      const d = `M${f.x.toFixed(1)} ${f.y.toFixed(1)} L${u.x.toFixed(1)} ${u.y.toFixed(1)}`;
      l.borda.setAttribute("d", d); l.linha.setAttribute("d", d);
    }
  }
  const guardarPosicoes = () => { estado.posicoes = new Map([...atual].map(([k, a]) => [k, { x: a.x, y: a.y }])); };

  /** Começa a mola: o ponto que já existia parte de onde estava; o novo aparece no destino. Sem movimento, tudo no destino. */
  function iniciarMola() {
    const antes = estado.posicoes ?? new Map();
    atual.clear();
    let mexe = false;
    for (const n of mapa.nos) {
      const p = antes.get(n.chave);
      const longe = p && Math.hypot(p.x - n.x, p.y - n.yCurvo) > MOLA.distanciaMinima;
      if (longe && !reduzirMovimento()) mexe = true;
      atual.set(n.chave, longe && !reduzirMovimento() ? { x: p.x, y: p.y, vx: 0, vy: 0 } : { x: n.x, y: n.yCurvo, vx: 0, vy: 0 });
    }
    pintar();
    guardarPosicoes();
    if (!mexe) { svg.removeAttribute("data-movendo"); return; }
    svg.dataset.movendo = "1";
    ultimoQuadro = performance.now();
    molaId = requestAnimationFrame(passoDaMolaNaTela);
  }
  /* ---------- ordem pessoal: arrastar um ponto para os lados, só com o mouse (lote 6) ---------- */
  let segurado = null; // chave do ponto que está na mão da pessoa: a mola não o puxa
  function arrastarNo(chave, e) {
    const a = atual.get(chave);
    if (!a) return;
    const x = (pontoNaArea(e).x - t.x) / t.k;
    segurado = chave;
    a.x = Math.min(mapa.largura - 14, Math.max(14, x));
    a.vx = 0;
    pintar();
    guardarPosicoes();
    posicionarCartao();
  }
  /** Solta o ponto: a nova ordem da camada é a dos pontos da esquerda para a direita; se não mudou, ele volta ao lugar. */
  async function soltarNo(chave, valeu) {
    segurado = null;
    const f = mapa.faixas[noDe(chave)?.faixa];
    if (!f) return;
    const nova = [...f.nos].sort((a, b) => atual.get(a).x - atual.get(b).x || f.nos.indexOf(a) - f.nos.indexOf(b));
    if (!valeu || nova.every((k, i) => k === f.nos[i])) { iniciarMola(); return; }
    estado.posicoes = null; // sem deslizar: o mapa refeito já nasce com todos os pontos no lugar novo
    try { await aoReordenar(f.id, nova); } catch { iniciarMola(); }
  }

  function passoDaMolaNaTela(agora) {
    const dt = Math.min(MOLA.passoMaximo, Math.max(0.001, (agora - ultimoQuadro) / 1000));
    ultimoQuadro = agora;
    let mexendo = false;
    for (const [chave, a] of atual) {
      if (chave === segurado) { mexendo = true; continue; }
      const n = alvoDe(chave);
      const px = passoDaMola({ x: a.x, v: a.vx }, n.x, dt);
      const py = passoDaMola({ x: a.y, v: a.vy }, n.yCurvo, dt);
      [a.x, a.vx, a.y, a.vy] = [px.x, px.v, py.x, py.v];
      if (emRepouso({ x: a.x, v: a.vx }, n.x) && emRepouso({ x: a.y, v: a.vy }, n.yCurvo)) { [a.x, a.y, a.vx, a.vy] = [n.x, n.yCurvo, 0, 0]; } else mexendo = true;
    }
    pintar();
    guardarPosicoes();
    posicionarCartao();
    if (mexendo) molaId = requestAnimationFrame(passoDaMolaNaTela);
    else svg.removeAttribute("data-movendo");
  }

  /** O texto de cada faixa usa a tinta (clara ou escura) de maior contraste sobre o fundo dela, no tema de agora. */
  function ajustarTintas() {
    const estilo = getComputedStyle(svg);
    const clara = estilo.getPropertyValue("--mapa-tinta-clara").trim();
    const escura = estilo.getPropertyValue("--mapa-tinta-escura").trim();
    const [c, e] = [lerCor(clara), lerCor(escura)];
    const fundos = [...mundo.querySelectorAll(".mapa-faixa")].map((f) => lerCor(getComputedStyle(f).fill));
    if (!c || !e) return;
    for (const g of mundo.querySelectorAll(".mapa-no")) {
      const fundo = fundos[Number(g.dataset.faixa)];
      if (!fundo) continue;
      const clarao = melhorTinta(fundo, c, e) === "clara";
      g.style.setProperty("--tinta", clarao ? clara : escura);
      g.style.setProperty("--halo", clarao ? escura : clara);
    }
  }

  /* ---------- seleção: caminho aceso e cartão ---------- */
  const noDe = (chave) => mapa.nos.find((n) => n.chave === chave);
  /**
   * Acende o caminho do ponto em foco: o selecionado (fixo) ou, sem seleção, o ponto sob o mouse (prévia, só no
   * computador; lote 2, item 7). O cartão é só do selecionado.
   */
  function marcarSelecao() {
    if (estado.selecionado && !noDe(estado.selecionado)) estado.selecionado = null; // o ponto saiu do mapa (filtro, exclusão)
    if (previa && !noDe(previa)) previa = null;
    const foco = estado.selecionado ?? previa;
    const caminho = foco ? caminhoDoNo(mapa, foco) : null;
    svg.classList.toggle("com-selecao", Boolean(caminho));
    svg.classList.toggle("em-previa", Boolean(caminho) && !estado.selecionado);
    for (const g of mundo.querySelectorAll(".mapa-no")) {
      g.classList.toggle("no-caminho", Boolean(caminho?.nos.has(g.dataset.no)));
      g.classList.toggle("foco", g.dataset.no === foco);
      g.classList.toggle("selecionado", g.dataset.no === estado.selecionado);
      g.setAttribute("aria-pressed", String(g.dataset.no === estado.selecionado));
    }
    for (const l of mundo.querySelectorAll(".mapa-ligacao, .mapa-ligacao-borda")) l.classList.toggle("ligacao-caminho", Boolean(caminho?.ligacoes.has(`${l.dataset.de}|${l.dataset.para}`)));
    montarCartao();
  }
  /** Prévia do caminho: o ponto sob o mouse, quando nada está selecionado (o clique fixa a seleção). */
  let previa = null;
  function mostrarPrevia(chave) {
    if (chave === previa) return;
    previa = chave;
    if (!estado.selecionado) marcarSelecao();
  }
  function selecionar(chave) {
    estado.selecionado = chave;
    previa = null;
    marcarSelecao();
    if (t) posicionarCartao();
  }
  function montarCartao() {
    const n = estado.selecionado ? noDe(estado.selecionado) : null;
    cartao.hidden = !n;
    if (!n) { cartao.replaceChildren(); return; }
    const faixa = mapa.faixas[n.faixa];
    const nome = document.createElement("strong");
    nome.textContent = n.tipo === "plano" ? n.nome : `${n.codigo ? `${n.codigo} · ` : ""}${n.nome}`;
    const tipo = document.createElement("small");
    tipo.className = "tec";
    tipo.textContent = n.restrito ? "Só quem participa dele vê o nome." : faixa.nome;
    cartao.replaceChildren(nome, tipo);
    if (!n.restrito) {
      const abrir = document.createElement("button");
      abrir.type = "button";
      abrir.className = "botao principal";
      abrir.dataset.mapaAbrir = "";
      abrir.textContent = "Abrir";
      cartao.append(abrir);
    }
  }
  /** O cartão fica junto ao ponto (abaixo dele, ou acima se faltar lugar) e nunca sai da área. */
  function posicionarCartao() {
    const n = estado.selecionado ? noDe(estado.selecionado) : null;
    if (!n || cartao.hidden) return;
    const onde = atual.get(n.chave) ?? { x: n.x, y: n.yCurvo };
    const px = t.x + t.k * onde.x;
    const py = t.y + t.k * onde.y;
    const larg = cartao.offsetWidth;
    const alt = cartao.offsetHeight;
    const esquerda = Math.max(8, Math.min(vista.w - larg - 8, px - larg / 2));
    const abaixo = py + 14 + alt <= vista.h - 8;
    const topo = abaixo ? py + 14 : Math.max(8 + folga().topo, py - 14 - alt); // não sobe para baixo do título e do menu
    cartao.style.transform = `translate(${esquerda.toFixed(1)}px, ${topo.toFixed(1)}px)`;
  }

  /* ---------- vista (movimento e aproximação) ---------- */
  function aplicar(nova) {
    t = limitarTransformacao(nova, limites());
    estado.t = t;
    mundo.setAttribute("transform", `translate(${t.x.toFixed(2)} ${t.y.toFixed(2)}) scale(${t.k.toFixed(4)})`);
    posicionarRotulos();
    posicionarCartao();
    mostrarNomesOuCodigos();
  }

  /** De longe (escala menor que `ESCALA_DOS_NOMES`), só o código de cada item, em tamanho que pareça de 9 px e caiba. */
  let escalaDosCodigos = 0;
  function mostrarNomesOuCodigos() {
    const longe = t.k < ESCALA_DOS_NOMES;
    svg.classList.toggle("de-longe", longe);
    if (!longe || Math.abs(t.k - escalaDosCodigos) < 0.005) return;
    escalaDosCodigos = t.k;
    for (const c of svg.querySelectorAll(".mapa-codigo")) {
      c.style.fontSize = `${Math.max(TAMANHO_DO_NOME, Math.min(Number(c.dataset.maximo), TAMANHO_APARENTE_DO_CODIGO / t.k)).toFixed(1)}px`;
    }
  }

  /** Nome de cada camada, no alto da faixa e preso à borda esquerda, em tamanho fixo; some quando a faixa sai da vista. */
  function posicionarRotulos() {
    const xMundo = Math.min(mapa.largura, Math.max(0, (12 - t.x) / t.k));
    const curva = deslocamentoCurvo(xMundo, mapa.centro, mapa.raio);
    const fonte = `${Math.max(8, Math.min(11, 11 * t.k)).toFixed(1)}px`; // menor quando o mapa inteiro é reduzido, para não cobrir os pontos
    const livre = folga().topo; // o nome da camada não entra sob o título e o menu da tela cheia
    for (const s of rotulos.children) {
      s.style.fontSize = fonte;
      const f = mapa.faixas.find((x) => x.id === s.dataset.camada);
      const topo = t.y + t.k * (f.topo + curva);
      const base = t.y + t.k * (f.base + curva);
      const de = Math.max(topo, livre);
      const ate = Math.min(base, vista.h);
      const cabe = ate - de >= 16;
      s.hidden = !cabe;
      if (cabe) s.style.transform = `translate(12px, ${(de + 3).toFixed(1)}px)`;
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
    const noChave = podeOrdenar && e.pointerType === "mouse" ? e.target.closest?.("[data-no]")?.dataset.no ?? null : null; // o mouse pode arrastar um ponto; o dedo só move o mapa
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, movido: false, noChave, arrastaNo: false });
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
      if (p.noChave) { p.arrastaNo = true; svg.classList.add("arrastando-ponto"); } else svg.classList.add("arrastando");
    }
    if (p.arrastaNo) { arrastarNo(p.noChave, e); return; }
    aplicar({ ...t, x: t.x + (e.clientX - p.x), y: t.y + (e.clientY - p.y) });
    p.x = e.clientX; p.y = e.clientY;
  });
  const soltar = (e) => {
    const p = ponteiros.get(e.pointerId);
    const toque = e.type === "pointerup" && p && !p.movido && ponteiros.size === 1; // sem passar do tremor e sem pinça
    if (!ponteiros.delete(e.pointerId)) return;
    if (p?.arrastaNo) { svg.classList.remove("arrastando-ponto"); soltarNo(p.noChave, e.type === "pointerup"); return; }
    if (toque) {
      const chave = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-no]")?.dataset.no ?? null;
      if (chave) selecionar(chave); else if (!e.target.closest?.("[data-mapa-cartao]")) selecionar(null);
    }
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
  /* prévia ao passar o mouse: só com mouse de verdade (no celular, só o toque); nunca durante um arrasto */
  const passaMouse = (e) => e.pointerType === "mouse" && matchMedia("(hover: hover)").matches;
  svg.addEventListener("pointerover", (e) => {
    if (!passaMouse(e) || ponteiros.size) return;
    const chave = e.target.closest?.("[data-no]")?.dataset.no;
    if (chave) mostrarPrevia(chave);
  });
  svg.addEventListener("pointerout", (e) => {
    if (!passaMouse(e) || !previa) return;
    if (e.relatedTarget?.closest?.("[data-no]")?.dataset.no === previa) return; // ainda dentro do mesmo ponto
    mostrarPrevia(null);
  });
  svg.addEventListener("keydown", (e) => {
    const chave = e.target.closest?.("[data-no]")?.dataset.no;
    if (chave && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selecionar(chave); }
    if (e.key === "Escape") selecionar(null);
  });
  area.addEventListener("click", (e) => {
    const botao = e.target.closest("button");
    if (!botao) return;
    if (botao.matches("[data-mapa-abrir]")) { const n = noDe(estado.selecionado); if (n) aoAbrir(n); }
    else if (botao.matches("[data-mapa-mais]")) animarPara(zoomEm(meioDaVista(), 1.3));
    else if (botao.matches("[data-mapa-menos]")) animarPara(zoomEm(meioDaVista(), 1 / 1.3));
    else if (botao.matches("[data-mapa-centralizar]")) animarPara(transformacaoInicial(limites()));
  });

  /* ---------- tamanho: só reaplica os limites; centraliza apenas na primeira vez ---------- */
  const observador = new ResizeObserver(() => {
    const novo = { w: area.clientWidth, h: area.clientHeight };
    if (!novo.w || !novo.h) return;
    const largouMais = Math.abs(novo.w - vista.w) > 1;
    vista = novo;
    if (largouMais) desenhar(); // a largura do mapa acompanha a da área; só a altura mudar (barra de endereço) não refaz nada
    aplicar(t ?? estado.t ?? transformacaoInicial(limites()));
  });

  svg.classList.toggle("ordenavel", podeOrdenar);
  desenhar();
  if (vista.w && vista.h) aplicar(estado.t ?? transformacaoInicial(limites()));
  observador.observe(area);
  /* as fontes mudam a largura dos nomes: desenha de novo quando carregarem, sem mexer na vista */
  document.fonts?.ready.then(() => { if (area.isConnected) { desenhar(); if (t) aplicar(t); } });

  /* trocar entre dia e noite (pela página ou pelo sistema) muda o fundo das faixas: as tintas do texto são refeitas */
  const mudouTema = () => { if (area.isConnected) ajustarTintas(); };
  const sobreTema = new MutationObserver(mudouTema);
  sobreTema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  const escuroDoSistema = matchMedia("(prefers-color-scheme: dark)");
  escuroDoSistema.addEventListener?.("change", mudouTema);

  return { destruir() { observador.disconnect(); sobreTema.disconnect(); escuroDoSistema.removeEventListener?.("change", mudouTema); cancelAnimationFrame(quadro); cancelAnimationFrame(molaId); } };
}
