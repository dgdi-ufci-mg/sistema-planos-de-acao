/**
 * Peças comuns de tela: painel lateral, que desliza da direita, e aviso curto.
 * O painel "de baixo" sobe da parte de baixo da tela no celular (como "Filtros e exibição").
 * A "janela" fica no centro da tela no computador e sobe de baixo no celular (janela da ação).
 */
import { abrirCamada } from "./voltar.js";

let fecharAtual = null;

/* teclado virtual (item 15 da avaliação de celular, 25/10/2026): no iPhone, o teclado cobre o que está preso ao pé
   da tela, como o botão "Criar ação" da janela que sobe de baixo. A altura coberta vira a variável --teclado, que
   sobe essas janelas (css). Usa a área visível da tela (visualViewport), onde o navegador a oferece. */
const vv = globalThis.visualViewport;
if (vv) {
  const medir = () => {
    const coberto = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty("--teclado", `${coberto > 80 ? coberto : 0}px`);
  };
  vv.addEventListener("resize", medir);
  vv.addEventListener("scroll", medir);
}

/**
 * Abre um painel com título e conteúdo; Esc, o botão Fechar ou o fundo escurecido fecham.
 * Esc fecha, a menos que algo dentro do painel já tenha tratado a tecla (por exemplo, cancelar uma edição).
 * @param {string} titulo  texto simples
 * @param {{deBaixo?: boolean, janela?: boolean, botao?: string, aoFechar?: () => void}} [opcoes]
 *   botao: texto do botão de fechar; aoFechar: chamado depois de fechar
 */
export function abrirPainel(titulo, conteudoHtml, { deBaixo = false, janela = false, botao = "Fechar", aoFechar } = {}) {
  fecharPainel();
  const camada = document.createElement("div");
  camada.className = janela ? "camada de-baixo janela" : deBaixo ? "camada de-baixo" : "camada";
  camada.innerHTML = `
    <div class="fundo-escuro" data-fechar></div>
    <div class="painel" role="dialog" aria-modal="true" aria-label="${titulo}">
      ${deBaixo || janela ? '<div class="alca" aria-hidden="true"></div>' : ""}
      <header role="none"><h2>${titulo}</h2><button class="botao" type="button" data-fechar>${botao}</button></header>
      <div class="painel-corpo">${conteudoHtml}</div>
    </div>`;
  document.body.append(camada);
  requestAnimationFrame(() => requestAnimationFrame(() => camada.classList.add("aberta")));
  const aoTeclar = (e) => { if (e.key === "Escape" && !e.defaultPrevented) fecharPainel(); };
  camada.addEventListener("click", (e) => { if (e.target.closest("[data-fechar]")) fecharPainel(); });
  document.addEventListener("keydown", aoTeclar);
  /* Voltar (celular) fecha o painel (item 1 da avaliação de celular) */
  const soltar = abrirCamada(() => { if (fecharAtual === fechar) fecharPainel(); });
  const fechar = () => {
    soltar();
    document.removeEventListener("keydown", aoTeclar);
    fecharAtual = null;
    camada.classList.remove("aberta");
    const animado = getComputedStyle(camada.querySelector(".painel")).transitionDuration !== "0s";
    if (!animado) { camada.remove(); aoFechar?.(); return; }
    camada.addEventListener("transitionend", () => camada.remove(), { once: true });
    setTimeout(() => camada.remove(), 500); /* se a animação não terminar (aba em segundo plano) */
    aoFechar?.();
  };
  fecharAtual = fechar;
  if (deBaixo || janela) puxarParaFechar(camada, fechar);
  camada.querySelector(".painel [data-fechar]").focus();
  return camada.querySelector(".painel-corpo");
}

export function fecharPainel() { fecharAtual?.(); }

/**
 * Janela que sobe de baixo, no celular: puxar a alça ou o cabeçalho para baixo fecha (item 6 da avaliação de
 * celular, 25/10/2026), como no iOS e no Android. A janela acompanha o dedo; soltando depois de 90 px, ou com um
 * gesto rápido para baixo, fecha; antes disso, volta ao lugar. Só no celular (até 640 px), onde a janela fica
 * presa à parte de baixo da tela.
 */
function puxarParaFechar(camada, fechar) {
  const painel = camada.querySelector(".painel");
  const puxadores = [painel.querySelector(".alca"), painel.querySelector("header")];
  let inicio = null;
  const mover = (e) => {
    if (!inicio) return;
    const dy = Math.max(0, e.clientY - inicio.y);
    painel.style.transition = "none";
    painel.style.transform = `translateY(${dy}px)`;
  };
  const soltar = (e) => {
    if (!inicio) return;
    const dy = Math.max(0, e.clientY - inicio.y);
    const rapido = dy > 30 && dy / Math.max(1, e.timeStamp - inicio.t) > 0.6;
    inicio = null;
    painel.style.transition = "";
    painel.style.transform = "";
    if (dy > 90 || rapido) fechar();
  };
  for (const el of puxadores) {
    el?.addEventListener("pointerdown", (e) => {
      if (!matchMedia("(max-width: 640px)").matches || e.target.closest("button, a, input, select, textarea")) return;
      inicio = { y: e.clientY, t: e.timeStamp };
      el.setPointerCapture(e.pointerId);
    });
    el?.addEventListener("pointermove", mover);
    el?.addEventListener("pointerup", soltar);
    el?.addEventListener("pointercancel", soltar);
  }
}

/**
 * Aviso curto no rodapé da tela, que some sozinho.
 * Com `acao` (por exemplo, "Desfazer"), mostra um botão e fica um pouco mais na tela.
 * @param {string} texto
 * @param {{acao?: {texto: string, fazer: () => void}}} [opcoes]
 */
export function avisar(texto, { acao } = {}) {
  let aviso = document.querySelector(".aviso-curto");
  if (!aviso) {
    aviso = document.createElement("div");
    aviso.className = "aviso-curto";
    aviso.setAttribute("role", "status");
    document.body.append(aviso);
  }
  aviso.textContent = texto;
  if (acao) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "aviso-acao";
    botao.textContent = acao.texto;
    botao.addEventListener("click", () => { aviso.hidden = true; acao.fazer(); });
    aviso.append(" ", botao);
  }
  aviso.hidden = false;
  clearTimeout(avisar.relogio);
  avisar.relogio = setTimeout(() => { aviso.hidden = true; }, acao ? 7000 : 4000);
}

/**
 * Pergunta antes de uma ação com consequências (exclusões): janela pequena, por cima de
 * qualquer painel aberto. Devolve os campos do formulário ao confirmar, ou null ao cancelar.
 * `validar(campos)` pode devolver uma mensagem de erro, e a janela continua aberta.
 * @param {{titulo: string, corpo: string, confirmar?: string, perigo?: boolean, validar?: (campos: object) => string|null}} pergunta
 * @returns {Promise<object|null>}
 */
export function perguntar({ titulo, corpo, confirmar = "Excluir", perigo = true, validar = () => null }) {
  return new Promise((resolver) => {
    const anterior = document.activeElement;
    const camada = document.createElement("div");
    camada.className = "dialogo-camada";
    camada.innerHTML = `
      <div class="fundo-escuro" data-cancelar></div>
      <form class="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo" novalidate>
        <h2 id="dialogo-titulo">${titulo}</h2>
        <div class="dialogo-corpo">${corpo}</div>
        <p class="erro" data-erro hidden></p>
        <div class="botoes">
          <button class="botao ${perigo ? "perigo" : "principal"}" type="submit">${confirmar}</button>
          <button class="botao" type="button" data-cancelar>Cancelar</button>
        </div>
      </form>`;
    document.body.append(camada);
    requestAnimationFrame(() => requestAnimationFrame(() => camada.classList.add("aberta")));
    const form = camada.querySelector("form");
    const soltar = abrirCamada(() => terminar(null)); // Voltar cancela o diálogo
    const terminar = (valor) => {
      soltar();
      window.removeEventListener("keydown", aoTeclar, true);
      camada.classList.remove("aberta");
      setTimeout(() => camada.remove(), 250);
      anterior?.focus?.();
      resolver(valor);
    };
    /* Esc cancela só esta janela, e não o painel que está por baixo (fase de captura) */
    const aoTeclar = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      terminar(null);
    };
    window.addEventListener("keydown", aoTeclar, true);
    camada.addEventListener("click", (e) => { if (e.target.closest("[data-cancelar]")) terminar(null); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const campos = Object.fromEntries(new FormData(form));
      const problema = validar(campos);
      if (problema) {
        const erro = form.querySelector("[data-erro]");
        erro.textContent = problema;
        erro.hidden = false;
        return;
      }
      terminar(campos);
    });
    (form.querySelector("input, select") ?? form.querySelector("[type=submit]")).focus();
  });
}
