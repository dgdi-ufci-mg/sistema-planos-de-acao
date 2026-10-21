/**
 * Feriados nacionais de um ano (especificação, seção 5.1), para o botão do calendário geral.
 * A lista é uma sugestão: o administrador revisa, corrige e completa antes de salvar.
 * Inclui os pontos facultativos federais mais comuns (Carnaval e Corpus Christi), marcados no motivo.
 */

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const iso = (data) => data.toISOString().slice(0, 10);
const somar = (data, dias) => new Date(data.getTime() + dias * 864e5);

/** @returns {{data: string, motivo: string}[]} em ordem de data */
export function feriadosNacionais(ano) {
  const p = pascoa(ano);
  const fixos = [
    ["01-01", "Confraternização Universal"], ["04-21", "Tiradentes"], ["05-01", "Dia do Trabalho"],
    ["09-07", "Independência do Brasil"], ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"],
    ["11-15", "Proclamação da República"], ["11-20", "Dia Nacional de Zumbi e da Consciência Negra"], ["12-25", "Natal"],
  ].map(([md, motivo]) => ({ data: `${ano}-${md}`, motivo }));
  const moveis = [
    [somar(p, -48), "Carnaval (ponto facultativo)"], [somar(p, -47), "Carnaval (ponto facultativo)"],
    [somar(p, -2), "Paixão de Cristo (Sexta-feira Santa)"], [somar(p, 60), "Corpus Christi (ponto facultativo)"],
  ].map(([data, motivo]) => ({ data: iso(data), motivo }));
  return [...fixos, ...moveis].sort((x, y) => x.data.localeCompare(y.data));
}
