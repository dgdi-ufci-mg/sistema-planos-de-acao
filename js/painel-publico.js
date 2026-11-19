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
import { entregasAtivas, SITUACOES_DA_ENTREGA } from "./entregas.js";
import { tipoDe, ehDeTarefas } from "./tipos.js";
import { usaEstimativas, usaDependencias, opcoesDoCalculo, modeloDe } from "./modelos.js";
import { ehContinua, caminhoCritico, estimativaVigente } from "./calculo.js";

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
 * Situação de cada ação no painel, em dois valores (19/11/2026, decisão do responsável): `concluida` e `naoConcluida`.
 * O painel é uma cópia que só muda quando alguém da equipe abre o plano; por isso leva só o que a equipe grava e não
 * depende da passagem do dia. Atrasada (seção 6.2) e Não liberada (que muda sozinha quando chega a data mínima,
 * seção 5.1) ficariam velhas na cópia; Concluída só muda quando alguém registra a conclusão.
 */
const situacaoDaLinha = (l) => (l.situacao === "concluida" ? "concluida" : "naoConcluida");

/**
 * Caminho crítico **planejado** (19/11/2026, decisão do responsável): o mesmo cálculo da tela, sem `hoje`, isto é, sem a
 * regra "nada termina no passado" (seção 5.5). As datas saem só das estimativas, das dependências e das conclusões
 * registradas, e mudam só quando a equipe mexe no plano; a previsão de hoje avançaria a cada dia e ficaria velha na
 * cópia. Plano com dependências em círculo (o cálculo recusa): null, e o painel fica sem datas.
 */
function caminhoPlanejado(espaco, linhas, cal) {
  if (!cal) return null;
  try {
    return caminhoCritico(linhas.map((l) => l.acao), cal, opcoesDoCalculo(espaco));
  } catch {
    return null;
  }
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
  const prazos = modeloDe(espaco).prazos;
  const plano = caminhoPlanejado(espaco, linhas, cal);
  const pessoas = new Map(responsaveis.map((r) => [r.id, r]));
  const faseDaEtapa = new Map((espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => [e.id, f.id])));
  const usaFases = espaco.camposOpcionais?.fasesEtapas !== false && Boolean(espaco.estrutura?.length);
  const ehPlano = tipoDe(espaco) === "planoDeAcao";
  /* visões só de leitura (parte 2): as mesmas regras do seletor do Sextante (js/telas/espaco.js, modos) */
  const visoes = caminho && cal && plano ? [usaEstimativas(espaco) ? "tempo" : null, usaDependencias(espaco) ? "rede" : null].filter(Boolean) : [];
  const numeros = new Set(linhas.map((l) => l.acao.numero));
  /** Dados de cada ação para as visões; só com alguma visão. */
  const paraAsVisoes = (l) => {
    if (!visoes.length) return {};
    const c = plano.porAcao.get(l.acao.numero);
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

  /** Data da ação no painel: a conclusão registrada; a data-limite, no espaço com data-limite; senão a data
      planejada (sem a regra da seção 5.5). Sem estimativa, sem data (a duração zero daria uma data sem sentido). */
  const dataDe = (l) => {
    if (l.situacao === "concluida") return l.acao.concluidaEm ?? null;
    if (prazos === "dataLimite") return l.acao.dataLimite ?? null;
    if (!plano) return null;
    if (!ehContinua(l.acao) && !estimativaVigente(l.acao)) return null;
    const c = plano.porAcao.get(l.acao.numero);
    return c ? cal.dataDeConclusao(c.conclusao, c.liberacao) : null;
  };

  const acoes = linhas.map((l) => {
    return {
      numero: l.acao.numero,
      nome: l.acao.rotulo,
      fase: usaFases ? faseDaEtapa.get(l.acao.etapa) ?? null : null,
      situacao: situacaoDaLinha(l),
      continua: ehContinua(l.acao) && usaEstimativas(espaco) && usaDependencias(espaco),
      data: dataDe(l),
      responsaveis: responsaveisParaOPublico(l.acao.responsaveis ?? [], pessoas, config.mostrarNomes),
      ...paraAsVisoes(l),
    };
  });

  /* fases na ordem do espaço, só as que têm ações; o painel mostra o bloco só com duas ou mais (decisão de 18/11/2026) */
  const fases = usaFases ? (espaco.estrutura ?? []).map((f) => {
    const daFase = acoes.filter((a) => a.fase === f.id);
    const conta = (s) => daFase.filter((a) => a.situacao === s).length;
    return { id: f.id, nome: f.nome, total: daFase.length, concluidas: conta("concluida") };
  }).filter((f) => f.total) : [];

  const lista = ehPlano && entregas ? entregasAtivas(entregas).map((e) => ({
    titulo: e.titulo,
    situacao: e.situacao,
    rotulo: SITUACOES_DA_ENTREGA[e.situacao]?.nome ?? e.situacao,
    prazo: e.prazo ?? null,
  })) : [];

  /* conclusão planejada: só com estimativas (no cronograma aberto não há cálculo de datas; seção 16.1) */
  const fimPlanejado = usaEstimativas(espaco) ? acoes.reduce((max, a) => (a.data && a.data > max ? a.data : max), "") : "";
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
    prazos,
    conclusaoPlanejada: fimPlanejado || null,
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
const concluida = (a) => a.situacao === "concluida";

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
    /* só concluída ou não (19/11/2026): as telas recebem "liberada" para as demais, e o painel desliga nelas as marcas
       de andamento e de atraso (opção `andamento` falsa); resumos antigos, com outras situações, caem no mesmo caso */
    const situacao = concluida ? "concluida" : "liberada";
    porAcao.set(a.numero, { liberacao, conclusao, critica: Boolean(a.critica), folga: a.folga ?? null, situacao,
      atrasada: false, continua: Boolean(a.continua) || a.situacao === "continua" || Boolean(a.comecaCom && a.terminaCom) });
    return { numero: a.numero, rotulo: a.nome, etapa: a.etapa ?? null, dependeDe: a.dependeDe ?? [], responsaveis: a.responsaveis ?? [],
      concluidaEm: concluida ? a.data : null, ...(a.comecaCom && a.terminaCom ? { comecaCom: a.comecaCom, terminaCom: a.terminaCom } : {}) };
  });
  const cal = { data: (i) => inicioDe.get(i) ?? null, dataDeConclusao: (c, i) => fimDe.get(`${c}|${i}`) ?? null };
  const linhas = lista.map((a, i) => {
    const c = porAcao.get(a.numero);
    return { acao: acoes[i], situacao: c.situacao, publica: a.situacao, fluxo: null, rotulo: concluida(a) ? "Concluída" : "Não concluída", atrasada: false, conclusao: fins[i], continua: c.continua,
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
    entregas: entregas.length,
    alcancadas,
    pctAlcancadas: pct(alcancadas, entregas.length),
  };
}

/** Dias corridos entre duas datas AAAA-MM-DD (b − a), sem efeito de fuso nem de horário de verão. */
const emUtc = (iso) => { const [a, m, d] = iso.split("-").map(Number); return Date.UTC(a, m - 1, d); };
const diasEntre = (a, b) => Math.round((emUtc(b) - emUtc(a)) / 86400000);

/**
 * Tempo decorrido do plano, para o cartão do alto do painel (19/11/2026, pedido do responsável). É contado na hora,
 * no aparelho de quem abre o painel, com a data de hoje dele: não fica velho na cópia, como ficariam as situações que
 * dependem do dia. Em dias corridos, do início do espaço até a referência:
 * - o prazo final, quando existe (o compromisso público);
 * - sem prazo, a conclusão planejada (só no espaço com estimativas, que tem cálculo de datas);
 * - sem nenhum dos dois, não há referência: o cartão diz só desde quando o plano está em andamento.
 * @param {{inicio?: string|null, prazoFinal?: string|null, conclusaoPlanejada?: string|null}} resumo
 * @param {string} hoje AAAA-MM-DD
 * @returns {null | {referencia: "prazo"|"planejada"|null, inicio: string, fim: string|null, decorridos: number,
 *   total: number|null, pct: number|null, antesDoInicio: boolean}} null sem início
 */
export function tempoDecorrido(resumo, hoje) {
  const inicio = resumo?.inicio;
  if (!inicio) return null;
  const referencia = resumo.prazoFinal ? "prazo" : resumo.conclusaoPlanejada ? "planejada" : null;
  const fim = referencia === "prazo" ? resumo.prazoFinal : referencia === "planejada" ? resumo.conclusaoPlanejada : null;
  const antesDoInicio = hoje < inicio;
  const decorridos = Math.max(0, diasEntre(inicio, hoje));
  if (!fim || fim <= inicio) return { referencia: null, inicio, fim: null, decorridos, total: null, pct: null, antesDoInicio };
  const total = diasEntre(inicio, fim);
  const ate = Math.min(decorridos, total);
  return { referencia, inicio, fim, decorridos: ate, total, pct: Math.round((ate / total) * 100), antesDoInicio };
}
