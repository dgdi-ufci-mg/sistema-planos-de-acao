/**
 * Modo "Rede" do espaço, o fluxo das ações (especificação, seção 8.4; passo 1.17c, primeira versão).
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
 *   raias: {id: string, nome: string, titulo?: string}[]|null, escala: string, aoMudarEscala: (escala: string) => void}} dados
 *   linhas: as linhas da lista (lista.js), para as datas e situações já calculadas;
 *   donos e situacao: o mesmo desenho dos cartões do quadro (22/10/2026)
 */
export function desenharRede(alvo, { acoes, caminho, linhas, etapaDe, identificador, donos, situacao, raias: etapas = null, escala, aoMudarEscala }) {
  if (!acoes.length) {
    alvo.innerHTML = `<p class="lista-vazia">Este espaço ainda não tem ações. A rede aparece quando houver ações.</p>`;
    return;
  }
  const { pos, arestas, raias, largura, altura } = montarRede(acoes, caminho, etapas ? { raias: etapas, raiaDe: (a) => a.etapa } : {});
  /* raias: uma por etapa, como no Bizagi (22/10/2026) */
  const raiasHtml = etapas ? raias.map((r, i) => `<div class="rede-raia${i % 2 ? " par" : ""}${i === raias.length - 1 ? " ultima" : ""}" style="top:${r.y}px;height:${r.altura}px;width:${largura - MEDIDAS.margem * 2}px;left:${MEDIDAS.margem}px" title="${esc(r.titulo)}">
      <span class="rede-raia-nome"><span>${esc(r.nome)}</span></span></div>`).join("") : "";
  const linhaDe = new Map(linhas.map((l) => [l.acao.numero, l]));

  /* cartões no padrão do quadro (22/10/2026): situação e nome, etapa, responsáveis e data */
  const cartoes = acoes.map((a) => {
    const { x, y } = pos.get(a.numero);
    const l = linhaDe.get(a.numero);
    const c = caminho.porAcao.get(a.numero);
    const classe = l.situacao === "concluida" ? "concluida" : l.semEstimativa ? "sem-estimativa" : c.critica ? "critica" : "folga";
    const data = l.situacao === "concluida" ? `Concluída ${dataBr(l.conclusao)}`
      : l.semEstimativa ? "Falta estimar" : `Até ${dataBr(l.conclusao)}`;
    const folga = l.situacao === "concluida" || l.semEstimativa ? ""
      : c.critica ? "sem folga" : `folga ${Math.round(c.folga)} ${plural(Math.round(c.folga), "dia", "dias")}`;
    return `<div class="rede-no ${classe}" style="left:${x}px;top:${y}px;width:${MEDIDAS.largura}px;height:${MEDIDAS.altura}px" data-numero="${a.numero}">
      <div class="rede-cartao" role="button" tabindex="0" data-abrir-acao data-rede-no="${a.numero}"
        title="${esc(etapaDe.get(a.etapa) ? `${etapaDe.get(a.etapa)}: ${a.rotulo}` : a.rotulo)}">
        <span class="rede-topo">${situacao(l)}<span class="rede-rotulo">${identificador(a)}<span data-editar="rotulo">${esc(a.rotulo)}</span></span></span>
        <span class="rede-base"><span class="donos">${donos(a)}</span>
          <span class="rede-data${l.atrasada ? " atrasada" : ""}"><span class="mono">${l.atrasada ? `<span class="icone-atrasada">${ICONES.atrasada}</span>` : ""}${data}</span>${folga ? `<small>${folga}</small>` : ""}</span></span>
      </div>
    </div>`;
  }).join("");

  const setas = arestas.map(({ de, para, critica, pontos, saltos }) => `<path class="rede-seta${critica ? " critica" : ""}" data-de="${de}" data-para="${para}"
      d="${caminhoDaSeta(pontos, saltos)}" marker-end="url(#rede-ponta${critica ? "-critica" : ""})"/>`).join("");

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
            ${raiasHtml}
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
  /* "Ver tudo": cabe na largura e na altura da área (22/10/2026) */
  const alturaUtil = parseFloat(getComputedStyle(rolagem).maxHeight) || rolagem.clientHeight;
  const fator = escala === "tudo" ? Math.min(1, (rolagem.clientWidth - 2) / largura, (alturaUtil - 2) / altura) : 1;
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
