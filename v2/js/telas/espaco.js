/**
 * Espaço aberto: por enquanto (passo 1.4), um resumo calculado, para conferir o
 * cálculo na tela. A lista de ações substitui este resumo no passo 1.6.
 */
import { criarCalendario } from "../calendario.js";
import { caminhoCritico } from "../calculo.js";
import { simular } from "../simulacao.js";
import { ICONES } from "../icones.js";

const dataBr = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * @param {HTMLElement} alvo
 * @param {object} espaco
 * @param {object[]} acoes
 * @param {{hoje: string}} opcoes
 */
export function mostrarEspaco(alvo, espaco, acoes, { hoje }) {
  const cal = criarCalendario(espaco, hoje);
  let resumo = "";
  if (acoes.length) {
    const r = caminhoCritico(acoes, cal, { hoje });
    const inicio = performance.now();
    const s = simular(acoes, cal, { hoje, semente: espaco.semente, simulacoes: espaco.simulacoes, prazoFinal: espaco.prazoFinal });
    const tempo = Math.round(performance.now() - inicio);
    const contar = (situacao) => [...r.porAcao.values()].filter((x) => x.situacao === situacao).length;
    const atrasadas = [...r.porAcao.values()].filter((x) => x.atrasada).length;
    resumo = `
      <ul class="situacoes">
        <li><span class="icone-concluida">${ICONES.concluida}</span>${contar("concluida")} concluídas</li>
        <li><span class="icone-liberada">${ICONES.liberada}</span>${contar("liberada")} liberadas</li>
        <li><span class="icone-nao-liberada">${ICONES.naoLiberada}</span>${contar("naoLiberada")} não liberadas</li>
        <li><span class="icone-atrasada">${ICONES.atrasada}</span>${atrasadas} atrasada${atrasadas === 1 ? "" : "s"}</li>
      </ul>
      <dl class="numeros">
        <div><dt>Conclusão prevista</dt><dd>${dataBr(cal.dataDeConclusao(s.p50, 0))}</dd></div>
        <div><dt>Data segura <small>(80% de chance)</small> <a href="#" class="oque" data-termo="dataSegura">o que é?</a></dt><dd>${dataBr(cal.dataDeConclusao(s.p80, 0))}</dd></div>
        <div><dt>Prazo final</dt><dd>${dataBr(espaco.prazoFinal)}</dd></div>
        <div><dt>Chance de cumprir o prazo</dt><dd>${s.chancePrazo == null ? "—" : Math.round(s.chancePrazo * 100) + "%"}</dd></div>
      </dl>
      <p class="tec">Simulação de ${espaco.simulacoes.toLocaleString("pt-BR")} cenários calculada em ${tempo} ms neste aparelho.</p>`;
  } else {
    resumo = `<p>Este espaço ainda não tem ações. O cadastro de ações chega nos próximos passos.</p>`;
  }
  alvo.innerHTML = `
    <section class="cartao">
      <h1>${esc(espaco.nome)}</h1>
      <p class="tec">Início em ${dataBr(espaco.inicio)}${espaco.prazoFinal ? ` · prazo final em ${dataBr(espaco.prazoFinal)}` : ""}</p>
      ${resumo}
      <p class="aviso">Resumo provisório, para conferir o cálculo. A lista de ações chega no passo 1.6.</p>
    </section>`;
}
