/**
 * Janela da ação (documentação técnica, seções 5.3, 5.4 e 8.3; passo 1.7).
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
import { editarTexto } from "./edicao-no-lugar.js";
import { usaEstimativas, usaDependencias } from "../modelos.js";
import { termos } from "../vocabulario.js";
import { nomeInicial, nomeDoFluxo, personalizadasDe } from "../situacoes.js";
import { usaEtiquetas, etiquetasDe, etiquetasDaAcao, etiquetaPorNome, TAMANHO_DO_NOME } from "../etiquetas.js";
import { etiquetaHtml } from "./etiqueta-html.js";

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
  /** Campo em edição ("rotulo", "etapa", "descricao", "naoAntesDe", "dataLimite", "estimativa") ou formulário aberto ("reestimar", "concluir"). */
  let editando = abrirCom; // "concluir" quando a janela é aberta ao arrastar para Concluídas
  let fechada = false;
  /** Histórico de alterações (passo 1.16): lido do banco só quando a seção é aberta. */
  let registros = null;
  let historicoAberto = false;
  /** checklist aberto sem itens ainda ("Adicionar checklist"), e foco a devolver ao campo de novo item */
  let checklistAberto = false;
  let focoNoChecklist = false;

  const inicial = acaoAtual();
  const corpo = abrirPainel(d.usaCodigos && inicial?.codigo ? `${termos(d.espaco).Acao} ${inicial.codigo}` : termos(d.espaco).Acao, "", {
    janela: true,
    aoFechar: () => { fechada = true; pararComentarios?.(); aoFechar(); },
  });

  /* ---------- comentários (passo 2.9; seção 16.5): conversa da ação, em tempo real ---------- */
  /** null enquanto carrega; depois, a lista do banco (inclusive os apagados, que a tela resume) */
  let comentarios = null;
  let editandoComentario = null;
  let apagandoComentario = null;
  let pararComentarios = null;
  const nomeDoAutor = (email) => d.responsaveis.find((r) => r.usuario && r.usuario === email)?.nome ?? String(email).split("@")[0];
  const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  /** Texto do comentário: sem formatação; endereços da web viram links e as quebras de linha ficam. */
  const textoDoComentario = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  /** Aparece com duas ou mais pessoas com login no espaço, ou se já houver conversa (seção 16.5). */
  function comComentarios() {
    const pessoas = new Set(d.responsaveis.map((r) => r.usuario).filter(Boolean));
    if (usuario) pessoas.add(usuario);
    return pessoas.size >= 2 || Boolean(comentarios?.length);
  }
  function comentariosHtml() {
    if (!comComentarios()) return "";
    const lista = comentarios ?? [];
    const visiveis = lista.filter((c) => !c.apagadoEm).length;
    return `<section class="comentarios" aria-label="Comentários">
      <h3>Comentários${visiveis ? ` <span class="n">${visiveis}</span>` : ""}</h3>
      ${comentarios === null ? `<p class="vazio">Carregando…</p>` : lista.length ? `<ol class="conversa">${lista.map(comentarioHtml).join("")}</ol>`
        : `<p class="vazio">Nenhum comentário ainda.</p>`}
      ${usuario && d.perm.comentar ? `<form class="comentar" data-comentar>
          <textarea name="novoComentario" rows="2" maxlength="4000" placeholder="Escreva um comentário" aria-label="Novo comentário"></textarea>
          <div class="comentar-pe"><small class="tec">Ctrl+Enter envia. Quem consulta o espaço vê os comentários.</small>
            <button class="botao principal" type="submit">Comentar</button></div>
        </form>` : usuario ? `<p class="tec">Só quem tem papel neste espaço comenta.</p>` : `<p class="tec">Entre com seu e-mail e senha para comentar.</p>`}
    </section>`;
  }
  function comentarioHtml(c) {
    const meu = usuario && c.autor === usuario;
    if (c.apagadoEm) {
      return `<li class="comentario apagado"><span class="tec">Comentário apagado ${c.apagadoComo === "administrador" ? "pelo administrador do espaço" : "pelo autor"} em ${quando(c.apagadoEm)}.</span></li>`;
    }
    const cabeca = `<div class="comentario-cabeca"><b>${esc(nomeDoAutor(c.autor))}</b>
      <time datetime="${esc(c.criadoEm)}">${quando(c.criadoEm)}</time>
      ${c.editadoEm ? `<span class="editado" title="Editado em ${quando(c.editadoEm)}. As versões anteriores ficam guardadas.">editado</span>` : ""}</div>`;
    if (editandoComentario === c.id) {
      return `<li class="comentario${meu ? " meu" : ""}">${cabeca}
        <form class="comentar" data-editar-comentario="${esc(c.id)}">
          <textarea name="textoComentario" rows="3" maxlength="4000" aria-label="Texto do comentário">${esc(c.texto)}</textarea>
          <div class="comentar-pe"><small class="tec">A versão anterior fica guardada.</small>
            <span class="botoes"><button class="botao" type="button" data-cancelar-comentario>Cancelar</button><button class="botao principal" type="submit">Salvar</button></span></div>
        </form></li>`;
    }
    return `<li class="comentario${meu ? " meu" : ""}">${cabeca}
      <p class="comentario-texto">${textoDoComentario(c.texto)}</p>
      ${meu ? (apagandoComentario === c.id
        ? `<div class="comentario-acoes confirmar">Apagar este comentário? Ele some para todos.
            <button type="button" class="botao-texto perigo" data-confirmar-apagar="${esc(c.id)}">Apagar</button>
            <button type="button" class="botao-texto" data-cancelar-comentario>Cancelar</button></div>`
        : `<div class="comentario-acoes"><button type="button" class="botao-texto" data-editar-comentario-id="${esc(c.id)}">Editar</button>
            <button type="button" class="botao-texto" data-apagar-comentario="${esc(c.id)}">Apagar</button></div>`)
      /* o administrador do espaço também apaga (esconde) comentários alheios (passo 2.1; seção 16.5) */
      : d.perm.apagarComentarioAlheio && store.podeGravar ? (apagandoComentario === c.id
        ? `<div class="comentario-acoes confirmar">Apagar este comentário de outra pessoa? Ele some para todos, com o aviso "apagado pelo administrador do espaço".
            <button type="button" class="botao-texto perigo" data-confirmar-apagar="${esc(c.id)}">Apagar</button>
            <button type="button" class="botao-texto" data-cancelar-comentario>Cancelar</button></div>`
        : `<div class="comentario-acoes"><button type="button" class="botao-texto" data-apagar-comentario="${esc(c.id)}">Apagar</button></div>`) : ""}
    </li>`;
  }
  /** Redesenha só a conversa (sem perder o que está sendo digitado nela). */
  function desenharComentarios() {
    const alvo = corpo.querySelector("[data-comentarios]");
    if (!alvo) return;
    const rascunho = alvo.querySelector('[name="novoComentario"]')?.value ?? "";
    const comFoco = document.activeElement?.name === "novoComentario";
    alvo.innerHTML = comentariosHtml();
    const caixa = alvo.querySelector('[name="novoComentario"]');
    if (caixa) { caixa.value = rascunho; if (comFoco) caixa.focus(); }
    const edicao = alvo.querySelector('[name="textoComentario"]');
    if (edicao && document.activeElement !== edicao) { edicao.focus(); edicao.setSelectionRange(edicao.value.length, edicao.value.length); }
  }
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
  /*
   * Revisão de 23/10/2026 (pedido do responsável):
   * - duas colunas no computador (dados à esquerda; atividade, com comentários e históricos, à direita),
   *   e abas "Detalhes" e "Atividade" no celular;
   * - os campos gravam ao sair deles, sem Salvar nem Cancelar; Esc desfaz o que foi digitado;
   * - busca de dependências e responsáveis só ao tocar em "+ Acrescentar"; campos vazios recolhidos em
   *   "Mais campos"; a etapa aparece uma vez, no título da janela, que deixou de dizer só "Ação".
   */
  /** busca aberta: "dependeDe", "responsaveis" ou null */
  let buscando = null;
  /** documento em edição na janela (passo 2.10a): id, "novo" ou null */
  let editandoDoc = null;
  /** campos opcionais abertos em "Mais campos", mesmo vazios */
  const mostrados = new Set();
  /** aba no celular: "detalhes" ou "atividade" */
  let aba = "detalhes";
  /** situação da última gravação de um campo: {campo, tipo: "salvando"|"salvo"|"erro", texto} */
  let status = null;
  let tempoStatus = null;
  /* papéis (passo 2.1): o Leitor, quem não tem papel e, no espaço fechado, o Usuário nas ações dos outros só consultam */
  const somenteLeitura = () => !store.podeGravar || !d.perm.atualizar(acaoAtual());

  function desenhar() {
    const acao = acaoAtual();
    if (!acao) { fecharPainel(); return; }
    const l = d.linhaDe.get(numero);
    const c = d.caminho.porAcao.get(numero);
    const [sitTexto, sitIcone, sitClasse] = SITUACOES[l.situacao];
    const etapas = (d.espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => ({ ...e, fase: f.nome })));
    const etapa = etapas.find((e) => e.id === acao.etapa);
    const pend = l.situacao === "naoLiberada" ? pendencias(acao, d.acoes, hoje) : null;
    const resumoEst = resumoDasEstimativas(acao, c);
    const revisao = l.revisao == null ? null : l.revisao < 0.01 ? "<1%" : `${Math.round(l.revisao * 100)}%`;
    const comEstimativas = usaEstimativas(d.espaco);
    const visiveis = (comentarios ?? []).filter((x) => !x.apagadoEm).length;

    const valores = guardarValores();
    corpo.innerHTML = `
      <div class="janela-abas" role="tablist" aria-label="Partes da ação">
        <button type="button" role="tab" data-aba="detalhes" aria-selected="${aba === "detalhes"}">Detalhes</button>
        <button type="button" role="tab" data-aba="atividade" aria-selected="${aba === "atividade"}">Atividade${visiveis ? ` <span class="n">${visiveis}</span>` : ""}</button>
      </div>
      <div class="janela-grade" data-aba-atual="${aba}">
        <div class="janela-principal">
          ${alheia ? `<p class="alteracao-alheia" role="status">${esc(alheia)} alterou esta ação agora.</p>` : ""}
          <div class="campo-acao campo-nome-acao" data-campo="rotulo">
            <textarea class="janela-nome" rows="1" maxlength="120" name="rotulo" data-auto="rotulo" data-original="${esc(acao.rotulo)}"
              aria-label="Nome da ${termos(d.espaco).acao}"${somenteLeitura() ? " readonly" : ""}>${esc(acao.rotulo)}</textarea>
            ${statusHtml("rotulo")}
          </div>

          <dl class="janela-resumo">
            <div><dt>Situação</dt><dd class="sit">${situacaoHtml(l, sitClasse, sitIcone, sitTexto)}${l.atrasada ? `<span class="carimbo"><span class="icone-atrasada">${ICONES.atrasada}</span>Atrasada</span>` : ""}</dd></div>
            ${!comEstimativas && l.situacao !== "concluida" ? `<div><dt>Data-limite</dt><dd class="mono${l.atrasada ? " atrasada" : ""}">${acao.dataLimite ? dataBr(acao.dataLimite) : '<span class="vazio">Sem data-limite</span>'}</dd></div>`
            : `<div><dt>${l.situacao === "concluida" ? "Concluída em" : "Conclusão prevista"}</dt>${l.semEstimativa ? `<dd><span class="falta-estimar">Falta estimar</span></dd>` : `<dd class="mono${l.atrasada ? " atrasada" : ""}">${dataBr(l.conclusao)}</dd>`}</div>`}
            ${l.situacao === "concluida" || l.execucao == null ? "" : `
              <div><dt>Índice de criticidade <a href="#" class="oque" data-termo="exec" aria-label="O que é o índice de criticidade?" title="O que é?">${ICONES.ajuda}</a></dt><dd>${barra(l.execucao, "var(--execucao)", `${Math.round(l.execucao * 100)}%`)}</dd></div>
              <div><dt>Contribuição para a incerteza <a href="#" class="oque" data-termo="rev" aria-label="O que é a contribuição para a incerteza?" title="O que é?">${ICONES.ajuda}</a></dt><dd>${barra(l.revisao, "var(--laranja)", revisao)}</dd></div>`}
          </dl>

          ${c.regraDoPassado ? `<p class="alerta">${ICONES.atrasada}<span><b>Prazo vencido sem reestimativa:</b> o cálculo considera conclusão a partir de hoje. Reestime a ação para informar quanto falta. <a href="#" class="oque" data-termo="regra">o que é?</a></span></p>` : ""}
          ${pend && (pend.anteriores.length || pend.dataMinima) ? `<p class="nota-janela">Será liberada ${[
            pend.anteriores.length ? `quando ${plural(pend.anteriores.length, "for concluída a ação", "forem concluídas as ações")} ${pend.anteriores.map((n) => `“${esc(nomeTexto(d.acoes.find((a) => a.numero === n)))}”`).join(", ")}` : "",
            pend.dataMinima ? `a partir de ${dataBr(pend.dataMinima)}` : "",
          ].filter(Boolean).join(", e ")}.</p>` : ""}

          ${botoesHtml(l, c)}
          ${editando === "reestimar" ? reestimativaHtml() : ""}
          ${editando === "concluir" ? conclusaoHtml(acao) : ""}

          <div class="janela-campos">${camposHtml(acao, l, etapas, etapa)}</div>
          ${maisCamposHtml(acao)}
          ${store.podeGravar && d.perm.excluirAcao ? `<div class="zona-exclusao"><button class="botao-excluir" type="button" data-excluir-acao>Excluir ${termos(d.espaco).acao}</button></div>` : ""}
        </div>

        <div class="janela-atividade" aria-label="Atividade">
          <div data-comentarios>${comentariosHtml()}</div>
          ${comEstimativas ? historicoHtml(acao, resumoEst) : ""}
          <details class="historico alteracoes" data-historico${historicoAberto ? " open" : ""}>
            <summary><h3>Histórico de alterações</h3></summary>
            <div data-registros>${registrosHtml()}</div>
          </details>
        </div>
      </div>`;
    /* título da janela: onde a ação fica (fase e etapa) e o código, em vez de só "Ação" */
    const titulo = [d.usaCodigos && acao.codigo ? acao.codigo : "", d.usaFases ? (etapa ? `${etapa.fase} · ${etapa.nome}` : "Sem fase nem etapa") : ""]
      .filter(Boolean).join(" · ") || termos(d.espaco).Acao;
    const cabeca = corpo.closest(".painel").querySelector("header h2");
    cabeca.textContent = titulo;
    cabeca.title = titulo;
    corpo.closest(".painel").style.setProperty("--calor", l.situacao === "concluida" ? "var(--ok)" : l.execucao == null ? "var(--neutral)"
      : `color-mix(in oklab, var(--crit) ${Math.round(l.execucao * 100)}%, var(--neutral))`);
    restaurarValores(valores);
    ajustarAlturas();
    if (focoNoChecklist) { focoNoChecklist = false; corpo.querySelector('[name="novoItemChecklist"]')?.focus(); }
    seletores.desenhar();
    encolherFormularioGravado();
  }

  /**
   * Situação (passo 2.7): na ação liberada de um espaço com situações personalizadas, uma lista para
   * escolher a inicial ou uma personalizada, que grava na hora; nas demais, o nome e o ícone.
   */
  function situacaoHtml(l, classe, icone, texto) {
    const nome = l.situacao === "liberada" ? nomeDoFluxo(d.espaco, l.fluxo) : texto;
    const ic = l.situacao === "liberada" && l.fluxo !== "inicial" ? "personalizada" : icone;
    if (l.situacao !== "liberada" || !personalizadasDe(d.espaco).length || somenteLeitura()) {
      return `<span class="${classe}">${ICONES[ic]}</span>${esc(nome)}`;
    }
    return `<span class="${classe}">${ICONES[ic]}</span><select class="escolha-situacao" data-mudar-situacao aria-label="Situação">
      <option value=""${l.fluxo === "inicial" ? " selected" : ""}>${esc(nomeInicial(d.espaco))}</option>
      ${personalizadasDe(d.espaco).map((x) => `<option value="${esc(x.id)}"${l.fluxo === x.id ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}
    </select>`;
  }

  /** Caixas de texto crescem com o conteúdo (nome da ação e descrição). */
  function ajustarAlturas(alvo = corpo) {
    for (const el of alvo.querySelectorAll("textarea.cresce, textarea.janela-nome")) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + 2}px`;
    }
  }

  /** "Salvando…", "Salvo" ou o erro, ao lado do nome do campo. */
  function statusHtml(campo) {
    if (!status || status.campo !== campo) return `<span class="status-campo" data-status="${campo}" aria-live="polite"></span>`;
    return `<span class="status-campo ${status.tipo}" data-status="${campo}" aria-live="polite">${status.tipo === "salvo" ? `${ICONES.marcado}Salvo` : esc(status.texto)}</span>`;
  }

  /** Rótulo do campo, com a situação da gravação. */
  const rotuloHtml = (campo, texto, dica = "") => `<span class="campo-nome"><span>${texto}</span>${dica ? ` <a href="#" class="oque" data-termo="${dica}" aria-label="O que é?" title="O que é?">${ICONES.ajuda}</a>` : ""}${statusHtml(campo)}</span>`;

  const atributos = (campo, valor) => `name="${campo}" data-auto="${campo}" data-original="${esc(valor ?? "")}"${somenteLeitura() ? " disabled" : ""}`;

  /** Campos que aparecem: os que têm valor, os essenciais e os abertos em "Mais campos". */
  function visivel(acao, campo) {
    if (mostrados.has(campo)) return true;
    if (campo === "descricao") return Boolean(acao.descricao);
    if (campo === "naoAntesDe") return Boolean(acao.naoAntesDe);
    if (campo === "codigo") return Boolean(acao.codigo);
    if (campo === "notas") return Boolean(acao.notas);
    if (campo === "checklist") return Boolean(acao.checklist?.length) || checklistAberto;
    if (campo === "etiquetas") return Boolean(acao.etiquetas?.length);
    if (campo === "justificativa") return Boolean(acao.justificativa);
    if (campo === "local") return Boolean(acao.local);
    if (campo === "entregaDoPlano") return Boolean(acao.entregaDoPlano);
    if (campo === "documentos") return Boolean(acao.documentos?.length) || editandoDoc != null;
    return true;
  }
  /** Campos opcionais que o espaço usa, na ordem de "Mais campos". */
  function opcionais() {
    const campos = d.espaco.camposOpcionais ?? {};
    return [
      campos.descricao !== false && ["descricao", "Descrição"],
      ["naoAntesDe", "Não começa antes de"],
      !somenteLeitura() && ["checklist", "Checklist"],
      campos.notas !== false && ["notas", "Anotações"],
      d.usaCodigos && ["codigo", "Código"],
      campos.justificativa === true && ["justificativa", "Justificativa"],
      campos.local === true && ["local", "Local"],
      usaEtiquetas(d.espaco) && ["etiquetas", "Etiquetas"],
      campos.documentos === true && ["documentos", "Documentos e links"],
      d.entregas?.length && ["entregaDoPlano", "Entrega do Plano de Ação"],
    ].filter(Boolean);
  }
  function maisCamposHtml(acao) {
    if (somenteLeitura()) return "";
    const fechados = opcionais().filter(([campo]) => !visivel(acao, campo));
    if (!fechados.length) return "";
    return `<div class="chips-campos mais-campos" role="group" aria-label="Mais campos"><span class="tec">Mais campos:</span>
      ${fechados.map(([campo, texto]) => `<button type="button" class="chip-campo" data-mostrar-campo="${campo}">${ICONES.mais}${texto}</button>`).join("")}</div>`;
  }

  function camposHtml(acao, l, etapas, etapa) {
    const campos = d.espaco.camposOpcionais ?? {};
    const contexto = { tons: d.espaco.tons, meus: d.meus };
    const donos = acao.responsaveis.map((id) => d.pessoas.get(id)).filter(Boolean);
    const comEstimativas = usaEstimativas(d.espaco);
    const livre = estimativaLivre(acao, l.situacao, hoje);
    const partes = [];

    if (d.usaFases) {
      partes.push(`<div class="campo-acao" data-campo="etapa">${rotuloHtml("etapa", "Etapa")}
        <select ${atributos("etapa", acao.etapa)} aria-label="Etapa"><option value="">Sem fase nem etapa</option>${(d.espaco.estrutura ?? []).map((f) =>
          `<optgroup label="${esc(f.nome)}">${f.etapas.map((e) => `<option value="${esc(e.id)}"${e.id === acao.etapa ? " selected" : ""}>${esc(e.nome)}</option>`).join("")}</optgroup>`).join("")}</select></div>`);
    }

    /* prazo: estimativa (enquanto livre) ou data-limite, conforme o modelo do espaço (passo 2.4b) */
    if (!comEstimativas) {
      partes.push(`<div class="campo-acao" data-campo="dataLimite">${rotuloHtml("dataLimite", "Data-limite")}
        <input type="date" ${atributos("dataLimite", acao.dataLimite)} value="${esc(acao.dataLimite ?? "")}" aria-label="Data-limite">
        <span class="tec">Vencida, a ação ganha o carimbo Atrasada. Vazia, a ação não tem prazo.</span></div>`);
    } else if (livre) {
      const e = acao.estimativas?.at(-1);
      const v = (k) => (e?.[k] ?? "");
      partes.push(`<div class="campo-acao" data-campo="estimativa">${rotuloHtml("estimativa", "Estimativa <small>(dias úteis)</small>")}
        <div class="tres-pontos">${[["o", "Otimista"], ["m", "Mais provável"], ["p", "Pessimista"]].map(([k, t]) =>
          `<label class="campo"><span>${t}</span><input name="${k}" data-auto="estimativa" data-original="${v(k)}" type="number" min="0" step="1" inputmode="numeric" value="${v(k)}"${somenteLeitura() ? " disabled" : ""}></label>`).join("")}</div>
        <span class="tec" data-pert>${e ? `Prazo previsto (PERT): ${diasUteis(duracaoPert(e))}. ` : "Sem estimativa: a ação fica com “Falta estimar”. "}${l.situacao === "naoLiberada" || !acao.estimativas?.length
          ? "Enquanto a ação não é liberada, a estimativa muda livremente."
          : "Correção de digitação: vale só hoje, antes de qualquer reestimativa."}</span></div>`);
    } else {
      const e = acao.estimativas?.at(-1);
      partes.push(`<div class="campo-acao" data-campo="estimativa">${rotuloHtml("estimativa", "Estimativa <small>(dias úteis)</small>")}
        <span>${e ? `<span class="mono">${decimal(e.o)} · ${decimal(e.m)} · ${decimal(e.p)}</span> <span class="tec">otimista · mais provável · pessimista</span>` : `<span class="falta-estimar">Falta estimar</span>`}</span>
        <span class="tec">${l.situacao === "concluida" ? "A ação foi concluída." : "Liberada: a estimativa muda por “Reestimar”."}</span></div>`);
    }

    partes.push(`<div class="campo-acao" data-campo="responsaveis">${rotuloHtml("responsaveis", "Responsáveis")}
      <div class="etiquetas">${donos.map((r) =>
        `<span class="etiqueta">${seloHtml(r, contexto)}${esc(r.nome)}${somenteLeitura() ? "" : `<button type="button" class="tirar" data-tirar-responsavel="${esc(r.id)}" aria-label="Retirar ${esc(r.nome)}">${ICONES.fechar}</button>`}</span>`).join("")
        || `<span class="vazio">Nenhum responsável.</span>`}
        ${somenteLeitura() || buscando === "responsaveis" ? "" : `<button type="button" class="chip-campo" data-buscar-abrir="responsaveis">${ICONES.mais}Acrescentar</button>`}</div>
      ${buscando === "responsaveis" ? seletorHtml("responsaveis", "Digite o nome, a sigla ou o setor") : ""}</div>`);

    if (usaDependencias(d.espaco)) {
      partes.push(`<div class="campo-acao" data-campo="dependeDe">${rotuloHtml("dependeDe", "Depende de")}
        <div class="etiquetas">${(acao.dependeDe ?? []).map((n) => {
          const a = d.acoes.find((x) => x.numero === n);
          return `<span class="etiqueta">${a ? nomeHtml(a) : "(ação excluída)"}${somenteLeitura() ? "" : `<button type="button" class="tirar" data-tirar-dependencia="${n}" aria-label="Retirar ${esc(a ? nomeTexto(a) : "")}">${ICONES.fechar}</button>`}</span>`;
        }).join("") || `<span class="vazio">Nenhuma: pode começar no início do espaço.</span>`}
          ${somenteLeitura() || buscando === "dependeDe" ? "" : `<button type="button" class="chip-campo" data-buscar-abrir="dependeDe">${ICONES.mais}Acrescentar</button>`}</div>
        ${buscando === "dependeDe" ? seletorHtml("dependeDe", d.usaCodigos ? "Digite o nome ou o código da ação anterior" : "Digite o nome da ação anterior") : ""}
        ${confirmarAnteriorHtml()}</div>`);
    }

    if (campos.descricao !== false && visivel(acao, "descricao")) {
      partes.push(`<div class="campo-acao" data-campo="descricao">${rotuloHtml("descricao", "Descrição")}
        <textarea class="cresce" rows="2" ${atributos("descricao", acao.descricao)} aria-label="Descrição" placeholder="O que é esta ação, em poucas linhas">${esc(acao.descricao ?? "")}</textarea></div>`);
    }
    /* justificativa e local, do 5W2H (passo 2.10a): textos simples, gravados ao sair do campo */
    if (campos.justificativa === true && visivel(acao, "justificativa")) {
      partes.push(`<div class="campo-acao" data-campo="justificativa">${rotuloHtml("justificativa", "Justificativa")}
        <textarea class="cresce" rows="2" ${atributos("justificativa", acao.justificativa)} aria-label="Justificativa" placeholder="Por que esta ação existe">${esc(acao.justificativa ?? "")}</textarea></div>`);
    }
    if (campos.local === true && visivel(acao, "local")) {
      partes.push(`<div class="campo-acao" data-campo="local">${rotuloHtml("local", "Local")}
        <input maxlength="200" ${atributos("local", acao.local)} value="${esc(acao.local ?? "")}" aria-label="Local" placeholder="Onde a ação acontece"></div>`);
    }
    /* entrega do Plano de Ação a que a ação contribui (passo 2.6): opcional e discreta, em "Mais campos" */
    if (d.entregas && (d.entregas.length || acao.entregaDoPlano) && visivel(acao, "entregaDoPlano")) {
      const atual = acao.entregaDoPlano ?? "";
      const existe = !atual || d.entregas.some((x) => x.id === atual);
      partes.push(`<div class="campo-acao" data-campo="entregaDoPlano">${rotuloHtml("entregaDoPlano", "Entrega do Plano de Ação", "entrega")}
        <select ${atributos("entregaDoPlano", atual)} aria-label="Entrega do Plano de Ação">
          <option value="">Nenhuma</option>
          ${existe ? "" : `<option value="${esc(atual)}" selected>(entrega excluída)</option>`}
          ${d.entregas.map((x) => `<option value="${esc(x.id)}"${x.id === atual ? " selected" : ""}>${esc(x.titulo)}</option>`).join("")}
        </select>
        <span class="tec">O resultado do plano para o qual esta ação contribui.</span></div>`);
    }
    if (visivel(acao, "naoAntesDe")) {
      partes.push(`<div class="campo-acao" data-campo="naoAntesDe">${rotuloHtml("naoAntesDe", "Não começa antes de", "naoAntesDe")}
        <input type="date" ${atributos("naoAntesDe", acao.naoAntesDe)} value="${esc(acao.naoAntesDe ?? "")}" aria-label="Não começa antes de">
        <span class="tec">Data mínima para a ação ser liberada, mesmo que as anteriores já tenham terminado.</span></div>`);
    }
    if (d.usaCodigos && visivel(acao, "codigo")) {
      partes.push(`<div class="campo-acao" data-campo="codigo">${rotuloHtml("codigo", "Código")}
        <input class="mono" maxlength="12" autocomplete="off" autocapitalize="characters" ${atributos("codigo", acao.codigo)} value="${esc(acao.codigo ?? "")}" aria-label="Código">
        <span class="tec">De 2 a 8 letras ou números, sem repetir no espaço. Vazio: sem código.</span></div>`);
    }
    /* etiquetas (passo 2.10a): como os responsáveis, com busca que também cria a etiqueta */
    if (usaEtiquetas(d.espaco) && visivel(acao, "etiquetas")) {
      partes.push(`<div class="campo-acao" data-campo="etiquetas">${rotuloHtml("etiquetas", "Etiquetas")}
        <div class="etiquetas">${etiquetasDaAcao(d.espaco, acao).map((x) => etiquetaHtml(x, somenteLeitura() ? ""
          : `<button type="button" class="tirar" data-tirar-etiqueta="${esc(x.id)}" aria-label="Retirar ${esc(x.nome)}">${ICONES.fechar}</button>`)).join("")
          || `<span class="vazio">Nenhuma etiqueta.</span>`}
          ${somenteLeitura() || buscando === "etiquetas" ? "" : `<button type="button" class="chip-campo" data-buscar-abrir="etiquetas">${ICONES.mais}Acrescentar</button>`}</div>
        ${buscando === "etiquetas" ? seletorHtml("etiquetas", "Digite o nome da etiqueta") : ""}</div>`);
    }
    if (campos.documentos === true && visivel(acao, "documentos")) partes.push(documentosHtml(acao));
    if (visivel(acao, "checklist")) partes.push(checklistHtml(acao));
    if (campos.notas !== false && visivel(acao, "notas")) partes.push(notasHtml(acao));
    return partes.join("");
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
    if (somenteLeitura()) return "";
    if (l.situacao === "concluida") {
      return `<div class="botoes"><button class="botao" type="button" data-desfazer-conclusao>Desfazer conclusão</button></div>`;
    }
    if (l.situacao !== "liberada" || editando === "reestimar" || editando === "concluir") return "";
    return `<div class="botoes">
      ${usaEstimativas(d.espaco) ? `<button class="botao${l.atrasada || c.regraDoPassado ? " principal" : ""}" type="button" data-abrir-form="reestimar">Reestimar</button>` : ""}
      <button class="botao${l.atrasada && usaEstimativas(d.espaco) ? "" : " principal"}" type="button" data-abrir-form="concluir">${ICONES.concluida}Registrar conclusão</button>
    </div>`;
  }

  /** Notas: mostradas já formatadas; ao clicar, editor visual com negrito, itálico, link e lista (seção 8.5). */
  /**
   * Checklist (passo 2.8; seção 16.5): não ocupa espaço até "Adicionar checklist". Cada item muda
   * sozinho, na hora, sem Salvar: marcar, mudar o texto (clique nele) ou retirar (×).
   */
  function checklistHtml(acao) {
    const itens = acao.checklist ?? [];
    const pode = !somenteLeitura();
    if (!itens.length && !checklistAberto) {
      return pode ? `<div class="campo-acao"><span class="campo-nome">Checklist</span>
        <button type="button" class="botao-texto" data-abrir-checklist>${ICONES.mais}Adicionar checklist</button></div>` : "";
    }
    const feitos = itens.filter((i) => i.feito).length;
    return `<div class="campo-acao checklist">
      <span class="campo-nome">Checklist${itens.length ? ` <span class="checklist-progresso">${feitos}/${itens.length}</span>` : ""}</span>
      ${itens.length ? `<span class="checklist-barra" aria-hidden="true"><i style="width:${Math.round((100 * feitos) / itens.length)}%"></i></span>` : ""}
      <ul class="checklist-itens">${itens.map((i) => `<li class="${i.feito ? "feito" : ""}">
        <input type="checkbox" data-marcar-item="${esc(i.id)}"${i.feito ? " checked" : ""}${pode ? "" : " disabled"} aria-label="${esc(i.texto)}">
        <span class="checklist-texto"${pode ? ` data-texto-item="${esc(i.id)}" tabindex="0" title="Clique para mudar o texto"` : ""}>${esc(i.texto)}</span>
        ${pode ? `<button type="button" class="tirar" data-tirar-item="${esc(i.id)}" aria-label="Retirar ${esc(i.texto)}">${ICONES.fechar}</button>` : ""}</li>`).join("")}</ul>
      ${pode ? `<form class="checklist-novo" data-checklist-form><input name="novoItemChecklist" maxlength="200" autocomplete="off"
        placeholder="Novo item: escreva e tecle Enter" aria-label="Novo item do checklist"></form>` : ""}
    </div>`;
  }

  /**
   * Documentos e links da ação (passo 2.10a; seção 4.2.4): cada um com o nome (que abre o link), a
   * identificação no SIPAC/Protocolo e a data; "Editar" e × em cada um; "+ Documento" abre um
   * formulário curto, com Salvar e Cancelar (Esc), porque um documento tem vários campos.
   */
  function documentosHtml(acao) {
    const docs = acao.documentos ?? [];
    const pode = !somenteLeitura();
    const formulario = (doc = {}) => `<form class="form-documento" data-form-documento="${esc(doc.id ?? "")}">
      <input name="nome" maxlength="120" value="${esc(doc.nome ?? "")}" placeholder="Nome, como “Termo de referência”" aria-label="Nome do documento" required>
      <div class="campos-lado-a-lado">
        <input name="identificacao" value="${esc(doc.identificacao ?? "")}" placeholder="Nº no SIPAC/Protocolo" aria-label="Identificação no SIPAC/Protocolo">
        <input type="date" name="data" value="${esc(doc.data ?? "")}" aria-label="Data do documento">
      </div>
      <input type="url" name="link" value="${esc(doc.link ?? "")}" placeholder="https://…" aria-label="Link">
      <div class="botoes"><button class="botao principal" type="submit">Salvar</button><button class="botao" type="button" data-cancelar-documento>Cancelar</button>
        <span class="tec">Informe a identificação, o link ou os dois.</span></div>
    </form>`;
    return `<div class="campo-acao" data-campo="documentos">${rotuloHtml("documentos", "Documentos e links")}
      <ul class="documentos-acao">${docs.map((doc) => editandoDoc === doc.id ? `<li>${formulario(doc)}</li>` : `<li>
        <span class="documento-nome">${doc.link && linkSeguro(doc.link) ? `<a href="${esc(doc.link)}" target="_blank" rel="noopener noreferrer">${esc(doc.nome)}</a>` : esc(doc.nome)}
          ${[doc.identificacao, doc.data ? dataBr(doc.data) : ""].filter(Boolean).length ? `<small class="tec">${esc([doc.identificacao, doc.data ? dataBr(doc.data) : ""].filter(Boolean).join(" · "))}</small>` : ""}</span>
        ${pode && editandoDoc == null ? `<span class="documento-botoes"><button type="button" class="botao-texto" data-editar-documento="${esc(doc.id)}">Editar</button>
          <button type="button" class="tirar" data-tirar-documento="${esc(doc.id)}" aria-label="Retirar ${esc(doc.nome)}">${ICONES.fechar}</button></span>` : ""}
      </li>`).join("")}</ul>
      ${editandoDoc === "novo" ? formulario() : pode && editandoDoc == null ? `<button type="button" class="chip-campo" data-novo-documento>${ICONES.mais}Documento</button>` : ""}
    </div>`;
  }
  async function salvarDocumento(form) {
    const dados = Object.fromEntries(["nome", "identificacao", "data", "link"].map((k) => [k, form.elements[k].value]));
    const id = form.dataset.formDocumento;
    const ok = await executar(() => (id ? store.alterarDocumentoDaAcao(espacoId, numero, id, dados) : store.acrescentarDocumentoNaAcao(espacoId, numero, dados)),
      id ? "Documento alterado." : "Documento acrescentado.");
    if (ok) { editandoDoc = null; desenhar(); }
  }

  function notasHtml(acao) {
    const html = markdownParaHtml(acao.notas);
    if (somenteLeitura()) {
      return `<div class="campo-acao" data-campo="notas">${rotuloHtml("notas", "Anotações")}<div class="nota-html">${html || `<span class="vazio">Sem anotações.</span>`}</div></div>`;
    }
    /* sempre editável; a barra de formatação aparece com o cursor dentro; grava ao sair (revisão de 23/10/2026) */
    return `<div class="campo-acao campo-notas" data-campo="notas">${rotuloHtml("notas", "Anotações")}
      <div class="editor-notas-caixa" data-caixa-notas>
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
        <div class="editor-notas nota-html" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Anotações"
          data-editor-notas data-vazio="Escreva aqui. Grava ao sair do campo.">${html}</div>
      </div></div>`;
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

  function reestimativaHtml() {
    return `<form class="editor cartao-form" data-salvar="reestimar">
      <h3>Reestimar</h3>
      <p class="tec">Quanto tempo falta, <b>a partir de hoje</b>, em dias úteis. A estimativa anterior fica no histórico.</p>
      ${tresPontosHtml(null)}
      <label class="campo"><span>Motivo <small>(opcional)</small></span><input name="motivo" maxlength="200" placeholder="Por exemplo: atraso do fornecedor"></label>
      <p class="erro" data-erro hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">Salvar reestimativa</button><button class="botao" type="button" data-cancelar>Cancelar</button></div>
    </form>`;
  }

  function conclusaoHtml(acao) {
    return `<form class="editor cartao-form" data-salvar="concluir">
      <h3>Registrar conclusão</h3>
      <label class="campo"><span>Data de conclusão</span><input name="data" type="date" value="${hoje}" max="${hoje}" min="${esc(d.espaco.inicio ?? "")}"></label>
      <p class="erro" data-erro hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">Registrar</button><button class="botao" type="button" data-cancelar>Cancelar</button></div>
    </form>`;
  }

  function historicoHtml(acao, resumo) {
    const lista = acao.estimativas ?? [];
    if (!lista.length) return `<section class="historico"><h3>Histórico de estimativas</h3><p class="vazio">Sem estimativa.</p></section>`;
    const nomeDe = (usuario) => d.responsaveis.find((r) => r.usuario && r.usuario === usuario)?.nome ?? usuario;
    const andou = resumo.deslocamento;
    return `<section class="historico">
      <h3>Histórico de estimativas</h3>
      <p class="tec">Original: ${diasUteis(resumo.original)} · ${resumo.reprogramacoes} ${plural(resumo.reprogramacoes, "reprogramação", "reprogramações")}${resumo.reprogramacoes || andou ? ` · o término ${andou > 0 ? `atrasou ${diasUteis(andou)}` : andou < 0 ? `adiantou ${diasUteis(-andou)}` : "não mudou"}` : ""}</p>
      <ol>${lista.map((e, i) => `<li${i === lista.length - 1 ? ' class="vigente"' : ""}>
        <span class="historico-quem"><span class="mono">${dataBr(e.em)}</span>${e.por ? ` · ${esc(nomeDe(e.por))}` : ""}${i === lista.length - 1 ? ` <span class="selo-vigente">vigente</span>` : ""}</span>
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
      situacao: (id) => personalizadasDe(d.espaco).find((x) => x.id === id)?.nome ?? "situação retirada",
      etiqueta: (id) => etiquetasDe(d.espaco).find((x) => x.id === id)?.nome ?? "etiqueta retirada",
      entrega: (id) => d.entregas?.find((x) => x.id === id)?.titulo ?? "entrega excluída",
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
  /**
   * Nova anterior ainda não concluída numa ação em situação personalizada (passo 2.7; seção 16.2):
   * antes de gravar, avisa que a ação vai para Não liberada e sai da situação atual.
   */
  let anteriorPendente = null;
  async function acrescentarAnterior(a) {
    const l = d.linhaDe.get(numero);
    if (!a.concluidaEm && l?.situacao === "liberada" && l.fluxo !== "inicial") {
      anteriorPendente = a.numero;
      buscando = null;
      return desenhar();
    }
    return store.acrescentarDependencia(espacoId, numero, a.numero);
  }
  function confirmarAnteriorHtml() {
    if (anteriorPendente == null) return "";
    const a = d.acoes.find((x) => x.numero === anteriorPendente);
    const l = d.linhaDe.get(numero);
    if (!a) { anteriorPendente = null; return ""; }
    return `<div class="aviso-confirmar" role="alertdialog" aria-label="Confirmar a nova dependência">
      <p>“${esc(nomeTexto(a))}” ainda não foi concluída. Com ela como anterior, esta ação passa para <b>Não liberada</b> e sai de <b>${esc(nomeDoFluxo(d.espaco, l.fluxo))}</b>. Quando a anterior terminar, ela volta para ${esc(nomeInicial(d.espaco))}.</p>
      <div class="botoes"><button class="botao principal" type="button" data-confirmar-anterior>Acrescentar assim mesmo</button>
        <button class="botao" type="button" data-desistir-anterior>Desistir</button></div></div>`;
  }

  /** Etiquetas do espaço que a ação ainda não tem, e "Criar etiqueta" para um nome novo (passo 2.10a). */
  function opcoesDeEtiquetas(texto) {
    const acao = acaoAtual();
    const ja = new Set(acao.etiquetas ?? []);
    const achadas = buscar(etiquetasDe(d.espaco).filter((x) => !ja.has(x.id)), texto, (x) => [x.nome]).slice(0, MAX_SUGESTOES)
      .map((x) => ({ html: etiquetaHtml(x), escolher: () => store.acrescentarEtiquetaNaAcao(espacoId, numero, x.id) }));
    const nome = texto.trim();
    if (nome && !etiquetaPorNome(d.espaco, nome)) {
      achadas.push(nome.length > TAMANHO_DO_NOME
        ? { html: `<span class="tec">O nome passa de ${TAMANHO_DO_NOME} caracteres.</span>`, escolher: () => {} }
        : { html: `${ICONES.mais} Criar a etiqueta “${esc(nome)}”`, escolher: () => store.etiquetarAcao(espacoId, numero, nome) });
    }
    return achadas;
  }

  function opcoesDe(nome, texto) {
    const acao = acaoAtual();
    if (nome === "dependeDe") {
      const etapaDe = new Map((d.espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => [e.id, e.nome])));
      return buscar(anterioresPossiveis(d.acoes, numero), texto, (a) => [a.rotulo, d.usaCodigos ? a.codigo : ""]).slice(0, MAX_SUGESTOES)
        .map((a) => ({
          html: `${nomeHtml(a)}${etapaDe.get(a.etapa) ? ` <span class="tec">${esc(etapaDe.get(a.etapa))}</span>` : ""}`,
          escolher: () => acrescentarAnterior(a),
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
  /**
   * Guarda só o que a pessoa digitou e ainda não gravou (campos com `data-original` diferentes do valor),
   * para não apagar com um valor velho o que outra pessoa acabou de gravar; os demais campos (busca,
   * comentário, novo item do checklist) voltam como estavam. Também o foco e a posição do cursor.
   */
  function guardarValores() {
    const v = { campos: {} };
    for (const el of corpo.querySelectorAll("[name]")) {
      if (el.type === "checkbox" || el.type === "radio") continue;
      if ("original" in el.dataset && el.value === el.dataset.original) continue;
      v.campos[el.name] = el.value;
    }
    const ativo = document.activeElement;
    if (ativo && corpo.contains(ativo)) {
      v.foco = ativo.name || ativo.dataset.buscar || (ativo.matches("[data-editor-notas]") ? "notas" : null);
      if (typeof ativo.selectionStart === "number") v.cursor = [ativo.selectionStart, ativo.selectionEnd];
    }
    const ed = editorNotas();
    if (ed && notasMudaram()) v.notas = ed.innerHTML;
    return v;
  }
  function restaurarValores(v) {
    for (const el of corpo.querySelectorAll("[name]")) if (el.name in v.campos) el.value = v.campos[el.name];
    const ed = editorNotas();
    if (ed && v.notas != null) ed.innerHTML = v.notas;
    if (!v.foco) return;
    const el = v.foco === "notas" ? ed : corpo.querySelector(`[name="${v.foco}"], [data-buscar="${v.foco}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (v.cursor && typeof el.setSelectionRange === "function") { try { el.setSelectionRange(...v.cursor); } catch { /* campo sem cursor */ } }
  }

  /* ---------- gravação ao sair do campo (revisão de 23/10/2026) ---------- */
  function mostrarStatus(campo, tipo, texto = "") {
    clearTimeout(tempoStatus);
    status = { campo, tipo, texto };
    const el = corpo.querySelector(`[data-status="${campo}"]`);
    if (el) {
      el.className = `status-campo ${tipo}`;
      el.innerHTML = tipo === "salvo" ? `${ICONES.marcado}Salvo` : esc(texto);
    }
    if (tipo === "salvo") tempoStatus = setTimeout(() => {
      status = null;
      const atual = corpo.querySelector(`[data-status="${campo}"]`);
      if (atual) { atual.className = "status-campo"; atual.textContent = ""; }
    }, 2000);
  }
  const lerTres = () => Object.fromEntries(["o", "m", "p"].map((k) => [k, corpo.querySelector(`[name="${k}"]`)?.value ?? ""]));
  /** Grava um campo, se mudou. Erro: o valor digitado fica, com a mensagem ao lado do nome do campo. */
  async function gravarCampo(el) {
    const campo = el.dataset.auto;
    if (!campo || somenteLeitura()) return;
    const texto = el.value;
    if (campo === "estimativa") {
      const tres = lerTres();
      if (["o", "m", "p"].every((k) => tres[k] === corpo.querySelector(`[name="${k}"]`).dataset.original)) return;
      if (["o", "m", "p"].some((k) => tres[k] === "")) return mostrarStatus("estimativa", "aviso", "Preencha os três pontos para gravar.");
    } else if (texto === el.dataset.original) return;
    const operacoes = {
      rotulo: () => {
        if (!texto.trim()) throw new Error("O nome da ação não pode ficar vazio.");
        return store.alterarAcao(espacoId, numero, { rotulo: texto.trim().replace(/\s*\n+\s*/g, " ") });
      },
      codigo: () => store.alterarAcao(espacoId, numero, { codigo: normalizarCodigo(texto) || null }),
      etapa: () => store.alterarAcao(espacoId, numero, { etapa: texto || null }),
      descricao: () => store.alterarAcao(espacoId, numero, { descricao: texto.trim() }),
      justificativa: () => store.alterarAcao(espacoId, numero, { justificativa: texto.trim() }),
      local: () => store.alterarAcao(espacoId, numero, { local: texto.trim().replace(/\s+/g, " ") }),
      entregaDoPlano: () => store.alterarAcao(espacoId, numero, { entregaDoPlano: texto || null }),
      naoAntesDe: () => store.alterarAcao(espacoId, numero, { naoAntesDe: texto || null }),
      dataLimite: () => store.alterarAcao(espacoId, numero, { dataLimite: texto || null }),
      estimativa: () => { const t = lerTres(); return store.corrigirEstimativa(espacoId, numero, { o: Number(t.o), m: Number(t.m), p: Number(t.p) }); },
    };
    mostrarStatus(campo, "salvando", "Salvando…");
    try {
      await operacoes[campo]();
      mostrarStatus(campo, "salvo");
    } catch (e) {
      mostrarStatus(campo, "erro", e.message);
      corpo.querySelectorAll(`[data-auto="${campo}"]`).forEach((x) => x.classList.add("com-erro"));
    }
  }
  /** As anotações gravam ao sair do editor, se mudaram. */
  const notasMudaram = () => {
    const ed = editorNotas();
    return Boolean(ed) && htmlParaMarkdown(ed) !== (acaoAtual()?.notas ?? "");
  };
  async function gravarNotas() {
    if (!notasMudaram() || somenteLeitura()) return;
    mostrarStatus("notas", "salvando", "Salvando…");
    try {
      await store.alterarAcao(espacoId, numero, { notas: htmlParaMarkdown(editorNotas()) });
      mostrarStatus("notas", "salvo");
    } catch (e) { mostrarStatus("notas", "erro", e.message); }
  }
  /** Esc num campo com alteração: volta ao valor gravado (sem fechar a janela). */
  function desfazerCampo(el) {
    if (el.dataset.auto === "estimativa") {
      for (const k of ["o", "m", "p"]) { const x = corpo.querySelector(`[name="${k}"]`); x.value = x.dataset.original; }
    } else el.value = el.dataset.original;
    el.classList.remove("com-erro");
    if (status?.campo === el.dataset.auto) { status = null; mostrarStatus(el.dataset.auto, "", ""); }
    ajustarAlturas();
  }

  /* ---------- formulários de bloco: Reestimar e Registrar conclusão ---------- */
  async function salvar(form) {
    const nome = form.dataset.salvar;
    const f = Object.fromEntries(new FormData(form));
    const erro = form.querySelector("[data-erro]");
    const tres = () => ({ o: Number(f.o === "" ? NaN : f.o), m: Number(f.m === "" ? NaN : f.m), p: Number(f.p === "" ? NaN : f.p) });
    const operacoes = {
      reestimar: () => store.reestimar(espacoId, numero, { ...tres(), motivo: f.motivo }),
      concluir: () => store.concluir(espacoId, numero, f.data),
    };
    const mensagens = { reestimar: "Reestimativa registrada.", concluir: "Conclusão registrada. As ações seguintes foram recalculadas." };
    try {
      editando = null; // antes de gravar: a gravação redesenha a janela já sem o formulário
      gravado = copiaDoFormulario(form);
      await operacoes[nome]();
      avisar(mensagens[nome]);
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

  const botoesDaAcao = () => corpo.querySelector("[data-abrir-form]")?.closest(".botoes") ?? null;
  function editar(nome) {
    editando = nome;
    /* os botões encolhem enquanto o formulário cresce no lugar deles */
    trocarSuave({ sai: botoesDaAcao(), redesenhar: desenhar, entra: () => corpo.querySelector(`[data-salvar="${nome}"]`), lado: "antes" });
    corpo.querySelector(`[data-salvar="${nome}"] [name]`)?.focus();
  }
  function cancelar() {
    const nome = editando;
    editando = null;
    /* o formulário encolhe enquanto os botões voltam a crescer */
    trocarSuave({ sai: corpo.querySelector(`[data-salvar="${nome}"]`), redesenhar: desenhar, entra: botoesDaAcao, lado: "depois" });
    corpo.querySelector(`[data-abrir-form="${nome}"]`)?.focus();
  }

  /** Abre um campo recolhido em "Mais campos" e põe o cursor nele. */
  function mostrarCampo(campo) {
    if (campo === "checklist") { checklistAberto = true; focoNoChecklist = true; }
    if (campo === "etiquetas") buscando = "etiquetas"; // abre já com a busca
    if (campo === "documentos") editandoDoc = "novo"; // abre já com o formulário
    mostrados.add(campo);
    desenhar();
    const bloco = corpo.querySelector(`[data-campo="${campo}"]`);
    abrirSuave(bloco);
    if (campo === "notas") editorNotas()?.focus();
    else if (campo !== "checklist") bloco?.querySelector("input, textarea, select")?.focus();
  }

  /** Muda o texto de um item do checklist ali mesmo: Enter grava, Esc cancela. */
  function editarItem(el) {
    const item = (acaoAtual()?.checklist ?? []).find((i) => i.id === el.dataset.textoItem);
    if (!item) return;
    editarTexto(el, {
      valor: item.texto,
      aoGravar: (novo) => store.alterarItemDoChecklist(espacoId, numero, item.id, novo),
      aoTerminar: () => {},
    });
  }

  /* ---------- eventos ---------- */
  corpo.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.closest("[data-confirmar-anterior]")) {
      const n = anteriorPendente;
      anteriorPendente = null;
      return executar(() => store.acrescentarDependencia(espacoId, numero, n));
    }
    if (t.closest("[data-desistir-anterior]")) { anteriorPendente = null; return desenhar(); }
    const abaB = t.closest("[data-aba]");
    if (abaB) { aba = abaB.dataset.aba; return desenhar(); }
    const mostrar = t.closest("[data-mostrar-campo]");
    if (mostrar) return mostrarCampo(mostrar.dataset.mostrarCampo);
    const abrirBusca = t.closest("[data-buscar-abrir]");
    if (abrirBusca) {
      buscando = abrirBusca.dataset.buscarAbrir;
      desenhar();
      return corpo.querySelector(`[data-buscar="${buscando}"]`)?.focus();
    }
    const form = t.closest("[data-abrir-form]");
    if (form) return editar(form.dataset.abrirForm);
    if (t.closest("[data-cancelar]")) return cancelar();
    if (t.closest("[data-excluir-acao]")) {
      try {
        if (await excluirAcao({ store, espacoId, acao: acaoAtual(), acoes: d.acoes })) fecharPainel();
      } catch (falha) { avisar(falha.message); }
      return;
    }
    const editarC = t.closest("[data-editar-comentario-id]");
    if (editarC) { editandoComentario = editarC.dataset.editarComentarioId; apagandoComentario = null; return desenharComentarios(); }
    const apagarC = t.closest("[data-apagar-comentario]");
    if (apagarC) { apagandoComentario = apagarC.dataset.apagarComentario; editandoComentario = null; return desenharComentarios(); }
    if (t.closest("[data-cancelar-comentario]")) { editandoComentario = null; apagandoComentario = null; return desenharComentarios(); }
    const confirmarC = t.closest("[data-confirmar-apagar]");
    if (confirmarC) {
      apagandoComentario = null;
      return executar(() => store.apagarComentario(espacoId, confirmarC.dataset.confirmarApagar), "Comentário apagado.");
    }
    if (t.closest("[data-abrir-checklist]")) {
      checklistAberto = true;
      focoNoChecklist = true;
      return desenhar();
    }
    const tirarItem = t.closest("[data-tirar-item]");
    if (tirarItem) return executar(() => store.retirarItemDoChecklist(espacoId, numero, tirarItem.dataset.tirarItem));
    const textoItem = t.closest("[data-texto-item]");
    if (textoItem && !textoItem.isContentEditable) return editarItem(textoItem);
    const dep = t.closest("[data-tirar-dependencia]");
    if (dep) return executar(() => store.retirarDependencia(espacoId, numero, Number(dep.dataset.tirarDependencia)));
    /* documentos da ação (passo 2.10a) */
    if (t.closest("[data-novo-documento]")) { editandoDoc = "novo"; desenhar(); return corpo.querySelector('[data-form-documento] [name="nome"]')?.focus(); }
    const editarDoc = t.closest("[data-editar-documento]");
    if (editarDoc) { editandoDoc = editarDoc.dataset.editarDocumento; desenhar(); return corpo.querySelector('[data-form-documento] [name="nome"]')?.focus(); }
    if (t.closest("[data-cancelar-documento]")) { editandoDoc = null; mostrados.delete("documentos"); return desenhar(); }
    const tirarDoc = t.closest("[data-tirar-documento]");
    if (tirarDoc) return executar(() => store.retirarDocumentoDaAcao(espacoId, numero, tirarDoc.dataset.tirarDocumento), "Documento retirado.");
    const etq = t.closest("[data-tirar-etiqueta]");
    if (etq) return executar(() => store.retirarEtiquetaDaAcao(espacoId, numero, etq.dataset.tirarEtiqueta));
    const resp = t.closest("[data-tirar-responsavel]");
    if (resp) return executar(() => store.retirarResponsavelDaAcao(espacoId, numero, resp.dataset.tirarResponsavel));
    if (t.closest("[data-desfazer-conclusao]")) {
      return executar(() => store.desfazerConclusao(espacoId, numero), `Conclusão desfeita. A ação voltou para ${usaDependencias(d.espaco) ? "as liberadas" : nomeInicial(d.espaco)}.`);
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
  corpo.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (e.target.matches("[data-comentar]")) return enviarComentario(e.target);
    if (e.target.matches("[data-editar-comentario]")) return salvarComentario(e.target);
    if (e.target.matches("[data-form-documento]")) return salvarDocumento(e.target);
    if (!e.target.matches("[data-checklist-form]")) return salvar(e.target);
    const campo = e.target.elements.novoItemChecklist;
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = "";
    focoNoChecklist = true;
    try { await store.acrescentarItemNoChecklist(espacoId, numero, texto); }
    catch (falha) { campo.value = texto; avisar(falha.message); }
  });
  async function enviarComentario(form) {
    const caixa = form.elements.novoComentario;
    const texto = caixa.value;
    if (!texto.trim()) return;
    caixa.value = "";
    try { await store.comentar(espacoId, numero, texto); corpo.querySelector('[name="novoComentario"]')?.focus(); }
    catch (falha) { caixa.value = texto; avisar(falha.message); }
  }
  async function salvarComentario(form) {
    const id = form.dataset.editarComentario;
    if (await executar(() => store.editarComentario(espacoId, id, form.elements.textoComentario.value))) {
      editandoComentario = null;
      desenharComentarios();
    }
  }
  /* Ctrl+Enter (⌘+Enter) envia o comentário ou salva a edição; Esc desiste da edição */
  corpo.addEventListener("keydown", (e) => {
    /* Esc no formulário do documento desiste dele, sem fechar a janela (passo 2.10a) */
    if (e.key === "Escape" && editandoDoc != null && e.target.closest("[data-form-documento]")) {
      e.preventDefault(); e.stopPropagation();
      editandoDoc = null; mostrados.delete("documentos");
      return desenhar();
    }
    if (e.key === "Escape" && (editandoComentario || apagandoComentario) && e.target.closest("[data-comentarios]")) {
      e.preventDefault(); e.stopPropagation();
      editandoComentario = null; apagandoComentario = null;
      return desenharComentarios();
    }
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
    const form = e.target.closest("[data-comentar], [data-editar-comentario]");
    if (form) { e.preventDefault(); form.requestSubmit(); }
  });
  /* checklist: marcar e desmarcar gravam na hora; os demais campos gravam ao sair deles */
  corpo.addEventListener("change", (e) => {
    const marca = e.target.closest("[data-marcar-item]");
    if (marca) return executar(() => store.marcarItemDoChecklist(espacoId, numero, marca.dataset.marcarItem, marca.checked));
    if (e.target.matches("[data-mudar-situacao]")) {
      const nome = e.target.selectedOptions[0]?.textContent.trim();
      return executar(() => store.mudarSituacao(espacoId, numero, e.target.value || null), `Situação: ${nome}.`);
    }
    if (e.target.dataset.auto) gravarCampo(e.target);
  });
  corpo.addEventListener("focusout", (e) => {
    /* anotações: grava ao sair do editor (não ao ir para a barra de formatação dele) */
    const caixa = e.target.closest?.("[data-caixa-notas]");
    if (caixa && !caixa.contains(e.relatedTarget)) gravarNotas();
    /* busca de dependências e responsáveis: recolhe ao sair dela sem nada digitado */
    const nome = e.target.dataset?.buscar;
    if (nome && !e.target.value && buscando === nome) {
      setTimeout(() => {
        const ativo = document.activeElement;
        if (fechada || buscando !== nome || ativo?.closest?.(`[data-seletor="${nome}"]`)) return;
        buscando = null;
        desenhar();
      }, 150);
    }
  });
  corpo.addEventListener("input", (e) => {
    const bloco = e.target.closest("form, [data-campo]");
    const pert = bloco?.querySelector("[data-pert]");
    if (pert && ["o", "m", "p"].includes(e.target.name)) {
      const [o, m, p] = ["o", "m", "p"].map((k) => Number(bloco.querySelector(`[name="${k}"]`).value));
      pert.textContent = [o, m, p].every(Number.isInteger) && o >= 0 && o <= m && m <= p && p > 0 ? `Prazo previsto (PERT): ${diasUteis(duracaoPert({ o, m, p }))}.` : "Preencha os três pontos: otimista ≤ mais provável ≤ pessimista.";
    }
    if (e.target.dataset.auto) e.target.classList.remove("com-erro");
    if (e.target.matches("textarea.cresce, textarea.janela-nome")) ajustarAlturas(e.target.parentElement);
  });
  corpo.addEventListener("keydown", (e) => {
    /* Esc na busca vazia recolhe a busca, sem fechar a janela */
    if (e.key === "Escape" && e.target.dataset.buscar && !e.target.value && buscando) {
      e.preventDefault();
      const nome = buscando;
      buscando = null;
      desenhar();
      corpo.querySelector(`[data-buscar-abrir="${nome}"]`)?.focus();
      return;
    }
    if (e.target.dataset.buscar) return; // o seletor cuida das teclas
    if (e.target.matches("[data-endereco-link]")) {
      if (e.key === "Enter") { e.preventDefault(); aplicarLink(); }
      if (e.key === "Escape") { e.preventDefault(); corpo.querySelector("[data-barra-link]").hidden = true; editorNotas()?.focus(); }
      return;
    }
    if (e.target.matches("[data-editor-notas]") && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); abrirBarraDeLink(); return; }
    if (e.key === "Escape" && editando) { e.preventDefault(); cancelar(); return; }
    const auto = e.target.dataset?.auto;
    /* Esc num campo alterado desfaz a digitação (sem fechar a janela); sem alteração, fecha como sempre */
    if (e.key === "Escape" && auto) {
      const alterado = auto === "estimativa"
        ? ["o", "m", "p"].some((k) => { const x = corpo.querySelector(`[name="${k}"]`); return x.value !== x.dataset.original; })
        : e.target.value !== e.target.dataset.original;
      if (alterado) { e.preventDefault(); desfazerCampo(e.target); return; }
    }
    if (e.key === "Escape" && e.target.matches("[data-editor-notas]") && notasMudaram()) {
      e.preventDefault();
      e.target.innerHTML = markdownParaHtml(acaoAtual()?.notas);
      return;
    }
    /* Enter no nome e no código grava (o nome não tem quebra de linha) */
    if (e.key === "Enter" && (auto === "rotulo" || auto === "codigo")) { e.preventDefault(); e.target.blur(); return; }
    if (e.key === "Enter" && e.target.matches("[data-texto-item]") && !e.target.isContentEditable) { e.preventDefault(); editarItem(e.target); }
  });

  const seletores = ligarSeletores(corpo, {
    dependeDe: {
      opcoes: (texto) => opcoesDe("dependeDe", texto),
      vazio: "Nenhuma ação disponível. Ficam de fora a própria ação, as que já são anteriores e as que dependem dela.",
    },
    responsaveis: { opcoes: (texto) => opcoesDe("responsaveis", texto), vazio: "Digite um nome para buscar ou cadastrar." },
    etiquetas: { opcoes: (texto) => opcoesDeEtiquetas(texto), vazio: "Digite o nome de uma etiqueta nova." },
  }, { aoErro: (e) => avisar(e.message) });

  desenhar();
  pararComentarios = store.acompanharComentarios(espacoId, numero, (lista) => { comentarios = lista; if (!fechada) desenharComentarios(); });
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
