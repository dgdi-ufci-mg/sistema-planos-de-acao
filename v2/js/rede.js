/**
 * Rede do espaço, "Fluxo das ações" (especificação, seção 8.4; passo 1.17c): regras, sem tela.
 * Arruma as ações em colunas (camadas): cada ação fica na coluna seguinte à da sua anterior
 * mais distante; dentro da coluna, a ordem é ajustada para cruzar menos setas (média da posição
 * das ações ligadas, em algumas passadas). Sem biblioteca externa.
 */

/**
 * @param {object[]} acoes ações ativas, na ordem do espaço
 * @param {{porAcao: Map}} caminho resultado de caminhoCritico
 * @returns {{colunas: number[][], arestas: {de: number, para: number, critica: boolean}[], coluna: Map<number, number>}}
 *   colunas: números das ações em cada coluna, na ordem de cima para baixo
 */
export function montarRede(acoes, caminho) {
  const numeros = new Set(acoes.map((a) => a.numero));
  const anteriores = new Map(acoes.map((a) => [a.numero, (a.dependeDe ?? []).filter((d) => numeros.has(d))]));
  const seguintes = new Map(acoes.map((a) => [a.numero, []]));
  for (const [n, ds] of anteriores) for (const d of ds) seguintes.get(d).push(n);

  /* coluna = 1 + coluna da anterior mais distante; com proteção contra ciclos */
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

  const total = Math.max(0, ...coluna.values()) + 1;
  const colunas = Array.from({ length: acoes.length ? total : 0 }, () => []);
  for (const a of acoes) colunas[coluna.get(a.numero)].push(a.numero);

  /* menos cruzamentos: ordena cada coluna pela posição média das ações ligadas na coluna vizinha */
  const posicao = () => new Map(colunas.flatMap((c) => c.map((n, i) => [n, i])));
  const media = (vizinhos, pos, padrao) => (vizinhos.length ? vizinhos.reduce((s, v) => s + pos.get(v), 0) / vizinhos.length : padrao);
  for (let passada = 0; passada < 4; passada++) {
    for (let c = 1; c < colunas.length; c++) {
      const pos = posicao();
      colunas[c] = colunas[c].map((n, i) => [n, media(anteriores.get(n), pos, i)]).sort((a, b) => a[1] - b[1]).map(([n]) => n);
    }
    for (let c = colunas.length - 2; c >= 0; c--) {
      const pos = posicao();
      colunas[c] = colunas[c].map((n, i) => [n, media(seguintes.get(n), pos, i)]).sort((a, b) => a[1] - b[1]).map(([n]) => n);
    }
  }

  /* seta crítica: liga duas ações sem folga, e a seguinte começa assim que a anterior termina */
  const arestas = [];
  for (const [n, ds] of anteriores) {
    for (const d of ds) {
      const a = caminho.porAcao.get(d);
      const b = caminho.porAcao.get(n);
      arestas.push({ de: d, para: n, critica: Boolean(a?.critica && b?.critica && Math.abs(a.conclusao - b.liberacao) < 1e-6) });
    }
  }
  return { colunas, arestas, coluna };
}
