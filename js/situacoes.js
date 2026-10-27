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
 *
 * **Quadro de tarefas** (revisão de 27/10/2026, decisão do responsável, como no Trello): as colunas são todas
 * iguais, sem a coluna Concluídas e sem a situação inicial fixa: as colunas são exatamente a lista `situacoes`
 * ("A fazer" é uma delas, renomeável, móvel e retirável). A tarefa fica na coluna em que está, concluída ou não;
 * a sem coluna válida vai para a primeira. A conclusão é uma marca (`conclusaoMarcadaEm`), e não uma data.
 */
import { usaDependencias } from "./modelos.js";
import { tipoDe } from "./tipos.js";

/** Espaço do tipo Quadro de tarefas. */
export const ehQuadro = (espaco) => tipoDe(espaco) === "quadro";

/**
 * A ação está concluída: com data de conclusão (Plano de Ação, Projeto) ou marcada como concluída, sem data
 * (Quadro de tarefas; revisão de 27/10/2026).
 */
export const estaConcluida = (acao) => Boolean(acao?.concluidaEm || acao?.conclusaoMarcadaEm);

/** Colunas do Quadro de tarefas, na ordem, todas editáveis: a lista `situacoes`. */
export const colunasProprias = (espaco) => espaco?.situacoes ?? [];

export const NOME_INICIAL_PADRAO = "A fazer";

/** Nome da situação inicial do espaço. */
export const nomeInicial = (espaco) => (usaDependencias(espaco) ? "Liberada"
  : ehQuadro(espaco) ? colunasProprias(espaco)[0]?.nome ?? NOME_INICIAL_PADRAO /* no quadro, a primeira coluna */
  : espaco?.nomeInicial?.trim() || NOME_INICIAL_PADRAO);

/** Situações personalizadas do espaço, na ordem das colunas do quadro. */
export const personalizadasDe = (espaco) => (ehQuadro(espaco) ? colunasProprias(espaco) : espaco?.situacoes ?? []);

/**
 * Onde a ação está no fluxo: "naoLiberada", "inicial", o id de uma personalizada, ou "concluida".
 * @param {object} acao
 * @param {string} situacao situação calculada (seção 6.1)
 * @param {object} espaco
 */
export function fluxoDe(acao, situacao, espaco) {
  /* no quadro, a tarefa concluída continua na coluna dela; a sem coluna válida vai para a primeira */
  if (ehQuadro(espaco) && situacao !== "naoLiberada") {
    const colunas = colunasProprias(espaco);
    const id = acao.situacaoPersonalizada;
    return (id && colunas.some((s) => s.id === id) ? id : colunas[0]?.id) ?? "inicial";
  }
  if (situacao !== "liberada") return situacao;
  const id = acao.situacaoPersonalizada;
  return id && personalizadasDe(espaco).some((s) => s.id === id) ? id : "inicial";
}

/** Nome do ponto do fluxo, para a tela. */
export function nomeDoFluxo(espaco, fluxo) {
  if (fluxo === "naoLiberada") return "Não liberada";
  if (fluxo === "concluida") return "Concluída";
  if (fluxo === "inicial" && !ehQuadro(espaco)) return nomeInicial(espaco);
  return personalizadasDe(espaco).find((s) => s.id === fluxo)?.nome ?? nomeInicial(espaco);
}

/**
 * Colunas do quadro, na ordem: Não liberadas (só com dependências), a inicial, as personalizadas e Concluídas.
 * @returns {{chave: string, titulo: string}[]}
 */
export function colunasDoQuadro(espaco) {
  if (ehQuadro(espaco)) return colunasProprias(espaco).map((s) => ({ chave: s.id, titulo: s.nome }));
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
  /* Lista de tarefas (passo 3.5): as colunas do quadro só ficam guardadas para a volta; valem as regras do quadro */
  const quadro = ehQuadro(espaco) || tipoDe(espaco) === "lista";
  if (ehQuadro(espaco) && !colunasProprias(espaco).length) return { codigo: "sem-colunas", mensagem: "O quadro precisa de pelo menos uma coluna." };
  /* no quadro, as colunas só não podem repetir o nome entre si (não há Não liberada nem Concluídas) */
  const nomes = new Set(quadro ? [] : [nomeInicial(espaco).toLowerCase(), "não liberada", "concluída"]);
  const ids = new Set();
  for (const s of personalizadasDe(espaco)) {
    if (!s.id || ids.has(s.id)) return { codigo: "id-repetido", mensagem: "Situação com identificador repetido." };
    ids.add(s.id);
    const nome = String(s.nome ?? "").trim();
    if (!nome) return { codigo: "nome-vazio", mensagem: "Toda situação precisa de nome." };
    if (nome.length > 40) return { codigo: "nome-longo", mensagem: `O nome “${nome.slice(0, 40)}…” passa de 40 caracteres.` };
    if (nomes.has(nome.toLowerCase())) return { codigo: "nome-repetido", mensagem: quadro ? `Já existe a coluna “${nome}”.` : `Já existe a situação “${nome}”.` };
    nomes.add(nome.toLowerCase());
  }
  return null;
}
