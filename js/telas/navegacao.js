/**
 * Navegação (documentação técnica, passo 1.14c): barra do topo e menu lateral, como no Todoist e no Notion.
 * - Barra do topo: botão do menu lateral, à esquerda, e o nome do espaço aberto, no centro.
 * - No computador, com a barra recolhida (23/10/2026): sem botão no canto; um puxador na borda esquerda
 *   abre a barra, e Ctrl+B (⌘B) abre e recolhe.
 * - Menu lateral: no alto, quem entrou (trocar senha, sair) ou "Entrar"; no meio, os espaços,
 *   cada um com a engrenagem de "Configurar este espaço", e "Novo espaço"; no pé, "Ajuda e manual",
 *   "Extração de dados" (passo 2.10), "Gestão da estratégia" (link para o módulo Superior, passo 2.5) e "Configurar o sistema".
 * - No computador, o menu fica ao lado do conteúdo e pode ser recolhido (lembrado neste aparelho);
 *   no celular, abre por cima, com fundo escurecido, e fecha ao escolher algo.
 */
import { ICONES } from "../icones.js";
import { esc } from "../formato.js";
import { iniciais } from "../responsaveis.js";
import { agruparPorTipo } from "../tipos.js";

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
    /* o título no alto do conteúdo aparece ou some: rede e planilha refazem a altura, como ao redimensionar a janela */
    requestAnimationFrame(() => dispatchEvent(new Event("resize")));
  }
  rotularBotao();
}
/** No computador, o botão do menu lateral só aparece com a barra aberta, e serve para recolhê-la. */
function rotularBotao() {
  const corpo = document.body;
  const visivel = estreito() ? corpo.classList.contains("lateral-aberta") : !corpo.classList.contains("lateral-recolhida");
  const botao = document.querySelector("[data-alternar-lateral]");
  botao.setAttribute("aria-expanded", String(visivel));
  const rotulo = estreito() ? "Menu" : "Recolher a barra lateral (Ctrl+B)";
  botao.setAttribute("aria-label", rotulo);
  if (estreito()) botao.removeAttribute("title"); else botao.title = rotulo;
}
const fecharNoCelular = () => { if (estreito()) alternar(false); };

function ligar() {
  ligado = true;
  document.body.classList.toggle("lateral-recolhida", lerRecolhido());
  document.querySelector("[data-alternar-lateral]").addEventListener("click", () => alternar());
  rotularBotao();
  /* puxador da borda esquerda (23/10/2026): abre a barra recolhida e passa o foco para o botão que a recolhe */
  document.querySelector("[data-puxador-lateral]").addEventListener("click", () => {
    alternar(true);
    document.querySelector("[data-alternar-lateral]").focus({ preventScroll: true });
  });
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
    /* Ctrl+B (⌘B no Mac) abre e recolhe a barra lateral, como no VS Code e no Notion; num texto formatável, continua sendo negrito */
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b" && !e.target.isContentEditable && !document.querySelector(".camada")) {
      e.preventDefault();
      alternar();
    }
  });
  /* ao passar de celular para computador (girar o tablet, redimensionar), o menu por cima se desfaz */
  matchMedia("(max-width: 899px)").addEventListener("change", () => {
    document.body.classList.remove("lateral-aberta");
    document.querySelector(".fundo-lateral").hidden = true;
    rotularBotao();
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
    legenda: opcoes.aoLegenda, lixeira: opcoes.aoLixeira, consulta: opcoes.aoConsulta, extracao: opcoes.aoExtracao,
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

  /* espaços agrupados por tipo, com o nome do tipo no plural, só os tipos que existem (passo 2.4a);
     sem espaço nenhum, o grupo único "Espaços" */
  /* encerrados (passo 2.3): saem da lista principal e ficam num grupo recolhido no fim (decisão do responsável, 24/10/2026) */
  const ativos = espacos.filter((e) => !e.encerradoEm);
  const encerrados = espacos.filter((e) => e.encerradoEm);
  const grupos = ativos.length ? agruparPorTipo(ativos) : [{ titulo: "Espaços", espacos: [] }];
  const itemHtml = (e) => `<li class="espaco-item${e.id === abertoId ? " atual" : ""}">
          ${e.id === abertoId
            /* o espaço aberto não é botão: clicar nele não faria nada */
            ? `<span class="espaco-nome" aria-current="page">${esc(e.nome)}</span>`
            : `<button type="button" class="espaco-nome" data-espaco="${esc(e.id)}">${esc(e.nome)}</button>`}
          ${podeConfigurar(e.id) ? `<button type="button" class="espaco-configurar" data-configurar="${esc(e.id)}" aria-label="Configurar ${esc(e.nome)}" title="Configurar este espaço">${ICONES.engrenagem}</button>` : ""}
        </li>`;
  document.querySelector(".lateral").innerHTML = `
    <div class="lateral-conta">${contaHtml}</div>
    <nav class="lateral-espacos" aria-label="Espaços">
      ${grupos.map((g) => `<h2 class="lateral-rotulo">${g.titulo}</h2>
      <ul>${g.espacos.map(itemHtml).join("")}</ul>`).join("")}
      ${espacos.length ? "" : `<p class="vazio">${!usuario && comLogin ? "Entre com seu e-mail e senha para ver os seus espaços." : "Nenhum espaço seu ainda."}</p>`}
      ${encerrados.length ? `<details class="lateral-encerrados"${encerrados.some((e) => e.id === abertoId) ? " open" : ""}>
        <summary class="lateral-rotulo">Encerrados <span class="n">${encerrados.length}</span></summary>
        <ul>${encerrados.map(itemHtml).join("")}</ul></details>` : ""}
      ${podeCriar ? `<button type="button" class="lateral-acao" data-item="novo">${ICONES.mais}Novo espaço</button>` : ""}
      ${opcoes.aoConsulta ? `<button type="button" class="lateral-acao" data-item="consulta" title="Espaços públicos e institucionais de que você não participa">${ICONES.olho}Espaços abertos à consulta${opcoes.nConsulta ? ` <span class="n">${opcoes.nConsulta}</span>` : ""}</button>` : ""}
    </nav>
    <div class="lateral-pe">
      ${opcoes.comLegenda ? `<button type="button" class="lateral-acao" data-item="legenda">${ICONES.legenda}Legenda</button>` : ""}
      <button type="button" class="lateral-acao" data-item="lixeira">${ICONES.lixeira}Lixeira</button>
      <button type="button" class="lateral-acao" data-item="ajuda">${ICONES.ajuda}Ajuda e manual</button>
      ${opcoes.aoExtracao ? `<button type="button" class="lateral-acao" data-item="extracao" title="Planilha ou PDF com os dados dos espaços">${ICONES.modoPlanilha}Extração de dados</button>` : ""}
      <a class="lateral-acao" href="superior/" title="Módulo Superior: o desdobramento do PEI/PDI até os Planos de Ação">${ICONES.modoRede}Gestão da estratégia</a>
      ${usuario || !comLogin ? `<button type="button" class="lateral-acao" data-item="sistema">${ICONES.sistema}Configurar o sistema</button>` : ""}
    </div>`;
}
