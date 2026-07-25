/* Chamada única à API de chat — todas as features passam por aqui */
function orFetch(payload, opts = {}){
  // Roteamento por throughput: mesma qualidade (modelo idêntico), mas o OpenRouter
  // escolhe o provedor mais rápido no momento. Não sobrescreve preferências já postas.
  const body = payload.provider ? payload : { ...payload, provider: { sort: 'throughput' } };
  return fetch(OR_BASE + '/chat/completions', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer ' + state.apiKey,
      'HTTP-Referer': location.origin || 'https://vtz-llm.local',
      'X-Title': SITE_TITLE,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
}
/* Contabilidade de custo unificada */
function trackUsage(usage, modelId, conv){
  if (!usage) return;
  const pricing = getModelPricing(modelId);
  const cost = (usage.prompt_tokens||0)*pricing.prompt + (usage.completion_tokens||0)*pricing.completion;
  state.totalCost += cost;
  localStorage.setItem('vtz_or_cost', String(state.totalCost));
  state.costByModel[modelId] = (state.costByModel[modelId] || 0) + cost;
  localStorage.setItem('vtz_cost_by_model', JSON.stringify(state.costByModel));
  if (conv){ conv.cost = (conv.cost || 0) + cost; }
  updateCostBadge();
}
/* Conta do OpenRouter sem crédito. Repetir o mesmo pedido não resolve — só um
   modelo grátis responde. Perde qualidade, mas o app continua de pé em vez de
   virar uma tela de erro.

   Avisa em toast de propósito: cair pra um modelo mais fraco em silêncio faria
   você culpar o app por uma resposta ruim sem saber que o crédito acabou. */
async function quedaPraGratis(payload, opts, respostaPaga){
  const atual = payload.model || '';
  const lista = (state.models && state.models.length) ? state.models : FALLBACK_MODELS;
  const gratis = lista.find(m => isFreeModel(m) && !isImageModel(m) && m.id !== atual);
  if (!gratis) return respostaPaga;   // sem grátis à mão: quem chamou mostra o 402
  toast(`Sem crédito no OpenRouter — respondendo com ${gratis.name || gratis.id}.`, 'warn');
  try{
    const res = await orFetch({ ...payload, model: gratis.id }, opts);
    return res.ok ? res : respostaPaga;   // grátis também falhou: mostra o erro original
  }catch(e){
    if (e.name === 'AbortError') throw e;
    return respostaPaga;
  }
}

/* Retry com backoff: 429/5xx/erro de rede tenta de novo sozinho (2 retries) */
async function orFetchRetry(payload, opts = {}){
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++){
    if (attempt > 0){
      await new Promise(r => setTimeout(r, 800 * attempt));
      if (opts.signal?.aborted) throw Object.assign(new Error('abortado'), {name:'AbortError'});
      toast(`Instabilidade na API — tentando de novo (${attempt+1}/3)…`, 'warn');
    }
    try{
      const res = await orFetch(payload, opts);
      /* 402 é sem crédito, não instabilidade: não entra no laço de retry. */
      if (res.status === 402) return await quedaPraGratis(payload, opts, res);
      if (res.ok || ![429,500,502,503,504,529].includes(res.status)) return res;
      lastErr = new Error('API ' + res.status);
    }catch(e){
      if (e.name === 'AbortError') throw e;
      lastErr = e;
    }
  }
  throw lastErr || new Error('Falha após 3 tentativas');
}
/* Som curto opcional ao concluir geração */
function playDing(){
  if (!state.soundOn) return;
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .18);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + .2);
  }catch(_){}
}
/* Hook comum pós-resposta: som + auto-título por IA */
function afterAssistantDone(conv){
  playDing();
  /* No app de PC, aviso do sistema quando a resposta chega e a janela está em
     outra coisa. O ding só serve se você estiver ouvindo; a notificação chega
     na barra de tarefas. Quem decide se notifica é o processo principal do
     Electron (ele sabe se a janela está em foco) — ver setupNotificacoes. */
  if (window.jarvisDesktop?.notify && (document.hidden || !document.hasFocus())){
    const ultima = conv.messages[conv.messages.length - 1];
    const previa = String(ultima?.content || '').replace(/\s+/g, ' ').slice(0, 180);
    window.jarvisDesktop.notify(conv.title || 'Resposta pronta', previa);
  }
  maybeAutoSpeak(conv); // Modo Voz: fala a resposta (e reinicia a escuta no mãos-livres)
  const realMsgs = conv.messages.filter(m => (m.role==='user'||m.role==='assistant') && !m._local);
  if (!conv.agentId && !conv._titled && realMsgs.length === 2){
    conv._titled = true;
    autoTitleConversation(conv);
  }
  // auto-memória: a cada ~6 mensagens do usuário, destila fatos duráveis em 2º plano
  if (state.autoMemory){
    const userCount = realMsgs.filter(m => m.role === 'user').length;
    if (userCount >= 3 && userCount !== conv._lastMemAt && userCount % 3 === 0){
      conv._lastMemAt = userCount;
      extractMemories(conv, { silent: true });
    }
  }
}
async function autoTitleConversation(conv){
  try{
    const freeModel = state.models.find(m => m.id.endsWith(':free') && !isImageModel(m));
    const model = freeModel?.id || state.routerConfig.fast;
    if (!model) return;
    const firstUser = contentToText(conv.messages.find(m => m.role==='user')?.content || '').slice(0, 500);
    const res = await orFetch({ model, messages:[
      { role:'system', content:'Gere um título curto de 3 a 6 palavras para esta conversa, em português, sem aspas e sem pontuação final. Responda só o título.' },
      { role:'user', content: firstUser }
    ]});
    if (!res.ok) return;
    const data = await res.json();
    const title = (data.choices?.[0]?.message?.content || '').trim().replace(/["'.]/g,'').slice(0, 60);
    if (title){ conv.title = title; persistConversations(); renderHistoryList(); }
  }catch(_){ /* título automático é best-effort */ }
}
/* ---------- Auto-memória em GRAFO (evolução da lista plana, estilo Claude/ChatGPT) ----------
   Destila a conversa em ENTIDADES + RELAÇÕES (não frases soltas) e funde no
   state.memoryGraph, que é resumido e injetado em TODA conversa. Usa um modelo
   barato/confiável (não o do chat) pra extrair JSON limpo — custo por rodada é
   fração de centavo. O grafo evita duplicar e contradizer fatos antigos. */
const MEMORY_MODEL = 'openai/gpt-4.1-mini';
const MEM_MAX_NODES = 120; // teto de segurança do grafo

