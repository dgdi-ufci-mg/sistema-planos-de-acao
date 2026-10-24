/**
 * Estratégia: catálogo do desdobramento do PEI/PDI (documentação técnica, seção 4.11; passo 2.5).
 * Regras puras, sem tela nem banco. Usadas pelo módulo Superior (que mantém o catálogo) e pelo sistema de
 * planos (onde o Plano de Ação se liga ao catálogo).
 *
 * Modelo genérico (decisões do responsável, 24/10/2026), para o catálogo acompanhar o modelo da instituição
 * sem mudar o sistema:
 * - **camadas**, em ordem, de cima para baixo (hoje: Objetivo Estratégico, Objetivo de Desenvolvimento,
 *   Política, Portfólio e Programa); cada uma pode ser **opcional**, como o Portfólio;
 * - **itens** do catálogo, cada um numa camada, com código e nome, criados por um **instrumento** (PEI, PDI,
 *   uma política…), que tem vigência própria e pode ser prorrogado;
 * - **ligações** de um item a itens superiores, várias para cima e para baixo: o superior fica na camada logo
 *   acima ou, se ela for opcional, numa camada acima dela (um Programa pode estar sob um Portfólio ou direto
 *   sob uma Política);
 * - a **última camada são os Planos de Ação** (os espaços do tipo Plano de Ação), que se ligam a itens da
 *   camada mais baixa do catálogo pela mesma regra (`vinculos` do espaço).
 */

/** Camadas de partida, usadas enquanto o gestor não grava as suas. */
export const CAMADAS_PADRAO = Object.freeze([
  { id: "objetivoEstrategico", nome: "Objetivo Estratégico", plural: "Objetivos Estratégicos", opcional: false },
  { id: "objetivoDesenvolvimento", nome: "Objetivo de Desenvolvimento", plural: "Objetivos de Desenvolvimento", opcional: false },
  { id: "politica", nome: "Política", plural: "Políticas", opcional: false },
  { id: "portfolio", nome: "Portfólio", plural: "Portfólios", opcional: true },
  { id: "programa", nome: "Programa", plural: "Programas", opcional: false },
]);

/** Camadas do modelo gravado, ou as de partida. */
export const camadasDe = (modelo) => (modelo?.camadas?.length ? modelo.camadas : CAMADAS_PADRAO);
const posicao = (camadas, id) => camadas.findIndex((c) => c.id === id);

/**
 * Camadas onde podem estar os superiores de um item da camada `id`: a logo acima e, enquanto a de cima for
 * opcional, também a seguinte acima. `id` null: a camada dos Planos de Ação, abaixo da última do catálogo.
 * @returns {string[]} ids das camadas, da mais próxima para a mais alta
 */
export function camadasAcima(camadas, id) {
  const i = id == null ? camadas.length : posicao(camadas, id);
  const acima = [];
  for (let j = i - 1; j >= 0; j--) {
    acima.push(camadas[j].id);
    if (!camadas[j].opcional) break;
  }
  return acima;
}

/** Data efetiva do fim do instrumento, depois das prorrogações; null: sem fim. */
export const fimDe = (instrumento) => instrumento?.fim ?? null;

/** Se o instrumento vale na data (ISO): início ≤ data ≤ fim (fim vazio: sem fim). */
export const instrumentoVigente = (instrumento, data) =>
  Boolean(instrumento) && !instrumento.excluidoEm && (!instrumento.inicio || instrumento.inicio <= data) && (!fimDe(instrumento) || data <= fimDe(instrumento));

/** Se o item vale na data: o instrumento dele vale (item sem instrumento: sempre). */
export function itemVigente(item, instrumentos, data) {
  if (item.excluidoEm) return false;
  if (!item.instrumento) return true;
  return instrumentoVigente(instrumentos.find((x) => x.id === item.instrumento), data);
}

/** Nome do item na tela: "código · nome". */
export const rotuloDoItem = (item) => (item ? `${item.codigo ? `${item.codigo} · ` : ""}${item.nome}` : "item retirado");

/**
 * Itens que um Plano de Ação pode escolher como Programa (passo 2.5, parte 3): os da camada mais baixa (e das
 * camadas opcionais logo acima dela, como em `camadasAcima`), vigentes na data, mais os que o plano já tem,
 * mesmo fora da vigência, para não sumirem da escolha. Em ordem de código e nome.
 * @param {{camadas: object[], instrumentos: object[], itens: object[]}} catalogo
 * @param {string} data  AAAA-MM-DD
 * @param {string[]} [atuais]  vínculos que o plano já tem
 */
export function opcoesDePrograma({ camadas, instrumentos, itens }, data, atuais = []) {
  const permitidas = camadasAcima(camadas, null);
  return itens
    .filter((x) => !x.excluidoEm && permitidas.includes(x.camada) && (itemVigente(x, instrumentos, data) || atuais.includes(x.id)))
    .sort((a, b) => String(a.codigo ?? "").localeCompare(String(b.codigo ?? ""), "pt-BR", { numeric: true }) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Programa de um espaço, para mostrar: o(s) item(ns) do catálogo em `vinculos` ou, sem eles, o texto livre `programa`.
 * @param {{vinculos?: string[]|null, programa?: string|null}} espaco
 * @param {{itens: object[]}|null} catalogo
 */
export function programaDoEspaco(espaco, catalogo) {
  const ligados = (espaco?.vinculos ?? []).map((id) => catalogo?.itens.find((x) => x.id === id)).filter(Boolean);
  if (ligados.length) return ligados.map(rotuloDoItem).join("; ");
  return espaco?.programa?.trim() || "";
}

/**
 * Caminho de um item até o topo, seguindo o primeiro superior de cada um (para mostrar onde ele está).
 * @returns {object[]} do topo até o item
 */
export function caminhoAteOTopo(item, itens) {
  const porId = new Map(itens.map((x) => [x.id, x]));
  const caminho = [];
  const vistos = new Set();
  for (let atual = item; atual && !vistos.has(atual.id); atual = porId.get(atual.superiores?.[0])) {
    vistos.add(atual.id);
    caminho.unshift(atual);
  }
  return caminho;
}

/** Subordinados diretos de um item (os que o têm entre os superiores). */
export const subordinadosDe = (id, itens) => itens.filter((x) => !x.excluidoEm && (x.superiores ?? []).includes(id));

/** Problema das camadas, ou null: ao menos uma; ids e nomes sem repetir; nome e plural preenchidos. */
export function problemaDasCamadas(camadas) {
  if (!Array.isArray(camadas) || !camadas.length) return { codigo: "camadas-vazias", mensagem: "O catálogo precisa de pelo menos uma camada." };
  const ids = new Set();
  const nomes = new Set();
  for (const c of camadas) {
    if (!c.id || ids.has(c.id)) return { codigo: "id-repetido", mensagem: "Camada com identificador repetido." };
    ids.add(c.id);
    const nome = String(c.nome ?? "").trim();
    if (!nome || !String(c.plural ?? "").trim()) return { codigo: "nome-vazio", mensagem: "Toda camada precisa de nome e de plural." };
    if (nomes.has(nome.toLowerCase())) return { codigo: "nome-repetido", mensagem: `Já existe a camada “${nome}”.` };
    nomes.add(nome.toLowerCase());
    if (typeof c.opcional !== "boolean") return { codigo: "valor-invalido", mensagem: "Informe se a camada é opcional." };
  }
  return null;
}

/** Problema do instrumento, ou null: nome; datas válidas; fim não antes do início. */
export function problemaDoInstrumento(i) {
  if (!String(i.nome ?? "").trim()) return { codigo: "nome-vazio", mensagem: "Informe o nome do instrumento, como “PDI 2024–2028”." };
  const data = /^\d{4}-\d{2}-\d{2}$/;
  if (!data.test(i.inicio ?? "")) return { codigo: "data-invalida", mensagem: "Informe o início da vigência." };
  if (i.fim != null && !data.test(i.fim)) return { codigo: "data-invalida", mensagem: "Data de fim inválida." };
  if (i.fim && i.fim < i.inicio) return { codigo: "prazo-antes-do-inicio", mensagem: "O fim não pode ser antes do início." };
  if (i.aprovacao?.link && !/^https?:\/\/\S+$/i.test(i.aprovacao.link)) return { codigo: "link-invalido", mensagem: "O link do documento deve começar com https:// ou http://." };
  return null;
}

/**
 * Problema do item no catálogo, ou null: camada existente; nome; código sem repetir na camada (entre os
 * ativos); superiores existentes, ativos, sem repetir e nas camadas permitidas (`camadasAcima`).
 * @param {object} item como ficaria depois da gravação
 * @param {{camadas: object[], itens: object[], instrumentos: object[]}} catalogo itens e instrumentos atuais
 */
export function problemaDoItem(item, { camadas, itens, instrumentos }) {
  if (posicao(camadas, item.camada) < 0) return { codigo: "camada-invalida", mensagem: "Escolha uma camada do catálogo." };
  if (!String(item.nome ?? "").trim()) return { codigo: "nome-vazio", mensagem: "Informe o nome do item." };
  const codigo = String(item.codigo ?? "").trim();
  if (codigo && itens.some((x) => x.id !== item.id && !x.excluidoEm && x.camada === item.camada && String(x.codigo ?? "").trim().toLowerCase() === codigo.toLowerCase())) {
    return { codigo: "codigo-ocupado", mensagem: `Já existe o código ${codigo} nesta camada.` };
  }
  if (item.instrumento && !instrumentos.some((x) => x.id === item.instrumento && !x.excluidoEm)) return { codigo: "nao-encontrado", mensagem: "Instrumento não encontrado." };
  const superiores = item.superiores ?? [];
  if (new Set(superiores).size !== superiores.length) return { codigo: "superior-repetido", mensagem: "O mesmo superior aparece duas vezes." };
  const permitidas = camadasAcima(camadas, item.camada);
  const nome = (id) => camadas.find((c) => c.id === id)?.nome;
  for (const id of superiores) {
    const sup = itens.find((x) => x.id === id && !x.excluidoEm);
    if (!sup) return { codigo: "nao-encontrado", mensagem: "Item superior não encontrado." };
    if (!permitidas.includes(sup.camada)) {
      return { codigo: "camada-errada", mensagem: `Um item de “${nome(item.camada)}” fica sob ${permitidas.map((c) => `“${nome(c)}”`).join(" ou ") || "nada (é a camada mais alta)"}, e não sob “${nome(sup.camada)}”.` };
    }
  }
  return null;
}

/**
 * Vínculos de um Plano de Ação: itens ativos, sem repetir, nas camadas permitidas para os Planos (abaixo da
 * última do catálogo). Problema, ou null.
 */
export function problemaDosVinculos(vinculos, { camadas, itens }) {
  if (vinculos == null) return null;
  if (!Array.isArray(vinculos) || new Set(vinculos).size !== vinculos.length) return { codigo: "vinculo-invalido", mensagem: "Lista de vínculos inválida." };
  const permitidas = camadasAcima(camadas, null);
  for (const id of vinculos) {
    const item = itens.find((x) => x.id === id && !x.excluidoEm);
    if (!item) return { codigo: "nao-encontrado", mensagem: "Item do catálogo não encontrado." };
    if (!permitidas.includes(item.camada)) return { codigo: "camada-errada", mensagem: "O Plano de Ação se liga a um item da camada mais baixa do catálogo." };
  }
  return null;
}

/**
 * Árvore para mostrar: os itens de cada camada, em ordem de código e nome, cada um com os subordinados.
 * Como um item pode ter vários superiores, ele aparece sob cada um deles.
 * @returns {{camada: object, itens: object[]}[]} por camada, de cima para baixo
 */
export function itensPorCamada(camadas, itens) {
  const ordem = (a, b) => String(a.codigo ?? "").localeCompare(String(b.codigo ?? ""), "pt-BR", { numeric: true }) || a.nome.localeCompare(b.nome, "pt-BR");
  return camadas.map((camada) => ({ camada, itens: itens.filter((x) => !x.excluidoEm && x.camada === camada.id).sort(ordem) }));
}

/**
 * Importação do catálogo por planilha (passo 2.5): Camada, Código, Nome, Superiores (códigos separados por ";")
 * e Instrumento (nome). Um item já existe quando tem o mesmo código na mesma camada; então é atualizado.
 * Os superiores podem citar itens existentes ou outras linhas; procuram-se nas camadas permitidas.
 * @returns {{linhas: object[], erro: string|null, ignoradas: string[]}} cada linha: {linha, tipo: "novo"|"atualiza"|"igual"|"erro",
 *   camada, codigo, nome, instrumento, superiores: códigos, avisos, erro}
 */
export function planejarCatalogo({ texto, camadas, itens, instrumentos, normalizar, lerColagem }) {
  const tabela = lerColagem(texto).filter((l) => l.some((c) => c.trim()));
  if (tabela.length < 2) return { linhas: [], ignoradas: [], erro: "Cole a linha de títulos e pelo menos uma linha." };
  const [titulos, ...corpo] = tabela;
  const TITULOS = { camada: ["camada", "nivel"], codigo: ["codigo", "cod", "sigla"], nome: ["nome", "item", "descricao"], superiores: ["superiores", "superior", "vinculado a", "ligado a"], instrumento: ["instrumento", "documento", "plano"] };
  const mapa = {};
  const ignoradas = [];
  titulos.forEach((t, i) => {
    const n = normalizar(t).trim();
    const c = Object.keys(TITULOS).find((k) => TITULOS[k].includes(n));
    if (c && mapa[c] == null) mapa[c] = i; else if (t.trim()) ignoradas.push(t.trim());
  });
  if (mapa.camada == null || mapa.nome == null) return { linhas: [], ignoradas, erro: "Faltam as colunas Camada e Nome." };
  const celula = (l, c) => (mapa[c] == null ? "" : String(l[mapa[c]] ?? "").trim());
  const camadaPorNome = (n) => camadas.find((c) => [c.nome, c.plural, c.id].some((x) => normalizar(x) === normalizar(n)));
  const ativos = itens.filter((x) => !x.excluidoEm);
  const linhas = corpo.map((l, i) => {
    const r = { linha: i + 2, avisos: [], nome: celula(l, "nome"), codigo: celula(l, "codigo"), superiores: celula(l, "superiores").split(/[;\n]/).map((x) => x.trim()).filter(Boolean) };
    const camada = camadaPorNome(celula(l, "camada"));
    if (!camada) return { ...r, tipo: "erro", erro: `Camada “${celula(l, "camada")}” não existe no catálogo.` };
    r.camada = camada.id;
    if (!r.nome) return { ...r, tipo: "erro", erro: "Linha sem o nome do item." };
    const nomeInstr = celula(l, "instrumento");
    if (nomeInstr) {
      const instr = instrumentos.find((x) => !x.excluidoEm && normalizar(x.nome) === normalizar(nomeInstr));
      if (instr) r.instrumento = instr.id; else r.avisos.push(`Instrumento “${nomeInstr}” não cadastrado: o item fica sem instrumento (vale sempre).`);
    }
    const existente = r.codigo && ativos.find((x) => x.camada === r.camada && normalizar(x.codigo ?? "") === normalizar(r.codigo));
    if (existente) { r.id = existente.id; r.existente = existente; }
    r.tipo = existente ? "atualiza" : "novo";
    return r;
  });
  /* superiores: por código, nas camadas permitidas, entre os existentes e as linhas da planilha */
  for (const r of linhas) {
    if (r.tipo === "erro") continue;
    const permitidas = camadasAcima(camadas, r.camada);
    r.refs = [];
    for (const cod of r.superiores) {
      const daPlanilha = linhas.find((x) => x !== r && x.tipo !== "erro" && permitidas.includes(x.camada) && normalizar(x.codigo) === normalizar(cod));
      const existente = ativos.find((x) => permitidas.includes(x.camada) && normalizar(x.codigo ?? "") === normalizar(cod));
      if (daPlanilha) r.refs.push(daPlanilha.id ? { id: daPlanilha.id } : { linha: daPlanilha.linha });
      else if (existente) r.refs.push({ id: existente.id });
      else r.avisos.push(`Superior “${cod}” não encontrado nas camadas permitidas: fica de fora.`);
    }
    if (r.tipo === "atualiza") {
      const e = r.existente;
      const mesmos = r.refs.every((x) => x.id) && JSON.stringify(r.refs.map((x) => x.id).sort()) === JSON.stringify([...(e.superiores ?? [])].sort());
      if (e.nome === r.nome && (r.instrumento ?? e.instrumento ?? null) === (e.instrumento ?? null) && mesmos) r.tipo = "igual";
    }
  }
  for (const r of linhas) delete r.existente;
  return { linhas, ignoradas, erro: null };
}
