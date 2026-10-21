/**
 * Exclusões (especificação, seção 4.7; passo 1.15). Nada é apagado: o item vai para a lixeira.
 * Exclusão simples: na hora, com "Desfazer" no aviso. Exclusão que afeta outros itens: uma janela
 * explica a consequência e oferece as alternativas (a primeira já vem marcada).
 */
import { esc, plural } from "../formato.js";
import { avisar, perguntar } from "./painel.js";

const lista = (nomes) => {
  const n = nomes.map((x) => `“${esc(x)}”`);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} e ${n.at(-1)}`;
};

/**
 * Ação: se outras dependem dela, pergunta se as liga às anteriores da excluída.
 * @returns {Promise<boolean>} se excluiu
 */
export async function excluirAcao({ store, espacoId, acao, acoes }) {
  const ativas = new Map(acoes.map((a) => [a.numero, a]));
  const dependentes = acoes.filter((a) => (a.dependeDe ?? []).includes(acao.numero));
  const anteriores = (acao.dependeDe ?? []).map((n) => ativas.get(n)).filter(Boolean);
  let religar = false;
  if (dependentes.length) {
    const resposta = await perguntar({
      titulo: `Excluir “${esc(acao.rotulo)}”?`,
      corpo: `<p>${dependentes.length} ${plural(dependentes.length, "ação depende", "ações dependem")} desta: ${lista(dependentes.map((a) => a.rotulo))}.</p>
        ${anteriores.length ? `<label class="escolha"><input type="radio" name="destino" value="religar" checked>
          <span>Ligar ${plural(dependentes.length, "essa ação", "essas ações")} às anteriores desta (${lista(anteriores.map((a) => a.rotulo))}), mantendo a sequência</span></label>` : ""}
        <label class="escolha"><input type="radio" name="destino" value="retirar"${anteriores.length ? "" : " checked"}>
          <span>Só retirar a dependência</span></label>`,
    });
    if (!resposta) return false;
    religar = resposta.destino === "religar";
  }
  await store.excluirAcao(espacoId, acao.numero, { religar });
  avisar(`Ação excluída: ${acao.rotulo}.`, {
    acao: { texto: "Desfazer", fazer: () => store.restaurarAcao(espacoId, acao.numero).then(() => avisar("Ação restaurada.")).catch((e) => avisar(e.message)) },
  });
  return true;
}

/**
 * Responsável: se está em ações, pergunta se outro entra no lugar.
 * @returns {Promise<boolean>} se excluiu
 */
export async function excluirResponsavel({ store, espacoId, responsavel, acoes, responsaveis }) {
  const emAcoes = acoes.filter((a) => (a.responsaveis ?? []).includes(responsavel.id)).length;
  let substituto = null;
  if (emAcoes) {
    const outros = responsaveis.filter((r) => r.id !== responsavel.id).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const resposta = await perguntar({
      titulo: `Excluir ${esc(responsavel.nome)}?`,
      corpo: `<p>É ${plural(emAcoes, "responsável por 1 ação", `responsável por ${emAcoes} ações`)} deste espaço.</p>
        ${outros.length ? `<label class="escolha"><input type="radio" name="destino" value="substituir" checked><span>Substituir por:</span></label>
        <select name="substituto" aria-label="Substituir por"><option value="">Escolha o responsável</option>
          ${outros.map((r) => `<option value="${esc(r.id)}">${esc(r.sigla ? `${r.sigla} · ${r.nome}` : r.nome)}</option>`).join("")}</select>` : ""}
        <label class="escolha"><input type="radio" name="destino" value="retirar"${outros.length ? "" : " checked"}><span>Só retirar das ações</span></label>`,
      validar: (c) => (c.destino === "substituir" && !c.substituto ? "Escolha quem entra no lugar, ou marque “Só retirar das ações”." : null),
    });
    if (!resposta) return false;
    substituto = resposta.destino === "substituir" ? resposta.substituto : null;
  }
  await store.excluirResponsavel(espacoId, responsavel.id, { substituto });
  avisar(`${responsavel.nome} foi para a lixeira.`, emAcoes ? {} : {
    acao: { texto: "Desfazer", fazer: () => store.restaurarResponsavel(espacoId, responsavel.id).then(() => avisar("Responsável restaurado.")).catch((e) => avisar(e.message)) },
  });
  return true;
}

/**
 * Fase ou etapa com ações: pergunta para onde vão as ações. Sem ações, não pergunta (quem chama
 * só retira do rascunho, como antes).
 * @param {{ids: string[], nome: string, ehFase: boolean, nAcoes: number, etapasQueFicam: {id: string, nome: string, fase: string}[]}} alvo
 * @returns {Promise<boolean>} se excluiu
 */
export async function excluirEtapas({ store, espacoId, ids, nome, ehFase, nAcoes, etapasQueFicam }) {
  const resposta = await perguntar({
    titulo: `Excluir a ${ehFase ? "fase" : "etapa"} “${esc(nome)}”?`,
    corpo: `<p>Ela tem ${nAcoes} ${plural(nAcoes, "ação", "ações")}.</p>
      ${etapasQueFicam.length ? `<label class="escolha"><input type="radio" name="destino" value="mover" checked><span>Mover as ações para:</span></label>
      <select name="etapa" aria-label="Mover para a etapa"><option value="">Escolha a etapa</option>
        ${etapasQueFicam.map((e) => `<option value="${esc(e.id)}">${esc(e.fase)} · ${esc(e.nome)}</option>`).join("")}</select>` : ""}
      <label class="escolha"><input type="radio" name="destino" value="sem"${etapasQueFicam.length ? "" : " checked"}><span>Deixar as ações sem fase nem etapa</span></label>`,
    validar: (c) => (c.destino === "mover" && !c.etapa ? "Escolha a etapa, ou marque “Deixar as ações sem fase nem etapa”." : null),
  });
  if (!resposta) return false;
  await store.excluirEtapas(espacoId, ids, { destino: resposta.destino === "mover" ? resposta.etapa : null });
  avisar(`${ehFase ? "Fase" : "Etapa"} excluída.`);
  return true;
}

/** Espaço: sempre pergunta. @returns {Promise<boolean>} se excluiu */
export async function excluirEspaco({ store, espaco }) {
  const resposta = await perguntar({
    titulo: `Excluir o espaço “${esc(espaco.nome)}”?`,
    corpo: "<p>Ele sai da lista de todos e vai para a lixeira, de onde pode ser restaurado.</p>",
  });
  if (!resposta) return false;
  await store.excluirEspaco(espaco.id);
  avisar(`Espaço excluído: ${espaco.nome}.`);
  return true;
}
