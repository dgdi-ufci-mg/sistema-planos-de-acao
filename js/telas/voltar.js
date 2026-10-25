/**
 * Botão e gesto de Voltar (item 1 da avaliação de celular, 25/10/2026; documentação técnica, seção 8.7).
 *
 * No Android, e no aplicativo instalado, Voltar fechava o site inteiro, mesmo com uma janela aberta. Agora, enquanto
 * houver alguma camada aberta (painel, janela, diálogo, busca, barra lateral por cima), existe uma entrada a mais no
 * histórico do navegador; Voltar consome essa entrada e fecha a camada de cima. Se ainda restar outra, a entrada é
 * recriada. Fechar pelos botões do sistema (ou Esc) devolve a entrada, para o histórico não acumular passos vazios.
 *
 * Uma entrada só para todas as camadas, e não uma por camada: trocar um painel por outro (por exemplo, abrir a
 * configuração a partir da busca) não mexe no histórico. A devolução espera o fim da tarefa atual, para que uma
 * camada aberta logo em seguida reaproveite a entrada.
 */
const pilha = [];
let temEntrada = false;
let devolvendo = false;
/** resolvida quando o navegador termina de devolver a entrada (quem vai criar outra entrada espera por ela) */
let devolvida = Promise.resolve();
let terminarDevolucao = () => {};

/**
 * Registra uma camada aberta.
 * @param {() => void} fechar  fecha a camada (chamada quando a pessoa toca em Voltar)
 * @returns {() => void}  chamar quando a camada fechar por outro caminho
 */
export function abrirCamada(fechar) {
  pilha.push(fechar);
  if (!temEntrada && !devolvendo) {
    history.pushState({ ...(history.state ?? {}), sextanteCamada: true }, "");
    temEntrada = true;
  }
  return () => fecharCamada(fechar);
}

function fecharCamada(fechar) {
  const i = pilha.lastIndexOf(fechar);
  if (i < 0) return;
  pilha.splice(i, 1);
  if (pilha.length || !temEntrada) return;
  /* a promessa nasce já, para quem for criar outra entrada logo em seguida (abrir outro espaço) esperar */
  let resolver;
  devolvida = new Promise((r) => { resolver = r; });
  setTimeout(() => {
    if (pilha.length || !temEntrada) { resolver(); return; } // outra camada abriu e reaproveitou a entrada
    temEntrada = false;
    devolvendo = true;
    terminarDevolucao = resolver;
    history.back();
  }, 0);
}

/** Espera o navegador terminar de devolver a entrada das camadas (antes de criar outra entrada no histórico). */
export function historicoPronto() {
  return devolvida;
}

addEventListener("popstate", () => {
  if (devolvendo) {
    devolvendo = false;
    terminarDevolucao();
    if (pilha.length) { history.pushState({ ...(history.state ?? {}), sextanteCamada: true }, ""); temEntrada = true; }
    return;
  }
  if (!temEntrada) return; // Voltar entre espaços: quem cuida é a partida (js/app.js)
  temEntrada = false;
  const fechar = pilha.pop();
  fechar?.();
  if (pilha.length) { history.pushState({ ...(history.state ?? {}), sextanteCamada: true }, ""); temEntrada = true; }
});
