/** Ligações externas da ação (23/11/2026; documentação técnica, seção 4.2.6). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarBancoLocal } from "../js/banco/local.js";
import { criarBancoFirestore } from "../js/banco/firestore.js";
import { criarFirestoreFalso } from "./firebase-falso.js";
import { criarStore } from "../js/dados.js";
import { descreverRegistro } from "../js/historico.js";
import { planilhaDoEspaco } from "../js/exportar.js";
import { reconhecerLink, chaveDoIdentificador, mesmoItem, problemaDaLigacao, ligacaoLimpa, textoDaLigacao, linkDoSipac, marcaDoLink, completarLigacao, ENDERECO_DO_SIPAC } from "../js/ligacoes.js";

const GLPI = "https://glpi.ufcimg.edu.br/front/ticket.form.php?id=1234";
const SIPAC = "https://sipac.ufcimg.edu.br/sipac/protocolo/processo/detalhes.jsf?id=98765";
const MEMO = "https://sig.cefetmg.br/sipac/protocolo/memorando_eletronico/memorando_eletronico.jsf?idMemorandoEletronico=1956755";
const HORDE = "https://webmail.ufcimg.edu.br/horde/imp/dynamic.php?page=message&uid=42";

describe("Ligações externas: regras", () => {
  it("reconhece o tipo pelo endereço e, quando o endereço traz, o número", () => {
    assert.deepEqual(reconhecerLink(GLPI), { tipo: "chamado", sistema: "glpi", identificador: "1234" });
    assert.deepEqual(reconhecerLink(MEMO), { tipo: "memorando", sistema: "sipac" });
    assert.deepEqual(reconhecerLink(SIPAC), { sistema: "sipac" }, "endereço do SIPAC que não diz o tipo");
    assert.deepEqual(reconhecerLink(HORDE), { tipo: "email", sistema: "horde" });
    assert.deepEqual(reconhecerLink(linkDoSipac("documento", "23062.1/2026-1")), { tipo: "documento", sistema: "sipac", identificador: "23062.1/2026-1" });
    assert.equal(reconhecerLink("https://exemplo.gov.br/pagina"), null);
    assert.equal(reconhecerLink("javascript:alert('glpi')"), null);
    assert.equal(reconhecerLink(""), null);
  });

  it("compara números pelos algarismos e e-mails sem < > nem maiúsculas; no SIPAC, o tipo não conta", () => {
    assert.equal(chaveDoIdentificador("sipac", "23062.004512/2026-10"), "23062004512202610");
    assert.equal(chaveDoIdentificador("horde", " <ABC@ufcimg.edu.br> "), "abc@ufcimg.edu.br");
    assert.ok(mesmoItem({ tipo: "processo", sistema: "sipac", identificador: "23062.004512/2026-10" }, { tipo: "memorando", sistema: "sipac", identificador: "23062004512202610" }));
    assert.ok(!mesmoItem({ sistema: "glpi", identificador: "12" }, { sistema: "sipac", identificador: "12" }));
  });

  it("aponta o problema de cada campo, inclusive o item repetido", () => {
    const ok = { tipo: "chamado", sistema: "glpi", identificador: "1234", link: GLPI };
    assert.equal(problemaDaLigacao(ok), null);
    assert.equal(problemaDaLigacao({ ...ok, tipo: "redmine" }).codigo, "tipo-invalido");
    assert.equal(problemaDaLigacao({ ...ok, sistema: "sipac" }).codigo, "sistema-invalido");
    assert.equal(problemaDaLigacao({ ...ok, identificador: " " }).codigo, "identificador-vazio");
    assert.equal(problemaDaLigacao({ ...ok, identificador: "abc" }).codigo, "identificador-invalido");
    const email = { tipo: "email", sistema: "horde", link: HORDE };
    assert.equal(problemaDaLigacao({ ...email, identificador: "<abc@x>" }), null);
    assert.equal(problemaDaLigacao({ ...email, titulo: "Convite" }), null, "e-mail sem identificador, com assunto");
    assert.equal(problemaDaLigacao(email).codigo, "titulo-vazio");
    assert.equal(problemaDaLigacao({ ...email, titulo: "A" }, [{ sistema: "horde", titulo: "A" }]), null, "sem número, não confere repetição");
    assert.equal(problemaDaLigacao({ tipo: "processo", sistema: "sipac", link: "https://x" }).mensagem, "Informe o NUP.");
    assert.equal(problemaDaLigacao({ tipo: "memorando", sistema: "sipac", identificador: "23062.1/2026-1" }).mensagem, "Cole o link do memorando.");
    assert.equal(problemaDaLigacao({ ...ok, link: "ftp://x" }).codigo, "link-invalido");
    assert.equal(problemaDaLigacao({ ...ok, titulo: "x".repeat(201) }).codigo, "titulo-longo");
    assert.equal(problemaDaLigacao(ok, [{ sistema: "glpi", identificador: " 1234 " }]).mensagem, "Este chamado já está ligado a esta tarefa.");
    assert.equal(problemaDaLigacao({ tipo: "memorando", sistema: "sipac", identificador: "23062.1/2026-1", link: MEMO }, [{ sistema: "sipac", identificador: "230621/2026-1" }]).mensagem, "Este memorando já está ligado a esta tarefa.");
  });

  it("processo e documento avulso: link montado pelo NUP; memorando: link colado", () => {
    const link = linkDoSipac("processo", " 23062.054143/2026-50 ");
    assert.equal(link, `${ENDERECO_DO_SIPAC}#sextante-processo=23062.054143%2F2026-50`);
    assert.deepEqual(marcaDoLink(link), { tipo: "processo", nup: "23062.054143/2026-50" });
    assert.equal(marcaDoLink(GLPI), null);
    const sessao = "https://sig.cefetmg.br/sipac/protocolo/mesa_virtual/processo.jsf";
    assert.deepEqual(completarLigacao({ tipo: "processo", identificador: "23062.054143/2026-50", link: sessao }), { tipo: "processo", sistema: "sipac", identificador: "23062.054143/2026-50", link }, "troca o link de sessão colado e põe o sistema");
    assert.equal(completarLigacao({ tipo: "documento", identificador: "23062.1/2026-1", link: "" }).link, linkDoSipac("documento", "23062.1/2026-1"));
    assert.equal(completarLigacao({ tipo: "processo", identificador: "", link: "" }).link, "", "sem NUP, nada a montar");
    assert.equal(completarLigacao({ tipo: "memorando", identificador: "23062.1/2026-1", link: MEMO }).link, MEMO, "memorando guarda o link colado");
    assert.equal(completarLigacao({ tipo: "chamado", identificador: "1", link: GLPI }).sistema, "glpi");
  });

  it("limpa os dados e escreve o texto curto", () => {
    assert.deepEqual(ligacaoLimpa({ tipo: "chamado", sistema: "glpi", identificador: " 1234 ", titulo: "  ", link: ` ${GLPI} ` }), { tipo: "chamado", sistema: "glpi", identificador: "1234", link: GLPI });
    assert.deepEqual(ligacaoLimpa({ tipo: "email", sistema: "horde", identificador: " ", titulo: "Convite", link: HORDE }), { tipo: "email", sistema: "horde", titulo: "Convite", link: HORDE });
    assert.equal(textoDaLigacao({ tipo: "chamado", sistema: "glpi", identificador: "1234", titulo: "Impressora" }), "Chamado (GLPI) 1234 – Impressora");
    assert.equal(textoDaLigacao({ tipo: "processo", sistema: "sipac", identificador: "23062.1/2026-1" }), "Processo (SIPAC), NUP 23062.1/2026-1");
    assert.equal(textoDaLigacao({ tipo: "email", sistema: "horde", identificador: "<a@b>", titulo: "Convite" }), "E-mail (Horde) – Convite");
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
      const l1 = await store.ligarItemExterno(id, a, { tipo: "chamado", identificador: " 1234 ", titulo: " Impressora ", link: GLPI });
      const l2 = await store.ligarItemExterno(id, a, { tipo: "processo", identificador: "23062.004512/2026-10", titulo: "", link: "" });
      const lidas = (await store.lerAcao(id, a)).ligacoesExternas;
      assert.deepEqual(lidas.map(({ ligadaEm, ...x }) => x), [
        { id: l1, tipo: "chamado", sistema: "glpi", identificador: "1234", titulo: "Impressora", link: GLPI, ligadaPor: "ana@ufci.edu.br" },
        { id: l2, tipo: "processo", sistema: "sipac", identificador: "23062.004512/2026-10", link: linkDoSipac("processo", "23062.004512/2026-10"), ligadaPor: "ana@ufci.edu.br" },
      ]);
      assert.ok(lidas.every((l) => l.ligadaEm.startsWith("2026-11-23")));
      await store.desligarItemExterno(id, a, l1);
      assert.deepEqual((await store.lerAcao(id, a)).ligacoesExternas.map((l) => l.id), [l2]);
    });

    it("recusa dados inválidos, item repetido, campo desconhecido e ação inexistente", async () => {
      const { store, id, a } = await novo();
      await store.ligarItemExterno(id, a, { tipo: "chamado", identificador: "1234", link: GLPI });
      await assert.rejects(store.ligarItemExterno(id, a, { tipo: "chamado", identificador: "1234", link: GLPI }), { codigo: "ligacao-repetida" });
      await assert.rejects(store.ligarItemExterno(id, a, { tipo: "x", identificador: "1", link: GLPI }), { codigo: "tipo-invalido" });
      await assert.rejects(store.ligarItemExterno(id, a, { tipo: "chamado", identificador: "1", link: "javascript:alert(1)" }), { codigo: "link-invalido" });
      await assert.rejects(store.ligarItemExterno(id, a, { tipo: "chamado", identificador: "1", link: GLPI, conteudo: "texto" }), { codigo: "campo-desconhecido" });
      await assert.rejects(store.ligarItemExterno(id, 99, { tipo: "chamado", identificador: "2", link: GLPI }), { codigo: "nao-encontrado" });
      await assert.rejects(store.criarAcao(id, { rotulo: "Y", ligacoesExternas: [{ tipo: "chamado", sistema: "glpi", identificador: "1", link: GLPI }] }), { codigo: "id-repetido" });
    });

    it("cada ligação feita ou desfeita entra no histórico", async () => {
      const { store, id, a } = await novo();
      const l1 = await store.ligarItemExterno(id, a, { tipo: "chamado", identificador: "1234", titulo: "Impressora", link: GLPI });
      await store.desligarItemExterno(id, a, l1);
      const rs = (await store.listarHistorico(id, a)).filter((r) => r.campo === "ligacoesExternas");
      assert.deepEqual(rs.map((r) => descreverRegistro(r, {})), [
        "Ligações externas: ligou Chamado (GLPI) 1234 – Impressora.",
        "Ligações externas: desligou Chamado (GLPI) 1234 – Impressora.",
      ]);
    });

    it("a planilha ganha a coluna só quando alguma ação tem ligação", async () => {
      const { store, id, a } = await novo();
      const colunas = async () => {
        const espaco = await store.lerEspaco(id);
        return planilhaDoEspaco({ espaco, acoes: await store.listarAcoes(id), responsaveis: [], geral: {}, hoje: "2026-11-23" }).split("\n");
      };
      assert.ok(!(await colunas())[0].includes("Ligações externas"));
      await store.ligarItemExterno(id, a, { tipo: "chamado", identificador: "1234", titulo: "Impressora", link: GLPI });
      const [titulos, linha] = await colunas();
      const i = titulos.split("\t").indexOf("Ligações externas");
      assert.ok(i >= 0);
      assert.equal(linha.split("\t")[i], `Chamado (GLPI) 1234 – Impressora (${GLPI})`);
    });
  });
}
