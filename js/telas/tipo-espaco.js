/**
 * Escolha do tipo do espaço (passo 2.4a), usada na criação e em "Configurar este espaço":
 * Plano de Ação ou Projeto, com a explicação de cada um. No Plano de Ação, aparecem o Programa e o
 * documento que o aprovou. O Programa é escolhido no catálogo da estratégia (passo 2.5, parte 3), mantido no
 * módulo Superior; com o catálogo sem Programas vigentes, ou antes de ele carregar, é digitado, como antes.
 */
import { esc } from "../formato.js";
import { TIPOS, tipoDe } from "../tipos.js";
import { abrirSuave, fecharSuave } from "./movimento.js";
import { opcoesDePrograma, caminhoAteOTopo, rotuloDoItem } from "../estrategia.js";
import { hojeLocal } from "../dados.js";

/** Campos do tipo, dentro de um formulário. */
export function tipoHtml(espaco = {}) {
  const atual = tipoDe(espaco);
  return `<fieldset class="tipo-espaco" data-tipo-espaco>
      <legend>Tipo</legend>
      <div class="tipo-opcoes">${Object.entries(TIPOS).map(([v, t]) => `
        <label class="tipo-opcao"><input type="radio" name="tipo" value="${v}"${v === atual ? " checked" : ""}>
          <span><b>${t.nome}</b><small>${t.explicacao}</small></span></label>`).join("")}</div>
      <div class="tipo-plano" data-tipo-plano${atual === "planoDeAcao" ? "" : " hidden"}>
        <div data-campo-programa>${programaTextoHtml(espaco)}</div>
        <div class="campos-lado-a-lado">
          <label class="campo"><span>Documento de aprovação</span>
            <input name="aprovacaoIdentificacao" maxlength="120" value="${esc(espaco.aprovacao?.identificacao ?? "")}" placeholder="Número no SIPAC ou no Protocolo"></label>
          <label class="campo"><span>Link do documento <small>(opcional)</small></span>
            <input name="aprovacaoLink" type="url" maxlength="500" value="${esc(espaco.aprovacao?.link ?? "")}" placeholder="https://"></label>
        </div>
      </div>
    </fieldset>`;
}

/** Programa digitado: catálogo sem Programas vigentes, ou ainda carregando. */
function programaTextoHtml(espaco) {
  return `<label class="campo"><span>Programa do PEI/PDI</span>
      <input name="programa" maxlength="200" value="${esc(espaco.programa ?? "")}" placeholder="Programa que prevê este Plano de Ação"></label>`;
}

/** Programa escolhido no catálogo; um texto livre antigo continua como opção até ser trocado. */
function programaCatalogoHtml(espaco, opcoes) {
  const atual = espaco.vinculos?.[0] ?? (espaco.programa?.trim() ? "texto" : "");
  return `<label class="campo"><span>Programa do PEI/PDI</span>
      <select name="vinculo" data-vinculo>
        ${atual === "" ? '<option value="" selected>Escolha o Programa</option>' : ""}
        ${atual === "texto" ? `<option value="texto" selected>Digitado antes do catálogo: ${esc(espaco.programa.trim())}</option>` : ""}
        ${opcoes.map((x) => `<option value="${esc(x.id)}"${x.id === atual ? " selected" : ""}>${esc(rotuloDoItem(x))}</option>`).join("")}
      </select></label>
    ${atual === "texto" ? `<input type="hidden" name="programa" value="${esc(espaco.programa.trim())}">` : ""}
    <p class="tec" data-caminho-programa></p>`;
}

/**
 * Troca o Programa digitado pela lista do catálogo, quando ele tem Programas vigentes.
 * @param {HTMLFormElement} form
 * @param {{store: object, espaco?: object}} opcoes
 */
async function carregarProgramas(form, { store, espaco = {} }) {
  const lugar = form.querySelector("[data-campo-programa]");
  let catalogo;
  try { catalogo = await store.lerCatalogo(); } catch { return; }
  const opcoes = opcoesDePrograma(catalogo, hojeLocal(), espaco.vinculos ?? []);
  if (!opcoes.length || !lugar.isConnected) return;
  const digitado = lugar.querySelector('[name="programa"]')?.value;
  lugar.innerHTML = programaCatalogoHtml({ ...espaco, programa: espaco.vinculos?.length ? espaco.programa : (digitado ?? espaco.programa) }, opcoes);
  const select = lugar.querySelector("[data-vinculo]");
  const caminho = lugar.querySelector("[data-caminho-programa]");
  const mostrarCaminho = () => {
    const item = catalogo.itens.find((x) => x.id === select.value);
    caminho.textContent = item
      ? caminhoAteOTopo(item, catalogo.itens).slice(0, -1).map(rotuloDoItem).join(" › ")
      : select.value === "texto" ? "Programa digitado antes do catálogo. Escolha o do catálogo para ligar este plano ao PEI/PDI." : "Programas do catálogo do PEI/PDI, mantido no módulo Superior.";
  };
  select.addEventListener("change", mostrarCaminho);
  mostrarCaminho();
}

/**
 * Mostra ou esconde os campos do Plano de Ação conforme o tipo marcado e, com o `store`, oferece os Programas
 * do catálogo.
 * @param {HTMLFormElement} form
 * @param {{store?: object, espaco?: object}} [catalogo]
 */
export function ligarTipo(form, catalogo = {}) {
  if (catalogo.store) carregarProgramas(form, catalogo);
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
 * Lê os campos do tipo para gravar. No Projeto, Programa, vínculos e aprovação são apagados (null).
 * @param {HTMLFormElement} form
 */
export function lerTipo(form) {
  const f = new FormData(form);
  const tipo = String(f.get("tipo") || "projeto");
  if (tipo !== "planoDeAcao") return { tipo, programa: null, vinculos: null, aprovacao: null };
  const identificacao = String(f.get("aprovacaoIdentificacao") ?? "").trim();
  const link = String(f.get("aprovacaoLink") ?? "").trim();
  /* Programa do catálogo (vinculos) ou digitado (programa); um apaga o outro */
  const vinculo = f.get("vinculo");
  const doCatalogo = vinculo && vinculo !== "texto";
  return {
    tipo,
    programa: doCatalogo ? null : String(f.get("programa") ?? "").trim(),
    vinculos: doCatalogo ? [String(vinculo)] : null,
    aprovacao: identificacao || link ? { identificacao, ...(link ? { link } : {}) } : null,
  };
}
