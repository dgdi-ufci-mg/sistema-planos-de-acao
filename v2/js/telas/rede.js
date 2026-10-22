/**
 * Modo "Rede" do espaço, o fluxo das ações (especificação, seção 8.4; passo 1.17c, primeira versão).
 * Cada ação é um cartão; as setas ligam cada ação às que dependem dela. Colunas da esquerda
 * para a direita, na ordem em que as ações podem acontecer (regras em `js/rede.js`).
 * Interativa: passar o mouse num cartão destaca tudo o que vem antes e depois dele; clicar abre
 * a ação; "Ver tudo" reduz o desenho para caber na largura da tela.
 * Só no computador (o seletor esconde o modo no celular).
 */
import { montarRede } from "../rede.js";
import { esc, dataBr, plural } from "../formato.js";
import { ICONES } from "../icones.js";

const LARGURA = 240;
const ALTURA = 76;
const VAO_X = 64;
const VAO_Y = 18;
const MARGEM = 16;

/**
 * @param {HTMLElement} alvo
 * @param {{acoes: object[], caminho: object, linhas: object[], etapaDe: Map<string, string>, usaCodigos: boolean,
 *   escala: string, aoMudarEscala: (escala: string) => void}} dados
 *   linhas: as linhas da lista (lista.js), para as datas e situações já calculadas
 */
export function desenharRede(alvo, { acoes, caminho, linhas, etapaDe, usaCodigos, escala, aoMudarEscala }) {
  if (!acoes.length) {
    alvo.innerHTML = `<p class="lista-vazia">Este espaço ainda não tem ações. A rede aparece quando houver ações.</p>`;
    return;
  }
  const { colunas, arestas } = montarRede(acoes, caminho);
  const linhaDe = new Map(linhas.map((l) => [l.acao.numero, l]));
  const maior = Math.max(...colunas.map((c) => c.length));
  const largura = MARGEM * 2 + colunas.length * LARGURA + (colunas.length - 1) * VAO_X;
  const altura = MARGEM * 2 + maior * ALTURA + (maior - 1) * VAO_Y;

  /* posição de cada cartão: colunas centradas na vertical */
  const pos = new Map();
  colunas.forEach((col, c) => {
    const sobra = (maior - col.length) * (ALTURA + VAO_Y) / 2;
    col.forEach((n, i) => pos.set(n, { x: MARGEM + c * (LARGURA + VAO_X), y: MARGEM + sobra + i * (ALTURA + VAO_Y) }));
  });

  const cartoes = acoes.map((a) => {
    const { x, y } = pos.get(a.numero);
    const l = linhaDe.get(a.numero);
    const c = caminho.porAcao.get(a.numero);
    const classe = l.situacao === "concluida" ? "concluida" : l.semEstimativa ? "sem-estimativa" : c.critica ? "critica" : "folga";
    const rodape = l.situacao === "concluida" ? `Concluída em ${dataBr(l.conclusao)}`
      : l.semEstimativa ? "Falta estimar"
      : `Até ${dataBr(l.conclusao)} · ${c.critica ? "sem folga" : `folga ${Math.round(c.folga)} ${plural(Math.round(c.folga), "dia", "dias")}`}`;
    return `<div class="rede-no ${classe}" style="left:${x}px;top:${y}px;width:${LARGURA}px;height:${ALTURA}px" data-numero="${a.numero}">
      <div class="rede-cartao" role="button" tabindex="0" data-abrir-acao data-rede-no="${a.numero}"
        title="${esc(etapaDe.get(a.etapa) ? `${etapaDe.get(a.etapa)}: ${a.rotulo}` : a.rotulo)}">
        <span class="rede-rotulo">${usaCodigos && a.codigo ? `<span class="codigo">${esc(a.codigo)}</span>` : ""}<span data-editar="rotulo">${esc(a.rotulo)}</span></span>
        <span class="rede-rodape">${l.atrasada ? `<span class="icone-atrasada">${ICONES.atrasada}</span>` : ""}<span class="mono">${rodape}</span></span>
      </div>
    </div>`;
  }).join("");

  const setas = arestas.map(({ de, para, critica }) => {
    const a = pos.get(de);
    const b = pos.get(para);
    const x1 = a.x + LARGURA;
    const y1 = a.y + ALTURA / 2;
    const x2 = b.x - 2;
    const y2 = b.y + ALTURA / 2;
    const meio = Math.min(VAO_X * 0.75, (x2 - x1) / 2);
    return `<path class="rede-seta${critica ? " critica" : ""}" data-de="${de}" data-para="${para}"
      d="M${x1},${y1} C${x1 + meio},${y1} ${x2 - meio},${y2} ${x2},${y2}" marker-end="url(#rede-ponta${critica ? "-critica" : ""})"/>`;
  }).join("");

  const anterior = alvo.querySelector("[data-rede-rolagem]");
  const rolagemAnterior = anterior ? [anterior.scrollLeft, anterior.scrollTop] : null;
  alvo.innerHTML = `
    <div class="crono-ferramentas">
      <div class="alternador" role="group" aria-label="Tamanho">
        ${[["normal", "Normal"], ["tudo", "Ver tudo"]].map(([v, nome]) => `<button type="button" data-escala="${v}" aria-pressed="${v === escala}">${nome}</button>`).join("")}
      </div>
      <div class="crono-legendas">
        <span class="crono-legenda"><i class="critica"></i>Sem folga <a href="#" class="oque" data-termo="folga">o que é?</a></span>
        <span class="crono-legenda"><i class="folga"></i>Com folga</span>
        <span class="crono-legenda"><i class="concluida"></i>Concluída</span>
      </div>
    </div>
    <div class="rede" data-rede>
      <div class="rede-rolagem" data-rede-rolagem>
        <div class="rede-tamanho" data-tamanho>
          <div class="rede-conteudo" data-conteudo style="width:${largura}px;height:${altura}px">
            <svg class="rede-setas" width="${largura}" height="${altura}" aria-hidden="true">
              <defs>
                <marker id="rede-ponta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker>
                <marker id="rede-ponta-critica" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker>
              </defs>
              ${setas}
            </svg>
            ${cartoes}
          </div>
        </div>
      </div>
    </div>
    <p class="tec">Da esquerda para a direita, na ordem em que as ações podem acontecer. Passe o mouse numa ação para destacar o que vem antes e depois dela; clique para abri-la. Termo técnico: diagrama de rede PERT/CPM (<a href="#" class="oque" data-termo="rede">o que é?</a>).</p>`;

  /* ---------- tamanho: "Ver tudo" reduz para caber na largura ---------- */
  const rolagem = alvo.querySelector("[data-rede-rolagem]");
  const tamanho = alvo.querySelector("[data-tamanho]");
  const conteudo = alvo.querySelector("[data-conteudo]");
  const fator = escala === "tudo" ? Math.min(1, (rolagem.clientWidth - 2) / largura) : 1;
  conteudo.style.transform = fator < 1 ? `scale(${fator})` : "";
  tamanho.style.width = `${largura * fator}px`;
  tamanho.style.height = `${altura * fator}px`;
  if (rolagemAnterior && escala === alvo.dataset.redeEscala) [rolagem.scrollLeft, rolagem.scrollTop] = rolagemAnterior;
  alvo.dataset.redeEscala = escala;

  alvo.querySelector(".crono-ferramentas").onclick = (e) => {
    const b = e.target.closest("[data-escala]");
    if (b && b.dataset.escala !== escala) aoMudarEscala(b.dataset.escala);
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
