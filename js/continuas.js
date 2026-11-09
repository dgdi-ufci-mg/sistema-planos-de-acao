/**
 * Ações contínuas (documentação técnica, seção 5.9; termo técnico: atividade *hammock*): regras dos marcos,
 * sem tela nem banco, para serem testadas. O cálculo das datas fica em js/calculo.js.
 *
 * Uma ação contínua começa com um marco e termina com outro. Cada marco é o projeto, uma fase, uma etapa
 * ou uma ação comum. Ela não tem dependências do tipo "termina e começa", nenhuma ação depende dela, e
 * ela não pode ser marco de outra contínua (decisões do responsável, 09/11/2026).
 */
import { ehContinua, TIPOS_DE_MARCO } from "./calculo.js";
import { usaContinuas } from "./modelos.js";

export { ehContinua, TIPOS_DE_MARCO };

/**
 * O marco como é gravado: `{tipo: "projeto"}`, `{tipo: "fase"|"etapa", id}` ou `{tipo: "acao", numero}`.
 * Devolve null se não tiver essa forma.
 */
export function normalizarMarco(m) {
  if (!m || typeof m !== "object" || !TIPOS_DE_MARCO.includes(m.tipo)) return null;
  if (m.tipo === "projeto") return { tipo: "projeto" };
  if (m.tipo === "acao") return Number.isInteger(m.numero) ? { tipo: "acao", numero: m.numero } : null;
  return typeof m.id === "string" && m.id ? { tipo: m.tipo, id: m.id } : null;
}

/** Os dois marcos são iguais? */
export const mesmoMarco = (a, b) => JSON.stringify(normalizarMarco(a)) === JSON.stringify(normalizarMarco(b));

/**
 * Problema dos marcos de uma ação, ou null. Recebe a ação como ficaria depois da gravação.
 * @param {{numero?: number, comecaCom?: object|null, terminaCom?: object|null, dependeDe?: number[]}} acao
 * @param {object[]} acoes ações ativas do espaço, como estão no banco
 * @param {object} espaco
 * @returns {{codigo: string, mensagem: string}|null}
 */
export function problemaDosMarcos(acao, acoes, espaco) {
  const { comecaCom, terminaCom } = acao;
  if (!comecaCom && !terminaCom) return null;
  if (!comecaCom || !terminaCom) return { codigo: "marcos-incompletos", mensagem: "Escolha os dois marcos: com o que a ação começa e com o que ela termina." };
  if (!usaContinuas(espaco)) return { codigo: "recurso-desligado", mensagem: "Ações contínuas só existem em espaços com estimativas e dependências." };
  const etapas = new Set((espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => e.id)));
  const fases = new Set((espaco.estrutura ?? []).map((f) => f.id));
  const porNumero = new Map(acoes.map((a) => [a.numero, a]));
  for (const [lado, m] of [["começa", comecaCom], ["termina", terminaCom]]) {
    const n = normalizarMarco(m);
    if (!n || JSON.stringify(n) !== JSON.stringify(m)) return { codigo: "marco-invalido", mensagem: `Marco inválido em “${lado} com”.` };
    if (n.tipo === "fase" && !fases.has(n.id)) return { codigo: "marco-invalido", mensagem: `A fase de “${lado} com” não existe no espaço.` };
    if (n.tipo === "etapa" && !etapas.has(n.id)) return { codigo: "marco-invalido", mensagem: `A etapa de “${lado} com” não existe no espaço.` };
    if (n.tipo === "acao") {
      if (n.numero === acao.numero) return { codigo: "marco-invalido", mensagem: "Uma ação contínua não pode ser marco dela mesma." };
      const alvo = porNumero.get(n.numero);
      if (!alvo) return { codigo: "marco-invalido", mensagem: `A ação de “${lado} com” não existe no espaço.` };
      if (ehContinua(alvo)) return { codigo: "marco-continua", mensagem: `“${alvo.rotulo}” é uma ação contínua e não pode ser marco de outra.` };
    }
  }
  if (acao.dependeDe?.length) {
    return { codigo: "continua-com-anteriores", mensagem: "Uma ação contínua não depende de outras pelo “termina e começa”: as datas dela vêm dos marcos. Retire as ações anteriores antes." };
  }
  const seguinte = acoes.find((a) => a.numero !== acao.numero && (a.dependeDe ?? []).includes(acao.numero));
  if (seguinte) return { codigo: "continua-com-seguintes", mensagem: `“${seguinte.rotulo}” depende desta ação. Uma ação contínua não pode ser anterior de outra; retire essa dependência antes.` };
  const usuaria = acoes.find((a) => a.numero !== acao.numero && ehContinua(a)
    && [a.comecaCom, a.terminaCom].some((m) => m.tipo === "acao" && m.numero === acao.numero));
  if (usuaria) return { codigo: "marco-continua", mensagem: `A ação contínua “${usuaria.rotulo}” usa esta como marco. Uma ação contínua não pode ser marco de outra; troque o marco dela antes.` };
  return null;
}

/**
 * Marcos que a pessoa pode escolher para a ação `numero`, na ordem da tela: o projeto, as fases, as etapas
 * (com o nome da fase) e as ações comuns (sem ela mesma e sem as contínuas).
 * @param {object} espaco
 * @param {object[]} acoes ações ativas, na ordem do espaço
 * @param {number|null} numero
 * @returns {{marco: object, grupo: string, nome: string}[]}
 */
export function marcosPossiveis(espaco, acoes, numero) {
  const lista = [{ marco: { tipo: "projeto" }, grupo: "Projeto", nome: "O projeto inteiro" }];
  for (const f of espaco.estrutura ?? []) lista.push({ marco: { tipo: "fase", id: f.id }, grupo: "Fases", nome: f.nome });
  for (const f of espaco.estrutura ?? []) {
    for (const e of f.etapas) lista.push({ marco: { tipo: "etapa", id: e.id }, grupo: "Etapas", nome: `${e.nome} (${f.nome})` });
  }
  for (const a of acoes) {
    if (a.numero === numero || ehContinua(a)) continue;
    lista.push({ marco: { tipo: "acao", numero: a.numero }, grupo: "Ações", nome: a.codigo ? `${a.codigo} · ${a.rotulo}` : a.rotulo });
  }
  return lista;
}

/**
 * Nome do marco, como aparece na tela: "Início do projeto", "Fim da etapa “Diagnóstico”", "Início da ação “Levantar dados”".
 * Marco que não existe mais: "(fase excluída)", "(etapa excluída)" ou "(ação excluída)".
 * @param {object} marco
 * @param {"inicio"|"fim"} lado
 * @param {object} espaco
 * @param {object[]} acoes
 */
export function nomeDoMarco(marco, lado, espaco, acoes) {
  const ponta = lado === "inicio" ? "Início" : "Fim";
  if (!marco) return "";
  if (marco.tipo === "projeto") return `${ponta} do projeto`;
  if (marco.tipo === "acao") {
    const a = acoes.find((x) => x.numero === marco.numero);
    return a ? `${ponta} da ação “${a.rotulo}”` : `${ponta} da ação (ação excluída)`;
  }
  const fases = espaco.estrutura ?? [];
  const nome = marco.tipo === "fase"
    ? fases.find((f) => f.id === marco.id)?.nome
    : fases.flatMap((f) => f.etapas).find((e) => e.id === marco.id)?.nome;
  return nome ? `${ponta} da ${marco.tipo} “${nome}”` : `${ponta} da ${marco.tipo} (${marco.tipo} excluída)`;
}

/**
 * Marco inicial sugerido quando a pessoa torna a ação contínua: os da etapa da ação, se ela tiver etapa
 * (decisão do responsável, 09/11/2026: só uma sugestão; a pessoa troca os dois); senão, os do projeto.
 * @returns {{comecaCom: object, terminaCom: object}}
 */
export function marcosSugeridos(acao, espaco) {
  const etapas = new Set((espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => e.id)));
  const m = acao.etapa && etapas.has(acao.etapa) ? { tipo: "etapa", id: acao.etapa } : { tipo: "projeto" };
  return { comecaCom: { ...m }, terminaCom: { ...m } };
}
