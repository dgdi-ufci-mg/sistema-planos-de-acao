/**
 * Service worker do aplicativo instalável (passo da seção 13.2, "Aplicativo para celular"; documentação técnica,
 * seção 8, "Instalar como aplicativo"). Não guarda nada em cache, de propósito: cada abertura busca a versão
 * publicada, e uma mudança no site chega ao aplicativo instalado como chega ao navegador. O sistema precisa de
 * internet de qualquer forma (Firebase). Sem conexão, as páginas do próprio site mostram um aviso simples, no
 * lugar da página de erro do navegador.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

const SEM_CONEXAO = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sem conexão</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:16px/1.5 system-ui,sans-serif;background:#F5F3EF;color:#173B36;padding:24px;text-align:center}
@media (prefers-color-scheme: dark){body{background:#0F1A19;color:#E6EFEC}}button{font:inherit;margin-top:12px;padding:8px 16px;border-radius:8px;border:1px solid currentColor;background:none;color:inherit}</style></head>
<body><div><p><b>Sem conexão com a internet.</b></p><p>O sistema precisa de internet para abrir. Confira a conexão e tente de novo.</p>
<button onclick="location.reload()">Tentar de novo</button></div></body></html>`;

self.addEventListener("fetch", (e) => {
  /* só a abertura das páginas do próprio site; o resto (scripts, Firebase) segue direto para a rede */
  if (e.request.mode !== "navigate" || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).catch(() => new Response(SEM_CONEXAO, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
