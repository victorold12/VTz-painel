/* Enviar e-mail é irreversível. O que este teste cobra é a trava:
 *
 *   1. o modelo NÃO consegue enviar sem uma confirmação humana
 *   2. quando a pessoa recusa, o modelo é INFORMADO de que não enviou — senão
 *      ele responde "pronto, mandei" e o e-mail nunca saiu, que é o pior
 *      desfecho possível: pior que o erro, porque ninguém procura o defeito
 *   3. marcar evento NÃO pede confirmação. É reversível em dois cliques, e
 *      pedir confirmação pra tudo treina a pessoa a clicar "sim" sem ler — aí a
 *      do e-mail, que é a que importa, deixa de valer alguma coisa
 *
 * O Google fica atrás de um backend falso: o que está em teste é a DECISÃO de
 * enviar, não a API do Google — essa tem teste próprio em
 * servidor/tests/test_google_envio.py.
 */
import http from 'node:http';
import {
  servePainel, abreNavegador, novoContexto, fingeCatalogo, placar,
} from './_ajuda.mjs';

const { checa, fim } = placar();
const estatico = await servePainel(8196);

/* Conta o que REALMENTE chegou no backend. É a única medida honesta de "o
   e-mail saiu" — o resto é o que a tela diz que aconteceu. */
const chegou = { emails: [], eventos: [] };
const back = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  if (req.method === 'OPTIONS'){ res.writeHead(204); return res.end(); }
  const rota = req.url.split('?')[0];
  let corpo = '';
  req.on('data', c => corpo += c);
  req.on('end', () => {
    const json = (o, s = 200) => { res.writeHead(s, {'Content-Type':'application/json'}); res.end(JSON.stringify(o)); };
    if (rota === '/api/health') return json({ ok:true });
    if (rota === '/api/connectors/google/status')
      return json({ configured:true, connected:true, precisa_reconectar:false, aviso:null });
    if (rota === '/api/connectors/google/gmail/send'){
      const d = JSON.parse(corpo || '{}');
      chegou.emails.push(d);
      return json({ ok:true, id:'m1', to:d.to, subject:d.subject || '(sem assunto)' });
    }
    if (rota === '/api/connectors/google/calendar/events'){
      if (req.method === 'POST'){
        const d = JSON.parse(corpo || '{}');
        chegou.eventos.push(d);
        return json({ ok:true, id:'e1', titulo:d.titulo, inicio:d.inicio, link:'http://x' });
      }
      return json({ events:[{ id:'a', titulo:'Reunião', inicio:'2026-08-02T15:00:00-03:00' }], count:1 });
    }
    if (rota === '/api/docs') return json({ documents: [], mode:'lexical' });
    return json({}, 404);
  });
});
await new Promise(r => back.listen(8197, '127.0.0.1', r));

const b = await abreNavegador();

/* O modelo falso pede a ferramenta indicada e depois relata o que ela devolveu
   — é assim que dá pra ver se o resultado da recusa chega até ele. */
let resultadoDaFerramenta = null;
async function conversa({ ferramenta, args, aceitaDialogo }){
  const ctx = await novoContexto(b, { viewport:{ width:1200, height:860 } });
  await fingeCatalogo(ctx);
  await ctx.route('**/openrouter.ai/api/v1/chat/**', async rota => {
    const corpo = JSON.parse(rota.request().postData() || '{}');
    if (!(corpo.messages || []).some(m => m.role === 'tool')){
      return rota.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
        choices:[{ finish_reason:'tool_calls', message:{ role:'assistant', content:null,
          tool_calls:[{ id:'c1', type:'function',
            function:{ name: ferramenta, arguments: JSON.stringify(args) } }] } }],
        usage:{ prompt_tokens:10, completion_tokens:5 } }) });
    }
    resultadoDaFerramenta = (corpo.messages || []).filter(m => m.role === 'tool')
      .map(m => m.content).join(' ');
    return rota.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
      choices:[{ finish_reason:'stop', message:{ role:'assistant',
        content:'ok: ' + resultadoDaFerramenta.slice(0, 120) } }],
      usage:{ prompt_tokens:20, completion_tokens:8 } }) });
  });
  await ctx.addInitScript(() => {
    localStorage.setItem('vtz_or_key','sk-t');
    localStorage.setItem('vtz_backend_url','http://127.0.0.1:8197');
    localStorage.setItem('vtz_tools','1');
  });
  const p = await ctx.newPage();
  const dialogos = [];
  p.on('dialog', d => { dialogos.push(d.message()); aceitaDialogo ? d.accept() : d.dismiss(); });
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  await p.goto(estatico.url + '/index.html');
  await p.waitForTimeout(2600);
  await p.fill('#chat-input', 'faz o que eu pedi');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(4500);
  return { p, ctx, dialogos, erros };
}

console.log('— e-mail: sem confirmação, não sai');
resultadoDaFerramenta = null;
let r = await conversa({ ferramenta:'enviar_email', aceitaDialogo:false,
  args:{ para:'chefe@empresa.com', assunto:'Pedido de demissão', corpo:'Venho por meio desta…' } });
checa('pediu confirmação', r.dialogos.length === 1, r.dialogos);
checa('a confirmação mostra o destinatário', /chefe@empresa\.com/.test(r.dialogos[0] || ''), r.dialogos[0]);
checa('mostra o assunto', /Pedido de demiss/.test(r.dialogos[0] || ''), r.dialogos[0]);
checa('mostra o corpo', /Venho por meio desta/.test(r.dialogos[0] || ''), r.dialogos[0]);
checa('avisa que não dá pra desfazer', /desfeito|irrevers/i.test(r.dialogos[0] || ''), r.dialogos[0]);
checa('NENHUM e-mail chegou no backend', chegou.emails.length === 0, chegou.emails);
checa('e o modelo foi informado do cancelamento',
  /CANCELOU/.test(resultadoDaFerramenta || ''), String(resultadoDaFerramenta).slice(0, 140));
checa('com instrução de não mentir que enviou',
  /Não diga que enviou/i.test(resultadoDaFerramenta || ''), String(resultadoDaFerramenta).slice(0, 200));
await r.ctx.close();

console.log('— e-mail: com confirmação, sai');
resultadoDaFerramenta = null;
r = await conversa({ ferramenta:'enviar_email', aceitaDialogo:true,
  args:{ para:'amigo@exemplo.com', assunto:'Oi', corpo:'Tudo certo pra sexta?' } });
checa('chegou UM e-mail no backend', chegou.emails.length === 1, chegou.emails);
checa('com o destinatário certo', chegou.emails[0]?.to === 'amigo@exemplo.com', chegou.emails[0]);
checa('e o corpo certo', chegou.emails[0]?.body === 'Tudo certo pra sexta?', chegou.emails[0]);
checa('o modelo soube que enviou',
  /Enviado para amigo@exemplo\.com/.test(resultadoDaFerramenta || ''),
  String(resultadoDaFerramenta).slice(0, 140));
await r.ctx.close();

console.log('— agenda: ler não pede nada');
resultadoDaFerramenta = null;
r = await conversa({ ferramenta:'ver_agenda', args:{ dias:7 }, aceitaDialogo:false });
checa('não pediu confirmação pra LER', r.dialogos.length === 0, r.dialogos);
checa('trouxe os eventos', /Reuni/.test(resultadoDaFerramenta || ''),
  String(resultadoDaFerramenta).slice(0, 140));
await r.ctx.close();

console.log('— agenda: marcar também não pede (é reversível)');
resultadoDaFerramenta = null;
r = await conversa({ ferramenta:'marcar_evento', aceitaDialogo:false,
  args:{ titulo:'Dentista', inicio:'2026-08-02T15:00' } });
checa('não pediu confirmação', r.dialogos.length === 0, r.dialogos);
checa('o evento chegou no backend', chegou.eventos.length === 1, chegou.eventos);
checa('com título e início certos',
  chegou.eventos[0]?.titulo === 'Dentista' && chegou.eventos[0]?.inicio === '2026-08-02T15:00',
  chegou.eventos[0]);
checa('sem erro de página', r.erros.length === 0, r.erros.slice(0, 3));
await r.ctx.close();

const saida = fim();
await b.close();
await estatico.fecha();
await new Promise(r2 => back.close(r2));
process.exit(saida);
