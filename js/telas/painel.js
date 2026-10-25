/**
 * Peças comuns de tela: painel lateral, que desliza da direita, e aviso curto.
 * O painel "de baixo" sobe da parte de baixo da tela no celular (como "Filtros e exibição").
 * A "janela" fica no centro da tela no computador e sobe de baixo no celular (janela da ação).
 */
let fecharAtual = null;

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
      <header role="none"><h2>${titulo}</h2><button class="botao" type="button" data-fechar>${botao}</button></header>
      <div class="painel-corpo">${conteudoHtml}</div>
    </div>`;
  document.body.append(camada);
  requestAnimationFrame(() => requestAnimationFrame(() => camada.classList.add("aberta")));
  const aoTeclar = (e) => { if (e.key === "Escape" && !e.defaultPrevented) fecharPainel(); };
  camada.addEventListener("click", (e) => { if (e.target.closest("[data-fechar]")) fecharPainel(); });
  document.addEventListener("keydown", aoTeclar);
  fecharAtual = () => {
    document.removeEventListener("keydown", aoTeclar);
    fecharAtual = null;
    camada.classList.remove("aberta");
    const animado = getComputedStyle(camada.querySelector(".painel")).transitionDuration !== "0s";
    if (!animado) { camada.remove(); aoFechar?.(); return; }
    camada.addEventListener("transitionend", () => camada.remove(), { once: true });
    setTimeout(() => camada.remove(), 500); /* se a animação não terminar (aba em segundo plano) */
    aoFechar?.();
  };
  camada.querySelector(".painel [data-fechar]").focus();
  return camada.querySelector(".painel-corpo");
}

export function fecharPainel() { fecharAtual?.(); }

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
    const terminar = (valor) => {
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
