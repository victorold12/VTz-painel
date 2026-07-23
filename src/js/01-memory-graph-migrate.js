/* Migra a lista plana antiga (vtz_memories) pro formato de grafo, uma única vez.
   Se o grafo já tem nós, devolve ele intacto. Caso contrário, transforma cada
   frase antiga num nó "fato" ligado a um nó raiz "Você" — sem perder nada. */
function migrateMemoriesToGraph(stored){
  const g = stored && Array.isArray(stored.nodes) ? stored : { nodes:[], edges:[] };
  if (g.nodes.length) return g;
  const legacy = JSON.parse(localStorage.getItem('vtz_memories') || '[]');
  if (!legacy.length) return g;
  g.nodes.push({ id:'voce', label:'Você', type:'pessoa' });
  for (const fact of legacy){
    const id = 'fato_' + memSlug(fact);
    if (g.nodes.some(n => n.id === id)) continue;
    g.nodes.push({ id, label: String(fact), type:'fato' });
    g.edges.push({ source:'voce', target:id, relation:'sabe-se que', confidence:0.85 });
  }
  localStorage.setItem('vtz_memory_graph', JSON.stringify(g));
  return g;
}
let _memPushTimer = null;
function saveMemoryGraph(){
  localStorage.setItem('vtz_memory_graph', JSON.stringify(state.memoryGraph));
  // Backend é a fonte única da memória (Seção 7). Com backend configurado, o
  // localStorage vira só cache descartável e o grafo é empurrado pra lá.
  // Debounce: uma extração/edição mexe em vários nós/arestas de uma vez.
  if (backendUrl()){
    clearTimeout(_memPushTimer);
    _memPushTimer = setTimeout(pushMemoryToBackend, 800);
  }
}
async function pushMemoryToBackend(){
  if (!backendUrl()) return;
  try{
    await fetch(backendUrl() + '/api/memory', {
      method:'PUT', headers: backendHeaders({ 'Content-Type':'application/json' }),
      body: JSON.stringify({ nodes: state.memoryGraph.nodes, edges: state.memoryGraph.edges }),
    });
  }catch(_){ /* offline: o cache local já guardou; sobe na próxima escrita */ }
}
/* Puxa o grafo do backend (fonte única). Se o backend já tem grafo, ele VENCE e
   substitui o cache local. Se o backend está vazio mas há grafo local, migra
   (empurra o local pra cima) — uma vez, no 1º backend configurado da sessão. */
let _memSynced = false;
async function syncMemoryWithBackend(){
  if (!backendUrl() || _memSynced) return;
  try{
    const d = await fetch(backendUrl() + '/api/memory', { headers: backendHeaders() }).then(okJson);
    const remote = { nodes: d.nodes || [], edges: d.edges || [] };
    if (remote.nodes.length){
      state.memoryGraph = remote;
      localStorage.setItem('vtz_memory_graph', JSON.stringify(remote));
      renderMemoryUI();
    } else if (state.memoryGraph.nodes.length){
      await pushMemoryToBackend(); // migra o que já existia local pro backend
    }
    _memSynced = true;
  }catch(_){ /* backend fora do ar: segue com o cache local, tenta de novo depois */ }
}
/* Resume o grafo (ou um subgrafo relevante) em texto natural pro system prompt.
   Barato: agrupa por nó de origem e lista as relações numa linha por entidade.
   `focusText` (opcional) prioriza os nós cujo rótulo casa com a conversa atual. */
function memoryGraphToText(g, { focusText = '', maxNodes = 40 } = {}){
  if (!g || !g.nodes.length) return '';
  const byId = new Map(g.nodes.map(n => [n.id, n]));
  // relevância: se há foco, pontua nós cujo rótulo aparece no texto da conversa
  let nodes = g.nodes;
  if (focusText){
    const hay = focusText.toLowerCase();
    const scored = g.nodes.map(n => {
      const words = n.label.toLowerCase().split(/[^a-z0-9à-ú]+/).filter(w => w.length > 3);
      const hits = words.filter(w => hay.includes(w)).length;
      return { n, hits };
    });
    // mantém sempre a pessoa raiz + os mais relevantes; se ninguém casar, usa todos
    const anyHit = scored.some(s => s.hits > 0);
    if (anyHit){
      nodes = scored.filter(s => s.hits > 0 || s.n.type === 'pessoa')
        .sort((a,b) => b.hits - a.hits).map(s => s.n);
    }
  }
  nodes = nodes.slice(0, maxNodes);
  const keep = new Set(nodes.map(n => n.id));
  const lines = [];
  for (const n of nodes){
    const rels = g.edges.filter(e => e.source === n.id && keep.has(e.target))
      .map(e => `${e.relation} ${byId.get(e.target)?.label || e.target}`);
    if (rels.length) lines.push(`- ${n.label}: ${rels.join('; ')}.`);
    else if (n.type === 'fato' || !g.edges.some(e => e.target === n.id)) lines.push(`- ${n.label}.`);
  }
  return lines.join('\n');
}


const state = {
  apiKey: localStorage.getItem('vtz_or_key') || '',
  model: localStorage.getItem('vtz_or_model') || '',
  models: [],
  conversations: JSON.parse(localStorage.getItem('vtz_conversations') || '[]'),
  currentConvId: localStorage.getItem('vtz_current_conv') || null,
  totalCost: parseFloat(localStorage.getItem('vtz_or_cost') || '0'),
  imageModels: [],
  toolsEnabled: false,
  pickerTab: 'all',
  routerConfig: JSON.parse(localStorage.getItem('vtz_router_config') || 'null') || {fast:'', balanced:'', power:''},
  skills: JSON.parse(localStorage.getItem('vtz_skills') || 'null') || [],
  agents: JSON.parse(localStorage.getItem('vtz_agents') || 'null') || [],
  favorites: JSON.parse(localStorage.getItem('vtz_favorites') || '[]'),
  usdToBrl: parseFloat(localStorage.getItem('vtz_usd_brl') || '5.50'),
  theme: localStorage.getItem('vtz_theme') || 'dark',
  pickerSorts: [], // até 2 presets combináveis, em ordem de prioridade (1º = primário, 2º = desempate)
  pendingAttachments: [],
  ctxWindow: parseInt(localStorage.getItem('vtz_ctx_window') || '24', 10),
  streamOn: localStorage.getItem('vtz_stream') !== '0',
  perfMode: localStorage.getItem('vtz_perf') === '1',
  webSearch: false, // busca web por sessão — off por padrão (custa ~$0,02/msg)
  gens: {}, // convId -> AbortController (gerações ativas, uma por conversa)
  templates: JSON.parse(localStorage.getItem('vtz_templates') || 'null') || [],
  costByModel: JSON.parse(localStorage.getItem('vtz_cost_by_model') || '{}'),
  tagFilter: '',
  soundOn: localStorage.getItem('vtz_sound') === '1',
  memories: JSON.parse(localStorage.getItem('vtz_memories') || '[]'), // backward compat: flat facts (deprecated, migrated to memoryGraph)
  memoryGraph: migrateMemoriesToGraph(JSON.parse(localStorage.getItem('vtz_memory_graph') || '{"nodes":[],"edges":[]}')),
  autoMemory: localStorage.getItem('vtz_auto_memory') !== '0',          // extrai fatos duráveis sozinha (padrão: ligado)
  projects: JSON.parse(localStorage.getItem('vtz_projects') || '[]'), // pastas de conversa
  projectFilter: localStorage.getItem('vtz_project_filter') || '',      // '' = todos
  searchFocus: localStorage.getItem('vtz_search_focus') || '',          // foco da busca web
  backendUrl: (localStorage.getItem('vtz_backend_url') || '').replace(/\/+$/, ''), // VTz OS backend (opcional)
  backendToken: localStorage.getItem('vtz_backend_token') || '', // token de acesso, se o backend exigir
  replicateKey: localStorage.getItem('vtz_replicate_key') || '', // chave do Replicate (geração de vídeo)
};
function backendUrl(){ return state.backendUrl || ''; }
