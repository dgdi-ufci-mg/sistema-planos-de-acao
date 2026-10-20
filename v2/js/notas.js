/**
 * Notas das ações em Markdown seguro (especificação, seção 8.5), sem biblioteca externa.
 * Aceita negrito (**…**), itálico (*…*), links ([texto](endereço)), endereços da web
 * automáticos, listas (linhas que começam com "- ") e quebras de linha. Todo o resto é
 * texto: nenhum HTML digitado é executado. Links só para http, https e mailto.
 */
import { esc } from "./formato.js";

/** Endereço aceito em link: http, https ou mailto, sem espaços. */
export const linkSeguro = (url) => /^(https?:\/\/|mailto:)[^\s]+$/i.test(String(url ?? "").trim());

const linkHtml = (url, texto) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${texto}</a>`;

/** Uma linha de Markdown em HTML: escapa primeiro, depois converte só o permitido. */
function linhaParaHtml(linha) {
  let s = esc(linha);
  const links = [];
  const guardar = (html) => `\u0000${links.push(html) - 1}\u0000`;
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/gi, (_, texto, url) => guardar(linkHtml(url, texto)));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/gi, (_, antes, url) => antes + guardar(linkHtml(url, url)));
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
}

/** Markdown da nota em HTML seguro, com parágrafos, quebras de linha e listas. */
export function markdownParaHtml(texto) {
  let html = "";
  let lista = false;
  let paragrafo = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) html += `<p>${paragrafo.join("<br>")}</p>`;
    paragrafo = [];
  };
  for (const linha of String(texto ?? "").split("\n")) {
    const item = linha.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      fecharParagrafo();
      if (!lista) { html += "<ul>"; lista = true; }
      html += `<li>${linhaParaHtml(item[1])}</li>`;
      continue;
    }
    if (lista) { html += "</ul>"; lista = false; }
    if (!linha.trim()) { fecharParagrafo(); continue; }
    paragrafo.push(linhaParaHtml(linha));
  }
  if (lista) html += "</ul>";
  fecharParagrafo();
  return html;
}

/**
 * Conteúdo do editor visual de volta para Markdown. Só negrito, itálico, links seguros,
 * listas e quebras sobrevivem; o resto vira texto simples.
 * @param {{childNodes: ArrayLike<object>}} raiz  elemento do editor (ou árvore equivalente, nos testes)
 */
export function htmlParaMarkdown(raiz) {
  const filhos = (n) => [...n.childNodes].map(converter).join("");
  function converter(n) {
    if (n.nodeType === 3) return n.nodeValue.replace(/ /g, " ");
    if (n.nodeType !== 1) return "";
    const tag = n.tagName.toUpperCase();
    const dentro = filhos(n);
    const negrito = tag === "B" || tag === "STRONG" || n.style?.fontWeight === "bold" || Number(n.style?.fontWeight) >= 600;
    const italico = tag === "I" || tag === "EM" || n.style?.fontStyle === "italic";
    if (tag === "BR") return "\n";
    if (tag === "UL" || tag === "OL") {
      return "\n" + [...n.childNodes].filter((li) => li.nodeType === 1)
        .map((li) => `- ${filhos(li).replace(/\n+/g, " ").trim()}`).join("\n") + "\n";
    }
    if (tag === "DIV" || tag === "P") return `\n${dentro}\n`;
    if (tag === "A") {
      const url = n.getAttribute("href") ?? "";
      if (!linkSeguro(url)) return dentro;
      return dentro === url ? url : `[${dentro}](${url})`;
    }
    let texto = dentro;
    if (italico && texto.trim()) texto = envolver(texto, "*");
    if (negrito && texto.trim()) texto = envolver(texto, "**");
    return texto;
  }
  return filhos(raiz).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Envolve o texto com a marca, deixando os espaços das pontas do lado de fora ("**a** b", e não "**a **b"). */
function envolver(texto, marca) {
  const [, antes, meio, depois] = texto.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return `${antes}${marca}${meio}${marca}${depois}`;
}
