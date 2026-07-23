/* Menu de ações da conversa (substitui o prompt de texto) */
function openConvMenu(convId){
  const conv = state.conversations.find(c => c.id === convId);
  if (!conv) return;
  const menu = document.getElementById('msg-menu');
  menu.innerHTML = '';
  const items = [
    { icon:'pin', label: conv.pinned ? 'Desafixar' : 'Fixar no topo', run: () => {
        conv.pinned = !conv.pinned; persistConversations(); renderHistoryList();
        toast(conv.pinned ? 'Conversa fixada.' : 'Conversa desafixada.');
      } },
    { icon:'wand', label:'Renomear', run: () => renameConversation(convId) },
    { icon:'folder', label:'Mover para projeto…', run: () => openProjectPicker(convId) },
    { icon:'file', label:'Exportar .md', run: () => exportConversationMarkdown(conv) },
    { icon:'globe', label:'Exportar página (.html)', run: () => exportConversationPage(conv) },
    { icon:'file', label:'Exportar conversa (PDF)', run: () => exportConversationPdf(conv) },
    { icon:'close', label:'Excluir conversa', run: () => { if (confirm(`Excluir "${conv.title}"?`)) deleteConversation(convId); } },
  ];
  items.forEach(it => {
    const btn = document.createElement('button');
    btn.className = 'msg-menu-item';
    btn.innerHTML = iconHTML(it.icon) + ' ' + esc(it.label);
    btn.onclick = () => { closeMsgMenu(); it.run(); };
    menu.appendChild(btn);
  });
  document.getElementById('msg-menu-overlay').classList.add('open');
}
/* Sub-menu: escolher o projeto de uma conversa (ou criar um novo na hora) */
function openProjectPicker(convId){
  const conv = state.conversations.find(c => c.id === convId);
  if (!conv) return;
  const menu = document.getElementById('msg-menu');
  menu.innerHTML = '';
  const addItem = (label, done, run) => {
    const btn = document.createElement('button');
    btn.className = 'msg-menu-item' + (done ? ' done' : '');
    btn.innerHTML = iconHTML('folder') + ' ' + esc(label);
    btn.onclick = () => { closeMsgMenu(); run(); };
    menu.appendChild(btn);
  };
  const set = (pid) => { conv.projectId = pid; persistConversations(); renderHistoryList(); toast(pid ? 'Movida pro projeto.' : 'Removida do projeto.'); };
  addItem('Sem projeto', !conv.projectId, () => set(null));
  state.projects.forEach(p => addItem(p.name, conv.projectId === p.id, () => set(p.id)));
  addItem('＋ Novo projeto…', false, () => {
    createProject((proj) => { conv.projectId = proj.id; persistConversations(); renderHistoryList(); });
  });
  document.getElementById('msg-menu-overlay').classList.add('open');
}
function persistConversations(){
  // Anexos (base64) ficam só em memória na sessão — persistir estouraria o localStorage.
  // Ao salvar, content multimodal vira texto + nota dos anexos.
  const stripped = state.conversations.map(c => ({
    ...c,
    messages: c.messages.map(m => {
      if (Array.isArray(m.content)){
        const names = (m._att || []).join(', ');
        return { ...m, content: contentToText(m.content) + (names ? `\n[anexos enviados: ${names}]` : '') };
      }
      return m;
    })
  }));
  try{
    localStorage.setItem('vtz_conversations', JSON.stringify(stripped));
    localStorage.setItem('vtz_current_conv', state.currentConvId || '');
  }catch(err){
    // QuotaExceededError: antes falhava em silêncio e o usuário perdia conversas sem saber
    if (err.name === 'QuotaExceededError' || err.code === 22){
      state.quotaFull = true;
      toast('Armazenamento cheio — a conversa NÃO foi salva. Arquive conversas antigas em Config.', 'err');
    } else {
      toast('Erro ao salvar: ' + err.message, 'err');
    }
  }
  updateSessionPanel();
  scheduleCloudSync();
}

/* ---------- Login opcional + sync na nuvem (Firebase) ----------
   Sem login: nada muda, tudo no localStorage. Com login Google: conversas,
   agentes e skills sobem pro Firestore e descem em qualquer aparelho.
   100% grátis dentro dos limites gratuitos do Firebase. */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDcdaOggw9ZWsayQmxcmKVf81-n-w0mlT0",
  authDomain: "vtz-life-47067.firebaseapp.com",
  projectId: "vtz-life-47067",
  storageBucket: "vtz-life-47067.firebasestorage.app",
  messagingSenderId: "601252874771",
  appId: "1:601252874771:web:e4280dadb331f176d10de6",
};
let fbAuth = null, fbDb = null, cloudSyncTimer = null;
function initFirebase(){
  if (typeof firebase === 'undefined' || !firebase.initializeApp){ console.warn('Firebase não carregou.'); return false; }
  try{
    firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    fbAuth.onAuthStateChanged(onAuthChanged);
    return true;
  }catch(e){ console.warn('Firebase init falhou:', e.message); return false; }
}
function onAuthChanged(user){
  const out = document.getElementById('account-signed-out');
  const inn = document.getElementById('account-signed-in');
  const accHead = document.getElementById('acc-head');
  const accSignout = document.getElementById('acc-signout');
  const footerName = document.getElementById('footer-name');
  if (user){
    if (out) out.style.display = 'none';
    if (inn) inn.style.display = 'block';
    const em = document.getElementById('account-email'); if (em) em.textContent = user.email || user.displayName || 'conta Google';
    if (accHead) accHead.textContent = user.email || user.displayName || 'conta Google';
    if (accSignout) accSignout.style.display = 'flex';
    if (footerName) footerName.textContent = user.displayName || user.email || 'Victor Hugo';
    pullFromCloud(user.uid);
  } else {
    if (out) out.style.display = 'block';
    if (inn) inn.style.display = 'none';
    if (accHead) accHead.textContent = 'Conta local (sem login)';
    if (accSignout) accSignout.style.display = 'none';
    if (footerName) footerName.textContent = 'Victor Hugo';
  }
}
/* Menu de conta no rodapé (estilo painel de conta): abre Configurações etc. */
function setupAccountMenu(){
  const wrap = document.querySelector('.account-wrap');
  const btn = document.getElementById('account-btn');
  const menu = document.getElementById('account-menu');
  if (!wrap || !btn || !menu) return;
  const close = () => wrap.classList.remove('open');
  const items = [
    { icon:'sliders', label:'Configurações', run: () => { switchView('config'); toggleSidebar(false); } },
    { icon:'chart',   label:'Analytics',     run: () => { switchView('analytics'); toggleSidebar(false); } },
    { icon:'sun',     label:'Alternar tema', run: () => toggleTheme() },
    { icon:'download',label:'Exportar backup', run: () => exportBackup() },
    { icon:'close',   label:'Sair', danger:true, signout:true, run: () => signOutGoogle() },
  ];
  const head = document.createElement('div');
  head.className = 'acc-head'; head.id = 'acc-head';
  head.textContent = 'Conta local (sem login)';
  menu.appendChild(head);
  items.forEach(it => {
    const b = document.createElement('button');
    b.className = 'acc-item' + (it.danger ? ' danger' : '');
    if (it.signout){ b.id = 'acc-signout'; b.style.display = 'none'; }
    b.innerHTML = iconHTML(it.icon) + '<span>' + esc(it.label) + '</span>';
    b.onclick = () => { close(); it.run(); };
    menu.appendChild(b);
  });
  btn.onclick = (e) => { e.stopPropagation(); wrap.classList.toggle('open'); };
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
}
async function signInGoogle(){
  if (!fbAuth){ toast('Login indisponível (Firebase não configurado).', 'err'); return; }
  try{ await fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); toast('Conectado. Sincronizando…'); }
  catch(e){ toast('Falha no login: ' + e.message, 'err'); }
}
async function signOutGoogle(){ if (fbAuth){ await fbAuth.signOut(); toast('Desconectado. Dados continuam neste navegador.'); } }
function setSyncStatus(txt){ const el = document.getElementById('sync-status'); if (el) el.textContent = txt; }
function scheduleCloudSync(){
  if (!fbAuth?.currentUser || !fbDb) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(pushToCloud, 1500);
}
async function pushToCloud(){
  const user = fbAuth?.currentUser;
  if (!user || !fbDb) return;
  try{
    setSyncStatus('Sincronizando…');
    const payload = {
      conversations: JSON.parse(localStorage.getItem('vtz_conversations') || '[]'),
      agents: state.agents, skills: state.skills,
      globalPrompt: localStorage.getItem('vtz_global_prompt') || '',
      favorites: state.favorites,
      memories: state.memories,
      memoryGraph: state.memoryGraph,
      projects: state.projects,
      updatedAt: Date.now(),
    };
    await fbDb.collection('vtzllm_users').doc(user.uid).set(payload);
    setSyncStatus('Sincronizado ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}));
  }catch(e){ setSyncStatus('Erro no sync: ' + e.message); }
}
async function pullFromCloud(uid){
  if (!fbDb) return;
  try{
    setSyncStatus('Baixando da nuvem…');
    const doc = await fbDb.collection('vtzllm_users').doc(uid).get();
    if (!doc.exists){ await pushToCloud(); return; }
    const d = doc.data();
    if (Array.isArray(d.conversations)) localStorage.setItem('vtz_conversations', JSON.stringify(d.conversations));
    if (Array.isArray(d.agents)){ state.agents = d.agents; localStorage.setItem('vtz_agents', JSON.stringify(d.agents)); }
    if (Array.isArray(d.skills)){ state.skills = d.skills; localStorage.setItem('vtz_skills', JSON.stringify(d.skills)); }
    if (typeof d.globalPrompt === 'string') localStorage.setItem('vtz_global_prompt', d.globalPrompt);
    if (Array.isArray(d.favorites)){ state.favorites = d.favorites; localStorage.setItem('vtz_favorites', JSON.stringify(d.favorites)); }
    if (Array.isArray(d.memories)){ state.memories = d.memories; localStorage.setItem('vtz_memories', JSON.stringify(d.memories)); }
    if (d.memoryGraph && Array.isArray(d.memoryGraph.nodes)){
      state.memoryGraph = d.memoryGraph; localStorage.setItem('vtz_memory_graph', JSON.stringify(d.memoryGraph));
    } else if (Array.isArray(d.memories)){
      // nuvem antiga (só lista plana): reconstrói o grafo a partir dela
      localStorage.removeItem('vtz_memory_graph');
      state.memoryGraph = migrateMemoriesToGraph({ nodes:[], edges:[] });
    }
    // restaurar backup também atualiza a fonte única (Seção 7), se há backend
    if (backendUrl() && typeof pushMemoryToBackend === 'function') pushMemoryToBackend();
    if (Array.isArray(d.projects)){ state.projects = d.projects; localStorage.setItem('vtz_projects', JSON.stringify(d.projects)); }
    state.conversations = JSON.parse(localStorage.getItem('vtz_conversations') || '[]');
    renderProjectsBar(); renderHistoryList(); renderChat();
    setSyncStatus('Sincronizado ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}));
    toast('Dados da nuvem carregados.');
  }catch(e){ setSyncStatus('Erro ao baixar: ' + e.message); }
}

/* ---------- Diagnóstico de conexão ----------
   Testa, em ordem: chave presente → catálogo (/models) → chat não-stream → chat com stream.
   Mostra status HTTP e corpo do erro — é o que faltava pra saber por que "não responde". */
async function runDiagnostics(){
  const out = document.getElementById('diag-out');
  out.style.display = 'block';
  const log = [];
  const paint = () => { out.textContent = log.join('\n'); };
  const push = (ok, label, detail) => {
    log.push(`${ok === null ? '…' : ok ? '[OK]' : '[FALHA]'} ${label}${detail ? '\n     ' + detail : ''}`);
    paint();
  };

  log.push('Origem: ' + (location.origin || 'file:// (origin nulo)'));
  log.push('Protocolo: ' + location.protocol);
  if (location.protocol === 'file:'){
    log.push('     Aviso: em file:// alguns navegadores restringem fetch e streaming.');
    log.push('     Se falhar aqui, sirva por http (ex.: python3 -m http.server) e teste de novo.');
  }
  paint();

  // 1) chave
  if (!state.apiKey){ push(false, 'Chave da API ausente'); return; }
  push(true, `Chave presente (${state.apiKey.slice(0,8)}…, ${state.apiKey.length} chars)`);

  // 2) catálogo
  try{
    const r = await fetch(OR_BASE + '/models');
    if (!r.ok) push(false, `GET /models → HTTP ${r.status}`, (await r.text()).slice(0,160));
    else {
      const d = await r.json();
      push(true, `GET /models → ${d.data?.length ?? '?'} modelos (catálogo ao vivo)`);
    }
  }catch(e){ push(false, 'GET /models falhou', e.message + ' — provável CORS ou rede'); }

  const model = state.model === '__router__' ? (state.routerConfig.balanced || state.routerConfig.fast) : state.model;
  push(null, `Modelo em teste: ${model}`);

  // 3) chat sem streaming
  try{
    const r = await orFetch({ model, messages:[{role:'user', content:'responda apenas: ok'}], max_tokens: 5 });
    const body = await r.text();
    if (!r.ok) push(false, `POST /chat/completions (sem stream) → HTTP ${r.status}`, body.slice(0,220));
    else {
      let txt = '';
      try{ txt = JSON.parse(body).choices?.[0]?.message?.content ?? ''; }catch(_){}
      push(!!txt, `POST sem stream → HTTP 200`, txt ? `resposta: "${txt.trim().slice(0,40)}"` : 'HTTP 200 mas SEM texto: ' + body.slice(0,160));
    }
  }catch(e){ push(false, 'POST sem stream falhou', e.message); }

  // 4) chat com streaming
  try{
    const r = await orFetch({ model, messages:[{role:'user', content:'responda apenas: ok'}], max_tokens: 5, stream: true });
    if (!r.ok){ push(false, `POST com stream → HTTP ${r.status}`, (await r.text()).slice(0,220)); }
    else if (!r.body){ push(false, 'POST com stream → sem res.body', 'navegador não expõe o corpo em stream'); }
    else {
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let chunks = 0, acc = '', firstLine = '';
      const t0 = Date.now();
      while(Date.now() - t0 < 20000){
        const {done, value} = await reader.read();
        if (done) break;
        chunks++;
        const s = dec.decode(value, {stream:true});
        if (!firstLine) firstLine = s.split('\n').find(l => l.trim()) || '';
        for (const line of s.split('\n')){
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const p = t.slice(5).trim();
          if (p === '[DONE]'){ chunks = chunks; break; }
          try{ acc += JSON.parse(p).choices?.[0]?.delta?.content || ''; }catch(_){}
        }
        if (acc) break;
      }
      try{ await reader.cancel(); }catch(_){}
      push(!!acc, `POST com stream → ${chunks} chunk(s)`,
        acc ? `texto recebido: "${acc.trim().slice(0,40)}"`
            : 'nenhum texto extraído. 1a linha crua: ' + (firstLine.slice(0,140) || '(vazia)'));
    }
  }catch(e){ push(false, 'POST com stream falhou', e.message); }

  // 5) busca web (plugin do OpenRouter)
  try{
    const r = await orFetch({ model, messages:[{role:'user', content:'Qual a data de hoje segundo a web? Responda em 5 palavras.'}], max_tokens: 40, plugins:[{id:'web'}] });
    const body = await r.text();
    if (!r.ok) push(false, `Busca web → HTTP ${r.status}`, body.slice(0,200));
    else {
      let txt = '';
      try{ txt = JSON.parse(body).choices?.[0]?.message?.content ?? ''; }catch(_){}
      push(!!txt, 'Busca web (plugin :web)', txt ? `resposta: "${txt.trim().slice(0,60)}"` : 'HTTP 200 sem texto');
    }
  }catch(e){ push(false, 'Busca web falhou', e.message); }

  log.push('');
  log.push('Se "sem stream" funciona e "com stream" falha: desmarque Streaming acima.');
  log.push('Busca web custa ~US$0,02 por mensagem, à parte dos tokens.');
  paint();
}

/* ---------- Medidor de armazenamento (limite ~5MB por origem) ---------- */
function storageBytes(){
  let total = 0;
  for (const k in localStorage){
    if (Object.prototype.hasOwnProperty.call(localStorage, k)) total += (localStorage[k].length + k.length) * 2;
  }
  return total;
}
const STORAGE_LIMIT = 5 * 1024 * 1024;
