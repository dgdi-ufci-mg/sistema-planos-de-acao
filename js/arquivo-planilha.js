/**
 * Arquivos de planilha feitos aqui mesmo, sem biblioteca (passo 2.10; documentação técnica, seção 16.6):
 * CSV com ponto e vírgula, Excel (.xlsx) e LibreOffice (.ods). O .xlsx e o .ods são pacotes ZIP de arquivos
 * XML; o ZIP é montado sem compressão ("stored"), que todo leitor aceita.
 * Regras puras: recebem tabelas e devolvem bytes ou texto, sem tela; testadas com o Node.
 *
 * Tabela: {nome, colunas: string[], linhas: Celula[][]}. Célula:
 * - texto, número, sim/não (boolean) ou vazio (null/undefined);
 * - {data: "AAAA-MM-DD"}: data;
 * - {momento: "…Z"}: data e hora (ISO, mostrada na hora local de quem gera);
 * - {fracao: 0.67}: percentual (0,67 = 67%).
 */

/* ---------- CRC-32 e ZIP sem compressão ---------- */
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Monta um ZIP sem compressão, na ordem dada (o .ods exige o "mimetype" primeiro).
 * @param {{nome: string, conteudo: string|Uint8Array}[]} arquivos
 * @param {Date} [quando] data e hora gravadas nos arquivos
 * @returns {Uint8Array}
 */
export function zip(arquivos, quando = new Date(2026, 0, 1)) {
  const cod = new TextEncoder();
  const hora = (quando.getHours() << 11) | (quando.getMinutes() << 5) | Math.floor(quando.getSeconds() / 2);
  const dia = ((quando.getFullYear() - 1980) << 9) | ((quando.getMonth() + 1) << 5) | quando.getDate();
  const partes = [];
  const central = [];
  let posicao = 0;
  for (const a of arquivos) {
    const nome = cod.encode(a.nome);
    const dados = typeof a.conteudo === "string" ? cod.encode(a.conteudo) : a.conteudo;
    const crc = crc32(dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true); // sem compressão
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, nome.length, true);
    local.setUint16(28, 0, true);
    const cabeca = new DataView(new ArrayBuffer(46));
    cabeca.setUint32(0, 0x02014b50, true);
    cabeca.setUint16(4, 20, true);
    cabeca.setUint16(6, 20, true);
    cabeca.setUint16(8, 0x0800, true);
    cabeca.setUint16(10, 0, true);
    cabeca.setUint16(12, hora, true);
    cabeca.setUint16(14, dia, true);
    cabeca.setUint32(16, crc, true);
    cabeca.setUint32(20, dados.length, true);
    cabeca.setUint32(24, dados.length, true);
    cabeca.setUint16(28, nome.length, true);
    cabeca.setUint32(42, posicao, true);
    partes.push(new Uint8Array(local.buffer), nome, dados);
    central.push(new Uint8Array(cabeca.buffer), nome);
    posicao += 30 + nome.length + dados.length;
  }
  const tamanhoCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, posicao, true);
  const todas = [...partes, ...central, new Uint8Array(fim.buffer)];
  const saida = new Uint8Array(todas.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of todas) { saida.set(p, i); i += p.length; }
  return saida;
}

/**
 * Lê um ZIP sem compressão (para os testes e para conferir o que foi gerado).
 * @returns {Map<string, Uint8Array>}
 */
export function lerZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  const arquivos = new Map();
  let i = 0;
  while (i + 4 <= bytes.length && v.getUint32(i, true) === 0x04034b50) {
    const tamanho = v.getUint32(i + 18, true);
    const n = v.getUint16(i + 26, true);
    const extra = v.getUint16(i + 28, true);
    const nome = dec.decode(bytes.subarray(i + 30, i + 30 + n));
    const inicio = i + 30 + n + extra;
    const dados = bytes.subarray(inicio, inicio + tamanho);
    if (crc32(dados) !== v.getUint32(i + 14, true)) throw new Error(`CRC errado em ${nome}`);
    arquivos.set(nome, dados);
    i = inicio + tamanho;
  }
  return arquivos;
}

/* ---------- células ---------- */
const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""); // caracteres que o XML não aceita
const tipoDe = (c) => (c == null || c === "" ? "vazio" : typeof c === "number" ? "numero" : typeof c === "boolean" ? "simnao"
  : typeof c === "string" ? "texto" : "data" in c ? "data" : "momento" in c ? "momento" : "fracao" in c ? "fracao" : "texto");
const dataBr = (iso) => iso.split("-").reverse().join("/");
const doisDigitos = (n) => String(n).padStart(2, "0");
/** Momento na hora local: [AAAA-MM-DD, hh:mm]. */
function local(iso) {
  const d = new Date(iso);
  return [`${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`, `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`];
}
const numeroBr = (n) => String(n).replace(".", ",");

/** Texto da célula, como aparece no CSV e no PDF. */
export function textoDaCelula(c) {
  switch (tipoDe(c)) {
    case "vazio": return "";
    case "numero": return numeroBr(Math.round(c * 1e6) / 1e6);
    case "simnao": return c ? "sim" : "não";
    case "data": return dataBr(c.data);
    case "momento": { const [d, h] = local(c.momento); return `${dataBr(d)} ${h}`; }
    case "fracao": return `${numeroBr(Math.round(c.fracao * 1000) / 10)}%`;
    default: return String(c);
  }
}

/* ---------- CSV ---------- */
/**
 * CSV com ponto e vírgula, como o Excel e o LibreOffice em português esperam: começa com a marca de UTF-8
 * (BOM), linhas terminadas em CRLF, números com vírgula decimal e datas dd/mm/aaaa.
 */
export function csv(tabela) {
  const campo = (t) => (/[;"\r\n]/.test(t) || /^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  const linhas = [tabela.colunas, ...tabela.linhas.map((l) => l.map(textoDaCelula))].map((l) => l.map((x) => campo(String(x))).join(";"));
  return `﻿${linhas.join("\r\n")}\r\n`;
}

/* ---------- Excel (.xlsx) ---------- */
/** Nome de aba aceito pelo Excel: até 31 caracteres, sem : \ / ? * [ ], sem repetir. */
export function nomesDasAbas(nomes) {
  const usados = new Set();
  return nomes.map((n) => {
    const base = String(n).replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Dados";
    let nome = base;
    for (let i = 2; usados.has(nome.toLowerCase()); i++) nome = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
    usados.add(nome.toLowerCase());
    return nome;
  });
}
const coluna = (i) => { let s = ""; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
/** Número de série de data do Excel (dias desde 30/12/1899). */
const serie = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000 + 25569;
function serieDoMomento(iso) {
  const [d, h] = local(iso);
  return serie(d) + (+h.slice(0, 2) * 60 + +h.slice(3, 5)) / 1440;
}
/* estilos: 0 normal; 1 título (negrito); 2 data; 3 data e hora; 4 percentual */
function celulaXlsx(c, ref) {
  switch (tipoDe(c)) {
    case "vazio": return "";
    case "numero": return `<c r="${ref}"><v>${c}</v></c>`;
    case "simnao": return `<c r="${ref}" t="b"><v>${c ? 1 : 0}</v></c>`;
    case "data": return `<c r="${ref}" s="2"><v>${serie(c.data)}</v></c>`;
    case "momento": return `<c r="${ref}" s="3"><v>${serieDoMomento(c.momento)}</v></c>`;
    case "fracao": return `<c r="${ref}" s="4"><v>${c.fracao}</v></c>`;
    default: return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(c)}</t></is></c>`;
  }
}
/**
 * Excel (.xlsx): uma aba por tabela, com a linha de títulos em negrito e congelada.
 * @param {{nome: string, colunas: string[], linhas: any[][]}[]} tabelas
 * @returns {Uint8Array}
 */
export function xlsx(tabelas, quando = new Date()) {
  const abas = nomesDasAbas(tabelas.map((t) => t.nome));
  const planilha = (t) => {
    const linhas = [t.colunas.map((c, j) => `<c r="${coluna(j)}1" s="1" t="inlineStr"><is><t>${xml(c)}</t></is></c>`).join("")]
      .concat(t.linhas.map((l, i) => l.map((c, j) => celulaXlsx(c, `${coluna(j)}${i + 2}`)).join("")));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetData>${linhas.map((l, i) => `<row r="${i + 1}">${l}</row>`).join("")}</sheetData></worksheet>`;
  };
  const arquivos = [
    { nome: "[Content_Types].xml", conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
    { nome: "_rels/.rels", conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nome: "xl/workbook.xml", conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { nome: "xl/_rels/workbook.xml.rels", conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nome: "xl/styles.xml", conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...tabelas.map((t, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, conteudo: planilha(t) })),
  ];
  return zip(arquivos, quando);
}

/* ---------- LibreOffice (.ods) ---------- */
function celulaOds(c) {
  const p = (t) => `<text:p>${xml(t)}</text:p>`;
  switch (tipoDe(c)) {
    case "vazio": return "<table:table-cell/>";
    case "numero": return `<table:table-cell office:value-type="float" office:value="${c}">${p(textoDaCelula(c))}</table:table-cell>`;
    case "simnao": return `<table:table-cell office:value-type="boolean" office:boolean-value="${c}">${p(textoDaCelula(c))}</table:table-cell>`;
    case "data": return `<table:table-cell table:style-name="ceData" office:value-type="date" office:date-value="${c.data}">${p(textoDaCelula(c))}</table:table-cell>`;
    case "momento": { const [d, h] = local(c.momento); return `<table:table-cell table:style-name="ceMomento" office:value-type="date" office:date-value="${d}T${h}:00">${p(textoDaCelula(c))}</table:table-cell>`; }
    case "fracao": return `<table:table-cell table:style-name="cePercentual" office:value-type="percentage" office:value="${c.fracao}">${p(textoDaCelula(c))}</table:table-cell>`;
    default: return `<table:table-cell office:value-type="string">${p(c)}</table:table-cell>`;
  }
}
/**
 * LibreOffice (.ods): uma aba por tabela, com a linha de títulos em negrito.
 * @returns {Uint8Array}
 */
export function ods(tabelas, quando = new Date()) {
  const abas = nomesDasAbas(tabelas.map((t) => t.nome));
  const ns = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0"';
  const conteudo = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${ns} office:version="1.2"><office:automatic-styles>
<number:date-style style:name="nData"><number:day number:style="long"/><number:text>/</number:text><number:month number:style="long"/><number:text>/</number:text><number:year number:style="long"/></number:date-style>
<number:date-style style:name="nMomento"><number:day number:style="long"/><number:text>/</number:text><number:month number:style="long"/><number:text>/</number:text><number:year number:style="long"/><number:text> </number:text><number:hours number:style="long"/><number:text>:</number:text><number:minutes number:style="long"/></number:date-style>
<number:percentage-style style:name="nPercentual"><number:number number:decimal-places="1" number:min-integer-digits="1"/><number:text>%</number:text></number:percentage-style>
<style:style style:name="ceTitulo" style:family="table-cell"><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="ceData" style:family="table-cell" style:data-style-name="nData"/>
<style:style style:name="ceMomento" style:family="table-cell" style:data-style-name="nMomento"/>
<style:style style:name="cePercentual" style:family="table-cell" style:data-style-name="nPercentual"/>
</office:automatic-styles><office:body><office:spreadsheet>
${tabelas.map((t, i) => `<table:table table:name="${xml(abas[i])}"><table:table-column table:number-columns-repeated="${Math.max(1, t.colunas.length)}"/>
<table:table-row>${t.colunas.map((c) => `<table:table-cell table:style-name="ceTitulo" office:value-type="string"><text:p>${xml(c)}</text:p></table:table-cell>`).join("")}</table:table-row>
${t.linhas.map((l) => `<table:table-row>${l.map(celulaOds).join("")}</table:table-row>`).join("\n")}</table:table>`).join("\n")}
</office:spreadsheet></office:body></office:document-content>`;
  return zip([
    { nome: "mimetype", conteudo: "application/vnd.oasis.opendocument.spreadsheet" },
    { nome: "META-INF/manifest.xml", conteudo: `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>` },
    { nome: "content.xml", conteudo },
  ], quando);
}
