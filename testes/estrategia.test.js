/** Catálogo da estratégia: camadas, instrumentos, itens e ligações (passo 2.5; documentação técnica, seção 4.11). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { CAMADAS_PADRAO, camadasAcima, instrumentoVigente, itemVigente, caminhoAteOTopo, problemaDasCamadas, planejarCatalogo, problemaDosVinculos } from "../js/estrategia.js";
import { normalizar } from "../js/acao.js";
import { lerColagem } from "../js/planilha.js";
import { problemaDoTipo } from "../js/tipos.js";

describe("Estratégia: regras", () => {
  it("superiores: a camada logo acima ou, se ela for opcional, também a de cima dela", () => {
    const c = CAMADAS_PADRAO;
    assert.deepEqual(camadasAcima(c, "objetivoEstrategico"), []);
    assert.deepEqual(camadasAcima(c, "politica"), ["objetivoDesenvolvimento"]);
    assert.deepEqual(camadasAcima(c, "programa"), ["portfolio", "politica"]);
    assert.deepEqual(camadasAcima(c, null), ["programa"]); // os Planos de Ação, abaixo da última camada
    const opcionalNoFim = [...c.slice(0, 4), { ...c[4], opcional: true }];
    assert.deepEqual(camadasAcima(opcionalNoFim, null), ["programa", "portfolio", "politica"]);
  });

  it("vigência pelo instrumento; sem fim, vale sempre depois do início", () => {
    const pdi = { id: "p", inicio: "2024-01-01", fim: "2028-12-31" };
    assert.equal(instrumentoVigente(pdi, "2026-10-24"), true);
    assert.equal(instrumentoVigente(pdi, "2029-01-01"), false);
    assert.equal(instrumentoVigente({ inicio: "2024-01-01", fim: null }, "2099-01-01"), true);
    assert.equal(itemVigente({ instrumento: "p" }, [pdi], "2023-12-31"), false);
    assert.equal(itemVigente({}, [], "2023-12-31"), true);
  });

  it("caminho até o topo pelo primeiro superior, sem laço infinito", () => {
    const itens = [{ id: "a", nome: "A" }, { id: "b", nome: "B", superiores: ["a"] }, { id: "c", nome: "C", superiores: ["b", "a"] }];
    assert.deepEqual(caminhoAteOTopo(itens[2], itens).map((x) => x.id), ["a", "b", "c"]);
    assert.deepEqual(caminhoAteOTopo({ id: "x", superiores: ["x"] }, []).map((x) => x.id), ["x"]);
  });

  it("recusa camadas vazias, repetidas ou sem nome", () => {
    assert.equal(problemaDasCamadas(CAMADAS_PADRAO), null);
    assert.equal(problemaDasCamadas([]).codigo, "camadas-vazias");
    assert.equal(problemaDasCamadas([CAMADAS_PADRAO[0], { ...CAMADAS_PADRAO[1], nome: "objetivo estratégico" }]).codigo, "nome-repetido");
    assert.equal(problemaDasCamadas([{ id: "a", nome: "A", plural: "", opcional: false }]).codigo, "nome-vazio");
  });

  it("o Plano de Ação pede o Programa: do catálogo (vínculos) ou em texto livre", () => {
    const base = { tipo: "planoDeAcao", aprovacao: { identificacao: "23062.1" } };
    assert.equal(problemaDoTipo(base).codigo, "programa-vazio");
    assert.equal(problemaDoTipo({ ...base, vinculos: ["p1"] }), null);
    assert.equal(problemaDoTipo({ ...base, programa: "Programa X" }), null);
    const cat = { camadas: CAMADAS_PADRAO, itens: [{ id: "p1", camada: "programa" }, { id: "x", camada: "politica" }] };
    assert.equal(problemaDosVinculos(["p1"], cat), null);
    assert.equal(problemaDosVinculos(["x"], cat).codigo, "camada-errada");
    assert.equal(problemaDosVinculos(["sumiu"], cat).codigo, "nao-encontrado");
  });
});

for (const [nome, criarBanco, definirAdmins] of [
  ["memória", () => criarBancoLocal(), (banco, emails) => banco.gravarAdministradoresDoSistema({ emails })],
  ["Firestore (falso)", () => { const db = criarFirestoreFalso(); const b = criarBancoFirestore(db); b.__db = db; return b; },
    (banco, emails) => banco.__db.collection("sistema").doc("administradores").set({ emails })],
]) {
  describe(`Estratégia no Store, banco em ${nome}`, () => {
    async function cenario() {
      const banco = criarBanco();
      let n = 0;
      const como = (email) => criarStore(banco, { exigirLogin: true, usuario: email, hoje: () => "2026-10-24", novoId: () => `id${++n}` });
      await definirAdmins(banco, ["gestor@ufci.edu.br"]);
      return { banco, gestor: como("gestor@ufci.edu.br"), ana: como("ana@ufci.edu.br") };
    }

    it("só o Gestor da Estratégia (hoje, o Administrador do Sistema) altera o catálogo", async () => {
      const { gestor, ana } = await cenario();
      assert.equal(await gestor.ehGestorDaEstrategia(), true);
      await assert.rejects(ana.criarInstrumento({ nome: "PEI", inicio: "2021-01-01" }), { codigo: "sem-permissao" });
      await assert.rejects(ana.criarItemEstrategico({ camada: "programa", nome: "X" }), { codigo: "sem-permissao" });
      const cat = await ana.lerCatalogo();
      assert.equal(cat.camadas.length, 5);
    });

    it("monta a árvore com ligações várias, pulando a camada opcional", async () => {
      const { gestor } = await cenario();
      const pdi = await gestor.criarInstrumento({ nome: "PDI 2024–2028", inicio: "2024-01-01", fim: "2028-12-31", aprovacao: { identificacao: "Res. 1/2024" } });
      const oe = await gestor.criarItemEstrategico({ camada: "objetivoEstrategico", codigo: "OE1", nome: "Governança" });
      const od = await gestor.criarItemEstrategico({ camada: "objetivoDesenvolvimento", codigo: "OD1", nome: "Dados", instrumento: pdi, superiores: [oe] });
      const pol = await gestor.criarItemEstrategico({ camada: "politica", codigo: "POL1", nome: "Política de dados", superiores: [od] });
      const pol2 = await gestor.criarItemEstrategico({ camada: "politica", codigo: "POL2", nome: "Política de TI", superiores: [od] });
      const prg = await gestor.criarItemEstrategico({ camada: "programa", codigo: "PRG1", nome: "Programa de dados", superiores: [pol] }); // sem Portfólio
      await gestor.ligarSuperior(prg, pol2); // dois superiores
      await assert.rejects(gestor.ligarSuperior(prg, oe), { codigo: "camada-errada" });
      await assert.rejects(gestor.criarItemEstrategico({ camada: "programa", codigo: "prg1", nome: "Repetido" }), { codigo: "codigo-ocupado" });
      const { itens } = await gestor.lerCatalogo();
      assert.deepEqual(itens.find((x) => x.id === prg).superiores, [pol, pol2]);
      await gestor.desligarSuperior(prg, pol2);
      await assert.rejects(gestor.excluirItemEstrategico(pol), { codigo: "item-com-subordinados" });
      await assert.rejects(gestor.excluirInstrumento(pdi), { codigo: "instrumento-com-itens" });
    });

    it("prorroga o instrumento com registro; recusa encurtar", async () => {
      const { gestor } = await cenario();
      const pdi = await gestor.criarInstrumento({ nome: "PDI", inicio: "2024-01-01", fim: "2028-12-31" });
      await assert.rejects(gestor.prorrogarInstrumento(pdi, { fim: "2027-12-31" }), { codigo: "prorrogacao-invalida" });
      await gestor.prorrogarInstrumento(pdi, { fim: "2029-12-31", aprovacao: { identificacao: "Res. 9/2028" } });
      const [i] = (await gestor.lerCatalogo()).instrumentos;
      assert.equal(i.fim, "2029-12-31");
      assert.deepEqual(i.prorrogacoes.map((p) => [p.fimAnterior, p.fim, p.por, p.aprovacao.identificacao]), [["2028-12-31", "2029-12-31", "gestor@ufci.edu.br", "Res. 9/2028"]]);
    });

    it("recusa mudar camadas que deixariam itens soltos ou ligações inválidas", async () => {
      const { gestor } = await cenario();
      const pol = await gestor.criarItemEstrategico({ camada: "politica", nome: "Política" });
      await gestor.criarItemEstrategico({ camada: "programa", nome: "Programa", superiores: [pol] });
      const semPolitica = CAMADAS_PADRAO.filter((c) => c.id !== "politica");
      await assert.rejects(gestor.alterarCamadas(semPolitica), { codigo: "camada-com-itens" });
      const portfolioObrigatorio = CAMADAS_PADRAO.map((c) => (c.id === "portfolio" ? { ...c, opcional: false } : c));
      await assert.rejects(gestor.alterarCamadas(portfolioObrigatorio), { codigo: "ligacao-invalida" });
      await gestor.alterarCamadas(CAMADAS_PADRAO.map((c) => (c.id === "programa" ? { ...c, nome: "Programa Institucional", plural: "Programas Institucionais" } : c)));
      assert.equal((await gestor.lerCatalogo()).camadas.at(-1).nome, "Programa Institucional");
    });

    it("o Plano de Ação se liga a um Programa do catálogo; o item ligado não é excluído", async () => {
      const { gestor } = await cenario();
      const prg = await gestor.criarItemEstrategico({ camada: "programa", nome: "Programa" });
      const pol = await gestor.criarItemEstrategico({ camada: "politica", nome: "Política" });
      const plano = { nome: "Plano", tipo: "planoDeAcao", aprovacao: { identificacao: "Ofício 1" } };
      await assert.rejects(gestor.criarEspaco({ ...plano, vinculos: [pol] }), { codigo: "camada-errada" });
      const id = await gestor.criarEspaco({ ...plano, vinculos: [prg] });
      assert.deepEqual((await gestor.lerEspaco(id)).vinculos, [prg]);
      await assert.rejects(gestor.excluirItemEstrategico(prg), { codigo: "item-com-planos" });
    });

    it("importa o catálogo por planilha: cria, atualiza e liga, inclusive a linhas da própria planilha", async () => {
      const { gestor } = await cenario();
      await gestor.criarInstrumento({ nome: "PDI 2024–2028", inicio: "2024-01-01" });
      const texto = [
        "Camada\tCódigo\tNome\tSuperiores\tInstrumento",
        "Objetivo Estratégico\tOE1\tGovernança\t\t",
        "Objetivos de Desenvolvimento\tOD1\tDados\tOE1\tPDI 2024–2028",
        "Política\tPOL1\tPolítica de dados\tOD1\t",
        "Programa\tPRG1\tPrograma de dados\tPOL1; OE1\t",
        "Inexistente\tX\tX\t\t",
      ].join("\n");
      const cat = await gestor.lerCatalogo();
      const plano = planejarCatalogo({ texto, ...cat, normalizar, lerColagem });
      assert.deepEqual(plano.linhas.map((l) => l.tipo), ["novo", "novo", "novo", "novo", "erro"]);
      assert.ok(plano.linhas[3].avisos.some((a) => a.includes("OE1"))); // OE1 não é camada permitida para Programa
      const r = await gestor.importarCatalogo(plano);
      assert.deepEqual([r.criados, r.atualizados, r.falhas.length], [4, 0, 0]);
      const { itens, instrumentos } = await gestor.lerCatalogo();
      const por = (cod) => itens.find((x) => x.codigo === cod);
      assert.deepEqual(por("PRG1").superiores, [por("POL1").id]);
      assert.equal(por("OD1").instrumento, instrumentos[0].id);
      /* de novo, igual: nada muda; com nome novo: atualiza */
      const de2 = planejarCatalogo({ texto: texto.replace("\tDados\t", "\tDados abertos\t"), ...(await gestor.lerCatalogo()), normalizar, lerColagem });
      assert.deepEqual(de2.linhas.map((l) => l.tipo), ["igual", "atualiza", "igual", "igual", "erro"]);
    });

    it("a cópia de segurança leva o catálogo e a restauração o recria", async () => {
      const { gestor } = await cenario();
      await gestor.criarItemEstrategico({ camada: "programa", codigo: "P1", nome: "Programa" });
      const copia = JSON.parse(JSON.stringify(await gestor.copiaDeSeguranca()));
      assert.equal(copia.versao, 3);
      assert.equal(copia.estrategia.itens.length, 1);
      const destino = criarStore(criarBanco(), { usuario: "gestor@ufci.edu.br" });
      await destino.restaurarCopia(copia);
      assert.equal((await destino.lerCatalogo()).itens[0].codigo, "P1");
    });
  });
}
