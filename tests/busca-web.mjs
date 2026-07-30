/* A busca web passa a ser lembrada entre sessões. O que este teste cobra não é
   só "gravou": é que o AVISO DE CUSTO continue saindo quando ela volta ligada
   sozinha.

   Motivo: ela é o único interruptor do app que gasta dinheiro por conta própria
   (~US$0,02 por mensagem, cobrado pelo OpenRouter fora do contador daqui).
   Lembrar a escolha é conveniência. Lembrar em silêncio que ela cobra seria
   gastar sem avisar — e o sintoma seria uma fatura maior sem nada na tela. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { abreNavegador } from './_ajuda.mjs';

import { fileURLToPath } from 'node:url';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const falhas = [];
const checa = (n, c, e = '') => {
  console.log((c ? '  ok  ' : 'FALHA ') + n + (c ? '' : '  ' + JSON.stringify(e)));
  if (!c) falhas.push(n);
};
const TIPOS = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.png':'image/png', '.webmanifest':'application/manifest+json' };

const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const arq = path.join(RAIZ, rel);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()){
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  res.end(fs.readFileSync(arq));
});
await new Promise(r => srv.listen(8198, '127.0.0.1', r));

const b = await abreNavegador();
const ctx = await b.newContext({ viewport:{width:1200,height:840}, reducedMotion:'reduce' });
await ctx.route('**/openrouter.ai/api/v1/models*', rota => rota.fulfill({ status:200,
  contentType:'application/json', body: JSON.stringify({ data:[
    { id:'anthropic/claude-sonnet-5', name:'Sonnet 5', pricing:{prompt:'0.000002',completion:'0.00001'}, context_length:200000, created:220 }] }) }));
await ctx.addInitScript(() => {
  localStorage.setItem('vtz_or_key','sk-t');
  /* Toast some sozinho; observar a inserção é o único jeito de saber que ele
     APARECEU, em vez de medir "já sumiu". */
  window.__avisos = [];
  /* Observa `document` e JÁ, não no DOMContentLoaded: o app.js roda no fim do
     body, então o toast do boot pode sair ANTES desse evento — esperar por ele
     mediria só os avisos tardios. `document` existe neste ponto;
     documentElement ainda não. */
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType === 1 && /toast/i.test(n.className || '')) window.__avisos.push(n.innerText || '');
  }))).observe(document, { childList:true, subtree:true });
});
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));

const estado = () => p.evaluate(() => ({
  marcado: document.getElementById('web-toggle')?.checked,
  guardado: localStorage.getItem('vtz_web_search'),
  chipAtivo: document.getElementById('tp-web')?.classList.contains('active'),
  focoVisivel: document.getElementById('search-focus')?.style.display !== 'none',
  avisos: (window.__avisos || []).join(' | ').replace(/\s+/g, ' '),
}));

console.log('— instalação nova: nasce desligada');
await p.goto('http://127.0.0.1:8198/index.html');
await p.waitForTimeout(2600);
let e = await estado();
checa('desligada por padrão', e.marcado === false, e);
checa('nada gravado ainda', e.guardado === null, e.guardado);
checa('e nenhum aviso de custo', !/0,02/.test(e.avisos), e.avisos.slice(0, 120));

console.log('— ligar grava e avisa o custo');
await p.evaluate(() => document.getElementById('web-toggle').click());
await p.waitForTimeout(500);
e = await estado();
checa('gravou ligada', e.guardado === '1', e.guardado);
checa('o chip ficou ativo', e.chipAtivo === true, e);
checa('o seletor de foco apareceu', e.focoVisivel === true, e);
checa('avisou o custo por mensagem', /0,02/.test(e.avisos), e.avisos.slice(-160));

console.log('— reabrir: volta ligada E avisa de novo');
await p.reload();
await p.waitForTimeout(2600);
e = await estado();
checa('voltou ligada', e.marcado === true, e);
checa('o chip veio ativo junto', e.chipAtivo === true, e);
checa('e o custo foi avisado no boot', /0,02/.test(e.avisos), e.avisos.slice(0, 200));

console.log('— desligar também é lembrado');
await p.evaluate(() => document.getElementById('web-toggle').click());
await p.waitForTimeout(400);
checa('gravou desligada', (await estado()).guardado === '0');
await p.reload();
await p.waitForTimeout(2600);
e = await estado();
checa('continua desligada ao reabrir', e.marcado === false, e);
checa('e sem aviso de custo', !/0,02/.test(e.avisos), e.avisos.slice(0, 140));

checa('sem erro de página', erros.length === 0, erros.slice(0, 3));
console.log('\n' + (falhas.length ? `${falhas.length} FALHA(S): ${falhas.join(', ')}` : 'tudo passou'));
await b.close();
await new Promise(r => srv.close(r));
process.exit(falhas.length ? 1 : 0);
