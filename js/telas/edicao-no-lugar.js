/**
 * Edição no lugar (22/10/2026, pedido do responsável): na lista, no quadro e na rede, quem pode
 * gravar edita o nome, a descrição ou os participantes de uma ação com Alt+clique no próprio campo,
 * sem abrir a janela da ação. Situação, datas e barras são calculadas e não se editam.
 */
import { esc } from "../formato.js";
import { seloHtml } from "./pessoas.js";
import { avisar } from "./painel.js";

/**
 * Transforma o texto do elemento numa caixa editável.
 * Uma linha: Enter grava. Várias linhas: Ctrl+Enter (ou Cmd+Enter) grava. Esc cancela. Sair do campo grava.
 * @param {HTMLElement} el
 * @param {{valor: string, multilinha?: boolean, aoGravar: (novo: string) => Promise<void>, aoTerminar: () => void}} opcoes
 */
export function editarTexto(el, { valor, multilinha = false, aoGravar, aoTerminar }) {
  const original = valor ?? "";
  el.textContent = original;
  el.contentEditable = "plaintext-only";
  if (el.contentEditable !== "plaintext-only") el.contentEditable = "true"; // navegador sem "plaintext-only"
  el.dataset.editando = "";
  el.classList.add("editando-no-lugar");
  el.setAttribute("role", "textbox");
  if (multilinha) el.setAttribute("aria-multiline", "true");
  el.focus();
  const faixa = document.createRange();
  faixa.selectNodeContents(el);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(faixa);

  let terminou = false;
  const aoTeclar = (e) => {
    e.stopPropagation(); // Enter e espaço não abrem a ação; Esc não fecha outros painéis
    if (e.key === "Escape") { e.preventDefault(); terminar(false); }
    else if (e.key === "Enter" && (!multilinha || e.ctrlKey || e.metaKey)) { e.preventDefault(); terminar(true); }
  };
  const aoSair = () => terminar(true);
  el.addEventListener("keydown", aoTeclar);
  el.addEventListener("blur", aoSair);

  async function terminar(gravar) {
    if (terminou) return;
    terminou = true;
    el.removeEventListener("keydown", aoTeclar);
    el.removeEventListener("blur", aoSair);
    const novo = (el.innerText ?? el.textContent).replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
    el.removeAttribute("contenteditable");
    el.removeAttribute("role");
    el.removeAttribute("aria-multiline");
    el.classList.remove("editando-no-lugar");
    delete el.dataset.editando;
    try {
      if (gravar && novo !== original.trim()) await aoGravar(novo);
      else el.textContent = original;
    } catch (falha) {
      el.textContent = original;
      avisar(falha.message);
    } finally {
      aoTerminar();
    }
  }
}

/**
 * Lista curta, presa ao campo, para marcar e desmarcar os participantes; cada marca grava na hora.
 * Fecha com Esc, com clique fora ou ao rolar a página.
 * @param {HTMLElement} ancora
 * @param {{responsaveis: object[], marcados: string[], tons?: object, aoMudar: (id: string, ligado: boolean) => Promise<void>}} opcoes
 */
export function escolherParticipantes(ancora, { responsaveis, marcados, tons, aoMudar }) {
  document.querySelector(".escolher-participantes")?.remove();
  const ordenados = [...responsaveis].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  const caixa = document.createElement("div");
  caixa.className = "popover escolher-participantes";
  caixa.tabIndex = -1;
  caixa.setAttribute("role", "dialog");
  caixa.setAttribute("aria-label", "Participantes da ação");
  caixa.innerHTML = `<h3>Participantes</h3>
    ${ordenados.length > 8 ? `<input type="search" class="busca-participantes" placeholder="Buscar" aria-label="Buscar responsável">` : ""}
    <div class="opcoes-participantes">${ordenados.map((r) => `
      <label data-nome="${esc(`${r.nome} ${r.sigla ?? ""}`.toLowerCase())}"><input type="checkbox" value="${esc(r.id)}"${marcados.includes(r.id) ? " checked" : ""}>
        ${seloHtml(r, { tons })}<span>${esc(r.nome)}</span></label>`).join("") || `<p class="tec">Nenhum responsável cadastrado neste espaço.</p>`}</div>`;
  document.body.append(caixa);

  /* abaixo do campo; sem espaço, acima; sempre dentro da janela */
  const r = ancora.getBoundingClientRect();
  const largura = caixa.offsetWidth;
  const altura = caixa.offsetHeight;
  caixa.style.left = `${Math.max(8, Math.min(r.left, innerWidth - largura - 8))}px`;
  caixa.style.top = `${r.bottom + 6 + altura > innerHeight ? Math.max(8, r.top - altura - 6) : r.bottom + 6}px`;
  (caixa.querySelector("input") ?? caixa).focus?.();

  caixa.addEventListener("change", async (e) => {
    const caixinha = e.target;
    if (caixinha.type !== "checkbox") return;
    caixinha.disabled = true;
    try { await aoMudar(caixinha.value, caixinha.checked); }
    catch (falha) { caixinha.checked = !caixinha.checked; avisar(falha.message); }
    finally { caixinha.disabled = false; }
  });
  caixa.addEventListener("input", (e) => {
    if (!e.target.matches(".busca-participantes")) return;
    const termo = e.target.value.trim().toLowerCase();
    for (const l of caixa.querySelectorAll("label[data-nome]")) l.hidden = Boolean(termo) && !l.dataset.nome.includes(termo);
  });

  const fechar = () => {
    caixa.remove();
    document.removeEventListener("pointerdown", fora, true);
    document.removeEventListener("keydown", tecla, true);
    removeEventListener("scroll", rolou, true);
  };
  const fora = (e) => { if (!caixa.contains(e.target)) fechar(); };
  const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); fechar(); ancora.closest("[data-abrir-acao]")?.focus(); } };
  const rolou = (e) => { if (!caixa.contains(e.target)) fechar(); };
  setTimeout(() => {
    document.addEventListener("pointerdown", fora, true);
    document.addEventListener("keydown", tecla, true);
    addEventListener("scroll", rolou, true);
  });
  return fechar;
}
