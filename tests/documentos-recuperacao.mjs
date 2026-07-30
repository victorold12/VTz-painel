/* O índice dos documentos mora num disco que some. Este teste APAGA O BANCO com
 * o backend no ar, sobe de novo vazio — que é literalmente o que o plano grátis
 * do Render faz a cada deploy — e cobra que o painel devolva os documentos
 * sozinho, a partir da cópia local do texto.
 *
 * Não dá pra provar isso com dublê: o ponto é o servidor esquecer de verdade.
 * Por isso uvicorn real, banco em arquivo, e o arquivo é deletado no meio.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  servePainel, abreNavegador, novoContexto, fingeCatalogo, gravaAvisos, avisos,
  abreConfig, placar, achaServidor,
} from './_ajuda.mjs';

const SERVIDOR = achaServidor();
if (!SERVIDOR){
  console.log('PULADO: repo `servidor` não encontrado ao lado deste. ' +
              'Clone os dois lado a lado, ou aponte VTZ_SERVIDOR_PATH.');
  process.exit(0);
}

const { checa, fim } = placar();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vtz-recup-e2e-'));
const BANCO = path.join(TMP, 'recup.db');

const SEGREDO = 'A senha do cofre do escritorio e ZK-7742.';
const ARQ = path.join(TMP, 'cofre-teste.txt');
fs.writeFileSync(ARQ, 'Notas do escritorio.\n\n' + SEGREDO +
  '\n\nA chave reserva fica com a Dona Ana.\n');

const estatico = await servePainel(8194);

let uvicorn = null;
async function sobeBackend(){
  uvicorn = spawn('python3', ['-m', 'uvicorn', 'app.main:app', '--port', '8195', '--host', '127.0.0.1'],
    { cwd: SERVIDOR, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, JARVIS_DB_PATH: BANCO, ALLOWED_ORIGINS: estatico.url, RENDER: '' } });
  for (let i = 0; i < 60; i++){
    try{ if ((await fetch('http://127.0.0.1:8195/api/health')).ok) return true; }catch(e){}
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}
async function derrubaBackend(){
  if (!uvicorn) return;
  uvicorn.kill('SIGKILL');
  await new Promise(r => setTimeout(r, 1200));
  uvicorn = null;
}

if (!await sobeBackend()){
  console.log('FALHA: o backend não subiu.');
  await estatico.fecha(); process.exit(1);
}

const b = await abreNavegador();
/* Contexto ÚNICO o teste inteiro: a cópia local é IndexedDB, e trocar de
   contexto apagaria justamente a coisa que está sendo testada. */
const ctx = await novoContexto(b);
await fingeCatalogo(ctx);
await gravaAvisos(ctx);
await ctx.addInitScript(() => {
  localStorage.setItem('vtz_or_key', 'sk-t');
  localStorage.setItem('vtz_backend_url', 'http://127.0.0.1:8195');
});

const noServidor = async () =>
  (await fetch('http://127.0.0.1:8195/api/docs').then(r => r.json())).documents;
const achaNoIndice = async (t) => JSON.stringify((await fetch(
  'http://127.0.0.1:8195/api/memory/search?q=senha+do+cofre').then(r => r.json())).results || []).includes(t);

console.log('— indexa uma vez');
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));
await p.goto(estatico.url + '/index.html');
await p.waitForTimeout(2600);
await abreConfig(p, 'dados');
await p.setInputFiles('#docs-file', ARQ);
await p.waitForTimeout(2500);
checa('indexou', (await noServidor()).length === 1, await noServidor());
checa('e está buscável', await achaNoIndice('ZK-7742'));

const naCopia = await p.evaluate(() => new Promise(ok => {
  const req = indexedDB.open('vtz-docs', 1);
  req.onsuccess = () => {
    const g = req.result.transaction('textos', 'readonly').objectStore('textos').getAll();
    g.onsuccess = () => ok((g.result || []).map(x => x.name));
  };
  req.onerror = () => ok(['ERRO']);
}));
checa('o texto foi pra cópia local', naCopia.includes('cofre-teste.txt'), naCopia);

console.log('— o servidor perde o disco (é o que o Render free faz num deploy)');
await derrubaBackend();
for (const sufixo of ['', '-wal', '-shm']) fs.rmSync(BANCO + sufixo, { force: true });
if (!await sobeBackend()){ console.log('FALHA: backend não voltou.'); process.exit(1); }
checa('o servidor está mesmo vazio', (await noServidor()).length === 0, await noServidor());
checa('e o trecho sumiu da busca', !(await achaNoIndice('ZK-7742')));

console.log('— o painel abre de novo e devolve sozinho');
await p.reload();
await p.waitForTimeout(9000);          // a recuperação sai ~4s depois do setup
const voltou = await noServidor();
checa('o documento voltou pro servidor', voltou.length === 1, voltou);
checa('com o nome certo', voltou[0]?.name === 'cofre-teste.txt', voltou[0]);
checa('e o trecho é buscável de novo', await achaNoIndice('ZK-7742'));
checa('avisou que estava recuperando', /perdeu|recuper/i.test(await avisos(p)),
  (await avisos(p)).slice(0, 160));

console.log('— não reenvia o que já está lá');
const antes = (await noServidor())[0]?.indexed_at;
await p.reload();
await p.waitForTimeout(9000);
const depois = (await noServidor())[0]?.indexed_at;
checa('o documento intacto não foi reindexado', antes === depois, { antes, depois });

console.log('— apagar de propósito não é desfeito pela recuperação');
await abreConfig(p, 'dados');
p.on('dialog', d => d.accept());
await p.evaluate(() => document.querySelector('.doc-del')?.click());
await p.waitForTimeout(1500);
checa('apagou', (await noServidor()).length === 0, await noServidor());
await p.reload();
await p.waitForTimeout(9000);
checa('e NÃO ressuscita no boot seguinte', (await noServidor()).length === 0, await noServidor());

checa('sem erro de página', erros.length === 0, erros.slice(0, 3));

const saida = fim();
await b.close();
await derrubaBackend();
await estatico.fecha();
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(saida);
