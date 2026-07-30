/* RAG ponta a ponta: painel real + backend real (uvicorn, banco temporário).
 *
 * O que interessa provar aqui não é "a rota responde" — o teste de backend
 * (servidor/tests/test_docs_rag.py) já cobre isso. É que o CAMINHO INTEIRO
 * fecha: o arquivo é lido no navegador, o texto sobe, o modelo chama a
 * ferramenta sozinho, o trecho volta com a origem, e a resposta na tela contém
 * o fato que só existe no documento.
 *
 * O OpenRouter é falsificado porque sem chave de verdade não haveria resposta
 * nenhuma — e o que está sendo medido é o encanamento, não a inteligência do
 * modelo. O falso responde como um modelo com tool-calling responde: primeiro
 * um tool_call, depois o texto usando o que a ferramenta devolveu.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  servePainel, abreNavegador, novoContexto, fingeCatalogo,
  abreConfig, voltaProChat, placar, achaServidor, exigePortaLivre,
} from './_ajuda.mjs';

const SERVIDOR = achaServidor();
if (!SERVIDOR){
  console.log('PULADO: repo `servidor` não encontrado ao lado deste. ' +
              'Clone os dois lado a lado, ou aponte VTZ_SERVIDOR_PATH.');
  process.exit(0);
}

const { checa, fim } = placar();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vtz-docs-e2e-'));

/* O fato só existe neste arquivo: se aparecer na resposta, veio do índice. */
const SEGREDO = 'O codigo do portao da chacara e 8813-KX.';
const ARQ = path.join(TMP, 'anotacoes-teste.txt');
fs.writeFileSync(ARQ, 'Anotacoes da chacara.\n\nA cerca foi trocada em marco.\n\n' +
  SEGREDO + '\n\nO caseiro se chama Nilton e trabalha as tercas.\n');

for (const porta of [8192, 8193]) await exigePortaLivre(porta);
const estatico = await servePainel(8192);

const uvicorn = spawn('python3', ['-m', 'uvicorn', 'app.main:app', '--port', '8193', '--host', '127.0.0.1'],
  { cwd: SERVIDOR, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, JARVIS_DB_PATH: path.join(TMP, 'e2e.db'),
           ALLOWED_ORIGINS: estatico.url, RENDER: '' } });
let subiu = false;
for (let i = 0; i < 60; i++){
  try{ if ((await fetch('http://127.0.0.1:8193/api/health')).ok){ subiu = true; break; } }catch(e){}
  await new Promise(r => setTimeout(r, 400));
}
if (!subiu){ console.log('FALHA: o backend não subiu.'); uvicorn.kill(); await estatico.fecha(); process.exit(1); }

const b = await abreNavegador();
const ctx = await novoContexto(b);
await fingeCatalogo(ctx);

/* Modelo falso com tool-calling em duas rodadas. Resposta COMPLETA, não SSE:
   com tools ligadas o painel desliga o streaming (tool-use exige a mensagem
   inteira). Mandar SSE aqui testaria um caminho que o app não percorre. */
let resultadoDaFerramenta = null;
await ctx.route('**/openrouter.ai/api/v1/chat/**', async rota => {
  const corpo = JSON.parse(rota.request().postData() || '{}');
  const jaTemResultado = (corpo.messages || []).some(m => m.role === 'tool');
  if (!jaTemResultado){
    return rota.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
      choices:[{ finish_reason:'tool_calls', message:{ role:'assistant', content:null,
        tool_calls:[{ id:'c1', type:'function', function:{
          name:'buscar_meus_documentos',
          arguments:'{"consulta":"codigo do portao da chacara"}' } }] } }],
      usage:{ prompt_tokens:10, completion_tokens:5 } }) });
  }
  resultadoDaFerramenta = (corpo.messages || []).filter(m => m.role === 'tool')
    .map(m => m.content).join(' ');
  const achou = /8813-KX/.test(resultadoDaFerramenta);
  const citou = /anotacoes-teste\.txt/.test(resultadoDaFerramenta);
  return rota.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
    choices:[{ finish_reason:'stop', message:{ role:'assistant',
      content: achou ? ('O codigo e 8813-KX' + (citou ? ' (fonte: anotacoes-teste.txt).' : '.'))
                     : 'Nao encontrei.' } }],
    usage:{ prompt_tokens:20, completion_tokens:8 } }) });
});

await ctx.addInitScript(() => {
  localStorage.setItem('vtz_or_key', 'sk-t');
  localStorage.setItem('vtz_backend_url', 'http://127.0.0.1:8193');
  localStorage.setItem('vtz_tools', '1');
});
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));
await p.goto(estatico.url + '/index.html');
await p.waitForTimeout(2600);

console.log('— indexar um arquivo pela tela');
await abreConfig(p, 'dados');
checa('a seção existe', await p.evaluate(() => !!document.getElementById('docs-add-btn')));
await p.setInputFiles('#docs-file', ARQ);
await p.waitForTimeout(2500);

const tela = await p.evaluate(() => ({
  msg: document.getElementById('docs-msg')?.textContent || '',
  lista: (document.getElementById('docs-lista')?.innerText || '').replace(/\s+/g, ' '),
  itens: document.querySelectorAll('.doc-item').length,
}));
checa('confirmou a indexação', /pedaço/i.test(tela.msg), tela.msg);
checa('o arquivo aparece na lista', tela.itens === 1, tela);
checa('a lista mostra o nome', /anotacoes-teste/.test(tela.lista), tela.lista.slice(0, 120));
/* Sem provedor de embeddings, a busca é por termos — e a tela precisa DIZER
   isso, senão a pessoa acha que o RAG está quebrado quando ele só é léxico. */
checa('avisa que a busca está no modo termos', /termos/i.test(tela.lista), tela.lista.slice(0, 160));

console.log('— o chat usa o documento sem ninguém anexar nada');
await voltaProChat(p);
await p.fill('#chat-input', 'qual e o codigo do portao da chacara?');
await p.keyboard.press('Enter');
await p.waitForTimeout(6000);

checa('o modelo chamou a ferramenta', !!resultadoDaFerramenta);
checa('a ferramenta devolveu o trecho do documento',
  /8813-KX/.test(resultadoDaFerramenta || ''), String(resultadoDaFerramenta).slice(0, 200));
checa('e devolveu a ORIGEM junto',
  /anotacoes-teste\.txt/.test(resultadoDaFerramenta || ''), String(resultadoDaFerramenta).slice(0, 200));
checa('a ferramenta avisa que a busca é léxica',
  /lexical|termos/i.test(resultadoDaFerramenta || ''), String(resultadoDaFerramenta).slice(0, 200));

const naTela = await p.evaluate(() =>
  [...document.querySelectorAll('.msg')].map(m => m.innerText).join(' | ').replace(/\s+/g, ' '));
checa('a resposta na tela traz o fato que só existe no documento',
  /8813-KX/.test(naTela), naTela.slice(-260));

console.log('— apagar tira da busca');
await abreConfig(p, 'dados');
p.on('dialog', d => d.accept());
await p.evaluate(() => document.querySelector('.doc-del')?.click());
await p.waitForTimeout(1800);
checa('sumiu da lista', await p.evaluate(() => document.querySelectorAll('.doc-item').length === 0));
const busca = await fetch('http://127.0.0.1:8193/api/memory/search?q=codigo+do+portao').then(r => r.json());
checa('e sumiu do índice do backend',
  !JSON.stringify(busca.results || []).includes('8813-KX'), busca.results);

console.log('— PDF entra sem converter na mão');
/* PDF de verdade, com camada de texto, montado em tests/fixtures. Se o pdf.js
   não carregar ou o worker não subir, isto falha — que é o ponto: o caminho
   inteiro (script + worker + extração) precisa funcionar no navegador. */
const PDF = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'contrato.pdf');
await p.setInputFiles('#docs-file', PDF);
await p.waitForTimeout(4000);
const msgPdf = await p.evaluate(() => document.getElementById('docs-msg')?.textContent || '');
checa('indexou o PDF', /pedaço/i.test(msgPdf), msgPdf);
const doPdf = await fetch('http://127.0.0.1:8193/api/memory/search?q=codigo+do+portao')
  .then(r => r.json());
checa('e o texto do PDF ficou buscável',
  JSON.stringify(doPdf.results || []).includes('8813-KX'),
  (doPdf.results || []).map(r => r.text.slice(0, 60)));
checa('com o nome do arquivo como origem',
  (doPdf.results || []).some(r => /contrato\.pdf/.test(r.source || '')),
  (doPdf.results || []).map(r => r.source));

checa('sem erro de página', erros.length === 0, erros.slice(0, 3));

const saida = fim();
await b.close();
uvicorn.kill();
await estatico.fecha();
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(saida);
