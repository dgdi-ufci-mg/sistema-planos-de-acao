import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { montarLinhas } from "../js/lista.js";
import { simular } from "../js/simulacao.js";
import { montarCronograma } from "../js/cronograma.js";

const HOJE = "2026-10-20";
async function exemplo() {
  const store = criarStore(criarBancoLocal());
  const id = await carregarExemplo(store, new Date(`${HOJE}T12:00:00Z`));
  const espaco = await store.lerEspaco(id);
  const acoes = (await store.listarAcoes(id)).sort((a, b) => a.ordem - b.ordem);
  const cal = criarCalendario(espaco, HOJE);
  const caminho = caminhoCritico(acoes, cal, { hoje: HOJE });
  return { espaco, acoes, cal, caminho };
}

describe("Cronograma (passo 1.17b)", () => {
  it("cada ação aparece uma vez, com início antes do fim e a mesma conclusão da lista", async () => {
    const { espaco, acoes, cal, caminho } = await exemplo();
    const { linhas, inicio, fim } = montarCronograma(acoes, caminho, cal, { estrutura: espaco.estrutura, usaFases: true });
    const barras = linhas.filter((l) => l.tipo === "acao").map((l) => l.barra);
    assert.equal(barras.length, acoes.length);
    assert.equal(new Set(barras.map((b) => b.numero)).size, acoes.length);
    const sim = simular(acoes, cal, { hoje: HOJE, semente: espaco.semente, simulacoes: 200 });
    const daLista = new Map(montarLinhas(acoes, caminho, sim, cal, HOJE).map((l) => [l.acao.numero, l.conclusao]));
    for (const b of barras) {
      assert.ok(b.inicio <= b.fim, `${b.acao.rotulo}: ${b.inicio} > ${b.fim}`);
      assert.equal(b.fim, daLista.get(b.numero), b.acao.rotulo);
      assert.ok(inicio <= b.inicio && b.fim <= fim);
    }
  });

  it("uma ação começa depois que as anteriores terminam (no mesmo dia, se a anterior termina no meio dele)", async () => {
    const { acoes, cal, caminho } = await exemplo();
    const { linhas } = montarCronograma(acoes, caminho, cal);
    const porNumero = new Map(linhas.map((l) => [l.barra.numero, l.barra]));
    for (const b of porNumero.values()) {
      for (const d of b.dependeDe) assert.ok(porNumero.get(d).fim <= b.inicio || b.situacao === "concluida", `${b.acao.rotulo}`);
    }
  });

  it("agrupa por fase e etapa, na ordem da estrutura; sem fases, só as ações", async () => {
    const { espaco, acoes, cal, caminho } = await exemplo();
    const com = montarCronograma(acoes, caminho, cal, { estrutura: espaco.estrutura, usaFases: true }).linhas;
    assert.equal(com[0].tipo, "grupo");
    assert.equal(com[0].nivel, "fase");
    assert.equal(com[1].nivel, "etapa");
    const fases = com.filter((l) => l.nivel === "fase").map((l) => l.id);
    assert.deepEqual(fases, ["F1", "F2", "F3"]);
    const sem = montarCronograma(acoes, caminho, cal).linhas;
    assert.ok(sem.every((l) => l.tipo === "acao"));
  });

  it("as ações críticas do cronograma são as do caminho crítico", async () => {
    const { acoes, cal, caminho } = await exemplo();
    const { linhas } = montarCronograma(acoes, caminho, cal);
    const criticas = linhas.filter((l) => l.barra.critica).map((l) => l.barra.numero).sort();
    const doCaminho = [...caminho.porAcao.entries()].filter(([, c]) => c.critica).map(([n]) => n).sort();
    assert.deepEqual(criticas, doCaminho);
    assert.ok(criticas.length > 0);
  });
});
