/**
 * Importação de responsáveis por planilha, com as contas de acesso (passos 1.14d e 1.19b): regras,
 * sem banco e sem tela. Monta o plano para conferir antes de gravar.
 *
 * Regras (decisão do responsável, 22/10/2026):
 * - com e-mail, é uma pessoa, e o sistema cria a conta de acesso dela (ou liga a conta que já existe);
 * - sem e-mail, pode ser unidade ou pessoa sem acesso: o tipo precisa vir na planilha;
 * - o tipo não muda depois de cadastrado, por isso o sistema não adivinha.
 * Um responsável que já existe no espaço (mesmo e-mail, sigla ou nome) fica como está; se for uma
 * pessoa sem e-mail e a planilha trouxer o e-mail, o e-mail é ligado a ela.
 */
import { normalizar } from "./acao.js";
import { lerColagem } from "./planilha.js";

const TITULOS = {
  tipo: ["tipo"],
  nome: ["nome", "nome completo", "responsavel"],
  sigla: ["sigla", "iniciais"],
  setor: ["setor", "unidade de lotacao", "lotacao"],
  usuario: ["e-mail", "email", "e-mail de login", "login", "usuario"],
};
const colunaDe = (titulo) => {
  const t = normalizar(titulo).replace(/\s+/g, " ").trim();
  return Object.keys(TITULOS).find((k) => TITULOS[k].includes(t)) ?? null;
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {{texto: string, responsaveis: object[]}} dados responsaveis: os ativos do espaço
 * @returns {{linhas: object[], ignoradas: string[], erro: string|null}}
 *   cada linha: {linha, nome, tipo: "novo"|"liga"|"ignorada"|"erro", dados?, id?, conta: boolean, avisos: string[], erro?}
 */
export function planejarResponsaveis({ texto, responsaveis }) {
  const tabela = lerColagem(texto).filter((l) => l.some((c) => c.trim()));
  if (tabela.length < 2) return { linhas: [], ignoradas: [], erro: "Cole a linha de títulos e pelo menos um responsável." };
  const [titulos, ...corpo] = tabela;
  const mapa = {};
  const ignoradas = [];
  titulos.forEach((t, i) => {
    const c = colunaDe(t);
    if (c && mapa[c] == null) mapa[c] = i; else if (t.trim()) ignoradas.push(t.trim());
  });
  if (mapa.nome == null) return { linhas: [], ignoradas, erro: "Falta a coluna com o nome (título “Nome”)." };
  const celula = (l, c) => (mapa[c] == null ? "" : String(l[mapa[c]] ?? "").trim());
  const vistos = [];

  const linhas = corpo.map((c, i) => {
    const r = { linha: i + 2, nome: celula(c, "nome"), avisos: [], conta: false };
    const email = celula(c, "usuario").toLowerCase();
    const sigla = celula(c, "sigla");
    const setor = celula(c, "setor");
    const tipoTexto = normalizar(celula(c, "tipo"));
    if (!r.nome) return { ...r, tipo: "erro", erro: "Falta o nome." };
    if (email && !EMAIL.test(email)) return { ...r, tipo: "erro", erro: `E-mail “${email}” inválido.` };
    let tipo = tipoTexto === "pessoa" ? "pessoa" : tipoTexto === "unidade" ? "unidade" : tipoTexto ? undefined : (email ? "pessoa" : null);
    if (tipo === undefined) return { ...r, tipo: "erro", erro: `Tipo “${celula(c, "tipo")}” não reconhecido: use “pessoa” ou “unidade”.` };
    if (tipo === null) return { ...r, tipo: "erro", erro: "Sem e-mail, informe o tipo: “pessoa” ou “unidade”." };
    if (tipo === "unidade" && email) return { ...r, tipo: "erro", erro: "Unidade não tem conta de acesso: retire o e-mail ou mude o tipo para “pessoa”." };

    /* repetido na própria planilha */
    const repetido = vistos.find((v) => (email && v.email === email) || normalizar(v.nome) === normalizar(r.nome) || (sigla && v.sigla && normalizar(v.sigla) === normalizar(sigla)));
    if (repetido) return { ...r, tipo: "erro", erro: `Repete a linha ${repetido.linha} (mesmo e-mail, nome ou sigla).` };
    vistos.push({ linha: r.linha, email, nome: r.nome, sigla });

    /* já existe no espaço? */
    const dono = email && responsaveis.find((x) => x.usuario === email);
    const existente = dono ?? responsaveis.find((x) => (sigla && x.sigla && normalizar(x.sigla) === normalizar(sigla)) || normalizar(x.nome) === normalizar(r.nome));
    if (existente) {
      r.id = existente.id;
      if (dono || !email) return { ...r, tipo: "ignorada", conta: Boolean(dono), avisos: [`Já cadastrado como “${existente.nome}”.${dono ? " A conta de acesso será conferida." : ""}`] };
      if (existente.tipo !== "pessoa") return { ...r, tipo: "erro", erro: `“${existente.nome}” já está cadastrado como unidade, que não tem conta de acesso.` };
      if (existente.usuario) return { ...r, tipo: "erro", erro: `“${existente.nome}” já tem outro e-mail (${existente.usuario}).` };
      return { ...r, tipo: "liga", usuario: email, conta: true, avisos: [`Já cadastrado como “${existente.nome}”: o e-mail será ligado a ele, com a conta de acesso.`] };
    }
    return { ...r, tipo: "novo", conta: Boolean(email), dados: { tipo, nome: r.nome, ...(sigla ? { sigla } : {}), ...(setor ? { setor } : {}), ...(email ? { usuario: email } : {}) } };
  });
  return { linhas, ignoradas, erro: null };
}
