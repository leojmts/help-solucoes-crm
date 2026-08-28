#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.PDFLib = require('pdf-lib');
const raiz = path.resolve(__dirname, '..');
vm.runInThisContext(fs.readFileSync(path.join(raiz, 'contratos-pdf.js'), 'utf8'), { filename: 'contratos-pdf.js' });

async function main() {
  const entrada = process.argv[2];
  if (!entrada) throw new Error('Informe os dados do contrato em base64.');
  const dados = JSON.parse(Buffer.from(entrada, 'base64').toString('utf8'));
  const destino = process.argv[3] || path.join(raiz, 'tmp', 'pdfs', 'contrato-teste.pdf');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const logoBytes = fs.readFileSync(path.join(raiz, 'help-logo.png'));
  const bytes = await global.ContratosPDF.gerarContratoPdf(dados, { logoBytes });
  fs.writeFileSync(destino, bytes);
  process.stdout.write(JSON.stringify({ destino, bytes: bytes.length, paginas: global.PDFLib.PDFDocument ? 'gerado' : '' }));
}

main().catch(error => { console.error(error); process.exit(1); });
