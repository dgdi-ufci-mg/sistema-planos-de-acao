/**
 * Migração dos dados da versão atual para a versão 2 (especificação, seção 11; preparação do
 * passo 1.20, feita no lote de 22/10/2026): regras, sem banco e sem tela.
 *
 * Entra a cópia de segurança da versão atual (botão "Copiar cópia de segurança": formato
 * `planos-de-acao`, versão 1, com `projects`, `tasks` e `people`). Sai uma cópia de segurança da
 * versão 2 (formato `sextante-copia-de-seguranca`, versão 2), que a própria versão 2 confere e
 * restaura num banco vazio ("Configurar o sistema" > Cópia de segurança). Assim a migração não
 * grava nada por conta própria: o resultado pode ser conferido antes, e o original fica intocado.
 *
 * Regras da seção 11, com as decisões provisórias registradas no diário de execução:
 * - `name`/`desc` → `rotulo`/`descricao` (sem nome, a descrição vira rótulo; descrição igual ao
 *   rótulo fica vazia);
 * - `stage` (texto) → etapa de uma fase única "Fase 1", na ordem em que aparecem;
 * - `id` da tarefa → `codigo` (normalizado; inválido fica de fora, com aviso), com `codigos` ligado;
 *   `numero` dado na ordem das tarefas;
 * - `preds` (códigos) → `dependeDe` (números); `owners` → `responsaveis`; `order` → `ordem`;
 * - `o, m, p` → primeira estimativa, `contaDe: "liberacao"`, frações arredondadas para cima;
 * - `aF` → `concluidaEm`; `cost`, `ac`, `pct`, `aS` e `status` são descartados;
 * - `holidays` → `datasExcluidas` com motivo vazio;
 * - `baseline` → retrato "Plano original", com as datas guardadas;
 * - `people` → responsáveis do espaço em que são citados; o tipo (pessoa ou unidade) vem da lista
 *   `unidades`, escolhida antes; os tons são distribuídos na ordem das ações.
 */
import { CAMPOS } from "./modelo.js";
import { normalizarCodigo } from "./acao.js";
import { ajustarTons } from "./responsaveis.js";
import { criarCalendario } from "./calendario.js";
import { montarRetrato } from "./retrato.js";
import { SEMENTE_PADRAO, SIMULACOES_PADRAO } from "./dados.js";

const CODIGO_VALIDO = /^[A-Z0-9]{2,8}$/;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "07/09/2026, 12/10/2026" → ["2026-09-07", "2026-10-12"]; o que não for data fica de fora. */
export function lerFeriados(texto) {
  return [...new Set(String(texto ?? "").split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = p.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : DATA_ISO.test(p) ? p : null;
  }).filter(Boolean))].sort();
}

/** Só os campos do dicionário (seção 4), sem vazios. */
const limpar = (objeto, entidade) => Object.fromEntries(Object.entries(objeto)
  .filter(([k, v]) => CAMPOS[entidade].includes(k) && v !== undefined));

/**
 * @param {object} copia cópia de segurança da versão atual
 * @param {{unidades?: string[], agora?: string, novoId?: () => string, retratos?: boolean}} [opcoes]
 *   unidades: ids das pessoas da versão atual que são unidades; agora: momento da migração;
 *   retratos: false pula o retrato "Plano original" (que roda a simulação)
 * @returns {{copia: object, relatorio: {espacos: object[], avisos: string[]}}}
 */
export function migrarCopiaV1(copia, { unidades = [], agora = new Date().toISOString(), novoId = () => globalThis.crypto.randomUUID(), retratos = true } = {}) {
  if (copia?.sistema !== "planos-de-acao" && !(copia?.projects && copia?.tasks)) {
    throw new Error("Este arquivo não é uma cópia de segurança da versão atual.");
  }
  const pessoas = copia.people ?? {};
  const avisosGerais = [];
  const relatorio = { espacos: [], avisos: avisosGerais };
  const espacos = Object.entries(copia.projects ?? {})
    .sort(([, a], [, b]) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))
    .map(([pid, p]) => migrarPlano(pid, p, Object.entries(copia.tasks?.[pid] ?? {}), pessoas, { unidades, agora, novoId, retratos, relatorio }));
  const usados = new Set(espacos.flatMap((e) => e.responsaveis.map((r) => r.id)));
  const semUso = Object.keys(pessoas).filter((id) => !usados.has(id));
  if (semUso.length) avisosGerais.push(`${semUso.length} responsável(is) sem ação em nenhum plano ficam de fora: ${semUso.map((id) => pessoas[id].name ?? id).join(", ")}.`);
  return {
    copia: { formato: "sextante-copia-de-seguranca", versao: 2, geradaEm: agora, geradaPor: null, calendarioGeral: null, espacos },
    relatorio,
  };
}

function migrarPlano(pid, p, tarefas, pessoas, { unidades, agora, novoId, retratos, relatorio }) {
  const avisos = [];
  const ordenadas = tarefas.sort(([ia, a], [ib, b]) => (a.order ?? 0) - (b.order ?? 0) || ia.localeCompare(ib));
  const numeroDe = new Map(ordenadas.map(([id], i) => [id, i + 1]));

  /* etapas: uma fase única "Fase 1", com as etapas na ordem em que aparecem */
  const nomesDeEtapa = [...new Set(ordenadas.map(([, t]) => String(t.stage ?? "").trim()).filter(Boolean))];
  const idDaEtapa = new Map(nomesDeEtapa.map((nome, i) => [nome, `e${i + 1}`]));
  const estrutura = nomesDeEtapa.length ? [{ id: "f1", nome: "Fase 1", etapas: nomesDeEtapa.map((nome) => ({ id: idDaEtapa.get(nome), nome })) }] : [];

  const inicio = DATA_ISO.test(p.start ?? "") ? p.start : String(p.createdAt ?? agora).slice(0, 10);
  const codigos = new Set();
  const acoes = ordenadas.map(([id, t]) => {
    const numero = numeroDe.get(id);
    const nome = String(t.name ?? "").trim();
    const desc = String(t.desc ?? "").trim();
    const rotulo = nome || desc || `Ação ${numero}`;
    let codigo = normalizarCodigo(id);
    if (!CODIGO_VALIDO.test(codigo) || codigos.has(codigo)) {
      avisos.push(`Ação ${numero} (“${rotulo}”): o código “${id}” não segue o formato da versão 2 (2 a 8 letras ou números) e ficou de fora.`);
      codigo = null;
    } else codigos.add(codigo);
    const dependeDe = [];
    for (const pr of t.preds ?? []) {
      if (numeroDe.has(pr)) dependeDe.push(numeroDe.get(pr));
      else avisos.push(`Ação ${numero} (“${rotulo}”): dependia de “${pr}”, que não existe no plano; a dependência ficou de fora.`);
    }
    const responsaveis = (t.owners ?? []).filter((o) => {
      if (pessoas[o]) return true;
      avisos.push(`Ação ${numero} (“${rotulo}”): responsável “${o}” não existe na lista de pessoas e ficou de fora.`);
      return false;
    });
    const estimativas = [];
    const [o, m, pe] = [t.o, t.m, t.p].map((v) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Math.ceil(Number(v) - 1e-9) : null));
    if (o != null && m != null && pe != null && o >= 0 && o <= m && m <= pe && pe > 0) {
      estimativas.push({ em: inicio, por: null, o, m, p: pe, contaDe: "liberacao" });
    } else if ([t.o, t.m, t.p].some((v) => v != null && v !== "")) {
      avisos.push(`Ação ${numero} (“${rotulo}”): estimativa ${t.o} · ${t.m} · ${t.p} inválida; a ação fica com "Falta estimar".`);
    }
    const concluidaEm = DATA_ISO.test(t.aF ?? "") ? t.aF : null;
    if (!concluidaEm && Number(t.pct) >= 100) avisos.push(`Ação ${numero} (“${rotulo}”): estava 100% concluída, mas sem data de término; fica não concluída até alguém registrar a data.`);
    return limpar({
      numero, codigo: codigo ?? undefined, ordem: numero, etapa: idDaEtapa.get(String(t.stage ?? "").trim()) ?? null, rotulo,
      descricao: desc && desc !== rotulo ? desc : undefined,
      dependeDe: [...new Set(dependeDe)], responsaveis: [...new Set(responsaveis)], estimativas,
      concluidaEm: concluidaEm ?? undefined, criadaEm: agora, alteradaEm: agora, alteradaPor: null,
    }, "acao");
  });

  /* responsáveis: só os citados neste plano; tipo escolhido antes; tons na ordem das ações */
  const citados = [...new Set(acoes.flatMap((a) => a.responsaveis))];
  const responsaveis = citados.map((id) => limpar({
    id, tipo: unidades.includes(id) ? "unidade" : "pessoa", nome: String(pessoas[id].name ?? "").trim() || id,
    sigla: pessoas[id].sigla || undefined, setor: pessoas[id].unit || undefined,
    criadoEm: pessoas[id].createdAt ?? agora, alteradoEm: agora, alteradoPor: null,
  }, "responsavel"));
  const tons = ajustarTons({}, citados.filter((id) => !unidades.includes(id)));

  if (p.dist === "tri") avisos.push("O plano usava a distribuição triangular; a versão 2 usa sempre a beta-PERT (seção 5).");
  const espaco = limpar({
    id: pid, nome: String(p.name ?? "").trim() || "Plano sem nome", inicio,
    prazoFinal: DATA_ISO.test(p.target ?? "") ? p.target : undefined,
    datasExcluidas: lerFeriados(p.holidays).map((data) => ({ data, motivo: "" })),
    datasGeraisDesconsideradas: [], documentos: [],
    simulacoes: Number.isInteger(p.iters) && p.iters > 0 ? p.iters : SIMULACOES_PADRAO,
    semente: Number.isInteger(p.seed) ? p.seed : SEMENTE_PADRAO,
    estrutura, camposOpcionais: { fasesEtapas: true, descricao: true, notas: true, codigos: true },
    tons, proximoNumero: acoes.length + 1,
    criadoEm: p.createdAt ?? agora, alteradoEm: agora, alteradoPor: null,
  }, "espaco");

  /* plano original (baseline) → retrato "Plano original", com as datas guardadas */
  const listaDeRetratos = [];
  if (retratos && p.baseline?.tasks && Object.keys(p.baseline.tasks).length) {
    const em = String(p.baseline.at ?? agora).slice(0, 10);
    /* o cálculo daquele dia: ações ainda não concluídas naquela data voltam a estar abertas */
    const naquelaData = acoes.map((a) => (a.concluidaEm && a.concluidaEm > em ? (({ concluidaEm, ...resto }) => resto)(a) : a));
    const { cabecalho, acoes: doRetrato } = montarRetrato({ espaco, acoes: naquelaData, responsaveis, geral: null, hoje: em });
    const cal = criarCalendario({ ...espaco }, em);
    const porCodigo = new Map(ordenadas.map(([id]) => [numeroDe.get(id), p.baseline.tasks[id]]));
    for (const a of doRetrato) {
      const b = porCodigo.get(a.numero);
      if (!b) continue;
      if (Number.isFinite(b.es)) a.liberacaoPrevista = cal.data(b.es);
      if (Number.isFinite(b.ef)) a.conclusaoPrevista = cal.dataDeConclusao(b.ef, b.es ?? 0);
    }
    if (Number.isFinite(p.baseline.fin)) cabecalho.resumo.conclusaoPrevista = cal.dataDeConclusao(p.baseline.fin, 0);
    listaDeRetratos.push({ id: novoId(), nome: "Plano original", origem: "manual", criadoEm: p.baseline.at ?? agora, criadoPor: null, ...cabecalho, acoes: doRetrato });
    avisos.push(`Plano original de ${em.split("-").reverse().join("/")} guardado como retrato; datas da versão atual, demais números recalculados para aquela data.`);
  }

  relatorio.espacos.push({ id: pid, nome: espaco.nome, acoes: acoes.length, etapas: nomesDeEtapa.length, responsaveis: responsaveis.length, retratos: listaDeRetratos.length, avisos });
  return { espaco, acoes, responsaveis, historico: [], retratos: listaDeRetratos };
}
