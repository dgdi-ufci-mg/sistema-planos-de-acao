/**
 * Situações das ações (documentação técnica, seção 16.2; passo 2.7). Regras puras, sem tela nem banco.
 *
 * A situação calculada continua sendo Não liberada, Liberada ou Concluída (seção 6.1). Dentro de
 * Liberada, o espaço pode ter **situações personalizadas**, como "Em andamento" e "Em teste", que
 * viram colunas do quadro. A ação guarda a personalizada em `situacaoPersonalizada` (o id), que só
 * vale enquanto ela está liberada: fora disso, a ação está na situação calculada.
 *
 * A situação inicial (a Liberada sem personalizada) se chama "Liberada" nos espaços com dependências
 * e, nos demais, "A fazer", com nome editável (`nomeInicial`; decisão do responsável, 23/10/2026).
 */
import { usaDependencias } from "./modelos.js";

export const NOME_INICIAL_PADRAO = "A fazer";

/** Nome da situação inicial do espaço. */
export const nomeInicial = (espaco) => (usaDependencias(espaco) ? "Liberada" : espaco?.nomeInicial?.trim() || NOME_INICIAL_PADRAO);

/** Situações personalizadas do espaço, na ordem das colunas do quadro. */
export const personalizadasDe = (espaco) => espaco?.situacoes ?? [];

/**
 * Onde a ação está no fluxo: "naoLiberada", "inicial", o id de uma personalizada, ou "concluida".
 * @param {object} acao
 * @param {string} situacao situação calculada (seção 6.1)
 * @param {object} espaco
 */
export function fluxoDe(acao, situacao, espaco) {
  if (situacao !== "liberada") return situacao;
  const id = acao.situacaoPersonalizada;
  return id && personalizadasDe(espaco).some((s) => s.id === id) ? id : "inicial";
}

/** Nome do ponto do fluxo, para a tela. */
export function nomeDoFluxo(espaco, fluxo) {
  if (fluxo === "naoLiberada") return "Não liberada";
  if (fluxo === "concluida") return "Concluída";
  if (fluxo === "inicial") return nomeInicial(espaco);
  return personalizadasDe(espaco).find((s) => s.id === fluxo)?.nome ?? nomeInicial(espaco);
}

/**
 * Colunas do quadro, na ordem: Não liberadas (só com dependências), a inicial, as personalizadas e Concluídas.
 * @returns {{chave: string, titulo: string}[]}
 */
export function colunasDoQuadro(espaco) {
  return [
    usaDependencias(espaco) && { chave: "naoLiberada", titulo: "Não liberadas" },
    { chave: "inicial", titulo: usaDependencias(espaco) ? "Liberadas" : nomeInicial(espaco) },
    ...personalizadasDe(espaco).map((s) => ({ chave: s.id, titulo: s.nome })),
    { chave: "concluida", titulo: "Concluídas" },
  ].filter(Boolean);
}

/**
 * Problema da lista de situações ou do nome inicial, ou null.
 * @returns {{codigo: string, mensagem: string}|null}
 */
export function problemaDasSituacoes(espaco) {
  if (espaco.nomeInicial != null && !String(espaco.nomeInicial).trim()) return { codigo: "nome-vazio", mensagem: "Dê um nome à situação inicial." };
  const nomes = new Set([nomeInicial(espaco).toLowerCase(), "não liberada", "concluída"]);
  const ids = new Set();
  for (const s of personalizadasDe(espaco)) {
    if (!s.id || ids.has(s.id)) return { codigo: "id-repetido", mensagem: "Situação com identificador repetido." };
    ids.add(s.id);
    const nome = String(s.nome ?? "").trim();
    if (!nome) return { codigo: "nome-vazio", mensagem: "Toda situação precisa de nome." };
    if (nome.length > 40) return { codigo: "nome-longo", mensagem: `O nome “${nome.slice(0, 40)}…” passa de 40 caracteres.` };
    if (nomes.has(nome.toLowerCase())) return { codigo: "nome-repetido", mensagem: `Já existe a situação “${nome}”.` };
    nomes.add(nome.toLowerCase());
  }
  return null;
}
