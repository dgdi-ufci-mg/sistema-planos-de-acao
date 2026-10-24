/**
 * Instalar como aplicativo (documentação técnica, seções 8 e 13.2): o site vira um ícone na tela inicial do
 * celular (ou um aplicativo no computador), aberto sem a barra do navegador, sem loja e sem custo.
 * Termo técnico: PWA (progressive web app). No Android e no computador, o Chrome e o Edge oferecem a instalação
 * pelo próprio sistema (evento `beforeinstallprompt`); no iPhone e no iPad, só pelo Safari, à mão.
 */
import { abrirPainel, fecharPainel, avisar } from "./painel.js";
import { NOME } from "../identidade.js";

let pedido = null;
const ouvintes = new Set();
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pedido = e; ouvintes.forEach((f) => f()); });
addEventListener("appinstalled", () => { pedido = null; ouvintes.forEach((f) => f()); });

/** Já aberto como aplicativo instalado? */
export const instalado = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
/** Avisa quando a instalação passa a estar disponível (ou deixa de estar). */
export const aoMudarInstalacao = (f) => ouvintes.add(f);

/** Registra o service worker (sw.js, na raiz), sem cache: ver o próprio arquivo. */
export function registrarAplicativo(caminho = "sw.js") {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register(caminho).catch(() => { /* sem instalação; o site segue normal */ });
}

const iPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Instala: pelo pedido do navegador, quando há; senão, mostra como fazer à mão. */
export async function instalar() {
  if (pedido) {
    const p = pedido;
    pedido = null;
    p.prompt();
    const { outcome } = await p.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (outcome === "accepted") avisar("Aplicativo instalado. Ele aparece na tela inicial ou na lista de aplicativos.");
    return;
  }
  abrirPainel("Instalar como aplicativo", `<div class="instalar">
    <p>O ${NOME} pode ficar na tela inicial do celular, como um aplicativo: abre sem a barra do navegador, sem passar por loja e sem custo. As mudanças no site chegam sozinhas ao aplicativo.</p>
    <p class="tec">Termo técnico: aplicativo instalável pelo navegador (PWA).</p>
    <h3>No iPhone e no iPad</h3>
    <ol><li>Abra o endereço no <b>Safari</b>.</li><li>Toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima).</li><li>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</li></ol>
    <h3>No Android</h3>
    <ol><li>Abra o endereço no <b>Chrome</b>.</li><li>Toque no menu <b>⋮</b>, no canto de cima.</li><li>Escolha <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</li></ol>
    <h3>No computador</h3>
    <p>No Chrome ou no Edge, clique no ícone de instalar, no fim da barra de endereço, ou no menu, em <b>Instalar ${NOME}</b>.</p>
    ${iPhone() ? '<p class="tec">Você está num iPhone ou iPad: use o Safari; os outros navegadores do iPhone podem não oferecer a opção.</p>' : ""}
    <div class="botoes"><button class="botao" type="button" data-fechar-instalar>Entendi</button></div>
  </div>`).addEventListener("click", (e) => { if (e.target.closest("[data-fechar-instalar]")) fecharPainel(); });
}
