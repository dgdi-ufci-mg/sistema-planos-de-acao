/**
 * Configurar o espaço (especificação, seções 4.1 e 8.1; passo 1.13): painel lateral aberto pelo
 * menu do espaço, com dados e datas, datas excluídas, fases e etapas, campos opcionais,
 * documentos e a semente da simulação (visível, mas fixa). Cada seção é gravada pelo seu botão
 * Salvar; os campos opcionais, na hora. Exportação (passo 1.19a): copiar para planilha e copiar
 * o fluxograma em Mermaid. Retratos e importação entram nos passos 1.18 e 1.19b.
 */
import { ligarSecoesSuaves } from "./movimento.js";
import { criarTelaResponsaveis } from "./responsaveis.js";
import { esc, dataBr, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { VERSAO_CALCULO } from "../simulacao.js";
import { datasEfetivas } from "../calendario.js";
import { abrirPainel, fecharPainel, avisar } from "./painel.js";
import { excluirEtapas, excluirEspaco } from "./exclusao.js";
import { marcarPendencias, AVISO_PENDENTE } from "./pendencias.js";
import { planilhaDoEspaco, mermaidDoEspaco } from "../exportar.js";
import { hojeLocal } from "../dados.js";
import { copiarTexto } from "./arquivos.js";

const CAMPOS_OPCIONAIS = [
  ["fasesEtapas", "Fases e etapas", "Separadores que agrupam as ações na lista."],
  ["descricao", "Descrição", "Texto completo de cada ação."],
  ["notas", "Notas", "Anotações formatadas de cada ação."],
  ["codigos", "Códigos das ações", "Códigos curtos, como LEV, para equipes que conversam por eles. Desligado, as ações aparecem só pelo nome."],
];
/** Campos opcionais desligados por padrão (seção 4.1.4); os demais vêm ligados. */
const DESLIGADOS_POR_PADRAO = new Set(["codigos"]);
const ligado = (campos, chave) => (DESLIGADOS_POR_PADRAO.has(chave) ? campos?.[chave] === true : campos?.[chave] !== false);

/** @param {{store: object, espacoId: string, aoExcluirEspaco?: () => void}} opcoes */
export async function abrirConfiguracao({ store, espacoId, aoExcluirEspaco = () => {} }) {
  let espaco = await store.lerEspaco(espacoId);
  let geral = await store.lerCalendarioGeral();
  let acoes = await store.listarAcoes(espacoId);
  let responsaveis = await store.listarResponsaveis(espacoId);
  /** responsáveis do espaço (seção 4.5): a mesma tela de antes, agora numa seção deste painel */
  const telaResponsaveis = criarTelaResponsaveis({ store });
  const meus = () => (store.usuario ? responsaveis.filter((r) => r.usuario === store.usuario).map((r) => r.id) : null);
  const desenharResponsaveis = () => {
    const alvo = corpo.querySelector("[data-responsaveis]");
    if (alvo) telaResponsaveis.desenhar(alvo, { espaco, acoes, responsaveis, meus: meus() });
    const n = corpo.querySelector('[data-secao="responsaveis"] > summary .n');
    if (n) n.textContent = String(responsaveis.length);
  };
  const novoId = (prefixo) => `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  /** Rascunhos das listas, editados na tela até o Salvar da seção. */
  const rascunho = {
    datas: structuredClone(espaco.datasExcluidas ?? []),
    estrutura: structuredClone(espaco.estrutura ?? []),
    documentos: structuredClone(espaco.documentos ?? []),
  };

  /* enquanto o painel está aberto, mudanças nos responsáveis (de quem quer que seja) aparecem na seção;
     as demais seções não são redesenhadas, para não perder o que está sendo digitado */
  let pararDeAcompanhar = () => {};
  const corpo = abrirPainel("Configurar este espaço", "", { aoFechar: () => pararDeAcompanhar() });
  ligarSecoesSuaves(corpo);
  /** Seções abertas; os dados do espaço começam abertos. Mantidas quando o painel é redesenhado. */
  const abertas = new Set(["dados"]);
  const aberta = (secao) => (abertas.has(secao) ? " open" : "");
  corpo.addEventListener("toggle", (e) => {
    const secao = e.target.dataset?.secao;
    if (secao) e.target.open ? abertas.add(secao) : abertas.delete(secao);
  }, true);

  async function recarregar() {
    espaco = await store.lerEspaco(espacoId);
    geral = await store.lerCalendarioGeral();
    acoes = await store.listarAcoes(espacoId);
    responsaveis = await store.listarResponsaveis(espacoId);
  }

  /* ---------- desenho ---------- */
  function marcar() {
    marcarPendencias(corpo.querySelector('[data-salvar="datas"]'), rascunho.datas, espaco.datasExcluidas, ["data", "motivo"]);
    marcarPendencias(corpo.querySelector('[data-salvar="documentos"]'), rascunho.documentos, espaco.documentos, ["nome", "data", "identificacao", "link"]);
  }

  function desenhar() {
    desenharSecoes();
    desenharResponsaveis();
    marcar();
  }

  function desenharSecoes() {
    const campos = espaco.camposOpcionais ?? {};
    corpo.innerHTML = `
      <details class="config" data-secao="dados"${aberta("dados")}>
        <summary><h3>Dados do espaço</h3></summary>
        <form class="editor" data-salvar="dados">
          <label class="campo"><span>Nome</span><input name="nome" maxlength="120" value="${esc(espaco.nome)}"></label>
          <div class="campos-lado-a-lado">
            <label class="campo"><span>Início</span><input name="inicio" type="date" value="${esc(espaco.inicio ?? "")}"></label>
            <label class="campo"><span>Prazo final <small>(opcional)</small></span><input name="prazoFinal" type="date" value="${esc(espaco.prazoFinal ?? "")}"></label>
          </div>
          <p class="erro" data-erro hidden></p>
          <div class="botoes"><button class="botao principal" type="submit">Salvar</button></div>
        </form>
      </details>

      <details class="config" data-secao="datas"${aberta("datas")}>
        <summary><h3>Datas excluídas</h3><span class="n">${datasEfetivas(espaco, geral).length}</span></summary>
        <p class="tec">Dias sem expediente, que não contam como dias úteis. Valem as datas do calendário geral, cuidado em
          "Configurar o sistema", mais as deste espaço, como feriados locais.</p>
        <h4>Do calendário geral</h4>
        ${geraisHtml()}
        <h4>Deste espaço</h4>
        <form class="editor" data-salvar="datas">
          <div class="linhas-config">${rascunho.datas.map((d, i) => `<div class="linha-config" data-linha-lista="${i}">
            <input type="date" data-lista="datas" data-indice="${i}" data-campo="data" value="${esc(d.data ?? "")}" aria-label="Data">
            <input data-lista="datas" data-indice="${i}" data-campo="motivo" value="${esc(d.motivo ?? "")}" placeholder="Motivo (opcional)" aria-label="Motivo">
            <button type="button" class="tirar" data-tirar="datas" data-indice="${i}" aria-label="Retirar a data">${ICONES.fechar}</button>
          </div>`).join("") || `<p class="vazio">Nenhuma data própria.</p>`}</div>
          <p class="erro" data-erro hidden></p>
          <div class="botoes"><button class="botao" type="button" data-acrescentar="datas">${ICONES.mais}Data</button><button class="botao principal" type="submit">Salvar</button>${AVISO_PENDENTE}</div>
        </form>
      </details>

      <details class="config" data-secao="responsaveis"${aberta("responsaveis")}>
        <summary><h3>Responsáveis</h3><span class="n">${responsaveis.length}</span></summary>
        <div class="responsaveis-do-espaco" data-responsaveis></div>
      </details>

      ${ligado(campos, "fasesEtapas") ? estruturaHtml() : ""}

      <details class="config" data-secao="campos"${aberta("campos")}>
        <summary><h3>Campos opcionais</h3></summary>
        <p class="tec">Desligar um campo o esconde da tela; o que já foi preenchido é mantido.</p>
        ${CAMPOS_OPCIONAIS.map(([chave, titulo, dica]) => `<label class="alternar-campo">
          <input type="checkbox" data-campo-opcional="${chave}"${ligado(campos, chave) ? " checked" : ""}>
          <span><b>${titulo}</b><small>${dica}</small></span></label>`).join("")}
      </details>

      <details class="config" data-secao="documentos"${aberta("documentos")}>
        <summary><h3>Documentos do espaço</h3><span class="n">${rascunho.documentos.length}</span></summary>
        <p class="tec">Por exemplo, o plano aprovado e as revisões, com a identificação no SIPAC/Protocolo e o link.</p>
        <form class="editor" data-salvar="documentos">
          <div class="linhas-config">${rascunho.documentos.map((doc, i) => `<div class="documento-config" data-linha-lista="${i}">
            <input data-lista="documentos" data-indice="${i}" data-campo="nome" value="${esc(doc.nome ?? "")}" placeholder="Nome do documento" aria-label="Nome do documento">
            <div class="campos-lado-a-lado">
              <input type="date" data-lista="documentos" data-indice="${i}" data-campo="data" value="${esc(doc.data ?? "")}" aria-label="Data do documento">
              <input data-lista="documentos" data-indice="${i}" data-campo="identificacao" value="${esc(doc.identificacao ?? "")}" placeholder="Nº no SIPAC/Protocolo" aria-label="Identificação no SIPAC/Protocolo">
            </div>
            <div class="linha-config">
              <input type="url" data-lista="documentos" data-indice="${i}" data-campo="link" value="${esc(doc.link ?? "")}" placeholder="https://…" aria-label="Link">
              ${doc.link && /^https?:\/\//i.test(doc.link) ? `<a href="${esc(doc.link)}" target="_blank" rel="noopener noreferrer" class="botao discreto">Abrir</a>` : ""}
              <button type="button" class="tirar" data-tirar="documentos" data-indice="${i}" aria-label="Retirar o documento">${ICONES.fechar}</button>
            </div>
          </div>`).join("") || `<p class="vazio">Nenhum documento.</p>`}</div>
          <p class="erro" data-erro hidden></p>
          <div class="botoes"><button class="botao" type="button" data-acrescentar="documentos">${ICONES.mais}Documento</button><button class="botao principal" type="submit">Salvar</button>${AVISO_PENDENTE}</div>
        </form>
      </details>

      <details class="config" data-secao="simulacao"${aberta("simulacao")}>
        <summary><h3>Simulação</h3></summary>
        <dl class="numeros">
          <div><dt>Semente</dt><dd>${espaco.semente}</dd></div>
          <div><dt>Cenários simulados</dt><dd>${espaco.simulacoes.toLocaleString("pt-BR")}</dd></div>
          <div><dt>Versão do cálculo</dt><dd>${VERSAO_CALCULO}</dd></div>
        </dl>
        <p class="tec">Fixos desde a criação do espaço, para que qualquer pessoa obtenha os mesmos resultados ao refazer o cálculo.</p>
      </details>

      <details class="config" data-secao="exportar"${aberta("exportar")}>
        <summary><h3>Exportar</h3></summary>
        <p class="tec">Copia as ações deste espaço, com as datas previstas, a folga e a situação, prontas para colar no Google Planilhas ou no Excel.</p>
        <div class="botoes"><button class="botao" type="button" data-exportar="planilha">Copiar para planilha</button></div>
        <p class="tec">Copia o fluxograma das ações em linguagem Mermaid, com as fases e etapas como grupos e as ações sem folga destacadas. Cole em mermaid.live para ver o desenho.</p>
        <div class="botoes"><button class="botao" type="button" data-exportar="mermaid">Copiar fluxograma</button></div>
        <textarea class="texto-exportado" data-exportado rows="6" readonly hidden aria-label="Texto exportado"></textarea>
      </details>

      <p class="tec">Retratos e importação chegam nos próximos passos. A cópia de segurança de todos os espaços fica em "Configurar o sistema".</p>
      ${store.podeGravar ? '<div class="zona-exclusao"><button class="botao-excluir" type="button" data-excluir-espaco>Excluir este espaço</button></div>' : ""}`;
  }

  /** Datas do calendário geral a partir do início do espaço, cada uma com a opção de desconsiderar. */
  function geraisHtml() {
    const desde = espaco.inicio ?? "";
    const lista = geral.datasExcluidas.filter((d) => d.data >= desde);
    if (!lista.length) {
      return `<p class="vazio">${geral.datasExcluidas.length ? "Nenhuma data geral a partir do início do espaço." : "O calendário geral ainda não tem datas."}</p>`;
    }
    const fora = new Set(espaco.datasGeraisDesconsideradas ?? []);
    return `<div class="gerais-config">${lista.map((d) => `<label class="geral-config${fora.has(d.data) ? " desconsiderada" : ""}">
      <span class="mono">${dataBr(d.data)}</span><span>${esc(d.motivo ?? "")}</span>
      <span class="desconsiderar"><input type="checkbox" data-desconsiderar="${esc(d.data)}"${fora.has(d.data) ? " checked" : ""}> desconsiderar</span>
    </label>`).join("")}</div>
    <p class="tec">Marque "desconsiderar" nas datas em que este espaço trabalha, como um ponto facultativo.</p>`;
  }

  function estruturaHtml() {
    const usos = new Map();
    for (const a of acoes) if (a.etapa) usos.set(a.etapa, (usos.get(a.etapa) ?? 0) + 1);
    const botaoMover = (lista, i, total, sentido, extra = "") => `<button type="button" class="tirar" data-mover="${lista}" data-indice="${i}"${extra} data-sentido="${sentido}"
      aria-label="${sentido < 0 ? "Subir" : "Descer"}"${(sentido < 0 && i === 0) || (sentido > 0 && i === total - 1) ? " disabled" : ""}>${sentido < 0 ? "↑" : "↓"}</button>`;
    /* com ações, o × pergunta para onde elas vão e grava na hora (passo 1.15) */
    const botaoTirar = (n, atributos) => `<button type="button" class="tirar" ${atributos}${n ? ` data-com-acoes="${n}"` : ""} aria-label="Retirar">${ICONES.fechar}</button>`;
    return `<details class="config" data-secao="estrutura"${aberta("estrutura")}>
      <summary><h3>Fases e etapas</h3><span class="n">${rascunho.estrutura.length}</span></summary>
      <p class="tec">As fases agrupam etapas, e as etapas agrupam ações, na ordem desta lista.</p>
      <form class="editor" data-salvar="estrutura">
        ${rascunho.estrutura.map((f, i) => {
          const nFase = f.etapas.reduce((n, e) => n + (usos.get(e.id) ?? 0), 0);
          return `<div class="fase-config">
            <div class="linha-config">
              <input data-fase="${i}" value="${esc(f.nome)}" placeholder="Nome da fase" aria-label="Nome da fase">
              ${botaoMover("fases", i, rascunho.estrutura.length, -1)}${botaoMover("fases", i, rascunho.estrutura.length, 1)}
              ${botaoTirar(nFase, `data-tirar-fase="${i}"`)}
            </div>
            <div class="etapas-config">${f.etapas.map((e, j) => `<div class="linha-config">
              <input data-fase="${i}" data-etapa="${j}" value="${esc(e.nome)}" placeholder="Nome da etapa" aria-label="Nome da etapa">
              ${botaoMover("etapas", j, f.etapas.length, -1, ` data-fase-da-etapa="${i}"`)}${botaoMover("etapas", j, f.etapas.length, 1, ` data-fase-da-etapa="${i}"`)}
              ${botaoTirar(usos.get(e.id) ?? 0, `data-tirar-etapa="${j}" data-fase-da-etapa="${i}"`)}
            </div>`).join("")}
              <button type="button" class="botao discreto" data-acrescentar-etapa="${i}">${ICONES.mais}Etapa</button>
            </div>
          </div>`;
        }).join("") || `<p class="vazio">Nenhuma fase.</p>`}
        <p class="erro" data-erro hidden></p>
        <div class="botoes"><button class="botao" type="button" data-acrescentar="fase">${ICONES.mais}Fase</button><button class="botao principal" type="submit">Salvar</button></div>
      </form>
    </details>`;
  }

  /* ---------- gravação ---------- */
  async function salvar(form) {
    const secao = form.dataset.salvar;
    const erro = form.querySelector("[data-erro]");
    const limpo = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null));
    try {
      if (secao === "dados") {
        const f = Object.fromEntries(new FormData(form));
        await store.alterarEspaco(espacoId, { nome: f.nome, inicio: f.inicio || null, prazoFinal: f.prazoFinal || null });
      } else if (secao === "datas") {
        const datas = rascunho.datas.map((d) => limpo({ data: d.data, motivo: d.motivo?.trim() })).sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
        await store.alterarEspaco(espacoId, { datasExcluidas: datas });
      } else if (secao === "estrutura") {
        await store.alterarEspaco(espacoId, { estrutura: rascunho.estrutura.map((f) => ({ ...f, nome: f.nome.trim(), etapas: f.etapas.map((e) => ({ ...e, nome: e.nome.trim() })) })) });
      } else if (secao === "documentos") {
        await store.alterarEspaco(espacoId, { documentos: rascunho.documentos.map((d) => limpo({ nome: d.nome?.trim(), data: d.data, identificacao: d.identificacao?.trim(), link: d.link?.trim() })) });
      }
      await recarregar();
      if (secao === "datas") rascunho.datas = structuredClone(espaco.datasExcluidas ?? []);
      if (secao === "documentos") rascunho.documentos = structuredClone(espaco.documentos ?? []);
      desenhar();
      avisar("Configuração salva.");
    } catch (e) {
      erro.textContent = e.message;
      erro.hidden = false;
    }
  }

  /* ---------- eventos ---------- */
  corpo.addEventListener("input", (e) => {
    const t = e.target;
    queueMicrotask(marcar);
    if (t.dataset.lista) rascunho[t.dataset.lista][Number(t.dataset.indice)][t.dataset.campo] = t.value;
    else if (t.dataset.etapa != null) rascunho.estrutura[Number(t.dataset.fase)].etapas[Number(t.dataset.etapa)].nome = t.value;
    else if (t.dataset.fase != null) rascunho.estrutura[Number(t.dataset.fase)].nome = t.value;
  });
  corpo.addEventListener("change", async (e) => {
    const data = e.target.dataset.desconsiderar;
    if (data) {
      const atuais = new Set(espaco.datasGeraisDesconsideradas ?? []);
      if (e.target.checked) atuais.add(data); else atuais.delete(data);
      try {
        await store.alterarEspaco(espacoId, { datasGeraisDesconsideradas: [...atuais].sort() });
        await recarregar();
        desenhar();
      } catch (falha) {
        avisar(falha.message);
      }
      return;
    }
    const chave = e.target.dataset.campoOpcional;
    if (!chave) return;
    try {
      await store.alterarEspaco(espacoId, { camposOpcionais: { ...(espaco.camposOpcionais ?? {}), [chave]: e.target.checked } });
      await recarregar();
      desenhar();
    } catch (falha) {
      avisar(falha.message);
    }
  });
  /** Fase ou etapa com ações: pergunta e grava na hora; o resto do rascunho continua como estava. */
  async function tirarComAcoes(t) {
    const fase = rascunho.estrutura[Number(t.dataset.tirarFase ?? t.dataset.faseDaEtapa)];
    const ehFase = t.dataset.tirarFase != null;
    const etapa = ehFase ? null : fase.etapas[Number(t.dataset.tirarEtapa)];
    const ids = ehFase ? [fase.id, ...fase.etapas.map((x) => x.id)] : [etapa.id];
    const fora = new Set(ids);
    const etapasQueFicam = (espaco.estrutura ?? []).filter((f) => !fora.has(f.id))
      .flatMap((f) => f.etapas.filter((x) => !fora.has(x.id)).map((x) => ({ ...x, fase: f.nome })));
    try {
      const excluiu = await excluirEtapas({
        store, espacoId, ids, nome: (ehFase ? fase : etapa).nome, ehFase, nAcoes: Number(t.dataset.comAcoes), etapasQueFicam,
      });
      if (!excluiu) return;
      await recarregar();
      rascunho.estrutura = rascunho.estrutura.filter((f) => !fora.has(f.id)).map((f) => ({ ...f, etapas: f.etapas.filter((x) => !fora.has(x.id)) }));
      desenhar();
    } catch (falha) {
      avisar(falha.message);
    }
  }

  corpo.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t || t.disabled) return;
    if (t.dataset.comAcoes) { tirarComAcoes(t); return; }
    if (t.dataset.exportar) {
      const dados = { espaco, acoes, responsaveis, geral, hoje: hojeLocal() };
      const planilha = t.dataset.exportar === "planilha";
      copiarTexto(planilha ? planilhaDoEspaco(dados) : mermaidDoEspaco(dados), corpo.querySelector("[data-exportado]"),
        planilha ? "Copiado. Cole na primeira célula de uma planilha vazia." : "Fluxograma copiado.");
      return;
    }
    if (t.dataset.excluirEspaco != null) {
      try {
        if (await excluirEspaco({ store, espaco })) { fecharPainel(); aoExcluirEspaco(); }
      } catch (falha) { avisar(falha.message); }
      return;
    }
    const i = Number(t.dataset.indice);
    if (t.dataset.acrescentar === "datas") rascunho.datas.push({ data: "", motivo: "" });
    else if (t.dataset.acrescentar === "documentos") rascunho.documentos.push({ nome: "", data: "", identificacao: "", link: "" });
    else if (t.dataset.acrescentar === "fase") rascunho.estrutura.push({ id: novoId("f"), nome: "", etapas: [] });
    else if (t.dataset.acrescentarEtapa != null) rascunho.estrutura[Number(t.dataset.acrescentarEtapa)].etapas.push({ id: novoId("e"), nome: "" });
    else if (t.dataset.tirar) rascunho[t.dataset.tirar].splice(i, 1);
    else if (t.dataset.tirarFase != null) rascunho.estrutura.splice(Number(t.dataset.tirarFase), 1);
    else if (t.dataset.tirarEtapa != null) rascunho.estrutura[Number(t.dataset.faseDaEtapa)].etapas.splice(Number(t.dataset.tirarEtapa), 1);
    else if (t.dataset.mover) {
      const lista = t.dataset.mover === "fases" ? rascunho.estrutura : rascunho.estrutura[Number(t.dataset.faseDaEtapa)].etapas;
      const j = i + Number(t.dataset.sentido);
      [lista[i], lista[j]] = [lista[j], lista[i]];
    } else return;
    const secao = t.closest("[data-secao]").dataset.secao;
    desenhar();
    /* depois de acrescentar, o foco vai para o campo novo */
    if (t.dataset.acrescentar || t.dataset.acrescentarEtapa != null) {
      const campos = corpo.querySelectorAll(`[data-secao="${secao}"] input:not([type=checkbox])`);
      const alvo = t.dataset.acrescentarEtapa != null
        ? corpo.querySelectorAll(`[data-secao="estrutura"] input[data-fase="${t.dataset.acrescentarEtapa}"][data-etapa]`)
        : campos;
      alvo[alvo.length - (t.dataset.acrescentar === "documentos" ? 4 : t.dataset.acrescentar === "datas" ? 2 : 1)]?.focus();
    }
  });
  corpo.addEventListener("submit", (e) => {
    if (!e.target.dataset.salvar) return; // o formulário dos responsáveis grava por conta própria
    e.preventDefault();
    salvar(e.target);
  });

  desenhar();
  pararDeAcompanhar = store.acompanharEspaco(espacoId, (dados) => {
    responsaveis = dados.responsaveis;
    acoes = dados.acoes;
    desenharResponsaveis();
  });
}
