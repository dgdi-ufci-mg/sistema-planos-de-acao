/**
 * Importação de ações por planilha (especificação, passo 1.19b): regras, sem banco e sem tela.
 * Lê um bloco colado do Google Planilhas ou do Excel, com a linha de títulos, e monta um plano
 * para conferir antes de gravar: quais linhas viram ações novas, quais atualizam ações existentes,
 * quais ficam de fora e por quê. O formato é o mesmo da exportação ("Copiar para planilha"), para
 * a ida e a volta funcionarem; as colunas calculadas (situação, datas previstas, folga) são ignoradas.
 *
 * Escolha de quem importa (decisão do responsável, 22/10/2026):
 * - "criar": só cria ações novas; as que já existem ficam como estão;
 * - "atualizar": também atualiza as que já existem. Célula vazia não muda nada.
 */
import { normalizar } from "./acao.js";
import { estimativaLivre } from "./acao.js";
import { lerColagem, lerData, lerResponsaveis } from "./planilha.js";

/** Títulos aceitos para cada coluna (sem acentos, minúsculas). */
const TITULOS = {
  numero: ["numero", "no", "n", "#"],
  codigo: ["codigo"],
  fase: ["fase"],
  etapa: ["etapa"],
  rotulo: ["acao", "rotulo", "nome", "nome da acao"],
  descricao: ["descricao"],
  dependeDe: ["depende de", "dependencias", "anteriores", "predecessores", "depende"],
  o: ["otimista", "melhor caso"],
  m: ["mais provavel"],
  p: ["pessimista", "pior caso"],
  responsaveis: ["responsaveis", "responsavel"],
  naoAntesDe: ["nao comeca antes de", "nao antes de"],
};
const colunaDe = (titulo) => {
  const t = normalizar(titulo).replace(/[º°.:]/g, "").replace(/\s+/g, " ").trim();
  return Object.keys(TITULOS).find((k) => TITULOS[k].includes(t)) ?? null;
};
const partes = (texto) => String(texto ?? "").split(/[;,\n]/).map((t) => t.trim()).filter(Boolean);
const inteiro = (texto) => {
  const t = String(texto ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

/**
 * @param {{texto: string, espaco: object, acoes: object[], responsaveis: object[], hoje: string,
 *   situacaoDe: (numero: number) => string, modo: "criar"|"atualizar"}} dados
 *   acoes: ativas; situacaoDe: situação calculada de cada ação existente (para saber se a estimativa ainda é livre)
 * @returns {{linhas: object[], etapasNovas: {fase: string, etapa: string}[], ignoradas: string[], erro: string|null}}
 */
export function planejarImportacao({ texto, espaco, acoes, responsaveis, hoje, situacaoDe, modo }) {
  const tabela = lerColagem(texto).filter((l) => l.some((c) => c.trim()));
  if (tabela.length < 2) return { linhas: [], etapasNovas: [], ignoradas: [], erro: "Cole a linha de títulos e pelo menos uma linha de ação." };
  const [titulos, ...corpo] = tabela;
  const mapa = {};
  const ignoradas = [];
  titulos.forEach((t, i) => {
    const c = colunaDe(t);
    if (c && mapa[c] == null) mapa[c] = i; else if (t.trim()) ignoradas.push(t.trim());
  });
  if (mapa.rotulo == null) {
    return { linhas: [], etapasNovas: [], ignoradas, erro: "Falta a coluna com o nome da ação (título “Ação”)." };
  }
  const celula = (linha, c) => (mapa[c] == null ? undefined : String(linha[mapa[c]] ?? "").trim());
  const usaCodigos = espaco.camposOpcionais?.codigos === true;

  /* fases e etapas: as que existem, por nome; as que faltam serão criadas */
  const etapas = (espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => ({ fase: f.nome, etapa: e.nome, id: e.id })));
  const etapasNovas = [];
  const etapaDe = (fase, etapa) => {
    if (!etapa) return undefined;
    const achada = etapas.find((e) => normalizar(e.etapa) === normalizar(etapa) && (!fase || normalizar(e.fase) === normalizar(fase)));
    if (achada) return { id: achada.id };
    const nova = etapasNovas.find((e) => normalizar(e.etapa) === normalizar(etapa) && normalizar(e.fase) === normalizar(fase || "Sem fase"));
    if (!nova) etapasNovas.push({ fase: fase || "Sem fase", etapa });
    return { nova: etapasNovas.findIndex((e) => normalizar(e.etapa) === normalizar(etapa) && normalizar(e.fase) === normalizar(fase || "Sem fase")) };
  };

  /* primeira passada: cada linha, sua ação existente (pelo número, pelo código ou pelo nome) e os campos */
  const linhas = corpo.map((c, i) => {
    const n = i + 2; // número da linha na planilha (a 1 é a dos títulos)
    const rotulo = celula(c, "rotulo") ?? "";
    const numeroTexto = celula(c, "numero");
    const codigo = celula(c, "codigo")?.toUpperCase() || undefined;
    const r = { linha: n, rotulo, avisos: [], campos: {}, numeroPlanilha: numeroTexto || null };
    if (!rotulo && !numeroTexto && !codigo) return { ...r, tipo: "erro", erro: "Linha sem o nome da ação." };
    const existente = (numeroTexto && acoes.find((a) => String(a.numero) === numeroTexto))
      ?? (codigo && acoes.find((a) => a.codigo === codigo))
      ?? (rotulo && acoes.find((a) => normalizar(a.rotulo) === normalizar(rotulo)));
    if (existente) { r.numero = existente.numero; r.existente = existente; }
    if (!existente && !rotulo) return { ...r, tipo: "erro", erro: `Nenhuma ação com o número ou código informado, e falta o nome.` };
    r.tipo = existente ? (modo === "atualizar" ? "atualiza" : "ignorada") : "nova";
    if (!existente && numeroTexto && acoes.length) r.avisos.push(`Não há ação com o número ${numeroTexto}: será criada uma nova, com o próximo número livre.`);
    if (r.tipo === "ignorada") { r.avisos.push(`Já existe no espaço (“${existente.rotulo}”).`); return r; }

    if (rotulo && (!existente || rotulo !== existente.rotulo)) r.campos.rotulo = rotulo;
    if (codigo !== undefined && usaCodigos && codigo !== existente?.codigo) r.campos.codigo = codigo;
    const descricao = celula(c, "descricao");
    if (descricao && descricao !== existente?.descricao) r.campos.descricao = descricao;
    const etapa = etapaDe(celula(c, "fase"), celula(c, "etapa"));
    if (etapa && etapa.id !== existente?.etapa) r.campos.etapa = etapa;
    const nao = celula(c, "naoAntesDe");
    if (nao) {
      const d = lerData(nao);
      if (d === undefined) r.avisos.push(`“Não começa antes de” não entendido (${nao}); use dd/mm/aaaa.`);
      else if (d !== existente?.naoAntesDe) r.campos.naoAntesDe = d;
    }
    const resp = celula(c, "responsaveis");
    if (resp) {
      const { ids, erros } = lerResponsaveis(resp, responsaveis);
      r.avisos.push(...erros.map((e) => `${e} Fica de fora.`));
      if (!existente || JSON.stringify(ids) !== JSON.stringify(existente.responsaveis ?? [])) r.campos.responsaveis = ids;
    }
    const [o, m, p] = ["o", "m", "p"].map((k) => inteiro(celula(c, k)));
    if ([o, m, p].some((x) => x !== null && x !== undefined)) {
      if ([o, m, p].some((x) => x === undefined || x === null) || !(o <= m && m <= p && p > 0)) {
        r.avisos.push("Estimativa incompleta ou inválida (use três números inteiros, otimista ≤ mais provável ≤ pessimista): fica de fora.");
      } else {
        const vigente = existente?.estimativas?.at(-1);
        if (!vigente || vigente.o !== o || vigente.m !== m || vigente.p !== p) {
          if (existente && !estimativaLivre(existente, situacaoDe(existente.numero), hoje)) {
            r.avisos.push("A ação já foi liberada: a estimativa não muda pela importação. Use “Reestimar” na ação.");
          } else r.campos.estimativa = { o, m, p };
        }
      }
    }
    r.dependeDeTexto = celula(c, "dependeDe");
    return r;
  });

  /* segunda passada: dependências, que podem citar ações existentes ou outras linhas da planilha */
  const validas = linhas.filter((l) => l.tipo === "nova" || l.tipo === "atualiza" || l.tipo === "ignorada");
  const refDe = (parte) => {
    const p = parte.trim();
    if (/^\d+$/.test(p)) {
      if (validas.some((l) => l.numero === Number(p)) || acoes.some((a) => a.numero === Number(p))) return { numero: Number(p) };
      /* número que só existe na planilha (por exemplo, ao levar ações para um espaço novo): a linha com esse número */
      const daPlanilha = validas.find((l) => l.numeroPlanilha === p && l.numero == null);
      if (daPlanilha) return { linha: daPlanilha.linha };
    }
    const cod = p.toUpperCase();
    const porCodigo = acoes.find((a) => a.codigo === cod);
    if (porCodigo) return { numero: porCodigo.numero };
    const porNome = validas.find((l) => normalizar(l.rotulo) === normalizar(p)) ?? acoes.find((a) => normalizar(a.rotulo) === normalizar(p));
    if (porNome) return porNome.numero != null ? { numero: porNome.numero } : { linha: porNome.linha }; // linha nova: o número sai na gravação
    return null;
  };
  for (const l of linhas) {
    if ((l.tipo !== "nova" && l.tipo !== "atualiza") || !l.dependeDeTexto) continue;
    const refs = [];
    for (const parte of partes(l.dependeDeTexto)) {
      const ref = refDe(parte);
      if (!ref) l.avisos.push(`“${parte}” não é número, código nem nome de uma ação: fica de fora.`);
      else if ((ref.numero != null && ref.numero === l.numero) || ref.linha === l.linha) l.avisos.push("Uma ação não pode depender dela mesma.");
      else if (!refs.some((x) => x.numero === ref.numero && x.linha === ref.linha)) refs.push(ref);
    }
    const atuais = l.existente?.dependeDe ?? [];
    const iguais = refs.every((r) => r.numero != null) && JSON.stringify(refs.map((r) => r.numero).sort()) === JSON.stringify([...atuais].sort());
    if (!iguais) l.campos.dependeDe = refs;
  }
  for (const l of linhas) {
    delete l.dependeDeTexto;
    delete l.numeroPlanilha;
    if (l.tipo === "atualiza" && !Object.keys(l.campos).length) { l.tipo = "ignorada"; l.avisos.push("Sem mudança."); }
  }
  return { linhas, etapasNovas, ignoradas, erro: null };
}
