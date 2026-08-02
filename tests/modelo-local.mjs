/* Modelo local no painel.
 *
 * O QUE ESTE TESTE PROTEGE
 *
 * A assimetria dos erros. Mandar pra nuvem sem precisar custa meio centavo;
 * mandar pra um 3B uma pergunta difícil custa uma resposta ruim e quase sempre
 * uma segunda tentativa — que sai mais caro que a economia. Então em toda
 * dúvida a chamada tem que subir, e é isso que os casos abaixo travam.
 *
 * Trava também as três formas de o local causar dano em vez de economia:
 *   - ficar com pergunta que precisa de ferramenta (é onde 3B mais erra)
 *   - responder e o painel dizer que foi a nuvem (trocar de modelo em silêncio)
 *   - falhar e derrubar a resposta em vez de deixar a nuvem assumir
 *
 * E a ligação com o produto: o módulo pode estar perfeito e nunca ser chamado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  servePainel, abreNavegador, novoContexto, placar, exigePortaLivre,
} from './_ajuda.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const { checa, fim } = placar();

/* --- Ligação com o produto (leitura de fonte, sem navegador) --- */
console.log('— o orFetch de fato consulta o local');
const core = fs.readFileSync(path.join(AQUI, '..', 'src', 'js', '04-chat-api-core.js'), 'utf-8');
checa('orFetch chama talvezLocal', /talvezLocal\(payload\)/.test(core));
checa('e cai na nuvem quando devolve nulo', /orFetchNuvem\(payload, opts\)/.test(core));
/* A telemetria continua no caminho da nuvem: o teste de telemetria confere o
   marcaLatencia, e mover o local pra frente dele não pode ter tirado isso. */
checa('a latência da nuvem continua medida', /marcaLatencia\(/.test(core));

const manifesto = JSON.parse(
  fs.readFileSync(path.join(AQUI, '..', 'src', 'js', 'manifest.json'), 'utf-8'));
checa('o módulo está no manifesto', manifesto.includes('43-modelo-local.js'));
checa('e depois do core que o usa',
  manifesto.indexOf('43-modelo-local.js') > manifesto.indexOf('04-chat-api-core.js'));

await exigePortaLivre(8231);
const estatico = await servePainel(8231);
const b = await abreNavegador();
const ctx = await novoContexto(b);
const erros = [];

/* PÁGINA NOVA POR CENÁRIO, e a 11434 bloqueada por padrão.
 *
 * As duas coisas por causa do mesmo susto: a primeira versão deste teste passou
 * a falhar porque o Ollama REAL desta máquina atendeu. O painel servido de
 * `http://localhost:8231` tem origem que o Ollama aceita, então o caminho
 * direto funcionou e devolveu texto de modelo de verdade onde o teste esperava
 * a ponte falsa.
 *
 * Isso foi uma boa notícia sobre o produto e uma péssima sobre o teste: a
 * suíte passaria ou não conforme o Victor tivesse o Ollama aberto. Bloquear na
 * camada de rede torna "não há modelo local" um fato do teste, não uma torcida.
 *
 * A página nova existe pelo cache de 30s do `modeloLocalEstado`: sem recarregar,
 * o estado detectado num cenário vazava pro seguinte. */
async function novaPagina({ deixaOllama = false } = {}) {
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message));
  if (!deixaOllama) await p.route('**://*:11434/**', r => r.abort());
  await p.goto(estatico.url + '/src/js/_harness-modelo-local.html');
  await p.waitForTimeout(300);
  return p;
}

const p = await novaPagina();

/* --- Pontuação: quem é simples o bastante pro local --- */
console.log('— pergunta simples fica no local');
const simples = await p.evaluate(() =>
  ['oi', 'bom dia', 'obrigado', 'ok', 'que horas são?'].map(t => [t, pontuaLocal(t)]));
for (const [t, n] of simples) checa(`"${t}" pontua baixo`, n <= 3, n);

console.log('— pergunta difícil sobe pra nuvem');
const dificeis = await p.evaluate(() => [
  'Compare as duas abordagens e justifique qual escala melhor, passo a passo',
  'analise este traceback e explique o erro',
  '```python\nclass A:\n  def f(self): pass\n```\nrefatore isso',
].map(t => [t.slice(0, 30), pontuaLocal(t)]));
for (const [t, n] of dificeis) checa(`"${t}…" pontua alto`, n > 3, n);

console.log('— a alternância c/qu do português');
/* "explicar" tem C, "explique" tem QU. Uma raiz `explic\w*` casaria com
   "explicação" e NÃO com "explique" — a forma imperativa, que é a mais provável
   numa pergunta ao assistente. Mesmo caso travado no lado Python. */
const conjugacoes = await p.evaluate(() =>
  ['explique', 'explicação', 'justifique', 'justificar', 'verifique', 'verificar']
    .map(v => [v, pontuaLocal(`me ${v} isso`)]));
for (const [v, n] of conjugacoes) checa(`"${v}" conta como raciocínio`, n > 0, n);

console.log('— saudação longa continua saudação');
const g = await p.evaluate(() => pontuaLocal('bom dia, tudo bem com você hoje?'));
checa('saudação não vira pergunta difícil', g === 0, g);

/* --- Roteamento: quando talvezLocal DEVOLVE null --- */
console.log('— em toda dúvida, sobe (a assimetria dos erros)');
const nulos = await p.evaluate(async () => {
  const r = {};
  /* Sem Ollama nenhum: o caminho direto falha rápido e devolve null. */
  r.semOllama = await talvezLocal({ messages: [{ role: 'user', content: 'oi' }] });
  /* Com ferramentas, nem tenta: escolher ferramenta errada gasta uma rodada
     inteira e o desconto do local evapora. */
  r.comFerramentas = await talvezLocal({
    messages: [{ role: 'user', content: 'oi' }], tools: [{ type: 'function' }] });
  /* Pergunta difícil nunca desce. */
  r.dificil = await talvezLocal({
    messages: [{ role: 'user', content: 'compare e justifique, passo a passo, analisando o traceback' }] });
  /* Desligado à mão manda tudo pra nuvem. */
  localStorage.setItem('vtz_local_desligado', '1');
  r.desligado = await talvezLocal({ messages: [{ role: 'user', content: 'oi' }] });
  localStorage.removeItem('vtz_local_desligado');
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null]));
});
checa('sem Ollama devolve null', nulos.semOllama);
checa('com ferramentas devolve null', nulos.comFerramentas);
checa('pergunta difícil devolve null', nulos.dificil);
checa('desligado devolve null', nulos.desligado);

/* --- O local respondendo, pela ponte do Electron --- */
console.log('— com a ponte do app, o local responde');
const pPonte = await novaPagina();
const resposta = await pPonte.evaluate(async () => {
  window.jarvisDesktop = {
    local: {
      estado: async () => ({ ok: true, modelo: 'qwen2.5:3b', cabeNaGpu: true }),
      chat: async (pedido) => ({
        ok: true, modelo: 'qwen2.5:3b',
        dados: { choices: [{ message: { role: 'assistant', content: 'Olá!' },
                             finish_reason: 'stop' }],
                 usage: { prompt_tokens: 8, completion_tokens: 3 },
                 _pedido: pedido },
      }),
    },
  };
  window.__registradas = [];
  const res = await talvezLocal({ messages: [{ role: 'user', content: 'oi' }] });
  if (!res) return { veio: false };
  const dados = await res.json();
  return {
    veio: true,
    ok: res.ok,
    conteudo: dados.choices?.[0]?.message?.content,
    provider: dados._provider,
    model: dados.model,
    modeloPedido: dados._pedido?.model,
    registradas: window.__registradas,
  };
});
checa('o local ficou com a pergunta', resposta.veio, resposta);
checa('devolve um Response de verdade (res.ok)', resposta.ok === true, resposta);
checa('com o conteúdo', resposta.conteudo === 'Olá!', resposta);
/* Trocar de modelo sem avisar é enganoso — o local erra mais, e quem lê a
   resposta precisa poder saber de onde ela veio. */
checa('marca que veio do local', resposta.provider === 'ollama', resposta);
checa('e o nome diz local:', /^local:/.test(resposta.model || ''), resposta);
checa('mandou o modelo escolhido', resposta.modeloPedido === 'qwen2.5:3b', resposta);

console.log('— gasto zero é ZERO, não "sem dado"');
checa('registrou a chamada', resposta.registradas?.length === 1, resposta.registradas);
checa('com custo 0', resposta.registradas?.[0]?.custo_usd === 0, resposta.registradas);
checa('e origem própria', resposta.registradas?.[0]?.origem === 'chat-local', resposta.registradas);

console.log('— streaming: o formato que o chat principal sabe ler');
const sse = await pPonte.evaluate(async () => {
  const res = await talvezLocal({ messages: [{ role: 'user', content: 'oi' }], stream: true });
  if (!res) return null;
  const texto = await res.text();
  /* O parser do 25-routellm lê linha a linha, exige `data:` e para no [DONE]. */
  const linhas = texto.split('\n').filter(l => l.startsWith('data:'));
  const primeiro = JSON.parse(linhas[0].slice(5));
  return {
    temDone: texto.includes('data: [DONE]'),
    conteudo: primeiro.choices?.[0]?.delta?.content,
    tipo: res.headers.get('content-type'),
  };
});
checa('emite SSE', /event-stream/.test(sse?.tipo || ''), sse);
checa('com o conteúdo no delta', sse?.conteudo === 'Olá!', sse);
checa('e fecha com [DONE]', sse?.temDone === true, sse);

console.log('— local que FALHA não derruba: a nuvem assume');
const pFalha = await novaPagina();
const falhou = await pFalha.evaluate(async () => {
  window.jarvisDesktop = {
    local: {
      estado: async () => ({ ok: true, modelo: 'qwen2.5:3b' }),
      chat: async () => { throw new Error('modelo morreu no meio'); },
    },
  };
  /* Devolve o BOOLEANO, não o objeto: um Response vira `{}` ao atravessar o
     evaluate, e `{}` é indistinguível de "vazio" do lado de cá. */
  const r = await talvezLocal({ messages: [{ role: 'user', content: 'oi' }] });
  return r === null;
});
checa('devolve null em vez de estourar', falhou === true, falhou);

checa('nenhum erro de página', erros.length === 0, erros);

await b.close();
await estatico.fecha();
fim();
