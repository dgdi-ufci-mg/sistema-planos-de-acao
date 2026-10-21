/**
 * Tela de boas-vindas (especificação, passo 1.4): para quem ainda não tem espaço.
 * Oferece criar um espaço e ver o exemplo. A restauração de uma cópia de
 * segurança entra aqui no passo 1.19, junto com a cópia.
 */
import { NOME, INSTITUICAO } from "../identidade.js";
import { ICONES } from "../icones.js";

const hojeIso = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
};

/**
 * @param {HTMLElement} alvo
 * @param {{aoCriar: (dados: object) => Promise<void>, aoVerExemplo: () => Promise<void>, comFormulario?: boolean,
 *   podeCriar?: boolean, aoEntrar?: () => void}} acoes
 *   comFormulario: já abre o formulário de criação ("Novo espaço", no menu do espaço);
 *   podeCriar: falso sem login, e o botão de criar vira "Entrar para criar um espaço".
 */
export function mostrarBoasVindas(alvo, { aoCriar, aoVerExemplo, comFormulario = false, podeCriar = true, aoEntrar }) {
  alvo.innerHTML = `
    <section class="cartao boas-vindas">
      <div class="identidade"><img src="../logo.png" alt="" width="40" height="40"><span><b>${NOME}</b><small>${INSTITUICAO}</small></span></div>
      <h1>Bem-vindo ao ${NOME}</h1>
      <p>Para cada ação, você informa quanto tempo ela deve levar e de quais outras ações ela depende.
      O sistema calcula as datas, mostra quais ações não podem atrasar sem atrasar todo o trabalho,
      estima a chance de cumprir o prazo e acompanha o andamento.</p>
      <div class="botoes">
        ${podeCriar ? `<button class="botao principal" type="button" data-acao="criar">${ICONES.mais}Criar um espaço de planejamento</button>`
          : '<button class="botao principal" type="button" data-acao="entrar">Entrar para criar um espaço</button>'}
        <button class="botao" type="button" data-acao="exemplo">Ver um exemplo</button>
      </div>
    </section>
    <section class="cartao" data-formulario hidden>
      <h2>Novo espaço de planejamento</h2>
      <form class="formulario" novalidate>
        <label class="campo"><span>Nome</span>
          <input name="nome" required maxlength="120" placeholder="Por exemplo: Implantação do novo sistema acadêmico"></label>
        <div class="campos-lado-a-lado">
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
    formulario.hidden = true;
    mostrarErro("");
  });
  alvo.querySelector('[data-acao="exemplo"]').addEventListener("click", () => aoVerExemplo());
  formulario.querySelector("form").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(evento.target));
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
  if (comFormulario && podeCriar) abrirFormulario();
}
