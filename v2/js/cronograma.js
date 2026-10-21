/**
 * Cronograma do espaço (especificação, seção 8.4; passo 1.17b): regras, sem tela.
 * Monta as linhas do cronograma (Gantt) a partir do caminho crítico: em que dia útil cada
 * ação começa e termina, se está no caminho crítico, a folga e as dependências.
 * Agrupa por fase e etapa quando o espaço as usa.
 */

/**
 * Barra de uma ação.
 * @param {object} acao
 * @param {object} c resultado do caminho crítico para a ação (calculo.js)
 * @param {object} cal calendário do espaço
 */
function barraDe(acao, c, cal) {
  const concluida = c.situacao === "concluida";
  const inicio = cal.data(c.liberacao);
  const fim = concluida ? acao.concluidaEm : cal.dataDeConclusao(c.conclusao, c.liberacao);
  return {
    numero: acao.numero,
    acao,
    inicio,
    /** último dia trabalhado (inclusive) */
    fim: fim < inicio ? inicio : fim,
    /** dias úteis de duração prevista (zero: sem estimativa) */
    duracao: Math.max(0, c.conclusao - c.liberacao),
    critica: Boolean(c.critica),
    folga: Math.max(0, Math.round(c.folga ?? 0)),
    situacao: c.situacao,
    atrasada: Boolean(c.atrasada),
    dependeDe: acao.dependeDe ?? [],
  };
}

/**
 * @param {object[]} acoes ações ativas, na ordem do espaço
 * @param {{porAcao: Map}} caminho resultado de caminhoCritico
 * @param {object} cal calendário do espaço
 * @param {{estrutura?: object[], usaFases?: boolean}} [opcoes]
 * @returns {{linhas: ({tipo: "grupo", nivel: "fase"|"etapa", id: string, nome: string, inicio: string|null, fim: string|null}|{tipo: "acao", barra: object})[],
 *   inicio: string|null, fim: string|null}}
 */
export function montarCronograma(acoes, caminho, cal, { estrutura = [], usaFases = false } = {}) {
  const barras = acoes.map((a) => barraDe(a, caminho.porAcao.get(a.numero), cal));
  const extremos = (bs) => bs.length
    ? { inicio: bs.map((b) => b.inicio).sort()[0], fim: bs.map((b) => b.fim).sort().at(-1) }
    : { inicio: null, fim: null };
  const linhas = [];
  if (usaFases && estrutura.length) {
    const daEtapa = new Map();
    for (const b of barras) {
      if (!daEtapa.has(b.acao.etapa)) daEtapa.set(b.acao.etapa, []);
      daEtapa.get(b.acao.etapa).push(b);
    }
    const conhecidas = new Set();
    for (const fase of estrutura) {
      const daFase = fase.etapas.flatMap((e) => daEtapa.get(e.id) ?? []);
      if (!daFase.length) continue;
      linhas.push({ tipo: "grupo", nivel: "fase", id: fase.id, nome: fase.nome, ...extremos(daFase) });
      for (const etapa of fase.etapas) {
        conhecidas.add(etapa.id);
        const bs = daEtapa.get(etapa.id) ?? [];
        if (!bs.length) continue;
        linhas.push({ tipo: "grupo", nivel: "etapa", id: etapa.id, nome: etapa.nome, ...extremos(bs) });
        for (const b of bs) linhas.push({ tipo: "acao", barra: b });
      }
    }
    const soltas = barras.filter((b) => !conhecidas.has(b.acao.etapa));
    if (soltas.length) {
      linhas.push({ tipo: "grupo", nivel: "fase", id: "sem-etapa", nome: "Sem fase nem etapa", ...extremos(soltas) });
      for (const b of soltas) linhas.push({ tipo: "acao", barra: b });
    }
  } else {
    for (const b of barras) linhas.push({ tipo: "acao", barra: b });
  }
  return { linhas, ...extremos(barras) };
}
