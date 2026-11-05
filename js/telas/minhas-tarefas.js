/**
 * Tela "Minhas tarefas" (documentação técnica, seção 8, "Minhas tarefas"; 05/11/2026): as ações e tarefas atribuídas
 * a quem entrou, de todos os espaços, agrupadas por prazo (regras em js/minhas-tarefas.js). Cada linha mostra o nome,
 * o espaço de origem e o prazo; tocar abre o espaço com a janela da ação ou tarefa.
 */
import { esc, dataBr } from "../formato.js";
import { esqueletoHtml } from "./esqueleto.js";

/** "26/10", ou "26/10/2027" fora do ano de hoje. */
const dataDoPrazo = (iso, hoje) => (iso.slice(0, 4) === hoje.slice(0, 4) ? dataBr(iso).slice(0, 5) : dataBr(iso));

/** Texto do prazo: "até" a data-limite, "previsão" da conclusão prevista. */
function prazoHtml(item, hoje) {
  if (!item.prazo) return "";
  const texto = `${item.tipoDePrazo === "limite" ? "até" : "previsão"} ${dataDoPrazo(item.prazo, hoje)}`;
  return `<span class="minhas-prazo${item.atrasada ? " atrasada" : ""}">${texto}</span>`;
}

function itemHtml(item, hoje) {
  const detalhe = [
    `<span class="minhas-espaco">${esc(item.espacoNome)}</span>`,
    prazoHtml(item, hoje),
    item.naoLiberada ? `<span>não liberada${item.aPartirDe ? `, a partir de ${dataDoPrazo(item.aPartirDe, hoje)}` : ""}</span>` : "",
  ].filter(Boolean).join('<span class="minhas-sep" aria-hidden="true">·</span>');
  return `<li><button type="button" class="minhas-item" data-espaco="${esc(item.espacoId)}" data-numero="${item.numero}">
      <span class="minhas-nome">${esc(item.rotulo)}</span>
      <span class="minhas-detalhe">${detalhe}</span>
    </button></li>`;
}

/** Enquanto lê os espaços: blocos cinza (o título fica na barra do topo, como o nome do espaço). */
export function mostrarCarregandoMinhas(alvo) {
  alvo.innerHTML = `<section class="minhas-tarefas">${esqueletoHtml("lista", 6)}</section>`;
}

/**
 * @param {HTMLElement} alvo
 * @param {{resultado: {grupos: object[], total: number}, hoje: string, aoAbrir: (espacoId: string, numero: number) => void}} opcoes
 */
export function mostrarMinhasTarefas(alvo, { resultado, hoje, aoAbrir }) {
  const { grupos, total } = resultado;
  alvo.innerHTML = `<section class="minhas-tarefas">
    <p class="tec minhas-explica">As ações e tarefas em que você é responsável, de todos os espaços de que participa.</p>
    ${total ? grupos.map((g) => `<section class="minhas-grupo minhas-${g.chave}" aria-labelledby="minhas-${g.chave}">
        <h2 id="minhas-${g.chave}">${g.titulo} <span class="n">${g.itens.length}</span></h2>
        <ul>${g.itens.map((i) => itemHtml(i, hoje)).join("")}</ul>
      </section>`).join("")
    : `<div class="cartao minhas-vazio"><p><b>Nenhuma tarefa sua em aberto.</b></p>
        <p>Quando você for responsável por uma ação ou tarefa, ela aparece aqui, junto com as dos outros espaços.</p></div>`}
  </section>`;
  alvo.querySelector(".minhas-tarefas").addEventListener("click", (e) => {
    const b = e.target.closest(".minhas-item");
    if (b) aoAbrir(b.dataset.espaco, Number(b.dataset.numero));
  });
}
