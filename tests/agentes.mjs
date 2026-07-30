/* Agente com identidade própria: teto de gasto que TRAVA, e ferramentas que
 * valem só pra ele.
 *
 * O teto é a parte que precisa de teste de verdade: um agente que roda sozinho
 * gasta em várias rodadas, e um limite que só avisa depois não é limite. Aqui o
 * bloqueio é medido pelo que chega no OpenRouter — se a requisição sair, o teto
 * falhou, independente do que a tela diga.
 */
import {
  servePainel, abreNavegador, novoContexto, fingeCatalogo, placar, exigePortaLivre,
} from './_ajuda.mjs';

const { checa, fim } = placar();
await exigePortaLivre(8203);
const estatico = await servePainel(8203);

const b = await abreNavegador();
const ctx = await novoContexto(b);
await fingeCatalogo(ctx);

let chamadas = [];
await ctx.route('**/openrouter.ai/api/v1/chat/**', rota => {
  chamadas.push(JSON.parse(rota.request().postData() || '{}'));
  return rota.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
    choices:[{ finish_reason:'stop', message:{ role:'assistant', content:'ok' } }],
    usage:{ prompt_tokens:1000, completion_tokens:1000 } }) });
});

/* Dois agentes: um restrito e barato, outro já estourado. Gravados direto no
   localStorage porque o que está em teste é o COMPORTAMENTO deles, não o
   formulário — o formulário tem verificação própria mais abaixo. */
await ctx.addInitScript(() => {
  localStorage.setItem('vtz_or_key', 'sk-t');
  localStorage.setItem('vtz_tools', '1');
  localStorage.setItem('vtz_agents', JSON.stringify([
    { id:'restrito', icon:'bot', name:'Só documentos', desc:'ferramenta única',
      systemPrompt:'Você só consulta documentos.', model:'',
      tools:['buscar_meus_documentos'], budget:5, spent:0 },
    { id:'estourado', icon:'bot', name:'No teto', desc:'já gastou tudo',
      systemPrompt:'x', model:'', budget:0.01, spent:0.5 },
  ]));
});
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));
await p.goto(estatico.url + '/index.html');
await p.waitForTimeout(2600);

const abreAgentes = () => p.evaluate(() =>
  document.querySelector('.side-nav-item[data-view="agente"]')?.click());

console.log('— o card mostra o gasto');
await abreAgentes();
await p.waitForTimeout(700);
const cards = await p.evaluate(() =>
  [...document.querySelectorAll('.agent-card')].map(c => c.innerText.replace(/\s+/g, ' ')));
checa('lista os dois agentes', cards.length === 2, cards);
checa('mostra o teto de quem tem', cards.some(c => /de 5\.00|de 5,00/.test(c)), cards);
checa('e marca TRAVADO em quem estourou', cards.some(c => /TRAVADO/.test(c)), cards);
checa('tem botão de rodar sozinho', await p.evaluate(() =>
  !!document.querySelector('.run-agent-btn')));

console.log('— agente no teto NÃO gasta mais nada');
chamadas = [];
await p.evaluate(() => {
  const alvo = [...document.querySelectorAll('.agent-card')]
    .find(c => /No teto/.test(c.innerText));
  alvo?.click();
});
await p.waitForTimeout(800);
await p.fill('#chat-input', 'oi');
await p.keyboard.press('Enter');
await p.waitForTimeout(2500);
checa('nenhuma requisição saiu', chamadas.length === 0, chamadas.length);
const naTela = await p.evaluate(() =>
  [...document.querySelectorAll('.msg')].map(m => m.innerText).join(' ').replace(/\s+/g, ' '));
checa('e a tela diz que travou por teto', /teto de gasto/i.test(naTela), naTela.slice(-200));
checa('dizendo como destravar', /aumentar o limite|zerar/i.test(naTela), naTela.slice(-200));

console.log('— agente restrito só recebe a ferramenta dele');
chamadas = [];
await abreAgentes();
await p.waitForTimeout(600);
await p.evaluate(() => {
  const alvo = [...document.querySelectorAll('.agent-card')]
    .find(c => /Só documentos/.test(c.innerText));
  alvo?.click();
});
await p.waitForTimeout(800);
await p.fill('#chat-input', 'o que diz o contrato?');
await p.keyboard.press('Enter');
await p.waitForTimeout(3000);
checa('a requisição saiu', chamadas.length >= 1, chamadas.length);
const nomes = (chamadas[0]?.tools || []).map(t => t.function?.name);
checa('mandou exatamente 1 ferramenta', nomes.length === 1, nomes);
checa('e é a que o agente pode usar', nomes[0] === 'buscar_meus_documentos', nomes);
checa('nada de mexer no PC', !nomes.includes('pc_action'), nomes);
checa('nem de enviar e-mail', !nomes.includes('enviar_email'), nomes);

console.log('— o gasto cai no agente certo');
await abreAgentes();
await p.waitForTimeout(700);
const depois = await p.evaluate(() => JSON.parse(localStorage.getItem('vtz_agents') || '[]')
  .map(a => ({ id:a.id, spent:a.spent })));
const restrito = depois.find(a => a.id === 'restrito');
const estourado = depois.find(a => a.id === 'estourado');
checa('o agente que respondeu foi debitado', restrito.spent > 0, restrito);
checa('e o que travou não gastou nada a mais', estourado.spent === 0.5, estourado);

console.log('— o editor mostra e grava teto e ferramentas');
await p.evaluate(() => {
  const alvo = [...document.querySelectorAll('.agent-card')]
    .find(c => /Só documentos/.test(c.innerText));
  alvo?.querySelector('.edit-agent-btn')?.click();
});
await p.waitForTimeout(700);
const editor = await p.evaluate(() => ({
  teto: document.getElementById('agent-budget-input')?.value,
  gasto: document.getElementById('agent-spent-hint')?.textContent || '',
  marcadas: [...document.querySelectorAll('#agent-tools-list input:checked')].map(i => i.value),
  total: document.querySelectorAll('#agent-tools-list input').length,
}));
checa('o teto salvo aparece', editor.teto === '5', editor.teto);
checa('o gasto aparece', /gastou US\$/.test(editor.gasto), editor.gasto);
checa('só a ferramenta dele vem marcada', editor.marcadas.length === 1, editor.marcadas);
checa('e as outras aparecem pra marcar', editor.total > 1, editor.total);

checa('sem erro de página', erros.length === 0, erros.slice(0, 3));

const saida = fim();
await b.close();
await estatico.fecha();
process.exit(saida);
