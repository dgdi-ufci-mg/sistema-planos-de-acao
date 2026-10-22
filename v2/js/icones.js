/**
 * Ícones do sistema, em SVG, no lugar de emojis (especificação, seção 16.2):
 * mesmo traço em todos, cor herdada do texto, iguais em qualquer aparelho.
 */

const svg = (conteudo) =>
  `<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${conteudo}</svg>`;

export const ICONES = Object.freeze({
  /** Modo Lista: linhas com marcadores. */
  modoLista: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".6"/><circle cx="4.5" cy="12" r=".6"/><circle cx="4.5" cy="18" r=".6"/>'),
  /** Modo Quadro: três colunas de alturas diferentes, como um Kanban. */
  modoQuadro: svg('<rect x="3" y="4" width="5" height="15" rx="1.5"/><rect x="9.5" y="4" width="5" height="10" rx="1.5"/><rect x="16" y="4" width="5" height="13" rx="1.5"/>'),
  /** Modo Planilha: grade de células. */
  modoPlanilha: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.5h18M9 4v16M15 4v16"/>'),
  /** Cronograma: barras escalonadas no tempo. */
  modoCronograma: svg('<path d="M4 6h8M8 12h9M13 18h7"/>'),
  /** Rede: caixas ligadas por setas. */
  modoRede: svg('<rect x="2.5" y="9" width="6" height="6" rx="1.5"/><rect x="15.5" y="3.5" width="6" height="6" rx="1.5"/><rect x="15.5" y="14.5" width="6" height="6" rx="1.5"/><path d="M8.5 12h3.5V6.5h3.5M12 12v5.5h3.5"/>'),
  /** Linha do tempo: eixo com a curva da chance de terminar. */
  modoLinha: svg('<path d="M3 4v16h18"/><path d="M6 17c5 0 6-10 14-11"/>'),
  /** Barra do tempo restante: cronômetro (22/10/2026). */
  barraTempo: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2M9.5 3h5M12 3v3"/>'),
  /** Barra da prioridade de execução: raio. */
  barraExecucao: svg('<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>'),
  /** Barra da prioridade de revisão: lupa. */
  /** Colunas da lista: três colunas. */
  colunas: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>'),
  barraRevisao: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>'),
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
  /** Filtros: três linhas de tamanhos diferentes. */
  filtros: svg('<path d="M4 6h16M7 12h10M10 18h4"/>'),
  /** Seguir: seta para a direita, no fim de um item que abre algo. */
  seguir: svg('<path d="m9 6 6 6-6 6"/>'),
  /** Menu lateral: três linhas iguais. */
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  /** Configurar: engrenagem. */
  engrenagem: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  /** Ajuda: ponto de interrogação num círculo. */
  ajuda: svg('<circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.9M12 17.2v.1"/>'),
  /** Configurar o sistema: controles deslizantes. */
  sistema: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  /** Filtrar: funil. */
  funil: svg('<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>'),
  /** Ordenar: setas para cima e para baixo. */
  ordenar: svg('<path d="M8 4v16M4.5 7.5 8 4l3.5 3.5M16 20V4M12.5 16.5 16 20l3.5-3.5"/>'),
  /** Legenda: lista com amostras. */
  legenda: svg('<rect x="4" y="5" width="4" height="4" rx="1"/><rect x="4" y="15" width="4" height="4" rx="1"/><path d="M11 7h9M11 17h9"/>'),
  /** Lixeira: cesto com tampa. */
  lixeira: svg('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>'),
  /** Fechar: xis. */
  fechar: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
});
