/**
 * Página do painel público (18/11/2026; documentação técnica, seção 8.8): painel/?p=<código>.
 *
 * Somente leitura, sem login e sem a barra do Sextante. Lê a cópia-resumo pelo Store (js/dados.js) e a desenha:
 * título e código, apresentação, Programa e aprovação, os três números (ações concluídas, entregas alcançadas,
 * conclusão prevista com início e prazo) e três blocos que começam recolhidos: andamento por fase (só com duas ou
 * mais fases), entregas (só com entregas) e ações, com filtro por situação.
 *
 * Parte 2 (18/11/2026): o cartão "Ver as ações de outro jeito", no fim da página (como no esboço), leva às duas visões só de leitura, "No tempo" (o
 * Cronograma do Sextante) e "Em rede" (a Rede), desenhadas pelas mesmas telas do Sextante (js/telas/cronograma.js e
 * js/telas/rede.js), sem edição, com os dados do resumo. Cada visão tem endereço próprio (#no-tempo e #em-rede), para
 * o botão Voltar do navegador e do celular levar de volta ao painel.
 *
 * `htmlDoPainel` é puro (texto entra, HTML sai), para ser testado com o Node; `mostrarPainelPublico` liga a página.
 */
import { esc, dataBr, plural } from "../formato.js";
import { numerosDoResumo, pecasDasVisoes } from "../painel-publico.js";
import { ICONES } from "../icones.js";
import { NOME, INSTITUICAO, INSTITUICAO_POR_EXTENSO } from "../identidade.js";

/** Filtros da lista de ações, na ordem dos botões; aparecem só os que têm ações (além de "Todas"). */
const FILTROS = [
  ["todas", "Todas"], ["liberada", "Liberadas"], ["atrasada", "Atrasadas"], ["concluida", "Concluídas"], ["naoLiberada", "Não liberadas"],
];
/** "Liberadas" inclui as contínuas, que estão em andamento durante o trecho que acompanham. */
const passaNoFiltro = (a, filtro) => filtro === "todas" || a.situacao === filtro || (filtro === "liberada" && a.situacao === "continua");

/** Texto da data de cada ação, conforme a situação. */
function textoDaData(a) {
  if (a.situacao === "continua") return "Durante o trecho que acompanha";
  if (!a.data) return "";
  return a.situacao === "concluida" ? `Concluída em ${dataBr(a.data)}` : `Prevista para ${dataBr(a.data)}`;
}

/** As duas visões só de leitura (parte 2): endereço (#…), nome do botão, ícone e frase de apoio. */
export const VISOES = {
  tempo: { hash: "#no-tempo", nome: "No tempo", icone: "modoCronograma", titulo: "As ações no tempo",
    frase: "Cada ação como uma barra, do início à conclusão prevista, com as ligações entre elas." },
  rede: { hash: "#em-rede", nome: "Em rede", icone: "modoRede", titulo: "As ações em rede",
    frase: "Da esquerda para a direita, na ordem em que as ações podem acontecer: o que depende do quê." },
};
/** Visões que o resumo oferece, na ordem dos botões (só com ações). */
export const visoesDoResumo = (resumo) => ((resumo.acoes ?? []).length ? ["tempo", "rede"].filter((v) => (resumo.visoes ?? []).includes(v)) : []);
/** Visão pedida pelo endereço (#no-tempo ou #em-rede), se o resumo a oferece; null: o painel. */
export const visaoDoEndereco = (hash, resumo) => {
  const v = Object.keys(VISOES).find((k) => VISOES[k].hash === hash);
  return v && visoesDoResumo(resumo).includes(v) ? v : null;
};

const etiqueta = (situacao, rotulo) => `<span class="pp-etiqueta pp-${esc(situacao)}">${esc(rotulo)}</span>`;

/** Cabeçalho do bloco recolhível: título, resumo e "Ver"/"Recolher". */
const resumoDoBloco = (titulo, resumo, ver) => `<summary class="pp-bloco-titulo">
  <span class="pp-bloco-nome"><span class="pp-h2">${titulo}</span><span class="pp-bloco-resumo">${resumo}</span></span>
  <span class="pp-ver"><span class="pp-ver-fechado">${ver}</span><span class="pp-ver-aberto">Recolher</span>${ICONES.abaixo}</span></summary>`;

/**
 * HTML da página.
 * @param {{resumo: object, atualizadoEm?: string|null}} painel
 * @param {{abertos?: Set<string>, filtro?: string, previa?: boolean}} estado  blocos abertos ("fases", "entregas", "acoes") e o
 *   filtro das ações; previa: a prévia de "Configurar este espaço", em que os botões das visões aparecem, mas não abrem
 */
export function htmlDoPainel({ resumo, atualizadoEm = null }, { abertos = new Set(), filtro = "todas", previa = false } = {}) {
  const n = numerosDoResumo(resumo);
  const aberto = (id) => (abertos.has(id) ? " open" : "");
  const fases = resumo.fases ?? [];
  const nomeDaFase = new Map(fases.map((f) => [f.id, f.nome]));
  const comFases = fases.length >= 2; // com uma fase só, o bloco repetiria o número das ações (decisão de 18/11/2026)
  const acoes = resumo.acoes ?? [];
  const entregas = resumo.entregas ?? [];

  const cartao = (titulo, valor, pct, texto) => `<div class="pp-cartao">
    <span class="pp-cartao-titulo">${titulo}</span><span class="pp-cartao-valor">${valor}</span>
    ${pct == null ? "" : `<span class="pp-barra" role="img" aria-label="${pct}%"><span style="width:${pct}%"></span></span>`}
    <span class="pp-cartao-texto">${texto}</span></div>`;

  const ap = resumo.aprovacao;
  const caixa = [
    resumo.programa ? `<span>Faz parte do <b>${esc(resumo.programa)}</b></span>` : "",
    ap ? `<span>Aprovado por: ${ap.link ? `<a href="${esc(ap.link)}" target="_blank" rel="noopener">${esc(ap.identificacao || "documento de aprovação")}</a>` : `<b>${esc(ap.identificacao)}</b>`}</span>` : "",
  ].filter(Boolean);

  /* ações: filtro e agrupamento por fase (só com duas ou mais fases; as sem fase vão para o fim) */
  const contagem = Object.fromEntries(FILTROS.map(([f]) => [f, acoes.filter((a) => passaNoFiltro(a, f)).length]));
  const filtroValido = contagem[filtro] ? filtro : "todas";
  const visiveis = acoes.filter((a) => passaNoFiltro(a, filtroValido));
  const grupos = comFases
    ? [...fases.map((f) => ({ nome: f.nome, acoes: visiveis.filter((a) => a.fase === f.id) })), { nome: "Sem fase", acoes: visiveis.filter((a) => !nomeDaFase.has(a.fase)) }]
    : [{ nome: null, acoes: visiveis }];
  const linhaDaAcao = (a) => `<li class="pp-linha">
    <span class="pp-linha-nome"><span>${esc(a.nome)}</span>${a.responsaveis?.length ? `<small>${esc(a.responsaveis.join(", "))}</small>` : ""}</span>
    <span class="pp-linha-data">${esc(textoDaData(a))}</span>${etiqueta(a.situacao, a.rotulo)}</li>`;

  return `
  <section class="pp-cabeca">
    <h1 class="pp-h1">${esc(resumo.nome)}</h1>
    ${resumo.codigo ? `<span class="pp-codigo">${esc(resumo.codigo)}</span>` : ""}
    ${resumo.apresentacao ? `<p class="pp-apresentacao">${esc(resumo.apresentacao)}</p>` : ""}
    ${caixa.length ? `<div class="pp-caixa">${caixa.join("")}</div>` : ""}
  </section>

  <section class="pp-cartoes">
    ${cartao("Ações concluídas", `${n.pctConcluidas}%`, n.pctConcluidas, `${n.concluidas} de ${n.acoes} ${plural(n.acoes, "ação concluída", "ações concluídas")}`)}
    ${n.entregas ? cartao("Entregas alcançadas", `${n.pctAlcancadas}%`, n.pctAlcancadas, `${n.alcancadas} de ${n.entregas} ${plural(n.entregas, "entrega alcançada", "entregas alcançadas")}`) : ""}
    ${cartao("Conclusão prevista", resumo.conclusaoPrevista ? dataBr(resumo.conclusaoPrevista) : "—", null,
      [resumo.inicio ? `<b>Início:</b> ${dataBr(resumo.inicio)}` : "", resumo.prazoFinal ? `<b>Prazo:</b> ${dataBr(resumo.prazoFinal)}` : ""].filter(Boolean).join("<br>") || "&nbsp;")}
  </section>

  ${comFases ? `<details class="pp-bloco" data-bloco="fases"${aberto("fases")}>
    ${resumoDoBloco("Andamento das ações por fase", `${fases.length} fases · ${fases.filter((f) => f.concluidas === f.total).length} ${plural(fases.filter((f) => f.concluidas === f.total).length, "concluída", "concluídas")}`, "Ver fases")}
    <div class="pp-bloco-corpo">
      ${fases.map((f) => {
        const pct = (x) => (f.total ? (x / f.total) * 100 : 0);
        const partes = [`${f.concluidas} de ${f.total} ${plural(f.concluidas, "concluída", "concluídas")}`, f.emAndamento ? `${f.emAndamento} ${plural(f.emAndamento, "liberada", "liberadas")}` : "", f.atrasadas ? `${f.atrasadas} ${plural(f.atrasadas, "atrasada", "atrasadas")}` : ""].filter(Boolean);
        return `<div class="pp-fase"><div class="pp-fase-linha"><b>${esc(f.nome)}</b><span>${partes.join(" · ")}</span></div>
          <span class="pp-barra pp-barra-fase" role="img" aria-label="${esc(partes.join(", "))}"><span class="pp-ok" style="width:${pct(f.concluidas)}%"></span><span class="pp-and" style="width:${pct(f.emAndamento)}%"></span><span class="pp-atr" style="width:${pct(f.atrasadas)}%"></span></span></div>`;
      }).join("")}
      <p class="pp-legenda"><span><i class="pp-ok"></i>Concluídas</span><span><i class="pp-and"></i>Liberadas</span><span><i class="pp-atr"></i>Atrasadas</span><span><i></i>Não liberadas</span></p>
    </div>
  </details>` : ""}

  ${entregas.length ? `<details class="pp-bloco" data-bloco="entregas"${aberto("entregas")}>
    ${resumoDoBloco("Entregas", `${entregas.length} ${plural(entregas.length, "entrega", "entregas")} · ${n.alcancadas} ${plural(n.alcancadas, "alcançada", "alcançadas")}`, "Ver entregas")}
    <ul class="pp-bloco-corpo pp-lista">${entregas.map((e) => `<li class="pp-linha">
      <span class="pp-linha-nome"><span>${esc(e.titulo)}</span>${e.prazo ? `<small>Prazo: ${dataBr(e.prazo)}</small>` : ""}</span>
      ${etiqueta(e.situacao === "alcancada" ? "concluida" : e.situacao === "emAndamento" ? "liberada" : "naoLiberada", e.rotulo)}</li>`).join("")}</ul>
  </details>` : ""}

  <details class="pp-bloco" data-bloco="acoes"${aberto("acoes")}>
    ${resumoDoBloco("Ações", `${n.acoes} ${plural(n.acoes, "ação", "ações")}${n.atrasadas ? ` · ${n.atrasadas} ${plural(n.atrasadas, "atrasada", "atrasadas")}` : ""}`, "Ver ações")}
    <div class="pp-bloco-corpo">
      ${acoes.length ? `<div class="pp-filtros" role="group" aria-label="Mostrar ações">${FILTROS.filter(([f]) => f === "todas" || contagem[f]).map(([f, nome]) =>
        `<button type="button" class="pp-filtro" data-filtro="${f}" aria-pressed="${f === filtroValido}">${nome}</button>`).join("")}</div>` : ""}
      ${grupos.filter((g) => g.acoes.length).map((g) => `${g.nome ? `<h3 class="pp-grupo">${esc(g.nome)}</h3>` : ""}<ul class="pp-lista">${g.acoes.map(linhaDaAcao).join("")}</ul>`).join("")
        || `<p class="pp-vazio">Nenhuma ação ${acoes.length ? "nesta situação" : "cadastrada ainda"}.</p>`}
    </div>
  </details>

  ${visoesDoResumo(resumo).length ? `<section class="pp-visoes" aria-labelledby="pp-visoes-titulo">
    <svg class="pp-visoes-desenho" width="56" height="40" viewBox="0 0 56 40" aria-hidden="true"><rect class="ok" x="1" y="14" width="14" height="12" rx="3"/><rect class="and" x="21" y="2" width="14" height="12" rx="3"/><rect class="atr" x="21" y="26" width="14" height="12" rx="3"/><rect class="nao" x="41" y="14" width="14" height="12" rx="3"/><path d="M15 20 L21 8 M15 20 L21 32 M35 8 L41 20 M35 32 L41 20"/></svg>
    <span class="pp-visoes-texto"><span class="pp-h2" id="pp-visoes-titulo">Ver as ações de outro jeito</span>
      <span class="pp-bloco-resumo">No tempo, com as barras de cada ação ao longo dos meses, ou em rede, com o que precisa terminar antes de cada uma começar. Somente leitura.</span></span>
    <span class="pp-visoes-botoes">${visoesDoResumo(resumo).map((v) => (previa
      ? `<button type="button" class="botao" disabled title="Na prévia, as visões não abrem. Abra o endereço do painel para vê-las.">${ICONES[VISOES[v].icone]}${VISOES[v].nome}</button>`
      : `<a class="botao" href="${VISOES[v].hash}" title="${esc(VISOES[v].frase)}">${ICONES[VISOES[v].icone]}${VISOES[v].nome}</a>`)).join("")}</span>
  </section>` : ""}

  <footer class="pp-rodape">
    ${atualizadoEm ? `<span><b>Atualizado em ${dataBr(atualizadoEm.slice(0, 10))}, às ${new Date(atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</b> O painel se atualiza quando a equipe mexe no plano.</span>` : ""}
    <span>Resumo público, somente leitura. Comentários e anotações da equipe não aparecem aqui.</span>
  </footer>`;
}

/** Cabeçalho da visão (parte 2): voltar ao painel, nome do plano e a frase de apoio. */
export const htmlDaVisao = (resumo, visao) => `<section class="pp-visao-cabeca">
    <a class="botao pp-voltar" href="#" data-voltar-painel>${ICONES.abrir}Voltar ao painel</a>
    <span class="pp-visao-titulo"><span class="pp-h2">${VISOES[visao].titulo}</span><small>${esc(resumo.nome)} · somente leitura</small></span>
  </section>
  <p class="pp-visao-frase">${VISOES[visao].frase}</p>
  <div class="pp-visao-area" data-visao="${visao}"></div>`;

/** Mensagens da página quando não há resumo para mostrar. */
const MENSAGENS = {
  semCodigo: ["Endereço incompleto", "Confira se o link foi copiado inteiro."],
  naoEncontrado: ["Painel não encontrado", "O endereço pode ter sido trocado pela equipe do plano. Peça o link atualizado."],
  desligado: ["Painel desligado", "A equipe do plano desligou este painel público."],
  vazio: ["Painel em preparação", "O resumo aparece aqui assim que a equipe abrir o plano no Sextante."],
  erro: ["Não foi possível abrir o painel", "Confira a internet e recarregue a página."],
};
export const htmlDaMensagem = (chave) => `<section class="pp-mensagem"><h1 class="pp-h1">${MENSAGENS[chave][0]}</h1><p>${MENSAGENS[chave][1]}</p></section>`;

/**
 * Liga a página: lê o painel pelo código e redesenha ao abrir ou fechar os blocos e ao trocar o filtro.
 * @param {HTMLElement} alvo
 * @param {{store: {lerPainelPublico: (codigo: string) => Promise<object|null>}, codigo: string|null, ligarSecoes?: (raiz: HTMLElement) => void}} opcoes
 */
export async function mostrarPainelPublico(alvo, { store, codigo, ligarSecoes = () => {} }) {
  document.querySelectorAll("[data-nome-sistema]").forEach((el) => { el.textContent = NOME; });
  document.querySelectorAll("[data-instituicao]").forEach((el) => { el.textContent = `${INSTITUICAO} · ${INSTITUICAO_POR_EXTENSO}`; });
  if (!codigo) { alvo.innerHTML = htmlDaMensagem("semCodigo"); return; }
  let painel;
  try {
    painel = await store.lerPainelPublico(codigo);
  } catch {
    alvo.innerHTML = htmlDaMensagem("erro");
    return;
  }
  if (!painel) { alvo.innerHTML = htmlDaMensagem("naoEncontrado"); return; }
  if (!painel.ligado) { alvo.innerHTML = htmlDaMensagem("desligado"); return; }
  if (!painel.resumo) { alvo.innerHTML = htmlDaMensagem("vazio"); return; }
  const resumo = painel.resumo;
  const estado = { abertos: new Set(), filtro: "todas" };
  /* zoom de cada visão, enquanto a página está aberta (no Sextante, o do aparelho; aqui, um painel sem memória) */
  const escalas = { tempo: "18", rede: "tudo" };
  let rolagemDoPainel = 0;
  const desenharPainel = () => { alvo.innerHTML = htmlDoPainel(painel, estado); };
  const desenhar = async () => {
    const visao = visaoDoEndereco(location.hash, resumo);
    document.body.dataset.ppVisao = visao ?? "";
    document.title = visao ? `${VISOES[visao].nome} · ${resumo.nome} · Painel público` : `${resumo.nome} · Painel público`;
    if (!visao) { desenharPainel(); scrollTo(0, rolagemDoPainel); return; }
    alvo.innerHTML = htmlDaVisao(resumo, visao);
    scrollTo(0, 0);
    await desenharVisao(alvo.querySelector("[data-visao]"), resumo, visao, escalas);
  };
  await desenhar();
  ligarSecoes(alvo);
  addEventListener("hashchange", () => desenhar());
  /* voltar ao painel: pelo histórico, quando se veio dele (o Voltar do celular faz o mesmo); senão, pelo endereço */
  let veioDoPainel = false;
  alvo.addEventListener("click", (e) => {
    const ir = e.target.closest("a[href^='#']");
    if (!ir) return;
    if (ir.matches("[data-voltar-painel]")) {
      e.preventDefault();
      if (veioDoPainel) history.back();
      else { history.replaceState(null, "", location.pathname + location.search); desenhar(); }
      veioDoPainel = false;
      return;
    }
    if (!visaoDoEndereco(location.hash, resumo)) { rolagemDoPainel = scrollY; veioDoPainel = true; }
  });
  /* "o que é?" das legendas: no Sextante abre a Ajuda; aqui, uma caixa com a explicação do glossário */
  alvo.addEventListener("click", async (e) => {
    const termo = e.target.closest("[data-termo]");
    if (!termo) return;
    e.preventDefault();
    const { GLOSSARIO } = await import("../glossario.js");
    const t = GLOSSARIO.find((x) => x.chave === termo.dataset.termo);
    if (t) mostrarTermo(t);
  });
  alvo.addEventListener("toggle", (e) => {
    const id = e.target.dataset?.bloco;
    if (id) e.target.open ? estado.abertos.add(id) : estado.abertos.delete(id);
  }, true);
  alvo.addEventListener("click", (e) => {
    const b = e.target.closest("[data-filtro]");
    if (!b) return;
    estado.filtro = b.dataset.filtro;
    desenharPainel();
    alvo.querySelector(`[data-filtro="${estado.filtro}"]`)?.focus();
  });
}

/**
 * Desenha a visão pedida com as telas do Sextante, sem edição (parte 2, 18/11/2026). As telas entram só aqui, para a
 * página do painel abrir sem carregá-las quando ninguém pede uma visão.
 * - No tempo: o Cronograma, com o responsável ao lado da barra (como o público vê) e sem a coluna do indicador.
 * - Em rede: a Rede, com as cores pela folga (o painel não leva os índices técnicos, seção 4.13) e, no celular, só
 *   para consulta (arrastar e pinça), como no Sextante.
 */
async function desenharVisao(area, resumo, visao, escalas) {
  const { acoes, caminho, cal, linhas, estrutura, usaFases } = pecasDasVisoes(resumo);
  const hoje = new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD no fuso do aparelho
  const espaco = { id: "painel", nome: resumo.nome, estrutura, prazoFinal: resumo.prazoFinal ?? null };
  const redesenhar = () => desenharVisao(area, resumo, visao, escalas);
  if (visao === "tempo") {
    const { desenharCronograma } = await import("./cronograma.js");
    desenharCronograma(area, { espaco, acoes, caminho, cal, hoje, usaFases, identificador: () => "", escala: escalas.tempo,
      aoMudarEscala: (escala) => { escalas.tempo = escala; redesenhar(); },
      exibir: { responsavel: true }, nomesDe: (a) => a.responsaveis, abreAcoes: false });
    return;
  }
  const { desenharRede } = await import("./rede.js");
  const etapaDe = new Map(estrutura.flatMap((f) => f.etapas.map((e) => [e.id, e.nome])));
  const SIT = { concluida: ["concluida", "Concluída"], naoLiberada: ["naoLiberada", "Espera outra ação"] };
  desenharRede(area, { acoes, caminho, linhas, etapaDe, identificador: () => "", escala: escalas.rede,
    donos: (a) => (a.responsaveis.length ? `<span class="pp-donos" title="${esc(a.responsaveis.join(", "))}">${esc(a.responsaveis.join(", "))}</span>` : ""),
    situacao: (l) => (SIT[l.situacao] ? `<span class="${SIT[l.situacao][0]}" title="${SIT[l.situacao][1]}">${ICONES[SIT[l.situacao][0]]}</span>` : ""),
    marcos: usaFases ? estrutura.flatMap((f) => f.etapas.map((e) => ({ id: e.id, nome: e.nome, titulo: `${f.nome} › ${e.nome}`, fase: f.id, faseNome: f.nome }))) : null,
    inicio: resumo.inicio ?? null, termino: linhas.filter((l) => !l.continua).map((l) => l.conclusao).filter(Boolean).sort().at(-1) ?? null,
    prazoFinal: resumo.prazoFinal ?? null, continuas: true,
    aoMudarEscala: (escala) => { escalas.rede = escala; redesenhar(); },
    /* a etiqueta "agora" leva o nome da situação, como no Sextante; na atrasada e na contínua o resumo guarda o carimbo,
       e não a situação de baixo, que é liberada */
    nomeDaSituacao: (l) => (["atrasada", "continua"].includes(l.publica) ? "Liberada" : l.rotulo ?? "Liberada"), nomeLiberada: "Liberada",
    toque: matchMedia("(max-width: 899px)").matches, abreAcoes: false });
}

/** Caixa com a explicação de um termo do glossário ("o que é?" das legendas), fechada por botão, Esc ou toque fora. */
function mostrarTermo(t) {
  const caixa = document.createElement("dialog");
  caixa.className = "pp-termo";
  caixa.innerHTML = `<h2 class="pp-h2">${esc(t.titulo)}</h2><p>${t.texto}</p>${t.tecnico ? `<p class="tec">Termo técnico: ${t.tecnico}</p>` : ""}
    <form method="dialog"><button class="botao" type="submit">Fechar</button></form>`;
  caixa.addEventListener("close", () => caixa.remove());
  caixa.addEventListener("click", (e) => { if (e.target === caixa) caixa.close(); });
  document.body.append(caixa);
  caixa.showModal();
}
