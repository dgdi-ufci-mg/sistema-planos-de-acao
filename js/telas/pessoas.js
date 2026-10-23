/**
 * Desenho dos responsáveis (documentação técnica, seção 8.3): pessoa num círculo com as iniciais,
 * no tom guardado no espaço; unidade num quadrado com a sigla.
 */
import { esc } from "../formato.js";
import { iniciais, tomDe, separar } from "../responsaveis.js";

/**
 * Letras do círculo (22/10/2026): a sigla da pessoa, quando tem até três letras, que é única no
 * espaço; sem sigla, as iniciais do nome (que podem repetir, como Hebert e Henrique).
 */
export const rotuloDoCirculo = (r) => (r.sigla && r.sigla.trim().length <= 3 ? r.sigla.trim().toLocaleUpperCase("pt-BR") : iniciais(r.nome));

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
  const letras = rotuloDoCirculo(r);
  return `<span class="avatar${meus?.includes(r.id) ? " eu" : ""}${letras.length > 2 ? " tres" : ""}" style="--tom:var(--tom-${tom});--tom-texto:var(--tom-${tom}-texto)" title="${esc(r.nome)}" role="img" aria-label="${esc(r.nome)}">${esc(letras)}</span>`;
}

/**
 * Responsáveis de uma ação: pessoas sobrepostas (até três, depois "+N") e, em seguida, unidades.
 * Com `todos`, desenha todas as pessoas; a tela esconde as que não couberem (ajustarDonos).
 * Em ordem alfabética do nome, da esquerda para a direita (22/10/2026, pedido do responsável).
 */
const porNome = (a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
export function donosHtml(lista, contexto = {}) {
  const { pessoas, unidades } = separar([...lista].sort(porNome));
  if (contexto.todos) {
    return (pessoas.length ? `<span class="pessoas">${pessoas.map((p) => seloHtml(p, contexto)).join("")}</span>` : "")
      + unidades.map((u) => seloHtml(u, contexto)).join("");
  }
  const visiveis = pessoas.length > PESSOAS_JUNTAS ? pessoas.slice(0, PESSOAS_JUNTAS - 1) : pessoas;
  const resto = pessoas.slice(visiveis.length);
  const nomes = esc(resto.map((p) => p.nome).join(", "));
  const mais = resto.length ? `<span class="avatar mais" title="${nomes}" role="img" aria-label="Mais ${resto.length}: ${nomes}">+${resto.length}</span>` : "";
  return (pessoas.length ? `<span class="pessoas">${visiveis.map((p) => seloHtml(p, contexto)).join("")}${mais}</span>` : "")
    + unidades.map((u) => seloHtml(u, contexto)).join("");
}

/**
 * Mostra todas as pessoas que couberem na largura de cada `.donos` dentro de `raiz`; as que não
 * couberem viram "+N" no fim (22/10/2026: com uma barra só, sobra espaço nos cartões).
 */
export function ajustarDonos(raiz) {
  for (const caixa of raiz.querySelectorAll(".donos")) {
    const grupo = caixa.querySelector(".pessoas");
    if (!grupo) continue;
    grupo.querySelector(".avatar.mais")?.remove();
    const selos = [...grupo.querySelectorAll(".avatar")];
    for (const s of selos) s.hidden = false;
    if (caixa.scrollWidth <= caixa.clientWidth + 1 || selos.length < 2) continue;
    const mais = document.createElement("span");
    mais.className = "avatar mais";
    mais.setAttribute("role", "img");
    grupo.append(mais);
    let escondidos = 0;
    while (escondidos < selos.length - 1) {
      escondidos++;
      selos[selos.length - escondidos].hidden = true;
      const nomes = selos.slice(selos.length - escondidos).map((s) => s.title).join(", ");
      mais.textContent = `+${escondidos}`;
      mais.title = nomes;
      mais.setAttribute("aria-label", `Mais ${escondidos}: ${nomes}`);
      if (caixa.scrollWidth <= caixa.clientWidth + 1) break;
    }
  }
}
