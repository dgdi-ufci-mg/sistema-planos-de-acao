/** Entregas do Plano de Ação e registro do alcance (passo 2.6; documentação técnica, seções 4.12 e 16.7). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { CAMPOS } from "../js/modelo.js";
import {
  problemaDaEntrega, problemaDoRegistro, problemaDaSituacao, avisoDeCoerencia, pendenciasParaEncerrar, alcanceAtual,
  textoDoValor, textoDaMeta, SITUACOES_DA_ENTREGA,
} from "../js/entregas.js";

const ev = { descricao: "Portaria publicada", identificacao: "23062.000001/2026-10" };
const registro = (entrega, data, valor, extra = {}) => ({ id: `r${data}${valor}`, entrega, data, valor, registradoEm: `${data}T12:00:00Z`, descricao: "Feito", evidencias: [ev], ...extra });

describe("Entregas: regras", () => {
  it("cadastro: título, tipo de meta e meta conforme o tipo", () => {
    assert.equal(problemaDaEntrega({ titulo: "Painel", tipoMeta: "padrao" }), null);
    assert.equal(problemaDaEntrega({ titulo: "POPs", tipoMeta: "quantitativa", meta: 10, unidade: "POPs" }), null);
    assert.equal(problemaDaEntrega({ titulo: "Atendimento", tipoMeta: "percentual", meta: 95 }), null);
    assert.equal(problemaDaEntrega({ titulo: " ", tipoMeta: "padrao" }).codigo, "titulo-vazio");
    assert.equal(problemaDaEntrega({ titulo: "X", tipoMeta: "outro" }).codigo, "tipo-de-meta");
    assert.equal(problemaDaEntrega({ titulo: "X", tipoMeta: "padrao", meta: 1 }).codigo, "meta-na-padrao");
    assert.equal(problemaDaEntrega({ titulo: "X", tipoMeta: "quantitativa", meta: 0 }).codigo, "meta-invalida");
    assert.equal(problemaDaEntrega({ titulo: "X", tipoMeta: "percentual", meta: 120 }).codigo, "meta-invalida");
    assert.equal(problemaDaEntrega({ titulo: "X", tipoMeta: "percentual", meta: 50, unidade: "pontos" }).codigo, "unidade-no-percentual");
    assert.equal(problemaDaEntrega({ titulo: "X", tipoMeta: "padrao", prazo: "31/12/2026" }).codigo, "prazo-invalido");
  });

  it("registro: valor conforme o tipo, descrição e pelo menos uma evidência com identificação ou link", () => {
    const q = { id: "e", tipoMeta: "quantitativa", meta: 10 };
    const p = { id: "e", tipoMeta: "padrao" };
    assert.equal(problemaDoRegistro(registro("e", "2026-11-03", 4), q), null);
    assert.equal(problemaDoRegistro(registro("e", "2026-11-03", true), p), null);
    assert.equal(problemaDoRegistro(registro("e", "2026-11-03", "4"), q).codigo, "valor-invalido");
    assert.equal(problemaDoRegistro(registro("e", "2026-11-03", 1), p).codigo, "valor-invalido");
    assert.equal(problemaDoRegistro(registro("e", "2026-11-03", 120), { tipoMeta: "percentual", meta: 90 }).codigo, "valor-invalido");
    assert.equal(problemaDoRegistro(registro("e", "", 4), q).codigo, "data-invalida");
    assert.equal(problemaDoRegistro(registro("e", "2026-11-03", 4, { evidencias: [] }), q).codigo, "sem-evidencia");
    assert.equal(problemaDoRegistro(registro("e", "2026-11-03", 4, { evidencias: [{ descricao: "Ata" }] }), q).codigo, "evidencia-sem-referencia");
    assert.equal(problemaDoRegistro(registro("e", "2026-11-03", 4, { evidencias: [{ descricao: "Ata", link: "ftp://x" }] }), q).codigo, "link-invalido");
    assert.equal(problemaDoRegistro(registro("e", "2026-11-03", 4, { descricao: " " }), q).codigo, "descricao-vazia");
  });

  it("alcance atual: o registro mais recente; fração da meta", () => {
    const q = { id: "e", tipoMeta: "quantitativa", meta: 200, unidade: "processos" };
    const lista = [registro("e", "2026-12-01", 150), registro("e", "2026-11-01", 80), registro("outra", "2027-01-01", 5)];
    const a = alcanceAtual(q, lista);
    assert.equal(a.valor, 150);
    assert.equal(a.fracao, 0.75);
    assert.equal(textoDoValor(q, a.valor), "150 de 200 processos");
    assert.equal(textoDaMeta({ tipoMeta: "percentual", meta: 95 }), "95%");
    assert.equal(alcanceAtual({ id: "e", tipoMeta: "padrao" }, [registro("e", "2026-11-01", true)]).fracao, 1);
    assert.equal(alcanceAtual(q, []), null);
  });

  it("situação: alcance para Alcançada e Parcialmente; justificativa para Parcialmente, Não alcançada e Cancelada", () => {
    const e = { id: "e", tipoMeta: "quantitativa", meta: 10 };
    assert.equal(problemaDaSituacao(e, { situacao: "alcancada" }, []).codigo, "sem-alcance");
    assert.equal(problemaDaSituacao(e, { situacao: "alcancada" }, [registro("e", "2026-11-01", 10)]), null);
    assert.equal(problemaDaSituacao(e, { situacao: "parcialmenteAlcancada" }, [registro("e", "2026-11-01", 5)]).codigo, "sem-justificativa");
    assert.equal(problemaDaSituacao(e, { situacao: "naoAlcancada" }, []).codigo, "sem-justificativa");
    assert.equal(problemaDaSituacao(e, { situacao: "cancelada", justificativa: "Mudou a estratégia" }, []), null);
    assert.equal(problemaDaSituacao(e, { situacao: "emAndamento" }, []), null);
    assert.equal(problemaDaSituacao(e, { situacao: "naoIniciada" }, []), null);
    assert.equal(problemaDaSituacao(e, { situacao: "x" }, []).codigo, "situacao-invalida");
    assert.equal(Object.keys(SITUACOES_DA_ENTREGA).length, 6);
  });

  it("aviso quando a situação e o valor não combinam", () => {
    const e = { id: "e", tipoMeta: "quantitativa", meta: 10 };
    assert.match(avisoDeCoerencia(e, "alcancada", [registro("e", "2026-11-01", 8)]), /abaixo da meta/);
    assert.equal(avisoDeCoerencia(e, "alcancada", [registro("e", "2026-11-01", 10)]), null);
    assert.match(avisoDeCoerencia(e, "parcialmenteAlcancada", [registro("e", "2026-11-01", 12)]), /já chega à meta/);
    assert.match(avisoDeCoerencia(e, "naoAlcancada", [registro("e", "2026-11-01", 3)]), /Há valor alcançado/);
    assert.match(avisoDeCoerencia(e, "naoIniciada", [registro("e", "2026-11-01", 0)]), /algo já foi feito/);
    assert.equal(avisoDeCoerencia(e, "emAndamento", []), null);
  });

  it("encerrar: pelo menos uma entrega; justificativa nas Não iniciada; alcance nas Em andamento", () => {
    assert.equal(pendenciasParaEncerrar([], []).length, 1);
    const entregas = [
      { id: "a", ordem: 1, titulo: "A", situacao: "naoIniciada" },
      { id: "b", ordem: 2, titulo: "B", situacao: "emAndamento" },
      { id: "c", ordem: 3, titulo: "C", situacao: "cancelada", justificativa: "Mudou" },
      { id: "d", ordem: 4, titulo: "D", situacao: "naoIniciada", excluidaEm: "2026-11-01T00:00:00Z" },
    ];
    assert.deepEqual(pendenciasParaEncerrar(entregas, []).map((f) => f.entrega.id), ["a", "b"]);
    entregas[0].justificativa = "Faltou orçamento";
    assert.deepEqual(pendenciasParaEncerrar(entregas, [registro("b", "2026-11-01", 3)]), []);
  });
});

for (const [nome, criarBanco] of [
  ["memória", () => criarBancoLocal()],
  ["Firestore (falso)", () => criarBancoFirestore(criarFirestoreFalso())],
]) {
  describe(`Entregas no Store, banco em ${nome}`, () => {
    async function cenario() {
      const banco = criarBanco();
      let n = 0;
      const como = (email) => criarStore(banco, { exigirLogin: true, usuario: email, hoje: () => "2026-10-24", novoId: () => `id${++n}` });
      const ana = como("ana@ufci.edu.br");
      const id = await ana.criarEspaco({ nome: "Plano", inicio: "2026-10-01", tipo: "planoDeAcao", programa: "Programa X", aprovacao: { identificacao: "1" } });
      const bia = await ana.criarResponsavel(id, { tipo: "pessoa", nome: "Bia", usuario: "bia@ufci.edu.br" });
      return { ana, bia: como("bia@ufci.edu.br"), biaId: bia, id };
    }

    it("só o administrador cadastra; só no Plano de Ação; começa Não iniciada, na ordem", async () => {
      const { ana, bia, biaId, id } = await cenario();
      const e1 = await ana.criarEntrega(id, { titulo: " Painel publicado ", tipoMeta: "padrao", responsaveis: [biaId] });
      const e2 = await ana.criarEntrega(id, { titulo: "POPs", tipoMeta: "quantitativa", meta: 10, unidade: "POPs", prazo: "2027-03-31" });
      await assert.rejects(bia.criarEntrega(id, { titulo: "X", tipoMeta: "padrao" }), { codigo: "sem-permissao" });
      await assert.rejects(ana.criarEntrega(id, { titulo: "X", tipoMeta: "padrao", responsaveis: ["nada"] }), { codigo: "responsavel-invalido" });
      await assert.rejects(ana.criarEntrega(id, { titulo: "X", tipoMeta: "padrao", situacao: "alcancada" }), { codigo: "campo-fixo" });
      const lista = await ana.listarEntregas(id);
      assert.deepEqual(lista.map((e) => e.id), [e1, e2]);
      assert.equal(lista[0].titulo, "Painel publicado");
      assert.equal(lista[0].situacao, "naoIniciada");
      for (const e of lista) for (const c of Object.keys(e)) assert.ok(CAMPOS.entrega.includes(c), `campo estranho ${c}`);
      const projeto = await ana.criarEspaco({ nome: "Projeto", inicio: "2026-10-01" });
      await assert.rejects(ana.criarEntrega(projeto, { titulo: "X", tipoMeta: "padrao" }), { codigo: "so-plano-de-acao" });
    });

    it("registro de alcance: só o administrador, com evidência; o mais recente é o atual; meta fixa depois", async () => {
      const { ana, bia, biaId, id } = await cenario();
      const e = await ana.criarEntrega(id, { titulo: "POPs", tipoMeta: "quantitativa", meta: 10 });
      const dados = { data: "2026-11-10", valor: 4, descricao: "Quatro publicados", evidencias: [ev], realizadores: [biaId] };
      await assert.rejects(bia.registrarAlcance(id, e, dados), { codigo: "sem-permissao" });
      await assert.rejects(ana.registrarAlcance(id, e, { ...dados, evidencias: [] }), { codigo: "sem-evidencia" });
      await ana.registrarAlcance(id, e, dados);
      await ana.registrarAlcance(id, e, { ...dados, data: "2026-12-10", valor: 7 });
      const alcances = await ana.listarAlcances(id);
      assert.deepEqual(alcances.map((r) => r.valor), [4, 7]);
      assert.equal(alcances[0].registradoPor, "ana@ufci.edu.br");
      for (const r of alcances) for (const c of Object.keys(r)) assert.ok(CAMPOS.registroDeAlcance.includes(c), `campo estranho ${c}`);
      await assert.rejects(ana.alterarEntrega(id, e, { meta: 12 }), { codigo: "meta-com-alcance" });
      await ana.alterarEntrega(id, e, { titulo: "POPs publicados", prazo: "2027-06-30" });
      assert.equal((await ana.listarEntregas(id))[0].titulo, "POPs publicados");
      await assert.rejects(ana.excluirEntrega(id, e), { codigo: "entrega-com-alcance" });
    });

    it("situação: exigências, registro das mudanças e exclusão lógica", async () => {
      const { ana, bia, id } = await cenario();
      const e = await ana.criarEntrega(id, { titulo: "Painel", tipoMeta: "padrao" });
      await assert.rejects(ana.mudarSituacaoDaEntrega(id, e, { situacao: "alcancada" }), { codigo: "sem-alcance" });
      await assert.rejects(ana.mudarSituacaoDaEntrega(id, e, { situacao: "cancelada" }), { codigo: "sem-justificativa" });
      await assert.rejects(bia.mudarSituacaoDaEntrega(id, e, { situacao: "emAndamento" }), { codigo: "sem-permissao" });
      await ana.mudarSituacaoDaEntrega(id, e, { situacao: "emAndamento" });
      await ana.registrarAlcance(id, e, { data: "2026-11-10", valor: true, descricao: "No ar", evidencias: [{ descricao: "Painel", link: "https://painel.ufci.edu.br" }] });
      await ana.mudarSituacaoDaEntrega(id, e, { situacao: "alcancada", justificativa: " " });
      const [lida] = await ana.listarEntregas(id);
      assert.equal(lida.situacao, "alcancada");
      assert.equal(lida.justificativa, null);
      assert.deepEqual(lida.mudancasDeSituacao.map((m) => m.situacao), ["emAndamento", "alcancada"]);
      assert.deepEqual(Object.keys(lida.mudancasDeSituacao[0]).sort(), [...CAMPOS.mudancaDeSituacao].sort());
      await assert.rejects(ana.alterarEntrega(id, e, { situacao: "naoIniciada" }), { codigo: "campo-fixo" });
      const outra = await ana.criarEntrega(id, { titulo: "Errada", tipoMeta: "padrao" });
      await ana.excluirEntrega(id, outra);
      assert.deepEqual((await ana.listarEntregas(id)).map((x) => x.id), [e]);
    });

    it("encerrar o Plano de Ação exige as entregas em dia", async () => {
      const { ana, id } = await cenario();
      await assert.rejects(ana.encerrarEspaco(id), { codigo: "entregas-pendentes" });
      const a = await ana.criarEntrega(id, { titulo: "A", tipoMeta: "padrao" });
      const b = await ana.criarEntrega(id, { titulo: "B", tipoMeta: "quantitativa", meta: 3 });
      await ana.mudarSituacaoDaEntrega(id, b, { situacao: "emAndamento" });
      await assert.rejects(ana.encerrarEspaco(id), (e) => e.codigo === "entregas-pendentes" && /“A”/.test(e.message) && /“B”/.test(e.message));
      await ana.mudarSituacaoDaEntrega(id, a, { situacao: "naoIniciada", justificativa: "Faltou orçamento" });
      await ana.registrarAlcance(id, b, { data: "2026-11-10", valor: 1, descricao: "Um", evidencias: [ev] });
      await ana.encerrarEspaco(id);
      await assert.rejects(ana.criarEntrega(id, { titulo: "C", tipoMeta: "padrao" }), { codigo: "espaco-encerrado" });
    });

    it("cópia de segurança e retrato levam as entregas e os alcances", async () => {
      const { ana, id } = await cenario();
      const e = await ana.criarEntrega(id, { titulo: "A", tipoMeta: "padrao" });
      await ana.registrarAlcance(id, e, { data: "2026-11-10", valor: true, descricao: "Feito", evidencias: [ev] });
      const copia = await ana.copiaDeSeguranca();
      assert.equal(copia.versao, 4);
      const doPlano = copia.espacos.find((x) => x.espaco.id === id);
      assert.equal(doPlano.entregas.length, 1);
      assert.equal(doPlano.alcances.length, 1);
      const outro = criarStore(criarBanco(), { exigirLogin: true, usuario: "ana@ufci.edu.br" });
      await outro.restaurarCopia(copia);
      assert.equal((await outro.listarEntregas(id))[0].titulo, "A");
      assert.equal((await outro.listarAlcances(id)).length, 1);
      await ana.salvarRetrato(id, "Plano aprovado");
      const [r] = await ana.listarRetratos(id);
      assert.equal(r.entregas[0].id, e);
      assert.equal(r.alcances.length, 1);
    });

    it("a ação se liga a uma entrega ativa do mesmo plano, com registro no histórico", async () => {
      const { ana, id } = await cenario();
      const e = await ana.criarEntrega(id, { titulo: "A", tipoMeta: "padrao" });
      const n = await ana.criarAcao(id, { rotulo: "Fazer", entregaDoPlano: e });
      assert.equal((await ana.listarAcoes(id)).find((a) => a.numero === n).entregaDoPlano, e);
      await assert.rejects(ana.alterarAcao(id, n, { entregaDoPlano: "outra" }), { codigo: "entrega-invalida" });
      await ana.alterarAcao(id, n, { entregaDoPlano: null });
      const hist = await ana.listarHistorico(id, n);
      assert.ok(hist.some((r) => r.campo === "entregaDoPlano"));
    });

    it("continuar uma entrega Em andamento de outro Plano de Ação (caminho A)", async () => {
      const { ana, id } = await cenario();
      const antigo = await ana.criarEspaco({ nome: "Plano 2025", inicio: "2025-01-06", tipo: "planoDeAcao", programa: "Programa X", aprovacao: { identificacao: "2" } });
      const origem = await ana.criarEntrega(antigo, { titulo: "POPs", tipoMeta: "quantitativa", meta: 10 });
      assert.deepEqual(await ana.listarEntregasParaContinuar(id), []); // ainda Não iniciada
      await ana.mudarSituacaoDaEntrega(antigo, origem, { situacao: "emAndamento" });
      const opcoes = await ana.listarEntregasParaContinuar(id);
      assert.deepEqual(opcoes.map((o) => [o.espaco.id, o.entrega.id]), [[antigo, origem]]);
      const nova = await ana.criarEntrega(id, { titulo: "POPs (continuação)", tipoMeta: "quantitativa", meta: 10, continuaDe: { espaco: antigo, entrega: origem } });
      assert.deepEqual((await ana.listarEntregas(id)).find((e) => e.id === nova).continuaDe, { espaco: antigo, entrega: origem });
      await assert.rejects(ana.criarEntrega(id, { titulo: "De novo", tipoMeta: "padrao", continuaDe: { espaco: antigo, entrega: origem } }), { codigo: "ja-continuada" });
      await assert.rejects(ana.criarEntrega(id, { titulo: "X", tipoMeta: "padrao", continuaDe: { espaco: id, entrega: nova } }), { codigo: "continuacao-invalida" });
      await assert.rejects(ana.criarEntrega(id, { titulo: "X", tipoMeta: "padrao", continuaDe: { espaco: antigo, entrega: "nada" } }), { codigo: "nao-encontrado" });
      await assert.rejects(ana.alterarEntrega(id, nova, { continuaDe: null }), { codigo: "campo-fixo" });
      assert.deepEqual(await ana.listarEntregasParaContinuar(id), []);
    });
  });
}
