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
 * - **Posição horizontal**: proporcional à ordem e afastada pela largura medida de cada nome. A largura do mapa
 *   cresce com o número de itens.
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
 * @param {number} [p.alturaFaixa]
 * @param {number} [p.margem]  espaço nas pontas de cada faixa
 * @param {number} [p.folga]  espaço mínimo entre dois nomes
 * @param {number} [p.raioPorLargura]  raio da curva, em larguras do mapa
 * @param {number} [p.larguraMinima]
 */
export function calcularMapa({
  camadas, itens, planos = [], medir = (t) => t.length * 7,
  alturaFaixa = 96, margem = 44, folga = 18, raioPorLargura = 3, larguraMinima = 640,
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

  /* largura: a maior faixa manda; cada ponto ocupa a largura do nome */
  for (const n of nos) {
    n.rotulo = rotuloDoPonto(n.codigo, n.nome);
    n.largura = Math.max(24, medir(n.rotulo));
  }
  const precisa = (l) => 2 * margem + l.reduce((s, n) => s + n.largura, 0) + folga * Math.max(0, l.length - 1);
  const largura = Math.ceil(Math.max(larguraMinima, ...lista.map(precisa)));
  for (const l of lista) {
    if (!l.length) continue;
    const d = (i) => (l[i].largura + l[i + 1].largura) / 2 + folga;
    for (const n of l) n.x = n.posicao * largura;
    l[0].x = Math.max(l[0].x, margem + l[0].largura / 2);
    for (let i = 1; i < l.length; i++) l[i].x = Math.max(l[i].x, l[i - 1].x + d(i - 1));
    const ultimo = l[l.length - 1];
    ultimo.x = Math.min(ultimo.x, largura - margem - ultimo.largura / 2);
    for (let i = l.length - 2; i >= 0; i--) l[i].x = Math.min(l[i].x, l[i + 1].x - d(i));
    for (const n of l) n.x = Math.round(n.x * 10) / 10;
  }

  /* altura e curvatura */
  const centro = largura / 2;
  const raio = raioPorLargura * largura;
  faixas.forEach((f, i) => { f.topo = i * alturaFaixa; f.base = (i + 1) * alturaFaixa; f.nos = lista[i].map((n) => n.chave); });
  for (const n of nos) {
    n.y = faixas[n.faixa].topo + alturaFaixa * 0.62;
    n.yCurvo = Math.round((n.y + deslocamentoCurvo(n.x, centro, raio)) * 10) / 10;
  }
  const altura = Math.ceil(faixas.length * alturaFaixa + deslocamentoCurvo(0, centro, raio));
  return { faixas, nos, ligacoes, largura, altura, centro, raio, alturaFaixa };
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

/** Linha entre um ponto e o que ele "vem de": curva suave, saindo e chegando na vertical. */
export function caminhoDaLigacao(filho, superior) {
  const meio = (filho.yCurvo + superior.yCurvo) / 2;
  return `M${filho.x} ${filho.yCurvo} C${filho.x} ${n1(meio)} ${superior.x} ${n1(meio)} ${superior.x} ${superior.yCurvo}`;
}

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/** Menor escala: a que mostra o conteúdo inteiro (conteúdo menor que a vista não é obrigado a crescer: no máximo 1). */
export const escalaMinima = ({ conteudo, vista, margem = 24 }) =>
  Math.min(1, (vista.w - 2 * margem) / conteudo.w, (vista.h - 2 * margem) / conteudo.h);

/**
 * Mantém o movimento e a aproximação dentro do conteúdo, nos dois sentidos: não afasta além de ver o conteúdo
 * inteiro, não aproxima além de `escalaMaxima` e não deixa o conteúdo sair da vista. Conteúdo menor que a vista
 * fica centralizado.
 * @param {{k: number, x: number, y: number}} t  escala e deslocamento (tela = escala × mundo + deslocamento)
 */
export function limitarTransformacao(t, { conteudo, vista, margem = 24, escalaMaxima = 3 }) {
  const minima = Math.min(escalaMinima({ conteudo, vista, margem }), escalaMaxima);
  const k = limitar(t.k, minima, escalaMaxima);
  const eixo = (pos, tamConteudo, tamVista) => {
    const ocupa = tamConteudo * k;
    return ocupa + 2 * margem <= tamVista ? (tamVista - ocupa) / 2 : limitar(pos, tamVista - ocupa - margem, margem);
  };
  return { k, x: eixo(t.x, conteudo.w, vista.w), y: eixo(t.y, conteudo.h, vista.h) };
}

/** Vista de abertura e do botão "Centralizar": o conteúdo na altura da vista (até a escala 1), no meio. */
export function transformacaoInicial({ conteudo, vista, margem = 24, escalaMaxima = 3 }) {
  const k = Math.min(1, (vista.h - 2 * margem) / conteudo.h);
  return limitarTransformacao({ k, x: (vista.w - conteudo.w * k) / 2, y: (vista.h - conteudo.h * k) / 2 }, { conteudo, vista, margem, escalaMaxima });
}
