/* Gera o instalar-tudo.bat fora do navegador, pra que o CI possa RODAR ele num
   Windows de verdade. O gerador vive em src/js/30-voice-config.js, um arquivo
   de painel que espera `document` — então aqui ele é lido como texto e só as
   funções puras são avaliadas. Duplicar o script num .mjs seria pior: duas
   cópias divergem, e a testada deixaria de ser a que o usuário baixa. */
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(raiz, 'src/js/30-voice-config.js'), 'utf8');

function corpoDaFuncao(nome){
  const i = src.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('não achei a função ' + nome);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++){
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error('função ' + nome + ' não fecha');
}

const trecho = (de, ate) => src.slice(src.indexOf(de), src.indexOf(ate));
const escopo = trecho('const VOZ_INSTALADORES', '/* Escolhe COM QUAL Python')
             + trecho('const WHISPER_URL_BASE', 'function scriptInstalaTudo')
             + corpoDaFuncao('scriptInstalaTudo');

const modelo = process.argv[2] || 'base';
const saida  = process.argv[3] || path.join(raiz, 'instalar-tudo.bat');
const texto  = new Function(escopo + '; return scriptInstalaTudo(' + JSON.stringify(modelo) + ');')();
fs.writeFileSync(saida, texto);
console.log(`instalar-tudo.bat gerado (modelo ${modelo}): ${texto.split('\r\n').length} linhas -> ${saida}`);
