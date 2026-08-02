/* O manifesto decide o que entra no bundle. Um arquivo em src/js que não esteja
 * listado simplesmente NÃO EXISTE em produção — e o sintoma não é um erro claro.
 *
 * O caso real: `41-matematica.js` entrou em 31/07 no commit "Fórmulas
 * renderizadas" e o manifesto não foi atualizado junto. Consequência em cadeia:
 *
 *   1. o arquivo não foi empacotado
 *   2. `safeRenderMarkdown` chama `katexDisponivel()` na primeira linha do try
 *   3. função inexistente -> ReferenceError
 *   4. o try/catch engole e cai no fallback de TEXTO PURO
 *
 * Resultado: TODO o markdown do painel quebrado em produção — sem negrito, sem
 * lista, sem bloco de código, sem tabela. O commit que adicionou renderização de
 * fórmula quebrou toda a renderização, e passou despercebido porque o erro virou
 * degradação silenciosa.
 *
 * Nenhum teste pegou. Os de ponta a ponta carregam `src/js` direto por bancada
 * (justamente pra alcançar função interna num bundle IIFE), e bancada mascara
 * arquivo fora do manifesto: ela carrega o que MANDAM carregar, não o que o
 * build monta.
 *
 * Este teste fecha esse buraco pelo único ângulo que sobra: comparar a lista com
 * o disco. É burro de propósito — não precisa de navegador, roda em
 * milissegundos, e falha com a mensagem exata do que fazer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(AQUI, '..', 'src', 'js');

const manifesto = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf-8'));
const noDisco = fs.readdirSync(SRC).filter((f) => f.endsWith('.js'));

const faltando = noDisco.filter((f) => !manifesto.includes(f));
const sobrando = manifesto.filter((f) => !noDisco.includes(f));

let falhas = 0;

if (faltando.length) {
  falhas++;
  console.log(`FALHA  arquivo em src/js FORA do manifesto: ${faltando.join(', ')}`);
  console.log('       Ele NÃO vai pro bundle. Acrescente em src/js/manifest.json,');
  console.log('       na posição certa — a ordem é a de concatenação.');
} else {
  console.log('  ok   todo arquivo de src/js está no manifesto');
}

if (sobrando.length) {
  falhas++;
  console.log(`FALHA  manifesto aponta arquivo que não existe: ${sobrando.join(', ')}`);
  console.log('       O build quebra ao tentar ler.');
} else {
  console.log('  ok   todo arquivo do manifesto existe no disco');
}

/* A ordem importa: os nomes começam com número porque essa é a ordem de
   concatenação, e trocar a ordem muda quem enxerga quem. Um arquivo novo
   acrescentado fora de ordem é sintoma de ter sido colado no fim sem pensar. */
const numeros = manifesto
  .map((f) => Number((f.match(/^(\d+)-/) || [])[1]))
  .filter((n) => Number.isFinite(n));
const ordenado = numeros.every((n, i) => i === 0 || n >= numeros[i - 1]);
if (!ordenado) {
  falhas++;
  console.log('FALHA  o manifesto está fora de ordem numérica');
} else {
  console.log('  ok   manifesto em ordem numérica');
}

console.log('');
if (falhas) {
  console.log(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log('tudo passou');
