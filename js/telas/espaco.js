/**
 * Espaço aberto: lista de ações (documentação técnica, seção 8.3; passo 1.6).
 * Cartões, fases e etapas recolhíveis, filtros, ordenação, "Minhas ações", legenda e animações.
 * Ferramentas na barra do topo, à direita (21/10/2026): seletor de modo, Filtrar e Ordenar (painéis
 * pequenos que abrem sob o botão) e Nova ação; no celular, um botão abre "Filtros e exibição" e o (+) cria.
 * No alto do conteúdo, só os avisos: previsão incompleta e ações atrasadas.
 */
import { criarCalendario, datasEfetivas } from "../calendario.js";
import { caminhoCritico } from "../calculo.js";
import { simular, chaveDaSimulacao } from "../simulacao.js";
import { colunasDoQuadro, nomeInicial, nomeDoFluxo, personalizadasDe } from "../situacoes.js";
import { usaEtiquetas, etiquetasDe, etiquetasDaAcao } from "../etiquetas.js";
import { etiquetaHtml } from "./etiqueta-html.js";
import { modeloDe, usaSimulacao, usaEstimativas, usaDataLimite, usaDependencias, opcoesDoCalculo, acoesParaCalculo } from "../modelos.js";
import { ICONES } from "../icones.js";
import { esc, dataBr, plural } from "../formato.js";
import { montarLinhas, contar, filtrar, ordenar, agrupar, resumir } from "../lista.js";
import { abrirPainel, avisar } from "./painel.js";
import { surgir } from "./movimento.js";
import { donosHtml, ajustarDonos } from "./pessoas.js";
import { GLOSSARIO } from "../glossario.js";
import { editarTexto, escolherParticipantes } from "./edicao-no-lugar.js";
import { abrirAcao } from "./janela-acao.js";
import { abrirNovaAcao, dataMinimaPadrao } from "./nova-acao.js";
import { criarPlanilha, colunasDaPlanilha } from "./editar-planilha.js";
import { desenharLinhaDoTempo } from "./linha-do-tempo.js";
import { desenharCronograma } from "./cronograma.js";
import { desenharRede } from "./rede.js";
import { criarTelaDeEntregas } from "./entregas.js";
import { esqueletoHtml } from "./esqueleto.js";
import { tipoDe } from "../tipos.js";
import { termos } from "../vocabulario.js";
import { registrarFonte } from "./busca.js";
import { registrarTecla } from "./atalhos.js";

const SITUACOES = {
  concluida: { texto: "Concluída", icone: "concluida", classe: "icone-concluida" },
  liberada: { texto: "Liberada", icone: "liberada", classe: "icone-liberada" },
  naoLiberada: { texto: "Não liberada", icone: "naoLiberada", classe: "icone-nao-liberada" },
};
const BOTOES_DE_FILTRO = [
  ["todas", "Todas"],
  ["liberada", "Liberadas", "liberada", "icone-liberada"],
  ["atrasada", "Atrasadas", "atrasada", "icone-atrasada"],
  ["naoLiberada", "Não liberadas", "naoLiberada", "icone-nao-liberada"],
  ["concluida", "Concluídas", "concluida", "icone-concluida"],
];
const ORDENS = [
  ["espaco", "Ordem do espaço"],
  ["prioridade", "Prioridade da equipe"], // passo 2.10a, com o campo opcional ligado
  ["execucao", "Índice de criticidade"],
  ["revisao", "Contribuição para a incerteza"],
  ["conclusao", "Conclusão prevista"],
];
const reduzirMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Mostra o espaço e acompanha as mudanças no banco: a cada gravação (de quem quer que seja),
 * recalcula e redesenha a lista e a janela aberta, mantendo filtros, ordem e grupos recolhidos.
 * @param {HTMLElement} alvo
 * @param {{store: object, espacoId: string, hoje: string, usuario?: string|null, barra: HTMLElement}} opcoes
 *   usuario: e-mail de quem entrou; sem ele, "Minhas ações" não aparece;
 *   barra: lugar das ferramentas na barra do topo
 * @returns {() => void} para de acompanhar (ao trocar de espaço)
 */
function lembrado(chave, padrao) {
  try { return localStorage.getItem(chave) || padrao; } catch { return padrao; }
}
function lerOcultasPlanilha() {
  try { return new Set(JSON.parse(localStorage.getItem("sextante.colunasPlanilha") || "[]")); } catch { return new Set(); }
}
/* "Nenhuma" saiu do seletor de barra (22/10/2026): quem a usava fica com a coluna Barras desligada */
function lerColunas() {
  let guardadas = null;
  try { guardadas = JSON.parse(localStorage.getItem("sextante.colunas") || "null"); } catch { /* sem armazenamento */ }
  if (guardadas && typeof guardadas === "object") return guardadas;
  return lembrado("sextante.barra", "") === "nenhuma" ? { barras: false } : {};
}

export function mostrarEspaco(alvo, { store, espacoId, hoje, usuario = null, barra }) {
  const ui = { modo: "lista", situacao: "todas", responsavel: "", minhas: false, etiqueta: "", ordem: "espaco", recolhidos: new Set(), legenda: false,
    /** painel aberto sob um botão da barra: "filtrar", "ordenar" ou null */
    pop: null,
    /** aproximação do cronograma: "semanas" ou "meses" */
    escalaCrono: "semanas",
    /** barra mostrada nos cartões: "tempo", "execucao" ou "revisao" (lembrada neste aparelho) */
    barra: lembrado("sextante.barra", "tempo"),
    /** colunas opcionais da lista (22/10/2026), lembradas neste aparelho; nome e situação são fixos */
    colunas: { descricao: false, participantes: true, barras: true, ...lerColunas() },
    /** colunas escondidas na planilha (23/10/2026), lembradas neste aparelho */
    ocultasPlanilha: lerOcultasPlanilha(),
    colunasAberto: false,
    /** identificador antes do nome (22/10/2026): "nenhum", "numero" (#1) ou "codigo"; null: o padrão do espaço */
    identificador: lembrado("sextante.identificador", null),
    /** número ao lado da barra de tempo restante (23/10/2026): "dias" (dias úteis) ou "data" (data prevista) */
    tempoNumero: lembrado("sextante.tempoNumero", "dias"),
    /** comparação do cronograma com um retrato (passo 1.18): lista (null: a carregar), escolhido e datas dele */
    retratos: null, comparar: null, base: null,
    /** tamanho da rede: "normal" ou "tudo" (reduzida para caber na largura) */
    escalaRede: "normal",
    /** linha de criação rápida com o cursor (chave) e o texto digitado, preservados entre redesenhos */
    rapida: null, rapidaTexto: "",
    /** entregas e registros de alcance do Plano de Ação (passo 2.6); null: ainda não lidos */
    entregas: null, alcances: [] };
  if (!["tempo", "execucao", "revisao"].includes(ui.barra)) ui.barra = "tempo";
  let chaveSim = null;
  let espaco, acoes, responsaveis, cal, sim, linhas, pessoas, meus, usaFases, usaCodigos, etapaDe, caminho;
  /** o que quem está vendo pode fazer neste espaço (papéis, passo 2.1; js/papeis.js) */
  let perm;
  let janela = null;
  /** janela "Nova ação" aberta: fica aberta entre criações e recebe as mudanças do banco */
  let novaJanela = null;
  const planilha = criarPlanilha({ store, espacoId, hoje, usuario });
  /* entregas (passo 2.6): lidas ao abrir o espaço, ao entrar na visualização e depois de cada gravação nelas */
  const ehPlano = () => tipoDe(espaco) === "planoDeAcao";
  /* Quadro de tarefas (passo 3.1): abre no quadro e cria tarefas em qualquer coluna, menos Concluídas */
  const ehQuadro = () => tipoDe(espaco) === "quadro";
  let modoInicial = false;
  let lendoEntregas = null;
  async function carregarEntregas() {
    if (!ehPlano()) { ui.entregas = null; return; }
    if (lendoEntregas) return lendoEntregas;
    lendoEntregas = (async () => {
      try {
        [ui.entregas, ui.alcances] = await Promise.all([store.listarEntregas(espacoId), store.listarAlcances(espacoId)]);
      } catch (e) {
        ui.entregas = ui.entregas ?? [];
        avisar(e.message);
      }
    })();
    await lendoEntregas;
    lendoEntregas = null;
    janela?.atualizar(dadosDaJanela());
    if (!base) return;
    cabeca.innerHTML = cabecaHtml();
    if (ui.modo === "entregas") desenharLista();
  }
  const telaEntregas = criarTelaDeEntregas({ store, espacoId, hoje, aoMudar: carregarEntregas, aoAbrirAcao: (n) => abrirJanela(n) });
  let comAcoes = null;
  let ferramentas, lista, legenda, cabeca;

  /** Recalcula tudo o que depende dos dados. */
  function derivar(dados, todos, geral) {
    espaco = dados.espaco;
    acoes = [...dados.acoes].sort((a, b) => a.ordem - b.ordem);
    responsaveis = todos;
    const datasExcluidas = datasEfetivas(espaco, geral);
    cal = criarCalendario({ ...espaco, datasExcluidas }, hoje);
    /* o modelo do espaço decide prazos, dependências e simulação (passo 2.4b) */
    caminho = caminhoCritico(acoes, cal, { hoje, ...opcoesDoCalculo(espaco) });
    if (usaSimulacao(espaco)) {
      /* a simulação só é refeita quando muda algo que entra nela (planos grandes levam até 1 s) */
      const paraSimular = acoesParaCalculo(espaco, acoes);
      const parametros = { hoje, semente: espaco.semente, simulacoes: espaco.simulacoes, prazoFinal: espaco.prazoFinal };
      const chave = chaveDaSimulacao(paraSimular, { ...parametros, inicio: espaco.inicio, datasExcluidas });
      if (chave !== chaveSim) { sim = simular(paraSimular, cal, parametros); chaveSim = chave; }
    } else { sim = null; chaveSim = null; }
    linhas = montarLinhas(acoes, caminho, sim, cal, hoje, { prazos: modeloDe(espaco).prazos, espaco });
    pessoas = new Map(responsaveis.map((r) => [r.id, r]));
    meus = usuario ? responsaveis.filter((r) => r.usuario === usuario).map((r) => r.id) : null;
    usaFases = espaco.camposOpcionais?.fasesEtapas !== false && Boolean(espaco.estrutura?.length);
    usaCodigos = espaco.camposOpcionais?.codigos === true; // desligado por padrão (seção 4.2)
    etapaDe = new Map((espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => [e.id, e.nome])));
    perm = store.permissoesEm(espaco);
    /* só o administrador cria ações (passo 2.1): some o "Nova ação" */
    document.body.classList.toggle("sem-criar-acao", !perm.criarAcao);
  }

  /** Dados prontos para a janela da ação. */
  const dadosDaJanela = () => ({
    espaco, acoes, responsaveis, cal, caminho, pessoas, meus, usaFases, perm, entregas: ui.entregas,
    linhaDe: new Map(linhas.map((l) => [l.acao.numero, l])),
    usaCodigos,
  });

  /* separadores de fases e etapas em qualquer ordenação: a ordem escolhida vale dentro de cada etapa.
     Só somem ao desligar "Fases e etapas" em Campos opcionais (decisão do responsável, 22/10/2026) */
  const agrupado = () => usaFases && ui.modo === "lista";
  const ativos = () => (ui.situacao !== "todas" ? 1 : 0) + (ui.responsavel ? 1 : 0) + (ui.minhas ? 1 : 0) + (etiquetaAtiva() ? 1 : 0) + (ui.ordem !== "espaco" ? 1 : 0);
  /* filtro por etiqueta (passo 2.10a): só com o campo ligado e a etiqueta ainda no catálogo */
  const etiquetaAtiva = () => (usaEtiquetas(espaco) && etiquetasDe(espaco).some((x) => x.id === ui.etiqueta) ? ui.etiqueta : "");
  const visiveis = () => ordenar(filtrar(linhas, {
    situacao: ui.situacao, responsavel: ui.responsavel, minhas: ui.minhas ? meus : undefined, etiqueta: etiquetaAtiva(),
  }), ui.ordem);

  const faltam = () => linhas.filter((l) => l.semEstimativa).length;
  /* o nome do espaço fica só na barra do topo (passo 1.14c); datas e chance saíram do alto (21/10/2026): vão para a linha do tempo e o cronograma (passos 1.17a e 1.17b);
     o aviso de previsão incompleta fica sempre à vista, em qualquer modo */
  function cabecaHtml() {
    /* papéis (passo 2.1): espaço antigo sem administrador, ou quem vê sem poder alterar */
    /* encerrado (passo 2.3): só consulta; o administrador reabre */
    const quemEncerrou = espaco.encerradoPor ? responsaveis.find((r) => r.usuario === espaco.encerradoPor)?.nome ?? espaco.encerradoPor : "";
    const papelAviso = perm.encerrado ? `<p class="aviso-papel encerrado">${ICONES.concluida}<span><b>Espaço encerrado</b> em ${dataBr(espaco.encerradoEm.slice(0, 10))}${quemEncerrou ? ` por ${esc(quemEncerrou)}` : ""}: só consulta.</span>
        ${perm.reabrir && store.podeGravar ? `<button class="botao" type="button" data-reabrir>Reabrir</button>` : ""}</p>`
      : !store.podeGravar ? ""
      : perm.livre ? `<p class="aviso-papel">${ICONES.pessoa}<span><b>Este espaço ainda não tem administrador.</b> Enquanto isso, quem entra altera tudo. Quem assumir passa a definir o papel de cada pessoa.</span>
          <button class="botao" type="button" data-assumir>Assumir a administração</button></p>`
      : perm.papel === "leitor" ? `<p class="aviso-papel">${ICONES.pessoa}<span>Você é <b>Leitor</b> neste espaço: consulta e comenta, sem alterar.</span></p>`
      : !perm.papel && store.usuario ? `<p class="aviso-papel">${ICONES.pessoa}<span>Você não tem papel neste espaço: só consulta. Para participar, peça a um administrador do espaço.</span></p>`
      : perm.papel === "usuario" && espaco.fechado ? `<p class="aviso-papel">${ICONES.pessoa}<span>Espaço <b>fechado</b>: você atualiza só as ações em que é responsável.</span></p>` : "";
    /* Plano de Ação sem entregas (passo 2.6): fica como rascunho */
    const semEntregas = ehPlano() && ui.entregas && !ui.entregas.length && !perm.encerrado && ui.modo !== "entregas"
      ? `<p class="aviso-papel sem-entregas">${ICONES.modoEntregas}<span><b>Sem entregas cadastradas.</b> Este Plano de Ação fica como rascunho até ter pelo menos uma entrega.</span>
        <button class="botao" type="button" data-ir-entregas>Ver entregas</button></p>` : "";
    /* sem a linha do celular (25/10/2026): Exibir, o indicador e "Mostrar até" foram para o painel "Filtros e
       exibição" (item 3 da avaliação de usabilidade) e o alerta das atrasadas virou o chip da barra do topo, como
       no computador (item 12 da avaliação de celular); a lista começa logo abaixo da barra */
    /* resumo do prazo no celular (item 2 da avaliação de celular): na lista e no quadro, uma faixa com a conclusão
       prevista e a chance de cumprir o prazo final, que abre a linha do tempo */
    const resumoPrazo = sim && acoes.length && ["lista", "quadro"].includes(ui.modo)
      ? `<button type="button" class="resumo-prazo${espaco.prazoFinal && sim.chancePrazo < 0.5 ? " ruim" : ""}" data-modo-resumo="linha">${ICONES.modoLinha}
          <span>Conclusão prevista <b class="mono">${dataBr(cal.dataDeConclusao(sim.p50, 0))}</b>${espaco.prazoFinal ? ` · <b>${Math.round(sim.chancePrazo * 100)}%</b> de chance até o prazo` : ""}</span>${ICONES.seguir}</button>` : "";
    return `${papelAviso}${semEntregas}${resumoPrazo}
      ${faltam() ? `<p class="previsao-incompleta">${ICONES.atrasada}<span><b>Previsão incompleta:</b> ${faltam()} ${plural(faltam(), "ação sem estimativa conta", "ações sem estimativa contam")} como zero dias.</span></p>` : ""}`;
  }

  /** Monta a estrutura da tela; refeita só quando o espaço passa a ter ou deixa de ter ações. */
  /**
   * Estrutura fixa da tela: cabeçalho e ações. Sem abas desde 21/10/2026: os responsáveis
   * são do espaço e ficam em "Configurar este espaço" (seções 4.5 e 8.2).
   */
  let base = false;
  let painelAcoes;
  function montarBase() {
    base = true;
    alvo.innerHTML = `
      <h2 class="titulo-conteudo" data-titulo-conteudo>${esc(espaco.nome)}</h2>
      <section class="cabeca-espaco" data-cabeca></section>
      <div data-painel="acoes"></div>`;
    cabeca = alvo.querySelector("[data-cabeca]");
    painelAcoes = alvo.querySelector('[data-painel="acoes"]');
  }

  /** Painel da aba Ações, montado uma vez: ferramentas, legenda e lista, mesmo com o espaço vazio. */
  function montar() {
    comAcoes = true;
    painelAcoes.innerHTML = `
        <div class="legenda" data-legenda hidden>${legendaHtml(store.podeGravar)}</div>
        <div class="lista" data-lista></div>
        <button class="botao-flutuante so-celular" type="button" aria-label="Nova ${termos(espaco).acao}" data-nova>${ICONES.mais}</button>`;
    ferramentas = barra;
    lista = painelAcoes.querySelector("[data-lista]");
    /* refaz quantas pessoas cabem em cada cartão quando a largura ou a altura da lista muda (janela, grupos abertos) */
    let pendenteDonos = false;
    new ResizeObserver(() => {
      if (pendenteDonos) return;
      pendenteDonos = true;
      requestAnimationFrame(() => { pendenteDonos = false; ajustarDonos(lista); });
    }).observe(lista);
    legenda = painelAcoes.querySelector("[data-legenda]");
    ligarRapida();
    /* propriedades, e não addEventListener: a barra é a mesma para todos os espaços */
    ferramentas.onchange = aoMudarControle;
    ferramentas.onclick = aoClicarNaBarra;
    ligarArraste();
    ligarPrioridade();
    lista.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-abrir-acao]")) { e.preventDefault(); e.target.click(); }
      else if (e.key.startsWith("Arrow") && e.target.matches(".linha[data-abrir-acao]")) andarEntreCartoes(e);
      else if (ui.modo === "entregas") telaEntregas.aoTeclar(e);
    });
  }

  function desenhar() {
    /* o que o modelo do espaço não tem volta ao padrão (só nesta tela; a escolha guardada no aparelho fica) */
    if (!modoInicial) { modoInicial = true; if (ehQuadro()) ui.modo = "quadro"; }
    if (!modos().some(([v]) => v === ui.modo)) ui.modo = "lista";
    if (!barras().some(([v]) => v === ui.barra)) ui.barra = "tempo";
    if (!ordens().some(([v]) => v === ui.ordem)) ui.ordem = "espaco";
    if (!base) montarBase();
    if (!comAcoes) montar();
    cabeca.innerHTML = cabecaHtml();
    desenharFerramentas();
    desenharLista();
  }

  /* ---------- ferramentas: filtros de situação, controles e Nova ação ---------- */
  /**
   * Seletor de modo: só ícones; o modo ativo mostra também o nome, e os demais o mostram ao
   * passar o mouse (decisão do responsável, 21/10/2026). No celular, só Lista e Quadro.
   */
  const MODOS = [["lista", "Lista", "modoLista", ""], ["quadro", "Quadro", "modoQuadro", ""],
    ["rede", "Rede", "modoRede", "so-computador"],
    ["cronograma", "Cronograma", "modoCronograma", "so-computador"],
    ["planilha", "Planilha", "modoPlanilha", "so-computador"],
    ["linha", "Linha do tempo", "modoLinha", ""], /* também no celular desde 25/10/2026 (item 2 da avaliação de celular) */
    ["entregas", "Entregas", "modoEntregas", ""]];
  /**
   * Visualizações que o modelo do espaço permite (passo 2.4b): a rede pede dependências; o
   * cronograma, estimativas; a linha do tempo, simulação. Lista, quadro e planilha valem sempre.
   */
  const modos = () => MODOS.filter(([v]) => (v === "rede" ? usaDependencias(espaco) : v === "cronograma" ? usaEstimativas(espaco)
    : v === "linha" ? usaSimulacao(espaco) : v === "entregas" ? ehPlano() : true));
  /** Modos sem filtros nem ordem: mostram o espaço inteiro (no cronograma, as setas ligariam ações escondidas). */
  const semFiltros = () => ["planilha", "cronograma", "rede", "linha", "entregas"].includes(ui.modo);
  let modoDesenhado = null;
  function modosHtml() {
    const trocou = modoDesenhado !== null && modoDesenhado !== ui.modo;
    return `<div class="modos" role="group" aria-label="Exibir como">
      ${modos().map(([v, nome, icone, classe]) => `<button type="button" class="modo ${classe}" data-modo="${v}" aria-pressed="${ui.modo === v}" title="${nome}" aria-label="${nome}">
        ${ICONES[icone]}<span class="modo-nome${ui.modo === v && trocou ? " entrando" : ""}" aria-hidden="true">${nome}</span></button>`).join("")}
    </div>`;
  }
  function controlesHtml() {
    return `
      ${semFiltros() ? "" : `
      ${meus ? `<label class="alternar"><input type="checkbox" data-ctl="minhas"${ui.minhas ? " checked" : ""}> Minhas ações</label>` : ""}
      <select data-ctl="responsavel" aria-label="Responsável">
        <option value="">Todos os responsáveis</option>
        ${responsaveis.map((r) => `<option value="${esc(r.id)}"${ui.responsavel === r.id ? " selected" : ""}>${esc(r.sigla ? `${r.sigla} · ${r.nome}` : r.nome)}</option>`).join("")}
      </select>
      ${etiquetaFiltroHtml(false)}
      <select data-ctl="ordem" aria-label="Ordenar">
        ${ordens().map(([v, t]) => `<option value="${v}"${ui.ordem === v ? " selected" : ""}>${t}</option>`).join("")}
      </select>`}`;
  }
  /**
   * Até onde abrir a lista agrupada (22/10/2026, pedido do responsável): só as fases, até as etapas,
   * ou tudo, até as ações. Fica acima da lista, à vista, no computador e no celular.
   */
  const NIVEIS = [["fases", "Fases"], ["etapas", "Etapas"], ["acoes", "Ações"]];
  const idsDe = (nivel) => [...lista.querySelectorAll(`.grupo.${nivel}`)].map((g) => g.dataset.grupo);
  function nivelAtual() {
    const [fases, etapas] = [idsDe("fase"), idsDe("etapa")];
    if (!ui.recolhidos.size) return "acoes";
    if (fases.length && fases.every((id) => ui.recolhidos.has(id))) return "fases";
    if (fases.every((id) => !ui.recolhidos.has(id)) && etapas.length && etapas.every((id) => ui.recolhidos.has(id))) return "etapas";
    return null;
  }
  /**
   * Barra dos cartões (22/10/2026, decisão do responsável): uma só, à escolha, cada uma com o seu
   * símbolo e a sua cor: tempo restante (verde/vermelho), prioridade de execução (violeta) e
   * prioridade de revisão (laranja). Sem barra: desligue a coluna Barras (22/10/2026).
   */
  const BARRAS = [
    ["tempo", "Tempo restante", "barraTempo"],
    ["execucao", "Índice de criticidade", "barraExecucao"],
    ["revisao", "Contribuição para a incerteza", "barraRevisao"],
  ];
  /** Indicadores que o espaço tem: os dois índices vêm da simulação (passo 2.4b). */
  const barras = () => (usaSimulacao(espaco) ? BARRAS : BARRAS.filter(([v]) => v === "tempo"));
  /** Ordens que o espaço tem; no espaço com data-limite, "Conclusão prevista" vira "Data-limite". */
  const ordens = () => ORDENS.filter(([v]) => (usaSimulacao(espaco) || !["execucao", "revisao"].includes(v)) && (v !== "prioridade" || espaco.camposOpcionais?.prioridade === true))
    .map(([v, t]) => [v, v === "conclusao" && usaDataLimite(espaco) ? "Data-limite" : t]);
  /* no mesmo padrão do seletor de modo: símbolos, com o nome só no escolhido (22/10/2026) */
  const NOMES_BARRA = { tempo: "Tempo restante", execucao: "Índice de criticidade", revisao: "Contribuição para a incerteza" }; /* nomes técnicos de volta (22/10/2026) */
  /**
   * Colunas da lista (22/10/2026, pedido do responsável): nome e situação ficam sempre; descrição,
   * participantes e barras entram e saem por um menu. A descrição só aparece se o espaço a usa.
   */
  const usaDescricao = () => espaco.camposOpcionais?.descricao !== false;
  const colunas = () => ({ ...ui.colunas, descricao: ui.colunas.descricao && usaDescricao() });
  const OPCOES_COLUNAS = [["descricao", "Descrição"], ["participantes", "Participantes"], ["barras", "Indicador"]];
  /**
   * Identificador antes do nome (22/10/2026, decisão do responsável): o número (#1) ou o código,
   * nunca os dois, porque servem ao mesmo fim. O código só existe se o espaço usa códigos; ação
   * ainda sem código mostra o número. Vale na lista, no quadro, na rede e no cronograma.
   */
  const identificador = () => {
    const escolhido = ui.identificador ?? (usaCodigos ? "codigo" : "nenhum");
    return escolhido === "codigo" && !usaCodigos ? "nenhum" : escolhido;
  };
  const idHtml = (a) => {
    const modo = identificador();
    if (modo === "codigo" && a.codigo) return `<span class="codigo">${esc(a.codigo)}</span>`;
    return modo === "nenhum" ? "" : `<span class="codigo">#${a.numero}</span>`;
  };
  const OPCOES_ID = [["nenhum", "Nenhum"], ["numero", "Número (#1)"], ["codigo", "Código"]];
  function mudarIdentificador(v) {
    ui.identificador = v;
    try { localStorage.setItem("sextante.identificador", v); } catch { /* sem armazenamento */ }
    ui.colunasAberto = true;
    cabeca.innerHTML = cabecaHtml();
    desenharLista();
    desenharFerramentas();
  }
  function mudarColuna(v, ligada) {
    ui.colunas = { ...ui.colunas, [v]: ligada };
    try { localStorage.setItem("sextante.colunas", JSON.stringify(ui.colunas)); } catch { /* sem armazenamento */ }
    ui.colunasAberto = true;
    cabeca.innerHTML = cabecaHtml();
    desenharLista();
    desenharFerramentas();
  }
  /* clique fora do menu de colunas, ou Esc, fecha o menu */
  const fecharColunas = (e) => {
    const menu = alvo.querySelector("[data-colunas-menu][open]");
    if (!menu || (e.type === "keydown" ? e.key !== "Escape" : e.composedPath().includes(menu))) return;
    menu.open = false;
    ui.colunasAberto = false;
  };
  function mostrarBarra(v) {
    ui.barra = v;
    try { localStorage.setItem("sextante.barra", v); } catch { /* sem armazenamento */ }
    cabeca.innerHTML = cabecaHtml();
    desenharLista();
    desenharFerramentas();
  }
  function marcarNivel() {
    const atual = nivelAtual();
    for (const b of alvo.querySelectorAll("[data-nivel]")) b.setAttribute("aria-pressed", String(b.dataset.nivel === atual));
  }
  function mostrarAte(nivel) {
    ui.recolhidos.clear();
    if (nivel === "fases") for (const id of idsDe("fase")) ui.recolhidos.add(id);
    if (nivel === "etapas") for (const id of idsDe("etapa")) ui.recolhidos.add(id);
    for (const g of lista.querySelectorAll(".grupo")) {
      const fechado = ui.recolhidos.has(g.dataset.grupo);
      g.classList.toggle("fechado", fechado);
      g.querySelector(":scope > .grupo-cabeca").setAttribute("aria-expanded", String(!fechado));
    }
    marcarNivel();
    marcarLegenda();
    if (ui.pop === "exibir") desenharFerramentas();
  }

  /** Filtros ativos (situação, responsável, "Minhas ações"), para o número no funil. */
  const filtrosAtivos = () => (ui.situacao !== "todas" ? 1 : 0) + (ui.responsavel ? 1 : 0) + (ui.minhas ? 1 : 0) + (etiquetaAtiva() ? 1 : 0);

  function situacoesHtml() {
    const n = contar(linhas);
    /* com situações personalizadas (passo 2.7), as liberadas se abrem: a inicial e cada personalizada */
    const sub = ui.modo === "lista" && personalizadasDe(espaco).length
      ? [["fluxo:inicial", nomeInicial(espaco)], ...personalizadasDe(espaco).map((s) => [`fluxo:${s.id}`, s.nome])] : [];
    const botao = ([v, t, icone, classe], recuo = false) => `<button class="opcao${recuo ? " recuo" : ""}" type="button" data-filtro="${v}" aria-pressed="${ui.situacao === v}">
        <span class="opcao-icone ${classe ?? ""}">${icone ? ICONES[icone] : ""}</span><span class="opcao-texto">${t}</span><span class="n">${n[v] ?? 0}</span></button>`;
    return BOTOES_DE_FILTRO.filter(([v]) => ui.modo === "lista" || v === "todas" || v === "atrasada").map((b) =>
      botao(b[0] === "liberada" && !usaDependencias(espaco) ? ["liberada", "Em aberto", b[2], b[3]] : b)
      + (b[0] === "liberada" ? sub.map(([v, t]) => botao([v, t, v === "fluxo:inicial" ? "liberada" : "personalizada", "icone-liberada"], true)).join("") : "")).join("");
  }
  function responsavelHtml() {
    return `${meus ? `<label class="alternar"><input type="checkbox" data-ctl="minhas"${ui.minhas ? " checked" : ""}> Minhas ações</label>` : ""}
      <label class="campo-pop"><span>Responsável</span><select data-ctl="responsavel">
        <option value="">Todos</option>
        ${responsaveis.map((r) => `<option value="${esc(r.id)}"${ui.responsavel === r.id ? " selected" : ""}>${esc(r.sigla ? `${r.sigla} · ${r.nome}` : r.nome)}</option>`).join("")}
      </select></label>`;
  }
  /** Filtro por etiqueta (passo 2.10a), só no espaço que usa etiquetas e tem alguma. */
  function etiquetaFiltroHtml(comRotulo = true) {
    if (!usaEtiquetas(espaco) || !etiquetasDe(espaco).length) return "";
    const select = `<select data-ctl="etiqueta"${comRotulo ? "" : ' aria-label="Etiqueta"'}>
        <option value="">${comRotulo ? "Todas" : "Todas as etiquetas"}</option>
        ${etiquetasDe(espaco).map((x) => `<option value="${esc(x.id)}"${etiquetaAtiva() === x.id ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}
      </select>`;
    return comRotulo ? `<label class="campo-pop"><span>Etiqueta</span>${select}</label>` : select;
  }
  function ordensHtml() {
    return ordens().map(([v, t]) => `<button class="opcao" type="button" data-ordem="${v}" aria-pressed="${ui.ordem === v}"><span class="opcao-icone">${ui.ordem === v ? ICONES.marcado : ""}</span><span class="opcao-texto">${t}</span></button>`).join("");
  }
  function popoverHtml() {
    /* "Classificar e filtrar" (23/10/2026, pedido do responsável), como no Excel: a ordem primeiro, depois os filtros */
    if (ui.pop === "classificar") {
      return `<div class="popover popover-exibir" data-popover role="dialog" aria-label="Classificar e filtrar">
        <h3>Classificar por</h3><div class="opcoes-lista">${ordensHtml()}</div>
        <h3>Filtrar por situação</h3><div class="opcoes-lista">${situacoesHtml()}</div>
        ${responsavelHtml()}
        ${etiquetaFiltroHtml()}
        ${filtrosAtivos() ? '<button class="botao discreto" type="button" data-limpar-filtros>Limpar filtros</button>' : ""}
      </div>`;
    }
    if (ui.pop === "filtrar") {
      return `<div class="popover" data-popover role="dialog" aria-label="Filtrar">
        <h3>Situação</h3><div class="opcoes-lista">${situacoesHtml()}</div>
        ${responsavelHtml()}
        ${etiquetaFiltroHtml()}
        ${filtrosAtivos() ? '<button class="botao discreto" type="button" data-limpar-filtros>Limpar filtros</button>' : ""}
      </div>`;
    }
    if (ui.pop === "ordenar") {
      return `<div class="popover" data-popover role="dialog" aria-label="Ordenar">
        <h3>Ordenar por</h3><div class="opcoes-lista">${ordensHtml()}</div>
      </div>`;
    }
    if (ui.pop === "modo") {
      return `<div class="popover popover-modo" data-popover role="dialog" aria-label="Visualização">
        <h3>Visualização</h3><div class="opcoes-lista">${modos().map(([v, nome, icone]) => `<button class="opcao" type="button" data-modo="${v}" aria-pressed="${ui.modo === v}">
          <span class="opcao-icone">${ICONES[icone]}</span><span class="opcao-texto">${nome}</span>${ui.modo === v ? `<span class="opcao-marca">${ICONES.marcado}</span>` : ""}</button>`).join("")}</div>
      </div>`;
    }
    if (ui.pop === "exibir") return exibirHtml();
    if (ui.pop === "indicador") return indicadorHtml();
    return "";
  }

  /**
   * Menu "Exibir" da barra do topo (teste de 23/10/2026, pedido do responsável): reúne o que antes
   * ficava na segunda linha. Indicador (a barra dos cartões), "Mostrar até", identificador e colunas,
   * cada um só onde faz sentido.
   */
  const OPCOES_TEMPO = [["dias", "Dias úteis restantes"], ["data", "Data prevista"]];
  function mudarTempoNumero(v) {
    ui.tempoNumero = v;
    try { localStorage.setItem("sextante.tempoNumero", v); } catch { /* sem armazenamento */ }
    cabeca.innerHTML = cabecaHtml();
    desenharLista();
    desenharFerramentas();
  }
  const comIndicador = () => ui.modo === "quadro" || (ui.modo === "lista" && colunas().barras);
  const comExibir = () => ["lista", "quadro", "rede", "cronograma", "planilha"].includes(ui.modo);
  const opcao = (atributo, v, nome, ativo, icone = "") => `<button class="opcao" type="button" ${atributo}="${v}" aria-pressed="${ativo}">
      <span class="opcao-icone">${icone}</span><span class="opcao-texto">${nome}</span>${ativo ? `<span class="opcao-marca">${ICONES.marcado}</span>` : ""}</button>`;
  /** Menu próprio do indicador (23/10/2026, pedido do responsável): só onde há barras. */
  function indicadorHtml() {
    return `<div class="popover popover-exibir" data-popover role="dialog" aria-label="Indicador">${indicadorConteudo()}</div>`;
  }
  function indicadorConteudo() {
    return `
      <h3>Indicador</h3><div class="opcoes-lista">${barras().map(([v, nome, icone]) =>
        opcao("data-barra", v, nome, ui.barra === v, `<span class="barra-icone ${v}">${ICONES[icone]}</span>`)).join("")}</div>
      ${ui.barra === "tempo" ? `<h3>Ao lado da barra de tempo</h3><div class="opcoes-lista">${OPCOES_TEMPO.map(([v, nome]) =>
        opcao("data-tempo-num", v, nome, ui.tempoNumero === v)).join("")}</div>` : ""}`;
  }
  /** Colunas da planilha em "Exibir" (23/10/2026): dados da ação e calculados; a coluna Ação fica sempre. */
  function colunasDaPlanilhaHtml() {
    const todas = colunasDaPlanilha(dadosDaJanela());
    const grupo = (titulo, cols) => `<h3>${titulo}</h3><div class="colunas-escolha colunas-planilha">${cols.map((c) => c.obrigatoria
      ? `<label class="fixa"><input type="checkbox" checked disabled> ${c.titulo}</label>`
      : `<label><input type="checkbox" data-coluna-planilha="${c.chave}"${ui.ocultasPlanilha.has(c.chave) ? "" : " checked"}> ${c.titulo}</label>`).join("")}</div>`;
    return grupo("Dados da ação", todas.filter((c) => !c.calculada)) + grupo("Calculados", todas.filter((c) => c.calculada));
  }
  function exibirHtml() {
    return `<div class="popover popover-exibir" data-popover role="dialog" aria-label="Exibir">${exibirConteudo()}</div>`;
  }
  function exibirConteudo() {
    const nivel = agrupado() && lista ? nivelAtual() : null;
    return `
      ${agrupado() ? `<h3>Mostrar até</h3><div class="opcoes-lista">${NIVEIS.map(([v, nome]) => opcao("data-nivel", v, nome, nivel === v)).join("")}</div>` : ""}
      ${ui.modo === "planilha" ? colunasDaPlanilhaHtml() : `<h3>Identificador antes do nome</h3><div class="opcoes-lista">${OPCOES_ID.filter(([v]) => v !== "codigo" || usaCodigos)
        .map(([v, nome]) => opcao("data-identificador-op", v, nome, identificador() === v)).join("")}</div>`}
      ${ui.modo === "lista" ? `<h3>Colunas</h3><div class="colunas-escolha">
        <label class="fixa"><input type="checkbox" checked disabled> Nome e situação</label>
        ${OPCOES_COLUNAS.filter(([v]) => v !== "descricao" || usaDescricao()).map(([v, nome]) => `<label><input type="checkbox" data-coluna="${v}"${ui.colunas[v] ? " checked" : ""}> ${nome}</label>`).join("")}</div>` : ""}
      ${ui.modo === "planilha" ? "" : `<h3>Ajuda na tela</h3><div class="opcoes-lista">${opcao("data-legenda-op", "1", "Legenda dos símbolos", ui.legenda, ICONES.legenda)}</div>`}`;
  }

  /** Ferramentas na barra do topo: modo, Filtrar, Ordenar e Nova ação (celular: "Filtros e exibição"). */
  function desenharFerramentas({ abriu = false } = {}) {
    const planilha = semFiltros();
    const nf = filtrosAtivos();
    /* teste de 23/10/2026 (pedido do responsável): nome do espaço à esquerda, seguido dos menus
       Visualização, Filtrar, Ordenar e Exibir, todos abrindo para baixo; à direita, as atrasadas e Nova ação.
       No celular, continua o funil com "Filtros e exibição" e a segunda linha */
    const [, nomeModo] = MODOS.find(([v]) => v === ui.modo);
    if (["filtrar", "ordenar"].includes(ui.pop) || (ui.pop === "classificar" && planilha)) ui.pop = null;
    if ((ui.pop === "indicador" && !comIndicador()) || (ui.pop === "exibir" && !comExibir())) ui.pop = null;
    const atrasadas = linhas.filter((l) => l.atrasada).length;
    const menu = (pop, icone, nome, extra = "", titulo = nome) => `<button class="menu-topo" type="button" data-pop="${pop}" aria-expanded="${ui.pop === pop}" aria-haspopup="dialog" title="${titulo}">
      ${icone}<span class="menu-topo-nome">${nome}</span>${extra}<span class="menu-topo-seta" aria-hidden="true">${ICONES.abrir}</span></button>`;
    /* três grupos, como na barra do Numbers (teste de 23/10/2026): à esquerda, onde estou (nome do espaço,
       só com o menu lateral fechado, e a visualização); no centro, como vejo; à direita, o que faço */
    const doCentro = ["classificar", "exibir", "indicador"].includes(ui.pop);
    const tituloConteudo = alvo.querySelector("[data-titulo-conteudo]");
    if (tituloConteudo) tituloConteudo.textContent = espaco.nome; // o nome pode ter mudado em "Configurar este espaço"
    ferramentas.innerHTML = `
      <div class="topo-esquerda">
        <span class="titulo-barra" title="${esc(espaco.nome)}">${esc(espaco.nome)}</span>
        <div class="menus-topo so-computador">${menu("modo", ICONES.visualizacao, nomeModo, "", `Visualização: ${nomeModo}`)}</div>
        <button class="icone-barra so-celular" type="button" data-opcoes aria-label="Filtros e exibição" title="Filtros e exibição">
          ${ICONES.funil}${ativos() ? `<span class="contador">${ativos()}</span>` : ""}</button>
        ${doCentro ? "" : popoverHtml()}
      </div>
      <div class="topo-centro so-computador">
        <div class="menus-topo">
          ${planilha ? "" : menu("classificar", ICONES.funil, "Classificar e filtrar",
            (ui.ordem !== "espaco" ? '<span class="ponto-menu" title="Ordem diferente da do espaço" aria-label="Ordem diferente da do espaço"></span>' : "")
            + (nf ? `<span class="contador" aria-label="${nf} ${plural(nf, "filtro ativo", "filtros ativos")}">${nf}</span>` : ""))}
          ${comExibir() ? menu("exibir", ICONES.olho, "Exibir") : ""}
          ${comIndicador() ? menu("indicador", ICONES.indicador, "Indicador") : ""}
        </div>
        ${doCentro ? popoverHtml() : ""}
      </div>
      <div class="topo-direita">
        ${atrasadas ? `<button class="chip-atrasadas" type="button" data-filtro="${ui.situacao === "atrasada" ? "todas" : "atrasada"}" aria-pressed="${ui.situacao === "atrasada"}"
          title="${ui.situacao === "atrasada" ? "Mostrar todas as ações" : "Mostrar só as atrasadas"}">${ICONES.atrasada}${atrasadas}<span class="chip-palavra"> ${plural(atrasadas, "atrasada", "atrasadas")}</span></button>` : ""}
        <button class="botao principal so-computador" type="button" data-nova title="Nova ${termos(espaco).acao} (tecla N)" aria-keyshortcuts="N">${ICONES.mais}Nova ${termos(espaco).acao}</button>
      </div>`;
    modoDesenhado = ui.modo;
    document.body.dataset.vistaAtual = ui.modo; // largura da área conforme o modo (css)
    ajustarBarra();
    ajustarMais();
    legenda.hidden = !ui.legenda || planilha;
    if (abriu) surgir(ferramentas.querySelector("[data-popover]"));
  }

  /**
   * Nomes dos menus do topo (25/10/2026, item 4 da avaliação de usabilidade, a pedido do responsável): ícone e nome
   * sempre que couberem. Se os grupos da barra se encostam, o chip das atrasadas fica só com o número; se ainda
   * encostam, os menus ficam só com o ícone (o nome aparece ao passar o mouse e é lido pelo leitor de tela).
   * Refeito a cada desenho da barra e quando a janela muda de largura (inclusive ao abrir ou recolher a barra lateral).
   */
  function ajustarBarra() {
    const topo = ferramentas.closest(".topo");
    if (!topo) return;
    const encostam = () => {
      const gs = [...ferramentas.querySelectorAll(":scope > .topo-esquerda, :scope > .topo-centro, :scope > .topo-direita")].filter((g) => g.getClientRects().length);
      const r = gs.map((g) => g.getBoundingClientRect()).sort((a, b) => a.left - b.left);
      return r.some((a, i) => i > 0 && r[i - 1].right + 8 > a.left) || gs.some((g) => g.scrollWidth > g.clientWidth + 1)
        || [...ferramentas.querySelectorAll(".menu-topo, .chip-atrasadas")].some((el) => el.scrollWidth > el.clientWidth + 1);
    };
    topo.classList.remove("barra-curta", "barra-icones");
    if (!encostam()) return;
    topo.classList.add("barra-curta");
    if (encostam()) topo.classList.add("barra-icones");
  }
  addEventListener("resize", ajustarBarra);

  /** O (+) do celular cria o que a visualização mostra: entrega nas Entregas (só para quem pode criá-las), ação nas demais. */
  function ajustarMais() {
    const mais = alvo.querySelector(".botao-flutuante");
    if (!mais) return;
    const entregas = ui.modo === "entregas";
    mais.classList.toggle("oculto", entregas && !lista?.querySelector("[data-nova-entrega]"));
    mais.setAttribute("aria-label", entregas ? "Nova entrega" : `Nova ${termos(espaco).acao}`);
  }

  function aoClicarNaBarra(e) {
    const t = e.target;
    const pop = t.closest("[data-pop]");
    if (pop) { ui.pop = ui.pop === pop.dataset.pop ? null : pop.dataset.pop; return desenharFerramentas({ abriu: Boolean(ui.pop) }); }
    const modo = t.closest("[data-modo]");
    if (modo) { ui.pop = null; return mudarModo(modo.dataset.modo); }
    const filtro = t.closest("[data-filtro]");
    if (filtro) return mudar("situacao", filtro.dataset.filtro);
    const ordem = t.closest("[data-ordem]");
    if (ordem) return mudar("ordem", ordem.dataset.ordem);
    if (t.closest("[data-limpar-filtros]")) { ui.responsavel = ""; ui.minhas = false; ui.etiqueta = ""; return mudar("situacao", "todas"); }
    if (t.closest("[data-opcoes]")) return abrirOpcoes();
    if (t.closest("[data-nova]")) { ui.pop = null; desenharFerramentas(); return abrirNova(); }
    const barra = t.closest("[data-barra]");
    if (barra) return mostrarBarra(barra.dataset.barra);
    const nivel = t.closest("[data-nivel]");
    if (nivel) return mostrarAte(nivel.dataset.nivel);
    const tempoNum = t.closest("[data-tempo-num]");
    if (tempoNum) return mudarTempoNumero(tempoNum.dataset.tempoNum);
    const id = t.closest("[data-identificador-op]");
    if (id) return mudarIdentificador(id.dataset.identificadorOp);
    if (t.closest("[data-legenda-op]")) { ui.legenda = !ui.legenda; return desenharFerramentas(); }
  }
  /* clique fora do painel aberto, ou Esc, fecha o painel */
  const fecharPop = (e) => {
    if (!ui.pop) return;
    /* composedPath: o botão clicado pode já ter sido trocado pelo redesenho da barra */
    if (e.type === "keydown" ? e.key !== "Escape" : e.composedPath().includes(ferramentas)) return;
    ui.pop = null;
    desenharFerramentas();
  };
  document.addEventListener("click", fecharPop);
  document.addEventListener("keydown", fecharPop);
  document.addEventListener("click", fecharColunas);
  document.addEventListener("keydown", fecharColunas);
  /* legenda: no menu "Exibir" (24/10/2026; antes, item do menu lateral) e, no celular, em "Filtros e exibição" */

  /* ---------- lista ---------- */
  function medidor(valor, titulo, cor, texto) {
    if (valor == null) return `<span class="medidor vazio">—</span>`;
    return `<span class="medidor" title="${titulo}"><span class="barra-medidor"><i style="width:${Math.max(2, Math.round(valor * 100))}%;background:${cor}"></i></span><span class="num">${texto}</span></span>`;
  }
  const corDe = (l) => (l.situacao === "concluida" ? "var(--ok)" : l.execucao == null ? "var(--neutral)" : `color-mix(in oklab, var(--crit) ${Math.round(l.execucao * 100)}%, var(--neutral))`);

  const FALTA_ESTIMAR = `<span class="falta-estimar">Falta estimar</span>`;

  /* ---------- criação rápida (passo 1.14a): nome e Enter, no fim de cada etapa e da coluna Liberadas ---------- */
  /** Sem filtros: com filtro, a ação criada poderia sumir da tela logo ao nascer. */
  const comRapida = () => store.podeGravar !== false && perm.criarAcao && ui.situacao === "todas" && !ui.responsavel && !ui.minhas && !etiquetaAtiva();
  function rapidaHtml(chave, etapa = "", ondeTexto = "", situacao = "") {
    const { acao } = termos(espaco);
    return `<form class="linha-rapida" data-rapida="${esc(chave)}" data-etapa="${esc(etapa)}" data-situacao="${esc(situacao)}">${ICONES.mais}
      <input name="rotulo" maxlength="120" autocomplete="off" placeholder="Adicionar ${acao}${ondeTexto}" aria-label="Adicionar ${acao}${ondeTexto}: digite o nome e tecle Enter"></form>`;
  }
  function ligarRapida() {
    lista.addEventListener("submit", async (e) => {
      const form = e.target.closest("[data-rapida]");
      if (!form) return;
      e.preventDefault();
      const rotulo = form.rotulo.value.trim();
      if (!rotulo) return;
      ui.rapida = form.dataset.rapida;
      ui.rapidaTexto = "";
      form.rotulo.value = "";
      const naoAntesDe = dataMinimaPadrao(espaco, hoje);
      try {
        const numero = await store.criarAcao(espacoId, {
          rotulo,
          ...(form.dataset.etapa ? { etapa: form.dataset.etapa } : {}),
          ...(naoAntesDe ? { naoAntesDe } : {}),
        });
        /* Quadro de tarefas (passo 3.1): criada numa coluna personalizada, já fica nela */
        if (form.dataset.situacao) await store.mudarSituacao(espacoId, numero, form.dataset.situacao);
      } catch (falha) {
        ui.rapidaTexto = rotulo;
        const atual = lista.querySelector(`[data-rapida="${CSS.escape(ui.rapida)}"] input`);
        if (atual) atual.value = rotulo;
        avisar(falha.message);
      }
    });
    lista.addEventListener("input", (e) => { if (e.target.closest("[data-rapida]")) ui.rapidaTexto = e.target.value; });
    lista.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && e.target.closest("[data-rapida]")) { e.target.value = ""; ui.rapidaTexto = ""; e.target.blur(); }
      /* colunas do quadro: Enter grava, Esc desiste */
      const nova = e.target.closest("[data-nova-coluna]");
      const nome = e.target.closest("[data-nome-coluna]");
      if (!nova && !nome) return;
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        coluna.criando = false; coluna.editando = null;
        return desenharLista();
      }
      if (e.key !== "Enter" || nova) return; // a coluna nova é um formulário: Enter envia
      e.preventDefault();
      nome.dataset.gravando = "1";
      renomearColuna(nome.dataset.nomeColuna, nome.value);
    });
    /* coluna nova (24/10/2026): "Criar" ou Enter */
    lista.addEventListener("submit", (e) => {
      const form = e.target.closest("[data-form-coluna]");
      if (!form) return;
      e.preventDefault();
      criarColuna(form.querySelector("[data-nova-coluna]").value);
    });
    /* menu da coluna aberto: Esc fecha */
    lista.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && coluna.menu) { e.stopPropagation(); coluna.menu = null; desenharLista(); lista.querySelector(`[data-menu-coluna]`)?.focus(); }
    });
    /* sair do campo do nome também grava (como na janela da ação); sair da coluna nova vazia desiste */
    lista.addEventListener("focusout", (e) => {
      const nome = e.target.closest("[data-nome-coluna]");
      if (nome && !nome.dataset.gravando && coluna.editando === nome.dataset.nomeColuna) renomearColuna(nome.dataset.nomeColuna, nome.value);
      const nova = e.target.closest("[data-nova-coluna]");
      if (nova && coluna.criando && !nova.value.trim()) setTimeout(() => { if (coluna.criando && !lista.querySelector("[data-nova-coluna]")?.value.trim()) { coluna.criando = false; desenharLista(); } }, 150);
    });
    lista.addEventListener("focusin", (e) => {
      const form = e.target.closest("[data-rapida]");
      if (form && ui.rapida !== form.dataset.rapida) { ui.rapida = form.dataset.rapida; ui.rapidaTexto = e.target.value; }
    });
    /* o cursor foi para outro lugar (e não sumiu num redesenho): esquece a linha */
    lista.addEventListener("focusout", (e) => {
      if (e.target.closest("[data-rapida]") && e.relatedTarget && !e.relatedTarget.closest("[data-rapida]")) ui.rapida = null;
    });
  }
  /** Depois de redesenhar, devolve o cursor e o texto à linha rápida que estava em uso. */
  function restaurarRapida() {
    if (!ui.rapida) return;
    const input = lista.querySelector(`[data-rapida="${CSS.escape(ui.rapida)}"] input`);
    if (!input) return;
    input.value = ui.rapidaTexto;
    input.focus({ preventScroll: true });
  }

  /**
   * Prazo no cartão da lista como barra (22/10/2026, decisão do responsável): dias úteis que faltam
   * (verde, para a direita) ou há quantos dias a previsão venceu (vermelho, para a esquerda), numa
   * escala única do espaço: do mais vencido ao que mais falta, com o zero marcado. O número fica ao
   * lado, pequeno; a data aparece ao parar o mouse.
   */
  function diasDoPrazo(l) {
    if (l.situacao === "concluida" || l.semEstimativa || !l.conclusao) return null; // sem data-limite: sem barra (passo 2.4b)
    if (l.atrasada) return -Math.max(1, cal.diasUteisAte(hoje) - cal.diasUteisAte(l.vencidaEm));
    return Math.max(0, cal.diasUteisAte(l.conclusao) - cal.diasUteisAte(hoje));
  }
  /** Data curta ao lado da barra: dd/mm, ou dd/mm/aa em todas se alguma for de outro ano. */
  /* uniforme (23/10/2026, pedido do responsável): se alguma data mostrada é de outro ano, todas levam o ano */
  const dataDaBarra = (l) => { const n = diasDoPrazo(l); return n == null ? null : n < 0 ? l.vencidaEm : l.conclusao; };
  const comAno = () => linhas.some((l) => { const d = l.situacao !== "concluida" && !l.semEstimativa ? dataDaBarra(l) : null; return d && d.slice(0, 4) !== hoje.slice(0, 4); });
  const dataCurta = (iso, ano) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}${ano ? `/${iso.slice(2, 4)}` : ""}` : "");
  function prazoHtml(l) {
    const n = diasDoPrazo(l);
    const valores = linhas.map(diasDoPrazo).filter((x) => x != null);
    const min = Math.min(0, ...valores);
    const max = Math.max(0, ...valores);
    const faixa = max - min || 1;
    const zero = ((0 - min) / faixa) * 100;
    const largura = (Math.abs(n) / faixa) * 100;
    const titulo = n < 0 ? `Venceu há ${-n} ${plural(-n, "dia útil", "dias úteis")}, em ${dataBr(l.vencidaEm)}`
      : n > 0 ? `${plural(n, "Falta", "Faltam")} ${n} ${plural(n, "dia útil", "dias úteis")}: ${usaDataLimite(espaco) ? "data-limite" : "conclusão prevista"} em ${dataBr(l.conclusao)}`
      : usaDataLimite(espaco) ? "Data-limite hoje" : "Conclusão prevista para hoje";
    return `<span class="prazo-barra ${n < 0 ? "vencido" : n > 0 ? "faltam" : "zero"}" title="${titulo}" aria-label="${titulo}">
      <span class="prazo-trilho">${min < 0 ? `<i class="prazo-zero" style="left:${zero}%"></i>` : ""}${n ? `<i class="prazo-valor" style="left:${n < 0 ? zero - largura : zero}%;width:${Math.max(1.5, largura)}%"></i>` : ""}</span>
      ${ui.tempoNumero === "data" ? `<span class="prazo-num data">${dataCurta(n < 0 ? l.vencidaEm : l.conclusao, comAno())}</span>` : `<span class="prazo-num">${n}<small class="prazo-unidade" aria-hidden="true"><span class="unidade-curta">d</span><span class="unidade-longa"> ${plural(Math.abs(n), "dia", "dias")}</span></small></span>`}</span>`;
  }

  /** A barra escolhida, com o símbolo à esquerda (22/10/2026). */
  function barraHtml(l) {
    const [, nome, icone] = BARRAS.find(([v]) => v === ui.barra);
    const simbolo = `<span class="barra-icone ${ui.barra}" title="${nome}" aria-hidden="true">${ICONES[icone]}</span>`;
    if (l.situacao === "concluida") return `<div class="pr"></div>`;
    let conteudo;
    if (ui.barra === "tempo") conteudo = l.semEstimativa ? FALTA_ESTIMAR : diasDoPrazo(l) == null ? "" : prazoHtml(l);
    else if (ui.barra === "revisao") {
      const revisao = l.revisao == null ? null : l.revisao < 0.01 ? "<1%" : `${Math.round(l.revisao * 100)}%`;
      conteudo = medidor(l.revisao, `Contribuição para a incerteza: responde por ${revisao} da incerteza do prazo final`, "var(--laranja)", revisao);
    } else conteudo = medidor(l.execucao, "Índice de criticidade", "var(--execucao)", l.execucao == null ? "" : `${Math.round(l.execucao * 100)}%`);
    return `<div class="pr">${simbolo}${conteudo}</div>`;
  }

  /** Progresso do checklist no cartão, como "2/5" (passo 2.8; seção 16.5). */
  const checklistNota = (a) => {
    const itens = a.checklist ?? [];
    if (!itens.length) return "";
    const feitos = itens.filter((i) => i.feito).length;
    return `<small class="nota-checklist${feitos === itens.length ? " completo" : ""}" title="Checklist: ${feitos} de ${itens.length} itens feitos">${ICONES.checklist}${feitos}/${itens.length}</small>`;
  };
  /** Etiquetas da ação no cartão e na linha (passo 2.10a), na ordem do catálogo. */
  const etiquetasNota = (a) => {
    if (!usaEtiquetas(espaco) || !a.etiquetas?.length) return "";
    const lista = etiquetasDaAcao(espaco, a);
    return lista.length ? `<span class="etqs">${lista.map((x) => etiquetaHtml(x)).join("")}</span>` : "";
  };
  function linhaHtml(l) {
    const a = l.acao;
    const s = SITUACOES[l.situacao];
    const donos = donosHtml(a.responsaveis.map((id) => pessoas.get(id)).filter(Boolean), { tons: espaco.tons, meus, todos: true });
    const nota = l.situacao !== "concluida" && l.reprogramacoes
      ? `${l.reprogramacoes} ${plural(l.reprogramacoes, "reprogramação", "reprogramações")}` : "";
    /* situação só com o ícone; liberada é o normal e fica sem marca (22/10/2026) */
    const sit = l.situacao === "liberada" ? ""
      : `<span class="${s.classe}" title="${s.texto}" aria-label="${s.texto}">${ICONES[s.icone]}</span>`; // só o ícone, também na não liberada
    const c = colunas();
    return `<div class="item${l.situacao === "concluida" ? " feita" : ""}" data-numero="${a.numero}" style="--calor:${corDe(l)}">
      <div class="linha" role="button" tabindex="0" data-abrir-acao>${puxadores() ? `<button type="button" class="puxador" data-puxar="${a.numero}"
        aria-label="Mudar a prioridade de ${esc(a.rotulo)}: arraste, ou use as setas para cima e para baixo" title="Arraste para mudar a prioridade">${ICONES.puxador}</button>` : ""}
        <div class="sit">${sit}</div>
        <div class="acao-nome"><span class="nome-linha">${idHtml(a)}<span class="rotulo" data-editar="rotulo">${esc(a.rotulo)}</span></span>${!agrupado() && etapaDe.get(a.etapa) ? `<span class="etapa">${esc(etapaDe.get(a.etapa))}</span>` : ""}${
          /* avisos pequenos sob o nome; o ícone da situação fica antes do nome, numa coluna estreita (22/10/2026) */
          [l.situacao === "liberada" && l.fluxo !== "inicial" ? `<span class="tag-situacao">${ICONES.personalizada}${esc(nomeDoFluxo(espaco, l.fluxo))}</span>` : "",
            l.aPartirDe ? `<span class="tec">a partir de ${dataBr(l.aPartirDe)}</span>` : "", l.semEstimativa && !(c.barras && ui.barra === "tempo") ? FALTA_ESTIMAR : "", nota ? `<small class="nota-reprog">${nota}</small>` : "", checklistNota(a), etiquetasNota(a)].join("")}</div>
        ${c.descricao ? `<div class="desc" data-editar="descricao">${esc(a.descricao ?? "")}</div>` : ""}
        ${c.participantes ? `<div class="donos" data-editar="responsaveis">${donos}</div>` : ""}
        ${c.barras ? barraHtml(l) : ""}
      </div>
    </div>`;
  }

  /**
   * Legenda da barra na linha da etapa aberta, sobre a coluna das barras (22/10/2026, pedido do
   * responsável): nome técnico, o que representa, caixa de explicação ao passar o mouse e link para
   * o glossário, com a equação.
   */
  const LEGENDA_BARRA = {
    tempo: ["tempoRestante", "dias úteis até a conclusão; em vermelho, desde que venceu"],
    tempoData: ["tempoRestante", "barra em dias úteis até a conclusão, com a data prevista; em vermelho, venceu"],
    /* espaço com data-limite (passo 2.4b) */
    tempoLimite: ["tempoRestante", "dias úteis até a data-limite; em vermelho, desde que venceu"],
    tempoDataLimite: ["tempoRestante", "barra em dias úteis até a data-limite, com a data; em vermelho, venceu"],
    execucao: ["exec", "quanto cada dia de atraso adia o fim"],
    revisao: ["rev", "parte da incerteza do prazo final"],
  };
  /**
   * A legenda aparece só na primeira etapa aberta (25/10/2026, item 2 da avaliação de usabilidade, a pedido do
   * responsável): repetida em todas, era ruído. Continua no próprio cartão da etapa, e não num cabeçalho de
   * tabela (retirado em 20/10/2026). Refeita ao abrir ou recolher um grupo.
   */
  function marcarLegenda() {
    const etapas = [...lista.querySelectorAll(".grupo.etapa")];
    const primeira = etapas.find((g) => !g.classList.contains("fechado") && !g.parentElement.closest(".grupo.fechado"));
    for (const g of etapas) g.classList.toggle("com-legenda", g === primeira);
  }
  function legendaBarraHtml() {
    const leg = LEGENDA_BARRA[(ui.barra === "tempo" && ui.tempoNumero === "data" ? "tempoData" : ui.barra) + (ui.barra === "tempo" && usaDataLimite(espaco) ? "Limite" : "")];
    if (!leg || ui.modo !== "lista" || !colunas().barras) return "";
    const [chave, curto] = leg;
    const termo = GLOSSARIO.find((t) => t.chave === chave);
    return `<div class="legenda-barra"><span class="legenda-barra-texto">
        <span class="barra-icone ${ui.barra}">${ICONES[BARRAS.find(([v]) => v === ui.barra)[2]]}</span>
        <span class="dica-termo"><a href="#" class="oque" data-termo="${chave}">${NOMES_BARRA[ui.barra]}</a><span class="caixa-dica" role="tooltip">${termo.texto} <i>${termo.formula ? "Clique para ver como é calculado." : "Clique para ver no glossário."}</i></span></span>: ${curto}</span></div>`;
  }
  function grupoHtml(nivel, id, titulo, ls, miolo) {
    const r = resumir(ls);
    const fechado = ui.recolhidos.has(id);
    const resumo = r.total
      ? `${r.total} ${plural(r.total, "ação", "ações")} · ${r.concluidas} ${plural(r.concluidas, "concluída", "concluídas")}${r.atrasadas ? ` · <span class="grupo-atrasadas">${r.atrasadas} ${plural(r.atrasadas, "atrasada", "atrasadas")}</span>` : ""} · ${r.concluidas === r.total ? "concluído em" : "termina em"} <span class="mono">${dataBr(r.termina)}</span>`
      : "Nenhuma ação";
    return `<section class="grupo ${nivel}${fechado ? " fechado" : ""}" data-grupo="${esc(id)}">
      ${nivel === "etapa" ? legendaBarraHtml() : ""}
      <button class="grupo-cabeca" type="button" aria-expanded="${!fechado}" data-alternar-grupo="${esc(id)}">
        <span class="grupo-seta">${ICONES.seguir}</span><span class="grupo-titulo">${esc(titulo)}</span>
        <span class="grupo-info"><span class="grupo-resumo">${resumo}</span>
        ${r.atrasadas ? `<span class="icone-atrasada grupo-alerta so-celular" title="${r.atrasadas} ${plural(r.atrasadas, "ação atrasada", "ações atrasadas")}">${ICONES.atrasada}</span>` : ""}
        <span class="grupo-progresso" title="Ações concluídas"><i style="width:${r.total ? Math.round((100 * r.concluidas) / r.total) : 0}%"></i></span></span>
      </button>
      <div class="grupo-corpo"><div class="grupo-dentro">${miolo}</div></div>
    </section>`;
  }

  function desenharLista({ animar = false } = {}) {
    const antes = new Map();
    if (animar) for (const el of lista.querySelectorAll(".item")) antes.set(el.dataset.numero, el.getBoundingClientRect());
    const ls = visiveis();
    let corpo;
    if (ui.modo === "planilha") { planilha.desenhar(lista, { ...dadosDaJanela(), ocultas: ui.ocultasPlanilha }); return; }
    if (ui.modo === "cronograma") {
      desenharCronograma(lista, { espaco, acoes, caminho, cal, hoje, usaFases, identificador: idHtml, escala: ui.escalaCrono,
        aoMudarEscala: (escala) => { ui.escalaCrono = escala; desenharLista(); },
        retratos: ui.retratos, comparar: ui.comparar, base: ui.base, aoComparar: compararCom });
      if (ui.retratos === null) carregarRetratos();
      return;
    }
    if (ui.modo === "rede") {
      desenharRede(lista, { acoes, caminho, linhas, etapaDe, identificador: idHtml, escala: ui.escalaRede,
        donos: (a) => donosHtml(a.responsaveis.map((id) => pessoas.get(id)).filter(Boolean), { tons: espaco.tons, meus }),
        situacao: (l) => (l.situacao === "liberada" ? "" : `<span class="${SITUACOES[l.situacao].classe}" title="${SITUACOES[l.situacao].texto}">${ICONES[SITUACOES[l.situacao].icone]}</span>`),
        marcos: usaFases ? (espaco.estrutura ?? []).flatMap((f) => (f.etapas ?? []).map((e) => ({ id: e.id, nome: e.nome, titulo: `${f.nome} › ${e.nome}` }))) : null,
        aoMudarEscala: (escala) => { ui.escalaRede = escala; desenharLista(); } });
      return;
    }
    if (ui.modo === "linha") { desenharLinhaDoTempo(lista, { espaco, cal, sim, hoje, temAcoes: acoes.length > 0 }); return; }
    if (ui.modo === "entregas") {
      if (ui.entregas === null) { lista.innerHTML = esqueletoHtml("cartoes", 3); carregarEntregas(); return; }
      telaEntregas.desenhar(lista, { espaco, acoes, entregas: ui.entregas, alcances: ui.alcances, responsaveis, perm, meus });
      ajustarDonos(lista);
      ajustarMais();
      return;
    }
    const rapida = comRapida();
    if (ui.modo === "quadro") corpo = quadroHtml(ls);
    else if (!ls.length && !rapida) corpo = `<p class="lista-vazia">Nenhuma ${termos(espaco).acao} com esses filtros.</p>`;
    else if (agrupado()) {
      const g = agrupar(ls, espaco.estrutura, { vazias: rapida });
      corpo = g.fases.map(({ fase, etapas, linhas: daFase }) => grupoHtml("fase", fase.id, fase.nome, daFase,
        etapas.map(({ etapa, linhas: daEtapa }) => grupoHtml("etapa", etapa.id, etapa.nome, daEtapa,
          daEtapa.map(linhaHtml).join("") + (rapida ? rapidaHtml(etapa.id, etapa.id, ` em ${etapa.nome}`) : ""))).join(""))).join("")
        + (g.semEtapa.length ? grupoHtml("fase", "sem-etapa", "Sem fase nem etapa", g.semEtapa, g.semEtapa.map(linhaHtml).join("")) : "");
    } else {
      corpo = (ls.length ? "" : `<p class="lista-vazia">Este espaço ainda não tem ${termos(espaco).acoes}. Digite o nome da primeira abaixo e tecle Enter, ou use "Nova ${termos(espaco).acao}".</p>`)
        + ls.map(linhaHtml).join("") + (rapida ? rapidaHtml("lista") : "");
    }
    const rolagemDoQuadro = lista.querySelector(".quadro")?.scrollLeft ?? 0; // o redesenho não volta o quadro para a primeira coluna
    lista.innerHTML = corpo;
    const quadro = lista.querySelector(".quadro");
    if (quadro) quadro.scrollLeft = rolagemDoQuadro;
    lista.toggleAttribute("data-puxadores", ui.modo === "lista" && puxadores());
    const c = colunas();
    lista.style.setProperty("--colunas", ["18px", "minmax(0, 2.4fr)", c.descricao && "minmax(0, 2.4fr)",
      c.participantes && "minmax(0, 1.5fr)", c.barras && "minmax(0, 1.6fr)"].filter(Boolean).join(" "));
    ajustarDonos(lista);
    if (agrupado()) marcarNivel();
    marcarLegenda();
    restaurarRapida();
    /* menu "⋯" da coluna: fixo na tela, para não ser cortado pela rolagem do quadro */
    const menuColuna = ui.modo === "quadro" && coluna.menu ? lista.querySelector(".menu-da-coluna") : null;
    if (menuColuna) {
      const r = menuColuna.parentElement.querySelector("[data-menu-coluna]").getBoundingClientRect();
      Object.assign(menuColuna.style, { position: "fixed", top: `${r.bottom + 4}px`, left: `${Math.max(8, Math.min(innerWidth - 216, r.right - 208))}px`, right: "auto" });
      menuColuna.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
      const fechar = () => { removeEventListener("scroll", fechar, true); if (coluna.menu) { coluna.menu = null; desenharLista(); } };
      setTimeout(() => { if (menuColuna.isConnected) addEventListener("scroll", fechar, { capture: true, once: true }); }, 150); // depois da rolagem do próprio redesenho
    }
    /* coluna nova aberta: o cursor volta ao campo depois de cada redesenho (por exemplo, depois de criar uma) */
    const campoNovaColuna = ui.modo === "quadro" && coluna.criando ? lista.querySelector("[data-nova-coluna]") : null;
    if (campoNovaColuna && !lista.contains(document.activeElement)) {
      campoNovaColuna.focus({ preventScroll: true });
      /* rola só o quadro (e não a página) até a coluna nova, se ela estiver fora da vista */
      const q = lista.querySelector(".quadro");
      const c = campoNovaColuna.closest(".coluna").getBoundingClientRect();
      const r = q.getBoundingClientRect();
      const delta = c.right > r.right ? c.right - r.right + 16 : c.left < r.left ? c.left - r.left - 16 : 0;
      if (delta) q.scrollBy({ left: delta, behavior: reduzirMovimento() ? "auto" : "smooth" });
    }
    if (animar && !reduzirMovimento()) animarMudanca(antes);
  }

  /* as ações que continuam deslizam até a nova posição; as que entram surgem suavemente */
  function animarMudanca(antes) {
    for (const el of lista.querySelectorAll(".item")) {
      const r0 = antes.get(el.dataset.numero);
      const r1 = el.getBoundingClientRect();
      const inicio = r0 ? [{ transform: `translateY(${r0.top - r1.top}px)` }, { transform: "none" }]
        : [{ opacity: 0, transform: "scale(.98)" }, { opacity: 1, transform: "none" }];
      if (r0 && Math.abs(r0.top - r1.top) < 1) continue;
      el.animate(inicio, { duration: r0 ? 320 : 260, easing: "cubic-bezier(.2,.7,.2,1)" });
    }
  }

  /* ---------- quadro (seção 8.3): colunas por situação; "Atrasada" é carimbo, não coluna ---------- */
  const COLUNAS = [
    ["naoLiberada", "Não liberadas", "icone-nao-liberada", "Liberadas sozinhas quando as anteriores terminam e a data mínima chega."],
    ["liberada", "Liberadas", "icone-liberada", "Arraste para Concluídas ao terminar."],
    ["concluida", "Concluídas", "icone-concluida", "Arraste de volta para Liberadas para desfazer a conclusão."],
  ];
  /* cartão do quadro no estilo enxuto da lista (22/10/2026): sem data nem carimbo; a coluna diz a situação e a barra, o prazo */
  function cartaoHtml(l) {
    const a = l.acao;
    const donos = donosHtml(a.responsaveis.map((id) => pessoas.get(id)).filter(Boolean), { tons: espaco.tons, meus, todos: true });
    const arrastavel = l.situacao !== "naoLiberada" && store.podeGravar !== false && perm.atualizar(a);
    return `<article class="item cartao-quadro${l.situacao === "concluida" ? " feita" : ""}" data-numero="${a.numero}" style="--calor:${corDe(l)}"${arrastavel ? ' draggable="true"' : ""}>
      <div class="linha" role="button" tabindex="0" data-abrir-acao>
        <div class="acao-nome"><span class="nome-linha">${idHtml(a)}<span class="rotulo" data-editar="rotulo">${esc(a.rotulo)}</span></span>${etapaDe.get(a.etapa) ? `<span class="etapa">${esc(etapaDe.get(a.etapa))}</span>` : ""}${
          l.semEstimativa && ui.barra !== "tempo" ? FALTA_ESTIMAR : ""}${checklistNota(a)}${etiquetasNota(a)}</div>
        <div class="cartao-base"><div class="donos" data-editar="responsaveis">${donos}</div></div>
        ${l.situacao === "concluida" ? "" : barraHtml(l)}
      </div>
    </article>`;
  }
  /** "+ Nova coluna", antes de Concluídas: cria uma situação personalizada (passo 2.7) ali mesmo. */
  /**
   * Coluna nova (revisão de 24/10/2026, decisão do responsável, inspirada no Trello, no Planner e no Jira):
   * fechada, é uma faixa estreita com "+", antes de Concluídas; aberta, um campo com "Criar" e ×, que continua
   * aberto para a próxima coluna. Pelo menu "⋯" de uma coluna, abre logo à direita dela.
   * @param {string|null} depois  id da coluna depois da qual a nova entra; null: no fim (antes de Concluídas)
   */
  const podeMexerNasColunas = () => store.podeGravar !== false && perm.configurar;
  const criandoAqui = (depois) => (depois ? coluna.criando?.depois === depois : coluna.criando === true);
  function novaColunaHtml(depois = null) {
    if (!podeMexerNasColunas()) return "";
    if (!criandoAqui(depois)) {
      return depois ? "" : `<button type="button" class="coluna-mais" data-criar-coluna aria-label="Nova coluna" title="Nova coluna">${ICONES.mais}</button>`;
    }
    return `<section class="coluna coluna-nova" aria-label="Nova coluna"><form class="form-coluna" data-form-coluna>
      <input class="nome-coluna" data-nova-coluna maxlength="40" placeholder="Nome da coluna" aria-label="Nome da nova coluna" autocomplete="off">
      <div class="botoes"><button class="botao principal" type="submit">Criar</button>
        <button type="button" class="botao" data-fechar-nova-coluna>Cancelar</button></div>
    </form></section>`;
  }
  /** Muda a ordem das colunas personalizadas: a coluna `id` passa para a posição `para` (0 = primeira depois da inicial). */
  async function moverColuna(id, para) {
    const lista_ = [...personalizadasDe(espaco)];
    const de = lista_.findIndex((x) => x.id === id);
    if (de < 0 || para < 0 || para >= lista_.length || para === de) return;
    const [x] = lista_.splice(de, 1);
    lista_.splice(para, 0, x);
    await gravarColunas({ situacoes: lista_ });
  }
  async function gravarColunas(mudanca, mensagem) {
    try {
      await store.alterarEspaco(espacoId, mudanca);
      if (mensagem) avisar(mensagem);
      return true;
    } catch (falha) {
      avisar(falha.message);
      return false;
    }
  }
  async function criarColuna(nome) {
    const n = nome.trim();
    if (!n) return lista.querySelector("[data-nova-coluna]")?.focus();
    const atuais = personalizadasDe(espaco);
    const depois = coluna.criando?.depois ?? null;
    const id = novoIdDeSituacao();
    const pos = depois ? atuais.findIndex((x) => x.id === depois) + 1 : atuais.length;
    const novas = [...atuais.slice(0, pos), { id, nome: n }, ...atuais.slice(pos)];
    /* o campo continua aberto para a próxima coluna, logo depois da que acabou de entrar (como no Trello) */
    coluna.criando = depois ? { depois: id } : true;
    if (!(await gravarColunas({ situacoes: novas }, `Coluna “${n}” criada.`))) {
      coluna.criando = depois ? { depois } : true;
      desenharLista();
      const campo = lista.querySelector("[data-nova-coluna]");
      if (campo) { campo.value = n; campo.focus(); }
    }
  }
  async function renomearColuna(id, nome) {
    const n = nome.trim();
    coluna.editando = null;
    const atual = personalizadasDe(espaco).find((x) => x.id === id);
    if (!n || !atual || n === atual.nome) return desenharLista();
    if (!(await gravarColunas({ situacoes: personalizadasDe(espaco).map((x) => (x.id === id ? { ...x, nome: n } : x)) }, "Coluna renomeada."))) desenharLista();
  }

  /* colunas do quadro (passo 2.7): Não liberadas (com dependências), a inicial, as personalizadas e Concluídas */
  function quadroHtml(ls) {
    const comPersonalizadas = personalizadasDe(espaco).length > 0;
    const dicas = {
      naoLiberada: usaDependencias(espaco) ? COLUNAS[0][3] : "Liberadas sozinhas quando a data mínima chega.",
      inicial: comPersonalizadas ? "Arraste para a coluna seguinte conforme o trabalho anda." : COLUNAS[1][3],
      concluida: `Arraste de volta para ${usaDependencias(espaco) ? "Liberadas" : nomeInicial(espaco)} para desfazer a conclusão.`,
    };
    const icone = (chave) => (chave === "naoLiberada" ? ["icone-nao-liberada", "naoLiberada"] : chave === "concluida" ? ["icone-concluida", "concluida"]
      : chave === "inicial" ? ["icone-liberada", "liberada"] : ["icone-liberada", "personalizada"]);
    /* sem dependências, "Não liberadas" só aparece se alguma ação espera a data mínima */
    const colunas = colunasDoQuadro(espaco);
    if (!colunas.some((c) => c.chave === "naoLiberada") && ls.some((l) => l.fluxo === "naoLiberada")) colunas.unshift({ chave: "naoLiberada", titulo: "Não liberadas" });
    const ordem = personalizadasDe(espaco).map((x) => x.id);
    /* larguras: colunas iguais; a faixa do "+" estreita; a coluna nova aberta, fixa */
    const larguras = colunas.flatMap(({ chave }) => [
      ...(chave === "concluida" && podeMexerNasColunas() ? [criandoAqui(null) ? "248px" : "40px"] : []),
      "minmax(220px, 1fr)",
      ...(coluna.criando?.depois === chave ? ["248px"] : []),
    ]);
    return `<div class="quadro" style="grid-template-columns:${larguras.join(" ")}">${colunas.map(({ chave, titulo }) => {
      const daColuna = ls.filter((l) => l.fluxo === chave);
      const [classe, ic] = icone(chave);
      const personalizada = ![ "naoLiberada", "inicial", "concluida"].includes(chave);
      const editavel = personalizada && podeMexerNasColunas();
      const posicao = ordem.indexOf(chave);
      const nome = coluna.editando === chave
        ? `<input class="nome-coluna" data-nome-coluna="${esc(chave)}" maxlength="40" value="${esc(titulo)}" aria-label="Nome da coluna">`
        : editavel ? `<button type="button" class="titulo-coluna" data-renomear-coluna="${esc(chave)}" title="Clique para renomear">${esc(titulo)}</button>` : `<b>${esc(titulo)}</b>`;
      const nelas = daColuna.length;
      /* ações da coluna num menu "⋯" (24/10/2026); no computador, o título também se arrasta para mudar a ordem */
      const menu = editavel && coluna.editando !== chave ? `<span class="menu-coluna-lugar"><button type="button" class="menu-coluna" data-menu-coluna="${esc(chave)}" aria-haspopup="menu" aria-expanded="${coluna.menu === chave}" aria-label="Opções da coluna ${esc(titulo)}" title="Opções da coluna">${ICONES.opcoes}</button>
        ${coluna.menu === chave ? `<div class="menu-da-coluna" role="menu">
          <button type="button" role="menuitem" data-renomear-coluna="${esc(chave)}">Renomear</button>
          <button type="button" role="menuitem" data-mover-coluna="${esc(chave)}" data-para="${posicao - 1}"${posicao <= 0 ? " disabled" : ""}>Mover para a esquerda</button>
          <button type="button" role="menuitem" data-mover-coluna="${esc(chave)}" data-para="${posicao + 1}"${posicao >= ordem.length - 1 ? " disabled" : ""}>Mover para a direita</button>
          <button type="button" role="menuitem" data-nova-coluna-depois="${esc(chave)}">Nova coluna à direita</button>
          <button type="button" role="menuitem" class="perigo" data-retirar-coluna="${esc(chave)}">Retirar a coluna</button>
        </div>` : ""}</span>` : "";
      return `${chave === "concluida" ? novaColunaHtml() : ""}<section class="coluna" data-coluna="${esc(chave)}" aria-label="${esc(titulo)}">
        <header${editavel && coluna.editando !== chave ? ` draggable="true" data-arrastar-coluna="${esc(chave)}" class="arrastavel"` : ""}><span class="${classe}">${ICONES[ic]}</span>${nome}<span class="n">${nelas}</span>${menu}</header>
        ${coluna.retirando === chave ? `<div class="aviso-confirmar"><p>${nelas ? `${nelas} ${plural(nelas, `${termos(espaco).acao} volta`, `${termos(espaco).acoes} voltam`)} para ${esc(nomeInicial(espaco))}.` : "A coluna está vazia."} Retirar “${esc(titulo)}”?</p>
          <div class="botoes"><button type="button" class="botao principal" data-confirmar-retirar-coluna="${esc(chave)}">Retirar</button>
          <button type="button" class="botao" data-cancelar-coluna>Cancelar</button></div></div>` : ""}
        ${dicas[chave] ? `<p class="tec so-computador">${dicas[chave]}</p>` : ""}
        <div class="coluna-cartoes">${daColuna.map(cartaoHtml).join("") || `<p class="vazio">Nenhuma ${termos(espaco).acao}.</p>`}</div>
        ${chave === "inicial" && comRapida() ? rapidaHtml("quadro") : ""}
        ${personalizada && ehQuadro() && comRapida() ? rapidaHtml(`quadro-${chave}`, "", "", chave) : ""}
      </section>${personalizada ? novaColunaHtml(chave) : ""}`;
    }).join("")}</div>`;
  }

  /* arrastar no quadro (computador): entre a inicial e as personalizadas muda a situação (passo 2.7);
     para Concluídas registra a conclusão; de Concluídas para a inicial desfaz */
  let arrastada = null;
  /* colunas no próprio quadro (23/10/2026, pedido do responsável): criar, renomear e retirar ali mesmo */
  /** criando: false, true (no fim, antes de Concluídas) ou {depois: id}; menu: id da coluna com o "⋯" aberto */
  const coluna = { editando: null, retirando: null, criando: false, menu: null };
  const novoIdDeSituacao = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const linhaDe = (numero) => linhas.find((l) => l.acao.numero === numero);
  const destinoValido = (coluna, numero) => {
    const l = linhaDe(numero);
    if (!l || coluna === l.fluxo || !perm.atualizar(l.acao)) return false;
    if (l.situacao === "liberada") return coluna !== "naoLiberada";
    return l.situacao === "concluida" && coluna === "inicial";
  };
  /* ---------- prioridade da equipe (passo 2.10a; seção 5.8): arrastar pelo puxador, com o mouse, o dedo ou as setas ---------- */
  /** Puxadores à vista: ordenação "Prioridade da equipe", campo ligado, na lista e com permissão de gravar. */
  const puxadores = () => ui.ordem === "prioridade" && espaco.camposOpcionais?.prioridade === true && ui.modo === "lista" && store.podeGravar !== false && perm.priorizar;
  /** Ações irmãs do item (a mesma etapa, ou a lista inteira sem fases), na ordem da tela. */
  const irmaosDe = (item) => [...item.parentElement.querySelectorAll(":scope > .item")];
  let puxando = null;
  const limparAlvos = () => lista.querySelectorAll(".solta-antes, .solta-depois").forEach((x) => x.classList.remove("solta-antes", "solta-depois"));
  /** Move a ação para entre as vizinhas e devolve o foco ao puxador dela depois do redesenho. */
  async function priorizar(numero, depoisDe, antesDe) {
    try {
      await store.priorizar(espacoId, numero, { depoisDe, antesDe });
      setTimeout(() => lista.querySelector(`[data-puxar="${numero}"]`)?.focus(), 60);
    } catch (falha) {
      avisar(falha.message);
    }
  }
  function ligarPrioridade() {
    lista.addEventListener("pointerdown", (e) => {
      const puxador = e.target.closest?.("[data-puxar]");
      if (!puxador || e.button > 0) return;
      e.preventDefault();
      const item = puxador.closest(".item");
      puxador.setPointerCapture(e.pointerId);
      puxando = { numero: Number(item.dataset.numero), item, irmaos: irmaosDe(item).filter((x) => x !== item), indice: null };
      item.classList.add("puxando");
    });
    lista.addEventListener("pointermove", (e) => {
      if (!puxando) return;
      const { irmaos } = puxando;
      let i = irmaos.findIndex((x) => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      if (i < 0) i = irmaos.length;
      puxando.indice = i;
      limparAlvos();
      if (i < irmaos.length) irmaos[i].classList.add("solta-antes"); else irmaos.at(-1)?.classList.add("solta-depois");
      /* perto da borda da tela, rola a página */
      if (e.clientY < 70) window.scrollBy(0, -14); else if (e.clientY > innerHeight - 70) window.scrollBy(0, 14);
    });
    const soltar = (cancelar) => {
      if (!puxando) return;
      const { numero, item, irmaos, indice } = puxando;
      puxando = null;
      item.classList.remove("puxando");
      limparAlvos();
      if (cancelar || indice == null) return;
      const depoisDe = irmaos[indice - 1] ? Number(irmaos[indice - 1].dataset.numero) : null;
      const antesDe = irmaos[indice] ? Number(irmaos[indice].dataset.numero) : null;
      const todos = irmaosDe(item);
      const pos = todos.indexOf(item);
      const [cima, baixo] = [todos[pos - 1], todos[pos + 1]].map((x) => (x ? Number(x.dataset.numero) : null));
      if (cima === depoisDe && baixo === antesDe) return; // soltou onde estava
      priorizar(numero, depoisDe, antesDe);
    };
    lista.addEventListener("pointerup", () => soltar(false));
    lista.addEventListener("pointercancel", () => soltar(true));
    /* setas no puxador: sobe ou desce uma posição entre as irmãs */
    lista.addEventListener("keydown", (e) => {
      const puxador = e.target.closest?.("[data-puxar]");
      if (!puxador || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault(); e.stopPropagation();
      const item = puxador.closest(".item");
      const todos = irmaosDe(item).map((x) => Number(x.dataset.numero));
      const i = todos.indexOf(Number(item.dataset.numero));
      const j = e.key === "ArrowUp" ? i - 1 : i + 1;
      if (j < 0 || j >= todos.length) return;
      const sem = todos.filter((_, k) => k !== i);
      priorizar(todos[i], sem[j - 1] ?? null, sem[j] ?? null);
    });
  }
  /* arrastar o título de uma coluna personalizada muda a ordem delas (24/10/2026; no computador) */
  let colunaArrastada = null;
  function ligarArrasteDeColunas() {
    const alvoDe = (e) => {
      const c = e.target.closest?.(".coluna[data-coluna]");
      return c && colunaArrastada && personalizadasDe(espaco).some((x) => x.id === c.dataset.coluna) ? c : null;
    };
    const limpar = () => lista.querySelectorAll(".coluna.antes, .coluna.depois").forEach((c) => c.classList.remove("antes", "depois"));
    lista.addEventListener("dragstart", (e) => {
      const h = e.target.closest?.("[data-arrastar-coluna]");
      if (!h || e.target.closest(".cartao-quadro")) return;
      colunaArrastada = h.dataset.arrastarColuna;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `coluna:${colunaArrastada}`);
      h.closest(".coluna").classList.add("arrastando-coluna");
    });
    lista.addEventListener("dragover", (e) => {
      const c = alvoDe(e);
      if (!c) return;
      e.preventDefault();
      limpar();
      if (c.dataset.coluna === colunaArrastada) return;
      const r = c.getBoundingClientRect();
      c.classList.add(e.clientX < r.left + r.width / 2 ? "antes" : "depois");
    });
    lista.addEventListener("drop", (e) => {
      const c = alvoDe(e);
      if (!c) return;
      e.preventDefault();
      const ids = personalizadasDe(espaco).map((x) => x.id);
      const antes = c.classList.contains("antes");
      limpar();
      if (c.dataset.coluna === colunaArrastada) return;
      const semEla = ids.filter((id) => id !== colunaArrastada);
      const pos = semEla.indexOf(c.dataset.coluna) + (antes ? 0 : 1);
      moverColuna(colunaArrastada, pos);
    });
    lista.addEventListener("dragend", () => {
      limpar();
      lista.querySelector(".arrastando-coluna")?.classList.remove("arrastando-coluna");
      colunaArrastada = null;
    });
  }
  function ligarArraste() {
    ligarArrasteDeColunas();
    lista.addEventListener("dragstart", (e) => {
      const cartao = e.target.closest?.(".cartao-quadro");
      if (!cartao) return;
      arrastada = Number(cartao.dataset.numero);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(arrastada));
      cartao.classList.add("arrastando");
    });
    lista.addEventListener("dragend", (e) => {
      e.target.closest?.(".cartao-quadro")?.classList.remove("arrastando");
      for (const c of lista.querySelectorAll(".coluna.alvo")) c.classList.remove("alvo");
      arrastada = null;
    });
    lista.addEventListener("dragover", (e) => {
      const coluna = e.target.closest?.(".coluna");
      if (!coluna || arrastada == null || !destinoValido(coluna.dataset.coluna, arrastada)) return;
      e.preventDefault();
      coluna.classList.add("alvo");
    });
    lista.addEventListener("dragleave", (e) => {
      const coluna = e.target.closest?.(".coluna");
      if (coluna && !coluna.contains(e.relatedTarget)) coluna.classList.remove("alvo");
    });
    lista.addEventListener("drop", async (e) => {
      const coluna = e.target.closest?.(".coluna");
      if (!coluna || arrastada == null) return;
      e.preventDefault();
      const numero = arrastada;
      coluna.classList.remove("alvo");
      if (!destinoValido(coluna.dataset.coluna, numero)) return;
      const l = linhaDe(numero);
      if (coluna.dataset.coluna === "concluida") abrirJanela(numero, "concluir");
      else if (l.situacao === "liberada") {
        try {
          await store.mudarSituacao(espacoId, numero, coluna.dataset.coluna === "inicial" ? null : coluna.dataset.coluna);
        } catch (falha) {
          avisar(falha.message);
        }
      } else {
        try {
          await store.desfazerConclusao(espacoId, numero);
          avisar(`Conclusão desfeita. A ação voltou para ${usaDependencias(espaco) ? "as liberadas" : nomeInicial(espaco)}.`);
        } catch (falha) {
          avisar(falha.message);
        }
      }
    });
  }

  /* ---------- mudanças ---------- */
  function mudar(campo, valor) {
    ui[campo] = valor;
    cabeca.innerHTML = cabecaHtml();
    desenharFerramentas();
    desenharLista({ animar: true });
    if (painelOpcoes?.isConnected) preencherOpcoes();
  }

  /* ---------- retratos para o cronograma (passo 1.18) ---------- */
  let carregandoRetratos = false;
  async function carregarRetratos() {
    if (carregandoRetratos) return;
    carregandoRetratos = true;
    try {
      ui.retratos = await store.listarRetratos(espacoId);
    } catch {
      ui.retratos = [];
    }
    carregandoRetratos = false;
    if (ui.modo === "cronograma") desenharLista();
  }
  async function compararCom(id) {
    ui.comparar = id;
    ui.base = null;
    if (id) {
      try {
        ui.base = new Map((await store.listarAcoesDoRetrato(espacoId, id)).map((a) => [a.numero, { inicio: a.liberacaoPrevista, fim: a.conclusaoPrevista }]));
      } catch (e) {
        ui.comparar = null;
        avisar(e.message);
      }
    }
    if (ui.modo === "cronograma") desenharLista();
  }

  function mudarModo(modo) {
    if (modo === "cronograma") ui.retratos = null; // relê a lista: pode haver retrato novo
    if (modo === "entregas") carregarEntregas(); // relê: outra pessoa pode ter registrado
    if (modo === "quadro" && ui.situacao !== "atrasada") ui.situacao = "todas"; // no quadro, as colunas já separam as situações
    mudar("modo", modo);
  }

  function alternarGrupo(id) {
    const fechar = !ui.recolhidos.has(id);
    if (fechar) ui.recolhidos.add(id); else ui.recolhidos.delete(id);
    const secao = lista.querySelector(`[data-grupo="${CSS.escape(id)}"]`);
    secao.classList.toggle("fechado", fechar);
    secao.querySelector(":scope > .grupo-cabeca").setAttribute("aria-expanded", String(!fechar));
    desenharFerramentas();
    marcarNivel();
    marcarLegenda();
  }

  /* ---------- celular: painel "Filtros e exibição" ---------- */
  let painelOpcoes = null;
  function preencherOpcoes() {
    painelOpcoes.innerHTML = `
      <section class="opcoes">${modosHtml()}</section>
      ${semFiltros() ? "" : `<section class="opcoes"><h3>Situação</h3><div class="opcoes-lista">${situacoesHtml()}</div></section>
      <section class="opcoes">${controlesHtml()}</section>`}
      ${comIndicador() ? `<section class="opcoes">${indicadorConteudo()}</section>` : ""}
      ${comExibir() && ui.modo !== "planilha" ? `<section class="opcoes opcoes-exibir">${exibirConteudo()}</section>` : ""}
      ${ativos() ? `<section><button class="botao discreto" type="button" data-limpar>Limpar filtros e ordem</button></section>` : ""}`;
  }
  function abrirOpcoes() {
    painelOpcoes = abrirPainel("Filtros e exibição", "", { deBaixo: true, botao: "Pronto" });
    preencherOpcoes();
    painelOpcoes.addEventListener("change", aoMudarControle);
    painelOpcoes.addEventListener("click", (e) => {
      const modo = e.target.closest("[data-modo]");
      if (modo) mudarModo(modo.dataset.modo);
      const filtro = e.target.closest("[data-filtro]");
      if (filtro) mudar("situacao", filtro.dataset.filtro);
      if (e.target.closest("[data-limpar]")) { ui.responsavel = ""; ui.minhas = false; ui.etiqueta = ""; ui.situacao = "todas"; mudar("ordem", "espaco"); }
      /* Exibir e indicador, no celular (25/10/2026) */
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.barra) mostrarBarra(b.dataset.barra);
      else if (b.dataset.nivel) mostrarAte(b.dataset.nivel);
      else if (b.dataset.tempoNum) mudarTempoNumero(b.dataset.tempoNum);
      else if (b.dataset.identificadorOp) mudarIdentificador(b.dataset.identificadorOp);
      else if (b.dataset.legendaOp != null) { ui.legenda = !ui.legenda; desenharFerramentas(); }
      else return;
      preencherOpcoes();
    });
  }

  function aoMudarControle(e) {
    if (e.target.dataset.coluna) return mudarColuna(e.target.dataset.coluna, e.target.checked);
    if (e.target.dataset.colunaPlanilha) {
      const v = e.target.dataset.colunaPlanilha;
      if (e.target.checked) ui.ocultasPlanilha.delete(v); else ui.ocultasPlanilha.add(v);
      try { localStorage.setItem("sextante.colunasPlanilha", JSON.stringify([...ui.ocultasPlanilha])); } catch { /* sem armazenamento */ }
      return desenharLista();
    }
    const ctl = e.target.dataset.ctl;
    if (ctl) mudar(ctl, e.target.type === "checkbox" ? e.target.checked : e.target.value);
  }

  /* ---------- eventos ---------- */
  alvo.onchange = (e) => {
    const coluna = e.target.dataset?.coluna;
    if (coluna) mudarColuna(coluna, e.target.checked);
    const id = e.target.dataset?.identificador;
    if (id) mudarIdentificador(id);
    const tempoNum = e.target.dataset?.tempoNumero;
    if (tempoNum) mudarTempoNumero(tempoNum);
  };
  alvo.onclick = (e) => { // onclick, e não addEventListener: cada espaço aberto substitui o anterior
    const t = e.target;
    if (t.closest("[data-editando]")) return; // clique dentro do campo em edição
    if (t.closest("[data-puxar]")) return; // o puxador da prioridade arrasta, não abre a ação
    if (t.closest("[data-reabrir]")) {
      return store.reabrirEspaco(espacoId).then(() => avisar("Espaço reaberto.")).catch((f) => avisar(f.message));
    }
    if (t.closest("[data-ir-entregas]")) return mudarModo("entregas");
    if (t.closest("[data-modo-resumo]")) return mudarModo(t.closest("[data-modo-resumo]").dataset.modoResumo);
    if (ui.modo === "entregas" && telaEntregas.aoClicar(e)) return;
    if (t.closest("[data-assumir]")) {
      return store.assumirAdministracao(espacoId).then(() => avisar("Você agora é administrador deste espaço. Os responsáveis com e-mail viraram usuários.")).catch((f) => avisar(f.message));
    }
    /* Alt+clique num campo editável: edita ali mesmo (22/10/2026) */
    const campo = e.altKey && store.podeGravar ? t.closest("[data-editar]") : null;
    if (campo) { e.preventDefault(); return editarNoLugar(campo); }
    const filtro = t.closest("[data-filtro]");
    if (filtro) return mudar("situacao", filtro.dataset.filtro);
    const grupo = t.closest("[data-alternar-grupo]");
    if (grupo) return alternarGrupo(grupo.dataset.alternarGrupo);
    const nivel = t.closest("[data-nivel]");
    if (nivel) return mostrarAte(nivel.dataset.nivel);
    const barra = t.closest("[data-barra]");
    if (barra) return mostrarBarra(barra.dataset.barra);
    const resumoColunas = t.closest(".botao-colunas");
    if (resumoColunas) { ui.colunasAberto = !resumoColunas.parentElement.open; return; }
    if (t.closest("[data-nova]")) {
      /* nas Entregas, o (+) cria uma entrega (25/10/2026, item 5 da avaliação de celular) */
      if (ui.modo === "entregas") { lista.querySelector("[data-nova-entrega]")?.click(); return; }
      return abrirNova();
    }
    /* colunas do quadro (23/10/2026) */
    /* menu "⋯" da coluna: abre e fecha; um clique fora dele o fecha */
    const botaoMenu = t.closest("[data-menu-coluna]");
    if (botaoMenu) { coluna.menu = coluna.menu === botaoMenu.dataset.menuColuna ? null : botaoMenu.dataset.menuColuna; return desenharLista(); }
    if (coluna.menu && !t.closest(".menu-da-coluna")) { coluna.menu = null; desenharLista(); }
    if (t.closest(".menu-da-coluna")) coluna.menu = null;
    if (t.closest("[data-criar-coluna]")) { coluna.criando = true; coluna.editando = null; return desenharLista(); } // o desenho põe o cursor no campo
    const depoisDe = t.closest("[data-nova-coluna-depois]");
    if (depoisDe) { coluna.criando = { depois: depoisDe.dataset.novaColunaDepois }; return desenharLista(); }
    if (t.closest("[data-fechar-nova-coluna]")) { coluna.criando = false; return desenharLista(); }
    const mover = t.closest("[data-mover-coluna]");
    if (mover) { desenharLista(); return moverColuna(mover.dataset.moverColuna, Number(mover.dataset.para)); }
    const renomear = t.closest("[data-renomear-coluna]");
    if (renomear) {
      coluna.editando = renomear.dataset.renomearColuna;
      desenharLista();
      const campo = lista.querySelector("[data-nome-coluna]");
      campo?.focus(); campo?.select();
      return;
    }
    const retirar = t.closest("[data-retirar-coluna]");
    if (retirar) { coluna.retirando = retirar.dataset.retirarColuna; coluna.menu = null; return desenharLista(); }
    if (t.closest("[data-cancelar-coluna]")) { coluna.retirando = null; return desenharLista(); }
    const confirmar = t.closest("[data-confirmar-retirar-coluna]");
    if (confirmar) {
      coluna.retirando = null;
      return store.retirarSituacao(espacoId, confirmar.dataset.confirmarRetirarColuna)
        .then((n) => avisar(n ? `Coluna retirada. ${n} ${plural(n, "ação voltou", "ações voltaram")} para ${nomeInicial(espaco)}.` : "Coluna retirada."))
        .catch((falha) => avisar(falha.message));
    }
    const item = t.closest("[data-abrir-acao]");
    if (item) return abrirJanela(Number(item.closest("[data-numero]").dataset.numero));
  };

  function abrirNova() {
    novaJanela = abrirNovaAcao({
      aoFechar: () => { novaJanela = null; },
      store, espacoId, hoje, usuario, dados: dadosDaJanela(),
      aoCriar: (numero) => requestAnimationFrame(() => {
        const item = lista?.querySelector(`[data-numero="${numero}"]`);
        if (!item) return;
        item.scrollIntoView({ block: "center", behavior: reduzirMovimento() ? "auto" : "smooth" });
        item.classList.add("recem-criada");
        setTimeout(() => item.classList.remove("recem-criada"), 2000);
      }),
    });
  }

  /**
   * Setas entre os cartões (atalhos de teclado, 24/10/2026): na lista, ↑ e ↓ andam pelos cartões à vista (os das
   * etapas recolhidas ficam de fora); no quadro, ↑ e ↓ andam dentro da coluna e ← e → passam para a coluna ao lado,
   * no cartão de mesma altura ou no último.
   */
  function andarEntreCartoes(e) {
    const visiveis = (raiz) => [...raiz.querySelectorAll(".linha[data-abrir-acao]")].filter((el) => !el.closest(".fechado") && el.getClientRects().length);
    const atual = e.target;
    let destino = null;
    if (ui.modo === "quadro") {
      const colunas = [...lista.querySelectorAll(".coluna[data-coluna]")];
      const c = colunas.findIndex((col) => col.contains(atual));
      const daColuna = visiveis(colunas[c]);
      const i = daColuna.indexOf(atual);
      if (e.key === "ArrowUp" || e.key === "ArrowDown") destino = daColuna[i + (e.key === "ArrowDown" ? 1 : -1)];
      else {
        const passo = e.key === "ArrowRight" ? 1 : -1;
        for (let k = c + passo; k >= 0 && k < colunas.length && !destino; k += passo) {
          const outra = visiveis(colunas[k]);
          destino = outra[Math.min(i, outra.length - 1)];
        }
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const todos = visiveis(lista);
      destino = todos[todos.indexOf(atual) + (e.key === "ArrowDown" ? 1 : -1)];
    } else return;
    e.preventDefault();
    destino?.focus();
    destino?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function abrirJanela(numero, abrirCom = null) {
    janela = abrirAcao({
      store, espacoId, numero, hoje, usuario, dados: dadosDaJanela(), abrirCom,
      aoFechar: () => {
        janela = null;
        lista?.querySelector(`[data-numero="${numero}"] [data-abrir-acao]`)?.focus();
      },
    });
  }

  /* ---------- edição no lugar: Alt+clique no nome, na descrição ou nos participantes (22/10/2026) ---------- */
  /** campo de texto em edição: os redesenhos esperam o fim, para não apagar o que se digita */
  let editando = false;
  let redesenharDepois = false;
  function editarNoLugar(campo) {
    const no = campo.closest("[data-numero]");
    const numero = Number(no.dataset.numero);
    const acao = acoes.find((a) => a.numero === numero);
    if (!acao) return;
    if (!perm.atualizar(acao)) { avisar(perm.papel === "leitor" ? "Você é Leitor neste espaço: pode consultar e comentar, sem alterar." : "Você não pode alterar esta ação."); return; }
    const tipo = campo.dataset.editar;
    if (tipo === "responsaveis") {
      return escolherParticipantes(campo, {
        responsaveis, marcados: acao.responsaveis, tons: espaco.tons,
        aoMudar: (id, ligado) => (ligado ? store.acrescentarResponsavelNaAcao(espacoId, numero, id) : store.retirarResponsavelDaAcao(espacoId, numero, id)),
      });
    }
    const arrastavel = no.getAttribute("draggable") === "true";
    if (arrastavel) no.setAttribute("draggable", "false"); // no quadro, arrastar não pode roubar a seleção do texto
    editando = true;
    editarTexto(campo, {
      valor: tipo === "rotulo" ? acao.rotulo : acao.descricao ?? "",
      multilinha: tipo === "descricao",
      aoGravar: (novo) => {
        if (tipo === "rotulo" && !novo) throw new Error("Informe o nome da ação.");
        return store.alterarAcao(espacoId, numero, { [tipo]: novo });
      },
      aoTerminar: () => {
        if (arrastavel) no.setAttribute("draggable", "true");
        editando = false;
        if (redesenharDepois) { redesenharDepois = false; desenhar(); }
      },
    });
  }
  /* com Alt pressionado, os campos editáveis ficam marcados */
  const marcarAlt = (e) => {
    const ligar = e.type === "keydown" && e.key === "Alt" && store.podeGravar && ["lista", "quadro", "rede"].includes(ui.modo);
    document.body.classList.toggle("alt-edicao", ligar);
  };
  document.addEventListener("keydown", marcarAlt);
  document.addEventListener("keyup", marcarAlt);
  addEventListener("blur", marcarAlt);

  /* até a primeira leitura do banco, blocos cinza no lugar da tela anterior */
  alvo.innerHTML = esqueletoHtml("lista", 6);
  /* ---------- acompanhamento: cada mudança no banco recalcula e redesenha ---------- */
  let fila = Promise.resolve();
  const parar = store.acompanharEspaco(espacoId, (dados) => {
    fila = fila.then(async () => {
      derivar(dados, dados.responsaveis, await store.lerCalendarioGeral());
      if (editando) redesenharDepois = true; else desenhar();
      if (ui.entregas === null && ehPlano()) carregarEntregas(); // passo 2.6: o aviso "sem entregas" precisa delas
      janela?.atualizar(dadosDaJanela());
      novaJanela?.atualizar(dadosDaJanela());
    }).catch((e) => avisar(e.message));
  });
  /* atalho "N": nova ação, como o botão "Nova ação" (só onde ele aparece) */
  const tirarTeclaN = registrarTecla("n", () => {
    if (ui.modo === "entregas") { lista.querySelector("[data-nova-entrega]")?.click(); return; } // nas Entregas, nova entrega
    if (!linhas || store.podeGravar === false || !perm.criarAcao) return;
    ui.pop = null;
    desenharFerramentas();
    abrirNova();
  });
  /* busca (Ctrl+K, 24/10/2026): as ações deste espaço e os comandos dele */
  const tirarDaBusca = registrarFonte("espaco", () => {
    if (!linhas || !espaco) return [];
    const t = termos(espaco);
    const comandos = [
      ...(store.podeGravar !== false && perm.criarAcao && ui.modo !== "entregas" ? [{ titulo: `Nova ${t.acao}`, icone: "mais", palavras: "criar adicionar", executar: () => abrirNova() }] : []),
      ...modos().filter(([v, , , classe]) => v !== ui.modo && !(classe === "so-computador" && matchMedia("(max-width: 899px)").matches))
        .map(([v, nome, icone]) => ({ titulo: `Ver como ${nome.toLowerCase()}`, icone, palavras: "visualizacao exibir", executar: () => mudarModo(v) })),
      ...(linhas.some((l) => l.atrasada) && ui.situacao !== "atrasada" && !semFiltros() ? [{ titulo: `Mostrar só as ${t.acoes} atrasadas`, icone: "atrasada", palavras: "filtrar", executar: () => mudar("situacao", "atrasada") }] : []),
      ...(ui.modo !== "planilha" && ui.modo !== "entregas" ? [{ titulo: ui.legenda ? "Esconder a legenda dos símbolos" : "Mostrar a legenda dos símbolos", icone: "legenda", palavras: "ajuda simbolos", executar: () => { ui.legenda = !ui.legenda; desenharFerramentas(); } }] : []),
    ].map((c) => ({ ...c, grupo: "Neste espaço" }));
    const itens = linhas.map((l) => {
      const a = l.acao;
      const siglas = a.responsaveis.map((id) => pessoas.get(id)).filter(Boolean).map((p) => p.sigla || p.nome);
      return {
        grupo: `${t.Acoes} de ${espaco.nome}`, icone: l.atrasada ? "atrasada" : l.situacao, titulo: a.rotulo,
        detalhe: [`#${a.numero}`, a.codigo, l.atrasada ? "Atrasada" : nomeDoFluxo(espaco, l.fluxo), etapaDe.get(a.etapa)].filter(Boolean).join(" · "),
        palavras: [`#${a.numero}`, a.codigo, a.descricao, etapaDe.get(a.etapa), ...siglas].filter(Boolean).join(" "),
        executar: () => abrirJanela(a.numero),
      };
    });
    return [...comandos, ...itens];
  });
  return () => {
    tirarDaBusca();
    tirarTeclaN();
    parar();
    janela?.fechar();
    document.removeEventListener("click", fecharPop);
    document.removeEventListener("keydown", fecharPop);
    document.removeEventListener("click", fecharColunas);
    document.removeEventListener("keydown", fecharColunas);
    document.removeEventListener("keydown", marcarAlt);
    document.removeEventListener("keyup", marcarAlt);
    removeEventListener("blur", marcarAlt);
    removeEventListener("resize", ajustarBarra);
    ferramentas?.closest(".topo")?.classList.remove("barra-curta", "barra-icones");
    document.body.classList.remove("alt-edicao");
    delete document.body.dataset.vistaAtual;
    document.querySelector(".escolher-participantes")?.remove();
    barra.innerHTML = "";
    barra.onclick = null;
    barra.onchange = null;
    alvo.onchange = null;
  };
}

function legendaHtml(podeEditar) {
  return `<div class="legenda-itens">
    ${podeEditar ? "<span><b>Alt+clique</b> no nome, na descrição ou nos participantes de uma ação edita ali mesmo, sem abrir a ação (na lista, no quadro e na rede).</span>" : ""}
    <span>Barra, à escolha: <span class="barra-icone tempo">${ICONES.barraTempo}</span><a href="#" class="oque" data-termo="tempoRestante">tempo restante</a> (verde: faltam dias úteis; vermelho: venceu)
      · <span class="barra-icone execucao">${ICONES.barraExecucao}</span><a href="#" class="oque" data-termo="exec">índice de criticidade</a>
      · <span class="barra-icone revisao">${ICONES.barraRevisao}</span><a href="#" class="oque" data-termo="rev">contribuição para a incerteza</a></span>
    <span class="simbolos">
      <span><span class="icone-concluida">${ICONES.concluida}</span>Concluída</span>
      <span><span class="icone-liberada">${ICONES.liberada}</span>Liberada</span>
      <span><span class="icone-nao-liberada">${ICONES.naoLiberada}</span>Não liberada</span>
      <span><span class="icone-atrasada">${ICONES.atrasada}</span>Atrasada</span>
    </span>
  </div>`;
}
