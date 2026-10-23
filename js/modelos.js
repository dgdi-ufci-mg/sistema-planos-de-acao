/**
 * Modelos de configuração do espaço (documentação técnica, seção 16.1; passo 2.4b). Regras puras.
 * Decisões do responsável, 23/10/2026:
 * - os prazos são por estimativa (três pontos, com datas previstas e caminho crítico) OU por
 *   data-limite opcional, nunca os dois no mesmo espaço;
 * - dependências: sim ou não; simulação: sim ou não, e só com prazos por estimativa;
 * - o modelo é escolhido na criação e fica fixo (a reavaliar com o uso).
 * Espaços sem o campo `modelo`, criados antes do passo 2.4b (como a PI²), valem como "Cronograma estruturado".
 */

export const MODELOS = Object.freeze({
  estruturado: Object.freeze({
    nome: "Cronograma estruturado",
    explicacao: "Cada ação tem uma estimativa de duração e depende de outras. O sistema calcula as datas, o caminho crítico e a chance de cumprir o prazo. Por exemplo: obras, eventos, implantações.",
    config: Object.freeze({ prazos: "estimativa", dependencias: true, simulacao: true }),
  }),
  aberto: Object.freeze({
    nome: "Cronograma aberto",
    explicacao: "Sem estimativas nem dependências: a equipe vai fazendo, e cada ação pode ter uma data-limite. Por exemplo: projetos de TI em ritmo contínuo.",
    config: Object.freeze({ prazos: "dataLimite", dependencias: false, simulacao: false }),
  }),
  personalizado: Object.freeze({
    nome: "Personalizado",
    explicacao: "Você escolhe como os prazos são definidos e se há dependências e simulação.",
    config: null,
  }),
});

/** Configuração efetiva do espaço: a do campo `modelo` ou, sem ele, a do cronograma estruturado. */
export function modeloDe(espaco) {
  const m = espaco?.modelo;
  if (!m) return { nome: "estruturado", ...MODELOS.estruturado.config };
  return { nome: m.nome ?? "personalizado", prazos: m.prazos, dependencias: Boolean(m.dependencias), simulacao: Boolean(m.simulacao) };
}

/** Atalhos do que o espaço usa. */
export const usaEstimativas = (espaco) => modeloDe(espaco).prazos === "estimativa";
export const usaDataLimite = (espaco) => modeloDe(espaco).prazos === "dataLimite";
export const usaDependencias = (espaco) => modeloDe(espaco).dependencias;
export const usaSimulacao = (espaco) => { const m = modeloDe(espaco); return m.prazos === "estimativa" && m.simulacao; };

/**
 * Monta o campo `modelo` a gravar na criação.
 * @param {string} nome "estruturado", "aberto" ou "personalizado"
 * @param {{prazos?: string, dependencias?: boolean, simulacao?: boolean}} [escolhas] só no personalizado
 */
export function montarModelo(nome, escolhas = {}) {
  const base = MODELOS[nome]?.config;
  const m = base ? { nome, ...base } : { nome: "personalizado", prazos: escolhas.prazos, dependencias: Boolean(escolhas.dependencias), simulacao: Boolean(escolhas.simulacao) };
  if (m.prazos !== "estimativa") m.simulacao = false; // a simulação sorteia as estimativas
  return m;
}

/**
 * Problema do campo `modelo`, ou null.
 * @returns {{codigo: string, mensagem: string}|null}
 */
export function problemaDoModelo(modelo) {
  if (modelo == null) return null;
  if (!MODELOS[modelo.nome]) return { codigo: "modelo-invalido", mensagem: `Modelo desconhecido: "${modelo.nome}".` };
  if (!["estimativa", "dataLimite"].includes(modelo.prazos)) return { codigo: "modelo-invalido", mensagem: "Escolha como os prazos são definidos: por estimativa ou por data-limite." };
  if (typeof modelo.dependencias !== "boolean" || typeof modelo.simulacao !== "boolean") return { codigo: "modelo-invalido", mensagem: "Modelo incompleto." };
  if (modelo.simulacao && modelo.prazos !== "estimativa") return { codigo: "modelo-invalido", mensagem: "A simulação só existe com prazos por estimativa." };
  const base = MODELOS[modelo.nome].config;
  if (base && Object.entries(base).some(([k, v]) => modelo[k] !== v)) return { codigo: "modelo-invalido", mensagem: `O modelo "${MODELOS[modelo.nome].nome}" não aceita outras escolhas.` };
  return null;
}

/** Opções de caminhoCritico conforme o modelo do espaço (js/calculo.js). */
export function opcoesDoCalculo(espaco) {
  const m = modeloDe(espaco);
  return { prazos: m.prazos, dependencias: m.dependencias };
}

/** Ações como entram na simulação: sem as anteriores, no espaço sem dependências. */
export const acoesParaCalculo = (espaco, acoes) => (usaDependencias(espaco) ? acoes : acoes.map((a) => ({ ...a, dependeDe: [] })));
