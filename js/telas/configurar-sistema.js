/**
 * Configurar o sistema (documentação técnica, seções 5.1 e 8.1): o calendário geral, com as datas sem
 * expediente que valem para todos os espaços, e a cópia de segurança de todos os espaços
 * (passo 1.19a). Aberto pelo menu lateral.
 * Desde o passo 2.3, o calendário geral é do Administrador do Sistema (e-mails em sistema/administradores,
 * editado só no console do Firebase); os demais o consultam. O Administrador do Sistema vê também
 * "Espaços e administradores", onde nomeia um administrador para um espaço órfão.
 */
import { ligarSecoesSuaves } from "./movimento.js";
import { esc } from "../formato.js";
import { ICONES } from "../icones.js";
import { feriadosNacionais } from "../feriados.js";
import { abrirPainel, avisar, perguntar } from "./painel.js";
import { marcarPendencias, AVISO_PENDENTE } from "./pendencias.js";
import { baixarArquivo } from "./arquivos.js";
import { NOME } from "../identidade.js";
import { normalizar } from "../acao.js";
import { administradores, nomeDaVisibilidade, visibilidadeDe, semAdministracao } from "../papeis.js";

/**
 * @param {{store: object, hoje: string, aoRestaurar?: () => void, foco?: string}} opcoes
 *   aoRestaurar: depois de restaurar uma cópia, reabre o sistema; foco: "copia" rola até a cópia de segurança
 */
export async function abrirConfiguracaoDoSistema({ store, hoje, aoRestaurar = () => {}, foco = null }) {
  let salvos = (await store.lerCalendarioGeral()).datasExcluidas;
  let rascunho = structuredClone(salvos);
  const anoAtual = Number(hoje.slice(0, 4));
  let anoFeriados = anoAtual + (Number(hoje.slice(5, 7)) >= 10 ? 1 : 0); // a partir de outubro, sugere o ano seguinte
  let novas = new Set(); // datas acrescentadas pelo botão, destacadas até salvar
  const corpo = abrirPainel("Configurar o sistema", "");
  ligarSecoesSuaves(corpo);
  /* Administrador do Sistema (passo 2.3) */
  const admSistema = await store.ehAdministradorDoSistema().catch(() => false);
  let espacos = admSistema ? await store.listarEspacos().catch(() => []) : [];
  let nomeando = null; // id do espaço com o formulário de nomeação aberto

  function desenhar() {
    const porAno = new Map();
    rascunho.forEach((d, i) => {
      const ano = d.data ? d.data.slice(0, 4) : "Sem data";
      if (!porAno.has(ano)) porAno.set(ano, []);
      porAno.get(ano).push([d, i]);
    });
    corpo.innerHTML = `
      <section class="config">
        <h3>Calendário geral</h3>
        <p class="tec">Feriados nacionais, recessos e outras datas sem expediente na instituição. Valem para todos os espaços,
          que podem acrescentar datas próprias (feriados locais) e desconsiderar alguma desta lista.</p>
        ${admSistema ? "" : `<p class="aviso-papel">${ICONES.pessoa}<span>Só o Administrador do Sistema altera o calendário geral. Aqui você o consulta.</span></p>`}
        ${admSistema ? `<div class="feriados-ano">
          <label class="campo"><span>Feriados nacionais de</span>
            <select data-ano>${[anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2].map((a) => `<option${a === anoFeriados ? " selected" : ""}>${a}</option>`).join("")}</select></label>
          <button class="botao" type="button" data-feriados>${ICONES.mais}Acrescentar</button>
        </div>` : ""}
        <form class="editor" data-salvar-calendario>
          ${[...porAno].sort(([a], [b]) => a.localeCompare(b)).map(([ano, itens]) => `<details class="ano-calendario"${novas.size || porAno.size === 1 || ano === String(anoFeriados) || ano === "Sem data" ? " open" : ""}>
            <summary>${esc(ano)} <span class="n">${itens.length}</span></summary>
            <div class="linhas-config">${itens.map(([d, i]) => `<div class="linha-config" data-linha-lista="${i}">
              <input type="date" data-indice="${i}" data-campo="data" value="${esc(d.data ?? "")}" aria-label="Data"${admSistema ? "" : " disabled"}>
              <input data-indice="${i}" data-campo="motivo" value="${esc(d.motivo ?? "")}" placeholder="Motivo" aria-label="Motivo"${admSistema ? "" : " disabled"}>
              ${admSistema ? `<button type="button" class="tirar" data-tirar="${i}" aria-label="Retirar a data">${ICONES.fechar}</button>` : ""}
            </div>`).join("")}</div>
          </details>`).join("") || `<p class="vazio">Nenhuma data cadastrada.</p>`}
          ${novas.size ? `<p class="aviso">Datas sugeridas, destacadas acima. As marcadas com ⚠️ são pontes prováveis. Revise antes de salvar: confira, corrija e acrescente o que faltar, como recessos e pontos facultativos do ano.</p>` : ""}
          <p class="erro" data-erro hidden></p>
          ${admSistema ? `<div class="botoes"><button class="botao" type="button" data-acrescentar>${ICONES.mais}Data</button><button class="botao principal" type="submit">Salvar calendário</button>${AVISO_PENDENTE}</div>` : ""}
        </form>
      </section>
      <section class="config">
        <h3>Cópia de segurança</h3>
        <p class="tec">Baixa um arquivo com todos os espaços, ações e responsáveis, inclusive o que está na lixeira, e o calendário geral.
          Guarde-o para ter uma cópia dos dados ou para levá-los a outra instalação do sistema. Os espaços restritos de que você não participa ficam de fora.</p>
        <div class="botoes"><button class="botao" type="button" data-copia>Baixar cópia de segurança</button></div>
        <h4>Restaurar uma cópia</h4>
        <p class="tec">Recria tudo o que está no arquivo, exatamente como estava. Só funciona com o banco vazio, sem nenhum espaço
          (nem na lixeira), para nunca misturar nem sobrescrever dados.</p>
        <div class="botoes"><button class="botao" type="button" data-restaurar${store.podeGravar ? "" : " disabled"}>Restaurar de um arquivo…</button>
          <input type="file" accept=".json,application/json" data-arquivo-copia hidden></div>
        ${store.podeGravar ? "" : `<p class="tec">Entre com seu e-mail e senha para restaurar.</p>`}
      </section>
      ${admSistema ? espacosHtml() : ""}
      <p class="tec">Os Administradores do Sistema são definidos no console do Firebase (documento sistema/administradores).</p>`;
    marcar();
  }

  /**
   * Espaços e administradores (passo 2.3), só para o Administrador do Sistema: cada espaço com os
   * administradores dele e "Nomear administrador", para um espaço órfão. A nomeação fica registrada no espaço.
   */
  function espacosHtml() {
    const ordenados = [...espacos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return `<section class="config">
      <h3>Espaços e administradores</h3>
      <p class="tec">Use "Nomear administrador" só num espaço órfão, quando nenhum administrador dele pode mais administrá-lo (por exemplo,
        saiu da instituição). A nomeação fica registrada no espaço, com o seu e-mail e a data, e os administradores dele a veem.
        Nomear não dá a você papel no espaço.</p>
      <ul class="espacos-sistema">${ordenados.map((e) => {
        const adms = administradores(e);
        return `<li>
          <div><b>${esc(e.nome)}</b> <small class="tec">${esc(nomeDaVisibilidade(visibilidadeDe(e)))}${e.encerradoEm ? " · encerrado" : ""}</small></div>
          <small>${semAdministracao(e) ? "Sem administração (quem tem login altera tudo, até alguém assumir)."
            : adms.length ? `Administradores: ${adms.map(esc).join(", ")}` : "<b>Sem administrador.</b>"}</small>
          ${semAdministracao(e) ? "" : nomeando === e.id ? `<form class="linha-config" data-nomear="${esc(e.id)}">
              <input type="email" name="email" required placeholder="E-mail do novo administrador" aria-label="E-mail do novo administrador">
              <button class="botao principal" type="submit">Nomear</button><button class="botao" type="button" data-cancelar-nomear>Cancelar</button></form>`
            : `<button class="botao-texto" type="button" data-abrir-nomear="${esc(e.id)}">Nomear administrador</button>`}
        </li>`;
      }).join("") || `<li class="vazio">Nenhum espaço.</li>`}</ul>
    </section>`;
  }
  /* ---------- restaurar (passo 1.19b) ---------- */
  async function escolherCopia() {
    try {
      const existentes = (await store.listarEspacos()).length + (await store.listarEspacosExcluidos()).length;
      if (existentes) { avisar("A restauração só é feita num banco sem nenhum espaço. Este banco já tem espaços."); return; }
    } catch (falha) { avisar(falha.message); return; }
    corpo.querySelector("[data-arquivo-copia]").click();
  }
  corpo.addEventListener("change", async (e) => {
    if (!e.target.matches("[data-arquivo-copia]")) return;
    const arquivo = e.target.files[0];
    e.target.value = "";
    if (!arquivo) return;
    let copia;
    let resumo;
    try {
      copia = JSON.parse(await arquivo.text());
      resumo = store.conferirCopia(copia);
    } catch (falha) {
      avisar(falha instanceof SyntaxError ? "Este arquivo não é uma cópia de segurança do sistema." : falha.message);
      return;
    }
    const quando = resumo.geradaEm ? new Date(resumo.geradaEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "data desconhecida";
    const ok = await perguntar({
      titulo: "Restaurar esta cópia?",
      corpo: `<p>Cópia de ${esc(quando)}, com ${resumo.espacos} ${resumo.espacos === 1 ? "espaço" : "espaços"}, ${resumo.acoes} ${resumo.acoes === 1 ? "ação" : "ações"},
        ${resumo.responsaveis} ${resumo.responsaveis === 1 ? "responsável" : "responsáveis"}, ${resumo.retratos} ${resumo.retratos === 1 ? "retrato" : "retratos"}
        e ${resumo.registros} ${resumo.registros === 1 ? "registro" : "registros"} de histórico.</p>
        <p>Tudo será recriado neste banco, exatamente como estava na cópia.</p>`,
      confirmar: "Restaurar", perigo: false,
    });
    if (!ok) return;
    try {
      await store.restaurarCopia(copia);
      avisar(`Cópia restaurada: ${resumo.espacos} ${resumo.espacos === 1 ? "espaço" : "espaços"}.`);
      aoRestaurar();
    } catch (falha) {
      avisar(falha.message);
    }
  });

  async function baixarCopia() {
    try {
      const copia = await store.copiaDeSeguranca();
      baixarArquivo(`${normalizar(NOME).replace(/[^a-z0-9]+/g, "-")}-copia-${hoje}.json`, JSON.stringify(copia, null, 2));
      avisar(`Cópia baixada: ${copia.espacos.length} ${copia.espacos.length === 1 ? "espaço" : "espaços"}.`
        + (copia.omitidos ? ` ${copia.omitidos} ${copia.omitidos === 1 ? "espaço restrito ficou" : "espaços restritos ficaram"} de fora, porque você não tem papel neles.` : ""));
    } catch (falha) {
      avisar(falha.message);
    }
  }
  const marcar = () => marcarPendencias(corpo.querySelector("[data-salvar-calendario]"), rascunho, salvos, ["data", "motivo"]);

  corpo.addEventListener("input", (e) => {
    const i = e.target.dataset.indice;
    if (i != null) { rascunho[Number(i)][e.target.dataset.campo] = e.target.value; marcar(); }
  });
  corpo.addEventListener("change", (e) => { if (e.target.matches("[data-ano]")) anoFeriados = Number(e.target.value); });
  corpo.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches("[data-copia]")) { baixarCopia(); return; }
    if (t.dataset.abrirNomear) { nomeando = t.dataset.abrirNomear; desenhar(); corpo.querySelector("[data-nomear] input")?.focus(); return; }
    if (t.matches("[data-cancelar-nomear]")) { nomeando = null; desenhar(); return; }
    if (t.matches("[data-restaurar]")) { escolherCopia(); return; }
    if (t.matches("[data-feriados]")) {
      const existentes = new Set(rascunho.map((d) => d.data));
      const sugeridas = feriadosNacionais(anoFeriados).filter((f) => !existentes.has(f.data));
      rascunho = [...rascunho, ...sugeridas].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
      novas = new Set(sugeridas.map((f) => f.data));
      desenhar();
      avisar(sugeridas.length ? `${sugeridas.length} datas sugeridas para ${anoFeriados}. Revise e salve.` : `Os feriados nacionais de ${anoFeriados} já estão na lista.`);
    } else if (t.matches("[data-acrescentar]")) {
      rascunho.push({ data: "", motivo: "" });
      desenhar();
      const datas = corpo.querySelectorAll('input[data-campo="data"]');
      datas[datas.length - 1]?.focus();
    } else if (t.dataset.tirar != null) {
      rascunho.splice(Number(t.dataset.tirar), 1);
      desenhar();
    }
  });
  corpo.addEventListener("submit", async (e) => {
    e.preventDefault();
    /* nomeação num espaço órfão (passo 2.3) */
    if (e.target.dataset.nomear) {
      const email = e.target.elements.email.value;
      try {
        await store.nomearAdministrador(e.target.dataset.nomear, email);
        espacos = await store.listarEspacos();
        nomeando = null;
        desenhar();
        avisar(`${email.trim().toLowerCase()} agora é administrador do espaço. A nomeação ficou registrada.`);
      } catch (falha) { avisar(falha.message); }
      return;
    }
    const erro = corpo.querySelector("[data-erro]");
    try {
      await store.alterarCalendarioGeral(rascunho.map((d) => (d.motivo?.trim() ? { data: d.data, motivo: d.motivo.trim() } : { data: d.data })));
      salvos = (await store.lerCalendarioGeral()).datasExcluidas;
      rascunho = structuredClone(salvos);
      novas = new Set();
      desenhar();
      avisar("Calendário geral salvo.");
    } catch (falha) {
      erro.textContent = falha.message;
      erro.hidden = false;
    }
  });

  desenhar();
  if (foco === "copia") corpo.querySelector("[data-restaurar]")?.scrollIntoView({ block: "center" });
}
