/**
 * Apoio aos testes de navegador (documentação técnica, seção 3.2, "Testes de navegador").
 *
 * Os testes desta pasta abrem o sistema num Chromium de verdade, pelo Playwright, e simulam o uso: tocar, segurar e
 * deslizar cartões, abrir e fechar janelas, apertar Voltar, mudar a largura da tela. Servem de rede de segurança para
 * o comportamento de tela, que os testes das regras puras não alcançam.
 *
 * O Playwright **não** é dependência do repositório: se não estiver instalado na máquina, os testes desta pasta são
 * pulados, com um aviso, e o `node --test` continua passando. Para rodá-los, instale o Playwright e o Chromium
 * (fora do repositório) ou aponte a variável PLAYWRIGHT_MODULO para a pasta do pacote. Com SEM_NAVEGADOR=1, eles são
 * pulados de propósito, para uma rodada rápida.
 *
 * Tudo roda só na memória: o `config.js` é interceptado e devolve `FIREBASE_CONFIG = null`, e os testes usam o
 * "Ver um exemplo". Nada é gravado no Firebase.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

/** Procura o Playwright: no próprio Node, na variável PLAYWRIGHT_MODULO ou na pasta global do npm. */
async function carregarPlaywright() {
  try { return await import("playwright"); } catch { /* segue */ }
  const lugares = [process.env.PLAYWRIGHT_MODULO, "/opt/npm-tools/node_modules/playwright"];
  try { lugares.push(join(execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(), "playwright")); } catch { /* sem npm */ }
  for (const lugar of lugares.filter(Boolean)) {
    try { return createRequire(join(lugar, "package.json"))(lugar); } catch { /* segue */ }
  }
  return null;
}

/* SEM_NAVEGADOR=1 pula estes testes de propósito, para uma rodada rápida só das regras */
const playwright = process.env.SEM_NAVEGADOR ? null : await carregarPlaywright();
/** Motivo para pular os testes, ou `false` quando o navegador está disponível. */
export const pular = process.env.SEM_NAVEGADOR ? "SEM_NAVEGADOR ligado (testes de navegador pulados)"
  : playwright ? false : "Playwright não instalado nesta máquina (testes de navegador pulados)";

const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

/** Servidor estático da raiz do repositório, numa porta livre. */
async function servir() {
  const servidor = createServer(async (req, res) => {
    let caminho = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (caminho.endsWith("/")) caminho += "index.html";
    const arquivo = normalize(join(RAIZ, caminho));
    if (!arquivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    try {
      const corpo = await readFile(arquivo);
      res.writeHead(200, { "content-type": TIPOS[extname(arquivo)] ?? "application/octet-stream", "cache-control": "no-store" }).end(corpo);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  return { servidor, endereco: `http://127.0.0.1:${servidor.address().port}/` };
}

/**
 * Abre o navegador e o servidor, uma vez por arquivo de teste.
 * @returns {Promise<{abrir: (opcoes?: object) => Promise<import("playwright").Page>, fechar: () => Promise<void>}>}
 */
export async function iniciar() {
  const { servidor, endereco } = await servir();
  const navegador = await playwright.chromium.launch({ args: ["--lang=pt-BR"] });
  const contextos = [];
  /**
   * Abre uma página nova, já com o exemplo aberto.
   * @param {{largura?: number, altura?: number, toque?: boolean, tema?: "light"|"dark", exemplo?: boolean}} [o]
   */
  async function abrir({ largura = 390, altura = 800, toque = largura <= 640, tema = "light", exemplo = true } = {}) {
    const contexto = await navegador.newContext({
      viewport: { width: largura, height: altura }, hasTouch: toque, isMobile: toque, locale: "pt-BR", colorScheme: tema,
    });
    contextos.push(contexto);
    await contexto.route("**/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: "export const FIREBASE_CONFIG = null;" }));
    /* nada sai para a internet: fontes e CDN ficam de fora (o sistema usa as fontes de reserva) */
    await contexto.route((url) => !url.href.startsWith(endereco), (r) => r.abort());
    const pagina = await contexto.newPage();
    pagina.erros = [];
    pagina.on("pageerror", (e) => pagina.erros.push(e.message));
    await pagina.goto(endereco + "sextante/");
    if (exemplo) {
      await pagina.click("[data-acao=exemplo]");
      await pagina.waitForSelector(".linha[data-abrir-acao]");
      await pagina.waitForTimeout(300);
    }
    return pagina;
  }
  async function fechar() {
    for (const c of contextos) await c.close();
    await navegador.close();
    await new Promise((r) => servidor.close(r));
  }
  return { abrir, fechar };
}

/** Espera as transições de abrir e fechar (0,25 s) terminarem. */
export const assentar = (pagina, ms = 450) => pagina.waitForTimeout(ms);

/** Quantas janelas e painéis (camadas) estão abertos. */
export const camadasAbertas = (pagina) => pagina.locator(".camada.aberta").count();

/**
 * Gestos de toque reais, pelo protocolo do Chromium: geram eventos de ponteiro do tipo "touch", como num celular.
 * @param {import("playwright").Page} pagina
 */
export async function dedo(pagina) {
  const cdp = await pagina.context().newCDPSession(pagina);
  const tocar = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  return {
    /** Arrasta o dedo de (x, y) por (dx, dy), em passos, com uma pausa antes de soltar. */
    async arrastar(x, y, dx, dy, { passos = 12, pausaInicial = 0 } = {}) {
      await tocar("touchStart", x, y);
      if (pausaInicial) await pagina.waitForTimeout(pausaInicial);
      for (let i = 1; i <= passos; i++) {
        await tocar("touchMove", x + (dx * i) / passos, y + (dy * i) / passos);
        await pagina.waitForTimeout(16);
      }
      await tocar("touchEnd");
    },
    /** Encosta o dedo e o deixa na tela (terminar com `cancelar` ou `soltar`). */
    encostar: (x, y) => tocar("touchStart", x, y),
    /** Solta o dedo. */
    soltar: () => tocar("touchEnd"),
    /** Interrompe o toque, como quando o sistema assume o gesto. */
    cancelar: () => cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }),
    /** Segura o dedo parado. */
    async segurar(x, y, ms = 700) {
      await tocar("touchStart", x, y);
      await pagina.waitForTimeout(ms);
      await tocar("touchEnd");
    },
  };
}

/** Centro de um elemento, para os gestos. */
export async function centro(locator) {
  const r = await locator.boundingBox();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, r };
}
