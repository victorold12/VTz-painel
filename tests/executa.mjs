/* Roda todos os testes de ponta a ponta, um de cada vez, e junta o resultado.
 *
 * UM DE CADA VEZ, de propósito: eles sobem servidores em portas fixas e alguns
 * derrubam e religam um backend. Em paralelo, dois testes disputariam a mesma
 * porta e o defeito apareceria como falha intermitente em qualquer um dos dois
 * — o pior tipo de teste, o que mente de vez em quando.
 *
 * O código sai 0 só se TODOS passarem. Um teste "PULADO" (falta o repo irmão
 * `servidor`) não derruba a suíte, mas aparece no resumo: pular calado seria
 * transformar cobertura ausente em tela verde.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const arquivos = readdirSync(AQUI)
  .filter(f => f.endsWith('.mjs') && !f.startsWith('_') && f !== 'executa.mjs')
  .sort();

const resultados = [];
for (const f of arquivos){
  console.log('\n\x1b[1m=== ' + f + '\x1b[0m');
  const r = spawnSync(process.execPath, [path.join(AQUI, f)], {
    stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf-8',
  });
  process.stdout.write(r.stdout || '');
  const pulou = /^PULADO/m.test(r.stdout || '');
  resultados.push({ f, ok: r.status === 0, pulou });
}

console.log('\n\x1b[1m=== resumo\x1b[0m');
for (const r of resultados){
  const marca = r.pulou ? '  --  ' : (r.ok ? '  ok  ' : 'FALHA ');
  console.log(marca + r.f + (r.pulou ? '  (pulado)' : ''));
}
const falharam = resultados.filter(r => !r.ok);
const pulados = resultados.filter(r => r.pulou);
console.log(`\n${resultados.length - falharam.length - pulados.length} passaram, ` +
            `${falharam.length} falharam, ${pulados.length} pulados`);
process.exit(falharam.length ? 1 : 0);
