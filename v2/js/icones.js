/**
 * Ícones do sistema, em SVG, no lugar de emojis (especificação, seção 16.2):
 * mesmo traço em todos, cor herdada do texto, iguais em qualquer aparelho.
 */

const svg = (conteudo) =>
  `<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${conteudo}</svg>`;

export const ICONES = Object.freeze({
  /** Concluída: visto num círculo. */
  concluida: svg('<circle cx="12" cy="12" r="9.5"/><path d="m8 12.5 2.7 2.7L16 9.8"/>'),
  /** Liberada: cadeado aberto. */
  liberada: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>'),
  /** Não liberada: cadeado fechado. */
  naoLiberada: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  /** Atrasada: relógio. */
  atrasada: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M5 3 2 6M19 3l3 3"/>'),
  /** Abrir lista: seta para baixo. */
  abrir: svg('<path d="m6 9 6 6 6-6"/>'),
  /** Novo: sinal de mais. */
  mais: svg('<path d="M12 5v14M5 12h14"/>'),
  /** Pessoa: menu do usuário sem login. */
  pessoa: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  /** Marcado: item escolhido numa lista. */
  marcado: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  /** Fechar: xis. */
  fechar: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
});
