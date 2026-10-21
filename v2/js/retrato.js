/**
 * Retrato do espaço (especificação, seção 4.4; passo 1.18): regras, sem banco.
 * Monta a cópia integral do espaço num momento, com os resultados calculados: o espaço,
 * as ações ativas (com todos os campos e mais os valores calculados), os responsáveis citados,
 * as datas excluídas que valiam e o resumo (conclusão prevista, data segura, P95 e chance).
 * Assim o retrato se sustenta sozinho e permite refazer o cálculo exatamente.
 */
import { criarCalendario, datasEfetivas } from "./calendario.js";
import { caminhoCritico } from "./calculo.js";
import { simular, VERSAO_CALCULO } from "./simulacao.js";
import { montarLinhas } from "./lista.js";

/**
 * @param {{espaco: object, acoes: object[], responsaveis: object[], geral: object, hoje: string}} dados
 *   acoes: só as ativas, na ordem do espaço
 * @returns {{cabecalho: object, acoes: object[]}} cabecalho: campos de CAMPOS.retrato, menos
 *   id, nome, origem, criadoEm e criadoPor (que o Store acrescenta); acoes: um registro por ação
 */
export function montarRetrato({ espaco, acoes, responsaveis, geral, hoje }) {
  const datasExcluidasEfetivas = datasEfetivas(espaco, geral);
  const cal = criarCalendario({ ...espaco, datasExcluidas: datasExcluidasEfetivas }, hoje);
  const caminho = caminhoCritico(acoes, cal, { hoje });
  const sim = simular(acoes, cal, { hoje, semente: espaco.semente, simulacoes: espaco.simulacoes, prazoFinal: espaco.prazoFinal });
  const linhas = new Map(montarLinhas(acoes, caminho, sim, cal, hoje).map((l) => [l.acao.numero, l]));
  const citados = new Set(acoes.flatMap((a) => a.responsaveis ?? []));
  return {
    cabecalho: {
      semente: espaco.semente,
      simulacoes: espaco.simulacoes,
      versaoCalculo: VERSAO_CALCULO,
      espaco: structuredClone(espaco),
      datasExcluidasEfetivas,
      responsaveis: responsaveis.filter((r) => citados.has(r.id)).map((r) => structuredClone(r)),
      resumo: {
        conclusaoPrevista: cal.dataDeConclusao(sim.p50, 0),
        dataSegura: cal.dataDeConclusao(sim.p80, 0),
        p95: cal.dataDeConclusao(sim.p95, 0),
        chancePrazo: sim.chancePrazo,
      },
    },
    acoes: acoes.map((a) => {
      const c = caminho.porAcao.get(a.numero);
      const s = sim.porAcao.get(a.numero);
      const l = linhas.get(a.numero);
      return {
        ...structuredClone(a),
        situacao: l.situacao,
        atrasada: l.atrasada,
        liberacaoPrevista: cal.data(c.liberacao),
        conclusaoPrevista: l.conclusao,
        folga: Math.max(0, c.folga ?? 0),
        prioridadeExecucao: s?.prioridadeExecucao ?? 0,
        prioridadeRevisao: s?.prioridadeRevisao ?? 0,
      };
    }),
  };
}
