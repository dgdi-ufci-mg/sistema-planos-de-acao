/**
 * Modo "Editar em planilha" (documentação técnica, seção 8.3; passo 1.11), só no computador:
 * uma grade com todas as ações e uma coluna por campo, para edição rápida.
 * - Cada célula é gravada ao sair dela; Enter desce para a linha de baixo; Esc desfaz a digitação.
 * - Colar um bloco do Google Planilhas ou do Excel preenche as células a partir da que tem o foco,
 *   criando ações novas para as linhas que passarem do fim.
 * - Dependências e responsáveis são digitados separados por ";" (números ou códigos; siglas ou nomes).
 * - Células que não podem ser editadas ficam cinza, com o motivo ao passar o mouse.
 * - A última linha, vazia, cria uma ação nova ao receber um rótulo.
 * - Classificar e filtrar em cada coluna, pelo botão do título, como no Excel (27/10/2026, pedido do responsável).
 * - Responsáveis e "Depende de" têm uma lista de várias escolhas, como no Google Planilhas (27/10/2026); digitar
 *   continua valendo.
 * - No modelo da planilha do Strata (30/10/2026, pedido do responsável): barra no alto com busca, "Agrupar por etapa",
 *   Desfazer, Refazer e Colunas (mostrar, esconder e mudar a ordem); linhas agrupadas por fase e etapa, recolhíveis;
 *   a célula que não pôde ser gravada fica marcada em vermelho, com o motivo, até ser gravada; a gravação continua
 *   na hora (decisão do responsável), e Desfazer regrava o valor anterior.
 */
import { esc, dataBr } from "../formato.js";
import { estimativaLivre, normalizarCodigo } from "../acao.js";
import {
  lerReferencias, escreverReferencias, lerResponsaveis, escreverResponsaveis, diferenca, lerColagem, lerData,
  agruparPorFaseEEtapa, ordenarColunas, moverColuna, passaNaBusca, criarDesfazer, ocultasAoLado, larguraAoConteudo,
} from "../planilha.js";
import { avisar, perguntar } from "./painel.js";
import { excluirAcao } from "./exclusao.js";
import { usaEstimativas, usaDependencias, usaSimulacao } from "../modelos.js";
import { termos } from "../vocabulario.js";
import { nomeDoFluxo } from "../situacoes.js";
import { usaEtiquetas, etiquetasDaAcao } from "../etiquetas.js";
import { posicoesDaPrioridade } from "../prioridade.js";
import { ICONES } from "../icones.js";

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
    { chave: "rotulo", titulo: termos(d.espaco).Acao, largura: 16, fixa: true, obrigatoria: true },
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
    campos.prioridade !== false && { chave: "prioridade", titulo: "Prioridade da equipe", largura: 6.5 },
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
  /* classificar e filtrar nas colunas (27/10/2026): valem enquanto o espaço está aberto, como no Excel */
  let ordenacao = null; // {chave, sentido: 1 (crescente) | -1 (decrescente)}
  const filtros = new Map(); // chave da coluna → valores (texto da célula) que ficam à vista
  let linhasAtuais = []; // as ações à vista, na ordem da grade
  /* barra no alto, grupos, desfazer e marcas de erro (30/10/2026, no modelo da planilha do Strata) */
  let busca = "";
  let agrupar = true; // por fase e etapa, quando o espaço usa fases e etapas
  const recolhidos = new Set(); // "f:<id da fase>" e "e:<id da etapa>"
  const historico = criarDesfazer();
  const erros = new Map(); // "<número>|<chave>" (ou "nova|rotulo") → motivo de a célula não ter sido gravada
  const CHAVE_ORDEM = "sextante.ordemPlanilha";
  let ordemColunas = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_ORDEM) || "[]"); } catch { return []; } })();
  const lembrarOrdem = () => { try { localStorage.setItem(CHAVE_ORDEM, JSON.stringify(ordemColunas)); } catch { /* sem armazenamento */ } };
  /** As colunas escondidas são as mesmas de "Exibir" (o mesmo conjunto e a mesma chave no navegador). */
  const lembrarOcultas = () => { try { localStorage.setItem("sextante.colunasPlanilha", JSON.stringify([...(d.ocultas ?? [])])); } catch { /* sem armazenamento */ } };

  /** Colunas visíveis, na ordem da grade (as escondidas em "Exibir" ficam de fora). */
  /* largura de cada coluna escolhida arrastando a borda do título (24/10/2026), lembrada neste aparelho */
  const CHAVE_LARGURAS = "sextante.largurasPlanilha";
  const larguras = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_LARGURAS) || "{}"); } catch { return {}; } })();
  const lembrarLarguras = () => { try { localStorage.setItem(CHAVE_LARGURAS, JSON.stringify(larguras)); } catch { /* sem armazenamento */ } };
  /* quebra de texto por coluna (18/11/2026): a linha cresce para mostrar o conteúdo inteiro; lembrada neste aparelho */
  const CHAVE_QUEBRAS = "sextante.quebraPlanilha";
  const quebras = new Set((() => { try { return JSON.parse(localStorage.getItem(CHAVE_QUEBRAS) || "[]"); } catch { return []; } })());
  const lembrarQuebras = () => { try { localStorage.setItem(CHAVE_QUEBRAS, JSON.stringify([...quebras])); } catch { /* sem armazenamento */ } };
  /** Colunas de texto que aceitam quebra: as de data, número, lista de uma escolha e as de várias escolhas ficam de fora. */
  const SEM_QUEBRA = ["numero", "etapa", "o", "m", "p", "naoAntesDe", "dataLimite", "concluidaEm", "checklist", "prioridade", "responsaveis", "dependeDe"];
  const aceitaQuebra = (chave) => !SEM_QUEBRA.includes(chave);
  function colunas() {
    const ocultas = d.ocultas ?? new Set();
    return ordenarColunas(colunasDaPlanilha(d), ordemColunas).filter((c) => c.obrigatoria || !ocultas.has(c.chave))
      .map((c) => ({ ...c, padrao: c.largura, largura: larguras[c.chave] ?? c.largura }));
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
    const erro = erros.get(`${acao ? acao.numero : "nova"}|${coluna.chave}`);
    const quebra = quebras.has(coluna.chave) && aceitaQuebra(coluna.chave);
    const classes = [quebra && "quebra", coluna.calculada && "calculada", coluna.inicioCalculados && "inicio-calculados", esquerda != null && "fixa", coluna.ultimaFixa && "ultima-fixa", !motivo && erro && "com-erro"].filter(Boolean);
    const estilo = esquerda != null ? ` style="--esq:${esquerda}"` : "";
    const comum = `data-linha="${linha}" data-col="${indice}" data-chave="${coluna.chave}" aria-label="${esc(coluna.titulo)}"`;
    if (motivo) {
      const dica = coluna.calculada ? (v ? `${v}` : "") : motivo;
      return `<td class="${["bloqueada", ...classes].join(" ")}"${estilo}${dica ? ` title="${esc(dica)}"` : ""}><span ${comum} role="textbox" aria-readonly="true" tabindex="-1">${esc(v)}</span></td>`;
    }
    const td = `<td${classes.length ? ` class="${classes.join(" ")}"` : ""}${estilo}${erro ? ` title="${esc(erro)}"` : ""}>`;
    if (coluna.chave === "etapa") {
      return `${td}<select ${comum} data-original="${esc(v)}"><option value=""></option>${etapas().map((e) =>
        `<option value="${esc(e.id)}"${e.id === v ? " selected" : ""}>${esc(e.nome)}</option>`).join("")}</select></td>`;
    }
    const tipo = ["naoAntesDe", "dataLimite", "concluidaEm"].includes(coluna.chave) ? ' type="date"' : ["o", "m", "p"].includes(coluna.chave) ? ' type="number" min="0" step="1"' : "";
    const dica = !acao && coluna.chave === "rotulo" ? ` placeholder="Nova ${termos(d.espaco).acao}: escreva o nome"` : "";
    const inteiro = v && !tipo && v.length > 12 && !erro ? ` title="${esc(v)}"` : "";
    /* Responsáveis e "Depende de": lista de várias escolhas (27/10/2026), além de digitar */
    if (acao && ["responsaveis", "dependeDe"].includes(coluna.chave)) {
      return `${td.replace("<td", '<td data-com-escolha')}<span class="celula-escolha"><input ${comum} value="${esc(v)}" data-original="${esc(v)}"${inteiro}>
        <button type="button" class="abrir-escolha" data-escolher tabindex="-1" aria-label="Escolher na lista (Alt+↓)" title="Escolher na lista (Alt+↓)">${ICONES.abrir}</button></span></td>`;
    }
    if (quebra && !tipo) { // texto que quebra: caixa de várias linhas, que cresce com o conteúdo (Alt+Enter, nova linha)
      return `${td}<textarea rows="1" ${comum} data-original="${esc(v)}"${dica}>${esc(v)}</textarea></td>`;
    }
    const vazia = tipo.includes("date") && !v ? " data-vazia" : ""; // data vazia: sem a máscara dd/mm/aaaa até receber o cursor
    return `${td}<input${tipo} ${comum} value="${esc(v)}" data-original="${esc(v)}"${dica}${inteiro}${vazia}${coluna.chave === "concluidaEm" ? ` max="${hoje}"` : ""}></td>`;
  }

  /* ---------- classificar e filtrar nas colunas ---------- */
  const comparador = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
  /** Chave de ordem do texto de uma célula: datas e números pelo valor; vazio sempre por último. */
  function chaveDeOrdem(texto) {
    const t = String(texto ?? "").trim();
    if (!t) return null;
    const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return { tipo: 0, v: `${br[3]}-${br[2]}-${br[1]}${t.slice(10)}` };
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return { tipo: 0, v: t };
    const n = t.replace(/^</, "").replace("%", "").replace(",", ".");
    if (n !== "" && !Number.isNaN(Number(n))) return { tipo: 1, v: Number(n) };
    return { tipo: 2, v: t };
  }
  function comparar(a, b) {
    const x = chaveDeOrdem(a);
    const y = chaveDeOrdem(b);
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    if (x.tipo !== y.tipo) return x.tipo - y.tipo;
    return x.tipo === 1 ? x.v - y.v : comparador.compare(x.v, y.v);
  }
  /* colunas com vários itens por célula: o filtro lista cada item, e a linha fica se tiver algum dos escolhidos */
  const VARIOS = ["responsaveis", "dependeDe", "etiquetas", "documentos"];
  const itensDe = (a, chave) => {
    const v = valor(a, chave);
    if (!VARIOS.includes(chave)) return [v];
    const itens = String(v).split(";").map((x) => x.trim()).filter(Boolean);
    return itens.length ? itens : [""];
  };
  /** Ações à vista: as que passam por todos os filtros, na ordem escolhida (ou na do espaço). */
  function linhasVisiveis() {
    const cols = colunas();
    const ls = d.acoes.filter((a) => [...filtros].every(([chave, valores]) => itensDe(a, chave).some((v) => valores.has(v)))
      && passaNaBusca(cols.map((c) => valor(a, c.chave)), busca));
    if (!ordenacao || !colunasDaPlanilha(d).some((c) => c.chave === ordenacao.chave)) return ls;
    return ls.map((a, i) => ({ a, i, v: valor(a, ordenacao.chave) }))
      .sort((p, q) => {
        const vazio = (!String(p.v).trim()) - (!String(q.v).trim());
        return vazio || ordenacao.sentido * comparar(p.v, q.v) || p.i - q.i; // vazias sempre por último
      }).map((x) => x.a);
  }
  const rotuloDoValor = (v) => (!String(v).trim() ? "(Vazias)" : /^\d{4}-\d{2}-\d{2}$/.test(v) ? dataBr(v) : v);

  /** Caixinha flutuante sob um elemento (filtro da coluna, escolha múltipla); fecha ao clicar fora ou com Esc. */
  let caixaAberta = null;
  function fecharCaixa() { caixaAberta?.soltar?.(); caixaAberta?.remove(); caixaAberta = null; }
  function abrirCaixa(ancora, html, largura = 280) {
    fecharCaixa();
    const caixa = document.createElement("div");
    caixa.className = "caixa-planilha";
    caixa.innerHTML = html;
    document.body.append(caixa);
    const r = ancora.getBoundingClientRect();
    caixa.style.width = `${largura}px`;
    caixa.style.left = `${Math.max(8, Math.min(innerWidth - largura - 8, r.left))}px`;
    const abaixo = r.bottom + 4;
    caixa.style.top = `${abaixo + caixa.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - caixa.offsetHeight - 4) : abaixo}px`;
    caixaAberta = caixa;
    const fora = (e) => { if (!caixa.contains(e.target) && !ancora.contains(e.target)) fecharCaixa(); };
    document.addEventListener("pointerdown", fora, true);
    /* fechar por qualquer caminho tira o ouvinte (30/10/2026): reabrir a caixa, como em Colunas, não a fecha no clique seguinte */
    caixa.soltar = () => document.removeEventListener("pointerdown", fora, true);
    caixa.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); fecharCaixa(); ancora.focus?.(); } });
    return caixa;
  }
  /** Lista com busca e caixas de marcar, usada no filtro e na escolha múltipla. */
  const listaHtml = (itens, marcados) => itens.map(([v, rotulo]) => `<label class="caixa-item"><input type="checkbox" value="${esc(v)}"${marcados.has(v) ? " checked" : ""}><span>${esc(rotulo)}</span></label>`).join("");
  function ligarBusca(caixa) {
    caixa.querySelector("[data-buscar-valor]")?.addEventListener("input", (e) => {
      const t = e.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      for (const item of caixa.querySelectorAll(".caixa-item")) item.hidden = Boolean(t) && !item.textContent.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(t);
    });
  }

  /** Classificar e filtrar uma coluna (como no Excel). */
  function abrirFiltro(botao) {
    const c = colunas()[Number(botao.dataset.filtroCol)];
    const valores = [...new Set(d.acoes.flatMap((a) => itensDe(a, c.chave)))].sort((a, b) => (!String(a).trim()) - (!String(b).trim()) || comparar(a, b));
    const numerica = valores.some((v) => chaveDeOrdem(v)?.tipo <= 1);
    const marcados = filtros.get(c.chave) ?? new Set(valores);
    const caixa = abrirCaixa(botao, `<div role="dialog" aria-label="Classificar e filtrar: ${esc(c.titulo)}">
      <div class="caixa-ordem">
        <button type="button" class="opcao-caixa${ordenacao?.chave === c.chave && ordenacao.sentido === 1 ? " ativa" : ""}" data-ordenar="1">${ICONES.ordenar ?? ""}${numerica ? "Do menor para o maior" : "De A a Z"}</button>
        <button type="button" class="opcao-caixa${ordenacao?.chave === c.chave && ordenacao.sentido === -1 ? " ativa" : ""}" data-ordenar="-1">${ICONES.ordenar ?? ""}${numerica ? "Do maior para o menor" : "De Z a A"}</button>
        ${ordenacao?.chave === c.chave ? '<button type="button" class="opcao-caixa" data-ordenar="0">Voltar à ordem do espaço</button>' : ""}
      </div>
      <h4>Filtrar</h4>
      ${valores.length > 6 ? '<input type="search" class="caixa-busca" data-buscar-valor placeholder="Buscar valores" aria-label="Buscar valores">' : ""}
      <label class="caixa-item caixa-todos"><input type="checkbox" data-todos${marcados.size === valores.length ? " checked" : ""}><span>Selecionar tudo</span></label>
      <div class="caixa-lista">${listaHtml(valores.map((v) => [v, rotuloDoValor(v)]), marcados)}</div>
      <div class="botoes"><button type="button" class="botao" data-limpar-filtro${filtros.has(c.chave) ? "" : " disabled"}>Limpar filtro</button>
        <button type="button" class="botao principal" data-aplicar-filtro>Aplicar</button></div></div>`);
    ligarBusca(caixa);
    const caixas = () => [...caixa.querySelectorAll(".caixa-lista input")];
    caixa.addEventListener("change", (e) => {
      if (e.target.matches("[data-todos]")) for (const x of caixas()) { if (!x.closest(".caixa-item").hidden) x.checked = e.target.checked; }
      else caixa.querySelector("[data-todos]").checked = caixas().every((x) => x.checked);
    });
    caixa.addEventListener("click", (e) => {
      const ord = e.target.closest("[data-ordenar]");
      if (ord) {
        ordenacao = ord.dataset.ordenar === "0" ? null : { chave: c.chave, sentido: Number(ord.dataset.ordenar) };
        fecharCaixa();
        return desenhar(alvo, d);
      }
      if (e.target.closest("[data-limpar-filtro]")) { filtros.delete(c.chave); fecharCaixa(); return desenhar(alvo, d); }
      if (e.target.closest("[data-aplicar-filtro]")) {
        const escolhidos = new Set(caixas().filter((x) => x.checked).map((x) => x.value));
        if (escolhidos.size === valores.length) filtros.delete(c.chave); else filtros.set(c.chave, escolhidos);
        fecharCaixa();
        desenhar(alvo, d);
      }
    });
    (caixa.querySelector("[data-buscar-valor]") ?? caixa.querySelector("[data-ordenar]"))?.focus();
  }

  /** Escolha de várias opções numa célula de Responsáveis ou de "Depende de" (como no Google Planilhas). */
  function abrirEscolha(el) {
    const numero = acaoDaLinha(el.dataset.linha)?.numero;
    if (numero == null) return;
    const chave = el.dataset.chave;
    const atual = () => d.acoes.find((a) => a.numero === numero);
    const responsaveis = chave === "responsaveis";
    const itens = responsaveis
      ? d.responsaveis.map((r) => [r.id, r.sigla ? `${r.sigla} · ${r.nome}` : r.nome])
      : d.acoes.filter((a) => a.numero !== numero).map((a) => [String(a.numero), `${d.usaCodigos && a.codigo ? a.codigo : `#${a.numero}`} · ${a.rotulo}`]);
    const marcados = new Set((responsaveis ? atual().responsaveis : atual().dependeDe ?? []).map(String));
    const caixa = abrirCaixa(el, `<div role="dialog" aria-label="Escolher ${responsaveis ? "responsáveis" : "as ações anteriores"}">
      ${itens.length > 6 ? `<input type="search" class="caixa-busca" data-buscar-valor placeholder="${responsaveis ? "Buscar pessoa ou unidade" : "Buscar ação"}" aria-label="Buscar">` : ""}
      <div class="caixa-lista">${itens.length ? listaHtml(itens, marcados) : `<p class="tec">${responsaveis ? "Nenhum responsável cadastrado neste espaço." : "Não há outras ações."}</p>`}</div>
      <p class="tec">Cada marca é gravada na hora.</p></div>`, 320);
    ligarBusca(caixa);
    caixa.addEventListener("change", (e) => {
      const escolhidos = [...caixa.querySelectorAll(".caixa-lista input:checked")].map((x) => x.value);
      const texto = responsaveis ? escreverResponsaveis(escolhidos, d.responsaveis) : escreverReferencias(escolhidos.map(Number), d.acoes, d.usaCodigos);
      const marca = e.target;
      ocupado = ocupado.then(async () => {
        const antes = valor(atual(), chave);
        try {
          await gravar(atual(), chave, texto);
          historico.registrar({ numero, chave, antes, depois: texto });
          erros.delete(`${numero}|${chave}`);
          atualizarBarra();
        } catch (falha) {
          marca.checked = !marca.checked; // não gravou: a marca volta
          avisar(falha.message);
        }
      });
    });
    (caixa.querySelector("[data-buscar-valor]") ?? caixa.querySelector(".caixa-lista input"))?.focus();
  }

  function botaoFiltro(c, j) {
    const ativo = filtros.has(c.chave) || ordenacao?.chave === c.chave;
    const icone = ordenacao?.chave === c.chave ? (ordenacao.sentido > 0 ? "↑" : "↓") : "";
    return `<button type="button" class="filtro-coluna${ativo ? " ativo" : ""}" data-filtro-col="${j}" aria-haspopup="dialog" aria-label="Classificar e filtrar: ${esc(c.titulo)}${filtros.has(c.chave) ? " (filtrada)" : ""}" title="Classificar e filtrar">${filtros.has(c.chave) ? ICONES.funil : icone ? `<b>${icone}</b>` : ICONES.abrir}</button>`;
  }

  /** Agrupa por fase e etapa? Só quando o espaço usa fases e etapas e a pessoa não desligou "Agrupar por etapa". */
  const agrupando = () => agrupar && d.usaFases && (d.espaco.estrutura ?? []).length > 0;

  /** Barra no alto (30/10/2026): busca, agrupar, desfazer, refazer e colunas. */
  function barraHtml() {
    return `<div class="planilha-barra so-computador" data-barra-planilha>
      <label class="grade-busca">${ICONES.buscar}<input type="search" data-busca-planilha placeholder="Buscar" aria-label="Buscar na planilha" value="${esc(busca)}"></label>
      ${d.usaFases && (d.espaco.estrutura ?? []).length ? `<button type="button" class="grade-chave" data-agrupar-planilha aria-pressed="${agrupar}">Agrupar por etapa</button>` : ""}
      <span class="planilha-barra-direita">
        <button type="button" class="botao" data-desfazer-planilha${historico.podeDesfazer ? "" : " disabled"} title="Desfazer a última alteração (Ctrl+Z)">Desfazer</button>
        <button type="button" class="botao" data-refazer-planilha${historico.podeRefazer ? "" : " disabled"} title="Refazer (Ctrl+Y)">Refazer</button>
        <button type="button" class="botao grade-botao-colunas" data-colunas-planilha aria-haspopup="dialog">${ICONES.colunas}Colunas</button>
      </span></div>`;
  }
  /** Só os botões de Desfazer e Refazer, sem redesenhar a grade (depois de uma gravação). */
  function atualizarBarra() {
    const des = alvo?.querySelector("[data-desfazer-planilha]");
    const ref = alvo?.querySelector("[data-refazer-planilha]");
    if (des) des.disabled = !historico.podeDesfazer;
    if (ref) ref.disabled = !historico.podeRefazer;
  }

  function desenhar(novoAlvo, dados) {
    d = dados;
    const trocouAlvo = alvo !== novoAlvo;
    alvo = novoAlvo;
    const foco = guardarFoco();
    const buscaComFoco = document.activeElement?.matches?.("[data-busca-planilha]") && alvo.contains(document.activeElement) ? document.activeElement.selectionStart : null;
    const rolagemAntes = alvo.querySelector(".planilha-rolagem");
    const posicao = rolagemAntes ? [rolagemAntes.scrollLeft, rolagemAntes.scrollTop] : null; // a gravação redesenha a grade sem mudar a rolagem
    const cols = colunas();
    const filtradas = linhasVisiveis();
    const ocultas = d.acoes.length - filtradas.length;
    /* grupos por fase e etapa (30/10/2026): as linhas recolhidas saem da grade, e a ordem da grade é a dos grupos */
    const grupos = agrupando() ? agruparPorFaseEEtapa(filtradas, d.espaco.estrutura) : null;
    linhasAtuais = grupos
      ? grupos.flatMap((g) => (recolhidos.has(`f:${g.fase.id}`) ? [] : g.etapas.flatMap((e) => (recolhidos.has(`e:${g.fase.id}:${e.etapa.id}`) ? [] : e.acoes))))
      : filtradas;
    /* largura de cada coluna em em (corrigido em 23/10/2026: antes, a tabela era espremida até caber na tela) */
    const total = cols.reduce((t, c) => t + c.largura, 0);
    const fixas = cols.filter((c) => c.fixa);
    const esquerdas = [];
    let soma = 0;
    cols.forEach((c, j) => { esquerdas[j] = c.fixa ? soma : null; if (c.fixa) soma += c.largura; });
    cols.forEach((c) => { c.ultimaFixa = c === fixas.at(-1); c.inicioCalculados = c === cols.find((x) => x.calculada); });
    /* colunas escondidas: um traço duplo entre as vizinhas, como no Excel; clicar nele mostra de novo (18/11/2026) */
    const lado = ocultasAoLado(ordenarColunas(colunasDaPlanilha(d), ordemColunas), d.ocultas ?? new Set());
    const titulos = new Map(colunasDaPlanilha(d).map((c) => [c.chave, c.titulo]));
    const marca = (chaves, fim) => `<button type="button" class="marca-oculta${fim ? " fim" : ""}" data-mostrar-colunas="${chaves.join(",")}" aria-label="Mostrar ${chaves.length === 1 ? "a coluna escondida" : `as ${chaves.length} colunas escondidas`}: ${esc(chaves.map((k) => titulos.get(k)).join(", "))}" title="Mostrar ${chaves.length === 1 ? "a coluna escondida" : "as colunas escondidas"}: ${esc(chaves.map((k) => titulos.get(k)).join(", "))}"></button>`;
    const cabecalho = (c, j) => `<th scope="col" class="${[c.calculada && "calculada", c.inicioCalculados && "inicio-calculados", c.fixa && "fixa", c.ultimaFixa && "ultima-fixa"].filter(Boolean).join(" ")}"
      ${c.fixa ? ` style="--esq:${esquerdas[j]}"` : ""}${c.calculada ? ' title="Calculado pelo sistema"' : ""}>${lado.antes.has(c.chave) ? marca(lado.antes.get(c.chave), false) : ""}${j === cols.length - 1 && lado.fim.length ? marca(lado.fim, true) : ""}<span class="titulo-coluna-planilha">${c.titulo}</span>${botaoFiltro(c, j)}<span class="redimensionar" data-redimensionar="${j}" title="Arraste para alargar ou estreitar; clique duas vezes para ajustar ao conteúdo" aria-hidden="true"></span></th>`;
    let i = 0;
    const linhaHtml = (a) => { const n = i++; return `<tr data-numero="${a.numero}">${cols.map((c, j) => celulaHtml(a, c, n, j, esquerdas[j])).join("")}</tr>`; };
    const cabecaDeGrupo = (chave, nivel, nome, quantos) => `<tr class="planilha-grupo ${nivel}"><th colspan="${cols.length}" scope="rowgroup">
      <button type="button" class="grade-grupo-botao" data-recolher-grupo="${esc(chave)}" aria-expanded="${!recolhidos.has(chave)}"><span class="grade-grupo-seta" aria-hidden="true"></span>${esc(nome)} <span class="tec">${quantos}</span></button></th></tr>`;
    const corpo = grupos
      ? grupos.map((g) => {
        const fChave = `f:${g.fase.id}`;
        const n = g.etapas.reduce((t, e) => t + e.acoes.length, 0);
        if (!g.fase.id) return cabecaDeGrupo(fChave, "nivel-fase", "Sem etapa", n) + (recolhidos.has(fChave) ? "" : g.etapas[0].acoes.map(linhaHtml).join(""));
        return cabecaDeGrupo(fChave, "nivel-fase", g.fase.nome, n) + (recolhidos.has(fChave) ? "" : g.etapas.map((e) => {
          const eChave = `e:${g.fase.id}:${e.etapa.id}`;
          return cabecaDeGrupo(eChave, "nivel-etapa", e.etapa.nome, e.acoes.length) + (recolhidos.has(eChave) ? "" : e.acoes.map(linhaHtml).join(""));
        }).join(""));
      }).join("")
      : linhasAtuais.map(linhaHtml).join("");
    alvo.innerHTML = `
      ${barraHtml()}
      ${ocultas || ordenacao ? `<p class="planilha-filtrada so-computador">${ocultas ? `${ocultas} de ${d.acoes.length} ${d.acoes.length === 1 ? termos(d.espaco).acao : termos(d.espaco).acoes} ${ocultas === 1 ? "escondida" : "escondidas"} pelos filtros${busca.trim() ? " e pela busca" : ""}.` : ""}${ordenacao ? ` Classificada por “${esc(colunasDaPlanilha(d).find((c) => c.chave === ordenacao.chave)?.titulo ?? "")}”.` : ""}
        <button type="button" class="botao discreto" data-limpar-tudo>Limpar filtros e classificação</button></p>` : ""}
      <div class="planilha-rolagem so-computador" style="scroll-padding-left:calc(${soma} * .88rem)">
        <table class="planilha" style="width:${total}em">
          <colgroup>${cols.map((c) => `<col style="width:${c.largura}em">`).join("")}</colgroup>
          <thead><tr>${cols.map(cabecalho).join("")}</tr></thead>
          <tbody>
            ${corpo}
            ${d.perm && !d.perm.criarAcao ? "" : `<tr class="linha-nova">${cols.map((c, j) => celulaHtml(null, c, linhasAtuais.length, j, esquerdas[j])).join("")}</tr>`}
          </tbody>
        </table>
      </div>
      <p class="planilha-pe tec so-computador">Cada célula é gravada ao sair dela. Cinza: não se edita aqui (passe o mouse para ver o motivo); títulos em itálico: calculados.
        Setas e Enter: andar · Esc: desfaz a digitação · Ctrl+Z: desfazer a última alteração · Arraste ou use Shift+setas para escolher várias células (Ctrl+C copia, Delete limpa) · Ctrl+D repete para baixo · Botão direito: mais opções · Cole um bloco do Excel ou do Google Planilhas a partir da célula escolhida ·
        Em “Depende de”, ${d.usaCodigos ? "números ou códigos" : "números"} separados por “;”; em “Responsáveis”, siglas ou nomes (Alt+↓ abre a lista).</p>
      <p class="so-celular cartao">A edição em planilha está disponível no computador.</p>`;
    const rolagem = alvo.querySelector(".planilha-rolagem");
    if (posicao) [rolagem.scrollLeft, rolagem.scrollTop] = posicao;
    ajustarAltura();
    ajustarTextareas();
    pintarSelecao();
    restaurarFoco(foco);
    if (buscaComFoco != null) { const b = alvo.querySelector("[data-busca-planilha]"); b.focus(); b.setSelectionRange(buscaComFoco, buscaComFoco); }
    if (trocouAlvo) ligar();
  }

  /** Colunas (30/10/2026): mostrar, esconder e mudar a ordem; as escondidas são as mesmas de "Exibir". */
  function abrirColunas(botao, focar = null) {
    const todas = ordenarColunas(colunasDaPlanilha(d), ordemColunas);
    const ocultas = d.ocultas ?? new Set();
    const moveis = todas.filter((c) => !c.fixa);
    const caixa = abrirCaixa(botao, `<div role="dialog" aria-label="Colunas">
      <h4>Colunas</h4>
      <ul class="grade-colunas">${todas.map((c) => {
        const k = moveis.indexOf(c);
        return `<li><label><input type="checkbox" data-coluna-visivel="${c.chave}"${c.obrigatoria || !ocultas.has(c.chave) ? " checked" : ""}${c.obrigatoria ? " disabled" : ""}> ${esc(c.titulo)}${c.fixa ? ' <small class="tec">parada à esquerda</small>' : ""}</label>
        ${c.fixa ? "" : `<span class="grade-colunas-mover"><button type="button" class="botao-icone" data-mover-coluna="${c.chave}" data-sentido="-1" aria-label="Mover ${esc(c.titulo)} para a esquerda"${k === 0 ? " disabled" : ""}>↑</button>
          <button type="button" class="botao-icone" data-mover-coluna="${c.chave}" data-sentido="1" aria-label="Mover ${esc(c.titulo)} para a direita"${k === moveis.length - 1 ? " disabled" : ""}>↓</button></span>`}</li>`;
      }).join("")}</ul>
      <div class="botoes"><button type="button" class="botao" data-colunas-padrao>Voltar ao padrão</button></div></div>`, 320);
    caixa.dataset.de = "colunas";
    caixa.addEventListener("change", (e) => {
      const chave = e.target.dataset.colunaVisivel;
      if (!chave || !d.ocultas) return;
      if (e.target.checked) d.ocultas.delete(chave); else d.ocultas.add(chave);
      lembrarOcultas();
      desenhar(alvo, d);
      abrirColunas(alvo.querySelector("[data-colunas-planilha]"), `[data-coluna-visivel="${chave}"]`);
    });
    caixa.addEventListener("click", (e) => {
      const mover = e.target.closest("[data-mover-coluna]");
      if (mover) {
        ordemColunas = moverColuna(colunasDaPlanilha(d), ordemColunas, mover.dataset.moverColuna, Number(mover.dataset.sentido));
        lembrarOrdem();
        desenhar(alvo, d);
        const sel = `[data-mover-coluna="${mover.dataset.moverColuna}"][data-sentido="${mover.dataset.sentido}"]`;
        return abrirColunas(alvo.querySelector("[data-colunas-planilha]"), sel);
      }
      if (e.target.closest("[data-colunas-padrao]")) {
        ordemColunas = [];
        lembrarOrdem();
        d.ocultas?.clear();
        lembrarOcultas();
        desenhar(alvo, d);
        abrirColunas(alvo.querySelector("[data-colunas-planilha]"), "[data-colunas-padrao]");
      }
    });
    const alvoDoFoco = (focar && caixa.querySelector(`${focar}:not([disabled])`)) || caixa.querySelector("input:not([disabled]), button:not([disabled])");
    alvoDoFoco?.focus();
  }

  /** Ajusta a largura da coluna ao conteúdo (clique duplo na borda do título, ou pelo menu), como no Excel. */
  function ajustarLargura(chave) {
    const tabela = alvo.querySelector(".planilha");
    if (!tabela) return;
    const emPx = parseFloat(getComputedStyle(tabela).fontSize);
    const ctx = document.createElement("canvas").getContext("2d");
    const medir = (texto, ref) => { const cs = getComputedStyle(ref); ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return ctx.measureText(texto).width; };
    const th = tabela.querySelector("th[scope=col]");
    const celula = tabela.querySelector("td input, td span, td textarea") ?? th;
    const titulo = colunasDaPlanilha(d).find((c) => c.chave === chave)?.titulo ?? "";
    let maior = medir(titulo, th) + 26; // o botão de filtro e a alça ocupam espaço no título
    for (const a of d.acoes) {
      const v = chave === "etapa" ? etapas().find((x) => x.id === a.etapa)?.nome ?? "" : valor(a, chave);
      for (const linha of String(v).split("\n")) maior = Math.max(maior, medir(linha, celula));
    }
    larguras[chave] = larguraAoConteudo(maior, emPx, 3, quebras.has(chave) ? 40 : 60);
    lembrarLarguras();
    desenhar(alvo, d);
  }

  /** Mostra colunas escondidas (as de uma marca ou todas). */
  function mostrarColunas(chaves) {
    if (!d.ocultas) return;
    for (const k of chaves) d.ocultas.delete(k);
    lembrarOcultas();
    desenhar(alvo, d);
  }

  /** Menu do botão direito no título da coluna (como no Excel). */
  function abrirMenuColuna(th, x, y) {
    const j = [...th.parentElement.children].indexOf(th);
    const c = colunas()[j];
    if (!c) return;
    const ancora = { getBoundingClientRect: () => ({ left: x, top: y, bottom: y }), contains: () => false };
    const valores = [...new Set(d.acoes.map((a) => valor(a, c.chave)))];
    const numerica = valores.some((v) => chaveDeOrdem(v)?.tipo <= 1);
    const sentido = (n) => ordenacao?.chave === c.chave && ordenacao.sentido === n;
    const temEscondidas = (d.ocultas?.size ?? 0) > 0;
    const item = (acao, texto, extra = "") => `<button type="button" role="menuitem" class="opcao-caixa${extra}" data-menu="${acao}">${texto}</button>`;
    const caixa = abrirCaixa(ancora, `<div role="menu" aria-label="Coluna ${esc(c.titulo)}" class="menu-coluna">
      ${item("az", numerica ? "Classificar do menor para o maior" : "Classificar de A a Z", sentido(1) ? " ativa" : "")}
      ${item("za", numerica ? "Classificar do maior para o menor" : "Classificar de Z a A", sentido(-1) ? " ativa" : "")}
      ${ordenacao?.chave === c.chave ? item("semordem", "Voltar à ordem do espaço") : ""}
      ${item("filtrar", "Filtrar…")}
      <hr>
      ${aceitaQuebra(c.chave) ? item("quebra", `${quebras.has(c.chave) ? "✓ " : ""}Quebrar texto`) : ""}
      ${item("ajustar", "Ajustar largura ao conteúdo")}
      ${larguras[c.chave] != null ? item("padrao", "Largura padrão") : ""}
      <hr>
      ${c.obrigatoria ? "" : item("ocultar", "Ocultar coluna")}
      ${temEscondidas ? item("mostrar", "Mostrar colunas escondidas…") : ""}
    </div>`, 250);
    caixa.dataset.de = "menu";
    caixa.addEventListener("click", (e) => {
      const b = e.target.closest("[data-menu]");
      if (!b) return;
      const acao = b.dataset.menu;
      fecharCaixa();
      if (acao === "az" || acao === "za") { ordenacao = { chave: c.chave, sentido: acao === "az" ? 1 : -1 }; return desenhar(alvo, d); }
      if (acao === "semordem") { ordenacao = null; return desenhar(alvo, d); }
      if (acao === "filtrar") { const bf = th.querySelector("[data-filtro-col]"); abrirFiltro(bf); caixaAberta.dataset.de = bf.dataset.filtroCol; return; }
      if (acao === "quebra") { if (quebras.has(c.chave)) quebras.delete(c.chave); else quebras.add(c.chave); lembrarQuebras(); return desenhar(alvo, d); }
      if (acao === "ajustar") return ajustarLargura(c.chave);
      if (acao === "padrao") { delete larguras[c.chave]; lembrarLarguras(); return desenhar(alvo, d); }
      if (acao === "ocultar") { d.ocultas?.add(c.chave); lembrarOcultas(); return desenhar(alvo, d); }
      if (acao === "mostrar") { const bc = alvo.querySelector("[data-colunas-planilha]"); if (bc) abrirColunas(bc); }
    });
    caixa.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const bs = [...caixa.querySelectorAll("button")];
      const i = bs.indexOf(document.activeElement);
      bs[(i + (e.key === "ArrowDown" ? 1 : bs.length - 1)) % bs.length]?.focus();
    });
    caixa.querySelector("button")?.focus();
  }

  /** Menu do botão direito numa célula (como no Excel). */
  function abrirMenuCelula(td, x, y) {
    const el = td.querySelector("[data-linha]");
    const pos = posicaoDe(el);
    if (!pos) return;
    const f = limites();
    const dentro = faixaMultipla() && pos.l >= f.l0 && pos.l <= f.l1 && pos.c >= f.c0 && pos.c <= f.c1;
    if (!dentro) limparFaixa();
    const naFaixa = faixaMultipla();
    const acao = acaoDaLinha(pos.l);
    const umaLinha = !naFaixa || limites().l0 === limites().l1;
    const ancora = { getBoundingClientRect: () => ({ left: x, top: y, bottom: y }), contains: () => false };
    const item = (a, texto, extra = "") => `<button type="button" role="menuitem" class="opcao-caixa${extra}" data-menu="${a}">${texto}</button>`;
    const podeEscrever = acao ? !bloqueio(acao, el.dataset.chave) || naFaixa : el.dataset.chave === "rotulo";
    const caixa = abrirCaixa(ancora, `<div role="menu" aria-label="Célula" class="menu-coluna">
      ${acao ? item("copiar", "Copiar") : ""}
      ${podeEscrever ? item("colar", "Colar") : ""}
      ${acao ? item("limpar", "Limpar conteúdo") : ""}
      ${acao && umaLinha ? `<hr>${item("abrir", `Abrir ${termos(d.espaco).acao}`)}` : ""}
      ${acao && umaLinha && d.perm?.excluirAcao ? item("excluir", `Excluir ${termos(d.espaco).acao}…`, " perigo") : ""}
    </div>`, 250);
    caixa.dataset.de = "menu";
    caixa.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-menu]");
      if (!b) return;
      const a = b.dataset.menu;
      fecharCaixa();
      try {
        if (a === "copiar") {
          const ff = faixaMultipla() ? limites() : { l0: pos.l, l1: pos.l, c0: pos.c, c1: pos.c };
          const antes = faixa; faixa = { ancora: { l: ff.l0, c: ff.c0 }, ponta: { l: ff.l1, c: ff.c1 } };
          const texto = faixaComoTexto(); faixa = antes;
          await navigator.clipboard.writeText(texto);
          avisar("Copiado.");
        } else if (a === "colar") {
          const texto = await navigator.clipboard.readText();
          colarNaFaixa(texto, celulaEl(faixaMultipla() ? limites().l0 : pos.l, faixaMultipla() ? limites().c0 : pos.c));
        } else if (a === "limpar") {
          if (!faixaMultipla()) faixa = { ancora: pos, ponta: pos };
          limparFaixaDeCelulas();
        } else if (a === "abrir") {
          d.abrirAcao?.(acao.numero);
        } else if (a === "excluir") {
          const ok = await perguntar({
            titulo: `Excluir “${esc(acao.rotulo)}”?`,
            corpo: `<p>A ${termos(d.espaco).acao} vai para a lixeira. Logo depois de excluir, o aviso oferece “Desfazer”.</p>`,
          });
          if (ok) await excluirAcao({ store, espacoId, acao, acoes: d.acoes });
        }
      } catch (err) {
        avisar(a === "copiar" || a === "colar" ? "O navegador não deixou usar a área de transferência por aqui: use Ctrl+C e Ctrl+V." : err.message);
      }
    });
    caixa.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const bs = [...caixa.querySelectorAll("button")];
      const i = bs.indexOf(document.activeElement);
      bs[(i + (e.key === "ArrowDown" ? 1 : bs.length - 1)) % bs.length]?.focus();
    });
    caixa.querySelector("button")?.focus();
  }

  /** Cola um texto: um valor só numa faixa preenche a faixa inteira (como no Excel); um bloco entra a partir da célula de cima à esquerda. */
  function colarNaFaixa(texto, el) {
    const blocos = lerColagem(texto);
    const unico = blocos.length === 1 && blocos[0].length === 1;
    if (unico && faixaMultipla()) {
      const f = limites();
      const cols = colunas();
      const itens = [];
      for (let l = f.l0; l <= f.l1; l++) for (let c = f.c0; c <= f.c1; c++) if (cols[c]) itens.push({ linha: l, chave: cols[c].chave, texto: blocos[0][0] });
      gravarLote(itens, "Colado");
      return true;
    }
    if (el && !unico) return colar(el, texto);
    if (el && unico && el.dataset.chave) { el.value = blocos[0][0]; el.dispatchEvent(new Event("change", { bubbles: true })); return true; }
    return false;
  }

  /** Desfazer (ou refazer) o último passo: regrava, na ordem, o valor de antes (ou o de depois) de cada célula. */
  function desfazerOuRefazer(refazendo) {
    const passo = refazendo ? historico.refazer() : historico.desfazer();
    if (!passo) return;
    atualizarBarra();
    ocupado = ocupado.then(async () => {
      const celulas = refazendo ? passo : [...passo].reverse();
      try {
        for (const c of celulas) {
          const atual = (await store.listarAcoes(espacoId)).find((a) => a.numero === c.numero);
          if (!atual) throw new Error(`A ${termos(d.espaco).acao} ${c.numero} não existe mais.`);
          await gravar(atual, c.chave, refazendo ? c.depois : c.antes);
          erros.delete(`${c.numero}|${c.chave}`);
        }
        avisar(refazendo ? "Alteração refeita." : "Alteração desfeita.");
      } catch (falha) {
        historico.devolver(passo, refazendo);
        avisar(`Não foi possível ${refazendo ? "refazer" : "desfazer"}: ${falha.message}`);
      }
      atualizarBarra();
      const c = passo[0];
      const linha = linhasAtuais.findIndex((a) => a.numero === c.numero);
      const coluna = colunas().findIndex((x) => x.chave === c.chave);
      alvo.querySelector(`[data-linha="${linha}"][data-col="${coluna}"]`)?.focus({ preventScroll: false });
    });
  }

  /* a planilha vai até o fim da tela (23/10/2026), como a rede; a linha de dicas fica no pé (30/10/2026) */
  function ajustarAltura() {
    const rolagem = alvo?.querySelector(".planilha-rolagem");
    if (!rolagem?.isConnected || !rolagem.offsetParent) return;
    const pe = alvo.querySelector(".planilha-pe")?.offsetHeight ?? 0;
    rolagem.style.height = `${Math.max(240, Math.floor(innerHeight - (rolagem.getBoundingClientRect().top + scrollY) - 16 - pe))}px`;
  }

  /* ---------- foco: mantido quando a grade é redesenhada por uma gravação ---------- */
  /** Textos que quebram: cada caixa cresce até mostrar o conteúdo inteiro (sem barra de rolagem). */
  function ajustarTextareas(pai = alvo) {
    for (const t of pai.querySelectorAll(".planilha textarea")) {
      t.style.height = "auto";
      if (t.scrollHeight > 0) t.style.height = `${t.scrollHeight}px`;
    }
  }

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
  const acaoDaLinha = (linha) => linhasAtuais[Number(linha)] ?? null; // a linha à vista (com filtros e classificação)

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
    const antes = el.dataset.original ?? "";
    const chaveDoErro = `${acao ? acao.numero : "nova"}|${chave}`;
    const td = el.closest("td");
    ocupado = ocupado.then(async () => {
      try {
        if (acao) await gravar(acao, chave, texto);
        else if (chave === "rotulo" && texto.trim()) await criarDaLinha({ rotulo: texto });
        if (acao) historico.registrar({ numero: acao.numero, chave, antes, depois: texto }); // criar uma ação não entra no Desfazer
        erros.delete(chaveDoErro);
        td?.classList.remove("com-erro");
        atualizarBarra();
      } catch (e) {
        /* a célula fica marcada, com o motivo, até ser gravada (30/10/2026); a marca sobrevive aos redesenhos */
        erros.set(chaveDoErro, e.message);
        td?.classList.add("com-erro");
        if (td) td.title = e.message;
        avisar(e.message);
      }
    });
  }

  /* ---------- seleção de várias células (18/11/2026, lote 2) ---------- */
  /** Faixa escolhida (Shift+clique, arrastar ou Shift+setas): `ancora` fica parada, `ponta` anda. Só vale com mais de uma célula. */
  let faixa = null; // {ancora: {l, c}, ponta: {l, c}}
  const celulaEl = (l, c) => alvo.querySelector(`[data-linha="${l}"][data-col="${c}"]`);
  const ultimaLinha = () => linhasAtuais.length - 1; // a linha em branco no fim não entra na faixa
  const limites = () => faixa && {
    l0: Math.min(faixa.ancora.l, faixa.ponta.l), l1: Math.max(faixa.ancora.l, faixa.ponta.l),
    c0: Math.min(faixa.ancora.c, faixa.ponta.c), c1: Math.max(faixa.ancora.c, faixa.ponta.c),
  };
  const faixaMultipla = () => { const f = limites(); return Boolean(f) && (f.l1 > f.l0 || f.c1 > f.c0); };
  function pintarSelecao() {
    for (const td of alvo.querySelectorAll("td.sel")) td.classList.remove("sel", "sel-topo", "sel-base", "sel-esq", "sel-dir");
    if (!faixaMultipla()) return;
    const f = limites();
    for (let l = f.l0; l <= f.l1; l++) for (let c = f.c0; c <= f.c1; c++) {
      const td = celulaEl(l, c)?.closest("td");
      if (!td) continue;
      td.classList.add("sel");
      if (l === f.l0) td.classList.add("sel-topo");
      if (l === f.l1) td.classList.add("sel-base");
      if (c === f.c0) td.classList.add("sel-esq");
      if (c === f.c1) td.classList.add("sel-dir");
    }
  }
  function escolherFaixa(ancora, ponta) {
    faixa = { ancora, ponta };
    pintarSelecao();
  }
  function limparFaixa() { if (faixa) { faixa = null; pintarSelecao(); } }
  const posicaoDe = (el) => { const x = el?.closest?.("[data-linha]"); return x ? { l: Number(x.dataset.linha), c: Number(x.dataset.col) } : null; };

  /** O texto de uma célula como a pessoa vê (datas em dd/mm/aaaa, etapa pelo nome), para copiar e repetir. */
  function textoDaCelula(l, c) {
    const el = celulaEl(l, c);
    if (!el) return "";
    if (el.tagName === "SELECT") return el.selectedOptions[0]?.textContent ?? "";
    if (el.tagName === "INPUT" && el.type === "date") return el.value ? dataBr(el.value) : "";
    return el.value ?? el.textContent ?? "";
  }
  /** A faixa (ou a célula só) como texto separado por tabulações, o formato do Excel e do Google Planilhas. */
  function faixaComoTexto() {
    const f = limites();
    const celula = (t) => (/[\t\n"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
    const linhas = [];
    for (let l = f.l0; l <= f.l1; l++) {
      const v = [];
      for (let c = f.c0; c <= f.c1; c++) v.push(celula(textoDaCelula(l, c)));
      linhas.push(v.join("\t"));
    }
    return linhas.join("\n");
  }

  /** Grava vários valores de uma vez, como um passo só do Desfazer. `itens`: {linha, chave, texto}. */
  function gravarLote(itens, rotulo) {
    /* as ações são fixadas já, pelo número: gravar uma etapa muda a ordem das linhas e redesenha a grade no meio do lote,
       e a posição das linhas deixaria de apontar para as ações escolhidas (corrigido em 18/11/2026) */
    const alvos = itens.map((i) => ({ ...i, acao: acaoDaLinha(i.linha) }));
    ocupado = ocupado.then(async () => {
      const passo = [];
      let falhas = 0;
      let feitas = 0;
      for (const { linha, chave, texto, acao } of alvos) {
        if (!acao || bloqueio(acao, chave)) continue;
        try {
          const atual = (await store.listarAcoes(espacoId)).find((a) => a.numero === acao.numero);
          const antes = valor(atual, chave);
          await gravar(atual, chave, texto);
          passo.push({ numero: acao.numero, chave, antes, depois: texto });
          feitas++;
        } catch (e) {
          falhas++;
          if (falhas === 1) avisar(`Linha ${linha + 1}: ${e.message}`);
        }
      }
      historico.registrar(passo);
      atualizarBarra();
      if (!falhas) avisar(feitas ? `${rotulo}: ${feitas} ${feitas === 1 ? "célula" : "células"}.` : "Nenhuma célula podia ser alterada aqui.");
      else avisar(`${rotulo}: ${feitas} gravadas e ${falhas} com problema (a primeira mensagem está acima).`);
    });
  }
  /** Colunas que se esvaziam sem apagar a ação: o nome nunca. */
  const limpavel = (chave) => chave !== "rotulo";
  function limparFaixaDeCelulas() {
    const f = limites();
    const cols = colunas();
    const itens = [];
    for (let l = f.l0; l <= f.l1; l++) for (let c = f.c0; c <= f.c1; c++) if (cols[c] && limpavel(cols[c].chave)) itens.push({ linha: l, chave: cols[c].chave, texto: "" });
    gravarLote(itens, "Células limpas");
  }
  /** Ctrl+D: repete para baixo o valor de cima (na faixa, o da primeira linha de cada coluna; numa célula só, o da linha de cima). */
  function repetirParaBaixo(el) {
    const cols = colunas();
    const itens = [];
    if (faixaMultipla()) {
      const f = limites();
      for (let c = f.c0; c <= f.c1; c++) for (let l = f.l0 + 1; l <= f.l1; l++) if (cols[c]) itens.push({ linha: l, chave: cols[c].chave, texto: textoDaCelula(f.l0, c) });
    } else {
      const l = Number(el.dataset.linha);
      const c = Number(el.dataset.col);
      if (l < 1 || l > ultimaLinha() || !cols[c]) return;
      itens.push({ linha: l, chave: cols[c].chave, texto: textoDaCelula(l - 1, c) });
    }
    gravarLote(itens, "Repetido para baixo");
  }

  /* ---------- colagem de um bloco ---------- */
  function colar(el, texto) {
    const blocos = lerColagem(texto);
    if (blocos.length <= 1 && (blocos[0]?.length ?? 0) <= 1) return false; // uma célula só: colagem comum
    const cols = colunas();
    const linha0 = Number(el.dataset.linha);
    const coluna0 = Number(el.dataset.col);
    ocupado = ocupado.then(async () => {
      let falhas = 0;
      let criadas = 0;
      const passo = []; // as células gravadas, para Desfazer desfazer a colagem inteira de uma vez
      for (const [i, celulas] of blocos.entries()) {
        const acao = acaoDaLinha(linha0 + i);
        const valores = {};
        celulas.forEach((texto, j) => { const c = cols[coluna0 + j]; if (c) valores[c.chave] = texto; });
        try {
          if (!acao) { if (await criarDaLinha(valores)) criadas++; continue; }
          for (const [chave, texto] of Object.entries(valores)) {
            if (bloqueio(acao, chave)) continue;
            const atual = (await store.listarAcoes(espacoId)).find((a) => a.numero === acao.numero);
            const antes = valor(atual, chave);
            await gravar(atual, chave, texto);
            passo.push({ numero: acao.numero, chave, antes, depois: texto });
          }
        } catch (e) {
          falhas++;
          avisar(`Linha ${linha0 + i + 1}: ${e.message}`);
        }
      }
      historico.registrar(passo);
      atualizarBarra();
      if (!falhas) avisar(`Colagem gravada${criadas ? `, com ${criadas} ${criadas === 1 ? "ação nova" : "ações novas"}` : ""}.`);
    });
    return true;
  }

  /** O cursor está na ponta do texto, do lado que a seta vai? (setas só saem da célula de texto na ponta) */
  const naPontaDe = (el, lado) => el.selectionStart === el.selectionEnd && el.selectionStart === (lado < 0 ? 0 : el.value.length);

  /* ---------- eventos ---------- */
  function ligar() {
    /* alargar ou estreitar uma coluna: arrastar a borda direita do título; dois cliques voltam ao original */
    alvo.addEventListener("pointerdown", (e) => {
      const alca = e.target.closest?.("[data-redimensionar]");
      if (!alca) return;
      e.preventDefault();
      const j = Number(alca.dataset.redimensionar);
      const c = colunas()[j];
      const tabela = alvo.querySelector(".planilha");
      const col = tabela.querySelectorAll("col")[j];
      const em = parseFloat(getComputedStyle(tabela).fontSize);
      const x0 = e.clientX;
      const total0 = parseFloat(tabela.style.width);
      let nova = c.largura;
      alca.setPointerCapture(e.pointerId);
      document.body.classList.add("redimensionando");
      const mover = (ev) => {
        nova = Math.max(3, Math.min(60, Math.round((c.largura + (ev.clientX - x0) / em) * 2) / 2));
        col.style.width = `${nova}em`;
        tabela.style.width = `${total0 + nova - c.largura}em`;
      };
      const soltar = () => {
        alca.removeEventListener("pointermove", mover);
        document.body.classList.remove("redimensionando");
        if (nova !== c.largura) { larguras[c.chave] = nova; lembrarLarguras(); desenhar(alvo, d); }
      };
      alca.addEventListener("pointermove", mover);
      alca.addEventListener("pointerup", soltar, { once: true });
      alca.addEventListener("pointercancel", soltar, { once: true });
    });
    alvo.addEventListener("dblclick", (e) => {
      const alca = e.target.closest?.("[data-redimensionar]");
      if (!alca) return;
      ajustarLargura(colunas()[Number(alca.dataset.redimensionar)].chave); // como no Excel; "Largura padrão" fica no menu do botão direito
    });
    /* botão direito (ou a tecla de menu) no título da coluna */
    alvo.addEventListener("contextmenu", (e) => {
      const th = e.target.closest?.("th[scope=col]");
      if (th && th.querySelector("[data-filtro-col]")) {
        e.preventDefault();
        const r = th.getBoundingClientRect();
        return abrirMenuColuna(th, e.clientX || r.left, e.clientY || r.bottom);
      }
      const td = e.target.closest?.(".planilha tbody td");
      if (td && td.querySelector("[data-linha]")) {
        e.preventDefault();
        const r = td.getBoundingClientRect();
        abrirMenuCelula(td, e.clientX || r.left, e.clientY || r.bottom);
      }
    });
    /* escolher várias células: Shift+clique, ou arrastar de uma célula a outra (dentro de uma célula só, o arrasto escolhe texto) */
    alvo.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest?.("[data-redimensionar], button, .marca-oculta")) return;
      const td = e.target.closest?.(".planilha tbody td");
      const origem = td && posicaoDe(td.querySelector("[data-linha]"));
      if (!origem) { limparFaixa(); return; }
      const ativa = posicaoDe(document.activeElement);
      if (e.shiftKey && (faixa?.ancora || ativa)) {
        e.preventDefault();
        escolherFaixa(faixa?.ancora ?? ativa, origem);
        return;
      }
      limparFaixa();
      let arrastou = false;
      const mover = (ev) => {
        const sob = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.(".planilha tbody td");
        const p = sob && posicaoDe(sob.querySelector("[data-linha]"));
        if (!p || (!arrastou && p.l === origem.l && p.c === origem.c)) return;
        if (p.l > ultimaLinha() || origem.l > ultimaLinha()) return;
        if (!arrastou) { arrastou = true; alvo.classList.add("escolhendo"); getSelection()?.removeAllRanges(); }
        escolherFaixa(origem, p);
      };
      const soltar = () => {
        document.removeEventListener("pointermove", mover);
        alvo.classList.remove("escolhendo");
        if (arrastou) celulaEl(origem.l, origem.c)?.focus({ preventScroll: true });
      };
      document.addEventListener("pointermove", mover);
      document.addEventListener("pointerup", soltar, { once: true });
      document.addEventListener("pointercancel", soltar, { once: true });
    });
    /* copiar e recortar a faixa (numa célula só, valem o copiar e o recortar do próprio campo) */
    alvo.addEventListener("copy", (e) => {
      if (!faixaMultipla()) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", faixaComoTexto());
    });
    alvo.addEventListener("cut", (e) => {
      if (!faixaMultipla()) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", faixaComoTexto());
      limparFaixaDeCelulas();
    });
    /* texto cortado: aparece inteiro ao passar o mouse */
    alvo.addEventListener("mouseover", (e) => {
      const el = e.target.closest?.(".planilha td input, .planilha td span");
      if (el && !el.title) {
        const texto = el.value ?? el.textContent;
        if (texto && el.scrollWidth > el.clientWidth + 1) el.title = texto;
      }
    });
    alvo.addEventListener("change", (e) => { if (e.target.dataset?.chave) gravarCelula(e.target); });
    alvo.addEventListener("click", (e) => {
      const filtro = e.target.closest?.("[data-filtro-col]");
      if (filtro) { e.preventDefault(); return caixaAberta && caixaAberta.dataset.de === filtro.dataset.filtroCol ? fecharCaixa() : (abrirFiltro(filtro), caixaAberta.dataset.de = filtro.dataset.filtroCol); }
      const marcaOculta = e.target.closest?.("[data-mostrar-colunas]");
      if (marcaOculta) return mostrarColunas(marcaOculta.dataset.mostrarColunas.split(","));
      const escolher = e.target.closest?.("[data-escolher]");
      if (escolher) return abrirEscolha(escolher.parentElement.querySelector("input"));
      if (e.target.closest?.("[data-limpar-tudo]")) { filtros.clear(); ordenacao = null; busca = ""; desenhar(alvo, d); return; }
      /* barra no alto e grupos (30/10/2026) */
      const grupo = e.target.closest?.("[data-recolher-grupo]");
      if (grupo) {
        const k = grupo.dataset.recolherGrupo;
        if (recolhidos.has(k)) recolhidos.delete(k); else recolhidos.add(k);
        desenhar(alvo, d);
        return alvo.querySelector(`[data-recolher-grupo="${CSS.escape(k)}"]`)?.focus();
      }
      if (e.target.closest?.("[data-agrupar-planilha]")) { agrupar = !agrupar; desenhar(alvo, d); return alvo.querySelector("[data-agrupar-planilha]")?.focus(); }
      if (e.target.closest?.("[data-desfazer-planilha]")) return desfazerOuRefazer(false);
      if (e.target.closest?.("[data-refazer-planilha]")) return desfazerOuRefazer(true);
      const colunasBotao = e.target.closest?.("[data-colunas-planilha]");
      if (colunasBotao) return caixaAberta?.dataset.de === "colunas" ? fecharCaixa() : abrirColunas(colunasBotao);
    });
    alvo.addEventListener("input", (e) => {
      if (e.target.matches?.("[data-busca-planilha]")) { busca = e.target.value; desenhar(alvo, d); return; }
      if (e.target.type === "date") e.target.toggleAttribute("data-vazia", !e.target.value);
      if (e.target.tagName === "TEXTAREA") ajustarTextareas(e.target.parentElement);
      limparFaixa(); // digitar numa célula volta a valer só ela
    });
    addEventListener("resize", () => { if (alvo.isConnected) ajustarAltura(); });
    alvo.addEventListener("keydown", (e) => {
      const el = e.target;
      if (!el.dataset?.chave) return;
      /* Ctrl+Z desfaz a última alteração gravada; com texto digitado e ainda não gravado, vale o desfazer do próprio campo */
      const ctrl = (e.ctrlKey || e.metaKey) && !e.altKey;
      const limpa = !("value" in el) || el.tagName === "SELECT" || el.value === (el.dataset.original ?? el.value);
      if (ctrl && limpa && (e.key === "z" || e.key === "Z")) { e.preventDefault(); return desfazerOuRefazer(e.shiftKey); }
      if (ctrl && limpa && (e.key === "y" || e.key === "Y")) { e.preventDefault(); return desfazerOuRefazer(true); }
      /* setas, Enter e Shift+Enter andam entre as células (23/10/2026); a saída da célula dispara a gravação (evento change).
         Num texto, ← e → só saem da célula com o cursor na ponta; Alt+↓ continua abrindo a lista da etapa */
      const ir = (dl, dc) => {
        const alvoCel = alvo.querySelector(`[data-linha="${Number(el.dataset.linha) + dl}"][data-col="${Number(el.dataset.col) + dc}"]`);
        if (!alvoCel) return false;
        alvoCel.focus();
        if (alvoCel.select && alvoCel.type !== "date" && alvoCel.type !== "number") alvoCel.select();
        return true;
      };
      const texto = (el.tagName === "INPUT" && !["date", "number"].includes(el.type)) || el.tagName === "TEXTAREA";
      /* texto que quebra: Alt+Enter começa outra linha na célula (como no Excel), só onde faz sentido */
      if (el.tagName === "TEXTAREA" && e.key === "Enter" && e.altKey && ["descricao", "justificativa"].includes(el.dataset.chave)) {
        e.preventDefault();
        el.setRangeText("\n", el.selectionStart, el.selectionEnd, "end");
        return ajustarTextareas(el.parentElement);
      }
      /* faixa: Shift+setas aumentam ou diminuem a escolha; Delete limpa; Ctrl+D repete para baixo; Esc desfaz a escolha */
      if (ctrl && !e.shiftKey && (e.key === "d" || e.key === "D")) { e.preventDefault(); return repetirParaBaixo(el); }
      if (faixaMultipla() && (e.key === "Delete" || e.key === "Backspace") && !ctrl) { e.preventDefault(); return limparFaixaDeCelulas(); }
      if (faixaMultipla() && e.key === "Escape") { e.preventDefault(); return limparFaixa(); }
      if (e.shiftKey && !ctrl && !e.altKey && e.key.startsWith("Arrow")) {
        const dl = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        const dc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        const textoNaCelula = ["INPUT", "TEXTAREA"].includes(el.tagName) && !["date", "number"].includes(el.type) && el.selectionStart !== el.selectionEnd;
        if (!textoNaCelula || faixa) { // com texto escolhido na célula e sem faixa, Shift+setas continuam escolhendo texto
          const horizontal = dc !== 0 && !faixa && ["INPUT", "TEXTAREA"].includes(el.tagName) && !["date", "number"].includes(el.type) && !naPontaDe(el, dc);
          if (!horizontal) {
            e.preventDefault();
            const base = faixa ?? { ancora: posicaoDe(el), ponta: posicaoDe(el) };
            const nova = { l: base.ponta.l + dl, c: base.ponta.c + dc };
            const cols = colunas();
            if (nova.l >= 0 && nova.l <= ultimaLinha() && nova.c >= 0 && nova.c < cols.length) {
              escolherFaixa(base.ancora, nova);
              celulaEl(nova.l, nova.c)?.scrollIntoView({ block: "nearest", inline: "nearest" });
            }
            return;
          }
        }
      }
      const naPonta = (lado) => !texto || (el.selectionStart === el.selectionEnd && el.selectionStart === (lado < 0 ? 0 : el.value.length));
      let andou = null;
      if (e.altKey && e.key === "ArrowDown" && ["responsaveis", "dependeDe"].includes(el.dataset.chave)) { e.preventDefault(); return abrirEscolha(el); }
      if (e.key === "Enter") andou = ir(e.shiftKey ? -1 : 1, 0) || true;
      else if (e.key === "ArrowDown" && !e.altKey && (el.tagName !== "TEXTAREA" || el.selectionStart === el.value.length)) andou = ir(1, 0);
      else if (e.key === "ArrowUp" && !e.altKey && (el.tagName !== "TEXTAREA" || el.selectionEnd === 0)) andou = ir(-1, 0);
      else if (e.key === "ArrowLeft" && naPonta(-1)) andou = ir(0, -1);
      else if (e.key === "ArrowRight" && naPonta(1)) andou = ir(0, 1);
      if (andou !== null) {
        limparFaixa();
        if (andou || e.key === "Enter" || !texto) e.preventDefault();
      } else if (e.key === "Escape" && "value" in el && el.value !== el.dataset.original) {
        e.preventDefault();
        el.value = el.dataset.original;
      }
    });
    alvo.addEventListener("paste", (e) => {
      const el = e.target;
      if (!el.dataset?.chave) return;
      const texto = e.clipboardData.getData("text/plain");
      if (faixaMultipla()) {
        const f = limites();
        if (colarNaFaixa(texto, celulaEl(f.l0, f.c0))) e.preventDefault();
        return;
      }
      if (colar(el, texto)) e.preventDefault();
    });
  }

  return { desenhar };
}
