/**
 * Modo "Editar em planilha" (especificação, seção 8.3; passo 1.11), só no computador:
 * uma grade com todas as ações e uma coluna por campo, para edição rápida.
 * - Cada célula é gravada ao sair dela; Enter desce para a linha de baixo; Esc desfaz a digitação.
 * - Colar um bloco do Google Planilhas ou do Excel preenche as células a partir da que tem o foco,
 *   criando ações novas para as linhas que passarem do fim.
 * - Dependências e responsáveis são digitados separados por ";" (números ou códigos; siglas ou nomes).
 * - Células que não podem ser editadas ficam cinza, com o motivo ao passar o mouse.
 * - A última linha, vazia, cria uma ação nova ao receber um rótulo.
 */
import { esc } from "../formato.js";
import { estimativaLivre, normalizarCodigo } from "../acao.js";
import { lerReferencias, escreverReferencias, lerResponsaveis, escreverResponsaveis, diferenca, lerColagem, lerData } from "../planilha.js";
import { avisar } from "./painel.js";

/**
 * @param {{store: object, espacoId: string, hoje: string, usuario?: string|null}} contexto
 * @returns {{desenhar: (alvo: HTMLElement, dados: object) => void}} dados: ver dadosDaJanela em espaco.js
 */
export function criarPlanilha({ store, espacoId, hoje, usuario = null }) {
  let d = null;
  let alvo = null;
  let ocupado = Promise.resolve(); // gravações em fila, na ordem em que a pessoa editou

  /** Colunas visíveis, na ordem da grade. */
  function colunas() {
    const campos = d.espaco.camposOpcionais ?? {};
    return [
      { chave: "numero", titulo: "Nº", largura: "3.5em" },
      d.usaCodigos && { chave: "codigo", titulo: "Código", largura: "6em" },
      { chave: "rotulo", titulo: "Rótulo", largura: "18em" },
      d.usaFases && { chave: "etapa", titulo: "Etapa", largura: "13em" },
      campos.descricao !== false && { chave: "descricao", titulo: "Descrição", largura: "18em" },
      { chave: "dependeDe", titulo: "Depende de", largura: "8em" },
      { chave: "responsaveis", titulo: "Responsáveis", largura: "10em" },
      { chave: "naoAntesDe", titulo: "Não começa antes de", largura: "9em" },
      { chave: "o", titulo: "Otimista", largura: "5em" },
      { chave: "m", titulo: "Mais provável", largura: "5em" },
      { chave: "p", titulo: "Pessimista", largura: "5em" },
      { chave: "concluidaEm", titulo: "Concluída em", largura: "9em" },
    ].filter(Boolean);
  }

  const etapas = () => (d.espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => ({ ...e, fase: f.nome })));

  /** Valor da célula, como texto. */
  function valor(acao, chave) {
    const e = acao.estimativas?.at(-1);
    switch (chave) {
      case "numero": return String(acao.numero);
      case "dependeDe": return escreverReferencias(acao.dependeDe, d.acoes, d.usaCodigos);
      case "responsaveis": return escreverResponsaveis(acao.responsaveis, d.responsaveis);
      case "o": case "m": case "p": return e ? String(e[chave]) : "";
      default: return acao[chave] ?? "";
    }
  }

  /** Motivo de a célula não poder ser editada, ou "". */
  function bloqueio(acao, chave) {
    if (chave === "numero") return "O número é dado pelo sistema e não muda.";
    const situacao = d.linhaDe.get(acao.numero)?.situacao;
    if (["o", "m", "p"].includes(chave) && !estimativaLivre(acao, situacao, hoje)) {
      return situacao === "concluida" ? "A ação já foi concluída." : "A ação já foi liberada: a estimativa muda por reestimativa, na janela da ação.";
    }
    if (chave === "concluidaEm" && situacao === "naoLiberada") return "A ação ainda não foi liberada.";
    return "";
  }

  function celulaHtml(acao, coluna, linha, indice) {
    const motivo = acao ? bloqueio(acao, coluna.chave) : coluna.chave === "rotulo" ? "" : "Escreva o rótulo para criar a ação.";
    const v = acao ? valor(acao, coluna.chave) : "";
    const comum = `data-linha="${linha}" data-coluna="${indice}" data-chave="${coluna.chave}" aria-label="${esc(coluna.titulo)}"`;
    if (motivo) return `<td class="bloqueada" title="${esc(motivo)}"><span ${comum} tabindex="-1">${esc(v)}</span></td>`;
    if (coluna.chave === "etapa") {
      return `<td><select ${comum}><option value=""></option>${etapas().map((e) =>
        `<option value="${esc(e.id)}"${e.id === v ? " selected" : ""}>${esc(e.nome)}</option>`).join("")}</select></td>`;
    }
    const tipo = ["naoAntesDe", "concluidaEm"].includes(coluna.chave) ? ' type="date"' : ["o", "m", "p"].includes(coluna.chave) ? ' type="number" min="0" step="1"' : "";
    const dica = !acao && coluna.chave === "rotulo" ? ' placeholder="Nova ação: escreva o rótulo"' : "";
    return `<td><input${tipo} ${comum} value="${esc(v)}" data-original="${esc(v)}"${dica}${coluna.chave === "concluidaEm" ? ` max="${hoje}"` : ""}></td>`;
  }

  function desenhar(novoAlvo, dados) {
    d = dados;
    const trocouAlvo = alvo !== novoAlvo;
    alvo = novoAlvo;
    const foco = guardarFoco();
    const cols = colunas();
    alvo.innerHTML = `
      <p class="tec so-computador">Cada célula é gravada ao sair dela. Enter desce para a linha de baixo; Esc desfaz o que foi digitado.
        Cole um bloco do Google Planilhas ou do Excel a partir da célula selecionada. Em "Depende de", use os ${d.usaCodigos ? "números ou códigos" : "números"} das ações,
        separados por ponto e vírgula; em "Responsáveis", as siglas ou os nomes. Células cinza não podem ser editadas aqui: passe o mouse para ver o motivo.</p>
      <div class="planilha-rolagem so-computador">
        <table class="planilha">
          <colgroup>${cols.map((c) => `<col style="width:${c.largura}">`).join("")}</colgroup>
          <thead><tr>${cols.map((c) => `<th scope="col">${c.titulo}</th>`).join("")}</tr></thead>
          <tbody>
            ${d.acoes.map((a, i) => `<tr data-numero="${a.numero}">${cols.map((c, j) => celulaHtml(a, c, i, j)).join("")}</tr>`).join("")}
            <tr class="linha-nova">${cols.map((c, j) => celulaHtml(null, c, d.acoes.length, j)).join("")}</tr>
          </tbody>
        </table>
      </div>
      <p class="so-celular cartao">A edição em planilha está disponível no computador.</p>`;
    restaurarFoco(foco);
    if (trocouAlvo) ligar();
  }

  /* ---------- foco: mantido quando a grade é redesenhada por uma gravação ---------- */
  function guardarFoco() {
    const el = document.activeElement;
    if (!alvo?.contains(el) || !el.dataset?.linha) return null;
    return { linha: el.dataset.linha, coluna: el.dataset.coluna, valor: el.value, sujo: el.value !== el.dataset.original };
  }
  function restaurarFoco(foco) {
    if (!foco) return;
    const el = alvo.querySelector(`[data-linha="${foco.linha}"][data-coluna="${foco.coluna}"]`);
    if (!el) return;
    if (foco.sujo && "value" in el) el.value = foco.valor;
    el.focus();
  }

  /* ---------- gravação de uma célula ---------- */
  const acaoDaLinha = (linha) => d.acoes[Number(linha)] ?? null;

  /** Grava o valor de uma célula na ação. Devolve uma mensagem de erro, ou "". */
  async function gravar(acao, chave, texto) {
    const t = String(texto ?? "").trim();
    const n = acao.numero;
    switch (chave) {
      case "codigo": return store.alterarAcao(espacoId, n, { codigo: normalizarCodigo(t) || null });
      case "rotulo":
        if (!t) throw new Error("O rótulo não pode ficar vazio.");
        return store.alterarAcao(espacoId, n, { rotulo: t });
      case "etapa": {
        const etapa = etapas().find((e) => e.id === t) ?? etapas().find((e) => e.nome.toLowerCase() === t.toLowerCase());
        if (t && !etapa) throw new Error(`“${t}” não é uma etapa deste espaço.`);
        return store.alterarAcao(espacoId, n, { etapa: etapa?.id ?? null });
      }
      case "descricao": return store.alterarAcao(espacoId, n, { descricao: t });
      case "naoAntesDe": {
        const data = lerData(t);
        if (data === undefined) throw new Error("Use uma data como 20/10/2026.");
        return store.alterarAcao(espacoId, n, { naoAntesDe: data });
      }
      case "dependeDe": {
        const { numeros, erros } = lerReferencias(t, d.acoes, d.usaCodigos);
        if (erros.length) throw new Error(erros[0]);
        const { acrescentar, retirar } = diferenca(acao.dependeDe, numeros);
        for (const x of retirar) await store.retirarDependencia(espacoId, n, x);
        for (const x of acrescentar) await store.acrescentarDependencia(espacoId, n, x);
        return;
      }
      case "responsaveis": {
        const { ids, erros } = lerResponsaveis(t, d.responsaveis);
        if (erros.length) throw new Error(erros[0]);
        const { acrescentar, retirar } = diferenca(acao.responsaveis, ids);
        for (const x of retirar) await store.retirarResponsavelDaAcao(espacoId, n, x);
        for (const x of acrescentar) await store.acrescentarResponsavelNaAcao(espacoId, n, x);
        return;
      }
      case "o": case "m": case "p": {
        const e = acao.estimativas?.at(-1) ?? {};
        const tres = { o: e.o, m: e.m, p: e.p, [chave]: t === "" ? undefined : Number(t) };
        if ([tres.o, tres.m, tres.p].some((x) => x === undefined)) return; // espera os três pontos
        return store.corrigirEstimativa(espacoId, n, tres);
      }
      case "concluidaEm": {
        const data = lerData(t);
        if (data === undefined) throw new Error("Use uma data como 20/10/2026.");
        if (data) return store.concluir(espacoId, n, data);
        if (acao.concluidaEm) return store.desfazerConclusao(espacoId, n);
        return;
      }
      default: return;
    }
  }

  /** Cria uma ação a partir de uma linha nova (rótulo obrigatório) e devolve o número dela. */
  async function criarDaLinha(valores) {
    const rotulo = String(valores.rotulo ?? "").trim();
    if (!rotulo) return null;
    const numero = await store.criarAcao(espacoId, { rotulo });
    for (const [chave, texto] of Object.entries(valores)) {
      if (chave === "rotulo" || chave === "numero" || String(texto ?? "").trim() === "") continue;
      const acao = (await store.listarAcoes(espacoId)).find((a) => a.numero === numero);
      await gravar(acao, chave, texto);
    }
    return numero;
  }

  /** Coloca na fila a gravação de uma célula; em caso de erro, avisa e marca a célula. */
  function gravarCelula(el) {
    const chave = el.dataset.chave;
    const texto = el.value;
    if (texto === el.dataset.original && el.tagName !== "SELECT") return;
    const acao = acaoDaLinha(el.dataset.linha);
    ocupado = ocupado.then(async () => {
      try {
        if (acao) await gravar(acao, chave, texto);
        else if (chave === "rotulo" && texto.trim()) await criarDaLinha({ rotulo: texto });
        el.classList.remove("com-erro");
      } catch (e) {
        el.classList.add("com-erro");
        el.title = e.message;
        avisar(e.message);
      }
    });
  }

  /* ---------- colagem de um bloco ---------- */
  function colar(el, texto) {
    const blocos = lerColagem(texto);
    if (blocos.length <= 1 && (blocos[0]?.length ?? 0) <= 1) return false; // uma célula só: colagem comum
    const cols = colunas();
    const linha0 = Number(el.dataset.linha);
    const coluna0 = Number(el.dataset.coluna);
    ocupado = ocupado.then(async () => {
      let erros = 0;
      let criadas = 0;
      for (const [i, celulas] of blocos.entries()) {
        const acao = acaoDaLinha(linha0 + i);
        const valores = {};
        celulas.forEach((texto, j) => { const c = cols[coluna0 + j]; if (c) valores[c.chave] = texto; });
        try {
          if (!acao) { if (await criarDaLinha(valores)) criadas++; continue; }
          for (const [chave, texto] of Object.entries(valores)) {
            if (bloqueio(acao, chave)) continue;
            const atual = (await store.listarAcoes(espacoId)).find((a) => a.numero === acao.numero);
            await gravar(atual, chave, texto);
          }
        } catch (e) {
          erros++;
          avisar(`Linha ${linha0 + i + 1}: ${e.message}`);
        }
      }
      if (!erros) avisar(`Colagem gravada${criadas ? `, com ${criadas} ${criadas === 1 ? "ação nova" : "ações novas"}` : ""}.`);
    });
    return true;
  }

  /* ---------- eventos ---------- */
  function ligar() {
    alvo.addEventListener("change", (e) => { if (e.target.dataset?.chave) gravarCelula(e.target); });
    alvo.addEventListener("keydown", (e) => {
      const el = e.target;
      if (!el.dataset?.chave) return;
      if (e.key === "Enter") {
        e.preventDefault(); // a saída da célula dispara a gravação (evento change)
        alvo.querySelector(`[data-linha="${Number(el.dataset.linha) + 1}"][data-coluna="${el.dataset.coluna}"]`)?.focus();
      } else if (e.key === "Escape" && "value" in el && el.value !== el.dataset.original) {
        e.preventDefault();
        el.value = el.dataset.original;
      }
    });
    alvo.addEventListener("paste", (e) => {
      const el = e.target;
      if (!el.dataset?.chave) return;
      if (colar(el, e.clipboardData.getData("text/plain"))) e.preventDefault();
    });
  }

  return { desenhar };
}
