/* A cena do JARVIS ouvindo, respondendo e FALANDO.
 *
 * Este teste existe porque eu já dei um defeito como corrigido sem ele. Na vez
 * anterior o teste injetava o pedido por TEXTO — passou verde e o caminho da
 * voz continuou quebrado na mão do usuário. Aqui o microfone é falsificado de
 * verdade (`--use-fake-device-for-media-stream`), então o caminho exercitado é
 * o mesmo que uma pessoa percorre.
 *
 * Os três defeitos que ficam travados:
 *   1. escuta sem fim — o `speechEnd` só saía depois de o volume cruzar um
 *      limiar; microfone baixo nunca cruzava e a cena ficava em "escutando"
 *      para sempre, muda
 *   2. volta muda — sem reconhecimento de fala (o normal no app de desktop, que
 *      não tem o serviço do Google), o transcript vinha vazio e a cena ia pra
 *      idle sem dizer nada, indistinguível de "me ignorou"
 *   3. não falava — a resposta só aparecia escrita
 */
import http from 'node:http';
import { chromium } from 'playwright';
import {
  servePainel, novoContexto, fingeCatalogo, placar, exigePortaLivre,
} from './_ajuda.mjs';

const { checa, fim } = placar();
await exigePortaLivre(8201);
await exigePortaLivre(8202);
const estatico = await servePainel(8201);

/* Backend falso: o /api/agent do JARVIS fala NDJSON, e o /speak devolve o que o
   Agente Local devolveria. */
let pediuFala = null;
let transcreveu = null;
const back = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  if (req.method === 'OPTIONS'){ res.writeHead(204); return res.end(); }
  const rota = req.url.split('?')[0];
  let corpo = '';
  req.on('data', c => corpo += c);
  req.on('end', () => {
    const json = (o, s = 200) => { res.writeHead(s, {'Content-Type':'application/json'}); res.end(JSON.stringify(o)); };
    if (rota === '/api/health') return json({ ok:true });
    if (rota === '/api/agents') return json({ agents:[{ agent_id:'pc1', name:'PC', online:true, revoked:false }] });
    if (rota === '/api/agent'){
      res.writeHead(200, {'Content-Type':'application/x-ndjson'});
      const manda = o => res.write(JSON.stringify(o) + '\n');
      manda({ type:'step', id:'s1', label:'Pensando', status:'active' });
      manda({ type:'done', answer:'O relatorio esta pronto, senhor.', files:[], steps:['Feito'] });
      return res.end();
    }
    if (/\/transcribe$/.test(rota)){
      const d = JSON.parse(corpo || '{}');
      transcreveu = { bytes: (d.audio_base64 || '').length, format: d.format };
      /* Devolve no mesmo formato do agente: {ok, data:{text}} */
      return json({ ok:true, data:{ text:'monta o relatorio', model:'base' } });
    }
    if (/\/speak$/.test(rota)){
      pediuFala = JSON.parse(corpo || '{}');
      /* delegate:browser é o contrato real de "não tenho motor de pé" — o
         painel tem que cair na voz do navegador, não ficar mudo. */
      return json({ ok:false, delegate:'browser', reason:'sem motor local' });
    }
    return json({}, 404);
  });
});
await new Promise(r => back.listen(8202, '127.0.0.1', r));

/* Microfone falso do Chromium: sem ele, getUserMedia falha e o teste mediria o
   caminho de erro, não o de sucesso. */
const b = await chromium.launch({ headless:true, args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-proxy-server',
  '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] });
const ctx = await novoContexto(b, { permissions:['microphone'] });
await fingeCatalogo(ctx);
await ctx.addInitScript(() => {
  localStorage.setItem('vtz_or_key','sk-t');
  localStorage.setItem('vtz_backend_url','http://127.0.0.1:8202');
  /* Reconhecimento de fala FORA — é exatamente a situação do app de desktop. */
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  /* Espiona a voz do navegador sem depender de haver áudio no runner.
     defineProperty e não atribuição: `speechSynthesis` é um getter do
     protótipo, e `window.speechSynthesis = {...}` falha CALADO — o teste
     mediria o stub que nunca entrou no lugar. */
  window.__falou = [];
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    cancel(){}, getVoices(){ return []; },
    speak(u){ window.__falou.push(String(u && u.text || '')); },
  }});
  window.SpeechSynthesisUtterance = function(t){ this.text = t; };
});
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));
await p.goto(estatico.url + '/index.html');
await p.waitForTimeout(2600);

const estado = () => p.evaluate(() => ({
  jstate: document.body.dataset.jstate,
  legenda: (document.querySelector('#j-cap-text')?.textContent || '').trim(),
  falou: (window.__falou || []).join(' | '),
}));

console.log('— abre a cena e manda escutar');
await p.evaluate(() => document.getElementById('jarvis-entry')?.click());
await p.waitForTimeout(900);
const abriu = await p.evaluate(() => !!document.querySelector('#jarvis-overlay.open'));
checa('a cena abriu', abriu);

if (abriu){
  await p.evaluate(() => document.querySelector('#j-mic')?.click());
  await p.waitForTimeout(1200);
  checa('entrou em escuta', (await estado()).jstate === 'listening', await estado());

  console.log('— sem reconhecimento de fala, a escuta NÃO fica presa');
  /* O microfone falso do Chromium emite um tom: o volume cruza o limiar, então
     o caminho aqui é "falou mas não virou texto". O teto de 15s garante saída
     mesmo se não cruzasse. */
  await p.waitForFunction(() => document.body.dataset.jstate !== 'listening',
    null, { timeout: 20000 }).catch(() => {});
  const e = await estado();
  checa('saiu de "escutando" sozinha', e.jstate !== 'listening', e);
  /* O PONTO DESTE TESTE: sem reconhecimento do navegador, o áudio tem que ir
     pro whisper do PC. Antes deste conserto, aqui a cena parava e avisava; agora
     ela transcreve e SEGUE. */
  checa('mandou o áudio pro PC transcrever', !!transcreveu, transcreveu);
  checa('com bytes de verdade', (transcreveu?.bytes || 0) > 100, transcreveu);
  checa('e seguiu sozinha até entregar',
    /Entregue|relatorio/i.test(await p.evaluate(() =>
      document.querySelector('#j-deliver')?.innerText || '')), e);
}

console.log('— com o pedido por texto, ele responde E FALA');
await p.evaluate(() => {
  const i = document.querySelector('#j-input');
  if (i){ i.value = 'monta o relatorio'; i.dispatchEvent(new Event('input', { bubbles:true })); }
});
await p.evaluate(() => {
  const b = document.querySelector('#j-run, #j-send');
  if (b) b.click();
  else document.querySelector('#j-input')?.dispatchEvent(
    new KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
});
await p.waitForTimeout(4500);
const fim1 = await estado();
checa('entregou a resposta', /Entregue|relatorio/i.test(
  await p.evaluate(() => document.querySelector('#j-deliver')?.innerText || '')), fim1);
checa('pediu a fala pro PC', !!pediuFala, pediuFala);
checa('com o texto da resposta', /relatorio esta pronto/i.test(pediuFala?.text || ''), pediuFala);
checa('e caiu na voz do navegador quando o PC delegou',
  /relatorio esta pronto/i.test(fim1.falou), fim1.falou.slice(0, 120));

checa('sem erro de página', erros.length === 0, erros.slice(0, 3));

const saida = fim();
await b.close();
await estatico.fecha();
await new Promise(r => back.close(r));
process.exit(saida);
