/* Telemetria de custo do painel.
 *
 * Existe porque o painel fala com o OpenRouter DIRETO — o backend só vê
 * agentes, orquestração e RAG. Medir só um dos lados produz um número parcial
 * se apresentando como total, o que é pior que não medir: decisão de orçamento
 * seria tomada em cima dele.
 *
 * O que fica travado:
 *   - a chamada vira uma linha COM CARIMBO DE TEMPO (o total acumulado que já
 *     existia não responde "quanto gastei esta semana")
 *   - sem backend, o dado NÃO se perde
 *   - só sai da fila o que o backend CONFIRMOU gravar
 *   - falha de telemetria NÃO derruba nada
 *   - o trackUsage está de fato ligado ao módulo (conferência de fonte)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  servePainel, abreNavegador, novoContexto, placar, exigePortaLivre,
} from './_ajuda.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const { checa, fim } = placar();

/* Ligação com o produto: a bancada exercita o MÓDULO, e esta conferência
   garante que ele está de fato conectado ao caminho real. Sem ela, o módulo
   poderia funcionar perfeitamente e nunca ser chamado por ninguém. */
console.log('— o trackUsage chama a telemetria');
const core = fs.readFileSync(path.join(AQUI, '..', 'src', 'js', '04-chat-api-core.js'), 'utf-8');
checa('trackUsage registra a chamada', /registraChamadaLocal\(/.test(core));
checa('orFetch marca a latência', /marcaLatencia\(/.test(core));
const init = fs.readFileSync(path.join(AQUI, '..', 'src', 'js', '10-prompt-presets.js'), 'utf-8');
checa('o envio periódico é ligado no init', /ligaEnvioDeTelemetria\(\)/.test(init));

await exigePortaLivre(8223);
const estatico = await servePainel(8223);
const b = await abreNavegador();
const ctx = await novoContexto(b);
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));
await p.goto(estatico.url + '/src/js/_harness-telemetria.html');
await p.waitForTimeout(600);

console.log('— a chamada vira linha com carimbo de tempo');
const r = await p.evaluate(() => {
  localStorage.removeItem('vtz_llm_fila');
  registraChamadaLocal({ model: 'anthropic/claude-sonnet', tokens_in: 100,
                         tokens_out: 50, custo_usd: 0.0012, origem: 'chat' });
  return JSON.parse(localStorage.getItem('vtz_llm_fila') || '[]');
});
checa('gravou uma linha', r.length === 1, r);
checa('com modelo', r[0]?.model === 'anthropic/claude-sonnet', r[0]);
checa('com tokens', r[0]?.tokens_in === 100 && r[0]?.tokens_out === 50, r[0]);
checa('com carimbo de tempo', typeof r[0]?.ts === 'number' && r[0].ts > 1e9, r[0]);
checa('com origem', r[0]?.origem === 'chat', r[0]);

console.log('— resumo por janela');
const res = await p.evaluate(() => {
  registraChamadaLocal({ model: 'modelo/barato', tokens_in: 10, tokens_out: 5,
                         custo_usd: 0.00001, origem: 'agente' });
  return resumoCustoLocal(7);
});
checa('conta as duas', res.na_fila === 2, res);
checa('soma os tokens', res.tokens_in === 110 && res.tokens_out === 55, res);
checa('agrupa por modelo', res.por_modelo.length === 2, res.por_modelo);
checa('declara que o custo é estimativa', res.custo_e_estimativa === true);

console.log('— falha também é dado');
const comFalha = await p.evaluate(() => {
  registraFalhaLocal({ model: 'x/y', origem: 'chat', erro: 'timeout' });
  const f = JSON.parse(localStorage.getItem('vtz_llm_fila') || '[]');
  return { ultima: f[f.length - 1], falhas: resumoCustoLocal(7).falhas };
});
checa('a falha entra na fila', comFalha.ultima?.ok === false, comFalha.ultima);
checa('e conta no resumo', comFalha.falhas === 1, comFalha);

console.log('— sem backend, o dado não se perde');
const sem = await p.evaluate(async () => {
  const antes = JSON.parse(localStorage.getItem('vtz_llm_fila')).length;
  const r = await enviaTelemetriaPendente();
  return { r, antes, depois: JSON.parse(localStorage.getItem('vtz_llm_fila')).length };
});
checa('não envia sem backend', sem.r.enviadas === 0, sem.r);
checa('e mantém a fila intacta', sem.depois === sem.antes, sem);

console.log('— só sai da fila o que o backend confirmou');
const recusado = await p.evaluate(async () => {
  window.backendUrl = () => 'http://127.0.0.1:9';   // porta morta
  const antes = JSON.parse(localStorage.getItem('vtz_llm_fila')).length;
  const r = await enviaTelemetriaPendente();
  return { r, antes, depois: JSON.parse(localStorage.getItem('vtz_llm_fila')).length };
});
/* Perder métrica numa falha de rede transformaria o relatório de gasto em
   ficção otimista: o que sumiu era justamente o que não foi contado. */
checa('backend fora do ar não consome a fila',
  recusado.depois === recusado.antes, recusado);

const aceito = await p.evaluate(async () => {
  window.backendUrl = () => 'FALSO';
  const original = window.fetch;
  window.fetch = async () => ({ ok: true, json: async () => ({ ok: true, gravadas: 99 }) });
  const antes = JSON.parse(localStorage.getItem('vtz_llm_fila')).length;
  const r = await enviaTelemetriaPendente();
  const depois = JSON.parse(localStorage.getItem('vtz_llm_fila')).length;
  window.fetch = original;
  return { r, antes, depois };
});
checa('backend confirmando esvazia a fila', aceito.depois === 0 && aceito.r.enviadas > 0, aceito);

console.log('— falha de telemetria não derruba nada');
const resiliente = await p.evaluate(() => {
  /* Cota do localStorage estourada é o caso real: perder métrica é aceitável,
     quebrar a resposta do chat não é. */
  const orig = localStorage.setItem.bind(localStorage);
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  let estourou = false;
  try { registraChamadaLocal({ model: 'x/y', custo_usd: 1 }); }
  catch (e) { estourou = true; }
  localStorage.setItem = orig;
  return estourou;
});
checa('gravar não propaga a falha', resiliente === false);

checa('sem erro de página', erros.length === 0, erros.slice(0, 3));

const saida = fim();
await b.close();
await estatico.fecha();
process.exit(saida);
