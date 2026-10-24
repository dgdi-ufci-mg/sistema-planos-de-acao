/**
 * Visualização "Entregas" do Plano de Ação (passo 2.6, parte 2; documentação técnica, seções 4.12, 8 e 16.7):
 * a lista das entregas, cada uma com a situação e o alcance em barra, e o painel de cada entrega, com o
 * registro do alcance (com evidências), a mudança de situação, a edição e o histórico.
 * Só o administrador do espaço altera; os demais consultam.
 */
import { esc, dataBr, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { abrirPainel, fecharPainel, avisar } from "./painel.js";
import { donosHtml } from "./pessoas.js";
import {
  TIPOS_DE_META, SITUACOES_DA_ENTREGA, alcanceAtual, registrosDa, avisoDeCoerencia, textoDoValor, textoDaMeta,
} from "../entregas.js";

const pct = (f) => `${Math.round(f * 100).toLocaleString("pt-BR")}%`;
const SITUACAO_INICIAL = "naoIniciada";

/** Selo da situação, com a cor dela. */
export const seloDaSituacao = (situacao) =>
  `<span class="selo-entrega s-${esc(situacao)}">${esc(SITUACOES_DA_ENTREGA[situacao]?.nome ?? situacao)}</span>`;

/**
 * Cria a tela das entregas de um espaço. `desenhar` refaz a lista; o painel aberto acompanha os dados.
 * @param {{store: object, espacoId: string, hoje: string, aoMudar: () => Promise<void>}} opcoes
 *   aoMudar: relê entregas e registros e redesenha (depois de cada gravação)
 */
export function criarTelaDeEntregas({ store, espacoId, hoje, aoMudar }) {
  /** dados mais recentes: espaco, entregas, alcances, responsaveis, perm, meus */
  let d = null;
  /** painel aberto: id da entrega e o formulário à vista */
  let aberta = null;
  let redesenharPainel = null;

  const pode = () => store.podeGravar !== false && d.perm.configurar;
  const pessoa = (id) => d.responsaveis.find((r) => r.id === id);
  const nomes = (ids) => (ids ?? []).map(pessoa).filter(Boolean);
  const gravar = async (operacao, mensagem) => {
    try { await operacao(); await aoMudar(); if (mensagem) avisar(mensagem); return true; } catch (e) { avisar(e.message); return false; }
  };

  function barraHtml(entrega) {
    const a = alcanceAtual(entrega, d.alcances);
    if (!a) return '<div class="entrega-alcance"><span class="entrega-barra vazia"><i style="width:0"></i></span><small class="tec">Sem alcance registrado</small></div>';
    const largura = Math.min(1, Math.max(0, a.fracao));
    return `<div class="entrega-alcance"><span class="entrega-barra${a.fracao >= 1 ? " cheia" : ""}" role="img" aria-label="Alcance: ${pct(a.fracao)} da meta"><i style="width:${(largura * 100).toFixed(1)}%"></i></span>
      <small>${esc(textoDoValor(entrega, a.valor))}${entrega.tipoMeta === "padrao" ? "" : ` · <b>${pct(a.fracao)}</b>`} <span class="tec">em ${dataBr(a.registro.data)}</span></small></div>`;
  }

  function cartaoHtml(e) {
    const aviso = avisoDeCoerencia(e, e.situacao ?? SITUACAO_INICIAL, d.alcances);
    const donos = nomes(e.responsaveis);
    return `<article class="cartao-entrega" role="button" tabindex="0" data-abrir-entrega="${esc(e.id)}">
      <div class="entrega-topo"><h3>${esc(e.titulo)}</h3>${seloDaSituacao(e.situacao ?? SITUACAO_INICIAL)}</div>
      ${barraHtml(e)}
      <div class="entrega-rodape"><small class="tec">Meta: ${esc(textoDaMeta(e))}${e.prazo ? ` · até ${dataBr(e.prazo)}` : ""}</small>
        ${donos.length ? `<span class="donos">${donosHtml(donos, { tons: d.espaco.tons, meus: d.meus })}</span>` : ""}</div>
      ${aviso ? `<p class="entrega-aviso">${ICONES.atrasada}<span>${esc(aviso)}</span></p>` : ""}
    </article>`;
  }

  /** A visualização: resumo por situação, os cartões e, para o administrador, "Nova entrega". */
  function desenhar(alvo, dados) {
    d = dados;
    const lista = d.entregas;
    const conta = Object.keys(SITUACOES_DA_ENTREGA).map((s) => [s, lista.filter((e) => (e.situacao ?? SITUACAO_INICIAL) === s).length]).filter(([, n]) => n);
    alvo.innerHTML = `<section class="entregas">
      <div class="entregas-cabeca">
        <p class="tec">Os resultados do Plano de Ação que importam para o PEI/PDI. ${pode() ? "Abra uma entrega para registrar o alcance, com evidência, ou mudar a situação." : "Só o administrador do espaço registra o alcance e muda a situação."}</p>
        ${pode() ? `<button class="botao principal" type="button" data-nova-entrega>${ICONES.mais}Nova entrega</button>` : ""}
      </div>
      ${conta.length ? `<p class="entregas-resumo">${conta.map(([s, n]) => `${seloDaSituacao(s)} <b>${n}</b>`).join(" ")}</p>` : ""}
      ${lista.length ? `<div class="lista-entregas">${lista.map(cartaoHtml).join("")}</div>`
        : `<div class="entregas-vazio"><p><b>Este Plano de Ação ainda não tem entregas.</b> Ele fica como rascunho até ter pelo menos uma.</p>
            <p class="tec">Uma entrega é um resultado do plano como um todo, com meta: percentual (como “95% dos pedidos atendidos em 24 horas”), quantitativa (“10 Procedimentos-Padrão publicados”) ou entrega padrão, feita ou não (“Relatório homologado”).</p></div>`}
    </section>`;
    redesenharPainel?.();
  }

  /** Clique na visualização: abre uma entrega ou o cadastro. */
  function aoClicar(e) {
    const abrir = e.target.closest("[data-abrir-entrega]");
    if (abrir) { abrirEntrega(abrir.dataset.abrirEntrega); return true; }
    if (e.target.closest("[data-nova-entrega]")) { abrirCadastro(null); return true; }
    return false;
  }
  function aoTeclar(e) {
    if (!["Enter", " "].includes(e.key)) return false;
    const abrir = e.target.closest?.("[data-abrir-entrega]");
    if (!abrir) return false;
    e.preventDefault();
    abrirEntrega(abrir.dataset.abrirEntrega);
    return true;
  }

  /* ---------- cadastro (nova e editar) ---------- */
  function responsaveisHtml(nome, marcados) {
    if (!d.responsaveis.length) return "";
    return `<fieldset class="escolha-pessoas"><legend>${nome === "realizadores" ? "Quem realizou <small>(opcional)</small>" : "Responsáveis <small>(opcional)</small>"}</legend>
      ${d.responsaveis.map((r) => `<label class="alternar"><input type="checkbox" name="${nome}" value="${esc(r.id)}"${marcados.includes(r.id) ? " checked" : ""}> ${esc(r.sigla ? `${r.sigla} · ${r.nome}` : r.nome)}</label>`).join("")}</fieldset>`;
  }
  function cadastroHtml(e) {
    const temAlcance = e && registrosDa(e.id, d.alcances).length > 0;
    const tipo = e?.tipoMeta ?? "quantitativa";
    return `<form class="editor form-entrega" data-form-cadastro>
      <label class="campo"><span>Título</span><input name="titulo" maxlength="200" required value="${esc(e?.titulo ?? "")}" placeholder="O que se quer alcançar"></label>
      <label class="campo"><span>Descrição <small>(opcional)</small></span><textarea name="descricao" rows="2" maxlength="2000">${esc(e?.descricao ?? "")}</textarea></label>
      <fieldset class="tipo-meta"${temAlcance ? " disabled" : ""}><legend>Tipo de meta</legend>
        ${Object.entries(TIPOS_DE_META).map(([v, t]) => `<label class="tipo-opcao"><input type="radio" name="tipoMeta" value="${v}"${v === tipo ? " checked" : ""}>
          <span><b>${t.nome}</b><small>${t.explicacao}</small></span></label>`).join("")}
      </fieldset>
      <div class="campos-lado-a-lado" data-campos-meta${tipo === "padrao" ? " hidden" : ""}>
        <label class="campo"><span data-rotulo-meta>${tipo === "percentual" ? "Meta (%)" : "Meta"}</span><input name="meta" type="number" min="0" step="any" value="${e?.meta ?? ""}"${temAlcance ? " disabled" : ""}></label>
        <label class="campo" data-campo-unidade${tipo === "quantitativa" ? "" : " hidden"}><span>Unidade <small>(opcional)</small></span><input name="unidade" maxlength="40" value="${esc(e?.unidade ?? "")}" placeholder="POPs, processos…"${temAlcance ? " disabled" : ""}></label>
      </div>
      ${temAlcance ? '<p class="tec">Já há alcance registrado: o tipo de meta e a meta não mudam mais, para os registros continuarem comparáveis.</p>' : ""}
      <label class="campo"><span>Prazo <small>(opcional)</small></span><input name="prazo" type="date" value="${esc(e?.prazo ?? "")}"></label>
      ${responsaveisHtml("responsaveis", e?.responsaveis ?? [])}
      <div class="botoes"><button class="botao principal" type="submit">${e ? "Salvar" : "Cadastrar"}</button>${e ? '<button class="botao" type="button" data-voltar>Cancelar</button>' : ""}</div>
    </form>`;
  }
  function lerCadastro(form, e) {
    const f = new FormData(form);
    const temAlcance = e && registrosDa(e.id, d.alcances).length > 0;
    const dados = {
      titulo: f.get("titulo"), descricao: f.get("descricao"), prazo: f.get("prazo") || null,
      responsaveis: f.getAll("responsaveis").map(String),
    };
    if (!temAlcance) {
      dados.tipoMeta = f.get("tipoMeta");
      dados.meta = dados.tipoMeta === "padrao" ? null : f.get("meta") === "" ? null : Number(f.get("meta"));
      dados.unidade = dados.tipoMeta === "quantitativa" ? f.get("unidade") : null;
    }
    return dados;
  }
  function ligarTipoDeMeta(form) {
    form.addEventListener("change", (ev) => {
      if (ev.target.name !== "tipoMeta") return;
      const v = ev.target.value;
      form.querySelector("[data-campos-meta]").hidden = v === "padrao";
      form.querySelector("[data-campo-unidade]").hidden = v !== "quantitativa";
      form.querySelector("[data-rotulo-meta]").textContent = v === "percentual" ? "Meta (%)" : "Meta";
    });
  }
  function abrirCadastro() {
    const corpo = abrirPainel("Nova entrega", cadastroHtml(null));
    const form = corpo.querySelector("form");
    ligarTipoDeMeta(form);
    form.querySelector('[name="titulo"]').focus();
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      let id = null;
      if (await gravar(async () => { id = await store.criarEntrega(espacoId, lerCadastro(form, null)); }, "Entrega cadastrada.")) abrirEntrega(id);
    });
  }

  /* ---------- painel da entrega ---------- */
  function evidenciaHtml(v) {
    const ref = v.link ? `<a href="${esc(v.link)}" target="_blank" rel="noopener noreferrer">${esc(v.identificacao || v.link)}</a>` : esc(v.identificacao);
    return `<li>${esc(v.descricao)}: ${ref}</li>`;
  }
  function historicoHtml(e) {
    const registros = registrosDa(e.id, d.alcances).reverse();
    const mudancas = [...(e.mudancasDeSituacao ?? [])].reverse();
    const quem = (email) => d.responsaveis.find((r) => r.usuario === email)?.nome ?? email ?? "";
    return `<h4>Registros de alcance</h4>
      ${registros.length ? `<ol class="registros-alcance">${registros.map((r, i) => `<li${i === 0 ? ' class="atual"' : ""}>
        <div><b>${esc(textoDoValor(e, r.valor))}</b> <span class="tec">em ${dataBr(r.data)}${i === 0 ? " · alcance atual" : ""}</span></div>
        <p>${esc(r.descricao)}</p>
        <ul class="evidencias">${r.evidencias.map(evidenciaHtml).join("")}</ul>
        ${r.realizadores?.length ? `<small class="tec">Realizado por ${nomes(r.realizadores).map((p) => esc(p.nome)).join(", ")}</small>` : ""}
        <small class="tec">Registrado${r.registradoPor ? ` por ${esc(quem(r.registradoPor))}` : ""} em ${dataBr(r.registradoEm.slice(0, 10))}</small>
      </li>`).join("")}</ol>` : '<p class="vazio">Nenhum registro ainda.</p>'}
      ${mudancas.length ? `<h4>Mudanças de situação</h4><ol class="registros-alcance">${mudancas.map((m) => `<li>
        <div>${seloDaSituacao(m.situacao)} <span class="tec">em ${dataBr(m.em.slice(0, 10))}${m.por ? ` por ${esc(quem(m.por))}` : ""}</span></div>
        ${m.justificativa ? `<p>${esc(m.justificativa)}</p>` : ""}</li>`).join("")}</ol>` : ""}`;
  }
  function alcanceFormHtml(e) {
    const valor = e.tipoMeta === "padrao"
      ? `<fieldset class="opcoes-valor"><legend>A entrega foi feita?</legend>
          <label class="alternar"><input type="radio" name="valor" value="sim" required> Sim</label>
          <label class="alternar"><input type="radio" name="valor" value="nao"> Ainda não</label></fieldset>`
      : `<label class="campo"><span>Valor alcançado até esta data ${e.tipoMeta === "percentual" ? "(%)" : e.unidade ? `(${esc(e.unidade)})` : ""}</span>
          <input name="valor" type="number" min="0"${e.tipoMeta === "percentual" ? ' max="100"' : ""} step="any" required>
          <small>Meta: ${esc(textoDaMeta(e))}. Informe o total acumulado, e não só o desta vez.</small></label>`;
    return `<form class="editor form-entrega" data-form-alcance>
      <label class="campo"><span>Data do alcance</span><input name="data" type="date" required value="${esc(hoje)}" max="${esc(hoje)}"></label>
      ${valor}
      <label class="campo"><span>O que foi alcançado</span><textarea name="descricao" rows="2" maxlength="2000" required></textarea></label>
      <fieldset class="evidencias-form"><legend>Evidências <small>(pelo menos uma: a identificação no SIPAC/Protocolo ou o link)</small></legend>
        <div data-evidencias>${evidenciaFormHtml()}</div>
        <button class="botao-texto" type="button" data-mais-evidencia>${ICONES.mais}Evidência</button>
      </fieldset>
      ${responsaveisHtml("realizadores", [])}
      <p class="tec">O registro não muda depois de gravado. Um alcance novo vira um registro novo, e o mais recente é o alcance atual.</p>
      <div class="botoes"><button class="botao principal" type="submit">Registrar</button><button class="botao" type="button" data-voltar>Cancelar</button></div>
    </form>`;
  }
  const evidenciaFormHtml = () => `<div class="evidencia-form">
      <label class="campo"><span>Descrição</span><input name="evDescricao" maxlength="200" placeholder="Portaria, ata, relatório, página publicada…"></label>
      <div class="campos-lado-a-lado">
        <label class="campo"><span>Identificação <small>(SIPAC/Protocolo)</small></span><input name="evIdentificacao" maxlength="120"></label>
        <label class="campo"><span>Link</span><input name="evLink" type="url" maxlength="500" placeholder="https://…"></label>
      </div></div>`;
  function lerAlcance(form, e) {
    const f = new FormData(form);
    const [descricoes, ids, links] = ["evDescricao", "evIdentificacao", "evLink"].map((n) => f.getAll(n).map((x) => String(x).trim()));
    const evidencias = descricoes.map((descricao, i) => ({ descricao, identificacao: ids[i], link: links[i] }))
      .filter((v) => v.descricao || v.identificacao || v.link);
    const bruto = f.get("valor");
    return {
      data: f.get("data"), descricao: f.get("descricao"), evidencias, realizadores: f.getAll("realizadores").map(String),
      valor: e.tipoMeta === "padrao" ? (bruto === "sim" ? true : bruto === "nao" ? false : null) : bruto === "" || bruto == null ? null : Number(bruto),
    };
  }
  function situacaoFormHtml(e) {
    const atual = e.situacao ?? SITUACAO_INICIAL;
    return `<form class="editor form-entrega" data-form-situacao>
      <fieldset class="lista-situacoes-entrega"><legend>Situação</legend>
        ${Object.entries(SITUACOES_DA_ENTREGA).map(([v, s]) => `<label class="tipo-opcao"><input type="radio" name="situacao" value="${v}"${v === atual ? " checked" : ""}>
          <span>${seloDaSituacao(v)}<small>${s.explicacao}${s.exigeAlcance ? " Pede um registro de alcance antes." : ""}</small></span></label>`).join("")}
      </fieldset>
      <label class="campo"><span>Justificativa <small data-justificativa-nota></small></span><textarea name="justificativa" rows="3" maxlength="2000">${esc(e.justificativa ?? "")}</textarea></label>
      <p class="entrega-aviso" data-aviso-coerencia hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">Salvar situação</button><button class="botao" type="button" data-voltar>Cancelar</button></div>
    </form>`;
  }
  function ligarSituacao(form, e) {
    const atualizar = () => {
      const s = form.querySelector('[name="situacao"]:checked')?.value;
      const def = SITUACOES_DA_ENTREGA[s];
      form.querySelector("[data-justificativa-nota]").textContent = def?.exigeJustificativa ? "(obrigatória)"
        : def?.justificativaAoEncerrar ? "(opcional agora; obrigatória para encerrar o plano)" : "(opcional)";
      const aviso = s ? avisoDeCoerencia(e, s, d.alcances) : null;
      const el = form.querySelector("[data-aviso-coerencia]");
      el.hidden = !aviso;
      el.innerHTML = aviso ? `${ICONES.atrasada}<span>${esc(aviso)}</span>` : "";
    };
    form.addEventListener("change", atualizar);
    atualizar();
  }

  function abrirEntrega(id) {
    const e0 = d.entregas.find((x) => x.id === id);
    if (!e0) return;
    aberta = { id, modo: null };
    const corpo = abrirPainel("Entrega", "", { aoFechar: () => { aberta = null; redesenharPainel = null; } });
    const desenharPainel = () => {
      const e = d?.entregas.find((x) => x.id === aberta?.id);
      if (!e) { fecharPainel(); return; }
      /* com um formulário aberto, os dados novos não apagam o que se digita */
      if (aberta.modo && corpo.querySelector("form")) return;
      const donos = nomes(e.responsaveis);
      const temAlcance = registrosDa(e.id, d.alcances).length > 0;
      const aviso = avisoDeCoerencia(e, e.situacao ?? SITUACAO_INICIAL, d.alcances);
      const formulario = aberta.modo === "alcance" ? alcanceFormHtml(e) : aberta.modo === "situacao" ? situacaoFormHtml(e)
        : aberta.modo === "editar" ? cadastroHtml(e) : "";
      corpo.innerHTML = `<div class="painel-entrega">
        <div class="entrega-topo"><h3>${esc(e.titulo)}</h3>${seloDaSituacao(e.situacao ?? SITUACAO_INICIAL)}</div>
        ${e.descricao ? `<p>${esc(e.descricao)}</p>` : ""}
        <dl class="ficha-estrategia">
          <div><dt>Meta</dt><dd>${esc(textoDaMeta(e))} <small class="tec">${esc(TIPOS_DE_META[e.tipoMeta]?.nome ?? "")}</small></dd></div>
          ${e.prazo ? `<div><dt>Prazo</dt><dd>${dataBr(e.prazo)}</dd></div>` : ""}
          ${donos.length ? `<div><dt>Responsáveis</dt><dd>${donos.map((p) => esc(p.nome)).join(", ")}</dd></div>` : ""}
        </dl>
        ${barraHtml(e)}
        ${e.justificativa ? `<p class="entrega-justificativa"><b>Justificativa:</b> ${esc(e.justificativa)}</p>` : ""}
        ${aviso ? `<p class="entrega-aviso">${ICONES.atrasada}<span>${esc(aviso)}</span></p>` : ""}
        ${pode() && !aberta.modo ? `<div class="botoes">
          <button class="botao principal" type="button" data-modo-entrega="alcance">Registrar alcance</button>
          <button class="botao" type="button" data-modo-entrega="situacao">Mudar situação</button>
          <button class="botao" type="button" data-modo-entrega="editar">Editar</button></div>` : ""}
        ${formulario}
        ${aberta.modo ? "" : historicoHtml(e)}
        ${pode() && !aberta.modo && !temAlcance ? `<div class="zona-exclusao">${aberta.excluindo
          ? `<div class="aviso-confirmar"><p>Excluir esta entrega? Use só para corrigir um cadastro errado; uma entrega que deixou de fazer sentido se marca como Cancelada.</p>
            <div class="botoes"><button class="botao principal" type="button" data-confirmar-excluir-entrega>Excluir</button><button class="botao" type="button" data-cancelar-excluir-entrega>Cancelar</button></div></div>`
          : '<button class="botao-excluir" type="button" data-excluir-entrega>Excluir entrega</button>'}</div>` : ""}
      </div>`;
      const form = corpo.querySelector("form");
      if (form?.matches("[data-form-cadastro]")) ligarTipoDeMeta(form);
      if (form?.matches("[data-form-situacao]")) ligarSituacao(form, e);
      form?.querySelector("input:not([type=radio]):not([disabled]), textarea")?.focus();
    };
    redesenharPainel = desenharPainel;
    const voltar = () => { aberta.modo = null; aberta.excluindo = false; corpo.innerHTML = ""; desenharPainel(); };
    corpo.addEventListener("click", async (ev) => {
      const t = ev.target.closest("button");
      if (!t) return;
      if (t.dataset.modoEntrega) { aberta.modo = t.dataset.modoEntrega; corpo.innerHTML = ""; desenharPainel(); return; }
      if (t.matches("[data-voltar]")) { voltar(); return; }
      if (t.matches("[data-mais-evidencia]")) { corpo.querySelector("[data-evidencias]").insertAdjacentHTML("beforeend", evidenciaFormHtml()); return; }
      if (t.matches("[data-excluir-entrega]")) { aberta.excluindo = true; desenharPainel(); return; }
      if (t.matches("[data-cancelar-excluir-entrega]")) { aberta.excluindo = false; desenharPainel(); return; }
      if (t.matches("[data-confirmar-excluir-entrega]")) {
        const id = aberta.id;
        fecharPainel();
        await gravar(() => store.excluirEntrega(espacoId, id), "Entrega excluída.");
      }
    });
    corpo.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const form = ev.target;
      const e = d.entregas.find((x) => x.id === aberta.id);
      const botao = form.querySelector('[type="submit"]');
      botao.disabled = true;
      let ok = false;
      if (form.matches("[data-form-alcance]")) ok = await gravar(() => store.registrarAlcance(espacoId, e.id, lerAlcance(form, e)), "Alcance registrado.");
      else if (form.matches("[data-form-situacao]")) {
        const f = new FormData(form);
        ok = await gravar(() => store.mudarSituacaoDaEntrega(espacoId, e.id, { situacao: f.get("situacao"), justificativa: f.get("justificativa") }), "Situação salva.");
      } else if (form.matches("[data-form-cadastro]")) ok = await gravar(() => store.alterarEntrega(espacoId, e.id, lerCadastro(form, e)), "Entrega salva.");
      if (ok) voltar(); else botao.disabled = false;
    });
    desenharPainel();
  }

  return { desenhar, aoClicar, aoTeclar };
}
