/** Testes da visualização "Responsáveis": ações ao mesmo tempo, por responsável e por semana (seção 5.10). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarCalendario } from "../js/calendario.js";
import { caminhoCritico } from "../js/calculo.js";
import { montarCarga, simultaneasPorSemana, nivelDaCarga } from "../js/carga.js";

const INICIO = "2026-10-05"; // segunda-feira
const cal = criarCalendario({ inicio: INICIO });
const acao = (numero, dias, dependeDe = [], extra = {}) =>
  ({ numero, ordem: numero, rotulo: `A${numero}`, dependeDe, responsaveis: [], estimativas: dias ? [{ o: dias, m: dias, p: dias }] : [], ...extra });
const ana = { id: "ana", tipo: "pessoa", nome: "Ana" };
const bia = { id: "bia", tipo: "pessoa", nome: "Bia" };
const dti = { id: "dti", tipo: "unidade", nome: "DTI", sigla: "DTI" };
const montar = (acoes, responsaveis, hoje = INICIO) =>
  montarCarga(acoes, caminhoCritico(acoes, cal, { hoje }), cal, responsaveis, { hoje });
const linha = (carga, id) => carga.linhas.find((l) => (l.responsavel?.id ?? "") === id);

describe("Responsáveis: ações ao mesmo tempo", () => {
  /*
   * Em dias úteis desde 05/10: 1: 0–5 (semana 1); 2: 0–3 (semana 1); 3 depende de 1: 5–8 (semana 2);
   * 4 depende de 3: 8–18 (semanas 2, 3 e 4).
   */
  const rede = () => [
    acao(1, 5, [], { responsaveis: ["ana"] }), acao(2, 3, [], { responsaveis: ["ana", "bia"] }),
    acao(3, 3, [1], { responsaveis: ["ana"] }), acao(4, 10, [3], { responsaveis: ["bia"] }),
  ];

  it("semanas de hoje ao fim previsto; em cada uma, o maior número de ações no mesmo dia útil", () => {
    const c = montar(rede(), [ana, bia]);
    assert.deepEqual(c.semanas, ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    assert.deepEqual(linha(c, "ana").porSemana, [2, 1, 0, 0]);
    assert.deepEqual(linha(c, "bia").porSemana, [1, 1, 1, 1]);
    assert.equal(c.maximo, 2);
  });

  it("ação com dois responsáveis conta inteira para cada um; ordem pelo pico, depois por ações em aberto", () => {
    const c = montar(rede(), [bia, ana]);
    assert.deepEqual(c.linhas.map((l) => [l.responsavel.id, l.pico, l.emAberto]), [["ana", 2, 3], ["bia", 1, 2]]);
  });

  it("ações que se sucedem na mesma semana não se somam: vale o mesmo dia", () => {
    /* 1: segunda a quarta; 2, que depende de 1: quinta e sexta */
    const c = montar([acao(1, 3, [], { responsaveis: ["ana"] }), acao(2, 2, [1], { responsaveis: ["ana"] })], [ana]);
    assert.deepEqual(linha(c, "ana").porSemana, [1]);
  });

  it("concluída fica de fora; contínua e sem estimativa aparecem, mas não entram no número", () => {
    const acoes = [
      acao(1, 5, [], { responsaveis: ["ana"], concluidaEm: "2026-10-06" }),
      acao(2, 5, [], { responsaveis: ["ana"] }),
      acao(3, 0, [], { responsaveis: ["ana"] }),
      acao(4, 0, [], { responsaveis: ["ana"], comecaCom: { tipo: "projeto" }, terminaCom: { tipo: "projeto" } }),
    ];
    const l = linha(montar(acoes, [ana], "2026-10-07"), "ana");
    assert.deepEqual(l.barras.map((b) => b.numero).sort(), [2, 3, 4]);
    assert.deepEqual([l.emAberto, l.semEstimativa, l.continuas, l.pico], [3, 1, 1, 1]);
    assert.deepEqual(l.barras.filter((b) => b.conta).map((b) => b.numero), [2]);
  });

  it("sem responsável (ou com responsável excluído) vai para a última linha; quem não tem ação em aberto fica em livres", () => {
    const excluido = { id: "x", tipo: "pessoa", nome: "Xis", excluidoEm: "2026-10-01T00:00:00Z" };
    const c = montar([acao(1, 5, [], { responsaveis: ["ana"] }), acao(2, 5), acao(3, 5, [], { responsaveis: ["x"] })], [ana, bia, dti, excluido]);
    assert.equal(c.linhas.at(-1).responsavel, null);
    assert.deepEqual(c.linhas.at(-1).barras.map((b) => b.numero), [2, 3]);
    assert.deepEqual(c.livres.map((r) => r.id), ["bia", "dti"]);
  });

  it("atrasada conta na semana de hoje (nada termina no passado); dias antes de hoje não contam", () => {
    const hoje = "2026-10-21"; // quarta-feira da terceira semana; a ação venceu em 09/10
    const c = montar([acao(1, 5, [], { responsaveis: ["ana"] })], [ana], hoje);
    assert.deepEqual(c.semanas, ["2026-10-19"]);
    const l = linha(c, "ana");
    assert.deepEqual([l.atrasadas, l.porSemana[0], l.barras[0].fim], [1, 1, hoje]);
  });

  it("tudo concluído: nenhuma linha", () => {
    const c = montar([acao(1, 2, [], { responsaveis: ["ana"], concluidaEm: "2026-10-06" })], [ana], "2026-10-07");
    assert.deepEqual([c.linhas.length, c.maximo, c.livres.length], [0, 0, 1]);
  });

  it("feriado não conta como dia de trabalho", () => {
    const comFeriado = criarCalendario({ inicio: INICIO, datasExcluidas: [{ data: "2026-10-12" }] });
    const barras = [{ inicio: "2026-10-12", fim: "2026-10-12" }];
    assert.deepEqual(simultaneasPorSemana(barras, ["2026-10-12"], comFeriado, INICIO), [0]);
    assert.deepEqual(simultaneasPorSemana(barras, ["2026-10-12"], cal, INICIO), [1]);
  });

  it("intensidade da cor: um nível por ação até quatro; acima, proporcional ao maior número", () => {
    assert.deepEqual([0, 1, 2, 3, 4].map((n) => nivelDaCarga(n, 2)), [0, 1, 2, 3, 4]);
    assert.deepEqual([1, 2, 4, 6, 8].map((n) => nivelDaCarga(n, 8)), [1, 1, 2, 3, 4]);
  });
});
