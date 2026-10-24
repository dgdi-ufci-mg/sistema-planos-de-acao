/**
 * Papéis por espaço e espaço aberto ou fechado (documentação técnica, seções 4.1.10 e 16.3; passo 2.1).
 * Regras puras, sem tela nem banco. As mesmas regras estão no `firestore.rules`, para o banco recusar
 * o que a tela não oferece; quem mudar uma muda a outra.
 *
 * O espaço guarda `acessos`: para cada e-mail com papel, o papel e o responsável ligado a ele (se houver).
 * O papel é escolhido na lista de responsáveis (decisão do responsável, 24/10/2026): cada pessoa com
 * e-mail de login tem um papel no espaço. Quem cria o espaço é o primeiro administrador.
 *
 * Espaço sem `acessos` (criado antes do passo 2.1, como a PI²): "sem administração". Até alguém com
 * login assumir a administração, vale a regra provisória de antes: quem entrou altera tudo.
 */

/** Papéis, do mais ao menos amplo: [valor guardado, nome na tela, o que pode]. */
export const PAPEIS = Object.freeze([
  ["administrador", "Administrador do espaço", "Configura o espaço, cria e exclui ações e define os papéis."],
  ["usuario", "Usuário", "Atualiza as ações (todas, no espaço aberto; só as suas, no fechado) e comenta."],
  ["leitor", "Leitor", "Consulta e comenta, sem alterar nada."],
]);
const VALORES = new Set(PAPEIS.map(([v]) => v));
export const nomeDoPapel = (papel) => PAPEIS.find(([v]) => v === papel)?.[1] ?? "Sem papel";
export const papelValido = (papel) => VALORES.has(papel);

/** E-mail como o sistema guarda: sem espaços, em minúsculas. */
export const emailNormal = (email) => String(email ?? "").trim().toLowerCase();

/** Espaço criado antes dos papéis, que ninguém assumiu ainda. */
export const semAdministracao = (espaco) => !espaco?.acessos;
/** Espaço fechado: cada usuário atualiza só as ações em que é responsável. Ausente: aberto. */
export const fechado = (espaco) => espaco?.fechado === true;

/** Acesso de um e-mail no espaço ({papel, responsavel}), ou null. */
export const acessoDe = (espaco, email) => (email ? espaco?.acessos?.[emailNormal(email)] ?? null : null);
/** Papel de um e-mail no espaço, ou null. */
export const papelDe = (espaco, email) => acessoDe(espaco, email)?.papel ?? null;

/** Administradores do espaço (e-mails). */
export const administradores = (espaco) => Object.entries(espaco?.acessos ?? {}).filter(([, a]) => a.papel === "administrador").map(([e]) => e);

/**
 * O que um e-mail pode fazer no espaço. Sem administração, quem tem login pode tudo (regra provisória).
 * @param {object} espaco
 * @param {string|null} email quem está gravando
 * @returns {{configurar: boolean, criarAcao: boolean, excluirAcao: boolean, priorizar: boolean, comentar: boolean,
 *   criarResponsavel: boolean, criarEtiqueta: boolean, salvarRetrato: boolean, apagarComentarioAlheio: boolean,
 *   atualizar: (acao: object) => boolean, papel: string|null, livre: boolean}}
 */
export function permissoes(espaco, email) {
  const livre = Boolean(email) && semAdministracao(espaco);
  const acesso = acessoDe(espaco, email);
  const papel = livre ? null : acesso?.papel ?? null;
  const adm = livre || papel === "administrador";
  const usu = adm || papel === "usuario";
  return {
    papel, livre,
    configurar: adm, criarAcao: adm, excluirAcao: adm, apagarComentarioAlheio: papel === "administrador",
    /* usuário reordena a prioridade só no espaço aberto: no fechado, mexeria na posição de ações de outros */
    priorizar: adm || (papel === "usuario" && !fechado(espaco)),
    criarResponsavel: usu, criarEtiqueta: usu, salvarRetrato: usu,
    comentar: usu || papel === "leitor",
    atualizar: (acao) => adm || (papel === "usuario" && (!fechado(espaco) || Boolean(acesso.responsavel && (acao?.responsaveis ?? []).includes(acesso.responsavel)))),
  };
}

/**
 * Acessos ao assumir a administração de um espaço sem administração: quem assume vira administrador;
 * as demais pessoas com e-mail entre os responsáveis viram usuários.
 * @param {string} email quem assume
 * @param {object[]} responsaveis responsáveis ativos do espaço
 */
export function acessosAoAssumir(email, responsaveis) {
  const eu = emailNormal(email);
  const acessos = {};
  for (const r of responsaveis) {
    if (r.tipo !== "pessoa" || !r.usuario) continue;
    acessos[emailNormal(r.usuario)] = { papel: "usuario", responsavel: r.id };
  }
  acessos[eu] = { papel: "administrador", responsavel: acessos[eu]?.responsavel ?? null };
  return acessos;
}

/**
 * Problema dos acessos, ou null: e-mail inválido, papel desconhecido ou nenhum administrador.
 * @returns {{codigo: string, mensagem: string}|null}
 */
export function problemaDosAcessos(espaco) {
  if (semAdministracao(espaco)) return null;
  for (const [email, a] of Object.entries(espaco.acessos)) {
    if (email !== emailNormal(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { codigo: "login-invalido", mensagem: `E-mail inválido nos acessos: “${email}”.` };
    if (!papelValido(a?.papel)) return { codigo: "papel-invalido", mensagem: `Papel desconhecido: “${a?.papel}”.` };
  }
  if (!administradores(espaco).length) return { codigo: "sem-administrador", mensagem: "O espaço precisa de pelo menos um administrador." };
  return null;
}
