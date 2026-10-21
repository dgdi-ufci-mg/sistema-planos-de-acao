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
 * Abre o elemento crescendo a partir da altura zero, com o conteúdo surgindo.
 * flexShrink 0: dentro de um painel com rolagem (coluna flexível), o elemento com overflow
 * escondido seria espremido até a altura mínima, e a animação não apareceria (falha de 21/10/2026).
 */
export function abrirSuave(el) {
  if (!el || reduzirMovimento()) return;
  const altura = el.getBoundingClientRect().height;
  el.animate([
    { height: "0px", opacity: 0, overflow: "hidden", flexShrink: 0, transform: "translateY(-4px)" },
    { height: `${altura}px`, opacity: 1, overflow: "hidden", flexShrink: 0, transform: "none" },
  ], { duration: DURACAO, easing: CURVA });
}

/** Fecha o elemento encolhendo até a altura zero; resolve quando terminar. */
export function fecharSuave(el) {
  if (!el || reduzirMovimento()) return Promise.resolve();
  const altura = el.getBoundingClientRect().height;
  const animacao = el.animate([
    { height: `${altura}px`, opacity: 1, overflow: "hidden", flexShrink: 0 },
    { height: "0px", opacity: 0, overflow: "hidden", flexShrink: 0, transform: "translateY(-4px)" },
  ], { duration: DURACAO * 0.8, easing: CURVA, fill: "forwards" });
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
