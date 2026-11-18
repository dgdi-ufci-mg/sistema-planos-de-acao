/**
 * Página do painel público (18/11/2026; documentação técnica, seção 8.8): painel/?p=<código>.
 *
 * Somente leitura, sem login e sem a barra do Sextante. Lê a cópia-resumo pelo Store (js/dados.js) e a desenha:
 * título e código, apresentação, Programa e aprovação, os três números (ações concluídas, entregas alcançadas,
 * conclusão prevista com início e prazo) e três blocos que começam recolhidos: andamento por fase (só com duas ou
 * mais fases), entregas (só com entregas) e ações, com filtro por situação.
 *
 * `htmlDoPainel` é puro (texto entra, HTML sai), para ser testado com o Node; `mostrarPainelPublico` liga a página.
 */
import { esc, dataBr, plural } from "../formato.js";
import { numerosDoResumo } from "../painel-publico.js";
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

const etiqueta = (situacao, rotulo) => `<span class="pp-etiqueta pp-${esc(situacao)}">${esc(rotulo)}</span>`;

/** Cabeçalho do bloco recolhível: título, resumo e "Ver"/"Recolher". */
const resumoDoBloco = (titulo, resumo, ver) => `<summary class="pp-bloco-titulo">
  <span class="pp-bloco-nome"><span class="pp-h2">${titulo}</span><span class="pp-bloco-resumo">${resumo}</span></span>
  <span class="pp-ver"><span class="pp-ver-fechado">${ver}</span><span class="pp-ver-aberto">Recolher</span>${ICONES.abaixo}</span></summary>`;

/**
 * HTML da página.
 * @param {{resumo: object, atualizadoEm?: string|null}} painel
 * @param {{abertos?: Set<string>, filtro?: string}} estado  blocos abertos ("fases", "entregas", "acoes") e o filtro das ações
 */
export function htmlDoPainel({ resumo, atualizadoEm = null }, { abertos = new Set(), filtro = "todas" } = {}) {
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

  <footer class="pp-rodape">
    ${atualizadoEm ? `<span><b>Atualizado em ${dataBr(atualizadoEm.slice(0, 10))}, às ${new Date(atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</b> O painel se atualiza quando a equipe mexe no plano.</span>` : ""}
    <span>Resumo público, somente leitura. Comentários e anotações da equipe não aparecem aqui.</span>
  </footer>`;
}

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
  document.title = `${painel.resumo.nome} · Painel público`;
  const estado = { abertos: new Set(), filtro: "todas" };
  const desenhar = () => { alvo.innerHTML = htmlDoPainel(painel, estado); };
  desenhar();
  ligarSecoes(alvo);
  alvo.addEventListener("toggle", (e) => {
    const id = e.target.dataset?.bloco;
    if (id) e.target.open ? estado.abertos.add(id) : estado.abertos.delete(id);
  }, true);
  alvo.addEventListener("click", (e) => {
    const b = e.target.closest("[data-filtro]");
    if (!b) return;
    estado.filtro = b.dataset.filtro;
    desenhar();
    alvo.querySelector(`[data-filtro="${estado.filtro}"]`)?.focus();
  });
}
