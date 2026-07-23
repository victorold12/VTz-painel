/* FALLBACK_MODELS: só é usado se o fetch ao vivo do /models falhar.
   context_length aqui é o valor conhecido por família (snapshot 2026-07); quando o
   catálogo real carrega, ele sobrescreve estes números.
   (ex: sem internet, ou CORS bloqueado por algum motivo específico).
   Snapshot pesquisado em 2026-07-07 — vai ficar desatualizado com o tempo.
   NÃO é fonte de verdade: o fetch ao vivo acima já traz o catálogo completo
   e atualizado quando funciona. Isso é só rede de segurança. */
const FALLBACK_MODELS = [
  {id:'openai/gpt-5.5', name:'GPT-5.5', pricing:{prompt:'0.000005',completion:'0.00003'}, context_length:400000},
  {id:'openai/gpt-5.4', name:'GPT-5.4', pricing:{prompt:'0.0000025',completion:'0.000015'}, context_length:400000},
  {id:'openai/gpt-4.1', name:'GPT-4.1', pricing:{prompt:'0.000002',completion:'0.000008'}, context_length:1047576},
  {id:'openai/gpt-4.1-mini', name:'GPT-4.1 Mini', pricing:{prompt:'0.0000004',completion:'0.0000016'}, context_length:1047576},
  {id:'openai/gpt-4.1-nano', name:'GPT-4.1 Nano', pricing:{prompt:'0.0000001',completion:'0.0000004'}, context_length:1047576},
  {id:'openai/o4-mini', name:'o4-mini', pricing:{prompt:'0.0000011',completion:'0.0000044'}, context_length:200000},
  {id:'openai/o3-mini', name:'o3-mini', pricing:{prompt:'0.0000011',completion:'0.0000044'}, context_length:200000},
  {id:'openai/gpt-3.5-turbo', name:'GPT-3.5 Turbo', pricing:{prompt:'0.000001',completion:'0.000002'}, context_length:16385},
  {id:'openai/gpt-image-1', name:'GPT Image 1', pricing:{prompt:'0.00001',completion:'0.00001'}, architecture:{output_modalities:['image','text']}, context_length:4096},
  {id:'openai/gpt-image-1-mini', name:'GPT Image 1 Mini', pricing:{prompt:'0.0000025',completion:'0.0000025'}, architecture:{output_modalities:['image','text']}, context_length:4096},
  {id:'openai/gpt-image-2', name:'GPT Image 2', pricing:{prompt:'0.000008',completion:'0.000008'}, architecture:{output_modalities:['image','text']}, context_length:4096},
  {id:'anthropic/claude-opus-4.8', name:'Claude Opus 4.8', pricing:{prompt:'0.000005',completion:'0.000025'}, context_length:200000},
  {id:'anthropic/claude-sonnet-5', name:'Claude Sonnet 5', pricing:{prompt:'0.000002',completion:'0.00001'}, context_length:200000},
  {id:'anthropic/claude-sonnet-4.6', name:'Claude Sonnet 4.6', pricing:{prompt:'0.000003',completion:'0.000015'}, context_length:200000},
  {id:'anthropic/claude-haiku-4.5', name:'Claude Haiku 4.5', pricing:{prompt:'0.000001',completion:'0.000005'}, context_length:200000},
  {id:'anthropic/claude-haiku-3.5', name:'Claude Haiku 3.5', pricing:{prompt:'0.0000008',completion:'0.000004'}, context_length:200000},
  {id:'anthropic/claude-haiku-3', name:'Claude Haiku 3', pricing:{prompt:'0.00000025',completion:'0.00000125'}, context_length:200000},
  {id:'anthropic/claude-fable-5', name:'Claude Fable 5', pricing:{prompt:'0.00001',completion:'0.00005'}, context_length:128000},
  {id:'anthropic/claude-3.5-sonnet', name:'Claude 3.5 Sonnet', pricing:{prompt:'0.000003',completion:'0.000015'}, context_length:128000},
  {id:'google/gemini-3.1-pro', name:'Gemini 3.1 Pro', pricing:{prompt:'0.000002',completion:'0.000012'}, context_length:1048576},
  {id:'google/gemini-3.5-flash', name:'Gemini 3.5 Flash', pricing:{prompt:'0.0000015',completion:'0.000009'}, context_length:1048576},
  {id:'google/gemini-3.1-flash-lite', name:'Gemini 3.1 Flash Lite', pricing:{prompt:'0.00000025',completion:'0.0000015'}, context_length:1048576},
  {id:'google/gemini-2.5-flash', name:'Gemini 2.5 Flash', pricing:{prompt:'0.0000003',completion:'0.0000012'}, context_length:1048576},
  {id:'google/gemini-2.5-flash-image', name:'Nano Banana (Gemini 2.5 Flash Image)', pricing:{prompt:'0.0000003',completion:'0.0000012'}, architecture:{output_modalities:['image','text']}, context_length:1048576},
  {id:'google/gemini-3.1-flash-image-preview', name:'Nano Banana 2 (Gemini 3.1 Flash Image)', pricing:{prompt:'0.0000003',completion:'0.0000012'}, architecture:{output_modalities:['image','text']}, context_length:1048576},
  {id:'google/gemini-3.1-flash-lite-image', name:'Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)', pricing:{prompt:'0.0000002',completion:'0.0000008'}, architecture:{output_modalities:['image','text']}, context_length:1048576},
  {id:'google/gemini-3-pro-image', name:'Nano Banana Pro (Gemini 3 Pro Image)', pricing:{prompt:'0.000002',completion:'0.000012'}, architecture:{output_modalities:['image','text']}, context_length:1048576},
  {id:'deepseek/deepseek-v4-flash', name:'DeepSeek V4 Flash', pricing:{prompt:'0.00000014',completion:'0.00000028'}, context_length:164000},
  {id:'deepseek/deepseek-r1', name:'DeepSeek R1', pricing:{prompt:'0.0000006',completion:'0.0000024'}, context_length:164000},
  {id:'deepseek/deepseek-r1:free', name:'DeepSeek R1 (free)', pricing:{prompt:'0',completion:'0'}, context_length:164000},
  {id:'meta-llama/llama-3.3-70b-instruct', name:'Llama 3.3 70B', pricing:{prompt:'0.00000013',completion:'0.0000004'}, context_length:131072},
  {id:'meta-llama/llama-3.3-70b-instruct:free', name:'Llama 3.3 70B (free)', pricing:{prompt:'0',completion:'0'}, context_length:131072},
  {id:'x-ai/grok-4.3', name:'Grok 4.3', pricing:{prompt:'0.00000125',completion:'0.0000025'}, context_length:256000},
  {id:'qwen/qwen3.7-max', name:'Qwen3.7 Max', pricing:{prompt:'0.0000025',completion:'0.0000075'}, context_length:262144},
  {id:'z-ai/glm-5.2', name:'GLM-5.2', pricing:{prompt:'0.0000014',completion:'0.0000044'}, context_length:200000},
  {id:'z-ai/glm-4.7-flash', name:'GLM-4.7 Flash (free)', pricing:{prompt:'0',completion:'0'}, context_length:200000},
  {id:'minimax/minimax-m3', name:'MiniMax M3', pricing:{prompt:'0.0000006',completion:'0.0000024'}, context_length:1000000},
  {id:'black-forest-labs/flux.2-pro', name:'FLUX.2 Pro', pricing:{prompt:'0',completion:'0'}, architecture:{output_modalities:['image']}, context_length:128000},
  {id:'bytedance-seed/seedream-4.5', name:'Seedream 4.5', pricing:{prompt:'0',completion:'0'}, architecture:{output_modalities:['image']}, context_length:128000},
  {id:'x-ai/grok-imagine-image-quality', name:'Grok Imagine Image Quality', pricing:{prompt:'0',completion:'0'}, architecture:{output_modalities:['image']}, context_length:256000},
];

async function fetchModels(){
  try{
    const res = await fetch(OR_BASE + '/models');
    const data = await res.json();
    state.models = data.data || [];
    if (!state.models.length) throw new Error('resposta vazia');
  }catch(e){
    console.error('Fetch ao vivo falhou, usando fallback datado (2026-07-07):', e);
    state.models = FALLBACK_MODELS;
  }
  if (!state.model && state.models.length) state.model = state.models[0].id;
  updateModelLabel();
  renderPickerTabs();
  populateImageModelSelect();
  pickDefaultRouterConfig();
  populateRouterSelects();
  updateSessionPanel();
}
function isImageModel(m){
  const outs = m.architecture?.output_modalities
    || m.architecture?.modality?.split('->')[1]?.split('+')
    || [];
  return outs.includes('image');
}
function updateModelLabel(){
  const SPECIAL = { '__router__':'RouteLLM', '__router_free__':'RouteLLM Free', '__fusion__':'Fusion' };
  if (SPECIAL[state.model]){
    document.getElementById('current-model-label').innerHTML = `<span style="display:inline-flex; margin-right:5px; vertical-align:-3px; color:var(--violet);">${iconHTML('shuffle')}</span>${SPECIAL[state.model]}`;
    return;
  }
  const m = state.models.find(x => x.id === state.model);
  document.getElementById('current-model-label').textContent = m ? (m.name || m.id) : (state.model || 'Selecionar modelo');
}
function getModelPricing(modelId){
  const m = state.models.find(x => x.id === modelId);
  if (!m || !m.pricing) return {prompt:0, completion:0};
  return { prompt: parseFloat(m.pricing.prompt||0), completion: parseFloat(m.pricing.completion||0) };
}
function populateImageModelSelect(){
  const imgs = state.models.filter(isImageModel);
  state.imageModels = imgs.length ? imgs.map(m => ({id:m.id, name:m.name||m.id})) : [
    {id:'google/gemini-2.5-flash-image', name:'Nano Banana (Gemini 2.5 Flash Image)'},
  ];
  const sel = document.getElementById('image-model-select');
  sel.innerHTML = '';
  state.imageModels.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = m.name;
    sel.appendChild(opt);
  });
}

/* ---------- Model picker overlay ---------- */
function openPicker(){
  document.getElementById('picker-overlay').classList.add('open');
  document.getElementById('picker-search-input').value = '';
  renderPickerTabs();
  renderPickerSorts();
  renderPickerList();
}
function closePicker(){ document.getElementById('picker-overlay').classList.remove('open'); }
function renderPickerTabs(){
  const all = state.models.length;
  const imgs = state.models.filter(isImageModel).length;
  const txt = all - imgs;
  const favs = state.favorites.filter(id => state.models.some(m => m.id === id)).length;
  const tabs = [ ['all','Todos',all], ['fav','★ Favoritos',favs], ['text','Texto',txt], ['image','Imagem',imgs] ];
  const el = document.getElementById('picker-tabs');
  el.innerHTML = '';
  tabs.forEach(([key,label,count]) => {
    const btn = document.createElement('button');
    btn.className = 'picker-tab' + (state.pickerTab === key ? ' active' : '');
    btn.textContent = `${label} ${count}`;
    btn.onclick = () => { state.pickerTab = key; renderPickerTabs(); renderPickerList(); };
    el.appendChild(btn);
  });
}
function renderPickerSorts(){
  const el = document.getElementById('picker-sorts');
  el.innerHTML = '';
  // chip "Padrão" = limpar combinação
  const def = document.createElement('button');
  def.className = 'picker-tab' + (state.pickerSorts.length === 0 ? ' active' : '');
  def.textContent = 'Padrão';
  def.onclick = () => { state.pickerSorts = []; renderPickerSorts(); renderPickerList(); };
  el.appendChild(def);

  SORT_PRESETS.forEach(p => {
    const pos = state.pickerSorts.indexOf(p.key); // -1, 0 ou 1
    const btn = document.createElement('button');
    btn.className = 'picker-tab' + (pos >= 0 ? ' active' : '');
    // mostra a ordem quando há 2 combinados (1 = primário, 2 = desempate)
    btn.innerHTML = esc(p.label) + (pos >= 0 && state.pickerSorts.length > 1 ? ` <span class="sort-order">${pos+1}</span>` : '');
    btn.onclick = () => { togglePickerSort(p.key); renderPickerSorts(); renderPickerList(); };
    el.appendChild(btn);
  });
}
function renderPickerList(){
  const q = document.getElementById('picker-search-input').value.trim().toLowerCase();
  let list = state.models;
  if (state.pickerTab === 'image') list = list.filter(isImageModel);
  if (state.pickerTab === 'text') list = list.filter(m => !isImageModel(m));
  if (state.pickerTab === 'fav') list = list.filter(m => isFavorite(m.id));
  if (q) list = list.filter(m => m.id.toLowerCase().includes(q) || (m.name||'').toLowerCase().includes(q));

  const active = state.pickerSorts.map(k => SORT_PRESETS.find(p => p.key === k)).filter(Boolean);
  if (active.length){
    // filtros de todos os presets ativos se acumulam (ex: "Grátis" + "Codex")
    active.forEach(p => { if (p.filter) list = list.filter(p.filter); });
    // ordena em cascata: 1º critério manda; empate -> 2º critério desempata
    const cmps = active.filter(p => p.cmp).map(p => p.cmp);
    if (cmps.length){
      list = [...list].sort((a,b) => {
        for (const cmp of cmps){ const d = cmp(a,b); if (d !== 0) return d; }
        return 0;
      });
    }
  } else {
    // sem preset: favoritos sempre no topo
    list = [...list].sort((a,b) => (isFavorite(b.id)?1:0) - (isFavorite(a.id)?1:0));
  }

  const specials = [];
  if (state.pickerTab !== 'image' && state.pickerTab !== 'fav' && state.pickerSorts.length === 0){
    const match = (m) => !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
      || 'routellm fusion'.includes(q);
    [ROUTER_MODEL, ROUTER_FREE_MODEL, FUSION_MODEL].forEach(sp => { if (match(sp)) specials.push(sp); });
  }
  const displayList = [...specials, ...list];

  const el = document.getElementById('picker-list');
  el.innerHTML = '';
  if (!displayList.length){
    const empty = document.createElement('div');
    empty.className = 'picker-empty';
    empty.textContent = state.pickerTab === 'fav'
      ? 'Nenhum favorito ainda. Toque na estrela de um modelo pra fixar aqui.'
      : (state.pickerSorts.includes('free') ? 'Nenhum modelo grátis com esses filtros.' : 'Nenhum modelo encontrado.');
    el.appendChild(empty);
    return;
  }
  displayList.forEach(m => {
    const SPECIAL_DESC = {
      '__router__': 'roteia pra melhor IA da tarefa',
      '__router_free__': 'roteia só entre modelos grátis',
      '__fusion__': '2 IAs em paralelo, fundidas na melhor resposta',
    };
    const isSpecial = !!SPECIAL_DESC[m.id];
    const badge = isSpecial
      ? `<span class="provider-badge" style="background:var(--violet)">${iconHTML(m.id==='__fusion__'?'shuffle':'shuffle')}</span>`
      : providerBadgeHTML(m.id);
    const price = isSpecial ? '' : formatPriceBRL(m);
    const row = document.createElement('div');
    row.className = 'model-row' + (m.id === state.model ? ' selected' : '');
    row.innerHTML = `
      ${badge}
      <div class="model-info">
        <span class="name">${esc(m.name||m.id)}</span>
        <span class="id">${isSpecial ? SPECIAL_DESC[m.id] : esc(m.id)}</span>
        ${price ? `<span class="price">${price}</span>` : ''}
      </div>
      ${isSpecial ? '' : `<button class="fav-btn ${isFavorite(m.id)?'faved':''}" title="Favoritar">${isFavorite(m.id)?'★':'☆'}</button>`}
      ${m.id === state.model ? '<span class="check">✓</span>' : ''}
    `;
    const favBtn = row.querySelector('.fav-btn');
    if (favBtn){
      favBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(m.id);
        renderPickerTabs();
        renderPickerList();
      };
    }
    row.onclick = () => {
      state.model = m.id;
      localStorage.setItem('vtz_or_model', state.model);
      updateModelLabel();
      updateCtxMeter();
      closePicker();
    };
    el.appendChild(row);
  });
}

/* ---------- Chat rendering ---------- */
