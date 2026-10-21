/**
 * Nova ação (especificação, seção 8.3; passos 1.9 e 1.14a): janela compacta, como a adição
 * rápida do Todoist. À vista, o essencial do tipo de espaço: o rótulo e os três pontos da
 * estimativa (que podem ficar para depois: a ação nasce com "Falta estimar"). O opcional fica
 * recolhido em botões pequenos, um por campo, ou todos de uma vez em "Todos os campos".
 * Enter cria a ação e deixa a janela aberta e limpa para a próxima, na mesma etapa.
 */
import { ICONES } from "../icones.js";
import { esc, plural, dataBr } from "../formato.js";
import { duracaoPert } from "../calculo.js";
import { buscar, normalizarCodigo, problemaDoCodigo, sugerirCodigo } from "../acao.js";
import { abrirPainel, avisar } from "./painel.js";
import { seloHtml } from "./pessoas.js";
import { seletorHtml, ligarSeletores } from "./seletor.js";

const MAX_SUGESTOES = 8;
const decimal = (x) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Data mínima de uma ação nova: hoje, se o espaço já começou (sem anteriores, ela nasceria atrasada). */
export const dataMinimaPadrao = (espaco, hoje) => (espaco.inicio && hoje > espaco.inicio ? hoje : "");

/**
 * @param {{store: object, espacoId: string, hoje: string, usuario?: string|null, dados: object,
 *   etapa?: string, aoCriar: (numero: number) => void, aoFechar?: () => void}} opcoes  dados: ver dadosDaJanela em espaco.js
 * @returns {{atualizar: (dados: object) => void}} a tela do espaço repassa as mudanças do banco
 */
export function abrirNovaAcao({ store, espacoId, hoje, usuario = null, dados, etapa = "", aoCriar, aoFechar }) {
  const d = { ...dados };
  let fechada = false;
  const campos = d.espaco.camposOpcionais ?? {};
  const etapas = (d.espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => ({ ...e, fase: f.nome })));
  const etapaDe = new Map(etapas.map((e) => [e.id, e.nome]));
  const nomeHtml = (a) => `${d.usaCodigos && a.codigo ? `<span class="mono">${esc(a.codigo)}</span> ` : ""}${esc(a.rotulo)}`;
  const existentes = () => d.acoes.map((a) => a.codigo).filter(Boolean);
  let responsaveis = [...d.responsaveis];
  let escolhidos;
  const limparEscolhas = () => { escolhidos = { dependeDe: [], responsaveis: [...(d.meus ?? [])] }; };
  limparEscolhas();

  /* campos recolhidos: [nome, texto do botão]; só os que o espaço usa */
  const OPCIONAIS = [
    d.usaFases && ["etapa", "Etapa"],
    ["responsaveis", "Responsáveis"],
    ["dependeDe", "Depende de"],
    ["naoAntesDe", "Não começa antes de"],
    campos.descricao !== false && ["descricao", "Descrição"],
    d.usaCodigos && ["codigo", "Código"],
  ].filter(Boolean);
  const abertos = new Set();

  const corpo = abrirPainel("Nova ação", `
    <form class="nova-acao" novalidate>
      <input class="rotulo-novo" name="rotulo" maxlength="120" required autocomplete="off"
        placeholder="Nome da ação" aria-label="Rótulo (nome curto da ação)">
      <div class="campo"><span>Estimativa <small>(dias úteis, da liberação até a conclusão; pode ficar para depois)</small></span>
        <div class="tres-pontos">
          <label class="campo"><span>Otimista</span><input name="o" type="number" min="0" step="1" inputmode="numeric"></label>
          <label class="campo"><span>Mais provável</span><input name="m" type="number" min="0" step="1" inputmode="numeric"></label>
          <label class="campo"><span>Pessimista</span><input name="p" type="number" min="0" step="1" inputmode="numeric"></label>
        </div>
        <small data-pert></small></div>
      ${d.usaFases ? `<label class="campo" data-bloco="etapa" hidden><span>Etapa</span><select name="etapa"><option value="">Sem fase nem etapa</option>${(d.espaco.estrutura ?? []).map((f) =>
        `<optgroup label="${esc(f.nome)}">${f.etapas.map((e) => `<option value="${esc(e.id)}"${e.id === etapa ? " selected" : ""}>${esc(e.nome)}</option>`).join("")}</optgroup>`).join("")}</select></label>` : ""}
      <div class="campo" data-bloco="responsaveis" hidden><span>Responsáveis</span><div class="etiquetas" data-etiquetas="responsaveis"></div>
        ${seletorHtml("responsaveis", "Digite o nome, a sigla ou o setor")}</div>
      <div class="campo" data-bloco="dependeDe" hidden><span>Depende de</span><div class="etiquetas" data-etiquetas="dependeDe"></div>
        ${seletorHtml("dependeDe", d.usaCodigos ? "Digite o nome ou o código da ação anterior" : "Digite o nome da ação anterior")}</div>
      <label class="campo" data-bloco="naoAntesDe" hidden><span>Não começa antes de</span>
        <input name="naoAntesDe" type="date" value="${dataMinimaPadrao(d.espaco, hoje)}">
        <small>Se o espaço já começou, vem com a data de hoje, para a ação não nascer atrasada. Apague se ela puder ser liberada assim que as anteriores terminarem.</small></label>
      ${campos.descricao !== false ? `<label class="campo" data-bloco="descricao" hidden><span>Descrição</span><textarea name="descricao" rows="2"></textarea></label>` : ""}
      ${d.usaCodigos ? `<label class="campo" data-bloco="codigo" hidden><span>Código</span>
        <input name="codigo" maxlength="12" autocomplete="off" autocapitalize="characters" placeholder="automático">
        <small data-aviso-codigo>Se ficar vazio, o sistema cria um.</small></label>` : ""}
      <div class="chips-campos" role="group" aria-label="Mais campos" data-chips></div>
      <p class="erro" data-erro hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">${ICONES.mais}Criar ação</button>
        <small class="tec">Enter cria e deixa a janela pronta para a próxima.</small></div>
    </form>`, { janela: true, aoFechar: () => { fechada = true; aoFechar?.(); } });
  const form = corpo.querySelector("form");
  const erro = form.querySelector("[data-erro]");
  const mostrarErro = (texto) => { erro.textContent = texto; erro.hidden = !texto; };

  /* ---------- botões dos campos recolhidos: mostram o valor quando há ---------- */
  function resumoDe(nome) {
    if (nome === "etapa") return etapaDe.get(form.etapa.value) ?? "";
    if (nome === "responsaveis") return escolhidos.responsaveis.length ? `${escolhidos.responsaveis.length}` : "";
    if (nome === "dependeDe") return escolhidos.dependeDe.length ? `${escolhidos.dependeDe.length}` : "";
    if (nome === "naoAntesDe") return form.naoAntesDe.value ? dataBr(form.naoAntesDe.value) : "";
    if (nome === "descricao") return form.descricao.value.trim() ? "✓" : "";
    if (nome === "codigo") return normalizarCodigo(form.codigo.value);
    return "";
  }
  function desenharChips() {
    const fechados = OPCIONAIS.filter(([nome]) => !abertos.has(nome));
    corpo.querySelector("[data-chips]").innerHTML = fechados.map(([nome, texto]) => {
      const valor = resumoDe(nome);
      return `<button type="button" class="chip-campo${valor ? " com-valor" : ""}" data-mostrar="${nome}">${ICONES.mais}${texto}${valor ? `: <b>${esc(valor)}</b>` : ""}</button>`;
    }).join("") + (fechados.length > 1 ? `<button type="button" class="chip-campo discreto" data-mostrar="todos">Todos os campos</button>` : "");
  }
  function mostrar(nome) {
    for (const [n] of OPCIONAIS) {
      if (nome !== "todos" && n !== nome) continue;
      abertos.add(n);
      corpo.querySelector(`[data-bloco="${n}"]`).hidden = false;
    }
    desenharChips();
    if (nome !== "todos") corpo.querySelector(`[data-bloco="${nome}"]`).querySelector("input, select, textarea")?.focus();
  }

  /* ---------- etiquetas e seletores ---------- */
  const contexto = () => ({ tons: d.espaco.tons, meus: d.meus });
  function desenharEtiquetas() {
    corpo.querySelector('[data-etiquetas="dependeDe"]').innerHTML = escolhidos.dependeDe.map((n) => {
      const a = d.acoes.find((x) => x.numero === n);
      return `<span class="etiqueta">${nomeHtml(a)}<button type="button" class="tirar" data-tirar="dependeDe" data-valor="${n}" aria-label="Retirar ${esc(a.rotulo)}">${ICONES.fechar}</button></span>`;
    }).join("");
    corpo.querySelector('[data-etiquetas="responsaveis"]').innerHTML = escolhidos.responsaveis.map((id) => {
      const r = responsaveis.find((x) => x.id === id);
      return r ? `<span class="etiqueta">${seloHtml(r, contexto())}${esc(r.nome)}<button type="button" class="tirar" data-tirar="responsaveis" data-valor="${esc(id)}" aria-label="Retirar ${esc(r.nome)}">${ICONES.fechar}</button></span>` : "";
    }).join("");
    desenharChips();
  }
  const acrescentar = (lista, valor) => { if (!escolhidos[lista].includes(valor)) escolhidos[lista].push(valor); desenharEtiquetas(); };

  const seletores = ligarSeletores(corpo, {
    dependeDe: {
      opcoes: (texto) => buscar(d.acoes.filter((a) => !escolhidos.dependeDe.includes(a.numero)), texto, (a) => [a.rotulo, d.usaCodigos ? a.codigo : ""])
        .slice(0, MAX_SUGESTOES)
        .map((a) => ({
          html: `${nomeHtml(a)}${etapaDe.get(a.etapa) ? ` <span class="tec">${esc(etapaDe.get(a.etapa))}</span>` : ""}`,
          escolher: () => acrescentar("dependeDe", a.numero),
        })),
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
    if (!d.usaCodigos) return "";
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

  /** Três pontos: todos vazios (fica para depois), todos inteiros válidos, ou um problema. */
  function lerTres() {
    const textos = ["o", "m", "p"].map((k) => form[k].value);
    if (textos.every((t) => t === "")) return { vazia: true };
    const [o, m, p] = textos.map((t) => (t === "" ? NaN : Number(t)));
    if (textos.some((t) => t === "")) return { problema: "Preencha os três pontos da estimativa, ou deixe os três em branco para estimar depois." };
    return { o, m, p };
  }
  function atualizarPert() {
    const { o, m, p } = lerTres();
    form.querySelector("[data-pert]").textContent = [o, m, p].every(Number.isInteger) && o >= 0 && o <= m && m <= p && p > 0
      ? `Prazo previsto (PERT): ${decimal(duracaoPert({ o, m, p }))} ${plural(duracaoPert({ o, m, p }), "dia útil", "dias úteis")}`
      : "Em branco: a ação fica com “Falta estimar”.";
  }

  form.addEventListener("input", (e) => {
    if (e.target.name === "rotulo" || e.target.name === "codigo") avisarCodigo();
    if (["o", "m", "p"].includes(e.target.name)) atualizarPert();
    if (["etapa", "naoAntesDe", "descricao", "codigo"].includes(e.target.name)) desenharChips();
  });
  form.addEventListener("change", (e) => { if (e.target.name === "etapa") desenharChips(); });
  corpo.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-mostrar]");
    if (botao) { mostrar(botao.dataset.mostrar); return; }
    const tirar = e.target.closest("[data-tirar]");
    if (!tirar) return;
    const valor = tirar.dataset.tirar === "dependeDe" ? Number(tirar.dataset.valor) : tirar.dataset.valor;
    escolhidos[tirar.dataset.tirar] = escolhidos[tirar.dataset.tirar].filter((v) => v !== valor);
    desenharEtiquetas();
  });

  /** Depois de criar: limpa tudo, menos a etapa e a data mínima, para cadastrar várias em sequência. */
  function limpar() {
    for (const nome of ["rotulo", "o", "m", "p", "descricao", "codigo"]) if (form[nome]) form[nome].value = "";
    limparEscolhas();
    desenharEtiquetas();
    atualizarPert();
    avisarCodigo();
    mostrarErro("");
    form.rotulo.focus();
  }

  let criando = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (criando) return;
    const f = Object.fromEntries(new FormData(form));
    const rotulo = f.rotulo.trim();
    if (!rotulo) { mostrarErro("Informe o nome da ação."); form.rotulo.focus(); return; }
    if (avisarCodigo()) { mostrarErro(form.querySelector("[data-aviso-codigo]").textContent); mostrar("codigo"); return; }
    const tres = lerTres();
    if (tres.problema) { mostrarErro(tres.problema); form.o.focus(); return; }
    const codigo = d.usaCodigos ? normalizarCodigo(f.codigo) || sugerirCodigo(rotulo, existentes()) : null;
    criando = true;
    try {
      const numero = await store.criarAcao(espacoId, {
        rotulo,
        ...(codigo ? { codigo } : {}),
        ...(f.etapa ? { etapa: f.etapa } : {}),
        ...(f.descricao?.trim() ? { descricao: f.descricao.trim() } : {}),
        dependeDe: escolhidos.dependeDe,
        responsaveis: escolhidos.responsaveis,
        ...(f.naoAntesDe ? { naoAntesDe: f.naoAntesDe } : {}),
        estimativas: tres.vazia ? [] : [{ em: hoje, por: usuario, o: tres.o, m: tres.m, p: tres.p, contaDe: "liberacao" }],
      });
      avisar(tres.vazia ? `Ação criada: ${rotulo}. Falta estimar.` : `Ação criada: ${rotulo}.`);
      aoCriar(numero);
      limpar();
    } catch (falha) {
      mostrarErro(falha.message);
    } finally {
      criando = false;
    }
  });

  desenharEtiquetas();
  seletores.desenhar();
  atualizarPert();
  if (etapa && d.usaFases) desenharChips();
  form.rotulo.focus();
  return {
    /** Ações e responsáveis novos, para as dependências e o código (a janela fica aberta entre criações). */
    atualizar(novos) {
      if (fechada) return;
      d.acoes = novos.acoes;
      responsaveis = novos.responsaveis;
    },
  };
}
