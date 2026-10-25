/**
 * Lixeira (documentação técnica, seção 4.7; passo 1.15): o que foi excluído neste espaço (ações e
 * responsáveis) e os espaços excluídos, cada um com quem excluiu, quando, e "Restaurar".
 * Aberta pelo item "Lixeira" do menu lateral.
 */
import { esqueletoHtml } from "./esqueleto.js";
import { esc } from "../formato.js";
import { abrirPainel, avisar } from "./painel.js";

const quando = (momento) => (momento ? new Date(momento).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

/**
 * @param {{store: object, espacoId?: string|null, storeEspacos: object, aoRestaurarEspaco: (id: string) => void}} opcoes
 *   store: o do espaço aberto (o exemplo tem o seu); storeEspacos: o dos espaços guardados
 */
export function abrirLixeira({ store, espacoId = null, storeEspacos, aoRestaurarEspaco }) {
  const corpo = abrirPainel("Lixeira", esqueletoHtml("texto", 4));

  async function desenhar() {
    const [lixo, espacos, responsaveis] = await Promise.all([
      espacoId ? store.listarLixeira(espacoId) : { acoes: [], responsaveis: [] },
      storeEspacos.listarEspacosExcluidos(),
      espacoId ? store.listarResponsaveis(espacoId) : [],
    ]);
    const quem = (email) => esc(responsaveis.find((r) => r.usuario === email)?.nome ?? email);
    /* restaurar é do administrador do espaço (passo 2.1) */
    const aqui = espacoId ? await store.lerEspaco(espacoId) : null;
    const podeAqui = Boolean(aqui) && store.podeGravar && store.permissoesEm(aqui).configurar;
    const pode = (s) => (s === store ? podeAqui : s.podeGravar);
    const podeEspaco = (e) => storeEspacos.podeGravar && storeEspacos.permissoesEm(e).configurar;
    /* feminino para ação, masculino para responsável e espaço */
    const item = (nome, por, em, atributos, podeRestaurar, feminino = false) => `<li class="item-lixeira">
      <span class="item-lixeira-texto"><b>${esc(nome)}</b><small>${feminino ? "Excluída" : "Excluído"}${por ? ` por ${quem(por)}` : ""} em ${quando(em)}</small></span>
      ${podeRestaurar ? `<button class="botao" type="button" ${atributos}>Restaurar</button>` : ""}</li>`;
    corpo.innerHTML = `
      <p class="tec">Nada é apagado de vez: o que está aqui pode voltar. Restaurar não refaz as ligações mudadas na exclusão.</p>
      ${espacoId ? `<section class="secao-lixeira"><h3>Neste espaço</h3>
        ${lixo.acoes.length || lixo.responsaveis.length ? "" : '<p class="vazio">Nenhuma ação nem responsável excluído.</p>'}
        ${lixo.acoes.length ? `<h4>Ações</h4><ul>${lixo.acoes.map((a) => item(a.rotulo, a.excluidaPor, a.excluidaEm, `data-restaurar-acao="${a.numero}"`, pode(store), true)).join("")}</ul>` : ""}
        ${lixo.responsaveis.length ? `<h4>Responsáveis</h4><ul>${lixo.responsaveis.map((r) => item(r.nome, r.excluidoPor, r.excluidoEm, `data-restaurar-responsavel="${esc(r.id)}"`, pode(store))).join("")}</ul>` : ""}
      </section>` : ""}
      <section class="secao-lixeira"><h3>Espaços excluídos</h3>
        ${espacos.length ? `<ul>${espacos.map((e) => item(e.nome, e.excluidoPor, e.excluidoEm, `data-restaurar-espaco="${esc(e.id)}"`, podeEspaco(e))).join("")}</ul>`
          : '<p class="vazio">Nenhum espaço excluído.</p>'}
      </section>`;
  }

  corpo.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    try {
      if (t.dataset.restaurarAcao) { await store.restaurarAcao(espacoId, Number(t.dataset.restaurarAcao)); avisar("Ação restaurada."); }
      else if (t.dataset.restaurarResponsavel) { await store.restaurarResponsavel(espacoId, t.dataset.restaurarResponsavel); avisar("Responsável restaurado."); }
      else if (t.dataset.restaurarEspaco) {
        await storeEspacos.restaurarEspaco(t.dataset.restaurarEspaco);
        avisar("Espaço restaurado.");
        aoRestaurarEspaco(t.dataset.restaurarEspaco);
      } else return;
      await desenhar();
    } catch (falha) {
      avisar(falha.message);
    }
  });
  desenhar().catch((falha) => { corpo.innerHTML = `<p class="erro">${esc(falha.message)}</p>`; });
}
