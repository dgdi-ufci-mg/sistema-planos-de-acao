/**
 * Palavras da tela que mudam conforme o tipo do espaço (seção 16.1; passo 3.1): no Plano de Ação e no Projeto,
 * o item do espaço é a **ação**; no Quadro de tarefas, a **tarefa**. A entidade, os campos e o banco são os mesmos
 * (`acao`, seção 4.2). As duas palavras são femininas, então artigos e adjetivos não mudam ("nova", "concluída").
 */
import { ehDeTarefas } from "./tipos.js";

/**
 * @param {object|null|undefined} espaco
 * @returns {{acao: string, Acao: string, acoes: string, Acoes: string}}
 */
export function termos(espaco) {
  return ehDeTarefas(espaco)
    ? { acao: "tarefa", Acao: "Tarefa", acoes: "tarefas", Acoes: "Tarefas" }
    : { acao: "ação", Acao: "Ação", acoes: "ações", Acoes: "Ações" };
}
