/**
 * Navegação (documentação técnica, passo 1.14c): barra do topo e menu lateral, como no Todoist e no Notion.
 * - Barra do topo: botão do menu lateral, à esquerda, e o nome do espaço aberto, no centro.
 * - No computador, com a barra recolhida: o botão de painel no canto esquerdo da barra do topo abre a barra
 *   (revisto em 26/10/2026, decisão do responsável: o puxador na borda esquerda, de 23/10, saiu), e Ctrl+B (⌘B)
 *   abre e recolhe.
 * - Menu lateral: no alto, quem entrou (trocar senha, sair) ou "Entrar", "Buscar", "Novo espaço" e "Minhas tarefas" (só com
 *   login, 05/11/2026)
 *   (29/10/2026, decisão do responsável: sempre à vista, sem depender do tamanho da lista); no meio, os espaços,
 *   cada um com a engrenagem de "Configurar este espaço"; no pé (24/10/2026, avaliação de
 *   usabilidade), à vista "Ajuda e manual" e "Configurar o sistema"; recolhidos em "Mais", a Lixeira, a "Extração de dados"
 *   (passo 2.10), "Gestão da estratégia" (link para o módulo Superior, passo 2.5) e "Instalar como aplicativo".
 *   A Legenda passou para o menu "Exibir" do espaço.
 * - No computador, o menu fica ao lado do conteúdo e pode ser recolhido (lembrado neste aparelho);
 *   no celular, abre por cima, com fundo escurecido, e fecha ao escolher algo.
 */
import { TEMAS, lerTema, escolherTema, PALETAS, lerPaleta, escolherPaleta } from "../tema.js";
import { ICONES } from "../icones.js";
import { NOME } from "../identidade.js";
import { esc } from "../formato.js";
import { iniciais } from "../responsaveis.js";
import { agruparPorTipo } from "../tipos.js";
/** Ícone de cada tipo no título do grupo da barra lateral (27/10/2026, pedido do responsável: destacar os títulos). */
const ICONE_DO_TIPO = { planoDeAcao: "modoEntregas", projeto: "modoCronograma", quadro: "modoQuadro", lista: "modoLista" };
import { ligarSecoesSuaves } from "./movimento.js";
import { atalhoDaBusca } from "./busca.js";
import { abrirCamada } from "./voltar.js";

const CHAVE_RECOLHIDO = "sextante.menuRecolhido";
const estreito = () => matchMedia("(max-width: 899px)").matches;
const lerRecolhido = () => { try { return localStorage.getItem(CHAVE_RECOLHIDO) === "1"; } catch { return false; } };
const gravarRecolhido = (v) => { try { localStorage.setItem(CHAVE_RECOLHIDO, v ? "1" : "0"); } catch { /* sem armazenamento */ } };
/* grupo "Mais" do pé da barra (24/10/2026): aberto ou fechado, lembrado neste aparelho */
const CHAVE_MAIS = "sextante.lateralMais";
const lerMais = () => { try { return localStorage.getItem(CHAVE_MAIS) === "1"; } catch { return false; } };
const gravarMais = (v) => { try { localStorage.setItem(CHAVE_MAIS, v ? "1" : "0"); } catch { /* sem armazenamento */ } };

/*
 * Largura da barra lateral (04/11/2026, pedido do responsável, como no Todoist): no computador, arrastar a borda
 * direita muda a largura, entre a mínima e a máxima; duplo clique volta ao padrão; com o foco na borda, as setas
 * mudam de 16 em 16 px, e Home e End vão aos limites. A largura é lembrada neste aparelho. No celular, a barra
 * abre por cima com a largura fixa de sempre.
 */
const CHAVE_LARGURA = "sextante.larguraLateral";
export const LARGURA_LATERAL = { padrao: 264, minima: 200, maxima: 420, passo: 16 };
const limitar = (px) => Math.round(Math.min(LARGURA_LATERAL.maxima, Math.max(LARGURA_LATERAL.minima, px)));
const lerLargura = () => {
  try { const v = Number(localStorage.getItem(CHAVE_LARGURA)); return v > 0 ? limitar(v) : LARGURA_LATERAL.padrao; }
  catch { return LARGURA_LATERAL.padrao; }
};
const gravarLargura = (v) => {
  try { if (v === LARGURA_LATERAL.padrao) localStorage.removeItem(CHAVE_LARGURA); else localStorage.setItem(CHAVE_LARGURA, String(v)); }
  catch { /* sem armazenamento */ }
};
let largura = LARGURA_LATERAL.padrao;
function aplicarLargura(px) {
  largura = limitar(px);
  document.documentElement.style.setProperty("--largura-lateral", `${largura}px`);
  const puxador = document.querySelector(".puxador-lateral");
  puxador?.setAttribute("aria-valuenow", String(largura));
  puxador?.setAttribute("aria-valuetext", `${largura} pixels`);
}

let ligado = false;
let soltarLateral = null;
let acoes = {};

/** Abre ou fecha o menu lateral: no computador, recolhe; no celular, abre por cima. */
function alternar(abrir) {
  const corpo = document.body;
  if (estreito()) {
    const aberto = abrir ?? !corpo.classList.contains("lateral-aberta");
    corpo.classList.toggle("lateral-aberta", aberto);
    /* Voltar fecha a barra aberta por cima (item 1 da avaliação de celular) */
    if (aberto && !soltarLateral) soltarLateral = abrirCamada(() => { soltarLateral = null; alternar(false); });
    if (!aberto && soltarLateral) { const s = soltarLateral; soltarLateral = null; s(); }
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
  const rotulo = estreito() ? "Menu" : visivel ? "Recolher a barra lateral (Ctrl+B)" : "Abrir a barra lateral (Ctrl+B)";
  botao.setAttribute("aria-label", rotulo);
  if (estreito()) botao.removeAttribute("title"); else botao.title = rotulo;
}
const fecharNoCelular = () => { if (estreito()) alternar(false); };

/** Liga a borda arrastável da barra lateral (só aparece no computador, com a barra aberta). */
function ligarPuxador() {
  const puxador = document.querySelector(".puxador-lateral");
  if (!puxador) return;
  puxador.setAttribute("aria-valuemin", String(LARGURA_LATERAL.minima));
  puxador.setAttribute("aria-valuemax", String(LARGURA_LATERAL.maxima));
  /* a largura lembrada entra sem transição, para a tela não "andar" ao abrir */
  document.body.classList.add("arrastando-lateral");
  aplicarLargura(lerLargura());
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("arrastando-lateral")));
  /* rede, planilha e barra do topo refazem as medidas como ao redimensionar a janela, no máximo uma vez por quadro */
  let quadro = 0;
  const avisar = () => { if (!quadro) quadro = requestAnimationFrame(() => { quadro = 0; dispatchEvent(new Event("resize")); }); };
  const mudar = (px) => { aplicarLargura(px); gravarLargura(largura); avisar(); };
  let inicio = null;
  puxador.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || estreito()) return;
    e.preventDefault();
    puxador.setPointerCapture(e.pointerId);
    inicio = { x: e.clientX, largura };
    document.body.classList.add("arrastando-lateral");
  });
  puxador.addEventListener("pointermove", (e) => {
    if (!inicio) return;
    aplicarLargura(inicio.largura + e.clientX - inicio.x);
    avisar();
  });
  const soltar = () => {
    if (!inicio) return;
    inicio = null;
    document.body.classList.remove("arrastando-lateral");
    gravarLargura(largura);
    avisar();
  };
  for (const evento of ["pointerup", "pointercancel", "lostpointercapture"]) puxador.addEventListener(evento, soltar);
  puxador.addEventListener("dblclick", () => mudar(LARGURA_LATERAL.padrao));
  puxador.addEventListener("keydown", (e) => {
    const nova = { ArrowLeft: largura - LARGURA_LATERAL.passo, ArrowRight: largura + LARGURA_LATERAL.passo,
      Home: LARGURA_LATERAL.minima, End: LARGURA_LATERAL.maxima }[e.key];
    if (nova === undefined) return;
    e.preventDefault();
    mudar(nova);
  });
}

function ligar() {
  ligado = true;
  document.body.classList.toggle("lateral-recolhida", lerRecolhido());
  ligarPuxador();
  document.querySelector("[data-alternar-lateral]").addEventListener("click", () => alternar());
  rotularBotao();
  document.querySelector(".fundo-lateral").addEventListener("click", () => alternar(false));
  const lateral = document.querySelector(".lateral");
  ligarSecoesSuaves(lateral); // "Mais" e "Encerrados" abrem e fecham deslizando
  lateral.addEventListener("toggle", (e) => { if (e.target.matches?.("[data-lateral-mais]")) gravarMais(e.target.open); }, true);
  lateral.addEventListener("click", (e) => {
    const conta = e.target.closest("[data-abrir-conta]");
    if (conta) {
      const menu = lateral.querySelector("[data-menu-conta]");
      menu.hidden = !menu.hidden;
      conta.setAttribute("aria-expanded", String(!menu.hidden));
      return;
    }
    /* tema deste aparelho (27/10/2026): troca na hora, sem fechar o menu */
    const tema = e.target.closest("[data-tema]");
    if (tema) {
      const escolhido = escolherTema(tema.dataset.tema);
      for (const b of lateral.querySelectorAll("[data-tema]")) b.setAttribute("aria-pressed", String(b.dataset.tema === escolhido));
      return;
    }
    /* paleta deste aparelho (11/11/2026, em teste): troca na hora, sem fechar o menu */
    const paleta = e.target.closest("[data-paleta]");
    if (paleta) {
      const escolhida = escolherPaleta(paleta.dataset.paleta);
      for (const b of lateral.querySelectorAll("[data-paleta]")) b.setAttribute("aria-pressed", String(b.dataset.paleta === escolhida));
      return;
    }
    const espaco = e.target.closest("[data-espaco]");
    const configurar = e.target.closest("[data-configurar]");
    const item = e.target.closest("[data-item]");
    if (configurar) { fecharNoCelular(); acoes.aoConfigurar(configurar.dataset.configurar); return; }
    if (espaco) { fecharNoCelular(); acoes.aoAbrir(espaco.dataset.espaco); return; }
    if (item) { fecharNoCelular(); acoes[item.dataset.item](); }
  });
  /* menu da conta aberto (caixinha por cima): clicar fora ou Esc fecha */
  const fecharConta = () => {
    const menu = lateral.querySelector("[data-menu-conta]");
    if (!menu || menu.hidden) return false;
    menu.hidden = true;
    lateral.querySelector("[data-abrir-conta]")?.setAttribute("aria-expanded", "false");
    return true;
  };
  document.addEventListener("click", (e) => { if (!e.target.closest?.(".lateral-conta")) fecharConta(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && fecharConta()) { e.stopPropagation(); return; }
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
    if (soltarLateral) { const s = soltarLateral; soltarLateral = null; s(); }
    document.querySelector(".fundo-lateral").hidden = true;
    rotularBotao();
  });
}

/**
 * "Minhas tarefas" (05/11/2026, pedido do responsável): entre "Novo espaço" e a lista de espaços, só para quem entrou
 * ("Novo espaço" continua logo abaixo de "Buscar", decisão de 29/10/2026). O número ao lado
 * conta as atrasadas e as de hoje (vazio enquanto não foi contado, e sem número quando é zero). Na tela de Minhas
 * tarefas, o item fica marcado como a página atual, como o espaço aberto.
 * @param {{minhasAtual?: boolean, nMinhas?: number|null}} opcoes
 */
function minhasHtml({ minhasAtual = false, nMinhas = null }) {
  const n = nMinhas ? `<span class="n" title="Atrasadas e de hoje">${nMinhas}</span>` : "";
  return `<button type="button" class="lateral-acao lateral-minhas${minhasAtual ? " atual" : ""}" data-item="minhasTarefas"${minhasAtual ? ' aria-current="page"' : ""}>${ICONES.concluida}Minhas tarefas${n}</button>`;
}

/**
 * Desenha a barra e o menu lateral.
 * @param {{espacos: object[], abertoId?: string|null, titulo?: string, usuario?: {email: string, nome?: string}|null,
 *   comLogin?: boolean, podeCriar?: boolean, podeConfigurar: (id: string) => boolean,
 *   aoAbrir: (id: string) => void, aoConfigurar: (id: string) => void, aoNovo: () => void, aoAjuda: () => void,
 *   aoSistema: () => void, aoEntrar: () => void, aoTrocarSenha: () => void, aoSair: () => void,
 *   aoMinhasTarefas?: (() => void)|null, minhasAtual?: boolean, nMinhas?: number|null}} opcoes
 */
export function mostrarNavegacao(opcoes) {
  const { espacos, abertoId = null, titulo = "", usuario = null, comLogin = true, podeCriar = true, podeConfigurar } = opcoes;
  acoes = {
    aoAbrir: opcoes.aoAbrir, aoConfigurar: opcoes.aoConfigurar, novo: opcoes.aoNovo, ajuda: opcoes.aoAjuda,
    sistema: opcoes.aoSistema, buscar: opcoes.aoBuscar, entrar: opcoes.aoEntrar, trocarSenha: opcoes.aoTrocarSenha, sair: opcoes.aoSair,
    minhasTarefas: opcoes.aoMinhasTarefas,
    lixeira: opcoes.aoLixeira, consulta: opcoes.aoConsulta, extracao: opcoes.aoExtracao, instalar: opcoes.aoInstalar,
  };
  if (!ligado) ligar();
  /* sem espaço aberto, o título de nível 1 é o nome do sistema, só para leitores de tela (24/10/2026) */
  const h1 = document.querySelector("[data-titulo]");
  h1.textContent = titulo || NOME;
  h1.classList.toggle("so-leitor", !titulo);

  const contaHtml = usuario
    ? `<button class="conta" type="button" data-abrir-conta aria-expanded="false" aria-controls="menu-conta">
        <span class="selo-conta" aria-hidden="true">${esc(iniciais(usuario.nome || usuario.email.split("@")[0]))}</span>
        <span class="conta-texto">${usuario.nome ? `<b>${esc(usuario.nome)}</b>` : ""}<small>${esc(usuario.email)}</small></span>${ICONES.abrir}</button>
      <div class="conta-menu" id="menu-conta" data-menu-conta hidden>
        ${usuario.nome ? "" : '<p class="tec">Sem responsável ligado a este e-mail neste espaço.</p>'}
        <div class="conta-tema" role="group" aria-label="Tema neste aparelho"><span>Tema</span>
          <div class="alternador dois">${PALETAS.map(([v, nome]) => `<button type="button" data-paleta="${v}" aria-pressed="${v === lerPaleta()}">${nome}</button>`).join("")}</div></div>
        <div class="conta-tema" role="group" aria-label="Modo claro ou escuro neste aparelho"><span>Modo</span>
          <div class="alternador">${TEMAS.map(([v, nome]) => `<button type="button" data-tema="${v}" aria-pressed="${v === lerTema()}">${nome}</button>`).join("")}</div></div>
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
    ${opcoes.aoBuscar ? `<button type="button" class="lateral-acao lateral-buscar" data-item="buscar" aria-keyshortcuts="Control+K Meta+K">${ICONES.buscar}Buscar<kbd>${atalhoDaBusca()}</kbd></button>` : ""}
    ${podeCriar ? `<button type="button" class="lateral-acao lateral-novo" data-item="novo">${ICONES.mais}Novo espaço</button>` : ""}
    ${opcoes.aoMinhasTarefas ? minhasHtml(opcoes) : ""}
    <nav class="lateral-espacos" aria-label="Espaços">
      ${grupos.map((g) => `<section class="lateral-grupo"><h2 class="lateral-rotulo lateral-titulo-grupo">${g.tipo ? `<span class="lateral-icone-grupo" aria-hidden="true">${ICONES[ICONE_DO_TIPO[g.tipo]] ?? ""}</span>` : ""}${g.titulo}</h2>
      <ul>${g.espacos.map(itemHtml).join("")}</ul></section>`).join("")}
      ${espacos.length ? "" : `<p class="vazio">${!usuario && comLogin ? "Entre com seu e-mail e senha para ver os seus espaços." : "Nenhum espaço seu ainda."}</p>`}
      ${encerrados.length ? `<details class="lateral-encerrados"${encerrados.some((e) => e.id === abertoId) ? " open" : ""}>
        <summary class="lateral-rotulo">Encerrados <span class="n">${encerrados.length}</span></summary>
        <ul>${encerrados.map(itemHtml).join("")}</ul></details>` : ""}
    </nav>
    <div class="lateral-pe">
      <details class="lateral-mais" data-lateral-mais${lerMais() ? " open" : ""}>
        <summary class="lateral-acao">${ICONES.opcoes}Mais<span class="lateral-mais-seta" aria-hidden="true">${ICONES.abrir}</span></summary>
        <div class="lateral-mais-itens">
          ${opcoes.aoConsulta ? `<button type="button" class="lateral-acao" data-item="consulta" title="Espaços públicos e institucionais de que você não participa">${ICONES.olho}Espaços abertos à consulta${opcoes.nConsulta ? ` <span class="n">${opcoes.nConsulta}</span>` : ""}</button>` : ""}
          <button type="button" class="lateral-acao" data-item="lixeira">${ICONES.lixeira}Lixeira</button>
          ${opcoes.aoExtracao ? `<button type="button" class="lateral-acao" data-item="extracao" title="Planilha ou PDF com os dados dos espaços">${ICONES.modoPlanilha}Extração de dados</button>` : ""}
          <a class="lateral-acao" href="../strata/" title="Strata: o desdobramento do PEI/PDI até os Planos de Ação">${ICONES.modoRede}Gestão da estratégia</a>
          ${opcoes.aoInstalar ? `<button type="button" class="lateral-acao" data-item="instalar" title="Pôr o Sextante na tela inicial, como um aplicativo">${ICONES.instalar}Instalar como aplicativo</button>` : ""}
        </div>
      </details>
      <button type="button" class="lateral-acao" data-item="ajuda">${ICONES.ajuda}Ajuda e manual</button>
      ${usuario || !comLogin ? `<button type="button" class="lateral-acao" data-item="sistema">${ICONES.sistema}Configurar o sistema</button>` : ""}
    </div>`;
}
