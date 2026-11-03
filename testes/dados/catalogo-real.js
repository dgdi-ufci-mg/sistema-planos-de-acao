/**
 * Catálogo do tamanho do real (passagem de 03/11/2026, Mapa do Strata): Missão, os 14 Objetivos Estratégicos do PEI,
 * 60 Objetivos de Desenvolvimento, 12 Políticas (duas ligadas a dois Objetivos de Desenvolvimento), 3 Portfólios e
 * 16 Programas. Fictício nos nomes e nas ligações, mas com a quantidade e o comprimento de texto do catálogo real.
 * Usado pelos testes das regras do Mapa (`testes/mapa.test.js`) e, nos testes de navegador, no lugar do catálogo de
 * exemplo (`carregarCatalogoReal`).
 */

const TEMAS = [
  "Sociedade", "Ensino", "Pesquisa", "Extensão", "Currículos e aprendizagens", "Acesso, permanência e êxito", "Internacionalização",
  "Comunicação", "Governança", "Gestão", "Pessoas", "Tecnologia da informação", "Infraestrutura física", "Orçamento",
];
const OBJETIVOS = [
  "Contribuir para o desenvolvimento socioeconômico sustentável de Minas Gerais",
  "Consolidar a oferta de educação profissional, tecnológica e superior de excelência",
  "Fortalecer a pesquisa aplicada, a pós-graduação e a inovação tecnológica",
  "Ampliar a integração com a sociedade por meio da extensão",
  "Atualizar os currículos e as práticas de ensino e aprendizagem",
  "Garantir o acesso, a permanência e o êxito dos estudantes",
  "Promover a internacionalização das atividades acadêmicas",
  "Aprimorar a comunicação institucional com os públicos interno e externo",
  "Fortalecer a governança, a integridade e a gestão de riscos",
  "Modernizar a gestão administrativa e os processos de trabalho",
  "Valorizar e desenvolver as pessoas que trabalham na instituição",
  "Prover soluções de tecnologia da informação seguras e integradas",
  "Adequar a infraestrutura física às necessidades acadêmicas",
  "Assegurar a sustentabilidade orçamentária e financeira",
];
const ODS_POR_OE = [3, 6, 5, 4, 5, 4, 3, 4, 5, 4, 5, 4, 4, 4]; // 60
const VERBOS = ["Ampliar", "Implantar", "Fortalecer", "Revisar", "Integrar", "Qualificar", "Monitorar", "Reduzir", "Expandir", "Aperfeiçoar"];
const OBJETOS = [
  "a oferta de cursos nas unidades do interior", "os indicadores de desempenho acadêmico", "as parcerias com o setor produtivo",
  "o acompanhamento dos egressos", "a política de assistência estudantil", "os laboratórios de ensino e pesquisa",
  "os processos de compras e contratações", "a capacitação dos servidores", "a segurança da informação",
  "a evasão nos cursos de graduação", "os canais de atendimento ao público", "a gestão de documentos e arquivos",
  "a produção científica em periódicos qualificados", "a mobilidade acadêmica de estudantes e servidores",
  "a acessibilidade dos espaços e serviços",
];

/** Itens do catálogo, na forma que o Mapa recebe: `{id, camada, codigo, nome, superiores}`. */
export function itensDoCatalogoReal() {
  const itens = [];
  const item = (id, camada, codigo, nome, superiores = []) => { itens.push({ id, camada, codigo, nome, superiores }); return id; };
  const missao = item("missao", "missao", "", "Promover a educação profissional, científica e tecnológica, pública e de qualidade, para o desenvolvimento de Minas Gerais e do país");
  const oes = OBJETIVOS.map((nome, i) => item(`oe${i + 1}`, "objetivoEstrategico", `OE-${i + 1}`, nome, [missao]));
  const ods = [];
  let k = 0;
  ODS_POR_OE.forEach((quantos, i) => {
    for (let j = 0; j < quantos; j++, k++) {
      ods.push(item(`od${k + 1}`, "objetivoDesenvolvimento", `OD-${k + 1}`, `${VERBOS[k % VERBOS.length]} ${OBJETOS[(k * 7) % OBJETOS.length]}`, [oes[i]]));
    }
  });
  const politicas = [
    ["Política de Governança de Dados", [8]], ["Política de Inovação", [10, 12]], ["Política de Extensão", [15]],
    ["Política de Assistência Estudantil", [24, 25]], ["Política de Internacionalização", [27]], ["Política de Comunicação", [31]],
    ["Política de Gestão de Riscos", [36]], ["Política de Gestão de Pessoas", [45]], ["Política de Segurança da Informação", [50]],
    ["Política de Infraestrutura e Sustentabilidade", [54]], ["Política de Ensino", [4]], ["Política Orçamentária", [58]],
  ].map(([nome, ligados], i) => item(`pol${i + 1}`, "politica", `POL-${i + 1}`, nome, ligados.map((n) => ods[n])));
  const portfolios = [
    ["Portfólio de Transformação Digital", [0, 8]], ["Portfólio de Infraestrutura", [9]], ["Portfólio Acadêmico", [10]],
  ].map(([nome, ligados], i) => item(`pf${i + 1}`, "portfolio", `PF-${i + 1}`, nome, ligados.map((n) => politicas[n])));
  const programas = [
    ["Programa Repositório Institucional de Dados", [portfolios[0]]], ["Programa Painéis de Gestão", [portfolios[0]]],
    ["Programa Processo Eletrônico", [portfolios[0]]], ["Programa Vitrine Tecnológica", [politicas[1]]],
    ["Programa Extensão nas Comunidades", [politicas[2]]], ["Programa Permanência", [politicas[3]]],
    ["Programa Mobilidade Internacional", [politicas[4]]], ["Programa Comunicação Integrada", [politicas[5]]],
    ["Programa Integridade", [politicas[6]]], ["Programa Desenvolvimento de Pessoas", [politicas[7]]],
    ["Programa Rede Segura", [portfolios[0]]], ["Programa Campus Sustentável", [portfolios[1]]],
    ["Programa Obras e Reformas", [portfolios[1]]], ["Programa Novos Currículos", [portfolios[2]]],
    ["Programa Laboratórios Abertos", [portfolios[2]]], ["Programa Eficiência do Gasto", [politicas[11]]],
  ].map(([nome, ligados], i) => item(`prg${i + 1}`, "programa", `PRG-${i + 1}`, nome, ligados));
  void programas;
  return itens;
}

/** Os 14 temas do mapa estratégico do PEI, na ordem dos Objetivos Estratégicos (os nomes curtos, para o Lote B). */
export const TEMAS_DO_PEI = Object.freeze(TEMAS);

/**
 * Carrega o catálogo no `Store` (como `carregarCatalogoDeExemplo`, de `js/superior/exemplo.js`), para os testes de
 * navegador e a prévia: os ids do banco trocam os ids daqui nas ligações.
 */
export async function carregarCatalogoReal(store) {
  const pei = await store.criarInstrumento({ nome: "PEI 2021–2030", inicio: "2021-01-01", fim: "2030-12-31", aprovacao: { identificacao: "Resolução CD 10/2020" } });
  const novo = new Map();
  for (const x of itensDoCatalogoReal()) {
    novo.set(x.id, await store.criarItemEstrategico({ camada: x.camada, codigo: x.codigo, nome: x.nome, instrumento: pei, superiores: x.superiores.map((s) => novo.get(s)) }));
  }
}
