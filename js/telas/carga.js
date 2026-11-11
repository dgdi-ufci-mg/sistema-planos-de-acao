/**
 * Modo "Responsáveis" do espaço (documentação técnica, seção 8.4; regras na seção 5.10 e em `js/carga.js`).
 * Responde a duas perguntas: quem cuida do quê, e quem acumula ações ao mesmo tempo.
 * - uma linha por responsável, com uma faixa de semanas, de hoje ao fim previsto; em cada semana, o número de
 *   ações ao mesmo tempo, com a cor mais forte quanto maior;
 * - clicar na linha abre as ações da pessoa, como barras no mesmo eixo; clicar numa ação abre a janela dela.
 * Só leitura: nada é recalculado nem reagendado. Também no celular (a faixa rola para o lado).
 */
import { montarCarga, nivelDaCarga, SEM_RESPONSAVEL } from "../carga.js";
import { esc, dataBr, dataCurta, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { seloHtml } from "./pessoas.js";
import { abrirSuave, fecharSuave } from "./movimento.js";

const UM_DIA = 864e5;
const dias = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / UM_DIA;
const somar = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * UM_DIA).toISOString().slice(0, 10);
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** Largura de uma semana, em px. */
const SEMANA = 36;

/**
 * @param {HTMLElement} alvo
 * @param {{acoes: object[], caminho: object, cal: object, hoje: string, responsaveis: object[], tons?: object,
 *   meus?: string[]|null, identificador: (acao: object) => string, abertos: Set<string>}} dados
 *   abertos: ids dos responsáveis com as ações à vista ("" para "Sem responsável"); a tela muda o conjunto
 */
export function desenharCarga(alvo, dados) {
  const { acoes, caminho, cal, hoje, responsaveis, tons, meus, identificador, abertos } = dados;
  if (!acoes.length) {
    alvo.innerHTML = `<p class="lista-vazia">Este espaço ainda não tem ações. Esta visualização aparece quando houver ações com responsáveis.</p>`;
    return;
  }
  const carga = montarCarga(acoes, caminho, cal, responsaveis, { hoje });
  if (!carga.linhas.length) {
    alvo.innerHTML = `<p class="lista-vazia">Nenhuma ação em aberto: todas as ações deste espaço estão concluídas.</p>`;
    return;
  }
  const { semanas, de, ate, maximo } = carga;
  const largura = semanas.length * SEMANA;
  const x = (iso) => (dias(de, iso) / 7) * SEMANA;

  /* cabeçalho: o mês, na primeira semana e a cada mês novo, e o dia de cada segunda-feira */
  let mesAnterior = "";
  const topo = semanas.map((s, i) => {
    const mes = s.slice(0, 7);
    const novo = mes !== mesAnterior;
    mesAnterior = mes;
    const m = Number(s.slice(5, 7)) - 1;
    return `<span class="carga-sem${novo && i ? " mes" : ""}">${novo ? `<b>${MESES[m]}${m === 0 || !i ? ` ${s.slice(0, 4)}` : ""}</b>` : ""}<i>${Number(s.slice(8, 10))}</i></span>`;
  }).join("");

  const resumo = (l) => [
    `${l.emAberto} em aberto`,
    l.atrasadas ? `<span class="carga-atraso">${l.atrasadas} ${plural(l.atrasadas, "atrasada", "atrasadas")}</span>` : "",
    l.semEstimativa ? `${l.semEstimativa} sem estimativa` : "",
  ].filter(Boolean).join(" · ");

  const barraHtml = (b) => {
    const x0 = Math.max(0, x(b.inicio));
    const x1 = Math.min(largura, x(somar(b.fim, 1)));
    const classe = b.continua ? "continua" : b.semEstimativa ? "sem-estimativa" : b.critica ? "critica" : "folga";
    const nota = b.continua ? "Ação contínua: não entra no número" : b.semEstimativa ? "Falta estimar: não entra no número"
      : b.atrasada ? "Atrasada" : b.situacao === "naoLiberada" ? "Não liberada: datas previstas" : "Liberada";
    return `<div class="carga-linha acao" data-numero="${b.numero}">
      <div class="carga-nome" role="button" tabindex="0" data-abrir-acao>
        ${identificador(b.acao)}<span class="rotulo">${esc(b.acao.rotulo)}</span>
        ${b.atrasada ? `<span class="icone-atrasada" title="Atrasada">${ICONES.atrasada}</span>` : ""}
      </div>
      <div class="carga-trilho" style="width:${largura}px">
        <button type="button" class="carga-barra ${classe}${b.inicio < de ? " antes" : ""}" data-abrir-acao
          style="left:${x0}px;width:${b.semEstimativa ? 12 : Math.max(4, x1 - x0)}px"
          title="${esc(b.acao.rotulo)}&#10;${dataBr(b.inicio)} a ${dataBr(b.fim)}&#10;${nota}"
          aria-label="${esc(b.acao.rotulo)}: ${dataBr(b.inicio)} a ${dataBr(b.fim)}. ${nota}"></button>
      </div>
    </div>`;
  };

  const grupoHtml = (l) => {
    const id = l.responsavel?.id ?? SEM_RESPONSAVEL;
    const nome = l.responsavel?.nome ?? "Sem responsável";
    const aberto = abertos.has(id);
    const celulas = l.porSemana.map((n, i) => {
      const dica = `Semana de ${dataCurta(semanas[i])}: ${n ? `${n} ${plural(n, "ação", "ações")} ao mesmo tempo` : "nenhuma ação"}`;
      return `<span class="carga-cel n${nivelDaCarga(n, maximo)}${n && n === l.pico ? " pico" : ""}" title="${dica}" role="img" aria-label="${dica}">${n || ""}</span>`;
    }).join("");
    return `<section class="carga-grupo${aberto ? " aberto" : ""}" data-dono="${esc(id)}">
      <div class="carga-linha dono">
        <button type="button" class="carga-nome" data-carga-abrir aria-expanded="${aberto}" aria-label="${esc(nome)}: ${aberto ? "esconder" : "mostrar"} as ações">
          <span class="carga-seta">${ICONES.abrir}</span>
          ${l.responsavel ? seloHtml(l.responsavel, { tons, meus }) : `<span class="carga-ninguem" aria-hidden="true">${ICONES.pessoa}</span>`}
          <span class="carga-quem"><b>${esc(nome)}</b><small>${resumo(l)}</small></span>
        </button>
        <div class="carga-trilho semanas" style="width:${largura}px">${celulas}</div>
      </div>
      ${aberto ? `<div class="carga-acoes">${l.barras.map(barraHtml).join("")}</div>` : ""}
    </section>`;
  };

  const temContinua = carga.linhas.some((l) => l.continuas);
  const temSemEstimativa = carga.linhas.some((l) => l.semEstimativa);
  const anterior = alvo.querySelector("[data-rolagem]");
  const rolagemAnterior = anterior?.scrollLeft ?? 0;
  alvo.innerHTML = `
    <div class="carga-ferramentas">
      <p class="carga-explica">Em cada semana, quantas ações cada responsável tem <b>ao mesmo tempo</b>, pelas datas previstas. O número mostra onde olhar; não mede horas de trabalho. <a href="#" class="oque" data-termo="acoesAoMesmoTempo">o que é?</a></p>
      <div class="crono-legendas">
        <span class="crono-legenda carga-escala-cor">Menos<i class="carga-cel n1"></i><i class="carga-cel n2"></i><i class="carga-cel n3"></i><i class="carga-cel n4"></i>Mais</span>
        <span class="crono-legenda"><i class="critica"></i>Sem folga</span>
        <span class="crono-legenda"><i class="folga"></i>Com folga</span>
        ${temContinua ? `<span class="crono-legenda"><i class="continua"></i>Contínua (fora do número)</span>` : ""}
        ${temSemEstimativa ? `<span class="crono-legenda"><i class="carga-falta"></i>Falta estimar (fora do número)</span>` : ""}
      </div>
    </div>
    <div class="carga" style="--semana:${SEMANA}px">
      <div class="carga-rolagem" data-rolagem>
        <div class="carga-conteudo" style="width:calc(var(--nomes) + ${largura}px)">
          <div class="carga-linha carga-cabeca"><div class="carga-nome">Responsável</div><div class="carga-trilho escala" style="width:${largura}px">${topo}</div></div>
          ${carga.linhas.map(grupoHtml).join("")}
          ${hoje >= de && hoje < ate ? `<i class="carga-hoje" style="left:calc(var(--nomes) + ${x(hoje)}px)" title="Hoje"></i>` : ""}
        </div>
      </div>
    </div>
    ${carga.livres.length ? `<p class="carga-livres"><b>Sem ações em aberto:</b> ${carga.livres.map((r) => esc(r.nome)).join(", ")}.</p>` : ""}
    <p class="tec">Clique num responsável para ver as ações dele; clique numa ação para abri-la. A ação com mais de um responsável conta inteira para cada um. Esta tela só mostra: não muda datas nem responsáveis. Termo técnico: histograma de recursos.</p>`;

  const rolagem = alvo.querySelector("[data-rolagem]");
  rolagem.scrollLeft = rolagemAnterior;
  /* abrir e fechar as ações de um responsável, com a transição padrão */
  alvo.querySelector(".carga").addEventListener("click", async (e) => {
    const botao = e.target.closest("[data-carga-abrir]");
    if (!botao) return;
    const grupo = botao.closest("[data-dono]");
    const id = grupo.dataset.dono;
    if (abertos.has(id)) {
      abertos.delete(id);
      await fecharSuave(grupo.querySelector(".carga-acoes"));
    } else abertos.add(id);
    desenharCarga(alvo, dados);
    const novo = [...alvo.querySelectorAll("[data-dono]")].find((g) => g.dataset.dono === id);
    if (abertos.has(id)) abrirSuave(novo?.querySelector(".carga-acoes"));
    novo?.querySelector("[data-carga-abrir]")?.focus({ preventScroll: true });
  });
}
