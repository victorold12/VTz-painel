/* Status dos conectores (via backend). */
async function refreshConnectorsStatus(){
  const box = document.getElementById('connectors-status');
  if (!backendUrl()){ box.innerHTML = '<p class="hint">Procurando o backend local…</p>'; await autoDetectBackend(); }
  if (!backendUrl()){ box.innerHTML = '<p class="hint">Backend não encontrado. Rode o backend (run.bat) ou configure a URL na aba Backend.</p>'; return; }
  box.innerHTML = '<p class="hint">Consultando…</p>';
  try{
    const d = await fetch(backendUrl() + '/api/connectors/status', { headers: backendHeaders() }).then(r => r.json());
    const LABEL = { notion_token:'Notion', figma_token:'Figma', google_client_id:'Google (app OAuth)' };
    const rows = Object.entries(d).map(([k, v]) =>
      `<div class="skl-item"><span class="skl-name">${esc(LABEL[k] || k)}</span><span class="skl-desc">${v ? '✅ configurado' : '⚪ sem chave'}</span></div>`);
    // Google: além de "configurado", mostra se o OAuth foi de fato concluído (conectado)
    if (d.google_client_id){
      try{
        const g = await fetch(backendUrl() + '/api/connectors/google/status', { headers: backendHeaders() }).then(r => r.json());
        rows.push(`<div class="skl-item"><span class="skl-name">Google (login)</span><span class="skl-desc">${g.connected ? '✅ conectado' : '⚠️ configurado, falta clicar em "Conectar Google"'}</span></div>`);
      }catch(_){}
    }
    box.innerHTML = rows.join('') || '<p class="hint">Nenhum conector reportado.</p>';
  }catch(e){ box.innerHTML = '<p class="hint">Falha: ' + esc(e.message) + '</p>'; }
}
/* Salva as chaves dos conectores no backend (não voltam por segurança). */
async function saveConnectorKeys(){
  const box = document.getElementById('connectors-status');
  if (!backendUrl()){ await autoDetectBackend(); }
  if (!backendUrl()){ box.innerHTML = '<p class="hint">Backend não encontrado. Ligue o backend primeiro (run.bat).</p>'; box.style.display='block'; return; }
  const payload = {};
  const g = (id) => document.getElementById(id).value;
  if (g('conn-notion') !== '') payload.notion_token = g('conn-notion').trim();
  if (g('conn-figma') !== '') payload.figma_token = g('conn-figma').trim();
  if (g('conn-gid') !== '') payload.google_client_id = g('conn-gid').trim();
  if (g('conn-gsecret') !== '') payload.google_client_secret = g('conn-gsecret').trim();
  if (!Object.keys(payload).length){ toast('Nada pra salvar — preencha ao menos um campo.', 'warn'); return; }
  try{
    const r = await fetch(backendUrl() + '/api/connectors/config', {
      method:'POST', headers: backendHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    ['conn-notion','conn-figma','conn-gid','conn-gsecret'].forEach(id => document.getElementById(id).value = '');
    toast('Chaves salvas no backend ✓');
    refreshConnectorsStatus();
  }catch(e){ toast('Falha ao salvar: ' + e.message, 'err'); }
}
/* Inicia o login OAuth do Google (abre a página de consentimento). */
async function connectGoogle(){
  if (!backendUrl()){ await autoDetectBackend(); }
  if (!backendUrl()){ toast('Ligue o backend primeiro (run.bat).', 'warn'); return; }
  try{
    const r = await fetch(backendUrl() + '/api/connectors/google/authorize', { headers: backendHeaders() });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.detail || 'Configure o Client ID/Secret e salve antes.');
    window.open(d.url, '_blank');
    toast('Abrindo login do Google… depois de autorizar, volte e clique em "Ver status".');
  }catch(e){ toast('Falha: ' + e.message, 'err'); }
}
/* ---------- Busca/uso dos conectores (Notion/Gmail/Drive) ---------- */
async function searchConnector(){
  const box = document.getElementById('conn-results');
  const source = document.getElementById('conn-source').value;
  const query = document.getElementById('conn-query').value.trim();
  if (!backendUrl()){ await autoDetectBackend(); }
  if (!backendUrl()){ box.innerHTML = '<p class="hint">Backend não encontrado. Ligue o backend primeiro.</p>'; return; }
  box.innerHTML = '<p class="hint">Buscando…</p>';
  try{
    let items = [];
    if (source === 'notion'){
      const d = await fetch(backendUrl() + '/api/connectors/notion/search', {
        method:'POST', headers: backendHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify({ query }),
      }).then(okJson);
      items = (d.results || []).map(r => ({ title: r.title, sub: r.type + (r.edited ? ' · editado ' + r.edited.slice(0,10) : ''), url: r.url,
        ctx: `Página do Notion "${r.title}"${r.url ? ' (' + r.url + ')' : ''}` }));
    } else if (source === 'gmail'){
      const d = await fetch(backendUrl() + '/api/connectors/google/gmail/messages?' + new URLSearchParams({ q: query, max_results: 10 }), { headers: backendHeaders() }).then(okJson);
      items = (d.messages || []).map(m => ({ title: m.subject, sub: (m.from || '') + (m.date ? ' · ' + m.date : ''), url: m.link,
        ctx: `E-mail — Assunto: ${m.subject}\nDe: ${m.from}\nData: ${m.date}\nTrecho: ${m.snippet}` }));
    } else if (source === 'drive'){
      const d = await fetch(backendUrl() + '/api/connectors/google/drive/files?' + new URLSearchParams({ q: query ? `name contains '${query}'` : '', page_size: 20 }), { headers: backendHeaders() }).then(okJson);
      items = (d.files || []).map(f => ({ title: f.name, sub: (f.mimeType || '').replace('application/vnd.google-apps.','') + (f.modifiedTime ? ' · ' + f.modifiedTime.slice(0,10) : ''), url: f.webViewLink,
        ctx: `Arquivo do Drive "${f.name}"${f.webViewLink ? ' (' + f.webViewLink + ')' : ''}` }));
    }
    if (!items.length){ box.innerHTML = '<p class="hint">Nada encontrado (ou o conector não está configurado/conectado).</p>'; return; }
    box.innerHTML = '';
    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'source-card';
      row.style.cssText = 'align-items:flex-start; cursor:default;';
      row.innerHTML = `<div class="src-body"><div class="src-title">${esc(it.title)}</div><div class="src-host">${esc(it.sub || '')}</div></div>`;
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex; gap:6px; flex-shrink:0;';
      if (it.url){
        const open = document.createElement('a');
        open.href = it.url; open.target = '_blank'; open.rel = 'noopener';
        open.className = 'secondary'; open.style.cssText = 'font-size:11px; padding:4px 8px; text-decoration:none;';
        open.textContent = 'Abrir';
        actions.appendChild(open);
      }
      const use = document.createElement('button');
      use.className = 'primary'; use.style.cssText = 'font-size:11px; padding:4px 8px;';
      use.textContent = 'Usar no chat';
      use.onclick = () => {
        const input = document.getElementById('chat-input');
        input.value = (input.value ? input.value + '\n\n' : '') + '[Contexto do conector]\n' + it.ctx;
        switchView('chat'); input.focus();
        toast('Contexto adicionado ao chat.');
      };
      actions.appendChild(use);
      row.appendChild(actions);
      box.appendChild(row);
    });
  }catch(e){ box.innerHTML = '<p class="hint">Falha: ' + esc(e.message) + '</p>'; }
}
function okJson(r){ return r.ok ? r.json() : r.json().then(d => { throw new Error(d.detail || ('HTTP ' + r.status)); }, () => { throw new Error('HTTP ' + r.status); }); }
/* Lista ferramentas de um servidor MCP (via backend). */
async function mcpListTools(){
  const out = document.getElementById('mcp-out');
  const url = document.getElementById('mcp-url-input').value.trim();
  out.style.display = 'block';
  if (!backendUrl()){ out.textContent = 'Procurando o backend local…'; await autoDetectBackend(); }
  if (!backendUrl()){ out.textContent = 'Backend não encontrado. Rode o backend (run.bat) ou configure a URL na aba Backend.'; return; }
  if (!url){ out.textContent = 'Cole a URL do servidor MCP acima.'; return; }
  out.textContent = 'Conectando ao MCP…';
  try{
    const r = await fetch(backendUrl() + '/api/mcp/tools', {
      method:'POST', headers: backendHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify({ server_url: url }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || ('HTTP ' + r.status));
    const tools = d.tools || [];
    out.textContent = tools.length
      ? tools.map(t => `• ${t.name}${t.description ? ' — ' + t.description : ''}`).join('\n')
      : JSON.stringify(d, null, 1);
  }catch(e){ out.textContent = 'Falha: ' + e.message; }
}
