/* Pages — exporta a conversa inteira como uma página HTML bonita e autônoma. */
function exportConversationPage(conv){
  const safeName = conv.title.replace(/[^a-z0-9]/gi,'_').slice(0,40) || 'conversa';
  const body = conv.messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => {
    const who = m.role === 'user' ? 'Você' : 'VTz LLM';
    const cls = m.role === 'user' ? 'u' : 'a';
    const html = m.role === 'user' ? esc(contentToText(m.content)).replace(/\n/g,'<br>') : safeRenderMarkdown(contentToText(m.content));
    return `<div class="turn ${cls}"><div class="who">${who}</div><div class="bubble">${html}</div></div>`;
  }).join('\n');
  const date = new Date().toLocaleString('pt-BR');
  const page = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(conv.title)}</title><style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;background:#f5f4f8;color:#1a1822;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6}
@media(prefers-color-scheme:dark){body{background:#0d0c12;color:#ece9f5}.bubble{background:#161420!important;border-color:#2a2637!important}.turn.u .bubble{background:#2a2140!important}}
.wrap{max-width:760px;margin:0 auto;padding:28px 18px 60px}
h1.doc{font-size:22px;margin:0 0 4px}
.meta{color:#8b8799;font-size:12px;margin-bottom:24px}
.turn{margin:16px 0}
.who{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#7c3aed;margin-bottom:5px}
.bubble{background:#fff;border:1px solid #e7e4f0;border-radius:14px;padding:14px 16px;overflow-wrap:break-word}
.turn.u .bubble{background:#ede8fd}
.bubble h1,.bubble h2,.bubble h3{line-height:1.3;margin:.8em 0 .4em}
.bubble table{border-collapse:collapse;width:100%;margin:.7em 0;display:block;overflow-x:auto}
.bubble th,.bubble td{border:1px solid #d9d5e6;padding:7px 10px;text-align:left}
.bubble thead th,.bubble tr:first-child th{background:#7c3aed;color:#fff}
.bubble pre{background:#f0eef7;padding:10px 12px;border-radius:8px;overflow-x:auto;font-size:13px}
.bubble code{font-family:ui-monospace,monospace;font-size:.9em}
.bubble ul,.bubble ol{padding-left:1.4em}
.bubble a{color:#7c3aed}
footer{margin-top:34px;text-align:center;color:#9a96a8;font-size:11px}
</style></head><body><div class="wrap">
<h1 class="doc">${esc(conv.title)}</h1><div class="meta">Exportado do VTz LLM · ${esc(date)}</div>
${body}
<footer>Gerado pelo VTz LLM</footer>
</div></body></html>`;
  triggerDownload(`${safeName}.html`, new Blob([page], { type:'text/html' }));
  toast('Página exportada.');
}
/* Exporta a conversa inteira como PDF formatado (reusa o motor de PDF). */
function exportConversationPdf(conv){
  let md = `# ${conv.title}\n\n`;
  conv.messages.forEach(m => {
    if (m.role === 'user') md += `## Você\n${contentToText(m.content)}\n\n`;
    else if (m.role === 'assistant') md += `## VTz LLM\n${contentToText(m.content)}\n\n`;
  });
  const safeName = conv.title.replace(/[^a-z0-9]/gi,'_').slice(0,40) || 'conversa';
  downloadRichPdf(md, `${safeName}.pdf`);
}


/* ---------- Agentes (CRUD) ---------- */
/* ---------- Backup / Restore ---------- */
function exportBackup(){
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations: state.conversations,
    skills: state.skills,
    agents: state.agents,
    routerConfig: state.routerConfig,
    totalCost: state.totalCost,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vtz-llm-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}
function importBackup(file){
  const reader = new FileReader();
  reader.onload = (e) => {
    try{
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.conversations)) state.conversations = data.conversations;
      if (Array.isArray(data.skills)) state.skills = data.skills;
      if (Array.isArray(data.agents)) state.agents = data.agents;
      if (data.routerConfig) state.routerConfig = data.routerConfig;
      if (typeof data.totalCost === 'number') state.totalCost = data.totalCost;

      // Persistência primeiro — isso é o que importa de verdade e não pode falhar por causa de UI.
      persistConversations();
      persistSkills();
      persistAgents();
      localStorage.setItem('vtz_router_config', JSON.stringify(state.routerConfig));
      localStorage.setItem('vtz_or_cost', String(state.totalCost));
      updateCostBadge();

      // Re-render — cada um isolado, um erro aqui não deve mascarar que os dados já foram salvos.
      try{ ensureConversation(); renderHistoryList(); renderChat(); }catch(e){ console.error('Erro ao renderizar chat após import:', e); }
      try{ renderSkills(); }catch(e){ console.error('Erro ao renderizar skills após import:', e); }
      try{ renderAgents(); }catch(e){ console.error('Erro ao renderizar agentes após import:', e); }
      try{ populateRouterSelects(); }catch(e){ console.error('Erro ao popular selects de router após import:', e); }

      toast('Backup importado com sucesso.');
    }catch(err){
      toast('Erro ao importar backup: ' + err.message, 'err');
    }
  };
  reader.readAsText(file);
}

function persistAgents(){ localStorage.setItem('vtz_agents', JSON.stringify(state.agents)); }
