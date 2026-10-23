/**
 * Exportação de um espaço (documentação técnica, passo 1.19a): regras, sem tela.
 * - Planilha: texto separado por tabulações, pronto para colar no Google Planilhas ou no Excel,
 *   com o cadastro e o que foi calculado (início e conclusão previstos, folga, situação).
 * - Fluxograma: texto em linguagem Mermaid, com as fases e etapas como grupos, as dependências
 *   como setas e as ações sem folga destacadas. Pode ser visto em mermaid.live.
 * Recebe só as ações ativas (o `Store` já filtra as excluídas).
 */
import { criarCalendario, datasEfetivas } from "./calendario.js";
import { caminhoCritico, estimativaVigente, duracaoPert } from "./calculo.js";
import { dataBr } from "./formato.js";
import { opcoesDoCalculo, usaDataLimite, usaDependencias } from "./modelos.js";
import { fluxoDe, nomeDoFluxo } from "./situacoes.js";


const SITUACAO = { concluida: "Concluída", liberada: "Liberada", naoLiberada: "Não liberada" };
/** Número com vírgula decimal, como as planilhas em português esperam. */
const numero = (n) => (n == null ? "" : String(Math.round(n * 100) / 100).replace(".", ","));
/** Tabulações e quebras de linha dentro de um campo quebrariam as colunas. */
const campo = (t) => String(t ?? "").replace(/[\t\r\n]+/g, " ").trim();

/** Calcula o que a exportação precisa: datas, folga e situação de cada ação. */
function calcular({ espaco, acoes, geral, hoje }) {
  const cal = criarCalendario({ ...espaco, datasExcluidas: datasEfetivas(espaco, geral) }, hoje);
  const caminho = caminhoCritico(acoes, cal, { hoje, ...opcoesDoCalculo(espaco) });
  const datas = (a) => {
    const c = caminho.porAcao.get(a.numero);
    const concluida = c.situacao === "concluida";
    const fim = concluida ? a.concluidaEm : usaDataLimite(espaco) ? a.dataLimite ?? "" : cal.dataDeConclusao(c.conclusao, c.liberacao);
    return { c, concluida, inicio: cal.data(c.liberacao), fim };
  };
  return { datas };
}

/** Rótulo de uma ação nas dependências: o código, quando o espaço usa códigos; senão, o número. */
const referencia = (a, usaCodigos) => (usaCodigos && a.codigo ? a.codigo : String(a.numero));

/**
 * @param {{espaco: object, acoes: object[], responsaveis: object[], geral: object, hoje: string}} dados
 * @returns {string} linhas separadas por tabulação, com a linha de títulos
 */
export function planilhaDoEspaco({ espaco, acoes, responsaveis, geral, hoje }) {
  const { datas } = calcular({ espaco, acoes, geral, hoje });
  const opcionais = espaco.camposOpcionais ?? {};
  const usaCodigos = opcionais.codigos === true;
  const usaFases = opcionais.fasesEtapas !== false && Boolean(espaco.estrutura?.length);
  const usaDescricao = opcionais.descricao !== false;
  const porNumero = new Map(acoes.map((a) => [a.numero, a]));
  const pessoa = new Map(responsaveis.map((r) => [r.id, r.sigla || r.nome]));
  const faseEEtapa = new Map((espaco.estrutura ?? []).flatMap((f) => f.etapas.map((e) => [e.id, [f.nome, e.nome]])));

  /* colunas conforme o modelo do espaço (passo 2.4b): dependências, e estimativas ou data-limite */
  const comDependencias = usaDependencias(espaco);
  const comEstimativas = !usaDataLimite(espaco);
  const titulos = ["Número", ...(usaCodigos ? ["Código"] : []), ...(usaFases ? ["Fase", "Etapa"] : []), "Ação",
    ...(usaDescricao ? ["Descrição"] : []), ...(comDependencias ? ["Depende de"] : []),
    ...(comEstimativas ? ["Otimista", "Mais provável", "Pessimista", "Prazo previsto (dias úteis)"] : ["Data-limite"]),
    "Responsáveis", "Situação", "Atrasada",
    ...(comEstimativas ? ["Início previsto", "Conclusão prevista", "Folga (dias úteis)", "Sem folga"] : [])];
  const linhas = [...acoes].sort((a, b) => a.ordem - b.ordem).map((a) => {
    const { c, concluida, inicio, fim } = datas(a);
    const e = estimativaVigente(a);
    const [fase, etapa] = faseEEtapa.get(a.etapa) ?? ["", ""];
    return [a.numero, ...(usaCodigos ? [a.codigo ?? ""] : []), ...(usaFases ? [fase, etapa] : []), a.rotulo,
      ...(usaDescricao ? [a.descricao ?? ""] : []),
      ...(comDependencias ? [(a.dependeDe ?? []).map((d) => (porNumero.has(d) ? referencia(porNumero.get(d), usaCodigos) : d)).join("; ")] : []),
      ...(comEstimativas ? [numero(e?.o), numero(e?.m), numero(e?.p), e ? numero(duracaoPert(e)) : ""] : [a.dataLimite ? dataBr(a.dataLimite) : ""]),
      (a.responsaveis ?? []).map((id) => pessoa.get(id)).filter(Boolean).join("; "),
      /* situação personalizada, quando houver (passo 2.7) */
      c.situacao === "liberada" ? nomeDoFluxo(espaco, fluxoDe(a, c.situacao, espaco)) : SITUACAO[c.situacao] ?? c.situacao, c.atrasada ? "sim" : "não",
      ...(comEstimativas ? [dataBr(inicio), dataBr(fim), concluida ? "" : numero(Math.max(0, c.folga)), concluida ? "" : (c.critica ? "sim" : "não")] : []),
    ].map(campo).join("\t");
  });
  return [titulos.join("\t"), ...linhas].join("\n");
}

/** Identificador do nó no Mermaid: só letras, números e sublinhado, começando por letra. */
const no = (a) => `A${a.numero}`;
/** Texto entre aspas no Mermaid: aspas viram apóstrofos. */
const texto = (t) => String(t ?? "").replace(/"/g, "'").replace(/[\r\n]+/g, " ");

/**
 * @param {{espaco: object, acoes: object[], geral: object, hoje: string}} dados
 * @returns {string} fluxograma em linguagem Mermaid
 */
export function mermaidDoEspaco({ espaco, acoes, geral, hoje }) {
  const { datas } = calcular({ espaco, acoes, geral, hoje });
  const opcionais = espaco.camposOpcionais ?? {};
  const usaCodigos = opcionais.codigos === true;
  const usaFases = opcionais.fasesEtapas !== false && Boolean(espaco.estrutura?.length);
  const ordenadas = [...acoes].sort((a, b) => a.ordem - b.ordem);
  const numeros = new Set(ordenadas.map((a) => a.numero));
  const classe = { critica: [], folga: [], concluida: [] };

  const desenhoDe = (a) => {
    const { c, concluida, fim } = datas(a);
    classe[concluida ? "concluida" : c.critica ? "critica" : "folga"].push(no(a));
    const nome = usaCodigos && a.codigo ? `<b>${texto(a.codigo)}</b> · ${texto(a.rotulo)}` : texto(a.rotulo);
    const rodape = concluida ? `concluída em ${dataBr(fim)}` : `até ${dataBr(fim)}${c.critica ? " · sem folga" : ""}`;
    return `${no(a)}["${nome}<br/><small>${rodape}</small>"]`;
  };

  const saida = ["flowchart LR"];
  if (usaFases) {
    const conhecidas = new Set();
    for (const fase of espaco.estrutura) {
      const etapas = fase.etapas.map((e) => [e, ordenadas.filter((a) => a.etapa === e.id)]).filter(([, as]) => as.length);
      fase.etapas.forEach((e) => conhecidas.add(e.id));
      if (!etapas.length) continue;
      saida.push(`    subgraph ${texto(fase.id).replace(/\W/g, "_")}["${texto(fase.nome)}"]`, "        direction LR");
      for (const [etapa, as] of etapas) {
        saida.push(`        subgraph ${texto(etapa.id).replace(/\W/g, "_")}["${texto(etapa.nome)}"]`);
        for (const a of as) saida.push(`            ${desenhoDe(a)}`);
        saida.push("        end");
      }
      saida.push("    end");
    }
    for (const a of ordenadas.filter((x) => !conhecidas.has(x.etapa))) saida.push(`    ${desenhoDe(a)}`);
  } else {
    for (const a of ordenadas) saida.push(`    ${desenhoDe(a)}`);
  }
  for (const a of ordenadas) for (const d of a.dependeDe ?? []) if (numeros.has(d)) saida.push(`    A${d} --> ${no(a)}`);
  /* as mesmas cores da tela (paleta do logotipo) */
  saida.push("    classDef critica fill:#FCE0DF,stroke:#E3262D,stroke-width:2px,color:#163F3A",
    "    classDef folga fill:#D6EEE9,stroke:#00796B,color:#163F3A",
    "    classDef concluida fill:#E4F1E3,stroke:#4E9A4D,color:#163F3A");
  for (const [nome, nos] of Object.entries(classe)) if (nos.length) saida.push(`    class ${nos.join(",")} ${nome}`);
  return saida.join("\n");
}
