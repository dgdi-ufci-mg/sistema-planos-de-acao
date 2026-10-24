/**
 * Etiquetas das ações (documentação técnica, seções 4.1.9 e 16.8; passo 2.10a). Regras puras, sem tela nem banco.
 *
 * Cada espaço tem o seu catálogo de etiquetas (nome e cor), como no Trello e no Planner; a ação guarda
 * só os ids das etiquetas (`etiquetas`), acrescentados e retirados um a um (seção 4.6). O campo é
 * opcional e vem desligado ("Campos opcionais" > Etiquetas).
 *
 * As cores são as dos tons das pessoas (variáveis `--tom-N` de css/estilo.css), que já existem nos
 * temas claro e escuro: a etiqueta guarda o nome da cor, e a tela usa o tom correspondente.
 */

/** Cores das etiquetas, na ordem em que são sugeridas: [nome guardado, nome na tela, número do tom]. */
export const CORES_ETIQUETA = Object.freeze([
  ["verde", "Verde", 6],
  ["azul", "Azul", 7],
  ["laranja", "Laranja", 5],
  ["lilas", "Lilás", 4],
  ["vermelho", "Vermelho", 1],
  ["turquesa", "Turquesa", 2],
  ["rosa", "Rosa", 8],
  ["oliva", "Oliva", 3],
]);
const TOM = new Map(CORES_ETIQUETA.map(([cor, , tom]) => [cor, tom]));

/** Até 30 caracteres no nome: a etiqueta é curta por natureza. */
export const TAMANHO_DO_NOME = 30;

/** Se o espaço usa etiquetas ("Campos opcionais", desligado por padrão). */
export const usaEtiquetas = (espaco) => espaco?.camposOpcionais?.etiquetas === true;

/** Catálogo de etiquetas do espaço, na ordem de cadastro. */
export const etiquetasDe = (espaco) => espaco?.etiquetas ?? [];

/** Número do tom (1 a 15) da cor; cor desconhecida: o primeiro da lista. */
export const tomDaCor = (cor) => TOM.get(cor) ?? CORES_ETIQUETA[0][2];

/** Cor sugerida para a próxima etiqueta: a menos usada no catálogo, na ordem da lista. */
export function proximaCor(espaco) {
  const uso = new Map(CORES_ETIQUETA.map(([cor]) => [cor, 0]));
  for (const e of etiquetasDe(espaco)) if (uso.has(e.cor)) uso.set(e.cor, uso.get(e.cor) + 1);
  const menor = Math.min(...uso.values());
  return CORES_ETIQUETA.find(([cor]) => uso.get(cor) === menor)[0];
}

/** Etiquetas da ação, na ordem do catálogo; ids que não estão mais no catálogo ficam de fora. */
export function etiquetasDaAcao(espaco, acao) {
  const ids = new Set(acao?.etiquetas ?? []);
  return etiquetasDe(espaco).filter((e) => ids.has(e.id));
}

/** Etiqueta do catálogo pelo nome, sem diferenciar maiúsculas, minúsculas e espaços nas pontas. */
export const etiquetaPorNome = (espaco, nome) =>
  etiquetasDe(espaco).find((e) => e.nome.trim().toLowerCase() === String(nome ?? "").trim().toLowerCase()) ?? null;

/**
 * Problema do catálogo de etiquetas, ou null: id vazio ou repetido, nome vazio, longo ou repetido, cor fora da lista.
 * @returns {{codigo: string, mensagem: string}|null}
 */
export function problemaDasEtiquetas(espaco) {
  const ids = new Set();
  const nomes = new Set();
  for (const e of etiquetasDe(espaco)) {
    if (!e.id || ids.has(e.id)) return { codigo: "id-repetido", mensagem: "Etiqueta com identificador repetido." };
    ids.add(e.id);
    const nome = String(e.nome ?? "").trim();
    if (!nome) return { codigo: "nome-vazio", mensagem: "Toda etiqueta precisa de nome." };
    if (nome.length > TAMANHO_DO_NOME) return { codigo: "nome-longo", mensagem: `O nome “${nome.slice(0, TAMANHO_DO_NOME)}…” passa de ${TAMANHO_DO_NOME} caracteres.` };
    if (nomes.has(nome.toLowerCase())) return { codigo: "nome-repetido", mensagem: `Já existe a etiqueta “${nome}”.` };
    nomes.add(nome.toLowerCase());
    if (!TOM.has(e.cor)) return { codigo: "cor-invalida", mensagem: `Cor de etiqueta desconhecida: “${e.cor}”.` };
  }
  return null;
}
