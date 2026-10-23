/**
 * Medida de velocidade com planos grandes (lote de 22/10/2026). Não faz parte dos testes automáticos:
 * rode à mão, dentro de v2/, com `node testes/desempenho.mjs`. Plano sintético, com semente fixa.
 */
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { simular } from "../js/simulacao.js";
import { montarRede } from "../js/rede.js";
/* plano sintético: 10 etapas de 20 ações, dependências para 1 a 3 ações anteriores próximas, semente fixa */
let x = 20261022; const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
for (const N of [50, 100, 200, 300]) {
  const acoes = [];
  for (let n = 1; n <= N; n++) {
    const deps = [];
    const k = n === 1 ? 0 : 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < k; i++) { const d = Math.max(1, n - 1 - Math.floor(rnd() * 12)); if (d < n && !deps.includes(d)) deps.push(d); }
    const m = 2 + Math.floor(rnd() * 10);
    acoes.push({ numero: n, ordem: n, etapa: `E${Math.ceil(n / (N / 10))}`, dependeDe: deps, responsaveis: [], estimativas: [{ o: m - 1, m, p: m * 2, em: "2026-10-01" }] });
  }
  const cal = criarCalendario({ inicio: "2026-10-01" }, "2026-10-22");
  let t = performance.now(); const cam = caminhoCritico(acoes, cal, { hoje: "2026-10-22" }); const tc = performance.now() - t;
  t = performance.now(); simular(acoes, cal, { hoje: "2026-10-22", semente: 20261014, simulacoes: 10000 }); const ts = performance.now() - t;
  const marcos = [...new Set(acoes.map((a) => a.etapa))].map((e) => ({ id: e, nome: e }));
  t = performance.now(); const r = montarRede(acoes, cam, { marcos, marcoDe: (a) => a.etapa }); const tr = performance.now() - t;
  const saltos = r.arestas.reduce((s, a) => s + a.saltos.length, 0);
  console.log(`${N} ações: caminho ${tc.toFixed(0)} ms · simulação ${ts.toFixed(0)} ms · rede ${tr.toFixed(0)} ms (${r.largura}×${Math.round(r.altura)} px, ${saltos} saltos)`);
}
