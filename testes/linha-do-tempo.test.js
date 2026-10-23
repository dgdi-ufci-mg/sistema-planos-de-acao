import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";
import { criarCalendario } from "../js/calendario.js";
import { simular } from "../js/simulacao.js";
import { distribuicaoDoTermino, chanceAte, segunda } from "../js/linha-do-tempo.js";

describe("Linha do tempo (passo 1.17a)", () => {
  it("segunda-feira da semana", () => {
    assert.equal(segunda("2026-10-21"), "2026-10-19"); // quarta
    assert.equal(segunda("2026-10-19"), "2026-10-19");
    assert.equal(segunda("2026-10-25"), "2026-10-19"); // domingo
  });

  it("a distribuição soma 100% e a chance até o prazo bate com a da simulação", async () => {
    const store = criarStore(criarBancoLocal());
    const id = await carregarExemplo(store, new Date("2026-10-20T12:00:00Z"));
    const espaco = await store.lerEspaco(id);
    const acoes = await store.listarAcoes(id);
    const cal = criarCalendario(espaco, "2026-10-20");
    const sim = simular(acoes, cal, { hoje: "2026-10-20", semente: espaco.semente, simulacoes: 2000, prazoFinal: espaco.prazoFinal });
    const { semanas, porDia } = distribuicaoDoTermino(sim.fins, cal);
    assert.ok(Math.abs(semanas.reduce((s, x) => s + x.parcela, 0) - 1) < 1e-9);
    assert.equal(porDia.at(-1).chanceAte, 1);
    assert.ok(Math.abs(chanceAte(porDia, espaco.prazoFinal) - sim.chancePrazo) < 1e-9);
    assert.ok(chanceAte(porDia, cal.dataDeConclusao(sim.p50, 0)) >= 0.5); // até a conclusão prevista, metade ou mais dos cenários
    assert.equal(chanceAte(porDia, "2000-01-01"), 0);
  });
});
