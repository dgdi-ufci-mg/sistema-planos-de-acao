/**
 * Partida da página do painel público (18/11/2026; documentação técnica, seção 8.8): painel/?p=<código>.
 * Liga o Firebase só para ler (ninguém entra nesta página); sem configuração, usa um banco vazio na memória
 * (testes e desenvolvimento), em que nenhum painel existe.
 */
import { FIREBASE_CONFIG } from "../config.js";
import { criarBancoLocal } from "./banco/local.js";
import { criarStore } from "./dados.js";
import { mostrarPainelPublico } from "./telas/painel-publico.js";
import { ligarSecoesSuaves } from "./telas/movimento.js";

const alvo = document.getElementById("painel");
const codigo = new URLSearchParams(location.search).get("p");

async function bancoDaPagina() {
  if (!FIREBASE_CONFIG) return criarBancoLocal();
  const { conectarFirebase } = await import("./banco/firebase.js");
  return (await conectarFirebase(FIREBASE_CONFIG)).banco;
}

bancoDaPagina()
  .then((banco) => mostrarPainelPublico(alvo, { store: criarStore(banco), codigo, ligarSecoes: ligarSecoesSuaves }))
  .catch(() => mostrarPainelPublico(alvo, { store: { lerPainelPublico: () => Promise.reject(new Error("sem banco")) }, codigo }));
