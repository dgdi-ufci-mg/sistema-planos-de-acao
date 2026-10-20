/** Testes do espaço de exemplo e da cópia da PI² usada nos testes. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";

/** Verdadeiro se as dependências formam um ciclo. */
function temCiclo(acoes, idDe, anterioresDe) {
  const anteriores = new Map(acoes.map((a) => [idDe(a), anterioresDe(a)]));
  const estado = new Map(); // 1 = visitando, 2 = pronto
  const visita = (id) => {
    if (estado.get(id) === 1) return true;
    if (estado.get(id) === 2) return false;
    estado.set(id, 1);
    const achou = (anteriores.get(id) ?? []).some(visita);
    estado.set(id, 2);
    return achou;
  };
  return [...anteriores.keys()].some(visita);
}

describe("Espaço de exemplo", async () => {
  const hoje = new Date("2026-10-20T12:00:00Z");
  const store = criarStore(criarBancoLocal());
  const espacoId = await carregarExemplo(store, hoje);
  const espaco = await store.lerEspaco(espacoId);
  const acoes = await store.listarAcoes(espacoId);
  const responsaveis = await store.listarResponsaveis();
  const etapas = new Set(espaco.estrutura.flatMap((f) => f.etapas.map((e) => e.id)));
  const ehDiaUtil = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`);
    return d.getUTCDay() % 6 !== 0 && !espaco.datasExcluidas.some((x) => x.data === iso);
  };

  it("tem 12 ações, em 3 fases e 6 etapas", () => {
    assert.equal(acoes.length, 12);
    assert.equal(espaco.estrutura.length, 3);
    assert.equal(etapas.size, 6);
  });

  it("toda dependência aponta para uma ação do espaço, sem ciclos", () => {
    const codigos = new Set(acoes.map((a) => a.codigo));
    for (const a of acoes) for (const d of a.dependeDe) assert.ok(codigos.has(d), `${a.codigo} depende de ${d}, que não existe`);
    assert.equal(temCiclo(acoes, (a) => a.codigo, (a) => a.dependeDe), false);
  });

  it("toda etapa e todo responsável citados existem", () => {
    const ids = new Set(responsaveis.map((r) => r.id));
    for (const a of acoes) {
      assert.ok(etapas.has(a.etapa), `${a.codigo}: etapa ${a.etapa} não existe`);
      for (const r of a.responsaveis) assert.ok(ids.has(r), `${a.codigo}: responsável ${r} não existe`);
    }
  });

  it("estimativas coerentes: otimista ≤ mais provável ≤ pessimista", () => {
    for (const a of acoes) for (const e of a.estimativas) {
      assert.ok(e.o <= e.m && e.m <= e.p, `${a.codigo}: ${e.o}, ${e.m}, ${e.p}`);
      assert.ok(["liberacao", "data"].includes(e.contaDe));
    }
  });

  it("datas em dias úteis, começando 35 dias úteis antes de hoje", () => {
    const datas = [espaco.inicio, espaco.prazoFinal,
      ...acoes.flatMap((a) => [a.concluidaEm, ...a.estimativas.map((e) => e.em)]).filter(Boolean)];
    for (const d of datas) assert.ok(ehDiaUtil(d), `${d} não é dia útil`);
    assert.ok(espaco.inicio < "2026-10-20" && espaco.prazoFinal > "2026-10-20");
  });

  it("é igual a cada vez que é montado para o mesmo dia", async () => {
    const outro = criarStore(criarBancoLocal());
    const outroId = await carregarExemplo(outro, hoje);
    const sem = (x) => x.map(({ criadaEm, alteradaEm, responsaveis, ...resto }) => resto);
    assert.deepEqual(sem(await outro.listarAcoes(outroId)), sem(acoes));
  });
});

describe("Cópia da PI² para testes", () => {
  const arquivo = JSON.parse(readFileSync(new URL("./dados/pi2-fase1.json", import.meta.url), "utf8"));
  const { _sobre, ...dados } = arquivo;

  it("não foi alterada desde a leitura dos dados reais", () => {
    const esperado = _sobre.match(/[0-9a-f]{64}/)[0];
    const atual = createHash("sha256").update(JSON.stringify(dados)).digest("hex");
    assert.equal(atual, esperado);
  });

  it("tem 29 ações, dependências válidas e sem ciclos", () => {
    const ids = new Set(dados.tasks.map((t) => t.id));
    assert.equal(ids.size, 29);
    for (const t of dados.tasks) for (const p of t.preds) assert.ok(ids.has(p), `${t.id} depende de ${p}`);
    assert.equal(temCiclo(dados.tasks, (t) => t.id, (t) => t.preds), false);
  });
});

describe("Espaço de exemplo: forma esperada", async () => {
  const { criarCalendario } = await import("../js/calendario.js");
  const { caminhoCritico } = await import("../js/calculo.js");
  const store = criarStore(criarBancoLocal());
  const id = await carregarExemplo(store, new Date("2026-10-20T12:00:00Z"));
  const espaco = await store.lerEspaco(id);
  const r = caminhoCritico(await store.listarAcoes(id), criarCalendario(espaco), { hoje: "2026-10-20" });
  const contar = (s) => [...r.porAcao.values()].filter((x) => x.situacao === s).length;

  it("tem ações concluídas, liberadas (uma atrasada) e não liberadas", () => {
    assert.deepEqual([contar("concluida"), contar("liberada"), contar("naoLiberada")], [2, 4, 6]);
    assert.equal([...r.porAcao.values()].filter((x) => x.atrasada).length, 1);
  });
});
