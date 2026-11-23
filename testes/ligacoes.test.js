/** Ligações externas da ação (23/11/2026; documentação técnica, seção 4.2.6). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { descreverRegistro } from "../js/historico.js";
import { planilhaDoEspaco } from "../js/exportar.js";
import { reconhecerLink, chaveDoIdentificador, mesmoItem, problemaDaLigacao, ligacaoLimpa, textoDaLigacao, linkDoSipac, nupDoLink, completarLigacao, ENDERECO_DO_SIPAC } from "../js/ligacoes.js";

const GLPI = "https://glpi.ufcimg.edu.br/front/ticket.form.php?id=1234";
const SIPAC = "https://sipac.ufcimg.edu.br/sipac/protocolo/processo/detalhes.jsf?id=98765";
const HORDE = "https://webmail.ufcimg.edu.br/horde/imp/dynamic.php?page=message&uid=42";

describe("Ligações externas: regras", () => {
  it("reconhece o sistema pelo endereço e, no GLPI, também o número", () => {
    assert.deepEqual(reconhecerLink(GLPI), { sistema: "glpi", identificador: "1234" });
    assert.deepEqual(reconhecerLink(SIPAC), { sistema: "sipac" });
    assert.deepEqual(reconhecerLink(HORDE), { sistema: "horde" });
    assert.equal(reconhecerLink("https://exemplo.gov.br/pagina"), null);
    assert.equal(reconhecerLink("javascript:alert('glpi')"), null);
    assert.equal(reconhecerLink(""), null);
  });

  it("compara números pelos algarismos e e-mails sem < > nem maiúsculas", () => {
    assert.equal(chaveDoIdentificador("sipac", "23062.004512/2026-10"), "23062004512202610");
    assert.equal(chaveDoIdentificador("horde", " <ABC@ufcimg.edu.br> "), "abc@ufcimg.edu.br");
    assert.ok(mesmoItem({ sistema: "sipac", identificador: "23062.004512/2026-10" }, { sistema: "sipac", identificador: "23062004512202610" }));
    assert.ok(!mesmoItem({ sistema: "glpi", identificador: "12" }, { sistema: "sipac", identificador: "12" }));
  });

  it("aponta o problema de cada campo, inclusive o item repetido", () => {
    const ok = { sistema: "glpi", identificador: "1234", link: GLPI };
    assert.equal(problemaDaLigacao(ok), null);
    assert.equal(problemaDaLigacao({ ...ok, sistema: "redmine" }).codigo, "sistema-invalido");
    assert.equal(problemaDaLigacao({ ...ok, identificador: " " }).codigo, "identificador-vazio");
    assert.equal(problemaDaLigacao({ ...ok, identificador: "abc" }).codigo, "identificador-invalido");
    assert.equal(problemaDaLigacao({ ...ok, sistema: "horde", identificador: "<abc@x>" }), null);
    assert.equal(problemaDaLigacao({ ...ok, sistema: "horde", identificador: "", titulo: "Convite" }), null, "e-mail sem identificador, com assunto");
    assert.equal(problemaDaLigacao({ ...ok, sistema: "horde", identificador: "" }).codigo, "titulo-vazio");
    assert.equal(problemaDaLigacao({ ...ok, sistema: "sipac", identificador: "" }).mensagem, "Informe o NUP.");
    assert.equal(problemaDaLigacao({ ...ok, sistema: "horde", identificador: "", titulo: "A" }, [{ sistema: "horde", titulo: "A" }]), null, "sem número, não confere repetição");
    assert.equal(problemaDaLigacao({ ...ok, link: "" }).codigo, "link-vazio");
    assert.equal(problemaDaLigacao({ ...ok, link: "ftp://x" }).codigo, "link-invalido");
    assert.equal(problemaDaLigacao({ ...ok, titulo: "x".repeat(201) }).codigo, "titulo-longo");
    assert.equal(problemaDaLigacao(ok, [{ sistema: "glpi", identificador: " 1234 " }]).codigo, "ligacao-repetida");
  });

  it("no SIPAC, o link é montado pelo NUP, e o NUP volta da marca", () => {
    const link = linkDoSipac(" 23062.054143/2026-50 ");
    assert.equal(link, `${ENDERECO_DO_SIPAC}#sextante-nup=23062.054143%2F2026-50`);
    assert.equal(nupDoLink(link), "23062.054143/2026-50");
    assert.equal(nupDoLink(GLPI), null);
    assert.equal(completarLigacao({ sistema: "sipac", identificador: "23062.054143/2026-50", link: "https://sig.cefetmg.br/sipac/protocolo/mesa_virtual/processo.jsf" }).link, link, "troca o link de sessão colado");
    assert.equal(completarLigacao({ sistema: "sipac", identificador: "", link: "" }).link, "", "sem NUP, nada a montar");
    assert.equal(completarLigacao({ sistema: "glpi", identificador: "1", link: GLPI }).link, GLPI);
    assert.equal(reconhecerLink(link).sistema, "sipac");
  });

  it("limpa os dados e escreve o texto curto", () => {
    assert.deepEqual(ligacaoLimpa({ sistema: "glpi", identificador: " 1234 ", titulo: "  ", link: ` ${GLPI} ` }), { sistema: "glpi", identificador: "1234", link: GLPI });
    assert.deepEqual(ligacaoLimpa({ sistema: "horde", identificador: " ", titulo: "Convite", link: HORDE }), { sistema: "horde", titulo: "Convite", link: HORDE });
    assert.equal(textoDaLigacao({ sistema: "glpi", identificador: "1234", titulo: "Impressora" }), "GLPI, Chamado 1234 – Impressora");
    assert.equal(textoDaLigacao({ sistema: "sipac", identificador: "23062.1/2026-1" }), "SIPAC/Protocolo, NUP 23062.1/2026-1");
    assert.equal(textoDaLigacao({ sistema: "horde", identificador: "<a@b>", titulo: "Convite" }), "Horde – Convite");
  });
});

for (const [nome, criarBanco] of [
  ["memória", () => criarBancoLocal()],
  ["Firestore (falso)", () => criarBancoFirestore(criarFirestoreFalso())],
]) {
  describe(`Ligações externas no Store, banco em ${nome}`, () => {
    const novo = async () => {
      let relogio = 0;
      let n = 0;
      const store = criarStore(criarBanco(), {
        usuario: "ana@ufci.edu.br", hoje: () => "2026-11-23", novoId: () => `id${++n}`,
        agora: () => new Date(Date.UTC(2026, 10, 23, 10, 0, relogio++)).toISOString(),
      });
      const id = await store.criarEspaco({ nome: "E", inicio: "2026-11-01" });
      const a = await store.criarAcao(id, { rotulo: "Trocar a impressora" });
      return { store, id, a };
    };

    it("liga e desliga, com data e autor, guardando só o que foi preenchido", async () => {
      const { store, id, a } = await novo();
      const l1 = await store.ligarItemExterno(id, a, { sistema: "glpi", identificador: " 1234 ", titulo: " Impressora ", link: GLPI });
      const l2 = await store.ligarItemExterno(id, a, { sistema: "sipac", identificador: "23062.004512/2026-10", titulo: "", link: "" });
      const lidas = (await store.lerAcao(id, a)).ligacoesExternas;
      assert.deepEqual(lidas.map(({ ligadaEm, ...x }) => x), [
        { id: l1, sistema: "glpi", identificador: "1234", titulo: "Impressora", link: GLPI, ligadaPor: "ana@ufci.edu.br" },
        { id: l2, sistema: "sipac", identificador: "23062.004512/2026-10", link: linkDoSipac("23062.004512/2026-10"), ligadaPor: "ana@ufci.edu.br" },
      ]);
      assert.ok(lidas.every((l) => l.ligadaEm.startsWith("2026-11-23")));
      await store.desligarItemExterno(id, a, l1);
      assert.deepEqual((await store.lerAcao(id, a)).ligacoesExternas.map((l) => l.id), [l2]);
    });

    it("recusa dados inválidos, item repetido, campo desconhecido e ação inexistente", async () => {
      const { store, id, a } = await novo();
      await store.ligarItemExterno(id, a, { sistema: "glpi", identificador: "1234", link: GLPI });
      await assert.rejects(store.ligarItemExterno(id, a, { sistema: "glpi", identificador: "1234", link: GLPI }), { codigo: "ligacao-repetida" });
      await assert.rejects(store.ligarItemExterno(id, a, { sistema: "x", identificador: "1", link: GLPI }), { codigo: "sistema-invalido" });
      await assert.rejects(store.ligarItemExterno(id, a, { sistema: "glpi", identificador: "1", link: "javascript:alert(1)" }), { codigo: "link-invalido" });
      await assert.rejects(store.ligarItemExterno(id, a, { sistema: "glpi", identificador: "1", link: GLPI, conteudo: "texto" }), { codigo: "campo-desconhecido" });
      await assert.rejects(store.ligarItemExterno(id, 99, { sistema: "glpi", identificador: "2", link: GLPI }), { codigo: "nao-encontrado" });
      await assert.rejects(store.criarAcao(id, { rotulo: "Y", ligacoesExternas: [{ sistema: "glpi", identificador: "1", link: GLPI }] }), { codigo: "id-repetido" });
    });

    it("cada ligação feita ou desfeita entra no histórico", async () => {
      const { store, id, a } = await novo();
      const l1 = await store.ligarItemExterno(id, a, { sistema: "glpi", identificador: "1234", titulo: "Impressora", link: GLPI });
      await store.desligarItemExterno(id, a, l1);
      const rs = (await store.listarHistorico(id, a)).filter((r) => r.campo === "ligacoesExternas");
      assert.deepEqual(rs.map((r) => descreverRegistro(r, {})), [
        "Ligações externas: ligou GLPI, Chamado 1234 – Impressora.",
        "Ligações externas: desligou GLPI, Chamado 1234 – Impressora.",
      ]);
    });

    it("a planilha ganha a coluna só quando alguma ação tem ligação", async () => {
      const { store, id, a } = await novo();
      const colunas = async () => {
        const espaco = await store.lerEspaco(id);
        return planilhaDoEspaco({ espaco, acoes: await store.listarAcoes(id), responsaveis: [], geral: {}, hoje: "2026-11-23" }).split("\n");
      };
      assert.ok(!(await colunas())[0].includes("Ligações externas"));
      await store.ligarItemExterno(id, a, { sistema: "glpi", identificador: "1234", titulo: "Impressora", link: GLPI });
      const [titulos, linha] = await colunas();
      const i = titulos.split("\t").indexOf("Ligações externas");
      assert.ok(i >= 0);
      assert.equal(linha.split("\t")[i], `GLPI, Chamado 1234 – Impressora (${GLPI})`);
    });
  });
}
