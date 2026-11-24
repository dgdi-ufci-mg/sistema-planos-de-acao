/**
 * Ligações externas da ação (seção 4.2.6; 23/11/2026): regras puras.
 *
 * Uma ligação aponta para um item de outro sistema da instituição, onde o trabalho da tarefa também anda:
 * um chamado do GLPI, um processo, documento avulso ou memorando do SIPAC/Protocolo, ou um e-mail do Horde.
 * Guarda o tipo, o sistema, o número (identificador), o título e o link; nunca o conteúdo do item.
 *
 * Sem tela e sem banco: recebe dados e devolve resultados (testes em `testes/ligacoes.test.js`).
 */

/** Sistemas de origem: o nome na tela. */
export const SISTEMAS = Object.freeze({
  glpi: Object.freeze({ nome: "GLPI" }),
  sipac: Object.freeze({ nome: "SIPAC" }),
  horde: Object.freeze({ nome: "Horde" }),
});

/**
 * Tipos de item, numa lista fechada e ampliável (24/11/2026, decisão do responsável). Cada tipo pertence a um sistema.
 * - `nome`: o que é ligado ("Processo"); `rotulo`: o nome com o sistema, como aparece na escolha ("Processo (SIPAC)");
 * - `este`: começo da frase de item repetido ("Este processo");
 * - `numero`: dica do campo do número; `sigla`: o que vem antes do número no texto ("NUP", "Chamado");
 * - `exigeNumero`: se o número é obrigatório. O e-mail não tem número que a pessoa veja: o identificador é o
 *   *Message-ID* do cabeçalho, lido pela extensão, e fica opcional na ligação à mão (23/11/2026);
 * - `linkMontado`: se o link é montado pelo Sextante a partir do NUP. Processos e documentos avulsos do SIPAC não têm
 *   link permanente: a tela do processo (`.../mesa_virtual/processo.jsf`) mostra o que estiver aberto na sessão.
 *   O memorando tem (`memorando_eletronico.jsf?idMemorandoEletronico=…`), e o link colado é guardado;
 * - `padroes`: reconhecem o tipo pelo endereço colado, sem depender de um domínio fixo.
 *
 * Não há "processo na unidade" e "processo fora da unidade", nem "memorando recebido" e "enviado": onde o processo
 * está muda com a tramitação, e recebido ou enviado depende de quem olha, mas a ligação é da tarefa, vista pela
 * equipe toda. A extensão decide na hora de abrir (24/11/2026).
 */
export const TIPOS = Object.freeze({
  processo: Object.freeze({ sistema: "sipac", nome: "Processo", rotulo: "Processo (SIPAC)", este: "Este processo", numero: "NUP", sigla: "NUP", exigeNumero: true, linkMontado: true, padroes: [] }),
  documento: Object.freeze({ sistema: "sipac", nome: "Documento avulso", rotulo: "Documento avulso (SIPAC)", este: "Este documento avulso", numero: "NUP", sigla: "NUP", exigeNumero: true, linkMontado: true, padroes: [] }),
  memorando: Object.freeze({ sistema: "sipac", nome: "Memorando", rotulo: "Memorando (SIPAC)", este: "Este memorando", numero: "NUP", sigla: "NUP", exigeNumero: true, linkMontado: false, padroes: [/memorando_eletronico\.jsf\?(?:[^#]*&)?idMemorandoEletronico=\d+/i] }),
  email: Object.freeze({ sistema: "horde", nome: "E-mail", rotulo: "E-mail (Horde)", este: "Este e-mail", numero: "Identificador (opcional)", sigla: "", exigeNumero: false, linkMontado: false, padroes: [/\/imp\//i, /\bhorde\b/i] }),
  chamado: Object.freeze({ sistema: "glpi", nome: "Chamado", rotulo: "Chamado (GLPI)", este: "Este chamado", numero: "Número do chamado", sigla: "Chamado", exigeNumero: true, linkMontado: false, padroes: [/\/front\/ticket\.form\.php/i, /\bglpi\b/i] }),
});

/** Ordem dos tipos na escolha e no reconhecimento do link. */
export const ORDEM_DOS_TIPOS = Object.freeze(["processo", "documento", "memorando", "email", "chamado"]);

/**
 * Endereço do SIPAC da instituição (23/11/2026). Escolha técnica do protótipo; no sistema definitivo, uma configuração.
 * O link de processo e de documento avulso é montado com ele: `…/sipac/#sextante-processo=<NUP>` ou
 * `#sextante-documento=<NUP>`. O SIPAC ignora o que vem depois de `#`; a extensão (passo 3.8, parte 3) lê a marca e
 * abre o item pela consulta, na sessão da pessoa: o processo, primeiro na área da unidade e, se não achar, na área
 * geral; o documento avulso, direto na área geral.
 */
export const ENDERECO_DO_SIPAC = "https://sig.cefetmg.br/sipac/";

/** Reconhece um endereço do SIPAC que não é de memorando (só para escolher o sistema). */
const PADRAO_DO_SIPAC = [/\/sipac\//i, /\bsipac\b/i];

/** Link montado de um processo ou documento avulso do SIPAC pelo NUP (ver `ENDERECO_DO_SIPAC`). */
export const linkDoSipac = (tipo, nup) => `${ENDERECO_DO_SIPAC}#sextante-${tipo}=${encodeURIComponent(String(nup).trim())}`;

/** Lê a marca de um link montado por `linkDoSipac`: `{tipo, nup}`, ou null. */
export function marcaDoLink(link) {
  const m = /#sextante-(processo|documento)=([^&]+)/.exec(String(link ?? ""));
  if (!m) return null;
  try { return { tipo: m[1], nup: decodeURIComponent(m[2]) }; } catch { return null; }
}

export const LIMITE_DO_TITULO = 200;
export const LIMITE_DO_IDENTIFICADOR = 300;

/** Link seguro: começa com https:// ou http:// e não tem espaços. */
export const linkValido = (link) => /^https?:\/\/\S+$/i.test(String(link ?? ""));

/**
 * Reconhece o tipo pelo endereço colado e, quando o endereço traz o número, também o número.
 * - GLPI: `.../front/ticket.form.php?id=1234` dá o chamado 1234.
 * - SIPAC: o link de memorando dá o tipo memorando; um link montado pelo Sextante dá o tipo e o NUP; outro endereço
 *   do SIPAC dá só o sistema (`{sistema: "sipac"}`), porque não diz se é processo ou documento avulso.
 * - Horde: o endereço guarda um número interno, que não é o do e-mail.
 * @returns {{tipo?: string, sistema: string, identificador?: string} | null}
 */
export function reconhecerLink(link) {
  if (!linkValido(link)) return null;
  const marca = marcaDoLink(link);
  if (marca) return { tipo: marca.tipo, sistema: "sipac", identificador: marca.nup };
  const tipo = ORDEM_DOS_TIPOS.find((t) => TIPOS[t].padroes.some((p) => p.test(link)));
  if (tipo === "chamado") {
    try {
      const id = new URL(link).searchParams.get("id");
      if (id && /^\d+$/.test(id)) return { tipo, sistema: "glpi", identificador: id };
    } catch { /* endereço que o navegador não entende: só o tipo */ }
  }
  if (tipo) return { tipo, sistema: TIPOS[tipo].sistema };
  if (PADRAO_DO_SIPAC.some((p) => p.test(link))) return { sistema: "sipac" };
  return null;
}

/**
 * Forma de comparar dois identificadores do mesmo sistema. Números de chamado e NUPs comparam só os algarismos
 * ("23062.004512/2026-10" = "23062004512202610"); o do e-mail (Message-ID), sem os sinais < > e sem diferença de
 * maiúsculas.
 */
export function chaveDoIdentificador(sistema, identificador) {
  const t = String(identificador ?? "").trim();
  if (sistema === "horde") return t.replace(/^<|>$/g, "").toLowerCase();
  return t.replace(/\D/g, "");
}

/**
 * Se duas ligações apontam para o mesmo item: mesmo sistema e mesmo número. No SIPAC, o NUP é único entre processos,
 * documentos avulsos e memorandos, e o tipo não entra na comparação.
 */
export const mesmoItem = (a, b) => a.sistema === b.sistema && Boolean(chaveDoIdentificador(a.sistema, a.identificador))
  && chaveDoIdentificador(a.sistema, a.identificador) === chaveDoIdentificador(b.sistema, b.identificador);

/**
 * Problema dos dados de uma ligação, ou null. Exige tipo conhecido, sistema coerente com o tipo, link seguro e, menos
 * no e-mail, o número; no e-mail sem identificador, o título (o assunto). `existentes` são as outras ligações da
 * mesma ação: o mesmo item não se liga duas vezes (sem número, não há como comparar).
 * @returns {{codigo: string, mensagem: string} | null}
 */
export function problemaDaLigacao(dados, existentes = []) {
  const { tipo, sistema, identificador, titulo, link } = dados ?? {};
  const t = TIPOS[tipo];
  if (!t) return { codigo: "tipo-invalido", mensagem: "Escolha o tipo: processo, documento avulso ou memorando do SIPAC, e-mail do Horde ou chamado do GLPI." };
  if (sistema !== t.sistema) return { codigo: "sistema-invalido", mensagem: `${t.rotulo}: o sistema deve ser o ${SISTEMAS[t.sistema].nome}.` };
  const id = String(identificador ?? "").trim();
  if (!id && t.exigeNumero) return { codigo: "identificador-vazio", mensagem: t.sigla === "NUP" ? "Informe o NUP." : "Informe o número do chamado." };
  if (!id && !String(titulo ?? "").trim()) return { codigo: "titulo-vazio", mensagem: "Informe o assunto do e-mail." };
  if (id.length > LIMITE_DO_IDENTIFICADOR) return { codigo: "identificador-longo", mensagem: `O número passa de ${LIMITE_DO_IDENTIFICADOR} caracteres.` };
  if (id && t.exigeNumero && !chaveDoIdentificador(sistema, id)) return { codigo: "identificador-invalido", mensagem: t.sigla === "NUP" ? "O NUP precisa ter algarismos." : "O número do chamado precisa ter algarismos." };
  if (!String(link ?? "").trim()) return { codigo: "link-vazio", mensagem: tipo === "memorando" ? "Cole o link do memorando." : "Informe o link." };
  if (!linkValido(String(link).trim())) return { codigo: "link-invalido", mensagem: "O link deve começar com https:// ou http://." };
  if (String(titulo ?? "").trim().length > LIMITE_DO_TITULO) return { codigo: "titulo-longo", mensagem: `O título passa de ${LIMITE_DO_TITULO} caracteres.` };
  if (existentes.some((x) => mesmoItem(x, { sistema, identificador: id }))) {
    return { codigo: "ligacao-repetida", mensagem: `${t.este} já está ligado a esta tarefa.` };
  }
  return null;
}

/** Os dados como serão gravados: só os campos preenchidos, sem espaços nas pontas. */
export function ligacaoLimpa({ tipo, sistema, identificador, titulo, link }) {
  const t = String(titulo ?? "").trim();
  const id = String(identificador ?? "").trim();
  return { tipo, sistema, ...(id ? { identificador: id } : {}), ...(t ? { titulo: t } : {}), link: String(link).trim() };
}

/**
 * Completa os dados antes de conferir e gravar: o sistema vem do tipo; no processo e no documento avulso do SIPAC, o
 * link é sempre o montado pelo NUP (`linkDoSipac`), mesmo que a pessoa tenha colado outro, porque esses endereços do
 * SIPAC só valem na sessão em que foram abertos.
 */
export function completarLigacao(dados) {
  const t = TIPOS[dados?.tipo];
  if (!t) return dados;
  const completos = { ...dados, sistema: t.sistema };
  if (t.linkMontado && String(dados.identificador ?? "").trim()) completos.link = linkDoSipac(dados.tipo, dados.identificador);
  return completos;
}

/** Número como aparece na tela: "NUP 23062.004512/2026-10", "Chamado 1234"; no e-mail, nada (o Message-ID é técnico). */
export function numeroNaTela(l) {
  const t = TIPOS[l.tipo];
  if (!t?.sigla || !l.identificador) return "";
  return `${t.sigla} ${l.identificador}`;
}

/**
 * Texto curto, para exportação, extração e histórico: "Processo (SIPAC), NUP 23062… – Título";
 * "Chamado (GLPI) 1234 – Título" (sem repetir "Chamado"); "E-mail (Horde) – Assunto".
 */
export function textoDaLigacao(l) {
  const t = TIPOS[l.tipo];
  const rotulo = t?.rotulo ?? SISTEMAS[l.sistema]?.nome ?? l.sistema;
  const n = !l.identificador || !t?.sigla ? "" : t.sigla === t.nome ? ` ${l.identificador}` : `, ${t.sigla} ${l.identificador}`;
  return `${rotulo}${n}${l.titulo ? ` – ${l.titulo}` : ""}`;
}
