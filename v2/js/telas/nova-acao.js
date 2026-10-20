/**
 * Nova ação (especificação, seção 8.3; passo 1.9): janela central, como no Todoist, com
 * rótulo, código opcional (sugerido a partir do rótulo, com aviso enquanto se digita),
 * etapa, descrição, dependências, responsáveis, "Não começa antes de" e três pontos de estimativa.
 */
import { ICONES } from "../icones.js";
import { esc, plural } from "../formato.js";
import { duracaoPert } from "../calculo.js";
import { buscar, normalizarCodigo, problemaDoCodigo, sugerirCodigo } from "../acao.js";
import { abrirPainel, fecharPainel, avisar } from "./painel.js";
import { seloHtml } from "./pessoas.js";
import { seletorHtml, ligarSeletores } from "./seletor.js";

const MAX_SUGESTOES = 8;
const numero = (x) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/**
 * @param {{store: object, espacoId: string, hoje: string, usuario?: string|null, dados: object,
 *   aoCriar: (codigo: string) => void}} opcoes  dados: ver dadosDaJanela em espaco.js
 */
export function abrirNovaAcao({ store, espacoId, hoje, usuario = null, dados, aoCriar }) {
  const d = dados;
  const escolhidos = { dependeDe: [], responsaveis: [...(d.meus ?? [])] };
  let responsaveis = [...d.responsaveis];
  const existentes = () => d.acoes.map((a) => a.codigo);
  const campos = d.espaco.camposOpcionais ?? {};
  /* sem anteriores, uma ação nova seria liberada no início do espaço e já nasceria atrasada */
  const dataMinimaPadrao = d.espaco.inicio && hoje > d.espaco.inicio ? hoje : "";

  const corpo = abrirPainel("Nova ação", `
    <form class="nova-acao" novalidate>
      <label class="campo"><span>Rótulo <small>(nome curto da ação)</small></span>
        <input name="rotulo" maxlength="120" required placeholder="Por exemplo: Publicar o edital de seleção"></label>
      <label class="campo"><span>Código <small>(opcional)</small></span>
        <input name="codigo" maxlength="12" autocomplete="off" autocapitalize="characters" placeholder="automático">
        <small data-aviso-codigo>Se ficar vazio, o sistema cria um.</small></label>
      ${d.usaFases ? `<label class="campo"><span>Etapa</span><select name="etapa"><option value="">Sem fase nem etapa</option>${(d.espaco.estrutura ?? []).map((f) =>
        `<optgroup label="${esc(f.nome)}">${f.etapas.map((e) => `<option value="${esc(e.id)}">${esc(e.nome)}</option>`).join("")}</optgroup>`).join("")}</select></label>` : ""}
      ${campos.descricao !== false ? `<label class="campo"><span>Descrição <small>(opcional)</small></span><textarea name="descricao" rows="2"></textarea></label>` : ""}
      <div class="campo"><span>Depende de</span><div class="etiquetas" data-etiquetas="dependeDe"></div>
        ${seletorHtml("dependeDe", "Digite o código ou o nome da ação anterior")}</div>
      <div class="campo"><span>Responsáveis</span><div class="etiquetas" data-etiquetas="responsaveis"></div>
        ${seletorHtml("responsaveis", "Digite o nome, a sigla ou o setor")}</div>
      <label class="campo"><span>Não começa antes de <small>(opcional)</small></span>
        <input name="naoAntesDe" type="date" value="${dataMinimaPadrao}">
        ${dataMinimaPadrao ? `<small>Já vem com a data de hoje, para a ação não nascer atrasada. Apague se ela puder ser liberada assim que as anteriores terminarem.</small>` : ""}</label>
      <div class="campo"><span>Estimativa</span>
        <small>Prazo em dias úteis, da liberação até a conclusão, incluindo o tempo até alguém começar.</small>
        <div class="tres-pontos">
          <label class="campo"><span>Otimista</span><input name="o" type="number" min="0" step="1" inputmode="numeric" required></label>
          <label class="campo"><span>Mais provável</span><input name="m" type="number" min="0" step="1" inputmode="numeric" required></label>
          <label class="campo"><span>Pessimista</span><input name="p" type="number" min="0" step="1" inputmode="numeric" required></label>
        </div>
        <small data-pert></small></div>
      <p class="erro" data-erro hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">${ICONES.mais}Criar ação</button><button class="botao" type="button" data-fechar>Cancelar</button></div>
    </form>`, { janela: true });
  const form = corpo.querySelector("form");
  const erro = form.querySelector("[data-erro]");
  const mostrarErro = (texto) => { erro.textContent = texto; erro.hidden = !texto; };

  /* ---------- etiquetas e seletores ---------- */
  const contexto = () => ({ tons: d.espaco.tons, meus: d.meus });
  function desenharEtiquetas() {
    corpo.querySelector('[data-etiquetas="dependeDe"]').innerHTML = escolhidos.dependeDe.map((cod) => {
      const a = d.acoes.find((x) => x.codigo === cod);
      return `<span class="etiqueta"><span class="mono">${esc(cod)}</span>${esc(a?.rotulo ?? "")}<button type="button" class="tirar" data-tirar="dependeDe" data-valor="${esc(cod)}" aria-label="Retirar ${esc(cod)}">${ICONES.fechar}</button></span>`;
    }).join("");
    corpo.querySelector('[data-etiquetas="responsaveis"]').innerHTML = escolhidos.responsaveis.map((id) => {
      const r = responsaveis.find((x) => x.id === id);
      return r ? `<span class="etiqueta">${seloHtml(r, contexto())}${esc(r.nome)}<button type="button" class="tirar" data-tirar="responsaveis" data-valor="${esc(id)}" aria-label="Retirar ${esc(r.nome)}">${ICONES.fechar}</button></span>` : "";
    }).join("");
  }
  const acrescentar = (lista, valor) => { if (!escolhidos[lista].includes(valor)) escolhidos[lista].push(valor); desenharEtiquetas(); };

  const seletores = ligarSeletores(corpo, {
    dependeDe: {
      opcoes: (texto) => buscar(d.acoes.filter((a) => !escolhidos.dependeDe.includes(a.codigo)), texto, (a) => [a.codigo, a.rotulo])
        .slice(0, MAX_SUGESTOES)
        .map((a) => ({ html: `<span class="mono">${esc(a.codigo)}</span> ${esc(a.rotulo)}`, escolher: () => acrescentar("dependeDe", a.codigo) })),
      vazio: "Nenhuma ação encontrada.",
    },
    responsaveis: {
      opcoes: (texto) => {
        const achados = buscar(responsaveis.filter((r) => !escolhidos.responsaveis.includes(r.id)), texto, (r) => [r.nome, r.sigla, r.setor])
          .slice(0, MAX_SUGESTOES)
          .map((r) => ({ html: `${seloHtml(r, contexto())} ${esc(r.nome)}${r.setor ? ` <span class="tec">${esc(r.setor)}</span>` : ""}`, escolher: () => acrescentar("responsaveis", r.id) }));
        const nome = texto.trim();
        if (nome && !responsaveis.some((r) => r.nome.toLowerCase() === nome.toLowerCase())) {
          for (const [tipo, comoTexto] of [["pessoa", "pessoa"], ["unidade", "unidade (setor, equipe ou grupo)"]]) {
            achados.push({
              html: `${ICONES.mais} Cadastrar “${esc(nome)}” como ${comoTexto}`,
              escolher: async () => {
                const id = await store.criarResponsavel({ tipo, nome, ...(tipo === "unidade" && nome.length <= 10 ? { sigla: nome.toUpperCase() } : {}) });
                responsaveis = await store.listarResponsaveis();
                acrescentar("responsaveis", id);
              },
            });
          }
        }
        return achados;
      },
      vazio: "Digite um nome para buscar ou cadastrar.",
    },
  }, { aoErro: (e) => avisar(e.message) });

  /* ---------- código: aviso enquanto se digita ---------- */
  function avisarCodigo() {
    const aviso = form.querySelector("[data-aviso-codigo]");
    const digitado = form.codigo.value.trim();
    if (!digitado) {
      const sugestao = form.rotulo.value.trim() ? sugerirCodigo(form.rotulo.value, existentes()) : "";
      aviso.className = "";
      aviso.textContent = sugestao ? `Se ficar vazio, será ${sugestao}.` : "Se ficar vazio, o sistema cria um.";
      return "";
    }
    const codigo = normalizarCodigo(digitado);
    const problema = problemaDoCodigo(codigo, existentes());
    aviso.className = problema ? "aviso-erro" : "aviso-ok";
    aviso.textContent = problema || `Código ${codigo} disponível.`;
    return problema;
  }

  function atualizarPert() {
    const [o, m, p] = ["o", "m", "p"].map((k) => (form[k].value === "" ? NaN : Number(form[k].value)));
    form.querySelector("[data-pert]").textContent = [o, m, p].every(Number.isInteger) && o >= 0 && o <= m && m <= p && p > 0
      ? `Prazo previsto (PERT): ${numero(duracaoPert({ o, m, p }))} ${plural(duracaoPert({ o, m, p }), "dia útil", "dias úteis")}` : "";
  }

  form.addEventListener("input", (e) => {
    if (e.target.name === "rotulo" || e.target.name === "codigo") avisarCodigo();
    if (["o", "m", "p"].includes(e.target.name)) atualizarPert();
  });
  corpo.addEventListener("click", (e) => {
    const tirar = e.target.closest("[data-tirar]");
    if (!tirar) return;
    escolhidos[tirar.dataset.tirar] = escolhidos[tirar.dataset.tirar].filter((v) => v !== tirar.dataset.valor);
    desenharEtiquetas();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const rotulo = f.rotulo.trim();
    if (!rotulo) { mostrarErro("Informe o rótulo da ação."); form.rotulo.focus(); return; }
    if (avisarCodigo()) { mostrarErro(form.querySelector("[data-aviso-codigo]").textContent); form.codigo.focus(); return; }
    if (["o", "m", "p"].some((k) => f[k] === "")) { mostrarErro("Informe os três prazos da estimativa."); form.o.focus(); return; }
    const codigo = normalizarCodigo(f.codigo) || sugerirCodigo(rotulo, existentes());
    try {
      await store.criarAcao(espacoId, {
        codigo, rotulo,
        ...(f.etapa ? { etapa: f.etapa } : {}),
        ...(f.descricao?.trim() ? { descricao: f.descricao.trim() } : {}),
        dependeDe: escolhidos.dependeDe,
        responsaveis: escolhidos.responsaveis,
        ...(f.naoAntesDe ? { naoAntesDe: f.naoAntesDe } : {}),
        estimativas: [{ em: hoje, por: usuario, o: Number(f.o), m: Number(f.m), p: Number(f.p), contaDe: "liberacao" }],
      });
    } catch (falha) {
      mostrarErro(falha.message);
      return;
    }
    fecharPainel();
    avisar(`Ação ${codigo} criada.`);
    aoCriar(codigo);
  });

  desenharEtiquetas();
  seletores.desenhar();
  form.rotulo.focus();
}
