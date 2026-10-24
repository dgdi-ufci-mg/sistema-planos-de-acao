/**
 * Responsáveis do espaço (documentação técnica, seção 4.5; passos 1.12 e 1.14b), na seção "Responsáveis"
 * de "Configurar este espaço". Cada espaço tem a sua lista, separada em pessoas e unidades, com busca.
 * Cadastro e edição no lugar: tipo, nome, sigla, setor e, para pessoas, o e-mail de login,
 * que faz funcionar "Minhas ações". O tipo é escolhido só no cadastro e não muda depois.
 * A exclusão vai para a lixeira, com "substituir por" nas ações (passo 1.15; js/telas/exclusao.js).
 */
import { esc, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { buscar } from "../acao.js";
import { seloHtml } from "./pessoas.js";
import { avisar } from "./painel.js";
import { abrirSuave, fecharSuave } from "./movimento.js";
import { excluirResponsavel } from "./exclusao.js";
import { PAPEIS, nomeDoPapel, papelDe, semAdministracao } from "../papeis.js";

/**
 * @param {{store: object}} contexto
 * @returns {{desenhar: (alvo: HTMLElement, dados: {espaco: object, acoes: object[], responsaveis: object[], meus: string[]|null}) => void}}
 */
export function criarTelaResponsaveis({ store }) {
  let d = null;
  let alvo = null;
  let texto = "";
  /** id do responsável em edição, "novo" para o cadastro, ou null. */
  let editando = null;
  /** o formulário acabou de ser aberto: anima a abertura no próximo desenho (e só nele) */
  let animarAbertura = false;

  function formularioHtml(r) {
    const tipo = r?.tipo ?? "pessoa";
    return `<form class="editor cartao-form form-responsavel" data-form-responsavel="${r ? esc(r.id) : "novo"}">
      <h4>${r ? "Editar responsável" : "Novo responsável"}</h4>
      ${r ? `<p class="tec">${tipo === "pessoa" ? "Pessoa" : "Unidade"}. O tipo não muda depois do cadastro: se estiver errado, cadastre de novo
        com o tipo certo e exclua este, substituindo-o nas ações.</p>
        <input type="hidden" name="tipo" value="${tipo}">`
      : `<div class="campo"><span id="rotulo-tipo">Tipo</span>
        <div class="alternador" role="radiogroup" aria-labelledby="rotulo-tipo">
          <label><input type="radio" name="tipo" value="pessoa" checked><span>Pessoa</span></label>
          <label><input type="radio" name="tipo" value="unidade"><span>Unidade</span></label>
        </div>
        <small>Unidade: setor, equipe ou grupo.</small></div>`}
      <label class="campo"><span>Nome</span><input name="nome" maxlength="120" required value="${esc(r?.nome ?? "")}"></label>
      <div class="campos-lado-a-lado">
        <label class="campo"><span>Sigla <small>(opcional)</small></span><input name="sigla" maxlength="12" value="${esc(r?.sigla ?? "")}"></label>
        <label class="campo"><span>Setor <small>(opcional)</small></span><input name="setor" maxlength="80" value="${esc(r?.setor ?? "")}"></label>
      </div>
      <label class="campo" data-so-pessoa${tipo === "unidade" ? " hidden" : ""}><span>E-mail de login <small>(opcional)</small></span>
        <input name="usuario" type="email" inputmode="email" autocomplete="off" value="${esc(r?.usuario ?? "")}" placeholder="nome@ufci.edu.br">
        <small>Liga a pessoa a quem entra no sistema com este e-mail, para funcionar "Minhas ações" e dar a ela um papel no espaço.</small></label>
      ${semAdministracao(d.espaco) ? "" : `<label class="campo" data-so-pessoa${tipo === "unidade" ? " hidden" : ""}><span>Papel neste espaço</span>
        <select name="papel">${PAPEIS.map(([v, nome]) => `<option value="${v}"${v === (r?.usuario ? papelDe(d.espaco, r.usuario) ?? "" : "usuario") ? " selected" : ""}>${nome}</option>`).join("")}
          <option value=""${r?.usuario && !papelDe(d.espaco, r.usuario) ? " selected" : ""}>Sem papel (só consulta)</option></select>
        <small>Vale só com o e-mail de login. ${PAPEIS.map(([, nome, oQue]) => `${nome}: ${oQue.charAt(0).toLowerCase()}${oQue.slice(1)}`).join(" ")}</small></label>`}
      <p class="erro" data-erro hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">Salvar</button><button class="botao" type="button" data-cancelar-responsavel>Cancelar</button>
        ${r ? '<button class="botao-excluir" type="button" data-excluir-responsavel>Excluir</button>' : ""}</div>
    </form>`;
  }

  function linhaHtml(r, contagem) {
    if (editando === r.id) return formularioHtml(r);
    const n = contagem.get(r.id) ?? 0;
    const detalhes = [r.sigla && r.tipo !== "unidade" ? r.sigla : "", r.setor].filter(Boolean).map(esc).join(" · ");
    /* só o administrador do espaço edita (passo 2.1) */
    if (!d.podeEditar) {
      return `<div class="responsavel">${seloHtml(r, { tons: d.espaco.tons, meus: d.meus })}
        <div class="responsavel-texto"><b>${esc(r.nome)}</b>${detalhes ? `<span class="tec">${detalhes}</span>` : ""}
          ${r.tipo === "pessoa" ? `<span class="tec">${r.usuario ? `Login: ${esc(r.usuario)}${semAdministracao(d.espaco) ? "" : ` · ${esc(nomeDoPapel(papelDe(d.espaco, r.usuario)))}`}` : "Sem login"}</span>` : ""}</div>
        <span class="responsavel-contagem">${n ? `${n} ${plural(n, "ação", "ações")} neste espaço` : "Nenhuma ação neste espaço"}</span>
      </div>`;
    }
    return `<div class="responsavel editavel" data-editar-responsavel="${esc(r.id)}" role="button" tabindex="0" title="Clique para editar">
      ${seloHtml(r, { tons: d.espaco.tons, meus: d.meus })}
      <div class="responsavel-texto"><b>${esc(r.nome)}</b>${detalhes ? `<span class="tec">${detalhes}</span>` : ""}
        ${r.tipo === "pessoa" ? `<span class="tec">${r.usuario ? `Login: ${esc(r.usuario)}${semAdministracao(d.espaco) ? "" : ` · ${esc(nomeDoPapel(papelDe(d.espaco, r.usuario)))}`}` : "Sem login"}</span>` : ""}</div>
      <span class="responsavel-contagem">${n ? `${n} ${plural(n, "ação", "ações")} neste espaço` : "Nenhuma ação neste espaço"}</span>
    </div>`;
  }

  function desenhar(novoAlvo, dados) {
    d = dados;
    const trocou = alvo !== novoAlvo;
    alvo = novoAlvo;
    const valores = guardarValores();
    const contagem = new Map();
    for (const a of d.acoes) for (const id of a.responsaveis ?? []) contagem.set(id, (contagem.get(id) ?? 0) + 1);
    const ordenados = [...d.responsaveis].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const achados = buscar(ordenados, texto, (r) => [r.nome, r.sigla, r.setor, r.usuario]);
    const grupo = (titulo, lista) => `<section class="grupo-responsaveis">
      <h3>${titulo} <span class="n">${lista.length}</span></h3>
      ${lista.map((r) => linhaHtml(r, contagem)).join("") || `<p class="vazio">Nenhum${texto ? " com essa busca" : ""}.</p>`}
    </section>`;
    alvo.innerHTML = `
      <div class="ferramentas-responsaveis">
        <input type="search" data-busca-responsaveis placeholder="Buscar responsável" aria-label="Buscar responsáveis" value="${esc(texto)}">
        ${d.podeEditar ? `<button class="botao principal" type="button" data-novo-responsavel>${ICONES.mais}Novo responsável</button>` : ""}
      </div>
      <p class="tec">Pessoas e unidades deste espaço; não aparecem nos outros. Pessoas aparecem em círculos com as iniciais; unidades, em quadrados com a sigla.</p>
      ${editando === "novo" ? formularioHtml(null) : ""}
      ${grupo("Pessoas", achados.filter((r) => r.tipo !== "unidade"))}
      ${grupo("Unidades", achados.filter((r) => r.tipo === "unidade"))}`;
    restaurarValores(valores);
    if (trocou) ligar();
    if (animarAbertura) { animarAbertura = false; abrirSuave(alvo.querySelector("[data-form-responsavel]")); }
  }

  /* valores digitados num formulário aberto sobrevivem a um redesenho causado por outra gravação */
  function guardarValores() {
    const form = alvo?.querySelector("[data-form-responsavel]");
    const ativo = document.activeElement;
    return {
      form: form ? Object.fromEntries(new FormData(form)) : null,
      foco: ativo && alvo?.contains(ativo) ? (ativo.name || (ativo.matches("[data-busca-responsaveis]") ? "busca" : null)) : null,
    };
  }
  function restaurarValores({ form, foco }) {
    const novo = alvo.querySelector("[data-form-responsavel]");
    if (form && novo) {
      for (const [k, v] of Object.entries(form)) {
        for (const el of novo.querySelectorAll(`[name="${k}"]`)) {
          if (el.type === "radio") el.checked = el.value === v;
          else el.value = v;
        }
      }
      for (const el of novo.querySelectorAll("[data-so-pessoa]")) el.hidden = form.tipo === "unidade";
    }
    if (foco === "busca") {
      const busca = alvo.querySelector("[data-busca-responsaveis]");
      busca.focus();
      busca.setSelectionRange(busca.value.length, busca.value.length);
    } else if (foco) novo?.querySelector(`[name="${foco}"]`)?.focus();
  }

  function redesenhar() { desenhar(alvo, d); }
  /** Abre o formulário (de cadastro ou de edição) com a animação de abertura. */
  function abrir(qual) {
    editando = qual;
    animarAbertura = true;
    redesenhar();
    alvo.querySelector('[name="nome"]')?.focus();
  }
  /** Fecha o formulário aberto, com a animação de fechamento. */
  async function fechar() {
    await fecharSuave(alvo.querySelector("[data-form-responsavel]"));
    editando = null;
    redesenhar();
  }

  async function salvar(form) {
    const f = Object.fromEntries(new FormData(form));
    const erro = form.querySelector("[data-erro]");
    const dados = {
      nome: f.nome,
      sigla: f.sigla ?? "",
      setor: (f.setor ?? "").trim(),
      usuario: f.tipo === "pessoa" ? (f.usuario ?? "").trim() : "",
    };
    try {
      if (form.dataset.formResponsavel === "novo") {
        if (!dados.usuario) delete dados.usuario;
        await store.criarResponsavel(d.espaco.id, { tipo: f.tipo, ...dados });
        avisar(`Cadastro salvo: ${dados.nome.trim()}.`);
      } else {
        if (f.tipo === "unidade") delete dados.usuario;
        await store.alterarResponsavel(d.espaco.id, form.dataset.formResponsavel, dados);
      }
      /* papel no espaço (passo 2.1): com e-mail, grava o escolhido, se mudou */
      if (f.tipo === "pessoa" && dados.usuario && "papel" in f) {
        const espaco = await store.lerEspaco(d.espaco.id);
        if ((papelDe(espaco, dados.usuario) ?? "") !== f.papel) await store.definirPapel(d.espaco.id, dados.usuario, f.papel || null);
      }
      await fechar();
    } catch (e) {
      erro.textContent = e.message;
      erro.hidden = false;
    }
  }

  function ligar() {
    alvo.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-novo-responsavel]")) { if (editando !== "novo") abrir("novo"); return; }
      if (t.closest("[data-cancelar-responsavel]")) { fechar(); return; }
      if (t.closest("[data-excluir-responsavel]")) {
        const responsavel = d.responsaveis.find((x) => x.id === editando);
        excluirResponsavel({ store, espacoId: d.espaco.id, responsavel, acoes: d.acoes, responsaveis: d.responsaveis })
          .then((excluiu) => { if (excluiu) { editando = null; redesenhar(); } })
          .catch((e) => avisar(e.message));
        return;
      }
      const r = t.closest("[data-editar-responsavel]");
      if (r) abrir(r.dataset.editarResponsavel);
    });
    alvo.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-editar-responsavel]")) { e.preventDefault(); e.target.click(); }
      if (e.key === "Escape" && editando) { e.preventDefault(); fechar(); }
    });
    alvo.addEventListener("input", (e) => {
      if (e.target.matches("[data-busca-responsaveis]")) { texto = e.target.value; redesenhar(); }
    });
    alvo.addEventListener("change", (e) => {
      if (e.target.name === "tipo") {
        for (const bloco of e.target.closest("form").querySelectorAll("[data-so-pessoa]")) {
          bloco.hidden = e.target.value === "unidade";
          if (!bloco.hidden) abrirSuave(bloco);
        }
      }
    });
    alvo.addEventListener("submit", (e) => { e.preventDefault(); salvar(e.target); });
  }

  return { desenhar };
}
