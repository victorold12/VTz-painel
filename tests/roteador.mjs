/* O roteador escolhe o modelo ANTES de qualquer resposta aparecer. Quando ele
   erra, o sintoma no chat é só "a resposta veio ruim" — não dá pra depurar
   olhando a tela. Então este teste embaralha o catálogo de propósito e cobra
   que a escolha continue a mesma: se a ordem do OpenRouter muda a decisão, é
   porque a decisão nunca foi sobre qualidade.

   Roda contra o app.js REAL, no navegador — as funções vivem dentro do IIFE, e
   o único jeito honesto de alcançá-las é pelo mesmo caminho que a interface
   usa. Por isso o teste mexe no catálogo e observa o que a UI mostra. */
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

/* Catálogo de mentira, mas com as armadilhas reais: a variante reduzida vem
   ANTES da completa em toda família, que é o caso que quebrava o código antigo. */
const CATALOGO = [
  { id:'openai/gpt-5-nano',            name:'GPT-5 Nano',    pricing:{prompt:'0.0000001',completion:'0.0000004'}, context_length:400000, created: 100 },
  { id:'openai/gpt-5-mini',            name:'GPT-5 Mini',    pricing:{prompt:'0.0000004',completion:'0.0000016'}, context_length:400000, created: 110 },
  { id:'openai/gpt-5.5',               name:'GPT-5.5',       pricing:{prompt:'0.000005',completion:'0.00003'},    context_length:400000, created: 200 },
  { id:'google/gemini-3.1-flash-lite', name:'Gemini Lite',   pricing:{prompt:'0.00000025',completion:'0.0000015'},context_length:1048576, created: 120 },
  { id:'google/gemini-3.1-pro',        name:'Gemini 3.1 Pro',pricing:{prompt:'0.000002',completion:'0.000012'},   context_length:1048576, created: 210 },
  { id:'anthropic/claude-haiku-4.5',   name:'Haiku 4.5',     pricing:{prompt:'0.000001',completion:'0.000005'},   context_length:200000, created: 130 },
  { id:'anthropic/claude-sonnet-4.6',  name:'Sonnet 4.6',    pricing:{prompt:'0.000003',completion:'0.000015'},   context_length:200000, created: 140 },
  { id:'anthropic/claude-sonnet-5',    name:'Sonnet 5',      pricing:{prompt:'0.000002',completion:'0.00001'},    context_length:200000, created: 220 },
  { id:'anthropic/claude-opus-4.8',    name:'Opus 4.8',      pricing:{prompt:'0.000005',completion:'0.000025'},   context_length:200000, created: 230 },
  { id:'deepseek/deepseek-r1',         name:'DeepSeek R1',   pricing:{prompt:'0.0000006',completion:'0.0000024'}, context_length:164000, created: 150 },
  { id:'deepseek/deepseek-r1:free',    name:'R1 free',       pricing:{prompt:'0',completion:'0'},                 context_length:164000, created: 151 },
  { id:'z-ai/glm-4.7-flash',           name:'GLM Flash free',pricing:{prompt:'0',completion:'0'},                 context_length:200000, created: 152 },
];

const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const arq = path.join(RAIZ, rel);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()){
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  res.end(fs.readFileSync(arq));
});
await new Promise((r) => srv.listen(8191, '127.0.0.1', r));

const b = await abreNavegador();

/* Abre o painel com um catálogo controlado, na ordem pedida, e devolve o que o
   app escolheu pra cada tier — lido dos <select> da tela, que é o que a pessoa
   veria. */
async function abreCom(modelos, vies){
  const ctx = await b.newContext({ viewport:{width:1360,height:900}, reducedMotion:'reduce' });
  await ctx.route('**/openrouter.ai/api/v1/models*', (rota) =>
    rota.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ data: modelos }) }));
  await ctx.addInitScript(([, v]) => {
    localStorage.setItem('vtz_or_key', 'sk-t');
    if (v) localStorage.setItem('vtz_router_vies', v);
  }, [modelos, vies || '']);
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.goto('http://127.0.0.1:8191/index.html');
  await p.waitForTimeout(2600);
  await p.evaluate(() => document.getElementById('account-btn')?.click());
  await p.waitForTimeout(250);
  await p.evaluate(() => [...document.querySelectorAll('#account-menu button')]
    .find((e) => /^Configura/i.test(e.textContent.trim()))?.click());
  await p.waitForTimeout(450);
  await p.evaluate(() => document.querySelector('#cfg-nav [data-cat="conexao"]')?.click());
  await p.waitForTimeout(500);
  const tiers = await p.evaluate(() => ({
    fast: document.getElementById('router-fast-select')?.value,
    balanced: document.getElementById('router-balanced-select')?.value,
    power: document.getElementById('router-power-select')?.value,
    vies: document.getElementById('router-vies-select')?.value,
    viesTexto: (document.getElementById('router-vies-msg')?.textContent || ''),
    ativo: document.getElementById('current-model-label')?.textContent?.trim() || '',
  }));
  return { ctx, p, tiers, erros };
}

console.log('— o tier Potente tem que ser um modelo potente');
const a = await abreCom(CATALOGO);
checa('Potente não é uma variante reduzida',
  !/nano|mini|lite|haiku/i.test(a.tiers.power || ''), a.tiers.power);
checa('Potente é da família certa', /opus|sonnet|gpt-5\.5/.test(a.tiers.power || ''), a.tiers.power);
checa('Rápido continua sendo um leve', /lite|nano|haiku|flash|gemma/i.test(a.tiers.fast || ''), a.tiers.fast);
checa('sem erro de página', a.erros.length === 0, a.erros.slice(0, 3));

checa('o rótulo do modelo ativo foi lido', a.tiers.ativo.length > 2, a.tiers.ativo);
checa('o modelo que abre não é o mais fraco do catálogo',
  !/nano|lite|1b|3b/i.test(a.tiers.ativo), a.tiers.ativo);

console.log('— a ordem do catálogo não pode mudar a escolha');
const embaralhado = CATALOGO.slice().reverse();
const bb = await abreCom(embaralhado);
checa('Potente é o mesmo com o catálogo invertido', bb.tiers.power === a.tiers.power,
  { antes: a.tiers.power, depois: bb.tiers.power });
checa('Equilibrado idem', bb.tiers.balanced === a.tiers.balanced,
  { antes: a.tiers.balanced, depois: bb.tiers.balanced });
checa('Rápido idem', bb.tiers.fast === a.tiers.fast,
  { antes: a.tiers.fast, depois: bb.tiers.fast });
checa('o modelo que abre idem', bb.tiers.ativo === a.tiers.ativo,
  { antes: a.tiers.ativo, depois: bb.tiers.ativo });

console.log('— o viés é escolhido pela pessoa e some do padrão só se ela mexer');
checa('padrão é equilíbrio', a.tiers.vies === 'equilibrio', a.tiers.vies);
checa('e a tela explica o que isso faz', a.tiers.viesTexto.length > 40, a.tiers.viesTexto);
const c = await abreCom(CATALOGO, 'qualidade');
checa('escolha guardada volta ao abrir', c.tiers.vies === 'qualidade', c.tiers.vies);
checa('e o texto muda junto', /qualidade da resposta/i.test(c.tiers.viesTexto), c.tiers.viesTexto.slice(0, 90));

console.log('— trocar na tela grava e explica');
await c.p.selectOption('#router-vies-select', 'economia');
await c.p.waitForTimeout(400);
const depois = await c.p.evaluate(() => ({
  guardado: localStorage.getItem('vtz_router_vies'),
  texto: document.getElementById('router-vies-msg')?.textContent || '',
}));
checa('gravou economia', depois.guardado === 'economia', depois.guardado);
checa('e o texto acompanhou', /custo/i.test(depois.texto), depois.texto.slice(0, 90));

console.log('\n' + (falhas.length ? `${falhas.length} FALHA(S): ${falhas.join(', ')}` : 'tudo passou'));
await b.close();
await new Promise((r) => srv.close(r));
process.exit(falhas.length ? 1 : 0);
