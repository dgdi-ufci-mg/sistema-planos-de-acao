/**
 * Regras da janela da ação (especificação, seções 5.3, 5.4 e 8.3), sem tela, para serem testadas.
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

/** Códigos das ações que dependem de `codigo`, direta ou indiretamente. */
export function dependentes(acoes, codigo) {
  const seguintes = new Map(acoes.map((a) => [a.codigo, []]));
  for (const a of acoes) for (const d of a.dependeDe ?? []) seguintes.get(d)?.push(a.codigo);
  const achados = new Set();
  const visitar = (c) => {
    for (const s of seguintes.get(c) ?? []) if (!achados.has(s)) { achados.add(s); visitar(s); }
  };
  visitar(codigo);
  return achados;
}

/** Ações que podem virar anteriores de `codigo`: nem ela, nem as que já são, nem as que dependem dela (sem ciclos). */
export function anterioresPossiveis(acoes, codigo) {
  const acao = acoes.find((a) => a.codigo === codigo);
  const fora = new Set([codigo, ...(acao?.dependeDe ?? []), ...dependentes(acoes, codigo)]);
  return acoes.filter((a) => !fora.has(a.codigo));
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
 * @returns {{anteriores: string[], dataMinima: string|null}}
 */
export function pendencias(acao, acoes, hoje) {
  const porCodigo = new Map(acoes.map((a) => [a.codigo, a]));
  return {
    anteriores: (acao.dependeDe ?? []).filter((c) => porCodigo.has(c) && !porCodigo.get(c).concluidaEm),
    dataMinima: acao.naoAntesDe && acao.naoAntesDe > hoje ? acao.naoAntesDe : null,
  };
}
