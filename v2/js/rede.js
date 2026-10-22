/**
 * Rede do espaço, "Fluxo das ações" (especificação, seção 8.4; passo 1.17c): regras, sem tela.
 *
 * Desenho em camadas, o mesmo método do Mermaid (Sugiyama; o Mermaid usa o dagre). Revisto em
 * 22/10/2026, a pedido do responsável, para não sobrepor setas e cartões:
 * 1. Colunas: cada ação fica na coluna seguinte à da sua anterior mais distante. Ação sem
 *    anteriores vai para junto da primeira seguinte (e não para a primeira coluna), para encurtar setas.
 * 2. Setas longas ganham pontos de passagem nas colunas do meio, cada um com o seu lugar na coluna:
 *    assim a seta passa entre os cartões, nunca por cima deles.
 * 3. Ordem dentro da coluna: média da posição dos vizinhos, em passadas para a frente e para trás,
 *    com trocas de vizinhos que diminuam cruzamentos; fica a ordem com menos cruzamentos.
 * 4. Altura: cada item vai para perto da altura média dos vizinhos, sem sair da ordem nem encostar
 *    nos outros (regressão isotônica). Cadeias e setas longas ficam retas.
 * Sem biblioteca externa.
 */

/** Medidas padrão do desenho, em pixels. */
export const MEDIDAS = Object.freeze({ largura: 250, altura: 100, vaoX: 84, vaoY: 22, vaoSeta: 14, margem: 18 });

/**
 * @param {object[]} acoes ações ativas, na ordem do espaço
 * @param {{porAcao: Map}} caminho resultado de caminhoCritico
 * @param {Partial<typeof MEDIDAS>} [medidas]
 * @returns {{colunas: number[][], coluna: Map<number, number>, pos: Map<number, {x: number, y: number}>,
 *   arestas: {de: number, para: number, critica: boolean, pontos: number[][]}[], largura: number, altura: number}}
 *   colunas: números das ações em cada coluna, de cima para baixo; pos: canto superior esquerdo de cada cartão;
 *   pontos: da saída da anterior à chegada na seguinte, passando pelos pontos de passagem
 */
export function montarRede(acoes, caminho, medidas = {}) {
  const M = { ...MEDIDAS, ...medidas };
  const numeros = new Set(acoes.map((a) => a.numero));
  const anteriores = new Map(acoes.map((a) => [a.numero, [...new Set((a.dependeDe ?? []).filter((d) => numeros.has(d) && d !== a.numero))]]));
  const seguintes = new Map(acoes.map((a) => [a.numero, []]));
  for (const [n, ds] of anteriores) for (const d of ds) seguintes.get(d).push(n);

  /* 1. colunas: 1 + coluna da anterior mais distante; com proteção contra ciclos */
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
  /* ação sem anteriores: logo antes da primeira seguinte */
  for (const a of acoes) {
    const segs = seguintes.get(a.numero).filter((s) => coluna.get(s) > coluna.get(a.numero));
    if (!anteriores.get(a.numero).length && segs.length) coluna.set(a.numero, Math.min(...segs.map((s) => coluna.get(s))) - 1);
  }
  const total = acoes.length ? Math.max(...coluna.values()) + 1 : 0;

  /* 2. arestas (só as que vão para a direita; num ciclo, a que volta é deixada de fora do desenho) e pontos de passagem */
  const arestas = [];
  for (const a of acoes) {
    for (const d of anteriores.get(a.numero)) {
      if (coluna.get(d) >= coluna.get(a.numero)) continue;
      const x = caminho.porAcao.get(d);
      const y = caminho.porAcao.get(a.numero);
      arestas.push({ de: d, para: a.numero, critica: Boolean(x?.critica && y?.critica && Math.abs(x.conclusao - y.liberacao) < 1e-6) });
    }
  }
  /* itens de cada coluna: ações (números) e pontos de passagem (textos "aresta:coluna") */
  const camadas = Array.from({ length: total }, () => []);
  const ordemDoEspaco = new Map(acoes.map((a, i) => [a.numero, i]));
  for (const a of acoes) camadas[coluna.get(a.numero)].push(a.numero);
  const ligacoes = []; // segmentos entre colunas vizinhas: [item da esquerda, item da direita]
  arestas.forEach((ar, i) => {
    ar.cadeia = [ar.de];
    for (let c = coluna.get(ar.de) + 1; c < coluna.get(ar.para); c++) {
      const p = `${i}:${c}`;
      camadas[c].push(p);
      ar.cadeia.push(p);
    }
    ar.cadeia.push(ar.para);
    for (let k = 0; k + 1 < ar.cadeia.length; k++) ligacoes.push([ar.cadeia[k], ar.cadeia[k + 1]]);
  });
  const esquerda = new Map(); // item -> itens ligados na coluna anterior
  const direita = new Map();
  for (const c of camadas) for (const it of c) { esquerda.set(it, []); direita.set(it, []); }
  for (const [e, d] of ligacoes) { direita.get(e).push(d); esquerda.get(d).push(e); }
  const ehAcao = (it) => typeof it === "number";

  /* 3. ordem dentro das colunas */
  const ordenarInicial = (c) => camadas[c].sort((p, q) => chave(p) - chave(q));
  const chave = (it) => (ehAcao(it) ? ordemDoEspaco.get(it) : ordemDoEspaco.get(arestas[Number(it.split(":")[0])].de) + 0.5);
  camadas.forEach((_, c) => ordenarInicial(c));
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
      .sort((p, q) => p[1] - q[1])
      .map(([it]) => it);
  };
  /* troca vizinhos de lugar enquanto isso diminuir os cruzamentos das duas faixas em volta */
  const trocar = (c) => {
    let melhorou = true;
    while (melhorou) {
      melhorou = false;
      for (let i = 0; i + 1 < camadas[c].length; i++) {
        const antes = cruzamentosEntre(c - 1) + cruzamentosEntre(c);
        [camadas[c][i], camadas[c][i + 1]] = [camadas[c][i + 1], camadas[c][i]];
        if (cruzamentosEntre(c - 1) + cruzamentosEntre(c) < antes) melhorou = true;
        else [camadas[c][i], camadas[c][i + 1]] = [camadas[c][i + 1], camadas[c][i]];
      }
    }
  };
  let melhor = camadas.map((c) => [...c]);
  let menor = totalDeCruzamentos(camadas);
  for (let passada = 0; passada < 8 && menor > 0; passada++) {
    for (let c = 1; c < total; c++) { baricentro(c, esquerda); trocar(c); }
    for (let c = total - 2; c >= 0; c--) { baricentro(c, direita); trocar(c); }
    const n = totalDeCruzamentos(camadas);
    if (n < menor) { menor = n; melhor = camadas.map((c) => [...c]); }
  }
  melhor.forEach((c, i) => { camadas[i] = c; });

  /* 4. altura de cada item (centro), na ordem e sem encostar */
  const altura = (it) => (ehAcao(it) ? M.altura : 0);
  const separacao = (p, q) => (altura(p) + altura(q)) / 2 + (ehAcao(p) && ehAcao(q) ? M.vaoY : M.vaoSeta);
  const centro = new Map();
  for (const c of camadas) {
    let y = 0;
    c.forEach((it, i) => { if (i) y += separacao(c[i - 1], it); centro.set(it, y); });
  }
  /* regressão isotônica com espaçamento mínimo: o mais perto possível dos alvos, mantendo a ordem */
  const acomodar = (c, alvos, pesos) => {
    const itens = camadas[c];
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
  const relaxar = (c) => {
    const itens = camadas[c];
    const alvos = [];
    const pesos = [];
    for (const it of itens) {
      const vs = [...esquerda.get(it), ...direita.get(it)];
      alvos.push(vs.length ? vs.reduce((s, v) => s + centro.get(v), 0) / vs.length : centro.get(it));
      pesos.push(vs.length ? (ehAcao(it) ? 1 : 4) * vs.length : 0.01); // pontos de passagem puxam mais: setas longas retas
    }
    acomodar(c, alvos, pesos);
  };
  for (let passada = 0; passada < 24; passada++) {
    for (let c = 0; c < total; c++) relaxar(c);
    for (let c = total - 1; c >= 0; c--) relaxar(c);
  }
  /* sobe tudo para começar na margem */
  const topo = centro.size ? Math.min(...[...centro].map(([it, y]) => y - altura(it) / 2)) : 0;
  const base = centro.size ? Math.max(...[...centro].map(([it, y]) => y + altura(it) / 2)) : 0;

  const xDe = (c) => M.margem + c * (M.largura + M.vaoX);
  const yDe = (it) => M.margem + centro.get(it) - topo;
  const pos = new Map(acoes.map((a) => [a.numero, { x: xDe(coluna.get(a.numero)), y: yDe(a.numero) - M.altura / 2 }]));

  /* portas: as setas que saem (ou chegam) de um cartão se espalham pela lateral, na ordem de altura */
  const saidas = new Map();
  const chegadas = new Map();
  arestas.forEach((ar) => {
    (saidas.get(ar.de) ?? saidas.set(ar.de, []).get(ar.de)).push(ar);
    (chegadas.get(ar.para) ?? chegadas.set(ar.para, []).get(ar.para)).push(ar);
  });
  const porta = (lista, ar, vizinho) => {
    const ordenadas = [...lista].sort((p, q) => yDe(vizinho(p)) - yDe(vizinho(q)));
    const i = ordenadas.indexOf(ar);
    const faixa = Math.min(M.altura * 0.5, (ordenadas.length - 1) * 10);
    return ordenadas.length > 1 ? -faixa / 2 + (faixa * i) / (ordenadas.length - 1) : 0;
  };
  for (const ar of arestas) {
    const pontos = [[xDe(coluna.get(ar.de)) + M.largura, yDe(ar.de) + porta(saidas.get(ar.de), ar, (a) => a.cadeia[1])]];
    for (const it of ar.cadeia.slice(1, -1)) {
      const c = Number(it.split(":")[1]);
      pontos.push([xDe(c), yDe(it)], [xDe(c) + M.largura, yDe(it)]);
    }
    pontos.push([xDe(coluna.get(ar.para)), yDe(ar.para) + porta(chegadas.get(ar.para), ar, (a) => a.cadeia.at(-2))]);
    ar.pontos = pontos;
  }
  for (const ar of arestas) delete ar.cadeia;

  return {
    colunas: camadas.map((c) => c.filter(ehAcao)),
    coluna,
    pos,
    arestas,
    largura: xDe(Math.max(0, total - 1)) + M.largura + M.margem,
    altura: M.margem * 2 + (base - topo),
  };
}

/**
 * Caminho SVG de uma seta: curvas suaves entre colunas e retas dentro delas.
 * @param {number[][]} pontos
 * @param {number} [recuo] quanto a ponta para antes do cartão
 */
export function caminhoDaSeta(pontos, recuo = 2) {
  const p = pontos.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  p[p.length - 1][0] -= recuo;
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    if (i % 2 === 1) { const m = (x1 - x0) / 2; d += ` C${x0 + m},${y0} ${x1 - m},${y1} ${x1},${y1}`; } // entre colunas
    else d += ` L${x1},${y1}`; // dentro de uma coluna, por um ponto de passagem
  }
  return d;
}
