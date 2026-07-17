/* Editar mensagem enviada: corrige o texto, descarta o que veio depois e refaz a resposta */
function openEditMsg(msgIndex){
  const conv = getCurrentConv();
  const msg = conv?.messages[msgIndex];
  if (!msg) return;
  if (state.gens[conv.id]){ toast('Aguarde ou interrompa a geração atual.', 'warn'); return; }
  const modal = document.getElementById('edit-msg-modal');
  document.getElementById('edit-msg-area').value = contentToText(msg.content);
  modal.dataset.msgIndex = String(msgIndex);
  // anexos não sobrevivem à edição (base64 não é persistido) — avisa em vez de perder em silêncio
  document.getElementById('edit-msg-note').style.display = Array.isArray(msg.content) ? 'block' : 'none';
  modal.style.display = 'flex';
  document.getElementById('edit-msg-area').focus();
}
async function saveEditMsg(){
  const modal = document.getElementById('edit-msg-modal');
  const idx = parseInt(modal.dataset.msgIndex, 10);
  const text = document.getElementById('edit-msg-area').value.trim();
  modal.style.display = 'none';
  if (!text) return;
  const conv = getCurrentConv();
  if (!conv || !conv.messages[idx]) return;
  conv.messages = conv.messages.slice(0, idx);
  conv.messages.push({ role:'user', content: text });
  conv.updatedAt = Date.now();
  persistConversations();
  renderChat();
  renderHistoryList();
  try{ await runChatLoop(0, conv); }
  catch(e){ if (e.name !== 'AbortError' && conv.id === state.currentConvId) appendMessageDOM('assistant', 'Erro: ' + e.message); }
}

/* ---------- Medidor de contexto ao vivo (tokens + custo estimado do próximo envio) ----------
   Estimativa: ~4 chars por token (heurística padrão pra pt/en). Não é o tokenizer exato
   do modelo — é aproximação declarada, suficiente pra avisar antes de ficar caro. */
function estimateTokens(text){ return Math.ceil((text || '').length / 4); }
function updateCtxMeter(){
  const el = document.getElementById('ctx-meter');
  if (!el) return;
  const chatView = document.getElementById('chat-view');
  if (!chatView || !chatView.classList.contains('active')) return;
  const conv = getCurrentConv();
  if (!conv){ el.textContent = ''; return; }
  let msgs = conv.messages;
  if (state.ctxWindow > 0 && msgs.length > state.ctxWindow) msgs = msgs.slice(-state.ctxWindow);
  const draft = document.getElementById('chat-input')?.value || '';
  const sys = buildSystemPrompt(conv) || '';
  let totalChars = sys.length + draft.length;
  for (const m of msgs){
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    totalChars += (typeof m.content === 'string') ? m.content.length : contentToText(m.content).length;
  }
  const tokens = Math.ceil(totalChars / 4);

  let modelId = conv.model || state.model;
  if (modelId === '__router__') modelId = state.routerConfig.balanced || state.routerConfig.fast || '';
  const m = state.models.find(x => x.id === modelId);
  const pricing = getModelPricing(modelId);
  const costBRL = tokens * pricing.prompt * state.usdToBrl;
  const ctxMax = m?.context_length || 0;

  const kt = tokens >= 1000 ? (tokens/1000).toFixed(1).replace('.',',') + 'k' : String(tokens);
  const maxTxt = ctxMax ? ' / ' + Math.round(ctxMax/1000) + 'k' : '';
  const custo = costBRL >= 0.01 ? ' · ~R$' + costBRL.toFixed(2).replace('.',',') : '';
  el.textContent = `~${kt}${maxTxt} tokens${custo}`;
  const pct = ctxMax ? tokens / ctxMax : 0;
  el.classList.toggle('warn', pct >= 0.7 && pct < 0.9);
  el.classList.toggle('danger', pct >= 0.9);
}

