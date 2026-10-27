/**
 * Configurar o sistema (documentação técnica, seções 5.1 e 8.1): o calendário geral, com as datas sem
 * expediente que valem para todos os espaços, e a cópia de segurança de todos os espaços
 * (passo 1.19a). Aberto pelo menu lateral.
 * Desde o passo 2.3, o calendário geral é do Administrador do Sistema (e-mails em sistema/administradores,
 * editado só no console do Firebase); os demais o consultam. O Administrador do Sistema vê também
 * "Espaços e administradores", onde nomeia um administrador para um espaço órfão.
 * Desde 27/10/2026 (pedido do responsável), abre como janela central em abas, como "Configurar este espaço", e o
 * Administrador do Sistema tem também "Usuários": a lista, o cadastro (com o e-mail do Firebase para a pessoa
 * definir a senha) e o envio de um e-mail para redefinir a senha.
 */
import { ligarSecoesSuaves } from "./movimento.js";
import { esc } from "../formato.js";
import { ICONES } from "../icones.js";
import { feriadosNacionais } from "../feriados.js";
import { abrirPainel, avisar, perguntar } from "./painel.js";
import { marcarPendencias, AVISO_INCOMPLETO, ESTADO_DA_GRAVACAO, mostrarEstado } from "./pendencias.js";
import { baixarArquivo } from "./arquivos.js";
import { NOME } from "../identidade.js";
import { normalizar } from "../acao.js";
import { administradores, nomeDaVisibilidade, visibilidadeDe, semAdministracao, emailNormal } from "../papeis.js";
import { montarAbasDaJanela } from "./abas-da-janela.js";
import { TIPOS, tipoDe } from "../tipos.js";
import { dataBr } from "../formato.js";

/**
 * @param {{store: object, hoje: string, acesso?: object|null, aoRestaurar?: () => void, foco?: string}} opcoes
 *   acesso: o login do Firebase (criar conta, redefinir senha), ou null sem o Firebase; aoRestaurar: depois de
 *   restaurar uma cópia, reabre o sistema; foco: "copia" abre a cópia de segurança
 */
export async function abrirConfiguracaoDoSistema({ store, hoje, acesso = null, aoRestaurar = () => {}, foco = null }) {
  let salvos = (await store.lerCalendarioGeral()).datasExcluidas;
  let rascunho = structuredClone(salvos);
  const anoAtual = Number(hoje.slice(0, 4));
  let anoFeriados = anoAtual + (Number(hoje.slice(5, 7)) >= 10 ? 1 : 0); // a partir de outubro, sugere o ano seguinte
  let novas = new Set(); // datas sugeridas pelo botão, destacadas enquanto o painel estiver aberto
  let admSistema = false;
  /* fechar (até com Esc) não perde o que foi digitado: grava o que ficou pendente (gravação automática, 24/10/2026) */
  /* janela central em abas, como "Configurar este espaço" (27/10/2026); no celular, sobe de baixo */
  const abas = { atual: foco === "copia" ? "copia" : null, naSecao: false };
  let soltarAbas = () => {};
  const corpo = abrirPainel("Configurar o sistema", "", { classe: "configuracao", deBaixo: matchMedia("(max-width: 640px)").matches,
    aoFechar: () => { soltarAbas(); clearTimeout(gravarCalendario.espera); if (admSistema) gravarCalendario(); } });
  ligarSecoesSuaves(corpo);
  /* Administrador do Sistema (passo 2.3) */
  admSistema = await store.ehAdministradorDoSistema().catch(() => false);
  let espacos = admSistema ? await store.listarEspacos().catch(() => []) : [];
  let nomeando = null; // id do espaço com o formulário de nomeação aberto
  let usuarios = admSistema ? await store.listarUsuarios().catch(() => []) : [];
  let administradoresDoSistema = admSistema ? await store.listarAdministradoresDoSistema().catch(() => []) : [];

  function desenhar() {
    const porAno = new Map();
    rascunho.forEach((d, i) => {
      const ano = d.data ? d.data.slice(0, 4) : "Sem data";
      if (!porAno.has(ano)) porAno.set(ano, []);
      porAno.get(ano).push([d, i]);
    });
    soltarAbas();
    corpo.innerHTML = `
      <details class="config" data-secao="calendario" open>
        <summary><h3>Calendário geral</h3></summary>
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
          ${novas.size ? `<p class="aviso">Datas sugeridas, já gravadas e destacadas acima. As marcadas com ⚠️ são pontes prováveis. Revise: confira, retire o que não valer e acrescente o que faltar, como recessos e pontos facultativos do ano.</p>` : ""}
          <p class="erro" data-erro hidden></p>
          ${admSistema ? `<div class="botoes"><button class="botao" type="button" data-acrescentar>${ICONES.mais}Data</button>${AVISO_INCOMPLETO}${ESTADO_DA_GRAVACAO}</div>` : ""}
        </form>
      </details>
      <details class="config" data-secao="copia">
        <summary><h3>Cópia de segurança</h3></summary>
        <p class="tec">Baixa um arquivo com todos os espaços, ações e responsáveis, inclusive o que está na lixeira, e o calendário geral.
          Guarde-o para ter uma cópia dos dados ou para levá-los a outra instalação do sistema. Os espaços restritos de que você não participa ficam de fora.</p>
        <div class="botoes"><button class="botao" type="button" data-copia>Baixar cópia de segurança</button></div>
        <h4>Restaurar uma cópia</h4>
        <p class="tec">Recria tudo o que está no arquivo, exatamente como estava. Só funciona com o banco vazio, sem nenhum espaço
          (nem na lixeira), para nunca misturar nem sobrescrever dados.</p>
        <div class="botoes"><button class="botao" type="button" data-restaurar${store.podeGravar ? "" : " disabled"}>Restaurar de um arquivo…</button>
          <input type="file" accept=".json,application/json" data-arquivo-copia hidden></div>
        ${store.podeGravar ? "" : `<p class="tec">Entre com seu e-mail e senha para restaurar.</p>`}
      </details>
      ${admSistema ? usuariosHtml() + espacosHtml() : ""}`;
    soltarAbas = montarAbasDaJanela(corpo, abas);
    marcar();
  }

  /**
   * Usuários (27/10/2026, pedido do responsável), só para o Administrador do Sistema: cadastrar um e-mail cria a
   * conta de acesso e o Firebase manda à pessoa o e-mail para definir a senha; cada usuário tem "Enviar e-mail de
   * nova senha". A lista junta os cadastrados pela tela, os Administradores do Sistema e quem tem papel num espaço
   * que você consulta. Trocar o e-mail de login, desativar ou apagar uma conta continuam no console do Firebase.
   */
  function usuariosHtml() {
    const porEmail = new Map();
    const juntar = (email, dados) => {
      const e = emailNormal(email ?? "");
      if (!e) return;
      const atual = porEmail.get(e) ?? { email: e, espacos: 0 };
      porEmail.set(e, { ...atual, ...dados, espacos: atual.espacos + (dados.espacos ?? 0) });
    };
    for (const u of usuarios) juntar(u.email, { nome: u.nome, cadastrado: true, cadastradoEm: u.cadastradoEm });
    for (const e of administradoresDoSistema) juntar(e, { admSistema: true });
    for (const esp of espacos) for (const e of Object.keys(esp.acessos ?? {})) juntar(e, { espacos: 1 });
    const lista = [...porEmail.values()].sort((a, b) => a.email.localeCompare(b.email, "pt-BR"));
    return `<details class="config" data-secao="usuarios">
      <summary><h3>Usuários</h3></summary>
      <p class="tec">Cadastre o e-mail de quem vai usar o sistema. ${acesso ? "O sistema cria a conta de acesso e a pessoa recebe um e-mail do Firebase para definir a própria senha." : "<b>Sem o banco compartilhado, nenhuma conta é criada</b>: o cadastro fica só na memória."}</p>
      <form class="linha-config cadastro-usuario" data-cadastrar-usuario>
        <input type="email" name="email" required placeholder="E-mail" aria-label="E-mail do novo usuário" autocomplete="off">
        <input name="nome" maxlength="80" placeholder="Nome (opcional)" aria-label="Nome do novo usuário" autocomplete="off">
        <button class="botao principal" type="submit"${store.podeGravar ? "" : " disabled"}>${ICONES.mais}Cadastrar</button>
      </form>
      <ul class="espacos-sistema usuarios-sistema">${lista.map((u) => `<li>
        <div><b>${esc(u.nome || u.email)}</b>${u.nome ? ` <small class="tec">${esc(u.email)}</small>` : ""}</div>
        <small>${[u.admSistema ? "Administrador do Sistema" : "", u.cadastrado ? `cadastrado pela tela${u.cadastradoEm ? ` em ${dataBr(u.cadastradoEm.slice(0, 10))}` : ""}` : "",
          u.espacos ? `papel em ${u.espacos} ${u.espacos === 1 ? "espaço" : "espaços"}` : ""].filter(Boolean).join(" · ") || "—"}</small>
        ${acesso ? `<button class="botao-texto" type="button" data-nova-senha="${esc(u.email)}">Enviar e-mail de nova senha</button>` : ""}
      </li>`).join("") || `<li class="vazio">Nenhum usuário cadastrado.</li>`}</ul>
      <p class="tec">A lista mostra os cadastrados aqui, os Administradores do Sistema e quem tem papel nos espaços que você consulta. Quem já tinha conta antes
        do cadastro pela tela aparece só se tiver papel num espaço. Trocar o e-mail de login, desativar ou apagar uma conta continua no console do Firebase
        (Authentication), porque o navegador não pode alterar a conta de outra pessoa.</p>
    </details>`;
  }

  /**
   * Espaços e administradores (passo 2.3), só para o Administrador do Sistema: cada espaço com os
   * administradores dele e "Nomear administrador", para um espaço órfão. A nomeação fica registrada no espaço.
   */
  function espacosHtml() {
    const ordenados = [...espacos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return `<details class="config" data-secao="espacos">
      <summary><h3>Espaços</h3></summary>
      <p class="tec">Use "Nomear administrador" só num espaço órfão, quando nenhum administrador dele pode mais administrá-lo (por exemplo,
        saiu da instituição). A nomeação fica registrada no espaço, com o seu e-mail e a data, e os administradores dele a veem.
        Nomear não dá a você papel no espaço.</p>
      <ul class="espacos-sistema">${ordenados.map((e) => {
        const adms = administradores(e);
        return `<li>
          <div><b>${esc(e.nome)}</b> <small class="tec">${esc(TIPOS[tipoDe(e)].nome)} · ${esc(nomeDaVisibilidade(visibilidadeDe(e)))}${e.criadoEm ? ` · criado em ${dataBr(e.criadoEm.slice(0, 10))}` : ""}${e.encerradoEm ? " · encerrado" : ""}</small></div>
          <small>${semAdministracao(e) ? "Sem administração (quem tem login altera tudo, até alguém assumir)."
            : adms.length ? `Administradores: ${adms.map(esc).join(", ")}` : "<b>Sem administrador.</b>"}</small>
          ${semAdministracao(e) ? "" : nomeando === e.id ? `<form class="linha-config" data-nomear="${esc(e.id)}">
              <input type="email" name="email" required placeholder="E-mail do novo administrador" aria-label="E-mail do novo administrador">
              <button class="botao principal" type="submit">Nomear</button><button class="botao" type="button" data-cancelar-nomear>Cancelar</button></form>`
            : `<button class="botao-texto" type="button" data-abrir-nomear="${esc(e.id)}">Nomear administrador</button>`}
        </li>`;
      }).join("") || `<li class="vazio">Nenhum espaço.</li>`}</ul>
      <p class="tec">A lista traz os espaços que você consulta; os restritos de que você não participa ficam de fora. Os Administradores do Sistema são
        definidos no console do Firebase (documento sistema/administradores, campo emails, do tipo lista).</p>
    </details>`;
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
  corpo.addEventListener("change", (e) => {
    if (e.target.matches("[data-ano]")) anoFeriados = Number(e.target.value);
    else if (e.target.dataset.indice != null) {
      /* data: o navegador avisa a cada número digitado do ano; espera a pessoa parar */
      clearTimeout(gravarCalendario.espera);
      if (e.target.type === "date") gravarCalendario.espera = setTimeout(() => gravarCalendario(), 900);
      else gravarCalendario();
    }
  });

  /* ---------- gravação automática (24/10/2026; item 10 da avaliação de usabilidade) ----------
   * O calendário geral grava sozinho: ao sair de um campo alterado, ao retirar uma data e ao acrescentar os
   * feriados sugeridos (com "Desfazer" no aviso). Uma data nova sem o dia fica destacada e de fora até ser
   * preenchida. Uma recusa aparece no pé da lista, e o que está na tela continua lá para ser corrigido. */
  let fila = Promise.resolve();
  const completas = (lista) => lista.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.data ?? ""))
    .map((d) => (d.motivo?.trim() ? { data: d.data, motivo: d.motivo.trim() } : { data: d.data }));
  function gravarCalendario({ aviso = null, desfazer = null } = {}) {
    fila = fila.then(async () => {
      const form = corpo.querySelector("[data-salvar-calendario]");
      const erro = form?.querySelector("[data-erro]");
      const lista = completas(rascunho).sort((a, b) => a.data.localeCompare(b.data));
      if (JSON.stringify(lista) === JSON.stringify(completas(salvos))) return;
      mostrarEstado(form, "salvando");
      try {
        await store.alterarCalendarioGeral(lista);
        salvos = (await store.lerCalendarioGeral()).datasExcluidas;
        if (erro) erro.hidden = true;
        mostrarEstado(form, "salvo");
        marcar();
        if (aviso) avisar(aviso, desfazer ? { acao: { texto: "Desfazer", fazer: desfazer } } : {});
      } catch (falha) {
        mostrarEstado(form, "");
        if (erro) { erro.textContent = falha.message; erro.hidden = false; }
      }
    });
    return fila;
  }
  corpo.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches("[data-copia]")) { baixarCopia(); return; }
    if (t.dataset.novaSenha) { enviarNovaSenha(t.dataset.novaSenha); return; }
    if (t.dataset.abrirNomear) { nomeando = t.dataset.abrirNomear; desenhar(); corpo.querySelector("[data-nomear] input")?.focus(); return; }
    if (t.matches("[data-cancelar-nomear]")) { nomeando = null; desenhar(); return; }
    if (t.matches("[data-restaurar]")) { escolherCopia(); return; }
    if (t.matches("[data-feriados]")) {
      const existentes = new Set(rascunho.map((d) => d.data));
      const sugeridas = feriadosNacionais(anoFeriados).filter((f) => !existentes.has(f.data));
      if (!sugeridas.length) { avisar(`Os feriados nacionais de ${anoFeriados} já estão na lista.`); return; }
      const antes = structuredClone(rascunho);
      const ano = anoFeriados;
      rascunho = [...rascunho, ...sugeridas].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
      novas = new Set(sugeridas.map((f) => f.data));
      desenhar();
      gravarCalendario({
        aviso: `${sugeridas.length} datas sugeridas para ${ano} gravadas. Revise as destacadas.`,
        desfazer: () => { rascunho = antes; novas = new Set(); desenhar(); gravarCalendario({ aviso: "Sugestões retiradas." }); },
      });
    } else if (t.matches("[data-acrescentar]")) {
      rascunho.push({ data: "", motivo: "" });
      desenhar();
      const datas = corpo.querySelectorAll('input[data-campo="data"]');
      datas[datas.length - 1]?.focus();
    } else if (t.dataset.tirar != null) {
      rascunho.splice(Number(t.dataset.tirar), 1);
      desenhar();
      gravarCalendario();
    }
  });
  corpo.addEventListener("submit", async (e) => {
    e.preventDefault();
    /* cadastro de usuário (27/10/2026) */
    if (e.target.matches("[data-cadastrar-usuario]")) {
      const email = emailNormal(e.target.elements.email.value);
      const nome = e.target.elements.nome.value;
      const botao = e.target.querySelector("button[type=submit]");
      botao.disabled = true;
      try {
        const conta = acesso ? await acesso.criarConta(email) : null;
        await store.registrarUsuario(email, { nome });
        usuarios = await store.listarUsuarios();
        desenhar();
        corpo.querySelector("[data-cadastrar-usuario] input")?.focus();
        avisar(conta === "criada" ? `${email} cadastrado. O Firebase enviou a ele um e-mail para definir a senha.`
          : conta === "existente" ? `${email} já tinha conta de acesso; ficou registrado na lista. Se ele não lembra a senha, use "Enviar e-mail de nova senha".`
          : `${email} cadastrado.`);
      } catch (falha) { botao.disabled = false; avisar(falha.message); }
      return;
    }
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
    gravarCalendario(); // Enter num campo da lista grava, como sair dele
  });

  /** Envia o e-mail do Firebase para a pessoa definir uma senha nova (27/10/2026). */
  async function enviarNovaSenha(email) {
    const ok = await perguntar({ titulo: "Enviar e-mail de nova senha?", corpo: `<p>${esc(email)} vai receber um e-mail do Firebase com um link para definir uma senha nova. A senha atual continua valendo até ele trocar.</p>`, confirmar: "Enviar", perigo: false });
    if (!ok) return;
    try { await acesso.redefinirSenha(email); avisar(`E-mail enviado para ${email}.`); } catch (falha) { avisar(falha.message); }
  }

  desenhar();
}
