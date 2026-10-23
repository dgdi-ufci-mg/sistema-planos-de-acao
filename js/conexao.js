/**
 * Vigia da conexão com a internet (22/10/2026).
 * O navegador só percebe quando o aparelho fica sem rede (`navigator.onLine`); a falha mais comum,
 * porém, é a rede ligada sem internet. Por isso o vigia também sonda o próprio site, de tempos em
 * tempos, com um pedido pequeno e sem cache: se não houver resposta, a internet caiu.
 * Duas sondas seguidas sem resposta declaram a queda (uma só pode ser lentidão passageira).
 */

/**
 * @param {{
 *   sondar: () => Promise<boolean>,
 *   aoMudar: (conectado: boolean) => void,
 *   temRede?: () => boolean,
 *   intervaloConectado?: number,
 *   intervaloSemConexao?: number,
 *   repetirFalha?: number,
 *   agendar?: (f: () => void, ms: number) => any,
 *   cancelar?: (id: any) => void,
 * }} opcoes intervalos em milissegundos
 * @returns {{verificar: () => Promise<void>, readonly conectado: boolean}}
 */
export function criarVigiaDeConexao({
  sondar, aoMudar, temRede = () => true,
  intervaloConectado = 10000, intervaloSemConexao = 5000, repetirFalha = 3000,
  agendar = (f, ms) => setTimeout(f, ms), cancelar = (id) => clearTimeout(id),
}) {
  let conectado = true;
  let falhas = 0;
  let proxima = null;
  let verificando = null;

  const definir = (valor) => {
    if (valor === conectado) return;
    conectado = valor;
    aoMudar(valor);
  };

  async function uma() {
    let ok = false;
    if (temRede()) {
      try { ok = await sondar(); } catch { ok = false; }
    }
    if (ok) { falhas = 0; definir(true); } else if (!temRede() || ++falhas >= 2) definir(false);
    cancelar(proxima);
    proxima = agendar(verificar, conectado ? (falhas ? repetirFalha : intervaloConectado) : intervaloSemConexao);
  }

  /** Confere agora (ao abrir, ao voltar à aba, quando o navegador avisa mudança de rede). */
  function verificar() {
    verificando ??= uma().finally(() => { verificando = null; });
    return verificando;
  }

  return { verificar, get conectado() { return conectado; } };
}

/**
 * Sonda padrão: pede o arquivo de configuração do próprio site, sem cache, e espera até `limite` ms.
 * @param {string} url
 */
export function sondaDoSite(url, limite = 5000) {
  return async () => {
    const controle = new AbortController();
    const prazo = setTimeout(() => controle.abort(), limite);
    try {
      const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}sonda=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: controle.signal });
      return r.ok;
    } finally {
      clearTimeout(prazo);
    }
  };
}
