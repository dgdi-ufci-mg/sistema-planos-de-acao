/**
 * Identidade do sistema, num lugar só.
 * Trocar o nome do sistema é mudar a linha abaixo (documentação técnica, seção 3.1) e, por serem arquivos
 * estáticos, lidos pelo celular sem rodar este código, também o `sextante/manifest.webmanifest` e o
 * `apple-mobile-web-app-title` do `sextante/index.html` (aplicativo instalável). Um teste
 * (`testes/aplicativo.test.js`) confere que estão iguais.
 */
export const NOME = "Sextante";
export const INSTITUICAO = "UFCI-MG";
/** Nome da instituição por extenso: aparece sob o título do Strata, no alto do Mapa em tela cheia (29/10/2026). */
export const INSTITUICAO_POR_EXTENSO = "Universidade Federal de Ciência e Inovação de Minas Gerais";
