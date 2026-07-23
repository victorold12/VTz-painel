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

async function main() {
  await buildJs();
  await buildCss();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
