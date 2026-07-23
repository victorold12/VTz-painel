/* Lista de todos os comandos do painel (digitáveis no chat). Clicar cola o
   template no campo de mensagem, pronto pra completar/enviar. */
const CHAT_COMMANDS = [
  { cmd:'/status', tpl:'/status', desc:'Status da sessão (modelo, custo, msgs)' },
  { cmd:'npx skills add', tpl:'npx skills add <repo> --skill <nome>', desc:'Instala uma skill do GitHub' },
  { cmd:'/skill list', tpl:'/skill list', desc:'Lista as skills instaladas' },
  { cmd:'/skill on', tpl:'/skill on <nome>', desc:'Ativa uma skill' },
  { cmd:'/skill off', tpl:'/skill off <nome>', desc:'Desativa uma skill' },
  { cmd:'/skill remove', tpl:'/skill remove <nome>', desc:'Remove uma skill' },
];
function renderCommandList(close){
  const box = document.getElementById('tp-commands');
  if (!box) return;
  box.innerHTML = '';
  CHAT_COMMANDS.forEach(c => {
    const b = document.createElement('button');
    b.className = 'tp-cmd'; b.type = 'button';
    b.innerHTML = `<code>${esc(c.cmd)}</code><span class="tp-cmd-desc">${esc(c.desc)}</span>`;
    b.onclick = () => {
      const input = document.getElementById('chat-input');
      if (input){
        input.value = c.tpl;
        input.dispatchEvent(new Event('input'));
        input.focus();
        // posiciona o cursor no primeiro <...> pra facilitar completar
        const i = c.tpl.indexOf('<');
        if (i >= 0) input.setSelectionRange(i, c.tpl.indexOf('>', i) + 1);
      }
      if (typeof close === 'function') close();
    };
    box.appendChild(b);
  });
}

/* ---------- Sidebar colapsável (desktop) ---------- */
function toggleSidebarCollapse(){
  const collapsed = document.body.classList.toggle('sb-collapsed');
  localStorage.setItem('vtz_sb_collapsed', collapsed ? '1' : '0');
}
function initSidebarCollapse(){
  if (localStorage.getItem('vtz_sb_collapsed') === '1') document.body.classList.add('sb-collapsed');
  // rótulos pra tooltip no modo colapsado
  document.querySelectorAll('.side-nav-item').forEach(b => {
    const txt = b.textContent.trim();
    if (txt) b.setAttribute('data-label', txt);
  });
  document.getElementById('sidebar-collapse-btn')?.addEventListener('click', toggleSidebarCollapse);
}

/* ---------- Painel de sessão minimalista ---------- */
function toggleSessionPanel(){
  const collapsed = document.body.classList.toggle('sp-collapsed');
  localStorage.setItem('vtz_sp_collapsed', collapsed ? '1' : '0');
}
function initSessionPanel(){
  if (localStorage.getItem('vtz_sp_collapsed') === '1') document.body.classList.add('sp-collapsed');
  document.getElementById('sp-collapse-btn')?.addEventListener('click', toggleSessionPanel);
  document.getElementById('sp-expand-btn')?.addEventListener('click', toggleSessionPanel);
}

/* ---------- Tabs de mídia (Imagem / Vídeo) ---------- */
function initMediaTabs(){
  document.querySelectorAll('.media-tabs').forEach(group => {
    const tabs = [...group.querySelectorAll('.media-tab')];
    const glider = group.querySelector('.media-tab-glider');
    const moveGlider = (el) => {
      if (!glider || !el) return;
      glider.style.width = el.offsetWidth + 'px';
      glider.style.transform = `translateX(${el.offsetLeft - 4}px)`;
    };
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        const view = t.dataset.mediaView;
        if (view) switchView(view);
      });
    });
    // reposiciona o glider quando a aba fica visível
    group._moveGlider = moveGlider;
  });
}
function syncMediaTabs(name){
  document.querySelectorAll('.media-tabs').forEach(group => {
    const tabs = [...group.querySelectorAll('.media-tab')];
    const active = tabs.find(t => t.dataset.mediaView === name);
    tabs.forEach(t => t.classList.toggle('active', t === active));
    if (active && group._moveGlider) requestAnimationFrame(() => group._moveGlider(active));
  });
}

/* ---------- Contador de tarefas rodando (gerações ativas) ---------- */
const runningTasks = new Map(); // id -> { name, startedAt }
function addRunningTask(id, name){
  runningTasks.set(id, { name, startedAt: Date.now() });
  renderTasksChip();
}
function removeRunningTask(id){
  runningTasks.delete(id);
  renderTasksChip();
}
function renderTasksChip(){
  const chip = document.getElementById('tasks-chip');
  const label = document.getElementById('tasks-chip-label');
  const n = runningTasks.size;
  if (chip) chip.classList.toggle('active', n > 0);
  if (label) label.textContent = `Tarefas (${n})`;
  const list = document.getElementById('tasks-pop-list');
  const empty = document.getElementById('tasks-pop-empty');
  if (empty) empty.style.display = n ? 'none' : 'block';
  if (list){
    list.innerHTML = [...runningTasks.entries()].map(([id, t]) => {
      const secs = Math.round((Date.now() - t.startedAt) / 1000);
      return `<div class="task-item"><span class="task-spinner"></span>`
        + `<span class="task-name">${esc(t.name)}</span><span class="task-time">${secs}s</span></div>`;
    }).join('');
  }
}
function setupTasksChip(){
  const chip = document.getElementById('tasks-chip');
  const pop = document.getElementById('tasks-pop');
  if (!chip || !pop) return;
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    renderTasksChip();
    pop.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!pop.contains(e.target) && !chip.contains(e.target)) pop.classList.remove('open');
  });
  // atualiza os cronômetros a cada 1s enquanto houver tarefa
  setInterval(() => { if (runningTasks.size) renderTasksChip(); }, 1000);
}
function saveApiKey(key){
  if (!key) return;
  state.apiKey = key;
  localStorage.setItem('vtz_or_key', key);
  document.getElementById('api-key-input').value = '';
}

/* ---------- Conversations ---------- */
function ensureConversation(){
  if (!state.currentConvId || !state.conversations.find(c => c.id === state.currentConvId)){
    if (state.conversations.length){
      state.currentConvId = state.conversations[0].id;
    } else {
      newConversation(true);
    }
  }
}
function getCurrentConv(){
  return state.conversations.find(c => c.id === state.currentConvId);
}
function newConversation(silent){
  const conv = { id: uid(), title:'Nova conversa', messages:[], updatedAt: Date.now(), projectId: state.projectFilter || null };
  state.conversations.unshift(conv);
  state.currentConvId = conv.id;
  persistConversations();
  if (!silent){ renderHistoryList(); renderChat(); switchView('chat'); }
}
function startAgentConversation(agent){
  const conv = { id: uid(), title: agent.name, messages:[], updatedAt: Date.now(), systemPrompt: agent.systemPrompt, agentId: agent.id, model: agent.model || '' };
  state.conversations.unshift(conv);
  state.currentConvId = conv.id;
  persistConversations();
  renderHistoryList();
  renderChat();
  switchView('chat');
}
function selectConversation(id){
  state.currentConvId = id;
  persistConversations();
  renderHistoryList();
  renderChat();
  switchView('chat');
  toggleSidebar(false);
}
function deleteConversation(id){
  state.conversations = state.conversations.filter(c => c.id !== id);
  if (state.currentConvId === id){
    state.currentConvId = state.conversations[0]?.id || null;
    if (!state.currentConvId) newConversation(true);
  }
  persistConversations();
  renderHistoryList();
  renderChat();
}
function renameConversation(id){
  const conv = state.conversations.find(c => c.id === id);
  if (!conv) return;
  const modal = document.getElementById('rename-modal');
  document.getElementById('rename-input').value = conv.title;
  modal.dataset.convId = id;
  modal.style.display = 'flex';
  document.getElementById('rename-input').focus();
}
