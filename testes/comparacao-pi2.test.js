/**
 * Teste de comparação (documentação técnica, seção 3.2): para o espaço da PI², a versão 2
 * precisa produzir as mesmas datas do caminho crítico que a versão 1.
 *
 * O cálculo da versão 1 é executado aqui mesmo, a partir de uma cópia congelada do index.html
 * dela (testes/dados/versao1-index.html), guardada na troca (passo 1.20, 23/10/2026).
 * Como a PI² não tem data de status na versão 1, as datas reais são ignoradas
 * lá; por isso a comparação é feita só com as estimativas, como a versão 1 fazia.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";

/** Extrai do index.html as funções de cálculo da versão 1. */
function calculoDaVersaoAtual() {
  const html = readFileSync(new URL("./dados/versao1-index.html", import.meta.url), "utf8");
  const inicio = html.indexOf("/* ---------- utilidades ---------- */");
  const fim = html.indexOf("/* ---------- Monte Carlo ---------- */");
  assert.ok(inicio > 0 && fim > inicio, "Não achei as seções de cálculo no index.html.");
  return new Function(`${html.slice(inicio, fim)}; return { computeDet, parseHol };`)();
}

describe("Comparação com a versão 1: PI²", () => {
  const pi2 = JSON.parse(readFileSync(new URL("./dados/pi2-fase1.json", import.meta.url), "utf8"));
  const { computeDet, parseHol } = calculoDaVersaoAtual();

  const atual = computeDet({ start: pi2.start, holidays: pi2.holidays, target: pi2.target, statusDate: "" }, pi2.tasks);
  const cal = criarCalendario({ inicio: pi2.start, datasExcluidas: parseHol(pi2.holidays).map((data) => ({ data })) });
  const acoes = pi2.tasks.map((t) => ({
    numero: t.id, ordem: t.order, dependeDe: t.preds, estimativas: [{ o: t.o, m: t.m, p: t.p }],
  }));
  const nova = caminhoCritico(acoes, cal);

  it("a versão 1 calculou sem erros", () => {
    assert.deepEqual(atual.errors, []);
  });

  it("mesma conclusão do espaço", () => {
    assert.ok(Math.abs(nova.fim - atual.det.fin) < 1e-9, `nova ${nova.fim} × atual ${atual.det.fin}`);
    assert.equal(cal.dataDeConclusao(nova.fim, 0), atual.cal.finD(atual.det.fin, 0).toISOString().slice(0, 10));
  });

  it("mesmas datas, folgas e ações críticas, ação por ação", () => {
    atual.net.list.forEach((t, i) => {
      const n = nova.porAcao.get(t.id);
      const quase = (a, b, nome) => assert.ok(Math.abs(a - b) < 1e-9, `${t.id} ${nome}: nova ${a} × atual ${b}`);
      quase(n.liberacao, atual.det.ES[i], "liberação");
      quase(n.conclusao, atual.det.EF[i], "conclusão");
      quase(n.liberacaoTardia, atual.det.LS[i], "liberação mais tarde");
      quase(n.conclusaoTardia, atual.det.LF[i], "conclusão mais tarde");
      quase(n.folga, atual.det.fl[i], "folga");
      assert.equal(n.critica, atual.det.crit[i], `${t.id}: crítica`);
      assert.equal(cal.dataDeConclusao(n.conclusao, n.liberacao),
        atual.cal.finD(atual.det.EF[i], atual.det.ES[i]).toISOString().slice(0, 10), `${t.id}: data de conclusão`);
      assert.equal(cal.data(n.liberacao), atual.cal.startD(atual.det.ES[i]).toISOString().slice(0, 10), `${t.id}: data de liberação`);
    });
  });
});
