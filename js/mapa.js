/**
 * Mapa do Strata (documentação técnica, seção 8, "Mapa"; lote 1 de 29/10/2026): regras puras da vista que mostra os
 * itens do catálogo como pontos em faixas horizontais, do chão (Planos de Ação) ao alto (a camada mais alta do
 * catálogo), ligados pela relação "vem de" (os superiores de cada item). Sem tela e sem banco: recebe o catálogo,
 * devolve a geometria. A tela fica em `js/superior/mapa.js`.
 *
 * Especificação (independente de biblioteca; a TI vai reescrever o sistema):
 * - **Faixas**: uma por camada do catálogo, na ordem do catálogo (a mais alta em cima), mais a faixa dos Planos de
 *   Ação, embaixo. A camada **opcional sem itens não ocupa faixa**. O número e a altura das faixas vêm do catálogo
 *   e do texto, e não de valores escritos à mão.
 * - **Pontos**: um por item ativo e um por Plano de Ação ligado a algum item mostrado. O Plano de Ação que a pessoa
 *   não pode consultar aparece como "Plano de Ação restrito", sem o nome.
 * - **Ordem na faixa** por regras, e não por posições escritas à mão: começa pela ordem de código e nome e faz
 *   poucas passadas de baricentro (a posição de cada ponto é a média das posições dos pontos a que ele se liga,
 *   primeiro para baixo, depois para cima), para reduzir os cruzamentos de linhas.
 * - **Posição horizontal**: a largura do mapa é a da área e cresce para os lados quando a faixa mais cheia não cabe
 *   com os pontos a 13 unidades (26 ÷ 2) uns dos outros: o mesmo desenho no celular e no computador. Filhos do mesmo pai em blocos, na ordem do caminho desde o alto; pais sobre os blocos.
 * - **Altura dentro da faixa** (03/11/2026): sem degraus por regra; decidida pela acomodação (`acomodar`), com paredes
 *   macias e elásticas, antes de o mapa aparecer, sempre igual.
 * - **Rótulos**: no mapa, só o código, e só o que fica livre (`codigosVisiveis`); o nome completo no caminho aceso.
 * - **Ligações**: retas. Duas linhas do mesmo ponto nunca saem na mesma direção, nenhuma passa rente a outro ponto e
 *   a física não cria cruzamentos.
 * - **Curvatura**: a faixa e os pontos seguem uma curva suave por uma correção simples de altura,
 *   `deslocamento = (x − centro)² ÷ (2 × R)`, com R grande e a mesma correção no desenho das faixas e dos pontos.
 *   Sem coordenadas polares.
 */

/** Identificador da faixa dos Planos de Ação (a última). */
export const FAIXA_PLANOS = "planosDeAcao";

const porCodigoENome = (a, b) =>
  String(a.codigo ?? "").localeCompare(String(b.codigo ?? ""), "pt-BR", { numeric: true }) || String(a.nome).localeCompare(String(b.nome), "pt-BR");

/** Texto do ponto: "código · nome", com reticências quando passa de `max` letras (o nome inteiro fica no título). */
export function rotuloDoPonto(codigo, nome, max = 34) {
  const texto = codigo ? `${codigo} · ${nome}` : String(nome);
  return texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;
}

/**
 * Nome do caminho aceso em linhas curtas (03/11/2026): quebra nas palavras, em até `maxLinhas` linhas de até `max`
 * letras; o que sobrar vai para a última linha, cortado com reticências. Uma palavra maior que `max` fica inteira.
 * @returns {string[]}
 */
export function quebrarEmLinhas(texto, max = 26, maxLinhas = 3) {
  const palavras = String(texto ?? "").trim().split(/\s+/).filter(Boolean);
  const linhas = [];
  for (const p of palavras) {
    const atual = linhas.at(-1);
    if (atual != null && `${atual} ${p}`.length <= max) linhas[linhas.length - 1] = `${atual} ${p}`;
    else linhas.push(p);
  }
  if (linhas.length <= maxLinhas) return linhas;
  const resto = linhas.slice(maxLinhas - 1).join(" ");
  return [...linhas.slice(0, maxLinhas - 1), resto.length > max ? `${resto.slice(0, max - 1).trimEnd()}…` : resto];
}

/** Deslocamento para baixo, na posição x, da curva de raio `raio` com o ponto mais alto em `centro`. */
export const deslocamentoCurvo = (x, centro, raio) => ((x - centro) * (x - centro)) / (2 * raio);

/**
 * Faixas do mapa: as camadas do catálogo na ordem dele, menos as opcionais sem itens, e a dos Planos de Ação.
 * @param {object[]} camadas
 * @param {object[]} itens  itens ativos que vão aparecer
 * @param {{semPlanos?: boolean}} [opcoes]  `semPlanos`: a faixa dos Planos de Ação foi escondida pelo filtro (seção 8, "Filtros")
 * @returns {{id: string, nome: string, plural: string, opcional: boolean}[]}
 */
export function faixasDoMapa(camadas, itens, { semPlanos = false } = {}) {
  const faixas = camadas
    .filter((c) => !c.opcional || itens.some((x) => x.camada === c.id))
    .map((c) => ({ id: c.id, nome: c.nome, plural: c.plural, opcional: Boolean(c.opcional) }));
  if (!semPlanos) faixas.push({ id: FAIXA_PLANOS, nome: "Plano de Ação", plural: "Planos de Ação", opcional: false });
  return faixas;
}

/**
 * Calcula o mapa.
 * @param {object} p
 * @param {object[]} p.camadas  camadas do catálogo, de cima para baixo
 * @param {object[]} p.itens  itens a mostrar (a tela já tirou os que não valem hoje, se for o caso)
 * @param {{id: string, nome: string, superiores: string[], restrito?: boolean}[]} [p.planos]  Planos de Ação, com os itens a que se ligam
 * @param {(texto: string) => number} [p.medir]  largura do texto na tela; sem a tela, 7 unidades por letra
 * @param {{w: number, h: number}} [p.vista]  tamanho da área do mapa: a largura do mapa acompanha a da área
 * @param {number} [p.margem]  espaço nas pontas de cada faixa
 * @param {number} [p.espacoMinimo]  menor distância entre dois pontos da mesma faixa
 * @param {number} [p.folgaEntreBlocos]  distância a mais entre dois blocos de filhos de pais diferentes (agrupamento)
 * @param {number} [p.passoNivel]  degrau vertical entre pontos vizinhos de uma faixa que precisa de mais de um nível
 * @param {number} [p.niveisMaximos]  degraus para os nomes caberem lado a lado
 * @param {number} [p.fileirasMaximas]  quantas vezes os pontos de uma faixa podem ficar mais juntos que `espacoMinimo` antes de o mapa crescer para os lados (desde 04/11/2026, 2: o mesmo desenho em qualquer aparelho)
 * @param {number} [p.raioPorLargura]  raio da curva, em larguras do mapa
 * @param {Record<string, string[]>} [p.ordemPessoal]  ordem escolhida pela pessoa (lote 6): para cada camada, as chaves dos pontos, da esquerda para a direita
 * @param {boolean} [p.semPlanos]  sem a faixa dos Planos de Ação (filtro, `js/filtro-do-mapa.js`)
 *
 * Itens e planos vindos de `filtrarParaOMapa` trazem também `via` (superior → nomes dos itens escondidos no caminho),
 * `esmaecido` e `alerta`; o plano com `manter` aparece mesmo sem nenhum superior visível. A ligação ganha `via` (lista,
 * vazia na direta) e `indireta` (via não vazia); o ponto ganha `esmaecido` e `alerta`.
 */
export function calcularMapa({
  camadas, itens, planos = [], medir = (t) => t.length * 7, vista = { w: 960, h: 560 },
  margem = 28, espacoMinimo = 26, folgaEntreBlocos = 13, passoNivel = 19, niveisMaximos = 4, fileirasMaximas = 2, raioPorLargura = 4, ordemPessoal = {}, semPlanos = false,
}) {
  const ativos = itens.filter((x) => !x.excluidoEm);
  const faixas = faixasDoMapa(camadas, ativos, { semPlanos });
  const indiceDaFaixa = new Map(faixas.map((f, i) => [f.id, i]));
  const idsDosItens = new Set(ativos.map((x) => x.id));

  /* pontos: itens por código e nome; depois os Planos de Ação por nome */
  const nos = [];
  for (const x of [...ativos].sort(porCodigoENome)) {
    const faixa = indiceDaFaixa.get(x.camada);
    if (faixa == null) continue;
    nos.push({
      chave: x.id, id: x.id, tipo: "item", faixa, codigo: x.codigo ?? "", nome: x.nome, restrito: false,
      superiores: (x.superiores ?? []).filter((s) => idsDosItens.has(s)), via: x.via ?? {}, esmaecido: Boolean(x.esmaecido), alerta: x.alerta ?? null,
    });
  }
  for (const e of semPlanos ? [] : [...planos].sort(porCodigoENome)) {
    const ligados = (e.superiores ?? []).filter((s) => idsDosItens.has(s));
    if (!e.manter && (e.superiores ?? []).length && !ligados.length) continue; // só liga a itens que não aparecem: não aparece (o filtro manda manter)
    nos.push({
      chave: `plano:${e.id}`, id: e.id, tipo: "plano", faixa: faixas.length - 1, codigo: e.restrito ? "" : String(e.codigo ?? ""), nome: e.nome, restrito: Boolean(e.restrito), superiores: ligados,
      via: e.via ?? {}, esmaecido: Boolean(e.esmaecido), alerta: e.alerta ?? null,
    });
  }
  const porChave = new Map(nos.map((n) => [n.chave, n]));
  const ligacoes = nos.flatMap((n) => n.superiores.map((s) => {
    const via = n.via[s] ?? [];
    return { de: n.chave, para: s, via, indireta: via.length > 0 };
  }));
  const subordinados = new Map();
  for (const l of ligacoes) subordinados.set(l.para, [...(subordinados.get(l.para) ?? []), l.de]);

  /* ordem em cada faixa: baricentro, descendo e subindo, com poucas passadas */
  const lista = faixas.map((_, i) => nos.filter((n) => n.faixa === i));
  const numerar = (l) => l.forEach((n, i) => { n.posicao = (i + 0.5) / l.length; });
  lista.forEach(numerar);
  const reordenar = (l, vizinhos) => {
    const antes = new Map(l.map((n, i) => [n.chave, i]));
    const centro = new Map(l.map((n) => {
      const v = vizinhos(n).map((k) => porChave.get(k).posicao);
      return [n.chave, v.length ? v.reduce((a, b) => a + b, 0) / v.length : n.posicao];
    }));
    l.sort((a, b) => centro.get(a.chave) - centro.get(b.chave) || antes.get(a.chave) - antes.get(b.chave));
    numerar(l);
  };
  const descer = () => { for (let i = 1; i < lista.length; i++) reordenar(lista[i], (n) => n.superiores); };
  const subir = () => { for (let i = lista.length - 2; i >= 0; i--) reordenar(lista[i], (n) => subordinados.get(n.chave) ?? []); };
  descer(); subir(); descer(); subir(); descer();
  /*
   * Agrupamento (30/10/2026, versão 249): da segunda faixa para baixo, os filhos de um mesmo pai ficam juntos,
   * num bloco, na ordem dos pais (o pai de cada ponto, para isso, é o superior mais à esquerda). Dentro do bloco vale
   * a ordem do baricentro. Os pontos sem superior mostrado vão ao fim. A ordem pessoal, quando há, vem depois e vale
   * sobre o agrupamento. Entre um bloco e outro fica uma folga a mais (`folgaEntreBlocos`). As linhas continuam retas.
   */
  /*
   * Ordem dos blocos pelo caminho desde o alto (03/11/2026): cada ponto tem um endereço, a lista das posições no
   * caminho do alto até ele (o do pai, mais a posição dele no bloco). Os blocos seguem a ordem dos endereços dos pais,
   * comparados elemento a elemento, e não a posição do pai na faixa dele. Assim, um ponto ligado a um pai dois níveis
   * acima (um Programa ligado direto a uma Política, sem Portfólio) fica entre os blocos certos, e a linha dele não
   * cruza as dos vizinhos (é a ordem de uma árvore percorrida da esquerda para a direita).
   */
  const endereco = new Map();
  const compararEnderecos = (a, b) => {
    for (let j = 0; j < Math.min(a.length, b.length); j++) if (a[j] !== b[j]) return a[j] - b[j];
    return a.length - b.length;
  };
  lista[0]?.forEach((n, j) => endereco.set(n.chave, [j]));
  for (let i = 1; i < lista.length; i++) {
    const l = lista[i];
    if (!l.some((n) => n.superiores.length)) { l.forEach((n, j) => endereco.set(n.chave, [lista.length + i, j])); continue; }
    const enderecoDe = (k) => endereco.get(k) ?? [Infinity];
    for (const n of l) n.grupo = n.superiores.length ? [...n.superiores].sort((a, b) => compararEnderecos(enderecoDe(a), enderecoDe(b)) || (a < b ? -1 : 1))[0] : null;
    const antes = new Map(l.map((n, j) => [n.chave, j]));
    const semGrupo = [lista.length + i];
    l.sort((a, b) => compararEnderecos(a.grupo == null ? semGrupo : enderecoDe(a.grupo), b.grupo == null ? semGrupo : enderecoDe(b.grupo))
      || (a.grupo ?? "").localeCompare(b.grupo ?? "") || antes.get(a.chave) - antes.get(b.chave));
    numerar(l);
    l.forEach((n, j) => endereco.set(n.chave, [...(n.grupo == null ? semGrupo : enderecoDe(n.grupo)), j]));
  }
  /* ordem pessoal (lote 6): vale depois das passadas; os pontos que ela não conhece (itens novos) vão ao fim, na ordem automática */
  faixas.forEach((f, i) => {
    const salva = ordemPessoal?.[f.id];
    if (!Array.isArray(salva) || !salva.length) return;
    const lugar = new Map(salva.map((k, j) => [k, j]));
    const antes = new Map(lista[i].map((n, j) => [n.chave, j]));
    lista[i].sort((a, b) => (lugar.get(a.chave) ?? Infinity) - (lugar.get(b.chave) ?? Infinity) || antes.get(a.chave) - antes.get(b.chave));
    numerar(lista[i]);
  });
  /* quantas trocas de bloco cada faixa tem (cada uma ganha a folga) */
  const trocas = (l) => l.reduce((t, n, j) => t + (j && n.grupo !== l[j - 1].grupo ? 1 : 0), 0);

  /* largura: a da área, se der; senão, cresce para os lados (04/11/2026, decisão do responsável): a faixa mais cheia
     precisa caber com os pontos a 26 ÷ 2 = 13 unidades uns dos outros, mais a folga entre blocos. Assim o desenho é o
     mesmo no celular e no computador; a vista de abertura mostra o mapa inteiro, menor, e o zoom o deixa limpo */
  const RECUO = 9; // do ponto até o começo do nome
  const reservaFinal = 60; // espaço para o nome do último ponto
  const necessaria = (l) => ((Math.max(1, l.length) - 1) * espacoMinimo) / fileirasMaximas + trocas(l) * folgaEntreBlocos;
  const largura = Math.ceil(Math.max(vista.w, 2 * margem + reservaFinal + Math.max(0, ...lista.map(necessaria))));
  const xMin = margem;
  const xMax = largura - margem - reservaFinal;
  /* fileiras de cada faixa pelos pontos: a menor quantidade que deixa 26 entre vizinhos da mesma fileira */
  for (const l of lista) l.fileiras = l.length > 1 ? Math.min(fileirasMaximas, Math.max(1, Math.ceil(((l.length - 1) * espacoMinimo) / Math.max(1, xMax - xMin - trocas(l) * folgaEntreBlocos) - 1e-9))) : 1;

  /* posição: começa pela ordem; depois, para baixo e para cima, cada ponto tenta ficar sob (ou sobre) a média dos
     pontos a que se liga, sem passar do vizinho (as linhas ficam quase na vertical e se cruzam menos) */
  for (const l of lista) for (const n of l) n.x = xMin + n.posicao * (xMax - xMin);
  /* vizinhos seguidos ficam em fileiras diferentes: a distância mínima entre eles é 26 ÷ fileiras */
  const afastar = (l) => {
    if (!l.length) return;
    /* entre blocos (agrupamento), a folga a mais */
    const passo = (i) => espacoMinimo / l.fileiras + (l[i].grupo !== l[i - 1].grupo ? folgaEntreBlocos : 0);
    l.forEach((n) => { n.x = Math.min(xMax, Math.max(xMin, n.x)); });
    for (let i = 1; i < l.length; i++) l[i].x = Math.max(l[i].x, l[i - 1].x + passo(i));
    l[l.length - 1].x = Math.min(l[l.length - 1].x, xMax);
    for (let i = l.length - 2; i >= 0; i--) l[i].x = Math.min(l[i].x, l[i + 1].x - passo(i + 1));
  };
  /*
   * Pais sobre os blocos (30/10/2026, versão 249; como nos desenhos de árvore): cada bloco de filhos se
   * desloca inteiro para ficar sob o pai, e depois cada pai se centraliza sobre o seu bloco (a média dos filhos do
   * bloco), de baixo para cima; duas rodadas, sempre sem passar do vizinho. A última palavra é dos pais, então as
   * linhas de cada pai descem curtas e quase verticais até o seu bloco.
   */
  const media = (ns) => ns.reduce((s2, n) => s2 + n.x, 0) / ns.length;
  const blocos = (l) => {
    const r = [];
    for (const n of l) { if (r.length && r.at(-1)[0].grupo === n.grupo) r.at(-1).push(n); else r.push([n]); }
    return r;
  };
  const alinharBlocos = () => {
    for (let i = 1; i < lista.length; i++) {
      for (const b of blocos(lista[i])) {
        if (b[0].grupo == null) continue;
        const d = porChave.get(b[0].grupo).x - media(b);
        for (const n of b) n.x += d;
      }
      afastar(lista[i]);
    }
  };
  const centrarPais = () => {
    for (let i = lista.length - 2; i >= 0; i--) {
      for (const n of lista[i]) {
        const bloco = (subordinados.get(n.chave) ?? []).map((k) => porChave.get(k)).filter((c) => c.grupo === n.chave);
        if (bloco.length) n.x = media(bloco);
      }
      afastar(lista[i]);
    }
  };
  lista.forEach(afastar);
  alinharBlocos(); centrarPais(); alinharBlocos(); centrarPais();
  for (const n of nos) n.x = Math.round(n.x * 10) / 10;

  /*
   * Rótulos (03/11/2026, decisão do responsável): no mapa, sempre o **código**, e não o nome ("pense num mapa:
   * ninguém deixa frases completas"); o nome completo aparece no caminho aceso. Sem código (Planos de Ação, item sem
   * código), nenhum rótulo. A largura do código é a do texto em 11 px e seminegrito (a medida recebe 13 px).
   */
  for (const n of nos) {
    n.completo = !n.codigo ? String(n.nome) : `${n.codigo} · ${n.nome}`;
    n.rotulo = String(n.codigo ?? ""); // desde 04/11/2026, também o código do Plano de Ação
    n.largura = n.rotulo ? Math.round(((medir(n.rotulo) * TAMANHO_DO_CODIGO) / 13) * 1.06 * 10) / 10 : 0;
    n.nivel = 0;
  }

  /* faixas com a altura mínima; a física faz crescer as que têm pressão (paredes elásticas) */
  const alturaMinima = Math.min(72, Math.max(52, (vista.h - 60) / faixas.length)); // área baixa (celular): faixas mais baixas
  faixas.forEach((f, i) => { f.niveis = 1; f.altura = alturaMinima; f.nos = lista[i].map((n) => n.chave); });
  const centro = largura / 2;
  const raio = raioPorLargura * largura;
  const mapa = { faixas, nos, ligacoes, largura, centro, raio, recuo: RECUO, passoNivel, alturaMinima, ordem: lista.map((l) => l.map((n) => n.chave)) };
  acomodar(mapa, { margem });
  mapa.altura = Math.ceil(faixas.at(-1).base + deslocamentoCurvo(0, centro, raio));
  return mapa;
}

/** Tamanho do código no mapa, em px na tela (o mesmo de `js/superior/mapa.js`). */
const TAMANHO_DO_CODIGO = 11;

/**
 * Constantes da acomodação (física, 03/11/2026). Distâncias em unidades do mapa (1 unidade = 1 px na escala 1).
 * - `rigidezX`, `rigidezY`: mola leve de cada ponto até o lugar das regras (a horizontal, mais firme; a altura, solta);
 * - `raioDoPonto`: metade da menor distância entre dois pontos da mesma faixa;
 * - `meiaAlturaDoNome`: metade da altura da caixa do código; `folgaDoNome`: espaço entre duas caixas;
 * - `folgaDireita`: espaço a mais depois do código, até o ponto seguinte;
 * - `folgaDaLinha`: menor distância entre uma linha e um ponto que não é dela (regra firme, no fim de cada passo);
 * - `circulosSemEncostar`: a regra firme da linha não aproxima dois pontos da faixa a menos disso (os círculos têm raio 6);
 * - `margemDaParede`: espaço entre o conteúdo e a borda da faixa; `forca*`: frações da invasão corrigidas por passo;
 * - `anguloMinimo`: menor ângulo, em graus, entre duas linhas do mesmo ponto;
 * - `crescer`, `encolher`: quanto a parede cede à pressão e volta quando sobra espaço;
 * - `passoMaximo`: maior movimento de um ponto num passo; `passos`: limite de passos; `repouso`: movimento abaixo do
 *   qual a acomodação para.
 */
export const FISICA = Object.freeze({
  rigidezX: 0.15, rigidezY: 0.06, raioDoPonto: 8.5, meiaAlturaDoNome: 8, folgaDoNome: 2, folgaDireita: 4, folgaDaLinha: 9, circulosSemEncostar: 13, margemDaParede: 5,
  forcaDosPontos: 0.5, forcaDosNomes: 0.12, forcaDaLinha: 0.5, forcaDoNomeSobLinha: 0.25, forcaDaParede: 0.6, anguloMinimo: 6, forcaDoAngulo: 0.15,
  crescer: 0.5, encolher: 0.06, passoMaximo: 3, passos: 160, repouso: 0.02,
});

/** Caixa de um ponto com o seu código à direita (`[x0, x1, y0, y1]`), na posição (x, y) dada. */
const caixaDoPonto = (n, x, y, recuo, c = FISICA) => [x - c.raioDoPonto + 2, n.largura ? x + recuo + n.largura : x + c.raioDoPonto - 2, y - c.meiaAlturaDoNome, y + c.meiaAlturaDoNome];

/** Caixa do código sozinho (sem o ponto), ou null. */
export const caixaDoNome = (n, x, y, recuo, c = FISICA) => (n.largura ? [x + recuo - 1, x + recuo + n.largura, y - c.meiaAlturaDoNome + 1, y + c.meiaAlturaDoNome - 1] : null);

/** Os segmentos AB e CD se cruzam (cruzamento próprio, sem contar pontas que se tocam). */
export function segmentosSeCruzam(a, b, c, d) {
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const [d1, d2, d3, d4] = [o(a, b, c), o(a, b, d), o(c, d, a), o(c, d, b)];
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
}

/** O segmento AB passa pela caixa `[x0, x1, y0, y1]`. */
export const segmentoNaCaixa = (a, b, [x0, x1, y0, y1]) => segmentoNaCaixaXY(a.x, a.y, b.x, b.y, x0, x1, y0, y1);

/** O mesmo, com números soltos (recorte de Liang–Barsky). */
function segmentoNaCaixaXY(ax, ay, bx, by, x0, x1, y0, y1) {
  let t0 = 0; let t1 = 1;
  const dx = bx - ax; const dy = by - ay;
  const corta = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return corta(-dx, ax - x0) && corta(dx, x1 - ax) && corta(-dy, ay - y0) && corta(dy, y1 - ay) && t0 <= t1;
}

/**
 * Acomodação (física, 03/11/2026; decisões do responsável no mesmo dia): parte do lugar das regras (a ordem e a
 * posição horizontal acima, todos os pontos no meio da faixa) e move os pontos e as paredes das faixas, passo a passo,
 * até parar. Roda inteira antes de o mapa aparecer, então o desenho é o mesmo a cada abertura (sem acaso). Mexe em
 * `x`, `y`, `yCurvo` de cada ponto e em `altura`, `topo` e `base` de cada faixa.
 *
 * Em cada passo, sobre cada ponto agem:
 * - **mola leve** até o lugar das regras (a horizontal, mais firme; a altura, solta: a altura dentro da faixa não tem
 *   significado);
 * - **paredes**: as bordas da faixa (com a curva) empurram o ponto e o código que se aproximam delas (parede macia: a
 *   força cresce com a invasão);
 * - **outros pontos e códigos da mesma faixa**: duas caixas (ponto mais código à direita) que se encostam se afastam,
 *   na direção em que a invasão é menor (para os lados ou na altura);
 * - **linhas alheias**: a linha que passa perto de um ponto que não é dela, ou sobre o código dele, empurra o ponto
 *   para longe, na perpendicular da linha;
 * - **linhas do mesmo ponto** que saem quase na mesma direção (menos de `anguloMinimo`) afastam as outras pontas.
 *
 * O movimento só vale se **preservar a ordem** de cada faixa e **não criar cruzamento novo** de linhas (o ponto tenta
 * mover nos dois sentidos, depois só na altura, depois só na horizontal; se nada servir, fica). Assim a física nunca
 * troca a ordem das regras nem cruza linhas que as regras deixaram sem cruzar.
 *
 * **Paredes elásticas**: a pressão do conteúdo sobre as bordas de uma faixa a faz crescer; quando sobra espaço, ela
 * encolhe devagar, até o que o conteúdo pede, sem passar abaixo da altura mínima (a faixa com poucos itens continua
 * parecendo céu). Sem altura máxima. As faixas de baixo descem junto.
 */
export function acomodar(mapa, { margem = 28 } = {}, c = FISICA) {
  const { faixas, nos, ligacoes, largura, centro, raio, recuo, alturaMinima } = mapa;
  const N = nos.length;
  const d = (x) => deslocamentoCurvo(x, centro, raio);
  const indice = new Map(nos.map((n, i) => [n.chave, i]));
  const ordem = mapa.ordem.map((l) => l.map((k) => indice.get(k)));
  const faixa = Int32Array.from(nos, (n) => n.faixa);
  const larg = Float64Array.from(nos, (n) => n.largura || 0);
  const xr = Float64Array.from(nos, (n) => n.x);
  const x = Float64Array.from(xr);
  const oy = new Float64Array(N);
  const fx = new Float64Array(N); const fy = new Float64Array(N);
  const px = new Float64Array(N); const py = new Float64Array(N);
  for (const f of faixas) f.altura = Math.max(f.altura, alturaMinima);
  const meio = new Float64Array(faixas.length);
  const montarFaixas = () => { let topo = 0; faixas.forEach((f, i) => { f.topo = topo; f.base = topo + f.altura; meio[i] = topo + f.altura / 2; topo = f.base; }); };
  const Y = (i, xi = x[i], oyi = oy[i]) => meio[faixa[i]] + oyi + d(xi);
  const atualizar = (i) => { px[i] = x[i]; py[i] = Y(i); };

  /* linhas: pontas, as que incidem em cada ponto e as candidatas a cruzar com cada uma (fixo) */
  const S = ligacoes.length;
  const sa = Int32Array.from(ligacoes, (l) => indice.get(l.de)); const sb = Int32Array.from(ligacoes, (l) => indice.get(l.para));
  const incidentes = nos.map(() => []);
  for (let s = 0; s < S; s++) { incidentes[sa[s]].push(s); incidentes[sb[s]].push(s); }
  const faixasDa = (s) => [Math.min(faixa[sa[s]], faixa[sb[s]]), Math.max(faixa[sa[s]], faixa[sb[s]])];
  const candidatos = [];
  for (let s = 0; s < S; s++) {
    const [f0, f1] = faixasDa(s);
    const lista = [];
    for (let t = 0; t < S; t++) {
      if (t === s || sa[t] === sa[s] || sa[t] === sb[s] || sb[t] === sa[s] || sb[t] === sb[s]) continue;
      const [g0, g1] = faixasDa(t);
      if (g0 <= f1 && f0 <= g1) lista.push(t);
    }
    candidatos.push(Int32Array.from(lista));
  }
  const lado3 = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const opostos = (u, v) => (u > 1e-9 && v < -1e-9) || (u < -1e-9 && v > 1e-9);
  /** Cruzamentos das linhas do ponto `k` se ele estivesse em (xk, yk): os pares de linhas (s × S + t). */
  const cruzamentosDe = (k, xk, yk) => {
    const pares = [];
    for (const s of incidentes[k]) {
      const ax = sa[s] === k ? xk : px[sa[s]]; const ay = sa[s] === k ? yk : py[sa[s]];
      const bx = sb[s] === k ? xk : px[sb[s]]; const by = sb[s] === k ? yk : py[sb[s]];
      const x0 = Math.min(ax, bx); const x1 = Math.max(ax, bx);
      for (const t of candidatos[s]) {
        const p = sa[t]; const q = sb[t];
        if ((px[p] < x0 && px[q] < x0) || (px[p] > x1 && px[q] > x1)) continue;
        if (opostos(lado3(ax, ay, bx, by, px[p], py[p]), lado3(ax, ay, bx, by, px[q], py[q]))
          && opostos(lado3(px[p], py[p], px[q], py[q], ax, ay), lado3(px[p], py[p], px[q], py[q], bx, by))) pares.push(Math.min(s, t) * S + Math.max(s, t));
      }
    }
    return pares;
  };
  /** Nenhum par de `depois` é novo (todos já estavam em `antes`). */
  const semNovos = (antes, depois) => { if (!depois.length) return true; const ja = new Set(antes); return depois.every((p) => ja.has(p)); };
  /** Todos os pares de linhas que se cruzam, com as posições de agora. */
  const cruzamentosTotais = () => { const t = []; for (let i = 0; i < N; i++) t.push(...cruzamentosDe(i, px[i], py[i])); return t; };
  const xMinimo = margem / 2 + c.raioDoPonto;
  const xMaximo = (i) => largura - margem / 2 - (larg[i] ? recuo + larg[i] + 2 : c.raioDoPonto);
  const R = c.raioDoPonto; const H = c.meiaAlturaDoNome; const G = c.folgaDoNome;
  const dir = (i) => (larg[i] ? x[i] + recuo + larg[i] + c.folgaDireita : x[i] + R - 2); // borda direita da caixa (ponto mais código)
  const minimo = (c.anguloMinimo * Math.PI) / 180;
  const pressao = new Float64Array(faixas.length);
  /** Faixa (a lista da ordem) e posição de cada ponto nela. */
  const lugarNaOrdem = [];
  for (const l of ordem) l.forEach((i, a) => { lugarNaOrdem[i] = [l, a]; });
  /** Em (xn, oyn), o ponto da posição `a` da faixa `l` chegaria mais perto de um vizinho da faixa que já está a menos de `circulosSemEncostar` (os círculos, de raio 6, se encostariam). */
  const encostaEmVizinho = (l, a, xn, oyn) => {
    const i = l[a];
    for (let b = Math.max(0, a - 4); b <= Math.min(l.length - 1, a + 4); b++) {
      if (b === a) continue;
      const depois = Math.hypot(x[l[b]] - xn, oy[l[b]] - oyn);
      if (depois < c.circulosSemEncostar && depois < Math.hypot(x[l[b]] - x[i], oy[l[b]] - oy[i])) return true;
    }
    return false;
  };
  /* faixa folgada: cabe um ponto a cada diâmetro mínimo (2 × raio + 1), em média; numa faixa mais cheia que isso, a
     saída na altura (abaixo) vira uma escada pela faixa toda e não resolve, então não vale */
  const folgada = ordem.map((l) => l.length < 2 || (largura - margem) / (l.length - 1) >= 2 * R + 1);

  for (let passo = 0; passo < c.passos; passo++) {
    montarFaixas();
    for (let i = 0; i < N; i++) { atualizar(i); fx[i] = c.rigidezX * (xr[i] - x[i]); fy[i] = -c.rigidezY * oy[i]; }
    pressao.fill(0);
    /* paredes */
    for (let i = 0; i < N; i++) {
      const livre = Math.max(0, faixas[faixa[i]].altura / 2 - c.margemDaParede - H);
      const invasao = Math.abs(oy[i]) - livre;
      if (invasao > 0) { fy[i] -= Math.sign(oy[i]) * invasao * c.forcaDaParede; pressao[faixa[i]] += invasao; }
    }
    /*
     * mesma faixa: dois pontos perto demais se afastam, em qualquer direção (o da direita sobe, se estiverem na mesma
     * altura); um código que encosta no ponto ou no código vizinho os afasta só para os lados, quando há espaço (a
     * tela mostra só os códigos que ficam livres, `codigosVisiveis`)
     */
    for (const l of ordem) {
      for (let a = 0; a < l.length; a++) {
        const i = l[a];
        const direitaI = dir(i);
        for (let b = a + 1; b < l.length; b++) {
          const j = l[b];
          const dxp = x[j] - x[i]; const dyp = oy[j] - oy[i];
          if (dxp > direitaI - x[i] + 2 * R + 300) break;
          const dist = Math.hypot(dxp, dyp);
          if (dist < 2 * R + 1) {
            const e = (2 * R + 1 - dist) / 2 * c.forcaDosPontos;
            const [ux, uy] = Math.abs(dyp) > 1e-6 ? [dxp / dist, dyp / dist] : [0, b % 2 ? -1 : 1]; // na mesma altura: alterna, em zigue-zague
            fx[i] -= ux * e; fy[i] -= uy * e; fx[j] += ux * e; fy[j] += uy * e;
          }
          const ix = direitaI + G - (x[j] - R + 2);
          const iy = 2 * H + G - Math.abs(dyp);
          if (ix > 0 && iy > 0) { fx[i] -= (ix / 2) * c.forcaDosNomes; fx[j] += (ix / 2) * c.forcaDosNomes; }
        }
      }
    }
    /*
     * linhas alheias: a linha que passa rente a um ponto, ou sobre o código dele, empurra o ponto para o lado em que ele
     * já está, na perpendicular da linha, até ficar livre (sobre o código, mais fraco: a tela esconde o código que uma
     * linha cobre). A ponta da linha que está na mesma faixa do ponto cede um pouco para o outro lado.
     */
    for (let s = 0; s < S; s++) {
      const A = sa[s]; const B = sb[s];
      const ax = px[A]; const ay = py[A]; const bx = px[B]; const by = py[B];
      const dx = bx - ax; const dy = by - ay; const comp = Math.hypot(dx, dy) || 1;
      const nx = -dy / comp; const ny = dx / comp;
      const x0 = Math.min(ax, bx) - 80; const x1 = Math.max(ax, bx) + R + 2;
      const y0 = Math.min(ay, by) - 2 * H; const y1 = Math.max(ay, by) + 2 * H;
      for (let i = 0; i < N; i++) {
        if (i === A || i === B || x[i] < x0 || x[i] > x1 || py[i] < y0 || py[i] > y1) continue;
        const u = Math.max(0, Math.min(1, ((px[i] - ax) * dx + (py[i] - ay) * dy) / (comp * comp)));
        const perto = Math.hypot(px[i] - ax - u * dx, py[i] - ay - u * dy) < c.folgaDaLinha;
        const cx0 = x[i] + recuo - 3; const cx1 = x[i] + recuo + larg[i] + 2;
        const sobreNome = larg[i] > 0 && segmentoNaCaixaXY(ax, ay, bx, by, cx0, cx1, py[i] - H - 1, py[i] + H + 1);
        if (!perto && !sobreNome) continue;
        const sc = (px[i] - ax) * nx + (py[i] - ay) * ny;
        const sinal = Math.sign(sc) || 1;
        let e = perto ? c.folgaDaLinha - Math.abs(sc) : 0;
        if (sobreNome) {
          const cx = (cx0 + cx1) / 2;
          const scc = (cx - ax) * nx + (py[i] - ay) * ny;
          const meia = (Math.abs(nx) * (cx1 - cx0)) / 2 + Math.abs(ny) * (H + 1);
          e = Math.max(e, (meia - sinal * scc + 2) * c.forcaDoNomeSobLinha);
        }
        let mx = sinal * nx * Math.max(0, e); let my = sinal * ny * Math.max(0, e);
        /* ponto rente a uma linha íngreme que sai de um vizinho da mesma faixa: para os lados, a ordem não deixa;
           a saída é na altura, para o lado em que a linha não existe (abaixo da ponta, se ela sobe; acima, se desce),
           só em faixa folgada e só em desvio curto */
        const ponta = faixa[A] === faixa[i] ? A : faixa[B] === faixa[i] ? B : -1;
        if (perto && ponta >= 0 && folgada[faixa[i]] && Math.abs(nx) > 0.7) {
          const outra = ponta === A ? B : A;
          const sobe = py[outra] < py[ponta];
          const falta = sobe ? py[ponta] + c.folgaDaLinha - py[i] : py[i] - (py[ponta] - c.folgaDaLinha);
          if (falta > 0 && falta <= 4 * c.folgaDaLinha) { mx = 0; my = sobe ? falta : -falta; } // só desvios curtos: longos viram uma escada
        }
        if (!mx && !my) continue;
        fx[i] += mx * c.forcaDaLinha; fy[i] += my * c.forcaDaLinha;
        for (const p of [A, B]) if (faixa[p] === faixa[i]) fy[p] -= my * c.forcaDaLinha * 0.5;
      }
    }
    /* linhas do mesmo ponto se abrem */
    for (let i = 0; i < N; i++) {
      if (incidentes[i].length < 2) continue;
      const ls = incidentes[i].map((s) => { const o = sa[s] === i ? sb[s] : sa[s]; return { o, ang: Math.atan2(py[o] - py[i], px[o] - px[i]) }; }).sort((p, q) => p.ang - q.ang);
      for (let k = 1; k < ls.length; k++) {
        const dif = ls[k].ang - ls[k - 1].ang;
        if (dif >= minimo) continue;
        for (const [m, sinal] of [[ls[k - 1], -1], [ls[k], 1]]) {
          const dist = Math.hypot(px[m.o] - px[i], py[m.o] - py[i]);
          const empurra = ((minimo - dif) * dist * c.forcaDoAngulo) / 2;
          const ang = m.ang + (sinal * Math.PI) / 2;
          fx[m.o] += Math.cos(ang) * empurra; fy[m.o] += Math.sin(ang) * empurra;
        }
      }
    }
    /* movimento, com resfriamento (o passo máximo diminui até parar): só o que preserva a ordem e não cria cruzamento */
    const teto = c.passoMaximo * Math.max(0.05, 1 - passo / c.passos);
    const lim = (v) => Math.max(-teto, Math.min(teto, v));
    let maior = 0;
    for (const l of ordem) {
      for (let a = 0; a < l.length; a++) {
        const i = l[a];
        const mx = lim(fx[i]); const my = lim(fy[i]);
        if (Math.abs(mx) < 1e-4 && Math.abs(my) < 1e-4) continue;
        const esquerda = a ? x[l[a - 1]] + 1 : xMinimo;
        const direita = a < l.length - 1 ? x[l[a + 1]] - 1 : Infinity;
        const novoX = (v) => Math.max(esquerda, Math.min(direita, xMaximo(i), Math.max(xMinimo, x[i] + v)));
        const tem = incidentes[i].length > 0;
        const antes = tem ? cruzamentosDe(i, px[i], py[i]) : [];
        for (const [vx, vy] of [[mx, my], [0, my], [mx, 0]]) {
          if (!vx && !vy) continue;
          const xn = novoX(vx); const oyn = oy[i] + vy;
          if (tem && !semNovos(antes, cruzamentosDe(i, xn, Y(i, xn, oyn)))) continue;
          maior = Math.max(maior, Math.abs(xn - x[i]), Math.abs(oyn - oy[i]));
          x[i] = xn; oy[i] = oyn;
          atualizar(i);
          break;
        }
      }
    }
    /*
     * Linha longe de ponto alheio, como regra firme (04/11/2026): as forças podem se anular com o ponto ainda rente a
     * uma linha (por exemplo, o código empurrando o ponto de volta para ela). Por isso, no fim de cada passo, o ponto a
     * menos de `folgaDaLinha` de uma linha que não é dele é posto a essa distância, na perpendicular da linha, para o
     * lado em que já está; se isso trocar a ordem ou criar cruzamento, tenta só na altura e depois só para o lado.
     */
    for (let s = 0; s < S; s++) {
      const A = sa[s]; const B = sb[s];
      const ax = px[A]; const ay = py[A]; const bx = px[B]; const by = py[B];
      const dx = bx - ax; const dy = by - ay; const comp2 = dx * dx + dy * dy;
      if (!comp2) continue;
      const comp = Math.sqrt(comp2);
      const nx = -dy / comp; const ny = dx / comp;
      const x0 = Math.min(ax, bx) - c.folgaDaLinha; const x1 = Math.max(ax, bx) + c.folgaDaLinha;
      const y0 = Math.min(ay, by) - c.folgaDaLinha; const y1 = Math.max(ay, by) + c.folgaDaLinha;
      for (let i = 0; i < N; i++) {
        if (i === A || i === B || px[i] < x0 || px[i] > x1 || py[i] < y0 || py[i] > y1) continue;
        const u = Math.max(0, Math.min(1, ((px[i] - ax) * dx + (py[i] - ay) * dy) / comp2));
        const qx = px[i] - (ax + u * dx); const qy = py[i] - (ay + u * dy);
        const dist = Math.hypot(qx, qy);
        if (dist >= c.folgaDaLinha) continue;
        /* para longe do ponto mais próximo da linha (na ponta, a direção da ponta; no meio, a perpendicular) */
        const [ux, uy] = dist > 1e-6 ? [qx / dist, qy / dist] : [nx, ny];
        const falta = c.folgaDaLinha - dist + 0.25;
        const tentativas = [[ux * falta, uy * falta]];
        if (Math.abs(uy) > 0.2) tentativas.push([0, Math.sign(uy) * Math.min(3 * falta, falta / Math.abs(uy))]);
        if (Math.abs(ux) > 0.2) tentativas.push([Math.sign(ux) * Math.min(3 * falta, falta / Math.abs(ux)), 0]);
        /* tenta mover o ponto; se não der, a ponta da linha que está na mesma faixa dele, para o outro lado */
        const mover = (k, lista) => {
          const [lk, ak] = lugarNaOrdem[k];
          const esq = ak ? x[lk[ak - 1]] + 1 : xMinimo;
          const dir = ak < lk.length - 1 ? x[lk[ak + 1]] - 1 : xMaximo(k);
          const temK = incidentes[k].length > 0;
          const antesK = temK ? cruzamentosDe(k, px[k], py[k]) : [];
          for (const [vx, vy] of lista) {
            const xn = x[k] + vx;
            if (xn < esq || xn > dir) continue;
            const oyn = oy[k] + vy;
            if (encostaEmVizinho(lk, ak, xn, oyn)) continue;
            if (temK && !semNovos(antesK, cruzamentosDe(k, xn, Y(k, xn, oyn)))) continue;
            maior = Math.max(maior, Math.abs(vx), Math.abs(vy));
            x[k] = xn; oy[k] = oyn;
            atualizar(k);
            return true;
          }
          return false;
        };
        if (mover(i, tentativas)) continue;
        const ponta = faixa[A] === faixa[i] ? A : faixa[B] === faixa[i] ? B : -1;
        if (ponta >= 0) mover(ponta, tentativas.map(([vx, vy]) => [-vx, -vy]));
      }
    }
    /* paredes elásticas: crescem com a pressão; encolhem devagar até o que o conteúdo pede, sem passar da mínima.
       Como a faixa que muda de altura desloca as de baixo, a mudança só vale se não criar cruzamento */
    let mexeu = maior;
    const alturasAntes = faixas.map((f) => f.altura);
    const cruzamentosAntes = cruzamentosTotais();
    faixas.forEach((f, k) => {
      const antes = f.altura;
      if (pressao[k] > 0) f.altura += c.crescer * pressao[k];
      else {
        let meia = 0;
        for (const i of ordem[k]) meia = Math.max(meia, Math.abs(oy[i]));
        const pede = Math.max(alturaMinima, 2 * (meia + H + c.margemDaParede));
        if (f.altura > pede) f.altura -= (f.altura - pede) * c.encolher;
      }
      mexeu = Math.max(mexeu, Math.abs(f.altura - antes));
    });
    if (faixas.some((f, k) => f.altura !== alturasAntes[k])) {
      montarFaixas();
      for (let i = 0; i < N; i++) atualizar(i);
      if (!semNovos(cruzamentosAntes, cruzamentosTotais())) { faixas.forEach((f, k) => { f.altura = alturasAntes[k]; }); mexeu = maior; }
    }
    if (mexeu < c.repouso && passo > 10) break;
  }
  /* sem arredondar: duas linhas quase encostadas poderiam passar a se cruzar */
  montarFaixas();
  nos.forEach((n, i) => {
    n.x = x[i];
    n.y = meio[n.faixa] + oy[i];
    n.yCurvo = n.y + d(n.x);
  });
  return mapa;
}

const n1 = (v) => Math.round(v * 10) / 10;

/** Contorno de uma faixa, com as bordas curvas (a parábola é uma curva de Bézier quadrática exata). */
export function caminhoDaFaixa(faixa, { largura, centro, raio }) {
  const d = (x) => deslocamentoCurvo(x, centro, raio);
  const controle = (y) => y - (centro * centro) / (2 * raio); // y + a(x0−c)(x1−c), com x0 = 0 e x1 = largura
  const topo = faixa.topo; const base = faixa.base;
  return `M0 ${n1(topo + d(0))} Q${n1(centro)} ${n1(controle(topo))} ${n1(largura)} ${n1(topo + d(largura))}`
    + ` L${n1(largura)} ${n1(base + d(largura))} Q${n1(centro)} ${n1(controle(base))} 0 ${n1(base + d(0))} Z`;
}

/**
 * Céu e solo da tela cheia (29/10/2026, tarde; a referência é o esboço): as faixas continuam, só como desenho, para os
 * dois lados além do mapa (`alem` unidades), pela mesma curva; abaixo da faixa dos Planos de Ação fica o solo, e acima
 * da faixa mais alta, o céu (o fundo da tela, com estrelas de noite). Sem círculos gigantes nem desfoque: só caminhos
 * com a mesma correção de altura e um gradiente linear no solo.
 * Contorno de uma faixa de `topo` a `base`, de x = −alem a x = largura + alem (simétrico em torno do centro, então a
 * curva de Bézier quadrática com o ponto de controle no centro é exatamente a parábola).
 */
export function caminhoAlem({ topo, base }, mapa, alem) {
  const x0 = -alem; const x1 = mapa.largura + alem;
  return `${curvaPorPartes(topo, x0, x1, mapa, "M")} L${n1(x1)} ${n1(base + deslocamentoCurvo(x1, mapa.centro, mapa.raio))}${curvaPorPartes(base, x1, x0, mapa, "")} Z`;
}

/**
 * A curva `y + deslocamento(x)` de xa a xb em partes, cada uma uma Bézier quadrática exata da parábola (o ponto de
 * controle sai da tangente). Uma parte só, longa demais, sai facetada na tela do navegador; por isso, partes de no
 * máximo meia largura do mapa.
 */
function curvaPorPartes(y, xa, xb, { largura, centro, raio }, inicio) {
  const partes = Math.max(1, Math.ceil(Math.abs(xb - xa) / (largura / 2)));
  const altura = (x) => y + deslocamentoCurvo(x, centro, raio);
  let d = inicio ? `${inicio}${n1(xa)} ${n1(altura(xa))}` : "";
  for (let i = 0; i < partes; i++) {
    const a = xa + ((xb - xa) * i) / partes; const b = xa + ((xb - xa) * (i + 1)) / partes;
    const controle = altura(a) + ((b - a) / 2) * ((a - centro) / raio); // tangente da parábola em a
    d += ` Q${n1((a + b) / 2)} ${n1(controle)} ${n1(b)} ${n1(altura(b))}`;
  }
  return d;
}

/** Linha do solo: a borda de baixo da faixa dos Planos de Ação, estendida para os dois lados. */
export function linhaDoSolo(mapa, alem) {
  return curvaPorPartes(mapa.faixas[mapa.faixas.length - 1].base, -alem, mapa.largura + alem, mapa, "M");
}

/**
 * Estrelas do céu acima da faixa mais alta (só no tema noite, como as das faixas): sempre nos mesmos lugares
 * (gerador fixo), de x = −alem a largura + alem, até `altura` unidades acima do mapa, cada uma acima da curva do topo.
 * @returns {{x: number, y: number, r: number, o: number}[]}
 */
export function estrelasDoCeu(mapa, { alem = mapa.largura, altura = mapa.largura, porArea = 1 / 2600 } = {}) {
  let semente = 7;
  const proximo = () => { semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0; return semente / 4294967296; };
  const topo = mapa.faixas[0]?.topo ?? 0;
  const largura = mapa.largura + 2 * alem;
  const quantas = Math.round(largura * altura * porArea);
  const estrelas = [];
  for (let k = 0; k < quantas; k++) {
    const x = -alem + proximo() * largura;
    const y = topo - 4 - proximo() * altura + deslocamentoCurvo(x, mapa.centro, mapa.raio);
    estrelas.push({ x: n1(x), y: n1(y), r: n1(0.4 + proximo() * 1.0), o: Math.round((0.3 + proximo() * 0.6) * 100) / 100 });
  }
  return estrelas;
}

/**
 * Códigos que aparecem no mapa, na escala `k` (03/11/2026): o código fica à direita do ponto, num tamanho fixo na tela
 * (`larguraNaTela(codigo)` px de largura, `alturaNaTela` px de altura, a `recuoNaTela` px do ponto), então, no mundo do
 * mapa, a caixa dele mede isso dividido por `k`. Um código aparece só se a caixa dele, com uma folga de 2 px:
 * - não passa da ponta direita do mapa;
 * - não cobre nenhum ponto (`raioNaTela` px de raio);
 * - não cobre o código de um ponto já escolhido (a escolha vai da esquerda para a direita, faixa a faixa; empate de x,
 *   o de cima primeiro);
 * - não tem nenhuma linha passando por cima, a não ser as do próprio ponto.
 * Mais perto (k maior), as caixas encolhem no mundo e mais códigos aparecem. Os pontos sem código não entram.
 * @param {{x: number, yCurvo: number}} [posicoes]  posição de agora de cada ponto (durante a mola), por chave; sem ela, a do mapa
 * @returns {Set<string>}  as chaves dos pontos cujo código aparece
 */
export function codigosVisiveis(mapa, k, { larguraNaTela, alturaNaTela = 13, recuoNaTela = 9, raioNaTela = 6, posicoes = null }) {
  const pos = (n) => posicoes?.get(n.chave) ?? { x: n.x, y: n.yCurvo };
  const folga = 2 / k;
  const caixa = (n) => {
    const p = pos(n);
    const meia = alturaNaTela / 2 / k;
    return [p.x + recuoNaTela / k - folga, p.x + (recuoNaTela + larguraNaTela(n.rotulo)) / k + folga, p.y - meia - folga, p.y + meia + folga];
  };
  const porChave = new Map(mapa.nos.map((n) => [n.chave, n]));
  const segmentos = mapa.ligacoes.map((l) => ({ de: l.de, para: l.para, a: pos(porChave.get(l.de)), b: pos(porChave.get(l.para)) }));
  const candidatos = mapa.nos.filter((n) => n.rotulo).sort((a, b) => a.faixa - b.faixa || pos(a).x - pos(b).x || pos(a).y - pos(b).y);
  const escolhidas = [];
  const visiveis = new Set();
  const r = raioNaTela / k;
  for (const n of candidatos) {
    const c = caixa(n);
    if (c[1] > mapa.largura) continue;
    if (mapa.nos.some((m) => m !== n && pos(m).x + r > c[0] && pos(m).x - r < c[1] && pos(m).y + r > c[2] && pos(m).y - r < c[3])) continue;
    if (escolhidas.some((e) => e[0] < c[1] && c[0] < e[1] && e[2] < c[3] && c[2] < e[3])) continue;
    if (segmentos.some((s) => s.de !== n.chave && s.para !== n.chave && segmentoNaCaixa(s.a, s.b, c))) continue;
    escolhidas.push(c);
    visiveis.add(n.chave);
  }
  return visiveis;
}

/** Linha entre um ponto e o que ele "vem de": reta (duas linhas do mesmo ponto nunca se sobrepõem, só se separam). */
export const caminhoDaLigacao = (filho, superior) => `M${filho.x} ${filho.yCurvo} L${superior.x} ${superior.yCurvo}`;

const distanciaAoSegmento = (p, a, b) => {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
};

/**
 * Confere as linhas do mapa: devolve as que passam rente a um ponto que não é delas (`folga` unidades), os pares de
 * linhas do mesmo ponto que saem quase na mesma direção (menos de 2°), isto é, que se sobrepõem, e (03/11/2026) os
 * pares de linhas sem ponta em comum que se cruzam, menos as de itens com mais de um superior (esses cruzamentos a
 * ordem não tem como evitar sempre). As linhas sobre os códigos ficam com `codigosVisiveis`, que só mostra o código
 * livre.
 * @returns {{tipo: "ponto"|"sobreposta"|"cruzamento", ligacao: object, outro: object}[]}
 */
export function problemasDasLigacoes(mapa, folga = 6) {
  const porChave = new Map(mapa.nos.map((n) => [n.chave, n]));
  const P = (n) => ({ x: n.x, y: n.yCurvo });
  const problemas = [];
  for (const l of mapa.ligacoes) {
    const a = porChave.get(l.de); const b = porChave.get(l.para);
    for (const n of mapa.nos) {
      if (n === a || n === b) continue;
      if (distanciaAoSegmento(P(n), P(a), P(b)) < folga) problemas.push({ tipo: "ponto", ligacao: l, outro: n });
    }
  }
  const angulo = (de, para) => Math.atan2(para.yCurvo - de.yCurvo, para.x - de.x);
  const porPonto = new Map();
  for (const l of mapa.ligacoes) for (const k of [l.de, l.para]) porPonto.set(k, [...(porPonto.get(k) ?? []), l]);
  for (const [chave, ls] of porPonto) {
    const de = porChave.get(chave);
    for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
      const outroDe = (l) => porChave.get(l.de === chave ? l.para : l.de);
      let d = Math.abs(angulo(de, outroDe(ls[i])) - angulo(de, outroDe(ls[j])));
      d = Math.min(d, 2 * Math.PI - d);
      if (d < (2 * Math.PI) / 180) problemas.push({ tipo: "sobreposta", ligacao: ls[i], outro: ls[j] });
    }
  }
  const variosSuperiores = new Set(mapa.nos.filter((n) => (n.superiores?.length ?? 0) > 1).map((n) => n.chave));
  const simples = mapa.ligacoes.filter((l) => !variosSuperiores.has(l.de));
  for (let i = 0; i < simples.length; i++) {
    for (let j = i + 1; j < simples.length; j++) {
      const [l, m] = [simples[i], simples[j]];
      if (l.de === m.de || l.de === m.para || l.para === m.de || l.para === m.para) continue;
      if (segmentosSeCruzam(P(porChave.get(l.de)), P(porChave.get(l.para)), P(porChave.get(m.de)), P(porChave.get(m.para)))) problemas.push({ tipo: "cruzamento", ligacao: l, outro: m });
    }
  }
  return problemas;
}

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Faixa útil da vista na altura: a tela cheia (29/10/2026, tarde) põe o título e o menu por cima do alto do mapa, e o
 * conteúdo não deve ficar sob eles ao abrir nem ao mover. `folga.topo` e `folga.base` são os pixels reservados no
 * alto e no pé da vista; sem folga, a vista inteira.
 */
const util = (vista, folga) => ({ w: vista.w, h: Math.max(1, vista.h - (folga?.topo ?? 0) - (folga?.base ?? 0)), topo: folga?.topo ?? 0 });

/** Menor escala: a que mostra o conteúdo inteiro (conteúdo menor que a vista não é obrigado a crescer: no máximo 1). */
export const escalaMinima = ({ conteudo, vista, margem = 24, folga }) => {
  const v = util(vista, folga);
  return Math.min(1, (v.w - 2 * margem) / conteudo.w, (v.h - 2 * margem) / conteudo.h);
};

/**
 * Mantém o movimento e a aproximação dentro do conteúdo, nos dois sentidos: não afasta além de ver o conteúdo
 * inteiro, não aproxima além de `escalaMaxima` e não deixa o conteúdo sair da vista. Conteúdo menor que a vista
 * fica centralizado.
 * @param {{k: number, x: number, y: number}} t  escala e deslocamento (tela = escala × mundo + deslocamento)
 */
export function limitarTransformacao(t, { conteudo, vista, margem = 24, escalaMaxima = 3, folga }) {
  const v = util(vista, folga);
  const minima = Math.min(escalaMinima({ conteudo, vista, margem, folga }), escalaMaxima);
  const k = limitar(t.k, minima, escalaMaxima);
  const eixo = (pos, tamConteudo, tamVista) => {
    const ocupa = tamConteudo * k;
    return ocupa + 2 * margem <= tamVista ? (tamVista - ocupa) / 2 : limitar(pos, tamVista - ocupa - margem, margem);
  };
  return { k, x: eixo(t.x, conteudo.w, v.w), y: eixo(t.y - v.topo, conteudo.h, v.h) + v.topo };
}

/** Vista de abertura e do botão "Centralizar": **todo o conteúdo numa tela**, no meio da faixa útil (no máximo na escala 1). */
export function transformacaoInicial({ conteudo, vista, margem = 24, escalaMaxima = 3, folga }) {
  const v = util(vista, folga);
  const k = escalaMinima({ conteudo, vista, margem, folga });
  return limitarTransformacao({ k, x: (v.w - conteudo.w * k) / 2, y: v.topo + (v.h - conteudo.h * k) / 2 }, { conteudo, vista, margem, escalaMaxima, folga });
}

/**
 * Caminho de um ponto (lote 2, 29/10/2026): ele mesmo, tudo o que ele "vem de" até o topo e tudo o que vem dele até os
 * Planos de Ação, por todas as ligações (um item com dois superiores acende os dois caminhos).
 * @returns {{nos: Set<string>, ligacoes: Set<string>}}  chaves dos pontos e das ligações (`de|para`)
 */
export function caminhoDoNo(mapa, chave) {
  const nos = new Set();
  const ligacoes = new Set();
  if (!mapa.nos.some((n) => n.chave === chave)) return { nos, ligacoes };
  nos.add(chave);
  for (const [lado, seguinte] of [["de", "para"], ["para", "de"]]) {
    const fila = [chave];
    const visto = new Set([chave]);
    while (fila.length) {
      const atual = fila.shift();
      for (const l of mapa.ligacoes) {
        if (l[lado] !== atual) continue;
        ligacoes.add(`${l.de}|${l.para}`);
        nos.add(l[seguinte]);
        if (!visto.has(l[seguinte])) { visto.add(l[seguinte]); fila.push(l[seguinte]); }
      }
    }
  }
  return { nos, ligacoes };
}

/* ---------- cores: contraste do texto sobre cada faixa e estrelas da noite (lote 4, 29/10/2026) ---------- */

/** Lê uma cor CSS já resolvida pelo navegador: `rgb(…)`, `rgba(…)` ou `color(srgb r g b)`. Devolve [r, g, b] de 0 a 255, ou null. */
export function lerCor(texto) {
  const t = String(texto ?? "").trim();
  let m = t.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = t.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (m) return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255];
  m = t.match(/^#([\da-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return null;
}

/** Luminância relativa (WCAG 2.x). */
export function luminancia([r, g, b]) {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Razão de contraste entre duas cores (de 1 a 21). O texto normal pede 4,5 ou mais (WCAG 1.4.3, nível AA). */
export function razaoDeContraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** A tinta (clara ou escura) de maior contraste sobre o fundo. @returns {"clara"|"escura"} */
export function melhorTinta(fundo, clara, escura) {
  return razaoDeContraste(fundo, clara) >= razaoDeContraste(fundo, escura) ? "clara" : "escura";
}

/**
 * Estrelas do tema noite: pontos pequenos, sempre nos mesmos lugares (gerador fixo, sem Math.random), espalhados
 * pelas faixas de cima, onde a noite é mais escura. Cada uma fica dentro da sua faixa, já com a curvatura.
 * @returns {{x: number, y: number, r: number, o: number}[]}
 */
export function estrelasDoMapa(mapa, porFaixaAlta = 14) {
  let semente = 20261029;
  const proximo = () => { semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0; return semente / 4294967296; };
  const altas = mapa.faixas.slice(0, Math.max(1, Math.ceil(mapa.faixas.length / 2)));
  const estrelas = [];
  altas.forEach((f, i) => {
    const quantas = Math.round(porFaixaAlta * (1 - (i / altas.length) * 0.6) * (mapa.largura / 360));
    for (let k = 0; k < quantas; k++) {
      const x = Math.round(proximo() * mapa.largura * 10) / 10;
      const y = f.topo + 3 + proximo() * (f.altura - 6);
      estrelas.push({ x, y: Math.round((y + deslocamentoCurvo(x, mapa.centro, mapa.raio)) * 10) / 10, r: Math.round((0.5 + proximo() * 0.9) * 10) / 10, o: Math.round((0.35 + proximo() * 0.5) * 100) / 100 });
    }
  });
  return estrelas;
}

/* ---------- física (lote 5, 29/10/2026): mola até o destino calculado pelas regras ---------- */

/** Constantes da mola: quase amortecimento crítico (a razão de amortecimento é c ÷ (2 × √k) ≈ 0,97), sem balançar. */
export const MOLA = Object.freeze({ rigidez: 180, amortecimento: 26, distanciaMinima: 1.5, repouso: 0.05, passoMaximo: 0.032 });

/**
 * Um passo da mola de um ponto (uma coordenada): Euler semi-implícito, aceleração = rigidez × (alvo − x) − amortecimento × v.
 * @param {{x: number, v: number}} estado
 * @returns {{x: number, v: number}}
 */
export function passoDaMola({ x, v }, alvo, dt, { rigidez, amortecimento } = MOLA) {
  const v2 = v + (rigidez * (alvo - x) - amortecimento * v) * dt;
  return { x: x + v2 * dt, v: v2 };
}

/** A coordenada está em repouso: perto do alvo e quase parada. */
export const emRepouso = ({ x, v }, alvo) => Math.abs(alvo - x) < MOLA.repouso && Math.abs(v) < MOLA.repouso;

/* ---------- física, parte 2 (lote 5 da passagem da tarde de 29/10/2026): vizinhos que reagem e inércia ---------- */

/** Constantes do puxão: quanto os vizinhos acompanham o ponto puxado e o espaço que os da mesma faixa abrem. */
export const PUXAO = Object.freeze({ ligados: 0.22, ligadosNaAltura: 0.12, raio: 64, abrir: 0.55, folgaNaAltura: 0.35 });

/**
 * Deslocamento dos vizinhos enquanto um ponto é puxado (regra pura): o ponto saiu `dx`, `dy` do seu destino.
 * - os pontos ligados a ele por "vem de" (os superiores e os que vêm dele, um passo só) acompanham uma fração do puxão
 *   (22% na horizontal, 12% na vertical), como presos por um elástico;
 * - os outros pontos da mesma faixa a menos de `raio` unidades da posição de agora abrem espaço, para os lados, tanto
 *   mais quanto mais perto (55% do que falta para o raio).
 * Ao soltar, os deslocamentos voltam a zero, e a mola leva cada ponto de volta ao destino das regras.
 * @returns {Map<string, {dx: number, dy: number}>}  só os pontos que se mexem (o próprio ponto puxado não entra)
 */
export function puxaoDosVizinhos(mapa, chave, dx, dy, c = PUXAO) {
  const saida = new Map();
  const no = mapa.nos.find((n) => n.chave === chave);
  if (!no) return saida;
  const ligados = new Set(mapa.ligacoes.flatMap((l) => (l.de === chave ? [l.para] : l.para === chave ? [l.de] : [])));
  const x = no.x + dx;
  for (const n of mapa.nos) {
    if (n.chave === chave) continue;
    if (ligados.has(n.chave)) { saida.set(n.chave, { dx: dx * c.ligados, dy: dy * c.ligadosNaAltura }); continue; }
    if (n.faixa !== no.faixa) continue;
    const distancia = n.x - x;
    if (Math.abs(distancia) >= c.raio) continue;
    const lado = distancia === 0 ? (n.x >= no.x ? 1 : -1) : Math.sign(distancia);
    saida.set(n.chave, { dx: lado * (c.raio - Math.abs(distancia)) * c.abrir, dy: 0 });
  }
  return saida;
}

/** Altura que o ponto puxado pode ceder dentro da faixa: 35% do puxão, sem sair da faixa (8 unidades de margem). */
export function alturaPuxada(no, faixa, yDoMouse, c = PUXAO) {
  const folga = Math.max(0, faixa.altura / 2 - 8);
  return Math.max(-folga, Math.min(folga, (yDoMouse - no.yCurvo) * c.folgaNaAltura));
}

/** Inércia do mapa ao soltar um arrasto: a velocidade cai pela metade a cada ~0,22 s (tempo característico de 0,32 s). */
export const INERCIA = Object.freeze({ tempo: 0.32, minima: 25, maxima: 4000, partida: 120 });

/**
 * Um passo da inércia (regra pura): a velocidade (px/s) decai exponencialmente; devolve o deslocamento do passo e a
 * velocidade nova. Para abaixo de `INERCIA.minima`.
 * @returns {{dx: number, dy: number, vx: number, vy: number, parou: boolean}}
 */
export function passoDaInercia({ vx, vy }, dt, c = INERCIA) {
  const fator = Math.exp(-dt / c.tempo);
  const [nx, ny] = [vx * fator, vy * fator];
  const dx = (vx - nx) * c.tempo; // integral exata da velocidade no passo
  const dy = (vy - ny) * c.tempo;
  return { dx, dy, vx: nx, vy: ny, parou: Math.hypot(nx, ny) < c.minima };
}

/** Velocidade de partida da inércia, limitada; abaixo de `INERCIA.partida`, não há inércia (o arrasto parou antes de soltar). */
export function velocidadeDeSaida({ vx, vy }, c = INERCIA) {
  const v = Math.hypot(vx, vy);
  if (!(v >= c.partida)) return null;
  const f = Math.min(1, c.maxima / v);
  return { vx: vx * f, vy: vy * f };
}

