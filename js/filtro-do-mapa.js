/**
 * Filtros do Mapa do Strata (30/10/2026; documentação técnica, seção 8, "Mapa", "Filtros"): regras puras que decidem
 * o que o mapa mostra, por camada e por vigência, e como as linhas "vem de" passam pelos itens escondidos. Sem tela e
 * sem banco: recebe o catálogo e a escolha da pessoa, devolve os itens e os Planos de Ação prontos para `calcularMapa`.
 *
 * Especificação (independente de biblioteca; a TI vai reescrever o sistema):
 * - **Vigência de cada ponto:** o item vale pelo instrumento dele (`itemVigente`); fora dele, "ainda não começou"
 *   quando o início do instrumento é depois de hoje, e "encerrado" nos outros casos. Item sem instrumento vale
 *   sempre. O Plano de Ação está "encerrado" quando tem `encerradoEm`; senão, "vigente".
 * - **O que aparece:** o ponto cuja vigência está marcada no filtro e cuja camada não está escondida.
 * - **Fora da vigência, mas com algo vigente abaixo** (incoerência real nos dados): o item que não é vigente e tem
 *   algum descendente vigente (item ou Plano de Ação, por qualquer caminho, sem olhar os filtros) leva um **alerta**
 *   com uma frase curta. Se a vigência dele não está marcada, mas "Vigentes" está, ele **aparece mesmo assim,
 *   apagado** (`esmaecido`), para o caminho não mentir; se a vigência dele está marcada, aparece normal, com o alerta.
 *   Sem nada vigente abaixo, segue o filtro (some).
 * - **Ligações por itens escondidos:** "vem de" é transitiva. Cada ponto visível sobe pelos superiores; ao encontrar
 *   um ponto escondido (pela camada ou pela vigência), continua subindo por ele até achar o primeiro ponto visível
 *   de cada caminho. A ligação a esse ponto é **indireta** e guarda os itens escondidos do caminho (`via`). Dois
 *   caminhos até o mesmo ponto dão uma linha só; a ligação direta vence a indireta; entre indiretas, a mais curta.
 *   Sem nenhum ponto visível acima, o ponto fica solto (sem linha), mas aparece.
 */
import { instrumentoVigente, rotuloDoItem } from "./estrategia.js";
import { dataBr, plural } from "./formato.js";

/** Faixa dos Planos de Ação (a mesma de `js/mapa.js`; repetida aqui para o módulo não depender da geometria). */
const PLANOS = "planosDeAcao";

/** Vigências que o filtro marca: chave → texto da tela. */
export const VIGENCIAS = Object.freeze({ vigentes: "Vigentes", encerrados: "Encerrados", futuros: "Ainda não começaram" });
const CHAVE_DO_ESTADO = { vigente: "vigentes", encerrado: "encerrados", futuro: "futuros" };

/** Filtro ao abrir: todas as camadas, só o que vale hoje (o antigo "Só o que vale hoje", ligado). */
export const FILTRO_PADRAO = Object.freeze({ ocultas: Object.freeze([]), vigencias: Object.freeze({ vigentes: true, encerrados: false, futuros: false }) });

/** Filtro limpo a partir de um valor qualquer (por exemplo, o guardado no navegador): o que não servir vira o padrão. */
export function normalizarFiltro(valor) {
  const v = valor && typeof valor === "object" ? valor : {};
  const ocultas = Array.isArray(v.ocultas) ? [...new Set(v.ocultas.filter((x) => typeof x === "string"))] : [];
  const vigencias = {};
  for (const k of Object.keys(VIGENCIAS)) vigencias[k] = typeof v.vigencias?.[k] === "boolean" ? v.vigencias[k] : FILTRO_PADRAO.vigencias[k];
  return { ocultas, vigencias };
}

/** Quantas escolhas diferem do padrão (camadas escondidas e vigências trocadas), só das camadas que existem. */
export function mudancasDoFiltro(filtro, camadasExistentes = null) {
  const f = normalizarFiltro(filtro);
  const ocultas = camadasExistentes ? f.ocultas.filter((id) => camadasExistentes.includes(id)) : f.ocultas;
  return ocultas.length + Object.keys(VIGENCIAS).filter((k) => f.vigencias[k] !== FILTRO_PADRAO.vigencias[k]).length;
}

/** Vigência do item na data: "vigente", "encerrado" ou "futuro". */
export function vigenciaDoItem(item, instrumentos, data) {
  if (!item.instrumento) return "vigente";
  const instr = instrumentos.find((x) => x.id === item.instrumento);
  if (instrumentoVigente(instr, data)) return "vigente";
  return instr && !instr.excluidoEm && instr.inicio && instr.inicio > data ? "futuro" : "encerrado";
}

/** Vigência do Plano de Ação: "encerrado" com `encerradoEm`; senão, "vigente". */
export const vigenciaDoPlano = (plano) => (plano.encerradoEm ? "encerrado" : "vigente");

/** "2 Planos de Ação e 1 item" */
const quantos = ({ planos, itens }) => [
  planos ? `${planos} ${plural(planos, "Plano de Ação", "Planos de Ação")}` : "",
  itens ? `${itens} ${plural(itens, "item", "itens")}` : "",
].filter(Boolean).join(" e ");

/** Frase do alerta: "Encerrado em 31/12/2025, mas ainda tem 2 Planos de Ação vigentes ligados a ele." */
export function fraseDoAlerta(estado, instrumento, abaixo) {
  const total = abaixo.planos + abaixo.itens;
  const vig = plural(total, "vigente", "vigentes");
  const lig = plural(total, "ligado", "ligados");
  if (estado === "futuro") return `Começa em ${dataBr(instrumento?.inicio)}, mas já tem ${quantos(abaixo)} ${vig} ${lig} a ele.`;
  const fim = instrumento && !instrumento.excluidoEm ? instrumento.fim : null;
  return `${fim ? `Encerrado em ${dataBr(fim)}` : "Fora da vigência"}, mas ainda tem ${quantos(abaixo)} ${vig} ${lig} a ele.`;
}

/**
 * Aplica o filtro.
 * @param {object} p
 * @param {object[]} p.camadas  camadas do catálogo, de cima para baixo
 * @param {object[]} p.instrumentos
 * @param {object[]} p.itens  itens do catálogo (os excluídos são ignorados)
 * @param {{id: string, nome: string, superiores: string[], restrito?: boolean, encerradoEm?: string}[]} [p.planos]
 * @param {string} p.hoje  AAAA-MM-DD
 * @param {{ocultas: string[], vigencias: {vigentes: boolean, encerrados: boolean, futuros: boolean}}} [p.filtro]
 * @returns {{camadas: object[], itens: object[], planos: object[], semPlanos: boolean}}  prontos para `calcularMapa`:
 *   cada item e plano com `superiores` (só pontos visíveis), `via` (superior → nomes dos escondidos no caminho; vazio
 *   na ligação direta), `vigencia`, `esmaecido` e `alerta` (frase, ou null)
 */
export function filtrarParaOMapa({ camadas, instrumentos, itens, planos = [], hoje, filtro = FILTRO_PADRAO }) {
  const f = normalizarFiltro(filtro);
  const ocultas = new Set(f.ocultas);
  const ativos = itens.filter((x) => !x.excluidoEm);
  const itemPorId = new Map(ativos.map((x) => [x.id, x]));
  const instrumentoDe = (id) => instrumentos.find((x) => x.id === id);

  /* nós: os itens (chave = id) e os Planos de Ação (chave = "plano:id"), com os superiores que existem */
  const nos = new Map();
  for (const x of ativos) {
    nos.set(x.id, { chave: x.id, tipo: "item", fonte: x, camada: x.camada, vigencia: vigenciaDoItem(x, instrumentos, hoje), superiores: (x.superiores ?? []).filter((s) => itemPorId.has(s)) });
  }
  for (const e of planos) {
    nos.set(`plano:${e.id}`, { chave: `plano:${e.id}`, tipo: "plano", fonte: e, camada: PLANOS, vigencia: vigenciaDoPlano(e), superiores: (e.superiores ?? []).filter((s) => itemPorId.has(s)) });
  }
  const abaixoDe = new Map();
  for (const n of nos.values()) for (const s of n.superiores) abaixoDe.set(s, [...(abaixoDe.get(s) ?? []), n.chave]);

  /* o que há de vigente abaixo de cada item, por qualquer caminho (sem olhar os filtros) */
  const vigentesAbaixo = (chave) => {
    const visto = new Set([chave]);
    const fila = [chave];
    const conta = { itens: 0, planos: 0 };
    while (fila.length) {
      for (const k of abaixoDe.get(fila.shift()) ?? []) {
        if (visto.has(k)) continue;
        visto.add(k);
        fila.push(k);
        const n = nos.get(k);
        if (n.vigencia === "vigente") conta[n.tipo === "plano" ? "planos" : "itens"]++;
      }
    }
    return conta;
  };

  for (const n of nos.values()) {
    const abaixo = n.tipo === "item" && n.vigencia !== "vigente" ? vigentesAbaixo(n.chave) : null;
    n.alerta = abaixo && abaixo.itens + abaixo.planos ? fraseDoAlerta(n.vigencia, instrumentoDe(n.fonte.instrumento), abaixo) : null;
    const marcado = f.vigencias[CHAVE_DO_ESTADO[n.vigencia]];
    n.esmaecido = !marcado && Boolean(n.alerta) && f.vigencias.vigentes;
    n.visivel = (marcado || n.esmaecido) && !ocultas.has(n.camada);
  }

  /* superiores visíveis de cada ponto visível: sobe pelos escondidos até o primeiro visível de cada caminho */
  const resolver = (n) => {
    const via = new Map(); // superior visível → nomes dos escondidos no caminho (o caminho mais curto)
    const visto = new Set([n.chave]);
    const fila = n.superiores.map((s) => ({ chave: s, caminho: [] }));
    while (fila.length) {
      const { chave, caminho } = fila.shift();
      if (visto.has(chave)) continue;
      visto.add(chave);
      const s = nos.get(chave);
      if (s.visivel) { if (!via.has(chave)) via.set(chave, caminho); continue; }
      const nome = rotuloDoItem(s.fonte);
      for (const acima of s.superiores) fila.push({ chave: acima, caminho: [...caminho, nome] });
    }
    return via; // a busca em largura acha a ligação direta (caminho vazio) e a indireta mais curta primeiro
  };

  const saida = (n) => {
    const via = resolver(n);
    return { ...n.fonte, superiores: [...via.keys()], via: Object.fromEntries(via), vigencia: n.vigencia, esmaecido: n.esmaecido, alerta: n.alerta };
  };
  const visiveis = [...nos.values()].filter((n) => n.visivel);
  return {
    camadas: camadas.filter((c) => !ocultas.has(c.id)),
    itens: visiveis.filter((n) => n.tipo === "item").map(saida),
    planos: visiveis.filter((n) => n.tipo === "plano").map((n) => ({ ...saida(n), manter: true })),
    semPlanos: ocultas.has(PLANOS),
  };
}
