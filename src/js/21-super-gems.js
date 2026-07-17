/* Super Gems — botões de ação rápida de um agente, acima do composer. */
function renderQuickActions(agent){
  const el = document.getElementById('quick-actions');
  if (!el) return;
  el.innerHTML = '';
  const actions = agent?.quickActions || [];
  if (!actions.length){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = 'qa-btn';
    b.textContent = a.label;
    b.title = a.prompt;
    b.onclick = () => {
      const input = document.getElementById('chat-input');
      input.value = a.prompt;
      sendMessage();
    };
    el.appendChild(b);
  });
}
function renderChat(){
  const conv = getCurrentConv();
  const log = document.getElementById('chat-log');
  const empty = document.getElementById('empty-state');
  log.innerHTML = '';

  const agent = conv?.agentId ? state.agents.find(a => a.id === conv.agentId) : null;
  renderQuickActions(agent);
  const greetEl = document.getElementById('empty-greeting');
  if (agent){
    greetEl.innerHTML = '';
    const iconSpan = document.createElement('span');
    iconSpan.style.cssText = 'display:inline-flex; margin-right:6px; color:var(--violet); vertical-align:-3px;';
    iconSpan.innerHTML = iconHTML(agent.icon);
    greetEl.appendChild(iconSpan);
    greetEl.appendChild(document.createTextNode(agent.name));
  } else {
    greetEl.textContent = 'Oi Victor, qual é o plano?';
  }
  document.getElementById('empty-sub').textContent = agent ? agent.desc : 'Chat multi-modelo via OpenRouter';

  if (!conv || !conv.messages.length){
    empty.style.display = 'flex';
    log.style.display = 'none';
    updateComposerState();
    return;
  }
  empty.style.display = 'none';
  log.style.display = 'flex';
  conv.messages.forEach((m, i) => {
    if (m.role === 'user' || m.role === 'assistant'){
      if (m._router) appendRouterBadge(m._router, null, null, true);
      appendMessageDOM(m.role, m.content, false, i);
    }
  });
  log.scrollTop = log.scrollHeight;
  updateComposerState();
  updateCtxMeter();
}
function safeRenderMarkdown(content){
  if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined'){
    try{ return DOMPurify.sanitize(marked.parse(content || '')); }
    catch(e){ console.error('Erro no parse de markdown, usando fallback texto puro:', e); }
  }
  // Fallback: CDN de marked/DOMPurify não carregou (ad-blocker, firewall, offline).
  // Renderiza texto puro escapado em vez de travar a UI.
  const div = document.createElement('div');
  div.textContent = content || '';
  return div.innerHTML.replace(/\n/g, '<br>');
}
function appendRouterBadge(modelName, conv, beforeEl, fullText){
  if (conv && conv.id !== state.currentConvId) return null;
  const log = document.getElementById('chat-log');
  document.getElementById('empty-state').style.display = 'none';
  log.style.display = 'flex';
  const badge = document.createElement('div');
  badge.className = 'router-badge';
  const inner = fullText
    ? `<span class="rb-model">${esc(modelName)}</span>`
    : `RouteLLM <span style="color:var(--text-faint)">►</span> <span class="rb-model">${esc(modelName)}</span>`;
  badge.innerHTML = `<span class="rb-icon">${iconHTML('shuffle')}</span><span>${inner}</span>`;
  if (beforeEl && beforeEl.parentElement === log) log.insertBefore(badge, beforeEl);
  else log.appendChild(badge);
  return badge;
}

function appendMessageDOM(role, content, isTool, msgIndex){
  const empty = document.getElementById('empty-state');
  const log = document.getElementById('chat-log');
  empty.style.display = 'none';
  log.style.display = 'flex';

  if (isTool){
    const div = document.createElement('div');
    div.className = 'msg tool';
    div.innerHTML = safeRenderMarkdown(contentToText(content));
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  const isUser = role === 'user';
  const textContent = contentToText(content);
  const row = document.createElement('div');
  row.className = 'msg-row' + (isUser ? ' user' : '');

  const convForAv = getCurrentConv();
  const agentForAv = convForAv?.agentId ? state.agents.find(a => a.id === convForAv.agentId) : null;
  const av = document.createElement('div');
  av.className = 'msg-av ' + (isUser ? 'usr' : 'ai');
  av.innerHTML = isUser ? 'VH' : (agentForAv?.photo ? `<img src="${agentForAv.photo}" alt="">` : iconHTML('sparkle'));

  const body = document.createElement('div');
  body.className = 'msg-body';

  const sender = document.createElement('div');
  sender.className = 'msg-sender';
  sender.textContent = isUser ? 'Você' : 'VTz LLM';

  const bubble = document.createElement('div');
  bubble.className = 'msg ' + role;
  bubble.innerHTML = safeRenderMarkdown(textContent);
  if (!isUser) enhanceCodeBlocks(bubble);

  // nota de anexos (quando a mensagem tinha arquivos)
  const conv = getCurrentConv();
  const msgObj = (msgIndex != null && conv) ? conv.messages[msgIndex] : null;
  if (msgObj && msgObj._att && msgObj._att.length){
    const note = document.createElement('div');
    note.className = 'msg-att-note';
    note.textContent = 'anexos: ' + msgObj._att.join(', ');
    bubble.appendChild(note);
  }

  // fontes da busca web (estilo Claude: favicon + título, clicável)
  if (msgObj && msgObj._images && msgObj._images.length){
    const box = document.createElement('div');
    box.className = 'msg-images';
    const head = document.createElement('div');
    head.className = 'sources-head';
    head.innerHTML = iconHTML('image') + ` Imagens`;
    box.appendChild(head);
    const strip = document.createElement('div');
    strip.className = 'img-strip';
    msgObj._images.forEach(im => {
      const a = document.createElement('a');
      a.href = im.source || im.image; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.title = im.title || '';
      const img = document.createElement('img');
      img.src = im.thumbnail || im.image; img.alt = im.title || ''; img.loading = 'lazy';
      img.onerror = () => a.remove();
      a.appendChild(img);
      strip.appendChild(a);
    });
    box.appendChild(strip);
    bubble.appendChild(box);
  }

  if (msgObj && msgObj._sources && msgObj._sources.length){
    const sources = document.createElement('div');
    sources.className = 'msg-sources';
    const head = document.createElement('div');
    head.className = 'sources-head';
    head.innerHTML = iconHTML('globe') + ` ${msgObj._sources.length} fonte${msgObj._sources.length>1?'s':''} da web`;
    sources.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'sources-grid';
    msgObj._sources.forEach((s, i) => {
      let host = '';
      try{ host = new URL(s.url).hostname.replace('www.',''); }catch(_){ host = s.url; }
      const a = document.createElement('a');
      a.className = 'source-card';
      a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32" alt="" onerror="this.style.display='none'">`
        + `<span class="src-body"><span class="src-title">${esc(s.title || host)}</span><span class="src-host">${esc(host)}</span></span>`
        + `<span class="src-n">${i+1}</span>`;
      grid.appendChild(a);
    });
    sources.appendChild(grid);
    bubble.appendChild(sources);
    // Com backend: busca a og:image de cada fonte (o navegador não pega por CORS).
    if (backendUrl()){
      msgObj._sources.slice(0, 8).forEach((s, i) => {
        fetch(backendUrl() + '/api/scrape', {
          method:'POST', headers: backendHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify({ url: s.url }),
        }).then(r => r.ok ? r.json() : null).then(d => {
          if (!d || !d.image) return;
          const card = grid.children[i]; if (!card) return;
          const img = document.createElement('img');
          img.className = 'src-thumb'; img.src = d.image; img.alt = ''; img.loading = 'lazy';
          img.onerror = () => { img.remove(); card.classList.remove('has-thumb'); };
          card.classList.add('has-thumb');
          card.insertBefore(img, card.firstChild);
        }).catch(() => {});
      });
    }
  }

  const acts = document.createElement('div');
  acts.className = 'msg-acts';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.innerHTML = iconHTML('copy') + ' Copiar';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(textContent).then(() => {
      copyBtn.innerHTML = iconHTML('copy') + ' Copiado';
      setTimeout(() => { copyBtn.innerHTML = iconHTML('copy') + ' Copiar'; }, 1500);
    }).catch(() => {});
  };
  acts.appendChild(copyBtn);

  // botão ⋯ abre o menu de ações (estilo Claude)
  if (msgIndex != null){
    const moreBtn = document.createElement('button');
    moreBtn.className = 'copy-btn';
    moreBtn.innerHTML = iconHTML('more');
    moreBtn.title = 'Mais ações';
    moreBtn.onclick = () => openMsgMenu(msgIndex);
    acts.appendChild(moreBtn);
  }

  body.appendChild(sender);
  body.appendChild(bubble);
  body.appendChild(acts);
  row.appendChild(av);
  row.appendChild(body);
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
  return row;
}

/* ---------- Menu de ações da mensagem ---------- */
function openMsgMenu(msgIndex){
  const conv = getCurrentConv();
  const msg = conv?.messages[msgIndex];
  if (!msg) return;
  const isAssistant = msg.role === 'assistant';
  const menu = document.getElementById('msg-menu');
  menu.innerHTML = '';

  const items = [
    { icon:'selectText', label:'Selecionar texto', run: () => openSelectText(contentToText(msg.content)) },
  ];
  if (!isAssistant) items.push({ icon:'edit', label:'Editar mensagem', run: () => openEditMsg(msgIndex) });
  const rawText = contentToText(msg.content);
  const blocks = extractCodeBlocks(rawText);
  items.push({ icon:'download', label:'Baixar mensagem (.md)', run: () => {
    downloadTextFile(`vtz-mensagem-${msgIndex+1}.md`, rawText);
  }});
  if (isAssistant && FS_CAN_SAVE){
    items.push({ icon:'download', label:'Salvar no computador…', run: () => {
      const first = blocks[0];
      const name = first ? guessFilename(first.code, first.lang, 1) : `vtz-${msgIndex+1}.md`;
      saveToDisk(first ? first.code : rawText, name);
    }});
    if (lastFileHandle){
      items.push({ icon:'download', label:`Salvar por cima de "${lastFileName}"`, run: () => {
        const first = blocks[0];
        saveOverLast(first ? first.code : rawText);
      }});
    }
  }
  items.push({ icon:'file', label:'Baixar PDF (formatado)', run: () => downloadRichPdf(rawText, `vtz-${msgIndex+1}.pdf`) });
  items.push({ icon:'file', label:'Baixar slides (PDF)', run: () => downloadSlidesPdf(rawText, `vtz-slides-${msgIndex+1}.pdf`) });
  items.push({ icon:'file', label:'Baixar como Word (.docx)', run: () => downloadDocx(rawText, `vtz-${msgIndex+1}.docx`) });
  if (extractMarkdownTables(rawText).length){
    items.push({ icon:'file', label:'Baixar tabela (.xlsx)', run: () => downloadXlsx(rawText, `vtz-${msgIndex+1}.xlsx`) });
  }
  if (blocks.length){
    items.push({ icon:'download', label:`Baixar código${blocks.length>1?'s':''} (${blocks.length} arquivo${blocks.length>1?'s':''})`, run: () => {
      blocks.forEach((b, i) => setTimeout(() => downloadTextFile(guessFilename(b.code, b.lang, i+1), b.code), i * 250));
      toast(`Baixando ${blocks.length} arquivo${blocks.length>1?'s':''}…`);
    }});
  }
  if (isAssistant){
    items.push({ icon:'volume', label:'Ouvir resposta', run: () => speakMessage(msg.content) });
    items.push({ icon:'refresh', label:'Regenerar', run: () => openRegenSheet(msgIndex) });
    items.push({ icon:'wand', label:'Humanizar', run: () => humanizeMessage(msgIndex) });
  }
  items.push({ icon:'thumbUp', label: msg._feedback==='up' ? 'Feedback positivo (registrado)' : 'Feedback positivo', done: msg._feedback==='up',
    run: () => { msg._feedback = msg._feedback==='up' ? null : 'up'; persistConversations(); } });
  items.push({ icon:'thumbDown', label: msg._feedback==='down' ? 'Feedback negativo (registrado)' : 'Feedback negativo', done: msg._feedback==='down',
    run: () => { msg._feedback = msg._feedback==='down' ? null : 'down'; persistConversations(); } });

  items.forEach(it => {
    const btn = document.createElement('button');
    btn.className = 'msg-menu-item' + (it.done ? ' done' : '');
    btn.innerHTML = iconHTML(it.icon) + ' ' + it.label;
    btn.onclick = () => { closeMsgMenu(); it.run(); };
    menu.appendChild(btn);
  });
  document.getElementById('msg-menu-overlay').classList.add('open');
}
function closeMsgMenu(){ document.getElementById('msg-menu-overlay').classList.remove('open'); }
function openSelectText(text){
  document.getElementById('select-text-area').value = text;
  document.getElementById('select-text-modal').style.display = 'flex';
}

