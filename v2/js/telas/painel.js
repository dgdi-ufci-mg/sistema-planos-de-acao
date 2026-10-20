/**
 * Peças comuns de tela: painel lateral, que sobe de baixo no celular, e aviso curto.
 */
let fecharAtual = null;

/** Abre um painel com título e conteúdo; Esc, o botão Fechar ou o fundo escurecido fecham. */
export function abrirPainel(titulo, conteudoHtml) {
  fecharPainel();
  const camada = document.createElement("div");
  camada.className = "camada";
  camada.innerHTML = `
    <div class="fundo-escuro" data-fechar></div>
    <aside class="painel" role="dialog" aria-modal="true" aria-label="${titulo}">
      <header><h2>${titulo}</h2><button class="botao" type="button" data-fechar>Fechar</button></header>
      <div class="painel-corpo">${conteudoHtml}</div>
    </aside>`;
  document.body.append(camada);
  const aoTeclar = (e) => { if (e.key === "Escape") fecharPainel(); };
  camada.addEventListener("click", (e) => { if (e.target.closest("[data-fechar]")) fecharPainel(); });
  document.addEventListener("keydown", aoTeclar);
  fecharAtual = () => { camada.remove(); document.removeEventListener("keydown", aoTeclar); fecharAtual = null; };
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
