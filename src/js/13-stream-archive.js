/* Tempo máximo sem receber nenhum byte do stream antes de abortar (evita 'Pensando…' eterno) */
let STREAM_IDLE_MS = 45000;
function updateStorageMeter(){
  const bar = document.getElementById('storage-bar');
  const label = document.getElementById('storage-label');
  if (!bar || !label) return;
  // escanear o localStorage inteiro é caro — só computa com a tela de Config visível
  const cfgView = document.getElementById('config-view');
  if (!cfgView || !cfgView.classList.contains('active')) return;
  const used = storageBytes();
  const pct = Math.min(100, (used / STORAGE_LIMIT) * 100);
  bar.style.width = pct.toFixed(1) + '%';
  bar.classList.toggle('warn', pct >= 70 && pct < 90);
  bar.classList.toggle('danger', pct >= 90);
  label.textContent = `${(used/1048576).toFixed(2)} MB de ~5 MB (${pct.toFixed(0)}%)`;
  const warn = document.getElementById('storage-warning');
  if (warn) warn.style.display = pct >= 70 ? 'block' : 'none';
}
/* Arquiva: remove as conversas mais antigas mantendo as N mais recentes + as fixadas */
function archiveOldConversations(keep = 15){
  const pinned = state.conversations.filter(c => c.pinned);
  const rest = state.conversations.filter(c => !c.pinned).sort((a,b) => b.updatedAt - a.updatedAt);
  const removed = rest.length - keep;
  if (removed <= 0){ toast('Nada a arquivar — você tem poucas conversas.', 'warn'); return; }
  state.conversations = [...pinned, ...rest.slice(0, keep)];
  if (!state.conversations.some(c => c.id === state.currentConvId)) state.currentConvId = state.conversations[0]?.id || null;
  state.quotaFull = false;
  persistConversations();
  renderHistoryList();
  renderChat();
  toast(`${removed} conversa(s) antiga(s) removida(s).`);
}
function dateBucket(ts){
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return days + ' dias atrás';
  if (days < 30) return Math.floor(days/7) + ' semanas atrás';
  return Math.floor(days/30) + ' meses atrás';
}
/* ---------- Projetos / Pastas de conversa ---------- */
const PROJECT_COLORS = ['#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#a855f7'];
function persistProjects(){ localStorage.setItem('vtz_projects', JSON.stringify(state.projects)); scheduleCloudSync?.(); }
let projectModalOnSave = null;
function openProjectModal(existing, onSave){
  document.getElementById('project-modal-title').textContent = existing ? 'Editar Projeto' : 'Novo Projeto';
  document.getElementById('project-name-input').value = existing?.name || '';
  document.getElementById('project-prompt-input').value = existing?.systemPrompt || '';
  document.getElementById('project-knowledge-input').value = existing?.knowledge || '';
  document.getElementById('project-modal').dataset.editId = existing?.id || '';
  projectModalOnSave = onSave || null;
  document.getElementById('project-modal').style.display = 'flex';
  document.getElementById('project-name-input').focus();
}
function closeProjectModal(){ document.getElementById('project-modal').style.display = 'none'; projectModalOnSave = null; }
function saveProjectFromModal(){
  const name = document.getElementById('project-name-input').value.trim();
  if (!name) return;
  const sp = document.getElementById('project-prompt-input').value.trim();
  const kn = document.getElementById('project-knowledge-input').value.trim();
  const editId = document.getElementById('project-modal').dataset.editId;
  let proj;
  if (editId){
    proj = state.projects.find(x => x.id === editId);
    if (!proj) return;
    proj.name = name.slice(0,40); proj.systemPrompt = sp; proj.knowledge = kn;
  } else {
    proj = { id: uid(), name: name.slice(0,40), color: PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length], systemPrompt: sp, knowledge: kn };
    state.projects.push(proj);
  }
  persistProjects();
  renderProjectsBar(); renderHistoryList();
  toast(editId ? 'Projeto atualizado.' : `Projeto "${proj.name}" criado.`);
  const cb = projectModalOnSave;
  closeProjectModal();
  if (cb) cb(proj);
}
function createProject(onSave){ openProjectModal(null, onSave); }
function editProject(id){
  const p = state.projects.find(x => x.id === id); if (!p) return;
  openProjectModal(p);
}
function deleteProject(id){
  const p = state.projects.find(x => x.id === id); if (!p) return;
  if (!confirm(`Excluir o projeto "${p.name}"? As conversas dele voltam pra "Todos", não são apagadas.`)) return;
  state.projects = state.projects.filter(x => x.id !== id);
  state.conversations.forEach(c => { if (c.projectId === id) c.projectId = null; });
  if (state.projectFilter === id){ state.projectFilter = ''; localStorage.setItem('vtz_project_filter',''); }
  persistProjects(); persistConversations();
  renderProjectsBar(); renderHistoryList();
}
function setProjectFilter(id){
  state.projectFilter = id; localStorage.setItem('vtz_project_filter', id);
  renderProjectsBar(); renderHistoryList();
}
function renderProjectsBar(){
  const bar = document.getElementById('projects-bar');
  if (!bar) return;
  bar.innerHTML = '';
  const mk = (label, id, color) => {
    const c = document.createElement('span');
    c.className = 'proj-chip' + (state.projectFilter === id ? ' active' : '');
    if (color) c.innerHTML = `<span class="pc-dot" style="background:${color}"></span>`;
    c.appendChild(document.createTextNode(label));
    c.onclick = () => setProjectFilter(id);
    if (id){ c.oncontextmenu = (e) => { e.preventDefault(); deleteProject(id); }; c.title = 'Clique para filtrar · clique-direito/segure para excluir'; }
    return c;
  };
  bar.appendChild(mk('Todos', '', null));
  state.projects.forEach(p => bar.appendChild(mk(p.name, p.id, p.color)));
  const add = document.createElement('span');
  add.className = 'proj-chip add';
  add.textContent = '+ Projeto';
  add.onclick = () => createProject((proj) => {
    state.projectFilter = proj.id; localStorage.setItem('vtz_project_filter', proj.id);
    renderProjectsBar(); renderHistoryList();
  });
  bar.appendChild(add);
  // botão de editar o projeto atualmente filtrado (nome, prompt e conhecimento)
  if (state.projectFilter){
    const edit = document.createElement('span');
    edit.className = 'proj-chip add';
    edit.textContent = '⚙ Editar';
    edit.title = 'Editar nome, instrução e conhecimento deste projeto';
    edit.onclick = () => editProject(state.projectFilter);
    bar.appendChild(edit);
  }
}
function renderHistoryList(){
  const query = (document.getElementById('history-search-input')?.value || '').trim().toLowerCase();
  const el = document.getElementById('history-list');
  el.innerHTML = '';
  let sorted = [...state.conversations].sort((a,b) => b.updatedAt - a.updatedAt);
  if (state.projectFilter) sorted = sorted.filter(c => c.projectId === state.projectFilter);
  if (query){
    sorted = sorted.filter(conv =>
      conv.title.toLowerCase().includes(query) ||
      conv.messages.some(m => contentToText(m.content||'').toLowerCase().includes(query))
    );
  }
  if (!sorted.length){
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.style.padding = '10px';
    empty.textContent = query ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.';
    el.appendChild(empty);
    return;
  }
  sorted = [...sorted.filter(c => c.pinned), ...sorted.filter(c => !c.pinned)];
  let lastBucket = null;
  sorted.forEach(conv => {
    const bucket = conv.pinned ? 'Fixadas' : dateBucket(conv.updatedAt);
    if (bucket !== lastBucket){
      const label = document.createElement('div');
      label.className = 'history-group-label';
      label.textContent = bucket;
      el.appendChild(label);
      lastBucket = bucket;
    }
    const item = document.createElement('div');
    item.className = 'history-item' + (conv.id === state.currentConvId ? ' active' : '');
    const titleSpan = document.createElement('span');
    titleSpan.className = 'title';
    if (conv.agentId){
      const iconSpan = document.createElement('span');
      iconSpan.innerHTML = iconHTML('bot');
      titleSpan.appendChild(iconSpan);
    }
    if (conv.pinned){
      const pinSpan = document.createElement('span');
      pinSpan.innerHTML = iconHTML('pin');
      pinSpan.style.opacity = '.65';
      titleSpan.appendChild(pinSpan);
    }
    titleSpan.appendChild(document.createTextNode(conv.title));
    titleSpan.onclick = () => selectConversation(conv.id);
    const menu = document.createElement('span');
    menu.className = 'menu-dot';
    menu.textContent = '⋯';
    menu.onclick = (e) => {
      e.stopPropagation();
      openConvMenu(conv.id);
    };
    item.appendChild(titleSpan);
    item.appendChild(menu);
    el.appendChild(item);
  });
}
function exportConversationMarkdown(conv){
  let md = `# ${conv.title}\n\n`;
  conv.messages.forEach(m => {
    if (m.role === 'user') md += `**Você:**\n${contentToText(m.content)}\n\n`;
    else if (m.role === 'assistant') md += `**Assistente:**\n${contentToText(m.content)}\n\n`;
  });
  const blob = new Blob([md], {type:'text/markdown'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${conv.title.replace(/[^a-z0-9]/gi,'_').slice(0,40) || 'conversa'}.md`;
  a.click();
}
