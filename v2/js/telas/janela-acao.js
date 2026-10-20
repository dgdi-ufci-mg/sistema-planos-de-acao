/**
 * Janela da ação (especificação, seções 5.3, 5.4 e 8.3; passo 1.7).
 * Resumo da ação, edição no lugar (com Salvar e Cancelar), seletores com busca para
 * dependências e responsáveis (sem ciclos), reestimativa, conclusão e histórico de estimativas.
 * As listas mudam item a item, na hora (seção 4.6). As notas ganham editor no passo 1.8.
 */
import { ICONES } from "../icones.js";
import { esc, dataBr, plural } from "../formato.js";
import { duracaoPert } from "../calculo.js";
import { estimativaLivre, anterioresPossiveis, buscar, resumoDasEstimativas, pendencias } from "../acao.js";
import { abrirPainel, fecharPainel, avisar } from "./painel.js";
import { seloHtml } from "./pessoas.js";

const SITUACOES = {
  concluida: ["Concluída", "concluida", "icone-concluida"],
  liberada: ["Liberada", "liberada", "icone-liberada"],
  naoLiberada: ["Não liberada", "naoLiberada", "icone-nao-liberada"],
};
const MAX_SUGESTOES = 8;
const numero = (x) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const diasUteis = (n) => `${numero(n)} ${plural(Math.abs(n), "dia útil", "dias úteis")}`;

/**
 * @param {{store: object, espacoId: string, codigo: string, hoje: string, usuario?: string|null,
 *   dados: object, aoFechar: () => void}} opcoes  dados: ver dadosDaJanela em espaco.js
 * @returns {{atualizar: (dados: object) => void, fechar: () => void}}
 */
export function abrirAcao({ store, espacoId, codigo, hoje, dados, aoFechar }) {
  let d = dados;
  /** Campo em edição ("rotulo", "etapa", "descricao", "naoAntesDe", "estimativa") ou formulário aberto ("reestimar", "concluir"). */
  let editando = null;
  /** Seletor com sugestões abertas e a sugestão destacada. */
  const busca = { dependeDe: { texto: "", indice: 0 }, responsaveis: { texto: "", indice: 0 } };
  let fechada = false;

  const corpo = abrirPainel(`Ação ${codigo}`, "", {
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
    const acao = d.acoes.find((a) => a.codigo === codigo);
    if (!acao) { fecharPainel(); return; }
    const l = d.linhaDe.get(codigo);
    const c = d.caminho.porAcao.get(codigo);
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
      <div class="janela-cabeca">
        ${d.usaFases ? `<span class="tec">${etapa ? `${esc(etapa.fase)} · ${esc(etapa.nome)}` : "Sem fase nem etapa"}</span>` : ""}
        ${editando === "rotulo"
          ? editorHtml("rotulo", `<input name="rotulo" maxlength="120" value="${esc(acao.rotulo)}" aria-label="Rótulo">`)
          : `<h3 class="janela-rotulo editavel" data-editar="rotulo" tabindex="0" title="Clique para editar">${esc(acao.rotulo)}</h3>`}
      </div>

      <dl class="janela-resumo">
        <div><dt>Situação</dt><dd class="sit"><span class="${sitClasse}">${ICONES[sitIcone]}</span>${sitTexto}${l.atrasada ? `<span class="carimbo"><span class="icone-atrasada">${ICONES.atrasada}</span>Atrasada</span>` : ""}</dd></div>
        <div><dt>${l.situacao === "concluida" ? "Concluída em" : "Conclusão prevista"}</dt><dd class="mono${l.atrasada ? " atrasada" : ""}">${dataBr(l.conclusao)}</dd></div>
        ${l.situacao === "concluida" ? "" : `
          <div><dt>Prioridade de execução <a href="#" class="oque" data-termo="exec">o que é?</a></dt><dd>${barra(l.execucao, "var(--calor)", `${Math.round(l.execucao * 100)}%`)}</dd></div>
          <div><dt>Prioridade de revisão <a href="#" class="oque" data-termo="rev">o que é?</a></dt><dd>${barra(l.revisao, "var(--accent)", revisao)}</dd></div>`}
      </dl>

      ${c.regraDoPassado ? `<p class="alerta">${ICONES.atrasada}<span><b>Prazo vencido sem reestimativa:</b> o cálculo considera conclusão a partir de hoje. Reestime a ação para informar quanto falta. <a href="#" class="oque" data-termo="regra">o que é?</a></span></p>` : ""}
      ${pend && (pend.anteriores.length || pend.dataMinima) ? `<p class="nota-janela">Será liberada ${[
        pend.anteriores.length ? `quando ${plural(pend.anteriores.length, "for concluída a ação", "forem concluídas as ações")} ${pend.anteriores.map(esc).join(", ")}` : "",
        pend.dataMinima ? `a partir de ${dataBr(pend.dataMinima)}` : "",
      ].filter(Boolean).join(", e ")}.</p>` : ""}

      ${botoesHtml(l, c)}
      ${editando === "reestimar" ? reestimativaHtml() : ""}
      ${editando === "concluir" ? conclusaoHtml(acao) : ""}

      <div class="janela-campos">
        ${d.usaFases ? campoHtml("etapa", "Etapa", etapa ? `${esc(etapa.fase)} · ${esc(etapa.nome)}` : "",
          `<select name="etapa" aria-label="Etapa"><option value="">Sem fase nem etapa</option>${(d.espaco.estrutura ?? []).map((f) =>
            `<optgroup label="${esc(f.nome)}">${f.etapas.map((e) => `<option value="${esc(e.id)}"${e.id === acao.etapa ? " selected" : ""}>${esc(e.nome)}</option>`).join("")}</optgroup>`).join("")}</select>`) : ""}
        ${campos.descricao !== false ? campoHtml("descricao", "Descrição", acao.descricao ? `<span class="texto-livre">${esc(acao.descricao)}</span>` : "",
          `<textarea name="descricao" rows="4" aria-label="Descrição">${esc(acao.descricao ?? "")}</textarea>`) : ""}

        <div class="campo-acao">
          <span class="campo-nome">Depende de</span>
          <div class="etiquetas">${(acao.dependeDe ?? []).map((cod) => {
            const a = d.acoes.find((x) => x.codigo === cod);
            return `<span class="etiqueta"><span class="mono">${esc(cod)}</span>${a ? esc(a.rotulo) : "(não existe mais)"}<button type="button" class="tirar" data-tirar-dependencia="${esc(cod)}" aria-label="Retirar ${esc(cod)}">${ICONES.fechar}</button></span>`;
          }).join("") || `<span class="vazio">Nenhuma: pode começar no início do espaço.</span>`}</div>
          ${seletorHtml("dependeDe", "Acrescentar ação anterior: digite o código ou o nome")}
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

        ${campos.notas !== false && acao.notas ? `<div class="campo-acao"><span class="campo-nome">Notas</span><div class="texto-livre">${esc(acao.notas)}</div><span class="tec">O editor de notas chega no passo 1.8.</span></div>` : ""}
      </div>

      ${historicoHtml(acao, resumoEst)}`;
    corpo.closest(".painel").style.setProperty("--calor", l.situacao === "concluida" ? "var(--ok)"
      : `color-mix(in oklab, var(--crit) ${Math.round(l.execucao * 100)}%, var(--neutral))`);
    restaurarValores(valores);
    desenharSugestoes();
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

  function tresPontosHtml(e) {
    const v = (k) => (e?.[k] ?? "");
    return `<div class="tres-pontos">
      <label class="campo"><span>Otimista</span><input name="o" type="number" min="0" step="0.5" inputmode="decimal" value="${v("o")}"></label>
      <label class="campo"><span>Mais provável</span><input name="m" type="number" min="0" step="0.5" inputmode="decimal" value="${v("m")}"></label>
      <label class="campo"><span>Pessimista</span><input name="p" type="number" min="0" step="0.5" inputmode="decimal" value="${v("p")}"></label>
    </div>
    <p class="tec" data-pert>${e ? `Prazo previsto (PERT): ${diasUteis(duracaoPert(e))}` : ""}</p>`;
  }

  function vigenteHtml(acao) {
    const e = acao.estimativas?.at(-1);
    return e ? `<span class="mono">${numero(e.o)} · ${numero(e.m)} · ${numero(e.p)}</span> <span class="tec">otimista · mais provável · pessimista, em dias úteis</span>` : "";
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
      <h4>Registrar conclusão de ${esc(acao.codigo)}</h4>
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
        <span>${numero(e.o)} · ${numero(e.m)} · ${numero(e.p)} → <b>${diasUteis(duracaoPert(e))}</b> ${e.contaDe === "data" ? `a partir de ${dataBr(e.em)}` : "da liberação"}</span>
        ${e.motivo ? `<span class="tec">Motivo: ${esc(e.motivo)}</span>` : ""}
      </li>`).join("")}</ol>
    </section>`;
  }

  /* ---------- seletores com busca ---------- */
  function seletorHtml(nome, dica) {
    return `<div class="seletor-busca" data-seletor="${nome}">
      <input type="text" autocomplete="off" placeholder="${dica}" aria-label="${dica}" data-buscar="${nome}"
        role="combobox" aria-expanded="false" aria-controls="sugestoes-${nome}" aria-autocomplete="list">
      <ul class="sugestoes" id="sugestoes-${nome}" role="listbox" hidden></ul>
    </div>`;
  }

  function opcoesDe(nome) {
    const acao = d.acoes.find((a) => a.codigo === codigo);
    const texto = busca[nome].texto;
    if (nome === "dependeDe") {
      return buscar(anterioresPossiveis(d.acoes, codigo), texto, (a) => [a.codigo, a.rotulo]).slice(0, MAX_SUGESTOES)
        .map((a) => ({ html: `<span class="mono">${esc(a.codigo)}</span> ${esc(a.rotulo)}`, escolher: () => store.acrescentarDependencia(espacoId, codigo, a.codigo) }));
    }
    const contexto = { tons: d.espaco.tons, meus: d.meus };
    const disponiveis = d.responsaveis.filter((r) => !acao.responsaveis.includes(r.id));
    const achados = buscar(disponiveis, texto, (r) => [r.nome, r.sigla, r.setor]).slice(0, MAX_SUGESTOES)
      .map((r) => ({ html: `${seloHtml(r, contexto)} ${esc(r.nome)}${r.setor ? ` <span class="tec">${esc(r.setor)}</span>` : ""}`,
        escolher: () => store.acrescentarResponsavelNaAcao(espacoId, codigo, r.id) }));
    const nomeNovo = texto.trim();
    const jaExiste = d.responsaveis.some((r) => r.nome.toLowerCase() === nomeNovo.toLowerCase());
    if (nomeNovo && !jaExiste) {
      for (const [tipo, comoTexto] of [["pessoa", "pessoa"], ["unidade", "unidade (setor, equipe ou grupo)"]]) {
        achados.push({
          html: `${ICONES.mais} Cadastrar “${esc(nomeNovo)}” como ${comoTexto}`,
          escolher: async () => {
            const id = await store.criarResponsavel({ tipo, nome: nomeNovo, ...(tipo === "unidade" ? { sigla: nomeNovo.length <= 10 ? nomeNovo.toUpperCase() : "" } : {}) });
            await store.acrescentarResponsavelNaAcao(espacoId, codigo, id);
          },
        });
      }
    }
    return achados;
  }

  function desenharSugestoes() {
    for (const nome of Object.keys(busca)) {
      const caixa = corpo.querySelector(`[data-seletor="${nome}"]`);
      if (!caixa) continue;
      const entrada = caixa.querySelector("input");
      const ul = caixa.querySelector("ul");
      const aberta = document.activeElement === entrada;
      const opcoes = aberta ? opcoesDe(nome) : [];
      busca[nome].indice = Math.min(busca[nome].indice, Math.max(0, opcoes.length - 1));
      ul.innerHTML = opcoes.length ? opcoes.map((o, i) => `<li role="option" id="sug-${nome}-${i}" data-sugestao="${i}" aria-selected="${i === busca[nome].indice}">${o.html}</li>`).join("")
        : `<li class="vazio">${nome === "dependeDe" ? "Nenhuma ação disponível. Ficam de fora a própria ação, as que já são anteriores e as que dependem dela." : "Digite um nome para buscar ou cadastrar."}</li>`;
      ul.hidden = !aberta;
      entrada.setAttribute("aria-expanded", String(aberta));
      entrada.setAttribute("aria-activedescendant", opcoes.length ? `sug-${nome}-${busca[nome].indice}` : "");
      caixa._opcoes = opcoes;
    }
  }

  async function escolher(nome, indice) {
    const opcao = corpo.querySelector(`[data-seletor="${nome}"]`)?._opcoes?.[indice];
    if (!opcao) return;
    busca[nome] = { texto: "", indice: 0 };
    const entrada = corpo.querySelector(`[data-buscar="${nome}"]`);
    entrada.value = "";
    await executar(opcao.escolher);
    corpo.querySelector(`[data-buscar="${nome}"]`)?.focus();
  }

  /* ---------- valores digitados: mantidos quando a janela é redesenhada por mudança de outra pessoa ---------- */
  function guardarValores() {
    const v = {};
    for (const el of corpo.querySelectorAll("form [name], [data-buscar]")) v[el.name || el.dataset.buscar] = el.value;
    v.foco = document.activeElement && corpo.contains(document.activeElement) ? (document.activeElement.name || document.activeElement.dataset.buscar) : null;
    return v;
  }
  function restaurarValores(v) {
    for (const el of corpo.querySelectorAll("form [name], [data-buscar]")) {
      const chave = el.name || el.dataset.buscar;
      if (chave in v) el.value = v[chave];
    }
    if (v.foco) corpo.querySelector(`[name="${v.foco}"], [data-buscar="${v.foco}"]`)?.focus();
  }

  /* ---------- gravação dos editores ---------- */
  async function salvar(form) {
    const nome = form.dataset.salvar;
    const f = Object.fromEntries(new FormData(form));
    const erro = form.querySelector("[data-erro]");
    const tres = () => ({ o: Number(f.o === "" ? NaN : f.o), m: Number(f.m === "" ? NaN : f.m), p: Number(f.p === "" ? NaN : f.p) });
    const operacoes = {
      rotulo: () => {
        if (!f.rotulo.trim()) throw new Error("Informe o rótulo da ação.");
        return store.alterarAcao(espacoId, codigo, { rotulo: f.rotulo.trim() });
      },
      etapa: () => store.alterarAcao(espacoId, codigo, { etapa: f.etapa || null }),
      descricao: () => store.alterarAcao(espacoId, codigo, { descricao: f.descricao.trim() }),
      naoAntesDe: () => store.alterarAcao(espacoId, codigo, { naoAntesDe: f.naoAntesDe || null }),
      estimativa: () => store.corrigirEstimativa(espacoId, codigo, tres()),
      reestimar: () => store.reestimar(espacoId, codigo, { ...tres(), motivo: f.motivo }),
      concluir: () => store.concluir(espacoId, codigo, f.data),
    };
    const mensagens = { reestimar: "Reestimativa registrada.", concluir: "Conclusão registrada. As ações seguintes foram recalculadas." };
    try {
      editando = null; // antes de gravar: a gravação redesenha a janela já sem o editor
      await operacoes[nome]();
      if (mensagens[nome]) avisar(mensagens[nome]);
    } catch (e) {
      editando = nome;
      desenhar();
      const novoErro = corpo.querySelector(`[data-salvar="${nome}"] [data-erro]`) ?? erro;
      for (const [k, val] of Object.entries(f)) { const el = corpo.querySelector(`[data-salvar="${nome}"] [name="${k}"]`); if (el) el.value = val; }
      novoErro.textContent = e.message;
      novoErro.hidden = false;
    }
  }

  function editar(nome) {
    editando = nome;
    desenhar();
    corpo.querySelector(`[data-salvar="${nome}"] [name]`)?.focus();
  }
  function cancelar() {
    const nome = editando;
    editando = null;
    desenhar();
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
    const dep = t.closest("[data-tirar-dependencia]");
    if (dep) return executar(() => store.retirarDependencia(espacoId, codigo, dep.dataset.tirarDependencia));
    const resp = t.closest("[data-tirar-responsavel]");
    if (resp) return executar(() => store.retirarResponsavelDaAcao(espacoId, codigo, resp.dataset.tirarResponsavel));
    if (t.closest("[data-desfazer-conclusao]")) {
      return executar(() => store.desfazerConclusao(espacoId, codigo), "Conclusão desfeita. A ação voltou a ser liberada.");
    }
    const sug = t.closest("[data-sugestao]");
    if (sug) return escolher(sug.closest("[data-seletor]").dataset.seletor, Number(sug.dataset.sugestao));
  });
  /* a sugestão é escolhida no clique; o mousedown não pode tirar o foco da busca antes disso */
  corpo.addEventListener("mousedown", (e) => { if (e.target.closest("[data-sugestao]")) e.preventDefault(); });
  corpo.addEventListener("submit", (e) => { e.preventDefault(); salvar(e.target); });
  corpo.addEventListener("input", (e) => {
    const nome = e.target.dataset.buscar;
    if (nome) { busca[nome] = { texto: e.target.value, indice: 0 }; desenharSugestoes(); return; }
    const form = e.target.closest("form");
    const pert = form?.querySelector("[data-pert]");
    if (pert && ["o", "m", "p"].includes(e.target.name)) {
      const [o, m, p] = ["o", "m", "p"].map((k) => Number(form.querySelector(`[name="${k}"]`).value));
      pert.textContent = [o, m, p].every(Number.isFinite) && o <= m && m <= p && p > 0 ? `Prazo previsto (PERT): ${diasUteis(duracaoPert({ o, m, p }))}` : "";
    }
  });
  corpo.addEventListener("focusin", (e) => { if (e.target.dataset.buscar) desenharSugestoes(); });
  corpo.addEventListener("focusout", (e) => { if (e.target.dataset.buscar) setTimeout(() => !fechada && desenharSugestoes(), 0); });
  corpo.addEventListener("keydown", (e) => {
    const nome = e.target.dataset.buscar;
    if (nome) {
      const n = corpo.querySelector(`[data-seletor="${nome}"]`)._opcoes?.length ?? 0;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        busca[nome].indice = (busca[nome].indice + (e.key === "ArrowDown" ? 1 : -1) + n) % Math.max(n, 1);
        desenharSugestoes();
      } else if (e.key === "Enter") {
        e.preventDefault();
        escolher(nome, busca[nome].indice);
      } else if (e.key === "Escape" && e.target.value) {
        e.preventDefault();
        e.target.value = "";
        busca[nome] = { texto: "", indice: 0 };
        desenharSugestoes();
      }
      return;
    }
    if (e.key === "Escape" && editando) { e.preventDefault(); cancelar(); return; }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-editar]")) { e.preventDefault(); editar(e.target.dataset.editar); }
  });

  desenhar();
  return {
    atualizar(novos) { if (!fechada) { d = novos; desenhar(); } },
    fechar() { if (!fechada) fecharPainel(); },
  };
}
