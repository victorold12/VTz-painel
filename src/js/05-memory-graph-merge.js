/* Funde um nó no grafo (dedup por id determinístico). Devolve o id. */
function memUpsertNode(g, label, type){
  const id = memSlug(label);
  const existing = g.nodes.find(n => n.id === id);
  if (existing){
    if (type && existing.type === 'fato' && type !== 'fato') existing.type = type; // promove tipo
    return id;
  }
  g.nodes.push({ id, label: String(label).slice(0, 80), type: MEM_NODE_TYPES.includes(type) ? type : 'fato' });
  return id;
}
/* Funde uma aresta. Relações "funcionais" (uma cidade, uma profissão) SUBSTITUEM
   o alvo antigo em vez de acumular — é assim que o grafo corrige contradições. */
const MEM_FUNCTIONAL_RELATIONS = new Set(['mora em','nasceu em','trabalha como','se chama','tem idade','estuda em','usa como principal']);
function memUpsertEdge(g, srcId, relation, tgtId){
  relation = String(relation).toLowerCase().trim().slice(0, 40);
  if (srcId === tgtId) return;
  if (MEM_FUNCTIONAL_RELATIONS.has(relation)){
    // remove alvos antigos da mesma relação funcional (correção de fato) + limpa nós órfãos
    const stale = g.edges.filter(e => e.source === srcId && e.relation === relation && e.target !== tgtId);
    g.edges = g.edges.filter(e => !(e.source === srcId && e.relation === relation && e.target !== tgtId));
    for (const e of stale){
      if (!g.edges.some(x => x.source === e.target || x.target === e.target))
        g.nodes = g.nodes.filter(n => n.id !== e.target);
    }
  }
  if (g.edges.some(e => e.source === srcId && e.relation === relation && e.target === tgtId)) return;
  g.edges.push({ source: srcId, target: tgtId, relation, confidence: 0.9 });
}
async function extractMemories(conv, { silent = true } = {}){
  if (!state.apiKey || !conv) return [];
  const recent = conv.messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && !m._local)
    .slice(-16);
  if (recent.length < 2) return [];
  const transcript = recent.map(m =>
    `${m.role === 'user' ? 'Usuário' : 'IA'}: ${contentToText(m.content).slice(0, 700)}`).join('\n');
  const existing = memoryGraphToText(state.memoryGraph) || '(grafo vazio)';
  const sys = 'Você mantém a MEMÓRIA EM GRAFO de longo prazo de um usuário. A partir da conversa, extraia ENTIDADES e RELAÇÕES duráveis que valem lembrar sempre: nome, localização, profissão/contexto, preferências fixas, objetivos, projetos em andamento, decisões técnicas recorrentes, ferramentas usadas. IGNORE o efêmero, dúvidas pontuais e o que já está no grafo. '
    + 'Responda APENAS um objeto JSON: {"nodes":[{"label":"...","type":"..."}],"edges":[{"source":"label origem","target":"label destino","relation":"verbo curto pt-BR"}]}. '
    + 'O usuário é sempre o nó de label "Você" (type "pessoa"). type ∈ [pessoa,lugar,projeto,preferencia,objetivo,decisao,ferramenta,fato]. relation é um verbo curto: "mora em","prefere","trabalha como","joga","usa","quer","decidiu". '
    + 'Toda aresta referencia labels que existem em nodes ou já no grafo. Se nada novo, responda {"nodes":[],"edges":[]}.';
  const usr = `GRAFO ATUAL:\n${existing}\n\nCONVERSA RECENTE:\n${transcript}\n\nRetorne só o que é NOVO (ausente do grafo) como JSON {nodes, edges}.`;
  try{
    const res = await orFetch({
      model: MEMORY_MODEL,
      messages: [{ role:'system', content: sys }, { role:'user', content: usr }],
      max_tokens: 500, temperature: 0,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    trackUsage(data.usage, MEMORY_MODEL);
    const txt = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse((txt.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    const g = state.memoryGraph;
    const before = { n: g.nodes.length, e: g.edges.length };
    // garante o nó raiz
    if (!g.nodes.some(n => n.id === 'voce')) g.nodes.push({ id:'voce', label:'Você', type:'pessoa' });
    // mapa label->id pros nós novos (aceita "Você"/"voce" como raiz)
    const labelToId = new Map();
    for (const n of (parsed.nodes || [])){
      if (!n || !n.label) continue;
      const isSelf = memSlug(n.label) === 'voce' || /^voc[eê]$|^eu$|^usu[aá]rio$/i.test(n.label.trim());
      const id = isSelf ? 'voce' : memUpsertNode(g, n.label, n.type);
      labelToId.set(n.label.toLowerCase(), id);
    }
    const resolveId = (label) => {
      if (!label) return null;
      const l = label.toLowerCase();
      if (labelToId.has(l)) return labelToId.get(l);
      const slug = /^voc[eê]$|^eu$|^usu[aá]rio$/i.test(label.trim()) ? 'voce' : memSlug(label);
      if (g.nodes.some(n => n.id === slug)) return slug;
      return memUpsertNode(g, label, 'fato'); // alvo mencionado só na aresta
    };
    for (const e of (parsed.edges || [])){
      if (!e || !e.source || !e.target || !e.relation) continue;
      const s = resolveId(e.source), t = resolveId(e.target);
      if (s && t) memUpsertEdge(g, s, e.relation, t);
    }
    // teto: se estourar, remove os nós-fato mais antigos (mantém entidades estruturadas)
    if (g.nodes.length > MEM_MAX_NODES){
      const overflow = g.nodes.length - MEM_MAX_NODES;
      const removable = g.nodes.filter(n => n.type === 'fato' && n.id !== 'voce').slice(0, overflow);
      const rmIds = new Set(removable.map(n => n.id));
      g.nodes = g.nodes.filter(n => !rmIds.has(n.id));
      g.edges = g.edges.filter(e => !rmIds.has(e.source) && !rmIds.has(e.target));
    }
    const addedN = g.nodes.length - before.n, addedE = g.edges.length - before.e;
    if (addedN > 0 || addedE > 0){
      // sincroniza a lista plana legada (compat + backup/sync antigo)
      state.memories = memoryGraphToText(g).split('\n').map(s => s.replace(/^- /,'').trim()).filter(Boolean);
      localStorage.setItem('vtz_memories', JSON.stringify(state.memories));
      saveMemoryGraph();
      renderMemoryUI();
      if (!silent) toast(`Memória atualizada: +${addedN} entidade${addedN===1?'':'s'}, +${addedE} relaç${addedE===1?'ão':'ões'}.`);
      return [`+${addedN}n/${addedE}e`];
    }
    if (!silent) toast('Nada novo pra lembrar desta conversa.');
    return [];
  }catch(e){
    if (!silent) toast('Falha ao atualizar memória: ' + e.message, 'err');
    return [];
  }
}
/* Atualiza a UI da memória (textarea + contador) a partir do grafo atual */
function renderMemoryUI(){
  const mi = document.getElementById('memory-input');
  if (mi && document.activeElement !== mi) mi.value = memoryGraphToText(state.memoryGraph);
  const mc = document.getElementById('memory-count');
  if (mc){
    const n = state.memoryGraph.nodes.length, e = state.memoryGraph.edges.length;
    mc.textContent = n ? `${n} entidade${n>1?'s':''}, ${e} relaç${e===1?'ão':'ões'} — resumo do grafo injetado em toda conversa.` : 'Grafo de memória vazio.';
  }
}
/* Estado do composer depende da CONVERSA visível: se ela está gerando, input trava
   e o botão vira "parar" — outras conversas continuam livres pra digitar e enviar */
function updateComposerState(){
  const busy = !!state.gens[state.currentConvId];
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('send-btn');
  if (!input || !btn) return;
  input.disabled = busy;
  input.placeholder = busy ? 'Gerando resposta nesta conversa…' : 'Escreva algo...';
  btn.classList.toggle('stop', busy);
  btn.innerHTML = busy ? iconHTML('stopSq') : iconHTML('send');
  btn.setAttribute('aria-label', busy ? 'Parar geração' : 'Enviar mensagem');
}
/* Linha "Pensando..." (shimmer estilo Claude) que vira a resposta em streaming.
   Só toca no DOM se a conversa dela estiver visível — resposta de outra conversa
   nunca vaza pra tela errada. */
function createThinkingRow(conv){
  if (conv.id !== state.currentConvId){
    return { el:null, update(){}, remove(){} };
  }
  const log = document.getElementById('chat-log');
  document.getElementById('empty-state').style.display = 'none';
  log.style.display = 'flex';
  const agentAv = conv.agentId ? state.agents.find(a => a.id === conv.agentId) : null;
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.innerHTML = `<div class="msg-av ai">${agentAv?.photo ? `<img src="${agentAv.photo}" alt="">` : iconHTML('sparkle')}</div>
    <div class="msg-body"><div class="msg-sender">VTz LLM</div>
    <div class="msg assistant"><span class="thinking-label">Pensando…</span></div></div>`;
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
  const bubble = row.querySelector('.msg.assistant');
  return {
    el: row,
    // Durante o stream: render barato (escape + <br>). Markdown completo só no final,
    // via appendMessageDOM — re-parsear o texto inteiro a cada chunk era custo
    // quadrático e travava respostas longas.
    update(text){ bubble.innerHTML = esc(text).replace(/\n/g,'<br>'); log.scrollTop = log.scrollHeight; },
    remove(){ row.remove(); }
  };
}
/* ---------- Download de arquivos gerados pela IA ----------
   Qualquer bloco de código vira arquivo baixável com a extensão certa.
   Limite honesto: só arquivos de TEXTO — binário (.docx/.pdf) a API de chat não gera. */
const LANG_EXT = {
  python:'py', py:'py', javascript:'js', js:'js', typescript:'ts', ts:'ts', jsx:'jsx', tsx:'tsx',
  html:'html', css:'css', json:'json', bat:'bat', batch:'bat', cmd:'bat', powershell:'ps1', ps1:'ps1',
  bash:'sh', sh:'sh', shell:'sh', zsh:'sh', sql:'sql', java:'java', c:'c', cpp:'cpp', 'c++':'cpp',
  csharp:'cs', cs:'cs', xml:'xml', yaml:'yml', yml:'yml', markdown:'md', md:'md', text:'txt', txt:'txt',
  php:'php', ruby:'rb', rb:'rb', go:'go', golang:'go', rust:'rs', rs:'rs', kotlin:'kt', swift:'swift',
  lua:'lua', ini:'ini', toml:'toml', csv:'csv', tsv:'tsv', svg:'svg', dockerfile:'Dockerfile',
  vue:'vue', dart:'dart', r:'r', perl:'pl', diff:'diff', graphql:'graphql', proto:'proto',
  reg:'reg', registry:'reg', vbs:'vbs', vbscript:'vbs', ahk:'ahk', autohotkey:'ahk', psm1:'psm1',
};
const EXT_MIME = { html:'text/html', htm:'text/html', json:'application/json', svg:'image/svg+xml', csv:'text/csv', xml:'application/xml', js:'text/javascript', css:'text/css' };
function extFromLang(lang){ return LANG_EXT[(lang||'').toLowerCase()] || 'txt'; }
/* Nome do arquivo: se a 1ª linha do código tiver um nome (ex: "# organizador.py",
   ":: limpeza.bat", "// app.js"), usa ele; senão vtz-arquivo-N.ext */
function guessFilename(code, lang, idx){
  const first = (code.split('\n')[0] || '').trim();
  const m = first.match(/([\w][\w.\-]*\.[A-Za-z0-9]{1,12})\b/);
  if (m && !/^\d/.test(m[1])) return m[1];
  return `vtz-arquivo-${idx || 1}.${extFromLang(lang)}`;
}
function downloadTextFile(name, text){
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = (EXT_MIME[ext] || 'text/plain') + ';charset=utf-8';
  const blob = new Blob([text], { type: mime });
  triggerDownload(name, blob);
}
function triggerDownload(name, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
/* Extrai tabelas markdown (| a | b |) em matriz de linhas/colunas */
function extractMarkdownTables(md){
  const tables = [];
  const lines = md.split('\n');
  let cur = null;
  for (const ln of lines){
    const isRow = /^\s*\|.*\|\s*$/.test(ln);
    if (isRow){
      const cells = ln.trim().replace(/^\||\|$/g,'').split('|').map(c => c.trim());
      if (/^:?-{2,}:?$/.test(cells.join('').replace(/[\s|]/g,'')) || cells.every(c => /^:?-+:?$/.test(c))) continue; // separador
      (cur = cur || []).push(cells);
    } else if (cur){
      if (cur.length > 1) tables.push(cur);
      cur = null;
    }
  }
  if (cur && cur.length > 1) tables.push(cur);
  return tables;
}
/* .xlsx da 1ª tabela da resposta (ou de todas, uma aba cada) — via SheetJS */
function downloadXlsx(md, name){
  if (typeof XLSX === 'undefined'){ toast('Biblioteca de planilha não carregou (offline?).', 'err'); return; }
  const tables = extractMarkdownTables(md);
  if (!tables.length){ toast('Nenhuma tabela encontrada na resposta.', 'warn'); return; }
  const wb = XLSX.utils.book_new();
  tables.forEach((t, i) => {
    const ws = XLSX.utils.aoa_to_sheet(t);
    XLSX.utils.book_append_sheet(wb, ws, `Tabela ${i+1}`);
  });
  const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  triggerDownload(name, new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
/* .pdf da resposta (texto) — via jsPDF, com quebra de página automática */
function downloadPdf(text, name){
  const J = window.jspdf?.jsPDF || window.jsPDF;
  if (!J){ toast('Biblioteca de PDF não carregou (offline?).', 'err'); return; }
  const doc = new J({ unit:'pt', format:'a4' });
  const margin = 48, width = doc.internal.pageSize.getWidth() - margin*2;
  const pageH = doc.internal.pageSize.getHeight() - margin;
  doc.setFont('helvetica'); doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, width);
  let y = margin;
  lines.forEach(line => {
    if (y > pageH){ doc.addPage(); y = margin; }
    doc.text(line, margin, y); y += 16;
  });
  triggerDownload(name, doc.output('blob'));
}

