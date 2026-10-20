/**
 * Seletor com busca (especificação, seção 8.3): ao digitar, aparecem as opções que contêm
 * o texto; setas e Enter escolhem; Esc limpa. Usado nas dependências e nos responsáveis.
 * Os eventos ficam na raiz (delegação), então a tela pode redesenhar o seletor à vontade.
 */

/** HTML de um seletor. `nome` identifica o seletor na raiz. */
export function seletorHtml(nome, dica) {
  return `<div class="seletor-busca" data-seletor="${nome}">
    <input type="text" autocomplete="off" placeholder="${dica}" aria-label="${dica}" data-buscar="${nome}"
      role="combobox" aria-expanded="false" aria-controls="sugestoes-${nome}" aria-autocomplete="list">
    <ul class="sugestoes" id="sugestoes-${nome}" role="listbox" hidden></ul>
  </div>`;
}

/**
 * Liga os seletores de uma raiz.
 * @param {HTMLElement} raiz
 * @param {Record<string, {opcoes: (texto: string) => {html: string, escolher: () => any}[], vazio: string}>} configuracoes
 * @param {{aoErro?: (e: Error) => void}} [opcoes]
 * @returns {{desenhar: () => void}} desenhar: chamar depois de redesenhar a raiz
 */
export function ligarSeletores(raiz, configuracoes, { aoErro = () => {} } = {}) {
  /* recolhida: depois de uma escolha, a lista fica fechada até a pessoa digitar, clicar ou usar as setas */
  const estado = Object.fromEntries(Object.keys(configuracoes).map((n) => [n, { texto: "", indice: 0, opcoes: [], recolhida: false }]));

  function desenhar() {
    for (const [nome, cfg] of Object.entries(configuracoes)) {
      const caixa = raiz.querySelector(`[data-seletor="${nome}"]`);
      if (!caixa) continue;
      const entrada = caixa.querySelector("input");
      const ul = caixa.querySelector("ul");
      const e = estado[nome];
      if (entrada.value !== e.texto) entrada.value = e.texto;
      const aberta = document.activeElement === entrada && !e.recolhida;
      e.opcoes = aberta ? cfg.opcoes(e.texto) : [];
      e.indice = Math.min(e.indice, Math.max(0, e.opcoes.length - 1));
      ul.innerHTML = e.opcoes.length
        ? e.opcoes.map((o, i) => `<li role="option" id="sug-${nome}-${i}" data-sugestao="${i}" aria-selected="${i === e.indice}">${o.html}</li>`).join("")
        : `<li class="vazio">${cfg.vazio}</li>`;
      ul.hidden = !aberta;
      entrada.setAttribute("aria-expanded", String(aberta));
      entrada.setAttribute("aria-activedescendant", e.opcoes.length ? `sug-${nome}-${e.indice}` : "");
    }
  }

  async function escolher(nome, indice) {
    const opcao = estado[nome].opcoes[indice];
    if (!opcao) return;
    estado[nome].texto = "";
    estado[nome].indice = 0;
    estado[nome].recolhida = true;
    try {
      await opcao.escolher();
    } catch (erro) {
      aoErro(erro);
    }
    raiz.querySelector(`[data-buscar="${nome}"]`)?.focus();
    desenhar();
  }

  raiz.addEventListener("input", (e) => {
    const nome = e.target.dataset?.buscar;
    if (!nome || !estado[nome]) return;
    estado[nome].texto = e.target.value;
    estado[nome].indice = 0;
    estado[nome].recolhida = false;
    desenhar();
  });
  raiz.addEventListener("focusin", (e) => { if (estado[e.target.dataset?.buscar]) desenhar(); });
  raiz.addEventListener("pointerdown", (e) => {
    const s = estado[e.target.dataset?.buscar];
    if (s?.recolhida) { s.recolhida = false; setTimeout(desenhar, 0); }
  });
  raiz.addEventListener("focusout", (e) => { if (estado[e.target.dataset?.buscar]) setTimeout(desenhar, 0); });
  /* a sugestão é escolhida no clique; o mousedown não pode tirar o foco da busca antes disso */
  raiz.addEventListener("mousedown", (e) => { if (e.target.closest("[data-sugestao]")) e.preventDefault(); });
  raiz.addEventListener("click", (e) => {
    const sug = e.target.closest("[data-sugestao]");
    if (sug) escolher(sug.closest("[data-seletor]").dataset.seletor, Number(sug.dataset.sugestao));
  });
  raiz.addEventListener("keydown", (e) => {
    const nome = e.target.dataset?.buscar;
    const s = estado[nome];
    if (!s) return;
    const n = s.opcoes.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (s.recolhida) { s.recolhida = false; desenhar(); return; }
      s.indice = (s.indice + (e.key === "ArrowDown" ? 1 : -1) + n) % Math.max(n, 1);
      desenhar();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!s.recolhida) escolher(nome, s.indice);
    } else if (e.key === "Escape" && s.texto) {
      e.preventDefault(); // limpa a busca sem fechar a janela
      s.texto = "";
      desenhar();
    }
  });

  return { desenhar };
}
