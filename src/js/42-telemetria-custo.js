/* Telemetria de custo do painel — para onde vão os R$ 50/mês.
   ==========================================================================

   POR QUE ESTE ARQUIVO EXISTE

   O backend já mede as chamadas que passam por ele (agentes, orquestração,
   RAG). Mas o painel fala com o OpenRouter DIRETO — `OR_BASE` em
   00-core-state.js — e é por aí que passa o chat do dia a dia, provavelmente a
   maior fatia do gasto.

   Medir só um dos dois lados produziria um número parcial se apresentando como
   total. Isso é pior que não medir: decisão de orçamento seria tomada em cima
   dele.

   O QUE JÁ EXISTIA, E POR QUE NÃO BASTAVA

   `trackUsage()` (04-chat-api-core.js) já soma custo em `state.totalCost` e
   `costByModel`, no localStorage. É bom e continua valendo — este arquivo NÃO
   substitui aquilo.

   O que faltava era a dimensão TEMPO. Um total acumulado não responde "quanto
   gastei esta semana", "qual conversa saiu mais cara", "o modelo novo baixou o
   custo?". Agregar cedo joga fora a pergunta que ainda não foi feita, então
   aqui cada chamada vira uma linha com carimbo de tempo.

   COMO SOBREVIVE SEM BACKEND

   O painel roda em três situações: com backend pareado, sem backend (site
   avulso), e offline. A fila fica no localStorage e só é esvaziada quando o
   envio confirma. Sem backend, o dado não se perde — fica local e o resumo
   local continua respondendo. */

const TELEMETRIA_FILA = 'vtz_llm_fila';
const TELEMETRIA_MAX = 400;      // teto da fila: o localStorage tem ~5 MB no total
const TELEMETRIA_LOTE = 50;      // quantas por requisição

/* Latência da última chamada, posta pelo `orFetch`.
   É aproximação assumida: sob duas chamadas simultâneas, a segunda pode herdar
   o tempo da primeira. Vale porque o uso é sequencial (uma pergunta por vez) e
   porque o alternativo — carregar um id de requisição por toda a cadeia até o
   trackUsage — mudaria oito pontos de chamada para ganhar precisão num número
   que serve pra comparar ordem de grandeza, não pra cobrar ninguém. */
let _ultimaLatenciaMs = null;
function marcaLatencia(ms){ _ultimaLatenciaMs = ms; }

function filaTelemetria(){
  try{ return JSON.parse(localStorage.getItem(TELEMETRIA_FILA) || '[]'); }
  catch(e){ return []; }
}

function gravaFila(lista){
  try{ localStorage.setItem(TELEMETRIA_FILA, JSON.stringify(lista.slice(-TELEMETRIA_MAX))); }
  catch(e){ /* cota estourada: perder métrica é melhor que quebrar o chat */ }
}

/* Registra uma chamada. Chamado pelo trackUsage, que já tem modelo, tokens,
   custo e conversa — não há motivo pra uma segunda contabilidade. */
function registraChamadaLocal({ model, tokens_in, tokens_out, custo_usd, origem }){
  const lista = filaTelemetria();
  lista.push({
    ts: Date.now() / 1000,
    provider: 'openrouter',
    model: model || '?',
    origem: origem || 'painel',
    tokens_in: Number.isFinite(tokens_in) ? tokens_in : null,
    tokens_out: Number.isFinite(tokens_out) ? tokens_out : null,
    custo_usd: Number.isFinite(custo_usd) ? custo_usd : null,
    ms: Number.isFinite(_ultimaLatenciaMs) ? Math.round(_ultimaLatenciaMs) : null,
    ok: true,
  });
  _ultimaLatenciaMs = null;   // consome: não vale pra próxima
  gravaFila(lista);
}

/* Falha também é dado: chamada que estourou consumiu tempo e às vezes tokens,
   e uma sequência de falhas é justamente o que se quer enxergar. */
function registraFalhaLocal({ model, origem, erro }){
  const lista = filaTelemetria();
  lista.push({
    ts: Date.now() / 1000, provider: 'openrouter', model: model || '?',
    origem: origem || 'painel',
    ms: Number.isFinite(_ultimaLatenciaMs) ? Math.round(_ultimaLatenciaMs) : null,
    ok: false, erro: String(erro || '').slice(0, 200),
  });
  _ultimaLatenciaMs = null;
  gravaFila(lista);
}

/* Descarrega pro backend. Só remove da fila o que o backend CONFIRMOU ter
   gravado — perder métrica em falha de rede transformaria um relatório de gasto
   em ficção otimista. */
let _enviando = false;
async function enviaTelemetriaPendente(){
  if (_enviando) return { enviadas: 0, motivo: 'já em andamento' };
  const lista = filaTelemetria();
  if (!lista.length) return { enviadas: 0 };
  if (!backendUrl()) return { enviadas: 0, motivo: 'sem backend: fica local' };

  _enviando = true;
  try{
    const lote = lista.slice(0, TELEMETRIA_LOTE);
    const r = await fetch(backendUrl() + '/api/analytics/custo', {
      method: 'POST',
      headers: backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ chamadas: lote }),
    });
    if (!r.ok) return { enviadas: 0, motivo: 'backend respondeu ' + r.status };
    const d = await r.json().catch(() => ({}));
    if (!d.ok) return { enviadas: 0, motivo: d.erro || 'backend recusou' };
    gravaFila(filaTelemetria().slice(lote.length));
    return { enviadas: lote.length };
  }catch(e){
    return { enviadas: 0, motivo: e.message };
  }finally{
    _enviando = false;
  }
}

/* Resumo a partir da fila local. Existe pra o painel mostrar gasto mesmo sem
   backend — e pra mostrar o que ainda não foi enviado. */
function resumoCustoLocal(dias = 7){
  const desde = Date.now() / 1000 - dias * 86400;
  const linhas = filaTelemetria().filter(c => c.ts >= desde);
  const porModelo = {};
  let usd = 0, tIn = 0, tOut = 0, falhas = 0;
  for (const c of linhas){
    usd += c.custo_usd || 0;
    tIn += c.tokens_in || 0;
    tOut += c.tokens_out || 0;
    if (!c.ok) falhas++;
    const m = porModelo[c.model] || (porModelo[c.model] = { chamadas: 0, custo_usd: 0 });
    m.chamadas++; m.custo_usd += c.custo_usd || 0;
  }
  return {
    dias, na_fila: linhas.length, custo_usd: usd,
    tokens_in: tIn, tokens_out: tOut, falhas,
    custo_e_estimativa: true,   // o preço vem do catálogo e muda
    por_modelo: Object.entries(porModelo)
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.custo_usd - a.custo_usd),
  };
}

/* Descarga periódica. 90s porque medir não é urgente: o dado já está seguro no
   localStorage, e o envio existe só pra juntar as duas metades no backend. */
let _relogioTelemetria = null;
function ligaEnvioDeTelemetria(){
  if (_relogioTelemetria) return;
  enviaTelemetriaPendente().catch(() => {});
  _relogioTelemetria = setInterval(() => { enviaTelemetriaPendente().catch(() => {}); }, 90000);
}
