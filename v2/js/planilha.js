/**
 * Regras do modo "Editar em planilha" (especificação, seção 8.3), sem tela, para serem testadas:
 * ler e escrever as listas digitadas (dependências e responsáveis) e ler um bloco colado
 * do Google Planilhas ou do Excel.
 */
import { normalizar } from "./acao.js";

const partes = (texto) => String(texto ?? "").split(/[;,\n]/).map((t) => t.trim()).filter(Boolean);

/**
 * Dependências digitadas: números das ações ("3; 5") e, se o espaço usa códigos, também códigos ("LEV; 5").
 * @returns {{numeros: number[], erros: string[]}}
 */
export function lerReferencias(texto, acoes, usaCodigos) {
  const numeros = [];
  const erros = [];
  for (const parte of partes(texto)) {
    const acao = /^\d+$/.test(parte)
      ? acoes.find((a) => a.numero === Number(parte))
      : usaCodigos ? acoes.find((a) => a.codigo && a.codigo === parte.toUpperCase()) : null;
    if (!acao) erros.push(`“${parte}” não é ${usaCodigos ? "número nem código" : "número"} de uma ação deste espaço.`);
    else if (!numeros.includes(acao.numero)) numeros.push(acao.numero);
  }
  return { numeros, erros };
}

/** Dependências para mostrar na célula: códigos, se o espaço usa e a ação tem; senão, números. */
export function escreverReferencias(numeros, acoes, usaCodigos) {
  return (numeros ?? []).map((n) => {
    const a = acoes.find((x) => x.numero === n);
    return usaCodigos && a?.codigo ? a.codigo : String(n);
  }).join("; ");
}

/**
 * Responsáveis digitados: sigla ou nome completo, sem diferenciar acentos e maiúsculas.
 * @returns {{ids: string[], erros: string[]}}
 */
export function lerResponsaveis(texto, responsaveis) {
  const ids = [];
  const erros = [];
  for (const parte of partes(texto)) {
    const p = normalizar(parte);
    const r = responsaveis.find((x) => x.sigla && normalizar(x.sigla) === p) ?? responsaveis.find((x) => normalizar(x.nome) === p);
    if (!r) erros.push(`“${parte}” não é sigla nem nome de um responsável cadastrado.`);
    else if (!ids.includes(r.id)) ids.push(r.id);
  }
  return { ids, erros };
}

/** Responsáveis para mostrar na célula: a sigla ou, sem sigla, o nome. */
export function escreverResponsaveis(ids, responsaveis) {
  return (ids ?? []).map((id) => {
    const r = responsaveis.find((x) => x.id === id);
    return r ? r.sigla || r.nome : "";
  }).filter(Boolean).join("; ");
}

/** O que acrescentar e retirar para passar da lista `antes` para a lista `depois`, item a item (seção 4.6). */
export function diferenca(antes = [], depois = []) {
  return { acrescentar: depois.filter((x) => !antes.includes(x)), retirar: antes.filter((x) => !depois.includes(x)) };
}

/**
 * Bloco colado de uma planilha: linhas separadas por quebra de linha e células por tabulação.
 * Aceita células entre aspas com quebras de linha dentro (como o Google Planilhas e o Excel copiam).
 * @returns {string[][]}
 */
export function lerColagem(texto) {
  const linhas = [];
  let linha = [];
  let celula = "";
  let aspas = false;
  const t = String(texto ?? "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { celula += '"'; i++; }
      else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"' && celula === "") aspas = true;
    else if (c === "\t") { linha.push(celula); celula = ""; }
    else if (c === "\n") { linha.push(celula); linhas.push(linha); linha = []; celula = ""; }
    else celula += c;
  }
  if (celula !== "" || linha.length) { linha.push(celula); linhas.push(linha); }
  return linhas;
}

/** Data digitada na planilha: AAAA-MM-DD ou DD/MM/AAAA; vazio vira null. Devolve undefined se não entender. */
export function lerData(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}
