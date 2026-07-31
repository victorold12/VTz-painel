// Build de produção: concatena src/js/*.js (ordem do manifest.json, preservada
// desde a divisão do app.js original — nunca reordene sem revisar dependências
// de escopo entre os arquivos) e minifica com esbuild pra app.js e style.css.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const srcJsDir = path.join(root, 'src', 'js');
const manifestPath = path.join(srcJsDir, 'manifest.json');

function bytes(n) {
  return (n / 1024).toFixed(1) + 'KB';
}

async function buildJs() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const parts = manifest.map((name) => fs.readFileSync(path.join(srcJsDir, name), 'utf-8'));
  const concatenated = parts.join('\n');

  const result = await esbuild.build({
    stdin: {
      contents: concatenated,
      loader: 'js',
      resolveDir: srcJsDir,
    },
    bundle: false,
    minify: true,
    format: 'iife',
    target: 'es2020',
    write: false,
    logLevel: 'warning',
  });

  const outPath = path.join(root, 'app.js');
  fs.writeFileSync(outPath, result.outputFiles[0].contents);
  console.log(`app.js: ${bytes(concatenated.length)} -> ${bytes(result.outputFiles[0].contents.length)}`);
}

async function buildCss() {
  const srcPath = path.join(root, 'src', 'style.css');
  const original = fs.readFileSync(srcPath, 'utf-8');

  const result = await esbuild.build({
    entryPoints: [srcPath],
    bundle: false,
    minify: true,
    write: false,
    logLevel: 'warning',
  });

  const outPath = path.join(root, 'style.css');
  fs.writeFileSync(outPath, result.outputFiles[0].contents);
  console.log(`style.css: ${bytes(original.length)} -> ${bytes(result.outputFiles[0].contents.length)}`);
}

/* As bibliotecas de terceiros ficam em vendor/, copiadas do node_modules com a
   versão travada no package.json. Antes vinham de cdnjs em tempo de execução, o
   que dava dois problemas num app DESKTOP: sem internet (ou com firewall
   corporativo) a página não renderizava, e sem SRI um CDN comprometido rodaria
   código com acesso ao localStorage — onde mora a chave do OpenRouter.

   Copiar em vez de referenciar node_modules/ direto porque o site é servido
   estático: node_modules não vai pro ar, vendor/ vai. */
const VENDOR = [
  ['marked/marked.min.js',                'marked.min.js'],
  ['dompurify/dist/purify.min.js',        'purify.min.js'],
  ['xlsx/dist/xlsx.full.min.js',          'xlsx.full.min.js'],
  ['jspdf/dist/jspdf.umd.min.js',         'jspdf.umd.min.js'],
  ['docx/build/index.umd.js',             'docx.umd.min.js'],
  ['pptxgenjs/dist/pptxgen.bundle.js',    'pptxgen.bundle.js'],
  ['html2canvas/dist/html2canvas.min.js', 'html2canvas.min.js'],
  ['katex/dist/katex.min.js',             'katex.min.js'],
  ['katex/dist/katex.min.css',            'katex.min.css'],
];

/* As fontes do KaTeX. Só .woff2 (296 KB); as versões .woff e .ttf que vêm no
   pacote somam 1,2 MB e existem pra navegador que nenhum usuário deste app tem.
   Sem as fontes o KaTeX ainda renderiza, mas cai numa serif do sistema e os
   sinais grandes (integral, somatório, raiz esticada) saem desalinhados — o
   layout dele conta com as métricas dessas fontes. */
function copiaFontesKatex() {
  const de = path.join(root, 'node_modules', 'katex', 'dist', 'fonts');
  const para = path.join(root, 'vendor', 'fonts');
  if (!fs.existsSync(de)) throw new Error('vendor: faltam as fontes do KaTeX. Rode "npm install".');
  fs.mkdirSync(para, { recursive: true });
  let n = 0, total = 0;
  for (const f of fs.readdirSync(de)) {
    if (!f.endsWith('.woff2')) continue;
    fs.copyFileSync(path.join(de, f), path.join(para, f));
    total += fs.statSync(path.join(de, f)).size;
    n++;
  }
  console.log(`vendor/fonts/: ${n} fontes do KaTeX, ${bytes(total)}`);
}

/* O qrcode não vem com um arquivo pronto pro navegador — é CommonJS em vários
   módulos. Como o build já usa esbuild, empacota aqui num arquivo só, em vez de
   puxar de CDN (o CSP bloqueia) ou de escrever um codificador de QR na mão. */
/* O pdf.js 4.x só vem como ESM, e o painel carrega tudo por <script> clássico
   (é um IIFE com globais, não um app de módulos). Então é empacotado aqui, no
   mesmo padrão do qrcode: IIFE com nome global.

   O WORKER também vira clássico de propósito. pdf.js sabe usar worker de
   módulo, mas no aplicativo de desktop a página vem de file:// — e worker de
   módulo em file:// falha em várias combinações de navegador. Worker clássico
   funciona nos dois mundos, e este app roda nos dois. */
async function bundlePdfjs() {
  const alvos = [
    ['pdfjs-dist/build/pdf.mjs', 'pdf.min.js', 'pdfjsLib'],
    ['pdfjs-dist/build/pdf.worker.mjs', 'pdf.worker.min.js', undefined],
  ];
  for (const [entrada, saidaNome, globalName] of alvos) {
    const saida = path.join(root, 'vendor', saidaNome);
    await esbuild.build({
      entryPoints: [require.resolve(entrada)],
      bundle: true, minify: true, format: 'iife', globalName,
      target: 'es2020', outfile: saida, logLevel: 'warning',
    });
    console.log(`vendor/${saidaNome}: ${bytes(fs.statSync(saida).size)}`);
  }
}

async function bundleQrcode() {
  const saida = path.join(root, 'vendor', 'qrcode.min.js');
  await esbuild.build({
    entryPoints: [path.join(root, 'node_modules', 'qrcode', 'lib', 'browser.js')],
    outfile: saida,
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'QRCode',
    platform: 'browser',
    target: 'es2020',
    logLevel: 'warning',
  });
  console.log(`vendor/qrcode.min.js: ${bytes(fs.statSync(saida).size)}`);
}

function copiaVendor() {
  const destDir = path.join(root, 'vendor');
  fs.mkdirSync(destDir, { recursive: true });
  let total = 0;
  for (const [origem, destino] of VENDOR) {
    const de = path.join(root, 'node_modules', origem);
    if (!fs.existsSync(de)) {
      throw new Error(
        `vendor: falta ${origem}. Rode "npm install" — sem este arquivo o app ` +
        `abre sem markdown/exportação e ninguém descobre até tentar usar.`);
    }
    fs.copyFileSync(de, path.join(destDir, destino));
    total += fs.statSync(de).size;
  }
  console.log(`vendor/: ${VENDOR.length} bibliotecas, ${bytes(total)}`);
}

async function main() {
  copiaVendor();
  copiaFontesKatex();
  await bundleQrcode();
  await bundlePdfjs();
  await buildJs();
  await buildCss();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
