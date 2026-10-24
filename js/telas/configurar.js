/**
 * Configurar o espaço (documentação técnica, seções 4.1 e 8.1; passo 1.13): painel lateral aberto pelo
 * menu do espaço, com dados e datas, datas excluídas, fases e etapas, campos opcionais,
 * documentos e a semente da simulação (visível, mas fixa). Cada seção é gravada pelo seu botão
 * Salvar; os campos opcionais, na hora. Exportação (passo 1.19a): copiar para planilha e copiar
 * o fluxograma em Mermaid. Retratos (passo 1.18): salvar e listar. Importar ações de planilha (passo 1.19b):
 * colar, conferir e gravar.
 */
import { ligarSecoesSuaves } from "./movimento.js";
import { criarTelaResponsaveis } from "./responsaveis.js";
import { esc, dataBr, plural } from "../formato.js";
import { ICONES } from "../icones.js";
import { VERSAO_CALCULO } from "../simulacao.js";
import { datasEfetivas, criarCalendario } from "../calendario.js";
import { caminhoCritico } from "../calculo.js";
import { planejarImportacao } from "../importar.js";
import { planejarResponsaveis } from "../importar-responsaveis.js";
import { abrirPainel, fecharPainel, avisar } from "./painel.js";
import { excluirEtapas, excluirEspaco } from "./exclusao.js";
import { marcarPendencias, AVISO_PENDENTE } from "./pendencias.js";
import { planilhaDoEspaco, mermaidDoEspaco } from "../exportar.js";
import { hojeLocal } from "../dados.js";
import { copiarTexto } from "./arquivos.js";
import { tipoHtml, ligarTipo, lerTipo } from "./tipo-espaco.js";
import { opcoesDoCalculo, usaSimulacao, usaDependencias } from "../modelos.js";
import { nomeInicial, personalizadasDe, NOME_INICIAL_PADRAO } from "../situacoes.js";
import { resumoDoModelo } from "./modelo-espaco.js";
import { CORES_ETIQUETA, etiquetasDe, tomDaCor, TAMANHO_DO_NOME } from "../etiquetas.js";
import { pendenciasParaEncerrar } from "../entregas.js";
import { tipoDe } from "../tipos.js";
import { PAPEIS, nomeDoPapel, semAdministracao, fechado, VISIBILIDADES, visibilidadeDe } from "../papeis.js";

const CAMPOS_OPCIONAIS = [
  ["fasesEtapas", "Fases e etapas", "Separadores que agrupam as ações na lista."],
  ["descricao", "Descrição", "Texto completo de cada ação."],
  ["notas", "Anotações", "Anotações formatadas de cada ação."],
  ["codigos", "Códigos das ações", "Códigos curtos, como LEV, para equipes que conversam por eles. Desligado, as ações aparecem só pelo nome."],
  ["prioridade", "Prioridade da equipe", "A equipe põe as ações em ordem de importância, arrastando-as na ordenação “Prioridade da equipe”."],
  ["etiquetas", "Etiquetas", "Marcas coloridas, como “Compras” ou “Urgente”, para agrupar e filtrar as ações."],
  ["justificativa", "Justificativa", "Por que cada ação existe, como uma exigência legal ou um pedido da Direção."],
  ["local", "Local", "Onde cada ação acontece, como um campus ou um setor."],
  ["documentos", "Documentos e links das ações", "Termos, pareceres e páginas ligados a cada ação, com a identificação no SIPAC/Protocolo ou o link."],
];
/** Campos opcionais desligados por padrão (seção 4.1.4); os demais vêm ligados. */
const DESLIGADOS_POR_PADRAO = new Set(["codigos", "prioridade", "etiquetas", "documentos", "justificativa", "local"]);
const ligado = (campos, chave) => (DESLIGADOS_POR_PADRAO.has(chave) ? campos?.[chave] === true : campos?.[chave] !== false);

/** @param {{store: object, espacoId: string, aoExcluirEspaco?: () => void}} opcoes */
export async function abrirConfiguracao({ store, espacoId, aoExcluirEspaco = () => {}, criarConta = null }) {
  let espaco = await store.lerEspaco(espacoId);
  let geral = await store.lerCalendarioGeral();
  let acoes = await store.listarAcoes(espacoId);
  let responsaveis = await store.listarResponsaveis(espacoId);
  /** retratos do espaço (passo 1.18), do mais recente ao mais antigo */
  let retratos = await store.listarRetratos(espacoId).catch(() => []);
  /* entregas do Plano de Ação (passo 2.6), para a coluna da exportação */
  const entregas = tipoDe(espaco) === "planoDeAcao" ? await store.listarEntregas(espacoId).catch(() => []) : [];
  /** responsáveis do espaço (seção 4.5): a mesma tela de antes, agora numa seção deste painel */
  const telaResponsaveis = criarTelaResponsaveis({ store });
  const meus = () => (store.usuario ? responsaveis.filter((r) => r.usuario === store.usuario).map((r) => r.id) : null);
  const desenharResponsaveis = () => {
    const alvo = corpo.querySelector("[data-responsaveis]");
    if (alvo) telaResponsaveis.desenhar(alvo, { espaco, acoes, responsaveis, meus: meus(), podeEditar: store.podeGravar && store.permissoesEm(espaco).configurar });
    const n = corpo.querySelector('[data-secao="responsaveis"] > summary .n');
    if (n) n.textContent = String(responsaveis.length);
  };
  const novoId = (prefixo) => `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  /** Rascunhos das listas, editados na tela até o Salvar da seção. */
  const rascunho = {
    datas: structuredClone(espaco.datasExcluidas ?? []),
    estrutura: structuredClone(espaco.estrutura ?? []),
    documentos: structuredClone(espaco.documentos ?? []),
  };

  /* enquanto o painel está aberto, mudanças nos responsáveis (de quem quer que seja) aparecem na seção;
     as demais seções não são redesenhadas, para não perder o que está sendo digitado */
  let pararDeAcompanhar = () => {};
  const corpo = abrirPainel("Configurar este espaço", "", { aoFechar: () => pararDeAcompanhar() });
  ligarSecoesSuaves(corpo);
  /** Seções abertas; os dados do espaço começam abertos. Mantidas quando o painel é redesenhado. */
  const abertas = new Set(["dados"]);
  const aberta = (secao) => (abertas.has(secao) ? " open" : "");
  corpo.addEventListener("toggle", (e) => {
    const secao = e.target.dataset?.secao ?? e.target.dataset?.sub;
    if (secao) e.target.open ? abertas.add(secao) : abertas.delete(secao);
  }, true);

  async function recarregar() {
    espaco = await store.lerEspaco(espacoId);
    geral = await store.lerCalendarioGeral();
    acoes = await store.listarAcoes(espacoId);
    responsaveis = await store.listarResponsaveis(espacoId);
  }

  /* ---------- desenho ---------- */
  function marcar() {
    marcarPendencias(corpo.querySelector('[data-salvar="datas"]'), rascunho.datas, espaco.datasExcluidas, ["data", "motivo"]);
    marcarPendencias(corpo.querySelector('[data-salvar="documentos"]'), rascunho.documentos, espaco.documentos, ["nome", "data", "identificacao", "link"]);
  }

  function desenhar() {
    desenharSecoes();
    const dados = corpo.querySelector('[data-salvar="dados"]');
    if (dados) ligarTipo(dados, { store, espaco }); // Programa e aprovação aparecem só no Plano de Ação (só o administrador vê a seção)
    desenharResponsaveis();
    marcar();
  }

  function desenharSecoes() {
    const campos = espaco.camposOpcionais ?? {};
    /* papéis (passo 2.1): só o administrador configura; os demais veem responsáveis, retratos e exportação */
    const perm = store.permissoesEm(espaco);
    const adm = perm.configurar && store.podeGravar;
    corpo.innerHTML = `
      ${acessoHtml(perm)}
      ${adm ? `
      <details class="config" data-secao="dados"${aberta("dados")}>
        <summary><h3>Dados do espaço</h3></summary>
        <form class="editor" data-salvar="dados">
          <label class="campo"><span>Nome</span><input name="nome" maxlength="120" value="${esc(espaco.nome)}"></label>
          ${tipoHtml(espaco)}
          ${resumoDoModelo(espaco)}
          <div class="campos-lado-a-lado">
            <label class="campo"><span>Início</span><input name="inicio" type="date" value="${esc(espaco.inicio ?? "")}"></label>
            <label class="campo"><span>Prazo final <small>(opcional)</small></span><input name="prazoFinal" type="date" value="${esc(espaco.prazoFinal ?? "")}"></label>
          </div>
          <p class="erro" data-erro hidden></p>
          <div class="botoes"><button class="botao principal" type="submit">Salvar</button></div>
        </form>
      </details>

      <details class="config" data-secao="datas"${aberta("datas")}>
        <summary><h3>Datas excluídas</h3><span class="n">${datasEfetivas(espaco, geral).length}</span></summary>
        <p class="tec">Dias sem expediente, que não contam como dias úteis. Valem as datas do calendário geral, cuidado em
          "Configurar o sistema", mais as deste espaço, como feriados locais.</p>
        <h4>Do calendário geral</h4>
        ${geraisHtml()}
        <h4>Deste espaço</h4>
        <form class="editor" data-salvar="datas">
          <div class="linhas-config">${rascunho.datas.map((d, i) => `<div class="linha-config" data-linha-lista="${i}">
            <input type="date" data-lista="datas" data-indice="${i}" data-campo="data" value="${esc(d.data ?? "")}" aria-label="Data">
            <input data-lista="datas" data-indice="${i}" data-campo="motivo" value="${esc(d.motivo ?? "")}" placeholder="Motivo (opcional)" aria-label="Motivo">
            <button type="button" class="tirar" data-tirar="datas" data-indice="${i}" aria-label="Retirar a data">${ICONES.fechar}</button>
          </div>`).join("") || `<p class="vazio">Nenhuma data própria.</p>`}</div>
          <p class="erro" data-erro hidden></p>
          <div class="botoes"><button class="botao" type="button" data-acrescentar="datas">${ICONES.mais}Data</button><button class="botao principal" type="submit">Salvar</button>${AVISO_PENDENTE}</div>
        </form>
      </details>` : ""}

      <details class="config" data-secao="responsaveis"${aberta("responsaveis")}>
        <summary><h3>Responsáveis</h3><span class="n">${responsaveis.length}</span></summary>
        <div class="responsaveis-do-espaco" data-responsaveis></div>
        ${adm ? `<details class="importar-responsaveis" data-sub="importar-responsaveis"${abertas.has("importar-responsaveis") ? " open" : ""}>
          <summary>Importar responsáveis de planilha</summary>
          <p class="tec">Cole as linhas com a linha de títulos: Nome (obrigatório), Tipo, Sigla, Setor e E-mail. Com e-mail, é uma pessoa e
            ganha a conta de acesso: o sistema manda a ela um e-mail para definir a própria senha. Sem e-mail, informe o tipo (pessoa ou unidade).
            ${criarConta ? "" : "<b>Neste espaço, as contas de acesso não são criadas</b> (o exemplo fica só no navegador)."}</p>
          <textarea class="texto-exportado" data-responsaveis-texto rows="5" aria-label="Linhas coladas da planilha"></textarea>
          <div class="botoes"><button class="botao" type="button" data-conferir-responsaveis>Conferir</button></div>
          <div data-previa-responsaveis></div>
        </details>` : ""}
      </details>

      ${adm ? `${ligado(campos, "fasesEtapas") ? estruturaHtml() : ""}
      ${situacoesHtml()}
      ${ligado(campos, "etiquetas") ? etiquetasHtml() : ""}

      <details class="config" data-secao="campos"${aberta("campos")}>
        <summary><h3>Campos opcionais</h3></summary>
        <p class="tec">Desligar um campo o esconde da tela; o que já foi preenchido é mantido.</p>
        ${CAMPOS_OPCIONAIS.map(([chave, titulo, dica]) => `<label class="alternar-campo">
          <input type="checkbox" data-campo-opcional="${chave}"${ligado(campos, chave) ? " checked" : ""}>
          <span><b>${titulo}</b><small>${dica}</small></span></label>`).join("")}
      </details>

      <details class="config" data-secao="documentos"${aberta("documentos")}>
        <summary><h3>Documentos do espaço</h3><span class="n">${rascunho.documentos.length}</span></summary>
        <p class="tec">Por exemplo, o plano aprovado e as revisões, com a identificação no SIPAC/Protocolo e o link.</p>
        <form class="editor" data-salvar="documentos">
          <div class="linhas-config">${rascunho.documentos.map((doc, i) => `<div class="documento-config" data-linha-lista="${i}">
            <input data-lista="documentos" data-indice="${i}" data-campo="nome" value="${esc(doc.nome ?? "")}" placeholder="Nome do documento" aria-label="Nome do documento">
            <div class="campos-lado-a-lado">
              <input type="date" data-lista="documentos" data-indice="${i}" data-campo="data" value="${esc(doc.data ?? "")}" aria-label="Data do documento">
              <input data-lista="documentos" data-indice="${i}" data-campo="identificacao" value="${esc(doc.identificacao ?? "")}" placeholder="Nº no SIPAC/Protocolo" aria-label="Identificação no SIPAC/Protocolo">
            </div>
            <div class="linha-config">
              <input type="url" data-lista="documentos" data-indice="${i}" data-campo="link" value="${esc(doc.link ?? "")}" placeholder="https://…" aria-label="Link">
              ${doc.link && /^https?:\/\//i.test(doc.link) ? `<a href="${esc(doc.link)}" target="_blank" rel="noopener noreferrer" class="botao discreto">Abrir</a>` : ""}
              <button type="button" class="tirar" data-tirar="documentos" data-indice="${i}" aria-label="Retirar o documento">${ICONES.fechar}</button>
            </div>
          </div>`).join("") || `<p class="vazio">Nenhum documento.</p>`}</div>
          <p class="erro" data-erro hidden></p>
          <div class="botoes"><button class="botao" type="button" data-acrescentar="documentos">${ICONES.mais}Documento</button><button class="botao principal" type="submit">Salvar</button>${AVISO_PENDENTE}</div>
        </form>
      </details>` : ""}

      ${usaSimulacao(espaco) ? `<details class="config" data-secao="simulacao"${aberta("simulacao")}>
        <summary><h3>Simulação</h3></summary>
        <dl class="numeros">
          <div><dt>Semente</dt><dd>${espaco.semente}</dd></div>
          <div><dt>Cenários simulados</dt><dd>${espaco.simulacoes.toLocaleString("pt-BR")}</dd></div>
          <div><dt>Versão do cálculo</dt><dd>${VERSAO_CALCULO}</dd></div>
        </dl>
        <p class="tec">Fixos desde a criação do espaço, para que qualquer pessoa obtenha os mesmos resultados ao refazer o cálculo.</p>
      </details>` : ""}

      <details class="config" data-secao="retratos"${aberta("retratos")}>
        <summary><h3>Retratos</h3><span class="n">${retratos.length}</span></summary>
        <p class="tec">Um retrato guarda o espaço como está agora, com as datas calculadas, para comparar depois com o andamento real.
          Por exemplo: "Plano aprovado", ou uma revisão do plano. Depois de salvo, ninguém altera.</p>
        ${store.podeGravar && perm.salvarRetrato ? `<div class="linha-config">
          <input data-nome-retrato maxlength="120" placeholder="Nome do retrato, como “Plano aprovado”" aria-label="Nome do retrato">
          <button class="botao principal" type="button" data-salvar-retrato>Salvar retrato</button>
        </div>` : ""}
        <div data-lista-retratos>${retratosHtml()}</div>
      </details>

      ${adm ? `<details class="config" data-secao="importar"${aberta("importar")}>
        <summary><h3>Importar ações de planilha</h3></summary>
        <p class="tec">Selecione as linhas no Google Planilhas ou no Excel, incluindo a linha de títulos, copie e cole abaixo.
          Colunas reconhecidas: Ação (obrigatória), Número, Código, Fase, Etapa, Descrição, Depende de, Otimista, Mais provável,
          Pessimista e Responsáveis. É o mesmo formato de "Copiar para planilha"; as demais colunas são ignoradas.</p>
        <textarea class="texto-exportado" data-importar-texto rows="6" aria-label="Linhas coladas da planilha"></textarea>
        <div class="opcoes-importar" role="radiogroup" aria-label="Ações que já existem">
          <label><input type="radio" name="modo-importar" value="criar" checked> Só criar ações novas</label>
          <label><input type="radio" name="modo-importar" value="atualizar"> Também atualizar as que já existem</label>
        </div>
        <p class="tec">Uma ação já existe quando tem o mesmo número, o mesmo código ou o mesmo nome. Ao atualizar, célula vazia não muda nada.</p>
        <div class="botoes"><button class="botao" type="button" data-conferir-importacao>Conferir</button></div>
        <div data-previa-importacao></div>
      </details>` : ""}

      <details class="config" data-secao="exportar"${aberta("exportar")}>
        <summary><h3>Exportar</h3></summary>
        <p class="tec">Copia as ações deste espaço, com as datas previstas, a folga e a situação, prontas para colar no Google Planilhas ou no Excel.</p>
        <div class="botoes"><button class="botao" type="button" data-exportar="planilha">Copiar para planilha</button></div>
        <p class="tec">Copia o fluxograma das ações em linguagem Mermaid, com as fases e etapas como grupos e as ações sem folga destacadas. Cole em mermaid.live para ver o desenho.</p>
        <div class="botoes"><button class="botao" type="button" data-exportar="mermaid">Copiar fluxograma</button></div>
        <textarea class="texto-exportado" data-exportado rows="6" readonly hidden aria-label="Texto exportado"></textarea>
      </details>

      <p class="tec">A cópia de segurança de todos os espaços, e a restauração dela, ficam em "Configurar o sistema".</p>
      ${adm ? `<div class="zona-encerrar">
        ${encerrando?.faltas?.length ? `<div class="aviso-confirmar"><p><b>Antes de encerrar, complete o registro das entregas</b> (na visualização Entregas):</p>
          <ul class="pendencias-encerrar">${encerrando.faltas.map((f) => `<li>${esc(f.mensagem)}</li>`).join("")}</ul>
          <div class="botoes"><button class="botao" type="button" data-cancelar-encerrar>Entendi</button></div></div>`
        : encerrando ? `<div class="aviso-confirmar"><p>Encerrar o espaço? Ele fica só para consulta, para todos, sai da lista principal (vai para "Encerrados", no fim da barra lateral) e continua acessível. Um administrador pode reabri-lo depois.</p>
          <div class="botoes"><button class="botao principal" type="button" data-confirmar-encerrar>Encerrar</button><button class="botao" type="button" data-cancelar-encerrar>Cancelar</button></div></div>`
        : `<button class="botao" type="button" data-encerrar>Encerrar este espaço</button>
          <p class="tec">Quando o plano termina: fica só para consulta e sai da lista principal. Diferente de excluir.</p>`}
      </div>
      <div class="zona-exclusao"><button class="botao-excluir" type="button" data-excluir-espaco>Excluir este espaço</button></div>` : ""}`;
  }

  /**
   * Acesso ao espaço (passo 2.1; seção 16.3), no alto da configuração:
   * - espaço sem administração: o convite para assumir;
   * - administrador: os papéis, espaço aberto ou fechado e os e-mails com papel sem cadastro de responsável
   *   (como o de quem criou o espaço); o papel de cada pessoa se escolhe na lista de responsáveis;
   * - os demais: o próprio papel e o aviso de que só o administrador configura.
   */
  function acessoHtml(perm) {
    if (perm.encerrado) {
      return `<div class="aviso-papel encerrado">${ICONES.concluida}<span><b>Espaço encerrado</b> em ${dataBr(espaco.encerradoEm.slice(0, 10))}${espaco.encerradoPor ? ` por ${esc(espaco.encerradoPor)}` : ""}.
        Fica só para consulta, inclusive a configuração. ${perm.reabrir ? "Para mudar algo, reabra." : "Só o administrador do espaço o reabre."}</span>
        ${perm.reabrir && store.podeGravar ? `<button class="botao principal" type="button" data-reabrir>Reabrir o espaço</button>` : ""}</div>`;
    }
    if (!store.podeGravar) return "";
    if (perm.livre) {
      return `<div class="aviso-papel">${ICONES.pessoa}<span><b>Este espaço ainda não tem administrador.</b> Enquanto isso, quem entra altera tudo.
        Quem assumir vira administrador; as pessoas com e-mail entre os responsáveis viram usuárias.</span>
        <button class="botao principal" type="button" data-assumir>Assumir a administração</button></div>`;
    }
    if (!perm.configurar) {
      return `<p class="aviso-papel">${ICONES.pessoa}<span>Seu papel neste espaço: <b>${esc(nomeDoPapel(perm.papel))}</b>. Só o administrador do espaço muda a configuração;
        aqui você consulta os responsáveis${perm.salvarRetrato ? ", salva retratos" : ""} e exporta.</span></p>`;
    }
    if (semAdministracao(espaco)) return ""; // o exemplo, sem login
    const ligados = new Set(responsaveis.filter((r) => r.usuario).map((r) => r.usuario));
    const soltos = Object.entries(espaco.acessos).filter(([email]) => !ligados.has(email));
    const opcoesPapel = (atual) => PAPEIS.map(([v, nome]) => `<option value="${v}"${v === atual ? " selected" : ""}>${nome}</option>`).join("");
    return `<details class="config" data-secao="acesso"${aberta("acesso")}>
      <summary><h3>Acesso ao espaço</h3></summary>
      <ul class="papeis-explicados">${PAPEIS.map(([, nome, oQue]) => `<li><b>${nome}:</b> ${oQue}</li>`).join("")}</ul>
      <p class="tec">O papel de cada pessoa se escolhe na lista de responsáveis, abaixo: cada pessoa com e-mail de login tem um. Quem não tem papel só consulta, se a visibilidade deixar.</p>
      <h4>Quem consulta</h4>
      <div class="opcoes-importar" role="radiogroup" aria-label="Visibilidade do espaço">
        ${VISIBILIDADES.map(([v, nome, quem]) => `<label><input type="radio" name="visibilidade" value="${v}"${visibilidadeDe(espaco) === v ? " checked" : ""}> <span><b>${nome}:</b> ${quem}</span></label>`).join("")}
      </div>
      <p class="tec">Os espaços públicos e institucionais aparecem para os demais em "Espaços abertos à consulta", e não na barra lateral deles.</p>
      <h4>Quem atualiza as ações</h4>
      <div class="opcoes-importar" role="radiogroup" aria-label="Quem atualiza as ações">
        <label><input type="radio" name="aberto-fechado" value="aberto"${fechado(espaco) ? "" : " checked"}> <span><b>Aberto:</b> todo Usuário atualiza todas as ações.</span></label>
        <label><input type="radio" name="aberto-fechado" value="fechado"${fechado(espaco) ? " checked" : ""}> <span><b>Fechado:</b> cada Usuário atualiza só as ações em que é responsável.</span></label>
      </div>
      ${soltos.length ? `<h4>Com papel, sem cadastro de responsável</h4>
        <ul class="acessos-soltos">${soltos.map(([email, a]) => `<li><span class="mono">${esc(email)}</span>
          <select data-papel-email="${esc(email)}" aria-label="Papel de ${esc(email)}">${opcoesPapel(a.papel)}</select>
          <button type="button" class="tirar" data-tirar-acesso="${esc(email)}" aria-label="Tirar o acesso de ${esc(email)}">${ICONES.fechar}</button></li>`).join("")}</ul>
        <p class="tec">Por exemplo, quem criou o espaço. Para aparecer nas ações, cadastre a pessoa como responsável com o mesmo e-mail.</p>` : ""}
      ${espaco.nomeacoes?.length ? `<h4>Nomeações pelo Administrador do Sistema</h4>
        <ul class="papeis-explicados">${espaco.nomeacoes.map((n) => `<li>${esc(n.email)}, nomeado por ${esc(n.por)} em ${dataBr(n.em.slice(0, 10))}</li>`).join("")}</ul>` : ""}
    </details>`;
  }
  /** confirmação de "Encerrar este espaço" aberta (passo 2.3) */
  let encerrando = false;
  /** Grava uma mudança de acesso e redesenha; na recusa (como tirar o último administrador), avisa. */
  async function gravarAcesso(operacao, mensagem) {
    try {
      await operacao();
      await recarregar();
      desenhar();
      if (mensagem) avisar(mensagem);
    } catch (falha) {
      avisar(falha.message);
      desenhar();
    }
  }

  /* ---------- importar responsáveis, com as contas de acesso (passos 1.14d e 1.19b) ---------- */
  let planoResp = null;
  function conferirResponsaveis() {
    planoResp = planejarResponsaveis({ texto: corpo.querySelector("[data-responsaveis-texto]").value, responsaveis });
    corpo.querySelector("[data-previa-responsaveis]").innerHTML = previaResponsaveisHtml();
  }
  function previaResponsaveisHtml() {
    if (planoResp.erro) return `<p class="erro">${esc(planoResp.erro)}</p>`;
    const conta = (t) => planoResp.linhas.filter((l) => l.tipo === t).length;
    const contas = planoResp.linhas.filter((l) => l.conta && l.tipo !== "erro").length;
    const oQue = (l) => l.tipo === "novo" ? `Novo: ${l.dados.tipo}${l.conta && criarConta ? ", com conta de acesso" : ""}`
      : l.tipo === "liga" ? "Liga o e-mail" : l.tipo === "erro" ? `Fica de fora: ${esc(l.erro)}` : "Fica como está";
    const ok = conta("novo") + conta("liga") + (criarConta ? contas : 0);
    return `<div class="previa-importacao">
      <p><b>${conta("novo")} ${plural(conta("novo"), "responsável novo", "responsáveis novos")}</b>${criarConta ? ` e <b>${contas} ${plural(contas, "conta de acesso", "contas de acesso")}</b> a criar ou conferir` : ""}.
        ${planoResp.ignoradas.length ? `<span class="tec">Colunas ignoradas: ${planoResp.ignoradas.map(esc).join(", ")}.</span>` : ""}</p>
      <ul>${planoResp.linhas.map((l) => `<li class="${l.tipo === "novo" ? "nova" : l.tipo === "liga" ? "atualiza" : l.tipo}">
        <span class="tec">Linha ${l.linha}</span> <b>${esc(l.nome || "(sem nome)")}</b><span>${oQue(l)}</span>
        ${l.avisos.map((a) => `<span class="aviso-linha">${esc(a)}</span>`).join("")}</li>`).join("")}</ul>
      <div class="botoes"><button class="botao principal" type="button" data-importar-responsaveis${ok ? "" : " disabled"}>Importar</button></div>
    </div>`;
  }
  async function importarResponsaveis(botao) {
    botao.disabled = true;
    try {
      const r = await store.importarResponsaveis(espacoId, planoResp, { criarConta });
      planoResp = null;
      responsaveis = await store.listarResponsaveis(espacoId);
      desenharResponsaveis();
      corpo.querySelector("[data-responsaveis-texto]").value = "";
      corpo.querySelector("[data-previa-responsaveis]").innerHTML = r.falhas.length
        ? `<p class="erro">Algumas linhas não foram gravadas:</p><ul class="falhas-importacao">${r.falhas.map((f) => `<li>Linha ${f.linha}: ${esc(f.mensagem)}</li>`).join("")}</ul>` : "";
      avisar([`${r.criados} ${plural(r.criados, "responsável cadastrado", "responsáveis cadastrados")}`,
        r.ligados ? `${r.ligados} ${plural(r.ligados, "e-mail ligado", "e-mails ligados")}` : "",
        r.contasCriadas ? `${r.contasCriadas} ${plural(r.contasCriadas, "conta criada (a pessoa recebe um e-mail para definir a senha)", "contas criadas (cada pessoa recebe um e-mail para definir a senha)")}` : "",
        r.contasExistentes ? `${r.contasExistentes} ${plural(r.contasExistentes, "conta já existia", "contas já existiam")}` : ""].filter(Boolean).join("; ") + ".");
    } catch (falha) {
      botao.disabled = false;
      avisar(falha.message);
    }
  }

  /* ---------- importar de planilha (passo 1.19b) ---------- */
  let plano = null;
  const NOMES_DOS_CAMPOS = { rotulo: "nome", codigo: "código", descricao: "descrição", etapa: "etapa", naoAntesDe: "“não começa antes de”",
    responsaveis: "responsáveis", estimativa: "estimativa", dependeDe: "dependências", etiquetas: "etiquetas", justificativa: "justificativa", local: "local", dataLimite: "data-limite" };
  function conferirImportacao() {
    const texto = corpo.querySelector("[data-importar-texto]").value;
    const modo = corpo.querySelector('[name="modo-importar"]:checked').value;
    const hoje = hojeLocal();
    const cal = criarCalendario({ ...espaco, datasExcluidas: datasEfetivas(espaco, geral) }, hoje);
    const caminho = caminhoCritico(acoes, cal, { hoje, ...opcoesDoCalculo(espaco) });
    plano = planejarImportacao({ texto, espaco, acoes, responsaveis, hoje, modo, situacaoDe: (n) => caminho.porAcao.get(n).situacao });
    corpo.querySelector("[data-previa-importacao]").innerHTML = previaHtml();
  }
  function previaHtml() {
    if (!plano) return "";
    if (plano.erro) return `<p class="erro">${esc(plano.erro)}</p>`;
    const conta = (t) => plano.linhas.filter((l) => l.tipo === t).length;
    const [novas, atualiza] = [conta("nova"), conta("atualiza")];
    const oQue = (l) => l.tipo === "nova" ? "Nova ação"
      : l.tipo === "atualiza" ? `Atualiza: ${Object.keys(l.campos).map((c) => NOMES_DOS_CAMPOS[c] ?? c).join(", ")}`
      : l.tipo === "erro" ? `Fica de fora: ${esc(l.erro)}` : "Fica como está";
    return `<div class="previa-importacao">
      <p><b>${novas} ${plural(novas, "ação nova", "ações novas")}</b> e <b>${atualiza} ${plural(atualiza, "atualização", "atualizações")}</b>.
        ${plano.etapasNovas.length ? `Etapas novas, criadas na importação: ${plano.etapasNovas.map((e) => esc(`${e.fase} · ${e.etapa}`)).join("; ")}.` : ""}
        ${plano.etiquetasNovas?.length ? `Etiquetas novas, criadas na importação: ${plano.etiquetasNovas.map((n) => `“${esc(n)}”`).join("; ")}.` : ""}
        ${plano.ignoradas.length ? `<span class="tec">Colunas ignoradas: ${plano.ignoradas.map(esc).join(", ")}.</span>` : ""}</p>
      <ul>${plano.linhas.map((l) => `<li class="${l.tipo}">
        <span class="tec">Linha ${l.linha}</span> <b>${esc(l.rotulo || "(sem nome)")}</b>
        <span>${oQue(l)}</span>
        ${l.avisos.filter((a) => a !== "Sem mudança.").map((a) => `<span class="aviso-linha">${esc(a)}</span>`).join("")}
      </li>`).join("")}</ul>
      <div class="botoes"><button class="botao principal" type="button" data-importar${novas + atualiza ? "" : " disabled"}>Importar</button></div>
    </div>`;
  }
  async function importar(botao) {
    botao.disabled = true;
    try {
      const r = await store.importarAcoes(espacoId, plano);
      await recarregar();
      plano = null;
      rascunho.estrutura = structuredClone(espaco.estrutura ?? []); // a importação pode ter criado etapas
      desenhar();
      corpo.querySelector("[data-previa-importacao]").innerHTML = r.falhas.length
        ? `<p class="erro">Algumas linhas não foram gravadas:</p><ul class="falhas-importacao">${r.falhas.map((f) => `<li>Linha ${f.linha}: ${esc(f.mensagem)}</li>`).join("")}</ul>` : "";
      avisar(`Importação concluída: ${r.criadas} ${plural(r.criadas, "ação criada", "ações criadas")} e ${r.atualizadas} ${plural(r.atualizadas, "atualizada", "atualizadas")}.`);
    } catch (falha) {
      botao.disabled = false;
      avisar(falha.message);
    }
  }

  /** Lista dos retratos: nome, quando, quem e o resultado naquele momento. */
  function retratosHtml() {
    if (!retratos.length) return `<p class="vazio">Nenhum retrato salvo.</p>`;
    const quem = (email) => responsaveis.find((r) => r.usuario === email)?.nome ?? email ?? "Sem login";
    const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return `<ul class="retratos">${retratos.map((r) => `<li>
      <b>${esc(r.nome)}</b>
      <span class="tec">${esc(quando(r.criadoEm))} · ${esc(quem(r.criadoPor))}</span>
      <span>Conclusão prevista <span class="mono">${dataBr(r.resumo.conclusaoPrevista)}</span> · data segura <span class="mono">${dataBr(r.resumo.dataSegura)}</span>${r.resumo.chancePrazo == null ? "" : ` · ${Math.round(r.resumo.chancePrazo * 100)}% de chance de cumprir o prazo`}</span>
    </li>`).join("")}</ul>`;
  }

  /** Datas do calendário geral a partir do início do espaço, cada uma com a opção de desconsiderar. */
  function geraisHtml() {
    const desde = espaco.inicio ?? "";
    const lista = geral.datasExcluidas.filter((d) => d.data >= desde);
    if (!lista.length) {
      return `<p class="vazio">${geral.datasExcluidas.length ? "Nenhuma data geral a partir do início do espaço." : "O calendário geral ainda não tem datas."}</p>`;
    }
    const fora = new Set(espaco.datasGeraisDesconsideradas ?? []);
    return `<div class="gerais-config">${lista.map((d) => `<label class="geral-config${fora.has(d.data) ? " desconsiderada" : ""}">
      <span class="mono">${dataBr(d.data)}</span><span>${esc(d.motivo ?? "")}</span>
      <span class="desconsiderar"><input type="checkbox" data-desconsiderar="${esc(d.data)}"${fora.has(d.data) ? " checked" : ""}> desconsiderar</span>
    </label>`).join("")}</div>
    <p class="tec">Marque "desconsiderar" nas datas em que este espaço trabalha, como um ponto facultativo.</p>`;
  }

  /**
   * Situações (passo 2.7; seção 16.2): as fixas e as personalizadas, que viram colunas do quadro.
   * Cada mudança grava na hora: renomear (ao sair do campo), subir, descer, retirar (com aviso se
   * houver ações nela) e acrescentar (Enter). Sem dependências, o nome da inicial é editável.
   */
  let retirandoSituacao = null;
  function situacoesHtml() {
    const lista = personalizadasDe(espaco);
    const pode = store.podeGravar;
    const nelas = (id) => acoes.filter((a) => a.situacaoPersonalizada === id && !a.concluidaEm).length;
    const fixa = (icone, nome, dica) => `<li class="situacao-fixa"><span class="situacao-icone">${ICONES[icone]}</span><span>${nome}</span><small class="tec">${dica}</small></li>`;
    return `<details class="config" data-secao="situacoes"${aberta("situacoes")}>
      <summary><h3>Situações</h3><span class="n">${lista.length}</span></summary>
      <p class="tec">As situações personalizadas, como “Em andamento” e “Em teste”, ficam entre ${esc(nomeInicial(espaco))} e Concluída e viram colunas do quadro, nesta ordem.</p>
      <ol class="lista-situacoes">
        ${usaDependencias(espaco) ? fixa("naoLiberada", "Não liberada", "calculada: espera as anteriores ou a data mínima") : ""}
        ${usaDependencias(espaco) || !pode ? fixa("liberada", esc(nomeInicial(espaco)), "situação inicial")
          : `<li class="situacao-fixa"><span class="situacao-icone">${ICONES.liberada}</span>
              <input data-nome-inicial maxlength="40" value="${esc(nomeInicial(espaco))}" aria-label="Nome da situação inicial" placeholder="${NOME_INICIAL_PADRAO}">
              <small class="tec">situação inicial; o nome pode mudar</small></li>`}
        ${lista.map((x, i) => `<li class="situacao-personalizada">
          <span class="situacao-icone">${ICONES.personalizada}</span>
          ${pode ? `<input data-nome-situacao="${esc(x.id)}" maxlength="40" value="${esc(x.nome)}" aria-label="Nome da situação">` : `<span>${esc(x.nome)}</span>`}
          ${pode ? `<span class="botoes-situacao">
            <button type="button" class="tirar" data-mover-situacao="${i}" data-sentido="-1" aria-label="Subir"${i === 0 ? " disabled" : ""}>↑</button>
            <button type="button" class="tirar" data-mover-situacao="${i}" data-sentido="1" aria-label="Descer"${i === lista.length - 1 ? " disabled" : ""}>↓</button>
            <button type="button" class="tirar" data-retirar-situacao="${esc(x.id)}" aria-label="Retirar ${esc(x.nome)}">${ICONES.fechar}</button></span>` : ""}
          ${retirandoSituacao === x.id ? `<div class="aviso-confirmar">
            <p>${nelas(x.id) ? `${nelas(x.id)} ${plural(nelas(x.id), "ação volta", "ações voltam")} para ${esc(nomeInicial(espaco))}.` : "Nenhuma ação está nela."} Retirar “${esc(x.nome)}”?</p>
            <div class="botoes"><button type="button" class="botao principal" data-confirmar-retirar-situacao="${esc(x.id)}">Retirar</button>
              <button type="button" class="botao" data-cancelar-retirar-situacao>Cancelar</button></div></div>` : ""}
        </li>`).join("")}
        ${fixa("concluida", "Concluída", "obrigatória")}
      </ol>
      ${pode ? `<input class="nova-situacao" data-nova-situacao maxlength="40" placeholder="Nova situação: escreva e tecle Enter" aria-label="Nova situação">` : ""}
    </details>`;
  }
  /**
   * Etiquetas (passo 2.10a; seção 4.1.9): catálogo do espaço, com o campo opcional ligado. Cada mudança
   * grava na hora: nome (ao sair do campo), cor (ao escolher), retirar (com aviso se houver ações com
   * ela) e acrescentar (Enter).
   */
  let retirandoEtiqueta = null;
  function etiquetasHtml() {
    const lista = etiquetasDe(espaco);
    const pode = store.podeGravar;
    const com = (id) => acoes.filter((a) => (a.etiquetas ?? []).includes(id)).length;
    const amostra = (cor) => `<span class="amostra-etiqueta" style="--etq:var(--tom-${tomDaCor(cor)});--etq-texto:var(--tom-${tomDaCor(cor)}-texto)" aria-hidden="true"></span>`;
    return `<details class="config" data-secao="etiquetas"${aberta("etiquetas")}>
      <summary><h3>Etiquetas</h3><span class="n">${lista.length}</span></summary>
      <p class="tec">Marcas coloridas para agrupar e filtrar as ações. Também podem ser criadas na própria ação.</p>
      <ul class="lista-etiquetas">${lista.map((x) => `<li>
        ${amostra(x.cor)}
        ${pode ? `<input data-nome-etiqueta="${esc(x.id)}" maxlength="${TAMANHO_DO_NOME}" value="${esc(x.nome)}" aria-label="Nome da etiqueta">
          <select data-cor-etiqueta="${esc(x.id)}" aria-label="Cor de ${esc(x.nome)}">${CORES_ETIQUETA.map(([cor, nome]) => `<option value="${cor}"${cor === x.cor ? " selected" : ""}>${nome}</option>`).join("")}</select>
          <button type="button" class="tirar" data-retirar-etiqueta="${esc(x.id)}" aria-label="Retirar ${esc(x.nome)}">${ICONES.fechar}</button>`
          : `<span>${esc(x.nome)}</span>`}
        ${retirandoEtiqueta === x.id ? `<div class="aviso-confirmar">
          <p>${com(x.id) ? `${com(x.id)} ${plural(com(x.id), "ação perde", "ações perdem")} esta etiqueta.` : "Nenhuma ação tem esta etiqueta."} Retirar “${esc(x.nome)}”?</p>
          <div class="botoes"><button type="button" class="botao principal" data-confirmar-retirar-etiqueta="${esc(x.id)}">Retirar</button>
            <button type="button" class="botao" data-cancelar-retirar-etiqueta>Cancelar</button></div></div>` : ""}
      </li>`).join("") || `<li class="vazio">Nenhuma etiqueta.</li>`}</ul>
      ${pode ? `<input class="nova-situacao" data-nova-etiqueta maxlength="${TAMANHO_DO_NOME}" placeholder="Nova etiqueta: escreva e tecle Enter" aria-label="Nova etiqueta">` : ""}
    </details>`;
  }
  /** Grava uma mudança das etiquetas e redesenha; na recusa, avisa e devolve false. */
  async function gravarEtiqueta(operacao, mensagem) {
    try {
      await operacao();
      await recarregar();
      desenhar();
      if (mensagem) avisar(mensagem);
      return true;
    } catch (falha) {
      avisar(falha.message);
      return false;
    }
  }

  async function gravarSituacoes(mudanca, mensagem) {
    try {
      await store.alterarEspaco(espacoId, mudanca);
      await recarregar();
      desenhar();
      if (mensagem) avisar(mensagem);
      return true;
    } catch (falha) {
      avisar(falha.message);
      return false;
    }
  }

  function estruturaHtml() {
    const usos = new Map();
    for (const a of acoes) if (a.etapa) usos.set(a.etapa, (usos.get(a.etapa) ?? 0) + 1);
    const botaoMover = (lista, i, total, sentido, extra = "") => `<button type="button" class="tirar" data-mover="${lista}" data-indice="${i}"${extra} data-sentido="${sentido}"
      aria-label="${sentido < 0 ? "Subir" : "Descer"}"${(sentido < 0 && i === 0) || (sentido > 0 && i === total - 1) ? " disabled" : ""}>${sentido < 0 ? "↑" : "↓"}</button>`;
    /* com ações, o × pergunta para onde elas vão e grava na hora (passo 1.15) */
    const botaoTirar = (n, atributos) => `<button type="button" class="tirar" ${atributos}${n ? ` data-com-acoes="${n}"` : ""} aria-label="Retirar">${ICONES.fechar}</button>`;
    return `<details class="config" data-secao="estrutura"${aberta("estrutura")}>
      <summary><h3>Fases e etapas</h3><span class="n">${rascunho.estrutura.length}</span></summary>
      <p class="tec">As fases agrupam etapas, e as etapas agrupam ações, na ordem desta lista.</p>
      <form class="editor" data-salvar="estrutura">
        ${rascunho.estrutura.map((f, i) => {
          const nFase = f.etapas.reduce((n, e) => n + (usos.get(e.id) ?? 0), 0);
          return `<div class="fase-config">
            <div class="linha-config">
              <input data-fase="${i}" value="${esc(f.nome)}" placeholder="Nome da fase" aria-label="Nome da fase">
              ${botaoMover("fases", i, rascunho.estrutura.length, -1)}${botaoMover("fases", i, rascunho.estrutura.length, 1)}
              ${botaoTirar(nFase, `data-tirar-fase="${i}"`)}
            </div>
            <div class="etapas-config">${f.etapas.map((e, j) => `<div class="linha-config">
              <input data-fase="${i}" data-etapa="${j}" value="${esc(e.nome)}" placeholder="Nome da etapa" aria-label="Nome da etapa">
              ${botaoMover("etapas", j, f.etapas.length, -1, ` data-fase-da-etapa="${i}"`)}${botaoMover("etapas", j, f.etapas.length, 1, ` data-fase-da-etapa="${i}"`)}
              ${botaoTirar(usos.get(e.id) ?? 0, `data-tirar-etapa="${j}" data-fase-da-etapa="${i}"`)}
            </div>`).join("")}
              <button type="button" class="botao discreto" data-acrescentar-etapa="${i}">${ICONES.mais}Etapa</button>
            </div>
          </div>`;
        }).join("") || `<p class="vazio">Nenhuma fase.</p>`}
        <p class="erro" data-erro hidden></p>
        <div class="botoes"><button class="botao" type="button" data-acrescentar="fase">${ICONES.mais}Fase</button><button class="botao principal" type="submit">Salvar</button></div>
      </form>
    </details>`;
  }

  /* ---------- gravação ---------- */
  async function salvar(form) {
    const secao = form.dataset.salvar;
    const erro = form.querySelector("[data-erro]");
    const limpo = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null));
    try {
      if (secao === "dados") {
        const f = Object.fromEntries(new FormData(form));
        await store.alterarEspaco(espacoId, { nome: f.nome, inicio: f.inicio || null, prazoFinal: f.prazoFinal || null, ...lerTipo(form) });
      } else if (secao === "datas") {
        const datas = rascunho.datas.map((d) => limpo({ data: d.data, motivo: d.motivo?.trim() })).sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
        await store.alterarEspaco(espacoId, { datasExcluidas: datas });
      } else if (secao === "estrutura") {
        await store.alterarEspaco(espacoId, { estrutura: rascunho.estrutura.map((f) => ({ ...f, nome: f.nome.trim(), etapas: f.etapas.map((e) => ({ ...e, nome: e.nome.trim() })) })) });
      } else if (secao === "documentos") {
        await store.alterarEspaco(espacoId, { documentos: rascunho.documentos.map((d) => limpo({ nome: d.nome?.trim(), data: d.data, identificacao: d.identificacao?.trim(), link: d.link?.trim() })) });
      }
      await recarregar();
      if (secao === "datas") rascunho.datas = structuredClone(espaco.datasExcluidas ?? []);
      if (secao === "documentos") rascunho.documentos = structuredClone(espaco.documentos ?? []);
      desenhar();
      avisar("Configuração salva.");
    } catch (e) {
      erro.textContent = e.message;
      erro.hidden = false;
    }
  }

  /* ---------- eventos ---------- */
  corpo.addEventListener("input", (e) => {
    const t = e.target;
    queueMicrotask(marcar);
    if (t.dataset.lista) rascunho[t.dataset.lista][Number(t.dataset.indice)][t.dataset.campo] = t.value;
    else if (t.dataset.etapa != null) rascunho.estrutura[Number(t.dataset.fase)].etapas[Number(t.dataset.etapa)].nome = t.value;
    else if (t.dataset.fase != null) rascunho.estrutura[Number(t.dataset.fase)].nome = t.value;
  });
  corpo.addEventListener("change", async (e) => {
    /* situações (passo 2.7): renomear grava ao sair do campo */
    if (e.target.dataset.nomeSituacao) {
      const id = e.target.dataset.nomeSituacao;
      const nome = e.target.value.trim();
      const lista = personalizadasDe(espaco).map((x) => (x.id === id ? { ...x, nome } : x));
      if (!(await gravarSituacoes({ situacoes: lista }, "Situação renomeada."))) e.target.value = personalizadasDe(espaco).find((x) => x.id === id)?.nome ?? "";
      return;
    }
    /* acesso ao espaço (passo 2.1) */
    if (e.target.name === "visibilidade") {
      const nome = VISIBILIDADES.find(([v]) => v === e.target.value)?.[1];
      await gravarAcesso(() => store.alterarEspaco(espacoId, { visibilidade: e.target.value }), `Visibilidade: ${nome}.`);
      return;
    }
    if (e.target.name === "aberto-fechado") {
      await gravarAcesso(() => store.alterarEspaco(espacoId, { fechado: e.target.value === "fechado" }),
        e.target.value === "fechado" ? "Espaço fechado: cada usuário atualiza só as suas ações." : "Espaço aberto: todo usuário atualiza todas as ações.");
      return;
    }
    if (e.target.dataset.papelEmail) {
      await gravarAcesso(() => store.definirPapel(espacoId, e.target.dataset.papelEmail, e.target.value), "Papel alterado.");
      return;
    }
    /* etiquetas (passo 2.10a): nome ao sair do campo; cor ao escolher */
    if (e.target.dataset.nomeEtiqueta) {
      const id = e.target.dataset.nomeEtiqueta;
      if (!(await gravarEtiqueta(() => store.alterarEtiqueta(espacoId, id, { nome: e.target.value }), "Etiqueta renomeada."))) {
        e.target.value = etiquetasDe(espaco).find((x) => x.id === id)?.nome ?? "";
      }
      return;
    }
    if (e.target.dataset.corEtiqueta) {
      await gravarEtiqueta(() => store.alterarEtiqueta(espacoId, e.target.dataset.corEtiqueta, { cor: e.target.value }));
      return;
    }
    if (e.target.matches("[data-nome-inicial]")) {
      const nome = e.target.value.trim();
      if (!(await gravarSituacoes({ nomeInicial: nome || NOME_INICIAL_PADRAO }, "Situação inicial renomeada."))) e.target.value = nomeInicial(espaco);
      return;
    }
    const data = e.target.dataset.desconsiderar;
    if (data) {
      const atuais = new Set(espaco.datasGeraisDesconsideradas ?? []);
      if (e.target.checked) atuais.add(data); else atuais.delete(data);
      try {
        await store.alterarEspaco(espacoId, { datasGeraisDesconsideradas: [...atuais].sort() });
        await recarregar();
        desenhar();
      } catch (falha) {
        avisar(falha.message);
      }
      return;
    }
    const chave = e.target.dataset.campoOpcional;
    if (!chave) return;
    try {
      await store.alterarEspaco(espacoId, { camposOpcionais: { ...(espaco.camposOpcionais ?? {}), [chave]: e.target.checked } });
      await recarregar();
      desenhar();
    } catch (falha) {
      avisar(falha.message);
    }
  });
  /** Fase ou etapa com ações: pergunta e grava na hora; o resto do rascunho continua como estava. */
  async function tirarComAcoes(t) {
    const fase = rascunho.estrutura[Number(t.dataset.tirarFase ?? t.dataset.faseDaEtapa)];
    const ehFase = t.dataset.tirarFase != null;
    const etapa = ehFase ? null : fase.etapas[Number(t.dataset.tirarEtapa)];
    const ids = ehFase ? [fase.id, ...fase.etapas.map((x) => x.id)] : [etapa.id];
    const fora = new Set(ids);
    const etapasQueFicam = (espaco.estrutura ?? []).filter((f) => !fora.has(f.id))
      .flatMap((f) => f.etapas.filter((x) => !fora.has(x.id)).map((x) => ({ ...x, fase: f.nome })));
    try {
      const excluiu = await excluirEtapas({
        store, espacoId, ids, nome: (ehFase ? fase : etapa).nome, ehFase, nAcoes: Number(t.dataset.comAcoes), etapasQueFicam,
      });
      if (!excluiu) return;
      await recarregar();
      rascunho.estrutura = rascunho.estrutura.filter((f) => !fora.has(f.id)).map((f) => ({ ...f, etapas: f.etapas.filter((x) => !fora.has(x.id)) }));
      desenhar();
    } catch (falha) {
      avisar(falha.message);
    }
  }

  corpo.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t || t.disabled) return;
    if (t.dataset.comAcoes) { tirarComAcoes(t); return; }
    /* situações (passo 2.7) */
    if (t.dataset.moverSituacao != null) {
      const lista = [...personalizadasDe(espaco)];
      const i = Number(t.dataset.moverSituacao);
      const j = i + Number(t.dataset.sentido);
      [lista[i], lista[j]] = [lista[j], lista[i]];
      await gravarSituacoes({ situacoes: lista });
      corpo.querySelector(`[data-mover-situacao="${j}"][data-sentido="${t.dataset.sentido}"]`)?.focus();
      return;
    }
    if (t.dataset.retirarSituacao) { retirandoSituacao = t.dataset.retirarSituacao; desenhar(); return; }
    if (t.dataset.cancelarRetirarSituacao != null) { retirandoSituacao = null; desenhar(); return; }
    if (t.dataset.confirmarRetirarSituacao) {
      retirandoSituacao = null;
      try {
        const n = await store.retirarSituacao(espacoId, t.dataset.confirmarRetirarSituacao);
        await recarregar();
        desenhar();
        avisar(n ? `Situação retirada. ${n} ${plural(n, "ação voltou", "ações voltaram")} para ${nomeInicial(espaco)}.` : "Situação retirada.");
      } catch (falha) { avisar(falha.message); }
      return;
    }
    /* acesso ao espaço (passo 2.1) */
    /* encerrar e reabrir (passo 2.3) */
    if (t.dataset.encerrar != null) {
      /* Plano de Ação (passo 2.6): mostra antes o que falta nas entregas */
      let faltas = [];
      if (tipoDe(espaco) === "planoDeAcao") {
        try { faltas = pendenciasParaEncerrar(await store.listarEntregas(espacoId), await store.listarAlcances(espacoId)); } catch (f) { avisar(f.message); return; }
      }
      encerrando = { faltas };
      desenhar();
      return;
    }
    if (t.dataset.cancelarEncerrar != null) { encerrando = false; desenhar(); return; }
    if (t.dataset.confirmarEncerrar != null) { encerrando = false; await gravarAcesso(() => store.encerrarEspaco(espacoId), "Espaço encerrado. Fica só para consulta."); return; }
    if (t.dataset.reabrir != null) { await gravarAcesso(() => store.reabrirEspaco(espacoId), "Espaço reaberto."); return; }
    if (t.dataset.assumir != null) { await gravarAcesso(() => store.assumirAdministracao(espacoId), "Você agora é administrador deste espaço."); return; }
    if (t.dataset.tirarAcesso) { await gravarAcesso(() => store.definirPapel(espacoId, t.dataset.tirarAcesso, null), "Acesso retirado."); return; }
    /* etiquetas (passo 2.10a) */
    if (t.dataset.retirarEtiqueta) { retirandoEtiqueta = t.dataset.retirarEtiqueta; desenhar(); return; }
    if (t.dataset.cancelarRetirarEtiqueta != null) { retirandoEtiqueta = null; desenhar(); return; }
    if (t.dataset.confirmarRetirarEtiqueta) {
      retirandoEtiqueta = null;
      let n = 0;
      await gravarEtiqueta(async () => { n = await store.retirarEtiqueta(espacoId, t.dataset.confirmarRetirarEtiqueta); });
      avisar(n ? `Etiqueta retirada de ${n} ${plural(n, "ação", "ações")} e do espaço.` : "Etiqueta retirada.");
      return;
    }
    if (t.dataset.salvarRetrato != null) {
      const campo = corpo.querySelector("[data-nome-retrato]");
      t.disabled = true;
      try {
        await store.salvarRetrato(espacoId, campo.value);
        retratos = await store.listarRetratos(espacoId);
        campo.value = "";
        corpo.querySelector("[data-lista-retratos]").innerHTML = retratosHtml();
        corpo.querySelector('[data-secao="retratos"] > summary .n').textContent = String(retratos.length);
        avisar("Retrato salvo. Compare com ele no cronograma.");
      } catch (falha) {
        avisar(falha.message);
      } finally {
        t.disabled = false;
      }
      return;
    }
    if (t.dataset.conferirImportacao != null) { conferirImportacao(); return; }
    if (t.dataset.conferirResponsaveis != null) { conferirResponsaveis(); return; }
    if (t.dataset.importarResponsaveis != null) { importarResponsaveis(t); return; }
    if (t.dataset.importar != null) { importar(t); return; }
    if (t.dataset.exportar) {
      const dados = { espaco, acoes, responsaveis, geral, hoje: hojeLocal(), entregas };
      const planilha = t.dataset.exportar === "planilha";
      copiarTexto(planilha ? planilhaDoEspaco(dados) : mermaidDoEspaco(dados), corpo.querySelector("[data-exportado]"),
        planilha ? "Copiado. Cole na primeira célula de uma planilha vazia." : "Fluxograma copiado.");
      return;
    }
    if (t.dataset.excluirEspaco != null) {
      try {
        if (await excluirEspaco({ store, espaco })) { fecharPainel(); aoExcluirEspaco(); }
      } catch (falha) { avisar(falha.message); }
      return;
    }
    const i = Number(t.dataset.indice);
    if (t.dataset.acrescentar === "datas") rascunho.datas.push({ data: "", motivo: "" });
    else if (t.dataset.acrescentar === "documentos") rascunho.documentos.push({ nome: "", data: "", identificacao: "", link: "" });
    else if (t.dataset.acrescentar === "fase") rascunho.estrutura.push({ id: novoId("f"), nome: "", etapas: [] });
    else if (t.dataset.acrescentarEtapa != null) rascunho.estrutura[Number(t.dataset.acrescentarEtapa)].etapas.push({ id: novoId("e"), nome: "" });
    else if (t.dataset.tirar) rascunho[t.dataset.tirar].splice(i, 1);
    else if (t.dataset.tirarFase != null) rascunho.estrutura.splice(Number(t.dataset.tirarFase), 1);
    else if (t.dataset.tirarEtapa != null) rascunho.estrutura[Number(t.dataset.faseDaEtapa)].etapas.splice(Number(t.dataset.tirarEtapa), 1);
    else if (t.dataset.mover) {
      const lista = t.dataset.mover === "fases" ? rascunho.estrutura : rascunho.estrutura[Number(t.dataset.faseDaEtapa)].etapas;
      const j = i + Number(t.dataset.sentido);
      [lista[i], lista[j]] = [lista[j], lista[i]];
    } else return;
    const secao = t.closest("[data-secao]").dataset.secao;
    desenhar();
    /* depois de acrescentar, o foco vai para o campo novo */
    if (t.dataset.acrescentar || t.dataset.acrescentarEtapa != null) {
      const campos = corpo.querySelectorAll(`[data-secao="${secao}"] input:not([type=checkbox])`);
      const alvo = t.dataset.acrescentarEtapa != null
        ? corpo.querySelectorAll(`[data-secao="estrutura"] input[data-fase="${t.dataset.acrescentarEtapa}"][data-etapa]`)
        : campos;
      alvo[alvo.length - (t.dataset.acrescentar === "documentos" ? 4 : t.dataset.acrescentar === "datas" ? 2 : 1)]?.focus();
    }
  });
  corpo.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && e.target.matches("[data-nova-situacao]")) {
      e.preventDefault();
      const nome = e.target.value.trim();
      if (!nome) return;
      if (await gravarSituacoes({ situacoes: [...personalizadasDe(espaco), { id: novoId("s"), nome }] }, `Situação “${nome}” criada.`)) {
        corpo.querySelector("[data-nova-situacao]")?.focus();
      }
      return;
    }
    if (e.key === "Enter" && e.target.matches("[data-nova-etiqueta]")) {
      e.preventDefault();
      const nome = e.target.value.trim();
      if (!nome) return;
      if (await gravarEtiqueta(() => store.criarEtiqueta(espacoId, { nome }), `Etiqueta “${nome}” criada.`)) corpo.querySelector("[data-nova-etiqueta]")?.focus();
      return;
    }
    if (e.key === "Enter" && e.target.matches("[data-nome-retrato]")) { e.preventDefault(); corpo.querySelector("[data-salvar-retrato]")?.click(); }
  });
  corpo.addEventListener("submit", (e) => {
    if (!e.target.dataset.salvar) return; // o formulário dos responsáveis grava por conta própria
    e.preventDefault();
    salvar(e.target);
  });

  desenhar();
  pararDeAcompanhar = store.acompanharEspaco(espacoId, (dados) => {
    responsaveis = dados.responsaveis;
    acoes = dados.acoes;
    if (dados.espaco) espaco = dados.espaco; // os papéis (passo 2.1) ficam no espaço e aparecem na lista de responsáveis
    desenharResponsaveis();
  });
}
