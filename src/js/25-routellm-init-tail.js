/* Só modelos gratuitos, com um "papel" inferido do id — usado pelo RouteLLM Free */
function freeCandidates(){
  const free = state.models.filter(m => isFreeModel(m) && !isImageModel(m));
  const role = (id) => {
    const s = id.toLowerCase();
    if (s.includes('r1') || s.includes('reason') || s.includes('think')) return 'raciocínio e matemática';
    if (s.includes('coder') || s.includes('code')) return 'código';
    if (s.includes('70b') || s.includes('72b') || s.includes('large') || s.includes('405b')) return 'tarefas complexas';
    if (s.includes('mini') || s.includes('small') || s.includes('8b') || s.includes('flash')) return 'conversas rápidas';
    return 'uso geral';
  };
  // no máximo 12 candidatos pra não estourar o prompt do classificador
  return free.slice(0, 12).map(m => ({ id: m.id, role: role(m.id) }));
}
function isFreeModel(m){
  if (!m) return false;
  if (typeof m.id === 'string' && m.id.endsWith(':free')) return true;
  const p = m.pricing;
  return p && parseFloat(p.prompt||0) === 0 && parseFloat(p.completion||0) === 0;
}
async function classifyWithLLM(userText, signal, freeOnly){
  const candidates = routerCandidates(freeOnly);
  if (!candidates.length) return null;
  // classificador: sempre um modelo grátis (custo zero); senão o tier fast configurado
  const freeModel = state.models.find(m => isFreeModel(m) && !isImageModel(m));
  const classifier = freeModel?.id || state.routerConfig.fast;
  if (!classifier) return null;
  const listText = candidates.map(c => `- ${c.id} (${c.role})`).join('\n');
  const res = await orFetch({ model: classifier, messages:[
      { role:'system', content:`Você é um roteador de modelos de IA. Analise a tarefa do usuário e escolha o MELHOR modelo da lista abaixo, equilibrando qualidade e custo (não escolha modelo caro pra tarefa trivial).\n${listText}\nResponda APENAS com JSON válido: {"model":"<id exato da lista>"}` },
      { role:'user', content: userText.slice(0, 2000) }
    ]}, { signal });
  if (!res.ok) throw new Error('classificador falhou');
  const data = await res.json();
  const raw = (data.choices[0].message.content || '').replace(/```json|```/g,'').trim();
  const parsed = JSON.parse(raw);
  const chosen = candidates.find(c => c.id === parsed.model);
  return chosen ? chosen.id : null;
}

/* ---------- Fusion: 2 modelos EM PARALELO + fusão por um 3º barato ----------
   Sem o delay do debate sequencial: as duas respostas são pedidas ao mesmo tempo
   (Promise.all), então o tempo total ≈ o do modelo mais lento, não a soma. Um
   modelo grátis funde as duas na melhor versão. */
function fusionPair(){
  // um forte + um rápido/barato distinto, ambos presentes no catálogo
  const strong = state.models.find(m => /claude-opus|gpt-5\.5|claude-sonnet-5|gemini-3/.test(m.id) && !isImageModel(m))
              || state.models.find(m => !isImageModel(m) && !isFreeModel(m));
  const fast = state.models.find(m => /deepseek|gemini-2\.5-flash|gpt-5-mini|llama-3\.3/.test(m.id) && !isImageModel(m) && m.id !== strong?.id)
            || state.models.find(m => !isImageModel(m) && m.id !== strong?.id);
  return [strong, fast].filter(Boolean).map(m => m.id);
}
async function runFusion(conv, ctrl, thinking){
  const models = fusionPair();
  if (models.length < 2){ throw new Error('Preciso de ao menos 2 modelos no catálogo pra fundir.'); }
  const systemPrompt = buildSystemPrompt(conv);
  let base = sanitizeForApi(conv.messages);
  if (state.ctxWindow > 0 && base.length > state.ctxWindow){
    base = base.slice(-state.ctxWindow);
    while (base.length && base[0].role !== 'user') base.shift();
  }
  const msgs = systemPrompt ? [{role:'system', content: systemPrompt}, ...base] : base;

  thinking.update('Consultando 2 modelos em paralelo…');
  // dispara as duas ao MESMO tempo
  const calls = models.map(model =>
    orFetch({ model, messages: msgs }, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => ({ model, text: d?.choices?.[0]?.message?.content || '', usage: d?.usage }))
      .catch(() => ({ model, text: '', usage: null }))
  );
  const results = await Promise.all(calls);
  results.forEach(r => trackUsage(r.usage, r.model));
  const valid = results.filter(r => r.text.trim());
  if (!valid.length) throw new Error('Nenhum dos modelos respondeu.');
  if (valid.length === 1) return { text: valid[0].text, models, fusedBy: null };

  // funde com um modelo grátis (ou o fast do par se não houver free)
  const freeModel = state.models.find(m => isFreeModel(m) && !isImageModel(m));
  const fuser = freeModel?.id || models[1];
  thinking.update('Fundindo as respostas na melhor versão…');
  const lastUser = contentToText([...conv.messages].reverse().find(m => m.role==='user')?.content || '');
  const fuseSystem = `Você recebe a mesma pergunta respondida por ${valid.length} modelos de IA diferentes. Produza UMA resposta final, a melhor possível: combine os acertos de cada uma, corrija erros, elimine redundância e contradições. Responda no idioma da pergunta, direto, sem citar "modelo A/B" nem explicar que houve fusão — entregue só a resposta final.`;
  const fuseUser = `PERGUNTA:\n${lastUser}\n\n` + valid.map((r,i) => `RESPOSTA ${i+1} (${r.model}):\n${r.text}`).join('\n\n---\n\n');
  const fr = await orFetch({ model: fuser, messages:[
    { role:'system', content: fuseSystem },
    { role:'user', content: fuseUser }
  ]}, { signal: ctrl.signal });
  if (!fr.ok) return { text: valid[0].text, models, fusedBy: null }; // fusão falhou: devolve a melhor bruta
  const fd = await fr.json();
  trackUsage(fd.usage, fuser);
  const fused = fd.choices?.[0]?.message?.content?.trim();
  return { text: fused || valid[0].text, models, fusedBy: fused ? fuser : null };
}

async function runChatLoop(depth=0, convArg, modelOverride){
  if (depth > 5) return;
  const conv = convArg || getCurrentConv();

  // registra a geração desta conversa (trava o composer DELA; as outras ficam livres)
  if (depth === 0){
    state.gens[conv.id] = new AbortController();
    updateComposerState();
  }
  const ctrl = state.gens[conv.id];

  // "Pensando..." aparece imediatamente — inclusive durante o roteamento.
  // Fica FORA do try pra ser removido no finally, aconteça o que acontecer.
  const thinking = createThinkingRow(conv);
  let watchdog = null;
  try{
    /* Watchdog da requisição INTEIRA: cobre o roteamento, a espera pelos headers
       (caso mais comum de travamento) e o corpo do stream. Antes ele só nascia
       depois dos headers — um servidor mudo travava o "Pensando…" pra sempre. */
    let lastByte = Date.now();
    let timedOut = false;
    watchdog = setInterval(() => {
      if (Date.now() - lastByte > STREAM_IDLE_MS){ timedOut = true; try{ ctrl.abort(); }catch(_){} }
    }, 1000);
    const timeoutMsg = () => `A API não respondeu em ${STREAM_IDLE_MS/1000}s. Rode "Testar conexão" em Config.`;

    const baseModel = modelOverride || conv.model || state.model;

    // ---- Fusion: caminho próprio (paralelo + fusão), não usa streaming ----
    if (baseModel === '__fusion__' && depth === 0){
      const out = await runFusion(conv, ctrl, thinking);
      clearInterval(watchdog); watchdog = null;
      const label = out.fusedBy
        ? `Fusion: ${out.models.map(id => state.models.find(m=>m.id===id)?.name || id).join(' + ')} → fundido`
        : `Fusion: ${out.models.map(id => state.models.find(m=>m.id===id)?.name || id).join(' + ')}`;
      appendRouterBadge(label, conv, thinking.el, true);
      const assistantMsg = { role:'assistant', content: out.text, _router: label };
      conv.messages.push(assistantMsg);
      conv.updatedAt = Date.now();
      if (conv.id === state.currentConvId){ appendMessageDOM('assistant', out.text, false, conv.messages.length - 1); updateCtxMeter(); }
      persistConversations();
      renderHistoryList();
      return;
    }

    let effectiveModel = baseModel;
    if (baseModel === '__router__' || baseModel === '__router_free__'){
      const freeOnly = baseModel === '__router_free__';
      const lastUser = [...conv.messages].reverse().find(m => m.role === 'user');
      const userText = contentToText(lastUser?.content || '');
      if (depth === 0){
        let chosen = null;
        try{ chosen = await classifyWithLLM(userText, ctrl.signal, freeOnly); }
        catch(e){
          if (e.name === 'AbortError'){ toast(timedOut ? timeoutMsg() : 'Geração interrompida', timedOut ? 'err' : 'warn'); return; }
          console.warn('Router LLM falhou, usando heurística:', e.message);
        }
        if (!chosen){
          if (freeOnly){
            const fc = freeCandidates();
            chosen = fc[0]?.id;
          } else {
            const {modelId} = resolveRouterModel(userText);
            chosen = modelId;
          }
        }
        if (!chosen) throw new Error(freeOnly ? 'Nenhum modelo grátis disponível no catálogo.' : 'Roteamento falhou.');
        conv._routedModel = chosen;
        const chosenName = state.models.find(m => m.id === chosen)?.name || chosen;
        appendRouterBadge((freeOnly ? 'RouteLLM Free' : 'RouteLLM') + ' ► ' + chosenName, conv, thinking.el, true);
      }
      effectiveModel = conv._routedModel || state.routerConfig.balanced;
    }

    const systemPrompt = buildSystemPrompt(conv);
    let baseMessages = sanitizeForApi(conv.messages);
    // Janela de contexto: corta o histórico reenviado (sem isso o custo cresce
    // quadraticamente com o tamanho da conversa). 0 = enviar tudo.
    if (state.ctxWindow > 0 && baseMessages.length > state.ctxWindow){
      baseMessages = baseMessages.slice(-state.ctxWindow);
      while (baseMessages.length && baseMessages[0].role !== 'user') baseMessages.shift();
    }
    const apiMessages = systemPrompt ? [{role:'system', content: systemPrompt}, ...baseMessages] : baseMessages;

    const useStream = state.streamOn && !state.toolsEnabled; // tool-use exige resposta completa
    const body = { model: effectiveModel, messages: apiMessages };
    if (state.toolsEnabled) body.tools = Object.values(TOOLS).map(t => t.def);
    // Busca web nativa do OpenRouter: funciona com qualquer modelo (incl. :free).
    // Custo do plugin (~US$0,02/req) é cobrado pelo provedor e NÃO aparece no
    // contador de tokens — declarado no toast ao ativar.
    if (state.webSearch) body.plugins = [{ id: 'web' }];
    if (useStream){ body.stream = true; body.stream_options = { include_usage: true }; }

    let res;
    try{
      res = await orFetchRetry(body, { signal: ctrl.signal });
    }catch(e){
      if (e.name === 'AbortError'){ toast(timedOut ? timeoutMsg() : 'Geração interrompida', timedOut ? 'err' : 'warn'); return; }
      throw e;
    }
    lastByte = Date.now(); // headers chegaram
    if (!res.ok){
      const errBody = (await res.text()).slice(0,300);
      throw new Error(`API ${res.status} — ${errBody || 'sem detalhe'}`);
    }

    /* ---- Streaming (chat normal) ---- */
    if (useStream){
      if (!res.body) throw new Error('Streaming indisponível — desative o streaming em Config.');
      let acc = '', usage = null, lastPaint = 0, aborted = false, annotations = [];
      try{
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        outer: while(true){
          const {done, value} = await reader.read();
          if (done) break;
          lastByte = Date.now();
          buf += dec.decode(value, {stream:true});
          let nl;
          while((nl = buf.indexOf('\n')) >= 0){
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line || line.startsWith(':')) continue;        // keep-alive do OpenRouter
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') break outer;              // não espera o socket fechar
            let obj;
            try{ obj = JSON.parse(payload); }
            catch(_){ continue; }                                // linha parcial
            if (obj.error) throw new Error(obj.error.message || 'erro do provedor');
            const dmsg = obj.choices?.[0]?.delta;
            const delta = dmsg?.content;
            // fontes da busca web chegam como annotations no delta
            if (dmsg?.annotations?.length){
              for (const an of dmsg.annotations){
                const u = an.url_citation || an;
                if (u?.url && !annotations.some(x => x.url === u.url)) annotations.push({ url:u.url, title:u.title || u.url });
              }
              if (!acc){
                const hosts = annotations.slice(0,4).map(a => { try{ return new URL(a.url).hostname.replace('www.',''); }catch(_){ return ''; } }).filter(Boolean);
                thinking.update('Pesquisando na web… ' + hosts.join(' · '));
              }
            }
            if (delta){
              acc += delta;
              const now = Date.now();
              if (now - lastPaint > 60){ thinking.update(acc); lastPaint = now; }
            }
            if (obj.usage) usage = obj.usage;
          }
        }
      }catch(e){
        if (e.name === 'AbortError') aborted = true;
        else throw e;
      }
      clearInterval(watchdog); watchdog = null; // corpo completo — para de vigiar
      trackUsage(usage, effectiveModel);
      if (!acc){
        if (timedOut) toast(timeoutMsg(), 'err');
        else if (aborted) toast('Geração interrompida.', 'warn');
        else toast('O modelo não retornou texto. Tente outro modelo ou desative o streaming em Config.', 'err');
        return;
      }
      if (aborted) toast('Geração interrompida — resposta parcial mantida', 'warn');

      const assistantMsg = { role:'assistant', content: acc };
      if (annotations.length) assistantMsg._sources = annotations;
      if ((baseModel === '__router__' || baseModel === '__router_free__') && conv._routedModel){
        const nm = state.models.find(m => m.id === conv._routedModel)?.name || conv._routedModel;
        assistantMsg._router = (baseModel === '__router_free__' ? 'RouteLLM Free ► ' : 'RouteLLM ► ') + nm;
      }
      assistantMsg.ts = Date.now();
      conv.messages.push(assistantMsg);
      conv.updatedAt = Date.now();
      if (conv.id === state.currentConvId){ appendMessageDOM('assistant', acc, false, conv.messages.length - 1); updateCtxMeter(); }
      persistConversations();
      renderHistoryList();
      // busca web + backend: anexa imagens sobre o tema (a pergunta do usuário)
      if (annotations.length && backendUrl()){
        const q = contentToText([...conv.messages].reverse().find(m => m.role === 'user')?.content || '');
        attachTopicImages(assistantMsg, q, conv);
      }
      afterAssistantDone(conv);
      return;
    }

    /* ---- Não-stream (tools ativas) ---- */
    let data;
    try{ data = await res.json(); }
    catch(e){
      if (e.name === 'AbortError'){ toast(timedOut ? timeoutMsg() : 'Geração interrompida', timedOut ? 'err' : 'warn'); return; }
      throw e;
    }
    clearInterval(watchdog); watchdog = null; // resposta completa — tools podem demorar sem serem abortadas
    if (data.error) throw new Error(data.error.message || 'erro do provedor');
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error('Resposta da API sem mensagem (formato inesperado).');
    trackUsage(data.usage, effectiveModel, conv);

    if (msg.tool_calls && msg.tool_calls.length){
      conv.messages.push(msg);
      for (const call of msg.tool_calls){
        const toolName = call.function.name;
        let args = {}; try{ args = JSON.parse(call.function.arguments || '{}'); }catch(e){}
        const tool = TOOLS[toolName];
        let result = 'Tool não encontrada: ' + toolName;
        if (tool){
          if (conv.id === state.currentConvId) appendMessageDOM(null, `tool: ${toolName}(${JSON.stringify(args)})`, true);
          result = await tool.exec(args);
          if (toolName === 'pc_action' && conv.id === state.currentConvId) appendMessageDOM(null, formatPcActionResult(result), true);
        }
        conv.messages.push({ role:'tool', tool_call_id: call.id, content: String(result) });
      }
      persistConversations();
      return runChatLoop(depth+1, conv, modelOverride);
    }

    const assistantMsg = { role:'assistant', content: msg.content || '' };
    if ((baseModel === '__router__' || baseModel === '__router_free__') && conv._routedModel){
      const nm = state.models.find(m => m.id === conv._routedModel)?.name || conv._routedModel;
      assistantMsg._router = (baseModel === '__router_free__' ? 'RouteLLM Free ► ' : 'RouteLLM ► ') + nm;
    }
    assistantMsg.ts = Date.now();
    conv.messages.push(assistantMsg);
    conv.updatedAt = Date.now();
    if (conv.id === state.currentConvId){ appendMessageDOM('assistant', msg.content || '', false, conv.messages.length - 1); updateCtxMeter(); }
    persistConversations();
    renderHistoryList();
    afterAssistantDone(conv);
  } finally {
    if (watchdog) clearInterval(watchdog);
    thinking.remove(); // "Pensando…" nunca fica pendurado, mesmo com exceção
    if (depth === 0){
      delete state.gens[conv.id];
      updateComposerState();
    }
  }
}

function updateCostBadge(){
  const val = '$' + state.totalCost.toFixed(4);
  document.getElementById('cost-badge').textContent = val;
  document.getElementById('cost-detail').textContent = 'Total gasto (estimado): ' + val;
  updateSessionPanel();
}

/* ---------- Painel de sessão + Analytics (100% dados reais) ---------- */
function updateSessionPanel(){
  const conv = getCurrentConv();
  const m = state.models.find(x => x.id === state.model);
  const SPECIAL_NAMES = { '__router__':'RouteLLM', '__router_free__':'RouteLLM Free', '__fusion__':'Fusion' };
  const modelLabel = SPECIAL_NAMES[state.model] || m?.name || state.model || '—';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sp-model', modelLabel.length > 18 ? modelLabel.slice(0,17) + '…' : modelLabel);
  set('sp-cost', '$' + state.totalCost.toFixed(4));
  set('sp-msgs', conv ? conv.messages.filter(x => x.role==='user'||x.role==='assistant').length : 0);
  set('sp-convs', state.conversations.length);
  set('sp-agents', state.agents.length);
  set('sp-skills', state.skills.filter(s => s.active).length + '/' + state.skills.length);
  set('sp-tools', Object.keys(TOOLS).length);
  // versão mini (painel recolhido)
  set('sp-mini-cost', '$' + (state.totalCost < 1 ? state.totalCost.toFixed(2) : state.totalCost.toFixed(1)));
  set('sp-mini-msgs', conv ? conv.messages.filter(x => x.role==='user'||x.role==='assistant').length : 0);
  set('sp-mini-convs', state.conversations.length);
}
function renderAnalytics(){
  const grid = document.getElementById('metrics-grid');
  if (!grid) return;
  const totalMsgs = state.conversations.reduce((n,c) => n + c.messages.filter(x => x.role==='user'||x.role==='assistant').length, 0);
  const metrics = [
    ['Conversas', state.conversations.length, ''],
    ['Mensagens', totalMsgs, ''],
    ['Custo total', '$' + state.totalCost.toFixed(4), 'amber'],
    ['Custo em R$', 'R$' + (state.totalCost * state.usdToBrl).toFixed(2).replace('.',','), 'amber'],
    ['Agentes', state.agents.length, 'violet'],
    ['Skills', state.skills.length, 'violet'],
  ];
  grid.innerHTML = '';
  metrics.forEach(([label, val, cls]) => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `<div class="metric-label">${label}</div><div class="metric-val ${cls}">${val}</div>`;
    grid.appendChild(card);
  });
}

/* ---------- Mic (best-effort ditado) ---------- */
function setupMic(){
  const btn = document.getElementById('mic-btn');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){ btn.style.opacity = '.3'; btn.title = 'Ditado não suportado neste navegador'; return; }
  const rec = new SR();
  rec.lang = 'pt-BR';
  rec.continuous = false;
  rec.interimResults = false;
  let listening = false;
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const input = document.getElementById('chat-input');
    input.value = (input.value ? input.value + ' ' : '') + text;
  };
  rec.onend = () => { listening = false; btn.classList.remove('recording'); };
  btn.onclick = () => {
    if (listening){ rec.stop(); listening = false; btn.classList.remove('recording'); }
    else { rec.start(); listening = true; btn.classList.add('recording'); }
  };
}

/* ---------- Imagem ---------- */
async function generateImage(){
  const prompt = document.getElementById('image-prompt').value.trim();
  const model = document.getElementById('image-model-select').value;
  if (!prompt || !state.apiKey) return;
  const btn = document.getElementById('gen-image-btn');
  btn.disabled = true; btn.textContent = 'Gerando...';
  try{
    const res = await orFetch({ model, messages:[{role:'user', content: prompt}], modalities:['image','text'] });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const msg = data.choices[0].message;
    const images = msg.images || [];
    const grid = document.getElementById('img-grid');
    images.forEach(img => {
      const url = img.image_url?.url || img.url || img;
      const card = document.createElement('div');
      card.className = 'img-card';
      card.innerHTML = `<img src="${url}"><a href="${url}" download="vtz-imagem.png">Baixar</a>`;
      grid.prepend(card);
    });
    if (!images.length) appendImageNote('Modelo não retornou imagem — verifique output_modalities.');
  }catch(e){ appendImageNote('Erro: ' + e.message); }
  finally{ btn.disabled = false; btn.textContent = 'Gerar'; }
}
function appendImageNote(text){
  const grid = document.getElementById('img-grid');
  const note = document.createElement('div');
  note.className = 'img-card';
  note.style.padding = '14px'; note.style.fontSize = '12px'; note.style.color = 'var(--text-dim)';
  note.textContent = text;
  grid.prepend(note);
}

/* ---------- Vídeo (Replicate, via Backend VTz OS) ---------- */
const FALLBACK_VIDEO_MODELS = [
  { id:'kling-v3',     name:'Kling AI v3.0 (recomendado)',  type:'text-to-video',  max_duration:10 },
  { id:'kling-v2',     name:'Kling AI v2.0',                type:'text-to-video',  max_duration:10 },
  { id:'kling-v1',     name:'Kling AI v1.0',                type:'text-to-video',  max_duration:10 },
  { id:'runway-gen3',  name:'Runway Gen-3.5 Motion',         type:'text-to-video',  max_duration:25 },
  { id:'luma-dream',   name:'Luma Dream Machine',            type:'text-to-video',  max_duration:5  },
  { id:'veo-2',        name:'Google Veo 2.0',                type:'text-to-video',  max_duration:6  },
  { id:'seedance',     name:'Seedance (Imagem → Vídeo)',     type:'image-to-video', max_duration:5  },
  { id:'hailuo',       name:'Hailuo Video Generation',       type:'text-to-video',  max_duration:10 },
];
async function loadVideoModels(){
  const sel = document.getElementById('video-model-select');
  let models = FALLBACK_VIDEO_MODELS;
  if (backendUrl()){
    try{
      const d = await fetch(backendUrl() + '/api/video/models', { headers: backendHeaders() }).then(okJson);
      if (d.models && d.models.length) models = d.models;
    }catch(_){ /* sem backend/erro — usa a lista fixa mesmo assim (só pra visualizar) */ }
  }
  state.videoModels = models;
  sel.innerHTML = '';
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name + (m.max_duration ? ` (até ${m.max_duration}s)` : '');
    opt.dataset.type = m.type || 'text-to-video';
    sel.appendChild(opt);
  });
  updateVideoModelFields();
}
/* créditos aproximados por segundo de vídeo, por modelo (estimativa p/ UI) */
const VIDEO_CREDIT_RATES = {
  'kling-v3':1.4, 'kling-v2':1.1, 'kling-v1':0.8, 'runway-gen3':2.0,
  'luma-dream':1.2, 'veo-2':2.5, 'seedance':1.0, 'hailuo':1.3,
};
function updateVideoCost(){
  const sel = document.getElementById('video-model-select');
  const dur = parseInt(document.getElementById('video-duration')?.value, 10) || 5;
  const rate = VIDEO_CREDIT_RATES[sel?.value] ?? 1.2;
  let credits = rate * dur;
  if (document.getElementById('video-audio-chip')?.classList.contains('on')) credits *= 1.2;
  const el = document.getElementById('video-cost');
  if (el) el.textContent = `~${credits.toFixed(1)} créditos`;
}
function updateVideoModelFields(){
  const sel = document.getElementById('video-model-select');
  const opt = sel.options[sel.selectedIndex];
  const isImg2Vid = opt?.dataset.type === 'image-to-video';
  document.getElementById('video-image-url').style.display = isImg2Vid ? 'block' : 'none';
  const durationInput = document.getElementById('video-duration');
  const model = state.videoModels?.find(m => m.id === sel.value);
  if (model?.max_duration){
    durationInput.max = model.max_duration;
    durationInput.title = `Até ${model.max_duration}s`;
    if (parseInt(durationInput.value,10) > model.max_duration) durationInput.value = model.max_duration;
  } else {
    durationInput.removeAttribute('max');
    durationInput.title = 'Duração em segundos';
  }
  updateVideoCost();
}
/* revisão de prompt: usa o OpenRouter pra reescrever o prompt de forma mais rica p/ vídeo */
async function revisePrompt(raw){
  if (!state.apiKey) throw new Error('Precisa da chave do OpenRouter (Config → Geral) pra revisar o prompt.');
  const body = {
    model: state.model && !state.model.startsWith('__') ? state.model : 'openai/gpt-4.1-mini',
    messages: [
      { role:'system', content:'Você melhora prompts de geração de vídeo. Reescreva o pedido do usuário num prompt visual, cinematográfico e detalhado (câmera, luz, movimento, estilo), em UMA frase densa. Responda SÓ com o prompt, sem aspas nem explicação.' },
      { role:'user', content: raw },
    ],
    max_tokens: 220,
  };
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + state.apiKey },
    body: JSON.stringify(body),
  }).then(okJson);
  return (r.choices?.[0]?.message?.content || raw).trim();
}
async function generateVideo(){
  let prompt = document.getElementById('video-prompt').value.trim();
  const model = document.getElementById('video-model-select').value;
  const durationRaw = document.getElementById('video-duration').value.trim();
  const imageUrl = document.getElementById('video-image-url').value.trim();
  const aspect = document.getElementById('video-aspect')?.value || '';
  const withAudio = document.getElementById('video-audio-chip')?.classList.contains('on');
  const doRevise = document.getElementById('video-revise-chip')?.classList.contains('on');
  if (!prompt || !model) return;
  if (!backendUrl()){ await autoDetectBackend(); }
  if (!backendUrl()){ appendVideoNote('Backend não encontrado. Ligue o Backend VTz OS primeiro (run.bat).'); return; }
  if (!state.replicateKey){ appendVideoNote('Cole sua chave do Replicate em Config → Geral → Replicate API Key.'); return; }
  const btn = document.getElementById('gen-video-btn');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try{
    if (doRevise){
      btn.textContent = 'Revisando...';
      try{ prompt = await revisePrompt(prompt); document.getElementById('video-prompt').value = prompt; toast('Prompt revisado pela IA.'); }
      catch(e){ toast('Não deu pra revisar: ' + e.message, 'warn'); }
      btn.textContent = 'Enviando...';
    }
    const payload = { model, prompt };
    if (durationRaw) payload.duration = parseInt(durationRaw, 10);
    if (imageUrl) payload.image_url = imageUrl;
    if (aspect) payload.aspect_ratio = aspect;
    if (withAudio) payload.audio = true;
    const d = await fetch(backendUrl() + '/api/video/generate', {
      method:'POST', headers: videoHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify(payload),
    }).then(okJson);
    const grid = document.getElementById('video-grid');
    const card = document.createElement('div');
    card.className = 'img-card';
    card.dataset.startedAt = String(Date.now());
    card.innerHTML = `<div class="vid-progress">`
      + `<div class="hint" style="font-size:11px; margin-bottom:8px;">${esc(d.model_name || model)}</div>`
      + `<div class="spinner"></div>`
      + `<div class="vid-status">Gerando… (${esc(d.status || 'starting')})</div>`
      + `<div class="vid-elapsed">0s</div>`
      + `<button class="vid-cancel-btn" type="button">Cancelar</button>`
      + `</div>`;
    grid.prepend(card);
    card.querySelector('.vid-cancel-btn').onclick = () => cancelVideoPrediction(d.id, card);
    addRunningTask(d.id, 'Vídeo: ' + (d.model_name || model));
    pollVideoPrediction(d.id, card);
  }catch(e){ appendVideoNote('Erro: ' + e.message); }
  finally{ btn.disabled = false; btn.textContent = 'Gerar'; }
}
async function pollVideoPrediction(id, card, attempt = 0){
  if (card.dataset.canceled) return;
  const statusEl = card.querySelector('.vid-status');
  const elapsedEl = card.querySelector('.vid-elapsed');
  if (elapsedEl){
    const secs = Math.round((Date.now() - Number(card.dataset.startedAt || Date.now())) / 1000);
    elapsedEl.textContent = secs + 's';
  }
  if (attempt > 150){ if (statusEl) statusEl.textContent = 'Tempo esgotado — confira o resultado direto no replicate.com.'; removeRunningTask(id); return; }
  try{
    const d = await fetch(backendUrl() + '/api/video/prediction/' + encodeURIComponent(id), { headers: videoHeaders() }).then(okJson);
    if (d.status === 'succeeded'){
      const out = Array.isArray(d.output) ? d.output[0] : d.output;
      if (out) card.innerHTML = `<video src="${out}" controls></video><a href="${out}" download="vtz-video.mp4">Baixar</a>`;
      else { card.className = 'img-card vid-progress'; card.innerHTML = `<div class="vid-status">Concluído, mas sem output reconhecível.</div>`; }
      removeRunningTask(id);
      return;
    }
    if (d.status === 'failed' || d.status === 'canceled'){
      card.className = 'img-card vid-progress';
      card.innerHTML = `<div class="vid-status">${d.status === 'canceled' ? 'Cancelado.' : 'Falhou: ' + esc(d.error || d.status)}</div>`;
      removeRunningTask(id);
      return;
    }
    if (statusEl) statusEl.textContent = `Gerando… (${d.status || 'processing'})`;
    setTimeout(() => pollVideoPrediction(id, card, attempt + 1), 3000);
  }catch(e){
    if (statusEl) statusEl.textContent = 'Erro ao consultar: ' + e.message;
  }
}
async function cancelVideoPrediction(id, card){
  const btn = card.querySelector('.vid-cancel-btn');
  if (btn){ btn.disabled = true; btn.textContent = 'Cancelando...'; }
  try{
    await fetch(backendUrl() + '/api/video/prediction/' + encodeURIComponent(id) + '/cancel', {
      method: 'POST', headers: videoHeaders(),
    }).then(okJson);
    const statusEl = card.querySelector('.vid-status');
    if (statusEl) statusEl.textContent = 'Cancelado.';
    card.dataset.canceled = '1';
    removeRunningTask(id);
  }catch(e){
    if (btn){ btn.disabled = false; btn.textContent = 'Cancelar'; }
  }
}
function appendVideoNote(text){
  const grid = document.getElementById('video-grid');
  const note = document.createElement('div');
  note.className = 'img-card';
  note.style.padding = '14px'; note.style.fontSize = '12px'; note.style.color = 'var(--text-dim)';
  note.textContent = text;
  grid.prepend(note);
}
