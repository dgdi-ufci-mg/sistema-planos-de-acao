/**
 * Datas sem expediente de um ano no serviço público federal (documentação técnica, seção 5.1), para o
 * botão do calendário geral. Segue a lista anual típica do Ministério da Gestão e da Inovação (MGI):
 * feriados nacionais e pontos facultativos. Os pontos facultativos de parte do dia (Quarta-feira de
 * Cinzas, vésperas de Natal e de Ano Novo) entram como dia inteiro, por zelo com os prazos
 * (decisão do responsável, 21/10/2026). A lista é uma sugestão: o administrador revisa antes de salvar.
 *
 * Pontes: o MGI costuma dar ponto facultativo na segunda-feira quando um feriado cai na terça, e na
 * sexta quando cai na quinta. Elas entram marcadas com ⚠️, para serem conferidas na portaria do ano.
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
const dataDe = (texto) => new Date(`${texto}T00:00:00Z`);

export const AVISO_PONTE = "⚠️ Ponte provável (ponto facultativo) — confira na portaria do MGI";

/** @returns {{data: string, motivo: string}[]} em ordem de data */
export function feriadosNacionais(ano) {
  const p = pascoa(ano);
  const feriados = [
    [`${ano}-01-01`, "Confraternização Universal (feriado nacional)"],
    [iso(somar(p, -2)), "Paixão de Cristo (feriado nacional)"],
    [`${ano}-04-21`, "Tiradentes (feriado nacional)"],
    [`${ano}-05-01`, "Dia Mundial do Trabalho (feriado nacional)"],
    [`${ano}-09-07`, "Independência do Brasil (feriado nacional)"],
    [`${ano}-10-12`, "Nossa Senhora Aparecida (feriado nacional)"],
    [`${ano}-11-02`, "Finados (feriado nacional)"],
    [`${ano}-11-15`, "Proclamação da República (feriado nacional)"],
    [`${ano}-11-20`, "Dia Nacional de Zumbi e da Consciência Negra (feriado nacional)"],
    [`${ano}-12-25`, "Natal (feriado nacional)"],
  ];
  const facultativos = [
    [iso(somar(p, -48)), "Carnaval (ponto facultativo)"],
    [iso(somar(p, -47)), "Carnaval (ponto facultativo)"],
    [iso(somar(p, -46)), "Quarta-Feira de Cinzas (ponto facultativo até as 14 horas; excluída por inteiro)"],
    [iso(somar(p, 60)), "Corpus Christi (ponto facultativo)"],
    [`${ano}-10-28`, "Dia do Servidor Público federal (ponto facultativo; confira se foi transferido)"],
    [`${ano}-12-24`, "Véspera do Natal (ponto facultativo após as 13 horas; excluída por inteiro)"],
    [`${ano}-12-31`, "Véspera do Ano Novo (ponto facultativo após as 13 horas; excluída por inteiro)"],
  ];
  const lista = [...feriados, ...facultativos].map(([data, motivo]) => ({ data, motivo }));
  const ocupadas = new Set(lista.map((x) => x.data));
  /* pontes: feriado (ou Corpus Christi) na terça puxa a segunda; na quinta, a sexta */
  const pontes = [];
  for (const [data] of [...feriados, facultativos[3]]) {
    const semana = dataDe(data).getUTCDay();
    const ponte = semana === 2 ? iso(somar(dataDe(data), -1)) : semana === 4 ? iso(somar(dataDe(data), 1)) : null;
    if (ponte && !ocupadas.has(ponte) && ponte.startsWith(String(ano))) {
      ocupadas.add(ponte);
      pontes.push({ data: ponte, motivo: AVISO_PONTE });
    }
  }
  return [...lista, ...pontes].sort((x, y) => x.data.localeCompare(y.data));
}
