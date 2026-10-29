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
 * - **Posição horizontal**: a largura do mapa é a da área (tudo cabe numa tela) e só cresce se a faixa mais cheia
 *   não couber com os pontos a 26 unidades de distância. Cada ponto procura ficar sob a média dos pontos a que se
 *   liga (as linhas ficam quase na vertical). O nome fica à direita do ponto; faixa cheia alterna os pontos em até 4
 *   níveis (degrau vertical) e corta com reticências o nome que ainda assim não couber.
 * - **Ligações**: retas. Duas linhas do mesmo ponto nunca saem na mesma direção, e nenhuma passa rente a outro ponto.
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

/** Deslocamento para baixo, na posição x, da curva de raio `raio` com o ponto mais alto em `centro`. */
export const deslocamentoCurvo = (x, centro, raio) => ((x - centro) * (x - centro)) / (2 * raio);

/**
 * Faixas do mapa: as camadas do catálogo na ordem dele, menos as opcionais sem itens, e a dos Planos de Ação.
 * @param {object[]} camadas
 * @param {object[]} itens  itens ativos que vão aparecer
 * @returns {{id: string, nome: string, plural: string, opcional: boolean}[]}
 */
export function faixasDoMapa(camadas, itens) {
  const faixas = camadas
    .filter((c) => !c.opcional || itens.some((x) => x.camada === c.id))
    .map((c) => ({ id: c.id, nome: c.nome, plural: c.plural, opcional: Boolean(c.opcional) }));
  faixas.push({ id: FAIXA_PLANOS, nome: "Plano de Ação", plural: "Planos de Ação", opcional: false });
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
 * @param {number} [p.passoNivel]  degrau vertical entre pontos vizinhos de uma faixa que precisa de mais de um nível
 * @param {number} [p.niveisMaximos]  degraus para os nomes caberem lado a lado
 * @param {number} [p.fileirasMaximas]  fileiras de uma faixa cheia demais para uma só (lote 4: a faixa cresce para baixo, e não para os lados)
 * @param {number} [p.raioPorLargura]  raio da curva, em larguras do mapa
 * @param {Record<string, string[]>} [p.ordemPessoal]  ordem escolhida pela pessoa (lote 6): para cada camada, as chaves dos pontos, da esquerda para a direita
 */
export function calcularMapa({
  camadas, itens, planos = [], medir = (t) => t.length * 7, vista = { w: 960, h: 560 },
  margem = 28, espacoMinimo = 26, passoNivel = 19, niveisMaximos = 4, fileirasMaximas = 8, raioPorLargura = 4, ordemPessoal = {},
}) {
  const ativos = itens.filter((x) => !x.excluidoEm);
  const faixas = faixasDoMapa(camadas, ativos);
  const indiceDaFaixa = new Map(faixas.map((f, i) => [f.id, i]));
  const idsDosItens = new Set(ativos.map((x) => x.id));

  /* pontos: itens por código e nome; depois os Planos de Ação por nome */
  const nos = [];
  for (const x of [...ativos].sort(porCodigoENome)) {
    const faixa = indiceDaFaixa.get(x.camada);
    if (faixa == null) continue;
    nos.push({
      chave: x.id, id: x.id, tipo: "item", faixa, codigo: x.codigo ?? "", nome: x.nome, restrito: false,
      superiores: (x.superiores ?? []).filter((s) => idsDosItens.has(s)),
    });
  }
  for (const e of [...planos].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))) {
    const ligados = (e.superiores ?? []).filter((s) => idsDosItens.has(s));
    if ((e.superiores ?? []).length && !ligados.length) continue; // só liga a itens que não aparecem: não aparece
    nos.push({
      chave: `plano:${e.id}`, id: e.id, tipo: "plano", faixa: faixas.length - 1, codigo: "", nome: e.nome, restrito: Boolean(e.restrito), superiores: ligados,
    });
  }
  const porChave = new Map(nos.map((n) => [n.chave, n]));
  const ligacoes = nos.flatMap((n) => n.superiores.map((s) => ({ de: n.chave, para: s })));
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
  /* ordem pessoal (lote 6): vale depois das passadas; os pontos que ela não conhece (itens novos) vão ao fim, na ordem automática */
  faixas.forEach((f, i) => {
    const salva = ordemPessoal?.[f.id];
    if (!Array.isArray(salva) || !salva.length) return;
    const lugar = new Map(salva.map((k, j) => [k, j]));
    const antes = new Map(lista[i].map((n, j) => [n.chave, j]));
    lista[i].sort((a, b) => (lugar.get(a.chave) ?? Infinity) - (lugar.get(b.chave) ?? Infinity) || antes.get(a.chave) - antes.get(b.chave));
    numerar(lista[i]);
  });

  /* largura: a da área (para tudo caber numa tela). A faixa cheia demais para uma fileira, com os pontos a 26 de
     distância, cresce para baixo, em fileiras (lote 4, 29/10/2026, tarde): até 8; a largura só cresce se nem 8 bastarem */
  const RECUO = 9; // do ponto até o começo do nome
  const reservaFinal = 60; // espaço para o nome do último ponto
  const maisCheia = Math.max(1, ...lista.map((l) => l.length));
  const largura = Math.ceil(Math.max(vista.w, 2 * margem + reservaFinal + ((maisCheia - 1) * espacoMinimo) / fileirasMaximas));
  const xMin = margem;
  const xMax = largura - margem - reservaFinal;
  /* fileiras de cada faixa pelos pontos: a menor quantidade que deixa 26 entre vizinhos da mesma fileira */
  for (const l of lista) l.fileiras = l.length > 1 ? Math.min(fileirasMaximas, Math.max(1, Math.ceil(((l.length - 1) * espacoMinimo) / Math.max(1, xMax - xMin) - 1e-9))) : 1;

  /* posição: começa pela ordem; depois, para baixo e para cima, cada ponto tenta ficar sob (ou sobre) a média dos
     pontos a que se liga, sem passar do vizinho (as linhas ficam quase na vertical e se cruzam menos) */
  for (const l of lista) for (const n of l) n.x = xMin + n.posicao * (xMax - xMin);
  /* vizinhos seguidos ficam em fileiras diferentes: a distância mínima entre eles é 26 ÷ fileiras */
  const afastar = (l) => {
    if (!l.length) return;
    const passo = espacoMinimo / l.fileiras;
    l.forEach((n) => { n.x = Math.min(xMax, Math.max(xMin, n.x)); });
    for (let i = 1; i < l.length; i++) l[i].x = Math.max(l[i].x, l[i - 1].x + passo);
    l[l.length - 1].x = Math.min(l[l.length - 1].x, xMax);
    for (let i = l.length - 2; i >= 0; i--) l[i].x = Math.min(l[i].x, l[i + 1].x - passo);
  };
  /* só um puxão suave (30%): puxar tudo para a média juntaria os pontos no meio da faixa */
  const media = (chaves, atual) => (chaves.length ? 0.7 * atual + 0.3 * (chaves.reduce((s2, k) => s2 + porChave.get(k).x, 0) / chaves.length) : atual);
  const paraBaixo = () => { for (let i = 1; i < lista.length; i++) { lista[i].forEach((n) => { n.x = media(n.superiores, n.x); }); afastar(lista[i]); } };
  const paraCima = () => { for (let i = lista.length - 2; i >= 0; i--) { lista[i].forEach((n) => { n.x = media(subordinados.get(n.chave) ?? [], n.x); }); afastar(lista[i]); } };
  lista.forEach(afastar);
  paraBaixo(); paraCima(); paraBaixo();
  for (const n of nos) n.x = Math.round(n.x * 10) / 10;

  /* nomes: à direita do ponto; quando não cabem lado a lado, os pontos da faixa se alternam em até 4 níveis
     (um pequeno degrau vertical); o que ainda não couber é cortado com reticências */
  const ajustar = (texto, disponivel) => {
    if (medir(texto) <= disponivel) return texto;
    let ate = texto.length - 1;
    while (ate > 1 && medir(`${texto.slice(0, ate).trimEnd()}…`) > disponivel) ate--;
    return ate > 1 && medir(`${texto.slice(0, ate).trimEnd()}…`) <= disponivel ? `${texto.slice(0, ate).trimEnd()}…` : "";
  };
  const limiteDireito = largura - margem / 2;
  const espaco = (l, i, niveis) => (i + niveis < l.length ? l[i + niveis].x - l[i].x - RECUO - 6 : limiteDireito - l[i].x - RECUO);
  for (const n of nos) n.completo = n.tipo === "plano" || !n.codigo ? String(n.nome) : `${n.codigo} · ${n.nome}`;
  for (const l of lista) {
    const maximo = Math.max(l.fileiras, niveisMaximos);
    let niveis = maximo;
    for (let k = l.fileiras; k <= maximo; k++) {
      if (l.every((n, i) => medir(n.completo) <= espaco(l, i, k))) { niveis = k; break; }
    }
    l.niveis = niveis;
    l.forEach((n, i) => {
      n.nivel = i % niveis;
      n.espacoDoNome = Math.max(0, espaco(l, i, niveis)); // unidades livres à direita do ponto (os rótulos da tela usam)
      n.rotulo = ajustar(n.completo, n.espacoDoNome);
      n.largura = n.rotulo ? medir(n.rotulo) : 0;
    });
  }

  /* altura e curvatura: cada faixa tem a altura dos seus níveis */
  const centro = largura / 2;
  const raio = raioPorLargura * largura;
  const alturaMinima = Math.min(72, Math.max(52, (vista.h - 60) / faixas.length)); // área baixa (celular): faixas mais baixas
  let topo = 0;
  faixas.forEach((f, i) => {
    f.niveis = lista[i].niveis ?? 1;
    f.altura = Math.max(alturaMinima, 40 + f.niveis * passoNivel);
    f.topo = topo; f.base = topo + f.altura; topo = f.base;
    f.nos = lista[i].map((n) => n.chave);
  });
  for (const n of nos) {
    const f = faixas[n.faixa];
    n.y = f.topo + f.altura / 2 + (n.nivel - (f.niveis - 1) / 2) * passoNivel;
    n.yCurvo = Math.round((n.y + deslocamentoCurvo(n.x, centro, raio)) * 10) / 10;
  }
  const altura = Math.ceil(topo + deslocamentoCurvo(0, centro, raio));
  return { faixas, nos, ligacoes, largura, altura, centro, raio, recuo: RECUO };
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

/** Linha entre um ponto e o que ele "vem de": reta (duas linhas do mesmo ponto nunca se sobrepõem, só se separam). */
export const caminhoDaLigacao = (filho, superior) => `M${filho.x} ${filho.yCurvo} L${superior.x} ${superior.yCurvo}`;

const distanciaAoSegmento = (p, a, b) => {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
};

/**
 * Confere as linhas do mapa: devolve as que passam rente a um ponto que não é delas (`folga` unidades) e os pares de
 * linhas do mesmo ponto que saem quase na mesma direção (menos de 2°), isto é, que se sobrepõem.
 * @returns {{tipo: "ponto"|"sobreposta", ligacao: object, outro: object}[]}
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
