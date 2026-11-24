/**
 * Tela "Ligações externas" do painel lateral (documentação técnica, seção 8, "Painel lateral das ligações externas";
 * passo 3.8, parte 2; 24/11/2026).
 *
 * A extensão de navegador lê o item aberto no SIPAC, no Horde ou no GLPI e abre o Sextante no painel lateral do
 * navegador, no endereço `#/ligacoes?tipo=…&id=…&titulo=…&link=…` (regras em js/ligacoes.js). A tela mostra:
 * - o item: tipo, número e título;
 * - as tarefas ligadas a ele, nos espaços de que a pessoa participa; tocar numa abre a janela da tarefa por cima;
 * - "Ligar a uma tarefa": busca pelo nome entre as tarefas não concluídas que a pessoa pode atualizar; "Ligar" grava;
 * - "Criar tarefa": nome (já com o título do item) e espaço, entre os espaços em que a pessoa pode criar tarefas;
 *   a tarefa nasce já ligada ao item.
 * Sem item no endereço, uma explicação; sem login, o item e o botão de entrar.
 *
 * Só desenha e chama as funções recebidas: ler, gravar e abrir ficam com o js/app.js.
 */
import { esc } from "../formato.js";
import { TIPOS, numeroNaTela, tarefasParaLigar } from "../ligacoes.js";
import { ICONES } from "../icones.js";
import { esqueletoHtml } from "./esqueleto.js";

/** O item, no alto da tela: tipo e número em letra menor, título (ou o número) em destaque. */
function itemHtml(item) {
  const t = TIPOS[item.tipo];
  const numero = numeroNaTela(item);
  const titulo = item.titulo || numero || t.nome;
  const abrir = item.link ? `<a class="pl-abrir" href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">Abrir no ${esc(t.sistema === "sipac" ? "SIPAC" : t.sistema === "glpi" ? "GLPI" : "Horde")}</a>` : "";
  return `<header class="pl-item">
    <p class="pl-tipo">${esc([t.rotulo, item.titulo ? numero : ""].filter(Boolean).join(" · "))}</p>
    <h2>${esc(titulo)}</h2>${abrir}
  </header>`;
}

/** Uma tarefa numa lista do painel: nome e espaço; `botao` é o que vai à direita (ou nada). */
const linhaHtml = ({ espaco, acao }, atributos, botao = "") => `<li class="pl-linha">
  <button type="button" class="pl-tarefa" ${atributos}>
    <span class="pl-nome">${esc(acao.rotulo)}</span>
    <span class="pl-espaco">${esc(espaco.nome)}</span>
  </button>${botao}
</li>`;

/** Enquanto lê os espaços. */
export function mostrarCarregandoLigacoes(alvo, item) {
  alvo.innerHTML = `<section class="painel-ligacoes" aria-busy="true">${item ? itemHtml(item) : ""}${esqueletoHtml("lista", 3)}</section>`;
}

/**
 * Desenha a tela.
 * @param {HTMLElement} alvo
 * @param {{item: object|null, comLogin: boolean, ligadas?: object[], fontes?: object[],
 *   podeAtualizar?: (espaco: object, acao: object) => boolean, espacosParaCriar?: object[],
 *   aoAbrir?: (espacoId: string, numero: number) => void, aoLigar?: (espacoId: string, numero: number) => Promise<boolean>,
 *   aoCriar?: (espacoId: string, nome: string) => Promise<boolean>, aoEntrar?: () => void}} o
 */
export function mostrarPainelDeLigacoes(alvo, o) {
  const { item } = o;
  if (!item) {
    alvo.innerHTML = `<section class="painel-ligacoes"><div class="pl-vazio-geral">
      <h2>Ligações externas</h2>
      <p>Abra um processo, documento avulso ou memorando do SIPAC, um e-mail do Horde ou um chamado do GLPI. Aqui aparecem as tarefas ligadas a ele.</p>
      <p class="tec">Esta tela é aberta pela extensão do Sextante, no painel lateral do navegador.</p>
    </div></section>`;
    return;
  }
  if (!o.comLogin) {
    alvo.innerHTML = `<section class="painel-ligacoes">${itemHtml(item)}
      <p class="pl-aviso">Entre com seu e-mail e senha para ver e ligar tarefas.</p>
      <div class="botoes"><button class="botao principal" type="button" data-pl-entrar>Entrar</button></div></section>`;
    alvo.querySelector("[data-pl-entrar]").addEventListener("click", () => o.aoEntrar?.());
    return;
  }
  const t = TIPOS[item.tipo];
  const nomeDoItem = t.este.replace(/^Este /, "este ").replace(/^Esta /, "esta ");
  const semNumero = !String(item.identificador ?? "").trim();
  const { ligadas = [], fontes = [], espacosParaCriar = [] } = o;
  let busca = "";
  let criando = false;

  const ligadasHtml = () => semNumero
    ? `<p class="pl-aviso">Sem o número, não dá para achar as tarefas ligadas a ${esc(nomeDoItem)}.</p>`
    : ligadas.length
      ? `<ul class="pl-lista">${ligadas.map((l) => linhaHtml(l, `data-pl-abrir="${esc(l.espaco.id)}|${l.acao.numero}"`)).join("")}</ul>`
      : `<p class="pl-vazio">Nenhuma tarefa ligada a ${esc(nomeDoItem)}.</p>`;

  const resultadosHtml = () => {
    const achadas = tarefasParaLigar(fontes, item, busca, o.podeAtualizar ?? (() => true));
    if (!achadas.length) return `<p class="pl-vazio">${busca.trim() ? "Nenhuma tarefa encontrada." : "Nenhuma tarefa para ligar."}</p>`;
    return `<ul class="pl-lista">${achadas.map((a) => linhaHtml(a, `data-pl-abrir="${esc(a.espaco.id)}|${a.acao.numero}"`,
      `<button type="button" class="botao pl-ligar" data-pl-ligar="${esc(a.espaco.id)}|${a.acao.numero}" aria-label="Ligar a ${esc(a.acao.rotulo)}">Ligar</button>`)).join("")}</ul>`;
  };

  const criarHtml = () => {
    if (!espacosParaCriar.length) return "";
    if (!criando) return `<button type="button" class="chip-campo" data-pl-novo>${ICONES.mais}Criar tarefa</button>`;
    const opcoes = espacosParaCriar.map((e) => `<option value="${esc(e.id)}">${esc(e.nome)}</option>`).join("");
    return `<form class="pl-criar" data-pl-criar>
      <input name="nome" maxlength="500" required aria-label="Nome da tarefa" placeholder="Nome da tarefa" value="${esc(item.titulo ?? "")}">
      ${espacosParaCriar.length > 1 ? `<select name="espaco" aria-label="Espaço">${opcoes}</select>` : `<input type="hidden" name="espaco" value="${esc(espacosParaCriar[0].id)}"><p class="tec">Em ${esc(espacosParaCriar[0].nome)}</p>`}
      <div class="botoes"><button class="botao principal" type="submit">Criar e ligar</button><button class="botao" type="button" data-pl-cancelar>Cancelar</button></div>
    </form>`;
  };

  alvo.innerHTML = `<section class="painel-ligacoes">${itemHtml(item)}
    <h3 class="pl-titulo">Tarefas ligadas${ligadas.length ? ` <span class="pl-conta">${ligadas.length}</span>` : ""}</h3>
    <div data-pl-ligadas>${ligadasHtml()}</div>
    <h3 class="pl-titulo">Ligar a uma tarefa</h3>
    <input type="search" class="pl-busca" data-pl-busca placeholder="Buscar tarefa pelo nome" aria-label="Buscar tarefa pelo nome">
    <div data-pl-resultados>${resultadosHtml()}</div>
    <div class="pl-rodape" data-pl-criar-area>${criarHtml()}</div>
  </section>`;

  /* os ouvintes vão na seção, que é refeita a cada desenho: no alvo (o #principal, que fica), se acumulariam */
  const raiz = alvo.querySelector(".painel-ligacoes");
  const resultados = raiz.querySelector("[data-pl-resultados]");
  const areaCriar = raiz.querySelector("[data-pl-criar-area]");
  const redesenharCriar = () => {
    areaCriar.innerHTML = criarHtml();
    areaCriar.querySelector('[name="nome"]')?.focus();
  };

  raiz.querySelector("[data-pl-busca]").addEventListener("input", (e) => {
    busca = e.target.value;
    resultados.innerHTML = resultadosHtml();
  });
  raiz.addEventListener("click", async (e) => {
    const ligar = e.target.closest("[data-pl-ligar]");
    if (ligar) {
      const [id, n] = ligar.dataset.plLigar.split("|");
      ligar.disabled = true;
      if (!(await o.aoLigar?.(id, Number(n)))) ligar.disabled = false;
      return;
    }
    const abrir = e.target.closest("[data-pl-abrir]");
    if (abrir) {
      const [id, n] = abrir.dataset.plAbrir.split("|");
      return o.aoAbrir?.(id, Number(n));
    }
    if (e.target.closest("[data-pl-novo]")) { criando = true; return redesenharCriar(); }
    if (e.target.closest("[data-pl-cancelar]")) { criando = false; return redesenharCriar(); }
  });
  raiz.addEventListener("submit", async (e) => {
    if (!e.target.matches("[data-pl-criar]")) return;
    e.preventDefault();
    const form = e.target;
    const botao = form.querySelector('[type="submit"]');
    botao.disabled = true;
    if (!(await o.aoCriar?.(form.elements.espaco.value, form.elements.nome.value))) botao.disabled = false;
  });
}

