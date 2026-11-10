/**
 * Visualização "Responsáveis" (documentação técnica, seções 5.10 e 8.4): regras, sem tela.
 * Para cada responsável do espaço, quantas ações ele tem ao mesmo tempo em cada semana, de hoje ao fim
 * previsto, pelas datas que o caminho crítico já calculou. É só leitura: nada é recalculado nem reagendado.
 *
 * O número é uma contagem de ações, e não uma medida de esforço: o sistema não guarda horas nem dedicação.
 * Por isso não há limite fixo de "sobrecarga"; a tela mostra onde olhar, e quem julga é a equipe.
 * Funções puras: não acessam a tela nem o banco.
 */
import { segunda, somarDias } from "./linha-do-tempo.js";

/** Chave da linha das ações sem responsável. */
export const SEM_RESPONSAVEL = "";

/**
 * Barra de uma ação em aberto: do dia em que pode começar ao último dia previsto de trabalho.
 * `conta`: entra no número de ações ao mesmo tempo. Ficam de fora a ação contínua (acompanha um trecho do
 * plano; ser responsável nela costuma ser estar a postos) e a ação sem estimativa (não tem período).
 */
function barraDe(acao, c, cal) {
  const inicio = cal.data(c.liberacao);
  const fim = cal.dataDeConclusao(c.conclusao, c.liberacao);
  const continua = Boolean(c.continua);
  const semEstimativa = !continua && !(acao.estimativas?.length);
  return {
    numero: acao.numero, acao, inicio, fim: fim < inicio ? inicio : fim,
    situacao: c.situacao, atrasada: Boolean(c.atrasada), critica: Boolean(c.critica),
    continua, semEstimativa, conta: !continua && !semEstimativa,
  };
}

/**
 * Maior número de barras no mesmo dia útil, em cada semana (de segunda a domingo).
 * @param {{inicio: string, fim: string}[]} barras
 * @param {string[]} semanas segunda-feira de cada semana
 * @param {{ehDiaUtil: (iso: string) => boolean}} cal
 * @param {string} hoje dias anteriores a hoje não contam
 */
export function simultaneasPorSemana(barras, semanas, cal, hoje) {
  return semanas.map((semana) => {
    let maior = 0;
    for (let i = 0; i < 7; i++) {
      const dia = somarDias(semana, i);
      if (dia < hoje || !cal.ehDiaUtil(dia)) continue;
      let n = 0;
      for (const b of barras) if (b.inicio <= dia && dia <= b.fim) n++;
      if (n > maior) maior = n;
    }
    return maior;
  });
}

/**
 * @param {object[]} acoes ações ativas do espaço, na ordem do espaço
 * @param {{porAcao: Map}} caminho resultado de caminhoCritico, com `hoje`
 * @param {object} cal calendário do espaço
 * @param {object[]} responsaveis responsáveis do espaço (os excluídos ficam de fora)
 * @param {{hoje: string}} opcoes
 * @returns {{semanas: string[], de: string, ate: string, maximo: number,
 *   linhas: {responsavel: object|null, barras: object[], porSemana: number[], pico: number, emAberto: number,
 *     atrasadas: number, semEstimativa: number, continuas: number}[],
 *   livres: object[]}}
 *   linhas: um responsável com ação em aberto por linha, do maior pico para o menor (no empate, mais ações em
 *   aberto e, depois, o nome); por último, as ações sem responsável (`responsavel: null`), se houver.
 *   livres: responsáveis sem nenhuma ação em aberto, por nome. maximo: o maior número de toda a tabela.
 */
export function montarCarga(acoes, caminho, cal, responsaveis, { hoje }) {
  const ativos = responsaveis.filter((r) => !r.excluidoEm);
  const conhecidos = new Set(ativos.map((r) => r.id));
  const porDono = new Map();
  const juntar = (id, barra) => { if (!porDono.has(id)) porDono.set(id, []); porDono.get(id).push(barra); };
  for (const acao of acoes) {
    const c = caminho.porAcao.get(acao.numero);
    if (!c || c.situacao === "concluida") continue;
    const barra = barraDe(acao, c, cal);
    const donos = [...new Set(acao.responsaveis ?? [])].filter((id) => conhecidos.has(id));
    if (!donos.length) juntar(SEM_RESPONSAVEL, barra);
    /* a ação com mais de um responsável conta inteira para cada um: não há dado para dividi-la */
    for (const id of donos) juntar(id, barra);
  }

  const todas = [...porDono.values()].flat();
  const de = segunda(hoje);
  const ultimo = todas.map((b) => b.fim).sort().at(-1) ?? hoje;
  const semanas = [];
  for (let s = de; s <= (ultimo < hoje ? hoje : ultimo); s = somarDias(s, 7)) semanas.push(s);
  const ate = somarDias(semanas.at(-1), 7);

  const linhaDe = (responsavel, barras) => {
    const porSemana = simultaneasPorSemana(barras.filter((b) => b.conta), semanas, cal, hoje);
    return {
      responsavel, barras: [...barras].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim) || a.numero - b.numero),
      porSemana, pico: Math.max(0, ...porSemana),
      emAberto: barras.length,
      atrasadas: barras.filter((b) => b.atrasada).length,
      semEstimativa: barras.filter((b) => b.semEstimativa).length,
      continuas: barras.filter((b) => b.continua).length,
    };
  };
  const porNome = (a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  const linhas = ativos.filter((r) => porDono.has(r.id)).map((r) => linhaDe(r, porDono.get(r.id)))
    .sort((a, b) => b.pico - a.pico || b.emAberto - a.emAberto || porNome(a.responsavel, b.responsavel));
  if (porDono.has(SEM_RESPONSAVEL)) linhas.push(linhaDe(null, porDono.get(SEM_RESPONSAVEL)));
  return {
    semanas, de, ate, linhas,
    maximo: Math.max(0, ...linhas.map((l) => l.pico)),
    livres: ativos.filter((r) => !porDono.has(r.id)).sort(porNome),
  };
}

/**
 * Intensidade da cor de uma semana, de 0 (nenhuma ação) a 4. Até quatro ações ao mesmo tempo, um nível por ação;
 * acima disso, proporcional ao maior número da tabela, para a cor mais forte ficar com quem mais acumula.
 */
export const nivelDaCarga = (n, maximo) => (n <= 0 ? 0 : Math.min(4, Math.ceil((n / Math.max(maximo, 4)) * 4)));
