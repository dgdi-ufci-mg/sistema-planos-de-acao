/**
 * Peças comuns de tela: painel lateral, que desliza da direita, e aviso curto.
 * O painel "de baixo" sobe da parte de baixo da tela no celular (como "Filtros e ordem").
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
    <aside class="painel" role="dialog" aria-modal="true" aria-label="${titulo}">
      <header><h2>${titulo}</h2><button class="botao" type="button" data-fechar>${botao}</button></header>
      <div class="painel-corpo">${conteudoHtml}</div>
    </aside>`;
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

/** Aviso curto no rodapé da tela, que some sozinho. */
export function avisar(texto) {
  let aviso = document.querySelector(".aviso-curto");
  if (!aviso) {
    aviso = document.createElement("div");
    aviso.className = "aviso-curto";
    aviso.setAttribute("role", "status");
    document.body.append(aviso);
  }
  aviso.textContent = texto;
  aviso.hidden = false;
  clearTimeout(avisar.relogio);
  avisar.relogio = setTimeout(() => { aviso.hidden = true; }, 4000);
}
