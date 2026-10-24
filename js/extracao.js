/**
 * Extração personalizada (passo 2.10; documentação técnica, seções 8 e 16.6): monta as tabelas que vão para o
 * arquivo (CSV, Excel, LibreOffice ou PDF) a partir dos espaços escolhidos. Regras puras, sem tela nem banco.
 *
 * - Ações: os campos escolhidos, com os nomes do dicionário de dados (seção 4.2) como títulos das colunas, mais
 *   os valores calculados do retrato (4.4.1); referências viram nomes (responsáveis, etapas, etiquetas…).
 * - Entregas e registros de alcance (4.12), só dos Planos de Ação.
 * - Histórico de alterações das ações (4.2.1), com a frase que a tela mostra.
 * A primeira coluna de toda tabela é `espaco`, o nome do espaço.
 */
import { montarRetrato } from "./retrato.js";
import { descreverRegistro } from "./historico.js";
import { nomeDoFluxo, fluxoDe, personalizadasDe } from "./situacoes.js";
import { etiquetasDe } from "./etiquetas.js";
import { estimativaVigente } from "./calculo.js";
import { alcanceAtual, registrosDa, SITUACOES_DA_ENTREGA, TIPOS_DE_META } from "./entregas.js";

const juntar = (lista) => lista.filter((x) => x != null && x !== "").join("; ");
const data = (iso) => (iso ? { data: String(iso).slice(0, 10) } : null);
const momento = (iso) => (iso ? { momento: iso } : null);
const SITUACAO_DA_ACAO = { concluida: "Concluída", liberada: "Liberada", naoLiberada: "Não liberada" };

/**
 * Campos das ações que podem ser extraídos, na ordem das colunas: [campo, nome na tela, valor, padrão].
 * `campo` é o nome do dicionário de dados (4.2) ou, nos calculados, o do retrato (4.4.1).
 * O valor recebe a ação (já com os calculados) e o contexto do espaço.
 */
export const CAMPOS_DA_ACAO = [
  ["numero", "Número", (a) => a.numero, true],
  ["codigo", "Código", (a) => a.codigo ?? null, false],
  ["etapa", "Fase e etapa", (a, c) => c.etapa.get(a.etapa) ?? null, true],
  ["rotulo", "Ação", (a) => a.rotulo, true],
  ["descricao", "Descrição", (a) => a.descricao ?? null, false],
  ["justificativa", "Justificativa", (a) => a.justificativa ?? null, false],
  ["local", "Local", (a) => a.local ?? null, false],
  ["responsaveis", "Responsáveis", (a, c) => juntar((a.responsaveis ?? []).map((id) => c.pessoa.get(id))), true],
  ["dependeDe", "Depende de", (a, c) => juntar((a.dependeDe ?? []).map((n) => c.referencia(n))), false],
  ["estimativas", "Estimativa vigente (otimista · mais provável · pessimista)", (a) => { const e = estimativaVigente(a); return e ? `${e.o} · ${e.m} · ${e.p}` : null; }, false],
  ["dataLimite", "Data-limite", (a) => data(a.dataLimite), false],
  ["naoAntesDe", "Não começa antes de", (a) => data(a.naoAntesDe), false],
  ["situacao", "Situação", (a, c) => (a.situacao === "liberada" ? nomeDoFluxo(c.espaco, fluxoDe(a, a.situacao, c.espaco)) : SITUACAO_DA_ACAO[a.situacao] ?? a.situacao), true],
  ["atrasada", "Atrasada", (a) => Boolean(a.atrasada), true],
  ["liberacaoPrevista", "Início previsto", (a) => (a.concluidaEm ? null : data(a.liberacaoPrevista)), false],
  ["conclusaoPrevista", "Conclusão prevista", (a) => (a.concluidaEm ? null : data(a.conclusaoPrevista)), true],
  ["concluidaEm", "Concluída em", (a) => data(a.concluidaEm), true],
  ["folga", "Folga (dias úteis)", (a) => (a.concluidaEm ? null : a.folga), false],
  ["prioridadeExecucao", "Índice de criticidade", (a) => (a.prioridadeExecucao == null ? null : { fracao: a.prioridadeExecucao }), false],
  ["prioridadeRevisao", "Contribuição para a incerteza", (a) => (a.prioridadeRevisao == null ? null : { fracao: a.prioridadeRevisao }), false],
  ["etiquetas", "Etiquetas", (a, c) => juntar((a.etiquetas ?? []).map((id) => c.etiqueta.get(id))), false],
  ["entregaDoPlano", "Entrega do Plano de Ação", (a, c) => (a.entregaDoPlano ? c.entrega.get(a.entregaDoPlano) ?? "(entrega excluída)" : null), false],
  ["checklist", "Checklist (feitos de total)", (a) => (a.checklist?.length ? `${a.checklist.filter((i) => i.feito).length} de ${a.checklist.length}` : null), false],
  ["documentos", "Documentos e links", (a) => juntar((a.documentos ?? []).map((d) => `${d.nome} (${d.link || d.identificacao})`)), false],
  ["notas", "Anotações", (a) => a.notas ?? null, false],
  ["criadaEm", "Criada em", (a) => momento(a.criadaEm), false],
  ["alteradaEm", "Alterada em", (a) => momento(a.alteradaEm), false],
  ["alteradaPor", "Alterada por", (a) => a.alteradaPor ?? null, false],
];
export const CAMPOS_PADRAO_DA_ACAO = CAMPOS_DA_ACAO.filter(([, , , p]) => p).map(([c]) => c);

/** Filtros das ações (por situação). */
export const FILTROS_DE_SITUACAO = {
  todas: { nome: "Todas", vale: () => true },
  abertas: { nome: "Não concluídas", vale: (a) => a.situacao !== "concluida" },
  concluidas: { nome: "Concluídas", vale: (a) => a.situacao === "concluida" },
  atrasadas: { nome: "Atrasadas", vale: (a) => a.atrasada },
};

/** Contexto de nomes de um espaço: responsáveis, etapas, etiquetas, entregas, referências às ações. */
function contexto({ espaco, acoes, responsaveis, entregas = [] }) {
  const porNumero = new Map(acoes.map((a) => [a.numero, a]));
  return {
    espaco,
    pessoa: new Map(responsaveis.map((r) => [r.id, r.sigla ? `${r.sigla} · ${r.nome}` : r.nome])),
    etapa: new Map((espaco.estrutura ?? []).flatMap((f) => (f.etapas ?? []).map((e) => [e.id, `${f.nome} › ${e.nome}`]))),
    etiqueta: new Map(etiquetasDe(espaco).map((e) => [e.id, e.nome])),
    entrega: new Map(entregas.map((e) => [e.id, e.titulo])),
    referencia: (n) => { const a = porNumero.get(n); return a ? (a.codigo || `#${a.numero}`) : `#${n}`; },
    rotulo: (n) => porNumero.get(n)?.rotulo ?? `#${n}`,
  };
}

/**
 * Monta as tabelas da extração.
 * @param {{
 *   espacos: {espaco: object, acoes: object[], responsaveis: object[], historico?: object[], entregas?: object[], alcances?: object[]}[],
 *   geral: object, hoje: string,
 *   escolha: {acoes?: {campos: string[], situacao?: string}|null, entregas?: boolean, alcances?: boolean, historico?: boolean}
 * }} dados  ações, responsáveis e entregas já sem os excluídos
 * @returns {{nome: string, colunas: string[], linhas: any[][]}[]}
 */
export function montarExtracao({ espacos, geral, hoje, escolha }) {
  const tabelas = [];
  const ordenados = [...espacos].sort((a, b) => a.espaco.nome.localeCompare(b.espaco.nome, "pt-BR"));

  if (escolha.acoes?.campos?.length) {
    const campos = CAMPOS_DA_ACAO.filter(([c]) => escolha.acoes.campos.includes(c));
    const filtro = FILTROS_DE_SITUACAO[escolha.acoes.situacao ?? "todas"] ?? FILTROS_DE_SITUACAO.todas;
    const linhas = [];
    for (const e of ordenados) {
      const calculadas = e.acoes.length
        ? montarRetrato({ espaco: e.espaco, acoes: e.acoes, responsaveis: e.responsaveis, geral, hoje }).acoes
        : [];
      const c = contexto(e);
      for (const a of calculadas.sort((x, y) => x.ordem - y.ordem).filter(filtro.vale)) {
        linhas.push([e.espaco.nome, ...campos.map(([, , valor]) => valor(a, c))]);
      }
    }
    tabelas.push({ nome: "Ações", colunas: ["espaco", ...campos.map(([c]) => c)], linhas });
  }

  const planos = ordenados.filter((e) => e.entregas);
  if (escolha.entregas) {
    const linhas = [];
    for (const e of planos) {
      const c = contexto(e);
      for (const x of e.entregas) {
        const a = alcanceAtual(x, e.alcances ?? []);
        linhas.push([e.espaco.nome, x.titulo, x.descricao ?? null, TIPOS_DE_META[x.tipoMeta]?.nome ?? x.tipoMeta, x.meta ?? null, x.unidade ?? null,
          data(x.prazo), juntar((x.responsaveis ?? []).map((id) => c.pessoa.get(id))), SITUACOES_DA_ENTREGA[x.situacao]?.nome ?? x.situacao,
          x.justificativa ?? null, a ? a.valor : null, a && x.tipoMeta !== "padrao" ? { fracao: a.fracao } : null, a ? data(a.registro.data) : null,
          registrosDa(x.id, e.alcances ?? []).length]);
      }
    }
    tabelas.push({ nome: "Entregas", colunas: ["espaco", "titulo", "descricao", "tipoMeta", "meta", "unidade", "prazo", "responsaveis", "situacao",
      "justificativa", "valorAlcancado", "fracaoDaMeta", "dataDoAlcance", "registrosDeAlcance"], linhas });
  }
  if (escolha.alcances) {
    const linhas = [];
    for (const e of planos) {
      const c = contexto(e);
      const titulo = new Map((e.entregas ?? []).map((x) => [x.id, x.titulo]));
      for (const r of [...(e.alcances ?? [])].sort((a, b) => a.data.localeCompare(b.data) || a.registradoEm.localeCompare(b.registradoEm))) {
        linhas.push([e.espaco.nome, titulo.get(r.entrega) ?? "(entrega excluída)", data(r.data), r.valor, r.descricao,
          r.evidencias.map((v) => `${v.descricao}: ${[v.identificacao, v.link].filter(Boolean).join(" · ")}`).join(" | "),
          juntar((r.realizadores ?? []).map((id) => c.pessoa.get(id))), momento(r.registradoEm), r.registradoPor ?? null]);
      }
    }
    tabelas.push({ nome: "Registros de alcance", colunas: ["espaco", "entrega", "data", "valor", "descricao", "evidencias", "realizadores", "registradoEm", "registradoPor"], linhas });
  }
  if (escolha.historico) {
    const linhas = [];
    for (const e of ordenados) {
      const c = contexto(e);
      const situacoes = new Map(personalizadasDe(e.espaco).map((s) => [s.id, s.nome]));
      const nomes = {
        acao: (n) => c.referencia(n), responsavel: (id) => c.pessoa.get(id) ?? "responsável excluído", etapa: (id) => c.etapa.get(id) ?? "etapa excluída",
        etiqueta: (id) => c.etiqueta.get(id), situacao: (id) => situacoes.get(id), entrega: (id) => c.entrega.get(id),
      };
      for (const r of [...(e.historico ?? [])].sort((a, b) => a.em.localeCompare(b.em) || a.id.localeCompare(b.id))) {
        linhas.push([e.espaco.nome, r.chave, c.rotulo(r.chave), r.campo ?? r.tipo, descreverRegistro(r, nomes), momento(r.em), r.por ?? null]);
      }
    }
    tabelas.push({ nome: "Histórico", colunas: ["espaco", "acao", "rotulo", "campo", "descricao", "em", "por"], linhas });
  }
  return tabelas;
}
