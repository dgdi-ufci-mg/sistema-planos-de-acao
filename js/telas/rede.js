/**
 * Modo "Rede" do espaço, o fluxo das ações (documentação técnica, seção 8.4; passo 1.17c, primeira versão).
 * Cada ação é um cartão; as setas ligam cada ação às que dependem dela. Colunas da esquerda
 * para a direita, na ordem em que as ações podem acontecer (regras em `js/rede.js`).
 * Interativa: passar o mouse num cartão destaca tudo o que vem antes e depois dele; clicar abre
 * a ação; "Ver tudo" reduz o desenho para caber na largura da tela.
 * Só no computador (o seletor esconde o modo no celular).
 */
import { montarRede, caminhoDaSeta, MEDIDAS } from "../rede.js";
import { esc, dataBr, plural } from "../formato.js";
import { ICONES } from "../icones.js";

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

/** Espaço, de cada lado, para os círculos de início e de término (27/10/2026). */
const LADO = 132;
const RAIO = 40;

export function desenharRede(alvo, { acoes, caminho, linhas, etapaDe, identificador, donos, situacao, marcos: etapas = null, escala, aoMudarEscala,
  inicio = null, termino = null, prazoFinal = null }) {
  if (!acoes.length) {
    alvo.innerHTML = `<p class="lista-vazia">Este espaço ainda não tem ações. A rede aparece quando houver ações.</p>`;
    return;
  }
  /* com fases, o cabeçalho tem duas linhas: o nome da fase e o da etapa (27/10/2026) */
  const { pos, arestas, marcos, largura: larguraRede, altura } = montarRede(acoes, caminho, etapas ? { marcos: etapas, marcoDe: (a) => a.etapa, medidas: { cabecaMarco: 58 } } : {});
  /* tudo se desloca para a direita, para caber o círculo de início; o de término fica depois do fim */
  const largura = larguraRede + LADO * 2;
  const desloc = (x) => x + LADO;
  /*
   * Cercas (27/10/2026, pedido do responsável), no lugar dos marcos (milestones) do Bizagi: uma faixa de fundo suave
   * por fase, com o nome da fase no alto, e, dentro dela, uma linha tracejada separando as etapas, com o nome da
   * etapa logo abaixo do da fase. As etapas vêm da montagem da rede (uma faixa de colunas por etapa).
   */
  const fases = [];
  for (const m of marcos) {
    const ultima = fases.at(-1);
    if (ultima && ultima.fase === (m.fase ?? m.id)) ultima.etapas.push(m);
    else fases.push({ fase: m.fase ?? m.id, nome: m.faseNome ?? m.nome, etapas: [m] });
  }
  const topo = MEDIDAS.margem;
  const alto = altura - MEDIDAS.margem * 2;
  const marcosHtml = fases.map((f, i) => {
    const x0 = f.etapas[0].x;
    const x1 = f.etapas.at(-1).x + f.etapas.at(-1).largura;
    const etapasHtml = f.etapas.map((m, k) => `<div class="rede-etapa${k ? " cerca" : ""}" style="left:${m.x - x0}px;width:${m.largura}px">
        <span class="rede-etapa-nome" title="${esc(m.titulo)}">${esc(m.faseNome ? m.nome : "")}</span></div>`).join("");
    return `<div class="rede-fase${i % 2 ? " par" : ""}" style="left:${desloc(x0)}px;width:${x1 - x0}px;top:${topo}px;height:${alto}px">
      <span class="rede-fase-nome" title="${esc(f.nome)}">${esc(f.nome)}</span>${etapasHtml}</div>`;
  }).join("");

  const linhaDe = new Map(linhas.map((l) => [l.acao.numero, l]));

  /* cartões no padrão do quadro (22/10/2026): situação e nome, etapa, responsáveis e data */
  const cartoes = acoes.map((a) => {
    const { x, y } = pos.get(a.numero);
    const l = linhaDe.get(a.numero);
    const c = caminho.porAcao.get(a.numero);
    const classe = l.situacao === "concluida" ? "concluida" : l.semEstimativa ? "sem-estimativa" : c.critica ? "critica" : "folga";
    const data = l.situacao === "concluida" ? `Concluída ${dataBr(l.conclusao)}`
      : l.semEstimativa ? "Falta estimar" : l.conclusao ? `Até ${dataBr(l.conclusao)}` : "Sem data-limite";
    /* espaço com data-limite (passo 2.4b): sem caminho crítico, sem folga */
    const folga = l.situacao === "concluida" || l.semEstimativa || c.folga == null ? ""
      : c.critica ? "sem folga" : `folga ${Math.round(c.folga)} ${plural(Math.round(c.folga), "dia", "dias")}`;
    return `<div class="rede-no ${classe}" style="left:${desloc(x)}px;top:${y}px;width:${MEDIDAS.largura}px;height:${MEDIDAS.altura}px" data-numero="${a.numero}">
      <div class="rede-cartao" role="button" tabindex="0" data-abrir-acao data-rede-no="${a.numero}"
        title="${esc(etapaDe.get(a.etapa) ? `${etapaDe.get(a.etapa)}: ${a.rotulo}` : a.rotulo)}">
        <span class="rede-topo">${situacao(l)}<span class="rede-rotulo">${identificador(a)}<span data-editar="rotulo">${esc(a.rotulo)}</span></span></span>
        <span class="rede-base"><span class="donos">${donos(a)}</span>
          <span class="rede-data${l.atrasada ? " atrasada" : ""}"><span class="mono">${l.atrasada ? `<span class="icone-atrasada">${ICONES.atrasada}</span>` : ""}${data}</span>${folga ? `<small>${folga}</small>` : ""}</span></span>
      </div>
    </div>`;
  }).join("");

  /* início e término (27/10/2026, pedido do responsável): círculos verdes e vermelhos com as datas, ligados por
     linhas finas tracejadas às ações que não têm anteriores e às que não têm seguintes */
  const temAntes = new Set(arestas.map((a) => a.para));
  const temDepois = new Set(arestas.map((a) => a.de));
  const meio = Math.round(Math.max(altura, 2 * RAIO + 60) / 2);
  const xInicio = LADO / 2;
  const xFim = largura - LADO / 2;
  const ligacoes = acoes.flatMap((a) => {
    const { x, y } = pos.get(a.numero);
    const yc = y + MEDIDAS.altura / 2;
    const xe = desloc(x);
    const xd = desloc(x) + MEDIDAS.largura;
    return [
      !temAntes.has(a.numero) ? `<path class="rede-ligacao" d="M${xInicio + RAIO},${meio} H${xInicio + RAIO + 20} V${yc} H${xe - 3}" marker-end="url(#rede-ponta)"/>` : "",
      !temDepois.has(a.numero) ? `<path class="rede-ligacao" d="M${xd},${yc} H${xFim - RAIO - 20} V${meio} H${xFim - RAIO - 3}" marker-end="url(#rede-ponta)"/>` : "",
    ];
  }).join("");
  const circulo = (classe, cx, rotulo, data, extra = "") => `<div class="rede-ponto ${classe}" style="left:${cx - RAIO}px;top:${meio - RAIO}px;width:${RAIO * 2}px;height:${RAIO * 2}px">
      <span class="rede-ponto-rotulo">${rotulo}</span><span class="rede-ponto-data mono">${data ? dataBr(data) : "—"}</span>${extra}</div>`;
  const pontos = circulo("inicio", xInicio, "Início", inicio)
    + circulo("termino", xFim, "Término", termino, prazoFinal ? `<span class="rede-ponto-prazo">prazo ${dataBr(prazoFinal)}</span>` : "");

  const setas = arestas.map(({ de, para, critica, volta, pontos, saltos }) => `<path class="rede-seta${critica ? " critica" : ""}${volta ? " volta" : ""}" data-de="${de}" data-para="${para}"
      d="${caminhoDaSeta(pontos, saltos)}" marker-end="url(#rede-ponta${critica ? "-critica" : ""})"/>`).join("");

  const anterior = alvo.querySelector("[data-rede-rolagem]");
  const rolagemAnterior = anterior ? [anterior.scrollLeft, anterior.scrollTop] : null;
  alvo.innerHTML = `
    <div class="crono-ferramentas">
      <div class="alternador" role="group" aria-label="Tamanho">
        ${[["normal", "Normal"], ["tudo", "Ver tudo"]].map(([v, nome]) => `<button type="button" data-escala="${v}" aria-pressed="${v === escala && !alvo.dataset.redeZoom}">${nome}</button>`).join("")}
      </div>
      <div class="zoom-rede" role="group" aria-label="Zoom">
        <button type="button" class="icone-barra" data-zoom-passo="-1" title="Afastar (Ctrl + rolar)" aria-label="Afastar">−</button>
        <span class="zoom-valor" data-zoom-valor aria-live="polite"></span>
        <button type="button" class="icone-barra" data-zoom-passo="1" title="Aproximar (Ctrl + rolar)" aria-label="Aproximar">+</button>
      </div>
      <div class="crono-legendas">
        <span class="crono-legenda"><i class="critica"></i>Sem folga <a href="#" class="oque" data-termo="folga">o que é?</a></span>
        <span class="crono-legenda"><i class="folga"></i>Com folga</span>
        <span class="crono-legenda"><i class="concluida"></i>Concluída</span>
      </div>
      <p class="tec rede-explicacao">Da esquerda para a direita, na ordem em que as ações podem acontecer. Passe o mouse numa ação para destacar o que vem antes e depois dela; clique para abri-la. Ctrl + rolar o mouse aproxima e afasta; arraste o fundo para mover a rede. Termo técnico: diagrama de rede PERT/CPM (<a href="#" class="oque" data-termo="rede">o que é?</a>).</p>
    </div>
    <div class="rede" data-rede>
      <div class="rede-rolagem" data-rede-rolagem>
        <div class="rede-tamanho" data-tamanho>
          <div class="rede-conteudo" data-conteudo style="width:${largura}px;height:${Math.max(altura, meio * 2)}px">
            ${marcosHtml}
            <svg class="rede-setas" width="${largura}" height="${Math.max(altura, meio * 2)}" aria-hidden="true">
              <defs>
                <marker id="rede-ponta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker>
                <marker id="rede-ponta-critica" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker>
              </defs>
              ${ligacoes}
              <g transform="translate(${LADO},0)">${setas}</g>
            </svg>
            ${cartoes}
            ${pontos}
          </div>
        </div>
      </div>
    </div>`;

  /* ---------- tamanho e zoom (22/10/2026): Ctrl + rolar aproxima e afasta, em volta do cursor, como
     nos quadros infinitos; arrastar o fundo move a rede. "Normal" é 100%; "Ver tudo" cabe na área ---------- */
  const rolagem = alvo.querySelector("[data-rede-rolagem]");
  const tamanho = alvo.querySelector("[data-tamanho]");
  const conteudo = alvo.querySelector("[data-conteudo]");
  const valor = alvo.querySelector("[data-zoom-valor]");
  const MIN = 0.2;
  const MAX = 2.5;
  /* a rede vai até o fim da tela (23/10/2026): a altura é o que sobra abaixo dela, com uma margem */
  const ajustarAltura = () => {
    if (!rolagem.isConnected) return removeEventListener("resize", ajustarAltura);
    rolagem.style.height = `${Math.max(320, Math.floor(innerHeight - (rolagem.getBoundingClientRect().top + scrollY) - 16))}px`;
  };
  ajustarAltura();
  if (aoRedimensionar) removeEventListener("resize", aoRedimensionar);
  aoRedimensionar = ajustarAltura;
  addEventListener("resize", ajustarAltura);
  const alturaUtil = rolagem.clientHeight;
  const caber = () => Math.min(1, (rolagem.clientWidth - 2) / largura, (alturaUtil - 2) / altura);
  let fator = alvo.dataset.redeZoom ? Number(alvo.dataset.redeZoom) : escala === "tudo" ? caber() : 1;
  const aplicar = (novo, cx = rolagem.clientWidth / 2, cy = rolagem.clientHeight / 2) => {
    novo = Math.min(MAX, Math.max(MIN, novo));
    const px = (rolagem.scrollLeft + cx) / fator; // ponto da rede sob o cursor
    const py = (rolagem.scrollTop + cy) / fator;
    fator = novo;
    conteudo.style.transform = fator !== 1 ? `scale(${fator})` : "";
    tamanho.style.width = `${largura * fator}px`;
    tamanho.style.height = `${altura * fator}px`;
    rolagem.scrollLeft = px * fator - cx;
    rolagem.scrollTop = py * fator - cy;
    valor.textContent = `${Math.round(fator * 100)}%`;
  };
  const zoomLivre = (novo, cx, cy) => {
    aplicar(novo, cx, cy);
    alvo.dataset.redeZoom = String(fator);
    for (const b of alvo.querySelectorAll("[data-escala]")) b.setAttribute("aria-pressed", "false");
  };
  aplicar(fator, 0, 0);
  if (rolagemAnterior && escala === alvo.dataset.redeEscala) [rolagem.scrollLeft, rolagem.scrollTop] = rolagemAnterior;
  alvo.dataset.redeEscala = escala;

  rolagem.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return; // sem Ctrl, rola normalmente
    e.preventDefault();
    const r = rolagem.getBoundingClientRect();
    zoomLivre(fator * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  /* arrastar o fundo (fora dos cartões) move a rede */
  rolagem.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("[data-rede-no]")) return;
    const inicio = { x: e.clientX, y: e.clientY, l: rolagem.scrollLeft, t: rolagem.scrollTop };
    rolagem.setPointerCapture(e.pointerId);
    rolagem.classList.add("arrastando");
    const mover = (ev) => { rolagem.scrollLeft = inicio.l - (ev.clientX - inicio.x); rolagem.scrollTop = inicio.t - (ev.clientY - inicio.y); };
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

  alvo.querySelector(".crono-ferramentas").onclick = (e) => {
    const z = e.target.closest("[data-zoom-passo]");
    if (z) return zoomLivre(fator * (Number(z.dataset.zoomPasso) > 0 ? 1.2 : 1 / 1.2));
    const b = e.target.closest("[data-escala]");
    if (!b) return;
    delete alvo.dataset.redeZoom;
    if (b.dataset.escala !== escala) return aoMudarEscala(b.dataset.escala);
    aplicar(escala === "tudo" ? caber() : 1);
    for (const x of alvo.querySelectorAll("[data-escala]")) x.setAttribute("aria-pressed", String(x === b));
  };

  /* ---------- destaque: tudo o que vem antes e depois da ação apontada ---------- */
  const antes = new Map(acoes.map((a) => [a.numero, []]));
  const depois = new Map(acoes.map((a) => [a.numero, []]));
  for (const { de, para } of arestas) { antes.get(para).push(de); depois.get(de).push(para); }
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
}
