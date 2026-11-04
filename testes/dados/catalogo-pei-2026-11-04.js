/**
 * Catálogo do Strata como estava no site em 04/11/2026 (só a estrutura: códigos e ligações), quando o responsável
 * cadastrou o Plano de Ação da Gestão de Riscos e viu a linha do PGOV até o OD-9.1 passar rente ao OD-9.2. Serve de
 * caso de referência para os testes do Mapa (`testes/mapa.test.js`): o mapa tem de sair limpo também com ele.
 * Larguras dos códigos medidas no navegador (texto de 13 px), em `LARGURAS`; área de 879 × 907 px.
 */
const ODS = { 2: 7, 3: 4, 4: 8, 5: 4, 6: 7, 7: 4, 8: 4, 9: 6, 10: 4, 11: 7, 12: 6, 13: 5, 14: 6 }; // OE-1 sem OD

/** Itens, na forma que o Mapa recebe: `{id, camada, codigo, nome, superiores}`. */
export function itensDoPei() {
  const itens = [];
  const item = (codigo, camada, superiores = []) => itens.push({ id: codigo, camada, codigo, nome: codigo, superiores });
  item("MIS", "missao");
  for (let i = 1; i <= 14; i++) item(`OE-${i}`, "objetivoEstrategico", ["MIS"]);
  for (const [oe, n] of Object.entries(ODS)) for (let j = 1; j <= n; j++) item(`OD-${oe}.${j}`, "objetivoDesenvolvimento", [`OE-${oe}`]);
  item("PGOV", "politica", ["OD-9.1"]);
  item("PORTGOV", "portfolio", ["PGOV"]);
  for (const p of ["DPGA 2023-2027", "PDEGOV 2023-2027", "PDGP 2023-2027", "PDGRI 2023-2027", "PTCS 2023 2027"]) item(p, "programa", ["PORTGOV"]);
  return itens;
}

/** O Plano de Ação ligado ao PDGRI. */
export const PLANOS_DO_PEI = Object.freeze([{ id: "pa-gr", codigo: "PA-GR 2026-2027", nome: "Plano de Ação da Gestão de Riscos 2026-2027", superiores: ["PDGRI 2023-2027"] }]);

/** Largura do texto em 13 px, como no navegador. */
export function medirComoNoNavegador(texto) {
  const t = String(texto);
  if (/^OD-\d\.\d$/.test(t)) return 36.84;
  if (/^OD-\d\d\.\d$/.test(t)) return 43.3;
  if (/^OE-\d$/.test(t)) return 26;
  if (/^OE-\d\d$/.test(t)) return 32.45;
  const conhecidas = { MIS: 19.81, PGOV: 30.58, PORTGOV: 53.09, "DPGA 2023-2027": 88.72, "PDEGOV 2023-2027": 103.77, "PDGP 2023-2027": 89.08, "PDGRI 2023-2027": 92.53, "PTCS 2023 2027": 84.66, "PA-GR 2026-2027": 91.61 };
  return conhecidas[t] ?? t.length * 7;
}
