/**
 * Modo "Editar em planilha" (documentação técnica, seção 8.3; passo 1.11), só no computador:
 * uma grade com todas as ações e uma coluna por campo, para edição rápida.
 * - Cada célula é gravada ao sair dela; Enter desce para a linha de baixo; Esc desfaz a digitação.
 * - Colar um bloco do Google Planilhas ou do Excel preenche as células a partir da que tem o foco,
 *   criando ações novas para as linhas que passarem do fim.
 * - Dependências e responsáveis são digitados separados por ";" (números ou códigos; siglas ou nomes).
 * - Células que não podem ser editadas ficam cinza, com o motivo ao passar o mouse.
 * - A última linha, vazia, cria uma ação nova ao receber um rótulo.
 */
import { esc, dataBr } from "../formato.js";
import { estimativaLivre, normalizarCodigo } from "../acao.js";
import { lerReferencias, escreverReferencias, lerResponsaveis, escreverResponsaveis, diferenca, lerColagem, lerData } from "../planilha.js";
import { avisar } from "./painel.js";
import { usaEstimativas, usaDependencias, usaSimulacao } from "../modelos.js";
import { nomeDoFluxo } from "../situacoes.js";
import { usaEtiquetas, etiquetasDaAcao } from "../etiquetas.js";
import { posicoesDaPrioridade } from "../prioridade.js";

const SITUACOES = { concluida: "Concluída", liberada: "Liberada", naoLiberada: "Não liberada" };

/**
 * Todas as colunas da planilha, na ordem da grade (23/10/2026, pedido do responsável: a planilha é para
 * quem usa muito o sistema e mostra todos os campos, inclusive os calculados). Larguras em em.
 * fixa: fica parada à esquerda ao rolar para o lado; calculada: só leitura, no fim.
 * @returns {{chave: string, titulo: string, largura: number, fixa?: boolean, calculada?: boolean, obrigatoria?: boolean}[]}
 */
export function colunasDaPlanilha(d) {
  const campos = d.espaco.camposOpcionais ?? {};
  /* o modelo do espaço decide as colunas de prazo, dependências e simulação (passo 2.4b) */
  const est = usaEstimativas(d.espaco);
  const dep = usaDependencias(d.espaco);
  const simu = usaSimulacao(d.espaco);
  return [
    /* revisão de 23/10/2026 (pedido do responsável): número e ação primeiro, parados à esquerda; o rótulo se chama "Ação" aqui */
    { chave: "numero", titulo: "Nº", largura: 3, fixa: true },
    d.usaCodigos && { chave: "codigo", titulo: "Código", largura: 6, fixa: true },
    { chave: "rotulo", titulo: "Ação", largura: 16, fixa: true, obrigatoria: true },
    d.usaFases && { chave: "fase", titulo: "Fase", largura: 9 },
    d.usaFases && { chave: "etapa", titulo: "Etapa", largura: 10 },
    campos.descricao !== false && { chave: "descricao", titulo: "Descrição", largura: 18 },
    campos.justificativa === true && { chave: "justificativa", titulo: "Justificativa", largura: 16 },
    campos.local === true && { chave: "local", titulo: "Local", largura: 9 },
    dep && { chave: "dependeDe", titulo: "Depende de", largura: 7 },
    { chave: "responsaveis", titulo: "Responsáveis", largura: 9 },
    { chave: "naoAntesDe", titulo: "Não começa antes de", largura: 9 },
    est && { chave: "o", titulo: "Otimista", largura: 5.5 },
    est && { chave: "m", titulo: "Mais provável", largura: 5.5 },
    est && { chave: "p", titulo: "Pessimista", largura: 5.5 },
    !est && { chave: "dataLimite", titulo: "Data-limite", largura: 9 },
    { chave: "concluidaEm", titulo: "Concluída em", largura: 9 },
    campos.notas !== false && { chave: "notas", titulo: "Anotações", largura: 16 },
    { chave: "checklist", titulo: "Checklist", largura: 5.5 },
    campos.prioridade === true && { chave: "prioridade", titulo: "Prioridade da equipe", largura: 6.5 },
    usaEtiquetas(d.espaco) && { chave: "etiquetas", titulo: "Etiquetas", largura: 9 },
    campos.documentos === true && { chave: "documentos", titulo: "Documentos e links", largura: 12 },
    { chave: "situacao", titulo: "Situação", largura: 7, calculada: true },
    { chave: "atrasadaDesde", titulo: "Atrasada desde", largura: 7, calculada: true },
    { chave: "liberacaoPrevista", titulo: "Liberação prevista", largura: 7, calculada: true },
    est && { chave: "conclusaoPrevista", titulo: "Conclusão prevista", largura: 7, calculada: true },
    est && { chave: "folga", titulo: "Folga (dias úteis)", largura: 5.5, calculada: true },
    simu && { chave: "execucao", titulo: "Índice de criticidade", largura: 6.5, calculada: true },
    simu && { chave: "revisao", titulo: "Contribuição para a incerteza", largura: 8.5, calculada: true },
    est && { chave: "reestimativas", titulo: "Reestimativas", largura: 6.5, calculada: true },
    { chave: "criadaEm", titulo: "Criada em", largura: 6.5, calculada: true },
    { chave: "alteradaEm", titulo: "Alterada em", largura: 9, calculada: true },
    { chave: "alteradaPor", titulo: "Alterada por", largura: 10, calculada: true },
  ].filter(Boolean);
}

/**
 * @param {{store: object, espacoId: string, hoje: string, usuario?: string|null}} contexto
 * @returns {{desenhar: (alvo: HTMLElement, dados: object) => void}} dados: ver dadosDaJanela em espaco.js
 */
export function criarPlanilha({ store, espacoId, hoje, usuario = null }) {
  let d = null;
  let alvo = null;
  let ocupado = Promise.resolve(); // gravações em fila, na ordem em que a pessoa editou

  /** Colunas visíveis, na ordem da grade (as escondidas em "Exibir" ficam de fora). */
  function colunas() {
    const ocultas = d.ocultas ?? new Set();
    return colunasDaPlanilha(d).filter((c) => c.obrigatoria || !ocultas.has(c.chave));
  }

  const etapas = () => (d.espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => ({ ...e, fase: f.nome })));

  /** Valor da célula, como texto. */
  function valor(acao, chave) {
    const e = acao.estimativas?.at(-1);
    switch (chave) {
      case "numero": return String(acao.numero);
      case "fase": return etapas().find((x) => x.id === acao.etapa)?.fase ?? "";
      case "dependeDe": return escreverReferencias(acao.dependeDe, d.acoes, d.usaCodigos);
      case "responsaveis": return escreverResponsaveis(acao.responsaveis, d.responsaveis);
      case "o": case "m": case "p": return e ? String(e[chave]) : "";
      case "notas": { // com mais de uma linha, só leitura: mostrada como texto corrido, sem as marcas de formatação
        const t = acao.notas ?? "";
        return /\n/.test(t) ? t.replace(/\*\*|__|\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/^\s*[-*]\s+/gm, "").split(/\n+/).filter(Boolean).join(" · ") : t;
      }
      case "checklist": {
        const itens = acao.checklist ?? [];
        return itens.length ? `${itens.filter((i) => i.feito).length}/${itens.length}` : "";
      }
      case "etiquetas": return etiquetasDaAcao(d.espaco, acao).map((x) => x.nome).join("; ");
      case "documentos": return (acao.documentos ?? []).map((x) => x.nome).join("; ");
      case "prioridade": return String(posicoesDaPrioridade(d.acoes).get(acao.numero) ?? "");
      default: return calculado(acao, chave) ?? acao[chave] ?? "";
    }
  }

  /** Valores calculados pelo sistema (só leitura), ou undefined se a coluna não é calculada. */
  function calculado(acao, chave) {
    const l = d.linhaDe.get(acao.numero);
    const c = d.caminho.porAcao.get(acao.numero);
    if (!l || !c) return undefined;
    const pct = (x) => (x == null ? "" : x > 0 && x < 0.01 ? "<1%" : `${Math.round(x * 100)}%`);
    const quando = (iso, comHora) => {
      if (!iso) return "";
      const t = new Date(iso);
      return comHora ? t.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : t.toLocaleDateString("pt-BR");
    };
    const semNumeros = l.situacao === "concluida" || l.semEstimativa;
    switch (chave) {
      case "situacao": return l.situacao === "liberada" ? nomeDoFluxo(d.espaco, l.fluxo) : SITUACOES[l.situacao] ?? ""; // personalizada (passo 2.7)
      case "atrasadaDesde": return l.atrasada ? dataBr(l.vencidaEm) : "";
      case "liberacaoPrevista": return dataBr(d.cal.data(c.liberacao));
      case "conclusaoPrevista": return l.semEstimativa ? "" : dataBr(l.conclusao);
      case "folga": return semNumeros ? "" : String(Math.round(c.folga));
      case "execucao": return pct(l.execucao);
      case "revisao": return pct(l.revisao);
      case "reestimativas": return String(l.reprogramacoes);
      case "criadaEm": return quando(acao.criadaEm);
      case "alteradaEm": return quando(acao.alteradaEm, true);
      case "alteradaPor": return acao.alteradaPor ? d.responsaveis.find((r) => r.usuario === acao.alteradaPor)?.nome ?? acao.alteradaPor : "";
      default: return undefined;
    }
  }

  /** Motivo de a célula não poder ser editada, ou "". */
  function bloqueio(acao, chave) {
    const coluna = colunasDaPlanilha(d).find((c) => c.chave === chave);
    if (coluna?.calculada) return "Calculado pelo sistema.";
    /* papéis (passo 2.1): Leitor, sem papel, ou Usuário numa ação alheia do espaço fechado */
    if (d.perm && !d.perm.atualizar(acao)) return d.perm.papel === "usuario" ? "Espaço fechado: você atualiza só as ações em que é responsável." : "Você não pode alterar as ações deste espaço.";
    if (chave === "numero") return "O número é dado pelo sistema e não muda.";
    if (chave === "fase") return "A fase vem da etapa: mude a etapa.";
    if (chave === "checklist") return "Itens feitos / total. Edite o checklist na janela da ação.";
    if (chave === "etiquetas") return "Edite as etiquetas na janela da ação.";
    if (chave === "documentos") return "Edite os documentos e links na janela da ação.";
    if (chave === "prioridade") return "Posição na prioridade da equipe. Mude arrastando a ação na lista, ordenada por “Prioridade da equipe”.";
    if (chave === "notas" && /\n/.test(acao.notas ?? "")) return "Anotações com mais de uma linha: edite na janela da ação.";
    const situacao = d.linhaDe.get(acao.numero)?.situacao;
    if (["o", "m", "p"].includes(chave) && !estimativaLivre(acao, situacao, hoje)) {
      return situacao === "concluida" ? "A ação já foi concluída." : "A ação já foi liberada: a estimativa muda por reestimativa, na janela da ação.";
    }
    if (chave === "concluidaEm" && situacao === "naoLiberada") return "A ação ainda não foi liberada.";
    return "";
  }

  function celulaHtml(acao, coluna, linha, indice, esquerda) {
    const motivo = acao ? bloqueio(acao, coluna.chave) : coluna.chave === "rotulo" ? "" : coluna.calculada ? "Calculado pelo sistema." : "Escreva o nome da ação para criar a linha.";
    const v = acao ? valor(acao, coluna.chave) : "";
    const classes = [coluna.calculada && "calculada", coluna.inicioCalculados && "inicio-calculados", esquerda != null && "fixa", coluna.ultimaFixa && "ultima-fixa"].filter(Boolean);
    const estilo = esquerda != null ? ` style="--esq:${esquerda}"` : "";
    const comum = `data-linha="${linha}" data-col="${indice}" data-chave="${coluna.chave}" aria-label="${esc(coluna.titulo)}"`;
    if (motivo) {
      const dica = coluna.calculada ? (v ? `${v}` : "") : motivo;
      return `<td class="${["bloqueada", ...classes].join(" ")}"${estilo}${dica ? ` title="${esc(dica)}"` : ""}><span ${comum} role="textbox" aria-readonly="true" tabindex="-1">${esc(v)}</span></td>`;
    }
    const td = `<td${classes.length ? ` class="${classes.join(" ")}"` : ""}${estilo}>`;
    if (coluna.chave === "etapa") {
      return `${td}<select ${comum}><option value=""></option>${etapas().map((e) =>
        `<option value="${esc(e.id)}"${e.id === v ? " selected" : ""}>${esc(e.nome)}</option>`).join("")}</select></td>`;
    }
    const tipo = ["naoAntesDe", "dataLimite", "concluidaEm"].includes(coluna.chave) ? ' type="date"' : ["o", "m", "p"].includes(coluna.chave) ? ' type="number" min="0" step="1"' : "";
    const dica = !acao && coluna.chave === "rotulo" ? ' placeholder="Nova ação: escreva o nome"' : "";
    const inteiro = v && !tipo && v.length > 12 ? ` title="${esc(v)}"` : "";
    const vazia = tipo.includes("date") && !v ? " data-vazia" : ""; // data vazia: sem a máscara dd/mm/aaaa até receber o cursor
    return `${td}<input${tipo} ${comum} value="${esc(v)}" data-original="${esc(v)}"${dica}${inteiro}${vazia}${coluna.chave === "concluidaEm" ? ` max="${hoje}"` : ""}></td>`;
  }

  function desenhar(novoAlvo, dados) {
    d = dados;
    const trocouAlvo = alvo !== novoAlvo;
    alvo = novoAlvo;
    const foco = guardarFoco();
    const rolagemAntes = alvo.querySelector(".planilha-rolagem");
    const posicao = rolagemAntes ? [rolagemAntes.scrollLeft, rolagemAntes.scrollTop] : null; // a gravação redesenha a grade sem mudar a rolagem
    const cols = colunas();
    /* largura de cada coluna em em (corrigido em 23/10/2026: antes, a tabela era espremida até caber na tela) */
    const total = cols.reduce((t, c) => t + c.largura, 0);
    const fixas = cols.filter((c) => c.fixa);
    const esquerdas = [];
    let soma = 0;
    cols.forEach((c, j) => { esquerdas[j] = c.fixa ? soma : null; if (c.fixa) soma += c.largura; });
    cols.forEach((c) => { c.ultimaFixa = c === fixas.at(-1); c.inicioCalculados = c === cols.find((x) => x.calculada); });
    const cabecalho = (c, j) => `<th scope="col" class="${[c.calculada && "calculada", c.inicioCalculados && "inicio-calculados", c.fixa && "fixa", c.ultimaFixa && "ultima-fixa"].filter(Boolean).join(" ")}"
      ${c.fixa ? ` style="--esq:${esquerdas[j]}"` : ""}${c.calculada ? ' title="Calculado pelo sistema"' : ""}>${c.titulo}</th>`;
    alvo.innerHTML = `
      <details class="tec planilha-dicas so-computador"${dicasAbertas ? " open" : ""}><summary>Cada célula é gravada ao sair dela. Cinza: não se edita aqui (passe o mouse para ver o motivo). Títulos em itálico: calculados. <span class="mais">Mais dicas</span></summary>
        <p>Setas, Enter e Shift+Enter andam entre as células; Esc desfaz o que foi digitado. Cole um bloco do Google Planilhas ou do Excel a partir da célula selecionada.
        Em "Depende de", use os ${d.usaCodigos ? "números ou códigos" : "números"} das ações, separados por ponto e vírgula; em "Responsáveis", as siglas ou os nomes.
        Escolha as colunas em "Exibir".</p></details>
      <div class="planilha-rolagem so-computador" style="scroll-padding-left:calc(${soma} * .88rem)">
        <table class="planilha" style="width:${total}em">
          <colgroup>${cols.map((c) => `<col style="width:${c.largura}em">`).join("")}</colgroup>
          <thead><tr>${cols.map(cabecalho).join("")}</tr></thead>
          <tbody>
            ${d.acoes.map((a, i) => `<tr data-numero="${a.numero}">${cols.map((c, j) => celulaHtml(a, c, i, j, esquerdas[j])).join("")}</tr>`).join("")}
            ${d.perm && !d.perm.criarAcao ? "" : `<tr class="linha-nova">${cols.map((c, j) => celulaHtml(null, c, d.acoes.length, j, esquerdas[j])).join("")}</tr>`}
          </tbody>
        </table>
      </div>
      <p class="so-celular cartao">A edição em planilha está disponível no computador.</p>`;
    const rolagem = alvo.querySelector(".planilha-rolagem");
    if (posicao) [rolagem.scrollLeft, rolagem.scrollTop] = posicao;
    ajustarAltura();
    restaurarFoco(foco);
    if (trocouAlvo) ligar();
  }

  /* a planilha vai até o fim da tela (23/10/2026), como a rede */
  let dicasAbertas = false;
  function ajustarAltura() {
    const rolagem = alvo?.querySelector(".planilha-rolagem");
    if (!rolagem?.isConnected || !rolagem.offsetParent) return;
    rolagem.style.height = `${Math.max(240, Math.floor(innerHeight - (rolagem.getBoundingClientRect().top + scrollY) - 16))}px`;
  }

  /* ---------- foco: mantido quando a grade é redesenhada por uma gravação ---------- */
  function guardarFoco() {
    const el = document.activeElement;
    if (!alvo?.contains(el) || !el.dataset?.linha) return null;
    return { linha: el.dataset.linha, coluna: el.dataset.col, valor: el.value, sujo: el.value !== el.dataset.original };
  }
  function restaurarFoco(foco) {
    if (!foco) return;
    const el = alvo.querySelector(`[data-linha="${foco.linha}"][data-col="${foco.coluna}"]`);
    if (!el) return;
    if (foco.sujo && "value" in el) el.value = foco.valor;
    el.focus({ preventScroll: true });
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
        if (!t) throw new Error("O nome da ação não pode ficar vazio.");
        return store.alterarAcao(espacoId, n, { rotulo: t });
      case "etapa": {
        const etapa = etapas().find((e) => e.id === t) ?? etapas().find((e) => e.nome.toLowerCase() === t.toLowerCase());
        if (t && !etapa) throw new Error(`“${t}” não é uma etapa deste espaço.`);
        return store.alterarAcao(espacoId, n, { etapa: etapa?.id ?? null });
      }
      case "descricao": return store.alterarAcao(espacoId, n, { descricao: t });
      case "justificativa": case "local": return store.alterarAcao(espacoId, n, { [chave]: t }); // passo 2.10a
      case "notas": return store.alterarAcao(espacoId, n, { notas: t });
      case "naoAntesDe": case "dataLimite": {
        const data = lerData(t);
        if (data === undefined) throw new Error("Use uma data como 20/10/2026.");
        return store.alterarAcao(espacoId, n, { [chave]: data });
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
    const coluna0 = Number(el.dataset.col);
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
    alvo.addEventListener("input", (e) => { if (e.target.type === "date") e.target.toggleAttribute("data-vazia", !e.target.value); });
    alvo.addEventListener("toggle", (e) => { if (e.target.matches?.(".planilha-dicas")) { dicasAbertas = e.target.open; ajustarAltura(); } }, true);
    addEventListener("resize", () => { if (alvo.isConnected) ajustarAltura(); });
    alvo.addEventListener("keydown", (e) => {
      const el = e.target;
      if (!el.dataset?.chave) return;
      /* setas, Enter e Shift+Enter andam entre as células (23/10/2026); a saída da célula dispara a gravação (evento change).
         Num texto, ← e → só saem da célula com o cursor na ponta; Alt+↓ continua abrindo a lista da etapa */
      const ir = (dl, dc) => {
        const alvoCel = alvo.querySelector(`[data-linha="${Number(el.dataset.linha) + dl}"][data-col="${Number(el.dataset.col) + dc}"]`);
        if (!alvoCel) return false;
        alvoCel.focus();
        if (alvoCel.select && alvoCel.type !== "date" && alvoCel.type !== "number") alvoCel.select();
        return true;
      };
      const texto = el.tagName === "INPUT" && !["date", "number"].includes(el.type);
      const naPonta = (lado) => !texto || (el.selectionStart === el.selectionEnd && el.selectionStart === (lado < 0 ? 0 : el.value.length));
      let andou = null;
      if (e.key === "Enter") andou = ir(e.shiftKey ? -1 : 1, 0) || true;
      else if (e.key === "ArrowDown" && !e.altKey) andou = ir(1, 0);
      else if (e.key === "ArrowUp" && !e.altKey) andou = ir(-1, 0);
      else if (e.key === "ArrowLeft" && naPonta(-1)) andou = ir(0, -1);
      else if (e.key === "ArrowRight" && naPonta(1)) andou = ir(0, 1);
      if (andou !== null) {
        if (andou || e.key === "Enter" || el.tagName !== "INPUT" || !texto) e.preventDefault();
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
