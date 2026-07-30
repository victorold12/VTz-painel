/* O PWA só vale se ele ABRIR SEM REDE. Testar "o service worker registrou" não
   prova nada — o que prova é derrubar o servidor e recarregar a página.

   Também se mede a armadilha oposta: rede primeiro tem que continuar entregando
   arquivo NOVO quando há rede. Um PWA que serve app.js velho é pior que nenhum. */
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
  '.png':'image/png', '.webmanifest':'application/manifest+json', '.json':'application/json' };

/* Um marcador que muda entre as duas fases, pra distinguir "veio do cache" de
   "veio da rede" sem depender de heurística. */
let MARCA = 'PRIMEIRA';
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const arq = path.join(RAIZ, rel);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()){
    res.writeHead(404); res.end('nao'); return;
  }
  const ext = path.extname(arq);
  let corpo = fs.readFileSync(arq);
  if (rel === 'marca.txt') corpo = Buffer.from(MARCA);
  res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream' });
  res.end(corpo);
});
fs.writeFileSync(path.join(RAIZ, 'marca.txt'), 'x');
await new Promise((r) => srv.listen(8188, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:8188/index.html';

const b = await abreNavegador();
const ctx = await b.newContext({ viewport:{width:430,height:900}, reducedMotion:'reduce' });
await ctx.addInitScript(() => localStorage.setItem('vtz_or_key','sk-t'));
const p = await ctx.newPage();
const csp = [];
p.on('console', (m) => { if (/Content Security Policy|Refused to/.test(m.text())) csp.push(m.text()); });
const erros = [];
p.on('pageerror', (e) => erros.push(e.message));

console.log('— primeira visita (com rede)');
await p.goto(BASE);
await p.waitForTimeout(3000);

const reg = await p.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return { tem: !!r, escopo: r ? r.scope : '', ativo: !!(r && r.active) };
});
checa('service worker registrou', reg.tem, reg);
checa('e ficou ativo', reg.ativo, reg);
checa('sem violação de CSP', csp.length === 0, csp.slice(0, 3));
checa('sem erro de página', erros.length === 0, erros.slice(0, 3));

/* O manifest é o que o navegador lê pra oferecer a instalação. Ler o link e
   buscar o arquivo prova as duas pontas: a tag está lá e o arquivo é servível. */
const man = await p.evaluate(async () => {
  const l = document.querySelector('link[rel="manifest"]');
  if (!l) return { tag: false };
  const r = await fetch(l.href);
  const j = await r.json();
  return { tag: true, ok: r.ok, nome: j.name, display: j.display, icones: (j.icons || []).length,
    maskable: (j.icons || []).some((i) => /maskable/.test(i.purpose || '')) };
});
checa('index.html aponta pro manifest', man.tag === true, man);
checa('manifest carrega e é JSON válido', man.ok === true, man);
checa('display standalone (janela própria)', man.display === 'standalone', man.display);
checa('tem ícone maskable (Android não corta)', man.maskable === true, man);

const icones = await p.evaluate(async () => {
  const alvos = ['icons/icone-192.png','icons/icone-512.png','icons/icone-512-maskable.png'];
  const out = {};
  for (const a of alvos){
    const r = await fetch(a);
    out[a] = r.ok ? (await r.blob()).size : 0;
  }
  return out;
});
Object.entries(icones).forEach(([k, v]) => checa('ícone existe: ' + k, v > 1000, v));

/* Espera o cache encher antes de cortar a rede — senão o teste offline mede a
   corrida, não o comportamento. */
await p.waitForFunction(async () => {
  const c = await caches.open('vtz-v1');
  return (await c.keys()).length >= 5;
}, null, { timeout: 15000 }).catch(() => {});
const noCache = await p.evaluate(async () => {
  const c = await caches.open('vtz-v1');
  return (await c.keys()).map((r) => new URL(r.url).pathname);
});
checa('guardou os arquivos do app', noCache.includes('/app.js') && noCache.includes('/index.html'),
  noCache.slice(0, 6));

console.log('— rede primeiro: arquivo mudou no servidor, o app tem que ver o novo');
MARCA = 'SEGUNDA';
const vistoOnline = await p.evaluate(async () => (await (await fetch('marca.txt')).text()));
checa('com rede, serve o conteúdo atual (não o do cache)', vistoOnline === 'SEGUNDA', vistoOnline);

console.log('— agora sem rede nenhuma: o servidor cai');
await new Promise((r) => srv.close(r));
csp.length = 0; erros.length = 0;

await p.reload({ waitUntil: 'domcontentloaded' }).catch((e) => console.log('   reload:', e.message));
await p.waitForTimeout(3500);

const offline = await p.evaluate(() => ({
  titulo: document.title,
  temChat: !!document.getElementById('chat-input') || !!document.querySelector('#composer, .composer'),
  temSidebar: !!document.querySelector('#sidebar, .sidebar'),
  jsRodou: typeof window.__vtzBoot !== 'undefined' || document.querySelectorAll('button').length > 10,
  botoes: document.querySelectorAll('button').length,
}));
checa('offline: a página abriu', offline.titulo === 'VTz LLM', offline.titulo);
checa('offline: a interface montou (JS do cache rodou)', offline.botoes > 10, offline.botoes);
checa('offline: sem erro de página', erros.length === 0, erros.slice(0, 3));

console.log('— o cartão "Instalar" explica o que está acontecendo');
const estado = await p.evaluate(() => {
  document.getElementById('account-btn')?.click();
  return true;
});
await p.waitForTimeout(300);
await p.evaluate(() => [...document.querySelectorAll('#account-menu button')]
  .find((e) => /^Configura/i.test(e.textContent.trim()))?.click());
await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#cfg-nav [data-cat="dados"]')?.click());
await p.waitForTimeout(600);
const cartao = await p.evaluate(() => {
  const b = document.getElementById('pwa-instalar-btn');
  const t = document.getElementById('pwa-estado');
  return { temBotao: !!b, texto: (t?.innerText || '').replace(/\s+/g, ' ') };
});
checa('o botão Instalar existe', cartao.temBotao, cartao);
checa('e o estado é explicado, nunca vazio', cartao.texto.length > 20 && cartao.texto !== '—', cartao.texto);

fs.unlinkSync(path.join(RAIZ, 'marca.txt'));
console.log('\n' + (falhas.length ? `${falhas.length} FALHA(S): ${falhas.join(', ')}` : 'tudo passou'));
await b.close();
process.exit(falhas.length ? 1 : 0);
