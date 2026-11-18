/**
 * Janela da ação aberta fora do espaço (documentação técnica, seção 8, "Minhas tarefas"; pedido do responsável,
 * 18/11/2026): em "Minhas tarefas", tocar numa tarefa abre a mesma janela da ação por cima da lista, sem sair dela.
 *
 * A janela precisa dos mesmos dados que a tela do espaço lhe passa (dadosDaJanela, em js/telas/espaco.js): o espaço,
 * as ações, os responsáveis, o calendário, o caminho crítico, as linhas da lista (com a simulação, nos espaços que a
 * usam), as permissões e, nos Planos de Ação, as entregas. Este módulo acompanha o espaço da ação aberta pelo Store e
 * refaz esses dados a cada mudança, como a tela do espaço faz. Ao passar pelas setas a uma tarefa de outro espaço, o
 * acompanhamento troca de espaço.
 *
 * O cálculo é o mesmo da tela do espaço (derivar, em js/telas/espaco.js): mudança num deve ser repetida no outro.
 */
import { criarCalendario, datasEfetivas } from "../calendario.js";
import { caminhoCritico } from "../calculo.js";
import { simular, chaveDaSimulacao } from "../simulacao.js";
import { modeloDe, usaSimulacao, opcoesDoCalculo, acoesParaCalculo } from "../modelos.js";
import { montarLinhas } from "../lista.js";
import { tipoDe } from "../tipos.js";
import { abrirAcao } from "./janela-acao.js";
import { avisar } from "./painel.js";

/**
 * Dados da janela da ação a partir do que o Store entrega ao acompanhar o espaço.
 * @param {{store: object, dados: {espaco: object, acoes: object[], responsaveis: object[]}, geral: object|null,
 *   entregas: object[]|null, usuario: string|null, hoje: string, memo: {chave: string|null, sim: object|null}}} fonte
 *   memo: a última simulação, refeita só quando muda algo que entra nela
 */
function derivar({ store, dados, geral, entregas, usuario, hoje, memo }) {
  const espaco = dados.espaco;
  const acoes = [...dados.acoes].sort((a, b) => a.ordem - b.ordem);
  const responsaveis = dados.responsaveis;
  const datasExcluidas = datasEfetivas(espaco, geral);
  const cal = criarCalendario({ ...espaco, datasExcluidas }, hoje);
  const caminho = caminhoCritico(acoes, cal, { hoje, ...opcoesDoCalculo(espaco) });
  let sim = null;
  if (usaSimulacao(espaco)) {
    const paraSimular = acoesParaCalculo(espaco, acoes);
    const parametros = { hoje, semente: espaco.semente, simulacoes: espaco.simulacoes, prazoFinal: espaco.prazoFinal };
    const chave = `${espaco.id}|${chaveDaSimulacao(paraSimular, { ...parametros, inicio: espaco.inicio, datasExcluidas })}`;
    if (chave !== memo.chave) { memo.sim = simular(paraSimular, cal, parametros); memo.chave = chave; }
    sim = memo.sim;
  }
  const linhas = montarLinhas(acoes, caminho, sim, cal, hoje, { prazos: modeloDe(espaco).prazos, espaco });
  return {
    espaco, acoes, responsaveis, cal, caminho,
    pessoas: new Map(responsaveis.map((r) => [r.id, r])),
    meus: usuario ? responsaveis.filter((r) => r.usuario === usuario).map((r) => r.id) : null,
    usaFases: espaco.camposOpcionais?.fasesEtapas !== false && Boolean(espaco.estrutura?.length),
    perm: store.permissoesEm(espaco),
    entregas,
    linhaDe: new Map(linhas.map((l) => [l.acao.numero, l])),
    usaCodigos: espaco.camposOpcionais?.codigos === true,
  };
}

/**
 * Abre a janela de uma ação fora da tela do espaço dela.
 * @param {{store: object, espacoId: string, numero: number, hoje: string, usuario?: string|null,
 *   vizinha?: ((numero: number, passo: number, espacoId: string) => ({espacoId: string, numero: number}|null))|null,
 *   aoAbrirEspaco: (espacoId: string, numero: number) => void,
 *   aoFechar: (espacoId: string, numero: number, mudou: boolean) => void}} opcoes
 *   aoFechar: mudou diz se algum espaço visto pela janela foi alterado enquanto ela estava aberta
 * @returns {{fechar: () => void}}
 */
export function abrirAcaoForaDoEspaco({ store, espacoId, numero, hoje, usuario = null, vizinha = null, aoAbrirEspaco, aoFechar }) {
  const memo = { chave: null, sim: null };
  let janela = null;
  let fechada = false;
  let mudou = false;
  /** acompanhamento do espaço atual: o id, o fim da escuta e a promessa dos primeiros dados */
  let atual = null;

  /** Passa a acompanhar um espaço; a promessa traz os primeiros dados da janela. */
  function acompanhar(id) {
    atual?.parar();
    let primeiros;
    const prontos = new Promise((resolver, recusar) => { primeiros = { resolver, recusar }; });
    let fila = Promise.resolve();
    let vezes = 0;
    let entregas = null;
    const este = { id, prontos, parar: () => {} };
    este.parar = store.acompanharEspaco(id, (dados) => {
      fila = fila.then(async () => {
        if (fechada || atual !== este) return;
        if (tipoDe(dados.espaco) === "planoDeAcao" && entregas === null) entregas = await store.listarEntregas(id).catch(() => []);
        if (fechada || atual !== este) return;
        const novos = derivar({ store, dados, geral: await store.lerCalendarioGeral(), entregas: tipoDe(dados.espaco) === "planoDeAcao" ? entregas : null, usuario, hoje, memo });
        if (vezes++ === 0) primeiros.resolver(novos);
        else { mudou = true; janela?.atualizar(novos); }
      }).catch((e) => { if (vezes === 0) primeiros.recusar(e); else avisar(e.message); });
    });
    atual = este;
    return prontos;
  }

  acompanhar(espacoId).then((dados) => {
    if (fechada) return;
    janela = abrirAcao({
      store, espacoId, numero, hoje, usuario, dados,
      vizinha,
      trocarDeEspaco: (id) => acompanhar(id),
      /* a cópia criada por "Duplicar" abre por cima da lista, como as demais */
      abrirOutra: (n) => { const id = atual.id; fecharTudo(); abrirAcaoForaDoEspaco({ store, espacoId: id, numero: n, hoje, usuario, vizinha, aoAbrirEspaco, aoFechar }); },
      aoAbrirEspaco,
      aoFechar: (n, id) => {
        const tinhaMudado = mudou;
        fechada = true;
        atual?.parar();
        aoFechar?.(id, n, tinhaMudado);
      },
    });
  }).catch((e) => { fechada = true; atual?.parar(); avisar(e.message); aoFechar?.(espacoId, numero, false); });

  function fecharTudo() {
    if (janela) janela.fechar();
    else { fechada = true; atual?.parar(); }
  }
  return { fechar: fecharTudo };
}
