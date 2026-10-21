/**
 * Modo "Cronograma" do espaço (especificação, seção 8.4; passo 1.17b, primeira versão).
 * Barras das ações no tempo, com as dependências em setas, agrupadas por fase e etapa.
 * Interativo: passar o mouse numa barra mostra as datas e a folga e destaca as ligações;
 * clicar abre a ação; dois níveis de aproximação (semanas e meses).
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

/** Pixels por dia de calendário em cada aproximação. */
const ESCALAS = [["semanas", "Semanas", 18], ["meses", "Meses", 5]];
const ALTURA = 34;

/**
 * @param {HTMLElement} alvo
 * @param {{espaco: object, acoes: object[], caminho: object, cal: object, hoje: string, usaFases: boolean,
 *   usaCodigos: boolean, escala: string, aoMudarEscala: (escala: string) => void,
 *   retratos?: object[]|null, comparar?: string|null, base?: Map<number, {inicio: string, fim: string}>|null,
 *   aoComparar?: (id: string|null) => void}} dados
 *   retratos: cabeçalhos dos retratos do espaço (null: ainda carregando); comparar: id do retrato escolhido;
 *   base: datas de cada ação no retrato escolhido
 */
export function desenharCronograma(alvo, { espaco, acoes, caminho, cal, hoje, usaFases, usaCodigos, escala, aoMudarEscala,
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
  const px = (ESCALAS.find(([v]) => v === escala) ?? ESCALAS[0])[2];
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
    if (px >= 12 && data.getUTCDay() === 1) marcasTopo.push(`<span class="crono-dia" style="left:${x(d)}px">${data.getUTCDate()}</span>`);
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
        ${usaCodigos && a.codigo ? `<span class="codigo">${esc(a.codigo)}</span>` : ""}<span class="rotulo">${esc(a.rotulo)}</span>
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
  const rolagemAnterior = anterior ? { esquerda: anterior.scrollLeft, escala: alvo.dataset.cronoEscala } : null;
  alvo.dataset.cronoEscala = escala;
  alvo.innerHTML = `
    <div class="crono-ferramentas">
      <div class="alternador" role="group" aria-label="Aproximação">
        ${ESCALAS.map(([v, nome]) => `<button type="button" data-escala="${v}" aria-pressed="${v === escala}">${nome}</button>`).join("")}
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
    const b = e.target.closest("[data-escala]");
    if (b && b.dataset.escala !== escala) aoMudarEscala(b.dataset.escala);
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
  rolagem.scrollLeft = rolagemAnterior?.escala === escala ? rolagemAnterior.esquerda : Math.max(0, x(hoje) - 14 * px);
}
