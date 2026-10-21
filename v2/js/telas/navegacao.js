/**
 * Navegação (especificação, passo 1.14c): barra do topo e menu lateral, como no Todoist e no Notion.
 * - Barra do topo: botão do menu lateral, à esquerda, e o nome do espaço aberto, no centro.
 * - Menu lateral: no alto, quem entrou (trocar senha, sair) ou "Entrar"; no meio, os espaços,
 *   cada um com a engrenagem de "Configurar este espaço", e "Novo espaço"; no pé, "Ajuda e manual"
 *   e "Configurar o sistema".
 * - No computador, o menu fica ao lado do conteúdo e pode ser recolhido (lembrado neste aparelho);
 *   no celular, abre por cima, com fundo escurecido, e fecha ao escolher algo.
 */
import { ICONES } from "../icones.js";
import { esc } from "../formato.js";
import { iniciais } from "../responsaveis.js";

const CHAVE_RECOLHIDO = "sextante.menuRecolhido";
const estreito = () => matchMedia("(max-width: 899px)").matches;
const lerRecolhido = () => { try { return localStorage.getItem(CHAVE_RECOLHIDO) === "1"; } catch { return false; } };
const gravarRecolhido = (v) => { try { localStorage.setItem(CHAVE_RECOLHIDO, v ? "1" : "0"); } catch { /* sem armazenamento */ } };

let ligado = false;
let acoes = {};

/** Abre ou fecha o menu lateral: no computador, recolhe; no celular, abre por cima. */
function alternar(abrir) {
  const corpo = document.body;
  if (estreito()) {
    const aberto = abrir ?? !corpo.classList.contains("lateral-aberta");
    corpo.classList.toggle("lateral-aberta", aberto);
    document.querySelector(".fundo-lateral").hidden = !aberto;
    if (aberto) document.querySelector(".lateral button")?.focus();
  } else {
    const recolher = abrir === undefined ? !corpo.classList.contains("lateral-recolhida") : !abrir;
    corpo.classList.toggle("lateral-recolhida", recolher);
    gravarRecolhido(recolher);
  }
  const visivel = estreito() ? corpo.classList.contains("lateral-aberta") : !corpo.classList.contains("lateral-recolhida");
  document.querySelector("[data-alternar-lateral]").setAttribute("aria-expanded", String(visivel));
}
const fecharNoCelular = () => { if (estreito()) alternar(false); };

function ligar() {
  ligado = true;
  document.body.classList.toggle("lateral-recolhida", lerRecolhido());
  document.querySelector("[data-alternar-lateral]").addEventListener("click", () => alternar());
  document.querySelector(".fundo-lateral").addEventListener("click", () => alternar(false));
  const lateral = document.querySelector(".lateral");
  lateral.addEventListener("click", (e) => {
    const conta = e.target.closest("[data-abrir-conta]");
    if (conta) {
      const menu = lateral.querySelector("[data-menu-conta]");
      menu.hidden = !menu.hidden;
      conta.setAttribute("aria-expanded", String(!menu.hidden));
      return;
    }
    const espaco = e.target.closest("[data-espaco]");
    const configurar = e.target.closest("[data-configurar]");
    const item = e.target.closest("[data-item]");
    if (configurar) { fecharNoCelular(); acoes.aoConfigurar(configurar.dataset.configurar); return; }
    if (espaco) { fecharNoCelular(); acoes.aoAbrir(espaco.dataset.espaco); return; }
    if (item) { fecharNoCelular(); acoes[item.dataset.item](); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("lateral-aberta") && !document.querySelector(".camada")) alternar(false);
  });
  /* ao passar de celular para computador (girar o tablet, redimensionar), o menu por cima se desfaz */
  matchMedia("(max-width: 899px)").addEventListener("change", () => {
    document.body.classList.remove("lateral-aberta");
    document.querySelector(".fundo-lateral").hidden = true;
  });
}

/**
 * Desenha a barra e o menu lateral.
 * @param {{espacos: object[], abertoId?: string|null, titulo?: string, usuario?: {email: string, nome?: string}|null,
 *   comLogin?: boolean, podeCriar?: boolean, podeConfigurar: (id: string) => boolean,
 *   aoAbrir: (id: string) => void, aoConfigurar: (id: string) => void, aoNovo: () => void, aoAjuda: () => void,
 *   aoSistema: () => void, aoEntrar: () => void, aoTrocarSenha: () => void, aoSair: () => void}} opcoes
 */
export function mostrarNavegacao(opcoes) {
  const { espacos, abertoId = null, titulo = "", usuario = null, comLogin = true, podeCriar = true, podeConfigurar } = opcoes;
  acoes = {
    aoAbrir: opcoes.aoAbrir, aoConfigurar: opcoes.aoConfigurar, novo: opcoes.aoNovo, ajuda: opcoes.aoAjuda,
    sistema: opcoes.aoSistema, entrar: opcoes.aoEntrar, trocarSenha: opcoes.aoTrocarSenha, sair: opcoes.aoSair,
  };
  if (!ligado) ligar();
  document.querySelector("[data-titulo]").textContent = titulo;

  const contaHtml = usuario
    ? `<button class="conta" type="button" data-abrir-conta aria-expanded="false" aria-controls="menu-conta">
        <span class="selo-conta" aria-hidden="true">${esc(iniciais(usuario.nome || usuario.email.split("@")[0]))}</span>
        <span class="conta-texto">${usuario.nome ? `<b>${esc(usuario.nome)}</b>` : ""}<small>${esc(usuario.email)}</small></span>${ICONES.abrir}</button>
      <div class="conta-menu" id="menu-conta" data-menu-conta hidden>
        ${usuario.nome ? "" : '<p class="tec">Sem responsável ligado a este e-mail neste espaço.</p>'}
        <button type="button" data-item="trocarSenha">Trocar senha</button>
        <button type="button" data-item="sair">Sair</button>
      </div>`
    : comLogin ? `<button class="botao" type="button" data-item="entrar">${ICONES.pessoa}Entrar</button>` : "";

  document.querySelector(".lateral").innerHTML = `
    <div class="lateral-conta">${contaHtml}</div>
    <nav class="lateral-espacos" aria-label="Espaços">
      <h2 class="lateral-rotulo">Espaços</h2>
      <ul>${espacos.map((e) => `<li class="espaco-item${e.id === abertoId ? " atual" : ""}">
          ${e.id === abertoId
            /* o espaço aberto não é botão: clicar nele não faria nada */
            ? `<span class="espaco-nome" aria-current="page">${esc(e.nome)}</span>`
            : `<button type="button" class="espaco-nome" data-espaco="${esc(e.id)}">${esc(e.nome)}</button>`}
          ${podeConfigurar(e.id) ? `<button type="button" class="espaco-configurar" data-configurar="${esc(e.id)}" aria-label="Configurar ${esc(e.nome)}" title="Configurar este espaço">${ICONES.engrenagem}</button>` : ""}
        </li>`).join("") || '<li class="vazio">Nenhum espaço ainda.</li>'}</ul>
      ${podeCriar ? `<button type="button" class="lateral-acao" data-item="novo">${ICONES.mais}Novo espaço</button>` : ""}
    </nav>
    <div class="lateral-pe">
      <button type="button" class="lateral-acao" data-item="ajuda">${ICONES.ajuda}Ajuda e manual</button>
      ${usuario || !comLogin ? `<button type="button" class="lateral-acao" data-item="sistema">${ICONES.sistema}Configurar o sistema</button>` : ""}
    </div>`;
}
