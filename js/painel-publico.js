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
import { usaEstimativas, usaDependencias } from "./modelos.js";
import { ehContinua } from "./calculo.js";

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
 * Parte 2 (18/11/2026): com o caminho crítico e o calendário, o resumo leva também o que as duas visões só de leitura
 * precisam ("No tempo", o Cronograma, e "Em rede", a Rede): as visões que o espaço usa (`visoes`), as etapas e, por
 * ação, a etapa, as ligações, o início previsto, a liberação e a conclusão em dias úteis, a folga e os marcos da contínua. Sem eles
 * (ou num espaço sem estimativas nem dependências), as visões não aparecem no painel.
 *
 * @param {{espaco: object, linhas: object[], responsaveis: object[], entregas?: object[]|null, programa?: string,
 *   caminho?: {porAcao: Map}|null, cal?: object|null}} dados
 *   linhas: as de montarLinhas, já na ordem do espaço; entregas: as do Plano de Ação (null: não lidas ainda);
 *   programa: o texto do Programa do PEI/PDI (js/estrategia.js, programaDoEspaco);
 *   caminho e cal: o caminho crítico (js/calculo.js) e o calendário do espaço, os mesmos da tela
 * @returns {object} resumoDoPainel (dicionário de dados, seção 4.13)
 */
export function montarResumo({ espaco, linhas, responsaveis, entregas = null, programa = "", caminho = null, cal = null }) {
  const config = configuracaoDoPainel(espaco);
  const pessoas = new Map(responsaveis.map((r) => [r.id, r]));
  const faseDaEtapa = new Map((espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => [e.id, f.id])));
  const usaFases = espaco.camposOpcionais?.fasesEtapas !== false && Boolean(espaco.estrutura?.length);
  const ehPlano = tipoDe(espaco) === "planoDeAcao";
  /* visões só de leitura (parte 2): as mesmas regras do seletor do Sextante (js/telas/espaco.js, modos) */
  const visoes = caminho && cal ? [usaEstimativas(espaco) ? "tempo" : null, usaDependencias(espaco) ? "rede" : null].filter(Boolean) : [];
  const numeros = new Set(linhas.map((l) => l.acao.numero));
  /** Dados de cada ação para as visões; só com alguma visão. */
  const paraAsVisoes = (l) => {
    if (!visoes.length) return {};
    const c = caminho.porAcao.get(l.acao.numero);
    const continua = ehContinua(l.acao);
    const marco = (m) => (m ? { tipo: m.tipo, ...(m.id != null ? { id: m.id } : {}), ...(m.numero != null ? { numero: m.numero } : {}) } : null);
    return {
      etapa: usaFases ? l.acao.etapa ?? null : null,
      dependeDe: continua ? [] : [...new Set(l.acao.dependeDe ?? [])].filter((n) => numeros.has(n) && n !== l.acao.numero),
      inicio: cal.data(c.liberacao),
      /* dias úteis contados do primeiro dia útil do espaço (seção 5.1), com fração: a Rede compara a conclusão de uma ação
         com a liberação da seguinte para pintar a seta sem folga */
      liberacao: c.liberacao,
      conclusao: c.conclusao,
      critica: Boolean(c.critica),
      folga: c.folga == null ? null : Math.max(0, Math.round(c.folga)),
      comecaCom: continua ? marco(l.acao.comecaCom) : null,
      terminaCom: continua ? marco(l.acao.terminaCom) : null,
    };
  };

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
      ...paraAsVisoes(l),
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
    visoes,
    /* etapas, na ordem do espaço, para as cercas da Rede e os grupos do Cronograma (só com visões e fases) */
    etapas: visoes.length && usaFases ? (espaco.estrutura ?? []).flatMap((f) => (f.etapas ?? []).map((e) => ({ id: e.id, nome: e.nome, fase: f.id }))) : [],
  };
}

/**
 * Peças que as telas do Cronograma e da Rede (js/telas/cronograma.js e js/telas/rede.js) recebem no Sextante, refeitas
 * a partir do resumo público, para as duas visões só de leitura do painel (parte 2, 18/11/2026). O painel não tem o
 * calendário do espaço: as datas já vêm calculadas no resumo. O calendário daqui só devolve essas datas: para a
 * liberação de uma ação, o início dela; para a conclusão e a liberação, a data prevista (ou registrada) de conclusão.
 * Como liberação e conclusão são as do Sextante, a mesma conta dá a mesma data, e as barras, as setas e as cores ficam
 * iguais às da equipe ao gravar.
 * @param {object} resumo resumoDoPainel
 * @returns {{acoes: object[], caminho: {porAcao: Map}, cal: {data: Function, dataDeConclusao: Function}, linhas: object[],
 *   estrutura: object[], usaFases: boolean}}
 */
export function pecasDasVisoes(resumo) {
  const lista = resumo.acoes ?? [];
  const etapas = resumo.etapas ?? [];
  const estrutura = (resumo.fases ?? []).map((f) => ({ id: f.id, nome: f.nome, etapas: etapas.filter((e) => e.fase === f.id).map((e) => ({ id: e.id, nome: e.nome })) }))
    .filter((f) => f.etapas.length);
  const inicioDe = new Map();
  const fimDe = new Map();
  const porAcao = new Map();
  const fins = [];
  const acoes = lista.map((a, i) => {
    const concluida = a.situacao === "concluida";
    const fim = a.data ?? null;
    fins[i] = fim;
    const liberacao = a.liberacao ?? 0;
    const conclusao = a.conclusao ?? liberacao;
    inicioDe.set(liberacao, a.inicio ?? null);
    if (!concluida) fimDe.set(`${conclusao}|${liberacao}`, fim); // a concluída usa a data registrada (concluidaEm)
    /* atrasada e contínua são carimbos sobre uma ação liberada (seção 6.2 e 5.9); o painel guarda só a situação simplificada */
    const situacao = concluida ? "concluida" : a.situacao === "naoLiberada" ? "naoLiberada" : "liberada";
    porAcao.set(a.numero, { liberacao, conclusao, critica: Boolean(a.critica), folga: a.folga ?? null, situacao,
      atrasada: a.situacao === "atrasada", continua: a.situacao === "continua" || Boolean(a.comecaCom && a.terminaCom) });
    return { numero: a.numero, rotulo: a.nome, etapa: a.etapa ?? null, dependeDe: a.dependeDe ?? [], responsaveis: a.responsaveis ?? [],
      concluidaEm: concluida ? a.data : null, ...(a.comecaCom && a.terminaCom ? { comecaCom: a.comecaCom, terminaCom: a.terminaCom } : {}) };
  });
  const cal = { data: (i) => inicioDe.get(i) ?? null, dataDeConclusao: (c, i) => fimDe.get(`${c}|${i}`) ?? null };
  const linhas = lista.map((a, i) => {
    const c = porAcao.get(a.numero);
    return { acao: acoes[i], situacao: c.situacao, publica: a.situacao, fluxo: null, rotulo: a.rotulo, atrasada: c.atrasada, conclusao: fins[i], continua: c.continua,
      semEstimativa: !c.continua && c.situacao !== "concluida" && !(c.conclusao > c.liberacao), execucao: null, podeEncerrar: false };
  });
  return { acoes, caminho: { porAcao }, cal, linhas, estrutura, usaFases: estrutura.length > 0 };
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
