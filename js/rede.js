/**
 * Rede do espaço, "Fluxo das ações" (documentação técnica, seção 8.4; passo 1.17c): regras, sem tela.
 *
 * Desenho em camadas, o mesmo método do Mermaid (Sugiyama), com setas em ângulo reto, como no Bizagi.
 * Revisto em 27/10/2026, a pedido do responsável (cercas por etapa e marcos por fase):
 * 1. Colunas pelas dependências: cada ação fica na coluna seguinte à da sua anterior mais distante; as
 *    ações sem anteriores ficam todas na primeira coluna, lado a lado (as que podem começar juntas
 *    ficam alinhadas). A etapa não muda a coluna.
 * 2. Cercas: as ações de cada etapa ficam juntas, numa faixa horizontal própria, e a tela desenha uma
 *    cerca (caixa) em volta só dos seus cartões. Etapas que não ocupam as mesmas colunas dividem a
 *    mesma faixa (uma depois da outra); as que correm em paralelo ficam em faixas empilhadas.
 * 3. Marcos por fase: uma linha vertical no vão logo depois da última coluna com ações da fase.
 * 4. Início e término (opção `pontas`): dois nós a mais, antes da primeira coluna e depois da última,
 *    ligados às ações sem anteriores e às sem seguintes pelas mesmas regras das setas.
 * 5. Setas longas ganham pontos de passagem nas colunas do meio (a seta passa entre os cartões, nunca
 *    por cima deles): na faixa da ação de onde saem; se ali houver outra etapa, na da ação de chegada;
 *    se também houver, num corredor abaixo de tudo.
 * 6. Ordem dentro da coluna: média da posição dos vizinhos, com trocas que diminuam cruzamentos.
 * 7. Altura: cada item vai para perto da altura média dos vizinhos da mesma faixa, sem sair da ordem
 *    (regressão isotônica). Cadeias e setas longas ficam retas.
 * 8. Setas em ângulo reto: descidas e subidas nos vãos entre colunas, cada uma no seu trilho. Onde duas
 *    setas se cruzam, a horizontal dá um pequeno salto sobre a vertical, como no Visio.
 * 9. Nenhuma linha sobre outra: trechos que coincidiriam são afastados alguns pixels.
 * 10. Ações contínuas (opção `continuas`; seção 5.9, 09/11/2026): caixa como as outras, na coluna do marco de
 *    início, sem setas de dependência. Duas ligações tracejadas, desenhadas depois de tudo: "começa junto" sai da
 *    lateral esquerda da caixa até o marco de início, e "termina junto" sai da lateral direita até o marco de fim
 *    (a lateral direita da ação, a cerca da etapa, as cercas da fase ou o círculo do projeto). Quando o marco de
 *    fim está noutra coluna, a ligação desce até um corredor abaixo de tudo, para não passar sobre os cartões.
 * 11. Fases em faixas (11/11/2026, pedido do responsável: como os milestones do Bizagi): cada fase ocupa um
 *    trecho próprio de colunas, na ordem das fases; nenhuma ação é desenhada no trecho de outra fase. A ação
 *    que depende de outra de fase posterior acompanha a fase dessa outra (fase efetiva). Só o desenho muda.
 * 12. Compactação (11/11/2026): cada etapa (com a sua cerca) sobe até encostar no que estiver acima dela nas
 *    mesmas colunas, em vez de ocupar uma faixa da largura do plano inteiro.
 * 13. Posições mantidas (opção `fixos`, 11/11/2026): com a coluna e a altura de cada ação dadas por quem chama
 *    (`abrirEspaco`), os itens 1, 4, 6, 7, 11 e 12 não se aplicam: as ações ficam onde estavam e só as setas
 *    são retraçadas, desviando dos cartões e das cercas das outras etapas.
 * Sem biblioteca externa.
 */
import { ehContinua } from "./calculo.js";

/** Medidas padrão do desenho, em pixels. */
export const MEDIDAS = Object.freeze({
  largura: 240, altura: 100, vaoX: 64, vaoY: 20, vaoSeta: 14, margem: 16,
  trilha: 10, folgaRaia: 18, salto: 4,
  /* cercas e marcos (27/10/2026) */
  cerca: 12, rotuloCerca: 24, folgaCercaTopo: 46, folgaCercaBase: 24, cabecaFase: 4, vaoFase: 48,
  raioPonta: 40,
});

/** Números dos nós de início e de término (as ações têm números positivos). */
export const INICIO = -1;
export const TERMINO = -2;

/**
 * @param {object[]} acoes ações ativas, na ordem do espaço
 * @param {{porAcao: Map}} caminho resultado de caminhoCritico
 * @param {{marcos?: {id: string, nome: string, titulo?: string, fase?: string, faseNome?: string}[],
 *   marcoDe?: (acao: object) => string|null, pontas?: boolean, continuas?: boolean, medidas?: Partial<typeof MEDIDAS>}} [opcoes]
 *   marcos: as etapas, na ordem; sem marcos, sem cercas. pontas: inclui os nós de início e de término.
 *   continuas: trata as ações com `comecaCom` e `terminaCom` como contínuas (item 10)
 * @returns {{colunas: number[][], coluna: Map<number, number>, pos: Map<number, {x: number, y: number}>,
 *   arestas: {de: number, para: number, critica: boolean, ligacao?: boolean, volta?: boolean, pontos: number[][], saltos: number[][]}[],
 *   cercas: {id: string, nome: string, titulo: string, fase: string|null, faseNome: string|null, x: number, y: number, largura: number, altura: number}[],
 *   fases: {id: string, nome: string, x: number}[], pontas: {inicio: {x: number, y: number}, termino: {x: number, y: number}}|null,
 *   ligacoesContinuas: {continua: number, lado: "inicio"|"fim", acao: number|null, pontos: number[][]}[],
 *   topo: number, largura: number, altura: number}}
 *   pos: canto superior esquerdo de cada cartão; pontas: centro dos círculos; pontos: linha em ângulo reto,
 *   da saída à chegada; saltos: pontos onde a seta salta sobre outra; topo: onde começam as linhas das fases
 */
export function montarRede(acoes, caminho, opcoes = {}) {
  const M = { ...MEDIDAS, ...(opcoes.medidas ?? {}) };
  const R = M.raioPonta;
  const numeros = new Set(acoes.map((a) => a.numero));
  /* ações contínuas (item 10): sem anteriores, e nenhuma ação comum depende delas */
  const continuas = new Set(opcoes.continuas ? acoes.filter(ehContinua).map((a) => a.numero) : []);
  const anteriores = new Map(acoes.map((a) => [a.numero, continuas.has(a.numero) ? []
    : [...new Set((a.dependeDe ?? []).filter((d) => numeros.has(d) && d !== a.numero && !continuas.has(d)))]]));
  const seguintes = new Map(acoes.map((a) => [a.numero, []]));
  for (const [n, ds] of anteriores) for (const d of ds) seguintes.get(d).push(n);
  const comPontas = Boolean(opcoes.pontas) && acoes.length > 0;

  /* ---------- etapas (as cercas) e fases ---------- */
  const comMarcos = Array.isArray(opcoes.marcos);
  const pedidos = comMarcos ? opcoes.marcos : [];
  const indiceDoMarco = new Map(pedidos.map((m, i) => [m.id, i]));
  const SEM_MARCO = pedidos.length;
  const etapa = new Map(acoes.map((a) => {
    const id = comMarcos ? opcoes.marcoDe?.(a) : null;
    return [a.numero, comMarcos && indiceDoMarco.has(id) ? indiceDoMarco.get(id) : comMarcos ? SEM_MARCO : 0];
  }));
  const temFases = comMarcos && pedidos.some((m) => m.fase);
  const faseEfetiva = temFases ? fasesEfetivas(acoes, anteriores, pedidos, opcoes.marcoDe) : new Map();
  const ordemDasFases = [...new Set(pedidos.map((m) => m.fase).filter((f) => f != null))];

  /* ---------- 1. colunas pelas dependências, fase por fase (item 11) ---------- */
  const desloc = comPontas ? 1 : 0;
  const coluna = new Map();
  const fixos = opcoes.fixos && acoes.every((a) => opcoes.fixos.has(a.numero)) ? opcoes.fixos : null;
  const porNumero = new Map(acoes.map((a) => [a.numero, a]));
  const etapaDaAcao = (a) => (opcoes.marcoDe ? opcoes.marcoDe(a) : a.etapa);
  /** Ações comuns que formam o marco; null no projeto; lista vazia se o marco não existe mais (vale o projeto). */
  const membrosDoMarco = (m) => {
    if (!m || m.tipo === "projeto") return null;
    if (m.tipo === "acao") return porNumero.has(m.numero) && !continuas.has(m.numero) ? [porNumero.get(m.numero)] : [];
    const etapas = m.tipo === "etapa" ? new Set([m.id]) : new Set((opcoes.marcos ?? []).filter((x) => x.fase === m.id).map((x) => x.id));
    return acoes.filter((a) => !continuas.has(a.numero) && etapas.has(etapaDaAcao(a)));
  };
  if (fixos) {
    for (const a of acoes) coluna.set(a.numero, fixos.get(a.numero).coluna);
  } else {
    const base = new Map([[-1, desloc]]);
    const visitando = new Set();
    const colunaDe = (n) => {
      if (coluna.has(n)) return coluna.get(n);
      if (visitando.has(n)) return desloc; // dependência circular: a seta vira uma que volta
      visitando.add(n);
      const c = Math.max(base.get(faseEfetiva.get(n) ?? -1) ?? desloc, ...anteriores.get(n).map((d) => colunaDe(d) + 1));
      visitando.delete(n);
      coluna.set(n, c);
      return c;
    };
    /* cada fase começa na coluna seguinte à última das fases anteriores; as ações sem fase não empurram ninguém */
    let ultima = desloc - 1;
    for (let f = 0; f < ordemDasFases.length; f++) {
      base.set(f, ultima + 1);
      for (const a of acoes) {
        if (faseEfetiva.get(a.numero) !== f) continue;
        const c = colunaDe(a.numero);
        if (!continuas.has(a.numero)) ultima = Math.max(ultima, c);
      }
    }
    for (const a of acoes) colunaDe(a.numero);
    /* a contínua fica na coluna do marco de início: a da ação, a primeira das ações comuns da etapa ou da fase, ou a primeira */
    for (const n of continuas) {
      const ms = membrosDoMarco(porNumero.get(n).comecaCom);
      coluna.set(n, ms?.length ? Math.min(...ms.map((a) => coluna.get(a.numero))) : desloc);
    }
  }
  let total = acoes.length ? Math.max(...coluna.values()) + 1 : 0;
  if (comPontas) { coluna.set(INICIO, 0); coluna.set(TERMINO, total); total += 1; }

  /* ---------- 3. setas ---------- */
  const arestas = [];
  const voltam = []; // dependência circular: passa por baixo de tudo
  for (const a of acoes) {
    for (const d of anteriores.get(a.numero)) {
      const x = caminho.porAcao.get(d);
      const y = caminho.porAcao.get(a.numero);
      const seta = { de: d, para: a.numero, critica: Boolean(x?.critica && y?.critica && Math.abs(x.conclusao - y.liberacao) < 1e-6) };
      (coluna.get(d) >= coluna.get(a.numero) ? voltam : arestas).push(seta);
    }
  }
  if (comPontas) {
    const temAntes = new Set(arestas.map((a) => a.para));
    const temDepois = new Set(arestas.map((a) => a.de));
    for (const a of acoes) if (!temAntes.has(a.numero) && !continuas.has(a.numero)) arestas.push({ de: INICIO, para: a.numero, critica: false, ligacao: true });
    for (const a of acoes) if (!temDepois.has(a.numero) && !continuas.has(a.numero)) arestas.push({ de: a.numero, para: TERMINO, critica: false, ligacao: true });
  }
  const ehPonta = (n) => n === INICIO || n === TERMINO;

  const etapasUsadas = [...new Set(acoes.map((a) => etapa.get(a.numero)))].sort((p, q) => p - q);
  const disporPorFaixas = () => {
  /* ---------- 4. faixas: cada etapa ocupa um trecho de colunas; etapas sem colunas em comum dividem a faixa ---------- */
  const trecho = new Map(etapasUsadas.map((e) => [e, [Infinity, -Infinity]]));
  const alargar = (e, a, b) => { const t = trecho.get(e); t[0] = Math.min(t[0], a); t[1] = Math.max(t[1], b); };
  for (const a of acoes) alargar(etapa.get(a.numero), coluna.get(a.numero), coluna.get(a.numero));
  for (const ar of arestas) {
    if (!ar.ligacao && etapa.get(ar.de) === etapa.get(ar.para)) alargar(etapa.get(ar.de), coluna.get(ar.de), coluna.get(ar.para) - 1);
  }
  const faixaDaEtapa = new Map();
  const ocupacao = []; // por faixa: [{e, a, b}]
  for (const e of [...etapasUsadas].sort((p, q) => trecho.get(p)[0] - trecho.get(q)[0] || p - q)) {
    const [a, b] = trecho.get(e);
    let f = ocupacao.findIndex((lista) => lista.every((o) => o.b < a || o.a > b));
    if (f < 0) { f = ocupacao.length; ocupacao.push([]); }
    ocupacao[f].push({ e, a, b });
    faixaDaEtapa.set(e, f);
  }
  /* as faixas seguem a ordem das etapas: a faixa da primeira etapa fica em cima */
  const ordemDasFaixas = ocupacao.map((lista, f) => [f, Math.min(...lista.map((o) => o.e))]).sort((p, q) => p[1] - q[1]).map(([f]) => f);
  const novaFaixa = new Map(ordemDasFaixas.map((f, i) => [f, i]));
  for (const [e, f] of faixaDaEtapa) faixaDaEtapa.set(e, novaFaixa.get(f));
  const ocupadas = ordemDasFaixas.map((f) => ocupacao[f]);
  const nFaixas = ocupadas.length;
  const CORREDOR = nFaixas;
  /* a faixa f está livre nas colunas a..b, fora a etapa e? */
  const livre = (f, a, b, e) => ocupadas[f].every((o) => o.e === e || o.b < a || o.a > b);

  /* ---------- 5. pontos de passagem ---------- */
  const raiaDoItem = new Map();
  for (const a of acoes) raiaDoItem.set(a.numero, faixaDaEtapa.get(etapa.get(a.numero)));
  if (comPontas) { raiaDoItem.set(INICIO, -1); raiaDoItem.set(TERMINO, -1); }
  const ordemDoEspaco = new Map(acoes.map((a, i) => [a.numero, i]));
  if (comPontas) { ordemDoEspaco.set(INICIO, -1); ordemDoEspaco.set(TERMINO, acoes.length); }
  for (const n of coluna.keys()) camadas[coluna.get(n)].push(n);
  const esquerda = new Map([...coluna.keys()].map((n) => [n, []]));
  const direita = new Map([...coluna.keys()].map((n) => [n, []]));
  arestas.forEach((ar, i) => {
    ar.cadeia = [ar.de];
    const c0 = coluna.get(ar.de);
    const c1 = coluna.get(ar.para);
    let raiaDosPontos = CORREDOR;
    if (c1 - c0 > 1) {
      const candidatas = [];
      if (!ehPonta(ar.de)) candidatas.push([raiaDoItem.get(ar.de), etapa.get(ar.de)]);
      if (!ehPonta(ar.para)) candidatas.push([raiaDoItem.get(ar.para), etapa.get(ar.para)]);
      const achada = candidatas.find(([f, e]) => (!ar.ligacao && etapa.get(ar.de) === etapa.get(ar.para)) || livre(f, c0 + 1, c1 - 1, e));
      if (achada) raiaDosPontos = achada[0];
    }
    for (let c = c0 + 1; c < c1; c++) {
      const p = `${i}:${c}`;
      camadas[c].push(p);
      ar.cadeia.push(p);
      raiaDoItem.set(p, raiaDosPontos);
      esquerda.set(p, []);
      direita.set(p, []);
    }
    ar.cadeia.push(ar.para);
    for (let k = 0; k + 1 < ar.cadeia.length; k++) { direita.get(ar.cadeia[k]).push(ar.cadeia[k + 1]); esquerda.get(ar.cadeia[k + 1]).push(ar.cadeia[k]); }
  });
  const raia = (it) => raiaDoItem.get(it);

  /* ---------- 6. ordem dentro das colunas (faixa primeiro) ---------- */
  const chave = (it) => (ehNo(it) ? ordemDoEspaco.get(it) : ordemDoEspaco.get(arestas[Number(it.split(":")[0])].de) + 0.5);
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

  /* ---------- 7. altura de cada item, faixa por faixa ---------- */
  const separacao = (p, q) => (alturaDe(p) + alturaDe(q)) / 2 + (ehNo(p) && ehNo(q) ? M.vaoY : M.vaoSeta);
  const nRaias = nFaixas + 1;
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
    const desl = [0];
    for (let i = 1; i < itens.length; i++) desl.push(desl[i - 1] + separacao(itens[i - 1], itens[i]));
    const blocos = [];
    itens.forEach((_, i) => {
      blocos.push({ soma: (alvos[i] - desl[i]) * pesos[i], peso: pesos[i], n: 1 });
      while (blocos.length > 1 && blocos.at(-2).soma / blocos.at(-2).peso > blocos.at(-1).soma / blocos.at(-1).peso) {
        const b = blocos.pop();
        const a = blocos.at(-1);
        a.soma += b.soma; a.peso += b.peso; a.n += b.n;
      }
    });
    let i = 0;
    for (const b of blocos) for (let k = 0; k < b.n; k++, i++) centro.set(itens[i], b.soma / b.peso + desl[i]);
  };
  const relaxar = (c, r) => {
    const itens = daRaia(c, r);
    if (!itens.length) return;
    const alvos = [];
    const pesos = [];
    itens.forEach((it, i) => {
      const vs = [...esquerda.get(it), ...direita.get(it)].filter((v) => raia(v) === r);
      const encostado = i > 0 ? centro.get(itens[i - 1]) + separacao(itens[i - 1], it)
        : itens.length > 1 ? centro.get(itens[1]) - separacao(it, itens[1]) : centro.get(it);
      alvos.push(vs.length ? vs.reduce((s, v) => s + centro.get(v), 0) / vs.length : encostado);
      pesos.push(vs.length ? (ehNo(it) ? 1 : 4) * vs.length : 0.05);
    });
    acomodar(itens, alvos, pesos);
  };
  for (let passada = 0; passada < 24; passada++) {
    for (let r = 0; r < nRaias; r++) {
      for (let c = 0; c < total; c++) relaxar(c, r);
      for (let c = total - 1; c >= 0; c--) relaxar(c, r);
    }
  }
  /* setas longas retas: os pontos de passagem de uma seta vão para uma altura só, quando cabem */
  for (let volta = 0; volta < 2; volta++) {
    for (const ar of arestas) {
      const pontos = ar.cadeia.slice(1, -1);
      if (!pontos.length) continue;
      let min = -Infinity;
      let max = Infinity;
      for (const p of pontos) {
        const col = camadas[Number(p.split(":")[1])].filter((it) => raia(it) === raia(p));
        const i = col.indexOf(p);
        if (i > 0) min = Math.max(min, centro.get(col[i - 1]) + separacao(col[i - 1], p));
        if (i + 1 < col.length) max = Math.min(max, centro.get(col[i + 1]) - separacao(p, col[i + 1]));
      }
      if (min > max) continue;
      const mesma = (n) => raia(n) === raia(pontos[0]);
      const preferidas = [mesma(ar.de) ? centro.get(ar.de) : null, mesma(ar.para) ? centro.get(ar.para) : null, centro.get(pontos[0])].filter((v) => v != null);
      const y = preferidas.find((v) => v >= min && v <= max) ?? Math.min(max, Math.max(min, preferidas[0]));
      for (const p of pontos) centro.set(p, y);
    }
  }
  /* ---------- 12. compactação: cada bloco sobe até encostar no que há acima dele, nas suas colunas ----------
     bloco: uma etapa (os cartões e os pontos de passagem dentro do seu trecho de colunas, com a folga da cerca)
     ou um trecho de seta que passa por colunas livres */
  const blocos = new Map();
  const noBloco = (id, r, ehEtapa) => blocos.get(id) ?? blocos.set(id, { id, r, etapa: ehEtapa, itens: [], cols: new Set() }).get(id);
  for (const a of acoes) noBloco(`e${etapa.get(a.numero)}`, raia(a.numero), true).itens.push(a.numero);
  for (const e of etapasUsadas) { const [a, b] = trecho.get(e); for (let c = a; c <= b; c++) blocos.get(`e${e}`).cols.add(c); }
  arestas.forEach((ar, i) => {
    let corrida = 0;
    let solto = false;
    for (const p of ar.cadeia.slice(1, -1)) {
      const c = Number(p.split(":")[1]);
      const r = raia(p);
      const dona = r === CORREDOR ? null : ocupadas[r].find((o) => o.a <= c && o.b >= c);
      if (dona) { blocos.get(`e${dona.e}`).itens.push(p); solto = false; continue; }
      if (!solto) corrida += 1;
      solto = true;
      const b = noBloco(`s${i}:${corrida}`, r, false);
      b.itens.push(p);
      b.cols.add(c);
      /* o trecho solto acompanha a etapa da ação de onde a seta sai (ou a de chegada), se ela estiver na mesma faixa */
      b.guias = [ar.de, ar.para].filter((n) => !ehPonta(n) && raia(n) === r).map((n) => `e${etapa.get(n)}`);
    }
  });
  const [folgaTopo, folgaBase] = comMarcos ? [M.folgaCercaTopo, M.folgaCercaBase] : [M.folgaRaia, M.folgaRaia];
  const horizonte = Array.from({ length: total }, () => topoDoDesenho);
  const desvio = new Map();
  const blocoDe = new Map();
  for (const b of blocos.values()) {
    b.topo = Math.min(...b.itens.map((it) => centro.get(it) - alturaDe(it) / 2)) - (b.etapa ? folgaTopo : 10);
    b.base = Math.max(...b.itens.map((it) => centro.get(it) + alturaDe(it) / 2)) + (b.etapa ? folgaBase : 16);
    b.ordem = Math.min(...b.itens.map((it) => centro.get(it)));
  }
  /* em cada faixa, primeiro as etapas; depois os trechos soltos, que ficam na altura da sua etapa-guia quando cabem
     (a seta sai reta, em vez de subir até o alto da coluna livre) */
  for (const b of [...blocos.values()].sort((p, q) => p.r - q.r || Number(q.etapa) - Number(p.etapa) || p.ordem - q.ordem)) {
    const guia = b.etapa ? null : (b.guias ?? []).find((g) => desvio.has(g));
    const y0 = Math.max(...[...b.cols].map((c) => horizonte[c]), guia ? b.topo + desvio.get(guia) : -Infinity);
    desvio.set(b.id, y0 - b.topo);
    for (const c of b.cols) horizonte[c] = y0 + b.base - b.topo;
    for (const it of b.itens) blocoDe.set(it, b.id);
  }
  yRaia = Math.max(topoDoDesenho, ...horizonte);
  yDe = (it) => (yFixo.has(it) ? yFixo.get(it) : desvio.get(blocoDe.get(it)) + centro.get(it));
  };

  /* ---------- 13. posições mantidas: as ações ficam onde estavam; só as setas são retraçadas ---------- */
  const disporFixos = () => {
    for (const a of acoes) { yFixo.set(a.numero, fixos.get(a.numero).y); camadas[coluna.get(a.numero)].push(a.numero); }
    /* cercas, em colunas e alturas: as setas das outras etapas desviam delas */
    const caixaDaEtapa = new Map();
    if (comMarcos) {
      for (const a of acoes) {
        const e = etapa.get(a.numero);
        const c = coluna.get(a.numero);
        const y = yFixo.get(a.numero);
        const b = caixaDaEtapa.get(e) ?? caixaDaEtapa.set(e, { a: c, b: c, y0: Infinity, y1: -Infinity }).get(e);
        b.a = Math.min(b.a, c); b.b = Math.max(b.b, c);
        b.y0 = Math.min(b.y0, y - M.altura / 2 - M.cerca - M.rotuloCerca);
        b.y1 = Math.max(b.y1, y + M.altura / 2 + M.cerca);
      }
    }
    if (comPontas) {
      camadas[0].push(INICIO); camadas[total - 1].push(TERMINO);
      for (const p of [INICIO, TERMINO]) {
        const vs = arestas.filter((ar) => (p === INICIO ? ar.de : ar.para) === p).map((ar) => yFixo.get(p === INICIO ? ar.para : ar.de));
        yFixo.set(p, Math.max(topoDoDesenho + R, vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : topoDoDesenho + R));
      }
    }
    const postos = Array.from({ length: total }, () => []);
    /* trechos de altura proibidos para uma seta na coluna c: cartões, cercas das outras etapas e setas já postas */
    const proibidos = (c, ar) => {
      const dela = new Set([ar.de, ar.para].filter((n) => !ehPonta(n)).map((n) => etapa.get(n)));
      const lista = camadas[c].filter(ehNo).map((n) => [yFixo.get(n) - alturaDe(n) / 2 - M.vaoSeta, yFixo.get(n) + alturaDe(n) / 2 + M.vaoSeta]);
      for (const [e, b] of caixaDaEtapa) if (!dela.has(e) && b.a <= c && b.b >= c) lista.push([b.y0 - 8, b.y1 + 8]);
      for (const y of postos[c]) lista.push([y - M.trilha, y + M.trilha]);
      lista.sort((p, q) => p[0] - q[0]);
      const juntos = [];
      for (const [a, b] of lista) {
        if (juntos.length && a <= juntos.at(-1)[1]) juntos.at(-1)[1] = Math.max(juntos.at(-1)[1], b);
        else juntos.push([a, b]);
      }
      return juntos;
    };
    const piso = topoDoDesenho + 6;
    const maisPerto = (c, ar, alvo) => {
      const y = Math.max(piso, alvo);
      for (const [a, b] of proibidos(c, ar)) {
        if (y <= a || y >= b) continue;
        return a >= piso && y - a <= b - y ? a : b;
      }
      return y;
    };
    let fundoFixo = Math.max(topoDoDesenho, ...acoes.map((a) => yFixo.get(a.numero) + M.altura / 2 + (comMarcos ? M.folgaCercaBase : M.folgaRaia)));
    arestas.forEach((ar, i) => {
      ar.cadeia = [ar.de];
      const cols = [];
      for (let c = coluna.get(ar.de) + 1; c < coluna.get(ar.para); c++) cols.push(c);
      /* reta, na altura da saída ou da chegada, quando o caminho está livre; senão, o mais perto possível, coluna a coluna */
      const reto = [yFixo.get(ar.de), yFixo.get(ar.para)].find((y) => cols.length && cols.every((c) => maisPerto(c, ar, y) === y));
      let y = yFixo.get(ar.de);
      for (const c of cols) {
        y = reto ?? maisPerto(c, ar, y);
        const p = `${i}:${c}`;
        yFixo.set(p, y);
        postos[c].push(y);
        camadas[c].push(p);
        ar.cadeia.push(p);
        fundoFixo = Math.max(fundoFixo, y + 16);
      }
      ar.cadeia.push(ar.para);
    });
    yRaia = fundoFixo;
    yDe = (it) => yFixo.get(it);
  };

  const ehNo = (it) => typeof it === "number";
  const alturaDe = (it) => (ehPonta(it) ? 2 * R : ehNo(it) ? M.altura : 0);
  const larguraDe = (it) => (ehPonta(it) ? 2 * R : ehNo(it) ? M.largura : 0);
  const camadas = Array.from({ length: total }, () => []);
  const topoDoDesenho = M.margem + (temFases ? M.cabecaFase : 0);
  const yFixo = new Map();
  let yDe = () => 0;
  let yRaia = topoDoDesenho;
  if (fixos) disporFixos(); else disporPorFaixas();
  /* início e término: na altura média do que está ligado a eles */
  for (const p of [INICIO, TERMINO]) {
    if (!comPontas || yFixo.has(p)) continue;
    const vs = arestas.filter((ar) => (p === INICIO ? ar.de : ar.para) === p).map((ar) => (p === INICIO ? ar.cadeia[1] : ar.cadeia.at(-2)));
    const media = vs.length ? vs.reduce((s, v) => s + yDe(v), 0) / vs.length : topoDoDesenho + R;
    yFixo.set(p, Math.max(topoDoDesenho + R, media));
  }

  /* ---------- 8. setas em ângulo reto ---------- */
  const saidas = new Map();
  const chegadas = new Map();
  for (const ar of arestas) {
    (saidas.get(ar.de) ?? saidas.set(ar.de, []).get(ar.de)).push(ar);
    (chegadas.get(ar.para) ?? chegadas.set(ar.para, []).get(ar.para)).push(ar);
  }
  const porta = (lista, ar, vizinho, no) => {
    const ordenadas = [...lista].sort((p, q) => yDe(vizinho(p)) - yDe(vizinho(q)));
    const i = ordenadas.indexOf(ar);
    const faixa = Math.min(alturaDe(no) * 0.6, (ordenadas.length - 1) * 12);
    return ordenadas.length > 1 ? -faixa / 2 + (faixa * i) / (ordenadas.length - 1) : 0;
  };
  const pedidosNoVao = Array.from({ length: Math.max(0, total - 1) }, () => []);
  for (const ar of arestas) {
    const ys = ar.cadeia.map(yDe);
    ys[0] += porta(saidas.get(ar.de), ar, (a) => a.cadeia[1], ar.de);
    ys[ys.length - 1] += porta(chegadas.get(ar.para), ar, (a) => a.cadeia.at(-2), ar.para);
    /* pontas alinhadas: se um lado tem só esta seta e a altura do outro cabe nele, a seta fica reta */
    const fim = ys.length - 1;
    const cabe = (y, it) => Math.abs(y - yDe(it)) <= alturaDe(it) / 2 - 10;
    if (Math.abs(ys[fim - 1] - ys[fim]) >= 0.5) {
      if (chegadas.get(ar.para).length === 1 && cabe(ys[fim - 1], ar.para)) ys[fim] = ys[fim - 1];
      else if (fim === 1 && saidas.get(ar.de).length === 1 && cabe(ys[fim], ar.de)) ys[0] = ys[fim];
    }
    ar.ys = ys;
    ar.trilhos = [];
    for (let k = 0; k + 1 < ys.length; k++) {
      if (Math.abs(ys[k] - ys[k + 1]) < 0.5) { ys[k + 1] = ys[k]; continue; }
      pedidosNoVao[coluna.get(ar.de) + k].push({ ar, k, ya: ys[k], yb: ys[k + 1] });
    }
  }
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
  /* fases (item 11): o trecho de colunas de cada uma, pelas fases efetivas; o vão logo depois da última fica mais largo */
  const fimDaFase = new Map();
  const inicioDaFase = new Map();
  if (temFases) {
    for (const a of acoes) {
      if (continuas.has(a.numero)) continue; // a contínua não marca o fim da fase (item 10)
      const f = ordemDasFases[faseEfetiva.get(a.numero)];
      if (f == null) continue;
      fimDaFase.set(f, Math.max(fimDaFase.get(f) ?? -1, coluna.get(a.numero)));
      inicioDaFase.set(f, Math.min(inicioDaFase.get(f) ?? Infinity, coluna.get(a.numero)));
    }
  }
  const colunasComMarco = new Set(fimDaFase.values());
  const extra = (c) => (colunasComMarco.has(c) ? M.vaoFase : 0);
  const larguraDaColuna = camadas.map((itens) => Math.max(0, ...itens.map(larguraDe)));
  const baseDoVao = pedidosNoVao.map((pedidos) => {
    const descem = (p) => (p.yb > p.ya ? -p.ya : p.ya);
    const opcoesDeOrdem = [
      melhorarOrdem([...pedidos].sort((p, q) => descem(p) - descem(q))),
      melhorarOrdem([...pedidos].sort((p, q) => p.ya - q.ya)),
      melhorarOrdem([...pedidos].sort((p, q) => q.ya - p.ya)),
    ];
    const ordem = opcoesDeOrdem.reduce((a, b) => (custoTotal(b) < custoTotal(a) ? b : a));
    ordem.forEach((p, i) => { p.ar.trilhos[p.k] = { i, n: ordem.length }; });
    return Math.max(M.vaoX, (ordem.length + 1) * M.trilha + 24);
  });
  const xDaColuna = [];
  let x = M.margem;
  for (let c = 0; c < total; c++) { xDaColuna.push(x); x += larguraDaColuna[c] + (baseDoVao[c] ?? 0) + (c < total - 1 ? extra(c) : 0); }
  const largura = (total ? xDaColuna[total - 1] + larguraDaColuna[total - 1] + extra(total - 1) : x) + M.margem;
  const fimDaColuna = (c) => xDaColuna[c] + larguraDaColuna[c];
  const xDoTrilho = (c, { i, n }) => fimDaColuna(c) + baseDoVao[c] / 2 + (i - (n - 1) / 2) * M.trilha;
  const xDoNo = (n) => xDaColuna[coluna.get(n)] + (larguraDaColuna[coluna.get(n)] - larguraDe(n)) / 2;

  const pos = new Map(acoes.map((a) => [a.numero, { x: xDoNo(a.numero), y: yDe(a.numero) - M.altura / 2 }]));
  const pontas = comPontas ? {
    inicio: { x: xDoNo(INICIO) + R, y: yDe(INICIO) },
    termino: { x: xDoNo(TERMINO) + R, y: yDe(TERMINO) },
  } : null;
  /* saída e chegada: na lateral do cartão; no círculo de início, do centro (o círculo cobre o começo);
     no de término, na borda do círculo */
  const xSaida = (n) => (n === INICIO ? pontas.inicio.x : xDoNo(n) + larguraDe(n));
  const xChegada = (n, y) => (n === TERMINO ? pontas.termino.x - Math.sqrt(Math.max(0, R * R - (y - pontas.termino.y) ** 2)) : xDoNo(n));
  for (const ar of arestas) {
    const c0 = coluna.get(ar.de);
    const pontos = [[xSaida(ar.de), ar.ys[0]]];
    for (let k = 0; k + 1 < ar.ys.length; k++) {
      const t = ar.trilhos[k];
      if (!t) continue;
      const xt = xDoTrilho(c0 + k, t);
      pontos.push([xt, ar.ys[k]], [xt, ar.ys[k + 1]]);
    }
    pontos.push([xChegada(ar.para, ar.ys.at(-1)), ar.ys.at(-1)]);
    ar.pontos = pontos;
  }
  for (const ar of arestas) { delete ar.cadeia; delete ar.ys; delete ar.trilhos; }

  /* setas que voltam (dependência circular): saem pela direita, descem até abaixo de tudo, voltam e sobem */
  let fundo = yRaia;
  voltam.forEach((ar, i) => {
    const a = pos.get(ar.de);
    const b = pos.get(ar.para);
    const y = yRaia + 12 + i * M.trilha;
    fundo = y + 12;
    const xs = a.x + M.largura + 6 + i * 3;
    const xe = b.x - 8 - i * 3;
    ar.pontos = [[a.x + M.largura, a.y + M.altura / 2], [xs, a.y + M.altura / 2], [xs, y], [xe, y], [xe, b.y + M.altura / 2], [b.x, b.y + M.altura / 2]];
    ar.volta = true;
    arestas.push(ar);
  });

  /* ---------- 9. nenhuma linha sobre outra ---------- */
  const caixas = [...pos.values()].map((p) => ({ x0: p.x, x1: p.x + M.largura, y0: p.y, y1: p.y + M.altura }));
  afastarSobrepostas(arestas, caixas, (ar, k, y) => {
    /* a primeira e a última parte ficam presas à lateral do cartão (ou ao círculo) */
    const ultimo = ar.pontos.length - 2;
    const dentro = (n) => (ehPonta(n) ? Math.abs(y - yDe(n)) <= R - 10 : Math.abs(y - yDe(n)) <= M.altura / 2 - 8);
    if (k === 0 && !dentro(ar.de)) return false;
    if (k === ultimo && !dentro(ar.para)) return false;
    return true;
  }, (ar) => { if (ar.para === TERMINO) ar.pontos.at(-1)[0] = xChegada(TERMINO, ar.pontos.at(-1)[1]); });
  for (const ar of arestas) ar.pontos = ar.pontos.map(([px, py]) => [Math.round(px * 10) / 10, Math.round(py * 10) / 10]);

  /* ---------- cercas das etapas e marcos das fases ---------- */
  const cercas = comMarcos ? etapasUsadas.map((e) => {
    const nos = acoes.filter((a) => etapa.get(a.numero) === e).map((a) => pos.get(a.numero));
    const info = e < SEM_MARCO ? pedidos[e] : { id: "", nome: "Sem etapa" };
    const x0 = Math.min(...nos.map((p) => p.x)) - M.cerca;
    const x1 = Math.max(...nos.map((p) => p.x)) + M.largura + M.cerca;
    const y0 = Math.min(...nos.map((p) => p.y)) - M.cerca - M.rotuloCerca;
    const y1 = Math.max(...nos.map((p) => p.y)) + M.altura + M.cerca;
    return { id: info.id, nome: info.nome, titulo: info.titulo ?? info.nome, fase: info.fase ?? null, faseNome: info.faseNome ?? null,
      x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 };
  }) : [];
  /* cada fase vai de x0 a x1 (a linha do fim, no meio do vão); a seguinte começa onde a anterior termina */
  const fases = [];
  for (const m of pedidos) {
    if (!m.fase || !fimDaFase.has(m.fase) || fases.some((f) => f.id === m.fase)) continue;
    const c = fimDaFase.get(m.fase);
    const ci = inicioDaFase.get(m.fase);
    const x1 = Math.round((fimDaColuna(c) + (baseDoVao[c] ?? 0) + extra(c) / 2) * 10) / 10;
    const antes = fases.filter((f) => f.x1 <= xDaColuna[ci]).at(-1);
    const x0 = antes ? antes.x1 : Math.round((xDaColuna[ci] - (ci > 0 ? (baseDoVao[ci - 1] ?? M.vaoX) / 2 : M.margem / 2)) * 10) / 10;
    fases.push({ id: m.fase, nome: m.faseNome ?? m.fase, x: x1, x0, x1 });
  }

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

  /* ---------- 10. ligações das ações contínuas ---------- */
  const ligacoesContinuas = [];
  if (continuas.size) {
    const retangulo = (lista) => {
      const x0 = Math.min(...lista.map((r) => r.x)); const y0 = Math.min(...lista.map((r) => r.y));
      return { x: x0, y: y0, largura: Math.max(...lista.map((r) => r.x + r.largura)) - x0, altura: Math.max(...lista.map((r) => r.y + r.altura)) - y0 };
    };
    const caixaDe = (n) => ({ x: pos.get(n).x, y: pos.get(n).y, largura: M.largura, altura: M.altura });
    const comuns = acoes.filter((a) => !continuas.has(a.numero));
    /** Onde a ligação encosta: {r: retângulo, acao, ponta} (ponta: o círculo do projeto) */
    const alvoDoMarco = (m, lado) => {
      const ms = membrosDoMarco(m);
      if (ms?.length && m.tipo === "acao") return { r: caixaDe(ms[0].numero), acao: ms[0].numero };
      if (ms?.length) {
        const doMarco = cercas.filter((c) => (m.tipo === "etapa" ? c.id === m.id : c.fase === m.id));
        return { r: doMarco.length ? retangulo(doMarco) : retangulo(ms.map((a) => caixaDe(a.numero))), grupo: true };
      }
      if (comPontas) return { ponta: lado === "inicio" ? pontas.inicio : pontas.termino };
      return comuns.length ? { r: retangulo(comuns.map((a) => caixaDe(a.numero))), grupo: true } : null;
    };
    const base = Math.max(fundo, ...[...pos.values()].map((p) => p.y + M.altura), ...cercas.map((c) => c.y + c.altura));
    let noCorredor = 0;
    const corredor = () => { const y = base + 16 + noCorredor * M.trilha; noCorredor += 1; fundo = Math.max(fundo, y + 12); return y; };
    const dentro = (r, b) => b.x >= r.x - 0.5 && b.x + b.largura <= r.x + r.largura + 0.5 && b.y >= r.y - 0.5 && b.y + b.altura <= r.y + r.altura + 0.5;
    const r1 = (v) => Math.round(v * 10) / 10;
    for (const a of acoes.filter((x) => continuas.has(x.numero))) {
      const b = caixaDe(a.numero);
      const by = b.y + b.altura / 2;
      const bx = b.x;
      const bxr = b.x + b.largura;
      /* começa junto: da lateral esquerda até o começo do marco */
      const ini = alvoDoMarco(a.comecaCom, "inicio");
      if (ini) {
        let pts;
        if (ini.ponta) pts = [[bx, by], [bx - 10, by], [bx - 10, ini.ponta.y], [ini.ponta.x + R, ini.ponta.y]];
        else {
          const ay = ini.acao != null ? ini.r.y + ini.r.altura / 2 : Math.min(ini.r.y + ini.r.altura - 6, Math.max(ini.r.y + 6, by));
          pts = Math.abs(ay - by) < 0.5 && ini.r.x < bx ? [[bx, by], [ini.r.x, by]] : [[bx, by], [Math.min(bx, ini.r.x) - 10, by], [Math.min(bx, ini.r.x) - 10, ay], [ini.r.x, ay]];
        }
        ligacoesContinuas.push({ continua: a.numero, lado: "inicio", acao: ini.acao ?? null, pontos: pts.map(([x, y]) => [r1(x), r1(y)]) });
      }
      /* termina junto: da lateral direita até o fim do marco */
      const fim = alvoDoMarco(a.terminaCom, "fim");
      if (fim) {
        let pts;
        if (fim.ponta) { const y = corredor(); pts = [[bxr, by], [bxr + 10, by], [bxr + 10, y], [fim.ponta.x, y], [fim.ponta.x, fim.ponta.y + R]]; }
        else {
          const ex = fim.r.x + fim.r.largura;
          const ay = fim.acao != null ? fim.r.y + fim.r.altura / 2 : fim.r.y + fim.r.altura - 6;
          if (fim.acao != null && Math.abs(ex - bxr) < 0.5) pts = [[bxr, by], [bxr + 10, by], [bxr + 10, ay], [ex, ay]];
          else if (fim.grupo && dentro(fim.r, b)) pts = [[bxr, by], [bxr + 6, by], [bxr + 6, ay], [ex, ay]];
          else { const y = corredor(); pts = [[bxr, by], [bxr + 10, by], [bxr + 10, y], [ex + 10, y], [ex + 10, ay], [ex, ay]]; }
        }
        ligacoesContinuas.push({ continua: a.numero, lado: "fim", acao: fim.acao ?? null, pontos: pts.map(([x, y]) => [r1(x), r1(y)]) });
      }
    }
  }

  const alturaFinal = Math.max(fundo, comPontas ? Math.max(pontas.inicio.y, pontas.termino.y) + R + 24 : 0) + M.margem;
  return {
    colunas: camadas.map((c) => c.filter((it) => ehNo(it) && !ehPonta(it))).filter((c, i) => !(comPontas && (i === 0 || i === total - 1))),
    coluna,
    pos,
    arestas,
    cercas,
    fases,
    pontas,
    ligacoesContinuas,
    topo: M.margem,
    largura,
    altura: acoes.length ? alturaFinal : M.margem * 2,
  };
}

/**
 * Fase efetiva de cada ação (item 11): a posição, na ordem das fases, da fase da sua etapa ou, se for mais adiante,
 * a da fase mais adiantada entre as ações de que depende. Assim nenhuma seta volta para uma fase anterior.
 * As ações sem fase (sem etapa, ou em etapa sem fase) e sem anteriores com fase ficam fora do mapa.
 * @returns {Map<number, number>}
 */
function fasesEfetivas(acoes, anteriores, marcos, marcoDe) {
  const ordem = [...new Set(marcos.map((m) => m.fase).filter((f) => f != null))];
  const faseDoMarco = new Map(marcos.map((m) => [m.id, m.fase != null ? ordem.indexOf(m.fase) : -1]));
  const propria = new Map(acoes.map((a) => [a.numero, faseDoMarco.get(marcoDe?.(a)) ?? -1]));
  const efetiva = new Map();
  const visitando = new Set();
  const de = (n) => {
    if (efetiva.has(n)) return efetiva.get(n);
    if (visitando.has(n)) return -1; // dependência circular
    visitando.add(n);
    const f = Math.max(propria.get(n) ?? -1, ...(anteriores.get(n) ?? []).map(de));
    visitando.delete(n);
    efetiva.set(n, f);
    return f;
  };
  for (const a of acoes) de(a.numero);
  for (const [n, f] of efetiva) if (f < 0) efetiva.delete(n);
  return efetiva;
}

/**
 * Posições mantidas depois de uma mudança feita na Rede (item 13; 11/11/2026, pedido do responsável: inserir só
 * abre espaço; a arrumação completa fica para o botão "Arrumar"). Recebe o arranjo que estava na tela e as ações de
 * agora, e devolve a coluna e a altura (centro) de cada ação, para a opção `fixos` de `montarRede`:
 * - as ações que já estavam ficam onde estavam;
 * - uma ação nova entra na coluna seguinte à da sua anterior mais adiantada, na altura da vizinha da mesma etapa
 *   (a seguinte, se houver; senão, a anterior). Se o lugar estiver ocupado, ou não houver coluna livre antes da
 *   seguinte, abre-se uma coluna: tudo dali para a direita desliza uma coluna, sem subir nem descer.
 * Devolve null quando o arranjo não pode ser mantido e a rede precisa ser arrumada de novo: mais de uma ação nova,
 * ação nova sem anteriores ou contínua, ação que mudou de etapa ou seta que passaria a apontar para trás.
 * @param {{coluna: Map<number, number>, pos: Map<number, {x: number, y: number}>, etapas?: Map<number, string|null>}} anterior
 * @param {object[]} acoes ações de agora
 * @param {{marcoDe?: (acao: object) => string|null, continuas?: boolean, medidas?: Partial<typeof MEDIDAS>}} [opcoes]
 * @returns {Map<number, {coluna: number, y: number}>|null}
 */
export function abrirEspaco(anterior, acoes, opcoes = {}) {
  if (!anterior?.pos?.size || !acoes.length) return null;
  const M = { ...MEDIDAS, ...(opcoes.medidas ?? {}) };
  const etapaDe = (a) => (opcoes.marcoDe ? opcoes.marcoDe(a) : a.etapa) ?? null;
  const numeros = new Set(acoes.map((a) => a.numero));
  const continua = (a) => Boolean(opcoes.continuas) && ehContinua(a);
  const fixos = new Map();
  const novas = [];
  for (const a of acoes) {
    const p = anterior.pos.get(a.numero);
    if (!p) { novas.push(a); continue; }
    if (anterior.etapas && (anterior.etapas.get(a.numero) ?? null) !== etapaDe(a)) return null;
    fixos.set(a.numero, { coluna: anterior.coluna.get(a.numero), y: p.y + M.altura / 2 });
  }
  if (novas.length > 1 || !fixos.size) return null;
  const dependencias = (a) => (continua(a) ? [] : (a.dependeDe ?? []).filter((d) => numeros.has(d) && d !== a.numero));
  if (novas.length) {
    const nova = novas[0];
    if (continua(nova)) return null;
    const antes = dependencias(nova).filter((d) => fixos.has(d));
    const depois = acoes.filter((a) => a !== nova && dependencias(a).includes(nova.numero)).map((a) => a.numero);
    if (!antes.length) return null;
    const maisAdiantada = antes.reduce((m, d) => (fixos.get(d).coluna > fixos.get(m).coluna ? d : m));
    const c = fixos.get(maisAdiantada).coluna + 1;
    const porEtapa = (lista) => lista.find((n) => etapaDe(acoes.find((a) => a.numero === n)) === etapaDe(nova));
    const ancora = (depois.length ? porEtapa(depois) : undefined) ?? porEtapa([maisAdiantada]) ?? depois[0] ?? maisAdiantada;
    const y = fixos.get(ancora).y;
    const semColuna = depois.some((n) => fixos.get(n).coluna <= c);
    /* lugar ocupado: um cartão na mesma coluna e altura, ou a cerca de outra etapa passando por ali */
    const cercas = new Map();
    for (const a of acoes) {
      const f = fixos.get(a.numero);
      if (!f) continue;
      const e = etapaDe(a);
      const b = cercas.get(e) ?? cercas.set(e, { a: f.coluna, b: f.coluna, y0: f.y, y1: f.y }).get(e);
      b.a = Math.min(b.a, f.coluna); b.b = Math.max(b.b, f.coluna); b.y0 = Math.min(b.y0, f.y); b.y1 = Math.max(b.y1, f.y);
    }
    const alcance = M.altura + M.vaoY;
    const ocupado = [...fixos.values()].some((f) => f.coluna === c && Math.abs(f.y - y) < alcance)
      || [...cercas].some(([e, b]) => e !== etapaDe(nova) && b.a <= c && b.b >= c && y > b.y0 - alcance && y < b.y1 + alcance);
    if (semColuna || ocupado) for (const f of fixos.values()) if (f.coluna >= c) f.coluna += 1;
    fixos.set(nova.numero, { coluna: c, y });
  }
  /* nenhuma seta para trás: senão, só arrumando de novo */
  for (const a of acoes) for (const d of dependencias(a)) if (fixos.get(d).coluna >= fixos.get(a.numero).coluna) return null;
  return fixos;
}

/**
 * Afasta trechos de setas que ficariam um sobre o outro (mesma linha, mesmo pedaço): o trecho vai alguns
 * pixels para o lado, sem passar por cima de cartões nem cair sobre outro trecho (27/10/2026).
 * Muda `pontos` no lugar.
 * @param {{pontos: number[][]}[]} arestas
 * @param {{x0: number, x1: number, y0: number, y1: number}[]} caixas cartões
 * @param {(ar: object, k: number, y: number) => boolean} podeHorizontal se o trecho horizontal k pode ir para y
 * @param {(ar: object) => void} [ajustar] acerto depois de mover (por exemplo, a ponta no círculo)
 */
export function afastarSobrepostas(arestas, caixas, podeHorizontal, ajustar = () => {}) {
  const trechos = () => arestas.flatMap((ar, i) => ar.pontos.slice(0, -1).map((p, k) => {
    const q = ar.pontos[k + 1];
    const h = Math.abs(p[1] - q[1]) < 0.01;
    if (h && Math.abs(p[0] - q[0]) < 0.01) return null;
    return { i, k, h, fixo: h ? p[1] : p[0], a: Math.min(h ? p[0] : p[1], h ? q[0] : q[1]), b: Math.max(h ? p[0] : p[1], h ? q[0] : q[1]) };
  }).filter(Boolean));
  const sobrepoe = (s, t) => s.i !== t.i && s.h === t.h && Math.abs(s.fixo - t.fixo) < 2 && Math.min(s.b, t.b) - Math.max(s.a, t.a) > 2;
  const cortaCartao = (s, fixo) => caixas.some((c) => (s.h
    ? fixo > c.y0 + 0.5 && fixo < c.y1 - 0.5 && s.b > c.x0 + 0.5 && s.a < c.x1 - 0.5
    : fixo > c.x0 + 0.5 && fixo < c.x1 - 0.5 && s.b > c.y0 + 0.5 && s.a < c.y1 - 0.5));
  const mover = (s, fixo) => {
    const p = arestas[s.i].pontos;
    const ind = s.h ? 1 : 0;
    p[s.k][ind] = fixo;
    p[s.k + 1][ind] = fixo;
  };
  const tentar = (s, todos) => {
    const ar = arestas[s.i];
    if (!s.h && (s.k === 0 || s.k === ar.pontos.length - 2)) return false; // pontas verticais não existem
    for (const d of [5, -5, 9, -9, 13, -13, 17, -17]) {
      const novo = s.fixo + d;
      if (s.h && !podeHorizontal(ar, s.k, novo)) continue;
      if (cortaCartao(s, novo)) continue;
      const movido = { ...s, fixo: novo };
      if (todos.some((t) => sobrepoe(movido, t))) continue;
      /* os trechos vizinhos mudam de comprimento: não podem passar a cair sobre outro */
      const original = s.fixo;
      mover(s, novo);
      const vizinhos = trechos().filter((t) => t.i === s.i && Math.abs(t.k - s.k) === 1);
      const ok = vizinhos.every((v) => !cortaCartao(v, v.fixo) && !trechos().some((t) => sobrepoe(v, t)));
      if (ok) { ajustar(ar); return true; }
      mover(s, original);
    }
    return false;
  };
  const desistir = new Set();
  for (let volta = 0; volta < 400; volta++) {
    const todos = trechos();
    let par = null;
    for (let x = 0; x < todos.length && !par; x++) {
      for (let y = x + 1; y < todos.length; y++) {
        const chave = `${todos[x].i}:${todos[x].k}|${todos[y].i}:${todos[y].k}`;
        if (!desistir.has(chave) && sobrepoe(todos[x], todos[y])) { par = [todos[x], todos[y], chave]; break; }
      }
    }
    if (!par) return;
    const [s, t, chave] = par;
    if (!tentar(t, todos) && !tentar(s, todos)) desistir.add(chave);
  }
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
