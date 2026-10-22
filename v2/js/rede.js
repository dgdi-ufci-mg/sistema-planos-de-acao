/**
 * Rede do espaço, "Fluxo das ações" (especificação, seção 8.4; passo 1.17c): regras, sem tela.
 *
 * Desenho em camadas, o mesmo método do Mermaid (Sugiyama), com raias e setas em ângulo reto,
 * como no Bizagi (revisto em 22/10/2026, a pedido do responsável):
 * 1. Colunas: cada ação fica na coluna seguinte à da sua anterior mais distante. Ação sem
 *    anteriores vai para junto da primeira seguinte, para encurtar setas.
 * 2. Raias: uma faixa horizontal por etapa, na ordem do espaço; cada ação fica na raia da sua etapa.
 * 3. Setas longas ganham pontos de passagem nas colunas do meio, cada um com o seu lugar na coluna
 *    (na raia de onde a seta sai): a seta passa entre os cartões, nunca por cima deles.
 * 4. Ordem dentro da coluna e da raia: média da posição dos vizinhos, em passadas para a frente e
 *    para trás, com trocas que diminuam cruzamentos; fica a ordem com menos cruzamentos.
 * 5. Altura: cada item vai para perto da altura média dos vizinhos da mesma raia, sem sair da ordem
 *    nem encostar nos outros (regressão isotônica). Cadeias e setas longas ficam retas.
 * 6. Setas em ângulo reto: as descidas e subidas ficam nos vãos entre colunas, cada uma no seu
 *    trilho; a ordem dos trilhos é a que cruza menos. Onde duas setas se cruzam, a horizontal dá
 *    um pequeno salto sobre a vertical, como no Visio.
 * Sem biblioteca externa.
 */

/** Medidas padrão do desenho, em pixels. */
export const MEDIDAS = Object.freeze({
  largura: 240, altura: 100, vaoX: 64, vaoY: 20, vaoSeta: 14, margem: 16,
  trilha: 10, cabecaRaia: 44, folgaRaia: 18, salto: 4,
});

/**
 * @param {object[]} acoes ações ativas, na ordem do espaço
 * @param {{porAcao: Map}} caminho resultado de caminhoCritico
 * @param {{raias?: {id: string, nome: string, titulo?: string}[], raiaDe?: (acao: object) => string|null,
 *   medidas?: Partial<typeof MEDIDAS>}} [opcoes] raias: as etapas, na ordem; sem raias, uma faixa só, sem cerca
 * @returns {{colunas: number[][], coluna: Map<number, number>, pos: Map<number, {x: number, y: number}>,
 *   arestas: {de: number, para: number, critica: boolean, pontos: number[][], saltos: number[][]}[],
 *   raias: {id: string, nome: string, titulo: string, y: number, altura: number}[], largura: number, altura: number}}
 *   pos: canto superior esquerdo de cada cartão; pontos: linha em ângulo reto, da saída à chegada;
 *   saltos: pontos onde a seta salta sobre outra
 */
export function montarRede(acoes, caminho, opcoes = {}) {
  const M = { ...MEDIDAS, ...(opcoes.medidas ?? {}) };
  const numeros = new Set(acoes.map((a) => a.numero));
  const anteriores = new Map(acoes.map((a) => [a.numero, [...new Set((a.dependeDe ?? []).filter((d) => numeros.has(d) && d !== a.numero))]]));
  const seguintes = new Map(acoes.map((a) => [a.numero, []]));
  for (const [n, ds] of anteriores) for (const d of ds) seguintes.get(d).push(n);

  /* ---------- 1. colunas ---------- */
  const coluna = new Map();
  const visitando = new Set();
  const colunaDe = (n) => {
    if (coluna.has(n)) return coluna.get(n);
    if (visitando.has(n)) return 0;
    visitando.add(n);
    const c = Math.max(-1, ...anteriores.get(n).map(colunaDe)) + 1;
    visitando.delete(n);
    coluna.set(n, c);
    return c;
  };
  for (const a of acoes) colunaDe(a.numero);
  for (const a of acoes) {
    const segs = seguintes.get(a.numero).filter((s) => coluna.get(s) > coluna.get(a.numero));
    if (!anteriores.get(a.numero).length && segs.length) coluna.set(a.numero, Math.min(...segs.map((s) => coluna.get(s))) - 1);
  }
  const total = acoes.length ? Math.max(...coluna.values()) + 1 : 0;

  /* ---------- 2. raias ---------- */
  const comRaias = Array.isArray(opcoes.raias);
  const pedidas = comRaias ? opcoes.raias : [];
  const indiceDaRaia = new Map(pedidas.map((r, i) => [r.id, i]));
  const SEM = pedidas.length;
  const raiaDaAcao = new Map(acoes.map((a) => {
    const id = comRaias ? opcoes.raiaDe?.(a) : null;
    return [a.numero, indiceDaRaia.has(id) ? indiceDaRaia.get(id) : SEM];
  }));

  /* ---------- 3. arestas e pontos de passagem ---------- */
  const arestas = [];
  for (const a of acoes) {
    for (const d of anteriores.get(a.numero)) {
      if (coluna.get(d) >= coluna.get(a.numero)) continue; // num ciclo, a seta que volta fica de fora
      const x = caminho.porAcao.get(d);
      const y = caminho.porAcao.get(a.numero);
      arestas.push({ de: d, para: a.numero, critica: Boolean(x?.critica && y?.critica && Math.abs(x.conclusao - y.liberacao) < 1e-6) });
    }
  }
  const camadas = Array.from({ length: total }, () => []);
  const ordemDoEspaco = new Map(acoes.map((a, i) => [a.numero, i]));
  for (const a of acoes) camadas[coluna.get(a.numero)].push(a.numero);
  const raiaDoItem = new Map(acoes.map((a) => [a.numero, raiaDaAcao.get(a.numero)]));
  const esquerda = new Map(acoes.map((a) => [a.numero, []]));
  const direita = new Map(acoes.map((a) => [a.numero, []]));
  arestas.forEach((ar, i) => {
    ar.cadeia = [ar.de];
    for (let c = coluna.get(ar.de) + 1; c < coluna.get(ar.para); c++) {
      const p = `${i}:${c}`;
      camadas[c].push(p);
      ar.cadeia.push(p);
      raiaDoItem.set(p, raiaDaAcao.get(ar.de));
      esquerda.set(p, []);
      direita.set(p, []);
    }
    ar.cadeia.push(ar.para);
    for (let k = 0; k + 1 < ar.cadeia.length; k++) { direita.get(ar.cadeia[k]).push(ar.cadeia[k + 1]); esquerda.get(ar.cadeia[k + 1]).push(ar.cadeia[k]); }
  });
  const ehAcao = (it) => typeof it === "number";
  const raia = (it) => raiaDoItem.get(it);

  /* ---------- 4. ordem dentro das colunas (raia primeiro) ---------- */
  const chave = (it) => (ehAcao(it) ? ordemDoEspaco.get(it) : ordemDoEspaco.get(arestas[Number(it.split(":")[0])].de) + 0.5);
  for (const c of camadas) c.sort((p, q) => raia(p) - raia(q) || chave(p) - chave(q));
  const cruzamentosEntre = (c, camada = camadas) => {
    if (c < 0 || c + 1 >= camada.length) return 0;
    const pe = new Map(camada[c].map((it, i) => [it, i]));
    const pd = new Map(camada[c + 1].map((it, i) => [it, i]));
    const seg = [];
    for (const it of camada[c]) for (const d of direita.get(it)) seg.push([pe.get(it), pd.get(d)]);
    let n = 0;
    for (let i = 0; i < seg.length; i++) for (let j = i + 1; j < seg.length; j++) {
      if ((seg[i][0] - seg[j][0]) * (seg[i][1] - seg[j][1]) < 0) n++;
    }
    return n;
  };
  const totalDeCruzamentos = (camada) => camada.reduce((s, _, c) => s + cruzamentosEntre(c, camada), 0);
  const baricentro = (c, vizinhos) => {
    const pos = new Map(camadas[c + (vizinhos === esquerda ? -1 : 1)].map((it, i) => [it, i]));
    camadas[c] = camadas[c]
      .map((it, i) => {
        const vs = vizinhos.get(it);
        return [it, vs.length ? vs.reduce((s, v) => s + pos.get(v), 0) / vs.length : i];
      })
      .sort((p, q) => raia(p[0]) - raia(q[0]) || p[1] - q[1])
      .map(([it]) => it);
  };
  const trocar = (c) => {
    let melhorou = true;
    while (melhorou) {
      melhorou = false;
      for (let i = 0; i + 1 < camadas[c].length; i++) {
        if (raia(camadas[c][i]) !== raia(camadas[c][i + 1])) continue;
        const antes = cruzamentosEntre(c - 1) + cruzamentosEntre(c);
        [camadas[c][i], camadas[c][i + 1]] = [camadas[c][i + 1], camadas[c][i]];
        if (cruzamentosEntre(c - 1) + cruzamentosEntre(c) < antes) melhorou = true;
        else [camadas[c][i], camadas[c][i + 1]] = [camadas[c][i + 1], camadas[c][i]];
      }
    }
  };
  let melhor = camadas.map((c) => [...c]);
  let menor = totalDeCruzamentos(camadas);
  for (let passada = 0; passada < 12 && menor > 0; passada++) {
    for (let c = 1; c < total; c++) { baricentro(c, esquerda); trocar(c); }
    for (let c = total - 2; c >= 0; c--) { baricentro(c, direita); trocar(c); }
    const n = totalDeCruzamentos(camadas);
    if (n < menor) { menor = n; melhor = camadas.map((c) => [...c]); }
  }
  melhor.forEach((c, i) => { camadas[i] = c; });

  /* ---------- 5. altura de cada item, raia por raia ---------- */
  const alturaDe = (it) => (ehAcao(it) ? M.altura : 0);
  const separacao = (p, q) => (alturaDe(p) + alturaDe(q)) / 2 + (ehAcao(p) && ehAcao(q) ? M.vaoY : M.vaoSeta);
  const nRaias = SEM + 1;
  const daRaia = (c, r) => camadas[c].filter((it) => raia(it) === r);
  const centro = new Map();
  for (let r = 0; r < nRaias; r++) {
    for (let c = 0; c < total; c++) {
      let y = 0;
      daRaia(c, r).forEach((it, i, lista) => { if (i) y += separacao(lista[i - 1], it); centro.set(it, y); });
    }
  }
  /* regressão isotônica com espaçamento mínimo: o mais perto possível dos alvos, mantendo a ordem */
  const acomodar = (itens, alvos, pesos) => {
    const desloc = [0];
    for (let i = 1; i < itens.length; i++) desloc.push(desloc[i - 1] + separacao(itens[i - 1], itens[i]));
    const blocos = [];
    itens.forEach((_, i) => {
      blocos.push({ soma: (alvos[i] - desloc[i]) * pesos[i], peso: pesos[i], n: 1 });
      while (blocos.length > 1 && blocos.at(-2).soma / blocos.at(-2).peso > blocos.at(-1).soma / blocos.at(-1).peso) {
        const b = blocos.pop();
        const a = blocos.at(-1);
        a.soma += b.soma; a.peso += b.peso; a.n += b.n;
      }
    });
    let i = 0;
    for (const b of blocos) for (let k = 0; k < b.n; k++, i++) centro.set(itens[i], b.soma / b.peso + desloc[i]);
  };
  const relaxar = (c, r) => {
    const itens = daRaia(c, r);
    if (!itens.length) return;
    const alvos = [];
    const pesos = [];
    itens.forEach((it, i) => {
      const vs = [...esquerda.get(it), ...direita.get(it)].filter((v) => raia(v) === r); // só vizinhos da mesma raia
      /* sem vizinhos na raia: fica encostado no item de cima (ou no de baixo), para não sobrar vazio */
      const encostado = i > 0 ? centro.get(itens[i - 1]) + separacao(itens[i - 1], it)
        : itens.length > 1 ? centro.get(itens[1]) - separacao(it, itens[1]) : centro.get(it);
      alvos.push(vs.length ? vs.reduce((s, v) => s + centro.get(v), 0) / vs.length : encostado);
      pesos.push(vs.length ? (ehAcao(it) ? 1 : 4) * vs.length : 0.05);
    });
    acomodar(itens, alvos, pesos);
  };
  for (let passada = 0; passada < 24; passada++) {
    for (let r = 0; r < nRaias; r++) {
      for (let c = 0; c < total; c++) relaxar(c, r);
      for (let c = total - 1; c >= 0; c--) relaxar(c, r);
    }
  }
  /* empilha as raias; cada uma com folga em cima e embaixo */
  const raias = [];
  const topoDaRaia = [];
  let yRaia = M.margem;
  for (let r = 0; r < nRaias; r++) {
    const itens = [...centro].filter(([it]) => raia(it) === r);
    if (!itens.length) continue;
    const topo = Math.min(...itens.map(([it, y]) => y - alturaDe(it) / 2));
    const base = Math.max(...itens.map(([it, y]) => y + alturaDe(it) / 2));
    const altura = base - topo + 2 * M.folgaRaia;
    topoDaRaia[r] = yRaia + M.folgaRaia - topo;
    const info = r < SEM ? pedidas[r] : { id: "", nome: "Sem etapa" };
    raias.push({ id: info.id, nome: info.nome, titulo: info.titulo ?? info.nome, y: yRaia, altura });
    yRaia += altura;
  }
  const yDe = (it) => topoDaRaia[raia(it)] + centro.get(it);

  /* ---------- 6. setas em ângulo reto ---------- */
  /* portas: as setas de um cartão se espalham pela lateral, na ordem de altura do outro lado */
  const saidas = new Map();
  const chegadas = new Map();
  for (const ar of arestas) {
    (saidas.get(ar.de) ?? saidas.set(ar.de, []).get(ar.de)).push(ar);
    (chegadas.get(ar.para) ?? chegadas.set(ar.para, []).get(ar.para)).push(ar);
  }
  const porta = (lista, ar, vizinho) => {
    const ordenadas = [...lista].sort((p, q) => yDe(vizinho(p)) - yDe(vizinho(q)));
    const i = ordenadas.indexOf(ar);
    const faixa = Math.min(M.altura * 0.6, (ordenadas.length - 1) * 12);
    return ordenadas.length > 1 ? -faixa / 2 + (faixa * i) / (ordenadas.length - 1) : 0;
  };
  /* altura da seta em cada item da cadeia e pedidos de trilho em cada vão */
  const pedidosNoVao = Array.from({ length: Math.max(0, total - 1) }, () => []);
  for (const ar of arestas) {
    const ys = ar.cadeia.map(yDe);
    ys[0] += porta(saidas.get(ar.de), ar, (a) => a.cadeia[1]);
    ys[ys.length - 1] += porta(chegadas.get(ar.para), ar, (a) => a.cadeia.at(-2));
    ar.ys = ys;
    ar.trilhos = [];
    for (let k = 0; k + 1 < ys.length; k++) {
      if (Math.abs(ys[k] - ys[k + 1]) < 0.5) { ys[k + 1] = ys[k]; continue; }
      pedidosNoVao[coluna.get(ar.de) + k].push({ ar, k, ya: ys[k], yb: ys[k + 1] });
    }
  }
  /* custo de pôr o trilho de e à esquerda do de f: cruzamentos que isso cria */
  const entre = (y, a, b) => y > Math.min(a, b) + 0.5 && y < Math.max(a, b) - 0.5;
  const custo = (e, f) => (entre(f.ya, e.ya, e.yb) ? 1 : 0) + (entre(e.yb, f.ya, f.yb) ? 1 : 0);
  const custoTotal = (ordem) => {
    let s = 0;
    for (let i = 0; i < ordem.length; i++) for (let j = i + 1; j < ordem.length; j++) s += custo(ordem[i], ordem[j]);
    return s;
  };
  const melhorarOrdem = (ordem) => {
    let melhorou = true;
    while (melhorou) {
      melhorou = false;
      for (let i = 0; i + 1 < ordem.length; i++) {
        if (custo(ordem[i + 1], ordem[i]) < custo(ordem[i], ordem[i + 1])) { [ordem[i], ordem[i + 1]] = [ordem[i + 1], ordem[i]]; melhorou = true; }
      }
    }
    return ordem;
  };
  const larguraDoVao = pedidosNoVao.map((pedidos) => {
    const descem = (p) => (p.yb > p.ya ? -p.ya : p.ya);
    const opcoes = [
      melhorarOrdem([...pedidos].sort((p, q) => descem(p) - descem(q))),
      melhorarOrdem([...pedidos].sort((p, q) => p.ya - q.ya)),
      melhorarOrdem([...pedidos].sort((p, q) => q.ya - p.ya)),
    ];
    const ordem = opcoes.reduce((a, b) => (custoTotal(b) < custoTotal(a) ? b : a));
    ordem.forEach((p, i) => { p.ar.trilhos[p.k] = { i, n: ordem.length }; });
    return Math.max(M.vaoX, (ordem.length + 1) * M.trilha + 24);
  });
  const xDaColuna = [];
  let x = M.margem + (comRaias ? M.cabecaRaia : 0);
  for (let c = 0; c < total; c++) { xDaColuna.push(x); x += M.largura + (larguraDoVao[c] ?? 0); }
  const largura = (total ? xDaColuna[total - 1] + M.largura : x) + M.margem;
  const xDoTrilho = (c, { i, n }) => xDaColuna[c] + M.largura + larguraDoVao[c] / 2 + (i - (n - 1) / 2) * M.trilha;

  const pos = new Map(acoes.map((a) => [a.numero, { x: xDaColuna[coluna.get(a.numero)], y: yDe(a.numero) - M.altura / 2 }]));
  for (const ar of arestas) {
    const c0 = coluna.get(ar.de);
    const pontos = [[xDaColuna[c0] + M.largura, ar.ys[0]]];
    for (let k = 0; k + 1 < ar.ys.length; k++) {
      const t = ar.trilhos[k];
      if (!t) continue;
      const xt = xDoTrilho(c0 + k, t);
      pontos.push([xt, ar.ys[k]], [xt, ar.ys[k + 1]]);
    }
    pontos.push([xDaColuna[coluna.get(ar.para)], ar.ys.at(-1)]);
    ar.pontos = pontos.map(([px, py]) => [Math.round(px * 10) / 10, Math.round(py * 10) / 10]);
  }
  for (const ar of arestas) { delete ar.cadeia; delete ar.ys; delete ar.trilhos; }

  /* ---------- saltos: a horizontal salta sobre a vertical que a cruza ---------- */
  const horizontais = [];
  const verticais = [];
  arestas.forEach((ar, i) => {
    ar.saltos = [];
    for (let k = 0; k + 1 < ar.pontos.length; k++) {
      const [[x0, y0], [x1, y1]] = [ar.pontos[k], ar.pontos[k + 1]];
      if (y0 === y1) horizontais.push({ i, y: y0, x0: Math.min(x0, x1), x1: Math.max(x0, x1) });
      else verticais.push({ i, x: x0, y0: Math.min(y0, y1), y1: Math.max(y0, y1) });
    }
  });
  for (const h of horizontais) {
    for (const v of verticais) {
      if (v.i === h.i) continue;
      if (v.x > h.x0 + M.salto && v.x < h.x1 - M.salto && h.y > v.y0 + 0.5 && h.y < v.y1 - 0.5) arestas[h.i].saltos.push([v.x, h.y]);
    }
  }
  for (const ar of arestas) ar.saltos.sort((p, q) => p[0] - q[0]);

  return {
    colunas: camadas.map((c) => c.filter(ehAcao)),
    coluna,
    pos,
    arestas,
    raias,
    largura,
    altura: (raias.length ? yRaia : 0) + M.margem,
  };
}

/**
 * Caminho SVG de uma seta em ângulo reto, com os saltos (semicírculos) sobre as setas que cruza.
 * @param {number[][]} pontos
 * @param {number[][]} [saltos]
 * @param {{recuo?: number, raio?: number}} [opcoes] recuo: quanto a ponta para antes do cartão
 */
export function caminhoDaSeta(pontos, saltos = [], { recuo = 2, raio = MEDIDAS.salto } = {}) {
  const p = pontos.map(([x, y]) => [x, y]);
  p[p.length - 1][0] -= recuo;
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let k = 1; k < p.length; k++) {
    const [x0, y0] = p[k - 1];
    const [x1, y1] = p[k];
    if (y0 === y1) {
      const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)];
      const aqui = saltos.filter(([sx, sy]) => sy === y0 && sx > a && sx < b).map(([sx]) => sx);
      if (x1 < x0) aqui.reverse();
      let ultimo = -Infinity;
      for (const sx of aqui) {
        if (Math.abs(sx - ultimo) < raio * 2.5) continue; // saltos colados viram um só
        ultimo = sx;
        const dir = x1 >= x0 ? 1 : -1;
        d += ` L${sx - dir * raio},${y0} A${raio},${raio} 0 0 ${dir > 0 ? 1 : 0} ${sx + dir * raio},${y0}`;
      }
    }
    d += ` L${x1},${y1}`;
  }
  return d;
}
