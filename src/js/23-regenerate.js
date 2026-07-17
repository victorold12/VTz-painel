/* Sheet de escolha de modelo pra regenerar: mesmo modelo, favoritos e shortlist */
function openRegenSheet(msgIndex){
  const menu = document.getElementById('msg-menu');
  menu.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'msg-menu-title';
  title.textContent = 'Regenerar com qual modelo?';
  menu.appendChild(title);
  const conv = getCurrentConv();
  const curModel = conv?.model || state.model;
  const opts = [{ id:null, label:'Mesmo modelo' + (curModel === '__router__' ? ' (RouteLLM)' : '') }];
  const seen = new Set();
  state.favorites.forEach(id => {
    const m = state.models.find(x => x.id === id && !isImageModel(x));
    if (m && !seen.has(m.id)){ seen.add(m.id); opts.push({ id:m.id, label:'★ ' + (m.name || m.id) }); }
  });
  routerCandidates().forEach(c => {
    if (!seen.has(c.id)){ seen.add(c.id); const m = state.models.find(x => x.id === c.id); opts.push({ id:c.id, label:(m?.name || c.id) }); }
  });
  opts.slice(0, 9).forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'msg-menu-item';
    btn.innerHTML = iconHTML('refresh') + ' ' + esc(o.label);
    btn.onclick = () => { closeMsgMenu(); regenerateFrom(msgIndex, o.id); };
    menu.appendChild(btn);
  });
  document.getElementById('msg-menu-overlay').classList.add('open');
}
/* Regenerar: corta a conversa até antes da mensagem e refaz — com modelo opcional */
async function regenerateFrom(msgIndex, modelOverride){
  const conv = getCurrentConv();
  if (!conv) return;
  if (state.gens[conv.id]){ toast('Aguarde ou interrompa a geração atual.', 'warn'); return; }
  conv.messages = conv.messages.slice(0, msgIndex);
  persistConversations();
  renderChat();
  try{ await runChatLoop(0, conv, modelOverride || null); }
  catch(e){ if (e.name !== 'AbortError' && conv.id === state.currentConvId) appendMessageDOM('assistant', 'Erro: ' + e.message); }
}

