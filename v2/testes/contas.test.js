import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarFirebaseFalso } from "./firebase-falso.js";
import { conectarFirebase } from "../js/banco/firebase.js";

describe("Criação de contas (passo 1.14d)", () => {
  it("cria a conta sem tirar quem está logado da sessão e manda o e-mail para definir a senha", async () => {
    globalThis.firebase = criarFirebaseFalso({ usuarios: { "admin@ufci.edu.br": "senha-de-teste" } });
    const { acesso } = await conectarFirebase({ projectId: "teste" });
    const vistos = [];
    acesso.aoMudarUsuario((e) => vistos.push(e));
    await acesso.entrar("admin@ufci.edu.br", "senha-de-teste");
    assert.equal(await acesso.criarConta(" Nova.Pessoa@ufci.edu.br "), "criada");
    assert.equal(globalThis.firebase._auth.currentUser.email, "admin@ufci.edu.br"); // continua logado
    assert.deepEqual(globalThis.firebase._auth._enviados, ["nova.pessoa@ufci.edu.br"]);
    assert.ok("nova.pessoa@ufci.edu.br" in globalThis.firebase._usuarios);
    assert.equal(await acesso.criarConta("admin@ufci.edu.br"), "existente");
    assert.equal(globalThis.firebase._auth._enviados.length, 1); // conta existente: nada é enviado
    assert.ok(!vistos.includes("nova.pessoa@ufci.edu.br"));
    delete globalThis.firebase;
  });
});
