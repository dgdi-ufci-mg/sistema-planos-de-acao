/**
 * Campos personalizados das ações (documentação técnica, seções 4.1.14 e 16.8; passo 3.6). Regras puras, sem tela nem banco.
 *
 * Cada espaço pode criar os seus campos, como no Redmine, no Trello e no Jira: "Nº do processo SEI", "Unidade
 * demandante", "Branch". O espaço guarda o catálogo (`camposPersonalizados`); a ação guarda os valores
 * (`valoresPersonalizados`), um mapa do id do campo para o valor, gravado um campo de cada vez (seção 4.6).
 *
 * Limitado de propósito, para não virar um construtor de bancos de dados: seis tipos, no máximo
 * `LIMITE_DE_CAMPOS` campos ativos, sem fórmulas, relações, obrigatoriedade nem valor padrão. O tipo é
 * escolhido na criação e não muda; o campo não é apagado, e sim arquivado, com os valores guardados.
 */

/** Tipos de campo, na ordem do menu: [tipo guardado, nome na tela, explicação curta]. */
export const TIPOS_DE_CAMPO = Object.freeze([
  ["texto", "Texto curto", "Uma linha, como um número de processo ou um nome."],
  ["numero", "Número", "Quantidade ou valor, como 3 ou 1.250,50."],
  ["data", "Data", "Um dia do calendário."],
  ["opcao", "Lista de opções", "Uma escolha entre opções definidas aqui."],
  ["simNao", "Sim ou não", "Uma marca, como “Precisa de parecer”."],
  ["link", "Link", "Endereço na internet, como a branch no GitHub ou um documento."],
]);
const TIPOS = new Set(TIPOS_DE_CAMPO.map(([t]) => t));

/** Campos ativos (não arquivados) por espaço: o bastante para equipes, pouco para virar um banco de dados. */
export const LIMITE_DE_CAMPOS = 8;
/** Tamanho máximo do nome do campo e do nome de cada opção. */
export const TAMANHO_DO_NOME = 40;
/** Tamanho máximo do valor de texto e de link. */
export const TAMANHO_DO_TEXTO = 200;

/** Nome do tipo na tela. */
export const nomeDoTipo = (tipo) => TIPOS_DE_CAMPO.find(([t]) => t === tipo)?.[1] ?? tipo;

/** Catálogo inteiro, com os arquivados, na ordem de cadastro. */
export const camposDe = (espaco) => espaco?.camposPersonalizados ?? [];
/** Campos ativos, na ordem de cadastro: os que aparecem na janela da ação e nas exportações. */
export const camposAtivos = (espaco) => camposDe(espaco).filter((c) => !c.arquivado);
/** Campo do catálogo pelo id, ou null. */
export const campoPorId = (espaco, id) => camposDe(espaco).find((c) => c.id === id) ?? null;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const LINK = /^https?:\/\/\S+$/i;
const vazio = (v) => v == null || (typeof v === "string" && v.trim() === "");

/** Data do calendário que existe de verdade (não aceita 31/02). */
function dataValida(texto) {
  if (!DATA_ISO.test(texto)) return false;
  const [a, m, d] = texto.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Número digitado no formato brasileiro ("1.250,50") ou com ponto decimal ("1250.5"). Devolve o número ou NaN.
 * Com vírgula, o ponto é separador de milhar; sem vírgula, um ponto só é decimal.
 */
export function lerNumero(entrada) {
  if (typeof entrada === "number") return entrada;
  let t = String(entrada ?? "").trim().replace(/\s/g, "");
  if (!t) return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/**
 * Valor no formato guardado, a partir do que a pessoa informou, ou o problema.
 * Vazio vira null (a chave sai do mapa). Texto e link sem espaços nas pontas; número como número;
 * data AAAA-MM-DD; opção pelo id (ou pelo nome, sem diferenciar maiúsculas); sim/não como true/false.
 * @returns {{valor: any}|{problema: {codigo: string, mensagem: string}}}
 */
export function valorDoCampo(campo, entrada) {
  const erro = (codigo, mensagem) => ({ problema: { codigo, mensagem } });
  if (campo.tipo === "simNao") {
    if (entrada == null || entrada === "") return { valor: null };
    if (typeof entrada === "boolean") return { valor: entrada };
    const t = String(entrada).trim().toLowerCase();
    if (["sim", "s", "true", "1"].includes(t)) return { valor: true };
    if (["não", "nao", "n", "false", "0"].includes(t)) return { valor: false };
    return erro("valor-invalido", `“${campo.nome}”: responda sim ou não.`);
  }
  if (vazio(entrada)) return { valor: null };
  switch (campo.tipo) {
    case "texto": {
      const t = String(entrada).trim().replace(/\s+/g, " ");
      if (t.length > TAMANHO_DO_TEXTO) return erro("texto-longo", `“${campo.nome}” passa de ${TAMANHO_DO_TEXTO} caracteres.`);
      return { valor: t };
    }
    case "numero": {
      const n = lerNumero(entrada);
      if (!Number.isFinite(n)) return erro("numero-invalido", `“${campo.nome}”: informe um número, como 3 ou 1.250,50.`);
      return { valor: n };
    }
    case "data": {
      const t = String(entrada).trim();
      if (!dataValida(t)) return erro("data-invalida", `“${campo.nome}”: data inválida.`);
      return { valor: t };
    }
    case "opcao": {
      const t = String(entrada).trim();
      const opcao = (campo.opcoes ?? []).find((o) => o.id === t) ?? (campo.opcoes ?? []).find((o) => o.nome.trim().toLowerCase() === t.toLowerCase());
      if (!opcao) return erro("opcao-inexistente", `“${campo.nome}”: a opção “${t}” não existe.`);
      return { valor: opcao.id };
    }
    case "link": {
      const t = String(entrada).trim();
      if (!LINK.test(t)) return erro("link-invalido", `“${campo.nome}”: o link deve começar com https:// ou http://.`);
      if (t.length > TAMANHO_DO_TEXTO * 5) return erro("texto-longo", `“${campo.nome}”: link longo demais.`);
      return { valor: t };
    }
    default: return erro("tipo-invalido", `Tipo de campo desconhecido: “${campo.tipo}”.`);
  }
}

/** O valor já guardado está no formato do tipo? (para gravações da ação inteira: restauração, cópias, importação) */
export function valorGuardadoValido(campo, valor) {
  if (valor == null) return false;
  switch (campo.tipo) {
    case "simNao": return typeof valor === "boolean";
    case "numero": return typeof valor === "number" && Number.isFinite(valor);
    case "opcao": return typeof valor === "string" && (campo.opcoes ?? []).some((o) => o.id === valor);
    default: {
      if (typeof valor !== "string") return false;
      const r = valorDoCampo(campo, valor);
      return !r.problema && r.valor === valor;
    }
  }
}

const NUMERO_BR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });

/** Valor como texto, para a tela, o histórico e as exportações. Vazio: "". */
export function textoDoValor(campo, valor) {
  if (valor == null || !campo) return "";
  switch (campo.tipo) {
    case "simNao": return valor === true ? "Sim" : valor === false ? "Não" : "";
    case "numero": return typeof valor === "number" ? NUMERO_BR.format(valor) : String(valor);
    case "data": return String(valor).split("-").reverse().join("/");
    case "opcao": return (campo.opcoes ?? []).find((o) => o.id === valor)?.nome ?? "(opção retirada)";
    default: return String(valor);
  }
}

/** Valores da ação, na ordem do catálogo, só dos campos ativos e com valor: [{campo, valor, texto}]. */
export function valoresDaAcao(espaco, acao) {
  const valores = acao?.valoresPersonalizados ?? {};
  return camposAtivos(espaco)
    .filter((c) => valores[c.id] != null)
    .map((c) => ({ campo: c, valor: valores[c.id], texto: textoDoValor(c, valores[c.id]) }));
}

/**
 * Nomes que já são de campos do sistema, na tela e nas colunas de "Copiar para planilha": um campo personalizado com
 * um deles criaria duas colunas iguais e confundiria quem lê (e a importação).
 */
const RESERVADOS = new Set(["numero", "codigo", "fase", "etapa", "acao", "tarefa", "nome", "descricao", "justificativa", "local",
  "depende de", "otimista", "mais provavel", "pessimista", "estimativa", "data-limite", "data limite", "nao comeca antes de",
  "responsaveis", "responsavel", "prioridade da equipe", "etiquetas", "etiqueta", "documentos", "documentos e links",
  "entrega do plano de acao", "situacao", "atrasada", "inicio previsto", "conclusao prevista", "concluida em", "anotacoes", "checklist"]);
const semAcento = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
/** O nome é de um campo do sistema? */
export const nomeReservado = (nome) => RESERVADOS.has(semAcento(nome).replace(/\s+/g, " "));

/** Nome do campo, sem espaços nas pontas e sem espaços repetidos. */
const limpo = (nome) => String(nome ?? "").trim().replace(/\s+/g, " ");

/**
 * Problema do catálogo de campos, ou null: id vazio ou repetido; nome vazio, longo ou repetido; tipo
 * desconhecido; opções só no tipo lista, com id e nome únicos; mais de `LIMITE_DE_CAMPOS` ativos.
 * @returns {{codigo: string, mensagem: string}|null}
 */
export function problemaDosCampos(espaco) {
  const ids = new Set();
  const nomes = new Set();
  let ativos = 0;
  for (const c of camposDe(espaco)) {
    if (!c.id || ids.has(c.id)) return { codigo: "id-repetido", mensagem: "Campo personalizado com identificador repetido." };
    ids.add(c.id);
    const nome = limpo(c.nome);
    if (!nome) return { codigo: "nome-vazio", mensagem: "Todo campo precisa de nome." };
    if (nome.length > TAMANHO_DO_NOME) return { codigo: "nome-longo", mensagem: `O nome “${nome.slice(0, TAMANHO_DO_NOME)}…” passa de ${TAMANHO_DO_NOME} caracteres.` };
    if (nomes.has(nome.toLowerCase())) return { codigo: "nome-repetido", mensagem: `Já existe o campo “${nome}”.` };
    if (nomeReservado(nome)) return { codigo: "nome-reservado", mensagem: `“${nome}” já é um campo do sistema. Escolha outro nome.` };
    nomes.add(nome.toLowerCase());
    if (!TIPOS.has(c.tipo)) return { codigo: "tipo-invalido", mensagem: `Tipo de campo desconhecido: “${c.tipo}”.` };
    if (c.arquivado != null && typeof c.arquivado !== "boolean") return { codigo: "valor-invalido", mensagem: "Arquivado: informe sim ou não." };
    if (c.tipo !== "opcao" && c.opcoes != null) return { codigo: "opcoes-fora-do-tipo", mensagem: `Só a lista de opções tem opções (“${nome}”).` };
    if (c.tipo === "opcao") {
      const idsOp = new Set();
      const nomesOp = new Set();
      for (const o of c.opcoes ?? []) {
        if (!o.id || idsOp.has(o.id)) return { codigo: "id-repetido", mensagem: `Opção com identificador repetido em “${nome}”.` };
        idsOp.add(o.id);
        const n = limpo(o.nome);
        if (!n) return { codigo: "nome-vazio", mensagem: `Toda opção de “${nome}” precisa de nome.` };
        if (n.length > TAMANHO_DO_NOME) return { codigo: "nome-longo", mensagem: `A opção “${n.slice(0, TAMANHO_DO_NOME)}…” passa de ${TAMANHO_DO_NOME} caracteres.` };
        if (nomesOp.has(n.toLowerCase())) return { codigo: "nome-repetido", mensagem: `A opção “${n}” aparece duas vezes em “${nome}”.` };
        nomesOp.add(n.toLowerCase());
      }
    }
    if (!c.arquivado) ativos += 1;
  }
  if (ativos > LIMITE_DE_CAMPOS) return { codigo: "campos-demais", mensagem: `O espaço pode ter até ${LIMITE_DE_CAMPOS} campos personalizados em uso. Arquive um antes de criar ou restaurar outro.` };
  return null;
}

/**
 * Problema dos valores de uma ação, gravados de uma vez (criação, importação, restauração), ou null.
 * Cada chave precisa ser um campo do catálogo, com o valor no formato do tipo. Campos arquivados aceitam o
 * valor que já tinham (restauração de cópias), mas a tela não os oferece.
 */
export function problemaDosValores(espaco, valores) {
  if (valores == null) return null;
  if (typeof valores !== "object" || Array.isArray(valores)) return { codigo: "valor-invalido", mensagem: "Valores personalizados inválidos." };
  for (const [id, valor] of Object.entries(valores)) {
    const campo = campoPorId(espaco, id);
    if (!campo) return { codigo: "nao-encontrado", mensagem: "Campo personalizado não encontrado neste espaço." };
    if (!valorGuardadoValido(campo, valor)) return { codigo: "valor-invalido", mensagem: `Valor inválido em “${campo.nome}”.` };
  }
  return null;
}
