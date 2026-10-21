/**
 * Aba Responsáveis (especificação, seções 4.5 e 8.2; passo 1.12).
 * Lista global, igual em todos os espaços, separada em pessoas e unidades, com busca.
 * Cadastro e edição no lugar: tipo, nome, sigla, setor e, para pessoas, o e-mail de login,
 * que faz funcionar "Minhas ações". O tipo só muda para corrigir erro de cadastro.
 * A exclusão chega com a lixeira (passo 1.15).
 */
import { esc, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { buscar } from "../acao.js";
import { seloHtml } from "./pessoas.js";
import { avisar } from "./painel.js";

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

  function formularioHtml(r) {
    const tipo = r?.tipo ?? "pessoa";
    return `<form class="editor cartao-form form-responsavel" data-form-responsavel="${r ? esc(r.id) : "novo"}">
      <h4>${r ? "Editar responsável" : "Novo responsável"}</h4>
      <fieldset class="tipo-responsavel"><legend>Tipo</legend>
        <label><input type="radio" name="tipo" value="pessoa"${tipo === "pessoa" ? " checked" : ""}> Pessoa</label>
        <label><input type="radio" name="tipo" value="unidade"${tipo === "unidade" ? " checked" : ""}> Unidade <small>(setor, equipe ou grupo)</small></label>
        ${r ? `<small class="tec">Mude o tipo só para corrigir erro de cadastro.</small>` : ""}
      </fieldset>
      <label class="campo"><span>Nome</span><input name="nome" maxlength="120" required value="${esc(r?.nome ?? "")}"></label>
      <div class="campos-lado-a-lado">
        <label class="campo"><span>Sigla <small>(opcional)</small></span><input name="sigla" maxlength="12" value="${esc(r?.sigla ?? "")}"></label>
        <label class="campo"><span>Setor <small>(opcional)</small></span><input name="setor" maxlength="80" value="${esc(r?.setor ?? "")}"></label>
      </div>
      <label class="campo" data-so-pessoa${tipo === "unidade" ? " hidden" : ""}><span>E-mail de login <small>(opcional)</small></span>
        <input name="usuario" type="email" inputmode="email" autocomplete="off" value="${esc(r?.usuario ?? "")}" placeholder="nome@ufci.edu.br">
        <small>Liga a pessoa a quem entra no sistema com este e-mail, para funcionar "Minhas ações".</small></label>
      <p class="erro" data-erro hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">Salvar</button><button class="botao" type="button" data-cancelar-responsavel>Cancelar</button></div>
    </form>`;
  }

  function linhaHtml(r, contagem) {
    if (editando === r.id) return formularioHtml(r);
    const n = contagem.get(r.id) ?? 0;
    const detalhes = [r.sigla && r.tipo !== "unidade" ? r.sigla : "", r.setor].filter(Boolean).map(esc).join(" · ");
    return `<div class="responsavel editavel" data-editar-responsavel="${esc(r.id)}" role="button" tabindex="0" title="Clique para editar">
      ${seloHtml(r, { tons: d.espaco.tons, meus: d.meus })}
      <div class="responsavel-texto"><b>${esc(r.nome)}</b>${detalhes ? `<span class="tec">${detalhes}</span>` : ""}
        ${r.tipo === "pessoa" ? `<span class="tec">${r.usuario ? `Login: ${esc(r.usuario)}` : "Sem login"}</span>` : ""}</div>
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
        <input type="search" data-busca-responsaveis placeholder="Buscar por nome, sigla, setor ou e-mail" aria-label="Buscar responsáveis" value="${esc(texto)}">
        <button class="botao principal" type="button" data-novo-responsavel>${ICONES.mais}Novo responsável</button>
      </div>
      <p class="tec">Os responsáveis são os mesmos em todos os espaços. Pessoas aparecem em círculos com as iniciais; unidades, em quadrados com a sigla.</p>
      ${editando === "novo" ? formularioHtml(null) : ""}
      ${grupo("Pessoas", achados.filter((r) => r.tipo !== "unidade"))}
      ${grupo("Unidades", achados.filter((r) => r.tipo === "unidade"))}`;
    restaurarValores(valores);
    if (trocou) ligar();
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
      novo.querySelector("[data-so-pessoa]").hidden = form.tipo === "unidade";
    }
    if (foco === "busca") {
      const busca = alvo.querySelector("[data-busca-responsaveis]");
      busca.focus();
      busca.setSelectionRange(busca.value.length, busca.value.length);
    } else if (foco) novo?.querySelector(`[name="${foco}"]`)?.focus();
  }

  function redesenhar() { desenhar(alvo, d); }

  async function salvar(form) {
    const f = Object.fromEntries(new FormData(form));
    const erro = form.querySelector("[data-erro]");
    const dados = {
      tipo: f.tipo,
      nome: f.nome,
      sigla: f.sigla ?? "",
      setor: (f.setor ?? "").trim(),
      usuario: f.tipo === "pessoa" ? (f.usuario ?? "").trim() : "",
    };
    try {
      if (form.dataset.formResponsavel === "novo") {
        if (!dados.usuario) delete dados.usuario;
        await store.criarResponsavel(dados);
        avisar(`Cadastro salvo: ${dados.nome.trim()}.`);
      } else {
        await store.alterarResponsavel(form.dataset.formResponsavel, dados);
      }
      editando = null;
      redesenhar();
    } catch (e) {
      erro.textContent = e.message;
      erro.hidden = false;
    }
  }

  function ligar() {
    alvo.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-novo-responsavel]")) { editando = "novo"; redesenhar(); alvo.querySelector('[name="nome"]')?.focus(); return; }
      if (t.closest("[data-cancelar-responsavel]")) { editando = null; redesenhar(); return; }
      const r = t.closest("[data-editar-responsavel]");
      if (r) { editando = r.dataset.editarResponsavel; redesenhar(); alvo.querySelector('[name="nome"]')?.focus(); }
    });
    alvo.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-editar-responsavel]")) { e.preventDefault(); e.target.click(); }
      if (e.key === "Escape" && editando) { e.preventDefault(); editando = null; redesenhar(); }
    });
    alvo.addEventListener("input", (e) => {
      if (e.target.matches("[data-busca-responsaveis]")) { texto = e.target.value; redesenhar(); }
    });
    alvo.addEventListener("change", (e) => {
      if (e.target.name === "tipo") e.target.closest("form").querySelector("[data-so-pessoa]").hidden = e.target.value === "unidade";
    });
    alvo.addEventListener("submit", (e) => { e.preventDefault(); salvar(e.target); });
  }

  return { desenhar };
}
