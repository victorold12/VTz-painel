/* Agente Local — pareamento, painel de dispositivos e auditoria (Seção 3/12
   do esquema em servidor/docs/SEGURANCA-AGENTE-LOCAL.md). Só fala com rotas
   que já existem no backend: /api/pair/*, /api/agents*, /api/audit. */

/* Cache do último GET /api/agents — não persiste (localStorage não faz
   sentido pra "quem tá online agora"), só serve pra detecção de capacidade
   sem precisar de um fetch novo toda hora que alguém checar. */
let _pcAgents = [];

/* Detecção de capacidade (Seção 1): true se algum agente pareado está online
   agora. Quem for desenhar uma ação de PC no chat consulta isto antes de
   habilitar o botão — hoje só o próprio painel usa, pro aviso abaixo. */
function hasOnlineAgent(){
  return _pcAgents.some(a => a.online);
}

function renderCapabilityBanner(){
  const box = document.getElementById('agente-capability-banner');
  if (!box) return;
  const online = _pcAgents.filter(a => a.online && !a.revoked);
  if (!_pcAgents.length){
    box.className = 'agente-banner warn';
    box.textContent = 'Nenhum dispositivo pareado — ações que precisam do PC (arquivo, comando) ficam indisponíveis. Pareie um Agente Local abaixo.';
  } else if (!online.length){
    box.className = 'agente-banner warn';
    box.textContent = `${_pcAgents.length} dispositivo(s) pareado(s), mas nenhum online agora — ligue o Agente Local (npm start) pra habilitar ações no PC.`;
  } else {
    box.className = 'agente-banner ok';
    box.textContent = `${online.length} dispositivo(s) online: ${online.map(a => a.name).join(', ')}. Ações no PC disponíveis.`;
  }
}

function timeAgo(unixSeconds){
  if (!unixSeconds) return 'nunca';
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} d`;
}

/* ---------- Painel de dispositivos ---------- */
async function refreshAgentsList(){
  const box = document.getElementById('pc-agents-list');
  if (!box) return;
  if (!backendUrl()){ box.innerHTML = '<p class="hint">Procurando o backend local…</p>'; await autoDetectBackend(); }
  if (!backendUrl()){
    box.innerHTML = '<p class="hint">Backend não encontrado. Rode o backend (run.bat) ou configure a URL na aba Backend.</p>';
    _pcAgents = [];
    renderCapabilityBanner();
    return;
  }
  box.innerHTML = '<p class="hint">Carregando…</p>';
  try{
    const d = await fetch(backendUrl() + '/api/agents', { headers: backendHeaders() }).then(okJson);
    _pcAgents = d.agents || [];
    renderCapabilityBanner();
    if (!_pcAgents.length){ box.innerHTML = '<p class="hint">Nenhum dispositivo pareado ainda.</p>'; return; }
    box.innerHTML = '';
    _pcAgents.forEach(a => box.appendChild(renderAgentRow(a)));
  }catch(e){
    box.innerHTML = '<p class="hint">Falha ao carregar: ' + esc(e.message) + '</p>';
  }
}

function renderAgentRow(a){
  const row = document.createElement('div');
  row.className = 'agent-row';
  const statusClass = a.revoked ? 'revoked' : (a.online ? 'online' : 'offline');
  const status = a.revoked ? 'revogado' : (a.online ? 'online' : 'offline');
  row.innerHTML = `
    <span class="agent-dot ${statusClass}">${iconHTML('dot')}</span>
    <span>
      <div class="agent-name">${esc(a.name)}</div>
      <div class="agent-meta">${esc(a.platform)} · ${status} · visto ${esc(timeAgo(a.last_seen_at))}</div>
    </span>
  `;
  if (!a.revoked){
    const actions = document.createElement('div');
    actions.className = 'agent-actions';
    const revokeBtn = document.createElement('button');
    revokeBtn.className = 'danger';
    revokeBtn.style.cssText = 'font-size:11px; padding:5px 10px;';
    revokeBtn.textContent = 'Revogar';
    revokeBtn.onclick = () => revokeAgent(a.agent_id, a.name);
    actions.appendChild(revokeBtn);
    row.appendChild(actions);
  }
  return row;
}

async function revokeAgent(agentId, name){
  if (!confirm(`Revogar "${name}"? O agente perde acesso na hora e precisa parear de novo pra voltar a funcionar.`)) return;
  try{
    const r = await fetch(backendUrl() + `/api/agents/${encodeURIComponent(agentId)}/revoke`, {
      method: 'POST', headers: backendHeaders(),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || ('HTTP ' + r.status));
    toast(`"${name}" revogado.`);
    refreshAgentsList();
  }catch(e){ toast('Falha ao revogar: ' + e.message, 'err'); }
}

/* ---------- Pareamento ---------- */
async function confirmPairing(){
  const input = document.getElementById('pair-code-input');
  const result = document.getElementById('pair-result');
  const code = input.value.trim();
  if (!code){ toast('Digite o código mostrado pelo Agente Local.', 'warn'); return; }
  if (!backendUrl()){ await autoDetectBackend(); }
  if (!backendUrl()){ toast('Backend não encontrado. Ligue o backend primeiro.', 'warn'); return; }
  result.textContent = 'Confirmando…';
  try{
    const r = await fetch(backendUrl() + '/api/pair/confirm', {
      method: 'POST', headers: backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ user_code: code }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || ('HTTP ' + r.status));
    result.textContent = `Pareado com "${d.name}" (${d.platform}). O Agente Local já pode conectar.`;
    input.value = '';
    toast('Pareamento confirmado.');
    refreshAgentsList();
  }catch(e){
    result.textContent = '';
    toast('Falha: ' + e.message, 'err');
  }
}

async function denyPairing(){
  const input = document.getElementById('pair-code-input');
  const result = document.getElementById('pair-result');
  const code = input.value.trim();
  if (!code){ toast('Digite o código pra negar.', 'warn'); return; }
  if (!backendUrl()){ await autoDetectBackend(); }
  if (!backendUrl()){ toast('Backend não encontrado.', 'warn'); return; }
  try{
    const r = await fetch(backendUrl() + '/api/pair/deny', {
      method: 'POST', headers: backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ user_code: code }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || ('HTTP ' + r.status));
    result.textContent = 'Pareamento negado.';
    input.value = '';
    toast('Negado.');
  }catch(e){ toast('Falha: ' + e.message, 'err'); }
}

/* ---------- Auditoria (o que o JARVIS fez no PC) ---------- */
const AUDIT_TIER_LABEL = { 0: 'T0', 1: 'T1', 2: 'T2', 3: 'T3' };

async function refreshAuditList(){
  const box = document.getElementById('audit-list');
  if (!box) return;
  if (!backendUrl()){ box.innerHTML = '<p class="hint">Backend não encontrado.</p>'; return; }
  box.innerHTML = '<p class="hint">Carregando…</p>';
  try{
    const d = await fetch(backendUrl() + '/api/audit?limit=25', { headers: backendHeaders() }).then(okJson);
    const entries = d.entries || [];
    if (!entries.length){ box.innerHTML = '<p class="hint">Nenhuma atividade registrada ainda.</p>'; return; }
    box.innerHTML = '';
    entries.forEach(e => box.appendChild(renderAuditRow(e)));
  }catch(e){ box.innerHTML = '<p class="hint">Falha ao carregar: ' + esc(e.message) + '</p>'; }
}

function renderAuditRow(e){
  const row = document.createElement('div');
  row.className = 'audit-row';
  const ok = e.result === 'ok';
  const tierColor = e.tier >= 3 ? 'var(--danger)' : (e.tier === 2 ? 'var(--amber)' : 'var(--text-dim)');
  row.innerHTML = `
    <span class="audit-tier" style="color:${tierColor};">${AUDIT_TIER_LABEL[e.tier] ?? '?'}</span>
    <span class="audit-status ${ok ? 'ok' : 'fail'}">${iconHTML(ok ? 'check' : 'close')}</span>
    <span>${esc(e.decision)}</span>
    <span class="audit-target">${esc((e.target || '').slice(0, 80))}</span>
    <span class="audit-when">${esc(timeAgo(e.ts))}</span>
  `;
  return row;
}
