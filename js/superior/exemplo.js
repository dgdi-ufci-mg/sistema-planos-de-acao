/**
 * Catálogo de exemplo do módulo Superior (passo 2.5): só quando o sistema roda sem o Firebase (na memória),
 * para mostrar como o desdobramento funciona. Fictício.
 */
export async function carregarCatalogoDeExemplo(store) {
  const pei = await store.criarInstrumento({ nome: "PEI 2021–2030", inicio: "2021-01-01", fim: "2030-12-31", aprovacao: { identificacao: "Resolução CD 10/2020" } });
  const pdi = await store.criarInstrumento({ nome: "PDI 2024–2028", inicio: "2024-01-01", fim: "2028-12-31", aprovacao: { identificacao: "Resolução CD 4/2024" } });
  const item = (camada, codigo, nome, instrumento, superiores = []) => store.criarItemEstrategico({ camada, codigo, nome, instrumento, superiores });
  const oe1 = await item("objetivoEstrategico", "OE1", "Fortalecer a governança e a gestão", pei);
  const oe2 = await item("objetivoEstrategico", "OE2", "Ampliar a inovação e a transferência de tecnologia", pei);
  const od1 = await item("objetivoDesenvolvimento", "OD1", "Decidir com base em dados", pdi, [oe1]);
  const od2 = await item("objetivoDesenvolvimento", "OD2", "Aproximar a pesquisa do setor produtivo", pdi, [oe2]);
  const pol1 = await item("politica", "POL1", "Política de Governança de Dados", null, [od1]);
  const pol2 = await item("politica", "POL2", "Política de Inovação", null, [od2, od1]);
  const port = await item("portfolio", "PF1", "Portfólio de Transformação Digital", null, [pol1]);
  await item("programa", "PRG1", "Programa Repositório Institucional de Dados", null, [port]);
  await item("programa", "PRG2", "Programa Painéis de Gestão", null, [port, pol2]);
  await item("programa", "PRG3", "Programa Vitrine Tecnológica", null, [pol2]); // sem Portfólio
}
