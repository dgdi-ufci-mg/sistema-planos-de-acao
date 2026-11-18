/**
 * Painel público do Plano de Ação ou do Projeto (18/11/2026; documentação técnica, seções 4.13 e 8.8).
 *
 * Um resumo somente leitura, com endereço permanente, para qualquer pessoa acompanhar o plano sem conta no
 * Sextante. O resumo é uma **cópia à parte** (coleção `paineis`), e não o próprio espaço: assim, um espaço
 * restrito ou institucional pode ter painel sem abrir comentários, histórico, anotações nem e-mails. Só vai para
 * a cópia o que este arquivo põe nela.
 *
 * Só regras, sem tela e sem banco, para ser testado com o Node.
 */
import { nomeDoFluxo } from "./situacoes.js";
import { entregasAtivas, SITUACOES_DA_ENTREGA } from "./entregas.js";
import { tipoDe, ehDeTarefas } from "./tipos.js";

/** Limite da apresentação para o público, em caracteres (decisão do responsável, 18/11/2026). */
export const TAMANHO_DA_APRESENTACAO = 400;
/** Tamanho do código do endereço: 20 letras e algarismos, cerca de 119 bits; impossível de adivinhar. */
export const TAMANHO_DO_CODIGO = 20;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // sem 0, O, 1, l e I, que se confundem
const CODIGO_VALIDO = new RegExp(`^[${ALFABETO}]{${TAMANHO_DO_CODIGO}}$`);

/** Só Planos de Ação e Projetos têm painel; Quadros e Listas de tarefas, não. */
export const temPainel = (espaco) => Boolean(espaco) && !ehDeTarefas(espaco);

/** Configuração do painel guardada no espaço (`painelPublico`), ou a de um painel nunca ligado. */
export const configuracaoDoPainel = (espaco) => ({ ligado: false, apresentacao: "", mostrarNomes: false, codigo: null, ...(espaco?.painelPublico ?? {}) });

/** O painel está ligado (e tem endereço)? */
export const painelLigado = (espaco) => temPainel(espaco) && configuracaoDoPainel(espaco).ligado === true && Boolean(configuracaoDoPainel(espaco).codigo);

/**
 * Código novo e aleatório para o endereço. `aleatorio(n)` devolve n bytes (no navegador, crypto.getRandomValues).
 * A sobra do módulo é desprezível para este uso (57 símbolos sobre 256 valores).
 */
export function gerarCodigoDoPainel(aleatorio = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  return [...aleatorio(TAMANHO_DO_CODIGO)].map((b) => ALFABETO[b % ALFABETO.length]).join("");
}
export const codigoValido = (codigo) => typeof codigo === "string" && CODIGO_VALIDO.test(codigo);

/** Endereço do painel, a partir do endereço do site (a pasta raiz, terminada em "/"). */
export const enderecoDoPainel = (codigo, raiz) => `${raiz}painel/?p=${encodeURIComponent(codigo)}`;

/** Problema na configuração que a pessoa escreveu, ou null. */
export function problemaDaConfiguracao({ apresentacao = "" } = {}) {
  if (String(apresentacao).length > TAMANHO_DA_APRESENTACAO) {
    return { codigo: "apresentacao-longa", mensagem: `A apresentação passa de ${TAMANHO_DA_APRESENTACAO} caracteres.` };
  }
  return null;
}

/**
 * Situação de cada ação no painel, em cinco valores simples (o público não precisa do fluxo inteiro):
 * concluida, atrasada (carimbo da seção 6.2), continua (seção 5.9), liberada (pode começar ou já começou)
 * e naoLiberada (espera ações anteriores ou uma data mínima). O rótulo é o mesmo que o Sextante mostra
 * (inclusive o nome das situações personalizadas), para o painel e o sistema falarem igual.
 */
function situacaoDaLinha(l) {
  if (l.situacao === "concluida") return "concluida";
  if (l.atrasada) return "atrasada";
  /* a contínua que ainda não começou (o marco de início não chegou) é Não liberada, como no Sextante (seção 5.9);
     até 18/11/2026 ela contava como em andamento, e o painel mostrava mais ações liberadas do que havia */
  if (l.situacao === "naoLiberada") return "naoLiberada";
  return l.continua ? "continua" : "liberada";
}

/**
 * Responsáveis como o público vê (escolha do administrador; padrão "só a área", pela LGPD):
 * - unidade: o nome da unidade;
 * - pessoa, com `mostrarNomes`: "Nome · setor" (ou só o nome);
 * - pessoa, sem `mostrarNomes`: só o setor; sem setor, a pessoa não aparece.
 * O e-mail de login nunca vai para o painel.
 */
export function responsaveisParaOPublico(ids, pessoas, mostrarNomes) {
  const textos = ids.map((id) => pessoas.get(id)).filter(Boolean).map((r) => {
    if (r.tipo === "unidade") return r.nome;
    const setor = String(r.setor ?? "").trim();
    if (mostrarNomes) return setor ? `${r.nome} · ${setor}` : r.nome;
    return setor || null;
  }).filter(Boolean);
  return [...new Set(textos)];
}

/**
 * Monta o resumo público a partir do que o Sextante já calculou na tela (linhas da lista, js/lista.js).
 * O resultado tem só textos, números e datas, e nada que permita voltar ao espaço.
 *
 * @param {{espaco: object, linhas: object[], responsaveis: object[], entregas?: object[]|null, programa?: string}} dados
 *   linhas: as de montarLinhas, já na ordem do espaço; entregas: as do Plano de Ação (null: não lidas ainda);
 *   programa: o texto do Programa do PEI/PDI (js/estrategia.js, programaDoEspaco)
 * @returns {object} resumoDoPainel (dicionário de dados, seção 4.13)
 */
export function montarResumo({ espaco, linhas, responsaveis, entregas = null, programa = "" }) {
  const config = configuracaoDoPainel(espaco);
  const pessoas = new Map(responsaveis.map((r) => [r.id, r]));
  const faseDaEtapa = new Map((espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => [e.id, f.id])));
  const usaFases = espaco.camposOpcionais?.fasesEtapas !== false && Boolean(espaco.estrutura?.length);
  const ehPlano = tipoDe(espaco) === "planoDeAcao";

  const acoes = linhas.map((l) => {
    const situacao = situacaoDaLinha(l);
    return {
      numero: l.acao.numero,
      nome: l.acao.rotulo,
      fase: usaFases ? faseDaEtapa.get(l.acao.etapa) ?? null : null,
      situacao,
      rotulo: situacao === "atrasada" ? "Atrasada" : situacao === "continua" ? "Contínua" : nomeDoFluxo(espaco, l.fluxo),
      data: l.conclusao ?? null,
      responsaveis: responsaveisParaOPublico(l.acao.responsaveis ?? [], pessoas, config.mostrarNomes),
    };
  });

  /* fases na ordem do espaço, só as que têm ações; o painel mostra o bloco só com duas ou mais (decisão de 18/11/2026) */
  const fases = usaFases ? (espaco.estrutura ?? []).map((f) => {
    const daFase = acoes.filter((a) => a.fase === f.id);
    const conta = (s) => daFase.filter((a) => a.situacao === s).length;
    return { id: f.id, nome: f.nome, total: daFase.length, concluidas: conta("concluida"), atrasadas: conta("atrasada"),
      emAndamento: conta("liberada") + conta("continua") };
  }).filter((f) => f.total) : [];

  const lista = ehPlano && entregas ? entregasAtivas(entregas).map((e) => ({
    titulo: e.titulo,
    situacao: e.situacao,
    rotulo: SITUACOES_DA_ENTREGA[e.situacao]?.nome ?? e.situacao,
    prazo: e.prazo ?? null,
  })) : [];

  const fimPrevisto = linhas.reduce((max, l) => (l.conclusao && l.conclusao > max ? l.conclusao : max), "");
  const aprovacao = ehPlano && (espaco.aprovacao?.identificacao || espaco.aprovacao?.link)
    ? { identificacao: espaco.aprovacao.identificacao ?? "", link: /^https?:\/\//i.test(espaco.aprovacao.link ?? "") ? espaco.aprovacao.link : "" }
    : null;

  return {
    nome: espaco.nome,
    codigo: ehPlano ? String(espaco.codigo ?? "").trim() || null : null,
    tipo: tipoDe(espaco),
    apresentacao: String(config.apresentacao ?? "").trim(),
    programa: ehPlano ? String(programa ?? "").trim() || null : null,
    aprovacao,
    inicio: espaco.inicio ?? null,
    prazoFinal: espaco.prazoFinal ?? null,
    conclusaoPrevista: fimPrevisto || null,
    acoes,
    fases,
    entregas: lista,
  };
}

/** Números do alto do painel, a partir do resumo (a página e os testes usam a mesma conta). */
export function numerosDoResumo(resumo) {
  const acoes = resumo.acoes ?? [];
  const entregas = resumo.entregas ?? [];
  const alcancadas = entregas.filter((e) => e.situacao === "alcancada").length;
  const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
  const concluidas = acoes.filter((a) => a.situacao === "concluida").length;
  return {
    acoes: acoes.length,
    concluidas,
    pctConcluidas: pct(concluidas, acoes.length),
    atrasadas: acoes.filter((a) => a.situacao === "atrasada").length,
    entregas: entregas.length,
    alcancadas,
    pctAlcancadas: pct(alcancadas, entregas.length),
  };
}
