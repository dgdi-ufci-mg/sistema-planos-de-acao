/**
 * Planilha do Strata (30/10/2026, pedido do responsável; documentação técnica, seção 8, "Strata", "Planilha"): o
 * catálogo em linhas e colunas, para ver e alterar muitos itens de uma vez sem sair do Mapa.
 *
 * - abre por cima do Mapa, como uma janela grande que sobe do pé da tela, com o Mapa escurecido ao fundo;
 * - linhas agrupadas por camada (recolhíveis), com filtros (camada, instrumento, vigência), busca, ordem pelas colunas e colunas que se escondem e
 *   mudam de lugar (preferência deste aparelho);
 * - no computador, o Gestor da Estratégia altera direto na célula: texto (código e nome), lista (instrumento) e
 *   várias opções (superiores, "Vem de"); anda pelas células com o teclado, copia e cola como numa planilha;
 * - o que muda fica **marcado e pendente** até "Salvar"; "Desfazer" e "Refazer" andam pelas células alteradas;
 * - a célula com problema fica marcada, com a explicação; o problema que impede gravar segura o "Salvar";
 * - Esc primeiro cancela a edição da célula; fora da edição, fecha (e, com alterações pendentes, pergunta antes);
 * - a linha escolhida acende o ponto dela no Mapa, ao fundo;
 * - no celular, só consulta: tocar numa linha abre o painel do item.
 * As regras (linhas, problemas, filtro, ordem, colar, plano de gravação) ficam em js/planilha-estrategia.js.
 */
import { esc, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { normalizar } from "../acao.js";
import { avisar } from "../telas/painel.js";
import { abrirCamada } from "../telas/voltar.js";
import { rotuloDoItem } from "../estrategia.js";
import { VIGENCIAS } from "../filtro-do-mapa.js";
import {
  COLUNAS, colunasVisiveis, registrarValor, contarPendencias, criarHistoricoDeEdicao, linhasDaPlanilha, filtrarEOrdenar,
  agruparPorCamada, candidatosASuperior, lerValorDaCelula, planoDeGravacao, VIGENCIA_TEXTO,
} from "../planilha-estrategia.js";

const CHAVE_COLUNAS = "strata.planilha.colunas";
const estreita = () => matchMedia("(max-width: 640px)").matches;
const reduzir = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Preferência de colunas deste aparelho (ordem e ocultas): só conveniência; sem armazenamento, vale a de partida. */
function lerPreferencia() {
  try { return JSON.parse(localStorage.getItem(CHAVE_COLUNAS)) ?? {}; } catch { return {}; }
}
function gravarPreferencia(p) {
  try { localStorage.setItem(CHAVE_COLUNAS, JSON.stringify(p)); } catch { /* sem armazenamento: vale só nesta abertura */ }
}

/** Grupos recolhidos e filtros: lembrados enquanto a página está aberta, entre uma abertura e outra da Planilha. */
const lembrado = { recolhidos: new Set(), filtro: { busca: "", camada: "", instrumento: null, vigencia: "", soProblemas: false, ordem: null } };

/**
 * Abre a Planilha por cima do Mapa.
 * @param {{store: object, hoje: string, ler: () => {cat: object, planos: object[], gestor: boolean},
 *   aoGravar: () => Promise<void>, aoSelecionar?: (id: string) => void, aoAbrirItem?: (id: string) => void, aoFechar?: () => void}} contexto
 *   `ler`: o catálogo, os Planos de Ação ligados e se a pessoa é Gestor da Estratégia, lidos de novo a cada desenho;
 *   `aoGravar`: recarrega o catálogo depois de salvar; `aoSelecionar`: acende o ponto no Mapa
 */
export function abrirPlanilha({ store, hoje, ler, aoGravar, aoSelecionar = () => {}, aoAbrirItem = () => {}, aoFechar = () => {} }) {
  let pendentes = new Map();
  const historico = criarHistoricoDeEdicao();
  let preferencia = lerPreferencia();
  const filtro = lembrado.filtro;
  /** célula ativa, por id da linha e da coluna (sobrevive aos redesenhos) */
  let ativa = { linha: null, coluna: "nome" };
  /** edição em curso: {linha, coluna, tipo} ou null */
  let editando = null;
  let confirmandoFechar = false;
  let salvando = false;
  let popover = null; // "colunas" | "superiores" | null
  let ultimaVistas = [];

  const raiz = document.createElement("div");
  raiz.className = "camada strata-grade-camada";
  raiz.dataset.planilha = "";
  raiz.innerHTML = `
    <div class="fundo-escuro" data-fundo></div>
    <section class="strata-grade" role="dialog" aria-modal="true" aria-labelledby="strata-grade-titulo">
      <header class="strata-grade-cabeca" data-cabeca></header>
      <div class="strata-grade-barra" data-barra></div>
      <div class="strata-grade-rolagem" data-rolagem>
        <table class="grade-estrategia" role="grid" aria-labelledby="strata-grade-titulo" data-tabela>
          <thead data-cabecalho></thead><tbody data-corpo></tbody>
        </table>
        <p class="vazio grade-vazio" data-vazio hidden></p>
      </div>
      <footer class="strata-grade-pe tec" data-pe></footer>
      <div class="grade-escolha" data-escolha hidden></div>
    </section>`;
  document.body.append(raiz);
  const $ = (s) => raiz.querySelector(s);
  const cabeca = $("[data-cabeca]");
  const barra = $("[data-barra]");
  const rolagem = $("[data-rolagem]");
  const tabela = $("[data-tabela]");
  const cabecalho = $("[data-cabecalho]");
  const corpo = $("[data-corpo]");
  const vazio = $("[data-vazio]");
  const pe = $("[data-pe]");
  const escolha = $("[data-escolha]");

  const dados = () => ler();
  const podeEditar = () => dados().gestor && store.podeGravar && !estreita();
  const colunas = () => colunasVisiveis(preferencia);
  const itemOriginal = (id) => dados().cat.itens.find((x) => x.id === id);

  /* ---------- desenho ---------- */
  function linhasVistas() {
    const { cat, planos } = dados();
    const todas = linhasDaPlanilha(cat, { pendentes, hoje, planos });
    const grupos = agruparPorCamada(filtrarEOrdenar(todas, filtro, normalizar), cat.camadas);
    return { todas, grupos, vistas: grupos.flatMap((g) => (lembrado.recolhidos.has(g.camada.id) ? [] : g.linhas)) };
  }

  function desenhar() {
    const { cat } = dados();
    const { todas, grupos, vistas } = linhasVistas();
    ultimaVistas = vistas;
    const cols = colunas();
    if (!vistas.some((l) => l.id === ativa.linha)) ativa.linha = vistas[0]?.id ?? null;
    if (!cols.some((c) => c.id === ativa.coluna)) ativa.coluna = cols[0].id;
    desenharCabeca(todas);
    desenharBarra(cat);
    cabecalho.innerHTML = `<tr>${cols.map((c, i) => {
      const ordem = filtro.ordem?.coluna === c.id ? filtro.ordem.sentido : 0;
      return `<th scope="col" class="col-${c.id}${i === 0 ? " fixa" : ""}" aria-sort="${ordem === 1 ? "ascending" : ordem === -1 ? "descending" : "none"}">
        <button type="button" class="grade-ordenar" data-ordenar="${c.id}" title="Ordenar por ${esc(c.titulo)}">${esc(c.titulo)}<span class="grade-seta" aria-hidden="true">${ordem === 1 ? "▲" : ordem === -1 ? "▼" : ""}</span></button></th>`;
    }).join("")}</tr>`;
    const editavel = podeEditar();
    corpo.innerHTML = grupos.map((g) => {
      const recolhido = lembrado.recolhidos.has(g.camada.id);
      const comProblema = g.linhas.filter((l) => l.problemas.some((p) => p.bloqueia)).length;
      return `<tr class="grade-grupo"><th colspan="${cols.length}" scope="rowgroup">
          <button type="button" class="grade-grupo-botao" data-recolher="${esc(g.camada.id)}" aria-expanded="${!recolhido}">
            <span class="grade-grupo-seta" aria-hidden="true"></span>${esc(g.camada.plural)} <span class="tec">${g.linhas.length}</span>
            ${comProblema ? `<span class="grade-grupo-alerta">${comProblema} ${plural(comProblema, "a corrigir", "a corrigir")}</span>` : ""}</button></th></tr>
        ${recolhido ? "" : g.linhas.map((l) => linhaHtml(l, cols, editavel)).join("")}`;
    }).join("");
    vazio.hidden = vistas.length > 0 || grupos.length > 0;
    vazio.textContent = todas.length ? "Nada com esse filtro." : "O catálogo está vazio.";
    pe.innerHTML = estreita()
      ? "Para alterar pela planilha, use o computador. Toque numa linha para abrir o item."
      : editavel ? "Setas: andar · Enter ou digitar: alterar · Esc: cancelar · Ctrl+C e Ctrl+V: copiar e colar · Ctrl+Z: desfazer · Ctrl+S: salvar"
      : dados().gestor ? "Entre com sua conta para alterar." : "Só o Gestor da Estratégia altera o catálogo; aqui você consulta.";
  }

  function linhaHtml(l, cols, editavel) {
    const sel = l.id === ativa.linha;
    return `<tr class="grade-linha${sel ? " ativa" : ""}" data-linha="${esc(l.id)}" aria-selected="${sel}">${cols.map((c, i) => {
      const problemas = l.problemas.filter((p) => p.campo === c.id);
      const classes = [`col-${c.id}`, i === 0 && "fixa", c.editavel && editavel && "editavel", l.alterados.has(c.id) && "alterada",
        problemas.some((p) => p.bloqueia) ? "com-erro" : problemas.length && "com-aviso", sel && c.id === ativa.coluna && "celula-ativa"].filter(Boolean).join(" ");
      const titulo = [l.alterados.has(c.id) ? "Alterado, ainda não salvo." : "", ...problemas.map((p) => p.mensagem)].filter(Boolean).join(" ");
      const texto = l.texto[c.id];
      const conteudo = c.id === "vigencia" ? `<span class="grade-selo ${l.vigencia === "vigente" ? "sim" : "nao"}">${texto}</span>`
        : c.id === "instrumento" && !l.item.instrumento ? `<span class="tec">${esc(texto)}</span>`
        : c.id === "superiores" ? ((l.item.superiores ?? []).map((id) => `<span class="grade-ficha">${esc(rotuloDoItem(dados().cat.itens.find((x) => x.id === id)))}</span>`).join("") || "")
        : esc(texto);
      return `<td role="gridcell" class="${classes}" data-coluna="${c.id}" tabindex="${sel && c.id === ativa.coluna ? 0 : -1}"${titulo ? ` title="${esc(titulo)}"` : ""}>${conteudo}${problemas.length ? `<span class="so-leitor">: ${esc(problemas.map((p) => p.mensagem).join(" "))}</span>` : ""}</td>`;
    }).join("")}</tr>`;
  }

  function desenharCabeca(todas) {
    const n = contarPendencias(pendentes);
    const bloqueios = todas.filter((l) => l.alterados.size && l.problemas.some((p) => p.bloqueia)).length;
    const editavel = podeEditar();
    if (confirmandoFechar) {
      cabeca.innerHTML = `<h2 id="strata-grade-titulo">Planilha</h2>
        <div class="grade-confirmar" role="alert"><span>${n} ${plural(n, "alteração não salva", "alterações não salvas")}.</span>
          ${bloqueios ? "" : '<button type="button" class="botao principal" data-salvar-e-fechar>Salvar e fechar</button>'}
          <button type="button" class="botao" data-descartar>Descartar e fechar</button>
          <button type="button" class="botao" data-continuar>Continuar editando</button></div>`;
      cabeca.querySelector("[data-continuar]").focus();
      return;
    }
    cabeca.innerHTML = `<h2 id="strata-grade-titulo">Planilha <span class="tec">${todas.length} ${plural(todas.length, "item", "itens")}</span></h2>
      <div class="grade-acoes">
        ${editavel ? `<button type="button" class="botao" data-desfazer${historico.podeDesfazer ? "" : " disabled"} title="Desfazer (Ctrl+Z)">Desfazer</button>
          <button type="button" class="botao" data-refazer${historico.podeRefazer ? "" : " disabled"} title="Refazer (Ctrl+Y)">Refazer</button>
          <button type="button" class="botao principal" data-salvar${n && !salvando ? "" : " disabled"}>${salvando ? "Salvando…" : n ? `Salvar ${n} ${plural(n, "alteração", "alterações")}` : "Nada a salvar"}</button>` : ""}
        <button type="button" class="botao grade-fechar" data-fechar-planilha aria-label="Fechar a planilha">${ICONES.fechar}<span>Fechar</span></button>
      </div>`;
  }

  function desenharBarra(cat) {
    const ativoBusca = document.activeElement?.matches?.("[data-grade-busca]");
    const pos = ativoBusca ? document.activeElement.selectionStart : null;
    barra.innerHTML = `
      <label class="grade-busca">${ICONES.buscar}<input type="search" data-grade-busca placeholder="Buscar" aria-label="Buscar na planilha" value="${esc(filtro.busca)}"></label>
      <select data-grade-camada aria-label="Camada"><option value="">Todas as camadas</option>${cat.camadas.map((c) => `<option value="${esc(c.id)}"${filtro.camada === c.id ? " selected" : ""}>${esc(c.plural)}</option>`).join("")}</select>
      <select data-grade-instrumento aria-label="Instrumento"><option value="*"${filtro.instrumento == null ? " selected" : ""}>Todos os instrumentos</option>
        <option value=""${filtro.instrumento === "" ? " selected" : ""}>Sem instrumento</option>
        ${cat.instrumentos.filter((x) => !x.excluidoEm).map((x) => `<option value="${esc(x.id)}"${filtro.instrumento === x.id ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}</select>
      <select data-grade-vigencia aria-label="Vigência"><option value="">Qualquer vigência</option>${Object.keys(VIGENCIA_TEXTO).map((k) =>
        `<option value="${k}"${filtro.vigencia === k ? " selected" : ""}>${esc(VIGENCIAS[{ vigente: "vigentes", encerrado: "encerrados", futuro: "futuros" }[k]])}</option>`).join("")}</select>
      <button type="button" class="grade-chave" data-so-problemas aria-pressed="${filtro.soProblemas}">Só o que precisa de atenção</button>
      <button type="button" class="botao grade-botao-colunas" data-abrir-colunas aria-expanded="${popover === "colunas"}">${ICONES.colunas}Colunas</button>`;
    if (ativoBusca) { const b = barra.querySelector("[data-grade-busca]"); b.focus(); b.setSelectionRange(pos, pos); }
  }

  /* ---------- célula ativa e foco ---------- */
  const celula = (linha = ativa.linha, coluna = ativa.coluna) => corpo.querySelector(`tr[data-linha="${CSS.escape(linha ?? "")}"] td[data-coluna="${coluna}"]`);
  function focar({ rolar = true } = {}) {
    const td = celula();
    if (!td) return;
    td.focus({ preventScroll: true });
    if (rolar) td.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  let selecaoAvisada = null;
  function ativar(linha, coluna, { foco = true } = {}) {
    const mudouLinha = linha !== ativa.linha;
    ativa = { linha, coluna };
    for (const tr of corpo.querySelectorAll("tr.grade-linha")) {
      const sel = tr.dataset.linha === linha;
      tr.classList.toggle("ativa", sel);
      tr.setAttribute("aria-selected", String(sel));
      for (const td of tr.children) {
        const a = sel && td.dataset.coluna === coluna;
        td.classList.toggle("celula-ativa", a);
        td.tabIndex = a ? 0 : -1;
      }
    }
    if (foco) focar();
    if (mudouLinha && linha && linha !== selecaoAvisada) { selecaoAvisada = linha; aoSelecionar(linha); } // o ponto acende no Mapa
  }
  function mover(dl, dc) {
    const cols = colunas();
    const i = ultimaVistas.findIndex((l) => l.id === ativa.linha);
    const j = cols.findIndex((c) => c.id === ativa.coluna);
    const ni = Math.max(0, Math.min(ultimaVistas.length - 1, i + dl));
    const nj = Math.max(0, Math.min(cols.length - 1, j + dc));
    if (ultimaVistas[ni]) ativar(ultimaVistas[ni].id, cols[nj].id);
  }

  /* ---------- alterar ---------- */
  function aplicar(id, campo, valor, { registrar = true } = {}) {
    const original = itemOriginal(id);
    if (!original) return;
    const antes = pendentes.get(id)?.[campo] ?? original[campo] ?? (campo === "superiores" ? [] : campo === "instrumento" ? null : "");
    pendentes = registrarValor(pendentes, original, campo, valor);
    if (registrar) historico.registrar({ id, campo, antes, depois: valor });
  }
  function atualizar() {
    const tinhaFoco = raiz.contains(document.activeElement) && document.activeElement.closest("[data-corpo]");
    desenhar();
    if (tinhaFoco) focar({ rolar: false });
  }

  function comecarEdicao(caractere = null) {
    const coluna = COLUNAS.find((c) => c.id === ativa.coluna);
    if (!podeEditar() || !coluna?.editavel || !ativa.linha) return;
    const td = celula();
    const linha = ultimaVistas.find((l) => l.id === ativa.linha);
    if (!td || !linha) return;
    editando = { linha: ativa.linha, coluna: coluna.id };
    if (coluna.tipo === "texto") {
      const valor = caractere ?? linha.item[coluna.id] ?? "";
      td.innerHTML = `<input class="grade-editor" data-editor maxlength="${coluna.id === "codigo" ? 20 : 200}" value="${esc(valor)}" aria-label="${esc(coluna.titulo)}">`;
      const input = td.querySelector("input");
      input.focus();
      if (caractere == null) input.select(); else input.setSelectionRange(valor.length, valor.length);
    } else if (coluna.tipo === "lista") {
      const { cat } = dados();
      td.innerHTML = `<select class="grade-editor" data-editor aria-label="Instrumento"><option value="">Sem instrumento (vale sempre)</option>${cat.instrumentos.filter((x) => !x.excluidoEm).map((x) =>
        `<option value="${esc(x.id)}"${x.id === linha.item.instrumento ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}</select>`;
      td.querySelector("select").focus();
    } else abrirSuperiores(td, linha);
  }
  function concluirEdicao({ cancelar = false, depois = null } = {}) {
    if (!editando) return;
    const { linha, coluna } = editando;
    const editor = raiz.querySelector("[data-editor]");
    editando = null;
    if (!cancelar && editor) {
      const valor = editor.tagName === "SELECT" ? (editor.value || null) : editor.value.trim();
      aplicar(linha, coluna, valor);
    }
    fecharEscolha();
    atualizar();
    focar();
    if (depois) mover(...depois);
  }

  /* superiores ("Vem de"): várias opções, numa lista com busca, junto da célula */
  function abrirSuperiores(td, linha) {
    const { cat } = dados();
    const candidatos = candidatosASuperior(linha.item, { ...cat, itens: cat.itens.map((x) => ({ ...x, ...(pendentes.get(x.id) ?? {}) })) });
    if (!candidatos.length) { editando = null; avisar("Este item é da camada mais alta: não vem de nenhum outro."); return; }
    const marcados = new Set(linha.item.superiores ?? []);
    const nomeDaCamada = (id) => cat.camadas.find((c) => c.id === id)?.nome ?? "";
    popover = "superiores";
    escolha.innerHTML = `<p class="grade-escolha-titulo">“${esc(rotuloDoItem(linha.item))}” vem de:</p>
      <input type="search" class="grade-escolha-busca" data-escolha-busca placeholder="Buscar" aria-label="Buscar superior">
      <div class="grade-escolha-lista" data-escolha-lista role="group" aria-label="Superiores">${candidatos.map((x) =>
        `<label class="grade-escolha-opcao" data-texto="${esc(normalizar(rotuloDoItem(x)))}"><input type="checkbox" value="${esc(x.id)}"${marcados.has(x.id) ? " checked" : ""}>
          <span>${esc(rotuloDoItem(x))} <small class="tec">${esc(nomeDaCamada(x.camada))}</small></span></label>`).join("")}</div>
      <div class="botoes"><button type="button" class="botao principal" data-escolha-aplicar>Aplicar</button><button type="button" class="botao" data-escolha-cancelar>Cancelar</button></div>`;
    posicionarEscolha(td);
    escolha.querySelector("[data-escolha-busca]").focus();
  }
  function aplicarSuperiores() {
    if (!editando) return;
    const ids = [...escolha.querySelectorAll("input[type=checkbox]:checked")].map((c) => c.value);
    const { linha } = editando;
    editando = null;
    aplicar(linha, "superiores", ids);
    fecharEscolha();
    atualizar();
    focar();
  }

  /* colunas: mostrar, esconder e mudar de lugar */
  function abrirColunas() {
    popover = "colunas";
    const visiveis = colunas().map((c) => c.id);
    const ordem = [...visiveis, ...COLUNAS.map((c) => c.id).filter((id) => !visiveis.includes(id))];
    escolha.innerHTML = `<p class="grade-escolha-titulo">Colunas</p>
      <ul class="grade-colunas">${ordem.map((id, i) => {
        const c = COLUNAS.find((x) => x.id === id);
        return `<li><label><input type="checkbox" data-coluna-visivel="${id}"${visiveis.includes(id) ? " checked" : ""}${c.fixa ? " disabled" : ""}> ${esc(c.titulo)}${c.fixa ? ' <small class="tec">sempre</small>' : ""}</label>
          <span class="grade-colunas-mover"><button type="button" class="botao-icone" data-mover-coluna="${id}" data-sentido="-1" aria-label="Mover ${esc(c.titulo)} para a esquerda"${i === 0 ? " disabled" : ""}>↑</button>
          <button type="button" class="botao-icone" data-mover-coluna="${id}" data-sentido="1" aria-label="Mover ${esc(c.titulo)} para a direita"${i === ordem.length - 1 ? " disabled" : ""}>↓</button></span></li>`;
      }).join("")}</ul>
      <div class="botoes"><button type="button" class="botao-texto" data-colunas-padrao>Voltar ao padrão</button><button type="button" class="botao" data-escolha-cancelar>Fechar</button></div>`;
    posicionarEscolha(barra.querySelector("[data-abrir-colunas]"));
    barra.querySelector("[data-abrir-colunas]")?.setAttribute("aria-expanded", "true");
    escolha.querySelector("input:not([disabled]), button")?.focus();
  }
  function posicionarEscolha(ancora) {
    escolha.hidden = false;
    const caixa = raiz.querySelector(".strata-grade").getBoundingClientRect();
    const a = ancora.getBoundingClientRect();
    const larg = Math.min(340, caixa.width - 24);
    escolha.style.width = `${larg}px`;
    escolha.style.left = `${Math.max(12, Math.min(a.left - caixa.left, caixa.width - larg - 12))}px`;
    const abaixo = a.bottom - caixa.top + 4;
    const alt = escolha.offsetHeight;
    escolha.style.top = `${abaixo + alt > caixa.height - 12 ? Math.max(12, a.top - caixa.top - alt - 4) : abaixo}px`;
    if (!reduzir()) escolha.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 180, easing: "cubic-bezier(.2, 0, 0, 1)" });
  }
  function fecharEscolha() {
    if (!popover) return;
    const era = popover;
    popover = null;
    escolha.hidden = true;
    escolha.replaceChildren();
    if (era === "colunas") { barra.querySelector("[data-abrir-colunas]")?.setAttribute("aria-expanded", "false"); barra.querySelector("[data-abrir-colunas]")?.focus(); }
  }
  function moverColuna(id, sentido) {
    const visiveis = colunas().map((c) => c.id);
    const ordem = [...visiveis, ...COLUNAS.map((c) => c.id).filter((x) => !visiveis.includes(x))];
    const i = ordem.indexOf(id);
    const j = i + sentido;
    if (j < 0 || j >= ordem.length) return;
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    preferencia = { ...preferencia, ordem };
    gravarPreferencia(preferencia);
    desenhar();
    abrirColunas();
    escolha.querySelector(`[data-mover-coluna="${id}"][data-sentido="${sentido}"]:not([disabled])`)?.focus()
      ?? escolha.querySelector(`[data-mover-coluna="${id}"]:not([disabled])`)?.focus();
  }

  /* ---------- desfazer, copiar, colar ---------- */
  function desfazerOuRefazer(refazer) {
    const passo = refazer ? historico.refazer() : historico.desfazer();
    if (!passo) return;
    aplicar(passo.id, passo.campo, refazer ? passo.depois : passo.antes, { registrar: false });
    ativa = { linha: passo.id, coluna: passo.campo };
    atualizar();
    focar();
  }
  function textoDaCelula(linha, coluna) {
    const l = ultimaVistas.find((x) => x.id === linha);
    return l ? l.texto[coluna] ?? "" : "";
  }
  /** Cola um bloco (linhas por quebra, colunas por tabulação) a partir da célula ativa; só nas células que se alteram. */
  function colar(texto) {
    if (!podeEditar() || !ativa.linha) return;
    const { cat } = dados();
    const blocos = String(texto).replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    const cols = colunas();
    const i0 = ultimaVistas.findIndex((l) => l.id === ativa.linha);
    const j0 = cols.findIndex((c) => c.id === ativa.coluna);
    const erros = [];
    let mudou = 0;
    blocos.forEach((valores, di) => valores.forEach((v, dj) => {
      const l = ultimaVistas[i0 + di];
      const c = cols[j0 + dj];
      if (!l || !c?.editavel) return;
      const r = lerValorDaCelula(c.id, v, { ...l.item }, { ...cat, itens: cat.itens.map((x) => ({ ...x, ...(pendentes.get(x.id) ?? {}) })) }, normalizar);
      if (r.erro) { erros.push(r.erro); return; }
      aplicar(l.id, c.id, r.valor);
      mudou++;
    }));
    atualizar();
    focar();
    if (erros.length) avisar(`${erros[0]}${erros.length > 1 ? ` (e mais ${erros.length - 1})` : ""}`);
    else if (!mudou) avisar("Esta coluna não se altera na planilha.");
  }
  function limparCelula() {
    const c = COLUNAS.find((x) => x.id === ativa.coluna);
    if (!podeEditar() || !c?.editavel || !ativa.linha) return;
    aplicar(ativa.linha, c.id, c.tipo === "varios" ? [] : c.tipo === "lista" ? null : "");
    atualizar();
  }

  /* ---------- salvar ---------- */
  async function salvar() {
    if (salvando || !contarPendencias(pendentes)) return false;
    const { todas } = linhasVistas();
    const presa = todas.find((l) => l.alterados.size && l.problemas.some((p) => p.bloqueia));
    if (presa) {
      const p = presa.problemas.find((x) => x.bloqueia);
      lembrado.recolhidos.delete(presa.item.camada);
      ativa = { linha: presa.id, coluna: p.campo };
      atualizar(); focar();
      avisar(`Corrija as células marcadas antes de salvar: ${p.mensagem}`);
      return false;
    }
    salvando = true;
    desenharCabeca(todas);
    const falhas = [];
    const plano = planoDeGravacao(dados().cat.itens, pendentes);
    for (const passo of plano) {
      const rotulo = rotuloDoItem({ ...itemOriginal(passo.id), ...(pendentes.get(passo.id) ?? {}) });
      try {
        if (passo.campos) {
          await store.alterarItemEstrategico(passo.id, passo.campos);
          const resto = { ...pendentes.get(passo.id) };
          for (const k of Object.keys(passo.campos)) delete resto[k];
          if (Object.keys(resto).length) pendentes.set(passo.id, resto); else pendentes.delete(passo.id);
        }
      } catch (f) { falhas.push(`${rotulo}: ${f.message}`); }
    }
    for (const passo of plano) {
      if (!passo.ligar.length && !passo.desligar.length) continue;
      try {
        for (const s of passo.desligar) await store.desligarSuperior(passo.id, s);
        for (const s of passo.ligar) await store.ligarSuperior(passo.id, s);
        const resto = { ...pendentes.get(passo.id) };
        delete resto.superiores;
        if (Object.keys(resto).length) pendentes.set(passo.id, resto); else pendentes.delete(passo.id);
      } catch (f) { falhas.push(`${rotuloDoItem(itemOriginal(passo.id))}: ${f.message}`); }
    }
    try { await aoGravar(); } catch { /* o aviso da falha de leitura vem da tela */ }
    /* o que foi gravado já é o valor do banco: as pendências que restam são só as que falharam */
    pendentes = [...pendentes].filter(([id]) => itemOriginal(id)).reduce((m, [id, campos]) => Object.entries(campos).reduce((n, [k, v]) => registrarValor(n, itemOriginal(id), k, v), m), new Map());
    historico.limpar();
    salvando = false;
    atualizar();
    if (falhas.length) avisar(`Não foi possível salvar ${falhas.length} ${plural(falhas.length, "item", "itens")}. ${falhas[0]}`);
    else avisar("Alterações salvas.");
    return !falhas.length;
  }

  /* ---------- abrir e fechar ---------- */
  let soltarVoltar = abrirCamada(() => fechar({ peloVoltar: true }));
  function fechar({ peloVoltar = false, forcar = false } = {}) {
    if (editando) concluirEdicao({ cancelar: true });
    fecharEscolha();
    if (!forcar && contarPendencias(pendentes)) {
      if (peloVoltar) soltarVoltar = abrirCamada(() => fechar({ peloVoltar: true })); // o Voltar não fecha com alterações pendentes
      confirmandoFechar = true;
      desenhar();
      return;
    }
    if (!peloVoltar) soltarVoltar?.();
    soltarVoltar = null;
    document.removeEventListener("keydown", teclaGeral);
    document.removeEventListener("copy", aoCopiar);
    document.removeEventListener("paste", aoColar);
    window.removeEventListener("resize", aoRedimensionar);
    raiz.classList.remove("aberta");
    const tirar = () => raiz.remove();
    if (reduzir()) tirar();
    else { raiz.querySelector(".strata-grade").addEventListener("transitionend", tirar, { once: true }); setTimeout(tirar, 500); }
    aoFechar();
  }

  /* ---------- eventos ---------- */
  raiz.addEventListener("click", async (e) => {
    const t = e.target.closest("button, [data-fundo], td, label");
    if (!t) { if (popover && !e.target.closest("[data-escolha]")) { if (editando) concluirEdicao({ cancelar: true }); else fecharEscolha(); } return; }
    if (popover && !t.closest("[data-escolha]") && !t.matches("[data-abrir-colunas]")) {
      if (editando) concluirEdicao({ cancelar: true }); else fecharEscolha();
      if (!t.matches("td")) return;
    }
    if (t.matches("[data-fundo]") || t.matches("[data-fechar-planilha]")) return fechar();
    if (t.matches("[data-continuar]")) { confirmandoFechar = false; desenhar(); focar(); return; }
    if (t.matches("[data-descartar]")) return fechar({ forcar: true });
    if (t.matches("[data-salvar-e-fechar]")) { confirmandoFechar = false; if (await salvar()) fechar({ forcar: true }); return; }
    if (t.matches("[data-salvar]")) return salvar();
    if (t.matches("[data-desfazer]")) return desfazerOuRefazer(false);
    if (t.matches("[data-refazer]")) return desfazerOuRefazer(true);
    if (t.matches("[data-abrir-colunas]")) return popover === "colunas" ? fecharEscolha() : abrirColunas();
    if (t.matches("[data-colunas-padrao]")) { preferencia = {}; gravarPreferencia(preferencia); desenhar(); abrirColunas(); return; }
    if (t.dataset.moverColuna) return moverColuna(t.dataset.moverColuna, Number(t.dataset.sentido));
    if (t.matches("[data-escolha-aplicar]")) return aplicarSuperiores();
    if (t.matches("[data-escolha-cancelar]")) { if (editando) concluirEdicao({ cancelar: true }); else fecharEscolha(); return; }
    if (t.matches("[data-so-problemas]")) { filtro.soProblemas = !filtro.soProblemas; return desenhar(); }
    if (t.dataset.recolher) {
      if (lembrado.recolhidos.has(t.dataset.recolher)) lembrado.recolhidos.delete(t.dataset.recolher); else lembrado.recolhidos.add(t.dataset.recolher);
      return desenhar();
    }
    if (t.dataset.ordenar) {
      const atual = filtro.ordem?.coluna === t.dataset.ordenar ? filtro.ordem.sentido : 0;
      filtro.ordem = atual === 0 ? { coluna: t.dataset.ordenar, sentido: 1 } : atual === 1 ? { coluna: t.dataset.ordenar, sentido: -1 } : null;
      return desenhar();
    }
    if (t.matches("td[data-coluna]") && !t.querySelector("[data-editor]")) {
      const tr = t.closest("tr");
      if (editando) concluirEdicao();
      if (estreita()) { ativar(tr.dataset.linha, t.dataset.coluna, { foco: false }); aoAbrirItem(tr.dataset.linha); return; }
      const ja = ativa.linha === tr.dataset.linha && ativa.coluna === t.dataset.coluna;
      ativar(tr.dataset.linha, t.dataset.coluna);
      if (ja) comecarEdicao(); // segundo clique na mesma célula: altera
    }
  });
  corpo.addEventListener("dblclick", (e) => {
    const td = e.target.closest("td[data-coluna]");
    if (!td || editando || estreita()) return;
    ativar(td.closest("tr").dataset.linha, td.dataset.coluna);
    comecarEdicao();
  });
  barra.addEventListener("input", (e) => {
    if (e.target.matches("[data-grade-busca]")) { filtro.busca = e.target.value; desenhar(); }
  });
  barra.addEventListener("change", (e) => {
    if (e.target.matches("[data-grade-camada]")) { filtro.camada = e.target.value; desenhar(); }
    if (e.target.matches("[data-grade-vigencia]")) { filtro.vigencia = e.target.value; desenhar(); }
    if (e.target.matches("[data-grade-instrumento]")) { filtro.instrumento = e.target.value === "*" ? null : e.target.value; desenhar(); }
  });
  escolha.addEventListener("input", (e) => {
    if (!e.target.matches("[data-escolha-busca]")) return;
    const termo = normalizar(e.target.value);
    for (const o of escolha.querySelectorAll("[data-texto]")) o.hidden = termo && !o.dataset.texto.includes(termo);
  });
  escolha.addEventListener("change", (e) => {
    if (!e.target.dataset.colunaVisivel) return;
    const ocultas = new Set(preferencia.ocultas ?? []);
    if (e.target.checked) ocultas.delete(e.target.dataset.colunaVisivel); else ocultas.add(e.target.dataset.colunaVisivel);
    preferencia = { ...preferencia, ocultas: [...ocultas] };
    gravarPreferencia(preferencia);
    desenhar();
  });
  escolha.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && popover === "superiores" && !e.target.matches("button")) { e.preventDefault(); aplicarSuperiores(); }
  });

  /** Teclas da tabela: andar, alterar, copiar, colar, desfazer. */
  tabela.addEventListener("keydown", (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (editando) {
      if (!e.target.matches("[data-editor]")) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); concluirEdicao({ cancelar: true }); return; }
      if (e.key === "Enter") { e.preventDefault(); concluirEdicao({ depois: [e.shiftKey ? -1 : 1, 0] }); return; }
      if (e.key === "Tab") { e.preventDefault(); concluirEdicao({ depois: [0, e.shiftKey ? -1 : 1] }); return; }
      return;
    }
    if (!e.target.matches("td[data-coluna]")) return;
    const passos = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], PageUp: [-10, 0], PageDown: [10, 0] };
    if (passos[e.key]) { e.preventDefault(); return mover(...passos[e.key]); }
    if (e.key === "Home") { e.preventDefault(); return mover(ctrl ? -1e6 : 0, -1e6); }
    if (e.key === "End") { e.preventDefault(); return mover(ctrl ? 1e6 : 0, 1e6); }
    if (e.key === "Tab") { e.preventDefault(); return mover(0, e.shiftKey ? -1 : 1); }
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      if (estreita()) { aoAbrirItem(ativa.linha); return; }
      return comecarEdicao();
    }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); return limparCelula(); }
    if (ctrl && !e.altKey && (e.key === "z" || e.key === "Z")) { e.preventDefault(); return desfazerOuRefazer(e.shiftKey); }
    if (ctrl && !e.altKey && (e.key === "y" || e.key === "Y")) { e.preventDefault(); return desfazerOuRefazer(true); }
    if (!ctrl && !e.altKey && e.key.length === 1 && COLUNAS.find((c) => c.id === ativa.coluna)?.tipo === "texto") { e.preventDefault(); return comecarEdicao(e.key); }
  });
  tabela.addEventListener("focusout", (e) => {
    /* clicar fora do editor de texto ou da lista conclui a alteração (como numa planilha) */
    if (editando && e.target.matches("[data-editor]") && !raiz.querySelector("[data-escolha]").contains(e.relatedTarget)) {
      setTimeout(() => { if (editando && !raiz.querySelector("[data-editor]")?.matches(":focus")) concluirEdicao(); }, 0);
    }
  });
  tabela.addEventListener("change", (e) => { if (e.target.matches("select[data-editor]")) concluirEdicao(); });
  /* copiar e colar: sem texto selecionado, o navegador manda o evento à página, e não à célula; vale a célula com o foco */
  const celulaComFoco = () => (document.activeElement?.matches?.("td[data-coluna]") && tabela.contains(document.activeElement) ? document.activeElement : null);
  function aoCopiar(e) {
    if (editando || !celulaComFoco()) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", textoDaCelula(ativa.linha, ativa.coluna));
    avisar("Copiado.");
  }
  function aoColar(e) {
    if (editando || !celulaComFoco()) return;
    e.preventDefault();
    colar(e.clipboardData.getData("text/plain"));
  }
  document.addEventListener("copy", aoCopiar);
  document.addEventListener("paste", aoColar);

  /** Teclas fora da tabela: Esc (fechar a lista aberta ou a planilha) e Ctrl+S (salvar). */
  function teclaGeral(e) {
    if (document.querySelector(".camada.aberta:not([data-planilha])")) return; // um painel aberto por cima trata as teclas
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S") && podeEditar()) { e.preventDefault(); if (editando && editando.coluna !== "superiores") concluirEdicao(); salvar(); return; }
    if (e.key !== "Escape" || e.defaultPrevented) return;
    e.preventDefault();
    if (popover) { if (editando) concluirEdicao({ cancelar: true }); else fecharEscolha(); return; }
    if (confirmandoFechar) { confirmandoFechar = false; desenhar(); focar(); return; }
    fechar();
  }
  document.addEventListener("keydown", teclaGeral);
  let ultimaLargura = estreita();
  function aoRedimensionar() {
    if (estreita() === ultimaLargura) return;
    ultimaLargura = estreita();
    if (editando) concluirEdicao({ cancelar: true });
    desenhar();
  }
  window.addEventListener("resize", aoRedimensionar);

  desenhar();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    raiz.classList.add("aberta");
    if (estreita()) $("[data-grade-busca]")?.blur(); else focar();
  }));
  if (ativa.linha) { selecaoAvisada = ativa.linha; aoSelecionar(ativa.linha); }

  return {
    /** Depois de o catálogo mudar por fora (painel do item, outra aba): redesenha sem perder as pendências. */
    atualizar() { if (!editando) atualizar(); },
    fechar,
    get aberta() { return raiz.isConnected; },
  };
}
