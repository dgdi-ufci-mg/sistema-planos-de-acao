/** Comentários das ações (passo 2.9): regras do Store. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarStore } from "../js/dados.js";

function cenario() {
  const banco = criarBancoLocal();
  let n = 0;
  let minuto = 0;
  const opcoes = { novoId: () => `id${++n}`, agora: () => `2026-10-23T18:${String(minuto++).padStart(2, "0")}:00.000Z` };
  const ana = criarStore(banco, { ...opcoes, usuario: "ana@ufci.edu.br" });
  const bia = criarStore(banco, { ...opcoes, usuario: "bia@ufci.edu.br" });
  const anonimo = criarStore(banco, opcoes);
  return { ana, bia, anonimo };
}

describe("Comentários", () => {
  it("comenta com autor e data, na ordem em que foram escritos", async () => {
    const { ana, bia } = cenario();
    const e = await ana.criarEspaco({ nome: "E" });
    const n = await ana.criarAcao(e, { rotulo: "A" });
    await ana.comentar(e, n, "  Mandei o ofício.  ");
    await bia.comentar(e, n, "Recebido.");
    const lista = await ana.listarComentarios(e, n);
    assert.deepEqual(lista.map((c) => [c.autor, c.texto]), [["ana@ufci.edu.br", "Mandei o ofício."], ["bia@ufci.edu.br", "Recebido."]]);
    assert.deepEqual(lista[0].versoes, []);
  });

  it("recusa comentário vazio, longo, sem login ou em ação que não existe", async () => {
    const { ana, anonimo } = cenario();
    const e = await ana.criarEspaco({ nome: "E" });
    const n = await ana.criarAcao(e, { rotulo: "A" });
    await assert.rejects(ana.comentar(e, n, "   "), { codigo: "comentario-vazio" });
    await assert.rejects(ana.comentar(e, n, "x".repeat(4001)), { codigo: "comentario-longo" });
    await assert.rejects(anonimo.comentar(e, n, "Oi"), { codigo: "sem-login" });
    await assert.rejects(ana.comentar(e, 99, "Oi"), { codigo: "nao-encontrado" });
  });

  it("editar guarda a versão anterior; só o autor edita", async () => {
    const { ana, bia } = cenario();
    const e = await ana.criarEspaco({ nome: "E" });
    const n = await ana.criarAcao(e, { rotulo: "A" });
    const id = await ana.comentar(e, n, "Versão 1");
    await ana.editarComentario(e, id, "Versão 2");
    await ana.editarComentario(e, id, "Versão 3");
    await assert.rejects(bia.editarComentario(e, id, "Intrusa"), { codigo: "sem-permissao" });
    const [c] = await ana.listarComentarios(e, n);
    assert.equal(c.texto, "Versão 3");
    assert.deepEqual(c.versoes.map((v) => v.texto), ["Versão 1", "Versão 2"]);
    assert.equal(c.versoes[0].em, c.criadoEm);
    assert.ok(c.editadoEm > c.criadoEm);
  });

  it("apagar só esconde: o texto e as versões ficam; depois, nada muda", async () => {
    const { ana, bia } = cenario();
    const e = await ana.criarEspaco({ nome: "E" });
    const n = await ana.criarAcao(e, { rotulo: "A" });
    const id = await ana.comentar(e, n, "Texto");
    await assert.rejects(bia.apagarComentario(e, id), { codigo: "sem-permissao" });
    await ana.apagarComentario(e, id);
    const [c] = await ana.listarComentarios(e, n);
    assert.equal(c.texto, "Texto");
    assert.equal(c.apagadoComo, "autor");
    assert.equal(c.apagadoPor, "ana@ufci.edu.br");
    await assert.rejects(ana.editarComentario(e, id, "Outro"), { codigo: "comentario-apagado" });
  });

  it("vão para a cópia de segurança e voltam na restauração, e não entram nos retratos", async () => {
    const { ana } = cenario();
    const e = await ana.criarEspaco({ nome: "E" });
    const n = await ana.criarAcao(e, { rotulo: "A" });
    const id = await ana.comentar(e, n, "Guardar");
    await ana.editarComentario(e, id, "Guardado");
    const copia = await ana.copiaDeSeguranca();
    assert.equal(copia.espacos[0].comentarios.length, 1);
    const outro = criarStore(criarBancoLocal(), { usuario: "ana@ufci.edu.br" });
    await outro.restaurarCopia(copia);
    const [c] = await outro.listarComentarios(e, n);
    assert.deepEqual([c.texto, c.versoes.length], ["Guardado", 1]);
    await ana.salvarRetrato(e, "Base");
    const [r] = await ana.listarRetratos(e);
    assert.equal(JSON.stringify(r).includes("Guardado"), false);
  });
});
