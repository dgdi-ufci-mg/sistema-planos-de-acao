/**
 * Movimento padrão das telas (especificação, seção 2, "Movimento com sentido"; passo 1.14b):
 * o que aparece ou some na tela entra e sai com uma transição curta, para a pessoa perceber
 * de onde veio e para onde foi. Quem ativou "Reduzir movimento" no aparelho não vê animação.
 * As durações e a curva são as mesmas das variáveis --mov e --mov-curva do CSS.
 */
export const DURACAO = 250; // ms; igual a --mov
export const CURVA = "cubic-bezier(.2, 0, 0, 1)"; // igual a --mov-curva: começa macio e assenta devagar

export const reduzirMovimento = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;

/**
 * Medidas do elemento aberto e do elemento "achatado" (altura, folgas e bordas zero e, numa
 * coluna flexível, sem o espaço entre itens), para que abrir e fechar não deixem salto no fim.
 * flexShrink 0: dentro de um painel com rolagem (coluna flexível), o elemento com overflow
 * escondido seria espremido até a altura mínima, e a animação não apareceria (falha de 21/10/2026).
 */
function medidas(el) {
  const cs = getComputedStyle(el);
  const pai = el.parentElement ? getComputedStyle(el.parentElement) : null;
  const vao = pai && /flex|grid/.test(pai.display) ? parseFloat(pai.rowGap) || 0 : 0;
  const lado = el.previousElementSibling ? "marginTop" : "marginBottom";
  const comum = { overflow: "hidden", boxSizing: "border-box", flexShrink: 0 };
  const aberto = {
    ...comum, height: `${el.getBoundingClientRect().height}px`, opacity: 1, transform: "none",
    paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderTopWidth: cs.borderTopWidth,
    borderBottomWidth: cs.borderBottomWidth, [lado]: cs[lado],
  };
  const achatado = {
    ...comum, height: "0px", opacity: 0, transform: "translateY(-4px)",
    paddingTop: "0px", paddingBottom: "0px", borderTopWidth: "0px", borderBottomWidth: "0px",
    [lado]: `${(parseFloat(cs[lado]) || 0) - (el.previousElementSibling || el.nextElementSibling ? vao : 0)}px`,
  };
  return { aberto, achatado };
}

/** Abre o elemento crescendo a partir da altura zero, com o conteúdo surgindo. */
export function abrirSuave(el) {
  if (!el || reduzirMovimento()) return;
  const { aberto, achatado } = medidas(el);
  el.animate([achatado, aberto], { duration: DURACAO, easing: CURVA });
}

/** Fecha o elemento encolhendo até a altura zero; resolve quando terminar. */
export function fecharSuave(el) {
  if (!el || reduzirMovimento()) return Promise.resolve();
  const { aberto, achatado } = medidas(el);
  const animacao = el.animate([aberto, achatado], { duration: DURACAO, easing: CURVA, fill: "forwards" });
  return animacao.finished.catch(() => {});
}

/** Faz o elemento surgir no lugar, sem mudar a altura (editores que substituem um valor). */
export function surgir(el) {
  if (!el || reduzirMovimento()) return;
  el.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: DURACAO, easing: CURVA });
}

/**
 * Seções recolhíveis (<details>) abrem e fecham deslizando, em vez de saltar.
 * Liga uma vez na raiz; vale para todas as seções dentro dela, inclusive as redesenhadas.
 */
export function ligarSecoesSuaves(raiz) {
  raiz.addEventListener("click", (e) => {
    const resumo = e.target.closest("summary");
    const secao = resumo?.parentElement;
    if (!secao || secao.tagName !== "DETAILS" || !raiz.contains(secao) || reduzirMovimento()) return;
    e.preventDefault();
    const abrir = !secao.open;
    const de = secao.getBoundingClientRect().height;
    secao.open = !secao.open; // mede a outra altura
    const ate = secao.getBoundingClientRect().height;
    if (!abrir) secao.open = true; // ao fechar, o conteúdo fica à vista até o fim do movimento
    const animacao = secao.animate([
      { height: `${de}px`, overflow: "hidden", boxSizing: "border-box", flexShrink: 0 },
      { height: `${ate}px`, overflow: "hidden", boxSizing: "border-box", flexShrink: 0 },
    ], { duration: DURACAO, easing: CURVA, fill: abrir ? "none" : "forwards" });
    if (!abrir) animacao.finished.then(() => { secao.open = false; animacao.cancel(); }).catch(() => {});
  });
}

/**
 * Troca um bloco por outro sem salto: uma cópia do que sai encolhe no lugar, ao mesmo tempo
 * que o que entra cresce. Usado quando um redesenho substitui, por exemplo, os botões
 * "Reestimar" e "Registrar conclusão" pelo formulário, e o contrário.
 * @param {{sai: Element|null, redesenhar: () => void, entra: () => Element|null, lado: "antes"|"depois"}} troca
 *   lado: onde o que sai estava em relação ao que entra
 */
export function trocarSuave({ sai, redesenhar, entra, lado }) {
  const fantasma = sai && !reduzirMovimento() ? sai.cloneNode(true) : null;
  redesenhar();
  const novo = entra();
  if (!novo) return;
  if (fantasma) {
    fantasma.setAttribute("aria-hidden", "true");
    fantasma.inert = true;
    novo[lado === "antes" ? "before" : "after"](fantasma);
    fecharSuave(fantasma).then(() => fantasma.remove());
  }
  abrirSuave(novo);
}
