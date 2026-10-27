/**
 * Telas do módulo Superior (passo 2.5; documentação técnica, seções 4.11 e 8): a gestão da estratégia.
 * Quatro abas:
 * - Desdobramento: a árvore do catálogo, de cima para baixo, com os Planos de Ação ligados no fim e, sob cada
 *   um, as entregas, com a situação e o alcance (passo 2.6); cada item
 *   abre um painel com camada, instrumento, superiores, subordinados e Planos de Ação;
 * - Instrumentos: PEI, PDI, políticas…, com vigência e prorrogações;
 * - Camadas: o modelo do desdobramento;
 * - Importar: a carga por planilha.
 * Todos consultam; só o Gestor da Estratégia (provisoriamente, o Administrador do Sistema) altera.
 */
import { esc, dataBr, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { normalizar } from "../acao.js";
import { lerColagem } from "../planilha.js";
import { abrirPainel, fecharPainel, avisar } from "../telas/painel.js";
import { tipoDe } from "../tipos.js";
import { alcanceAtual, textoDoValor } from "../entregas.js";
import { seloDaSituacao } from "../telas/entregas.js";
import { esqueletoHtml } from "../telas/esqueleto.js";
import {
  camadasAcima, instrumentoVigente, itemVigente, rotuloDoItem, caminhoAteOTopo, subordinadosDe, itensPorCamada, planejarCatalogo,
} from "../estrategia.js";

const ABAS = [["arvore", "Desdobramento"], ["instrumentos", "Instrumentos"], ["camadas", "Camadas"], ["importar", "Importar"]];

/**
 * @param {HTMLElement} alvo
 * @param {{store: object, hoje: string}} contexto
 * @returns {{recarregar: () => Promise<void>}}
 */
export function mostrarSuperior(alvo, { store, hoje }) {
  const ui = { aba: "arvore", soVigentes: true, busca: "", recolhidos: new Set() };
  let cat = { camadas: [], instrumentos: [], itens: [] };
  let gestor = false;
  let planos = [];
  /** entregas e registros de alcance de cada Plano de Ação que a pessoa consulta (passo 2.6): id → {entregas, alcances} */
  let entregasDe = new Map();
  /** rascunho das camadas, editado até "Salvar camadas" */
  let rascunho = null;
  let planoImportacao = null;

  alvo.innerHTML = esqueletoHtml("lista", 6); // até a primeira leitura do catálogo
  async function recarregar() {
    [cat, gestor] = await Promise.all([store.lerCatalogo(), store.ehGestorDaEstrategia().catch(() => false)]);
    const espacos = await store.listarEspacos().catch(() => []);
    planos = espacos.filter((e) => tipoDe(e) === "planoDeAcao" && e.vinculos?.length);
    entregasDe = new Map(await Promise.all(planos.filter((e) => store.podeVerEspaco(e)).map(async (e) => {
      try { return [e.id, { entregas: await store.listarEntregas(e.id), alcances: await store.listarAlcances(e.id) }]; } catch { return [e.id, null]; }
    })));
    rascunho = structuredClone(cat.camadas);
    desenhar();
  }

  const camadaDe = (id) => cat.camadas.find((c) => c.id === id);
  const instrumentoDe = (id) => cat.instrumentos.find((x) => x.id === id);
  const itemDe = (id) => cat.itens.find((x) => x.id === id);
  const vale = (item) => !ui.soVigentes || itemVigente(item, cat.instrumentos, hoje);
  const planosDe = (id) => planos.filter((e) => e.vinculos.includes(id));
  const recebePlanos = (item) => camadasAcima(cat.camadas, null).includes(item.camada);
  const posicaoDaCamada = (id) => cat.camadas.findIndex((c) => c.id === id);
  const ordem = (a, b) => posicaoDaCamada(a.camada) - posicaoDaCamada(b.camada)
    || String(a.codigo ?? "").localeCompare(String(b.codigo ?? ""), "pt-BR", { numeric: true }) || a.nome.localeCompare(b.nome, "pt-BR");

  function desenhar() {
    const abas = ABAS.filter(([v]) => gestor || v !== "importar");
    alvo.innerHTML = `
      <section class="superior-cabeca">
        <h1 class="superior-titulo">Estratégia</h1>
        <p class="tec">O desdobramento do PEI/PDI, de cima para baixo, até os Planos de Ação.
          ${gestor ? "Você é Gestor da Estratégia: pode alterar o catálogo." : "Só o Gestor da Estratégia altera o catálogo; aqui você consulta."}</p>
        <div class="superior-abas" role="tablist">${abas.map(([v, t]) => `<button type="button" role="tab" data-aba="${v}" aria-selected="${ui.aba === v}">${t}</button>`).join("")}</div>
      </section>
      <section class="superior-corpo">${{ arvore: arvoreHtml, instrumentos: instrumentosHtml, camadas: camadasHtml, importar: importarHtml }[ui.aba]()}</section>`;
    const busca = alvo.querySelector("[data-busca-arvore]");
    if (busca && ui.busca) { busca.focus(); busca.setSelectionRange(ui.busca.length, ui.busca.length); }
    /* abas que não cabem (celular, 25/10/2026, item 17 da avaliação de celular): a borda direita esmaece enquanto
       houver aba escondida, e a aba escolhida rola para a vista */
    const faixa = alvo.querySelector(".superior-abas");
    const marcarFaixa = () => faixa.classList.toggle("tem-mais", faixa.scrollLeft + faixa.clientWidth < faixa.scrollWidth - 2);
    faixa.addEventListener("scroll", marcarFaixa, { passive: true });
    faixa.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    marcarFaixa();
  }

  /* ---------- desdobramento ---------- */
  function itemHtml(item) {
    const instr = instrumentoDe(item.instrumento);
    const fora = !itemVigente(item, cat.instrumentos, hoje);
    const n = recebePlanos(item) ? planosDe(item.id).length : 0;
    return `<button type="button" class="item-estrategia" data-item="${esc(item.id)}">
      <span class="item-estrategia-nome">${item.codigo ? `<b class="mono">${esc(item.codigo)}</b> ` : ""}${esc(item.nome)}</span>
      <small class="tec">${esc(camadaDe(item.camada)?.nome ?? "")}${instr ? ` · ${esc(instr.nome)}` : ""}${fora ? " · fora da vigência" : ""}${n ? ` · ${n} ${plural(n, "Plano de Ação", "Planos de Ação")}` : ""}</small>
    </button>`;
  }
  function noHtml(item, caminho) {
    const filhos = subordinadosDe(item.id, cat.itens).filter(vale).filter((x) => !caminho.has(x.id)).sort(ordem);
    const ligados = recebePlanos(item) ? planosDe(item.id) : [];
    const temFilhos = filhos.length || ligados.length;
    const chave = [...caminho, item.id].join("/");
    const fechado = ui.recolhidos.has(chave);
    const proximo = new Set([...caminho, item.id]);
    return `<li class="no-estrategia${fechado ? " fechado" : ""}">
      <div class="no-linha">${temFilhos ? `<button type="button" class="no-seta" data-alternar-no="${esc(chave)}" aria-expanded="${!fechado}" aria-label="${fechado ? "Abrir" : "Fechar"} ${esc(item.nome)}">${ICONES.seguir}</button>` : '<span class="no-seta vazia"></span>'}${itemHtml(item)}</div>
      ${temFilhos && !fechado ? `<ul>${filhos.map((f) => noHtml(f, proximo)).join("")}${ligados.map(planoHtml).join("")}</ul>` : ""}
    </li>`;
  }
  /** Entregas de um Plano de Ação, sob ele na árvore (passo 2.6): situação e alcance; sem entregas, "rascunho". */
  function entregasDoPlanoHtml(e) {
    const dados = entregasDe.get(e.id);
    if (!dados) return "";
    if (!dados.entregas.length) return "";
    return `<ul class="entregas-no-plano">${dados.entregas.map((x) => {
      const a = alcanceAtual(x, dados.alcances);
      return `<li><span class="entrega-no-plano-nome">${esc(x.titulo)}</span> ${seloDaSituacao(x.situacao ?? "naoIniciada")}
        <small class="tec">${a ? `${esc(textoDoValor(x, a.valor))}${x.tipoMeta === "padrao" ? "" : ` (${Math.round(a.fracao * 100)}%)`}` : "sem alcance registrado"}</small></li>`;
    }).join("")}</ul>`;
  }
  function planoHtml(e) {
    const visivel = store.podeVerEspaco(e);
    const dados = entregasDe.get(e.id);
    const rascunho = dados && !dados.entregas.length;
    return `<li class="no-estrategia no-plano"><div class="no-linha"><span class="no-seta vazia"></span>
      ${visivel ? `<a class="item-estrategia plano" href="../#/espaco/${esc(e.id)}"><span class="item-estrategia-nome">${esc(e.nome)}</span><small class="tec">Plano de Ação${e.encerradoEm ? " · encerrado" : ""}${rascunho ? " · rascunho, sem entregas" : dados ? ` · ${dados.entregas.length} ${plural(dados.entregas.length, "entrega", "entregas")}` : ""}</small></a>`
        : `<span class="item-estrategia plano"><span class="item-estrategia-nome">Plano de Ação restrito</span><small class="tec">Só quem participa dele vê o nome.</small></span>`}</div>
      ${visivel ? entregasDoPlanoHtml(e) : ""}</li>`;
  }
  function arvoreHtml() {
    const ativos = cat.itens.filter(vale);
    /* raízes: os itens sem superior ativo (os da camada mais alta e os que ainda não foram ligados) */
    const raizes = ativos.filter((x) => !(x.superiores ?? []).some((s) => itemDe(s))).sort(ordem);
    const termo = normalizar(ui.busca).trim();
    const achados = termo ? ativos.filter((x) => normalizar(`${x.codigo ?? ""} ${x.nome}`).includes(termo)).sort(ordem) : [];
    return `
      <div class="superior-ferramentas">
        <input type="search" data-busca-arvore placeholder="Buscar pelo código ou pelo nome" aria-label="Buscar no catálogo" value="${esc(ui.busca)}">
        <label class="alternar"><input type="checkbox" data-so-vigentes${ui.soVigentes ? " checked" : ""}> Só o que vale hoje</label>
        ${termo ? "" : `<button type="button" class="botao discreto" data-recolher-tudo>${ui.recolhidos.size ? "Abrir tudo" : "Recolher tudo"}</button>`}
        ${gestor ? `<button type="button" class="botao principal" data-novo-item>${ICONES.mais}Novo item</button>` : ""}
      </div>
      ${termo ? `<ul class="arvore-estrategia busca">${achados.map((x) => `<li class="no-estrategia"><div class="no-linha"><span class="no-seta vazia"></span>${itemHtml(x)}</div>
          <small class="tec caminho-estrategia">${caminhoAteOTopo(x, cat.itens).slice(0, -1).map((c) => esc(rotuloDoItem(c))).join(" › ")}</small></li>`).join("") || '<li class="vazio">Nada encontrado.</li>'}</ul>`
        : raizes.length ? `<ul class="arvore-estrategia">${raizes.map((r) => noHtml(r, new Set())).join("")}</ul>`
        : `<p class="vazio">${cat.itens.length ? "Nada vale hoje. Desmarque “Só o que vale hoje” para ver tudo." : gestor ? "O catálogo está vazio. Comece por “Novo item” ou pela aba Importar." : "O catálogo ainda está vazio."}</p>`}
      <p class="tec">${cat.camadas.map((c) => esc(c.plural) + (c.opcional ? " (opcional)" : "")).join(" › ")} › Planos de Ação. Um item pode estar sob mais de um superior; nesse caso, aparece sob cada um.</p>`;
  }

  /** Painel de um item: onde fica, superiores, subordinados, Planos de Ação e, para o gestor, edição. */
  function abrirItem(id) {
    const item = itemDe(id);
    if (!item) return;
    const corpo = abrirPainel(rotuloDoItem(item), "");
    let confirmandoExclusao = false;
    const desenharPainel = () => {
      const atual = itemDe(id);
      if (!atual) { fecharPainel(); return; }
      const instr = instrumentoDe(atual.instrumento);
      const supPermitidos = camadasAcima(cat.camadas, atual.camada);
      const candidatos = cat.itens.filter((x) => supPermitidos.includes(x.camada) && !(atual.superiores ?? []).includes(x.id)).sort(ordem);
      const subCamadas = cat.camadas.filter((c) => camadasAcima(cat.camadas, c.id).includes(atual.camada));
      const subs = subordinadosDe(atual.id, cat.itens).sort(ordem);
      const lista = (itens, comTirar) => itens.length ? `<ul class="lista-estrategia">${itens.map((x) => `<li>${itemHtml(x)}${comTirar && gestor ? `<button type="button" class="tirar" data-desligar="${esc(x.id)}" aria-label="Desligar de ${esc(x.nome)}">${ICONES.fechar}</button>` : ""}</li>`).join("")}</ul>` : "";
      corpo.innerHTML = `
        <dl class="ficha-estrategia">
          <div><dt>Camada</dt><dd>${esc(camadaDe(atual.camada)?.nome ?? "")}</dd></div>
          <div><dt>Instrumento</dt><dd>${instr ? `${esc(instr.nome)} <small class="tec">${vigenciaTexto(instr)}</small>` : '<span class="tec">Sem instrumento: vale sempre.</span>'}</dd></div>
        </dl>
        ${caminhoAteOTopo(atual, cat.itens).length > 1 ? `<p class="tec caminho-estrategia">${caminhoAteOTopo(atual, cat.itens).map((c) => esc(rotuloDoItem(c))).join(" › ")}</p>` : ""}
        <h4>Superiores</h4>
        ${lista((atual.superiores ?? []).map(itemDe).filter(Boolean), true) || `<p class="vazio">${supPermitidos.length ? "Nenhum: ainda não está ligado a um superior." : "Nenhum: é a camada mais alta."}</p>`}
        ${gestor && candidatos.length ? `<div class="linha-config linha-ligar"><select data-novo-superior aria-label="Superior para ligar">${candidatos.map((x) => `<option value="${esc(x.id)}">${esc(rotuloDoItem(x))} (${esc(camadaDe(x.camada)?.nome)})</option>`).join("")}</select>
          <button type="button" class="botao" data-ligar>Ligar</button></div>` : ""}
        <h4>Subordinados</h4>
        ${lista(subs, false) || '<p class="vazio">Nenhum.</p>'}
        ${gestor && subCamadas.length ? `<button type="button" class="botao-texto" data-novo-subordinado>${ICONES.mais}Novo subordinado</button>` : ""}
        ${recebePlanos(atual) ? `<h4>Planos de Ação</h4>${planosDe(atual.id).length ? `<ul class="lista-estrategia">${planosDe(atual.id).map((e) => `<li>${store.podeVerEspaco(e) ? `<a href="../#/espaco/${esc(e.id)}">${esc(e.nome)}</a>` : "Plano de Ação restrito"}</li>`).join("")}</ul>` : '<p class="vazio">Nenhum Plano de Ação ligado.</p>'}` : ""}
        ${gestor ? `<h4>Editar</h4>
          <form class="editor" data-editar-item>
            <div class="campos-lado-a-lado">
              <label class="campo"><span>Código</span><input name="codigo" maxlength="20" value="${esc(atual.codigo ?? "")}"></label>
              <label class="campo"><span>Instrumento</span>${instrumentoSelect(atual.instrumento)}</label>
            </div>
            <label class="campo"><span>Nome</span><input name="nome" maxlength="200" required value="${esc(atual.nome)}"></label>
            <div class="botoes"><button class="botao principal" type="submit">Salvar</button></div>
          </form>
          <div class="zona-exclusao">${confirmandoExclusao ? `<div class="aviso-confirmar"><p>Excluir “${esc(rotuloDoItem(atual))}”? Ele sai do catálogo (fica registrado como excluído).</p>
            <div class="botoes"><button class="botao principal" type="button" data-confirmar-excluir>Excluir</button><button class="botao" type="button" data-cancelar-excluir>Cancelar</button></div></div>`
            : '<button class="botao-excluir" type="button" data-excluir-item>Excluir item</button>'}</div>` : ""}`;
    };
    const gravar = async (operacao, mensagem) => {
      try { await operacao(); await recarregar(); desenharPainel(); if (mensagem) avisar(mensagem); } catch (e) { avisar(e.message); }
    };
    corpo.addEventListener("click", (e) => {
      const t = e.target.closest("button, a");
      if (!t) return;
      if (t.dataset.item) { abrirItem(t.dataset.item); return; }
      if (t.dataset.desligar) { gravar(() => store.desligarSuperior(id, t.dataset.desligar), "Ligação desfeita."); return; }
      if (t.matches("[data-ligar]")) { gravar(() => store.ligarSuperior(id, corpo.querySelector("[data-novo-superior]").value), "Ligado."); return; }
      if (t.matches("[data-novo-subordinado]")) { abrirNovoItem({ superior: id }); return; }
      if (t.matches("[data-excluir-item]")) { confirmandoExclusao = true; desenharPainel(); return; }
      if (t.matches("[data-cancelar-excluir]")) { confirmandoExclusao = false; desenharPainel(); return; }
      if (t.matches("[data-confirmar-excluir]")) {
        store.excluirItemEstrategico(id).then(async () => { fecharPainel(); await recarregar(); avisar("Item excluído."); }).catch((f) => { confirmandoExclusao = false; desenharPainel(); avisar(f.message); });
      }
    });
    corpo.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      gravar(() => store.alterarItemEstrategico(id, { codigo: f.get("codigo"), nome: f.get("nome"), instrumento: f.get("instrumento") || null }), "Item salvo.");
    });
    desenharPainel();
  }

  function instrumentoSelect(atual) {
    return `<select name="instrumento"><option value="">Sem instrumento (vale sempre)</option>${cat.instrumentos.map((x) =>
      `<option value="${esc(x.id)}"${x.id === atual ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}</select>`;
  }

  /** Novo item: camada, código, nome, instrumento e, se houver, o superior (os da camada permitida). */
  function abrirNovoItem({ superior = null } = {}) {
    const sup = itemDe(superior);
    const camadas = sup ? cat.camadas.filter((c) => camadasAcima(cat.camadas, c.id).includes(sup.camada)) : cat.camadas;
    const corpo = abrirPainel(sup ? `Novo subordinado de ${rotuloDoItem(sup)}` : "Novo item", "");
    const desenharForm = (camadaId = camadas[0]?.id) => {
      const permitidas = camadasAcima(cat.camadas, camadaId);
      const candidatos = cat.itens.filter((x) => permitidas.includes(x.camada)).sort(ordem);
      corpo.innerHTML = `<form class="editor" data-novo-item-form>
        <label class="campo"><span>Camada</span><select name="camada">${camadas.map((c) => `<option value="${esc(c.id)}"${c.id === camadaId ? " selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label>
        <div class="campos-lado-a-lado">
          <label class="campo"><span>Código <small>(opcional)</small></span><input name="codigo" maxlength="20"></label>
          <label class="campo"><span>Instrumento</span>${instrumentoSelect(sup?.instrumento ?? null)}</label>
        </div>
        <label class="campo"><span>Nome</span><input name="nome" maxlength="200" required></label>
        ${permitidas.length ? `<label class="campo"><span>Superior</span><select name="superior">${sup ? "" : '<option value="">Ligar depois</option>'}${candidatos.map((x) =>
          `<option value="${esc(x.id)}"${x.id === superior ? " selected" : ""}>${esc(rotuloDoItem(x))} (${esc(camadaDe(x.camada)?.nome)})</option>`).join("")}</select>
          <small class="tec">Pode ficar sob ${permitidas.map((c) => `“${esc(camadaDe(c)?.nome)}”`).join(" ou ")}. Outros superiores se ligam depois, no item.</small></label>`
          : '<p class="tec">Camada mais alta: sem superior.</p>'}
        <div class="botoes"><button class="botao principal" type="submit">Criar</button></div>
      </form>`;
      corpo.querySelector('[name="nome"]').focus();
    };
    corpo.addEventListener("change", (e) => { if (e.target.name === "camada") desenharForm(e.target.value); });
    corpo.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const novo = await store.criarItemEstrategico({ camada: f.get("camada"), codigo: f.get("codigo"), nome: f.get("nome"), instrumento: f.get("instrumento") || null, superiores: f.get("superior") ? [f.get("superior")] : [] });
        await recarregar();
        avisar("Item criado.");
        abrirItem(novo);
      } catch (falha) { avisar(falha.message); }
    });
    desenharForm();
  }

  /* ---------- instrumentos ---------- */
  function vigenciaTexto(x) {
    const estado = instrumentoVigente(x, hoje) ? "vigente" : x.inicio > hoje ? "ainda não começou" : "encerrado";
    return `${dataBr(x.inicio)} a ${x.fim ? dataBr(x.fim) : "sem fim definido"} · ${estado}`;
  }
  function instrumentosHtml() {
    const ordenados = [...cat.instrumentos].sort((a, b) => b.inicio.localeCompare(a.inicio) || a.nome.localeCompare(b.nome, "pt-BR"));
    return `
      <p class="tec">Os documentos que criam os itens do catálogo, como o PEI, o PDI ou uma política. Um item vale enquanto o instrumento dele vale.
        A prorrogação muda o fim e fica registrada.</p>
      ${gestor ? `<div class="superior-ferramentas"><button type="button" class="botao principal" data-novo-instrumento>${ICONES.mais}Novo instrumento</button></div>` : ""}
      <ul class="lista-instrumentos">${ordenados.map((x) => {
        const n = cat.itens.filter((i) => i.instrumento === x.id).length;
        return `<li class="cartao-instrumento${instrumentoVigente(x, hoje) ? " vigente" : ""}">
          <div><b>${esc(x.nome)}</b> <small class="tec">${vigenciaTexto(x)}</small></div>
          <small class="tec">${n} ${plural(n, "item", "itens")} no catálogo${x.aprovacao?.identificacao ? ` · aprovado por ${x.aprovacao.link ? `<a href="${esc(x.aprovacao.link)}" target="_blank" rel="noopener noreferrer">${esc(x.aprovacao.identificacao)}</a>` : esc(x.aprovacao.identificacao)}` : ""}</small>
          ${(x.prorrogacoes ?? []).length ? `<ul class="prorrogacoes">${x.prorrogacoes.map((p) => `<li class="tec">Prorrogado de ${p.fimAnterior ? dataBr(p.fimAnterior) : "sem fim"} para ${dataBr(p.fim)}${p.aprovacao?.identificacao ? ` (${esc(p.aprovacao.identificacao)})` : ""}, registrado${p.por ? ` por ${esc(p.por)}` : ""} em ${dataBr(p.em.slice(0, 10))}</li>`).join("")}</ul>` : ""}
          ${gestor ? `<div class="botoes"><button type="button" class="botao-texto" data-editar-instrumento="${esc(x.id)}">Editar</button>
            <button type="button" class="botao-texto" data-prorrogar="${esc(x.id)}">Prorrogar</button>
            ${n ? "" : `<button type="button" class="botao-texto perigo" data-excluir-instrumento="${esc(x.id)}">Excluir</button>`}</div>` : ""}
        </li>`;
      }).join("") || '<li class="vazio">Nenhum instrumento cadastrado.</li>'}</ul>`;
  }
  function abrirInstrumento(id = null) {
    const x = id ? instrumentoDe(id) : null;
    const corpo = abrirPainel(x ? `Editar ${x.nome}` : "Novo instrumento", `<form class="editor" data-form-instrumento>
      <label class="campo"><span>Nome</span><input name="nome" maxlength="120" required value="${esc(x?.nome ?? "")}" placeholder="Por exemplo, PDI 2024–2028"></label>
      <div class="campos-lado-a-lado">
        <label class="campo"><span>Início da vigência</span><input name="inicio" type="date" required value="${esc(x?.inicio ?? "")}"></label>
        <label class="campo"><span>Fim <small>(opcional)</small></span><input name="fim" type="date" value="${esc(x?.fim ?? "")}"${x ? " disabled" : ""}></label>
      </div>
      ${x ? '<p class="tec">Para mudar o fim, use “Prorrogar”, que registra a mudança.</p>' : ""}
      <div class="campos-lado-a-lado">
        <label class="campo"><span>Documento de aprovação <small>(SIPAC/Protocolo)</small></span><input name="identificacao" value="${esc(x?.aprovacao?.identificacao ?? "")}"></label>
        <label class="campo"><span>Link <small>(opcional)</small></span><input name="link" type="url" value="${esc(x?.aprovacao?.link ?? "")}" placeholder="https://…"></label>
      </div>
      <div class="botoes"><button class="botao principal" type="submit">${x ? "Salvar" : "Criar"}</button></div>
    </form>`);
    corpo.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const aprovacao = f.get("identificacao").trim() ? { identificacao: f.get("identificacao").trim(), ...(f.get("link").trim() ? { link: f.get("link").trim() } : {}) } : null;
      try {
        if (x) await store.alterarInstrumento(x.id, { nome: f.get("nome"), inicio: f.get("inicio"), aprovacao });
        else await store.criarInstrumento({ nome: f.get("nome"), inicio: f.get("inicio"), fim: f.get("fim") || null, ...(aprovacao ? { aprovacao } : {}) });
        fecharPainel();
        await recarregar();
        avisar(x ? "Instrumento salvo." : "Instrumento criado.");
      } catch (falha) { avisar(falha.message); }
    });
  }
  function abrirProrrogacao(id) {
    const x = instrumentoDe(id);
    const corpo = abrirPainel(`Prorrogar ${x.nome}`, `<form class="editor" data-form-prorrogar>
      <p class="tec">Fim atual: ${x.fim ? dataBr(x.fim) : "sem fim definido"}. A prorrogação fica registrada, com você e a data.</p>
      <label class="campo"><span>Novo fim</span><input name="fim" type="date" required min="${esc(x.fim ?? x.inicio)}"></label>
      <div class="campos-lado-a-lado">
        <label class="campo"><span>Documento que aprovou <small>(opcional)</small></span><input name="identificacao"></label>
        <label class="campo"><span>Link <small>(opcional)</small></span><input name="link" type="url" placeholder="https://…"></label>
      </div>
      <div class="botoes"><button class="botao principal" type="submit">Prorrogar</button></div>
    </form>`);
    corpo.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const aprovacao = f.get("identificacao").trim() ? { identificacao: f.get("identificacao").trim(), ...(f.get("link").trim() ? { link: f.get("link").trim() } : {}) } : null;
      try {
        await store.prorrogarInstrumento(id, { fim: f.get("fim"), aprovacao });
        fecharPainel();
        await recarregar();
        avisar("Prorrogação registrada.");
      } catch (falha) { avisar(falha.message); }
    });
  }

  /* ---------- camadas ---------- */
  function camadasHtml() {
    const r = rascunho;
    const n = (id) => cat.itens.filter((x) => x.camada === id).length;
    return `
      <p class="tec">As camadas do desdobramento, de cima para baixo. Um item fica sob um da camada logo acima ou, se ela for <b>opcional</b>,
        de uma camada acima dela: com o Portfólio opcional, um Programa fica sob um Portfólio ou direto sob uma Política. Abaixo da última camada vêm os Planos de Ação.</p>
      ${gestor ? `<p class="tec">Cada camada tem dois nomes: no singular, para um item (“um Programa”), e no plural, para os títulos das listas (“Programas”).</p>` : ""}
      <ol class="lista-camadas">${r.map((c, i) => `<li>
        ${gestor ? `<label class="campo-camada"><small class="tec">Nome no singular</small><input data-camada="${i}" data-campo="nome" value="${esc(c.nome)}" placeholder="Ex.: Programa"></label>
          <label class="campo-camada"><small class="tec">Nome no plural</small><input data-camada="${i}" data-campo="plural" value="${esc(c.plural)}" placeholder="Ex.: Programas"></label>
          <label class="alternar"><input type="checkbox" data-camada="${i}" data-campo="opcional"${c.opcional ? " checked" : ""}> Opcional</label>
          <span class="botoes-situacao"><button type="button" class="tirar" data-mover-camada="${i}" data-sentido="-1" aria-label="Subir"${i === 0 ? " disabled" : ""}>↑</button>
          <button type="button" class="tirar" data-mover-camada="${i}" data-sentido="1" aria-label="Descer"${i === r.length - 1 ? " disabled" : ""}>↓</button>
          <button type="button" class="tirar" data-tirar-camada="${i}" aria-label="Retirar ${esc(c.nome)}"${n(c.id) ? ` disabled title="Tem ${n(c.id)} ${plural(n(c.id), "item", "itens")}"` : ""}>${ICONES.fechar}</button></span>`
          : `<b>${esc(c.nome)}</b> <small class="tec">${esc(c.plural)}${c.opcional ? " · opcional" : ""} · ${n(c.id)} ${plural(n(c.id), "item", "itens")}</small>`}
      </li>`).join("")}<li class="tec">Planos de Ação</li></ol>
      ${gestor ? `<div class="botoes"><button type="button" class="botao" data-nova-camada>${ICONES.mais}Camada</button><button type="button" class="botao principal" data-salvar-camadas>Salvar camadas</button></div>` : ""}`;
  }

  /* ---------- importar ---------- */
  function importarHtml() {
    return `
      <p class="tec">Cole as linhas do Google Planilhas ou do Excel, com a linha de títulos. Colunas: <b>Camada</b> e <b>Nome</b> (obrigatórias),
        <b>Código</b>, <b>Superiores</b> (códigos separados por “;”) e <b>Instrumento</b> (o nome de um instrumento cadastrado).
        Um item que já tem o mesmo código na mesma camada é atualizado. Os superiores podem citar outras linhas da planilha.</p>
      <textarea class="texto-exportado" data-importar-catalogo rows="8" aria-label="Linhas coladas da planilha"></textarea>
      <div class="botoes"><button type="button" class="botao" data-conferir-catalogo>Conferir</button></div>
      <div data-previa-catalogo>${previaHtml()}</div>`;
  }
  function previaHtml() {
    const p = planoImportacao;
    if (!p) return "";
    if (p.erro) return `<p class="erro">${esc(p.erro)}</p>`;
    const conta = (t) => p.linhas.filter((l) => l.tipo === t).length;
    const nomes = { novo: "Novo", atualiza: "Atualiza", igual: "Sem mudança", erro: "Fica de fora" };
    return `<div class="previa-importacao">
      <p><b>${conta("novo")} ${plural(conta("novo"), "item novo", "itens novos")}</b> e <b>${conta("atualiza")} ${plural(conta("atualiza"), "atualização", "atualizações")}</b>.
        ${p.ignoradas.length ? `<span class="tec">Colunas ignoradas: ${p.ignoradas.map(esc).join(", ")}.</span>` : ""}</p>
      <ul>${p.linhas.map((l) => `<li class="${l.tipo === "erro" ? "erro" : l.tipo === "novo" ? "nova" : l.tipo}"><span class="tec">Linha ${l.linha}</span>
        <b>${esc([l.codigo, l.nome].filter(Boolean).join(" · ") || "(sem nome)")}</b> <span>${nomes[l.tipo]}${l.erro ? `: ${esc(l.erro)}` : ""}</span>
        ${l.avisos.map((a) => `<span class="aviso-linha">${esc(a)}</span>`).join("")}</li>`).join("")}</ul>
      ${conta("novo") + conta("atualiza") ? '<div class="botoes"><button type="button" class="botao principal" data-gravar-catalogo>Gravar</button></div>' : ""}
    </div>`;
  }

  /* ---------- eventos ---------- */
  alvo.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t || t.disabled) return;
    if (t.dataset.aba) { ui.aba = t.dataset.aba; return desenhar(); }
    if (t.dataset.item) return abrirItem(t.dataset.item);
    if (t.dataset.alternarNo) { if (ui.recolhidos.has(t.dataset.alternarNo)) ui.recolhidos.delete(t.dataset.alternarNo); else ui.recolhidos.add(t.dataset.alternarNo); return desenhar(); }
    if (t.matches("[data-recolher-tudo]")) {
      if (ui.recolhidos.size) ui.recolhidos.clear();
      else for (const el of alvo.querySelectorAll("[data-alternar-no]")) ui.recolhidos.add(el.dataset.alternarNo);
      return desenhar();
    }
    if (t.matches("[data-novo-item]")) return abrirNovoItem();
    if (t.matches("[data-novo-instrumento]")) return abrirInstrumento();
    if (t.dataset.editarInstrumento) return abrirInstrumento(t.dataset.editarInstrumento);
    if (t.dataset.prorrogar) return abrirProrrogacao(t.dataset.prorrogar);
    if (t.dataset.excluirInstrumento) {
      try { await store.excluirInstrumento(t.dataset.excluirInstrumento); await recarregar(); avisar("Instrumento excluído."); } catch (f) { avisar(f.message); }
      return;
    }
    if (t.dataset.moverCamada != null) {
      const i = Number(t.dataset.moverCamada);
      const j = i + Number(t.dataset.sentido);
      [rascunho[i], rascunho[j]] = [rascunho[j], rascunho[i]];
      return desenhar();
    }
    if (t.dataset.tirarCamada != null) { rascunho.splice(Number(t.dataset.tirarCamada), 1); return desenhar(); }
    if (t.matches("[data-nova-camada]")) {
      rascunho.push({ id: `c${Date.now().toString(36)}`, nome: "", plural: "", opcional: false });
      desenhar();
      const campos = alvo.querySelectorAll('[data-campo="nome"]');
      return campos[campos.length - 1]?.focus();
    }
    if (t.matches("[data-salvar-camadas]")) {
      try { await store.alterarCamadas(rascunho); await recarregar(); avisar("Camadas salvas."); } catch (f) { avisar(f.message); }
      return;
    }
    if (t.matches("[data-conferir-catalogo]")) {
      planoImportacao = planejarCatalogo({ texto: alvo.querySelector("[data-importar-catalogo]").value, ...cat, normalizar, lerColagem });
      alvo.querySelector("[data-previa-catalogo]").innerHTML = previaHtml();
      return;
    }
    if (t.matches("[data-gravar-catalogo]")) {
      t.disabled = true;
      try {
        const r = await store.importarCatalogo(planoImportacao);
        planoImportacao = null;
        await recarregar();
        avisar(`Catálogo gravado: ${r.criados} ${plural(r.criados, "item novo", "itens novos")}, ${r.atualizados} ${plural(r.atualizados, "atualização", "atualizações")}.`
          + (r.falhas.length ? ` ${r.falhas.length} ${plural(r.falhas.length, "linha falhou", "linhas falharam")}: ${r.falhas.map((x) => `linha ${x.linha}, ${x.mensagem}`).join("; ")}` : ""));
      } catch (f) { t.disabled = false; avisar(f.message); }
    }
  });
  alvo.addEventListener("input", (e) => {
    if (e.target.matches("[data-busca-arvore]")) { ui.busca = e.target.value; desenhar(); return; }
    const i = e.target.dataset.camada;
    if (i != null && e.target.type !== "checkbox") rascunho[Number(i)][e.target.dataset.campo] = e.target.value;
  });
  alvo.addEventListener("change", (e) => {
    if (e.target.matches("[data-so-vigentes]")) { ui.soVigentes = e.target.checked; desenhar(); return; }
    const i = e.target.dataset.camada;
    if (i != null && e.target.type === "checkbox") rascunho[Number(i)].opcional = e.target.checked;
  });

  return { recarregar };
}
