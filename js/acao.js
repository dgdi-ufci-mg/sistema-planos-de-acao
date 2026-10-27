/**
 * Regras da janela da ação (documentação técnica, seções 5.3, 5.4 e 8.3), sem tela, para serem testadas.
 */
import { duracaoPert } from "./calculo.js";

/**
 * A estimativa pode ser ajustada sem histórico? Sim enquanto a ação não está liberada
 * (ainda é planejamento) e, na ação liberada, só para corrigir a digitação no mesmo dia
 * em que a única estimativa foi feita (seção 4.3). Sem estimativa, sempre (é a primeira).
 */
export function estimativaLivre(acao, situacao, hoje) {
  if (situacao === "concluida") return false;
  const lista = acao.estimativas ?? [];
  if (!lista.length || situacao === "naoLiberada") return true;
  return lista.length === 1 && lista[0].em === hoje;
}

/** Números das ações que dependem da ação `numero`, direta ou indiretamente. */
export function dependentes(acoes, numero) {
  const seguintes = new Map(acoes.map((a) => [a.numero, []]));
  for (const a of acoes) for (const d of a.dependeDe ?? []) seguintes.get(d)?.push(a.numero);
  const achados = new Set();
  const visitar = (c) => {
    for (const s of seguintes.get(c) ?? []) if (!achados.has(s)) { achados.add(s); visitar(s); }
  };
  visitar(numero);
  return achados;
}

/** Ações que podem virar anteriores da ação `numero`: nem ela, nem as que já são, nem as que dependem dela (sem ciclos). */
export function anterioresPossiveis(acoes, numero) {
  const acao = acoes.find((a) => a.numero === numero);
  const fora = new Set([numero, ...(acao?.dependeDe ?? []), ...dependentes(acoes, numero)]);
  return acoes.filter((a) => !fora.has(a.numero));
}

/** Texto sem acentos e em minúsculas, para a busca. */
export const normalizar = (texto) => String(texto ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Itens em que algum dos textos contém a busca (sem diferenciar acentos e maiúsculas). */
export function buscar(itens, busca, textosDe) {
  const b = normalizar(busca).trim();
  if (!b) return itens;
  return itens.filter((item) => textosDe(item).some((t) => normalizar(t).includes(b)));
}

/**
 * Resumo do histórico de estimativas (seção 5.3): estimativa original, reprogramações e
 * quanto o término andou, em dias úteis, desde a primeira estimativa.
 * @param {object} acao
 * @param {{liberacao: number, conclusao: number}} calculada  resultado de caminhoCritico para a ação
 */
export function resumoDasEstimativas(acao, calculada) {
  const lista = acao.estimativas ?? [];
  if (!lista.length) return null;
  const original = duracaoPert(lista[0]);
  return {
    original,
    reprogramacoes: lista.length - 1,
    deslocamento: Math.round(calculada.conclusao - (calculada.liberacao + original)),
  };
}

/**
 * O que falta para uma ação não liberada ser liberada: anteriores não concluídas e data mínima por vir.
 * @returns {{anteriores: number[], dataMinima: string|null}}
 */
export function pendencias(acao, acoes, hoje) {
  const porNumero = new Map(acoes.map((a) => [a.numero, a]));
  return {
    anteriores: (acao.dependeDe ?? []).filter((c) => porNumero.has(c) && !porNumero.get(c).concluidaEm && !porNumero.get(c).conclusaoMarcadaEm),
    dataMinima: acao.naoAntesDe && acao.naoAntesDe > hoje ? acao.naoAntesDe : null,
  };
}

/* ---------- código mnemônico, opcional (seções 4.2 e 8.3) ---------- */
const PALAVRAS_VAZIAS = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "para", "com", "por", "um", "uma", "ao", "aos"]);

/** O que a pessoa digitou no código, em maiúsculas e sem acentos, espaços ou sinais. */
export const normalizarCodigo = (texto) => normalizar(texto).toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Problema do código, ou "" se ele serve: de 2 a 8 letras ou números e livre no espaço. */
export function problemaDoCodigo(codigo, existentes) {
  if (!/^[A-Z0-9]{2,8}$/.test(codigo)) return "Use de 2 a 8 letras ou números, sem espaços.";
  if (existentes.includes(codigo)) return `Já existe uma ação com o código ${codigo}.`;
  return "";
}

/**
 * Código sugerido a partir do rótulo: as iniciais das três primeiras palavras que contam
 * ("Publicar o edital de seleção" → PES); se estiver ocupado, as duas primeiras letras e um número (PE2).
 */
export function sugerirCodigo(rotulo, existentes) {
  const palavras = normalizar(rotulo).split(/[^a-z0-9]+/).filter((p) => p && !PALAVRAS_VAZIAS.has(p));
  let base = palavras.slice(0, 3).map((p) => p[0]).join("");
  if (palavras.length && base.length < 3) base = (base + palavras[0].slice(1)).slice(0, 3);
  base = (base || "ACA").toUpperCase().padEnd(3, "X");
  if (!problemaDoCodigo(base, existentes)) return base;
  for (let i = 2; i < 1000; i++) {
    const codigo = base.slice(0, 2) + i;
    if (!problemaDoCodigo(codigo, existentes)) return codigo;
  }
  return null;
}
