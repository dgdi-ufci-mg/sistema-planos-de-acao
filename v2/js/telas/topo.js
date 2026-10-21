/**
 * Barra do topo (especificação, seção 8.1): menu do espaço e menu do usuário.
 * Menu do espaço: lista dos espaços (✓ no aberto), "Configurar este espaço",
 * "Novo espaço" e "Boas-vindas" (sem permissão para gravar, só a lista e "Boas-vindas").
 * Menu do usuário: sem login, ícone de pessoa, com "Ajuda e manual" e "Entrar"; com login,
 * as iniciais, os dados de quem entrou, "Configurar o sistema", "Trocar senha" e "Sair".
 */
import { ICONES } from "../icones.js";
import { esc } from "../formato.js";
import { iniciais } from "../responsaveis.js";

/**
 * @param {HTMLElement} alvo
 * @param {{espacos: object[], abertoId?: string|null, aoAbrir: (id: string) => void, aoConfigurar: () => void,
 *   aoNovo: () => void, aoBoasVindas: () => void, aoAjuda: () => void, aoSistema: () => void, aoEntrar: () => void,
 *   aoTrocarSenha: () => void, aoSair: () => void, usuario?: {email: string, nome?: string}|null,
 *   podeConfigurar?: boolean, podeCriar?: boolean, comLogin?: boolean}} opcoes
 *   usuario: quem entrou; podeConfigurar: o espaço aberto aceita gravações; podeCriar: pode criar espaço;
 *   comLogin: o sistema tem login (sem banco compartilhado, o menu não oferece "Entrar")
 */
export function mostrarTopo(alvo, opcoes) {
  const { espacos, abertoId, usuario = null, podeConfigurar = true, podeCriar = true, comLogin = true } = opcoes;
  const aberto = espacos.find((e) => e.id === abertoId);
  alvo.innerHTML = `
    <div class="menu-espaco">
      <button class="seletor" type="button" aria-haspopup="true" aria-expanded="false" data-abrir="espacos">
        <span>${aberto ? esc(aberto.nome) : "Escolher espaço"}</span>${ICONES.abrir}
      </button>
      <div class="menu" data-menu="espacos" hidden>
        ${espacos.map((e) => `<button type="button" data-espaco="${esc(e.id)}"${e.id === abertoId ? ' class="atual" aria-current="true"' : ""}>
          <span>${esc(e.nome)}</span>${e.id === abertoId ? ICONES.marcado : ""}</button>`).join("")}
        ${espacos.length ? "<hr>" : ""}
        ${aberto && podeConfigurar ? '<button type="button" data-item="configurar">Configurar este espaço</button>' : ""}
        ${podeCriar ? '<button type="button" data-item="novo">Novo espaço</button>' : ""}
        <button type="button" data-item="boasVindas">Boas-vindas</button>
      </div>
    </div>
    <div class="menu-usuario">
      <button class="redondo${usuario ? " com-login" : ""}" type="button" aria-label="Menu do usuário" aria-haspopup="true" aria-expanded="false" data-abrir="usuario"
        ${usuario ? `title="${esc(usuario.email)}"` : ""}>${usuario ? esc(iniciais(usuario.nome || usuario.email.split("@")[0])) : ICONES.pessoa}</button>
      <div class="menu" data-menu="usuario" hidden>
        ${usuario ? `<div class="menu-cabeca">${usuario.nome ? `<b>${esc(usuario.nome)}</b>` : ""}<small>${esc(usuario.email)}</small>
          ${usuario.nome ? "" : '<small class="tec">Sem responsável ligado a este e-mail</small>'}</div><hr>` : ""}
        <button type="button" data-item="ajuda">Ajuda e manual</button>
        ${usuario || !comLogin ? '<button type="button" data-item="sistema">Configurar o sistema</button>' : ""}
        ${usuario ? '<button type="button" data-item="trocarSenha">Trocar senha</button><button type="button" data-item="sair">Sair</button>'
          : comLogin ? '<button type="button" data-item="entrar">Entrar</button>' : ""}
      </div>
    </div>`;

  const fechar = () => {
    for (const m of alvo.querySelectorAll("[data-menu]")) m.hidden = true;
    for (const b of alvo.querySelectorAll("[data-abrir]")) b.setAttribute("aria-expanded", "false");
  };
  const itens = {
    configurar: opcoes.aoConfigurar, novo: opcoes.aoNovo, boasVindas: opcoes.aoBoasVindas,
    ajuda: opcoes.aoAjuda, sistema: opcoes.aoSistema, entrar: opcoes.aoEntrar,
    trocarSenha: opcoes.aoTrocarSenha, sair: opcoes.aoSair,
  };
  alvo.onclick = (e) => {
    const abrir = e.target.closest("[data-abrir]");
    if (abrir) {
      const menu = alvo.querySelector(`[data-menu="${abrir.dataset.abrir}"]`);
      const estavaFechado = menu.hidden;
      fechar();
      menu.hidden = !estavaFechado;
      abrir.setAttribute("aria-expanded", String(estavaFechado));
      return;
    }
    const espaco = e.target.closest("[data-espaco]");
    const item = e.target.closest("[data-item]");
    fechar();
    if (espaco) opcoes.aoAbrir(espaco.dataset.espaco);
    else if (item) itens[item.dataset.item]();
  };
  document.onclick = (e) => { if (!alvo.contains(e.target)) fechar(); };
  document.onkeydown = (e) => { if (e.key === "Escape") fechar(); };
}
