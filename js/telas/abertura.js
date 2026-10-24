/**
 * Tela de boas-vindas (documentação técnica, passo 1.4): para quem ainda não tem espaço.
 * Oferece criar um espaço e ver o exemplo; com o banco vazio, também restaurar
 * uma cópia de segurança (passo 1.19b).
 */
import { NOME, INSTITUICAO } from "../identidade.js";
import { ICONES } from "../icones.js";
import { tipoHtml, ligarTipo, lerTipo } from "./tipo-espaco.js";
import { modeloHtml, ligarModelo, lerModelo } from "./modelo-espaco.js";
import { abrirSuave, fecharSuave } from "./movimento.js";

const hojeIso = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
};

/**
 * @param {HTMLElement} alvo
 * @param {{aoCriar: (dados: object) => Promise<void>, aoVerExemplo: () => Promise<void>, comFormulario?: boolean,
 *   podeCriar?: boolean, aoEntrar?: () => void}} acoes
 *   comFormulario: já abre o formulário de criação ("Novo espaço", no menu do espaço);
 *   podeCriar: falso sem login, e o botão de criar vira "Entrar para criar um espaço";
 *   aoCancelar: com o formulário sozinho, "Cancelar" volta para onde a pessoa estava;
 *   store: para oferecer os Programas do catálogo da estratégia no Plano de Ação (passo 2.5).
 */
export function mostrarBoasVindas(alvo, { aoCriar, aoVerExemplo, comFormulario = false, podeCriar = true, aoEntrar, aoCancelar,
  aoRestaurar = null, verificarVazio = async () => false, store = null }) {
  /* "Novo espaço" (menu lateral): só o formulário, sem o quadro de boas-vindas */
  const soFormulario = comFormulario && podeCriar;
  alvo.innerHTML = `
    <section class="cartao boas-vindas"${soFormulario ? " hidden" : ""}>
      <div class="identidade"><img src="logo.png" alt="" width="40" height="40"><span><b>${NOME}</b><small>${INSTITUICAO}</small></span></div>
      <h1>Bem-vindo ao ${NOME}</h1>
      <p>Para cada ação, você informa quanto tempo ela deve levar e de quais outras ações ela depende.
      O sistema calcula as datas, mostra quais ações não podem atrasar sem atrasar todo o trabalho,
      estima a chance de cumprir o prazo e acompanha o andamento.</p>
      <div class="botoes">
        ${podeCriar ? `<button class="botao principal" type="button" data-acao="criar">${ICONES.mais}Criar um espaço de planejamento</button>`
          : '<button class="botao principal" type="button" data-acao="entrar">Entrar para criar um espaço</button>'}
        <button class="botao" type="button" data-acao="exemplo">Ver um exemplo</button>
      </div>
      <p class="tec" data-restaurar-copia hidden>Tem uma cópia de segurança? <a href="#" data-acao="restaurar">Restaurar uma cópia de segurança</a></p>
    </section>
    <section class="cartao" data-formulario hidden>
      <h2>Novo espaço de planejamento</h2>
      <form class="formulario" novalidate>
        <label class="campo"><span>Nome</span>
          <input name="nome" required maxlength="120" placeholder="Por exemplo: Implantação do novo sistema acadêmico"></label>
        ${tipoHtml()}
        ${modeloHtml()}
        <div class="campos-lado-a-lado" data-datas-espaco>
          <label class="campo"><span>Início</span><input name="inicio" type="date" required value="${hojeIso()}"></label>
          <label class="campo"><span>Prazo final <small>(opcional)</small></span><input name="prazoFinal" type="date"></label>
        </div>
        <p class="erro" data-erro hidden></p>
        <div class="botoes">
          <button class="botao principal" type="submit">Criar</button>
          <button class="botao" type="button" data-acao="cancelar">Cancelar</button>
        </div>
      </form>
    </section>`;

  const formulario = alvo.querySelector("[data-formulario]");
  const erro = alvo.querySelector("[data-erro]");
  const mostrarErro = (texto) => { erro.textContent = texto; erro.hidden = !texto; };

  const abrirFormulario = () => {
    formulario.hidden = false;
    formulario.querySelector('[name="nome"]').focus();
  };
  alvo.querySelector('[data-acao="criar"]')?.addEventListener("click", abrirFormulario);
  alvo.querySelector('[data-acao="entrar"]')?.addEventListener("click", () => aoEntrar());
  alvo.querySelector('[data-acao="cancelar"]').addEventListener("click", () => {
    if (soFormulario && aoCancelar) return aoCancelar(); // volta para onde a pessoa estava
    formulario.hidden = true;
    mostrarErro("");
  });
  alvo.querySelector('[data-acao="exemplo"]').addEventListener("click", () => aoVerExemplo());
  alvo.querySelector('[data-acao="restaurar"]').addEventListener("click", (e) => { e.preventDefault(); aoRestaurar?.(); });
  /* só com login e banco vazio */
  if (aoRestaurar && podeCriar && !soFormulario) verificarVazio().then((vazio) => { alvo.querySelector("[data-restaurar-copia]").hidden = !vazio; });
  formulario.querySelector("form").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const f = Object.fromEntries(new FormData(evento.target));
    /* tipo do espaço (passo 2.4a): no Projeto, nada de Programa nem aprovação */
    const tipo = Object.fromEntries(Object.entries(lerTipo(evento.target)).filter(([, v]) => v != null));
    const dados = { nome: f.nome, inicio: f.inicio, prazoFinal: f.prazoFinal, ...tipo, modelo: lerModelo(evento.target) };
    /* Quadro de tarefas (passo 3.1): sem modelo nem datas do espaço; começa hoje */
    if (tipo.tipo === "quadro") { delete dados.modelo; delete dados.prazoFinal; dados.inicio = hojeIso(); }
    if (!dados.nome.trim()) return mostrarErro("Informe o nome do espaço.");
    if (!dados.inicio) return mostrarErro("Informe a data de início.");
    if (dados.prazoFinal && dados.prazoFinal < dados.inicio) return mostrarErro("O prazo final não pode ser antes do início.");
    if (!dados.prazoFinal) delete dados.prazoFinal;
    try {
      await aoCriar(dados);
    } catch (e) {
      mostrarErro(e.message);
    }
  });
  ligarTipo(formulario.querySelector("form"), { store }); // com o store, o Programa vem do catálogo da estratégia
  ligarModelo(formulario.querySelector("form"));
  /* Quadro de tarefas: o modelo e as datas somem do formulário */
  formulario.querySelector("form").addEventListener("change", (e) => {
    if (e.target.name !== "tipo") return;
    const quadro = e.target.value === "quadro";
    for (const sel of ["[data-modelo-espaco]", "[data-datas-espaco]"]) {
      const el = formulario.querySelector(sel);
      el.getAnimations().forEach((a) => a.cancel());
      if (quadro && !el.hidden) fecharSuave(el).then(() => { if (formulario.querySelector('[name="tipo"]:checked')?.value === "quadro") el.hidden = true; });
      else if (!quadro && el.hidden) { el.hidden = false; abrirSuave(el); }
    }
  });
  if (comFormulario && podeCriar) abrirFormulario();
}
