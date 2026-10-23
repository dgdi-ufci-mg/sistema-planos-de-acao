/**
 * Escolha do modelo do espaço na criação (passo 2.4b; seção 16.1), como a escolha de opções no
 * início de um jogo: Cronograma estruturado, Cronograma aberto ou Personalizado. No personalizado,
 * três escolhas: prazos por estimativa ou por data-limite, dependências e simulação (só com estimativa).
 * Depois de criado, o modelo fica fixo (decisão do responsável, 23/10/2026): "Configurar este espaço"
 * só o mostra.
 */
import { MODELOS, modeloDe, montarModelo } from "../modelos.js";
import { abrirSuave, fecharSuave } from "./movimento.js";

/** Campos do modelo, dentro do formulário de criação. */
export function modeloHtml() {
  return `<fieldset class="tipo-espaco modelo-espaco" data-modelo-espaco>
      <legend>Modelo</legend>
      <div class="tipo-opcoes">${Object.entries(MODELOS).map(([v, m]) => `
        <label class="tipo-opcao"><input type="radio" name="modelo" value="${v}"${v === "estruturado" ? " checked" : ""}>
          <span><b>${m.nome}</b><small>${m.explicacao}</small></span></label>`).join("")}</div>
      <div class="modelo-escolhas" data-modelo-escolhas hidden>
        <div class="escolha" role="radiogroup" aria-label="Prazos das ações">
          <span class="escolha-nome">Prazos das ações</span>
          <label><input type="radio" name="prazos" value="estimativa" checked> Por estimativa <small>(três pontos, com datas previstas)</small></label>
          <label><input type="radio" name="prazos" value="dataLimite"> Por data-limite <small>(opcional, escolhida pela pessoa)</small></label>
        </div>
        <label class="escolha-marca"><input type="checkbox" name="dependencias" checked> Dependências entre ações</label>
        <label class="escolha-marca" data-escolha-simulacao><input type="checkbox" name="simulacao" checked> Simulação <small>(chance de cumprir o prazo, linha do tempo e índices; só com estimativa)</small></label>
      </div>
      <p class="tec">O modelo não muda depois de criado o espaço.</p>
    </fieldset>`;
}

/** Mostra as escolhas do personalizado e desliga a simulação quando os prazos são por data-limite. */
export function ligarModelo(form) {
  const escolhas = form.querySelector("[data-modelo-escolhas]");
  const simulacao = form.querySelector('[name="simulacao"]');
  const ajustarSimulacao = () => {
    const porData = form.querySelector('[name="prazos"]:checked')?.value === "dataLimite";
    simulacao.disabled = porData;
    if (porData) simulacao.checked = false;
    form.querySelector("[data-escolha-simulacao]").classList.toggle("desligada", porData);
  };
  form.addEventListener("change", (e) => {
    if (e.target.name === "prazos") ajustarSimulacao();
    if (e.target.name !== "modelo") return;
    escolhas.getAnimations().forEach((a) => a.cancel());
    if (e.target.value === "personalizado") { escolhas.hidden = false; abrirSuave(escolhas); }
    else if (!escolhas.hidden) fecharSuave(escolhas).then(() => {
      if (form.querySelector('[name="modelo"]:checked')?.value === "personalizado") return;
      escolhas.hidden = true;
      escolhas.getAnimations().forEach((a) => a.cancel());
    });
  });
}

/** O campo `modelo` a gravar. */
export function lerModelo(form) {
  const f = new FormData(form);
  return montarModelo(String(f.get("modelo") || "estruturado"), {
    prazos: String(f.get("prazos") || "estimativa"),
    dependencias: f.get("dependencias") === "on",
    simulacao: f.get("simulacao") === "on",
  });
}

/** Resumo do modelo, só leitura, para "Configurar este espaço". */
export function resumoDoModelo(espaco) {
  const m = modeloDe(espaco);
  const partes = [m.prazos === "estimativa" ? "prazos por estimativa" : "prazos por data-limite",
    m.dependencias ? "com dependências" : "sem dependências", m.simulacao ? "com simulação" : "sem simulação"];
  return `<p class="modelo-resumo"><span class="campo-nome">Modelo</span> <b>${MODELOS[m.nome]?.nome ?? m.nome}</b>: ${partes.join(", ")}.
    <span class="tec">Escolhido na criação; não muda.</span></p>`;
}
