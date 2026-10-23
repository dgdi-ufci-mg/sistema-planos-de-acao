/**
 * Escolha do tipo do espaço (passo 2.4a), usada na criação e em "Configurar este espaço":
 * Plano de Ação ou Projeto, com a explicação de cada um. No Plano de Ação, aparecem o Programa
 * (texto livre até o catálogo do passo 2.5) e o documento que o aprovou.
 */
import { esc } from "../formato.js";
import { TIPOS, tipoDe } from "../tipos.js";
import { abrirSuave, fecharSuave } from "./movimento.js";

/** Campos do tipo, dentro de um formulário. */
export function tipoHtml(espaco = {}) {
  const atual = tipoDe(espaco);
  return `<fieldset class="tipo-espaco" data-tipo-espaco>
      <legend>Tipo</legend>
      <div class="tipo-opcoes">${Object.entries(TIPOS).map(([v, t]) => `
        <label class="tipo-opcao"><input type="radio" name="tipo" value="${v}"${v === atual ? " checked" : ""}>
          <span><b>${t.nome}</b><small>${t.explicacao}</small></span></label>`).join("")}</div>
      <div class="tipo-plano" data-tipo-plano${atual === "planoDeAcao" ? "" : " hidden"}>
        <label class="campo"><span>Programa do PEI/PDI</span>
          <input name="programa" maxlength="200" value="${esc(espaco.programa ?? "")}" placeholder="Programa que prevê este Plano de Ação"></label>
        <div class="campos-lado-a-lado">
          <label class="campo"><span>Documento de aprovação</span>
            <input name="aprovacaoIdentificacao" maxlength="120" value="${esc(espaco.aprovacao?.identificacao ?? "")}" placeholder="Número no SIPAC ou no Protocolo"></label>
          <label class="campo"><span>Link do documento <small>(opcional)</small></span>
            <input name="aprovacaoLink" type="url" maxlength="500" value="${esc(espaco.aprovacao?.link ?? "")}" placeholder="https://"></label>
        </div>
        <p class="tec">Por enquanto, o Programa é digitado. Quando o catálogo do PEI/PDI existir, ele será escolhido numa lista.</p>
      </div>
    </fieldset>`;
}

/** Mostra ou esconde os campos do Plano de Ação conforme o tipo marcado. */
export function ligarTipo(form) {
  form.addEventListener("change", (e) => {
    if (e.target.name !== "tipo") return;
    const plano = form.querySelector("[data-tipo-plano]");
    plano.getAnimations().forEach((a) => a.cancel()); // o fechamento fica parado no fim; sem isto, a reabertura voltaria a ele
    if (e.target.value === "planoDeAcao") { plano.hidden = false; abrirSuave(plano); }
    else fecharSuave(plano).then(() => {
      if (form.querySelector('[name="tipo"]:checked')?.value === "planoDeAcao") return;
      plano.hidden = true;
      plano.getAnimations().forEach((a) => a.cancel());
    });
  });
}

/**
 * Lê os campos do tipo para gravar. No Projeto, Programa e aprovação são apagados (null).
 * @param {HTMLFormElement} form
 */
export function lerTipo(form) {
  const f = new FormData(form);
  const tipo = String(f.get("tipo") || "projeto");
  if (tipo !== "planoDeAcao") return { tipo, programa: null, aprovacao: null };
  const identificacao = String(f.get("aprovacaoIdentificacao") ?? "").trim();
  const link = String(f.get("aprovacaoLink") ?? "").trim();
  return {
    tipo,
    programa: String(f.get("programa") ?? "").trim(),
    aprovacao: identificacao || link ? { identificacao, ...(link ? { link } : {}) } : null,
  };
}
