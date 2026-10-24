/**
 * "Espaços abertos à consulta" (passo 2.2; seção 16.3; decisão do responsável, 24/10/2026): a página dos
 * espaços públicos e institucionais de que a pessoa não participa. Eles não ocupam a barra lateral, que
 * mostra só os espaços em que a pessoa tem papel; aqui ela os encontra, com busca, agrupados por tipo.
 */
import { esc } from "../formato.js";
import { buscar } from "../acao.js";
import { abrirPainel, fecharPainel } from "./painel.js";
import { agruparPorTipo } from "../tipos.js";
import { visibilidadeDe, nomeDaVisibilidade } from "../papeis.js";

/** Explicação no alto da página (texto combinado com o responsável em 24/10/2026). */
export const EXPLICACAO_CONSULTA = "Espaços de que você não participa, mas que os administradores abriram para consulta: os <b>públicos</b>, que qualquer pessoa vê, e os <b>institucionais</b>, que quem tem login na UFCI-MG vê. Os espaços restritos não aparecem aqui.";

/**
 * @param {{espacos: object[], comLogin: boolean, aoAbrir: (id: string) => any}} opcoes
 *   espacos: os abertos à consulta para quem está vendo (podeVer e não participa)
 */
export function abrirConsulta({ espacos, comLogin, aoAbrir }) {
  let texto = "";
  const corpo = abrirPainel("Espaços abertos à consulta", "");
  function desenhar() {
    const achados = buscar([...espacos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), texto, (e) => [e.nome, e.programa]);
    corpo.innerHTML = `
      <p class="tec">${EXPLICACAO_CONSULTA}</p>
      ${comLogin ? "" : `<p class="tec">Sem login, aparecem só os públicos. Entre com seu e-mail e senha para ver também os institucionais e os seus espaços.</p>`}
      ${espacos.length > 6 ? `<input type="search" data-busca-consulta placeholder="Buscar pelo nome ou pelo Programa" aria-label="Buscar espaços" value="${esc(texto)}">` : ""}
      ${achados.length ? agruparPorTipo(achados).map((g) => `<section class="grupo-consulta"><h3>${g.titulo}</h3>
        <ul class="lista-consulta">${g.espacos.map((e) => `<li><button type="button" class="item-consulta" data-abrir-consulta="${esc(e.id)}">
          <b>${esc(e.nome)}</b>
          <small class="tec">${esc(nomeDaVisibilidade(visibilidadeDe(e)))}${e.encerradoEm ? " · encerrado" : ""}${e.programa ? ` · ${esc(e.programa)}` : ""}</small></button></li>`).join("")}</ul>
      </section>`).join("") : `<p class="vazio">${texto ? "Nenhum espaço com essa busca." : "Nenhum espaço aberto à consulta por enquanto."}</p>`}`;
    const busca = corpo.querySelector("[data-busca-consulta]");
    if (busca && document.activeElement !== busca && texto) { busca.focus(); busca.setSelectionRange(texto.length, texto.length); }
  }
  corpo.addEventListener("input", (e) => {
    if (!e.target.matches("[data-busca-consulta]")) return;
    texto = e.target.value;
    desenhar();
    const busca = corpo.querySelector("[data-busca-consulta]");
    busca.focus();
    busca.setSelectionRange(texto.length, texto.length);
  });
  corpo.addEventListener("click", async (e) => {
    const item = e.target.closest("[data-abrir-consulta]");
    if (!item) return;
    fecharPainel();
    await aoAbrir(item.dataset.abrirConsulta);
  });
  desenhar();
}
