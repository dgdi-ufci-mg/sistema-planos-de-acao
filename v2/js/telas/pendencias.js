/**
 * Destaque do que ainda não foi salvo nas listas editáveis (datas excluídas, documentos):
 * a linha nova ou alterada fica destacada, e o aviso "Alterações não salvas" aparece junto
 * do botão Salvar. Depois de salvar, tudo volta à aparência normal.
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
