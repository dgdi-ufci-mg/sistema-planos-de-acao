import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizar, filtrarItens } from "../js/busca.js";

const itens = [
  { grupo: "Ações", titulo: "Levantar requisitos com as áreas", palavras: "#1 Etapa 1.1" },
  { grupo: "Ações", titulo: "Definir a arquitetura técnica", palavras: "#2" },
  { grupo: "Espaços", titulo: "Repositório de dados" },
  { grupo: "Comandos", titulo: "Nova ação" },
  { grupo: "Comandos", titulo: "Ver como cronograma", palavras: "visualização gantt" },
  { grupo: "Comandos", titulo: "Ajuda e manual" },
];

test("normalizar tira acentos, maiúsculas e espaços repetidos", () => {
  assert.equal(normalizar("  Ação  Técnica "), "acao tecnica");
  assert.equal(normalizar(null), "");
});

test("sem consulta, devolve tudo, agrupado na ordem recebida", () => {
  assert.deepEqual(filtrarItens(itens, "").map((i) => i.titulo), itens.map((i) => i.titulo));
});

test("cada palavra digitada precisa aparecer, em qualquer ordem e sem acento", () => {
  assert.deepEqual(filtrarItens(itens, "tecnica arquitetura").map((i) => i.titulo), ["Definir a arquitetura técnica"]);
  assert.deepEqual(filtrarItens(itens, "gantt").map((i) => i.titulo), ["Ver como cronograma"]);
  assert.deepEqual(filtrarItens(itens, "#1").map((i) => i.titulo), ["Levantar requisitos com as áreas"]);
  assert.deepEqual(filtrarItens(itens, "xyz"), []);
});

test("título que começa pelo digitado vem antes; os grupos seguem a ordem do melhor item", () => {
  const r = filtrarItens(itens, "a");
  assert.equal(r[0].titulo, "Ajuda e manual");
  assert.equal(r[0].grupo, "Comandos");
  /* o grupo do primeiro item vem inteiro antes dos outros grupos */
  const grupos = r.map((i) => i.grupo);
  assert.deepEqual([...new Set(grupos)], ["Comandos", "Ações", "Espaços"]);
  assert.equal(grupos.lastIndexOf("Comandos") < grupos.indexOf("Ações"), true);
});

test("respeita o limite", () => {
  assert.equal(filtrarItens(itens, "", 2).length, 2);
});

test("itens só ao digitar ficam fora da lista inicial", () => {
  const com = [...itens, { grupo: "Glossário", titulo: "O que é: Folga", soAoDigitar: true }];
  assert.equal(filtrarItens(com, "").some((i) => i.grupo === "Glossário"), false);
  assert.deepEqual(filtrarItens(com, "folga").map((i) => i.titulo), ["O que é: Folga"]);
});
