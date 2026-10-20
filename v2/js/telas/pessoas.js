/**
 * Desenho dos responsáveis (especificação, seção 8.3): pessoa num círculo com as iniciais,
 * no tom guardado no espaço; unidade num quadrado com a sigla.
 */
import { esc } from "../formato.js";
import { iniciais, tomDe, separar } from "../responsaveis.js";

/** Até quantas pessoas aparecem juntas; as demais viram "+N". */
const PESSOAS_JUNTAS = 3;

/**
 * Selo de um responsável.
 * @param {object} r  responsável
 * @param {{tons?: object, meus?: string[]|null}} contexto  tons do espaço e ids ligados a quem entrou
 */
export function seloHtml(r, { tons, meus } = {}) {
  if (r.tipo === "unidade") {
    return `<span class="unidade" title="${esc(r.nome)}" role="img" aria-label="${esc(r.nome)}">${esc(r.sigla || iniciais(r.nome))}</span>`;
  }
  const tom = tons?.[r.id] ?? tomDe(r.nome);
  return `<span class="avatar${meus?.includes(r.id) ? " eu" : ""}" style="--tom:var(--tom-${tom});--tom-texto:var(--tom-${tom}-texto)" title="${esc(r.nome)}" role="img" aria-label="${esc(r.nome)}">${esc(iniciais(r.nome))}</span>`;
}

/** Responsáveis de uma ação: pessoas sobrepostas (até três, depois "+N") e, em seguida, unidades. */
export function donosHtml(lista, contexto = {}) {
  const { pessoas, unidades } = separar(lista);
  const visiveis = pessoas.length > PESSOAS_JUNTAS ? pessoas.slice(0, PESSOAS_JUNTAS - 1) : pessoas;
  const resto = pessoas.slice(visiveis.length);
  const nomes = esc(resto.map((p) => p.nome).join(", "));
  const mais = resto.length ? `<span class="avatar mais" title="${nomes}" role="img" aria-label="Mais ${resto.length}: ${nomes}">+${resto.length}</span>` : "";
  return (pessoas.length ? `<span class="pessoas">${visiveis.map((p) => seloHtml(p, contexto)).join("")}${mais}</span>` : "")
    + unidades.map((u) => seloHtml(u, contexto)).join("");
}
