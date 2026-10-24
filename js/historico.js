/**
 * Histórico de alterações das ações (documentação técnica, seções 4.2.1 e 16.4; passo 1.16): regras, sem banco.
 * Compara a ação antes e depois de uma gravação e devolve um registro por campo que mudou:
 * quem, quando, campo, valor antigo e valor novo. A criação gera um registro só.
 * O banco grava os registros junto com a alteração, de uma vez: um não existe sem o outro.
 */
import { CAMPOS } from "./modelo.js";

/** Carimbos da própria gravação: já estão no registro (em, por), não são mudanças do conteúdo. */
const SEM_HISTORICO = new Set(["alteradaEm", "alteradaPor", "excluidaPor", "criadaEm"]);
const valor = (v) => (v === undefined ? null : v);
const iguais = (a, b) => JSON.stringify(valor(a)) === JSON.stringify(valor(b));

/**
 * @param {object|null} antes ação antes da gravação; null na criação
 * @param {object} depois ação depois da gravação
 * @param {{em: string, por: string|null, novoId: () => string}} quem
 * @returns {object[]} registros do histórico (campos de CAMPOS.historico)
 */
export function registrosDaMudanca(antes, depois, { em, por, novoId }) {
  const base = { entidade: "acao", chave: depois.numero, em, por: por ?? null };
  if (!antes) return [{ id: novoId(), ...base, tipo: "criacao", campo: null, antes: null, depois: null }];
  return CAMPOS.acao
    .filter((campo) => !SEM_HISTORICO.has(campo) && !iguais(antes[campo], depois[campo]))
    .map((campo) => ({ id: novoId(), ...base, tipo: "alteracao", campo, antes: valor(antes[campo]), depois: valor(depois[campo]) }));
}

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const tres = (e) => `${e.o} · ${e.m} · ${e.p}`;
const lista = (v) => (Array.isArray(v) ? v : []);

/**
 * Frase simples que descreve um registro do histórico, para a janela da ação.
 * @param {object} r registro (CAMPOS.historico)
 * @param {{acao: (n: number) => string, responsavel: (id: string) => string, etapa: (id: string) => string}} nomes
 *   como mostrar outra ação, um responsável e uma etapa
 * @returns {string} texto puro (a tela escapa)
 */
export function descreverRegistro(r, nomes) {
  if (r.tipo === "criacao") return "Criou a ação.";
  const { campo, antes, depois } = r;
  const mudancaDeLista = (rotulo, nome) => {
    const entrou = lista(depois).filter((x) => !lista(antes).includes(x)).map(nome);
    const saiu = lista(antes).filter((x) => !lista(depois).includes(x)).map(nome);
    return [entrou.length ? `${rotulo}: acrescentou ${entrou.join(", ")}` : "", saiu.length ? `${entrou.length ? "retirou" : `${rotulo}: retirou`} ${saiu.join(", ")}` : ""]
      .filter(Boolean).join("; ") + ".";
  };
  switch (campo) {
    case "rotulo": return `Mudou o nome da ação de “${antes ?? ""}” para “${depois ?? ""}”.`;
    case "codigo": return depois ? `Mudou o código para ${depois}${antes ? ` (era ${antes})` : ""}.` : "Retirou o código.";
    case "descricao": return "Alterou a descrição.";
    case "notas": return "Alterou as anotações.";
    case "etapa": return `Mudou a etapa${antes ? ` de “${nomes.etapa(antes)}”` : ""} para ${depois ? `“${nomes.etapa(depois)}”` : "sem fase nem etapa"}.`;
    case "ordem": return "Mudou a posição na ordem do espaço.";
    case "dependeDe": return mudancaDeLista("Depende de", nomes.acao);
    case "responsaveis": return mudancaDeLista("Responsáveis", nomes.responsavel);
    /* passo 2.10a: etiqueta já retirada do catálogo aparece como "etiqueta retirada" */
    case "etiquetas": return mudancaDeLista("Etiquetas", (id) => `“${nomes.etiqueta?.(id) ?? "etiqueta retirada"}”`);
    case "naoAntesDe": return depois ? `“Não começa antes de” passou a ${dataBr(depois)}.` : "Retirou a data de “Não começa antes de”.";
    case "concluidaEm": return depois ? `Registrou a conclusão em ${dataBr(depois)}.` : "Desfez a conclusão.";
    /* passo 2.7: nomes vindos do espaço; uma situação já retirada aparece como "situação retirada" */
    case "situacaoPersonalizada": return `Mudou a situação para ${depois ? `“${nomes.situacao?.(depois) ?? "situação retirada"}”` : "a inicial"}.`;
    case "excluidaEm": return depois ? "Excluiu a ação (foi para a lixeira)." : "Restaurou a ação da lixeira.";
    case "checklist": {
      /* passo 2.8: compara item a item, pelo id */
      const a = new Map(lista(antes).map((i) => [i.id, i]));
      const d = new Map(lista(depois).map((i) => [i.id, i]));
      const partes = [];
      for (const [id, i] of d) {
        const velho = a.get(id);
        if (!velho) partes.push(`acrescentou “${i.texto}”`);
        else {
          if (velho.texto !== i.texto) partes.push(`mudou “${velho.texto}” para “${i.texto}”`);
          if (velho.feito !== i.feito) partes.push(i.feito ? `marcou “${i.texto}” como feito` : `desmarcou “${i.texto}”`);
        }
      }
      for (const [id, i] of a) if (!d.has(id)) partes.push(`retirou “${i.texto}”`);
      return partes.length ? `Checklist: ${partes.join("; ")}.` : "Reordenou o checklist.";
    }
    case "estimativas": {
      const a = lista(antes);
      const d = lista(depois);
      if (d.length > a.length) {
        const nova = d.at(-1);
        return a.length ? `Reestimou: ${tres(nova)} dias úteis${nova.motivo ? ` (motivo: ${nova.motivo})` : ""}.` : `Estimou: ${tres(nova)} dias úteis.`;
      }
      if (d.length && a.length) return `Corrigiu a estimativa de ${tres(a.at(-1))} para ${tres(d.at(-1))} dias úteis.`;
      return "Alterou as estimativas.";
    }
    default: return `Alterou ${campo}.`;
  }
}
