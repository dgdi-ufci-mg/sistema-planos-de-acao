/**
 * Configurar o sistema (especificação, seções 5.1 e 8.1): por enquanto, o calendário geral,
 * com as datas sem expediente que valem para todos os espaços. Aberto pelo menu do usuário.
 * Até existirem os papéis (Fase 2), qualquer pessoa conectada pode editar; depois, só o
 * Administrador do Sistema.
 */
import { ligarSecoesSuaves } from "./movimento.js";
import { esc } from "../formato.js";
import { ICONES } from "../icones.js";
import { feriadosNacionais } from "../feriados.js";
import { abrirPainel, avisar } from "./painel.js";
import { marcarPendencias, AVISO_PENDENTE } from "./pendencias.js";

/** @param {{store: object, hoje: string}} opcoes */
export async function abrirConfiguracaoDoSistema({ store, hoje }) {
  let salvos = (await store.lerCalendarioGeral()).datasExcluidas;
  let rascunho = structuredClone(salvos);
  const anoAtual = Number(hoje.slice(0, 4));
  let anoFeriados = anoAtual + (Number(hoje.slice(5, 7)) >= 10 ? 1 : 0); // a partir de outubro, sugere o ano seguinte
  let novas = new Set(); // datas acrescentadas pelo botão, destacadas até salvar
  const corpo = abrirPainel("Configurar o sistema", "");
  ligarSecoesSuaves(corpo);

  function desenhar() {
    const porAno = new Map();
    rascunho.forEach((d, i) => {
      const ano = d.data ? d.data.slice(0, 4) : "Sem data";
      if (!porAno.has(ano)) porAno.set(ano, []);
      porAno.get(ano).push([d, i]);
    });
    corpo.innerHTML = `
      <section class="config">
        <h3>Calendário geral</h3>
        <p class="tec">Feriados nacionais, recessos e outras datas sem expediente na instituição. Valem para todos os espaços,
          que podem acrescentar datas próprias (feriados locais) e desconsiderar alguma desta lista.</p>
        <div class="feriados-ano">
          <label class="campo"><span>Feriados nacionais de</span>
            <select data-ano>${[anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2].map((a) => `<option${a === anoFeriados ? " selected" : ""}>${a}</option>`).join("")}</select></label>
          <button class="botao" type="button" data-feriados>${ICONES.mais}Acrescentar</button>
        </div>
        <form class="editor" data-salvar-calendario>
          ${[...porAno].sort(([a], [b]) => a.localeCompare(b)).map(([ano, itens]) => `<details class="ano-calendario"${novas.size || porAno.size === 1 || ano === String(anoFeriados) || ano === "Sem data" ? " open" : ""}>
            <summary>${esc(ano)} <span class="n">${itens.length}</span></summary>
            <div class="linhas-config">${itens.map(([d, i]) => `<div class="linha-config" data-linha-lista="${i}">
              <input type="date" data-indice="${i}" data-campo="data" value="${esc(d.data ?? "")}" aria-label="Data">
              <input data-indice="${i}" data-campo="motivo" value="${esc(d.motivo ?? "")}" placeholder="Motivo" aria-label="Motivo">
              <button type="button" class="tirar" data-tirar="${i}" aria-label="Retirar a data">${ICONES.fechar}</button>
            </div>`).join("")}</div>
          </details>`).join("") || `<p class="vazio">Nenhuma data cadastrada.</p>`}
          ${novas.size ? `<p class="aviso">Datas sugeridas, destacadas acima. As marcadas com ⚠️ são pontes prováveis. Revise antes de salvar: confira, corrija e acrescente o que faltar, como recessos e pontos facultativos do ano.</p>` : ""}
          <p class="erro" data-erro hidden></p>
          <div class="botoes"><button class="botao" type="button" data-acrescentar>${ICONES.mais}Data</button><button class="botao principal" type="submit">Salvar calendário</button>${AVISO_PENDENTE}</div>
        </form>
      </section>
      <p class="tec">Outras configurações gerais, como usuários e permissões, chegam nas próximas fases.</p>`;
    marcar();
  }
  const marcar = () => marcarPendencias(corpo.querySelector("[data-salvar-calendario]"), rascunho, salvos, ["data", "motivo"]);

  corpo.addEventListener("input", (e) => {
    const i = e.target.dataset.indice;
    if (i != null) { rascunho[Number(i)][e.target.dataset.campo] = e.target.value; marcar(); }
  });
  corpo.addEventListener("change", (e) => { if (e.target.matches("[data-ano]")) anoFeriados = Number(e.target.value); });
  corpo.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches("[data-feriados]")) {
      const existentes = new Set(rascunho.map((d) => d.data));
      const sugeridas = feriadosNacionais(anoFeriados).filter((f) => !existentes.has(f.data));
      rascunho = [...rascunho, ...sugeridas].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
      novas = new Set(sugeridas.map((f) => f.data));
      desenhar();
      avisar(sugeridas.length ? `${sugeridas.length} datas sugeridas para ${anoFeriados}. Revise e salve.` : `Os feriados nacionais de ${anoFeriados} já estão na lista.`);
    } else if (t.matches("[data-acrescentar]")) {
      rascunho.push({ data: "", motivo: "" });
      desenhar();
      const datas = corpo.querySelectorAll('input[data-campo="data"]');
      datas[datas.length - 1]?.focus();
    } else if (t.dataset.tirar != null) {
      rascunho.splice(Number(t.dataset.tirar), 1);
      desenhar();
    }
  });
  corpo.addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = corpo.querySelector("[data-erro]");
    try {
      await store.alterarCalendarioGeral(rascunho.map((d) => (d.motivo?.trim() ? { data: d.data, motivo: d.motivo.trim() } : { data: d.data })));
      salvos = (await store.lerCalendarioGeral()).datasExcluidas;
      rascunho = structuredClone(salvos);
      novas = new Set();
      desenhar();
      avisar("Calendário geral salvo.");
    } catch (falha) {
      erro.textContent = falha.message;
      erro.hidden = false;
    }
  });

  desenhar();
}
