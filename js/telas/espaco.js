/**
 * Espaço aberto: lista de ações (documentação técnica, seção 8.3; passo 1.6).
 * Cartões, fases e etapas recolhíveis, filtros, ordenação, "Minhas ações", legenda e animações.
 * Ferramentas na barra do topo, à direita (21/10/2026): seletor de modo, Filtrar e Ordenar (painéis
 * pequenos que abrem sob o botão) e Nova ação; no celular, um botão abre "Filtros e ordem" e o (+) cria.
 * No alto do conteúdo, só os avisos: previsão incompleta e ações atrasadas.
 */
import { criarCalendario, datasEfetivas } from "../calendario.js";
import { caminhoCritico } from "../calculo.js";
import { simular, chaveDaSimulacao } from "../simulacao.js";
import { modeloDe, usaSimulacao, opcoesDoCalculo, acoesParaCalculo } from "../modelos.js";
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
  const ui = { modo: "lista", situacao: "todas", responsavel: "", minhas: false, ordem: "espaco", recolhidos: new Set(), legenda: false,
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
    rapida: null, rapidaTexto: "" };
  if (!["tempo", "execucao", "revisao"].includes(ui.barra)) ui.barra = "tempo";
  let chaveSim = null;
  let espaco, acoes, responsaveis, cal, sim, linhas, pessoas, meus, usaFases, usaCodigos, etapaDe, caminho;
  let janela = null;
  /** janela "Nova ação" aberta: fica aberta entre criações e recebe as mudanças do banco */
  let novaJanela = null;
  const planilha = criarPlanilha({ store, espacoId, hoje, usuario });
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
    linhas = montarLinhas(acoes, caminho, sim, cal, hoje, { prazos: modeloDe(espaco).prazos });
    pessoas = new Map(responsaveis.map((r) => [r.id, r]));
    meus = usuario ? responsaveis.filter((r) => r.usuario === usuario).map((r) => r.id) : null;
    usaFases = espaco.camposOpcionais?.fasesEtapas !== false && Boolean(espaco.estrutura?.length);
    usaCodigos = espaco.camposOpcionais?.codigos === true; // desligado por padrão (seção 4.2)
    etapaDe = new Map((espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => [e.id, e.nome])));
  }

  /** Dados prontos para a janela da ação. */
  const dadosDaJanela = () => ({
    espaco, acoes, responsaveis, cal, caminho, pessoas, meus, usaFases,
    linhaDe: new Map(linhas.map((l) => [l.acao.numero, l])),
    usaCodigos,
  });

  /* separadores de fases e etapas em qualquer ordenação: a ordem escolhida vale dentro de cada etapa.
     Só somem ao desligar "Fases e etapas" em Campos opcionais (decisão do responsável, 22/10/2026) */
  const agrupado = () => usaFases && ui.modo === "lista";
  const ativos = () => (ui.situacao !== "todas" ? 1 : 0) + (ui.responsavel ? 1 : 0) + (ui.minhas ? 1 : 0) + (ui.ordem !== "espaco" ? 1 : 0);
  const visiveis = () => ordenar(filtrar(linhas, {
    situacao: ui.situacao, responsavel: ui.responsavel, minhas: ui.minhas ? meus : undefined,
  }), ui.ordem);

  const faltam = () => linhas.filter((l) => l.semEstimativa).length;
  /* o nome do espaço fica só na barra do topo (passo 1.14c); datas e chance saíram do alto (21/10/2026): vão para a linha do tempo e o cronograma (passos 1.17a e 1.17b);
     o aviso de previsão incompleta fica sempre à vista, em qualquer modo */
  function cabecaHtml() {
    const atrasadas = linhas.filter((l) => l.atrasada).length;
    /* "Barra" e "Mostrar até" à esquerda, alerta de atrasadas à direita, na mesma linha (22/10/2026, pedido do responsável) */
    const alerta = atrasadas ? `<button type="button" class="alerta-atrasadas" data-filtro="${ui.situacao === "atrasada" ? "todas" : "atrasada"}">${ICONES.atrasada}<span>${ui.situacao === "atrasada"
        ? `Mostrando só ${plural(atrasadas, "a ação atrasada", `as ${atrasadas} ações atrasadas`)}. <u>Mostrar todas</u>`
        : `<b>${atrasadas} ${plural(atrasadas, "ação atrasada", "ações atrasadas")}.</b> <u>Ver</u>`}</span></button>` : "";
    const naLista = ui.modo === "lista";
    const comBarra = ui.modo === "quadro" || (naLista && colunas().barras);
    const comExibir = ["lista", "quadro", "rede", "cronograma"].includes(ui.modo);
    return `${alerta || agrupado() || comExibir || comBarra ? `<div class="cabeca-linha"><div class="cabeca-controles">${comExibir ? colunasHtml() : ""}${comBarra ? barrasHtml() : ""}${agrupado() ? niveisHtml() : ""}</div>${alerta}</div>` : ""}
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
        <button class="botao-flutuante so-celular" type="button" aria-label="Nova ação" data-nova>${ICONES.mais}</button>`;
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
    lista.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-abrir-acao]")) { e.preventDefault(); e.target.click(); }
    });
  }

  function desenhar() {
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
    ["linha", "Linha do tempo", "modoLinha", "so-computador"]];
  /** Modos sem filtros nem ordem: mostram o espaço inteiro (no cronograma, as setas ligariam ações escondidas). */
  const semFiltros = () => ["planilha", "cronograma", "rede", "linha"].includes(ui.modo);
  let modoDesenhado = null;
  function modosHtml() {
    const trocou = modoDesenhado !== null && modoDesenhado !== ui.modo;
    return `<div class="modos" role="group" aria-label="Exibir como">
      ${MODOS.map(([v, nome, icone, classe]) => `<button type="button" class="modo ${classe}" data-modo="${v}" aria-pressed="${ui.modo === v}" title="${nome}" aria-label="${nome}">
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
      <select data-ctl="ordem" aria-label="Ordenar">
        ${ORDENS.map(([v, t]) => `<option value="${v}"${ui.ordem === v ? " selected" : ""}>${t}</option>`).join("")}
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
  /* no mesmo padrão do seletor de modo: símbolos, com o nome só no escolhido (22/10/2026) */
  const NOMES_BARRA = { tempo: "Tempo restante", execucao: "Índice de criticidade", revisao: "Contribuição para a incerteza" }; /* nomes técnicos de volta (22/10/2026) */
  const barrasHtml = () => `<div class="controle-rotulado"><span class="niveis-rotulo">Indicador</span><div class="modos barras" role="group" aria-label="Barra mostrada nos cartões">
      ${BARRAS.map(([v, nome, icone]) => `<button type="button" class="modo" data-barra="${v}" aria-pressed="${ui.barra === v}" title="${nome}" aria-label="${nome}"><span class="barra-icone ${v}">${ICONES[icone]}</span><span class="modo-nome" aria-hidden="true">${NOMES_BARRA[v]}</span></button>`).join("")}
    </div></div>`;
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
  /* menu "Exibir" (antes "Colunas", 22/10/2026): identificador e, na lista, as colunas */
  const colunasHtml = () => `<details class="menu-colunas" data-colunas-menu${ui.colunasAberto ? " open" : ""}>
      <summary class="botao-colunas" title="Exibir" aria-label="Exibir">${ICONES.olho}<span class="colunas-nome">Exibir</span></summary>
      <div class="popover colunas-popover" role="group" aria-label="O que exibir">
        ${comIndicador() && ui.barra === "tempo" ? `<h3>Ao lado da barra de tempo</h3>
        ${OPCOES_TEMPO.map(([v, nome]) => `<label><input type="radio" name="tempoNumero" data-tempo-numero="${v}"${ui.tempoNumero === v ? " checked" : ""}> ${nome}</label>`).join("")}` : ""}
        <h3>Identificador</h3>
        ${OPCOES_ID.filter(([v]) => v !== "codigo" || usaCodigos).map(([v, nome]) => `<label><input type="radio" name="identificador" data-identificador="${v}"${identificador() === v ? " checked" : ""}> ${nome}</label>`).join("")}
        ${ui.modo === "lista" ? `<h3>Colunas</h3>
        <label class="fixa"><input type="checkbox" checked disabled> Nome e situação</label>
        ${OPCOES_COLUNAS.filter(([v]) => v !== "descricao" || usaDescricao()).map(([v, nome]) => `<label><input type="checkbox" data-coluna="${v}"${ui.colunas[v] ? " checked" : ""}> ${nome}</label>`).join("")}` : ""}
      </div>
    </details>`;
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
  const niveisHtml = () => `<div class="controle-rotulado"><span class="niveis-rotulo">Mostrar até</span><div class="modos niveis" role="group" aria-label="Mostrar até">
      ${NIVEIS.map(([v, nome]) => `<button type="button" class="modo" data-nivel="${v}" aria-pressed="false"><span class="modo-nome">${nome}</span></button>`).join("")}
    </div></div>`;
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
    if (ui.pop === "exibir") desenharFerramentas();
  }

  /** Filtros ativos (situação, responsável, "Minhas ações"), para o número no funil. */
  const filtrosAtivos = () => (ui.situacao !== "todas" ? 1 : 0) + (ui.responsavel ? 1 : 0) + (ui.minhas ? 1 : 0);

  function situacoesHtml() {
    const n = contar(linhas);
    return BOTOES_DE_FILTRO.filter(([v]) => ui.modo === "lista" || v === "todas" || v === "atrasada").map(([v, t, icone, classe]) =>
      `<button class="opcao" type="button" data-filtro="${v}" aria-pressed="${ui.situacao === v}">
        <span class="opcao-icone ${classe ?? ""}">${icone ? ICONES[icone] : ""}</span><span class="opcao-texto">${t}</span><span class="n">${n[v]}</span></button>`).join("");
  }
  function responsavelHtml() {
    return `${meus ? `<label class="alternar"><input type="checkbox" data-ctl="minhas"${ui.minhas ? " checked" : ""}> Minhas ações</label>` : ""}
      <label class="campo-pop"><span>Responsável</span><select data-ctl="responsavel">
        <option value="">Todos</option>
        ${responsaveis.map((r) => `<option value="${esc(r.id)}"${ui.responsavel === r.id ? " selected" : ""}>${esc(r.sigla ? `${r.sigla} · ${r.nome}` : r.nome)}</option>`).join("")}
      </select></label>`;
  }
  function ordensHtml() {
    return ORDENS.map(([v, t]) => `<button class="opcao" type="button" data-ordem="${v}" aria-pressed="${ui.ordem === v}"><span class="opcao-icone">${ui.ordem === v ? ICONES.marcado : ""}</span><span class="opcao-texto">${t}</span></button>`).join("");
  }
  function popoverHtml() {
    /* "Classificar e filtrar" (23/10/2026, pedido do responsável), como no Excel: a ordem primeiro, depois os filtros */
    if (ui.pop === "classificar") {
      return `<div class="popover popover-exibir" data-popover role="dialog" aria-label="Classificar e filtrar">
        <h3>Classificar por</h3><div class="opcoes-lista">${ordensHtml()}</div>
        <h3>Filtrar por situação</h3><div class="opcoes-lista">${situacoesHtml()}</div>
        ${responsavelHtml()}
        ${filtrosAtivos() ? '<button class="botao discreto" type="button" data-limpar-filtros>Limpar filtros</button>' : ""}
      </div>`;
    }
    if (ui.pop === "filtrar") {
      return `<div class="popover" data-popover role="dialog" aria-label="Filtrar">
        <h3>Situação</h3><div class="opcoes-lista">${situacoesHtml()}</div>
        ${responsavelHtml()}
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
        <h3>Visualização</h3><div class="opcoes-lista">${MODOS.map(([v, nome, icone]) => `<button class="opcao" type="button" data-modo="${v}" aria-pressed="${ui.modo === v}">
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
    return `<div class="popover popover-exibir" data-popover role="dialog" aria-label="Indicador">
      <h3>Indicador</h3><div class="opcoes-lista">${BARRAS.map(([v, nome, icone]) =>
        opcao("data-barra", v, nome, ui.barra === v, `<span class="barra-icone ${v}">${ICONES[icone]}</span>`)).join("")}</div>
      ${ui.barra === "tempo" ? `<h3>Ao lado da barra de tempo</h3><div class="opcoes-lista">${OPCOES_TEMPO.map(([v, nome]) =>
        opcao("data-tempo-num", v, nome, ui.tempoNumero === v)).join("")}</div>` : ""}
    </div>`;
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
    const nivel = agrupado() && lista ? nivelAtual() : null;
    return `<div class="popover popover-exibir" data-popover role="dialog" aria-label="Exibir">
      ${agrupado() ? `<h3>Mostrar até</h3><div class="opcoes-lista">${NIVEIS.map(([v, nome]) => opcao("data-nivel", v, nome, nivel === v)).join("")}</div>` : ""}
      ${ui.modo === "planilha" ? colunasDaPlanilhaHtml() : `<h3>Identificador antes do nome</h3><div class="opcoes-lista">${OPCOES_ID.filter(([v]) => v !== "codigo" || usaCodigos)
        .map(([v, nome]) => opcao("data-identificador-op", v, nome, identificador() === v)).join("")}</div>`}
      ${ui.modo === "lista" ? `<h3>Colunas</h3><div class="colunas-escolha">
        <label class="fixa"><input type="checkbox" checked disabled> Nome e situação</label>
        ${OPCOES_COLUNAS.filter(([v]) => v !== "descricao" || usaDescricao()).map(([v, nome]) => `<label><input type="checkbox" data-coluna="${v}"${ui.colunas[v] ? " checked" : ""}> ${nome}</label>`).join("")}</div>` : ""}
    </div>`;
  }

  /** Ferramentas na barra do topo: modo, Filtrar, Ordenar e Nova ação (celular: "Filtros e ordem"). */
  function desenharFerramentas({ abriu = false } = {}) {
    const planilha = semFiltros();
    const nf = filtrosAtivos();
    /* teste de 23/10/2026 (pedido do responsável): nome do espaço à esquerda, seguido dos menus
       Visualização, Filtrar, Ordenar e Exibir, todos abrindo para baixo; à direita, as atrasadas e Nova ação.
       No celular, continua o funil com "Filtros e ordem" e a segunda linha */
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
        <button class="icone-barra so-celular" type="button" data-opcoes aria-label="Filtros e ordem" title="Filtros e ordem">
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
        ${atrasadas ? `<button class="chip-atrasadas so-computador" type="button" data-filtro="${ui.situacao === "atrasada" ? "todas" : "atrasada"}" aria-pressed="${ui.situacao === "atrasada"}"
          title="${ui.situacao === "atrasada" ? "Mostrar todas as ações" : "Mostrar só as atrasadas"}">${ICONES.atrasada}${atrasadas} ${plural(atrasadas, "atrasada", "atrasadas")}</button>` : ""}
        <button class="botao principal so-computador" type="button" data-nova>${ICONES.mais}Nova ação</button>
      </div>`;
    modoDesenhado = ui.modo;
    document.body.dataset.vistaAtual = ui.modo; // largura da área conforme o modo (css)
    legenda.hidden = !ui.legenda || planilha;
    if (abriu) surgir(ferramentas.querySelector("[data-popover]"));
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
    if (t.closest("[data-limpar-filtros]")) { ui.responsavel = ""; ui.minhas = false; return mudar("situacao", "todas"); }
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
  /* legenda: item do menu lateral (passo 1.14c) */
  const alternarLegenda = () => { ui.legenda = !ui.legenda; desenharFerramentas(); };
  document.addEventListener("sextante:alternar-legenda", alternarLegenda);

  /* ---------- lista ---------- */
  function medidor(valor, titulo, cor, texto) {
    if (valor == null) return `<span class="medidor vazio">—</span>`;
    return `<span class="medidor" title="${titulo}"><span class="barra-medidor"><i style="width:${Math.max(2, Math.round(valor * 100))}%;background:${cor}"></i></span><span class="num">${texto}</span></span>`;
  }
  const corDe = (l) => (l.situacao === "concluida" ? "var(--ok)" : l.execucao == null ? "var(--neutral)" : `color-mix(in oklab, var(--crit) ${Math.round(l.execucao * 100)}%, var(--neutral))`);

  const FALTA_ESTIMAR = `<span class="falta-estimar">Falta estimar</span>`;

  /* ---------- criação rápida (passo 1.14a): nome e Enter, no fim de cada etapa e da coluna Liberadas ---------- */
  /** Sem filtros: com filtro, a ação criada poderia sumir da tela logo ao nascer. */
  const comRapida = () => store.podeGravar !== false && ui.situacao === "todas" && !ui.responsavel && !ui.minhas;
  function rapidaHtml(chave, etapa = "", ondeTexto = "") {
    return `<form class="linha-rapida" data-rapida="${esc(chave)}" data-etapa="${esc(etapa)}">${ICONES.mais}
      <input name="rotulo" maxlength="120" autocomplete="off" placeholder="Adicionar ação${ondeTexto}" aria-label="Adicionar ação${ondeTexto}: digite o nome e tecle Enter"></form>`;
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
        await store.criarAcao(espacoId, {
          rotulo,
          ...(form.dataset.etapa ? { etapa: form.dataset.etapa } : {}),
          ...(naoAntesDe ? { naoAntesDe } : {}),
        });
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
    if (l.situacao === "concluida" || l.semEstimativa) return null;
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
      : n > 0 ? `${plural(n, "Falta", "Faltam")} ${n} ${plural(n, "dia útil", "dias úteis")}: conclusão prevista em ${dataBr(l.conclusao)}`
      : "Conclusão prevista para hoje";
    return `<span class="prazo-barra ${n < 0 ? "vencido" : n > 0 ? "faltam" : "zero"}" title="${titulo}" aria-label="${titulo}">
      <span class="prazo-trilho">${min < 0 ? `<i class="prazo-zero" style="left:${zero}%"></i>` : ""}${n ? `<i class="prazo-valor" style="left:${n < 0 ? zero - largura : zero}%;width:${Math.max(1.5, largura)}%"></i>` : ""}</span>
      ${ui.tempoNumero === "data" ? `<span class="prazo-num data">${dataCurta(n < 0 ? l.vencidaEm : l.conclusao, comAno())}</span>` : `<span class="prazo-num">${n}</span>`}</span>`;
  }

  /** A barra escolhida, com o símbolo à esquerda (22/10/2026). */
  function barraHtml(l) {
    const [, nome, icone] = BARRAS.find(([v]) => v === ui.barra);
    const simbolo = `<span class="barra-icone ${ui.barra}" title="${nome}" aria-hidden="true">${ICONES[icone]}</span>`;
    if (l.situacao === "concluida") return `<div class="pr"></div>`;
    let conteudo;
    if (ui.barra === "tempo") conteudo = l.semEstimativa ? FALTA_ESTIMAR : prazoHtml(l);
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
      <div class="linha" role="button" tabindex="0" data-abrir-acao>
        <div class="sit">${sit}</div>
        <div class="acao-nome"><span class="nome-linha">${idHtml(a)}<span class="rotulo" data-editar="rotulo">${esc(a.rotulo)}</span></span>${!agrupado() && etapaDe.get(a.etapa) ? `<span class="etapa">${esc(etapaDe.get(a.etapa))}</span>` : ""}${
          /* avisos pequenos sob o nome; o ícone da situação fica antes do nome, numa coluna estreita (22/10/2026) */
          [l.aPartirDe ? `<span class="tec">a partir de ${dataBr(l.aPartirDe)}</span>` : "", l.semEstimativa && !(c.barras && ui.barra === "tempo") ? FALTA_ESTIMAR : "", nota ? `<small class="nota-reprog">${nota}</small>` : "", checklistNota(a)].join("")}</div>
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
    execucao: ["exec", "quanto cada dia de atraso adia o fim"],
    revisao: ["rev", "parte da incerteza do prazo final"],
  };
  function legendaBarraHtml() {
    const leg = LEGENDA_BARRA[ui.barra === "tempo" && ui.tempoNumero === "data" ? "tempoData" : ui.barra];
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
    const rapida = comRapida();
    if (ui.modo === "quadro") corpo = quadroHtml(ls);
    else if (!ls.length && !rapida) corpo = `<p class="lista-vazia">Nenhuma ação com esses filtros.</p>`;
    else if (agrupado()) {
      const g = agrupar(ls, espaco.estrutura, { vazias: rapida });
      corpo = g.fases.map(({ fase, etapas, linhas: daFase }) => grupoHtml("fase", fase.id, fase.nome, daFase,
        etapas.map(({ etapa, linhas: daEtapa }) => grupoHtml("etapa", etapa.id, etapa.nome, daEtapa,
          daEtapa.map(linhaHtml).join("") + (rapida ? rapidaHtml(etapa.id, etapa.id, ` em ${etapa.nome}`) : ""))).join(""))).join("")
        + (g.semEtapa.length ? grupoHtml("fase", "sem-etapa", "Sem fase nem etapa", g.semEtapa, g.semEtapa.map(linhaHtml).join("")) : "");
    } else {
      corpo = (ls.length ? "" : `<p class="lista-vazia">Este espaço ainda não tem ações. Digite o nome da primeira abaixo e tecle Enter, ou use "Nova ação".</p>`)
        + ls.map(linhaHtml).join("") + (rapida ? rapidaHtml("lista") : "");
    }
    lista.innerHTML = corpo;
    const c = colunas();
    lista.style.setProperty("--colunas", ["18px", "minmax(0, 2.4fr)", c.descricao && "minmax(0, 2.4fr)",
      c.participantes && "minmax(0, 1.5fr)", c.barras && "minmax(0, 1.6fr)"].filter(Boolean).join(" "));
    ajustarDonos(lista);
    if (agrupado()) marcarNivel();
    restaurarRapida();
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
    const arrastavel = l.situacao !== "naoLiberada";
    return `<article class="item cartao-quadro${l.situacao === "concluida" ? " feita" : ""}" data-numero="${a.numero}" style="--calor:${corDe(l)}"${arrastavel ? ' draggable="true"' : ""}>
      <div class="linha" role="button" tabindex="0" data-abrir-acao>
        <div class="acao-nome"><span class="nome-linha">${idHtml(a)}<span class="rotulo" data-editar="rotulo">${esc(a.rotulo)}</span></span>${etapaDe.get(a.etapa) ? `<span class="etapa">${esc(etapaDe.get(a.etapa))}</span>` : ""}${
          l.semEstimativa && ui.barra !== "tempo" ? FALTA_ESTIMAR : ""}${checklistNota(a)}</div>
        <div class="cartao-base"><div class="donos" data-editar="responsaveis">${donos}</div></div>
        ${l.situacao === "concluida" ? "" : barraHtml(l)}
      </div>
    </article>`;
  }
  function quadroHtml(ls) {
    return `<div class="quadro">${COLUNAS.map(([situacao, titulo, classe, dica]) => {
      const daColuna = ls.filter((l) => l.situacao === situacao);
      return `<section class="coluna" data-coluna="${situacao}" aria-label="${titulo}">
        <header><span class="${classe}">${ICONES[SITUACOES[situacao].icone]}</span><b>${titulo}</b><span class="n">${daColuna.length}</span></header>
        <p class="tec so-computador">${dica}</p>
        <div class="coluna-cartoes">${daColuna.map(cartaoHtml).join("") || `<p class="vazio">Nenhuma ação.</p>`}</div>
        ${situacao === "liberada" && comRapida() ? rapidaHtml("quadro") : ""}
      </section>`;
    }).join("")}</div>`;
  }

  /* arrastar no quadro (computador): Liberadas → Concluídas registra a conclusão; Concluídas → Liberadas desfaz */
  let arrastada = null;
  const situacaoDe = (numero) => linhas.find((l) => l.acao.numero === numero)?.situacao;
  const destinoValido = (coluna, numero) => {
    const s = situacaoDe(numero);
    return (s === "liberada" && coluna === "concluida") || (s === "concluida" && coluna === "liberada");
  };
  function ligarArraste() {
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
      if (coluna.dataset.coluna === "concluida") abrirJanela(numero, "concluir");
      else {
        try {
          await store.desfazerConclusao(espacoId, numero);
          avisar("Conclusão desfeita. A ação voltou a ser liberada.");
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
  }

  /* ---------- celular: painel "Filtros e ordem" ---------- */
  let painelOpcoes = null;
  function preencherOpcoes() {
    painelOpcoes.innerHTML = `
      <section class="opcoes">${modosHtml()}</section>
      ${semFiltros() ? "" : `<section class="opcoes"><h3>Situação</h3><div class="opcoes-lista">${situacoesHtml()}</div></section>
      <section class="opcoes">${controlesHtml()}</section>`}
      ${ativos() ? `<section><button class="botao discreto" type="button" data-limpar>Limpar filtros e ordem</button></section>` : ""}`;
  }
  function abrirOpcoes() {
    painelOpcoes = abrirPainel("Filtros e ordem", "", { deBaixo: true, botao: "Pronto" });
    preencherOpcoes();
    painelOpcoes.addEventListener("change", aoMudarControle);
    painelOpcoes.addEventListener("click", (e) => {
      const modo = e.target.closest("[data-modo]");
      if (modo) mudarModo(modo.dataset.modo);
      const filtro = e.target.closest("[data-filtro]");
      if (filtro) mudar("situacao", filtro.dataset.filtro);
      if (e.target.closest("[data-limpar]")) { ui.responsavel = ""; ui.minhas = false; ui.situacao = "todas"; mudar("ordem", "espaco"); }
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
    if (t.closest("[data-nova]")) return abrirNova();
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

  /* ---------- acompanhamento: cada mudança no banco recalcula e redesenha ---------- */
  let fila = Promise.resolve();
  const parar = store.acompanharEspaco(espacoId, (dados) => {
    fila = fila.then(async () => {
      derivar(dados, dados.responsaveis, await store.lerCalendarioGeral());
      if (editando) redesenharDepois = true; else desenhar();
      janela?.atualizar(dadosDaJanela());
      novaJanela?.atualizar(dadosDaJanela());
    }).catch((e) => avisar(e.message));
  });
  return () => {
    parar();
    janela?.fechar();
    document.removeEventListener("click", fecharPop);
    document.removeEventListener("keydown", fecharPop);
    document.removeEventListener("click", fecharColunas);
    document.removeEventListener("keydown", fecharColunas);
    document.removeEventListener("keydown", marcarAlt);
    document.removeEventListener("keyup", marcarAlt);
    removeEventListener("blur", marcarAlt);
    document.body.classList.remove("alt-edicao");
    delete document.body.dataset.vistaAtual;
    document.querySelector(".escolher-participantes")?.remove();
    document.removeEventListener("sextante:alternar-legenda", alternarLegenda);
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
