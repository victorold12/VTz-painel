/* Redimensiona a foto pra 96px (dataURL pequeno — cabe no localStorage) */
function fileToAvatar(file){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Falha ao ler a imagem'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.onload = () => {
        const s = 96, c = document.createElement('canvas');
        c.width = s; c.height = s;
        const x = c.getContext('2d');
        const r = Math.max(s/img.width, s/img.height);
        const w = img.width*r, h = img.height*r;
        x.drawImage(img, (s-w)/2, (s-h)/2, w, h);
        resolve(c.toDataURL('image/jpeg', .82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function openAgentModal(existing){
  document.getElementById('agent-modal-title').textContent = existing ? 'Editar Agente' : 'Novo Agente';
  document.getElementById('agent-icon-input').value = (existing?.icon && ICONS[existing.icon]) ? existing.icon : 'bot';
  document.getElementById('agent-name-input').value = existing?.name || '';
  document.getElementById('agent-desc-input').value = existing?.desc || '';
  document.getElementById('agent-prompt-input').value = existing?.systemPrompt || '';
  document.getElementById('agent-actions-input').value = (existing?.quickActions || []).map(a => `${a.label} | ${a.prompt}`).join('\n');
  document.getElementById('agent-modal').dataset.editId = existing?.id || '';
  agentPhotoDraft = existing?.photo || null;
  const sel = document.getElementById('agent-model-select');
  sel.innerHTML = '<option value="">Padrão do app</option><option value="__router__">RouteLLM (automático)</option><option value="__router_free__">RouteLLM Free (só grátis)</option><option value="__fusion__">Fusion (2 IAs em paralelo)</option>';
  state.models.filter(m => !isImageModel(m)).forEach(m => {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = m.name || m.id;
    sel.appendChild(o);
  });
  sel.value = existing?.model || '';
  updateAgentIconPreview();
  document.getElementById('agent-modal').style.display = 'flex';
}
function closeAgentModal(){ document.getElementById('agent-modal').style.display = 'none'; }
function saveAgentFromModal(){
  const icon = document.getElementById('agent-icon-input').value || 'bot';
  const name = document.getElementById('agent-name-input').value.trim();
  const desc = document.getElementById('agent-desc-input').value.trim();
  const systemPrompt = document.getElementById('agent-prompt-input').value.trim();
  if (!name || !systemPrompt) return;
  const model = document.getElementById('agent-model-select').value || '';
  const quickActions = document.getElementById('agent-actions-input').value.split('\n')
    .map(l => { const i = l.indexOf('|'); if (i < 0) return null; const label = l.slice(0,i).trim(); const prompt = l.slice(i+1).trim(); return (label && prompt) ? { label, prompt } : null; })
    .filter(Boolean);
  const editId = document.getElementById('agent-modal').dataset.editId;
  if (editId){
    const a = state.agents.find(x => x.id === editId);
    if (a){ a.icon=icon; a.name=name; a.desc=desc; a.systemPrompt=systemPrompt; a.model=model; a.photo=agentPhotoDraft; a.quickActions=quickActions; }
  } else {
    state.agents.push({ id: uid(), icon, name, desc, systemPrompt, model, photo: agentPhotoDraft, quickActions });
  }
  persistAgents();
  renderAgents();
  closeAgentModal();
}

/* ---------- Skills (CRUD) ---------- */
function persistSkills(){ localStorage.setItem('vtz_skills', JSON.stringify(state.skills)); }

function renderSkills(){
  const el = document.getElementById('skills-list');
  el.innerHTML = '';
  if (!state.skills.length){
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.style.padding = '8px';
    empty.textContent = 'Nenhuma skill ainda. Crie uma pra injetar instruções automaticamente quando a conversa tocar no assunto.';
    el.appendChild(empty);
    return;
  }
  state.skills.forEach(s => {
    const card = document.createElement('div');
    card.className = 'skill-card';
    const keywords = (s.trigger||'').split(',').map(k=>k.trim()).filter(Boolean);
    card.innerHTML = `
      <div class="skill-card-top">
        <span class="name">${esc(s.name)}</span>
        <label class="switch">
          <input type="checkbox" ${s.active?'checked':''}>
          <span class="track"></span>
        </label>
      </div>
      <div class="trigger-pills">${keywords.length ? keywords.map(k=>`<span class="pill">${esc(k)}</span>`).join('') : '<span class="hint">sem trigger — só manual</span>'}</div>
      <div class="instructions-preview">${esc(s.instructions)}</div>
      <div class="skill-card-actions">
        <button class="edit-btn">Editar</button>
        <button class="delete-btn">Excluir</button>
      </div>
    `;
    card.querySelector('input[type=checkbox]').onchange = (e) => { s.active = e.target.checked; persistSkills(); };
    card.querySelector('.edit-btn').onclick = () => openSkillModal(s);
    card.querySelector('.delete-btn').onclick = () => {
      if (confirm(`Excluir skill "${s.name}"?`)){
        state.skills = state.skills.filter(x=>x.id!==s.id);
        persistSkills();
        renderSkills();
      }
    };
    el.appendChild(card);
  });
}
function openSkillModal(existing){
  document.getElementById('skill-modal-title').textContent = existing ? 'Editar Skill' : 'Nova Skill';
  document.getElementById('skill-name-input').value = existing?.name || '';
  document.getElementById('skill-trigger-input').value = existing?.trigger || '';
  document.getElementById('skill-instructions-input').value = existing?.instructions || '';
  document.getElementById('skill-modal').dataset.editId = existing?.id || '';
  document.getElementById('skill-modal').style.display = 'flex';
}
function closeSkillModal(){ document.getElementById('skill-modal').style.display = 'none'; }
function saveSkillFromModal(){
  const name = document.getElementById('skill-name-input').value.trim();
  const trigger = document.getElementById('skill-trigger-input').value.trim();
  const instructions = document.getElementById('skill-instructions-input').value.trim();
  if (!name || !instructions) return;
  const editId = document.getElementById('skill-modal').dataset.editId;
  if (editId){
    const s = state.skills.find(x=>x.id===editId);
    if (s){ s.name=name; s.trigger=trigger; s.instructions=instructions; }
  } else {
    state.skills.push({ id: uid(), name, trigger, instructions, active:false });
  }
  persistSkills();
  renderSkills();
  closeSkillModal();
}
function buildSystemPrompt(conv){
  const parts = [];
  const globalP = (localStorage.getItem('vtz_global_prompt') || '').trim();
  if (globalP) parts.push(globalP);
  // memória em grafo: resume só o subgrafo relevante pra conversa atual (barato + focado)
  if (state.memoryGraph && state.memoryGraph.nodes.length){
    const focus = conv.messages.filter(m => m.role === 'user' && !m._local)
      .slice(-3).map(m => contentToText(m.content)).join(' ');
    const memText = memoryGraphToText(state.memoryGraph, { focusText: focus, maxNodes: 30 });
    if (memText) parts.push('[Memória sobre o usuário — leve em conta sempre, sem repetir de volta a menos que perguntado]\n' + memText);
  }
  const proj = conv.projectId && state.projects.find(p => p.id === conv.projectId);
  if (proj){
    if (proj.systemPrompt) parts.push(`[Projeto: ${proj.name}]\n${proj.systemPrompt}`);
    if (proj.knowledge) parts.push(`[Conhecimento do projeto "${proj.name}" — use como contexto de referência]\n${proj.knowledge}`);
  }
  if (conv.systemPrompt) parts.push(conv.systemPrompt);
  if (state.webSearch && state.searchFocus && SEARCH_FOCUS[state.searchFocus]){
    parts.push(`[Foco da busca web] Ao pesquisar, ${SEARCH_FOCUS[state.searchFocus].hint}.`);
  }
  // roster leve: o modelo sempre sabe QUAIS skills existem (mesmo sem ativar),
  // pra responder "quais skills eu tenho?" sem depender do histórico de comandos.
  if (state.skills.length){
    parts.push('[Skills instaladas neste painel]\n' + state.skills.map(s =>
      `- ${s.name}${s.active ? ' (ativa)' : ''}${s._desc ? ' — ' + s._desc : ''}`).join('\n'));
  }
  const lastUser = [...conv.messages].reverse().find(m => m.role === 'user');
  const lastText = contentToText(lastUser?.content || '').toLowerCase();
  state.skills.forEach(s => {
    const keywords = (s.trigger||'').split(',').map(k=>k.trim().toLowerCase()).filter(Boolean);
    const autoMatch = keywords.some(k => k && lastText.includes(k));
    if (s.active || autoMatch) parts.push(`[Skill: ${s.name}]\n${s.instructions}`);
  });
  return parts.length ? parts.join('\n\n---\n\n') : null;
}

/* ---------- Models ---------- */
