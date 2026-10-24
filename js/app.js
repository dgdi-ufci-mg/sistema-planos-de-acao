/**
 * Partida da versão 2: identidade, banco, login, barra do topo e abertura do sistema
 * (documentação técnica, passos 1.4 a 1.6 e 1.14):
 * - os espaços ficam no Firebase da versão 2 (config.js); sem configuração, ou se o banco
 *   não carregar, ficam só na memória;
 * - o espaço de exemplo fica sempre na memória, num banco à parte: nunca vai para o Firebase;
 * - quem chega por um link de espaço (#/espaco/<id>) abre esse espaço;
 * - senão, abre o último espaço aberto neste aparelho, se ele ainda existir;
 * - senão, vê as boas-vindas.
 */
import { NOME } from "./identidade.js";
import { FIREBASE_CONFIG } from "../config.js";
import { criarBancoLocal } from "./banco/local.js";
import { conectarFirebase } from "./banco/firebase.js";
import { criarStore, hojeLocal } from "./dados.js";
import { carregarExemplo, carregarExemploDeQuadro } from "./exemplo.js";
import { mostrarBoasVindas } from "./telas/abertura.js";
import { mostrarEspaco } from "./telas/espaco.js";
import { mostrarNavegacao } from "./telas/navegacao.js";
import { mostrarAjuda } from "./telas/ajuda.js";
import { avisar, fecharPainel } from "./telas/painel.js";
import { abrirConfiguracao } from "./telas/configurar.js";
import { abrirConfiguracaoDoSistema } from "./telas/configurar-sistema.js";
import { abrirEntrar, abrirTrocarSenha } from "./telas/acesso.js";
import { abrirLixeira } from "./telas/lixeira.js";
import { abrirConsulta } from "./telas/consulta.js";
import { abrirExtracao } from "./telas/extracao.js";
import { instalar, instalado, aoMudarInstalacao, registrarAplicativo } from "./telas/instalar.js";
import { criarVigiaDeConexao, sondaDoSite } from "./conexao.js";

document.title = NOME;

/* barra do topo: "rolou" liga o vidro (documentação técnica, seção 8.1) */
const topo = document.querySelector(".topo");
let pendente = false;
const marcarRolagem = () => {
  pendente = false;
  const rolou = window.scrollY > 4;
  topo.classList.toggle("rolou", rolou);
  document.body.classList.toggle("rolou", rolou);
};
window.addEventListener("scroll", () => {
  if (!pendente) { pendente = true; requestAnimationFrame(marcarRolagem); }
}, { passive: true });
marcarRolagem();

/* lembrança do último espaço, só neste aparelho; sem armazenamento, segue sem ela */
const CHAVE_ULTIMO = "sextante.ultimoEspaco";
const lembrar = (id) => { try { localStorage.setItem(CHAVE_ULTIMO, id); } catch { /* sem armazenamento */ } };
const esquecer = () => { try { localStorage.removeItem(CHAVE_ULTIMO); } catch { /* sem armazenamento */ } };
const ultimo = () => { try { return localStorage.getItem(CHAVE_ULTIMO); } catch { return null; } };

const hoje = hojeLocal();
const principal = document.querySelector("#principal");

/** Banco dos espaços (Firebase ou memória) e acesso (login), definidos na partida. */
let store = null;
let acesso = null;
/** E-mail de quem entrou, ou null. */
let usuario = null;
/** Exemplo: banco em memória à parte, criado na primeira vez que é aberto. */
let exemplo = null;
let exemploId = null;
/** espaços do banco do exemplo (passo 3.1: o Plano de Ação e o Quadro de tarefas de exemplo) */
const exemplos = new Set();
let abertoId = null;

const storeDe = (id) => (id && exemplos.has(id) ? exemplo : store);
const tentar = async (f, padrao) => { try { return await f(); } catch (e) { avisar(e.message); return padrao; } };

/**
 * Espaços do banco compartilhado, separados (passo 2.2): os de que quem entrou participa (barra lateral)
 * e os abertos à consulta (públicos e institucionais, sem papel), que não ocupam a barra.
 */
async function espacosDoBanco() {
  const todos = await tentar(() => store.listarEspacos(), []);
  return {
    meus: todos.filter((e) => store.participaDoEspaco(e)),
    consulta: todos.filter((e) => !store.participaDoEspaco(e) && store.podeVerEspaco(e)),
  };
}

async function atualizarTopo() {
  const { meus, consulta } = await espacosDoBanco();
  const espacos = [...meus, ...(exemplo ? await exemplo.listarEspacos() : [])];
  const titulo = abertoId ? (await tentar(() => storeDe(abertoId).lerEspaco(abertoId), null))?.nome ?? "" : "";
  /* nome de quem entrou: o do responsável ligado ao e-mail no espaço aberto (os responsáveis são de cada espaço) */
  const ligado = usuario && abertoId ? (await tentar(() => storeDe(abertoId).listarResponsaveis(abertoId), [])).find((r) => r.usuario === usuario) : null;
  mostrarNavegacao({
    espacos,
    abertoId,
    titulo,
    nConsulta: consulta.length,
    aoConsulta: async () => abrirConsulta({ espacos: consulta, comLogin: Boolean(usuario), aoAbrir: abrirEspaco, catalogo: await store.lerCatalogo().catch(() => null) }),
    usuario: usuario ? { email: usuario, nome: ligado?.nome } : null,
    comLogin: Boolean(acesso),
    podeConfigurar: (id) => storeDe(id).podeGravar,
    podeCriar: store.podeGravar,
    aoAbrir: abrirEspaco,
    /* a engrenagem de outro espaço abre esse espaço antes de configurar */
    aoConfigurar: async (id) => {
      if (id !== abertoId && !(await abrirEspaco(id))) return;
      /* contas de acesso só no banco compartilhado; no exemplo, nunca */
      abrirConfiguracao({ store: storeDe(id), espacoId: id, aoExcluirEspaco: espacoExcluido, criarConta: !exemplos.has(id) && acesso ? acesso.criarConta : null });
    },
    aoNovo: () => boasVindas({ comFormulario: true }),
    comLegenda: Boolean(abertoId),
    aoLegenda: () => document.dispatchEvent(new CustomEvent("sextante:alternar-legenda")),
    aoLixeira: () => abrirLixeira({
      store: storeDe(abertoId), espacoId: abertoId, storeEspacos: store,
      aoRestaurarEspaco: () => atualizarTopo(),
    }),
    aoAjuda: () => ajuda(),
    /* aplicativo instalável (seção 8, "Instalar como aplicativo"); some quando já aberto como aplicativo */
    aoInstalar: instalado() ? null : () => instalar(),
    /* extração personalizada (passo 2.10): os espaços do banco que a pessoa consulta e, se aberto, o exemplo */
    aoExtracao: async () => {
      const { meus, consulta } = await espacosDoBanco();
      const fontes = [{ store, espacos: [...meus, ...consulta] }];
      if (exemplo) fontes.push({ store: exemplo, espacos: await exemplo.listarEspacos(), rotulo: "exemplo" });
      abrirExtracao({ fontes, hoje });
    },
    aoSistema: () => sistema(),
    aoEntrar: entrar,
    aoTrocarSenha: () => abrirTrocarSenha({ acesso }),
    aoSair: () => tentar(async () => { await acesso.sair(); avisar("Você saiu."); }),
  });
}

const entrar = () => abrirEntrar({ acesso });
/** "Configurar o sistema"; depois de restaurar uma cópia, reabre o sistema pelo começo. */
const sistema = (foco = null) => abrirConfiguracaoDoSistema({ store, hoje, foco, aoRestaurar: async () => {
  fecharPainel();
  const [primeiro] = (await espacosDoBanco()).meus;
  if (!primeiro || !(await abrirEspaco(primeiro.id))) boasVindas();
} });

/* ---------- sem conexão (22/10/2026) ----------
 * No banco compartilhado, sem internet as alterações não podem ser gravadas. Um aviso fixo na barra
 * do topo (visível em qualquer ponto da página) avisa enquanto durar; os botões de criar e excluir
 * somem; e o Store recusa gravações com uma mensagem clara. O exemplo, na memória, continua livre.
 * A queda é percebida pelo vigia (js/conexao.js): sem rede no aparelho, na hora; com a rede ligada
 * mas sem internet, em até uns 15 segundos, pelas sondas ao próprio site. */
const avisoConexao = document.querySelector("[data-sem-conexao]");
let conectado = true;
function atualizarConexao() {
  if (!acesso) return; // sem banco compartilhado, nada a avisar
  store.definirConexao(conectado);
  avisoConexao.hidden = conectado;
  document.body.classList.toggle("sem-conexao", !conectado && !exemplos.has(abertoId));
}
const vigia = criarVigiaDeConexao({
  sondar: sondaDoSite(new URL("config.js", location.href).href),
  temRede: () => navigator.onLine,
  aoMudar: (on) => {
    conectado = on;
    atualizarConexao();
    if (on && acesso) avisar("Conexão restabelecida. As alterações voltam a ser gravadas.");
  },
});
window.addEventListener("offline", () => vigia.verificar());
window.addEventListener("online", () => vigia.verificar());
document.addEventListener("visibilitychange", () => { if (!document.hidden) vigia.verificar(); });

/** Depois de excluir o espaço aberto: abre outro, se houver, ou as boas-vindas. */
async function espacoExcluido() {
  esquecer();
  const [outro] = (await espacosDoBanco()).meus;
  if (!outro || !(await abrirEspaco(outro.id))) boasVindas();
}

/** Ajuda; com `foco`, destaca um termo do glossário (links "o que é?"). */
function ajuda(foco) {
  mostrarAjuda({ foco, aoVerExemplo: verExemplo });
}

async function verExemplo() {
  if (!exemplo) {
    exemplo = criarStore(criarBancoLocal());
    exemploId = await carregarExemplo(exemplo);
    exemplos.add(exemploId);
    exemplos.add(await carregarExemploDeQuadro(exemplo)); // passo 3.1: o Quadro de tarefas de exemplo, ao lado do Plano de Ação
  }
  await abrirEspaco(exemploId);
}

/** Para de acompanhar o espaço que estava aberto. */
let pararEspaco = () => {};

async function abrirEspaco(id) {
  const daqui = storeDe(id);
  const espaco = await tentar(() => daqui.lerEspaco(id), null);
  if (!espaco) return false;
  /* espaço restrito (ou institucional, sem login) que a pessoa não pode consultar (passo 2.2) */
  if (!daqui.podeVerEspaco(espaco)) { semAcesso(espaco); return true; }
  abertoId = id;
  if (!exemplos.has(id)) lembrar(id);
  if (location.hash !== `#/espaco/${id}`) history.replaceState(null, "", `#/espaco/${id}`);
  pararEspaco();
  /* sem login, a tela esconde "Nova ação"; as demais gravações são recusadas com aviso */
  document.body.classList.toggle("so-leitura", !daqui.podeGravar);
  const pararTela = mostrarEspaco(principal, { store: daqui, espacoId: id, hoje, usuario, barra: document.querySelector("[data-acoes-topo]") });
  /* o nome do espaço no topo acompanha as mudanças (por exemplo, ao renomear em "Configurar este espaço") */
  /* o topo acompanha o nome do espaço e o nome de quem entrou (o do responsável ligado ao e-mail neste espaço) */
  /* e o tipo, que muda o grupo do espaço no menu lateral (passo 2.4a) */
  /* e o encerramento, a visibilidade e o papel de quem entrou, que mudam onde o espaço aparece (passos 2.1 a 2.3) */
  const chaveDoTopo = (e, rs) => `${e.nome}|${e.tipo ?? ""}|${rs.find((r) => usuario && r.usuario === usuario)?.nome ?? ""}|${e.encerradoEm ?? ""}|${e.visibilidade ?? ""}|${JSON.stringify(e.acessos?.[usuario ?? ""] ?? null)}`;
  let chave = null;
  const pararTopo = daqui.acompanharEspaco(id, ({ espaco: atual, responsaveis }) => {
    const nova = chaveDoTopo(atual, responsaveis);
    if (chave !== null && nova !== chave) atualizarTopo();
    chave = nova;
  });
  pararEspaco = () => { pararTela(); pararTopo(); };
  atualizarConexao();
  await atualizarTopo();
  window.scrollTo(0, 0);
  return true;
}

/** Tela de quem chegou a um espaço que não pode consultar, por link ou pelo último aberto (passo 2.2). */
function semAcesso(espaco) {
  pararEspaco();
  pararEspaco = () => {};
  abertoId = null;
  esquecer();
  document.body.classList.remove("so-leitura", "sem-criar-acao");
  const institucional = espaco.visibilidade === "institucional";
  principal.innerHTML = `<section class="cartao sem-acesso">
    <h2>${institucional ? "Espaço institucional" : "Espaço restrito"}</h2>
    <p>${institucional ? "Este espaço é visto por quem entra com login. Entre com seu e-mail e senha para consultá-lo."
      : "Só quem tem papel neste espaço o consulta. Para participar, peça a um administrador do espaço que cadastre você como responsável, com o seu e-mail."}</p>
    <div class="botoes">${!usuario && acesso ? '<button class="botao principal" type="button" data-sem-acesso="entrar">Entrar</button>' : ""}
      <button class="botao" type="button" data-sem-acesso="inicio">Ir para o início</button></div>
  </section>`;
  principal.querySelector('[data-sem-acesso="entrar"]')?.addEventListener("click", entrar);
  principal.querySelector('[data-sem-acesso="inicio"]').addEventListener("click", () => boasVindas());
  atualizarTopo();
}

function boasVindas({ comFormulario = false } = {}) {
  const anterior = abertoId;
  pararEspaco();
  pararEspaco = () => {};
  abertoId = null;
  document.body.classList.remove("so-leitura", "sem-criar-acao");
  if (!comFormulario) esquecer(); // ao cancelar o novo espaço, volta ao que estava aberto
  history.replaceState(null, "", location.pathname + location.search);
  mostrarBoasVindas(principal, {
    aoCancelar: async () => { if (!anterior || !(await abrirEspaco(anterior))) boasVindas(); },
    aoCriar: async (dados) => abrirEspaco(await store.criarEspaco(dados)),
    aoVerExemplo: verExemplo,
    comFormulario,
    podeCriar: store.podeGravar,
    store,
    aoEntrar: entrar,
    /* banco vazio: oferece restaurar uma cópia de segurança (passo 1.19b) */
    aoRestaurar: () => sistema("copia"),
    verificarVazio: async () => !(await tentar(async () => (await store.listarEspacos()).length + (await store.listarEspacosExcluidos()).length, 1)),
  });
  atualizarTopo();
  window.scrollTo(0, 0);
}

/* links "o que é?" em qualquer tela: <a data-termo="chave">o que é?</a> */
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-termo]");
  if (link) { e.preventDefault(); ajuda(link.dataset.termo); }
});

/** Abre o espaço do link, o último aberto ou as boas-vindas. */
async function abrirInicio() {
  const doLink = location.hash.match(/^#\/espaco\/([\w-]+)$/)?.[1];
  for (const id of [doLink, ultimo()]) if (id && await abrirEspaco(id)) return;
  boasVindas();
}

/* link para outro espaço dentro do sistema (passo 2.6: "Continua a entrega X, do Plano de Ação Y") */
window.addEventListener("hashchange", () => {
  const id = location.hash.match(/^#\/espaco\/([\w-]+)$/)?.[1];
  if (id && id !== abertoId && store) abrirEspaco(id);
});

/* aplicativo instalável pelo navegador: o service worker, sem cache, e a barra refeita quando o navegador oferece instalar */
registrarAplicativo();
aoMudarInstalacao(() => { if (store) atualizarTopo(); });

async function partida() {
  if (FIREBASE_CONFIG) {
    try {
      const conexao = await conectarFirebase(FIREBASE_CONFIG);
      acesso = conexao.acesso;
      store = criarStore(conexao.banco, { exigirLogin: true });
    } catch (e) {
      console.error(e);
      acesso = null;
      store = criarStore(criarBancoLocal());
      avisar("Não foi possível conectar ao banco de dados. O sistema abriu sem gravar: tudo se perde ao recarregar a página.");
    }
  } else {
    store = criarStore(criarBancoLocal());
  }
  if (!acesso) return abrirInicio();
  vigia.verificar();

  /* a primeira resposta do login abre o sistema; as seguintes (entrar, sair) refazem a tela aberta */
  let primeira = true;
  acesso.aoMudarUsuario(async (email) => {
    usuario = email;
    store.definirUsuario(email);
    exemplo?.definirUsuario(email);
    if (primeira) { primeira = false; return abrirInicio(); }
    if (abertoId) await abrirEspaco(abertoId);
    else boasVindas();
  });
}
partida();
