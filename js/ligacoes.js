/**
 * Ligações externas da ação (seção 4.2.6; 23/11/2026): regras puras.
 *
 * Uma ligação aponta para um item de outro sistema da instituição, onde o trabalho da tarefa também anda:
 * um chamado do GLPI, um processo do SIPAC/Protocolo ou um e-mail do Horde. Guarda o sistema, o número
 * (identificador), o título e o link; nunca o conteúdo do item.
 *
 * Sem tela e sem banco: recebe dados e devolve resultados (testes em `testes/ligacoes.test.js`).
 */

/**
 * Sistemas aceitos, numa lista fechada e ampliável. `numero` é o nome do identificador na tela;
 * `padroes` reconhecem o sistema pelo endereço colado (sem depender de um domínio fixo, que muda de instituição).
 */
export const SISTEMAS = Object.freeze({
  glpi: Object.freeze({ nome: "GLPI", item: "Chamado", numero: "Número do chamado", padroes: [/\/front\/ticket\.form\.php/i, /\bglpi\b/i] }),
  sipac: Object.freeze({ nome: "SIPAC/Protocolo", item: "Processo", numero: "Número do processo", padroes: [/\/sipac\//i, /\bsipac\b/i] }),
  horde: Object.freeze({ nome: "Horde", item: "E-mail", numero: "Identificador do e-mail", padroes: [/\/imp\//i, /\bhorde\b/i] }),
});

/** Ordem dos sistemas na tela. */
export const ORDEM_DOS_SISTEMAS = Object.freeze(["glpi", "sipac", "horde"]);

export const LIMITE_DO_TITULO = 200;
export const LIMITE_DO_IDENTIFICADOR = 300;

/** Link seguro: começa com https:// ou http:// e não tem espaços. */
export const linkValido = (link) => /^https?:\/\/\S+$/i.test(String(link ?? ""));

/**
 * Reconhece o sistema pelo endereço colado e, quando o endereço traz o número, também o número.
 * GLPI: `.../front/ticket.form.php?id=1234` dá o chamado 1234. No SIPAC e no Horde, o endereço
 * guarda um número interno, que não é o do processo nem o do e-mail; o número fica para a pessoa
 * (ou para a extensão, que o lê na página).
 * @returns {{sistema: string, identificador?: string} | null}
 */
export function reconhecerLink(link) {
  if (!linkValido(link)) return null;
  const sistema = ORDEM_DOS_SISTEMAS.find((s) => SISTEMAS[s].padroes.some((p) => p.test(link)));
  if (!sistema) return null;
  if (sistema === "glpi") {
    try {
      const id = new URL(link).searchParams.get("id");
      if (id && /^\d+$/.test(id)) return { sistema, identificador: id };
    } catch { /* endereço que o navegador não entende: só o sistema */ }
  }
  return { sistema };
}

/**
 * Forma de comparar dois identificadores do mesmo sistema. Números de chamado e de processo comparam
 * só os algarismos ("23062.004512/2026-10" = "23062004512202610"); o do e-mail (Message-ID), sem os
 * sinais < > e sem diferença de maiúsculas.
 */
export function chaveDoIdentificador(sistema, identificador) {
  const t = String(identificador ?? "").trim();
  if (sistema === "horde") return t.replace(/^<|>$/g, "").toLowerCase();
  return t.replace(/\D/g, "");
}

/** Se duas ligações apontam para o mesmo item (mesmo sistema e mesmo número). */
export const mesmoItem = (a, b) => a.sistema === b.sistema && Boolean(chaveDoIdentificador(a.sistema, a.identificador))
  && chaveDoIdentificador(a.sistema, a.identificador) === chaveDoIdentificador(b.sistema, b.identificador);

/**
 * Problema dos dados de uma ligação, ou null. Exige sistema conhecido, número e link seguro; o título
 * é opcional. `existentes` são as outras ligações da mesma ação: o mesmo item não se liga duas vezes.
 * @returns {{codigo: string, mensagem: string} | null}
 */
export function problemaDaLigacao(dados, existentes = []) {
  const { sistema, identificador, titulo, link } = dados ?? {};
  if (!SISTEMAS[sistema]) return { codigo: "sistema-invalido", mensagem: "Sistema não reconhecido. Use um link do GLPI, do SIPAC/Protocolo ou do Horde." };
  const id = String(identificador ?? "").trim();
  if (!id) return { codigo: "identificador-vazio", mensagem: `Informe o ${SISTEMAS[sistema].numero.toLowerCase()}.` };
  if (id.length > LIMITE_DO_IDENTIFICADOR) return { codigo: "identificador-longo", mensagem: `O número passa de ${LIMITE_DO_IDENTIFICADOR} caracteres.` };
  if (sistema !== "horde" && !chaveDoIdentificador(sistema, id)) return { codigo: "identificador-invalido", mensagem: `O ${SISTEMAS[sistema].numero.toLowerCase()} precisa ter algarismos.` };
  if (!String(link ?? "").trim()) return { codigo: "link-vazio", mensagem: "Informe o link." };
  if (!linkValido(String(link).trim())) return { codigo: "link-invalido", mensagem: "O link deve começar com https:// ou http://." };
  if (String(titulo ?? "").trim().length > LIMITE_DO_TITULO) return { codigo: "titulo-longo", mensagem: `O título passa de ${LIMITE_DO_TITULO} caracteres.` };
  if (existentes.some((x) => mesmoItem(x, { sistema, identificador: id }))) {
    return { codigo: "ligacao-repetida", mensagem: `Este ${SISTEMAS[sistema].item.toLowerCase()} já está ligado a esta tarefa.` };
  }
  return null;
}

/** Os dados como serão gravados: só os campos preenchidos, sem espaços nas pontas. */
export function ligacaoLimpa({ sistema, identificador, titulo, link }) {
  const t = String(titulo ?? "").trim();
  return { sistema, identificador: String(identificador).trim(), ...(t ? { titulo: t } : {}), link: String(link).trim() };
}

/** Texto curto de uma ligação, para exportação, extração e histórico: "GLPI 1234 – Título". */
export function textoDaLigacao(l) {
  const nome = SISTEMAS[l.sistema]?.nome ?? l.sistema;
  return `${nome} ${l.identificador}${l.titulo ? ` – ${l.titulo}` : ""}`;
}
