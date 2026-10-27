/**
 * Marca do sistema (27/10/2026): o símbolo do sextante e o logotipo (símbolo + nome), desenhados em SVG.
 *
 * O símbolo é um setor de 60° (um sexto do círculo, como o instrumento), com o braço indicador apontando um
 * ponto do arco. As cores vêm das variáveis do tema (classes `marca-*`, em `css/estilo.css`): corpo e nome em
 * `--accent` (verde-azulado), braço e pontos em `--warn` (dourado). Assim a marca acompanha os temas claro e
 * escuro. Os arquivos estáticos (`logo.png`, ícone da aba, e `icones/`, aplicativo instalável) são cópias em
 * imagem das cores do tema claro (documentação técnica, seção 3.1).
 *
 * O nome do logotipo é desenhado, e não escrito com uma fonte, para ficar igual em qualquer aparelho. Se o
 * nome do sistema mudar (`js/identidade.js`), o desenho do nome precisa ser refeito.
 */
import { NOME } from "./identidade.js";

const DESENHO_DO_SIMBOLO = `
  <path class="marca-corpo" d="M128 40L43 187.2A170 170 0 0 0 213 187.2Z" fill="none" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="marca-escala" d="M58 161.2A140 140 0 0 0 198 161.2" fill="none" stroke-width="4" stroke-linecap="round"/>
  <path class="marca-braco" d="M128 40L157.5 207.4" fill="none" stroke-width="10" stroke-linecap="round"/>
  <circle class="marca-ponto" cx="128" cy="40" r="14"/>
  <circle class="marca-ponto" cx="157.5" cy="207.4" r="9"/>`;

/** Símbolo, num quadrado. `tamanho` em px; decorativo (sem texto para o leitor de tela). */
export function simboloSvg(tamanho = 26) {
  return `<svg class="marca marca-simbolo" viewBox="32 26 192 192" width="${tamanho}" height="${tamanho}" aria-hidden="true" focusable="false">${DESENHO_DO_SIMBOLO}</svg>`;
}

/** Logotipo: símbolo à esquerda e o nome em caixa alta, com o A sem travessão (o mesmo ângulo de 60° do símbolo). */
export function logotipoSvg(altura = 32) {
  const largura = Math.round((altura * 839.4) / 158);
  return `<svg class="marca marca-logotipo" viewBox="6 46 839.4 158" width="${largura}" height="${altura}" role="img" aria-label="${NOME}" focusable="false">
  <g transform="translate(4.8 40.3) scale(0.7)">${DESENHO_DO_SIMBOLO}</g>
  <g transform="translate(-61 -5)">
    <path class="marca-nome-traco" d="M317.25 106.75C311.75 97.75 301.24 95.25 293 95.25C277.55 95.25 268.8 101.25 268.8 112.25C268.8 125.25 279.61 126.8 293 130C308.45 133.6 318.75 141 318.75 147.25C318.75 159.75 308.45 164.75 293 164.75C282.7 164.75 270.34 162.25 266.25 152.25" fill="none" stroke-width="10.5"/>
    <path class="marca-nome" d="M346 90H398V100.5H356.5V124.75H395V135.25H356.5V159.5H398V170H346Z
      M412.81 90H425.59L481.19 170H468.41Z M468.41 90H481.19L425.59 170H412.81Z
      M489 90H557V100.5H528.25V170H517.75V100.5H489Z
      M558 170L604.19 90L650.38 170H638.25L604.19 111L570.12 170Z
      M670.38 170V90H681.88L727.88 156V90H738.38V170H726.88L680.88 104V170Z
      M745.38 90H813.38V100.5H784.63V170H774.13V100.5H745.38Z
      M824.38 90H876.38V100.5H834.88V124.75H873.38V135.25H834.88V159.5H876.38V170H824.38Z"/>
  </g>
</svg>`;
}
