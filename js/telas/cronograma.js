/**
 * Modo "Cronograma" do espaço (documentação técnica, seção 8.4; passo 1.17b, primeira versão).
 * Barras das ações no tempo, com as dependências em setas, agrupadas por fase e etapa.
 * Interativo: passar o mouse numa barra mostra as datas e a folga e destaca as ligações;
 * zoom com os botões − e + ou com Ctrl + rolagem do mouse (27/10/2026, pedido do responsável,
 * como no MS Project e no GanttProject), mantendo parada a data sob o ponteiro.
 * Comparação com um retrato (passo 1.18): linha fina sob cada barra, com as datas do retrato.
 * Só no computador (o seletor esconde o modo no celular).
 *
 * Edição dentro do cronograma (10/11/2026, pedido do responsável: facilidade de editar o plano nesta tela), para quem
 * pode gravar: clicar na barra abre a caixinha dos três prazos; arrastar a borda direita da barra encurta ou alonga
 * o prazo; arrastar a bolinha da ponta até outra ação liga as duas; clicar numa seta a seleciona (Delete retira);
 * "+" na etapa cria uma ação; duplo clique no nome (ou F2) renomeia; arrastar o nome muda a ordem ou a etapa;
 * o botão direito abre o menu; Ctrl+Z desfaz.
 * Navegação: botões "Hoje" e "Ver tudo", nome do mês sempre à vista, fases e etapas que se recolhem e arrastar o
 * fundo para deslocar a vista.
 * Na barra: a ação ainda não liberada fica mais clara, e a atrasada, listrada.
 */
import { montarCronograma, zoomQueCabe, estimativaParaTerminarEm } from "../cronograma.js";
import { esc, dataBr, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { avisar } from "./painel.js";
import { abrirFlutuante, colocar, flutuanteAberto } from "./rede.js";

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
/**
 * Pixels por dia do zoom guardado: um dos níveis ou, depois de "Ver tudo" (10/11/2026), qualquer valor de 1 a 40.
 * Aceita os nomes antigos "semanas" e "meses".
 */
export const pxDoZoom = (escala) => {
  const px = escala === "meses" ? 5 : escala === "semanas" ? ZOOM_PADRAO : Number(escala);
  return Number.isFinite(px) && px >= 1 && px <= 40 ? px : ZOOM_PADRAO;
};
/** Nível de zoom mais próximo (dá o nome mostrado entre os botões). */
export const nivelDoZoom = (escala) => {
  const px = pxDoZoom(escala);
  return ZOOM.reduce((melhor, n, i) => (Math.abs(n[0] - px) < Math.abs(ZOOM[melhor][0] - px) ? i : melhor), 0);
};
/** Data e posição do ponteiro a manter paradas no próximo desenho (zoom pela rolagem do mouse); `inicio`: "Ver tudo". */
let ancora = null;
const ALTURA = 34;
const DURACAO = 250;
const CURVA = "cubic-bezier(.2, 0, 0, 1)";
const reduzirMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fases e etapas recolhidas, por espaço: valem enquanto a página está aberta (não são gravadas). */
const recolhidosDe = new Map();
/** Seta selecionada: {de, para}. Guardada fora do desenho, que é refeito a cada mudança nos dados. */
let selecao = null;
/** Ação recém-criada que espera o desenho para abrir o nome (a resposta do "+" pode chegar antes ou depois dele). */
let renomearAoDesenhar = null;
let renomearNoAtual = () => false;
let abrirPrazoNoAtual = () => {};
/** Onde estavam as linhas e as barras no desenho anterior, para o novo deslizar a partir dali. */
let anterior = null;
/** Ajuste da altura da rolagem ao redimensionar a janela e Ctrl+Z: um só por vez, trocados a cada desenho. */
let aoRedimensionar = null;
let aoTeclarNaPagina = null;

/**
 * @param {HTMLElement} alvo
 * @param {{espaco: object, acoes: object[], caminho: object, cal: object, hoje: string, usaFases: boolean,
 *   identificador: (acao: object) => string, escala: string, aoMudarEscala: (escala: string) => void,
 *   retratos?: object[]|null, comparar?: string|null, base?: Map<number, {inicio: string, fim: string}>|null,
 *   aoComparar?: (id: string|null) => void, edicao?: object|null}} dados
 *   retratos: cabeçalhos dos retratos do espaço (null: ainda carregando); comparar: id do retrato escolhido;
 *   base: datas de cada ação no retrato escolhido; edicao: operações de edição (null: só leitura)
 */
export function desenharCronograma(alvo, dados) {
  const { espaco, acoes, caminho, cal, hoje, usaFases, identificador, escala, aoMudarEscala,
    retratos = null, comparar = null, base = null, aoComparar = () => {}, edicao = null } = dados;
  if (!acoes.length) {
    alvo.innerHTML = `<p class="lista-vazia">Este espaço ainda não tem ações. O cronograma aparece quando houver ações.</p>`;
    return;
  }
  const redesenhar = () => desenharCronograma(alvo, dados);
  if (!recolhidosDe.has(espaco.id)) recolhidosDe.set(espaco.id, new Set());
  const recolhidos = recolhidosDe.get(espaco.id);
  /* a ação recém-criada precisa estar à vista para receber o nome: abre a fase e a etapa dela */
  if (renomearAoDesenhar != null) {
    const etapa = acoes.find((a) => a.numero === renomearAoDesenhar)?.etapa;
    const fase = (espaco.estrutura ?? []).find((f) => f.etapas.some((e) => e.id === etapa));
    for (const id of [etapa, fase?.id, "sem-etapa"]) recolhidos.delete(id);
  }
  const { linhas, inicio, fim } = montarCronograma(acoes, caminho, cal, { estrutura: espaco.estrutura, usaFases, recolhidos });
  const prazo = espaco.prazoFinal ?? null;
  const datasBase = base ? [...base.values()].flatMap((b) => [b.inicio, b.fim]) : [];
  const de = somar([inicio, hoje, ...datasBase].sort()[0], -3);
  const ate = somar([fim, prazo ?? fim, hoje, ...datasBase].sort().at(-1), 10);
  const nivel = nivelDoZoom(escala);
  const px = pxDoZoom(escala);
  const largura = Math.ceil(dias(de, ate) * px);
  const x = (iso) => dias(de, iso) * px;

  /* ---------- cabeçalho: meses e, de perto, o dia de cada segunda-feira ---------- */
  /* o nome do mês acompanha a rolagem e fica sempre à vista enquanto o mês estiver na tela (10/11/2026) */
  const inicios = [];
  for (let d = de; d <= ate; d = somar(d, 1)) if (d === de || d.endsWith("-01")) inicios.push(d);
  const marcasTopo = inicios.map((d, i) => {
    const data = new Date(`${d}T00:00:00Z`);
    const larguraDoMes = (i + 1 < inicios.length ? x(inicios[i + 1]) : largura) - x(d);
    const rotulo = `${MESES[data.getUTCMonth()]}${data.getUTCMonth() === 0 || i === 0 ? ` ${data.getUTCFullYear()}` : ""}`;
    /* mês estreito demais para o nome (o pedaço do começo ou o zoom muito de longe) fica sem ele, para não encavalar */
    return larguraDoMes < rotulo.length * 7 + 12 ? "" : `<div class="crono-mes" style="left:${x(d)}px;width:${larguraDoMes}px"><span>${rotulo}</span></div>`;
  });
  for (let d = de; d <= ate; d = somar(d, 1)) {
    const data = new Date(`${d}T00:00:00Z`);
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
  const t = edicao?.nomeAcao ?? "ação";
  const posicao = new Map(); // número → {y, x0, x1}
  const geometria = { espaco: espaco.id, px, de, linhas: new Map(), barras: new Map() };
  const maisHtml = (etapa, onde) => (edicao?.podeCriar
    ? `<button type="button" class="crono-mais" data-nova-em="${esc(etapa)}" title="Nova ${esc(t)}${onde}" aria-label="Nova ${esc(t)}${onde}">${ICONES.mais}</button>` : "");
  const corpo = linhas.map((l, i) => {
    const y = i * ALTURA;
    if (l.tipo === "grupo") {
      geometria.linhas.set(`g:${l.id}`, y);
      const criaAqui = l.nivel === "etapa" || l.id === "sem-etapa";
      return `<div class="crono-linha grupo ${l.nivel}${l.recolhido ? " recolhido" : ""}" style="top:${y}px" data-chave="g:${esc(l.id)}">
        <div class="crono-nome" data-recolher="${esc(l.id)}">
          <button type="button" class="crono-recolher" aria-expanded="${!l.recolhido}" aria-label="${l.recolhido ? "Abrir" : "Recolher"} ${esc(l.nome)}">${ICONES.abrir}</button>
          <span class="crono-grupo-nome">${esc(l.nome)}</span>
          ${l.recolhido ? `<span class="crono-conta" title="${l.acoes} ${plural(l.acoes, "ação recolhida", "ações recolhidas")}">${l.acoes}</span>` : ""}
          ${criaAqui ? maisHtml(l.id === "sem-etapa" ? "" : l.id, l.id === "sem-etapa" ? ", sem etapa" : ` em ${l.nome}`) : ""}
        </div>
        ${l.inicio ? `<i class="crono-resumo" style="left:calc(var(--nomes) + ${x(l.inicio)}px);width:${x(somar(l.fim, 1)) - x(l.inicio)}px"></i>` : ""}
      </div>`;
    }
    const b = l.barra;
    const a = b.acao;
    const x0 = x(b.inicio);
    const x1 = x(somar(b.fim, 1));
    const semEstimativa = b.duracao === 0 && b.situacao !== "concluida" && !b.continua;
    const largo = semEstimativa ? 12 : Math.max(4, x1 - x0);
    posicao.set(b.numero, { y: y + ALTURA / 2, x0, x1 });
    geometria.linhas.set(`a:${a.numero}`, y);
    geometria.barras.set(a.numero, { x0, largo });
    /* ação contínua (seção 5.9): barra fina e listrada, que acompanha os marcos; concluída, como as demais */
    const classe = b.situacao === "concluida" ? "concluida" : b.continua ? "continua" : semEstimativa ? "sem-estimativa" : b.critica ? "critica" : "folga";
    /* andamento e atraso na barra (10/11/2026): a que ainda espera as anteriores fica mais clara; a atrasada, listrada */
    const estado = `${b.situacao === "naoLiberada" && !b.continua ? " aguardando" : ""}${b.atrasada ? " atrasada" : ""}`;
    const estima = Boolean(edicao?.usaEstimativas && edicao.podeEstimar(a.numero));
    const alcas = !edicao ? "" : `
      ${estima && !semEstimativa ? `<i class="crono-borda" data-borda="${a.numero}" style="left:calc(var(--nomes) + ${x0 + largo - 5}px)" title="Arraste para encurtar ou alongar o prazo"></i>` : ""}
      ${edicao.usaDependencias && !b.continua ? `<i class="crono-alca" data-alca="${a.numero}" style="left:calc(var(--nomes) + ${x0 + largo + 7}px)" title="Arraste até outra ${esc(t)} para ligar: ela só começa quando esta terminar"></i>` : ""}`;
    return `<div class="crono-linha" style="top:${y}px" data-numero="${a.numero}" data-chave="a:${a.numero}">
      <div class="crono-nome" role="button" tabindex="0" data-abrir-acao>
        ${identificador(a)}<span class="rotulo"${edicao ? ' data-editar="rotulo"' : ""}>${esc(a.rotulo)}</span>
        ${b.atrasada ? `<span class="icone-atrasada" title="Atrasada">${ICONES.atrasada}</span>` : ""}
      </div>
      ${base?.has(a.numero) ? `<i class="crono-base" style="left:calc(var(--nomes) + ${x(base.get(a.numero).inicio)}px);width:${Math.max(3, x(somar(base.get(a.numero).fim, 1)) - x(base.get(a.numero).inicio))}px"></i>` : ""}
      <button type="button" class="crono-barra-acao ${classe}${estado}" ${estima ? "data-prazo" : "data-abrir-acao"} data-barra="${a.numero}" data-dica-numero="${a.numero}"
        style="left:calc(var(--nomes) + ${x0}px);width:${largo}px" aria-label="${esc(a.rotulo)}: ${dataBr(b.inicio)} a ${dataBr(b.fim)}${b.atrasada ? ", atrasada" : ""}${estima ? ". Enter ajusta o prazo" : ""}"></button>${alcas}
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
      const caminhoDaSeta = x2 - x1 >= 12
        ? `M${x1},${y1} H${x1 + 6} V${y2} H${x2 - 1}`
        : `M${x1},${y1} h6 V${y2 - sentido * (ALTURA / 2 - 2)} H${x2 - 8} V${y2} H${x2 - 1}`;
      const marca = `data-de="${d}" data-para="${l.barra.numero}" d="${caminhoDaSeta}"`;
      setas.push(`<path class="crono-seta" ${marca} marker-end="url(#crono-ponta)"/>${edicao ? `<path class="crono-seta-alvo" ${marca}><title>Clique para selecionar a ligação</title></path>` : ""}`);
    }
  }
  const altura = linhas.length * ALTURA;

  const marcaVertical = (iso, classe, nome) => (iso >= de && iso <= ate
    ? `<div class="crono-marca ${classe}" style="left:${x(iso)}px"><span>${nome}</span></div>` : "");

  const barrasDaTela = linhas.filter((l) => l.tipo === "acao").map((l) => l.barra);
  const legenda = `<span class="crono-legenda"><i class="critica"></i>Sem folga <a href="#" class="oque" data-termo="folga">o que é?</a></span>
    <span class="crono-legenda"><i class="folga"></i>Com folga</span>
    <span class="crono-legenda"><i class="folga aguardando"></i>Ainda não liberada</span>
    <span class="crono-legenda"><i class="folga atrasada"></i>Atrasada</span>
    <span class="crono-legenda"><i class="concluida"></i>Concluída</span>
    ${barrasDaTela.some((b) => b.continua) ? `<span class="crono-legenda"><i class="continua"></i>Contínua <a href="#" class="oque" data-termo="continua">o que é?</a></span>` : ""}
    ${base ? `<span class="crono-legenda"><i class="base"></i>No retrato</span>` : ""}`;
  const retratoEscolhido = retratos?.find((r) => r.id === comparar);
  const comparacao = retratos?.length ? `<label class="crono-comparar"><span>Comparar com</span>
      <select data-comparar aria-label="Comparar com um retrato"><option value="">Nenhum retrato</option>
        ${retratos.map((r) => `<option value="${esc(r.id)}"${r.id === comparar ? " selected" : ""}>${esc(r.nome)} (${dataBr(r.criadoEm.slice(0, 10))})</option>`).join("")}
      </select></label>` : "";
  const ajuda = edicao
    ? `Clique na barra para ajustar o prazo ou arraste a borda direita dela. Arraste a bolinha da ponta até outra ${esc(t)} para ligar as duas. Arraste o nome para mudar a ordem ou a etapa. Duplo clique no nome renomeia; o botão direito abre mais opções.`
    : "Clique numa ação para abri-la. Passe o mouse numa barra para ver as datas e as ligações.";

  /* ao redesenhar (mudança nos dados ou na aproximação), mantém a rolagem; na primeira vez, abre perto de hoje */
  const antiga = alvo.querySelector("[data-rolagem]");
  const rolagemAnterior = antiga ? { esquerda: antiga.scrollLeft, topo: antiga.scrollTop, escala: alvo.dataset.cronoEscala } : null;
  const focoDentro = Boolean(alvo.querySelector(".crono")?.contains(document.activeElement));
  alvo.dataset.cronoEscala = escala;
  alvo.innerHTML = `
    <div class="crono-ferramentas">
      <div class="crono-zoom" role="group" aria-label="Zoom">
        <button type="button" class="botao" data-zoom="-1" aria-label="Diminuir o zoom" title="Diminuir o zoom (Ctrl + rolar o mouse para baixo)"${px <= ZOOM[0][0] ? " disabled" : ""}>${ICONES.menos}</button>
        <span class="crono-zoom-nome" aria-live="polite">${ZOOM[nivel][1]}</span>
        <button type="button" class="botao" data-zoom="1" aria-label="Aumentar o zoom" title="Aumentar o zoom (Ctrl + rolar o mouse para cima)"${px >= ZOOM.at(-1)[0] ? " disabled" : ""}>${ICONES.mais}</button>
      </div>
      <div class="crono-ir" role="group" aria-label="Ir para">
        <button type="button" class="botao" data-ir-hoje title="Levar a vista até o dia de hoje">Hoje</button>
        <button type="button" class="botao" data-ver-tudo title="Ajustar o zoom para o cronograma inteiro caber na tela">Ver tudo</button>
      </div>
      ${edicao ? `<button type="button" class="botao" data-crono-desfazer title="Desfazer a última edição feita aqui (Ctrl+Z)"${edicao.temDesfazer() ? "" : " disabled"}>Desfazer</button>` : ""}
      ${comparacao}
      <div class="crono-legendas">${legenda}</div>
    </div>
    <div class="crono${edicao ? " editavel" : ""}" style="--altura:${ALTURA}px" tabindex="-1">
      <div class="crono-rolagem" data-rolagem>
        <div class="crono-conteudo" style="width:calc(var(--nomes) + ${largura}px)">
          <div class="crono-topo"><div class="crono-nome crono-cabeca"><span>Ação</span>${usaFases && (espaco.estrutura ?? []).length ? "" : maisHtml("", "")}</div><div class="crono-escala" style="width:${largura}px">${marcasTopo.join("")}</div></div>
          <div class="crono-corpo" style="height:${altura}px">
            <div class="crono-trilho" style="width:${largura}px">
              ${guias.join("")}
              ${hoje > de ? `<i class="crono-passado" style="width:${x(hoje)}px"></i>` : ""}
              ${marcaVertical(hoje, "hoje", "Hoje")}
              ${prazo ? marcaVertical(prazo, "prazo", "Prazo final") : ""}
              <svg class="crono-setas" width="${largura}" height="${altura}">
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
    <p class="tec">${ajuda} Termo técnico: diagrama de Gantt (<a href="#" class="oque" data-termo="cronograma">o que é?</a>).</p>`;

  /* ---------- interação ---------- */
  const caixa = alvo.querySelector(".crono");
  const dica = alvo.querySelector("[data-dica]");
  const rolagem = alvo.querySelector("[data-rolagem]");
  const trilho = alvo.querySelector(".crono-trilho");
  const porNumero = new Map(barrasDaTela.map((b) => [b.numero, b]));
  const linhaDe = (n) => caixa.querySelector(`.crono-linha[data-numero="${n}"]`);
  const barraDe = (n) => caixa.querySelector(`[data-barra="${n}"]`);
  /** Durante um arrasto, a dica e o destaque do mouse ficam parados. */
  let arrastando = false;
  alvo.querySelector(".crono-ferramentas").onclick = (e) => {
    const b = e.target.closest("[data-zoom]");
    if (b) return zoom(Number(b.dataset.zoom));
    if (e.target.closest("[data-ir-hoje]")) return irParaHoje();
    if (e.target.closest("[data-ver-tudo]")) return verTudo();
    if (e.target.closest("[data-crono-desfazer]")) return edicao?.desfazer();
  };
  alvo.querySelector(".crono-ferramentas").onchange = (e) => {
    if (e.target.matches("[data-comparar]")) aoComparar(e.target.value || null);
  };
  const limpar = () => {
    caixa.classList.remove("destacando");
    for (const el of caixa.querySelectorAll(".ligada")) el.classList.remove("ligada");
    dica.hidden = true;
  };
  const mostrarDica = (el, html) => {
    dica.innerHTML = html;
    dica.hidden = false;
    const r = el.getBoundingClientRect();
    const c = caixa.getBoundingClientRect();
    dica.style.left = `${Math.min(Math.max(0, r.left - c.left), c.width - dica.offsetWidth)}px`;
    dica.style.top = `${r.bottom - c.top + 6}px`;
  };
  caixa.addEventListener("pointerover", (e) => {
    if (arrastando) return;
    const alvoBarra = e.target.closest("[data-dica-numero]");
    if (!alvoBarra) return;
    const numero = Number(alvoBarra.dataset.dicaNumero);
    const b = porNumero.get(numero);
    limpar();
    caixa.classList.add("destacando");
    alvoBarra.classList.add("ligada");
    for (const s of caixa.querySelectorAll(`.crono-seta[data-de="${numero}"], .crono-seta[data-para="${numero}"]`)) {
      s.classList.add("ligada");
      barraDe(s.dataset.de === String(numero) ? s.dataset.para : s.dataset.de)?.classList.add("ligada");
    }
    const situacao = b.situacao === "concluida" ? `Concluída em ${dataBr(b.fim)}`
      : b.duracao === 0 ? "Falta estimar"
      : b.critica ? "Sem folga: atrasar esta ação atrasa o fim do espaço"
      : `Folga de ${b.folga} ${plural(b.folga, "dia útil", "dias úteis")}`;
    const andamento = b.atrasada ? "<br>Atrasada: o prazo previsto já passou"
      : b.situacao === "naoLiberada" && !b.continua ? "<br>Ainda não liberada: espera as anteriores ou a data mínima" : "";
    const naBase = base?.get(numero);
    const diferenca = naBase ? cal.diasUteisAte(b.fim) - cal.diasUteisAte(naBase.fim) : 0;
    const noRetrato = !base ? "" : naBase
      ? `<br>No retrato “${esc(retratoEscolhido?.nome ?? "")}”: <span class="mono">${dataBr(naBase.inicio)} → ${dataBr(naBase.fim)}</span>. ${diferenca > 0 ? `Termina ${diferenca} ${plural(diferenca, "dia útil", "dias úteis")} depois` : diferenca < 0 ? `Termina ${-diferenca} ${plural(-diferenca, "dia útil", "dias úteis")} antes` : "Mesmo término"}.`
      : "<br>Ação criada depois do retrato.";
    mostrarDica(alvoBarra, `<b>${esc(b.acao.rotulo)}</b><br><span class="mono">${dataBr(b.inicio)} → ${dataBr(b.fim)}</span><br>${situacao}${andamento}${noRetrato}`);
  });
  caixa.addEventListener("pointerout", (e) => {
    if (arrastando) return;
    if (e.target.closest("[data-dica-numero]") && !e.relatedTarget?.closest?.("[data-dica-numero]")) limpar();
  });

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
  const nomes = trilho.getBoundingClientRect().left - rolagem.getBoundingClientRect().left + rolagem.scrollLeft;
  if (ancora?.inicio) {
    rolagem.scrollLeft = 0;
    ancora = null;
  } else if (ancora) {
    /* zoom: a data que estava sob o ponteiro (ou no meio da vista, pelos botões) continua no mesmo lugar */
    rolagem.scrollLeft = Math.max(0, nomes + x(ancora.data) + ancora.fracao * px - ancora.tela);
    ancora = null;
  } else {
    rolagem.scrollLeft = rolagemAnterior?.escala === String(escala) ? rolagemAnterior.esquerda : Math.max(0, x(hoje) - 14 * px);
  }
  /** Muda o zoom em `passo` níveis, mantendo parada a data na posição `tela` (px a partir da borda esquerda da vista). */
  function zoom(passo, tela = nomes + (rolagem.clientWidth - nomes) / 2) {
    /* a partir de um zoom fora dos níveis ("Ver tudo"), vai ao nível vizinho naquele sentido */
    const niveis = ZOOM.map((n) => n[0]);
    const novo = passo > 0 ? niveis.find((n) => n > px + 0.005) : niveis.findLast((n) => n < px - 0.005);
    if (novo == null) return;
    const dia = (rolagem.scrollLeft + tela - nomes) / px;
    ancora = { data: somar(de, Math.floor(dia)), fracao: dia - Math.floor(dia), tela };
    aoMudarEscala(String(novo));
  }
  /** "Hoje" (10/11/2026): leva a vista até hoje, a um terço da largura, sem mexer no zoom. */
  function irParaHoje() {
    const destino = Math.max(0, x(hoje) - (rolagem.clientWidth - nomes) / 3);
    rolagem.scrollTo({ left: destino, behavior: reduzirMovimento() ? "auto" : "smooth" });
  }
  /** "Ver tudo" (10/11/2026): o zoom em que o cronograma inteiro cabe na largura da tela. */
  function verTudo() {
    const cabe = zoomQueCabe(dias(de, ate), rolagem.clientWidth - nomes - 16); // 16: folga para a bolinha e os rótulos da ponta
    ancora = { inicio: true };
    if (String(cabe) === String(escala)) { ancora = null; rolagem.scrollTo({ left: 0, behavior: reduzirMovimento() ? "auto" : "smooth" }); return; }
    aoMudarEscala(String(cabe));
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

  /* ---------- arrastar o fundo desloca a vista, como na Rede (10/11/2026) ---------- */
  rolagem.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    if (!e.target.closest(".crono-corpo") || e.target.closest(".crono-nome, [data-barra], [data-alca], [data-borda], .crono-seta-alvo, [data-editando]")) return;
    const inicio = { x: e.clientX, y: e.clientY, esquerda: rolagem.scrollLeft, topo: rolagem.scrollTop };
    let andou = false;
    const mover = (ev) => {
      const dx = ev.clientX - inicio.x;
      const dy = ev.clientY - inicio.y;
      if (!andou && Math.hypot(dx, dy) < 4) return;
      if (!andou) { andou = true; arrastando = true; limpar(); caixa.classList.add("deslocando"); }
      rolagem.scrollLeft = inicio.esquerda - dx;
      rolagem.scrollTop = inicio.topo - dy;
    };
    const soltar = () => {
      removeEventListener("pointermove", mover);
      removeEventListener("pointerup", soltar);
      removeEventListener("pointercancel", soltar);
      if (!andou) return;
      arrastando = false;
      caixa.classList.remove("deslocando");
    };
    addEventListener("pointermove", mover);
    addEventListener("pointerup", soltar);
    addEventListener("pointercancel", soltar);
  });

  /* ---------- recolher e abrir fases e etapas (10/11/2026) ---------- */
  caixa.addEventListener("click", (e) => {
    const grupo = e.target.closest("[data-recolher]");
    if (!grupo || e.target.closest("[data-nova-em]")) return;
    const id = grupo.dataset.recolher;
    if (recolhidos.has(id)) recolhidos.delete(id); else recolhidos.add(id);
    redesenhar();
    alvo.querySelector(`[data-recolher="${CSS.escape(id)}"] .crono-recolher`)?.focus({ preventScroll: true });
  });

  animarMudanca(caixa, geometria);
  if (edicao) ativarEdicao();
  else { selecao = null; if (aoTeclarNaPagina) { document.removeEventListener("keydown", aoTeclarNaPagina); aoTeclarNaPagina = null; } }

  /* ====================== edição (10/11/2026) ====================== */
  function ativarEdicao() {
    edicao.ouvirDesfazer((tem) => { const b = alvo.querySelector("[data-crono-desfazer]"); if (b) b.disabled = !tem; });
    const diaSob = (clientX) => (clientX - trilho.getBoundingClientRect().left) / px;
    const marcar = () => {
      for (const el of caixa.querySelectorAll(".selecionada")) el.classList.remove("selecionada");
      if (selecao) for (const el of caixa.querySelectorAll(`.crono-seta[data-de="${selecao.de}"][data-para="${selecao.para}"]`)) el.classList.add("selecionada");
      if (selecao && !caixa.querySelector(".selecionada")) selecao = null; // sumiu depois de uma mudança
    };
    const selecionarSeta = (deN, paraN) => { selecao = { de: deN, para: paraN }; marcar(); caixa.focus({ preventScroll: true }); };
    /* traz a linha e o começo da barra para dentro da área visível */
    const mostrar = (n) => {
      const linha = linhaDe(n);
      if (!linha) return;
      const y = Number.parseFloat(linha.style.top);
      const visivel = rolagem.clientHeight - 40 - ALTURA; // 40: cabeçalho das datas, parado no alto
      if (y < rolagem.scrollTop) rolagem.scrollTop = y;
      else if (y > rolagem.scrollTop + visivel) rolagem.scrollTop = y - visivel;
      const p = posicao.get(n);
      const larguraVisivel = rolagem.clientWidth - nomes;
      if (p && (p.x0 < rolagem.scrollLeft || p.x0 > rolagem.scrollLeft + larguraVisivel - 60)) rolagem.scrollLeft = Math.max(0, p.x0 - larguraVisivel / 3);
    };
    /* com `depois`, abre a caixinha de prazos quando o nome termina (menos com Esc, que desiste) */
    const renomear = (n, depois = false) => {
      const campo = linhaDe(n)?.querySelector('[data-editar="rotulo"]');
      if (!campo || !edicao.podeAlterar(n)) return false;
      mostrar(n);
      edicao.renomear(campo);
      if (depois && edicao.usaEstimativas) {
        let desistiu = false;
        campo.addEventListener("keydown", (e) => { if (e.key === "Escape") desistiu = true; });
        campo.addEventListener("focusout", () => { if (!desistiu) setTimeout(() => abrirPrazoNoAtual(n), 80); }, { once: true });
      }
      return true;
    };
    /* depois de criar: a nova fica com o nome aberto para digitar e, em seguida, a caixinha dos prazos */
    const criarE = (botao, criar) => {
      if (botao) botao.disabled = true;
      criar().then((numero) => {
        if (botao?.isConnected) botao.disabled = false;
        if (numero == null) return;
        /* o redesenho pode chegar antes ou depois da resposta */
        if (!renomearNoAtual(numero, true)) renomearAoDesenhar = numero;
      });
    };
    renomearNoAtual = renomear;
    abrirPrazoNoAtual = abrirPrazo;
    marcar();
    if (renomearAoDesenhar != null && renomear(renomearAoDesenhar, true)) renomearAoDesenhar = null;
    else if (focoDentro && selecao) caixa.focus({ preventScroll: true });

    /* ---------- cliques (na captura, para o clique no nome poder esperar o duplo clique) ---------- */
    let abrirDepois = null;
    /** O clique que vem logo depois de soltar uma linha arrastada não abre a ação. */
    let acabouDeMover = false;
    caixa.addEventListener("click", (e) => {
      if (acabouDeMover) { acabouDeMover = false; return e.stopPropagation(); }
      if (e.target.closest("[data-editando]")) return e.stopPropagation();
      const mais = e.target.closest("[data-nova-em]");
      if (mais) { e.stopPropagation(); return criarE(mais, () => edicao.criarEm(mais.dataset.novaEm || null)); }
      if (e.target.closest("[data-alca], [data-borda]")) return e.stopPropagation();
      const alvoSeta = e.target.closest(".crono-seta-alvo");
      if (alvoSeta) { e.stopPropagation(); return selecionarSeta(Number(alvoSeta.dataset.de), Number(alvoSeta.dataset.para)); }
      const barra = e.target.closest("[data-prazo]");
      if (barra) { e.stopPropagation(); selecao = null; marcar(); return abrirPrazo(Number(barra.dataset.barra)); }
      const nome = e.target.closest(".crono-nome[data-abrir-acao]");
      if (nome && !e.altKey && e.detail > 0) {
        /* clique no nome abre a ação; duplo clique renomeia: o clique espera um instante pelo segundo */
        e.stopPropagation();
        clearTimeout(abrirDepois);
        if (e.detail > 1) return;
        const n = Number(nome.closest("[data-numero]").dataset.numero);
        abrirDepois = setTimeout(() => edicao.abrir(n), 230);
        return;
      }
      if (selecao && !e.target.closest("[data-abrir-acao]")) { selecao = null; marcar(); }
    }, true);
    caixa.addEventListener("dblclick", (e) => {
      const nome = e.target.closest(".crono-nome[data-abrir-acao]");
      if (!nome || e.target.closest("[data-editando]")) return;
      clearTimeout(abrirDepois);
      renomear(Number(nome.closest("[data-numero]").dataset.numero));
    });

    /* ---------- teclado ---------- */
    caixa.addEventListener("keydown", (e) => {
      if (e.target.closest("[data-editando]")) return;
      const linha = e.target.closest(".crono-linha[data-numero]");
      if (e.key === "F2" && linha) { e.preventDefault(); return renomear(Number(linha.dataset.numero)); }
      if (!selecao) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const { de: deN, para: paraN } = selecao;
        selecao = null;
        edicao.desligar(deN, paraN);
      } else if (e.key === "Escape") { e.stopPropagation(); selecao = null; marcar(); }
    });
    /* Ctrl+Z desfaz a última edição feita aqui, se o cursor não estiver num campo nem houver janela aberta */
    if (aoTeclarNaPagina) document.removeEventListener("keydown", aoTeclarNaPagina);
    aoTeclarNaPagina = (e) => {
      if (!caixa.isConnected) { document.removeEventListener("keydown", aoTeclarNaPagina); aoTeclarNaPagina = null; return; }
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") return;
      if (e.target.closest?.("input, textarea, select, [contenteditable], .camada.aberta, .rede-flutuante")) return;
      if (document.querySelector(".camada.aberta") || !edicao.temDesfazer()) return;
      e.preventDefault();
      edicao.desfazer();
    };
    document.addEventListener("keydown", aoTeclarNaPagina);

    /* ---------- caixinha de prazos junto à barra (como na Rede) ---------- */
    function abrirPrazo(n) {
      if (!edicao.usaEstimativas || !edicao.podeEstimar(n) || !barraDe(n)) return;
      limpar();
      const atual = edicao.estimativaDe(n);
      const rotulo = acoes.find((a) => a.numero === n)?.rotulo ?? "";
      const campo = (nome, texto) => `<label><span>${texto}</span><input name="${nome}" type="number" min="0" step="1" inputmode="numeric" value="${atual?.[nome] ?? ""}"></label>`;
      const el = abrirFlutuante(`
        <form class="rede-estimar-forma" novalidate>
          <p class="rede-estimar-titulo">Prazo em dias úteis</p>
          <div class="rede-estimar-campos">${campo("o", "Otimista")}${campo("m", "Mais provável")}${campo("p", "Pessimista")}</div>
          <p class="rede-estimar-erro" role="alert" hidden></p>
          <p class="rede-estimar-dica">Enter grava · Esc fecha · <button type="button" class="crono-abrir-acao" data-abrir-daqui>Abrir a ${esc(t)}</button></p>
        </form>`, {
        classe: "rede-estimar", rotulo: `Prazo de ${rotulo}`,
        posicionar: (caixaEl) => {
          const barra = document.querySelector(`.crono [data-barra="${n}"]`);
          if (!barra) return flutuanteAberto()?.fechar("sumiu");
          const r = barra.getBoundingClientRect();
          const v = document.querySelector(".crono [data-rolagem]").getBoundingClientRect();
          const baixo = r.bottom + 8 + caixaEl.offsetHeight < innerHeight - 8;
          colocar(caixaEl, Math.max(r.left, v.left + nomes + 4), baixo ? r.bottom + 8 : r.top - caixaEl.offsetHeight - 8);
        },
        aoFechar: (motivo) => { if (motivo === "esc" || motivo === "gravou") document.querySelector(`.crono [data-barra="${n}"]`)?.focus({ preventScroll: true }); },
      });
      const forma = el.querySelector("form");
      const erro = el.querySelector(".rede-estimar-erro");
      forma.o.focus();
      forma.o.select();
      forma.addEventListener("focusin", (e) => e.target.select?.());
      forma.addEventListener("click", (e) => {
        if (!e.target.closest("[data-abrir-daqui]")) return;
        flutuanteAberto()?.fechar("abrir");
        edicao.abrir(n);
      });
      forma.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter" || e.target.closest("[data-abrir-daqui]")) return;
        e.preventDefault();
        const valores = ["o", "m", "p"].map((k) => forma[k].value.trim());
        if (valores.every((v) => v === "")) return flutuanteAberto()?.fechar("vazio");
        const [o, m, p] = valores.map((v) => (v === "" ? NaN : Number(v)));
        if (atual && atual.o === o && atual.m === m && atual.p === p) return flutuanteAberto()?.fechar("gravou");
        const falha = await edicao.estimar(n, { o, m, p });
        if (falha) { erro.textContent = falha; erro.hidden = false; flutuanteAberto()?.posicionar(el); return; }
        flutuanteAberto()?.fechar("gravou");
      });
    }

    /* ---------- menu do botão direito (como na Rede) ---------- */
    function itensDoMenu(m) {
      if (m.tipo === "acao") {
        const n = m.numero;
        const ligavel = edicao.podeCriar && edicao.usaDependencias && !porNumero.get(n)?.continua;
        return [
          { rotulo: `Abrir a ${t}`, tecla: "Enter", fazer: () => edicao.abrir(n) },
          edicao.podeAlterar(n) && { rotulo: "Renomear", tecla: "F2", fazer: () => renomear(n) },
          edicao.usaEstimativas && edicao.podeEstimar(n) && { rotulo: "Prazo em dias úteis", fazer: () => abrirPrazo(n) },
          edicao.podeConcluir(n) && { rotulo: "Concluir…", fazer: () => edicao.concluir(n) },
          ligavel && { rotulo: `Nova ${t} antes desta`, fazer: () => criarE(null, () => edicao.criarAntes(n)) },
          ligavel && { rotulo: `Nova ${t} depois desta`, fazer: () => criarE(null, () => edicao.criarDepois(n)) },
          edicao.podeExcluir && { rotulo: `Excluir a ${t}`, perigo: true, fazer: () => edicao.excluir(n) },
        ].filter(Boolean);
      }
      const { de: deN, para: paraN } = m;
      return [
        edicao.podeCriar && { rotulo: `Inserir uma ${t} no meio`, fazer: () => criarE(null, () => edicao.inserirEntre(deN, paraN)) },
        { rotulo: "Retirar a ligação", tecla: "Delete", perigo: true, fazer: () => { selecao = null; edicao.desligar(deN, paraN); } },
      ].filter(Boolean);
    }
    function abrirMenu(m, clientX, clientY) {
      const itens = itensDoMenu(m);
      const el = abrirFlutuante(itens.map((i, k) => `<button type="button" role="menuitem" data-item="${k}"${i.perigo ? ' class="perigo"' : ""}>
        <span>${esc(i.rotulo)}</span>${i.tecla ? `<kbd>${i.tecla}</kbd>` : ""}</button>`).join(""), {
        classe: "menu-da-janela rede-menu", papel: "menu", rotulo: "Opções", fechaAoRolar: true,
        posicionar: (caixaEl) => colocar(caixaEl, clientX, clientY),
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
        flutuanteAberto()?.fechar("escolha");
        itens[Number(b.dataset.item)].fazer();
      });
    }
    caixa.addEventListener("contextmenu", (e) => {
      if (e.target.closest("[data-editando]")) return;
      const naSeta = e.target.closest(".crono-seta-alvo");
      const linha = e.target.closest(".crono-linha[data-numero]");
      let m = null;
      if (naSeta) { selecionarSeta(Number(naSeta.dataset.de), Number(naSeta.dataset.para)); m = { tipo: "seta", ...selecao }; }
      else if (linha && e.target.closest(".crono-nome, [data-barra]")) m = { tipo: "acao", numero: Number(linha.dataset.numero) };
      if (!m) return; // no fundo, o menu do navegador
      e.preventDefault();
      limpar();
      abrirMenu(m, e.clientX, e.clientY);
    });
    /* as caixas soltas acompanham a rolagem (o menu fecha) */
    rolagem.addEventListener("scroll", () => {
      const f = flutuanteAberto();
      if (!f) return;
      if (f.rolagem) f.fechar("rolagem");
      else f.posicionar(f.el);
    }, { passive: true });
    const aberto = flutuanteAberto();
    if (aberto && !aberto.rolagem) requestAnimationFrame(() => flutuanteAberto()?.posicionar(flutuanteAberto().el));
    else aberto?.fechar("redesenho");

    /* ---------- arrastos: a borda direita muda o prazo; a bolinha liga duas ações ---------- */
    /* perto das bordas da área, o arrasto rola o cronograma */
    const rolarNaBorda = (e) => {
      const v = rolagem.getBoundingClientRect();
      if (e.clientX > v.right - 36) rolagem.scrollLeft += 14;
      else if (e.clientX < v.left + nomes + 36) rolagem.scrollLeft -= 14;
      if (e.clientY > v.bottom - 30) rolagem.scrollTop += 12;
      else if (e.clientY < v.top + 40 + 30) rolagem.scrollTop -= 12;
    };
    caixa.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const borda = e.target.closest("[data-borda]");
      const alca = e.target.closest("[data-alca]");
      if (borda) return arrastarBorda(e, borda);
      if (alca) return arrastarLigacao(e, alca);
      const nome = e.target.closest(".crono-linha[data-numero] > .crono-nome");
      if (nome && e.pointerType !== "touch" && !e.target.closest("[data-editando]") && edicao.podeAlterar(Number(nome.parentElement.dataset.numero))) arrastarLinha(e, nome.parentElement);
    });

    /**
     * Linha arrastada pelo nome (decisão do responsável, 10/11/2026): solta entre duas ações, muda a ordem; solta em
     * outra etapa, muda também a etapa. Só mexe na ordem do espaço e na etapa: as datas continuam calculadas.
     */
    function arrastarLinha(e, linha) {
      const n = Number(linha.dataset.numero);
      const y0 = e.clientY;
      const corpoEl = caixa.querySelector(".crono-corpo");
      let marca = null;
      let alvoAtual = null;
      const mover = (ev) => {
        if (!marca) {
          if (Math.abs(ev.clientY - y0) < 6) return;
          arrastando = true;
          clearTimeout(abrirDepois);
          limpar();
          caixa.classList.add("movendo");
          linha.classList.add("sendo-movida");
          marca = document.createElement("i");
          marca.className = "crono-insercao";
          corpoEl.append(marca);
        }
        ev.preventDefault();
        rolarNaBorda(ev);
        const y = ev.clientY - corpoEl.getBoundingClientRect().top;
        const i = Math.max(0, Math.min(linhas.length - 1, Math.floor(y / ALTURA)));
        const l = linhas[i];
        let alvoNovo = null;
        let yMarca = 0;
        if (l.tipo === "acao") {
          const antes = y - i * ALTURA < ALTURA / 2;
          const etapa = usaFases ? l.barra.acao.etapa ?? null : undefined;
          /* soltar em cima de si mesma, ou encostada nela dentro da mesma etapa, não muda nada */
          const vizinha = linhas[antes ? i - 1 : i + 1];
          const semEfeito = l.barra.numero === n || (vizinha?.tipo === "acao" && vizinha.barra.numero === n);
          if (!semEfeito) alvoNovo = { etapa, ...(antes ? { antesDe: l.barra.numero } : { depoisDe: l.barra.numero }) };
          yMarca = (antes ? i : i + 1) * ALTURA;
        } else if (l.nivel === "etapa" || l.id === "sem-etapa") {
          /* no título da etapa: vai para o começo dela (também quando está recolhida) */
          const etapa = l.id === "sem-etapa" ? null : l.id;
          const primeira = linhas[i + 1];
          if (!(primeira?.tipo === "acao" && primeira.barra.numero === n)) alvoNovo = { etapa, primeira: true };
          yMarca = (i + 1) * ALTURA;
        }
        alvoAtual = alvoNovo;
        marca.hidden = !alvoNovo;
        marca.style.top = `${yMarca - 1}px`;
      };
      const soltar = (ev) => {
        removeEventListener("pointermove", mover);
        removeEventListener("pointerup", soltar);
        removeEventListener("pointercancel", soltar);
        if (!marca) return;
        arrastando = false;
        acabouDeMover = true;
        setTimeout(() => { acabouDeMover = false; }, 0);
        caixa.classList.remove("movendo");
        linha.classList.remove("sendo-movida");
        marca.remove();
        if (ev.type === "pointercancel" || !alvoAtual) return;
        edicao.mover(n, alvoAtual);
      };
      addEventListener("pointermove", mover, { passive: false });
      addEventListener("pointerup", soltar);
      addEventListener("pointercancel", soltar);
    }

    /**
     * Borda direita da barra (decisão do responsável, 10/11/2026): solta num dia, a ação passa a terminar nele; os três
     * prazos mudam na mesma proporção (js/cronograma.js, estimativaParaTerminarEm). O começo da barra não se move.
     */
    function arrastarBorda(e, borda) {
      const n = Number(borda.dataset.borda);
      const b = porNumero.get(n);
      const barra = barraDe(n);
      const p = posicao.get(n);
      const vigente = edicao.estimativaDe(n);
      if (!b || !barra || !vigente) return;
      e.preventDefault();
      borda.setPointerCapture(e.pointerId);
      arrastando = true;
      limpar();
      caixa.classList.add("arrastando-borda");
      barra.classList.add("esticando");
      const primeiro = cal.diasUteisAte(b.inicio) - 1; // índice do dia útil em que a barra começa
      let dia = cal.diasUteisAte(b.fim) - 1;
      const mover = (ev) => {
        rolarNaBorda(ev);
        /* o dia de calendário sob o ponteiro; fim de semana e feriado valem o dia útil anterior */
        const sob = somar(de, Math.round(diaSob(ev.clientX)) - 1);
        dia = Math.max(primeiro, cal.diasUteisAte(sob < b.inicio ? b.inicio : sob) - 1);
        const fimNovo = cal.data(dia);
        const largo = Math.max(4, x(somar(fimNovo, 1)) - p.x0);
        barra.style.width = `${largo}px`;
        borda.style.left = `calc(var(--nomes) + ${p.x0 + largo - 5}px)`;
        mostrarDica(barra, `<b>${esc(b.acao.rotulo)}</b><br>Termina em <span class="mono">${dataBr(fimNovo)}</span>${fimNovo === b.fim ? "" : `<br>Antes: <span class="mono">${dataBr(b.fim)}</span>`}`);
      };
      const soltar = async (ev) => {
        borda.removeEventListener("pointermove", mover);
        arrastando = false;
        caixa.classList.remove("arrastando-borda");
        barra.classList.remove("esticando");
        dica.hidden = true;
        const voltar = () => { barra.style.width = `${Math.max(4, p.x1 - p.x0)}px`; borda.style.left = `calc(var(--nomes) + ${Math.max(p.x0 + 4, p.x1) - 5}px)`; };
        if (ev.type === "pointercancel" || cal.data(dia) === b.fim) return voltar();
        const contaDe = vigente.contaDe === "data" ? cal.diasUteisAntes(vigente.em) : b.liberacao;
        const tres = estimativaParaTerminarEm(vigente, contaDe, dia);
        if (!tres) { voltar(); return avisar("Não deu para ajustar o prazo para esse dia."); }
        if (tres.o === vigente.o && tres.m === vigente.m && tres.p === vigente.p) return voltar();
        const falha = await edicao.estimar(n, tres);
        if (falha) { voltar(); return avisar(falha); }
        /* gravado: a caixinha dos três prazos abre junto à barra, para conferir ou acertar os números (decisão do
           responsável, 10/11/2026); espera o redesenho e o deslizar da barra */
        setTimeout(() => abrirPrazoNoAtual(n), DURACAO + 80);
      };
      borda.addEventListener("pointermove", mover);
      borda.addEventListener("pointerup", soltar, { once: true });
      borda.addEventListener("pointercancel", soltar, { once: true });
    }

    /** Bolinha da ponta: arrastada até outra ação, esta passa a depender daquela (só começa quando ela terminar). */
    function arrastarLigacao(e, alca) {
      const origem = Number(alca.dataset.alca);
      const p = posicao.get(origem);
      if (!p) return;
      e.preventDefault();
      alca.setPointerCapture(e.pointerId);
      arrastando = true;
      limpar();
      caixa.classList.add("ligando");
      const svg = caixa.querySelector(".crono-setas");
      const fio = document.createElementNS("http://www.w3.org/2000/svg", "path");
      fio.setAttribute("class", "crono-fio");
      svg.append(fio);
      const xDaPonta = Number.parseFloat(alca.style.left.match(/\+ ([\d.-]+)px/)?.[1] ?? p.x1) + 6;
      let destino = null;
      const mover = (ev) => {
        rolarNaBorda(ev);
        const r = trilho.getBoundingClientRect();
        fio.setAttribute("d", `M${xDaPonta},${p.y} L${ev.clientX - r.left},${ev.clientY - r.top}`);
        const sob = document.elementsFromPoint(ev.clientX, ev.clientY).map((el) => el.closest?.(".crono-linha[data-numero]")).find(Boolean);
        const n = sob ? Number(sob.dataset.numero) : null;
        const novo = n != null && n !== origem && !porNumero.get(n)?.continua ? n : null;
        if (novo === destino) return;
        linhaDe(destino)?.classList.remove("alvo-da-ligacao");
        destino = novo;
        linhaDe(destino)?.classList.add("alvo-da-ligacao");
      };
      const soltar = (ev) => {
        alca.removeEventListener("pointermove", mover);
        arrastando = false;
        caixa.classList.remove("ligando");
        fio.remove();
        linhaDe(destino)?.classList.remove("alvo-da-ligacao");
        if (ev.type === "pointercancel" || destino == null) return;
        if (porNumero.get(destino)?.dependeDe.includes(origem)) return avisar("Essas duas já estão ligadas.");
        edicao.ligar(origem, destino);
      };
      alca.addEventListener("pointermove", mover);
      alca.addEventListener("pointerup", soltar, { once: true });
      alca.addEventListener("pointercancel", soltar, { once: true });
    }
  }
}

/**
 * Movimento com sentido (10/11/2026): depois de uma edição ou de recolher um grupo, as linhas deslizam de onde estavam
 * para o novo lugar, as barras vão da posição e do tamanho antigos para os novos, e o que é novo surge. As setas
 * voltam no fim, já no traçado novo. Sem desenho anterior, com outro zoom ou com "Reduzir movimento", nada se anima.
 */
function animarMudanca(caixa, geometria) {
  const antes = anterior;
  anterior = geometria;
  if (!antes || antes.espaco !== geometria.espaco || antes.px !== geometria.px || reduzirMovimento()) return;
  /* o eixo pode ter começado em outro dia: converte as posições antigas para o eixo novo */
  const dx = dias(geometria.de, antes.de) * geometria.px;
  const opcoes = { duration: DURACAO, easing: CURVA };
  let mexeu = false;
  for (const linha of caixa.querySelectorAll(".crono-linha[data-chave]")) {
    const chave = linha.dataset.chave;
    const yNovo = geometria.linhas.get(chave);
    if (!antes.linhas.has(chave)) { linha.animate([{ opacity: 0 }, { opacity: 1 }], opcoes); mexeu = true; continue; }
    const yAntes = antes.linhas.get(chave);
    if (yAntes !== yNovo) { linha.animate([{ transform: `translateY(${yAntes - yNovo}px)` }, { transform: "none" }], opcoes); mexeu = true; }
    const n = Number(linha.dataset.numero);
    const a = antes.barras.get(n);
    const b = geometria.barras.get(n);
    if (!a || !b || (Math.abs(a.x0 + dx - b.x0) < 0.5 && Math.abs(a.largo - b.largo) < 0.5)) continue;
    linha.querySelector("[data-barra]")?.animate([
      { left: `calc(var(--nomes) + ${a.x0 + dx}px)`, width: `${a.largo}px` },
      { left: `calc(var(--nomes) + ${b.x0}px)`, width: `${b.largo}px` }], opcoes);
    mexeu = true;
  }
  if (mexeu || antes.linhas.size !== geometria.linhas.size) {
    caixa.querySelector(".crono-setas")?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1 }], { duration: DURACAO + 120, easing: "linear" });
  }
}
