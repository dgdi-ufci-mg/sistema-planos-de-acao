/**
 * Regras do modo "Editar em planilha" (documentação técnica, seção 8.3), sem tela, para serem testadas:
 * ler e escrever as listas digitadas (dependências e responsáveis) e ler um bloco colado
 * do Google Planilhas ou do Excel.
 */
import { normalizar } from "./acao.js";

const partes = (texto) => String(texto ?? "").split(/[;,\n]/).map((t) => t.trim()).filter(Boolean);

/**
 * Dependências digitadas: números das ações ("3; 5") e, se o espaço usa códigos, também códigos ("LEV; 5").
 * @returns {{numeros: number[], erros: string[]}}
 */
export function lerReferencias(texto, acoes, usaCodigos) {
  const numeros = [];
  const erros = [];
  for (const parte of partes(texto)) {
    const acao = /^\d+$/.test(parte)
      ? acoes.find((a) => a.numero === Number(parte))
      : usaCodigos ? acoes.find((a) => a.codigo && a.codigo === parte.toUpperCase()) : null;
    if (!acao) erros.push(`“${parte}” não é ${usaCodigos ? "número nem código" : "número"} de uma ação deste espaço.`);
    else if (!numeros.includes(acao.numero)) numeros.push(acao.numero);
  }
  return { numeros, erros };
}

/** Dependências para mostrar na célula: códigos, se o espaço usa e a ação tem; senão, números. */
export function escreverReferencias(numeros, acoes, usaCodigos) {
  return (numeros ?? []).map((n) => {
    const a = acoes.find((x) => x.numero === n);
    return usaCodigos && a?.codigo ? a.codigo : String(n);
  }).join("; ");
}

/**
 * Responsáveis digitados: sigla ou nome completo, sem diferenciar acentos e maiúsculas.
 * @returns {{ids: string[], erros: string[]}}
 */
export function lerResponsaveis(texto, responsaveis) {
  const ids = [];
  const erros = [];
  for (const parte of partes(texto)) {
    const p = normalizar(parte);
    const r = responsaveis.find((x) => x.sigla && normalizar(x.sigla) === p) ?? responsaveis.find((x) => normalizar(x.nome) === p);
    if (!r) erros.push(`“${parte}” não é sigla nem nome de um responsável cadastrado.`);
    else if (!ids.includes(r.id)) ids.push(r.id);
  }
  return { ids, erros };
}

/** Responsáveis para mostrar na célula: a sigla ou, sem sigla, o nome. */
export function escreverResponsaveis(ids, responsaveis) {
  return (ids ?? []).map((id) => {
    const r = responsaveis.find((x) => x.id === id);
    return r ? r.sigla || r.nome : "";
  }).filter(Boolean).join("; ");
}

/** O que acrescentar e retirar para passar da lista `antes` para a lista `depois`, item a item (seção 4.6). */
export function diferenca(antes = [], depois = []) {
  return { acrescentar: depois.filter((x) => !antes.includes(x)), retirar: antes.filter((x) => !depois.includes(x)) };
}

/**
 * Bloco colado de uma planilha: linhas separadas por quebra de linha e células por tabulação.
 * Aceita células entre aspas com quebras de linha dentro (como o Google Planilhas e o Excel copiam).
 * @returns {string[][]}
 */
export function lerColagem(texto) {
  const linhas = [];
  let linha = [];
  let celula = "";
  let aspas = false;
  const t = String(texto ?? "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { celula += '"'; i++; }
      else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"' && celula === "") aspas = true;
    else if (c === "\t") { linha.push(celula); celula = ""; }
    else if (c === "\n") { linha.push(celula); linhas.push(linha); linha = []; celula = ""; }
    else celula += c;
  }
  if (celula !== "" || linha.length) { linha.push(celula); linhas.push(linha); }
  return linhas;
}

/** Data digitada na planilha: AAAA-MM-DD ou DD/MM/AAAA; vazio vira null. Devolve undefined se não entender. */
export function lerData(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}

/* ---------- planilha do Sextante no modelo da do Strata (30/10/2026, pedido do responsável; seção 8.3) ---------- */

/**
 * Grupos da planilha por fase e etapa, na ordem da estrutura do espaço. Cada fase traz as suas etapas, e cada etapa as
 * suas ações, na ordem recebida (já filtrada e classificada). Ação sem etapa, ou com etapa que não existe mais, vai para
 * "Sem etapa", no fim. Fases e etapas sem ações ficam de fora.
 * @param {object[]} acoes as ações à vista, na ordem da grade
 * @param {{id: string, nome: string, etapas: {id: string, nome: string}[]}[]} estrutura
 * @returns {{fase: {id: string, nome: string}, etapas: {etapa: {id: string, nome: string}, acoes: object[]}[]}[]}
 */
export function agruparPorFaseEEtapa(acoes, estrutura = []) {
  const conhecidas = new Set(estrutura.flatMap((f) => f.etapas.map((e) => e.id)));
  const grupos = estrutura.map((f) => ({
    fase: { id: f.id, nome: f.nome },
    etapas: f.etapas.map((e) => ({ etapa: { id: e.id, nome: e.nome }, acoes: acoes.filter((a) => a.etapa === e.id) })).filter((g) => g.acoes.length),
  })).filter((g) => g.etapas.length);
  const soltas = acoes.filter((a) => !conhecidas.has(a.etapa));
  if (soltas.length) grupos.push({ fase: { id: "", nome: "Sem etapa" }, etapas: [{ etapa: { id: "", nome: "Sem etapa" }, acoes: soltas }] });
  return grupos;
}

/**
 * Colunas na ordem escolhida pela pessoa: as fixas (número, código e ação) ficam sempre na frente, na ordem delas; as
 * demais seguem `ordem` (chaves); coluna que a ordem não conhece vai para o fim, na ordem de partida; chave que não
 * existe mais é ignorada.
 */
export function ordenarColunas(colunas, ordem = []) {
  const fixas = colunas.filter((c) => c.fixa);
  const resto = colunas.filter((c) => !c.fixa);
  const pos = new Map(ordem.map((k, i) => [k, i]));
  const conhecidas = resto.filter((c) => pos.has(c.chave)).sort((a, b) => pos.get(a.chave) - pos.get(b.chave));
  return [...fixas, ...conhecidas, ...resto.filter((c) => !pos.has(c.chave))];
}

/** Move a coluna `chave` uma posição (`sentido` −1 ou 1) entre as não fixas; devolve a nova ordem (chaves). */
export function moverColuna(colunas, ordem, chave, sentido) {
  const lista = ordenarColunas(colunas, ordem).filter((c) => !c.fixa).map((c) => c.chave);
  const i = lista.indexOf(chave);
  const j = i + sentido;
  if (i < 0 || j < 0 || j >= lista.length) return lista;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista;
}

/** Sem acentos e em minúsculas, para a busca. */
const semAcentos = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A linha passa pela busca? `textos`: os textos das células da linha; busca vazia aceita tudo. */
export function passaNaBusca(textos, busca) {
  const termo = semAcentos(busca).trim();
  return !termo || textos.some((t) => semAcentos(t).includes(termo));
}

/**
 * Desfazer e refazer de uma planilha que grava na hora. Cada passo é uma lista de células (uma, ao sair de uma célula;
 * várias, ao colar um bloco): {numero, chave, antes, depois}, com os valores como texto. Desfazer grava `antes`;
 * refazer grava `depois`. Um passo novo apaga o que havia para refazer. No máximo `limite` passos.
 */
export function criarDesfazer(limite = 100) {
  let feitos = [];
  let desfeitos = [];
  return {
    registrar(celulas) {
      const uteis = (Array.isArray(celulas) ? celulas : [celulas]).filter((c) => String(c.antes ?? "") !== String(c.depois ?? ""));
      if (!uteis.length) return;
      feitos.push(uteis);
      if (feitos.length > limite) feitos.shift();
      desfeitos = [];
    },
    /** @returns {object[]|null} as células a regravar com `antes` */
    desfazer() { const p = feitos.pop(); if (p) desfeitos.push(p); return p ?? null; },
    /** @returns {object[]|null} as células a regravar com `depois` */
    refazer() { const p = desfeitos.pop(); if (p) feitos.push(p); return p ?? null; },
    /** Um passo que não pôde ser regravado volta para onde estava. */
    devolver(passo, refazendo) { if (refazendo) { feitos.pop(); desfeitos.push(passo); } else { desfeitos.pop(); feitos.push(passo); } },
    get podeDesfazer() { return feitos.length > 0; },
    get podeRefazer() { return desfeitos.length > 0; },
  };
}
