/**
 * Partida da versão 2. Por enquanto, só aplica a identidade à página provisória.
 */
import { NOME } from "./identidade.js";

document.title = `${NOME} (versão 2, em construção)`;
document.querySelector("[data-nome]").textContent = NOME;
