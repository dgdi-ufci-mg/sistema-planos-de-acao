/**
 * Entrar e trocar a senha (documentação técnica, seção 8.1; passo 1.14).
 * Usuários são cadastrados pelo administrador, no console do Firebase: aqui não há cadastro.
 */
import { abrirPainel, fecharPainel, avisar } from "./painel.js";

/**
 * @param {{acesso: object}} opcoes acesso: entrar, redefinirSenha (js/banco/firebase.js)
 */
export function abrirEntrar({ acesso }) {
  const corpo = abrirPainel("Entrar", `
    <form class="formulario form-acesso" novalidate>
      <p class="tec">Qualquer pessoa pode consultar os espaços. Para criar ou alterar, entre com o e-mail e a senha cadastrados pelo administrador do sistema.</p>
      <label class="campo"><span>E-mail</span><input name="email" type="email" inputmode="email" autocomplete="username" required></label>
      <label class="campo"><span>Senha</span><input name="senha" type="password" autocomplete="current-password" required></label>
      <p class="erro" data-erro role="status" hidden></p>
      <div class="botoes">
        <button class="botao principal" type="submit">Entrar</button>
        <button class="botao" type="button" data-esqueci>Esqueci a senha</button>
      </div>
    </form>`, { janela: true, botao: "Cancelar" });
  const form = corpo.querySelector("form");
  const msg = form.querySelector("[data-erro]");
  const mostrar = (texto, ok = false) => { msg.textContent = texto; msg.hidden = !texto; msg.classList.toggle("ok", ok); };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { email, senha } = Object.fromEntries(new FormData(form));
    if (!email.trim() || !senha) return mostrar("Informe e-mail e senha.");
    mostrar("Entrando…", true);
    try {
      await acesso.entrar(email, senha);
      fecharPainel();
      avisar(`Você entrou como ${email.trim().toLowerCase()}.`);
    } catch (falha) {
      mostrar(falha.message);
    }
  });
  form.querySelector("[data-esqueci]").addEventListener("click", async () => {
    const email = form.email.value.trim();
    if (!email) { form.email.focus(); return mostrar("Digite seu e-mail acima e toque de novo em “Esqueci a senha”."); }
    try {
      await acesso.redefinirSenha(email);
      mostrar("Se o e-mail estiver cadastrado, você receberá um link para criar uma senha nova.", true);
    } catch (falha) {
      mostrar(falha.message);
    }
  });
  form.email.focus();
}

/**
 * Troca de senha: pede a senha atual (seção 8.1).
 * @param {{acesso: object}} opcoes acesso: trocarSenha
 */
export function abrirTrocarSenha({ acesso }) {
  const corpo = abrirPainel("Trocar senha", `
    <form class="formulario form-acesso" novalidate>
      <label class="campo"><span>Senha atual</span><input name="atual" type="password" autocomplete="current-password" required></label>
      <label class="campo"><span>Senha nova <small>(pelo menos 6 caracteres)</small></span><input name="nova" type="password" autocomplete="new-password" minlength="6" required></label>
      <label class="campo"><span>Repita a senha nova</span><input name="repeticao" type="password" autocomplete="new-password" required></label>
      <p class="erro" data-erro role="status" hidden></p>
      <div class="botoes"><button class="botao principal" type="submit">Trocar senha</button></div>
    </form>`, { janela: true, botao: "Cancelar" });
  const form = corpo.querySelector("form");
  const msg = form.querySelector("[data-erro]");
  const mostrar = (texto) => { msg.textContent = texto; msg.hidden = !texto; };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { atual, nova, repeticao } = Object.fromEntries(new FormData(form));
    if (!atual || !nova) return mostrar("Preencha a senha atual e a nova.");
    if (nova.length < 6) return mostrar("A senha nova precisa ter pelo menos 6 caracteres.");
    if (nova !== repeticao) return mostrar("A repetição não confere com a senha nova.");
    try {
      await acesso.trocarSenha(atual, nova);
      fecharPainel();
      avisar("Senha trocada.");
    } catch (falha) {
      mostrar(falha.message);
    }
  });
  form.atual.focus();
}
