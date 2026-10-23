/**
 * Migração da versão atual para a versão 2 (especificação, seção 11; preparação do passo 1.20).
 * A conversão é conferida contra o cálculo da própria versão atual, extraído do index.html da raiz,
 * com a cópia real da PI² (sem responsáveis nem descrições) e com um plano pequeno, inventado,
 * que exercita responsáveis, unidades, plano original e os casos de aviso.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { migrarCopiaV1, lerFeriados } from "../js/migracao.js";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";

function calculoDaVersaoAtual() {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const inicio = html.indexOf("/* ---------- utilidades ---------- */");
  const fim = html.indexOf("/* ---------- Monte Carlo ---------- */");
  return new Function(`${html.slice(inicio, fim)}; return { computeDet, parseHol };`)();
}
const { computeDet, parseHol } = calculoDaVersaoAtual();
const AGORA = "2026-10-22T12:00:00.000Z";
let n = 0;
const novoId = () => `id${++n}`;

/** A PI² no formato da cópia de segurança da versão atual, com o plano original guardado. */
function copiaDaPi2() {
  const { _sobre, tasks, ...plano } = JSON.parse(readFileSync(new URL("./dados/pi2-fase1.json", import.meta.url), "utf8"));
  void _sobre;
  const atual = computeDet({ start: plano.start, holidays: plano.holidays, target: plano.target, statusDate: "" }, tasks);
  const baseline = { at: "2026-09-17", fin: atual.det.fin, useCost: false, tasks: {} };
  atual.net.list.forEach((t, i) => { baseline.tasks[t.id] = { es: atual.det.ES[i], ef: atual.det.EF[i], v: 1 }; });
  return {
    atual,
    copia: {
      sistema: "planos-de-acao", versao: 1, geradoEm: AGORA,
      projects: { "pi2-fase1": { ...plano, createdAt: "2026-09-10T10:00:00.000Z", seed: 20261014, iters: 2000, baseline } },
      tasks: { "pi2-fase1": Object.fromEntries(tasks.map(({ id, ...t }) => [id, t])) },
      people: {},
    },
  };
}

describe("Migração: PI² real", () => {
  const { atual, copia } = copiaDaPi2();
  const { copia: nova, relatorio } = migrarCopiaV1(copia, { agora: AGORA, novoId });
  const e = nova.espacos[0];

  it("gera uma cópia de segurança da versão 2 que a própria versão 2 aceita e restaura", async () => {
    const store = criarStore(criarBancoLocal(), { usuario: "teste@ufci.edu.br" });
    const resumo = await store.restaurarCopia(nova);
    assert.deepEqual([resumo.espacos, resumo.acoes, resumo.retratos], [1, 29, 1]);
    const [espaco] = await store.listarEspacos();
    assert.equal(espaco.nome, "PI² · Fase 1 – Piloto com dados de ensino");
    assert.equal((await store.listarAcoes(espaco.id)).length, 29);
  });

  it("números na ordem das tarefas, códigos guardados e ligados, etapas numa fase única", () => {
    assert.deepEqual(e.acoes.map((a) => a.numero), Array.from({ length: 29 }, (_, i) => i + 1));
    assert.equal(e.acoes[0].codigo, "VRA");
    assert.equal(e.espaco.camposOpcionais.codigos, true);
    assert.equal(e.espaco.estrutura.length, 1);
    assert.equal(e.espaco.estrutura[0].nome, "Fase 1");
    assert.equal(e.espaco.estrutura[0].etapas.length, 3);
    assert.equal(e.espaco.proximoNumero, 30);
    assert.equal(e.espaco.simulacoes, 2000);
    assert.deepEqual(e.espaco.datasExcluidas.map((d) => d.data), parseHol(copia.projects["pi2-fase1"].holidays).sort());
    assert.deepEqual(relatorio.espacos[0].avisos.filter((a) => !a.startsWith("Plano original")), []);
  });

  it("o caminho crítico da versão 2 dá as mesmas datas que a versão atual", () => {
    const cal = criarCalendario({ inicio: e.espaco.inicio, datasExcluidas: e.espaco.datasExcluidas });
    const semConclusao = e.acoes.map(({ concluidaEm, ...a }) => { void concluidaEm; return a; });
    const c = caminhoCritico(semConclusao, cal);
    assert.ok(Math.abs(c.fim - atual.det.fin) < 1e-9);
    const numeroDe = new Map(e.acoes.map((a) => [a.codigo, a.numero]));
    atual.net.list.forEach((t, i) => {
      const x = c.porAcao.get(numeroDe.get(t.id));
      assert.ok(Math.abs(x.conclusao - atual.det.EF[i]) < 1e-9, t.id);
      assert.equal(x.critica, atual.det.crit[i], t.id);
    });
  });

  it("o plano original vira o retrato \"Plano original\", com as datas da versão atual", () => {
    const [r] = e.retratos;
    assert.equal(r.nome, "Plano original");
    assert.equal(r.acoes.length, 29);
    const numeroDe = new Map(e.acoes.map((a) => [a.codigo, a.numero]));
    atual.net.list.forEach((t, i) => {
      const a = r.acoes.find((x) => x.numero === numeroDe.get(t.id));
      assert.equal(a.conclusaoPrevista, atual.cal.finD(atual.det.EF[i], atual.det.ES[i]).toISOString().slice(0, 10), t.id);
      assert.equal(a.liberacaoPrevista, atual.cal.startD(atual.det.ES[i]).toISOString().slice(0, 10), t.id);
    });
    assert.equal(r.resumo.conclusaoPrevista, atual.cal.finD(atual.det.fin, 0).toISOString().slice(0, 10));
  });
});

describe("Migração: casos especiais", () => {
  const copia = {
    sistema: "planos-de-acao", versao: 1,
    projects: { p: { name: "Plano X", start: "2026-10-01", target: "2026-12-01", holidays: "12/10/2026, xx, 2026-11-02", dist: "tri" } },
    tasks: { p: {
      "lev-1": { name: "", desc: "Levantar requisitos", order: 2, preds: [], owners: ["ana", "dti"], o: 1.5, m: 2.2, p: 4, stage: "Planejamento", pct: 100, cost: 9 },
      LIC: { name: "Licitar", desc: "Licitar", order: 1, preds: ["lev-1", "NADA"], owners: ["fantasma"], o: 5, m: 3, p: 9, stage: "", aF: "2026-10-20" },
    } },
    people: { ana: { name: "Ana Souza", sigla: "ANA", unit: "DGDI" }, dti: { name: "Diretoria de TI", sigla: "DTI" }, beto: { name: "Beto" } },
  };
  const { copia: nova, relatorio } = migrarCopiaV1(copia, { unidades: ["dti"], agora: AGORA, novoId });
  const [e] = nova.espacos;
  const [lic, lev] = e.acoes;

  it("rótulo, descrição, código normalizado, ordem e conclusão", () => {
    assert.equal(lic.numero, 1); // ordem da versão atual
    assert.equal(lev.rotulo, "Levantar requisitos"); // sem nome, a descrição vira rótulo
    assert.equal(lev.descricao, undefined);
    assert.equal(lic.descricao, undefined); // descrição igual ao rótulo
    assert.equal(lev.codigo, "LEV1");
    assert.equal(lic.concluidaEm, "2026-10-20");
    assert.equal(lev.concluidaEm, undefined);
    assert.equal(lev.etapa, "e1");
    assert.equal(lic.etapa, null);
  });

  it("estimativa arredondada para cima; estimativa inválida vira \"Falta estimar\"", () => {
    assert.deepEqual(lev.estimativas, [{ em: "2026-10-01", por: null, o: 2, m: 3, p: 4, contaDe: "liberacao" }]);
    assert.deepEqual(lic.estimativas, []);
  });

  it("dependências pelo número; inexistentes ficam de fora, com aviso", () => {
    assert.deepEqual(lic.dependeDe, [2]);
    const avisos = relatorio.espacos[0].avisos.join("\n");
    assert.match(avisos, /NADA/);
    assert.match(avisos, /fantasma/);
    assert.match(avisos, /estimativa 5 · 3 · 9 inválida/);
    assert.match(avisos, /100% concluída/);
    assert.match(avisos, /triangular/);
  });

  it("responsáveis só no espaço em que aparecem, com o tipo escolhido; tons só para pessoas", () => {
    assert.deepEqual(e.responsaveis.map((r) => [r.id, r.tipo, r.setor ?? null]), [["ana", "pessoa", "DGDI"], ["dti", "unidade", null]]);
    assert.deepEqual(Object.keys(e.espaco.tons), ["ana"]);
    assert.match(relatorio.avisos.join(), /Beto/);
  });

  it("feriados: datas válidas, sem repetir; texto que não é data fica de fora", () => {
    assert.deepEqual(e.espaco.datasExcluidas, [{ data: "2026-10-12", motivo: "" }, { data: "2026-11-02", motivo: "" }]);
    assert.deepEqual(lerFeriados("1/2/2027; 01/02/2027"), ["2027-02-01"]);
  });

  it("recusa arquivo que não é cópia da versão atual", () => {
    assert.throws(() => migrarCopiaV1({ formato: "sextante-copia-de-seguranca" }), /não é uma cópia/);
  });
});
