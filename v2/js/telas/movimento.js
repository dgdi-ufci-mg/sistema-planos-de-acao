/**
 * Movimento padrão das telas (especificação, seção 2, "Movimento com sentido"; passo 1.14b):
 * o que aparece ou some na tela entra e sai com uma transição curta, para a pessoa perceber
 * de onde veio e para onde foi. Quem ativou "Reduzir movimento" no aparelho não vê animação.
 * As durações e a curva são as mesmas das variáveis --mov e --mov-curva do CSS.
 */
export const DURACAO = 250; // ms; igual a --mov
export const CURVA = "cubic-bezier(.2, .7, .2, 1)"; // igual a --mov-curva

export const reduzirMovimento = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;

/** Abre o elemento crescendo a partir da altura zero, com o conteúdo surgindo. */
export function abrirSuave(el) {
  if (!el || reduzirMovimento()) return;
  const altura = el.getBoundingClientRect().height;
  el.animate([
    { height: "0px", opacity: 0, overflow: "hidden", transform: "translateY(-4px)" },
    { height: `${altura}px`, opacity: 1, overflow: "hidden", transform: "none" },
  ], { duration: DURACAO, easing: CURVA });
}

/** Fecha o elemento encolhendo até a altura zero; resolve quando terminar. */
export function fecharSuave(el) {
  if (!el || reduzirMovimento()) return Promise.resolve();
  const altura = el.getBoundingClientRect().height;
  const animacao = el.animate([
    { height: `${altura}px`, opacity: 1, overflow: "hidden" },
    { height: "0px", opacity: 0, overflow: "hidden", transform: "translateY(-4px)" },
  ], { duration: DURACAO * 0.8, easing: CURVA, fill: "forwards" });
  return animacao.finished.catch(() => {});
}
