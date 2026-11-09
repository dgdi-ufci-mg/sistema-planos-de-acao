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

/**
 * Seleção na Rede (09/11/2026): sobrevive aos redesenhos que cada gravação provoca.
 * `{tipo: "no", numero}` ou `{tipo: "seta", de, para}`. `renomearAoDesenhar` é a ação recém-criada pelo "+",
 * que abre o nome para edição assim que aparece.
 */
let selecao = null;
let renomearAoDesenhar = null;
/** Renomear no desenho mais recente: a resposta do "+" pode chegar depois de um redesenho. */
let renomearNoAtual = () => false;

/** Raio dos círculos de início e de término (27/10/2026). */
const RAIO = MEDIDAS.raioPonta;

export function desenharRede(alvo, { acoes, caminho, linhas, etapaDe, identificador, donos, situacao, marcos: etapas = null, escala, aoMudarEscala,
  inicio = null, termino = null, prazoFinal = null, edicao = null }) {
  if (!acoes.length) {
    alvo.innerHTML = `<p class="lista-vazia">Este espaço ainda não tem ações. A rede aparece quando houver ações.</p>`;
    return;
  }
  /*
   * Cercas e marcos (27/10/2026, pedido do responsável): as ações ficam nas colunas pelas dependências; cada etapa
   * ganha uma cerca em volta só dos seus cartões, com o nome no alto; cada fase, uma linha vertical onde termina.
   * Início e término entram na montagem como nós, para as linhas deles seguirem as mesmas regras das setas.
   */
  const { pos, arestas, cercas, fases, pontas, topo, largura, altura } = montarRede(acoes, caminho,
    { pontas: true, ...(etapas ? { marcos: etapas, marcoDe: (a) => a.etapa } : {}) });
  const cercasHtml = cercas.map((c) => `<div class="rede-cerca" style="left:${c.x}px;top:${c.y}px;width:${c.largura}px;height:${c.altura}px">
      <span class="rede-cerca-nome" title="${esc(c.titulo)}">${esc(c.nome)}</span></div>`).join("");
  /* fases que terminam no mesmo vão dividem a linha; os nomes ficam juntos */
  const porX = new Map();
  for (const f of fases) (porX.get(f.x) ?? porX.set(f.x, []).get(f.x)).push(f.nome);
  const fasesHtml = [...porX].map(([x, nomes]) => `<div class="rede-fase-marco" style="left:${x}px;top:${topo}px;height:${altura - topo * 2}px">
      <span class="rede-fase-nome" title="Fim: ${esc(nomes.join(", "))}">${esc(nomes.join(" · "))}</span></div>`).join("");

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
    return `<div class="rede-no ${classe}" style="left:${x}px;top:${y}px;width:${MEDIDAS.largura}px;height:${MEDIDAS.altura}px" data-numero="${a.numero}">
      <div class="rede-cartao" role="button" tabindex="0" data-abrir-acao data-rede-no="${a.numero}"
        title="${esc(etapaDe.get(a.etapa) ? `${etapaDe.get(a.etapa)}: ${a.rotulo}` : a.rotulo)}">
        <span class="rede-topo">${situacao(l)}<span class="rede-rotulo">${identificador(a)}<span data-editar="rotulo">${esc(a.rotulo)}</span></span></span>
        <span class="rede-base"><span class="donos">${donos(a)}</span>
          <span class="rede-data${l.atrasada ? " atrasada" : ""}"><span class="mono">${l.atrasada ? `<span class="icone-atrasada">${ICONES.atrasada}</span>` : ""}${data}</span>${folga ? `<small>${folga}</small>` : ""}</span></span>
      </div>${edicao ? `
      ${edicao.podeCriar ? `<button type="button" class="rede-mais" data-rede-mais="${a.numero}" title="Criar a próxima ação, ligada a esta" aria-label="Criar a próxima ação depois de ${esc(a.rotulo)}">${ICONES.mais}</button>` : ""}
      <span class="rede-alca" data-rede-alca="${a.numero}" title="Arraste até outra ação para ligá-las"></span>` : ""}
    </div>`;
  }).join("");

  /* início e término (27/10/2026, pedido do responsável): círculos verdes e vermelhos com as datas */
  const circulo = (classe, { x: cx, y: cy }, rotulo, data, extra = "") => `<div class="rede-ponto ${classe}" style="left:${cx - RAIO}px;top:${cy - RAIO}px;width:${RAIO * 2}px;height:${RAIO * 2}px">
      <span class="rede-ponto-rotulo">${rotulo}</span><span class="rede-ponto-data mono">${data ? dataBr(data) : "—"}</span>${extra}</div>`;
  const pontosHtml = circulo("inicio", pontas.inicio, "Início", inicio)
    + circulo("termino", pontas.termino, "Término", termino, prazoFinal ? `<span class="rede-ponto-prazo">prazo ${dataBr(prazoFinal)}</span>` : "");

  const setas = arestas.map(({ de, para, critica, volta, ligacao, pontos, saltos }) => (ligacao
    ? `<path class="rede-ligacao" data-de="${de}" data-para="${para}" d="${caminhoDaSeta(pontos, saltos)}" marker-end="url(#rede-ponta)"/>`
    : `<path class="rede-seta${critica ? " critica" : ""}${volta ? " volta" : ""}" data-de="${de}" data-para="${para}"
      d="${caminhoDaSeta(pontos, saltos)}" marker-end="url(#rede-ponta${critica ? "-critica" : ""})"/>${edicao ? `
      <path class="rede-seta-alvo" data-seta-de="${de}" data-seta-para="${para}" d="${caminhoDaSeta(pontos, saltos)}"><title>Clique para selecionar; Delete retira a ligação</title></path>` : ""}`)).join("");

  const anterior = alvo.querySelector("[data-rede-rolagem]");
  const focoDentro = alvo.contains(document.activeElement);
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
      <p class="tec rede-explicacao">Da esquerda para a direita, na ordem em que as ações podem acontecer. ${edicao
        ? `Clique numa ação para selecioná-la; o <b>+</b> cria a próxima e a bolinha, arrastada até outra ação, liga as duas. Duplo clique renomeia; Enter abre. Clique numa seta e aperte Delete para desligar.`
        : `Passe o mouse numa ação para destacar o que vem antes e depois dela; clique para abri-la.`} Ctrl + rolar o mouse aproxima e afasta; arraste o fundo para mover a rede. Termo técnico: diagrama de rede PERT/CPM (<a href="#" class="oque" data-termo="rede">o que é?</a>).</p>
    </div>
    <div class="rede${edicao ? " editavel" : ""}" data-rede tabindex="-1">
      <div class="rede-rolagem" data-rede-rolagem>
        <div class="rede-tamanho" data-tamanho>
          <div class="rede-conteudo" data-conteudo style="width:${largura}px;height:${altura}px">
            ${cercasHtml}${fasesHtml}
            <svg class="rede-setas" width="${largura}" height="${altura}" aria-hidden="true">
              <defs>
                <marker id="rede-ponta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker>
                <marker id="rede-ponta-critica" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker>
              </defs>
              ${setas}
            </svg>
            ${cartoes}
            ${pontosHtml}
            ${edicao ? `<svg class="rede-ligando" width="${largura}" height="${altura}" aria-hidden="true"><path data-ligando d=""/></svg>` : ""}
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
  /* arrastar o fundo (fora dos cartões) move a rede; um arrasto não conta como clique no fundo */
  let moveuFundo = false;
  rolagem.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("[data-rede-no], [data-rede-mais], [data-rede-alca], .rede-seta-alvo")) return;
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

  if (edicao) ativarEdicao({ caixa, rolagem, conteudo, fator: () => fator, edicao, destacar, limpar, focoDentro, moveuFundo: () => moveuFundo });
}

/**
 * Edição dentro da Rede (09/11/2026, pedido do responsável; documentação técnica, seção 8.4).
 * Clique seleciona (não abre); duplo clique ou F2 renomeia; Enter abre a ação; o "+" cria a próxima ação, já
 * ligada e com o nome aberto para digitar; a bolinha, arrastada até outro cartão, cria a dependência; uma seta
 * selecionada sai com Delete. Esc tira a seleção.
 */
function ativarEdicao({ caixa, rolagem, conteudo, fator, edicao, destacar, limpar, focoDentro, moveuFundo }) {
  const no = (n) => caixa.querySelector(`.rede-no[data-numero="${n}"]`);
  const seta = (de, para) => caixa.querySelector(`.rede-seta[data-de="${de}"][data-para="${para}"]`);
  const marcar = () => {
    for (const el of caixa.querySelectorAll(".selecionada")) el.classList.remove("selecionada");
    if (selecao?.tipo === "no") no(selecao.numero)?.classList.add("selecionada");
    if (selecao?.tipo === "seta") seta(selecao.de, selecao.para)?.classList.add("selecionada");
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
  const renomear = (n) => {
    const campo = no(n)?.querySelector('[data-editar="rotulo"]');
    if (!campo) return false;
    selecionarNo(n, false);
    mostrar(n);
    edicao.renomear(campo);
    return true;
  };

  renomearNoAtual = renomear;
  marcar();
  if (renomearAoDesenhar != null && renomear(renomearAoDesenhar)) renomearAoDesenhar = null;
  else if (focoDentro && selecao?.tipo === "no") no(selecao.numero)?.querySelector("[data-rede-no]")?.focus({ preventScroll: true });
  else if (focoDentro && selecao?.tipo === "seta") caixa.focus({ preventScroll: true });

  /* cliques: na fase de captura, para que o clique num cartão selecione em vez de abrir a janela */
  caixa.addEventListener("click", (e) => {
    if (e.target.closest("[data-editando]")) return e.stopPropagation();
    const mais = e.target.closest("[data-rede-mais]");
    if (mais) {
      e.stopPropagation();
      const origem = Number(mais.dataset.redeMais);
      mais.disabled = true;
      edicao.criarDepois(origem).then((numero) => {
        mais.disabled = false;
        if (numero == null) return;
        /* o redesenho pode chegar antes ou depois da resposta */
        if (!renomearNoAtual(numero)) { renomearAoDesenhar = numero; selecao = { tipo: "no", numero }; }
      });
      return;
    }
    if (e.target.closest("[data-rede-alca]")) return e.stopPropagation();
    const alvoSeta = e.target.closest(".rede-seta-alvo");
    if (alvoSeta) { e.stopPropagation(); return selecionarSeta(Number(alvoSeta.dataset.setaDe), Number(alvoSeta.dataset.setaPara)); }
    const cartao = e.target.closest("[data-rede-no]");
    if (cartao) {
      if (e.altKey) return; // Alt+clique continua editando no lugar (22/10/2026)
      e.stopPropagation();
      return selecionarNo(Number(cartao.dataset.redeNo));
    }
    if (e.target.closest(".rede-rolagem") && !moveuFundo()) desmarcar();
  }, true);
  caixa.addEventListener("dblclick", (e) => {
    const cartao = e.target.closest("[data-rede-no]");
    if (!cartao || e.target.closest("[data-editando]")) return;
    e.preventDefault();
    renomear(Number(cartao.dataset.redeNo));
  });
  caixa.addEventListener("keydown", (e) => {
    if (e.target.closest("[data-editando]")) return;
    if (e.key === "Escape" && selecao) { e.stopPropagation(); desmarcar(); return caixa.focus({ preventScroll: true }); }
    if (selecao?.tipo === "seta" && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      e.stopPropagation();
      const { de, para } = selecao;
      selecao = null;
      edicao.desligar(de, para);
      return;
    }
    const cartao = e.target.closest("[data-rede-no]");
    if (!cartao) return;
    const n = Number(cartao.dataset.redeNo);
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); return edicao.abrir(n); }
    if (e.key === "F2") { e.preventDefault(); e.stopPropagation(); return renomear(n); }
  }, true);
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
