/**
 * Modo "Cronograma" do espaço (documentação técnica, seção 8.4; passo 1.17b, primeira versão).
 * Barras das ações no tempo, com as dependências em setas, agrupadas por fase e etapa.
 * Interativo: passar o mouse numa barra mostra as datas e a folga e destaca as ligações;
 * clicar abre a ação; zoom com os botões − e + ou com Ctrl + rolagem do mouse (27/10/2026, pedido do responsável,
 * como no MS Project e no GanttProject), mantendo parada a data sob o ponteiro.
 * Comparação com um retrato (passo 1.18): linha fina sob cada barra, com as datas do retrato.
 * Só no computador (o seletor esconde o modo no celular).
 */
import { montarCronograma } from "../cronograma.js";
import { esc, dataBr, plural } from "../formato.js";
import { ICONES } from "../icones.js";

const UM_DIA = 864e5;
const dias = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / UM_DIA;
const somar = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * UM_DIA).toISOString().slice(0, 10);
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Níveis de zoom: pixels por dia de calendário e o nome do que se vê melhor em cada um (27/10/2026). O padrão é
 * 18 px (semanas), como antes; "meses", a aproximação antiga de longe, é o de 5 px.
 */
export const ZOOM = [[2, "Trimestres"], [3, "Meses"], [5, "Meses"], [8, "Semanas"], [12, "Semanas"], [18, "Semanas"], [28, "Dias"], [40, "Dias"]];
export const ZOOM_PADRAO = 18;
/** Nível de zoom válido mais próximo (aceita os nomes antigos "semanas" e "meses"). */
export const nivelDoZoom = (escala) => {
  const px = escala === "meses" ? 5 : escala === "semanas" ? ZOOM_PADRAO : Number(escala) || ZOOM_PADRAO;
  return ZOOM.reduce((melhor, n, i) => (Math.abs(n[0] - px) < Math.abs(ZOOM[melhor][0] - px) ? i : melhor), 0);
};
/** Data e posição do ponteiro a manter paradas no próximo desenho (zoom pela rolagem do mouse). */
let ancora = null;
const ALTURA = 34;

/**
 * @param {HTMLElement} alvo
 * @param {{espaco: object, acoes: object[], caminho: object, cal: object, hoje: string, usaFases: boolean,
 *   identificador: (acao: object) => string, escala: string, aoMudarEscala: (escala: string) => void,
 *   retratos?: object[]|null, comparar?: string|null, base?: Map<number, {inicio: string, fim: string}>|null,
 *   aoComparar?: (id: string|null) => void}} dados
 *   retratos: cabeçalhos dos retratos do espaço (null: ainda carregando); comparar: id do retrato escolhido;
 *   base: datas de cada ação no retrato escolhido
 */
/** Ajuste da altura da rolagem ao redimensionar a janela: um só por vez, trocado a cada desenho. */
let aoRedimensionar = null;

export function desenharCronograma(alvo, { espaco, acoes, caminho, cal, hoje, usaFases, identificador, escala, aoMudarEscala,
  retratos = null, comparar = null, base = null, aoComparar = () => {} }) {
  if (!acoes.length) {
    alvo.innerHTML = `<p class="lista-vazia">Este espaço ainda não tem ações. O cronograma aparece quando houver ações.</p>`;
    return;
  }
  const { linhas, inicio, fim } = montarCronograma(acoes, caminho, cal, { estrutura: espaco.estrutura, usaFases });
  const prazo = espaco.prazoFinal ?? null;
  const datasBase = base ? [...base.values()].flatMap((b) => [b.inicio, b.fim]) : [];
  const de = somar([inicio, hoje, ...datasBase].sort()[0], -3);
  const ate = somar([fim, prazo ?? fim, hoje, ...datasBase].sort().at(-1), 10);
  const nivel = nivelDoZoom(escala);
  const px = ZOOM[nivel][0];
  const largura = Math.ceil(dias(de, ate) * px);
  const x = (iso) => dias(de, iso) * px;

  /* ---------- cabeçalho: meses e, de perto, o dia de cada segunda-feira ---------- */
  const marcasTopo = [];
  for (let d = de; d <= ate; d = somar(d, 1)) {
    const data = new Date(`${d}T00:00:00Z`);
    if (data.getUTCDate() === 1 || d === de) {
      const rotulo = `${MESES[data.getUTCMonth()]}${data.getUTCMonth() === 0 || d === de ? ` ${data.getUTCFullYear()}` : ""}`;
      marcasTopo.push(`<span class="crono-mes" style="left:${x(d)}px">${rotulo}</span>`);
    }
    /* de perto, o dia de cada segunda-feira; bem de perto (28 px ou mais), todos os dias */
    if ((px >= 12 && data.getUTCDay() === 1) || (px >= 28 && data.getUTCDate() !== 1)) marcasTopo.push(`<span class="crono-dia" style="left:${x(d)}px">${data.getUTCDate()}</span>`);
  }
  /* linhas verticais: semanas (de perto) ou meses (de longe) */
  const guias = [];
  for (let d = de; d <= ate; d = somar(d, 1)) {
    const data = new Date(`${d}T00:00:00Z`);
    if ((px >= 12 && data.getUTCDay() === 1) || data.getUTCDate() === 1) guias.push(`<i class="crono-guia${data.getUTCDate() === 1 ? " mes" : ""}" style="left:${x(d)}px"></i>`);
  }

  /* ---------- linhas ---------- */
  const posicao = new Map(); // número → {y, x0, x1}
  const corpo = linhas.map((l, i) => {
    const y = i * ALTURA;
    if (l.tipo === "grupo") {
      return `<div class="crono-linha grupo ${l.nivel}" style="top:${y}px">
        <div class="crono-nome"><span>${esc(l.nome)}</span></div>
        ${l.inicio ? `<i class="crono-resumo" style="left:calc(var(--nomes) + ${x(l.inicio)}px);width:${x(somar(l.fim, 1)) - x(l.inicio)}px"></i>` : ""}
      </div>`;
    }
    const b = l.barra;
    const a = b.acao;
    const x0 = x(b.inicio);
    const x1 = x(somar(b.fim, 1));
    posicao.set(b.numero, { y: y + ALTURA / 2, x0, x1 });
    const semEstimativa = b.duracao === 0 && b.situacao !== "concluida";
    const classe = b.situacao === "concluida" ? "concluida" : semEstimativa ? "sem-estimativa" : b.critica ? "critica" : "folga";
    return `<div class="crono-linha" style="top:${y}px" data-numero="${a.numero}">
      <div class="crono-nome" role="button" tabindex="0" data-abrir-acao>
        ${identificador(a)}<span class="rotulo">${esc(a.rotulo)}</span>
        ${b.atrasada ? `<span class="icone-atrasada" title="Atrasada">${ICONES.atrasada}</span>` : ""}
      </div>
      ${base?.has(a.numero) ? `<i class="crono-base" style="left:calc(var(--nomes) + ${x(base.get(a.numero).inicio)}px);width:${Math.max(3, x(somar(base.get(a.numero).fim, 1)) - x(base.get(a.numero).inicio))}px"></i>` : ""}
      <button type="button" class="crono-barra-acao ${classe}" data-abrir-acao data-dica-numero="${a.numero}"
        style="left:calc(var(--nomes) + ${x0}px);width:${semEstimativa ? 12 : Math.max(4, x1 - x0)}px" aria-label="${esc(a.rotulo)}: ${dataBr(b.inicio)} a ${dataBr(b.fim)}"></button>
    </div>`;
  }).join("");

  /* ---------- setas das dependências ---------- */
  const setas = [];
  for (const l of linhas) {
    if (l.tipo !== "acao") continue;
    const destino = posicao.get(l.barra.numero);
    for (const d of l.barra.dependeDe) {
      const origem = posicao.get(d);
      if (!origem) continue;
      const { x1, y: y1 } = origem;
      const { x0: x2, y: y2 } = destino;
      const sentido = y2 > y1 ? 1 : -1;
      const caminho = x2 - x1 >= 12
        ? `M${x1},${y1} H${x1 + 6} V${y2} H${x2 - 1}`
        : `M${x1},${y1} h6 V${y2 - sentido * (ALTURA / 2 - 2)} H${x2 - 8} V${y2} H${x2 - 1}`;
      setas.push(`<path class="crono-seta" data-de="${d}" data-para="${l.barra.numero}" d="${caminho}" marker-end="url(#crono-ponta)"/>`);
    }
  }
  const altura = linhas.length * ALTURA;

  const marcaVertical = (iso, classe, nome) => (iso >= de && iso <= ate
    ? `<div class="crono-marca ${classe}" style="left:${x(iso)}px"><span>${nome}</span></div>` : "");

  const legenda = `<span class="crono-legenda"><i class="critica"></i>Sem folga <a href="#" class="oque" data-termo="folga">o que é?</a></span>
    <span class="crono-legenda"><i class="folga"></i>Com folga</span>
    <span class="crono-legenda"><i class="concluida"></i>Concluída</span>
    ${base ? `<span class="crono-legenda"><i class="base"></i>No retrato</span>` : ""}`;
  const retratoEscolhido = retratos?.find((r) => r.id === comparar);
  const comparacao = retratos?.length ? `<label class="crono-comparar"><span>Comparar com</span>
      <select data-comparar aria-label="Comparar com um retrato"><option value="">Nenhum retrato</option>
        ${retratos.map((r) => `<option value="${esc(r.id)}"${r.id === comparar ? " selected" : ""}>${esc(r.nome)} (${dataBr(r.criadoEm.slice(0, 10))})</option>`).join("")}
      </select></label>` : "";

  /* ao redesenhar (mudança nos dados ou na aproximação), mantém a rolagem; na primeira vez, abre perto de hoje */
  const anterior = alvo.querySelector("[data-rolagem]");
  const rolagemAnterior = anterior ? { esquerda: anterior.scrollLeft, topo: anterior.scrollTop, escala: alvo.dataset.cronoEscala } : null;
  alvo.dataset.cronoEscala = escala;
  alvo.innerHTML = `
    <div class="crono-ferramentas">
      <div class="crono-zoom" role="group" aria-label="Zoom">
        <button type="button" class="botao" data-zoom="-1" aria-label="Diminuir o zoom" title="Diminuir o zoom (Ctrl + rolar o mouse para baixo)"${nivel === 0 ? " disabled" : ""}>${ICONES.menos}</button>
        <span class="crono-zoom-nome" aria-live="polite">${ZOOM[nivel][1]}</span>
        <button type="button" class="botao" data-zoom="1" aria-label="Aumentar o zoom" title="Aumentar o zoom (Ctrl + rolar o mouse para cima)"${nivel === ZOOM.length - 1 ? " disabled" : ""}>${ICONES.mais}</button>
      </div>
      ${comparacao}
      <div class="crono-legendas">${legenda}</div>
    </div>
    <div class="crono" style="--altura:${ALTURA}px">
      <div class="crono-rolagem" data-rolagem>
        <div class="crono-conteudo" style="width:calc(var(--nomes) + ${largura}px)">
          <div class="crono-topo"><div class="crono-nome topo">Ação</div><div class="crono-escala" style="width:${largura}px">${marcasTopo.join("")}</div></div>
          <div class="crono-corpo" style="height:${altura}px">
            <div class="crono-trilho" style="width:${largura}px">
              ${guias.join("")}
              ${hoje > de ? `<i class="crono-passado" style="width:${x(hoje)}px"></i>` : ""}
              ${marcaVertical(hoje, "hoje", "Hoje")}
              ${prazo ? marcaVertical(prazo, "prazo", "Prazo final") : ""}
              <svg class="crono-setas" width="${largura}" height="${altura}" aria-hidden="true">
                <defs><marker id="crono-ponta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z"/></marker></defs>
                ${setas.join("")}
              </svg>
            </div>
            ${corpo}
          </div>
        </div>
      </div>
      <div class="tempo-dica" data-dica hidden></div>
    </div>
    <p class="tec">Clique numa ação para abri-la. Passe o mouse numa barra para ver as datas e as ligações. Termo técnico: diagrama de Gantt (<a href="#" class="oque" data-termo="cronograma">o que é?</a>).</p>`;

  /* ---------- interação ---------- */
  const caixa = alvo.querySelector(".crono");
  const dica = alvo.querySelector("[data-dica]");
  const porNumero = new Map(linhas.filter((l) => l.tipo === "acao").map((l) => [l.barra.numero, l.barra]));
  alvo.querySelector(".crono-ferramentas").onclick = (e) => {
    const b = e.target.closest("[data-zoom]");
    if (b) zoom(Number(b.dataset.zoom));
  };
  alvo.querySelector(".crono-ferramentas").onchange = (e) => {
    if (e.target.matches("[data-comparar]")) aoComparar(e.target.value || null);
  };
  const limpar = () => {
    caixa.classList.remove("destacando");
    for (const el of caixa.querySelectorAll(".ligada")) el.classList.remove("ligada");
    dica.hidden = true;
  };
  caixa.addEventListener("pointerover", (e) => {
    const alvoBarra = e.target.closest("[data-dica-numero]");
    if (!alvoBarra) return;
    const numero = Number(alvoBarra.dataset.dicaNumero);
    const b = porNumero.get(numero);
    limpar();
    caixa.classList.add("destacando");
    alvoBarra.classList.add("ligada");
    for (const s of caixa.querySelectorAll(`.crono-seta[data-de="${numero}"], .crono-seta[data-para="${numero}"]`)) {
      s.classList.add("ligada");
      caixa.querySelector(`[data-dica-numero="${s.dataset.de === String(numero) ? s.dataset.para : s.dataset.de}"]`)?.classList.add("ligada");
    }
    const situacao = b.situacao === "concluida" ? `Concluída em ${dataBr(b.fim)}`
      : b.duracao === 0 ? "Falta estimar"
      : b.critica ? "Sem folga: atrasar esta ação atrasa o fim do espaço"
      : `Folga de ${b.folga} ${plural(b.folga, "dia útil", "dias úteis")}`;
    const naBase = base?.get(numero);
    const diferenca = naBase ? cal.diasUteisAte(b.fim) - cal.diasUteisAte(naBase.fim) : 0;
    const noRetrato = !base ? "" : naBase
      ? `<br>No retrato “${esc(retratoEscolhido?.nome ?? "")}”: <span class="mono">${dataBr(naBase.inicio)} → ${dataBr(naBase.fim)}</span>. ${diferenca > 0 ? `Termina ${diferenca} ${plural(diferenca, "dia útil", "dias úteis")} depois` : diferenca < 0 ? `Termina ${-diferenca} ${plural(-diferenca, "dia útil", "dias úteis")} antes` : "Mesmo término"}.`
      : "<br>Ação criada depois do retrato.";
    dica.innerHTML = `<b>${esc(b.acao.rotulo)}</b><br><span class="mono">${dataBr(b.inicio)} → ${dataBr(b.fim)}</span><br>${situacao}${noRetrato}`;
    dica.hidden = false;
    const r = alvoBarra.getBoundingClientRect();
    const c = caixa.getBoundingClientRect();
    dica.style.left = `${Math.min(Math.max(0, r.left - c.left), c.width - dica.offsetWidth)}px`;
    dica.style.top = `${r.bottom - c.top + 6}px`;
  });
  caixa.addEventListener("pointerout", (e) => {
    if (e.target.closest("[data-dica-numero]") && !e.relatedTarget?.closest?.("[data-dica-numero]")) limpar();
  });

  const rolagem = alvo.querySelector("[data-rolagem]");
  /* barras de rolagem no próprio cronograma (27/10/2026, pedido do responsável): a área vai até o fim da tela, rola nos
     dois sentidos, o cabeçalho das datas fica parado ao rolar para baixo e a barra horizontal fica sempre à vista */
  const ajustarAltura = () => {
    if (!rolagem.isConnected) return removeEventListener("resize", ajustarAltura);
    rolagem.style.height = `${Math.max(320, Math.floor(innerHeight - (rolagem.getBoundingClientRect().top + scrollY) - 16))}px`;
    /* desconta o que fica abaixo (o texto de ajuda e a margem do pé da página), para a página não rolar (27/10/2026) */
    const sobra = document.documentElement.scrollHeight - innerHeight;
    if (sobra > 0) rolagem.style.height = `${Math.max(320, rolagem.offsetHeight - sobra)}px`;
  };
  ajustarAltura();
  if (aoRedimensionar) removeEventListener("resize", aoRedimensionar);
  aoRedimensionar = ajustarAltura;
  addEventListener("resize", ajustarAltura);
  if (rolagemAnterior) rolagem.scrollTop = rolagemAnterior.topo;
  const nomes = rolagem.querySelector(".crono-trilho").getBoundingClientRect().left - rolagem.getBoundingClientRect().left + rolagem.scrollLeft;
  if (ancora) {
    /* zoom: a data que estava sob o ponteiro (ou no meio da vista, pelos botões) continua no mesmo lugar */
    rolagem.scrollLeft = Math.max(0, nomes + x(ancora.data) + ancora.fracao * px - ancora.tela);
    ancora = null;
  } else {
    rolagem.scrollLeft = rolagemAnterior?.escala === String(escala) ? rolagemAnterior.esquerda : Math.max(0, x(hoje) - 14 * px);
  }
  /** Muda o zoom em `passo` níveis, mantendo parada a data na posição `tela` (px a partir da borda esquerda da vista). */
  function zoom(passo, tela = nomes + (rolagem.clientWidth - nomes) / 2) {
    const novo = Math.max(0, Math.min(ZOOM.length - 1, nivel + passo));
    if (novo === nivel) return;
    const dia = (rolagem.scrollLeft + tela - nomes) / px;
    ancora = { data: somar(de, Math.floor(dia)), fracao: dia - Math.floor(dia), tela };
    aoMudarEscala(String(ZOOM[novo][0]));
  }
  /* Ctrl + rolagem do mouse (ou o gesto de pinça do touchpad, que chega assim): zoom no ponto do ponteiro */
  let acumulado = 0;
  rolagem.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    acumulado += e.deltaY;
    if (Math.abs(acumulado) < 40) return;
    const passo = acumulado < 0 ? 1 : -1;
    acumulado = 0;
    const tela = e.clientX - rolagem.getBoundingClientRect().left;
    if (tela > nomes) zoom(passo, tela);
    else zoom(passo);
  }, { passive: false });
}
