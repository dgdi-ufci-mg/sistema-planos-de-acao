/**
 * Janela da ação (especificação, seções 5.3, 5.4 e 8.3; passo 1.7).
 * Resumo da ação, edição no lugar (com Salvar e Cancelar), seletores com busca para
 * dependências e responsáveis (sem ciclos), reestimativa, conclusão e histórico de estimativas.
 * As listas mudam item a item, na hora (seção 4.6). Notas com editor visual, guardadas em Markdown seguro (passo 1.8).
 */
import { ICONES } from "../icones.js";
import { esc, dataBr, plural } from "../formato.js";
import { duracaoPert } from "../calculo.js";
import { estimativaLivre, anterioresPossiveis, buscar, resumoDasEstimativas, pendencias, normalizarCodigo } from "../acao.js";
import { markdownParaHtml, htmlParaMarkdown, linkSeguro } from "../notas.js";
import { abrirPainel, fecharPainel, avisar } from "./painel.js";
import { excluirAcao } from "./exclusao.js";
import { surgir, trocarSuave, abrirSuave, fecharSuave, reduzirMovimento } from "./movimento.js";
import { seloHtml } from "./pessoas.js";
import { seletorHtml, ligarSeletores } from "./seletor.js";
import { descreverRegistro } from "../historico.js";

const SITUACOES = {
  concluida: ["Concluída", "concluida", "icone-concluida"],
  liberada: ["Liberada", "liberada", "icone-liberada"],
  naoLiberada: ["Não liberada", "naoLiberada", "icone-nao-liberada"],
};
const MAX_SUGESTOES = 8;
const decimal = (x) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const diasUteis = (n) => `${decimal(n)} ${plural(Math.abs(n), "dia útil", "dias úteis")}`;

/**
 * @param {{store: object, espacoId: string, numero: number, hoje: string, usuario?: string|null,
 *   dados: object, aoFechar: () => void, abrirCom?: string|null}} opcoes  dados: ver dadosDaJanela em espaco.js;
 *   abrirCom: formulário já aberto, como "concluir"
 * @returns {{atualizar: (dados: object) => void, fechar: () => void}}
 */
export function abrirAcao({ store, espacoId, numero, hoje, dados, aoFechar, abrirCom = null, usuario = null }) {
  let d = dados;
  /** Quem acabou de alterar a ação, se não foi quem está com a janela aberta (seção 4.6). */
  let alheia = null;
  let tempoAlheia = null;
  /** Nome de outra ação: o código (se o espaço usa códigos) e o rótulo. */
  const nomeHtml = (a) => `${d.usaCodigos && a.codigo ? `<span class="mono">${esc(a.codigo)}</span> ` : ""}${esc(a.rotulo)}`;
  const nomeTexto = (a) => `${d.usaCodigos && a.codigo ? `${a.codigo} ` : ""}${a.rotulo}`;
  const acaoAtual = () => d.acoes.find((a) => a.numero === numero);
  /** Campo em edição ("rotulo", "etapa", "descricao", "naoAntesDe", "estimativa") ou formulário aberto ("reestimar", "concluir"). */
  let editando = abrirCom; // "concluir" quando a janela é aberta ao arrastar para Concluídas
  let fechada = false;
  /** Histórico de alterações (passo 1.16): lido do banco só quando a seção é aberta. */
  let registros = null;
  let historicoAberto = false;

  const inicial = acaoAtual();
  const corpo = abrirPainel(d.usaCodigos && inicial?.codigo ? `Ação ${inicial.codigo}` : "Ação", "", {
    janela: true,
    aoFechar: () => { fechada = true; aoFechar(); },
  });
  const executar = async (operacao, sucesso) => {
    try {
      await operacao();
      if (sucesso) avisar(sucesso);
      return true;
    } catch (e) {
      avisar(e.message);
      return false;
    }
  };

  /* ---------- desenho ---------- */
  function desenhar() {
    const acao = acaoAtual();
    if (!acao) { fecharPainel(); return; }
    const l = d.linhaDe.get(numero);
    const c = d.caminho.porAcao.get(numero);
    const campos = d.espaco.camposOpcionais ?? {};
    const contexto = { tons: d.espaco.tons, meus: d.meus };
    const [sitTexto, sitIcone, sitClasse] = SITUACOES[l.situacao];
    const etapas = (d.espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => ({ ...e, fase: f.nome })));
    const etapa = etapas.find((e) => e.id === acao.etapa);
    const livre = estimativaLivre(acao, l.situacao, hoje);
    const pend = l.situacao === "naoLiberada" ? pendencias(acao, d.acoes, hoje) : null;
    const resumoEst = resumoDasEstimativas(acao, c);
    const donos = acao.responsaveis.map((id) => d.pessoas.get(id)).filter(Boolean);
    const revisao = l.revisao == null ? null : l.revisao < 0.01 ? "<1%" : `${Math.round(l.revisao * 100)}%`;

    const valores = guardarValores();
    corpo.innerHTML = `
      ${alheia ? `<p class="alteracao-alheia" role="status">${esc(alheia)} alterou esta ação agora.</p>` : ""}
      <div class="janela-cabeca">
        ${d.usaFases ? `<span class="tec">${etapa ? `${esc(etapa.fase)} · ${esc(etapa.nome)}` : "Sem fase nem etapa"}</span>` : ""}
        ${editando === "rotulo"
          ? editorHtml("rotulo", `<input name="rotulo" maxlength="120" value="${esc(acao.rotulo)}" aria-label="Rótulo">`)
          : `<h3 class="janela-rotulo editavel" data-editar="rotulo" tabindex="0" title="Clique para editar">${esc(acao.rotulo)}</h3>`}
      </div>

      <dl class="janela-resumo">
        <div><dt>Situação</dt><dd class="sit"><span class="${sitClasse}">${ICONES[sitIcone]}</span>${sitTexto}${l.atrasada ? `<span class="carimbo"><span class="icone-atrasada">${ICONES.atrasada}</span>Atrasada</span>` : ""}</dd></div>
        <div><dt>${l.situacao === "concluida" ? "Concluída em" : "Conclusão prevista"}</dt>${l.semEstimativa ? `<dd><span class="falta-estimar">Falta estimar</span></dd>` : `<dd class="mono${l.atrasada ? " atrasada" : ""}">${dataBr(l.conclusao)}</dd>`}</div>
        ${l.situacao === "concluida" || l.execucao == null ? "" : `
          <div><dt>Prioridade de execução <a href="#" class="oque" data-termo="exec">o que é?</a></dt><dd>${barra(l.execucao, "var(--calor)", `${Math.round(l.execucao * 100)}%`)}</dd></div>
          <div><dt>Prioridade de revisão <a href="#" class="oque" data-termo="rev">o que é?</a></dt><dd>${barra(l.revisao, "var(--accent)", revisao)}</dd></div>`}
      </dl>

      ${c.regraDoPassado ? `<p class="alerta">${ICONES.atrasada}<span><b>Prazo vencido sem reestimativa:</b> o cálculo considera conclusão a partir de hoje. Reestime a ação para informar quanto falta. <a href="#" class="oque" data-termo="regra">o que é?</a></span></p>` : ""}
      ${pend && (pend.anteriores.length || pend.dataMinima) ? `<p class="nota-janela">Será liberada ${[
        pend.anteriores.length ? `quando ${plural(pend.anteriores.length, "for concluída a ação", "forem concluídas as ações")} ${pend.anteriores.map((n) => `“${esc(nomeTexto(d.acoes.find((a) => a.numero === n)))}”`).join(", ")}` : "",
        pend.dataMinima ? `a partir de ${dataBr(pend.dataMinima)}` : "",
      ].filter(Boolean).join(", e ")}.</p>` : ""}

      ${botoesHtml(l, c)}
      ${editando === "reestimar" ? reestimativaHtml() : ""}
      ${editando === "concluir" ? conclusaoHtml(acao) : ""}

      <div class="janela-campos">
        ${d.usaCodigos ? campoHtml("codigo", "Código", acao.codigo ? `<span class="mono">${esc(acao.codigo)}</span>` : "",
          `<input name="codigo" maxlength="12" autocomplete="off" autocapitalize="characters" value="${esc(acao.codigo ?? "")}" aria-label="Código">`,
          "De 2 a 8 letras ou números, sem repetir no espaço. Deixe vazio para ficar sem código.") : ""}
        ${d.usaFases ? campoHtml("etapa", "Etapa", etapa ? `${esc(etapa.fase)} · ${esc(etapa.nome)}` : "",
          `<select name="etapa" aria-label="Etapa"><option value="">Sem fase nem etapa</option>${(d.espaco.estrutura ?? []).map((f) =>
            `<optgroup label="${esc(f.nome)}">${f.etapas.map((e) => `<option value="${esc(e.id)}"${e.id === acao.etapa ? " selected" : ""}>${esc(e.nome)}</option>`).join("")}</optgroup>`).join("")}</select>`) : ""}
        ${campos.descricao !== false ? campoHtml("descricao", "Descrição", acao.descricao ? `<span class="texto-livre">${esc(acao.descricao)}</span>` : "",
          `<textarea name="descricao" rows="4" aria-label="Descrição">${esc(acao.descricao ?? "")}</textarea>`) : ""}

        <div class="campo-acao">
          <span class="campo-nome">Depende de</span>
          <div class="etiquetas">${(acao.dependeDe ?? []).map((n) => {
            const a = d.acoes.find((x) => x.numero === n);
            return `<span class="etiqueta">${a ? nomeHtml(a) : "(ação excluída)"}<button type="button" class="tirar" data-tirar-dependencia="${n}" aria-label="Retirar ${esc(a ? nomeTexto(a) : "")}">${ICONES.fechar}</button></span>`;
          }).join("") || `<span class="vazio">Nenhuma: pode começar no início do espaço.</span>`}</div>
          ${seletorHtml("dependeDe", d.usaCodigos ? "Acrescentar ação anterior: digite o nome ou o código" : "Acrescentar ação anterior: digite o nome")}
        </div>

        <div class="campo-acao">
          <span class="campo-nome">Responsáveis</span>
          <div class="etiquetas">${donos.map((r) =>
            `<span class="etiqueta">${seloHtml(r, contexto)}${esc(r.nome)}<button type="button" class="tirar" data-tirar-responsavel="${esc(r.id)}" aria-label="Retirar ${esc(r.nome)}">${ICONES.fechar}</button></span>`).join("")
            || `<span class="vazio">Nenhum responsável.</span>`}</div>
          ${seletorHtml("responsaveis", "Acrescentar responsável: digite o nome, a sigla ou o setor")}
        </div>

        ${campoHtml("naoAntesDe", "Não começa antes de", acao.naoAntesDe ? dataBr(acao.naoAntesDe) : "",
          `<input type="date" name="naoAntesDe" value="${esc(acao.naoAntesDe ?? "")}" aria-label="Não começa antes de">`,
          `Data mínima para a ação ser liberada, mesmo que as anteriores já tenham terminado. <a href="#" class="oque" data-termo="naoAntesDe">o que é?</a>`)}

        ${livre ? campoHtml("estimativa", "Estimativa", vigenteHtml(acao), tresPontosHtml(acao.estimativas?.at(-1)),
          l.situacao === "naoLiberada" || !acao.estimativas?.length
            ? "Prazo em dias úteis, da liberação até a conclusão, incluindo o tempo até alguém começar. Enquanto a ação não está liberada, a estimativa pode ser ajustada livremente."
            : "Correção de digitação: vale só hoje, antes de qualquer reestimativa.") : ""}

        ${campos.notas !== false ? notasHtml(acao) : ""}
      </div>

      ${historicoHtml(acao, resumoEst)}
      <details class="historico alteracoes" data-historico${historicoAberto ? " open" : ""}>
        <summary><h4>Histórico de alterações</h4></summary>
        <div data-registros>${registrosHtml()}</div>
      </details>
      ${store.podeGravar ? `<div class="zona-exclusao"><button class="botao-excluir" type="button" data-excluir-acao>Excluir ação</button></div>` : ""}`;
    corpo.closest(".painel").querySelector("header h2").textContent = d.usaCodigos && acao.codigo ? `Ação ${acao.codigo}` : "Ação";
    corpo.closest(".painel").style.setProperty("--calor", l.situacao === "concluida" ? "var(--ok)" : l.execucao == null ? "var(--neutral)"
      : `color-mix(in oklab, var(--crit) ${Math.round(l.execucao * 100)}%, var(--neutral))`);
    restaurarValores(valores);
    seletores.desenhar();
    encolherFormularioGravado();
  }

  /**
   * Formulário de bloco ("Reestimar", "Registrar conclusão") que acabou de ser gravado: a gravação
   * redesenha a janela sem ele; uma cópia encolhe no lugar enquanto os botões voltam a crescer.
   */
  let gravado = null;
  function encolherFormularioGravado() {
    if (!gravado) return;
    const fantasma = gravado;
    gravado = null;
    const ancora = corpo.querySelector("[data-abrir-form], [data-desfazer-conclusao]")?.closest(".botoes");
    if (!ancora || reduzirMovimento()) return;
    fantasma.setAttribute("aria-hidden", "true");
    fantasma.inert = true;
    ancora.after(fantasma);
    fecharSuave(fantasma).then(() => fantasma.remove());
    abrirSuave(ancora);
  }
  /** Cópia do formulário com o que foi digitado (a cópia de um campo não leva o valor digitado). */
  function copiaDoFormulario(form) {
    const copia = form.cloneNode(true);
    const originais = form.querySelectorAll("input, textarea");
    copia.querySelectorAll("input, textarea").forEach((el, i) => { el.value = originais[i].value; });
    return copia;
  }

  function barra(valor, cor, texto) {
    return `<span class="medidor"><span class="barra-medidor"><i style="width:${Math.max(2, Math.round(valor * 100))}%;background:${cor}"></i></span><span class="num">${texto}</span></span>`;
  }

  function botoesHtml(l, c) {
    if (l.situacao === "concluida") {
      return `<div class="botoes"><button class="botao" type="button" data-desfazer-conclusao>Desfazer conclusão</button></div>`;
    }
    if (l.situacao !== "liberada" || editando === "reestimar" || editando === "concluir") return "";
    return `<div class="botoes">
      <button class="botao${l.atrasada || c.regraDoPassado ? " principal" : ""}" type="button" data-abrir-form="reestimar">Reestimar</button>
      <button class="botao${l.atrasada ? "" : " principal"}" type="button" data-abrir-form="concluir">${ICONES.concluida}Registrar conclusão</button>
    </div>`;
  }

  /** Campo com valor e, ao clicar, editor com Salvar e Cancelar. */
  function campoHtml(nome, rotulo, valorHtml, editor, dica = "") {
    return `<div class="campo-acao" data-campo="${nome}">
      <span class="campo-nome">${rotulo}</span>
      ${editando === nome ? editorHtml(nome, editor)
        : `<div class="editavel" data-editar="${nome}" tabindex="0" role="button" title="Clique para editar">${valorHtml || `<span class="vazio">Clique para preencher</span>`}</div>`}
      ${dica && editando === nome ? `<span class="tec">${dica}</span>` : ""}
    </div>`;
  }

  function editorHtml(nome, editor) {
    return `<form class="editor" data-salvar="${nome}">${editor}
      <p class="erro" data-erro hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">Salvar</button><button class="botao" type="button" data-cancelar>Cancelar</button></div>
    </form>`;
  }

  /** Notas: mostradas já formatadas; ao clicar, editor visual com negrito, itálico, link e lista (seção 8.5). */
  function notasHtml(acao) {
    const html = markdownParaHtml(acao.notas);
    if (editando !== "notas") {
      return `<div class="campo-acao" data-campo="notas"><span class="campo-nome">Notas</span>
        <div class="editavel nota-html" data-editar="notas" tabindex="0" role="button" title="Clique para editar">${html || `<span class="vazio">Clique para escrever</span>`}</div></div>`;
    }
    return `<div class="campo-acao" data-campo="notas"><span class="campo-nome">Notas</span>
      <form class="editor" data-salvar="notas">
        <div class="barra-notas" role="toolbar" aria-label="Formatação">
          <button type="button" class="botao discreto" data-formatar="bold" title="Negrito (Ctrl+B)" aria-label="Negrito"><b>N</b></button>
          <button type="button" class="botao discreto" data-formatar="italic" title="Itálico (Ctrl+I)" aria-label="Itálico"><i>I</i></button>
          <button type="button" class="botao discreto" data-formatar="link" title="Link (Ctrl+K)">Link</button>
          <button type="button" class="botao discreto" data-formatar="lista" title="Lista com marcadores">Lista</button>
        </div>
        <div class="barra-link" data-barra-link hidden>
          <input type="url" inputmode="url" placeholder="https://…" aria-label="Endereço do link" data-endereco-link>
          <button type="button" class="botao" data-aplicar-link>Aplicar</button>
        </div>
        <div class="editor-notas nota-html" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Notas" data-editor-notas>${html}</div>
        <p class="erro" data-erro hidden></p>
        <div class="botoes"><button class="botao principal" type="submit">Salvar</button><button class="botao" type="button" data-cancelar>Cancelar</button></div>
      </form></div>`;
  }

  /* ---------- editor visual das notas ---------- */
  let selecaoGuardada = null;
  const editorNotas = () => corpo.querySelector("[data-editor-notas]");
  function formatar(comando) {
    const ed = editorNotas();
    if (!ed) return;
    ed.focus();
    if (comando === "link") return abrirBarraDeLink();
    document.execCommand(comando === "lista" ? "insertUnorderedList" : comando);
  }
  function abrirBarraDeLink() {
    const s = getSelection();
    selecaoGuardada = s.rangeCount && editorNotas().contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
    const barraLink = corpo.querySelector("[data-barra-link]");
    barraLink.hidden = false;
    const entrada = barraLink.querySelector("input");
    entrada.value = "";
    entrada.focus();
  }
  function aplicarLink() {
    const url = corpo.querySelector("[data-endereco-link]").value.trim();
    if (!linkSeguro(url)) { avisar("Use um endereço que comece com https://, http:// ou mailto:."); return; }
    const ed = editorNotas();
    ed.focus();
    const s = getSelection();
    if (selecaoGuardada) { s.removeAllRanges(); s.addRange(selecaoGuardada); }
    if (s.rangeCount && !s.isCollapsed && ed.contains(s.anchorNode)) document.execCommand("createLink", false, url);
    else document.execCommand("insertHTML", false, `<a href="${esc(url)}">${esc(url)}</a>&nbsp;`);
    corpo.querySelector("[data-barra-link]").hidden = true;
  }

  function tresPontosHtml(e) {
    const v = (k) => (e?.[k] ?? "");
    return `<div class="tres-pontos">
      <label class="campo"><span>Otimista</span><input name="o" type="number" min="0" step="1" inputmode="numeric" value="${v("o")}"></label>
      <label class="campo"><span>Mais provável</span><input name="m" type="number" min="0" step="1" inputmode="numeric" value="${v("m")}"></label>
      <label class="campo"><span>Pessimista</span><input name="p" type="number" min="0" step="1" inputmode="numeric" value="${v("p")}"></label>
    </div>
    <p class="tec" data-pert>${e ? `Prazo previsto (PERT): ${diasUteis(duracaoPert(e))}` : ""}</p>`;
  }

  function vigenteHtml(acao) {
    const e = acao.estimativas?.at(-1);
    return e ? `<span class="mono">${decimal(e.o)} · ${decimal(e.m)} · ${decimal(e.p)}</span> <span class="tec">otimista · mais provável · pessimista, em dias úteis</span>`
      : `<span class="falta-estimar">Falta estimar</span> <span class="vazio">Clique para preencher</span>`;
  }

  function reestimativaHtml() {
    return `<form class="editor cartao-form" data-salvar="reestimar">
      <h4>Reestimar</h4>
      <p class="tec">Quanto tempo falta, <b>a partir de hoje</b>, em dias úteis. A estimativa anterior fica no histórico.</p>
      ${tresPontosHtml(null)}
      <label class="campo"><span>Motivo <small>(opcional)</small></span><input name="motivo" maxlength="200" placeholder="Por exemplo: atraso do fornecedor"></label>
      <p class="erro" data-erro hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">Salvar reestimativa</button><button class="botao" type="button" data-cancelar>Cancelar</button></div>
    </form>`;
  }

  function conclusaoHtml(acao) {
    return `<form class="editor cartao-form" data-salvar="concluir">
      <h4>Registrar conclusão</h4>
      <label class="campo"><span>Data de conclusão</span><input name="data" type="date" value="${hoje}" max="${hoje}" min="${esc(d.espaco.inicio ?? "")}"></label>
      <p class="erro" data-erro hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">Registrar</button><button class="botao" type="button" data-cancelar>Cancelar</button></div>
    </form>`;
  }

  function historicoHtml(acao, resumo) {
    const lista = acao.estimativas ?? [];
    if (!lista.length) return `<section class="historico"><h4>Histórico de estimativas</h4><p class="vazio">Sem estimativa.</p></section>`;
    const nomeDe = (usuario) => d.responsaveis.find((r) => r.usuario && r.usuario === usuario)?.nome ?? usuario;
    const andou = resumo.deslocamento;
    return `<section class="historico">
      <h4>Histórico de estimativas</h4>
      <p class="tec">Original: ${diasUteis(resumo.original)} · ${resumo.reprogramacoes} ${plural(resumo.reprogramacoes, "reprogramação", "reprogramações")}${resumo.reprogramacoes || andou ? ` · o término ${andou > 0 ? `atrasou ${diasUteis(andou)}` : andou < 0 ? `adiantou ${diasUteis(-andou)}` : "não mudou"}` : ""}</p>
      <ol>${lista.map((e, i) => `<li${i === lista.length - 1 ? ' class="vigente"' : ""}>
        <span class="mono">${dataBr(e.em)}</span>${e.por ? ` · ${esc(nomeDe(e.por))}` : ""}${i === lista.length - 1 ? ` <span class="selo-vigente">vigente</span>` : ""}
        <span>${decimal(e.o)} · ${decimal(e.m)} · ${decimal(e.p)} → <b>${diasUteis(duracaoPert(e))}</b> ${e.contaDe === "data" ? `a partir de ${dataBr(e.em)}` : "da liberação"}</span>
        ${e.motivo ? `<span class="tec">Motivo: ${esc(e.motivo)}</span>` : ""}
      </li>`).join("")}</ol>
    </section>`;
  }

  /** Registros do histórico de alterações, do mais recente ao mais antigo, em frases simples. */
  function registrosHtml() {
    if (!registros) return `<p class="vazio">Carregando…</p>`;
    if (!registros.length) return `<p class="vazio">Nenhuma alteração registrada.</p>`;
    const etapas = new Map((d.espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => [e.id, e.nome])));
    const nomes = {
      acao: (n) => { const a = d.acoes.find((x) => x.numero === n); return a ? `“${nomeTexto(a)}”` : "uma ação excluída"; },
      responsavel: (id) => d.pessoas.get(id)?.nome ?? "um responsável excluído",
      etapa: (id) => etapas.get(id) ?? "etapa retirada",
    };
    const quem = (email) => (email ? d.responsaveis.find((r) => r.usuario === email)?.nome ?? email : "Sem login");
    const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return `<ol>${[...registros].reverse().map((r) => `<li>
      <span><span class="mono">${esc(quando(r.em))}</span> · ${esc(quem(r.por))}</span>
      <span>${esc(descreverRegistro(r, nomes))}</span>
    </li>`).join("")}</ol>
    <p class="tec">Registro permanente: ninguém altera nem apaga.</p>`;
  }
  async function carregarHistorico() {
    try {
      registros = await store.listarHistorico(espacoId, numero);
    } catch (e) {
      registros = [];
      avisar(e.message);
    }
    const alvo = corpo.querySelector("[data-registros]");
    if (alvo && !fechada) alvo.innerHTML = registrosHtml();
  }
  corpo.addEventListener("toggle", (e) => {
    if (!e.target.matches?.("[data-historico]")) return;
    historicoAberto = e.target.open;
    if (historicoAberto) carregarHistorico();
  }, true);

  /* ---------- seletores com busca ---------- */
  function opcoesDe(nome, texto) {
    const acao = acaoAtual();
    if (nome === "dependeDe") {
      const etapaDe = new Map((d.espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => [e.id, e.nome])));
      return buscar(anterioresPossiveis(d.acoes, numero), texto, (a) => [a.rotulo, d.usaCodigos ? a.codigo : ""]).slice(0, MAX_SUGESTOES)
        .map((a) => ({
          html: `${nomeHtml(a)}${etapaDe.get(a.etapa) ? ` <span class="tec">${esc(etapaDe.get(a.etapa))}</span>` : ""}`,
          escolher: () => store.acrescentarDependencia(espacoId, numero, a.numero),
        }));
    }
    const contexto = { tons: d.espaco.tons, meus: d.meus };
    const disponiveis = d.responsaveis.filter((r) => !acao.responsaveis.includes(r.id));
    const achados = buscar(disponiveis, texto, (r) => [r.nome, r.sigla, r.setor]).slice(0, MAX_SUGESTOES)
      .map((r) => ({ html: `${seloHtml(r, contexto)} ${esc(r.nome)}${r.setor ? ` <span class="tec">${esc(r.setor)}</span>` : ""}`,
        escolher: () => store.acrescentarResponsavelNaAcao(espacoId, numero, r.id) }));
    const nomeNovo = texto.trim();
    const jaExiste = d.responsaveis.some((r) => r.nome.toLowerCase() === nomeNovo.toLowerCase());
    if (nomeNovo && !jaExiste) {
      for (const [tipo, comoTexto] of [["pessoa", "pessoa"], ["unidade", "unidade (setor, equipe ou grupo)"]]) {
        achados.push({
          html: `${ICONES.mais} Cadastrar “${esc(nomeNovo)}” como ${comoTexto}`,
          escolher: async () => {
            const id = await store.criarResponsavel(espacoId, { tipo, nome: nomeNovo, ...(tipo === "unidade" ? { sigla: nomeNovo.length <= 10 ? nomeNovo.toUpperCase() : "" } : {}) });
            await store.acrescentarResponsavelNaAcao(espacoId, numero, id);
          },
        });
      }
    }
    return achados;
  }

  /* ---------- valores digitados: mantidos quando a janela é redesenhada por mudança de outra pessoa ---------- */
  function guardarValores() {
    const v = {};
    for (const el of corpo.querySelectorAll("form [name]")) v[el.name] = el.value;
    v.foco = document.activeElement && corpo.contains(document.activeElement) ? (document.activeElement.name || document.activeElement.dataset.buscar) : null;
    const ed = editorNotas();
    if (ed) v.notas = ed.innerHTML;
    return v;
  }
  function restaurarValores(v) {
    for (const el of corpo.querySelectorAll("form [name]")) if (el.name in v) el.value = v[el.name];
    if (v.foco) corpo.querySelector(`[name="${v.foco}"], [data-buscar="${v.foco}"]`)?.focus();
    const ed = editorNotas();
    if (ed && v.notas != null) ed.innerHTML = v.notas;
  }

  /* ---------- gravação dos editores ---------- */
  async function salvar(form) {
    const nome = form.dataset.salvar;
    const f = Object.fromEntries(new FormData(form));
    const erro = form.querySelector("[data-erro]");
    const tres = () => ({ o: Number(f.o === "" ? NaN : f.o), m: Number(f.m === "" ? NaN : f.m), p: Number(f.p === "" ? NaN : f.p) });
    const operacoes = {
      codigo: () => {
        const novo = normalizarCodigo(f.codigo);
        return store.alterarAcao(espacoId, numero, { codigo: novo || null });
      },
      rotulo: () => {
        if (!f.rotulo.trim()) throw new Error("Informe o rótulo da ação.");
        return store.alterarAcao(espacoId, numero, { rotulo: f.rotulo.trim() });
      },
      etapa: () => store.alterarAcao(espacoId, numero, { etapa: f.etapa || null }),
      descricao: () => store.alterarAcao(espacoId, numero, { descricao: f.descricao.trim() }),
      naoAntesDe: () => store.alterarAcao(espacoId, numero, { naoAntesDe: f.naoAntesDe || null }),
      estimativa: () => store.corrigirEstimativa(espacoId, numero, tres()),
      reestimar: () => store.reestimar(espacoId, numero, { ...tres(), motivo: f.motivo }),
      concluir: () => store.concluir(espacoId, numero, f.data),
      notas: () => store.alterarAcao(espacoId, numero, { notas: htmlParaMarkdown(form.querySelector("[data-editor-notas]")) }),
    };
    const mensagens = { reestimar: "Reestimativa registrada.", concluir: "Conclusão registrada. As ações seguintes foram recalculadas." };
    try {
      editando = null; // antes de gravar: a gravação redesenha a janela já sem o editor
      if (BLOCOS.includes(nome)) gravado = copiaDoFormulario(form);
      await operacoes[nome]();
      if (mensagens[nome]) avisar(mensagens[nome]);
    } catch (e) {
      gravado = null;
      editando = nome;
      desenhar();
      const novoErro = corpo.querySelector(`[data-salvar="${nome}"] [data-erro]`) ?? erro;
      for (const [k, val] of Object.entries(f)) { const el = corpo.querySelector(`[data-salvar="${nome}"] [name="${k}"]`); if (el) el.value = val; }
      novoErro.textContent = e.message;
      novoErro.hidden = false;
    }
  }

  /** Formulários que entram como um bloco novo (crescem); os demais editores substituem o valor (surgem). */
  const BLOCOS = ["reestimar", "concluir"];
  const botoesDaAcao = () => corpo.querySelector("[data-abrir-form]")?.closest(".botoes") ?? null;
  function editar(nome) {
    editando = nome;
    if (BLOCOS.includes(nome)) {
      /* os botões encolhem enquanto o formulário cresce no lugar deles */
      trocarSuave({ sai: botoesDaAcao(), redesenhar: desenhar, entra: () => corpo.querySelector(`[data-salvar="${nome}"]`), lado: "antes" });
    } else {
      desenhar();
      surgir(corpo.querySelector(`[data-salvar="${nome}"]`));
    }
    const ed = editorNotas();
    if (nome === "notas" && ed) {
      ed.focus();
      getSelection().selectAllChildren(ed);
      getSelection().collapseToEnd();
    } else {
      corpo.querySelector(`[data-salvar="${nome}"] [name]`)?.focus();
    }
  }
  function cancelar() {
    const nome = editando;
    editando = null;
    if (BLOCOS.includes(nome)) {
      /* o formulário encolhe enquanto os botões voltam a crescer */
      trocarSuave({ sai: corpo.querySelector(`[data-salvar="${nome}"]`), redesenhar: desenhar, entra: botoesDaAcao, lado: "depois" });
    } else {
      desenhar();
      surgir(corpo.querySelector(`[data-editar="${nome}"]`));
    }
    corpo.querySelector(`[data-editar="${nome}"], [data-abrir-form="${nome}"]`)?.focus();
  }

  /* ---------- eventos ---------- */
  corpo.addEventListener("click", async (e) => {
    const t = e.target;
    const campo = t.closest("[data-editar]");
    if (campo && !t.closest("a")) return editar(campo.dataset.editar);
    const form = t.closest("[data-abrir-form]");
    if (form) return editar(form.dataset.abrirForm);
    if (t.closest("[data-cancelar]")) return cancelar();
    if (t.closest("[data-excluir-acao]")) {
      try {
        if (await excluirAcao({ store, espacoId, acao: acaoAtual(), acoes: d.acoes })) fecharPainel();
      } catch (falha) { avisar(falha.message); }
      return;
    }
    const dep = t.closest("[data-tirar-dependencia]");
    if (dep) return executar(() => store.retirarDependencia(espacoId, numero, Number(dep.dataset.tirarDependencia)));
    const resp = t.closest("[data-tirar-responsavel]");
    if (resp) return executar(() => store.retirarResponsavelDaAcao(espacoId, numero, resp.dataset.tirarResponsavel));
    if (t.closest("[data-desfazer-conclusao]")) {
      return executar(() => store.desfazerConclusao(espacoId, numero), "Conclusão desfeita. A ação voltou a ser liberada.");
    }
    const fmt = t.closest("[data-formatar]");
    if (fmt) return formatar(fmt.dataset.formatar);
    if (t.closest("[data-aplicar-link]")) return aplicarLink();
    if (t.closest("[data-editor-notas] a")) e.preventDefault(); // no editor, o link é texto a editar, não para abrir
  });
  /* texto colado nas notas entra sem formatação (seção 8.5) */
  corpo.addEventListener("paste", (e) => {
    if (!e.target.closest("[data-editor-notas]")) return;
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  });
  /* os botões de formatação não podem tirar o foco do editor das notas */
  corpo.addEventListener("mousedown", (e) => { if (e.target.closest("[data-formatar]")) e.preventDefault(); });
  corpo.addEventListener("submit", (e) => { e.preventDefault(); salvar(e.target); });
  corpo.addEventListener("input", (e) => {
    const form = e.target.closest("form");
    const pert = form?.querySelector("[data-pert]");
    if (pert && ["o", "m", "p"].includes(e.target.name)) {
      const [o, m, p] = ["o", "m", "p"].map((k) => Number(form.querySelector(`[name="${k}"]`).value));
      pert.textContent = [o, m, p].every(Number.isInteger) && o >= 0 && o <= m && m <= p && p > 0 ? `Prazo previsto (PERT): ${diasUteis(duracaoPert({ o, m, p }))}` : "";
    }
  });
  corpo.addEventListener("keydown", (e) => {
    if (e.target.dataset.buscar) return; // o seletor cuida das teclas
    if (e.target.matches("[data-endereco-link]")) {
      if (e.key === "Enter") { e.preventDefault(); aplicarLink(); }
      if (e.key === "Escape") { e.preventDefault(); corpo.querySelector("[data-barra-link]").hidden = true; editorNotas()?.focus(); }
      return;
    }
    if (e.target.matches("[data-editor-notas]") && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); abrirBarraDeLink(); return; }
    if (e.key === "Escape" && editando) { e.preventDefault(); cancelar(); return; }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-editar]")) { e.preventDefault(); editar(e.target.dataset.editar); }
  });

  const seletores = ligarSeletores(corpo, {
    dependeDe: {
      opcoes: (texto) => opcoesDe("dependeDe", texto),
      vazio: "Nenhuma ação disponível. Ficam de fora a própria ação, as que já são anteriores e as que dependem dela.",
    },
    responsaveis: { opcoes: (texto) => opcoesDe("responsaveis", texto), vazio: "Digite um nome para buscar ou cadastrar." },
  }, { aoErro: (e) => avisar(e.message) });

  desenhar();
  return {
    /**
     * Novos dados do banco. Se outra pessoa alterou a ação, avisa por 10 segundos; os campos
     * em edição ficam como estão (guardarValores), e a pessoa decide se grava.
     */
    atualizar(novos) {
      if (fechada) return;
      const antes = acaoAtual();
      d = novos;
      const depois = acaoAtual();
      if (antes && depois && depois.alteradaEm !== antes.alteradaEm && depois.alteradaPor && depois.alteradaPor !== usuario) {
        alheia = d.responsaveis.find((r) => r.usuario === depois.alteradaPor)?.nome ?? depois.alteradaPor;
        clearTimeout(tempoAlheia);
        tempoAlheia = setTimeout(() => { alheia = null; if (!fechada) desenhar(); }, 10000);
      }
      desenhar();
      if (historicoAberto && antes?.alteradaEm !== depois?.alteradaEm) carregarHistorico();
    },
    fechar() { if (!fechada) fecharPainel(); },
  };
}
