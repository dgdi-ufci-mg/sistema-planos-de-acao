/**
 * Saída de textos e arquivos para quem usa o sistema (passo 1.19a): copiar para a área de
 * transferência e baixar um arquivo. Sem biblioteca.
 */
import { avisar } from "./painel.js";

/**
 * Copia o texto. Se o navegador recusar, mostra o texto selecionado em `reserva`
 * (uma caixa de texto só de leitura), para a pessoa copiar com Ctrl+C.
 * @param {string} texto
 * @param {HTMLTextAreaElement} reserva
 * @param {string} feito aviso de sucesso
 */
export async function copiarTexto(texto, reserva, feito) {
  try {
    await navigator.clipboard.writeText(texto);
    reserva.hidden = true;
    avisar(feito);
  } catch {
    reserva.value = texto;
    reserva.hidden = false;
    reserva.focus();
    reserva.select();
    avisar("Não foi possível copiar automaticamente. O texto está selecionado: use Ctrl+C.");
  }
}

/** Baixa um arquivo de texto com o nome dado. */
export function baixarArquivo(nome, texto, tipo = "application/json") {
  const url = URL.createObjectURL(new Blob([texto], { type: `${tipo};charset=utf-8` }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
