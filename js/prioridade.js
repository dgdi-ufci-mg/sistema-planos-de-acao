/**
 * Prioridade da equipe (documentação técnica, seções 4.2 e 16.8; passo 2.10a). Regras puras, sem tela nem banco.
 *
 * A equipe ordena as ações arrastando-as na ordenação "Prioridade da equipe" (lista ordenada, sem níveis).
 * A posição de cada ação é uma **chave de ordenação fracionária** (`posicaoPrioridade`): um texto em base 36
 * ("0" a "9" e "a" a "z") comparado em ordem alfabética. Para pôr uma ação entre outras duas, basta criar uma
 * chave entre as delas: só a ação movida é gravada, sem regravar a lista, e duas pessoas reordenando ao mesmo
 * tempo não apagam o trabalho uma da outra (seção 4.6).
 *
 * As ações sem chave vêm depois das que têm, na ordem do espaço.
 */

const DIGITOS = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = DIGITOS.length;
const valor = (c) => DIGITOS.indexOf(c);

/**
 * O espaço usa a prioridade da equipe? Ligada por padrão, em todos os espaços (decisão do responsável, 29/10/2026):
 * só fica desligada quando o campo opcional foi desligado de propósito (`prioridade: false`).
 */
export const usaPrioridade = (espaco) => espaco?.camposOpcionais?.prioridade !== false;

/** Chave válida: só dígitos da base 36, sem terminar em "0" (assim sempre há espaço antes dela). */
export const chaveValida = (k) => typeof k === "string" && /^[0-9a-z]*[1-9a-z]$/.test(k);

/**
 * Chave estritamente entre `a` e `b`, em ordem alfabética. null em `a`: antes de `b`; null em `b`: depois de `a`;
 * os dois null: a primeira chave ("i", o meio da base).
 * @param {string|null} a
 * @param {string|null} b
 * @returns {string}
 */
export function chaveEntre(a, b) {
  if (a != null && !chaveValida(a)) throw new Error(`Chave inválida: ${a}`);
  if (b != null && !chaveValida(b)) throw new Error(`Chave inválida: ${b}`);
  if (a != null && b != null && a >= b) throw new Error(`A chave ${a} não vem antes de ${b}.`);
  const de = a ?? "";
  let ate = b; // depois que o prefixo fica menor que b, b deixa de limitar
  let prefixo = "";
  for (let i = 0; ; i++) {
    const da = i < de.length ? valor(de[i]) : 0;
    const db = ate != null && i < ate.length ? valor(ate[i]) : BASE;
    if (da === db) { prefixo += DIGITOS[da]; continue; }
    const meio = Math.floor((da + db) / 2);
    if (meio > da) return prefixo + DIGITOS[meio];
    /* não cabe dígito entre os dois (db = da + 1): fica com o de `a` e segue, agora sem limite de cima */
    prefixo += DIGITOS[da];
    ate = null;
  }
}

/** Compara duas ações pela prioridade da equipe: com chave antes, pela chave; sem chave, depois, pela ordem do espaço. */
export function compararPrioridade(a, b) {
  const ka = a.posicaoPrioridade ?? null;
  const kb = b.posicaoPrioridade ?? null;
  if (ka != null && kb != null && ka !== kb) return ka < kb ? -1 : 1;
  if ((ka == null) !== (kb == null)) return ka == null ? 1 : -1;
  return (a.ordem ?? 0) - (b.ordem ?? 0);
}

/**
 * Gravações para mover uma ação para entre `depoisDe` e `antesDe` (números das vizinhas na ordem de
 * prioridade; null nas pontas). Se a vizinha de cima ainda não tem chave, as ações sem chave até ela
 * recebem chaves na ordem atual (só na primeira vez em que se mexe nessa parte da lista).
 * @param {object[]} acoes ações ativas do espaço
 * @param {number} numero ação movida
 * @param {{depoisDe?: number|null, antesDe?: number|null}} vizinhas
 * @returns {{numero: number, posicaoPrioridade: string}[]} gravações, na ordem; a última é a da ação movida
 */
export function planejarMovimento(acoes, numero, { depoisDe = null, antesDe = null } = {}) {
  const ordenadas = acoes.filter((a) => a.numero !== numero).sort(compararPrioridade);
  const chave = new Map(ordenadas.map((a) => [a.numero, a.posicaoPrioridade ?? null]));
  const gravacoes = [];
  if (depoisDe != null && chave.get(depoisDe) == null) {
    let ultima = ordenadas.filter((a) => chave.get(a.numero) != null).at(-1)?.posicaoPrioridade ?? null;
    for (const a of ordenadas) {
      if (chave.get(a.numero) != null) continue;
      ultima = chaveEntre(ultima, null);
      chave.set(a.numero, ultima);
      gravacoes.push({ numero: a.numero, posicaoPrioridade: ultima });
      if (a.numero === depoisDe) break;
    }
  }
  const ka = depoisDe == null ? null : chave.get(depoisDe) ?? null;
  let kb = antesDe == null ? null : chave.get(antesDe) ?? null;
  /* duas chaves iguais ou fora de ordem (duas pessoas movendo ao mesmo tempo): fica logo depois da de cima */
  if (ka != null && kb != null && ka >= kb) kb = null;
  gravacoes.push({ numero, posicaoPrioridade: chaveEntre(ka, kb) });
  return gravacoes;
}

/** Posição de cada ação na prioridade da equipe (1, 2, 3…), só para as que têm chave. */
export function posicoesDaPrioridade(acoes) {
  const comChave = acoes.filter((a) => a.posicaoPrioridade != null).sort(compararPrioridade);
  return new Map(comChave.map((a, i) => [a.numero, i + 1]));
}
