/**
 * Tela "Extração de dados" (passo 2.10, parte 2; documentação técnica, seções 8 e 16.6): escolher os espaços, o que
 * extrair (ações com os campos do dicionário, entregas, registros de alcance, histórico) e o formato (CSV, Excel,
 * LibreOffice ou PDF pela impressão do navegador). Só leitura: nada muda no banco.
 */
import { esc, plural } from "../formato.js";
import { abrirPainel, avisar } from "./painel.js";
import { tipoDe } from "../tipos.js";
import { montarExtracao, CAMPOS_DA_ACAO, CAMPOS_PADRAO_DA_ACAO, FILTROS_DE_SITUACAO } from "../extracao.js";
import { csv, xlsx, ods, textoDaCelula } from "../arquivo-planilha.js";

const FORMATOS = [
  ["xlsx", "Excel (.xlsx)", "Uma aba por tabela."],
  ["ods", "LibreOffice (.ods)", "Uma aba por tabela."],
  ["csv", "CSV com ponto e vírgula", "Um arquivo por tabela; abre no Excel e no LibreOffice."],
  ["pdf", "PDF pela impressão", "Abre a impressão do navegador; escolha “Salvar como PDF”."],
];
const lembrar = (chave, valor) => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ } };
const lembrado = (chave, padrao) => { try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; } };

/** Baixa um arquivo gerado aqui. */
function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** PDF: as tabelas numa página só para impressão; o resto da tela some ao imprimir. */
function imprimir(tabelas, titulo) {
  document.querySelector(".impressao-extracao")?.remove();
  const folha = document.createElement("section");
  folha.className = "impressao-extracao";
  folha.innerHTML = `<h1>${esc(titulo)}</h1>${tabelas.map((t) => `<h2>${esc(t.nome)} <small>(${t.linhas.length} ${plural(t.linhas.length, "linha", "linhas")})</small></h2>
    <table><thead><tr>${t.colunas.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
    <tbody>${t.linhas.map((l) => `<tr>${l.map((c) => `<td>${esc(textoDaCelula(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`).join("")}`;
  document.body.append(folha);
  document.body.classList.add("imprimindo-extracao");
  const fim = () => { document.body.classList.remove("imprimindo-extracao"); folha.remove(); removeEventListener("afterprint", fim); };
  addEventListener("afterprint", fim);
  /* a folha fica escondida na tela até o fim da impressão (ou até a próxima extração em PDF): no celular, a
     impressão pode abrir depois de print() voltar */
  print();
}

/**
 * Abre a tela.
 * @param {{fontes: {store: object, espacos: object[], rotulo?: string}[], hoje: string}} opcoes
 *   fontes: os espaços que a pessoa pode consultar, de cada banco (o do sistema e o do exemplo)
 */
export function abrirExtracao({ fontes, hoje }) {
  const todos = fontes.flatMap((f) => f.espacos.map((e) => ({ fonte: f, espaco: e })))
    .sort((a, b) => a.espaco.nome.localeCompare(b.espaco.nome, "pt-BR"));
  const escolha = {
    espacos: new Set(),
    acoes: lembrado("sextante.extracao.acoes", true),
    campos: new Set(lembrado("sextante.extracao.campos", CAMPOS_PADRAO_DA_ACAO)),
    situacao: "todas",
    entregas: lembrado("sextante.extracao.entregas", false),
    alcances: lembrado("sextante.extracao.alcances", false),
    historico: lembrado("sextante.extracao.historico", false),
    formato: lembrado("sextante.extracao.formato", "xlsx"),
  };
  const corpo = abrirPainel("Extração de dados", "");
  const algumPlano = () => todos.some((x) => escolha.espacos.has(x.espaco.id) && tipoDe(x.espaco) === "planoDeAcao");
  const marcar = (nome, ligado, texto, extra = "") => `<label class="alternar"><input type="checkbox" data-escolha="${nome}"${ligado ? " checked" : ""}${extra}> <span>${texto}</span></label>`;

  function desenhar() {
    corpo.innerHTML = `<form class="editor extracao" data-form-extracao>
      <p class="tec">Gere uma planilha ou um PDF com os dados dos espaços que você pode consultar. Os títulos das colunas são os nomes do dicionário de dados. Nada muda nos espaços.</p>
      <fieldset><legend>Espaços</legend>
        ${todos.length ? `<div class="extracao-espacos">${todos.map(({ espaco, fonte }) => `<label class="alternar"><input type="checkbox" data-espaco-extracao="${esc(espaco.id)}"${escolha.espacos.has(espaco.id) ? " checked" : ""}>
          <span>${esc(espaco.nome)}${fonte.rotulo ? ` <small class="tec">${esc(fonte.rotulo)}</small>` : ""}${espaco.encerradoEm ? ' <small class="tec">encerrado</small>' : ""}</span></label>`).join("")}</div>
          ${todos.length > 1 ? '<div class="botoes"><button class="botao-texto" type="button" data-todos-espacos>Marcar todos</button><button class="botao-texto" type="button" data-nenhum-espaco>Desmarcar todos</button></div>' : ""}`
          : '<p class="vazio">Nenhum espaço para extrair.</p>'}
      </fieldset>
      <fieldset><legend>O que extrair</legend>
        ${marcar("acoes", escolha.acoes, "<b>Ações</b>")}
        ${escolha.acoes ? `<div class="extracao-campos">
          <label class="campo"><span>Quais ações</span><select data-situacao-extracao>${Object.entries(FILTROS_DE_SITUACAO).map(([v, f]) => `<option value="${v}"${v === escolha.situacao ? " selected" : ""}>${f.nome}</option>`).join("")}</select></label>
          <div class="extracao-lista-campos">${CAMPOS_DA_ACAO.map(([campo, nome]) => `<label class="alternar"><input type="checkbox" data-campo-extracao="${campo}"${escolha.campos.has(campo) ? " checked" : ""}> <span>${esc(nome)} <code>${campo}</code></span></label>`).join("")}</div>
          <div class="botoes"><button class="botao-texto" type="button" data-campos-padrao>Campos padrão</button><button class="botao-texto" type="button" data-todos-campos>Todos os campos</button></div>
        </div>` : ""}
        ${marcar("entregas", escolha.entregas, "<b>Entregas</b> dos Planos de Ação, com o alcance atual", algumPlano() ? "" : " disabled")}
        ${marcar("alcances", escolha.alcances, "<b>Registros de alcance</b>, com as evidências", algumPlano() ? "" : " disabled")}
        ${algumPlano() ? "" : '<small class="tec">Entregas e alcances existem só nos Planos de Ação.</small>'}
        ${marcar("historico", escolha.historico, "<b>Histórico de alterações</b> das ações")}
      </fieldset>
      <fieldset><legend>Formato</legend>
        ${FORMATOS.map(([v, nome, dica]) => `<label class="tipo-opcao"><input type="radio" name="formato" value="${v}"${v === escolha.formato ? " checked" : ""}><span><b>${nome}</b><small>${dica}</small></span></label>`).join("")}
      </fieldset>
      <div class="botoes"><button class="botao principal" type="submit">Extrair</button></div>
    </form>`;
  }

  corpo.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.espacoExtracao) { if (t.checked) escolha.espacos.add(t.dataset.espacoExtracao); else escolha.espacos.delete(t.dataset.espacoExtracao); return desenhar(); }
    if (t.dataset.escolha) { escolha[t.dataset.escolha] = t.checked; lembrar(`sextante.extracao.${t.dataset.escolha}`, t.checked); return desenhar(); }
    if (t.dataset.campoExtracao) {
      if (t.checked) escolha.campos.add(t.dataset.campoExtracao); else escolha.campos.delete(t.dataset.campoExtracao);
      lembrar("sextante.extracao.campos", [...escolha.campos]);
      return;
    }
    if (t.matches("[data-situacao-extracao]")) { escolha.situacao = t.value; return; }
    if (t.name === "formato") { escolha.formato = t.value; lembrar("sextante.extracao.formato", t.value); }
  });
  corpo.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches("[data-todos-espacos]")) { todos.forEach((x) => escolha.espacos.add(x.espaco.id)); desenhar(); }
    if (t.matches("[data-nenhum-espaco]")) { escolha.espacos.clear(); desenhar(); }
    const campos = t.matches("[data-campos-padrao]") ? CAMPOS_PADRAO_DA_ACAO : t.matches("[data-todos-campos]") ? CAMPOS_DA_ACAO.map(([c]) => c) : null;
    if (campos) { escolha.campos = new Set(campos); lembrar("sextante.extracao.campos", campos); desenhar(); }
  });
  corpo.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!escolha.espacos.size) return avisar("Escolha pelo menos um espaço.");
    const comAcoes = escolha.acoes && escolha.campos.size;
    if (escolha.acoes && !escolha.campos.size) return avisar("Escolha pelo menos um campo das ações.");
    const comEntregas = algumPlano() && (escolha.entregas || escolha.alcances);
    if (!comAcoes && !comEntregas && !escolha.historico) return avisar("Escolha o que extrair.");
    const botao = corpo.querySelector('[type="submit"]');
    botao.disabled = true;
    botao.textContent = "Preparando…";
    try {
      const espacos = (await Promise.all(fontes.map((f) => {
        const ids = f.espacos.map((x) => x.id).filter((id) => escolha.espacos.has(id));
        return ids.length ? f.store.dadosParaExtracao(ids, { historico: escolha.historico }) : [];
      }))).flat();
      const tabelas = montarExtracao({
        espacos, hoje,
        escolha: {
          acoes: comAcoes ? { campos: CAMPOS_DA_ACAO.map(([c]) => c).filter((c) => escolha.campos.has(c)), situacao: escolha.situacao } : null,
          entregas: algumPlano() && escolha.entregas, alcances: algumPlano() && escolha.alcances, historico: escolha.historico,
        },
      });
      const base = `extracao-${hoje}`;
      if (escolha.formato === "xlsx") baixar(`${base}.xlsx`, xlsx(tabelas), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      else if (escolha.formato === "ods") baixar(`${base}.ods`, ods(tabelas), "application/vnd.oasis.opendocument.spreadsheet");
      else if (escolha.formato === "csv") {
        for (const t of tabelas) baixar(`${base}-${t.nome.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, "-")}.csv`, csv(t), "text/csv;charset=utf-8");
      } else imprimir(tabelas, `Extração de dados · ${espacos.map((x) => x.espaco.nome).join(", ")}`);
      const linhas = tabelas.reduce((s, t) => s + t.linhas.length, 0);
      if (escolha.formato !== "pdf") avisar(`Extração pronta: ${tabelas.length} ${plural(tabelas.length, "tabela", "tabelas")}, ${linhas} ${plural(linhas, "linha", "linhas")}.`);
    } catch (falha) {
      avisar(falha.message);
    } finally {
      botao.disabled = false;
      botao.textContent = "Extrair";
    }
  });
  desenhar();
}
