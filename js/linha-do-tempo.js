/**
 * Linha do tempo do espaço (documentação técnica, seção 8.4; passo 1.17a): regras, sem tela.
 * A partir das datas de término dos cenários simulados (seção 5.7), calcula quanto dos
 * cenários termina em cada semana e a chance acumulada de terminar até cada data.
 */

const UM_DIA = 864e5;
const paraData = (iso) => new Date(`${iso}T00:00:00Z`);
const paraIso = (d) => d.toISOString().slice(0, 10);

/** Segunda-feira da semana da data (semanas de segunda a domingo). */
export function segunda(iso) {
  const d = paraData(iso);
  return paraIso(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * UM_DIA));
}

/**
 * @param {ArrayLike<number>} fins término de cada cenário, em índice de dia útil (simular().fins)
 * @param {{dataDeConclusao: (fim: number, inicio?: number) => string}} cal
 * @returns {{semanas: {semana: string, parcela: number}[], porDia: {data: string, chanceAte: number}[]}}
 *   semanas: parte dos cenários que termina em cada semana; porDia: chance acumulada em cada data de término
 */
export function distribuicaoDoTermino(fins, cal) {
  const total = fins.length;
  const porData = new Map();
  for (const f of fins) {
    const d = cal.dataDeConclusao(f, 0);
    porData.set(d, (porData.get(d) ?? 0) + 1);
  }
  const datas = [...porData.keys()].sort();
  const semanas = new Map();
  for (const d of datas) semanas.set(segunda(d), (semanas.get(segunda(d)) ?? 0) + porData.get(d));
  let acumulado = 0;
  return {
    semanas: [...semanas.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([semana, n]) => ({ semana, parcela: n / total })),
    porDia: datas.map((data) => { acumulado += porData.get(data); return { data, chanceAte: acumulado / total }; }),
  };
}

/** Chance de terminar até a data (inclusive), pela distribuição. */
export function chanceAte(porDia, data) {
  let chance = 0;
  for (const d of porDia) { if (d.data > data) break; chance = d.chanceAte; }
  return chance;
}

/** Soma dias a uma data ISO. */
export const somarDias = (iso, n) => paraIso(new Date(paraData(iso).getTime() + n * UM_DIA));
