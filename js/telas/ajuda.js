/**
 * Ajuda (documentação técnica, seção 8.1): glossário e, no futuro, o manual.
 * Aberta pelo menu do usuário ou pelos links "o que é?" da tela, que destacam o termo.
 */
import { GLOSSARIO } from "../glossario.js";
import { ICONES } from "../icones.js";
import { abrirPainel, fecharPainel } from "./painel.js";
import { NOME, INSTITUICAO } from "../identidade.js";

const CLASSE_DO_ICONE = { concluida: "icone-concluida", liberada: "icone-liberada", naoLiberada: "icone-nao-liberada", atrasada: "icone-atrasada" };

/** @param {{foco?: string, aoVerExemplo: () => void}} opcoes */
export function mostrarAjuda({ foco, aoVerExemplo }) {
  const corpo = abrirPainel("Ajuda", `
    <div class="identidade"><img src="logo.png" alt="" width="32" height="32"><span><b>${NOME}</b><small>${INSTITUICAO}</small></span></div>
    <section>
      <p>Quer ver como funciona? Abra um espaço de exemplo, com dados fictícios.</p>
      <button class="botao" type="button" data-exemplo>Ver um exemplo</button>
    </section>
    <section>
      <h3>Glossário</h3>
      ${GLOSSARIO.map((t) => `
        <div class="termo${t.chave === foco ? " destacado" : ""}" id="termo-${t.chave}">
          <h4>${t.icone ? `<span class="${CLASSE_DO_ICONE[t.icone]}">${ICONES[t.icone]}</span>` : ""}${t.titulo}</h4>
          <p>${t.texto}</p>
          ${t.tecnico ? `<span class="tec">Termo técnico: ${t.tecnico}</span>` : ""}
          ${t.simples ? `<span class="tec">Em palavras simples: ${t.simples}</span>` : ""}
          ${t.formula ? `<div class="termo-formula"><b>Como é calculado</b>${t.formula}</div>` : ""}
          ${t.referencia ? `<p class="termo-fonte"><b>Fonte</b> ${t.referencia}</p>` : ""}
        </div>`).join("")}
      <p class="tec">O manual completo entra aqui quando for refeito.</p>
    </section>`);
  corpo.querySelector("[data-exemplo]").addEventListener("click", () => { fecharPainel(); aoVerExemplo(); });
  if (foco) corpo.querySelector(`#termo-${foco}`)?.scrollIntoView({ block: "center" });
}
