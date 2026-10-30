/**
 * Regras da Planilha do Strata (documentação técnica, seção 8, "Strata", "Planilha"; 30/10/2026, pedido do responsável),
 * sem tela, para serem testadas com o Node: as colunas, as linhas com as alterações ainda não salvas, os problemas de
 * cada linha, o filtro, a ordem, o desfazer e refazer, o que copiar e colar numa célula e o plano de gravação.
 *
 * As alterações ficam **pendentes** (em memória, por item e por campo) até a pessoa salvar: a célula alterada fica
 * marcada, e "Desfazer" e "Refazer" andam por elas. Ao salvar, cada item muda pelas operações de sempre do Store
 * (`alterarItemEstrategico`, `ligarSuperior`, `desligarSuperior`), que repetem as mesmas validações.
 */
import { camadasAcima, problemaDoItem, rotuloDoItem, subordinadosDe } from "./estrategia.js";
import { vigenciaDoItem } from "./filtro-do-mapa.js";

/** Vigência de cada item, como texto da coluna (os mesmos estados dos Filtros do Mapa, `vigenciaDoItem`). */
export const VIGENCIA_TEXTO = Object.freeze({ vigente: "Vigente", encerrado: "Encerrado", futuro: "Ainda não começou" });

/**
 * Colunas, na ordem de partida. `editavel`: a célula muda na planilha (só para o Gestor da Estratégia, e só no
 * computador); `tipo`: "texto", "lista" (uma opção) ou "varios" (várias opções); `fixa`: não se esconde.
 * A camada não se edita: um item noutra camada é outro item (seção 4.11.4).
 */
export const COLUNAS = Object.freeze([
  { id: "codigo", titulo: "Código", editavel: true, tipo: "texto", fixa: true },
  { id: "nome", titulo: "Nome", editavel: true, tipo: "texto", fixa: true },
  { id: "camada", titulo: "Camada", editavel: false },
  { id: "instrumento", titulo: "Instrumento", editavel: true, tipo: "lista" },
  { id: "vigencia", titulo: "Vigência", editavel: false },
  { id: "superiores", titulo: "Vem de", editavel: true, tipo: "varios" },
  { id: "subordinados", titulo: "Subordinados", editavel: false },
  { id: "planos", titulo: "Planos de Ação", editavel: false },
].map(Object.freeze));

/** Campos do item que a planilha altera. */
const CAMPOS = ["codigo", "nome", "instrumento", "superiores"];
const igual = (a, b) => (Array.isArray(a) || Array.isArray(b)) ? JSON.stringify(a ?? []) === JSON.stringify(b ?? []) : (a ?? "") === (b ?? "");

/**
 * Colunas mostradas, a partir da preferência guardada ({ordem, ocultas}): as fixas sempre aparecem; coluna nova
 * (que a preferência não conhece) entra no fim; id que não existe mais é ignorado.
 * @returns {object[]} colunas visíveis, na ordem escolhida
 */
export function colunasVisiveis(preferencia = {}) {
  const ids = COLUNAS.map((c) => c.id);
  const ordem = [...(preferencia.ordem ?? []).filter((id) => ids.includes(id)), ...ids.filter((id) => !(preferencia.ordem ?? []).includes(id))];
  const ocultas = new Set(preferencia.ocultas ?? []);
  return ordem.map((id) => COLUNAS.find((c) => c.id === id)).filter((c) => c.fixa || !ocultas.has(c.id));
}

/** Item como ficaria com as alterações pendentes. */
export const itemEfetivo = (item, pendentes) => ({ ...item, ...(pendentes.get(item.id) ?? {}) });

/**
 * Registra um valor numa célula: devolve as pendências novas (o original não muda). Voltar ao valor gravado tira a
 * pendência daquele campo.
 * @param {Map<string, object>} pendentes id → campos alterados
 */
export function registrarValor(pendentes, item, campo, valor) {
  if (!CAMPOS.includes(campo)) throw new Error(`Campo que a planilha não altera: ${campo}`);
  const novas = new Map(pendentes);
  const campos = { ...(novas.get(item.id) ?? {}) };
  if (igual(item[campo], valor)) delete campos[campo];
  else campos[campo] = valor;
  if (Object.keys(campos).length) novas.set(item.id, campos);
  else novas.delete(item.id);
  return novas;
}

/** Número de células alteradas e ainda não salvas. */
export const contarPendencias = (pendentes) => [...pendentes.values()].reduce((n, c) => n + Object.keys(c).length, 0);

/**
 * Desfazer e refazer das alterações ainda não salvas. Cada passo é uma célula: {id, campo, antes, depois}.
 * Um passo novo apaga o que havia para refazer.
 */
export function criarHistoricoDeEdicao() {
  let feitos = [];
  let desfeitos = [];
  return {
    registrar(passo) { if (!igual(passo.antes, passo.depois)) { feitos.push(passo); desfeitos = []; } },
    /** @returns {object|null} o passo a desfazer (aplique `antes`) */
    desfazer() { const p = feitos.pop(); if (p) desfeitos.push(p); return p ?? null; },
    /** @returns {object|null} o passo a refazer (aplique `depois`) */
    refazer() { const p = desfeitos.pop(); if (p) feitos.push(p); return p ?? null; },
    get podeDesfazer() { return feitos.length > 0; },
    get podeRefazer() { return desfeitos.length > 0; },
    limpar() { feitos = []; desfeitos = []; },
  };
}

/**
 * Problemas de uma linha, já com as alterações pendentes de todas as linhas (um código repetido entre duas linhas
 * alteradas aparece nas duas). `bloqueia`: impede salvar; senão, é só um aviso (item ainda sem superior).
 * @returns {{campo: string, mensagem: string, bloqueia: boolean}[]}
 */
export function problemasDaLinha(item, { camadas, itens, instrumentos }) {
  const lista = [];
  const p = problemaDoItem(item, { camadas, itens, instrumentos });
  if (p) {
    const campo = { "nome-vazio": "nome", "codigo-ocupado": "codigo", "superior-repetido": "superiores", "camada-errada": "superiores" }[p.codigo]
      ?? (p.mensagem.startsWith("Instrumento") ? "instrumento" : p.mensagem.startsWith("Item superior") ? "superiores" : "nome");
    lista.push({ campo, mensagem: p.mensagem, bloqueia: true });
  }
  if (!(item.superiores ?? []).length && camadasAcima(camadas, item.camada).length && itens.some((x) => !x.excluidoEm && camadasAcima(camadas, item.camada).includes(x.camada))) {
    lista.push({ campo: "superiores", mensagem: "Ainda não está ligado a um superior.", bloqueia: false });
  }
  return lista;
}

/**
 * Linhas da planilha: os itens ativos, já com as alterações pendentes, a vigência (`vigenciaDoItem`), os valores de
 * cada coluna para mostrar e os problemas.
 * @param {{camadas: object[], instrumentos: object[], itens: object[]}} cat
 * @param {{pendentes?: Map, hoje: string, planos?: {id: string, vinculos: string[]}[]}} opcoes
 */
export function linhasDaPlanilha(cat, { pendentes = new Map(), hoje, planos = [] }) {
  const ativos = cat.itens.filter((x) => !x.excluidoEm);
  const efetivos = ativos.map((x) => itemEfetivo(x, pendentes));
  const catEfetivo = { ...cat, itens: efetivos };
  const instrumentoDe = (id) => cat.instrumentos.find((x) => x.id === id && !x.excluidoEm);
  const itemDe = (id) => efetivos.find((x) => x.id === id);
  return efetivos.map((item) => {
    const original = ativos.find((x) => x.id === item.id);
    const camada = cat.camadas.find((c) => c.id === item.camada);
    const instr = instrumentoDe(item.instrumento);
    const vigencia = vigenciaDoItem(item, cat.instrumentos, hoje);
    const subs = subordinadosDe(item.id, efetivos).length;
    const nPlanos = planos.filter((e) => (e.vinculos ?? []).includes(item.id)).length;
    const recebePlanos = camadasAcima(cat.camadas, null).includes(item.camada);
    return {
      id: item.id,
      item,
      original,
      vigencia,
      posicaoDaCamada: cat.camadas.findIndex((c) => c.id === item.camada),
      alterados: new Set(Object.keys(pendentes.get(item.id) ?? {})),
      problemas: problemasDaLinha(item, catEfetivo),
      texto: {
        codigo: item.codigo ?? "",
        nome: item.nome ?? "",
        camada: camada?.nome ?? "",
        instrumento: instr?.nome ?? (item.instrumento ? "Instrumento retirado" : "Sem instrumento"),
        vigencia: VIGENCIA_TEXTO[vigencia],
        superiores: (item.superiores ?? []).map((id) => rotuloDoItem(itemDe(id))).join("; "),
        subordinados: subs ? String(subs) : "",
        planos: recebePlanos ? (nPlanos ? String(nPlanos) : "") : "",
      },
      numero: { subordinados: subs, planos: nPlanos },
    };
  });
}

/**
 * Filtra e ordena as linhas. `busca`: em todas as colunas, sem diferenciar acentos e maiúsculas; `camada` e
 * `instrumento`: id (instrumento "" é "sem instrumento"); `vigencia`: "vigente", "encerrado" ou "futuro" (vazio: todas);
 * `soProblemas`: só as linhas com problema ou aviso.
 * Sem ordem escolhida: por camada, de cima para baixo, depois código (números em ordem natural) e nome.
 * @param {{busca?: string, camada?: string|null, instrumento?: string|null, vigencia?: string|null, soProblemas?: boolean, ordem?: {coluna: string, sentido: 1|-1}|null}} f
 * @param {(t: string) => string} normalizar sem acentos e em minúsculas (js/acao.js)
 */
export function filtrarEOrdenar(linhas, f, normalizar) {
  const termo = normalizar(f.busca ?? "").trim();
  const filtradas = linhas.filter((l) => (!f.camada || l.item.camada === f.camada)
    && (f.instrumento == null || (l.item.instrumento ?? "") === f.instrumento)
    && (!f.vigencia || l.vigencia === f.vigencia)
    && (!f.soProblemas || l.problemas.length)
    && (!termo || Object.values(l.texto).some((v) => normalizar(v).includes(termo))));
  const natural = (a, b) => String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", { numeric: true, sensitivity: "base" });
  const padrao = (a, b) => a.posicaoDaCamada - b.posicaoDaCamada || natural(a.texto.codigo, b.texto.codigo) || natural(a.texto.nome, b.texto.nome);
  const col = f.ordem?.coluna;
  const porColuna = !col ? () => 0
    : col === "camada" ? (a, b) => a.posicaoDaCamada - b.posicaoDaCamada
    : col in (filtradas[0]?.numero ?? {}) ? (a, b) => a.numero[col] - b.numero[col]
    : (a, b) => {
      /* vazios sempre no fim, nos dois sentidos */
      const va = a.texto[col]; const vb = b.texto[col];
      if (!va !== !vb) return (!va ? 1 : -1) * (f.ordem.sentido ?? 1);
      return natural(va, vb);
    };
  return [...filtradas].sort((a, b) => (porColuna(a, b) * (f.ordem?.sentido ?? 1)) || padrao(a, b));
}

/**
 * Agrupa as linhas por camada, na ordem das camadas (só as que têm linhas).
 * @returns {{camada: object, linhas: object[]}[]}
 */
export function agruparPorCamada(linhas, camadas) {
  return camadas.map((camada) => ({ camada, linhas: linhas.filter((l) => l.item.camada === camada.id) })).filter((g) => g.linhas.length);
}

/**
 * Superiores que um item pode ter: os itens ativos das camadas permitidas (`camadasAcima`), menos ele mesmo.
 */
export function candidatosASuperior(item, { camadas, itens }) {
  const permitidas = camadasAcima(camadas, item.camada);
  return itens.filter((x) => !x.excluidoEm && x.id !== item.id && permitidas.includes(x.camada));
}

/**
 * Valor colado (ou digitado) numa célula, a partir de texto. Instrumento: pelo nome, sem diferenciar acentos e
 * maiúsculas; vazio é "sem instrumento". Superiores: códigos ou nomes separados por ponto e vírgula, só entre os
 * permitidos para o item.
 * @returns {{valor?: any, erro?: string}}
 */
export function lerValorDaCelula(coluna, texto, item, cat, normalizar) {
  const t = String(texto ?? "").replace(/\r?\n$/, "").trim();
  if (coluna === "codigo") {
    if (t.length > 20) return { erro: "O código tem no máximo 20 caracteres." };
    return { valor: t };
  }
  if (coluna === "nome") {
    if (/\n/.test(t)) return { erro: "Cole um texto de uma linha só." };
    if (t.length > 200) return { erro: "O nome tem no máximo 200 caracteres." };
    return { valor: t };
  }
  if (coluna === "instrumento") {
    if (!t || normalizar(t) === normalizar("Sem instrumento")) return { valor: null };
    const achado = cat.instrumentos.find((x) => !x.excluidoEm && normalizar(x.nome) === normalizar(t));
    return achado ? { valor: achado.id } : { erro: `Não há instrumento chamado “${t}”.` };
  }
  if (coluna === "superiores") {
    const candidatos = candidatosASuperior(item, cat);
    const ids = [];
    for (const parte of t.split(/[;\n]/).map((p) => p.trim()).filter(Boolean)) {
      const n = normalizar(parte);
      const achado = candidatos.find((x) => (x.codigo && normalizar(x.codigo) === n) || normalizar(x.nome) === n || normalizar(rotuloDoItem(x)) === n);
      if (!achado) return { erro: `“${parte}” não é um superior possível para este item.` };
      if (!ids.includes(achado.id)) ids.push(achado.id);
    }
    return { valor: ids };
  }
  return { erro: "Esta coluna não se altera." };
}

/**
 * Plano de gravação das alterações pendentes: por item, primeiro os campos (código, nome, instrumento) e depois as
 * ligações a fazer e a desfazer. Ligações vêm depois de todos os campos, porque podem depender de um código novo.
 * @returns {{id: string, campos: object|null, ligar: string[], desligar: string[]}[]}
 */
export function planoDeGravacao(itens, pendentes) {
  const plano = [];
  for (const [id, campos] of pendentes) {
    const original = itens.find((x) => x.id === id);
    if (!original) continue;
    const { superiores, ...resto } = campos;
    const antes = original.superiores ?? [];
    plano.push({
      id,
      campos: Object.keys(resto).length ? resto : null,
      ligar: superiores ? superiores.filter((s) => !antes.includes(s)) : [],
      desligar: superiores ? antes.filter((s) => !superiores.includes(s)) : [],
    });
  }
  return plano;
}
