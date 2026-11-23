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
 * Sistemas aceitos, numa lista fechada e ampliável. `item` diz o que é ligado; `numero`, o nome do identificador na
 * tela; `sigla`, o que vem antes do número no texto curto ("Chamado 1234", "NUP 23062…"); `exigeNumero`, se a
 * ligação precisa do número. O e-mail não tem número que a pessoa veja: o identificador é o *Message-ID* do
 * cabeçalho, lido pela extensão, e fica opcional na ligação feita à mão (23/11/2026, decisão do responsável);
 * `padroes` reconhecem o sistema pelo endereço colado (sem depender de um domínio fixo, que muda de instituição).
 */
export const SISTEMAS = Object.freeze({
  glpi: Object.freeze({ nome: "GLPI", item: "Chamado", artigo: "o", numero: "Número do chamado", sigla: "Chamado", exigeNumero: true, padroes: [/\/front\/ticket\.form\.php/i, /\bglpi\b/i] }),
  sipac: Object.freeze({ nome: "SIPAC/Protocolo", item: "Processo ou documento", artigo: "o", numero: "NUP (número único de protocolo)", sigla: "NUP", exigeNumero: true, padroes: [/\/sipac\//i, /\bsipac\b/i] }),
  horde: Object.freeze({ nome: "Horde", item: "E-mail", artigo: "o", numero: "Identificador do e-mail (opcional)", sigla: "", exigeNumero: false, padroes: [/\/imp\//i, /\bhorde\b/i] }),
});

/** Ordem dos sistemas na tela. */
export const ORDEM_DOS_SISTEMAS = Object.freeze(["glpi", "sipac", "horde"]);

/**
 * Endereço do SIPAC da instituição (23/11/2026). O SIPAC não tem link permanente para um processo: o endereço da
 * tela do processo (`.../mesa_virtual/processo.jsf`) mostra o que estiver aberto na sessão. Por isso o link de uma
 * ligação do SIPAC é sempre montado aqui, com o NUP depois de `#sextante-nup=`; o SIPAC ignora o que vem depois de
 * `#`, e a extensão (passo 3.8, parte 3) lê essa marca e abre o processo pela consulta, na sessão da pessoa.
 */
export const ENDERECO_DO_SIPAC = "https://sig.cefetmg.br/sipac/";

/** Link de um processo ou documento do SIPAC pelo NUP (ver `ENDERECO_DO_SIPAC`). */
export const linkDoSipac = (nup) => `${ENDERECO_DO_SIPAC}#sextante-nup=${encodeURIComponent(String(nup).trim())}`;

/** Lê o NUP da marca de um link do SIPAC montado por `linkDoSipac`, ou null. */
export function nupDoLink(link) {
  const m = /#sextante-nup=([^&]+)/.exec(String(link ?? ""));
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return null; }
}

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
 * Problema dos dados de uma ligação, ou null. Exige sistema conhecido, link seguro e, no GLPI e no SIPAC, o número;
 * no e-mail sem identificador, o título (o assunto), para a ligação ter como ser reconhecida na tela. O título é
 * opcional nos demais. `existentes` são as outras ligações da mesma ação: o mesmo item não se liga duas vezes
 * (sem número, não há como comparar, e a repetição não é conferida).
 * @returns {{codigo: string, mensagem: string} | null}
 */
export function problemaDaLigacao(dados, existentes = []) {
  const { sistema, identificador, titulo, link } = dados ?? {};
  if (!SISTEMAS[sistema]) return { codigo: "sistema-invalido", mensagem: "Sistema não reconhecido. Use um link do GLPI, do SIPAC/Protocolo ou do Horde." };
  const id = String(identificador ?? "").trim();
  const sis = SISTEMAS[sistema];
  if (!id && sis.exigeNumero) return { codigo: "identificador-vazio", mensagem: sistema === "sipac" ? "Informe o NUP." : "Informe o número do chamado." };
  if (!id && !String(titulo ?? "").trim()) return { codigo: "titulo-vazio", mensagem: "Informe o assunto do e-mail." };
  if (id.length > LIMITE_DO_IDENTIFICADOR) return { codigo: "identificador-longo", mensagem: `O número passa de ${LIMITE_DO_IDENTIFICADOR} caracteres.` };
  if (id && sis.exigeNumero && !chaveDoIdentificador(sistema, id)) return { codigo: "identificador-invalido", mensagem: sistema === "sipac" ? "O NUP precisa ter algarismos." : "O número do chamado precisa ter algarismos." };
  if (!String(link ?? "").trim()) return { codigo: "link-vazio", mensagem: "Informe o link." };
  if (!linkValido(String(link).trim())) return { codigo: "link-invalido", mensagem: "O link deve começar com https:// ou http://." };
  if (String(titulo ?? "").trim().length > LIMITE_DO_TITULO) return { codigo: "titulo-longo", mensagem: `O título passa de ${LIMITE_DO_TITULO} caracteres.` };
  if (existentes.some((x) => mesmoItem(x, { sistema, identificador: id }))) {
    return { codigo: "ligacao-repetida", mensagem: `Este ${sis.item.toLowerCase()} já está ligado a esta tarefa.` };
  }
  return null;
}

/** Os dados como serão gravados: só os campos preenchidos, sem espaços nas pontas. */
export function ligacaoLimpa({ sistema, identificador, titulo, link }) {
  const t = String(titulo ?? "").trim();
  const id = String(identificador ?? "").trim();
  return { sistema, ...(id ? { identificador: id } : {}), ...(t ? { titulo: t } : {}), link: String(link).trim() };
}

/**
 * Completa os dados antes de conferir e gravar: no SIPAC, o link é sempre o montado pelo NUP (`linkDoSipac`),
 * mesmo que a pessoa tenha colado outro, porque os endereços do SIPAC só valem na sessão em que foram abertos.
 */
export function completarLigacao(dados) {
  if (dados?.sistema !== "sipac" || !String(dados.identificador ?? "").trim()) return dados;
  return { ...dados, link: linkDoSipac(dados.identificador) };
}

/**
 * Número como aparece na tela: "Chamado 1234", "NUP 23062.004512/2026-10"; no e-mail, nada (o *Message-ID* é
 * técnico e não diz nada a quem lê).
 */
export function numeroNaTela(l) {
  const sis = SISTEMAS[l.sistema];
  if (!sis?.sigla || !l.identificador) return "";
  return `${sis.sigla} ${l.identificador}`;
}

/** Texto curto de uma ligação, para exportação, extração e histórico: "GLPI, Chamado 1234 – Título"; "Horde – Assunto". */
export function textoDaLigacao(l) {
  const nome = SISTEMAS[l.sistema]?.nome ?? l.sistema;
  const n = numeroNaTela(l);
  return `${nome}${n ? `, ${n}` : ""}${l.titulo ? ` – ${l.titulo}` : ""}`;
}
