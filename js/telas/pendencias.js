/**
 * Destaque do que ainda não foi salvo nas listas editáveis (datas excluídas, documentos):
 * a linha nova ou alterada fica destacada, e um aviso aparece no pé da lista. Com a gravação
 * automática (24/10/2026), só fica destacada a linha incompleta, que ainda não pode ser gravada
 * (uma data sem o dia, um documento sem nome); o resto é gravado ao sair do campo.
 *
 * O estado da gravação ("Salvando…", "Salvo") aparece no pé de cada seção (`ESTADO_DA_GRAVACAO`,
 * `mostrarEstado`), como na janela da ação.
 */
const assinatura = (item, campos) => campos.map((c) => String(item?.[c] ?? "").trim()).join("|");

/**
 * @param {HTMLElement|null} raiz  formulário da lista
 * @param {object[]} rascunho  itens na tela
 * @param {object[]} salvos  itens gravados
 * @param {string[]} campos  campos comparados
 */
export function marcarPendencias(raiz, rascunho, salvos, campos) {
  if (!raiz) return;
  const gravadas = new Set((salvos ?? []).map((x) => assinatura(x, campos)));
  let pendente = rascunho.length !== (salvos ?? []).length;
  for (const linha of raiz.querySelectorAll("[data-linha-lista]")) {
    const alterada = !gravadas.has(assinatura(rascunho[Number(linha.dataset.linhaLista)], campos));
    linha.classList.toggle("nao-salva", alterada);
    pendente ||= alterada;
  }
  const aviso = raiz.querySelector("[data-pendente]");
  if (aviso) aviso.hidden = !pendente;
}

export const AVISO_PENDENTE = `<span class="pendente" data-pendente hidden>Alterações não salvas</span>`;

/** Aviso das listas com gravação automática: só a linha incompleta fica sem gravar. */
export const AVISO_INCOMPLETO = `<span class="pendente" data-pendente hidden>Linha destacada ainda não gravada</span>`;

/** Lugar do estado da gravação no pé de uma seção. */
export const ESTADO_DA_GRAVACAO = `<span class="estado-gravacao" data-estado role="status" aria-live="polite"></span>`;

/**
 * Mostra o estado da gravação de uma seção: "salvando", "salvo" (some depois de alguns segundos) ou "" (nada).
 * @param {HTMLElement|null} raiz  formulário ou seção que contém o `ESTADO_DA_GRAVACAO`
 * @param {"salvando"|"salvo"|""} estado
 */
export function mostrarEstado(raiz, estado) {
  const el = raiz?.querySelector("[data-estado]");
  if (!el) return;
  clearTimeout(el._relogio);
  el.textContent = estado === "salvando" ? "Salvando…" : estado === "salvo" ? "Salvo" : "";
  el.classList.toggle("salvo", estado === "salvo");
  if (estado === "salvo") el._relogio = setTimeout(() => { el.textContent = ""; el.classList.remove("salvo"); }, 3000);
}
