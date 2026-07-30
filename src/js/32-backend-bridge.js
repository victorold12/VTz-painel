/* ============================================================
   PONTE COM O BACKEND — rotas que existiam no servidor e ninguém
   no painel chamava: /api/analytics, /api/backup, /api/models e
   /api/memory/{extract,daily,search}.

   Princípio destas telas: cada número diz DE ONDE veio. O que é do
   navegador aparece separado do que é do servidor, e quando o
   servidor avisa que a cadeia de auditoria não fecha, o aviso vai
   na tela em vez de o número aparecer como se fosse confiável.
   ============================================================ */

async function pontejson(rota, opts){
  if (!backendUrl()) throw new Error('Backend do VTz OS não configurado (Configurações → Backend).');
  const r = await fetch(backendUrl() + rota,
                        Object.assign({ headers: backendHeaders() }, opts || {}));
  if (!r.ok){
    /* O FastAPI devolve o motivo em {"detail": "..."} — mostrar a frase é o que
       faz diferença pra quem lê ("catálogo indisponível" em vez de um JSON). */
    const txt = await r.text().catch(() => '');
    let motivo = txt;
    try{ const j = JSON.parse(txt); motivo = j.detail || j.message || txt; }catch(e){}
    throw new Error(`HTTP ${r.status}${motivo ? ' — ' + String(motivo).slice(0, 200) : ''}`);
  }
  return r.json();
}

/* ============================================================
   1. ANALYTICS DO SERVIDOR (log de auditoria)
   O bloco local continua sendo o que é: contagem deste navegador.
   Este é outro: o que o Agente Local realmente executou no PC.
   ============================================================ */
let _anaDias = 7;

async function renderServerAnalytics(){
  const box = document.getElementById('srv-metrics');
  if (!box) return;
  if (!backendUrl()){
    box.innerHTML = '<p class="hint">Sem Backend VTz OS configurado. Estes números vêm do log de auditoria do servidor — ligue o backend em Configurações → Backend pra vê-los.</p>';
    return;
  }
  box.innerHTML = '<p class="hint">Carregando do servidor…</p>';
  try{
    const d = await pontejson('/api/analytics?days=' + _anaDias);
    const cartoes = [
      ['Ações no PC', d.total, ''],
      ['Negadas por você', d.negadas, d.negadas ? 'amber' : ''],
      ['Dias com atividade', (d.por_dia || []).length, 'violet'],
      ['Dispositivos', (d.agentes || []).length, 'violet'],
    ];
    let html = '<div class="metrics-grid">' + cartoes.map(([l, v, c]) =>
      `<div class="metric-card"><div class="metric-label">${esc(l)}</div>` +
      `<div class="metric-val ${c}">${esc(String(v))}</div></div>`).join('') + '</div>';

    if (d.chain_warning){
      html += `<p class="ana-alerta">⚠ ${esc(d.chain_warning)}</p>`;
    }
    if (d.note){
      html += `<p class="hint" style="margin-top:10px;">${esc(d.note)}</p>`;
    }
    const lista = (titulo, itens, nome, valor) => {
      if (!itens || !itens.length) return '';
      return `<div class="ana-bloco"><h4>${esc(titulo)}</h4>` + itens.slice(0, 8).map(i =>
        `<div class="ana-linha"><span>${esc(String(i[nome]))}</span><b>${esc(String(i[valor]))}</b></div>`
      ).join('') + '</div>';
    };
    html += '<div class="ana-cols">';
    html += lista('Por ação', d.acoes, 'label', 'total');
    html += lista('Por nível de risco', d.tiers, 'label', 'total');
    html += lista('Arquivos/alvos mais tocados', d.alvos_mais_tocados, 'nome', 'total');
    html += lista('Por dia', (d.por_dia || []).slice(-8).map(x => ({ nome: x.dia, total: x.total })), 'nome', 'total');
    html += '</div>';
    html += `<p class="hint" style="margin-top:12px;">Janela: últimos ${d.days} dia(s). Fonte: log de auditoria do backend — cada linha é uma ação que o Agente Local executou de verdade neste PC.</p>`;
    box.innerHTML = html;
  }catch(e){
    box.innerHTML = `<p class="hint">Não deu pra ler o servidor: ${esc(e.message)}</p>`;
  }
}

function setupAnalyticsPeriodo(){
  const sel = document.getElementById('ana-dias');
  if (!sel) return;
  sel.value = String(_anaDias);
  sel.onchange = () => { _anaDias = Number(sel.value) || 7; renderServerAnalytics(); };
}

/* ============================================================
   2. BACKUP DO BANCO DO SERVIDOR
   Separado do backup local de propósito: são coisas diferentes.
   O local tem as conversas (que vivem no navegador); o do servidor
   tem a memória em grafo, a camada diária e os agentes pareados.
   ============================================================ */
async function exportServerBackup(){
  const msg = document.getElementById('srv-backup-msg');
  const diz = (t, cls) => { if (msg){ msg.textContent = t; msg.className = 'hint ' + (cls || ''); } };
  try{
    diz('Baixando do servidor…');
    const d = await pontejson('/api/backup/export');
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vtz-os-servidor-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    const m = d.memory || {};
    const cadeia = d.audit_chain_ok === false
      ? ' ATENÇÃO: a cadeia de auditoria deste banco não fecha.' : '';
    diz(`Baixado: ${(m.nodes || []).length} nó(s), ${(m.edges || []).length} relação(ões), ` +
        `${(m.daily || []).length} dia(s) e ${(d.agents || []).length} dispositivo(s). ` +
        'O token de pareamento não vai no arquivo.' + cadeia, cadeia ? 'erro' : 'ok');
  }catch(err){ diz('Falhou: ' + err.message, 'erro'); }
}

async function importServerBackup(file){
  const msg = document.getElementById('srv-backup-msg');
  const diz = (t, cls) => { if (msg){ msg.textContent = t; msg.className = 'hint ' + (cls || ''); } };
  const modo = document.getElementById('srv-backup-mode')?.value || 'merge';
  if (modo === 'replace' &&
      !confirm('Substituir apaga a memória que está no servidor e coloca a do arquivo no lugar. Continuar?')){
    return;
  }
  try{
    diz('Restaurando…');
    const texto = await file.text();
    const pacote = JSON.parse(texto);
    const d = await pontejson('/api/backup/import', {
      method: 'POST',
      headers: backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ format: pacote.format, memory: pacote.memory || {}, mode: modo }),
    });
    const i = d.importados || {}, x = d.descartados || {};
    const descartou = (x.nodes || 0) + (x.edges || 0);
    diz(`Restaurado (${d.mode || modo}): ${i.nodes ?? 0} nó(s), ${i.edges ?? 0} relação(ões), ${i.daily ?? 0} dia(s)` +
        (descartou ? `; ${descartou} linha(s) descartada(s) por não bater o formato` : '') +
        '. Pareamento e auditoria não voltam por backup.', 'ok');
    _memSynced = false;
    if (typeof syncMemoryWithBackend === 'function') syncMemoryWithBackend();
  }catch(err){ diz('Falhou: ' + err.message, 'erro'); }
}

/* ============================================================
   3. MEMÓRIA: extrair fatos, camada diária e busca
   ============================================================ */
async function extrairFatosDaConversa(){
  const msg = document.getElementById('mem-acao-msg');
  const diz = (t, cls) => { if (msg){ msg.textContent = t; msg.className = 'hint ' + (cls || ''); } };
  const conv = state.conversations.find(c => c.id === state.currentConvId);
  const msgs = (conv?.messages || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-30)
    .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 4000) }));
  if (!msgs.length){ diz('Esta conversa está vazia — não há de onde extrair fato.', 'erro'); return; }
  try{
    diz('Lendo a conversa no servidor…');
    const d = await pontejson('/api/memory/extract', {
      method: 'POST',
      headers: backendHeaders({ 'Content-Type': 'application/json', 'X-OR-Key': state.apiKey || '' }),
      body: JSON.stringify({ messages: msgs }),
    });
    const ap = d.aplicados || {};
    const novos = (ap.nos_novos || []).length;
    const saiu  = (ap.nos_removidos || []).length;
    const rel   = ap.arestas_novas || 0;
    if (!d.extraidos){
      diz(`Nenhum fato durável nesta conversa (extrator: ${esc(d.modelo || '—')}). Isso é resultado normal — conversa técnica raramente diz algo permanente sobre você.`, 'ok');
    } else {
      diz(`${d.extraidos} fato(s) lido(s) → ${novos} entidade(s) nova(s), ${rel} relação(ões) nova(s)` +
          (saiu ? `, ${saiu} substituída(s)` : '') + `. Extrator: ${esc(d.modelo || '—')}.`, 'ok');
      _memSynced = false;
      if (typeof syncMemoryWithBackend === 'function') await syncMemoryWithBackend();
      if (typeof renderMemoryUI === 'function') renderMemoryUI();
    }
  }catch(err){ diz('Falhou: ' + err.message, 'erro'); }
}

async function renderDiario(){
  const box = document.getElementById('mem-diario');
  if (!box) return;
  if (!backendUrl()){ box.innerHTML = '<p class="hint">Precisa do Backend VTz OS.</p>'; return; }
  box.innerHTML = '<p class="hint">Carregando…</p>';
  try{
    const d = await pontejson('/api/memory/daily?limit=14');
    const dias = d.days || [];
    if (!dias.length){
      box.innerHTML = '<p class="hint">Nenhum dia consolidado ainda. O resumo diário é gerado a partir dos fatos extraídos.</p>';
      return;
    }
    box.innerHTML = dias.map(x =>
      `<div class="mem-dia"><div class="mem-dia-top"><b>${esc(x.day)}</b>` +
      `<span>${esc(String(x.fact_count ?? 0))} fato(s)</span></div>` +
      `<div class="mem-dia-txt">${esc(x.summary || '')}</div></div>`).join('');
  }catch(err){ box.innerHTML = `<p class="hint">Falhou: ${esc(err.message)}</p>`; }
}

async function buscarMemoria(){
  const q = document.getElementById('mem-busca')?.value.trim();
  const box = document.getElementById('mem-busca-res');
  if (!box) return;
  if (!q){ box.innerHTML = ''; return; }
  box.innerHTML = '<p class="hint">Buscando…</p>';
  try{
    const d = await pontejson('/api/memory/search?q=' + encodeURIComponent(q) + '&limit=8');
    /* O servidor diz se comparou vetores (semantic) ou termos (lexical).
       Mostrar isso é o que impede chamar contagem de palavra de busca
       semântica — quem lê sabe o que a resposta vale. */
    const selo = d.mode === 'semantic'
      ? '<span class="mem-selo ok">semântica (embeddings)</span>'
      : '<span class="mem-selo">léxica (sem provedor de embeddings — não acha sinônimo)</span>';
    const itens = d.results || [];
    box.innerHTML = selo + (d.note ? `<p class="hint">${esc(d.note)}</p>` : '') +
      (itens.length
        ? itens.map(i => `<div class="mem-res"><b>${esc(i.kind || '')}</b>` +
            `<span>${esc(i.text || i.ref || '')}</span>` +
            `<i>${typeof i.score === 'number' ? i.score.toFixed(3) : ''}</i></div>`).join('')
        : '<p class="hint">Nada encontrado.</p>');
  }catch(err){ box.innerHTML = `<p class="hint">Falhou: ${esc(err.message)}</p>`; }
}

async function reindexarMemoria(){
  const msg = document.getElementById('mem-acao-msg');
  const diz = (t, cls) => { if (msg){ msg.textContent = t; msg.className = 'hint ' + (cls || ''); } };
  try{
    diz('Reindexando…');
    const d = await pontejson('/api/memory/reindex', { method: 'POST' });
    const semantica = d.mode === 'semantic';
    diz(`Indexados ${d.nodes ?? 0} nó(s) e ${d.days ?? 0} dia(s) — busca ` +
        (semantica ? 'semântica (embeddings configurados).'
                   : 'léxica: sem EMBEDDINGS_BASE/EMBEDDINGS_MODEL no servidor, ela compara termos e não acha sinônimo.'), 'ok');
  }catch(err){ diz('Falhou: ' + err.message, 'erro'); }
}

/* ============================================================
   4. CATÁLOGO DE MODELOS PELO BACKEND
   O painel busca direto no OpenRouter. Isso funciona no navegador,
   mas quebra quando a rede bloqueia o host — e no app de PC o
   backend já tem cache de 30 min. Então: backend primeiro, direto
   como reserva. Nunca inventa preço.
   ============================================================ */
async function fetchCatalogoModelos(){
  if (backendUrl()){
    try{
      const d = await pontejson('/api/models');
      if (Array.isArray(d.models) && d.models.length){
        return { data: d.models, fonte: 'backend', aviso: d.warning || null };
      }
    }catch(e){ /* cai pro direto — o motivo aparece no teste de conexão */ }
  }
  const r = await fetch(OR_BASE + '/models');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  return { data: d.data || [], fonte: 'openrouter', aviso: null };
}

function setupBackendBridge(){
  setupAnalyticsPeriodo();
  const b1 = document.getElementById('srv-backup-export');
  if (b1) b1.onclick = exportServerBackup;
  const b2 = document.getElementById('srv-backup-import');
  const f2 = document.getElementById('srv-backup-file');
  if (b2 && f2){
    b2.onclick = () => f2.click();
    f2.addEventListener('change', e => { if (e.target.files[0]) importServerBackup(e.target.files[0]); });
  }
  const e1 = document.getElementById('mem-extrair');
  if (e1) e1.onclick = extrairFatosDaConversa;
  const e2 = document.getElementById('mem-reindex');
  if (e2) e2.onclick = reindexarMemoria;
  const e3 = document.getElementById('mem-busca-btn');
  if (e3) e3.onclick = buscarMemoria;
  const e4 = document.getElementById('mem-busca');
  if (e4) e4.addEventListener('keydown', ev => { if (ev.key === 'Enter'){ ev.preventDefault(); buscarMemoria(); } });
  const e5 = document.getElementById('mem-diario-btn');
  if (e5) e5.onclick = renderDiario;
}
