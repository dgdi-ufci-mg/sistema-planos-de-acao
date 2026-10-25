/**
 * Modo "Linha do tempo" do espaço (documentação técnica, seção 8.4; passo 1.17a, primeira versão).
 * Responde a uma pergunta: quando o trabalho termina? Mostra, do início do espaço ao prazo final:
 * - três números: conclusão prevista (P50), data segura (P80) e a chance de cumprir o prazo final;
 * - as barras de quanto dos cenários simulados termina em cada semana;
 * - a curva da chance acumulada de terminar até cada data;
 * - as marcas de hoje, da conclusão prevista, da data segura e do prazo final.
 * Interativa: passando o mouse, mostra a chance de terminar até a data apontada.
 * No celular desde 25/10/2026 (item 2 da avaliação de celular): o desenho usa a largura da tela, e tocar ou
 * deslizar o dedo no gráfico mostra a chance na data apontada.
 */
import { distribuicaoDoTermino, chanceAte, somarDias } from "../linha-do-tempo.js";
import { esc, dataBr } from "../formato.js";

const UM_DIA = 864e5;
const dias = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / UM_DIA;
const pct = (x) => `${Math.round(x * 100)}%`;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Desenha a linha do tempo dentro de `alvo`.
 * @param {HTMLElement} alvo
 * @param {{espaco: object, cal: object, sim: object, hoje: string, temAcoes: boolean}} dados
 */
export function desenharLinhaDoTempo(alvo, { espaco, cal, sim, hoje, temAcoes }) {
  if (!temAcoes) {
    alvo.innerHTML = `<p class="lista-vazia">Este espaço ainda não tem ações. A linha do tempo aparece quando houver ações estimadas.</p>`;
    return;
  }
  const prazo = espaco.prazoFinal ?? null;
  const p50 = cal.dataDeConclusao(sim.p50, 0);
  const p80 = cal.dataDeConclusao(sim.p80, 0);
  const { semanas, porDia } = distribuicaoDoTermino(sim.fins, cal);

  const cartoes = `<div class="tempo-numeros">
    <div class="tempo-numero"><span class="tempo-rotulo">Conclusão prevista</span><b class="mono">${dataBr(p50)}</b>
      <span class="tec">Metade dos cenários termina até aqui.</span></div>
    <div class="tempo-numero segura"><span class="tempo-rotulo">Data segura <a href="#" class="oque" data-termo="dataSegura">o que é?</a></span><b class="mono">${dataBr(p80)}</b>
      <span class="tec">80% dos cenários terminam até aqui.</span></div>
    ${prazo ? `<div class="tempo-numero prazo${sim.chancePrazo < 0.5 ? " ruim" : ""}"><span class="tempo-rotulo">Prazo final <a href="#" class="oque" data-termo="chancePrazo">o que é?</a></span><b class="mono">${dataBr(prazo)}</b>
      <span class="tec"><b>${pct(sim.chancePrazo)}</b> de chance de terminar até o prazo.</span></div>` : ""}
  </div>`;

  alvo.innerHTML = `${cartoes}
    <figure class="tempo-grafico" aria-label="Linha do tempo: em que data o trabalho pode terminar">
      <div class="tempo-desenho" data-desenho></div>
      <div class="tempo-dica" data-dica hidden></div>
      <figcaption class="tec">Barras: parte dos cenários simulados que termina em cada semana. Linha: chance de terminar até cada data. ${matchMedia("(hover: none)").matches ? "Toque ou deslize o dedo no gráfico" : "Passe o mouse"} para ver a chance em qualquer data.</figcaption>
    </figure>`;

  const desenho = alvo.querySelector("[data-desenho]");
  const dica = alvo.querySelector("[data-dica]");

  /* ---------- escala ---------- */
  const ultimo = porDia.at(-1)?.data ?? p80;
  const ini = [espaco.inicio, hoje].sort()[0];
  const fim = [ultimo, prazo ?? ultimo, hoje].sort().at(-1);
  const de = somarDias(ini, -3);
  const ate = somarDias(fim, 7);
  const total = Math.max(1, dias(de, ate));

  const L = Math.max(matchMedia("(max-width: 640px)").matches ? 300 : 560, desenho.clientWidth || 900);
  const A = 330;
  const M = { esq: 12, dir: 44, topo: 84, base: 28 }; // topo: até quatro alturas de rótulo
  const largura = L - M.esq - M.dir;
  const altura = A - M.topo - M.base;
  const x = (iso) => M.esq + (dias(de, iso) / total) * largura;
  const y = (c) => M.topo + (1 - c) * altura;
  const maxParcela = Math.max(...semanas.map((s) => s.parcela), 0.0001);
  const yBarra = (p) => M.topo + altura - (p / maxParcela) * altura * 0.55;

  /* passado: do início a hoje */
  const passado = hoje > de
    ? `<rect class="t-passado" x="${x(de)}" y="${M.topo}" width="${Math.max(0, x(hoje < ate ? hoje : ate) - x(de))}" height="${altura}"/>` : "";

  /* linhas de 0%, 50% e 100% da chance, com rótulos à direita */
  const grade = [0, 0.5, 1].map((c) => `<line class="t-grade" x1="${M.esq}" x2="${M.esq + largura}" y1="${y(c)}" y2="${y(c)}"/>
    <text class="t-eixo" x="${M.esq + largura + 6}" y="${y(c) + 4}">${pct(c)}</text>`).join("");

  /* início de cada mês */
  const meses = [];
  let proximoRotulo = -Infinity;
  for (let d = new Date(`${de.slice(0, 7)}-01T00:00:00Z`); d.toISOString().slice(0, 10) <= ate; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso < de) continue;
    const rotulo = d.getUTCMonth() === 0 || !meses.length ? `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}` : MESES[d.getUTCMonth()];
    /* na tela estreita, o rótulo que encostaria no anterior fica de fora (fica a marca do mês) */
    const cabe = x(iso) >= proximoRotulo;
    if (cabe) proximoRotulo = x(iso) + rotulo.length * 7 + 8;
    meses.push(`<line class="t-mes" x1="${x(iso)}" x2="${x(iso)}" y1="${M.topo + altura}" y2="${M.topo + altura + 5}"/>
      ${cabe ? `<text class="t-eixo" x="${x(iso) + 3}" y="${M.topo + altura + 18}">${rotulo}</text>` : ""}`);
  }

  /* barras semanais: depois do prazo final, na cor de alerta */
  const barras = semanas.map(({ semana, parcela }) => {
    const x0 = x(semana) + 1;
    const w = Math.max(2, x(somarDias(semana, 7)) - x(semana) - 2);
    const depois = prazo && semana > prazo;
    return `<rect class="t-barra${depois ? " depois" : ""}" x="${x0}" y="${yBarra(parcela)}" width="${w}" height="${M.topo + altura - yBarra(parcela)}" rx="2"/>`;
  }).join("");

  /* curva da chance acumulada, em degraus */
  let caminho = `M${x(de)},${y(0)}`;
  for (const { data, chanceAte: c } of porDia) caminho += ` H${x(data)} V${y(c)}`;
  caminho += ` H${x(ate)}`;

  /* marcas: hoje, conclusão prevista, data segura e prazo final */
  const marcas = [
    { iso: hoje, nome: "Hoje", classe: "hoje" },
    { iso: p50, nome: "Conclusão prevista", classe: "p50" },
    { iso: p80, nome: "Data segura", classe: "p80" },
    ...(prazo ? [{ iso: prazo, nome: `Prazo final · ${pct(sim.chancePrazo)}`, classe: "prazo" }] : []),
  ].sort((a, b) => a.iso.localeCompare(b.iso));
  /* cada rótulo vai na primeira altura livre; perto da borda direita, é puxado para dentro */
  const fimPorNivel = [];
  const marcasSvg = marcas.map((m) => {
    const px = x(m.iso);
    const larguraTexto = (m.nome.length + 11) * 6.6;
    const tx = Math.min(px + 4, L - larguraTexto);
    let nivel = fimPorNivel.findIndex((f) => tx > f + 8);
    if (nivel < 0) nivel = fimPorNivel.length;
    fimPorNivel[nivel] = tx + larguraTexto;
    const ty = 14 + nivel * 18;
    return `<g class="t-marca ${m.classe}">
      <line x1="${px}" x2="${px}" y1="${ty + 5}" y2="${M.topo + altura}"/>
      <text x="${tx}" y="${ty}"><tspan class="t-marca-nome">${esc(m.nome)}</tspan><tspan class="t-marca-data" dx="6">${dataBr(m.iso)}</tspan></text>
    </g>`;
  }).join("");

  desenho.innerHTML = `<svg viewBox="0 0 ${L} ${A}" width="${L}" height="${A}" role="img" aria-label="Chance de terminar ao longo do tempo">
    ${passado}${grade}${meses.join("")}${barras}
    <path class="t-curva" d="${caminho}"/>
    ${marcasSvg}
    <line class="t-mira" data-mira x1="0" x2="0" y1="${M.topo}" y2="${M.topo + altura}" visibility="hidden"/>
    <circle class="t-ponto" data-ponto r="4" visibility="hidden"/>
    <rect class="t-sensor" data-sensor x="${M.esq}" y="${M.topo}" width="${largura}" height="${altura}"/>
  </svg>`;

  /* ---------- interação: mira e dica ---------- */
  const svg = desenho.querySelector("svg");
  const mira = svg.querySelector("[data-mira]");
  const ponto = svg.querySelector("[data-ponto]");
  const sensor = svg.querySelector("[data-sensor]");
  const esconder = () => { mira.setAttribute("visibility", "hidden"); ponto.setAttribute("visibility", "hidden"); dica.hidden = true; };
  const mostrar = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    const data = somarDias(de, Math.round(((px - M.esq) / largura) * total));
    const c = chanceAte(porDia, data);
    const mx = x(data);
    mira.setAttribute("x1", mx); mira.setAttribute("x2", mx); mira.setAttribute("visibility", "visible");
    ponto.setAttribute("cx", mx); ponto.setAttribute("cy", y(c)); ponto.setAttribute("visibility", "visible");
    dica.innerHTML = `Até <b class="mono">${dataBr(data)}</b>: <b>${pct(c)}</b> de chance de terminar`;
    dica.hidden = false;
    const caixa = desenho.getBoundingClientRect();
    const esquerda = ((mx / L) * r.width) + (r.left - caixa.left);
    dica.style.left = `${Math.min(Math.max(0, esquerda + 12), caixa.width - dica.offsetWidth)}px`;
    dica.style.top = `${((y(c) / A) * r.height) - 36}px`;
  };
  sensor.addEventListener("pointermove", mostrar);
  sensor.addEventListener("pointerdown", mostrar); // no celular, o toque mostra a data apontada
  sensor.addEventListener("pointerleave", esconder);
}
