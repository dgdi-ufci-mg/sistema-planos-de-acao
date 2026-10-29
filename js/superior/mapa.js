/**
 * Tela do Mapa do Strata (lote 1 de 29/10/2026; documentação técnica, seção 8, "Mapa"). Desenha em SVG a geometria
 * calculada por `js/mapa.js`: as faixas curvas, as linhas "vem de" e os pontos, com os nomes das camadas presos à
 * borda esquerda, em tamanho fixo. Sem biblioteca externa (regra do repositório: nada de dependências novas).
 */
import { calcularMapa, caminhoDaFaixa, caminhoDaLigacao, deslocamentoCurvo } from "../mapa.js";

const NS = "http://www.w3.org/2000/svg";
/** Até esta largura da área, o nome da camada vai acima da faixa, e não no meio dela. */
const LARGURA_DE_CELULAR = 640;

const criar = (nome, atributos = {}) => {
  const e = document.createElementNS(NS, nome);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, v);
  return e;
};

/**
 * @param {HTMLElement} area  contêiner do mapa (com altura definida pelo CSS)
 * @param {{camadas: object[], itens: object[], planos: object[], estado: object}} contexto
 *   `estado` guarda a vista do mapa entre um desenho e outro da tela
 * @returns {{destruir: () => void}}
 */
export function criarVistaMapa(area, { camadas, itens, planos, estado }) {
  area.innerHTML = `
    <svg class="mapa-svg" role="group" aria-label="Mapa do desdobramento: do alto, o que vem primeiro; embaixo, os Planos de Ação" focusable="false">
      <g data-mapa-mundo></g>
      <text class="mapa-nome mapa-medida" x="0" y="0" aria-hidden="true"></text>
    </svg>
    <div class="mapa-rotulos" aria-hidden="true"></div>`;
  const svg = area.querySelector(".mapa-svg");
  const mundo = svg.querySelector("[data-mapa-mundo]");
  const medidor = svg.querySelector(".mapa-medida");
  const rotulos = area.querySelector(".mapa-rotulos");

  let mapa = null;
  let vista = { w: area.clientWidth, h: area.clientHeight };
  let t = { k: 1, x: 0, y: 24 };

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

  /* ---------- vista ---------- */
  function aplicar(nova) {
    t = nova;
    estado.t = t;
    mundo.setAttribute("transform", `translate(${t.x.toFixed(2)} ${t.y.toFixed(2)}) scale(${t.k})`);
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

  desenhar();
  aplicar({ k: 1, x: Math.max(0, (vista.w - mapa.largura) / 2), y: 24 });
  /* as fontes mudam a largura dos nomes: desenha de novo quando carregarem */
  document.fonts?.ready.then(() => { if (area.isConnected) { desenhar(); aplicar(t); } });

  return { destruir() {} };
}
