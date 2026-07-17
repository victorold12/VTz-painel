/* Voz — lê a resposta em voz alta (TTS nativo do navegador). Clicar de novo para. */
function speakMessage(raw, btnEl){
  const synth = window.speechSynthesis;
  if (!synth){ toast('Voz não suportada neste navegador.', 'warn'); return; }
  if (synth.speaking || synth.pending){
    synth.cancel();
    if (speakMessage._on){ speakMessage._on = false; return; }  // clicou no mesmo: só para
  }
  let text = contentToText(raw).replace(/```[\s\S]*?```/g, '. bloco de código omitido. ');
  text = stripMd(text).replace(/[|#>*_`~]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4500);
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'pt-BR'; u.rate = 1.06; u.pitch = 1;
  const voices = synth.getVoices();
  const pt = voices.find(v => /pt[-_]?BR/i.test(v.lang)) || voices.find(v => /^pt/i.test(v.lang));
  if (pt) u.voice = pt;
  u.onend = () => { speakMessage._on = false; };
  speakMessage._on = true;
  synth.speak(u);
  toast('Lendo a resposta…');
}

/* ---------- Comparar modelos lado a lado (Model Council) ---------- */
function compareModelOptions(){
  const list = (state.models && state.models.length ? state.models : FALLBACK_MODELS);
  // só modelos que produzem texto (exclui os só-imagem)
  return list.filter(m => {
    const out = m.architecture?.output_modalities;
    return !out || out.includes('text');
  });
}
function openCompare(){
  if (!state.apiKey){ toast('Configure a chave do OpenRouter primeiro.', 'warn'); switchView('config'); return; }
  let ov = document.getElementById('compare-overlay');
  if (!ov){
    ov = document.createElement('div');
    ov.id = 'compare-overlay';
    ov.className = 'compare-overlay';
    ov.innerHTML = `
      <div class="cmp-panel">
        <div class="cmp-head">
          <span class="cmp-title">Comparar modelos lado a lado</span>
          <button class="hp-btn hp-close" id="cmp-close" aria-label="Fechar">${iconHTML('close')}</button>
        </div>
        <div class="cmp-controls">
          <div class="cmp-selectors" id="cmp-selectors"></div>
          <textarea id="cmp-prompt" placeholder="Escreva a pergunta pra mandar pra todos ao mesmo tempo…"></textarea>
          <button class="primary" id="cmp-run">Comparar</button>
        </div>
        <div class="cmp-cols" id="cmp-cols"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    ov.querySelector('#cmp-close').onclick = () => ov.classList.remove('open');
    ov.querySelector('#cmp-run').onclick = runCompare;
  }
  const opts = compareModelOptions();
  const optHtml = opts.map(m => `<option value="${esc(m.id)}">${esc(m.name || m.id)}</option>`).join('');
  const sel = ov.querySelector('#cmp-selectors');
  sel.innerHTML = '';
  const def = [opts[0]?.id, opts[1]?.id, ''];
  for (let i = 0; i < 3; i++){
    const s = document.createElement('select');
    s.className = 'cmp-model';
    s.innerHTML = `<option value="">— ${i < 2 ? 'escolha um modelo' : 'modelo (opcional)'} —</option>` + optHtml;
    if (def[i]) s.value = def[i];
    sel.appendChild(s);
  }
  const conv = getCurrentConv();
  const lastUser = conv ? [...conv.messages].reverse().find(m => m.role === 'user') : null;
  if (lastUser) ov.querySelector('#cmp-prompt').value = contentToText(lastUser.content);
  ov.classList.add('open');
}
async function runCompare(){
  const ov = document.getElementById('compare-overlay');
  const uniq = [...new Set([...ov.querySelectorAll('.cmp-model')].map(s => s.value).filter(Boolean))];
  const promptText = ov.querySelector('#cmp-prompt').value.trim();
  if (!uniq.length){ toast('Escolha ao menos 1 modelo.', 'warn'); return; }
  if (!promptText){ toast('Escreva a pergunta.', 'warn'); return; }
  const cols = ov.querySelector('#cmp-cols');
  cols.innerHTML = '';
  cols.style.setProperty('--cols', uniq.length);
  const colEls = {};
  uniq.forEach(id => {
    const name = compareModelOptions().find(m => m.id === id)?.name || id;
    const col = document.createElement('div');
    col.className = 'cmp-col';
    col.innerHTML = `<div class="cmp-col-head">${esc(name)}</div><div class="cmp-col-body"><span class="thinking-label">Pensando…</span></div><div class="cmp-col-meta"></div>`;
    cols.appendChild(col);
    colEls[id] = col;
  });
  await Promise.all(uniq.map(async id => {
    const col = colEls[id];
    const body = col.querySelector('.cmp-col-body');
    const meta = col.querySelector('.cmp-col-meta');
    const t0 = performance.now();
    try{
      const res = await orFetchRetry({ model: id, messages:[{ role:'user', content: promptText }] });
      if (!res.ok){ body.innerHTML = `<span class="cmp-err">Erro HTTP ${res.status}</span>`; return; }
      const data = await res.json();
      const msg = contentToText(data.choices?.[0]?.message?.content || '(sem texto)');
      body.innerHTML = safeRenderMarkdown(msg);
      enhanceCodeBlocks(body);
      trackUsage(data.usage, id, getCurrentConv());
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      const pricing = getModelPricing(id);
      const cost = data.usage ? ((data.usage.prompt_tokens||0)*pricing.prompt + (data.usage.completion_tokens||0)*pricing.completion) : 0;
      meta.textContent = `${secs}s · ~$${cost.toFixed(4)}`;
    }catch(e){ body.innerHTML = `<span class="cmp-err">${esc(e.message)}</span>`; }
  }));
}

/* ---------- Deep Research light (Gemini) — multi-busca + síntese, client-side ---------- */
function deepResearchModel(){
  if (state.model && !state.model.startsWith('__')) return state.model;
  return state.routerConfig?.balanced || state.models[0]?.id || 'openai/gpt-4.1-mini';
}
async function startDeepResearch(){
  const input = document.getElementById('chat-input');
  const topic = input.value.trim();
  if (!topic){ toast('Escreva o tema da pesquisa no campo de mensagem primeiro.', 'warn'); input.focus(); return; }
  if (!state.apiKey){ toast('Configure a chave do OpenRouter primeiro.', 'warn'); switchView('config'); return; }
  input.value = '';
  if (backendUrl()) backendDeepResearch(topic);  // server-side, mais robusto
  else deepResearch(topic);                       // fallback client-side
}
async function deepResearch(topic){
  const conv = getCurrentConv(); if (!conv) return;
  const model = deepResearchModel();
  conv.messages.push({ role:'user', content: '🔬 Pesquisa profunda: ' + topic });
  const aIdx = conv.messages.push({ role:'assistant', content: '_Planejando a pesquisa…_' }) - 1;
  conv.updatedAt = Date.now();
  persistConversations(); renderChat();
  const setStatus = (t) => { conv.messages[aIdx].content = t; renderChat(); };
  const ask = async (messages, plugins) => {
    const body = { model, messages };
    if (plugins) body.plugins = plugins;
    const r = await orFetchRetry(body);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    trackUsage(d.usage, model, conv);
    return contentToText(d.choices?.[0]?.message?.content || '');
  };
  try{
    setStatus('🔬 _Quebrando o tema em sub-perguntas…_');
    const subRaw = await ask([{ role:'user', content: `Quebre o tema abaixo em 3 a 4 sub-perguntas de pesquisa objetivas e complementares. Responda SÓ com um array JSON de strings, nada mais.\n\nTema: ${topic}` }]);
    let subs = [];
    try{ subs = JSON.parse((subRaw.match(/\[[\s\S]*\]/) || [subRaw])[0]); }catch(_){}
    if (!Array.isArray(subs) || !subs.length){
      subs = subRaw.split('\n').map(s => s.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean);
    }
    subs = subs.filter(s => typeof s === 'string' && s.length > 4).slice(0, 4);
    if (!subs.length) subs = [topic];
    setStatus('🔬 _Pesquisando na web:_\n' + subs.map(s => '- ' + s).join('\n'));
    const findings = await Promise.all(subs.map(async q => {
      try{ const a = await ask([{ role:'user', content: q + '\n\nResponda com fatos e dados concretos, citando as fontes (com links).' }], [{ id:'web' }]); return `### ${q}\n${a}`; }
      catch(e){ return `### ${q}\n(falha nesta sub-busca: ${e.message})`; }
    }));
    setStatus('🔬 _Sintetizando o relatório final…_');
    const report = await ask([{ role:'user', content: `Com base SÓ nas descobertas abaixo, escreva um relatório final sobre "${topic}". Use "## seções", **negrito**, listas e uma seção final "## Conclusão". Cite as fontes (links) ao longo do texto. Seja objetivo e honesto sobre o que ficou incerto.\n\n${findings.join('\n\n')}` }]);
    conv.messages[aIdx].content = report;
    if (conv.title === 'Nova conversa' || !conv.title) conv.title = topic.slice(0, 40);
    conv.updatedAt = Date.now();
    persistConversations(); renderChat(); renderHistoryList();
    attachTopicImages(conv.messages[aIdx], topic, conv);  // imagens sobre o tema (via backend)
    toast('Pesquisa profunda concluída.');
  }catch(e){
    conv.messages[aIdx].content = '**Falha na pesquisa profunda:** ' + e.message;
    persistConversations(); renderChat();
    toast('Pesquisa profunda falhou: ' + e.message, 'err');
  }
}

/* ---------- Integração com o backend VTz OS (opcional) ---------- */
