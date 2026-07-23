/* Exporta um agente como JSON — vira o "marketplace pessoal": compartilha por arquivo. */
function exportAgent(agent){
  const clean = { vtzAgent:1, name:agent.name, desc:agent.desc, icon:agent.icon, systemPrompt:agent.systemPrompt, model:agent.model||'', photo:agent.photo||null, quickActions:agent.quickActions||[] };
  const safe = (agent.name||'agente').replace(/[^\w\-]+/g,'-').toLowerCase();
  downloadTextFile(`agente-${safe}.json`, JSON.stringify(clean, null, 2));
  toast('Agente exportado.');
}
/* Importa um agente de um arquivo .json (aceita o formato exportado ou um objeto simples). */
function importAgentFile(file){
  const fr = new FileReader();
  fr.onload = () => {
    try{
      const o = JSON.parse(fr.result);
      if (!o || (!o.systemPrompt && !o.name)) throw new Error('arquivo não parece um agente');
      const agent = {
        id: uid(),
        name: (o.name || 'Agente importado').slice(0,60),
        desc: (o.desc || '').slice(0,200),
        icon: o.icon || 'bot',
        systemPrompt: o.systemPrompt || '',
        model: o.model || '',
        photo: o.photo || null,
        quickActions: Array.isArray(o.quickActions) ? o.quickActions.filter(a => a && a.label && a.prompt) : [],
      };
      state.agents.unshift(agent);
      persistAgents();
      renderAgents();
      toast(`Agente "${agent.name}" importado.`);
    }catch(e){ toast('Falha ao importar: ' + e.message, 'err'); }
  };
  fr.onerror = () => toast('Não consegui ler o arquivo.', 'err');
  fr.readAsText(file);
}

function renderAgents(){
  const el = document.getElementById('agents-list');
  el.innerHTML = '';
  if (!state.agents.length){
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.style.padding = '8px';
    empty.textContent = 'Nenhum agente ainda. Crie um pra fixar um "modo" (system prompt) numa tarefa recorrente.';
    el.appendChild(empty);
    return;
  }
  state.agents.forEach(agent => {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.innerHTML = `
      <div class="agent-card-top">
        <div class="icon">${agent.photo ? `<img src="${agent.photo}" alt="" class="agent-photo">` : iconHTML(agent.icon)}</div>
        <div class="agent-card-actions">
          <button class="edit-agent-btn">Editar</button>
          <button class="export-agent-btn">Exportar</button>
          <button class="delete-agent-btn">Excluir</button>
        </div>
      </div>
      <div class="name">${esc(agent.name)}</div>
      <div class="desc">${esc(agent.desc)}</div>
    `;
    card.querySelector('.edit-agent-btn').onclick = (e) => { e.stopPropagation(); openAgentModal(agent); };
    card.querySelector('.export-agent-btn').onclick = (e) => { e.stopPropagation(); exportAgent(agent); };
    card.querySelector('.delete-agent-btn').onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Excluir agente "${agent.name}"?`)){
        state.agents = state.agents.filter(a => a.id !== agent.id);
        persistAgents();
        renderAgents();
      }
    };
    card.addEventListener('click', () => startAgentConversation(agent));
    el.appendChild(card);
  });
}
let agentPhotoDraft = null; // dataURL da foto em edição no modal
function updateAgentIconPreview(){
  const prev = document.getElementById('agent-icon-preview');
  if (agentPhotoDraft){
    prev.innerHTML = `<img src="${agentPhotoDraft}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    prev.innerHTML = iconHTML(document.getElementById('agent-icon-input').value);
  }
}
