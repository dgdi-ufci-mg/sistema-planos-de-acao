import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { carregarExemplo } from "../js/exemplo.js";

const HOJE = "2026-10-20";
for (const [nome, criarBanco] of [["memória", () => criarBancoLocal()], ["Firestore (falso)", () => criarBancoFirestore(criarFirestoreFalso())]]) {
  describe(`Restauração da cópia de segurança (passo 1.19b), banco em ${nome}`, () => {
    it("restaura tudo exatamente como estava, inclusive lixeira, histórico e retratos", async () => {
      const origem = criarStore(criarBanco(), { usuario: "ana@ufci.edu.br", hoje: () => HOJE });
      const id = await carregarExemplo(origem, new Date(`${HOJE}T12:00:00Z`));
      await origem.alterarCalendarioGeral([{ data: "2026-12-08", motivo: "Teste" }]);
      const [primeira] = await origem.listarAcoes(id);
      await origem.alterarAcao(id, primeira.numero, { rotulo: "Mudada" });
      await origem.excluirAcao(id, (await origem.listarAcoes(id)).at(-1).numero);
      await origem.salvarRetrato(id, "Base");
      const outro = await origem.criarEspaco({ nome: "Excluído", inicio: HOJE });
      await origem.excluirEspaco(outro);
      const copia = JSON.parse(JSON.stringify(await origem.copiaDeSeguranca()));

      const destino = criarStore(criarBanco(), { usuario: "ana@ufci.edu.br" }); // a administradora do espaço restaurado (passo 2.1)
      const resumo = destino.conferirCopia(copia);
      assert.equal(resumo.espacos, 2);
      assert.equal(resumo.retratos, 1);
      await destino.restaurarCopia(copia);
      const nova = JSON.parse(JSON.stringify(await destino.copiaDeSeguranca()));
      for (const c of [copia, nova]) { delete c.geradaEm; delete c.geradaPor; }
      assert.deepEqual(nova, copia);
      /* o contador continua: a próxima ação recebe o número seguinte, sem reaproveitar */
      const proxima = await destino.criarAcao(id, { rotulo: "Depois da restauração" });
      assert.equal(proxima, 13);
    });

    it("recusa banco com dados e arquivos que não são cópia", async () => {
      const store = criarStore(criarBanco(), { usuario: "ana@ufci.edu.br" });
      assert.throws(() => store.conferirCopia({ qualquer: 1 }), { codigo: "copia-invalida" });
      assert.throws(() => store.conferirCopia({ formato: "sextante-copia-de-seguranca", versao: 2, espacos: [{ espaco: { id: "x", nome: "E", campoEstranho: 1 }, acoes: [], responsaveis: [] }] }), { codigo: "campo-desconhecido" });
      await store.criarEspaco({ nome: "Já existe", inicio: HOJE });
      const copia = { formato: "sextante-copia-de-seguranca", versao: 2, espacos: [] };
      await assert.rejects(store.restaurarCopia(copia), { codigo: "banco-com-dados" });
    });
  });
}
