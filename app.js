/* =========================================================
   VTZ PANEL — OpenRouter chat/image/tool-use client
   Roda 100% client-side. Sem backend próprio.
   Ponte VTZ OS (pywebview) para tools pesadas: ver TOOLS abaixo.
   ========================================================= */

const OR_BASE = 'https://openrouter.ai/api/v1';
const SITE_TITLE = 'VTz LLM';

function uid(){ return 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2,8); }

/* ---------- Ícones SVG inline (sem CDN externo — mesma lógica de resiliência do resto do app) ---------- */
const ICONS = {
  menu: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>',
  chevronDown: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  sparkle: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.8L20 10l-6.1 2.2L12 18l-1.9-5.8L4 10l6.1-2.2z"/></svg>',
  chat: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="4"/><polygon points="8 17 8 21 12 17" fill="currentColor" stroke="none"/></svg>',
  bot: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none"/><line x1="12" y1="8" x2="12" y2="4"/><circle cx="12" cy="3" r="1" fill="currentColor" stroke="none"/></svg>',
  image: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  zap: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  sliders: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/></svg>',
  mic: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
  send: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
  search: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  shuffle: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
  info: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/></svg>',
  bank: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="21" x2="21" y2="21"/><line x1="5" y1="21" x2="5" y2="10"/><line x1="9" y1="21" x2="9" y2="10"/><line x1="15" y1="21" x2="15" y2="10"/><line x1="19" y1="21" x2="19" y2="10"/><polygon points="12 3 21 9 3 9"/></svg>',
  cpu: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="6" width="12" height="12" rx="2"/><line x1="9" y1="2" x2="9" y2="6"/><line x1="15" y1="2" x2="15" y2="6"/><line x1="9" y1="18" x2="9" y2="22"/><line x1="15" y1="18" x2="15" y2="22"/><line x1="2" y1="9" x2="6" y2="9"/><line x1="2" y1="15" x2="6" y2="15"/><line x1="18" y1="9" x2="22" y2="9"/><line x1="18" y1="15" x2="22" y2="15"/></svg>',
  gamepad: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="12" rx="6"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="13" r="1" fill="currentColor" stroke="none"/></svg>',
  dumbbell: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="18" y2="12"/><rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/><rect x="5" y="10" width="2" height="4" fill="currentColor" stroke="none"/><rect x="17" y="10" width="2" height="4" fill="currentColor" stroke="none"/></svg>',
  sun: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="7" y2="7"/><line x1="17" y1="17" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="7" y2="17"/><line x1="17" y1="7" x2="19.1" y2="4.9"/></svg>',
  moon: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  chart: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="20" x2="5" y2="12"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="19" y1="20" x2="19" y2="9"/></svg>',
  copy: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  more: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  refresh: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>',
  wand: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L7 22l-5-5z"/><line x1="14" y1="7" x2="17" y2="10"/><line x1="19" y1="2" x2="19" y2="4"/><line x1="22" y1="5" x2="20" y2="5"/></svg>',
  thumbUp: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"/></svg>',
  thumbDown: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z"/></svg>',
  selectText: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M13 13l7 7"/><path d="M17 17l3 3 1-4-4 1z" fill="currentColor" stroke="none"/></svg>',
  paperclip: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  close: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  file: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
  stopSq: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  pin: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l1 7 2 2H6l2-2z"/></svg>',
  folder: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  columns: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="8" height="16" rx="2"/><rect x="13" y="4" width="8" height="16" rx="2"/></svg>',
  expand: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  edit: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
  download: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  globe: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  doc: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
  volume: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  play: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
  brain: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 2 3 3 0 0 0 3-1V4a3 3 0 0 0-3-1z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 5 3 3 0 0 1-4 2 3 3 0 0 1-3-1"/></svg>',
  upload: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
};
function iconHTML(name){ return ICONS[name] || ICONS.bot; }
/* migra ícones antigos em emoji (versões anteriores do painel) pros novos ícones SVG */
const LEGACY_EMOJI_TO_ICON = {'🏛️':'bank','🧠':'cpu','🎮':'gamepad','💪':'dumbbell','🧩':'zap','🤖':'bot'};

/* ---------- Memória em GRAFO (evolução da lista plana) ----------
   Em vez de guardar frases soltas, guardamos um pequeno grafo de conhecimento:
     nós  = entidades/conceitos sobre o usuário (pessoa, lugar, projeto, preferência, decisão, fato)
     arestas = relações entre eles (mora em, prefere, trabalha com, decidiu, etc.)
   Vantagem: sem duplicar/contradizer fatos, e ao montar o prompt resumimos só o
   subgrafo relevante — mais estruturado e mais barato que despejar 60 frases toda vez. */
const MEM_NODE_TYPES = ['pessoa','lugar','projeto','preferencia','objetivo','decisao','ferramenta','fato'];
/* id determinístico e estável a partir do rótulo — mesmo rótulo => mesmo id (dedup natural) */
function memSlug(label){
  return String(label).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')   // tira acento
    .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0, 48) || 'no';
}
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
function saveMemoryGraph(){
  localStorage.setItem('vtz_memory_graph', JSON.stringify(state.memoryGraph));
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
/* Monta headers pra chamadas ao backend, incluindo o token de acesso quando configurado. */
function backendHeaders(extra){
  const h = Object.assign({}, extra || {});
  if (state.backendToken) h['X-Backend-Token'] = state.backendToken;
  return h;
}
/* Mesma coisa, mas também injeta a chave do Replicate (usada só na aba Vídeo). */
function videoHeaders(extra){
  const h = backendHeaders(extra);
  if (state.replicateKey) h['X-Replicate-Key'] = state.replicateKey;
  return h;
}
/* Foco de busca: direciona o modelo pra priorizar certas fontes (viés, não filtro rígido). */
const SEARCH_FOCUS = {
  reddit:   { label:'Reddit', hint:'priorize discussões e opiniões reais de usuários no Reddit (site:reddit.com)' },
  youtube:  { label:'YouTube', hint:'priorize vídeos, análises e tutoriais do YouTube (site:youtube.com)' },
  academic: { label:'Acadêmico', hint:'priorize fontes acadêmicas e científicas: papers, estudos, journals (scholar, pubmed, arxiv). Cite os estudos.' },
  news:     { label:'Notícias', hint:'priorize notícias recentes de veículos de imprensa confiáveis, com data' },
  shopping: { label:'Compras', hint:'priorize lojas e páginas de produto com preço atual; compare preços entre lojas' },
};
const BOOT_TS = Date.now();
if (localStorage.getItem('vtz_templates') === null){
  state.templates = [
    { id: uid(), name:'Relatório incubadora', content:'Estruture um relatório de atividades da incubadora para a empresa {{empresa}}, cobrindo o período {{período}}. Inclua: eventos mapeados, custos estimados e próximos passos. Formato: headers claros, objetivo, pronto pra .docx.' },
    { id: uid(), name:'Revisão de código VTZ OS', content:'Revise este código do VTZ OS focando em: bugs, performance e legibilidade. Aponte problemas com justificativa e entregue a versão corrigida completa:\n\n```\n{{código}}\n```' },
    { id: uid(), name:'Script FPS reversível', content:'Crie um script .bat de otimização de {{alvo}} para Windows 11, seguro para anti-cheat, com backup automático e um restaurar.bat que desfaz tudo.' },
  ];
  localStorage.setItem('vtz_templates', JSON.stringify(state.templates));
}

/* ---------- Helpers de conteúdo multimodal ---------- */
/* Extrai texto plano de content (string ou array de parts) */
function contentToText(content){
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter(p => p.type === 'text').map(p => p.text).join('\n');
  return '';
}
/* Converte um File em part da API OpenRouter. Suporte real:
   imagem (image_url), PDF (file), áudio (input_audio), texto (inline no prompt).
   Vídeo: só alguns modelos (Gemini) aceitam — enviado como file, pode falhar em outros. */
function fileToPart(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler ' + file.name));
    reader.onload = () => {
      const dataUrl = reader.result;
      if (file.type.startsWith('image/')){
        resolve({ type:'image_url', image_url:{ url: dataUrl } });
      } else if (file.type === 'application/pdf'){
        resolve({ type:'file', file:{ filename: file.name, file_data: dataUrl } });
      } else if (file.type.startsWith('audio/')){
        const fmt = file.type.includes('wav') ? 'wav' : 'mp3';
        resolve({ type:'input_audio', input_audio:{ data: dataUrl.split(',')[1], format: fmt } });
      } else if (file.type.startsWith('video/')){
        resolve({ type:'file', file:{ filename: file.name, file_data: dataUrl } });
      } else {
        // texto/código: inline como parte de texto
        const txtReader = new FileReader();
        txtReader.onload = () => resolve({ type:'text', text:`[Arquivo: ${file.name}]\n${txtReader.result}` });
        txtReader.onerror = () => reject(new Error('Falha ao ler ' + file.name));
        txtReader.readAsText(file);
        return;
      }
    };
    reader.readAsDataURL(file);
  });
}
/* Remove campos internos (_router, _feedback, _att) antes de mandar pra API */
function sanitizeForApi(messages){
  return messages.filter(m => !m._local).map(m => {
    const { _router, _feedback, _att, _compare, _local, ts, ...rest } = m;
    return rest;
  });
}
/* Chips de anexo no composer */
/* ---------- Acesso a arquivos locais (File System Access API) ----------
   Abre arquivos DO DISCO (com permissão do usuário), lê como contexto pra IA e —
   o diferencial sobre o <input file> — permite SALVAR de volta no mesmo arquivo
   ou em qualquer pasta. Só Chrome/Edge têm a API; nos demais, cai no <input file>
   (leitura) e no download pra pasta Downloads (escrita). Nada é acessado sem o
   usuário escolher e autorizar no seletor do navegador. */
const FS_CAN_SAVE = typeof window.showSaveFilePicker === 'function';
const FS_CAN_OPEN = typeof window.showOpenFilePicker === 'function';
let lastFileHandle = null;   // último arquivo de texto aberto (pra "salvar por cima")
let lastFileName = '';
const TEXT_EXT = /\.(txt|md|markdown|json|csv|tsv|js|mjs|ts|jsx|tsx|py|rb|go|rs|java|c|h|cpp|cs|php|html?|css|scss|xml|yaml|yml|toml|ini|cfg|sh|bat|sql|log)$/i;
function isTextLike(file){ return (file.type && file.type.startsWith('text/')) || TEXT_EXT.test(file.name); }

async function openLocalFiles(){
  if (!FS_CAN_OPEN){ document.getElementById('attach-input').click(); return; }  // fallback universal
  let handles;
  try{ handles = await window.showOpenFilePicker({ multiple:true }); }
  catch(e){ if (e.name !== 'AbortError') toast('Não consegui abrir: ' + e.message, 'err'); return; }
  const MAX_TOTAL = 20 * 1024 * 1024;
  let total = state.pendingAttachments.reduce((n,f) => n + f.size, 0);
  for (const h of handles){
    let file; try{ file = await h.getFile(); }catch(_){ continue; }
    if (total + file.size > MAX_TOTAL){ toast(`Limite de 20MB — "${file.name}" não foi adicionado.`, 'err'); continue; }
    if (isTextLike(file)){ lastFileHandle = h; lastFileName = file.name; }  // guarda p/ salvar de volta
    state.pendingAttachments.push(file);
    total += file.size;
  }
  renderAttachChips();
  toast(lastFileHandle ? `Aberto "${lastFileName}" — dá pra editar e salvar de volta.` : 'Arquivo(s) aberto(s) do computador.');
}

/* Salva um texto num arquivo REAL no disco (o usuário escolhe pasta e nome). */
async function saveToDisk(text, suggestedName){
  if (!FS_CAN_SAVE){ downloadTextFile(suggestedName, text); toast('Salvo em Downloads (navegador sem acesso a pastas).'); return; }
  let handle;
  try{
    handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description:'Texto', accept:{ 'text/plain':['.txt','.md'], 'text/markdown':['.md'] } }],
    });
  }catch(e){ if (e.name !== 'AbortError') toast('Não consegui salvar: ' + e.message, 'err'); return; }
  try{
    const w = await handle.createWritable();
    await w.write(text); await w.close();
    lastFileHandle = handle; lastFileName = handle.name || suggestedName;
    toast(`Salvo no computador ✓ (${lastFileName})`);
  }catch(e){ toast('Erro ao escrever: ' + e.message, 'err'); }
}

/* Sobrescreve o último arquivo aberto/salvo, sem novo seletor. */
async function saveOverLast(text){
  if (!lastFileHandle){ return saveToDisk(text, lastFileName || 'arquivo.txt'); }
  try{
    const perm = await lastFileHandle.requestPermission?.({ mode:'readwrite' });
    if (perm && perm !== 'granted'){ toast('Permissão de escrita negada.', 'err'); return; }
    const w = await lastFileHandle.createWritable();
    await w.write(text); await w.close();
    toast(`Salvo por cima de "${lastFileName}" ✓`);
  }catch(e){ if (e.name !== 'AbortError') toast('Erro ao salvar: ' + e.message, 'err'); }
}

function renderAttachChips(){
  const el = document.getElementById('attach-chips');
  if (!el) return;
  el.innerHTML = '';
  state.pendingAttachments.forEach((f, i) => {
    const chip = document.createElement('div');
    chip.className = 'attach-chip';
    const kb = f.size > 1048576 ? (f.size/1048576).toFixed(1)+'MB' : Math.round(f.size/1024)+'KB';
    chip.innerHTML = `${iconHTML('file')}<span class="an">${esc(f.name)}</span><span style="color:var(--text-faint)">${kb}</span><button class="rm" aria-label="Remover anexo">${iconHTML('close')}</button>`;
    chip.querySelector('.rm').onclick = () => { state.pendingAttachments.splice(i,1); renderAttachChips(); };
    el.appendChild(chip);
  });
}

/* ---------- Núcleo compartilhado (dedupe) ---------- */
/* Escapa HTML de qualquer valor vindo do usuário ou da API antes de entrar em innerHTML */
function esc(s){
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}
function debounce(fn, ms){
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
/* Toast não-bloqueante (substitui alert nos fluxos não-destrutivos) */
function toast(msg, type){
  const wrap = document.getElementById('toasts');
  if (!wrap){ console.log('[toast]', msg); return; }
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.setAttribute('role','status');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3200);
}
/* Chamada única à API de chat — todas as features passam por aqui */
function orFetch(payload, opts = {}){
  // Roteamento por throughput: mesma qualidade (modelo idêntico), mas o OpenRouter
  // escolhe o provedor mais rápido no momento. Não sobrescreve preferências já postas.
  const body = payload.provider ? payload : { ...payload, provider: { sort: 'throughput' } };
  return fetch(OR_BASE + '/chat/completions', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer ' + state.apiKey,
      'HTTP-Referer': location.origin || 'https://vtz-llm.local',
      'X-Title': SITE_TITLE,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
}
/* Contabilidade de custo unificada */
function trackUsage(usage, modelId, conv){
  if (!usage) return;
  const pricing = getModelPricing(modelId);
  const cost = (usage.prompt_tokens||0)*pricing.prompt + (usage.completion_tokens||0)*pricing.completion;
  state.totalCost += cost;
  localStorage.setItem('vtz_or_cost', String(state.totalCost));
  state.costByModel[modelId] = (state.costByModel[modelId] || 0) + cost;
  localStorage.setItem('vtz_cost_by_model', JSON.stringify(state.costByModel));
  if (conv){ conv.cost = (conv.cost || 0) + cost; }
  updateCostBadge();
}
/* Retry com backoff: 429/5xx/erro de rede tenta de novo sozinho (2 retries) */
async function orFetchRetry(payload, opts = {}){
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++){
    if (attempt > 0){
      await new Promise(r => setTimeout(r, 800 * attempt));
      if (opts.signal?.aborted) throw Object.assign(new Error('abortado'), {name:'AbortError'});
      toast(`Instabilidade na API — tentando de novo (${attempt+1}/3)…`, 'warn');
    }
    try{
      const res = await orFetch(payload, opts);
      if (res.ok || ![429,500,502,503,504,529].includes(res.status)) return res;
      lastErr = new Error('API ' + res.status);
    }catch(e){
      if (e.name === 'AbortError') throw e;
      lastErr = e;
    }
  }
  throw lastErr || new Error('Falha após 3 tentativas');
}
/* Som curto opcional ao concluir geração */
function playDing(){
  if (!state.soundOn) return;
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .18);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + .2);
  }catch(_){}
}
/* Hook comum pós-resposta: som + auto-título por IA */
function afterAssistantDone(conv){
  playDing();
  const realMsgs = conv.messages.filter(m => (m.role==='user'||m.role==='assistant') && !m._local);
  if (!conv.agentId && !conv._titled && realMsgs.length === 2){
    conv._titled = true;
    autoTitleConversation(conv);
  }
  // auto-memória: a cada ~6 mensagens do usuário, destila fatos duráveis em 2º plano
  if (state.autoMemory){
    const userCount = realMsgs.filter(m => m.role === 'user').length;
    if (userCount >= 3 && userCount !== conv._lastMemAt && userCount % 3 === 0){
      conv._lastMemAt = userCount;
      extractMemories(conv, { silent: true });
    }
  }
}
async function autoTitleConversation(conv){
  try{
    const freeModel = state.models.find(m => m.id.endsWith(':free') && !isImageModel(m));
    const model = freeModel?.id || state.routerConfig.fast;
    if (!model) return;
    const firstUser = contentToText(conv.messages.find(m => m.role==='user')?.content || '').slice(0, 500);
    const res = await orFetch({ model, messages:[
      { role:'system', content:'Gere um título curto de 3 a 6 palavras para esta conversa, em português, sem aspas e sem pontuação final. Responda só o título.' },
      { role:'user', content: firstUser }
    ]});
    if (!res.ok) return;
    const data = await res.json();
    const title = (data.choices?.[0]?.message?.content || '').trim().replace(/["'.]/g,'').slice(0, 60);
    if (title){ conv.title = title; persistConversations(); renderHistoryList(); }
  }catch(_){ /* título automático é best-effort */ }
}
/* ---------- Auto-memória em GRAFO (evolução da lista plana, estilo Claude/ChatGPT) ----------
   Destila a conversa em ENTIDADES + RELAÇÕES (não frases soltas) e funde no
   state.memoryGraph, que é resumido e injetado em TODA conversa. Usa um modelo
   barato/confiável (não o do chat) pra extrair JSON limpo — custo por rodada é
   fração de centavo. O grafo evita duplicar e contradizer fatos antigos. */
const MEMORY_MODEL = 'openai/gpt-4.1-mini';
const MEM_MAX_NODES = 120; // teto de segurança do grafo

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

/* ===== Renderizador de PDF formatado + slides (client-side, jsPDF) =====
   O modelo escreve markdown; estas funções convertem em PDF com layout real
   (títulos, listas, tabelas em grade, código, slides). Sem backend, sem link falso. */
const VTZ_VIOLET = [139, 92, 246];
function getJsPDF(){ return window.jspdf?.jsPDF || window.jsPDF || null; }

/* Helpers de markdown inline (compartilhados por PDF e Word). */
function mdLinkify(s){ return String(s).replace(/\[(.+?)\]\((.+?)\)/g,'$1 ($2)'); }
function stripMd(s){ return mdLinkify(s).replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1').replace(/`(.+?)`/g,'$1'); }
/* Quebra "texto **negrito** e `código`" em segmentos com estilo. */
function inlineSegments(s){
  s = mdLinkify(s);
  const segs = [], re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null){
    if (m.index > last) segs.push({ text: s.slice(last, m.index) });
    if (m[2] !== undefined) segs.push({ text: m[2], bold: true });
    else if (m[3] !== undefined) segs.push({ text: m[3], italic: true });
    else if (m[4] !== undefined) segs.push({ text: m[4], code: true });
    last = re.lastIndex;
  }
  if (last < s.length) segs.push({ text: s.slice(last) });
  return segs.length ? segs : [{ text: s }];
}

/* Parseia markdown em blocos estruturados (independe do DOM).
   Títulos e tabelas ficam em texto plano; parágrafos e listas guardam o
   markdown inline (**negrito**, *itálico*, `código`) pra render com estilo. */
function mdToBlocks(md){
  const blocks = [];
  const lines = String(md).replace(/\r/g,'').split('\n');
  let i = 0;
  while (i < lines.length){
    const ln = lines[i], t = ln.trim();
    if (t.startsWith('```')){                       // bloco de código
      const code = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')){ code.push(lines[i]); i++; }
      i++; blocks.push({ type:'code', lines: code }); continue;
    }
    if (/^\s*\|.*\|\s*$/.test(ln)){                 // tabela
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])){
        const cells = lines[i].trim().replace(/^\||\|$/g,'').split('|').map(c => stripMd(c.trim()));
        const isSep = cells.every(c => /^:?-+:?$/.test(c.replace(/\s/g,'')));
        if (!isSep) rows.push(cells);
        i++;
      }
      if (rows.length) blocks.push({ type:'table', rows }); continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)){ blocks.push({ type:'hr' }); i++; continue; }
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h){ blocks.push({ type:'h', level: h[1].length, text: stripMd(h[2]) }); i++; continue; }
    const li = t.match(/^([-*+]|\d+\.)\s+(.*)$/);
    if (li){ blocks.push({ type:'li', ordered: /\d+\./.test(li[1]), text: mdLinkify(li[2]) }); i++; continue; }
    if (t === ''){ blocks.push({ type:'gap' }); i++; continue; }
    blocks.push({ type:'p', text: mdLinkify(t) }); i++;
  }
  return blocks;
}

/* Desenha uma tabela em grade. Retorna o novo y. addPage() devolve o y do topo. */
function pdfDrawTable(doc, rows, x0, y, totalW, pageBottom, addPage){
  const cols = Math.max(...rows.map(r => r.length));
  const colW = totalW / cols, cellPad = 4, lineH = 12;
  rows.forEach((row, ri) => {
    const wrapped = []; let maxLines = 1;
    for (let c = 0; c < cols; c++){
      doc.setFont('helvetica', ri===0?'bold':'normal'); doc.setFontSize(9);
      const w = doc.splitTextToSize(String(row[c]||''), colW - cellPad*2);
      wrapped.push(w); maxLines = Math.max(maxLines, w.length);
    }
    const rowH = maxLines*lineH + cellPad*2;
    if (y + rowH > pageBottom){ y = addPage(); }
    if (ri===0){ doc.setFillColor(...VTZ_VIOLET); doc.rect(x0,y,totalW,rowH,'F'); }
    else if (ri%2===0){ doc.setFillColor(245,244,250); doc.rect(x0,y,totalW,rowH,'F'); }
    for (let c = 0; c < cols; c++){
      const x = x0 + c*colW;
      doc.setDrawColor(210,206,222); doc.setLineWidth(0.5); doc.rect(x,y,colW,rowH);
      doc.setFont('helvetica', ri===0?'bold':'normal'); doc.setFontSize(9);
      if (ri===0) doc.setTextColor(255,255,255); else doc.setTextColor(45,45,55);
      (wrapped[c]||[]).forEach((line,li) => doc.text(line, x+cellPad, y+cellPad+lineH*(li+1)-3));
    }
    y += rowH;
  });
  return y + 8;
}

/* PDF de documento formatado (retrato): títulos, listas, tabelas, código. */
function downloadRichPdf(md, name){
  const J = getJsPDF();
  if (!J){ toast('Biblioteca de PDF não carregou (offline?).', 'err'); return; }
  const doc = new J({ unit:'pt', format:'a4' });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const M = 48, CW = pw - M*2;
  let y = M;
  const need = h => { if (y + h > ph - M){ doc.addPage(); y = M; } };
  const drawText = (raw, { size=11, style='normal', color=[30,30,30], lh=15, indent=0, bullet=null }={}) => {
    const forceBold = style === 'bold';
    const maxW = CW - indent - (bullet ? 14 : 0);
    const x0 = M + indent + (bullet ? 14 : 0);
    const setFontFor = w => {
      const b = forceBold || w.bold, it = w.italic;
      const st = b && it ? 'bolditalic' : b ? 'bold' : it ? 'italic' : 'normal';
      doc.setFont(w.code ? 'courier' : 'helvetica', (w.code && !b) ? 'normal' : st);
      doc.setFontSize(size);
    };
    // tokeniza os segmentos inline em palavras que carregam o estilo
    const words = [];
    inlineSegments(raw).forEach(s => String(s.text).split(/(\s+)/).forEach(w => { if (w !== '') words.push(Object.assign({ t:w }, s)); }));
    let line = [], lineW = 0, firstLine = true;
    const flush = () => {
      need(lh);
      if (bullet && firstLine){ doc.setFont('helvetica','normal'); doc.setFontSize(size); doc.setTextColor(...VTZ_VIOLET); doc.text(bullet, M+indent, y); }
      let x = x0;
      line.forEach(w => { setFontFor(w); doc.setTextColor(...color); doc.text(w.t, x, y); x += doc.getTextWidth(w.t); });
      y += lh; line = []; lineW = 0; firstLine = false;
    };
    words.forEach(w => {
      setFontFor(w);
      const ww = doc.getTextWidth(w.t);
      if (lineW + ww > maxW && line.length && w.t.trim() !== ''){ flush(); }
      if (!line.length && w.t.trim() === '') return;      // ignora espaço no início da linha
      line.push(w); lineW += ww;
    });
    if (line.length) flush();
  };
  mdToBlocks(md).forEach(b => {
    switch(b.type){
      case 'h': {
        const map = { 1:[19,10], 2:[15,8], 3:[13,6], 4:[11,5] };
        const [sz, sp] = map[b.level] || map[4];
        y += sp;
        drawText(b.text, { size:sz, style:'bold', color: b.level<=2 ? VTZ_VIOLET : [40,40,40], lh: sz+4 });
        y += sp*0.5; break;
      }
      case 'p': drawText(b.text); y += 4; break;
      case 'li': drawText(b.text, { indent:12, bullet: b.ordered ? '›' : '•' }); break;
      case 'table': y = pdfDrawTable(doc, b.rows, M, y, CW, ph - M, () => { doc.addPage(); return M; }); break;
      case 'code': {
        doc.setFont('courier','normal'); doc.setFontSize(9);
        const wrappedAll = [];
        b.lines.forEach(l => doc.splitTextToSize(l || ' ', CW - 16).forEach(x => wrappedAll.push(x)));
        const boxH = wrappedAll.length*12 + 12;
        need(Math.min(boxH, ph - M*2));
        doc.setFillColor(244,244,246); doc.rect(M, y, CW, boxH, 'F');
        doc.setTextColor(60,60,70);
        let cy = y + 14;
        wrappedAll.forEach(ll => { if (cy > ph - M){ doc.addPage(); cy = M + 14; } doc.text(ll, M+8, cy); cy += 12; });
        y = cy + 8; break;
      }
      case 'hr': y += 6; need(1); doc.setDrawColor(220,218,228); doc.line(M, y, pw-M, y); y += 10; break;
      case 'gap': y += 6; break;
    }
  });
  triggerDownload(name, doc.output('blob'));
}

/* Divide markdown em slides: cada '# ' ou '## ' inicia um slide; '---' também. */
function slideChunks(md){
  const blocks = mdToBlocks(md), slides = [];
  let cur = null;
  const push = () => { if (cur && (cur.title || cur.body.length)) slides.push(cur); };
  blocks.forEach(b => {
    if (b.type === 'h' && b.level <= 2){ push(); cur = { title: b.text, body: [] }; return; }
    if (b.type === 'hr'){ push(); cur = { title:'', body: [] }; return; }
    if (!cur) cur = { title:'', body: [] };
    if (b.type !== 'gap') cur.body.push(b);
  });
  push();
  return slides.length ? slides : [{ title:'', body: blocks.filter(b => b.type !== 'gap') }];
}

/* PDF de slides (paisagem): 1 seção por página, título em faixa violeta, rodapé numerado. */
function downloadSlidesPdf(md, name){
  const J = getJsPDF();
  if (!J){ toast('Biblioteca de PDF não carregou (offline?).', 'err'); return; }
  const doc = new J({ unit:'pt', format:'a4', orientation:'landscape' });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const M = 56, CW = pw - M*2;
  const slides = slideChunks(md);
  slides.forEach((s, si) => {
    if (si > 0) doc.addPage();
    doc.setFillColor(250,249,253); doc.rect(0,0,pw,ph,'F');
    doc.setFillColor(...VTZ_VIOLET); doc.rect(0,0,pw,68,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor(255,255,255);
    doc.text(doc.splitTextToSize(s.title || `Slide ${si+1}`, CW)[0], M, 44);
    let y = 110;
    s.body.forEach(b => {
      if (b.type === 'table'){ y = pdfDrawTable(doc, b.rows, M, y, CW, ph - M, () => M); return; }
      if (b.type === 'code'){
        doc.setFont('courier','normal'); doc.setFontSize(11); doc.setTextColor(60,60,70);
        b.lines.forEach(l => { if (y < ph - M){ doc.text(String(l).slice(0,120), M, y); y += 18; } });
        return;
      }
      const isH = b.type === 'h', isLi = b.type === 'li';
      doc.setFont('helvetica', isH ? 'bold' : 'normal');
      doc.setFontSize(isH ? 16 : 15); doc.setTextColor(35,35,45);
      const text = (isLi ? '•  ' : '') + stripMd(b.text || '');
      doc.splitTextToSize(text, CW).forEach(line => {
        if (y > ph - M) return;                     // slide deve ser conciso; excedente não estoura
        doc.text(line, M, y); y += isH ? 26 : 24;
      });
      if (isH) y += 4;
    });
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(150,148,160);
    doc.text('VTz LLM', M, ph - 24);
    doc.text(`${si+1} / ${slides.length}`, pw - M - 32, ph - 24);
  });
  triggerDownload(name, doc.output('blob'));
}
/* .docx formatado — via docx.js. Markdown vira documento Word real:
   títulos com estilo, tabelas em grade, listas, código e negrito/itálico. */
function downloadDocx(md, name){
  if (typeof docx === 'undefined'){ toast('Biblioteca de Word não carregou (offline?).', 'err'); return; }
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } = docx;
  const VIOLET = '8B5CF6';
  const HMAP = { 1:HeadingLevel.HEADING_1, 2:HeadingLevel.HEADING_2, 3:HeadingLevel.HEADING_3, 4:HeadingLevel.HEADING_4 };
  const runs = raw => inlineSegments(raw).map(s => new TextRun({
    text: s.text, bold: !!s.bold, italics: !!s.italic,
    font: s.code ? 'Consolas' : 'Calibri', size: s.code ? 20 : 22,
  }));
  const children = [];
  mdToBlocks(md).forEach(b => {
    if (b.type === 'h'){
      children.push(new Paragraph({ heading: HMAP[b.level] || HeadingLevel.HEADING_4, spacing:{ before:160, after:80 }, children:[ new TextRun({ text:b.text, bold:true }) ] }));
    } else if (b.type === 'p'){
      children.push(new Paragraph({ spacing:{ after:120 }, children: runs(b.text) }));
    } else if (b.type === 'li'){
      children.push(new Paragraph({ bullet:{ level:0 }, children: runs(b.text) }));
    } else if (b.type === 'code'){
      b.lines.forEach(l => children.push(new Paragraph({ shading:{ fill:'F2F2F6' }, children:[ new TextRun({ text: l || ' ', font:'Consolas', size:20 }) ] })));
      children.push(new Paragraph({ text:'' }));
    } else if (b.type === 'table'){
      const cols = Math.max(...b.rows.map(r => r.length));
      const rows = b.rows.map((r, ri) => new TableRow({ children: Array.from({ length: cols }).map((_, c) => new TableCell({
        width:{ size: Math.floor(100/cols), type: WidthType.PERCENTAGE },
        shading: ri === 0 ? { fill: VIOLET } : (ri % 2 === 0 ? { fill:'F5F4FA' } : undefined),
        children:[ new Paragraph({ children:[ new TextRun({ text: r[c] || '', bold: ri === 0, color: ri === 0 ? 'FFFFFF' : '000000', size:20 }) ] }) ],
      })) }));
      children.push(new Table({ width:{ size:100, type: WidthType.PERCENTAGE }, rows }));
      children.push(new Paragraph({ text:'' }));
    } else if (b.type === 'hr'){
      children.push(new Paragraph({ border:{ bottom:{ color:'CCCCCC', space:1, style: BorderStyle.SINGLE, size:6 } } }));
    }
  });
  const d = new Document({ sections:[{ children }] });
  Packer.toBlob(d).then(blob => triggerDownload(name, blob)).catch(e => toast('Falha ao gerar Word: ' + e.message, 'err'));
}
/* Extrai blocos ```lang ... ``` do markdown cru (independe do DOM) */
function extractCodeBlocks(markdown){
  const blocks = [];
  const re = /```([\w+.#-]*)\s*\n([\s\S]*?)```/g;
  let m;
  while((m = re.exec(markdown)) !== null){
    const code = m[2].replace(/\n$/, '');
    if (code.trim()) blocks.push({ lang: m[1] || '', code });
  }
  return blocks;
}

/* Botão de copiar em cada bloco de código dentro da mensagem */
function enhanceCodeBlocks(scope){
  scope.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement && pre.parentElement.classList.contains('code-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.replaceWith(wrap);
    wrap.appendChild(pre);
    const btn = document.createElement('button');
    btn.className = 'code-copy';
    btn.setAttribute('aria-label','Copiar este bloco');
    btn.innerHTML = iconHTML('copy');
    btn.onclick = () => {
      navigator.clipboard.writeText(pre.innerText).then(() => {
        btn.classList.add('ok');
        setTimeout(() => btn.classList.remove('ok'), 1200);
      }).catch(() => {});
    };
    wrap.appendChild(btn);

    // Baixar este bloco como arquivo, com extensão detectada da linguagem
    const codeEl = pre.querySelector('code');
    const langMatch = (codeEl?.className || '').match(/language-([\w+.#-]+)/);
    const lang = langMatch ? langMatch[1] : '';
    const dl = document.createElement('button');
    dl.className = 'code-copy code-dl';
    dl.setAttribute('aria-label','Baixar como arquivo');
    dl.innerHTML = iconHTML('download');
    dl.onclick = () => {
      const idx = [...scope.querySelectorAll('pre')].indexOf(pre) + 1;
      downloadTextFile(guessFilename(pre.innerText, lang, idx), pre.innerText);
      dl.classList.add('ok');
      setTimeout(() => dl.classList.remove('ok'), 1200);
    };
    wrap.appendChild(dl);

    // Canvas: prévia ao vivo pra blocos que são HTML/SVG
    const looksHtml = /^html?$|^svg$|^xml$/i.test(lang) || /<(!doctype|html|body|head|div|section|svg|h[1-6]|table|canvas|style)\b/i.test(pre.innerText);
    if (looksHtml){
      const pv = document.createElement('button');
      pv.className = 'code-copy code-preview';
      pv.setAttribute('aria-label','Ver prévia');
      pv.innerHTML = iconHTML('play');
      pv.onclick = () => openHtmlPreview(pre.innerText);
      wrap.appendChild(pv);
    }
  });
}

/* Canvas — renderiza HTML/SVG numa iframe isolada (sandbox), estilo Gemini Canvas. */
function openHtmlPreview(html){
  let ov = document.getElementById('html-preview-overlay');
  if (!ov){
    ov = document.createElement('div');
    ov.id = 'html-preview-overlay';
    ov.className = 'html-preview-overlay';
    ov.innerHTML = `
      <div class="hp-panel">
        <div class="hp-bar">
          <span class="hp-title">Prévia</span>
          <div class="hp-actions">
            <button class="hp-btn" id="hp-open">Abrir em nova aba</button>
            <button class="hp-btn hp-close" id="hp-close" aria-label="Fechar">${iconHTML('close')}</button>
          </div>
        </div>
        <iframe id="hp-frame" sandbox="allow-scripts allow-modals" referrerpolicy="no-referrer"></iframe>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) closeHtmlPreview(); });
    ov.querySelector('#hp-close').onclick = closeHtmlPreview;
  }
  const frame = ov.querySelector('#hp-frame');
  frame.srcdoc = html;
  ov.querySelector('#hp-open').onclick = () => {
    const blob = new Blob([html], { type:'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };
  ov.classList.add('open');
}
function closeHtmlPreview(){
  const ov = document.getElementById('html-preview-overlay');
  if (ov){ ov.classList.remove('open'); ov.querySelector('#hp-frame').srcdoc = ''; }
}

/* Voz — lê a resposta em voz alta (TTS nativo do navegador). Clicar de novo para. */
function speakMessage(raw, btnEl){
  const synth = window.speechSynthesis;
  if (!synth){ toast('Voz não suportada neste navegador.', 'warn'); return; }
  if (synth.speaking || synth.pending){
    synth.cancel();
    if (speakMessage._on){ speakMessage._on = false; return; }  // clicou no mesmo: só para
  }
  let text = contentToText(raw).replace(/```[\s\S]*?```/g, '. bloco de código omitido. ');
  text = stripMd(text).replace(/[|#>*_`~]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4500);
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'pt-BR'; u.rate = 1.06; u.pitch = 1;
  const voices = synth.getVoices();
  const pt = voices.find(v => /pt[-_]?BR/i.test(v.lang)) || voices.find(v => /^pt/i.test(v.lang));
  if (pt) u.voice = pt;
  u.onend = () => { speakMessage._on = false; };
  speakMessage._on = true;
  synth.speak(u);
  toast('Lendo a resposta…');
}

/* ---------- Comparar modelos lado a lado (Model Council) ---------- */
function compareModelOptions(){
  const list = (state.models && state.models.length ? state.models : FALLBACK_MODELS);
  // só modelos que produzem texto (exclui os só-imagem)
  return list.filter(m => {
    const out = m.architecture?.output_modalities;
    return !out || out.includes('text');
  });
}
function openCompare(){
  if (!state.apiKey){ toast('Configure a chave do OpenRouter primeiro.', 'warn'); switchView('config'); return; }
  let ov = document.getElementById('compare-overlay');
  if (!ov){
    ov = document.createElement('div');
    ov.id = 'compare-overlay';
    ov.className = 'compare-overlay';
    ov.innerHTML = `
      <div class="cmp-panel">
        <div class="cmp-head">
          <span class="cmp-title">Comparar modelos lado a lado</span>
          <button class="hp-btn hp-close" id="cmp-close" aria-label="Fechar">${iconHTML('close')}</button>
        </div>
        <div class="cmp-controls">
          <div class="cmp-selectors" id="cmp-selectors"></div>
          <textarea id="cmp-prompt" placeholder="Escreva a pergunta pra mandar pra todos ao mesmo tempo…"></textarea>
          <button class="primary" id="cmp-run">Comparar</button>
        </div>
        <div class="cmp-cols" id="cmp-cols"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    ov.querySelector('#cmp-close').onclick = () => ov.classList.remove('open');
    ov.querySelector('#cmp-run').onclick = runCompare;
  }
  const opts = compareModelOptions();
  const optHtml = opts.map(m => `<option value="${esc(m.id)}">${esc(m.name || m.id)}</option>`).join('');
  const sel = ov.querySelector('#cmp-selectors');
  sel.innerHTML = '';
  const def = [opts[0]?.id, opts[1]?.id, ''];
  for (let i = 0; i < 3; i++){
    const s = document.createElement('select');
    s.className = 'cmp-model';
    s.innerHTML = `<option value="">— ${i < 2 ? 'escolha um modelo' : 'modelo (opcional)'} —</option>` + optHtml;
    if (def[i]) s.value = def[i];
    sel.appendChild(s);
  }
  const conv = getCurrentConv();
  const lastUser = conv ? [...conv.messages].reverse().find(m => m.role === 'user') : null;
  if (lastUser) ov.querySelector('#cmp-prompt').value = contentToText(lastUser.content);
  ov.classList.add('open');
}
async function runCompare(){
  const ov = document.getElementById('compare-overlay');
  const uniq = [...new Set([...ov.querySelectorAll('.cmp-model')].map(s => s.value).filter(Boolean))];
  const promptText = ov.querySelector('#cmp-prompt').value.trim();
  if (!uniq.length){ toast('Escolha ao menos 1 modelo.', 'warn'); return; }
  if (!promptText){ toast('Escreva a pergunta.', 'warn'); return; }
  const cols = ov.querySelector('#cmp-cols');
  cols.innerHTML = '';
  cols.style.setProperty('--cols', uniq.length);
  const colEls = {};
  uniq.forEach(id => {
    const name = compareModelOptions().find(m => m.id === id)?.name || id;
    const col = document.createElement('div');
    col.className = 'cmp-col';
    col.innerHTML = `<div class="cmp-col-head">${esc(name)}</div><div class="cmp-col-body"><span class="thinking-label">Pensando…</span></div><div class="cmp-col-meta"></div>`;
    cols.appendChild(col);
    colEls[id] = col;
  });
  await Promise.all(uniq.map(async id => {
    const col = colEls[id];
    const body = col.querySelector('.cmp-col-body');
    const meta = col.querySelector('.cmp-col-meta');
    const t0 = performance.now();
    try{
      const res = await orFetchRetry({ model: id, messages:[{ role:'user', content: promptText }] });
      if (!res.ok){ body.innerHTML = `<span class="cmp-err">Erro HTTP ${res.status}</span>`; return; }
      const data = await res.json();
      const msg = contentToText(data.choices?.[0]?.message?.content || '(sem texto)');
      body.innerHTML = safeRenderMarkdown(msg);
      enhanceCodeBlocks(body);
      trackUsage(data.usage, id, getCurrentConv());
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      const pricing = getModelPricing(id);
      const cost = data.usage ? ((data.usage.prompt_tokens||0)*pricing.prompt + (data.usage.completion_tokens||0)*pricing.completion) : 0;
      meta.textContent = `${secs}s · ~$${cost.toFixed(4)}`;
    }catch(e){ body.innerHTML = `<span class="cmp-err">${esc(e.message)}</span>`; }
  }));
}

/* ---------- Deep Research light (Gemini) — multi-busca + síntese, client-side ---------- */
function deepResearchModel(){
  if (state.model && !state.model.startsWith('__')) return state.model;
  return state.routerConfig?.balanced || state.models[0]?.id || 'openai/gpt-4.1-mini';
}
async function startDeepResearch(){
  const input = document.getElementById('chat-input');
  const topic = input.value.trim();
  if (!topic){ toast('Escreva o tema da pesquisa no campo de mensagem primeiro.', 'warn'); input.focus(); return; }
  if (!state.apiKey){ toast('Configure a chave do OpenRouter primeiro.', 'warn'); switchView('config'); return; }
  input.value = '';
  if (backendUrl()) backendDeepResearch(topic);  // server-side, mais robusto
  else deepResearch(topic);                       // fallback client-side
}
async function deepResearch(topic){
  const conv = getCurrentConv(); if (!conv) return;
  const model = deepResearchModel();
  conv.messages.push({ role:'user', content: '🔬 Pesquisa profunda: ' + topic });
  const aIdx = conv.messages.push({ role:'assistant', content: '_Planejando a pesquisa…_' }) - 1;
  conv.updatedAt = Date.now();
  persistConversations(); renderChat();
  const setStatus = (t) => { conv.messages[aIdx].content = t; renderChat(); };
  const ask = async (messages, plugins) => {
    const body = { model, messages };
    if (plugins) body.plugins = plugins;
    const r = await orFetchRetry(body);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    trackUsage(d.usage, model, conv);
    return contentToText(d.choices?.[0]?.message?.content || '');
  };
  try{
    setStatus('🔬 _Quebrando o tema em sub-perguntas…_');
    const subRaw = await ask([{ role:'user', content: `Quebre o tema abaixo em 3 a 4 sub-perguntas de pesquisa objetivas e complementares. Responda SÓ com um array JSON de strings, nada mais.\n\nTema: ${topic}` }]);
    let subs = [];
    try{ subs = JSON.parse((subRaw.match(/\[[\s\S]*\]/) || [subRaw])[0]); }catch(_){}
    if (!Array.isArray(subs) || !subs.length){
      subs = subRaw.split('\n').map(s => s.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean);
    }
    subs = subs.filter(s => typeof s === 'string' && s.length > 4).slice(0, 4);
    if (!subs.length) subs = [topic];
    setStatus('🔬 _Pesquisando na web:_\n' + subs.map(s => '- ' + s).join('\n'));
    const findings = await Promise.all(subs.map(async q => {
      try{ const a = await ask([{ role:'user', content: q + '\n\nResponda com fatos e dados concretos, citando as fontes (com links).' }], [{ id:'web' }]); return `### ${q}\n${a}`; }
      catch(e){ return `### ${q}\n(falha nesta sub-busca: ${e.message})`; }
    }));
    setStatus('🔬 _Sintetizando o relatório final…_');
    const report = await ask([{ role:'user', content: `Com base SÓ nas descobertas abaixo, escreva um relatório final sobre "${topic}". Use "## seções", **negrito**, listas e uma seção final "## Conclusão". Cite as fontes (links) ao longo do texto. Seja objetivo e honesto sobre o que ficou incerto.\n\n${findings.join('\n\n')}` }]);
    conv.messages[aIdx].content = report;
    if (conv.title === 'Nova conversa' || !conv.title) conv.title = topic.slice(0, 40);
    conv.updatedAt = Date.now();
    persistConversations(); renderChat(); renderHistoryList();
    attachTopicImages(conv.messages[aIdx], topic, conv);  // imagens sobre o tema (via backend)
    toast('Pesquisa profunda concluída.');
  }catch(e){
    conv.messages[aIdx].content = '**Falha na pesquisa profunda:** ' + e.message;
    persistConversations(); renderChat();
    toast('Pesquisa profunda falhou: ' + e.message, 'err');
  }
}

/* ---------- Integração com o backend VTz OS (opcional) ---------- */
/* Auto-detecção: se nenhuma URL foi configurada, procura o backend local
   (localhost:8000) e se conecta sozinho. Navegadores permitem HTTPS→localhost. */
let _autoDetectDone = false;
async function autoDetectBackend(){
  if (state.backendUrl || _autoDetectDone) return !!state.backendUrl;
  _autoDetectDone = true;
  for (const url of ['http://localhost:8000', 'http://127.0.0.1:8000']){
    try{
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(url + '/api/health', { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok){
        state.backendUrl = url;
        localStorage.setItem('vtz_backend_url', url);
        const inp = document.getElementById('backend-url-input'); if (inp) inp.value = url;
        updateAgentBtnVisibility();
        toast('Backend local detectado ✓');
        return true;
      }
    }catch(_){}
  }
  return false;
}
/* Busca imagens sobre o tema (via backend) e anexa à mensagem. */
async function attachTopicImages(msgObj, query, conv){
  if (!backendUrl() || !query || !msgObj) return;
  try{
    const r = await fetch(backendUrl() + '/api/images', {
      method:'POST', headers: backendHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify({ q: query, max: 10 }),
    });
    if (!r.ok) return;
    const d = await r.json();
    if (d.results && d.results.length){
      msgObj._images = d.results;
      persistConversations();
      renderChat();
    }
  }catch(_){}
}
async function testBackend(){
  const out = document.getElementById('backend-status');
  const url = backendUrl();
  out.style.display = 'block';
  if (!url){ out.textContent = 'Nenhuma URL configurada acima.'; return; }
  out.textContent = 'Testando ' + url + '…';
  try{
    const health = await fetch(url + '/api/health').then(r => r.json());
    let conn = {}, connErr = '';
    try{
      const cr = await fetch(url + '/api/connectors/status', { headers: backendHeaders() });
      if (cr.status === 401) connErr = '\n\n⚠ Token exigido pelo backend e ausente/errado — preencha o campo acima.';
      else conn = await cr.json();
    }catch(_){}
    out.textContent = 'OK ✓  backend no ar.\n' + JSON.stringify(health, null, 1) +
      '\n\nConectores configurados:\n' + JSON.stringify(conn, null, 1) + connErr;
  }catch(e){
    out.textContent = 'Falhou: ' + e.message +
      '\n\nCheque: backend rodando? URL certa? ALLOWED_ORIGINS liberou o domínio deste site?';
  }
}
/* Deep research usando o servidor (mais robusto, com progresso via SSE). */
async function backendDeepResearch(topic){
  const conv = getCurrentConv(); if (!conv) return;
  conv.messages.push({ role:'user', content: '🔬 Pesquisa profunda: ' + topic });
  const aIdx = conv.messages.push({ role:'assistant', content: '_Conectando ao backend…_' }) - 1;
  conv.updatedAt = Date.now(); persistConversations(); renderChat();
  const set = (t) => { conv.messages[aIdx].content = t; renderChat(); };
  const sources = [];
  let subs = [];
  try{
    const r = await fetch(backendUrl() + '/api/deep-research', {
      method:'POST',
      headers: backendHeaders({ 'Content-Type':'application/json', 'X-OR-Key': state.apiKey }),
      body: JSON.stringify({ topic, model: deepResearchModel() }),
    });
    if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
    while (true){
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream:true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0){
        const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 2);
        if (!line.startsWith('data:')) continue;
        let ev; try{ ev = JSON.parse(line.slice(5)); }catch(_){ continue; }
        if (ev.event === 'subquestions'){ subs = ev.items || []; set('🔬 _Pesquisando:_\n' + subs.map(s => '- ' + s).join('\n')); }
        else if (ev.event === 'status'){ set('🔬 _' + ev.message + '_' + (subs.length ? '\n\n' + subs.map(s => '- ' + s).join('\n') : '')); }
        else if (ev.event === 'finding'){ (ev.sources || []).forEach(u => { if (u && !sources.includes(u)) sources.push(u); }); }
        else if (ev.event === 'report'){ conv.messages[aIdx].content = ev.markdown; if (sources.length) conv.messages[aIdx]._sources = sources.map(u => ({ url:u, title:u })); }
        else if (ev.event === 'error'){ throw new Error(ev.message); }
      }
    }
    if (conv.title === 'Nova conversa' || !conv.title) conv.title = topic.slice(0, 40);
    conv.updatedAt = Date.now(); persistConversations(); renderChat(); renderHistoryList();
    attachTopicImages(conv.messages[aIdx], topic, conv);  // imagens sobre o tema
    toast('Pesquisa profunda (backend) concluída.');
  }catch(e){
    conv.messages[aIdx].content = '**Falha na pesquisa profunda (backend):** ' + e.message + '\n\n(o backend está no ar e com CORS liberado?)';
    persistConversations(); renderChat();
    toast('Backend falhou: ' + e.message, 'err');
  }
}

/* ---------- Agente autônomo avançado (backend /api/autonomous, SSE) ---------- */
/* Mostra o botão só quando há backend — é uma rota server-side, não tem fallback. */
function updateAgentBtnVisibility(){
  const btn = document.getElementById('agent-btn');
  if (btn) btn.style.display = backendUrl() ? 'flex' : 'none';
}
const AGENT_TOOL_ICON = { web_search:'🔍', fetch_url:'📄', notion_search:'🗒️', note:'📝', update_plan:'🧭' };
async function startAutonomousAgent(){
  if (!backendUrl()){ toast('O agente autônomo precisa do Backend VTz OS ligado (Config → Backend).', 'warn'); return; }
  const input = document.getElementById('chat-input');
  const task = input.value.trim();
  if (!task){ toast('Escreva a tarefa do agente no campo de mensagem primeiro.', 'warn'); input.focus(); return; }
  if (!state.apiKey){ toast('Configure a chave do OpenRouter primeiro.', 'warn'); switchView('config'); return; }
  input.value = '';
  const conv = getCurrentConv(); if (!conv) return;
  conv.messages.push({ role:'user', content: '🤖 Agente: ' + task });
  const aIdx = conv.messages.push({ role:'assistant', content: '_Iniciando o agente…_' }) - 1;
  conv.updatedAt = Date.now(); persistConversations(); renderChat();

  let plan = [], steps = [], usage = null, done = false;
  const render = (finalMd) => {
    if (finalMd != null){ conv.messages[aIdx].content = finalMd; renderChat(); return; }
    let md = '### 🤖 Agente autônomo\n**Tarefa:** ' + task + '\n';
    if (plan.length) md += '\n**Plano:**\n' + plan.map((s,i) => `${i+1}. ${s}`).join('\n') + '\n';
    if (steps.length){
      md += '\n**Progresso:**\n' + steps.map(s => {
        if (s.type === 'action') return `- ${AGENT_TOOL_ICON[s.tool]||'🔧'} \`${s.tool}\` ${s.arg ? '— ' + s.arg : ''}`;
        if (s.type === 'obs') return `  ↳ _${s.text}_`;
        return '- ' + s.text;
      }).join('\n') + '\n';
    }
    if (usage) md += `\n_${usage.total} tokens usados_`;
    conv.messages[aIdx].content = md; renderChat();
  };
  render();

  try{
    const r = await fetch(backendUrl() + '/api/autonomous', {
      method:'POST',
      headers: backendHeaders({ 'Content-Type':'application/json', 'X-OR-Key': state.apiKey }),
      body: JSON.stringify({ task, model: deepResearchModel(), max_steps: 12 }),
    });
    if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
    while (true){
      const { value, done: rd } = await reader.read(); if (rd) break;
      buf += dec.decode(value, { stream:true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0){
        const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 2);
        if (!line.startsWith('data:')) continue;
        let ev; try{ ev = JSON.parse(line.slice(5)); }catch(_){ continue; }
        if (ev.event === 'plan'){ plan = ev.steps || []; render(); }
        else if (ev.event === 'action'){ const a = ev.args || {}; const arg = a.query || a.url || a.text || (a.steps ? '('+a.steps.length+' passos)' : ''); steps.push({ type:'action', tool: ev.tool, arg: arg ? String(arg).slice(0,80) : '' }); render(); }
        else if (ev.event === 'observation'){ steps.push({ type:'obs', text: String(ev.result||'').replace(/\s+/g,' ').slice(0,120) }); render(); }
        else if (ev.event === 'status'){ steps.push({ type:'status', text: ev.message }); render(); }
        else if (ev.event === 'usage'){ usage = ev; render(); }
        else if (ev.event === 'answer'){
          let md = ev.markdown || '(sem resposta)';
          const nSteps = steps.filter(s => s.type === 'action').length;
          md += `\n\n---\n_🤖 Agente autônomo · ${nSteps} ação(ões)${usage ? ' · ' + usage.total + ' tokens' : ''}${ev.note ? ' · ' + ev.note : ''}_`;
          render(md); done = true;
        }
        else if (ev.event === 'error'){ throw new Error(ev.message); }
      }
    }
    if (!done) render(conv.messages[aIdx].content + '\n\n_(fluxo encerrado sem resposta final)_');
    if (conv.title === 'Nova conversa' || !conv.title) conv.title = task.slice(0, 40);
    conv.updatedAt = Date.now(); persistConversations(); renderChat(); renderHistoryList();
    toast('Agente autônomo concluído.');
  }catch(e){
    render('**Falha no agente autônomo:** ' + e.message + '\n\n(o backend está no ar e com CORS liberado?)');
    persistConversations();
    toast('Agente falhou: ' + e.message, 'err');
  }
}

/* seed de skills na primeira execução */
if (localStorage.getItem('vtz_skills') === null){
  state.skills = [
    { id: uid(), name:'VTZ Design System', trigger:'design, ui, interface, tema, glass', instructions:'Aplique o design system VTZ: tema Glass (superfícies translúcidas com blur) como padrão, acento violeta, tipografia nativa do sistema, preto como base.', active:false },
    { id: uid(), name:'Automação Windows (.bat)', trigger:'windows, script, automação, .bat, .reg', instructions:'Sempre que gerar scripts de automação Windows, acompanhe o .py (ou .ps1) com um .bat de execução. Para mudanças de registro, inclua backup e restauração reversíveis.', active:false },
    { id: uid(), name:'Incubadora Maricá', trigger:'incubadora, evento, maricá, relatório', instructions:'Contexto: mapeamento de eventos e relatórios para 5 empresas incubadas em Maricá-RJ. Tom objetivo, formatação clara com headers, atenção à sensibilidade política local.', active:false },
  ];
  localStorage.setItem('vtz_skills', JSON.stringify(state.skills));
}

/* ---------- System prompt global — o "treino" das respostas ----------
   Não existe fine-tuning client-side; o mecanismo real é este prompt, injetado
   ANTES de agente e skills em toda conversa. Editável em Config. */
const DEFAULT_GLOBAL_PROMPT = `Você é o VTZ, assistente pessoal do Victor Hugo. Regras de resposta:
1. Responda em português brasileiro, direto e sem enrolação — zero preâmbulo tipo "Claro! Aqui está".
2. Se a resposta cabe em um parágrafo denso, não escreva três.
3. Não concorde automaticamente: se houver erro ou opção melhor, aponte com justificativa técnica.
4. Em decisões, apresente comparação objetiva e indique a superior (Pareto: máximo retorno, mínimo esforço).
5. Código sempre pronto para produção, comentado onde importa; automação Windows acompanha .bat de execução e mudanças reversíveis.
6. Headers e listas só quando facilitarem leitura rápida.
7. Se não souber, diga que não sabe — nunca invente dados.
8. Pedidos explícitos de teste, benchmark ou experimento (ex.: "gere um texto longo pra testar o streaming") devem ser atendidos literalmente, sem questionar o propósito.
9. Você não salva arquivos nem tem sandbox — mas o VTz LLM converte a SUA resposta em PDF/slides/Word/Excel no navegador (menu ⋯ da mensagem). Nunca invente link de download, nunca finja ter salvo arquivo, e NUNCA escreva script gerador (Python/reportlab/docx-lib/.bat) para o usuário rodar e produzir o arquivo — o app já gera. Entregue o CONTEÚDO direto, estruturado para render bem:
   - Apresentação/slides: um "## Título" por slide, seguido de poucos bullets curtos (um conceito por slide). O app gera "Baixar slides (PDF)".
   - Planilha/tabela (ex.: plano de treino): use tabela markdown "| Coluna | ... |" com cabeçalho. Gera Excel e PDF em grade.
   - Documento: títulos ##/### + listas. Gera "Baixar PDF (formatado)".
   Um TEMPLATE rotulado (ex.: treino ABC pra preencher cargas) é permitido e NÃO conta como inventar dados — só deixe claro que é modelo. Se útil, lembre em uma linha que o download é pelo menu ⋯. (Exceção: só escreva script gerador de arquivo se o usuário pedir explicitamente o código.)
10. Formate as respostas com capricho, no estilo de pesquisa do ChatGPT: use "## Seção" para agrupar, **negrito** em nomes/rótulos/preços, listas com bullet (rótulo em negrito + descrição curta) e TABELA markdown pra comparar itens (produtos, preços, specs). Em buscas web, organize por categoria ou faixa de preço, destaque a recomendação final numa seção própria e cite as fontes. Não despeje texto corrido quando dá pra estruturar — mas também não force estrutura em respostas curtas de uma linha.`;
if (localStorage.getItem('vtz_global_prompt') === null){
  localStorage.setItem('vtz_global_prompt', DEFAULT_GLOBAL_PROMPT);
}
/* Migração não-destrutiva do prompt global: injeta regras novas em prompts já
   salvos (personalizados ou antigos) preservando o resto. Cada regra tem um
   marcador único — se já estiver presente, não reaplica (idempotente). */
const PROMPT_RULES = [
  { mark: 'menu ⋯',
    text: '9. Você não gera arquivos você mesmo — o VTz LLM converte sua resposta em PDF/slides/Word/Excel pelo menu ⋯ da mensagem. Nunca invente link de download, nunca finja ter salvo arquivo e nunca escreva script gerador (Python/reportlab/.bat) pro usuário rodar. Para planilha/treino use tabela markdown "| Coluna | ... |"; para slides use "## Título" por slide; para documento use ##/### + listas. Template rotulado pra preencher é permitido.' },
  { mark: 'estilo de pesquisa',
    text: '10. Formate as respostas com capricho, no estilo de pesquisa do ChatGPT: use "## Seção" para agrupar, **negrito** em nomes/rótulos/preços, listas com bullet (rótulo em negrito + descrição curta) e TABELA markdown pra comparar itens (produtos, preços, specs). Em buscas web, organize por categoria ou faixa de preço, destaque a recomendação final e cite as fontes. Não despeje texto corrido quando dá pra estruturar — mas não force estrutura em respostas curtas.' },
];
(function migrateGlobalPrompt(){
  let cur = localStorage.getItem('vtz_global_prompt');
  if (!cur) return;
  let changed = false;
  PROMPT_RULES.forEach(r => { if (!cur.includes(r.mark)){ cur = cur.replace(/\s+$/,'') + '\n' + r.text; changed = true; } });
  if (changed) localStorage.setItem('vtz_global_prompt', cur);
})();

/* seed de agentes na primeira execução — depois disso são 100% editáveis via CRUD */
if (localStorage.getItem('vtz_agents') === null){
  state.agents = [
    { id:'incubadora', icon:'bank', name:'Incubadora Maricá',
      desc:'Mapeamento de eventos, relatórios e documentos para as 5 empresas incubadas.',
      systemPrompt:'Você ajuda Victor Hugo com trabalho estratégico da incubadora de Maricá-RJ: mapeamento de eventos, produção de documentos e relatórios de atividade para as 5 empresas incubadas (Destilaria Guinsburg, Sou Águia, Gaia Soluções Sustentáveis, HS Office, Francinete Froés). Seja objetivo, use formatação clara com headers, e considere a sensibilidade política do contexto de Maricá quando o tema tocar nisso.' },
    { id:'vtzos-dev', icon:'cpu', name:'VTZ OS Dev',
      desc:'Par de programação pro assistente VTZ OS (backend Python + pywebview).',
      systemPrompt:'Você é o par de programação de Victor no projeto VTZ OS: um assistente Jarvis-style com backend Python (WebSocket), frontend HTML/CSS/JS via pywebview, orb 3D reativo com state machine, integração RouteLLM/Abacus, e treino de wake word customizado via openwakeword-trainer. Priorize código pronto para produção, modular e comentado. Para qualquer automação Windows, sempre acompanhe o script Python com um .bat de execução.' },
    { id:'fps-boost', icon:'gamepad', name:'FPS Boost / Windows',
      desc:'Scripts de otimização de Windows pra Fortnite, Valorant e EA FC.',
      systemPrompt:'Você ajuda Victor a otimizar Windows 10/11 para jogos (Fortnite, Valorant, EA FC): tweaks de registro, planos de energia, GPU scheduling, redução de input lag e stutter. Sempre gere scripts .bat/.reg/.ps1 reversíveis com backup e restauração embutidos, seguros para anti-cheat.' },
    { id:'rotina-fisico', icon:'dumbbell', name:'Rotina & Físico',
      desc:'Consistência de treino, protocolo e hábitos da rotina VTZ.',
      systemPrompt:'Você ajuda Victor a manter consistência na rotina VTZ: treino noturno (18h-20h), objetivo de físico denso e atlético, mentalidade constância>perfeição, framework CHÃO vs TETO, protocolo-freeze de 4-8 semanas, e hábitos (mewing, postura, skincare, leitura bíblica, 2L de água/dia). Foque em execução e consistência de protocolo, não em conselho médico.' },
    { id:'skill-router', icon:'zap', name:'Skill Router',
      desc:'Ajuda a criar e refinar skills e prompts do ecossistema Claude.',
      systemPrompt:'Você ajuda Victor a criar, refinar e depurar skills e prompts para o ecossistema de Claude Skills dele (agent-org, vtz-ds, skill-router, prompt-architect, mcp-builder, vtz-builder). Foque em triggers precisos de skill, clareza de instrução e modularidade.' },
  ];
  localStorage.setItem('vtz_agents', JSON.stringify(state.agents));
} else {
  /* migração: quem já tinha agentes salvos com emoji (versão anterior) passa pra ícone SVG */
  let migrated = false;
  state.agents.forEach(a => {
    if (LEGACY_EMOJI_TO_ICON[a.icon]){ a.icon = LEGACY_EMOJI_TO_ICON[a.icon]; migrated = true; }
  });
  if (migrated) localStorage.setItem('vtz_agents', JSON.stringify(state.agents));
}


/* migração: histórico antigo single-thread -> primeira conversa */
(function migrateOldHistory(){
  const old = JSON.parse(localStorage.getItem('vtz_or_history') || 'null');
  if (old && old.length && state.conversations.length === 0){
    const conv = { id: uid(), title: old[0]?.content?.slice(0,32) || 'Conversa', messages: old, updatedAt: Date.now() };
    state.conversations.push(conv);
    state.currentConvId = conv.id;
    localStorage.removeItem('vtz_or_history');
  }
})();


/* ---------- RouteLLM caseiro ---------- */
const ROUTER_MODEL = {id:'__router__', name:'RouteLLM (automático)'};
const ROUTER_FREE_MODEL = {id:'__router_free__', name:'RouteLLM Free (só grátis)'};
const FUSION_MODEL = {id:'__fusion__', name:'Fusion (2 IAs em paralelo)'};

function classifyTier(text){
  const t = (text||'').toLowerCase();
  const codeHints = ['código','function','def ','class ','bug','erro de','debug','script','python','javascript','html','css','sql','regex','refator','função'];
  const powerHints = ['explique detalhadamente','analise','arquitetura','estratégia','compare','prós e contras','passo a passo completo','plano completo'];
  if ((text||'').length > 500 || codeHints.some(k => t.includes(k)) || powerHints.some(k => t.includes(k))) return 'power';
  if ((text||'').length < 60) return 'fast';
  return 'balanced';
}
function resolveRouterModel(text){
  const tier = classifyTier(text);
  const modelId = state.routerConfig[tier] || state.routerConfig.balanced || (state.models[0] && state.models[0].id);
  return {tier, modelId};
}
function pickDefaultRouterConfig(){
  const findBy = (subs) => state.models.find(m => subs.some(s => m.id.includes(s)) && !isImageModel(m))?.id;
  if (!state.routerConfig.fast) state.routerConfig.fast = findBy(['flash-lite','haiku-3','gpt-4.1-nano','gemma']) || state.models.find(m=>!isImageModel(m))?.id;
  if (!state.routerConfig.balanced) state.routerConfig.balanced = findBy(['gemini-2.5-flash','deepseek-v4-flash','flash']) || state.routerConfig.fast;
  if (!state.routerConfig.power) state.routerConfig.power = findBy(['claude-sonnet','claude-opus','gpt-5','gpt-4.1']) || state.routerConfig.balanced;
  localStorage.setItem('vtz_router_config', JSON.stringify(state.routerConfig));
}
function populateRouterSelects(){
  ['fast','balanced','power'].forEach(tier => {
    const sel = document.getElementById(`router-${tier}-select`);
    if (!sel) return;
    sel.innerHTML = '';
    state.models.filter(m => !isImageModel(m)).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id; opt.textContent = m.name || m.id;
      if (m.id === state.routerConfig[tier]) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => { state.routerConfig[tier] = sel.value; localStorage.setItem('vtz_router_config', JSON.stringify(state.routerConfig)); };
  });
}

/* ---------- Tool registry ---------- */
const isVtzOS = typeof window.pywebview !== 'undefined';

const TOOLS = {
  get_datetime: {
    def:{ type:'function', function:{ name:'get_datetime', description:'Retorna data e hora atual', parameters:{type:'object',properties:{}} } },
    exec: async () => new Date().toString()
  },
  calculate: {
    def:{ type:'function', function:{ name:'calculate', description:'Avalia uma expressão matemática simples', parameters:{ type:'object', properties:{ expression:{type:'string'} }, required:['expression'] } } },
    exec: async (args) => {
      try{
        const result = Function('"use strict"; return (' + args.expression.replace(/[^0-9+\-*/().\s]/g,'') + ')')();
        return String(result);
      }catch(e){ return 'Erro ao calcular: ' + e.message; }
    }
  }
};
if (isVtzOS) {
  TOOLS.execute_code = {
    def:{ type:'function', function:{ name:'execute_code', description:'Executa código Python no sandbox local do VTZ OS', parameters:{ type:'object', properties:{ code:{type:'string'} }, required:['code'] } } },
    exec: async (args) => await window.pywebview.api.execute_tool('execute_code', args)
  };
  TOOLS.browse_web = {
    def:{ type:'function', function:{ name:'browse_web', description:'Navega e extrai conteúdo de uma URL via backend', parameters:{ type:'object', properties:{ url:{type:'string'} }, required:['url'] } } },
    exec: async (args) => await window.pywebview.api.execute_tool('browse_web', args)
  };
}

/* ---------- Provider badges ---------- */
const PROVIDER_PALETTE = {
  openai:['OA','#10a37f'], anthropic:['AN','#d97757'], google:['GG','#4285f4'],
  deepseek:['DS','#6c5ce7'], 'meta-llama':['ML','#0668e1'], mistralai:['MI','#ff7000'],
  'x-ai':['XA','#333333'], qwen:['QW','#6236ff'], 'z-ai':['ZA','#7c5cff'],
  bytedance:['BD','#111111'], 'bytedance-seed':['BD','#111111'], 'black-forest-labs':['BF','#1c1c1c'], microsoft:['MS','#00a4ef'],
  perplexity:['PX','#20b8cd'], cohere:['CO','#39594d'], minimax:['MM','#ff3366'],
};
/* domínio oficial de cada provedor — usado pra buscar a logo real (favicon).
   Se a imagem falhar (offline, bloqueio), cai automaticamente no badge de letras. */
const PROVIDER_DOMAINS = {
  openai:'openai.com', anthropic:'anthropic.com', google:'google.com',
  deepseek:'deepseek.com', 'meta-llama':'meta.com', mistralai:'mistral.ai',
  'x-ai':'x.ai', qwen:'alibabacloud.com', 'z-ai':'z.ai',
  bytedance:'bytedance.com', 'bytedance-seed':'bytedance.com',
  'black-forest-labs':'bfl.ai', microsoft:'microsoft.com',
  perplexity:'perplexity.ai', cohere:'cohere.com', minimax:'minimax.io',
  moonshotai:'moonshot.ai', nvidia:'nvidia.com', amazon:'amazon.com', ai21:'ai21.com',
};
function providerMeta(modelId){
  const p = (modelId.split('/')[0] || '?').toLowerCase();
  const found = PROVIDER_PALETTE[p];
  const domain = PROVIDER_DOMAINS[p] || null;
  if (found) return {label:found[0], color:found[1], domain};
  return {label:p.slice(0,2).toUpperCase(), color:'#4a4a55', domain};
}
/* badge com logo real + fallback: tenta o favicon oficial; onerror esconde a img e mostra as letras */
function providerBadgeHTML(modelId){
  const pm = providerMeta(modelId);
  if (pm.domain){
    return `<span class="provider-badge" style="background:${pm.color}">` +
      `<img src="https://www.google.com/s2/favicons?domain=${pm.domain}&sz=64" alt="" loading="lazy" ` +
      `onerror="this.style.display='none'; this.nextElementSibling.style.display='inline'">` +
      `<span class="badge-fallback" style="display:none">${pm.label}</span></span>`;
  }
  return `<span class="provider-badge" style="background:${pm.color}">${pm.label}</span>`;
}
/* preço em R$ por 1M tokens (entrada / saída), taxa configurável no Config */
function formatPriceBRL(m){
  if (!m.pricing) return '';
  const pIn = parseFloat(m.pricing.prompt||0) * 1e6 * state.usdToBrl;
  const pOut = parseFloat(m.pricing.completion||0) * 1e6 * state.usdToBrl;
  if (pIn === 0 && pOut === 0) return 'Grátis';
  const fmt = (v) => v >= 10 ? 'R$' + Math.round(v) : 'R$' + v.toFixed(2).replace('.', ',');
  return `${fmt(pIn)} / ${fmt(pOut)} · 1M tok`;
}
function isFavorite(id){ return state.favorites.includes(id); }
function toggleFavorite(id){
  if (isFavorite(id)) state.favorites = state.favorites.filter(f => f !== id);
  else state.favorites.push(id);
  localStorage.setItem('vtz_favorites', JSON.stringify(state.favorites));
}

/* ---------- Filtros/ordenação do picker ----------
   IMPORTANTE sobre honestidade dos dados:
   - "Custo", "Contexto" e "Recentes" ordenam por DADOS REAIS da API (pricing, context_length, created).
   - "Codex" e "Performance" são rankings CURADOS por heurística (lista de padrões de id,
     do melhor pro pior) — não existem benchmarks no /models da API. Snapshot de 2026-07,
     editável no array abaixo. */
const CODEX_RANK = [
  'claude-opus','claude-sonnet-5','gpt-5.5','claude-sonnet','gpt-5','grok-code','deepseek-r1',
  'qwen3-coder','qwen','o4','o3','gemini-3.1-pro','glm-5','deepseek','gemini-3.5-flash','gpt-4.1',
];
const PERF_RANK = [
  'claude-opus','gpt-5.5','gemini-3.1-pro','claude-sonnet-5','grok-4','gpt-5','claude-sonnet',
  'deepseek-r1','qwen3.7-max','glm-5','o4','gemini-3.5-flash','minimax','gpt-4.1',
];
function rankScore(modelId, rankList){
  const id = modelId.toLowerCase();
  for (let i = 0; i < rankList.length; i++){
    if (id.includes(rankList[i])) return i;
  }
  return 999; // não ranqueado -> fim da lista
}
function totalPricePerM(m){
  return (parseFloat(m.pricing?.prompt||0) + parseFloat(m.pricing?.completion||0)) * 1e6;
}
/* Presets combináveis (até 2): cada um tem cmp (ordena) e/ou filter (restringe).
   Ao combinar, o 1º selecionado é o critério primário e o 2º desempata. */
const SORT_PRESETS = [
  { key:'codex',   label:'Codex',       cmp:(a,b) => rankScore(a.id,CODEX_RANK) - rankScore(b.id,CODEX_RANK) },
  { key:'cheap',   label:'Custo ↓',     cmp:(a,b) => totalPricePerM(a) - totalPricePerM(b) },
  { key:'perf',    label:'Performance', cmp:(a,b) => rankScore(a.id,PERF_RANK) - rankScore(b.id,PERF_RANK) },
  { key:'context', label:'Contexto ↑',  cmp:(a,b) => (b.context_length||0) - (a.context_length||0) },
  { key:'new',     label:'Recentes',    cmp:(a,b) => (b.created||0) - (a.created||0) },
  { key:'free',    label:'Grátis',      filter:(m) => totalPricePerM(m) === 0 },
];
const MAX_SORTS = 2;
/* Alterna um preset na seleção (máx 2). Clicar de novo remove; um 3º empurra o mais antigo. */
function togglePickerSort(key){
  const i = state.pickerSorts.indexOf(key);
  if (i >= 0){ state.pickerSorts.splice(i, 1); return; }
  state.pickerSorts.push(key);
  if (state.pickerSorts.length > MAX_SORTS) state.pickerSorts.shift();
}

/* ---------- Tema claro/escuro ---------- */
function applyTheme(theme){
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('vtz_theme', theme);
  const iconEl = document.getElementById('theme-icon');
  if (iconEl) iconEl.innerHTML = iconHTML(theme === 'dark' ? 'sun' : 'moon');
}
function toggleTheme(){ applyTheme(state.theme === 'dark' ? 'light' : 'dark'); }

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('env-detail').textContent = isVtzOS
    ? 'Rodando dentro do VTZ OS — tools pesadas disponíveis (execute_code, browse_web).'
    : 'Rodando como site standalone — apenas tools leves disponíveis.';

  if (!state.apiKey) document.getElementById('key-modal').style.display = 'flex';

  applyTheme(state.theme);
  document.getElementById('theme-btn').onclick = toggleTheme;

  // Firebase (login opcional): só ativa se o SDK e a config real estiverem presentes
  if (initFirebase()){
    document.getElementById('google-signin-btn').onclick = signInGoogle;
    document.getElementById('google-signout-btn').onclick = signOutGoogle;
  } else {
    const hint = document.getElementById('account-hint');
    if (hint) hint.textContent = 'Sync na nuvem indisponível: configure o Firebase (chave real) pra ativar o login. Sem isso, tudo continua salvo neste navegador.';
    const btn = document.getElementById('google-signin-btn');
    if (btn){ btn.disabled = true; btn.textContent = 'Login indisponível (configurar Firebase)'; }
  }

  // sugestões da tela inicial: ícones + envio real ao clicar
  const sugIcons = ['bank','cpu','gamepad','dumbbell'];
  document.querySelectorAll('#suggestions .sug-card').forEach((card, i) => {
    card.querySelector('.si').innerHTML = iconHTML(sugIcons[i] || 'bot');
    card.onclick = () => {
      document.getElementById('chat-input').value = card.dataset.sug || '';
      sendMessage();
    };
  });

  // textarea cresce conforme digita (do CORE AI)
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });
  chatInput.addEventListener('input', debounce(updateCtxMeter, 200));

  // anexos: + abre o picker; chips com remover
  document.getElementById('plus-btn').onclick = () => document.getElementById('attach-input').click();
  if (FS_CAN_OPEN){
    const ofb = document.getElementById('openfile-btn');
    ofb.style.display = 'flex';
    ofb.onclick = openLocalFiles;
  }
  document.getElementById('attach-input').addEventListener('change', (e) => {
    const MAX_TOTAL = 20 * 1024 * 1024; // 20MB total (base64 infla ~33%)
    let total = state.pendingAttachments.reduce((n,f) => n + f.size, 0);
    for (const f of e.target.files){
      if (total + f.size > MAX_TOTAL){ toast(`Limite de 20MB — "${f.name}" não foi adicionado.`, 'err'); continue; }
      if (f.type.startsWith('video/')) toast(`Vídeo só funciona em modelos com suporte (ex: Gemini).`, 'warn');
      state.pendingAttachments.push(f);
      total += f.size;
    }
    e.target.value = '';
    renderAttachChips();
  });

  // menu de mensagem e select text: fechar
  document.getElementById('msg-menu-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'msg-menu-overlay') closeMsgMenu();
  });
  document.getElementById('select-text-close').onclick = () => { document.getElementById('select-text-modal').style.display = 'none'; };
  document.getElementById('select-text-modal').addEventListener('click', (e) => {
    if (e.target.id === 'select-text-modal') e.target.style.display = 'none';
  });

  updateSessionPanel();

  ensureConversation();
  renderProjectsBar();
  renderHistoryList();
  renderChat();
  updateCostBadge();
  renderAgents();
  renderSkills();
  fetchModels();

  // header / sidebar wiring
  document.getElementById('menu-btn').onclick = () => toggleSidebar(true);
  document.getElementById('sidebar-backdrop').onclick = () => toggleSidebar(false);
  document.getElementById('new-chat-btn').onclick = () => { newConversation(); toggleSidebar(false); };
  document.querySelectorAll('.side-nav-item').forEach(btn => {
    btn.onclick = () => { switchView(btn.dataset.view); toggleSidebar(false); };
  });

  // model picker
  document.getElementById('model-picker-btn').onclick = openPicker;
  document.getElementById('picker-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'picker-overlay') closePicker();
  });
  document.getElementById('picker-search-input').addEventListener('input', debounce(renderPickerList, 120));

  // api key modal
  document.getElementById('modal-save-btn').onclick = () => {
    const v = document.getElementById('modal-key-input').value.trim();
    if (v) { saveApiKey(v); document.getElementById('key-modal').style.display = 'none'; }
  };

  // chat
  document.getElementById('send-btn').onclick = () => {
    const gen = state.gens[state.currentConvId];
    if (gen){ gen.abort(); return; }
    sendMessage();
  };

  // Acessibilidade: rótulos nos botões de ícone e papel de diálogo nos overlays
  const ARIA = { 'menu-btn':'Abrir menu', 'theme-btn':'Alternar tema claro/escuro', 'mic-btn':'Ditar por voz',
    'send-btn':'Enviar mensagem', 'plus-btn':'Anexar arquivos', 'model-picker-btn':'Selecionar modelo de IA' };
  Object.entries(ARIA).forEach(([id, label]) => document.getElementById(id)?.setAttribute('aria-label', label));
  ['picker-overlay','msg-menu-overlay','key-modal','skill-modal','agent-modal','project-modal','select-text-modal','rename-modal','edit-msg-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el){ el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); }
  });

  // Atalhos: Esc fecha overlays; Ctrl/Cmd+K abre o seletor de modelos
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape'){
      closeMsgMenu(); closePicker(); toggleSidebar(false);
      ['select-text-modal','skill-modal','agent-modal','project-modal','rename-modal','edit-msg-modal'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.style.display !== 'none') el.style.display = 'none';
      });
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); openPicker(); }
  });
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('tools-toggle').addEventListener('change', (e) => {
    state.toolsEnabled = e.target.checked;
    document.getElementById('tools-status').textContent = state.toolsEnabled ? `${Object.keys(TOOLS).length} tools ativas` : '';
    document.getElementById('tp-tools').classList.toggle('active', state.toolsEnabled);
    updateToolsTrigger();
  });
  setupToolsPopover();

  // mic (best-effort, Web Speech API)
  setupMic();

  // config
  document.getElementById('save-key-btn').onclick = () => saveApiKey(document.getElementById('api-key-input').value.trim());
  document.getElementById('clear-key-btn').onclick = () => { localStorage.removeItem('vtz_or_key'); state.apiKey=''; document.getElementById('key-modal').style.display='flex'; };
  document.getElementById('save-replicate-key-btn').onclick = () => {
    const key = document.getElementById('replicate-key-input').value.trim();
    if (!key) return;
    state.replicateKey = key;
    localStorage.setItem('vtz_replicate_key', key);
    document.getElementById('replicate-key-input').value = '';
    toast('Chave do Replicate salva ✓');
  };
  document.getElementById('clear-replicate-key-btn').onclick = () => {
    localStorage.removeItem('vtz_replicate_key');
    state.replicateKey = '';
    toast('Chave do Replicate removida.');
  };
  document.getElementById('reset-cost-btn').onclick = () => { state.totalCost = 0; localStorage.setItem('vtz_or_cost','0'); updateCostBadge(); };
  const brlInput = document.getElementById('usd-brl-input');
  brlInput.value = String(state.usdToBrl).replace('.', ',');
  brlInput.addEventListener('change', () => {
    const v = parseFloat(brlInput.value.replace(',', '.'));
    if (v > 0 && v < 100){
      state.usdToBrl = v;
      localStorage.setItem('vtz_usd_brl', String(v));
      renderPickerList();
    } else {
      brlInput.value = String(state.usdToBrl).replace('.', ',');
    }
  });
  document.getElementById('gen-image-btn').onclick = generateImage;
  document.getElementById('gen-video-btn').onclick = generateVideo;
  document.getElementById('video-model-select').onchange = updateVideoModelFields;
  document.getElementById('video-duration')?.addEventListener('input', updateVideoCost);
  document.getElementById('video-aspect')?.addEventListener('change', updateVideoCost);
  document.getElementById('video-audio-chip')?.addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('on'); updateVideoCost();
  });
  document.getElementById('video-revise-chip')?.addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('on');
  });
  // redesign 2026: menus, sidebar colapsável, painel de sessão, tabs de mídia, tarefas
  initSidebarCollapse();
  initSessionPanel();
  initMediaTabs();
  setupTasksChip();

  // skills
  document.getElementById('new-skill-btn').onclick = () => openSkillModal(null);
  document.getElementById('skill-cancel-btn').onclick = closeSkillModal;
  document.getElementById('skill-save-btn').onclick = saveSkillFromModal;
  document.getElementById('skill-modal').addEventListener('click', (e) => { if (e.target.id === 'skill-modal') closeSkillModal(); });

  // projetos
  document.getElementById('project-cancel-btn').onclick = closeProjectModal;
  document.getElementById('project-save-btn').onclick = saveProjectFromModal;
  document.getElementById('project-modal').addEventListener('click', (e) => { if (e.target.id === 'project-modal') closeProjectModal(); });

  // agentes
  document.getElementById('new-agent-btn').onclick = () => openAgentModal(null);
  document.getElementById('import-agent-btn').onclick = () => document.getElementById('import-agent-file').click();
  document.getElementById('import-agent-file').onchange = (e) => { const f = e.target.files[0]; if (f) importAgentFile(f); e.target.value = ''; };
  document.getElementById('agent-cancel-btn').onclick = closeAgentModal;
  document.getElementById('agent-save-btn').onclick = saveAgentFromModal;
  document.getElementById('agent-icon-input').addEventListener('change', updateAgentIconPreview);
  document.getElementById('agent-photo-btn').onclick = () => document.getElementById('agent-photo-input').click();
  document.getElementById('agent-photo-input').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try{ agentPhotoDraft = await fileToAvatar(f); updateAgentIconPreview(); }
    catch(err){ toast('Erro na foto: ' + err.message, 'err'); }
  });
  document.getElementById('agent-photo-remove').onclick = () => { agentPhotoDraft = null; updateAgentIconPreview(); };

  const gpInput = document.getElementById('global-prompt-input');
  gpInput.value = localStorage.getItem('vtz_global_prompt') || '';
  gpInput.addEventListener('change', () => {
    localStorage.setItem('vtz_global_prompt', gpInput.value);
    toast('Estilo de resposta salvo.');
  });
  document.getElementById('global-prompt-reset').onclick = () => {
    gpInput.value = DEFAULT_GLOBAL_PROMPT;
    localStorage.setItem('vtz_global_prompt', DEFAULT_GLOBAL_PROMPT);
    toast('Estilo restaurado pro padrão.');
  };
  // memória em grafo
  const memInput = document.getElementById('memory-input');
  renderMemoryUI();
  // editar à mão: reconstrói o grafo como fatos simples (preserva "apagar linha = esquecer").
  // A memória automática volta a criar as relações estruturadas depois.
  memInput.addEventListener('change', () => {
    const lines = memInput.value.split('\n').map(s => s.replace(/^-\s*/,'').trim()).filter(Boolean);
    const g = { nodes:[{ id:'voce', label:'Você', type:'pessoa' }], edges:[] };
    for (const line of lines){
      const id = memUpsertNode(g, line, 'fato');
      if (id !== 'voce') memUpsertEdge(g, 'voce', 'sabe-se que', id);
    }
    state.memoryGraph = g;
    state.memories = lines;
    localStorage.setItem('vtz_memories', JSON.stringify(state.memories));
    saveMemoryGraph();
    renderMemoryUI();
    toast('Memória salva.');
  });
  const autoMemToggle = document.getElementById('auto-memory-toggle');
  if (autoMemToggle){
    autoMemToggle.checked = state.autoMemory;
    autoMemToggle.onchange = () => {
      state.autoMemory = autoMemToggle.checked;
      localStorage.setItem('vtz_auto_memory', state.autoMemory ? '1' : '0');
      toast(state.autoMemory ? 'Memória automática ligada.' : 'Memória automática desligada.');
    };
  }
  document.getElementById('update-memory-btn')?.addEventListener('click', async (e) => {
    const conv = getCurrentConv();
    if (!conv || conv.messages.filter(m => !m._local && (m.role==='user'||m.role==='assistant')).length < 2){
      toast('Abra uma conversa com algumas mensagens primeiro.', 'warn'); return;
    }
    e.target.disabled = true; e.target.textContent = 'Atualizando…';
    await extractMemories(conv, { silent: false });
    renderMemoryUI();
    e.target.disabled = false; e.target.textContent = 'Atualizar memória agora';
  });
  // backend VTz OS
  const beInput = document.getElementById('backend-url-input');
  beInput.value = state.backendUrl;
  beInput.addEventListener('change', () => {
    state.backendUrl = beInput.value.trim().replace(/\/+$/, '');
    localStorage.setItem('vtz_backend_url', state.backendUrl);
    updateAgentBtnVisibility();
    toast(state.backendUrl ? 'Backend salvo.' : 'Backend removido (volta ao modo local).');
  });
  const beTokenInput = document.getElementById('backend-token-input');
  beTokenInput.value = state.backendToken;
  beTokenInput.addEventListener('change', () => {
    state.backendToken = beTokenInput.value.trim();
    localStorage.setItem('vtz_backend_token', state.backendToken);
    toast(state.backendToken ? 'Token salvo.' : 'Token removido.');
  });
  document.getElementById('backend-test-btn').onclick = testBackend;
  setupConfigNav();
  setupAccountMenu();
  autoDetectBackend();  // procura o backend local em segundo plano
  document.getElementById('goto-skills-btn').onclick = () => { switchView('skills'); toggleSidebar(false); };
  document.getElementById('skillsh-load-btn').onclick = loadSkillsLibrary;
  document.getElementById('skill-url-install-btn').onclick = installSkillFromUrl;
  document.getElementById('connectors-refresh-btn').onclick = refreshConnectorsStatus;
  document.getElementById('connectors-save-btn').onclick = saveConnectorKeys;
  document.getElementById('google-connect-btn').onclick = connectGoogle;
  document.getElementById('conn-search-btn').onclick = searchConnector;
  document.getElementById('conn-query').addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); searchConnector(); } });
  document.getElementById('mcp-list-btn').onclick = mcpListTools;
  document.getElementById('agent-modal').addEventListener('click', (e) => { if (e.target.id === 'agent-modal') closeAgentModal(); });

  // busca no histórico (debounced)
  document.getElementById('history-search-input').addEventListener('input', debounce(renderHistoryList, 120));

  // rename modal
  document.getElementById('rename-cancel').onclick = () => { document.getElementById('rename-modal').style.display = 'none'; };
  document.getElementById('rename-save').onclick = () => {
    const modal = document.getElementById('rename-modal');
    const conv = state.conversations.find(c => c.id === modal.dataset.convId);
    const nv = document.getElementById('rename-input').value.trim();
    if (conv && nv){ conv.title = nv; persistConversations(); renderHistoryList(); }
    modal.style.display = 'none';
  };
  document.getElementById('rename-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('rename-save').click();
  });

  // diagnóstico + toggle de streaming
  const focusSel = document.getElementById('search-focus');
  focusSel.value = state.searchFocus || '';
  document.getElementById('web-toggle').addEventListener('change', (e) => {
    state.webSearch = e.target.checked;
    focusSel.style.display = state.webSearch ? 'block' : 'none';
    document.getElementById('tp-web').classList.toggle('active', state.webSearch);
    updateToolsTrigger();
    if (state.webSearch) toast('Busca web ativada — o modelo pesquisa a internet antes de responder (~US$0,02/msg, fora do contador de tokens).');
    else toast('Busca web desativada.');
  });
  focusSel.addEventListener('change', () => {
    state.searchFocus = focusSel.value;
    localStorage.setItem('vtz_search_focus', state.searchFocus);
  });

  const perfToggle = document.getElementById('perf-toggle');
  perfToggle.checked = state.perfMode;
  document.body.classList.toggle('perf', state.perfMode);
  perfToggle.onchange = () => {
    state.perfMode = perfToggle.checked;
    localStorage.setItem('vtz_perf', state.perfMode ? '1' : '0');
    document.body.classList.toggle('perf', state.perfMode);
    toast(state.perfMode ? 'Modo desempenho ativado.' : 'Efeitos visuais completos.');
  };
  const streamToggle = document.getElementById('stream-toggle');
  streamToggle.checked = state.streamOn;
  streamToggle.onchange = () => {
    state.streamOn = streamToggle.checked;
    localStorage.setItem('vtz_stream', state.streamOn ? '1' : '0');
    toast(state.streamOn ? 'Streaming ativado.' : 'Streaming desativado (resposta chega de uma vez).');
  };
  document.getElementById('diag-btn').onclick = async () => {
    const b = document.getElementById('diag-btn');
    b.disabled = true; b.textContent = 'Testando…';
    try{ await runDiagnostics(); }
    finally{ b.disabled = false; b.textContent = 'Testar conexão'; }
  };

  // armazenamento
  document.getElementById('archive-btn').onclick = () => {
    if (confirm('Arquivar conversas antigas? As 15 mais recentes e as fixadas são mantidas.')) archiveOldConversations(15);
  };
  updateStorageMeter();

  // editar mensagem
  document.getElementById('edit-msg-cancel').onclick = () => { document.getElementById('edit-msg-modal').style.display = 'none'; };
  document.getElementById('edit-msg-save').onclick = saveEditMsg;
  document.getElementById('edit-msg-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-msg-modal') e.target.style.display = 'none';
  });

  // medidor de contexto ao vivo
  updateCtxMeter();

  // janela de contexto
  const ctxSel = document.getElementById('ctx-window-select');
  ctxSel.value = String(state.ctxWindow);
  ctxSel.onchange = () => {
    state.ctxWindow = parseInt(ctxSel.value, 10);
    localStorage.setItem('vtz_ctx_window', String(state.ctxWindow));
    updateCtxMeter();
    toast(state.ctxWindow ? `Contexto limitado às últimas ${state.ctxWindow} mensagens` : 'Contexto completo (mais caro)');
  };

  // transparência: ver system prompt ativo
  document.getElementById('view-system-btn').onclick = () => {
    const conv = getCurrentConv();
    const sp = conv ? buildSystemPrompt(conv) : null;
    openSelectText(sp || 'Nenhum system prompt ativo nesta conversa (sem agente e sem skill acionada).');
  };
  document.getElementById('compare-btn').onclick = openCompare;
  document.getElementById('deep-btn').onclick = startDeepResearch;
  document.getElementById('agent-btn').onclick = startAutonomousAgent;
  updateAgentBtnVisibility();

  // backup / restore
  document.getElementById('export-backup-btn').onclick = exportBackup;
  document.getElementById('import-backup-btn').onclick = () => document.getElementById('import-backup-file').click();
  document.getElementById('import-backup-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importBackup(e.target.files[0]);
  });
});

/* ---------- View / sidebar switching ---------- */
function switchView(name){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.side-nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(name + '-view').classList.add('active');
  document.querySelector(`.side-nav-item[data-view="${name}"]`)?.classList.add('active');
  if (name === 'analytics') renderAnalytics();
  if (name === 'config'){ updateStorageMeter(); requestAnimationFrame(updateCfgNavScrollHint); }
  if (name === 'video' && !state.videoModels) loadVideoModels();
  syncMediaTabs(name);
}
function toggleSidebar(open){
  document.getElementById('sidebar').classList.toggle('open', open);
  document.getElementById('sidebar-backdrop').classList.toggle('open', open);
}

/* ---------- Menu de ferramentas colapsável ---------- */
function updateToolsTrigger(){
  const active = !!(state.toolsEnabled || state.webSearch);
  const trg = document.getElementById('tools-trigger');
  const dot = document.getElementById('tools-trigger-dot');
  if (trg) trg.classList.toggle('has-active', active);
  if (dot) dot.style.display = active ? 'block' : 'none';
}
function setupToolsPopover(){
  const trigger = document.getElementById('tools-trigger');
  const pop = document.getElementById('tools-pop');
  if (!trigger || !pop) return;
  const cmdPop = document.getElementById('commands-pop');
  const closeCmd = () => cmdPop?.classList.remove('open');
  const close = () => { pop.classList.remove('open'); closeCmd(); };
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pop.classList.contains('open')){ close(); }
    else { pop.classList.add('open'); }
  });
  // sub-janela de comandos: abre a partir do item "Comandos", volta pelo botão back
  document.getElementById('commands-btn')?.addEventListener('click', (e) => {
    e.stopPropagation(); cmdPop?.classList.add('open');
  });
  document.getElementById('commands-back')?.addEventListener('click', (e) => {
    e.stopPropagation(); closeCmd();
  });
  // fecha ao clicar numa ação (mas não ao mexer nos toggles/select)
  ['deep-btn','agent-btn','compare-btn','view-system-btn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => setTimeout(close, 60));
  });
  document.addEventListener('click', (e) => {
    if (!pop.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) close();
  });
  renderCommandList(close);
  updateToolsTrigger();
}
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
/* Menu de ações da conversa (substitui o prompt de texto) */
function openConvMenu(convId){
  const conv = state.conversations.find(c => c.id === convId);
  if (!conv) return;
  const menu = document.getElementById('msg-menu');
  menu.innerHTML = '';
  const items = [
    { icon:'pin', label: conv.pinned ? 'Desafixar' : 'Fixar no topo', run: () => {
        conv.pinned = !conv.pinned; persistConversations(); renderHistoryList();
        toast(conv.pinned ? 'Conversa fixada.' : 'Conversa desafixada.');
      } },
    { icon:'wand', label:'Renomear', run: () => renameConversation(convId) },
    { icon:'folder', label:'Mover para projeto…', run: () => openProjectPicker(convId) },
    { icon:'file', label:'Exportar .md', run: () => exportConversationMarkdown(conv) },
    { icon:'globe', label:'Exportar página (.html)', run: () => exportConversationPage(conv) },
    { icon:'file', label:'Exportar conversa (PDF)', run: () => exportConversationPdf(conv) },
    { icon:'close', label:'Excluir conversa', run: () => { if (confirm(`Excluir "${conv.title}"?`)) deleteConversation(convId); } },
  ];
  items.forEach(it => {
    const btn = document.createElement('button');
    btn.className = 'msg-menu-item';
    btn.innerHTML = iconHTML(it.icon) + ' ' + esc(it.label);
    btn.onclick = () => { closeMsgMenu(); it.run(); };
    menu.appendChild(btn);
  });
  document.getElementById('msg-menu-overlay').classList.add('open');
}
/* Sub-menu: escolher o projeto de uma conversa (ou criar um novo na hora) */
function openProjectPicker(convId){
  const conv = state.conversations.find(c => c.id === convId);
  if (!conv) return;
  const menu = document.getElementById('msg-menu');
  menu.innerHTML = '';
  const addItem = (label, done, run) => {
    const btn = document.createElement('button');
    btn.className = 'msg-menu-item' + (done ? ' done' : '');
    btn.innerHTML = iconHTML('folder') + ' ' + esc(label);
    btn.onclick = () => { closeMsgMenu(); run(); };
    menu.appendChild(btn);
  };
  const set = (pid) => { conv.projectId = pid; persistConversations(); renderHistoryList(); toast(pid ? 'Movida pro projeto.' : 'Removida do projeto.'); };
  addItem('Sem projeto', !conv.projectId, () => set(null));
  state.projects.forEach(p => addItem(p.name, conv.projectId === p.id, () => set(p.id)));
  addItem('＋ Novo projeto…', false, () => {
    createProject((proj) => { conv.projectId = proj.id; persistConversations(); renderHistoryList(); });
  });
  document.getElementById('msg-menu-overlay').classList.add('open');
}
function persistConversations(){
  // Anexos (base64) ficam só em memória na sessão — persistir estouraria o localStorage.
  // Ao salvar, content multimodal vira texto + nota dos anexos.
  const stripped = state.conversations.map(c => ({
    ...c,
    messages: c.messages.map(m => {
      if (Array.isArray(m.content)){
        const names = (m._att || []).join(', ');
        return { ...m, content: contentToText(m.content) + (names ? `\n[anexos enviados: ${names}]` : '') };
      }
      return m;
    })
  }));
  try{
    localStorage.setItem('vtz_conversations', JSON.stringify(stripped));
    localStorage.setItem('vtz_current_conv', state.currentConvId || '');
  }catch(err){
    // QuotaExceededError: antes falhava em silêncio e o usuário perdia conversas sem saber
    if (err.name === 'QuotaExceededError' || err.code === 22){
      state.quotaFull = true;
      toast('Armazenamento cheio — a conversa NÃO foi salva. Arquive conversas antigas em Config.', 'err');
    } else {
      toast('Erro ao salvar: ' + err.message, 'err');
    }
  }
  updateSessionPanel();
  scheduleCloudSync();
}

/* ---------- Login opcional + sync na nuvem (Firebase) ----------
   Sem login: nada muda, tudo no localStorage. Com login Google: conversas,
   agentes e skills sobem pro Firestore e descem em qualquer aparelho.
   100% grátis dentro dos limites gratuitos do Firebase. */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDcdaOggw9ZWsayQmxcmKVf81-n-w0mlT0",
  authDomain: "vtz-life-47067.firebaseapp.com",
  projectId: "vtz-life-47067",
  storageBucket: "vtz-life-47067.firebasestorage.app",
  messagingSenderId: "601252874771",
  appId: "1:601252874771:web:e4280dadb331f176d10de6",
};
let fbAuth = null, fbDb = null, cloudSyncTimer = null;
function initFirebase(){
  if (typeof firebase === 'undefined' || !firebase.initializeApp){ console.warn('Firebase não carregou.'); return false; }
  try{
    firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    fbAuth.onAuthStateChanged(onAuthChanged);
    return true;
  }catch(e){ console.warn('Firebase init falhou:', e.message); return false; }
}
function onAuthChanged(user){
  const out = document.getElementById('account-signed-out');
  const inn = document.getElementById('account-signed-in');
  const accHead = document.getElementById('acc-head');
  const accSignout = document.getElementById('acc-signout');
  const footerName = document.getElementById('footer-name');
  if (user){
    if (out) out.style.display = 'none';
    if (inn) inn.style.display = 'block';
    const em = document.getElementById('account-email'); if (em) em.textContent = user.email || user.displayName || 'conta Google';
    if (accHead) accHead.textContent = user.email || user.displayName || 'conta Google';
    if (accSignout) accSignout.style.display = 'flex';
    if (footerName) footerName.textContent = user.displayName || user.email || 'Victor Hugo';
    pullFromCloud(user.uid);
  } else {
    if (out) out.style.display = 'block';
    if (inn) inn.style.display = 'none';
    if (accHead) accHead.textContent = 'Conta local (sem login)';
    if (accSignout) accSignout.style.display = 'none';
    if (footerName) footerName.textContent = 'Victor Hugo';
  }
}
/* Menu de conta no rodapé (estilo painel de conta): abre Configurações etc. */
function setupAccountMenu(){
  const wrap = document.querySelector('.account-wrap');
  const btn = document.getElementById('account-btn');
  const menu = document.getElementById('account-menu');
  if (!wrap || !btn || !menu) return;
  const close = () => wrap.classList.remove('open');
  const items = [
    { icon:'sliders', label:'Configurações', run: () => { switchView('config'); toggleSidebar(false); } },
    { icon:'chart',   label:'Analytics',     run: () => { switchView('analytics'); toggleSidebar(false); } },
    { icon:'sun',     label:'Alternar tema', run: () => toggleTheme() },
    { icon:'download',label:'Exportar backup', run: () => exportBackup() },
    { icon:'close',   label:'Sair', danger:true, signout:true, run: () => signOutGoogle() },
  ];
  const head = document.createElement('div');
  head.className = 'acc-head'; head.id = 'acc-head';
  head.textContent = 'Conta local (sem login)';
  menu.appendChild(head);
  items.forEach(it => {
    const b = document.createElement('button');
    b.className = 'acc-item' + (it.danger ? ' danger' : '');
    if (it.signout){ b.id = 'acc-signout'; b.style.display = 'none'; }
    b.innerHTML = iconHTML(it.icon) + '<span>' + esc(it.label) + '</span>';
    b.onclick = () => { close(); it.run(); };
    menu.appendChild(b);
  });
  btn.onclick = (e) => { e.stopPropagation(); wrap.classList.toggle('open'); };
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
}
async function signInGoogle(){
  if (!fbAuth){ toast('Login indisponível (Firebase não configurado).', 'err'); return; }
  try{ await fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); toast('Conectado. Sincronizando…'); }
  catch(e){ toast('Falha no login: ' + e.message, 'err'); }
}
async function signOutGoogle(){ if (fbAuth){ await fbAuth.signOut(); toast('Desconectado. Dados continuam neste navegador.'); } }
function setSyncStatus(txt){ const el = document.getElementById('sync-status'); if (el) el.textContent = txt; }
function scheduleCloudSync(){
  if (!fbAuth?.currentUser || !fbDb) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(pushToCloud, 1500);
}
async function pushToCloud(){
  const user = fbAuth?.currentUser;
  if (!user || !fbDb) return;
  try{
    setSyncStatus('Sincronizando…');
    const payload = {
      conversations: JSON.parse(localStorage.getItem('vtz_conversations') || '[]'),
      agents: state.agents, skills: state.skills,
      globalPrompt: localStorage.getItem('vtz_global_prompt') || '',
      favorites: state.favorites,
      memories: state.memories,
      memoryGraph: state.memoryGraph,
      projects: state.projects,
      updatedAt: Date.now(),
    };
    await fbDb.collection('vtzllm_users').doc(user.uid).set(payload);
    setSyncStatus('Sincronizado ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}));
  }catch(e){ setSyncStatus('Erro no sync: ' + e.message); }
}
async function pullFromCloud(uid){
  if (!fbDb) return;
  try{
    setSyncStatus('Baixando da nuvem…');
    const doc = await fbDb.collection('vtzllm_users').doc(uid).get();
    if (!doc.exists){ await pushToCloud(); return; }
    const d = doc.data();
    if (Array.isArray(d.conversations)) localStorage.setItem('vtz_conversations', JSON.stringify(d.conversations));
    if (Array.isArray(d.agents)){ state.agents = d.agents; localStorage.setItem('vtz_agents', JSON.stringify(d.agents)); }
    if (Array.isArray(d.skills)){ state.skills = d.skills; localStorage.setItem('vtz_skills', JSON.stringify(d.skills)); }
    if (typeof d.globalPrompt === 'string') localStorage.setItem('vtz_global_prompt', d.globalPrompt);
    if (Array.isArray(d.favorites)){ state.favorites = d.favorites; localStorage.setItem('vtz_favorites', JSON.stringify(d.favorites)); }
    if (Array.isArray(d.memories)){ state.memories = d.memories; localStorage.setItem('vtz_memories', JSON.stringify(d.memories)); }
    if (d.memoryGraph && Array.isArray(d.memoryGraph.nodes)){
      state.memoryGraph = d.memoryGraph; localStorage.setItem('vtz_memory_graph', JSON.stringify(d.memoryGraph));
    } else if (Array.isArray(d.memories)){
      // nuvem antiga (só lista plana): reconstrói o grafo a partir dela
      localStorage.removeItem('vtz_memory_graph');
      state.memoryGraph = migrateMemoriesToGraph({ nodes:[], edges:[] });
    }
    if (Array.isArray(d.projects)){ state.projects = d.projects; localStorage.setItem('vtz_projects', JSON.stringify(d.projects)); }
    state.conversations = JSON.parse(localStorage.getItem('vtz_conversations') || '[]');
    renderProjectsBar(); renderHistoryList(); renderChat();
    setSyncStatus('Sincronizado ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}));
    toast('Dados da nuvem carregados.');
  }catch(e){ setSyncStatus('Erro ao baixar: ' + e.message); }
}

/* ---------- Diagnóstico de conexão ----------
   Testa, em ordem: chave presente → catálogo (/models) → chat não-stream → chat com stream.
   Mostra status HTTP e corpo do erro — é o que faltava pra saber por que "não responde". */
async function runDiagnostics(){
  const out = document.getElementById('diag-out');
  out.style.display = 'block';
  const log = [];
  const paint = () => { out.textContent = log.join('\n'); };
  const push = (ok, label, detail) => {
    log.push(`${ok === null ? '…' : ok ? '[OK]' : '[FALHA]'} ${label}${detail ? '\n     ' + detail : ''}`);
    paint();
  };

  log.push('Origem: ' + (location.origin || 'file:// (origin nulo)'));
  log.push('Protocolo: ' + location.protocol);
  if (location.protocol === 'file:'){
    log.push('     Aviso: em file:// alguns navegadores restringem fetch e streaming.');
    log.push('     Se falhar aqui, sirva por http (ex.: python3 -m http.server) e teste de novo.');
  }
  paint();

  // 1) chave
  if (!state.apiKey){ push(false, 'Chave da API ausente'); return; }
  push(true, `Chave presente (${state.apiKey.slice(0,8)}…, ${state.apiKey.length} chars)`);

  // 2) catálogo
  try{
    const r = await fetch(OR_BASE + '/models');
    if (!r.ok) push(false, `GET /models → HTTP ${r.status}`, (await r.text()).slice(0,160));
    else {
      const d = await r.json();
      push(true, `GET /models → ${d.data?.length ?? '?'} modelos (catálogo ao vivo)`);
    }
  }catch(e){ push(false, 'GET /models falhou', e.message + ' — provável CORS ou rede'); }

  const model = state.model === '__router__' ? (state.routerConfig.balanced || state.routerConfig.fast) : state.model;
  push(null, `Modelo em teste: ${model}`);

  // 3) chat sem streaming
  try{
    const r = await orFetch({ model, messages:[{role:'user', content:'responda apenas: ok'}], max_tokens: 5 });
    const body = await r.text();
    if (!r.ok) push(false, `POST /chat/completions (sem stream) → HTTP ${r.status}`, body.slice(0,220));
    else {
      let txt = '';
      try{ txt = JSON.parse(body).choices?.[0]?.message?.content ?? ''; }catch(_){}
      push(!!txt, `POST sem stream → HTTP 200`, txt ? `resposta: "${txt.trim().slice(0,40)}"` : 'HTTP 200 mas SEM texto: ' + body.slice(0,160));
    }
  }catch(e){ push(false, 'POST sem stream falhou', e.message); }

  // 4) chat com streaming
  try{
    const r = await orFetch({ model, messages:[{role:'user', content:'responda apenas: ok'}], max_tokens: 5, stream: true });
    if (!r.ok){ push(false, `POST com stream → HTTP ${r.status}`, (await r.text()).slice(0,220)); }
    else if (!r.body){ push(false, 'POST com stream → sem res.body', 'navegador não expõe o corpo em stream'); }
    else {
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let chunks = 0, acc = '', firstLine = '';
      const t0 = Date.now();
      while(Date.now() - t0 < 20000){
        const {done, value} = await reader.read();
        if (done) break;
        chunks++;
        const s = dec.decode(value, {stream:true});
        if (!firstLine) firstLine = s.split('\n').find(l => l.trim()) || '';
        for (const line of s.split('\n')){
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const p = t.slice(5).trim();
          if (p === '[DONE]'){ chunks = chunks; break; }
          try{ acc += JSON.parse(p).choices?.[0]?.delta?.content || ''; }catch(_){}
        }
        if (acc) break;
      }
      try{ await reader.cancel(); }catch(_){}
      push(!!acc, `POST com stream → ${chunks} chunk(s)`,
        acc ? `texto recebido: "${acc.trim().slice(0,40)}"`
            : 'nenhum texto extraído. 1a linha crua: ' + (firstLine.slice(0,140) || '(vazia)'));
    }
  }catch(e){ push(false, 'POST com stream falhou', e.message); }

  // 5) busca web (plugin do OpenRouter)
  try{
    const r = await orFetch({ model, messages:[{role:'user', content:'Qual a data de hoje segundo a web? Responda em 5 palavras.'}], max_tokens: 40, plugins:[{id:'web'}] });
    const body = await r.text();
    if (!r.ok) push(false, `Busca web → HTTP ${r.status}`, body.slice(0,200));
    else {
      let txt = '';
      try{ txt = JSON.parse(body).choices?.[0]?.message?.content ?? ''; }catch(_){}
      push(!!txt, 'Busca web (plugin :web)', txt ? `resposta: "${txt.trim().slice(0,60)}"` : 'HTTP 200 sem texto');
    }
  }catch(e){ push(false, 'Busca web falhou', e.message); }

  log.push('');
  log.push('Se "sem stream" funciona e "com stream" falha: desmarque Streaming acima.');
  log.push('Busca web custa ~US$0,02 por mensagem, à parte dos tokens.');
  paint();
}

/* ---------- Medidor de armazenamento (limite ~5MB por origem) ---------- */
function storageBytes(){
  let total = 0;
  for (const k in localStorage){
    if (Object.prototype.hasOwnProperty.call(localStorage, k)) total += (localStorage[k].length + k.length) * 2;
  }
  return total;
}
const STORAGE_LIMIT = 5 * 1024 * 1024;
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
/* FALLBACK_MODELS: só é usado se o fetch ao vivo do /models falhar.
   context_length aqui é o valor conhecido por família (snapshot 2026-07); quando o
   catálogo real carrega, ele sobrescreve estes números.
   (ex: sem internet, ou CORS bloqueado por algum motivo específico).
   Snapshot pesquisado em 2026-07-07 — vai ficar desatualizado com o tempo.
   NÃO é fonte de verdade: o fetch ao vivo acima já traz o catálogo completo
   e atualizado quando funciona. Isso é só rede de segurança. */
const FALLBACK_MODELS = [
  {id:'openai/gpt-5.5', name:'GPT-5.5', pricing:{prompt:'0.000005',completion:'0.00003'}, context_length:400000},
  {id:'openai/gpt-5.4', name:'GPT-5.4', pricing:{prompt:'0.0000025',completion:'0.000015'}, context_length:400000},
  {id:'openai/gpt-4.1', name:'GPT-4.1', pricing:{prompt:'0.000002',completion:'0.000008'}, context_length:1047576},
  {id:'openai/gpt-4.1-mini', name:'GPT-4.1 Mini', pricing:{prompt:'0.0000004',completion:'0.0000016'}, context_length:1047576},
  {id:'openai/gpt-4.1-nano', name:'GPT-4.1 Nano', pricing:{prompt:'0.0000001',completion:'0.0000004'}, context_length:1047576},
  {id:'openai/o4-mini', name:'o4-mini', pricing:{prompt:'0.0000011',completion:'0.0000044'}, context_length:200000},
  {id:'openai/o3-mini', name:'o3-mini', pricing:{prompt:'0.0000011',completion:'0.0000044'}, context_length:200000},
  {id:'openai/gpt-3.5-turbo', name:'GPT-3.5 Turbo', pricing:{prompt:'0.000001',completion:'0.000002'}, context_length:16385},
  {id:'openai/gpt-image-1', name:'GPT Image 1', pricing:{prompt:'0.00001',completion:'0.00001'}, architecture:{output_modalities:['image','text']}, context_length:4096},
  {id:'openai/gpt-image-1-mini', name:'GPT Image 1 Mini', pricing:{prompt:'0.0000025',completion:'0.0000025'}, architecture:{output_modalities:['image','text']}, context_length:4096},
  {id:'openai/gpt-image-2', name:'GPT Image 2', pricing:{prompt:'0.000008',completion:'0.000008'}, architecture:{output_modalities:['image','text']}, context_length:4096},
  {id:'anthropic/claude-opus-4.8', name:'Claude Opus 4.8', pricing:{prompt:'0.000005',completion:'0.000025'}, context_length:200000},
  {id:'anthropic/claude-sonnet-5', name:'Claude Sonnet 5', pricing:{prompt:'0.000002',completion:'0.00001'}, context_length:200000},
  {id:'anthropic/claude-sonnet-4.6', name:'Claude Sonnet 4.6', pricing:{prompt:'0.000003',completion:'0.000015'}, context_length:200000},
  {id:'anthropic/claude-haiku-4.5', name:'Claude Haiku 4.5', pricing:{prompt:'0.000001',completion:'0.000005'}, context_length:200000},
  {id:'anthropic/claude-haiku-3.5', name:'Claude Haiku 3.5', pricing:{prompt:'0.0000008',completion:'0.000004'}, context_length:200000},
  {id:'anthropic/claude-haiku-3', name:'Claude Haiku 3', pricing:{prompt:'0.00000025',completion:'0.00000125'}, context_length:200000},
  {id:'anthropic/claude-fable-5', name:'Claude Fable 5', pricing:{prompt:'0.00001',completion:'0.00005'}, context_length:128000},
  {id:'anthropic/claude-3.5-sonnet', name:'Claude 3.5 Sonnet', pricing:{prompt:'0.000003',completion:'0.000015'}, context_length:128000},
  {id:'google/gemini-3.1-pro', name:'Gemini 3.1 Pro', pricing:{prompt:'0.000002',completion:'0.000012'}, context_length:1048576},
  {id:'google/gemini-3.5-flash', name:'Gemini 3.5 Flash', pricing:{prompt:'0.0000015',completion:'0.000009'}, context_length:1048576},
  {id:'google/gemini-3.1-flash-lite', name:'Gemini 3.1 Flash Lite', pricing:{prompt:'0.00000025',completion:'0.0000015'}, context_length:1048576},
  {id:'google/gemini-2.5-flash', name:'Gemini 2.5 Flash', pricing:{prompt:'0.0000003',completion:'0.0000012'}, context_length:1048576},
  {id:'google/gemini-2.5-flash-image', name:'Nano Banana (Gemini 2.5 Flash Image)', pricing:{prompt:'0.0000003',completion:'0.0000012'}, architecture:{output_modalities:['image','text']}, context_length:1048576},
  {id:'google/gemini-3.1-flash-image-preview', name:'Nano Banana 2 (Gemini 3.1 Flash Image)', pricing:{prompt:'0.0000003',completion:'0.0000012'}, architecture:{output_modalities:['image','text']}, context_length:1048576},
  {id:'google/gemini-3.1-flash-lite-image', name:'Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)', pricing:{prompt:'0.0000002',completion:'0.0000008'}, architecture:{output_modalities:['image','text']}, context_length:1048576},
  {id:'google/gemini-3-pro-image', name:'Nano Banana Pro (Gemini 3 Pro Image)', pricing:{prompt:'0.000002',completion:'0.000012'}, architecture:{output_modalities:['image','text']}, context_length:1048576},
  {id:'deepseek/deepseek-v4-flash', name:'DeepSeek V4 Flash', pricing:{prompt:'0.00000014',completion:'0.00000028'}, context_length:164000},
  {id:'deepseek/deepseek-r1', name:'DeepSeek R1', pricing:{prompt:'0.0000006',completion:'0.0000024'}, context_length:164000},
  {id:'deepseek/deepseek-r1:free', name:'DeepSeek R1 (free)', pricing:{prompt:'0',completion:'0'}, context_length:164000},
  {id:'meta-llama/llama-3.3-70b-instruct', name:'Llama 3.3 70B', pricing:{prompt:'0.00000013',completion:'0.0000004'}, context_length:131072},
  {id:'meta-llama/llama-3.3-70b-instruct:free', name:'Llama 3.3 70B (free)', pricing:{prompt:'0',completion:'0'}, context_length:131072},
  {id:'x-ai/grok-4.3', name:'Grok 4.3', pricing:{prompt:'0.00000125',completion:'0.0000025'}, context_length:256000},
  {id:'qwen/qwen3.7-max', name:'Qwen3.7 Max', pricing:{prompt:'0.0000025',completion:'0.0000075'}, context_length:262144},
  {id:'z-ai/glm-5.2', name:'GLM-5.2', pricing:{prompt:'0.0000014',completion:'0.0000044'}, context_length:200000},
  {id:'z-ai/glm-4.7-flash', name:'GLM-4.7 Flash (free)', pricing:{prompt:'0',completion:'0'}, context_length:200000},
  {id:'minimax/minimax-m3', name:'MiniMax M3', pricing:{prompt:'0.0000006',completion:'0.0000024'}, context_length:1000000},
  {id:'black-forest-labs/flux.2-pro', name:'FLUX.2 Pro', pricing:{prompt:'0',completion:'0'}, architecture:{output_modalities:['image']}, context_length:128000},
  {id:'bytedance-seed/seedream-4.5', name:'Seedream 4.5', pricing:{prompt:'0',completion:'0'}, architecture:{output_modalities:['image']}, context_length:128000},
  {id:'x-ai/grok-imagine-image-quality', name:'Grok Imagine Image Quality', pricing:{prompt:'0',completion:'0'}, architecture:{output_modalities:['image']}, context_length:256000},
];

async function fetchModels(){
  try{
    const res = await fetch(OR_BASE + '/models');
    const data = await res.json();
    state.models = data.data || [];
    if (!state.models.length) throw new Error('resposta vazia');
  }catch(e){
    console.error('Fetch ao vivo falhou, usando fallback datado (2026-07-07):', e);
    state.models = FALLBACK_MODELS;
  }
  if (!state.model && state.models.length) state.model = state.models[0].id;
  updateModelLabel();
  renderPickerTabs();
  populateImageModelSelect();
  pickDefaultRouterConfig();
  populateRouterSelects();
  updateSessionPanel();
}
function isImageModel(m){
  const outs = m.architecture?.output_modalities
    || m.architecture?.modality?.split('->')[1]?.split('+')
    || [];
  return outs.includes('image');
}
function updateModelLabel(){
  const SPECIAL = { '__router__':'RouteLLM', '__router_free__':'RouteLLM Free', '__fusion__':'Fusion' };
  if (SPECIAL[state.model]){
    document.getElementById('current-model-label').innerHTML = `<span style="display:inline-flex; margin-right:5px; vertical-align:-3px; color:var(--violet);">${iconHTML('shuffle')}</span>${SPECIAL[state.model]}`;
    return;
  }
  const m = state.models.find(x => x.id === state.model);
  document.getElementById('current-model-label').textContent = m ? (m.name || m.id) : (state.model || 'Selecionar modelo');
}
function getModelPricing(modelId){
  const m = state.models.find(x => x.id === modelId);
  if (!m || !m.pricing) return {prompt:0, completion:0};
  return { prompt: parseFloat(m.pricing.prompt||0), completion: parseFloat(m.pricing.completion||0) };
}
function populateImageModelSelect(){
  const imgs = state.models.filter(isImageModel);
  state.imageModels = imgs.length ? imgs.map(m => ({id:m.id, name:m.name||m.id})) : [
    {id:'google/gemini-2.5-flash-image', name:'Nano Banana (Gemini 2.5 Flash Image)'},
  ];
  const sel = document.getElementById('image-model-select');
  sel.innerHTML = '';
  state.imageModels.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = m.name;
    sel.appendChild(opt);
  });
}

/* ---------- Model picker overlay ---------- */
function openPicker(){
  document.getElementById('picker-overlay').classList.add('open');
  document.getElementById('picker-search-input').value = '';
  renderPickerTabs();
  renderPickerSorts();
  renderPickerList();
}
function closePicker(){ document.getElementById('picker-overlay').classList.remove('open'); }
function renderPickerTabs(){
  const all = state.models.length;
  const imgs = state.models.filter(isImageModel).length;
  const txt = all - imgs;
  const favs = state.favorites.filter(id => state.models.some(m => m.id === id)).length;
  const tabs = [ ['all','Todos',all], ['fav','★ Favoritos',favs], ['text','Texto',txt], ['image','Imagem',imgs] ];
  const el = document.getElementById('picker-tabs');
  el.innerHTML = '';
  tabs.forEach(([key,label,count]) => {
    const btn = document.createElement('button');
    btn.className = 'picker-tab' + (state.pickerTab === key ? ' active' : '');
    btn.textContent = `${label} ${count}`;
    btn.onclick = () => { state.pickerTab = key; renderPickerTabs(); renderPickerList(); };
    el.appendChild(btn);
  });
}
function renderPickerSorts(){
  const el = document.getElementById('picker-sorts');
  el.innerHTML = '';
  // chip "Padrão" = limpar combinação
  const def = document.createElement('button');
  def.className = 'picker-tab' + (state.pickerSorts.length === 0 ? ' active' : '');
  def.textContent = 'Padrão';
  def.onclick = () => { state.pickerSorts = []; renderPickerSorts(); renderPickerList(); };
  el.appendChild(def);

  SORT_PRESETS.forEach(p => {
    const pos = state.pickerSorts.indexOf(p.key); // -1, 0 ou 1
    const btn = document.createElement('button');
    btn.className = 'picker-tab' + (pos >= 0 ? ' active' : '');
    // mostra a ordem quando há 2 combinados (1 = primário, 2 = desempate)
    btn.innerHTML = esc(p.label) + (pos >= 0 && state.pickerSorts.length > 1 ? ` <span class="sort-order">${pos+1}</span>` : '');
    btn.onclick = () => { togglePickerSort(p.key); renderPickerSorts(); renderPickerList(); };
    el.appendChild(btn);
  });
}
function renderPickerList(){
  const q = document.getElementById('picker-search-input').value.trim().toLowerCase();
  let list = state.models;
  if (state.pickerTab === 'image') list = list.filter(isImageModel);
  if (state.pickerTab === 'text') list = list.filter(m => !isImageModel(m));
  if (state.pickerTab === 'fav') list = list.filter(m => isFavorite(m.id));
  if (q) list = list.filter(m => m.id.toLowerCase().includes(q) || (m.name||'').toLowerCase().includes(q));

  const active = state.pickerSorts.map(k => SORT_PRESETS.find(p => p.key === k)).filter(Boolean);
  if (active.length){
    // filtros de todos os presets ativos se acumulam (ex: "Grátis" + "Codex")
    active.forEach(p => { if (p.filter) list = list.filter(p.filter); });
    // ordena em cascata: 1º critério manda; empate -> 2º critério desempata
    const cmps = active.filter(p => p.cmp).map(p => p.cmp);
    if (cmps.length){
      list = [...list].sort((a,b) => {
        for (const cmp of cmps){ const d = cmp(a,b); if (d !== 0) return d; }
        return 0;
      });
    }
  } else {
    // sem preset: favoritos sempre no topo
    list = [...list].sort((a,b) => (isFavorite(b.id)?1:0) - (isFavorite(a.id)?1:0));
  }

  const specials = [];
  if (state.pickerTab !== 'image' && state.pickerTab !== 'fav' && state.pickerSorts.length === 0){
    const match = (m) => !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
      || 'routellm fusion'.includes(q);
    [ROUTER_MODEL, ROUTER_FREE_MODEL, FUSION_MODEL].forEach(sp => { if (match(sp)) specials.push(sp); });
  }
  const displayList = [...specials, ...list];

  const el = document.getElementById('picker-list');
  el.innerHTML = '';
  if (!displayList.length){
    const empty = document.createElement('div');
    empty.className = 'picker-empty';
    empty.textContent = state.pickerTab === 'fav'
      ? 'Nenhum favorito ainda. Toque na estrela de um modelo pra fixar aqui.'
      : (state.pickerSorts.includes('free') ? 'Nenhum modelo grátis com esses filtros.' : 'Nenhum modelo encontrado.');
    el.appendChild(empty);
    return;
  }
  displayList.forEach(m => {
    const SPECIAL_DESC = {
      '__router__': 'roteia pra melhor IA da tarefa',
      '__router_free__': 'roteia só entre modelos grátis',
      '__fusion__': '2 IAs em paralelo, fundidas na melhor resposta',
    };
    const isSpecial = !!SPECIAL_DESC[m.id];
    const badge = isSpecial
      ? `<span class="provider-badge" style="background:var(--violet)">${iconHTML(m.id==='__fusion__'?'shuffle':'shuffle')}</span>`
      : providerBadgeHTML(m.id);
    const price = isSpecial ? '' : formatPriceBRL(m);
    const row = document.createElement('div');
    row.className = 'model-row' + (m.id === state.model ? ' selected' : '');
    row.innerHTML = `
      ${badge}
      <div class="model-info">
        <span class="name">${esc(m.name||m.id)}</span>
        <span class="id">${isSpecial ? SPECIAL_DESC[m.id] : esc(m.id)}</span>
        ${price ? `<span class="price">${price}</span>` : ''}
      </div>
      ${isSpecial ? '' : `<button class="fav-btn ${isFavorite(m.id)?'faved':''}" title="Favoritar">${isFavorite(m.id)?'★':'☆'}</button>`}
      ${m.id === state.model ? '<span class="check">✓</span>' : ''}
    `;
    const favBtn = row.querySelector('.fav-btn');
    if (favBtn){
      favBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(m.id);
        renderPickerTabs();
        renderPickerList();
      };
    }
    row.onclick = () => {
      state.model = m.id;
      localStorage.setItem('vtz_or_model', state.model);
      updateModelLabel();
      updateCtxMeter();
      closePicker();
    };
    el.appendChild(row);
  });
}

/* ---------- Chat rendering ---------- */
/* Config em abas (estilo painel de configurações): navegação à esquerda,
   painel à direita. Os grupos têm data-cat; a nav mostra/esconde por categoria. */
function setupConfigNav(){
  const nav = document.getElementById('cfg-nav');
  if (!nav) return;
  const cats = [
    { section:'Configurações' },
    { cat:'conexao',   label:'Geral',          icon:'sliders' },
    { cat:'conta',     label:'Conta',          icon:'bank' },
    { cat:'custo',     label:'Cobrança & Uso', icon:'chart' },
    { cat:'respostas', label:'Respostas',      icon:'sparkle' },
    { cat:'dados',     label:'Dados & Backup', icon:'folder' },
    { cat:'backend',   label:'Backend VTz OS', icon:'cpu' },
    { section:'Personalizar' },
    { cat:'skills',    label:'Habilidades',    icon:'zap' },
    { cat:'conectores',label:'Conectores',     icon:'globe' },
    { cat:'mcps',      label:'MCPs',           icon:'paperclip' },
  ];
  const groups = [...document.querySelectorAll('#config-view .cfg-group')];
  const show = (cat) => {
    groups.forEach(g => { g.hidden = g.dataset.cat !== cat; });
    nav.querySelectorAll('.cfg-nav-item').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    if (cat === 'dados') updateStorageMeter();
  };
  nav.innerHTML = '';
  cats.forEach(c => {
    if (c.section){
      const l = document.createElement('div');
      l.className = 'cfg-nav-label';
      l.textContent = c.section;
      nav.appendChild(l);
      return;
    }
    const b = document.createElement('button');
    b.className = 'cfg-nav-item';
    b.dataset.cat = c.cat;
    b.innerHTML = iconHTML(c.icon) + '<span>' + esc(c.label) + '</span>';
    b.onclick = () => show(c.cat);
    nav.appendChild(b);
  });
  show('conexao');

  // dica de rolagem (mobile): esconde o degradê quando não há mais o que rolar.
  // a view começa display:none (largura 0), então além de recalcular no
  // scroll/resize, switchView('config') também chama isso quando a aba abre.
  nav.addEventListener('scroll', updateCfgNavScrollHint);
  window.addEventListener('resize', updateCfgNavScrollHint);
  updateCfgNavScrollHint();
}
function updateCfgNavScrollHint(){
  const nav = document.getElementById('cfg-nav');
  const shell = nav?.closest('.cfg-shell');
  if (!nav || !shell) return;
  const hasMore = nav.scrollWidth - nav.clientWidth - nav.scrollLeft > 4;
  shell.classList.toggle('cfg-nav-end', !hasMore);
}

/* ---------- Biblioteca skills.sh + instalação por URL ---------- */
async function loadSkillsLibrary(){
  const box = document.getElementById('skillsh-list');
  if (!backendUrl()){ box.innerHTML = '<p class="hint">Procurando o backend local…</p>'; await autoDetectBackend(); }
  if (!backendUrl()){
    box.innerHTML = '<p class="hint">Backend não encontrado. Rode o backend (run.bat) ou configure a URL na aba Backend. Sem ele, use a instalação por URL abaixo.</p>';
    return;
  }
  box.innerHTML = '<p class="hint">Carregando catálogo…</p>';
  try{
    const d = await fetch(backendUrl() + '/api/skillsh', { headers: backendHeaders() }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    const items = d.skills || [];
    if (!items.length){ box.innerHTML = '<p class="hint">Catálogo vazio — o skills.sh pode ter mudado o formato. Use a instalação por URL.</p>'; return; }
    box.innerHTML = '';
    items.slice(0, 40).forEach(it => {
      const row = document.createElement('div');
      row.className = 'skl-item';
      row.innerHTML = `<span class="skl-name">${esc(it.name)}</span>` +
        (it.desc ? `<span class="skl-desc">${esc(it.desc)}</span>` : '') +
        `<a class="skl-open" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">Abrir ↗</a>`;
      box.appendChild(row);
    });
    const note = document.createElement('p');
    note.className = 'hint'; note.style.marginTop = '8px';
    note.textContent = 'Abra a skill no skills.sh, copie o link RAW do SKILL.md dela (no GitHub) e cole abaixo pra instalar.';
    box.appendChild(note);
  }catch(e){ box.innerHTML = '<p class="hint">Falha ao carregar: ' + esc(e.message) + '</p>'; }
}
/* Instala uma skill de um SKILL.md raw do GitHub (CORS liberado no raw). */
/* núcleo compartilhado: baixa um SKILL.md cru, parseia e adiciona às skills.
   Usado tanto pela aba Config (instalar por URL) quanto pelos comandos do chat. */
/* baixa 1 SKILL.md cru (rápido: aborta em 6s). Retorna {url, text} ou lança. */
async function fetchSkillMarkdown(rawUrl){
  const url = rawUrl.replace(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\//, 'https://raw.githubusercontent.com/$1/$2/');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try{
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    if (text.length > 60000) throw new Error('arquivo grande demais pra uma skill');
    return { url, text };
  } finally { clearTimeout(t); }
}
/* parseia o markdown de uma skill e adiciona ao estado (sem rede). */
function addSkillFromMarkdown(text, url){
  let name = '', desc = '';
  const fm = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fm){
    name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '') || '';
    desc = (fm[1].match(/^description:\s*(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '') || '';
  }
  if (!name){
    const h1 = text.match(/^#\s+(.+)$/m);
    name = h1 ? h1[1].trim() : (url.split('/').slice(-2, -1)[0] || 'Skill importada');
  }
  const trigger = deriveSkillKeywords(name, desc, fm ? fm[1] : '');
  const skill = { id: uid(), name: name.slice(0, 60), trigger, instructions: text, active:false, _sourceUrl: url, _desc: desc.slice(0, 200) };
  state.skills.push(skill);
  persistSkills();
  if (typeof renderSkills === 'function') renderSkills();
  return skill;
}
async function installSkillFromRawUrl(rawUrl){
  const { url, text } = await fetchSkillMarkdown(rawUrl);
  return addSkillFromMarkdown(text, url);
}
/* Testa TODAS as URLs candidatas em paralelo e instala a 1ª que responder um
   SKILL.md válido — muito mais rápido que tentar uma de cada vez. */
async function installSkillFromCandidates(candidates){
  const attempts = candidates.map(u => fetchSkillMarkdown(u));
  let hit;
  try{ hit = await Promise.any(attempts); }
  catch(_){ return null; }  // nenhuma respondeu
  return addSkillFromMarkdown(hit.text, hit.url);
}
/* Gera palavras-chave (trigger) automaticamente ao instalar uma skill.
   1º: campos explícitos no frontmatter (keywords/triggers/tags), inline ou lista YAML.
   2º: deriva de name + description, tirando palavras vazias (PT+EN) e curtas. */
function deriveSkillKeywords(name, desc, fmBody){
  const clean = (s) => s.trim().replace(/^["'\[]|["'\]]$/g, '').toLowerCase();
  if (fmBody){
    // inline: "keywords: a, b, c"  ou  "tags: [a, b]"  (whitespace horizontal só,
    // pra não atravessar a quebra de linha e capturar a 1ª linha de uma lista YAML)
    const inline = fmBody.match(/^[ \t]*(?:keywords|triggers|tags)[ \t]*:[ \t]*(\S.*)$/im);
    if (inline && inline[1].trim() && !inline[1].trim().startsWith('#')){
      const kws = inline[1].replace(/^\[|\]$/g, '').split(/[,;]/).map(clean).filter(Boolean);
      if (kws.length) return [...new Set(kws)].slice(0, 12).join(', ');
    }
    // lista YAML multilinha: "keywords:\n  - a\n  - b"
    const ml = fmBody.match(/^\s*(?:keywords|triggers|tags)\s*:\s*\n((?:\s*-\s*.+\n?)+)/im);
    if (ml){
      const kws = ml[1].split('\n').map(l => clean(l.replace(/^\s*-\s*/, ''))).filter(Boolean);
      if (kws.length) return [...new Set(kws)].slice(0, 12).join(', ');
    }
  }
  // fallback: deriva de name + description
  const STOP = new Set(('a,o,e,de,da,do,das,dos,para,por,com,sem,que,uma,um,as,os,no,na,nos,nas,em,ao,à,se,ou,mais,seu,sua,como,quando,' +
    'the,and,for,with,without,that,this,your,you,use,uses,used,using,when,how,what,to,of,in,on,is,are,be,as,it,at,an,or,from,by,its,into,can,will,help,helps,skill,skills,agent').split(','));
  const text = (name + ' ' + desc).toLowerCase();
  const words = text.match(/[a-zà-ú0-9][a-zà-ú0-9.\-]{2,}/gi) || [];
  const seen = new Set(), out = [];
  for (const w of words){
    const c = w.replace(/[.\-]+$/, '');
    if (c.length < 3 || STOP.has(c) || seen.has(c)) continue;
    seen.add(c); out.push(c);
    if (out.length >= 8) break;
  }
  return out.join(', ');
}
async function installSkillFromUrl(){
  const input = document.getElementById('skill-url-input');
  const url = input.value.trim();
  if (!url){ toast('Cole a URL do SKILL.md primeiro.', 'warn'); return; }
  try{
    const s = await installSkillFromRawUrl(url);
    input.value = '';
    toast(`Skill "${s.name}" instalada. Ative na aba Skills (switch) ou defina palavras-chave.`);
  }catch(e){ toast('Falha ao instalar: ' + e.message, 'err'); }
}

/* Resolve a "fonte" de uma skill (repo do GitHub + nome, ou URL crua) numa
   lista de URLs candidatas de SKILL.md pra tentar em ordem. */
function resolveSkillCandidates(src, skillName){
  const out = [];
  // já é um SKILL.md cru ou um blob do GitHub → usa direto
  if (/SKILL\.md(\?|#|$)/i.test(src) || /\/blob\//.test(src) || /raw\.githubusercontent\.com/.test(src)){
    out.push(src);
    if (!skillName) return out;
  }
  // repo do GitHub (URL completa) ou "owner/repo"
  const m = src.match(/github\.com\/([^/]+)\/([^/#?]+)/i) || src.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m){
    const owner = m[1], repo = m[2].replace(/\.git$/, '');
    for (const br of ['main', 'master']){
      if (skillName){
        out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${br}/${skillName}/SKILL.md`);
        out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${br}/skills/${skillName}/SKILL.md`);
        out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${br}/.claude/skills/${skillName}/SKILL.md`);
      } else {
        out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${br}/SKILL.md`);
      }
    }
  }
  return [...new Set(out)];
}

/* Comandos de skill no chat: `npx skills add <repo> --skill <nome>`, `/skill list`, etc.
   Não roda npx de verdade (o navegador não tem Node) — o site reconhece a sintaxe e
   faz o equivalente: resolve o SKILL.md, baixa e instala. */
function parseSkillCommand(raw){
  const rest = raw.trim().replace(/^npx\s+skills\b/i, '').replace(/^\/skills?\b/i, '').trim();
  const tokens = rest.split(/\s+/).filter(Boolean);
  const sub = (tokens.shift() || 'help').toLowerCase();
  let skillName = '';
  const args = [];
  for (let i = 0; i < tokens.length; i++){
    if (tokens[i] === '--skill' || tokens[i] === '-s') skillName = tokens[++i] || '';
    else args.push(tokens[i]);
  }
  return { sub, args, skillName };
}
async function handleSkillCommand(raw, conv){
  conv.messages.push({ role:'user', content: raw, _local:true, ts: Date.now() });
  const reply = (md) => {
    conv.messages.push({ role:'assistant', content: md, _local:true, ts: Date.now() });
    conv.updatedAt = Date.now();
    renderChat(); persistConversations(); renderHistoryList();
  };
  const findSkill = (q) => {
    q = (q || '').toLowerCase();
    return state.skills.find(x => x.name.toLowerCase() === q) || state.skills.find(x => x.name.toLowerCase().includes(q));
  };
  const { sub, args, skillName } = parseSkillCommand(raw);

  if (sub === 'add' || sub === 'install'){
    const src = args[0];
    if (!src) return reply('**Uso:** `npx skills add <repo-ou-url> --skill <nome>`\n\nEx.: `npx skills add https://github.com/microsoft/azure-skills --skill azure-quotas`');
    const candidates = resolveSkillCandidates(src, skillName);
    if (!candidates.length) return reply('Não entendi a fonte. Passe um repo do GitHub (`owner/repo` ou URL) com `--skill <nome>`, ou a URL crua de um `SKILL.md`.');
    reply(`⏳ Instalando skill de \`${esc(src)}\`${skillName ? ' (`'+esc(skillName)+'`)' : ''}…`);
    const installed = await installSkillFromCandidates(candidates);
    // remove a mensagem "instalando" antes de dar o resultado final
    conv.messages.pop();
    if (installed){
      const kw = installed.trigger ? `\n\n🔑 Palavras-chave (disparo automático): \`${esc(installed.trigger)}\`` : '';
      reply(`✅ Skill **${esc(installed.name)}** instalada.${installed._desc ? '\n\n_'+esc(installed._desc)+'_' : ''}${kw}\n\nJá dispara sozinha quando essas palavras aparecem na conversa — ou ative de vez com \`/skill on ${esc(installed.name)}\`. Ajuste as palavras na aba **Skills**.`);
    } else {
      reply(`❌ Não achei o \`SKILL.md\`. Tentei:\n\n${candidates.map(c => '- `' + c + '`').join('\n')}\n\nConfira o nome em \`--skill\`, ou cole a URL crua do \`SKILL.md\` direto no \`add\`.`);
    }
    return;
  }
  if (sub === 'list' || sub === 'ls'){
    if (!state.skills.length) return reply('Nenhuma skill instalada ainda.\n\nInstale com `npx skills add <repo> --skill <nome>`.');
    const rows = state.skills.map(s => `- ${s.active ? '🟢' : '⚪'} **${esc(s.name)}**${s._desc ? ' — ' + esc(s._desc) : ''}`).join('\n');
    return reply(`**Skills instaladas (${state.skills.length}):**\n\n${rows}\n\n_🟢 ativa · ⚪ inativa. Use \`/skill on <nome>\` pra ativar._`);
  }
  if (sub === 'remove' || sub === 'rm' || sub === 'uninstall'){
    const s = findSkill(skillName || args.join(' '));
    if (!s) return reply(`Não achei essa skill. Veja \`/skill list\`.`);
    state.skills = state.skills.filter(x => x.id !== s.id);
    persistSkills(); if (typeof renderSkills === 'function') renderSkills();
    return reply(`🗑️ Skill **${esc(s.name)}** removida.`);
  }
  if (sub === 'on' || sub === 'enable' || sub === 'off' || sub === 'disable'){
    const s = findSkill(skillName || args.join(' '));
    if (!s) return reply(`Não achei essa skill. Veja \`/skill list\`.`);
    s.active = (sub === 'on' || sub === 'enable');
    persistSkills(); if (typeof renderSkills === 'function') renderSkills();
    return reply(`${s.active ? '🟢' : '⚪'} Skill **${esc(s.name)}** ${s.active ? 'ativada' : 'desativada'}.`);
  }
  return reply(`**Comandos de skills** (digite no chat):\n\n- \`npx skills add <repo> --skill <nome>\` — instala do GitHub\n- \`/skill list\` — lista as instaladas\n- \`/skill on <nome>\` · \`/skill off <nome>\` — ativa/desativa\n- \`/skill remove <nome>\` — remove\n\nTambém aceita a URL crua de um \`SKILL.md\` direto no \`add\`.\n\n_Obs: não roda \`npx\` de verdade (o navegador não tem Node) — o site reconhece a sintaxe e baixa o \`SKILL.md\` do repo._`);
}
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
/* Super Gems — botões de ação rápida de um agente, acima do composer. */
function renderQuickActions(agent){
  const el = document.getElementById('quick-actions');
  if (!el) return;
  el.innerHTML = '';
  const actions = agent?.quickActions || [];
  if (!actions.length){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = 'qa-btn';
    b.textContent = a.label;
    b.title = a.prompt;
    b.onclick = () => {
      const input = document.getElementById('chat-input');
      input.value = a.prompt;
      sendMessage();
    };
    el.appendChild(b);
  });
}
function renderChat(){
  const conv = getCurrentConv();
  const log = document.getElementById('chat-log');
  const empty = document.getElementById('empty-state');
  log.innerHTML = '';

  const agent = conv?.agentId ? state.agents.find(a => a.id === conv.agentId) : null;
  renderQuickActions(agent);
  const greetEl = document.getElementById('empty-greeting');
  if (agent){
    greetEl.innerHTML = '';
    const iconSpan = document.createElement('span');
    iconSpan.style.cssText = 'display:inline-flex; margin-right:6px; color:var(--violet); vertical-align:-3px;';
    iconSpan.innerHTML = iconHTML(agent.icon);
    greetEl.appendChild(iconSpan);
    greetEl.appendChild(document.createTextNode(agent.name));
  } else {
    greetEl.textContent = 'Oi Victor, qual é o plano?';
  }
  document.getElementById('empty-sub').textContent = agent ? agent.desc : 'Chat multi-modelo via OpenRouter';

  if (!conv || !conv.messages.length){
    empty.style.display = 'flex';
    log.style.display = 'none';
    updateComposerState();
    return;
  }
  empty.style.display = 'none';
  log.style.display = 'flex';
  conv.messages.forEach((m, i) => {
    if (m.role === 'user' || m.role === 'assistant'){
      if (m._router) appendRouterBadge(m._router, null, null, true);
      appendMessageDOM(m.role, m.content, false, i);
    }
  });
  log.scrollTop = log.scrollHeight;
  updateComposerState();
  updateCtxMeter();
}
function safeRenderMarkdown(content){
  if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined'){
    try{ return DOMPurify.sanitize(marked.parse(content || '')); }
    catch(e){ console.error('Erro no parse de markdown, usando fallback texto puro:', e); }
  }
  // Fallback: CDN de marked/DOMPurify não carregou (ad-blocker, firewall, offline).
  // Renderiza texto puro escapado em vez de travar a UI.
  const div = document.createElement('div');
  div.textContent = content || '';
  return div.innerHTML.replace(/\n/g, '<br>');
}
function appendRouterBadge(modelName, conv, beforeEl, fullText){
  if (conv && conv.id !== state.currentConvId) return null;
  const log = document.getElementById('chat-log');
  document.getElementById('empty-state').style.display = 'none';
  log.style.display = 'flex';
  const badge = document.createElement('div');
  badge.className = 'router-badge';
  const inner = fullText
    ? `<span class="rb-model">${esc(modelName)}</span>`
    : `RouteLLM <span style="color:var(--text-faint)">►</span> <span class="rb-model">${esc(modelName)}</span>`;
  badge.innerHTML = `<span class="rb-icon">${iconHTML('shuffle')}</span><span>${inner}</span>`;
  if (beforeEl && beforeEl.parentElement === log) log.insertBefore(badge, beforeEl);
  else log.appendChild(badge);
  return badge;
}

function appendMessageDOM(role, content, isTool, msgIndex){
  const empty = document.getElementById('empty-state');
  const log = document.getElementById('chat-log');
  empty.style.display = 'none';
  log.style.display = 'flex';

  if (isTool){
    const div = document.createElement('div');
    div.className = 'msg tool';
    div.innerHTML = safeRenderMarkdown(contentToText(content));
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  const isUser = role === 'user';
  const textContent = contentToText(content);
  const row = document.createElement('div');
  row.className = 'msg-row' + (isUser ? ' user' : '');

  const convForAv = getCurrentConv();
  const agentForAv = convForAv?.agentId ? state.agents.find(a => a.id === convForAv.agentId) : null;
  const av = document.createElement('div');
  av.className = 'msg-av ' + (isUser ? 'usr' : 'ai');
  av.innerHTML = isUser ? 'VH' : (agentForAv?.photo ? `<img src="${agentForAv.photo}" alt="">` : iconHTML('sparkle'));

  const body = document.createElement('div');
  body.className = 'msg-body';

  const sender = document.createElement('div');
  sender.className = 'msg-sender';
  sender.textContent = isUser ? 'Você' : 'VTz LLM';

  const bubble = document.createElement('div');
  bubble.className = 'msg ' + role;
  bubble.innerHTML = safeRenderMarkdown(textContent);
  if (!isUser) enhanceCodeBlocks(bubble);

  // nota de anexos (quando a mensagem tinha arquivos)
  const conv = getCurrentConv();
  const msgObj = (msgIndex != null && conv) ? conv.messages[msgIndex] : null;
  if (msgObj && msgObj._att && msgObj._att.length){
    const note = document.createElement('div');
    note.className = 'msg-att-note';
    note.textContent = 'anexos: ' + msgObj._att.join(', ');
    bubble.appendChild(note);
  }

  // fontes da busca web (estilo Claude: favicon + título, clicável)
  if (msgObj && msgObj._images && msgObj._images.length){
    const box = document.createElement('div');
    box.className = 'msg-images';
    const head = document.createElement('div');
    head.className = 'sources-head';
    head.innerHTML = iconHTML('image') + ` Imagens`;
    box.appendChild(head);
    const strip = document.createElement('div');
    strip.className = 'img-strip';
    msgObj._images.forEach(im => {
      const a = document.createElement('a');
      a.href = im.source || im.image; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.title = im.title || '';
      const img = document.createElement('img');
      img.src = im.thumbnail || im.image; img.alt = im.title || ''; img.loading = 'lazy';
      img.onerror = () => a.remove();
      a.appendChild(img);
      strip.appendChild(a);
    });
    box.appendChild(strip);
    bubble.appendChild(box);
  }

  if (msgObj && msgObj._sources && msgObj._sources.length){
    const sources = document.createElement('div');
    sources.className = 'msg-sources';
    const head = document.createElement('div');
    head.className = 'sources-head';
    head.innerHTML = iconHTML('globe') + ` ${msgObj._sources.length} fonte${msgObj._sources.length>1?'s':''} da web`;
    sources.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'sources-grid';
    msgObj._sources.forEach((s, i) => {
      let host = '';
      try{ host = new URL(s.url).hostname.replace('www.',''); }catch(_){ host = s.url; }
      const a = document.createElement('a');
      a.className = 'source-card';
      a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32" alt="" onerror="this.style.display='none'">`
        + `<span class="src-body"><span class="src-title">${esc(s.title || host)}</span><span class="src-host">${esc(host)}</span></span>`
        + `<span class="src-n">${i+1}</span>`;
      grid.appendChild(a);
    });
    sources.appendChild(grid);
    bubble.appendChild(sources);
    // Com backend: busca a og:image de cada fonte (o navegador não pega por CORS).
    if (backendUrl()){
      msgObj._sources.slice(0, 8).forEach((s, i) => {
        fetch(backendUrl() + '/api/scrape', {
          method:'POST', headers: backendHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify({ url: s.url }),
        }).then(r => r.ok ? r.json() : null).then(d => {
          if (!d || !d.image) return;
          const card = grid.children[i]; if (!card) return;
          const img = document.createElement('img');
          img.className = 'src-thumb'; img.src = d.image; img.alt = ''; img.loading = 'lazy';
          img.onerror = () => { img.remove(); card.classList.remove('has-thumb'); };
          card.classList.add('has-thumb');
          card.insertBefore(img, card.firstChild);
        }).catch(() => {});
      });
    }
  }

  const acts = document.createElement('div');
  acts.className = 'msg-acts';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.innerHTML = iconHTML('copy') + ' Copiar';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(textContent).then(() => {
      copyBtn.innerHTML = iconHTML('copy') + ' Copiado';
      setTimeout(() => { copyBtn.innerHTML = iconHTML('copy') + ' Copiar'; }, 1500);
    }).catch(() => {});
  };
  acts.appendChild(copyBtn);

  // botão ⋯ abre o menu de ações (estilo Claude)
  if (msgIndex != null){
    const moreBtn = document.createElement('button');
    moreBtn.className = 'copy-btn';
    moreBtn.innerHTML = iconHTML('more');
    moreBtn.title = 'Mais ações';
    moreBtn.onclick = () => openMsgMenu(msgIndex);
    acts.appendChild(moreBtn);
  }

  body.appendChild(sender);
  body.appendChild(bubble);
  body.appendChild(acts);
  row.appendChild(av);
  row.appendChild(body);
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
  return row;
}

/* ---------- Menu de ações da mensagem ---------- */
function openMsgMenu(msgIndex){
  const conv = getCurrentConv();
  const msg = conv?.messages[msgIndex];
  if (!msg) return;
  const isAssistant = msg.role === 'assistant';
  const menu = document.getElementById('msg-menu');
  menu.innerHTML = '';

  const items = [
    { icon:'selectText', label:'Selecionar texto', run: () => openSelectText(contentToText(msg.content)) },
  ];
  if (!isAssistant) items.push({ icon:'edit', label:'Editar mensagem', run: () => openEditMsg(msgIndex) });
  const rawText = contentToText(msg.content);
  const blocks = extractCodeBlocks(rawText);
  items.push({ icon:'download', label:'Baixar mensagem (.md)', run: () => {
    downloadTextFile(`vtz-mensagem-${msgIndex+1}.md`, rawText);
  }});
  if (isAssistant && FS_CAN_SAVE){
    items.push({ icon:'download', label:'Salvar no computador…', run: () => {
      const first = blocks[0];
      const name = first ? guessFilename(first.code, first.lang, 1) : `vtz-${msgIndex+1}.md`;
      saveToDisk(first ? first.code : rawText, name);
    }});
    if (lastFileHandle){
      items.push({ icon:'download', label:`Salvar por cima de "${lastFileName}"`, run: () => {
        const first = blocks[0];
        saveOverLast(first ? first.code : rawText);
      }});
    }
  }
  items.push({ icon:'file', label:'Baixar PDF (formatado)', run: () => downloadRichPdf(rawText, `vtz-${msgIndex+1}.pdf`) });
  items.push({ icon:'file', label:'Baixar slides (PDF)', run: () => downloadSlidesPdf(rawText, `vtz-slides-${msgIndex+1}.pdf`) });
  items.push({ icon:'file', label:'Baixar como Word (.docx)', run: () => downloadDocx(rawText, `vtz-${msgIndex+1}.docx`) });
  if (extractMarkdownTables(rawText).length){
    items.push({ icon:'file', label:'Baixar tabela (.xlsx)', run: () => downloadXlsx(rawText, `vtz-${msgIndex+1}.xlsx`) });
  }
  if (blocks.length){
    items.push({ icon:'download', label:`Baixar código${blocks.length>1?'s':''} (${blocks.length} arquivo${blocks.length>1?'s':''})`, run: () => {
      blocks.forEach((b, i) => setTimeout(() => downloadTextFile(guessFilename(b.code, b.lang, i+1), b.code), i * 250));
      toast(`Baixando ${blocks.length} arquivo${blocks.length>1?'s':''}…`);
    }});
  }
  if (isAssistant){
    items.push({ icon:'volume', label:'Ouvir resposta', run: () => speakMessage(msg.content) });
    items.push({ icon:'refresh', label:'Regenerar', run: () => openRegenSheet(msgIndex) });
    items.push({ icon:'wand', label:'Humanizar', run: () => humanizeMessage(msgIndex) });
  }
  items.push({ icon:'thumbUp', label: msg._feedback==='up' ? 'Feedback positivo (registrado)' : 'Feedback positivo', done: msg._feedback==='up',
    run: () => { msg._feedback = msg._feedback==='up' ? null : 'up'; persistConversations(); } });
  items.push({ icon:'thumbDown', label: msg._feedback==='down' ? 'Feedback negativo (registrado)' : 'Feedback negativo', done: msg._feedback==='down',
    run: () => { msg._feedback = msg._feedback==='down' ? null : 'down'; persistConversations(); } });

  items.forEach(it => {
    const btn = document.createElement('button');
    btn.className = 'msg-menu-item' + (it.done ? ' done' : '');
    btn.innerHTML = iconHTML(it.icon) + ' ' + it.label;
    btn.onclick = () => { closeMsgMenu(); it.run(); };
    menu.appendChild(btn);
  });
  document.getElementById('msg-menu-overlay').classList.add('open');
}
function closeMsgMenu(){ document.getElementById('msg-menu-overlay').classList.remove('open'); }
function openSelectText(text){
  document.getElementById('select-text-area').value = text;
  document.getElementById('select-text-modal').style.display = 'flex';
}

/* Editar mensagem enviada: corrige o texto, descarta o que veio depois e refaz a resposta */
function openEditMsg(msgIndex){
  const conv = getCurrentConv();
  const msg = conv?.messages[msgIndex];
  if (!msg) return;
  if (state.gens[conv.id]){ toast('Aguarde ou interrompa a geração atual.', 'warn'); return; }
  const modal = document.getElementById('edit-msg-modal');
  document.getElementById('edit-msg-area').value = contentToText(msg.content);
  modal.dataset.msgIndex = String(msgIndex);
  // anexos não sobrevivem à edição (base64 não é persistido) — avisa em vez de perder em silêncio
  document.getElementById('edit-msg-note').style.display = Array.isArray(msg.content) ? 'block' : 'none';
  modal.style.display = 'flex';
  document.getElementById('edit-msg-area').focus();
}
async function saveEditMsg(){
  const modal = document.getElementById('edit-msg-modal');
  const idx = parseInt(modal.dataset.msgIndex, 10);
  const text = document.getElementById('edit-msg-area').value.trim();
  modal.style.display = 'none';
  if (!text) return;
  const conv = getCurrentConv();
  if (!conv || !conv.messages[idx]) return;
  conv.messages = conv.messages.slice(0, idx);
  conv.messages.push({ role:'user', content: text });
  conv.updatedAt = Date.now();
  persistConversations();
  renderChat();
  renderHistoryList();
  try{ await runChatLoop(0, conv); }
  catch(e){ if (e.name !== 'AbortError' && conv.id === state.currentConvId) appendMessageDOM('assistant', 'Erro: ' + e.message); }
}

/* ---------- Medidor de contexto ao vivo (tokens + custo estimado do próximo envio) ----------
   Estimativa: ~4 chars por token (heurística padrão pra pt/en). Não é o tokenizer exato
   do modelo — é aproximação declarada, suficiente pra avisar antes de ficar caro. */
function estimateTokens(text){ return Math.ceil((text || '').length / 4); }
function updateCtxMeter(){
  const el = document.getElementById('ctx-meter');
  if (!el) return;
  const chatView = document.getElementById('chat-view');
  if (!chatView || !chatView.classList.contains('active')) return;
  const conv = getCurrentConv();
  if (!conv){ el.textContent = ''; return; }
  let msgs = conv.messages;
  if (state.ctxWindow > 0 && msgs.length > state.ctxWindow) msgs = msgs.slice(-state.ctxWindow);
  const draft = document.getElementById('chat-input')?.value || '';
  const sys = buildSystemPrompt(conv) || '';
  let totalChars = sys.length + draft.length;
  for (const m of msgs){
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    totalChars += (typeof m.content === 'string') ? m.content.length : contentToText(m.content).length;
  }
  const tokens = Math.ceil(totalChars / 4);

  let modelId = conv.model || state.model;
  if (modelId === '__router__') modelId = state.routerConfig.balanced || state.routerConfig.fast || '';
  const m = state.models.find(x => x.id === modelId);
  const pricing = getModelPricing(modelId);
  const costBRL = tokens * pricing.prompt * state.usdToBrl;
  const ctxMax = m?.context_length || 0;

  const kt = tokens >= 1000 ? (tokens/1000).toFixed(1).replace('.',',') + 'k' : String(tokens);
  const maxTxt = ctxMax ? ' / ' + Math.round(ctxMax/1000) + 'k' : '';
  const custo = costBRL >= 0.01 ? ' · ~R$' + costBRL.toFixed(2).replace('.',',') : '';
  el.textContent = `~${kt}${maxTxt} tokens${custo}`;
  const pct = ctxMax ? tokens / ctxMax : 0;
  el.classList.toggle('warn', pct >= 0.7 && pct < 0.9);
  el.classList.toggle('danger', pct >= 0.9);
}

/* Sheet de escolha de modelo pra regenerar: mesmo modelo, favoritos e shortlist */
function openRegenSheet(msgIndex){
  const menu = document.getElementById('msg-menu');
  menu.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'msg-menu-title';
  title.textContent = 'Regenerar com qual modelo?';
  menu.appendChild(title);
  const conv = getCurrentConv();
  const curModel = conv?.model || state.model;
  const opts = [{ id:null, label:'Mesmo modelo' + (curModel === '__router__' ? ' (RouteLLM)' : '') }];
  const seen = new Set();
  state.favorites.forEach(id => {
    const m = state.models.find(x => x.id === id && !isImageModel(x));
    if (m && !seen.has(m.id)){ seen.add(m.id); opts.push({ id:m.id, label:'★ ' + (m.name || m.id) }); }
  });
  routerCandidates().forEach(c => {
    if (!seen.has(c.id)){ seen.add(c.id); const m = state.models.find(x => x.id === c.id); opts.push({ id:c.id, label:(m?.name || c.id) }); }
  });
  opts.slice(0, 9).forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'msg-menu-item';
    btn.innerHTML = iconHTML('refresh') + ' ' + esc(o.label);
    btn.onclick = () => { closeMsgMenu(); regenerateFrom(msgIndex, o.id); };
    menu.appendChild(btn);
  });
  document.getElementById('msg-menu-overlay').classList.add('open');
}
/* Regenerar: corta a conversa até antes da mensagem e refaz — com modelo opcional */
async function regenerateFrom(msgIndex, modelOverride){
  const conv = getCurrentConv();
  if (!conv) return;
  if (state.gens[conv.id]){ toast('Aguarde ou interrompa a geração atual.', 'warn'); return; }
  conv.messages = conv.messages.slice(0, msgIndex);
  persistConversations();
  renderChat();
  try{ await runChatLoop(0, conv, modelOverride || null); }
  catch(e){ if (e.name !== 'AbortError' && conv.id === state.currentConvId) appendMessageDOM('assistant', 'Erro: ' + e.message); }
}

/* Humanizar: reescreve a mensagem em tom mais natural via API e substitui o conteúdo.
   Registrado no mapa de gerações (abortável pelo botão parar) e com tratamento de
   modelos de raciocínio que devolvem content vazio. */
async function humanizeMessage(msgIndex){
  const conv = getCurrentConv();
  const msg = conv?.messages[msgIndex];
  if (!msg || !state.apiKey) return;
  if (state.gens[conv.id]){ toast('Aguarde ou interrompa a geração atual.', 'warn'); return; }
  const original = contentToText(msg.content);
  let effectiveModel = conv.model || state.model;
  if (effectiveModel === '__router__') effectiveModel = state.routerConfig.balanced || state.routerConfig.fast;
  if (!effectiveModel){ toast('Nenhum modelo disponível pra humanizar.', 'err'); return; }
  state.gens[conv.id] = new AbortController();
  updateComposerState();
  toast('Humanizando resposta…');
  let hDeadline = Date.now();
  const hWatchdog = setInterval(() => {
    if (Date.now() - hDeadline > STREAM_IDLE_MS){ try{ state.gens[conv.id]?.abort(); }catch(_){} }
  }, 1000);
  try{
    const res = await orFetch({ model: effectiveModel, messages:[
      { role:'system', content:'Você reescreve textos em português brasileiro num tom mais humano, natural e direto — como uma pessoa experiente escrevendo, sem clichês de IA ("é importante notar", "vale ressaltar"). Mantenha TODO o conteúdo, fatos, números e blocos de código intactos. Responda apenas com o texto reescrito.' },
      { role:'user', content: original }
    ]}, { signal: state.gens[conv.id].signal });
    if (!res.ok) throw new Error('API ' + res.status + ': ' + (await res.text()).slice(0,120));
    const data = await res.json();
    const rewritten = (data.choices?.[0]?.message?.content || '').trim();
    trackUsage(data.usage, effectiveModel, conv);
    if (!rewritten){
      toast('O modelo não retornou texto (comum em modelos de raciocínio) — tente outro modelo.', 'err');
      return;
    }
    msg.content = rewritten;
    persistConversations();
    if (conv.id === state.currentConvId) renderChat();
    toast('Resposta humanizada.');
  }catch(e){
    if (e.name === 'AbortError') toast('Humanização interrompida.', 'warn');
    else toast('Erro ao humanizar: ' + e.message, 'err');
  }finally{
    clearInterval(hWatchdog);
    delete state.gens[conv.id];
    updateComposerState();
  }
}

/* ---------- Send / loop ---------- */
async function sendMessage(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  const hasAtt = state.pendingAttachments.length > 0;
  if ((!text && !hasAtt) || !state.apiKey) return;
  input.value = '';
  input.style.height = 'auto';

  const conv = getCurrentConv();
  if (state.gens[conv.id]){ toast('Esta conversa já está gerando — interrompa ou aguarde.', 'warn'); return; }
  conv.draft = '';
  // easter egg /status: painel local, sem chamada de API
  if (text.trim() === '/status' && !hasAtt){
    const upMin = Math.max(1, Math.round((Date.now() - BOOT_TS) / 60000));
    const mName = state.model === '__router__' ? 'RouteLLM' : (state.models.find(m=>m.id===state.model)?.name || state.model);
    const totalMsgs = state.conversations.reduce((s,c)=> s + c.messages.filter(x=>x.role==='user'||x.role==='assistant').length, 0);
    const status = `**VTZ STATUS**\n- Modelo ativo: ${mName}\n- Sessão: ${upMin} min\n- Custo total: $${state.totalCost.toFixed(4)} (R$${(state.totalCost*state.usdToBrl).toFixed(2)})\n- Conversas: ${state.conversations.length} · Mensagens: ${totalMsgs}\n- Janela de contexto: ${state.ctxWindow || 'tudo'}\n- Tools: ${Object.keys(TOOLS).length} · Tema: ${state.theme}`;
    conv.messages.push({ role:'user', content:text, _local:true, ts:Date.now() });
    conv.messages.push({ role:'assistant', content:status, _local:true, ts:Date.now() });
    conv.updatedAt = Date.now();
    renderChat(); persistConversations();
    return;
  }
  // comandos de skill: `npx skills add ...`, `/skill list`, `/skills`, etc. (não chama a API)
  if (!hasAtt && /^(npx\s+skills|\/skills?)\b/i.test(text)){
    if (conv.title === 'Nova conversa') conv.title = 'Comandos de skill';
    await handleSkillCommand(text, conv);
    return;
  }
  let userMsg;
  if (hasAtt){
    const parts = [];
    if (text) parts.push({ type:'text', text });
    const names = [];
    for (const f of state.pendingAttachments){
      try{
        parts.push(await fileToPart(f));
        names.push(f.name);
      }catch(e){
        appendMessageDOM('assistant', 'Erro ao anexar ' + f.name + ': ' + e.message);
      }
    }
    userMsg = { role:'user', content: parts, _att: names, ts: Date.now() };
    state.pendingAttachments = [];
    renderAttachChips();
  } else {
    userMsg = { role:'user', content: text, ts: Date.now() };
  }

  conv.messages.push(userMsg);
  if (conv.title === 'Nova conversa') conv.title = (text || userMsg._att?.[0] || 'Anexo').slice(0,32);
  conv.updatedAt = Date.now();
  appendMessageDOM('user', userMsg.content, false, conv.messages.length - 1);
  persistConversations();
  renderHistoryList();

  try{ await runChatLoop(0, conv); }
  catch(e){
    if (e.name !== 'AbortError' && conv.id === state.currentConvId) appendMessageDOM('assistant', 'Erro: ' + e.message);
  }
}

/* ---------- RouteLLM 2.0: um modelo grátis/barato ESCOLHE a melhor IA pra tarefa ----------
   Diferente do tier fixo: o classificador recebe a mensagem + a lista de candidatos
   e devolve JSON com o modelo escolhido. Se falhar (rede, JSON inválido), cai na
   heurística antiga como rede de segurança. */
function routerCandidates(freeOnly){
  // shortlist de candidatos reais presentes no catálogo, com o "papel" de cada um
  const wanted = [
    ['claude-opus',   'código complexo, arquitetura, análise profunda'],
    ['claude-sonnet', 'código, escrita técnica, raciocínio'],
    ['gpt-5',         'raciocínio geral avançado'],
    ['deepseek-r1',   'raciocínio matemático, custo baixo'],
    ['gemini-3.5-flash', 'tarefas médias, rápido e barato'],
    ['gemini-2.5-flash', 'conversas simples, muito barato'],
    [':free',         'tarefas triviais, grátis'],
  ];
  const picks = [];
  for (const [pat, role] of wanted){
    const m = state.models.find(x => x.id.includes(pat) && !isImageModel(x));
    if (m && !picks.some(p => p.id === m.id)) picks.push({ id: m.id, role });
  }
  if (freeOnly) return freeCandidates();
  return picks;
}
/* Só modelos gratuitos, com um "papel" inferido do id — usado pelo RouteLLM Free */
function freeCandidates(){
  const free = state.models.filter(m => isFreeModel(m) && !isImageModel(m));
  const role = (id) => {
    const s = id.toLowerCase();
    if (s.includes('r1') || s.includes('reason') || s.includes('think')) return 'raciocínio e matemática';
    if (s.includes('coder') || s.includes('code')) return 'código';
    if (s.includes('70b') || s.includes('72b') || s.includes('large') || s.includes('405b')) return 'tarefas complexas';
    if (s.includes('mini') || s.includes('small') || s.includes('8b') || s.includes('flash')) return 'conversas rápidas';
    return 'uso geral';
  };
  // no máximo 12 candidatos pra não estourar o prompt do classificador
  return free.slice(0, 12).map(m => ({ id: m.id, role: role(m.id) }));
}
function isFreeModel(m){
  if (!m) return false;
  if (typeof m.id === 'string' && m.id.endsWith(':free')) return true;
  const p = m.pricing;
  return p && parseFloat(p.prompt||0) === 0 && parseFloat(p.completion||0) === 0;
}
async function classifyWithLLM(userText, signal, freeOnly){
  const candidates = routerCandidates(freeOnly);
  if (!candidates.length) return null;
  // classificador: sempre um modelo grátis (custo zero); senão o tier fast configurado
  const freeModel = state.models.find(m => isFreeModel(m) && !isImageModel(m));
  const classifier = freeModel?.id || state.routerConfig.fast;
  if (!classifier) return null;
  const listText = candidates.map(c => `- ${c.id} (${c.role})`).join('\n');
  const res = await orFetch({ model: classifier, messages:[
      { role:'system', content:`Você é um roteador de modelos de IA. Analise a tarefa do usuário e escolha o MELHOR modelo da lista abaixo, equilibrando qualidade e custo (não escolha modelo caro pra tarefa trivial).\n${listText}\nResponda APENAS com JSON válido: {"model":"<id exato da lista>"}` },
      { role:'user', content: userText.slice(0, 2000) }
    ]}, { signal });
  if (!res.ok) throw new Error('classificador falhou');
  const data = await res.json();
  const raw = (data.choices[0].message.content || '').replace(/```json|```/g,'').trim();
  const parsed = JSON.parse(raw);
  const chosen = candidates.find(c => c.id === parsed.model);
  return chosen ? chosen.id : null;
}

/* ---------- Fusion: 2 modelos EM PARALELO + fusão por um 3º barato ----------
   Sem o delay do debate sequencial: as duas respostas são pedidas ao mesmo tempo
   (Promise.all), então o tempo total ≈ o do modelo mais lento, não a soma. Um
   modelo grátis funde as duas na melhor versão. */
function fusionPair(){
  // um forte + um rápido/barato distinto, ambos presentes no catálogo
  const strong = state.models.find(m => /claude-opus|gpt-5\.5|claude-sonnet-5|gemini-3/.test(m.id) && !isImageModel(m))
              || state.models.find(m => !isImageModel(m) && !isFreeModel(m));
  const fast = state.models.find(m => /deepseek|gemini-2\.5-flash|gpt-5-mini|llama-3\.3/.test(m.id) && !isImageModel(m) && m.id !== strong?.id)
            || state.models.find(m => !isImageModel(m) && m.id !== strong?.id);
  return [strong, fast].filter(Boolean).map(m => m.id);
}
async function runFusion(conv, ctrl, thinking){
  const models = fusionPair();
  if (models.length < 2){ throw new Error('Preciso de ao menos 2 modelos no catálogo pra fundir.'); }
  const systemPrompt = buildSystemPrompt(conv);
  let base = sanitizeForApi(conv.messages);
  if (state.ctxWindow > 0 && base.length > state.ctxWindow){
    base = base.slice(-state.ctxWindow);
    while (base.length && base[0].role !== 'user') base.shift();
  }
  const msgs = systemPrompt ? [{role:'system', content: systemPrompt}, ...base] : base;

  thinking.update('Consultando 2 modelos em paralelo…');
  // dispara as duas ao MESMO tempo
  const calls = models.map(model =>
    orFetch({ model, messages: msgs }, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => ({ model, text: d?.choices?.[0]?.message?.content || '', usage: d?.usage }))
      .catch(() => ({ model, text: '', usage: null }))
  );
  const results = await Promise.all(calls);
  results.forEach(r => trackUsage(r.usage, r.model));
  const valid = results.filter(r => r.text.trim());
  if (!valid.length) throw new Error('Nenhum dos modelos respondeu.');
  if (valid.length === 1) return { text: valid[0].text, models, fusedBy: null };

  // funde com um modelo grátis (ou o fast do par se não houver free)
  const freeModel = state.models.find(m => isFreeModel(m) && !isImageModel(m));
  const fuser = freeModel?.id || models[1];
  thinking.update('Fundindo as respostas na melhor versão…');
  const lastUser = contentToText([...conv.messages].reverse().find(m => m.role==='user')?.content || '');
  const fuseSystem = `Você recebe a mesma pergunta respondida por ${valid.length} modelos de IA diferentes. Produza UMA resposta final, a melhor possível: combine os acertos de cada uma, corrija erros, elimine redundância e contradições. Responda no idioma da pergunta, direto, sem citar "modelo A/B" nem explicar que houve fusão — entregue só a resposta final.`;
  const fuseUser = `PERGUNTA:\n${lastUser}\n\n` + valid.map((r,i) => `RESPOSTA ${i+1} (${r.model}):\n${r.text}`).join('\n\n---\n\n');
  const fr = await orFetch({ model: fuser, messages:[
    { role:'system', content: fuseSystem },
    { role:'user', content: fuseUser }
  ]}, { signal: ctrl.signal });
  if (!fr.ok) return { text: valid[0].text, models, fusedBy: null }; // fusão falhou: devolve a melhor bruta
  const fd = await fr.json();
  trackUsage(fd.usage, fuser);
  const fused = fd.choices?.[0]?.message?.content?.trim();
  return { text: fused || valid[0].text, models, fusedBy: fused ? fuser : null };
}

async function runChatLoop(depth=0, convArg, modelOverride){
  if (depth > 5) return;
  const conv = convArg || getCurrentConv();

  // registra a geração desta conversa (trava o composer DELA; as outras ficam livres)
  if (depth === 0){
    state.gens[conv.id] = new AbortController();
    updateComposerState();
  }
  const ctrl = state.gens[conv.id];

  // "Pensando..." aparece imediatamente — inclusive durante o roteamento.
  // Fica FORA do try pra ser removido no finally, aconteça o que acontecer.
  const thinking = createThinkingRow(conv);
  let watchdog = null;
  try{
    /* Watchdog da requisição INTEIRA: cobre o roteamento, a espera pelos headers
       (caso mais comum de travamento) e o corpo do stream. Antes ele só nascia
       depois dos headers — um servidor mudo travava o "Pensando…" pra sempre. */
    let lastByte = Date.now();
    let timedOut = false;
    watchdog = setInterval(() => {
      if (Date.now() - lastByte > STREAM_IDLE_MS){ timedOut = true; try{ ctrl.abort(); }catch(_){} }
    }, 1000);
    const timeoutMsg = () => `A API não respondeu em ${STREAM_IDLE_MS/1000}s. Rode "Testar conexão" em Config.`;

    const baseModel = modelOverride || conv.model || state.model;

    // ---- Fusion: caminho próprio (paralelo + fusão), não usa streaming ----
    if (baseModel === '__fusion__' && depth === 0){
      const out = await runFusion(conv, ctrl, thinking);
      clearInterval(watchdog); watchdog = null;
      const label = out.fusedBy
        ? `Fusion: ${out.models.map(id => state.models.find(m=>m.id===id)?.name || id).join(' + ')} → fundido`
        : `Fusion: ${out.models.map(id => state.models.find(m=>m.id===id)?.name || id).join(' + ')}`;
      appendRouterBadge(label, conv, thinking.el, true);
      const assistantMsg = { role:'assistant', content: out.text, _router: label };
      conv.messages.push(assistantMsg);
      conv.updatedAt = Date.now();
      if (conv.id === state.currentConvId){ appendMessageDOM('assistant', out.text, false, conv.messages.length - 1); updateCtxMeter(); }
      persistConversations();
      renderHistoryList();
      return;
    }

    let effectiveModel = baseModel;
    if (baseModel === '__router__' || baseModel === '__router_free__'){
      const freeOnly = baseModel === '__router_free__';
      const lastUser = [...conv.messages].reverse().find(m => m.role === 'user');
      const userText = contentToText(lastUser?.content || '');
      if (depth === 0){
        let chosen = null;
        try{ chosen = await classifyWithLLM(userText, ctrl.signal, freeOnly); }
        catch(e){
          if (e.name === 'AbortError'){ toast(timedOut ? timeoutMsg() : 'Geração interrompida', timedOut ? 'err' : 'warn'); return; }
          console.warn('Router LLM falhou, usando heurística:', e.message);
        }
        if (!chosen){
          if (freeOnly){
            const fc = freeCandidates();
            chosen = fc[0]?.id;
          } else {
            const {modelId} = resolveRouterModel(userText);
            chosen = modelId;
          }
        }
        if (!chosen) throw new Error(freeOnly ? 'Nenhum modelo grátis disponível no catálogo.' : 'Roteamento falhou.');
        conv._routedModel = chosen;
        const chosenName = state.models.find(m => m.id === chosen)?.name || chosen;
        appendRouterBadge((freeOnly ? 'RouteLLM Free' : 'RouteLLM') + ' ► ' + chosenName, conv, thinking.el, true);
      }
      effectiveModel = conv._routedModel || state.routerConfig.balanced;
    }

    const systemPrompt = buildSystemPrompt(conv);
    let baseMessages = sanitizeForApi(conv.messages);
    // Janela de contexto: corta o histórico reenviado (sem isso o custo cresce
    // quadraticamente com o tamanho da conversa). 0 = enviar tudo.
    if (state.ctxWindow > 0 && baseMessages.length > state.ctxWindow){
      baseMessages = baseMessages.slice(-state.ctxWindow);
      while (baseMessages.length && baseMessages[0].role !== 'user') baseMessages.shift();
    }
    const apiMessages = systemPrompt ? [{role:'system', content: systemPrompt}, ...baseMessages] : baseMessages;

    const useStream = state.streamOn && !state.toolsEnabled; // tool-use exige resposta completa
    const body = { model: effectiveModel, messages: apiMessages };
    if (state.toolsEnabled) body.tools = Object.values(TOOLS).map(t => t.def);
    // Busca web nativa do OpenRouter: funciona com qualquer modelo (incl. :free).
    // Custo do plugin (~US$0,02/req) é cobrado pelo provedor e NÃO aparece no
    // contador de tokens — declarado no toast ao ativar.
    if (state.webSearch) body.plugins = [{ id: 'web' }];
    if (useStream){ body.stream = true; body.stream_options = { include_usage: true }; }

    let res;
    try{
      res = await orFetchRetry(body, { signal: ctrl.signal });
    }catch(e){
      if (e.name === 'AbortError'){ toast(timedOut ? timeoutMsg() : 'Geração interrompida', timedOut ? 'err' : 'warn'); return; }
      throw e;
    }
    lastByte = Date.now(); // headers chegaram
    if (!res.ok){
      const errBody = (await res.text()).slice(0,300);
      throw new Error(`API ${res.status} — ${errBody || 'sem detalhe'}`);
    }

    /* ---- Streaming (chat normal) ---- */
    if (useStream){
      if (!res.body) throw new Error('Streaming indisponível — desative o streaming em Config.');
      let acc = '', usage = null, lastPaint = 0, aborted = false, annotations = [];
      try{
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        outer: while(true){
          const {done, value} = await reader.read();
          if (done) break;
          lastByte = Date.now();
          buf += dec.decode(value, {stream:true});
          let nl;
          while((nl = buf.indexOf('\n')) >= 0){
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line || line.startsWith(':')) continue;        // keep-alive do OpenRouter
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') break outer;              // não espera o socket fechar
            let obj;
            try{ obj = JSON.parse(payload); }
            catch(_){ continue; }                                // linha parcial
            if (obj.error) throw new Error(obj.error.message || 'erro do provedor');
            const dmsg = obj.choices?.[0]?.delta;
            const delta = dmsg?.content;
            // fontes da busca web chegam como annotations no delta
            if (dmsg?.annotations?.length){
              for (const an of dmsg.annotations){
                const u = an.url_citation || an;
                if (u?.url && !annotations.some(x => x.url === u.url)) annotations.push({ url:u.url, title:u.title || u.url });
              }
              if (!acc){
                const hosts = annotations.slice(0,4).map(a => { try{ return new URL(a.url).hostname.replace('www.',''); }catch(_){ return ''; } }).filter(Boolean);
                thinking.update('Pesquisando na web… ' + hosts.join(' · '));
              }
            }
            if (delta){
              acc += delta;
              const now = Date.now();
              if (now - lastPaint > 60){ thinking.update(acc); lastPaint = now; }
            }
            if (obj.usage) usage = obj.usage;
          }
        }
      }catch(e){
        if (e.name === 'AbortError') aborted = true;
        else throw e;
      }
      clearInterval(watchdog); watchdog = null; // corpo completo — para de vigiar
      trackUsage(usage, effectiveModel);
      if (!acc){
        if (timedOut) toast(timeoutMsg(), 'err');
        else if (aborted) toast('Geração interrompida.', 'warn');
        else toast('O modelo não retornou texto. Tente outro modelo ou desative o streaming em Config.', 'err');
        return;
      }
      if (aborted) toast('Geração interrompida — resposta parcial mantida', 'warn');

      const assistantMsg = { role:'assistant', content: acc };
      if (annotations.length) assistantMsg._sources = annotations;
      if ((baseModel === '__router__' || baseModel === '__router_free__') && conv._routedModel){
        const nm = state.models.find(m => m.id === conv._routedModel)?.name || conv._routedModel;
        assistantMsg._router = (baseModel === '__router_free__' ? 'RouteLLM Free ► ' : 'RouteLLM ► ') + nm;
      }
      assistantMsg.ts = Date.now();
      conv.messages.push(assistantMsg);
      conv.updatedAt = Date.now();
      if (conv.id === state.currentConvId){ appendMessageDOM('assistant', acc, false, conv.messages.length - 1); updateCtxMeter(); }
      persistConversations();
      renderHistoryList();
      // busca web + backend: anexa imagens sobre o tema (a pergunta do usuário)
      if (annotations.length && backendUrl()){
        const q = contentToText([...conv.messages].reverse().find(m => m.role === 'user')?.content || '');
        attachTopicImages(assistantMsg, q, conv);
      }
      afterAssistantDone(conv);
      return;
    }

    /* ---- Não-stream (tools ativas) ---- */
    let data;
    try{ data = await res.json(); }
    catch(e){
      if (e.name === 'AbortError'){ toast(timedOut ? timeoutMsg() : 'Geração interrompida', timedOut ? 'err' : 'warn'); return; }
      throw e;
    }
    clearInterval(watchdog); watchdog = null; // resposta completa — tools podem demorar sem serem abortadas
    if (data.error) throw new Error(data.error.message || 'erro do provedor');
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error('Resposta da API sem mensagem (formato inesperado).');
    trackUsage(data.usage, effectiveModel, conv);

    if (msg.tool_calls && msg.tool_calls.length){
      conv.messages.push(msg);
      for (const call of msg.tool_calls){
        const toolName = call.function.name;
        let args = {}; try{ args = JSON.parse(call.function.arguments || '{}'); }catch(e){}
        const tool = TOOLS[toolName];
        let result = 'Tool não encontrada: ' + toolName;
        if (tool){
          if (conv.id === state.currentConvId) appendMessageDOM(null, `tool: ${toolName}(${JSON.stringify(args)})`, true);
          result = await tool.exec(args);
        }
        conv.messages.push({ role:'tool', tool_call_id: call.id, content: String(result) });
      }
      persistConversations();
      return runChatLoop(depth+1, conv, modelOverride);
    }

    const assistantMsg = { role:'assistant', content: msg.content || '' };
    if ((baseModel === '__router__' || baseModel === '__router_free__') && conv._routedModel){
      const nm = state.models.find(m => m.id === conv._routedModel)?.name || conv._routedModel;
      assistantMsg._router = (baseModel === '__router_free__' ? 'RouteLLM Free ► ' : 'RouteLLM ► ') + nm;
    }
    assistantMsg.ts = Date.now();
    conv.messages.push(assistantMsg);
    conv.updatedAt = Date.now();
    if (conv.id === state.currentConvId){ appendMessageDOM('assistant', msg.content || '', false, conv.messages.length - 1); updateCtxMeter(); }
    persistConversations();
    renderHistoryList();
    afterAssistantDone(conv);
  } finally {
    if (watchdog) clearInterval(watchdog);
    thinking.remove(); // "Pensando…" nunca fica pendurado, mesmo com exceção
    if (depth === 0){
      delete state.gens[conv.id];
      updateComposerState();
    }
  }
}

function updateCostBadge(){
  const val = '$' + state.totalCost.toFixed(4);
  document.getElementById('cost-badge').textContent = val;
  document.getElementById('cost-detail').textContent = 'Total gasto (estimado): ' + val;
  updateSessionPanel();
}

/* ---------- Painel de sessão + Analytics (100% dados reais) ---------- */
function updateSessionPanel(){
  const conv = getCurrentConv();
  const m = state.models.find(x => x.id === state.model);
  const SPECIAL_NAMES = { '__router__':'RouteLLM', '__router_free__':'RouteLLM Free', '__fusion__':'Fusion' };
  const modelLabel = SPECIAL_NAMES[state.model] || m?.name || state.model || '—';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sp-model', modelLabel.length > 18 ? modelLabel.slice(0,17) + '…' : modelLabel);
  set('sp-cost', '$' + state.totalCost.toFixed(4));
  set('sp-msgs', conv ? conv.messages.filter(x => x.role==='user'||x.role==='assistant').length : 0);
  set('sp-convs', state.conversations.length);
  set('sp-agents', state.agents.length);
  set('sp-skills', state.skills.filter(s => s.active).length + '/' + state.skills.length);
  set('sp-tools', Object.keys(TOOLS).length);
  // versão mini (painel recolhido)
  set('sp-mini-cost', '$' + (state.totalCost < 1 ? state.totalCost.toFixed(2) : state.totalCost.toFixed(1)));
  set('sp-mini-msgs', conv ? conv.messages.filter(x => x.role==='user'||x.role==='assistant').length : 0);
  set('sp-mini-convs', state.conversations.length);
}
function renderAnalytics(){
  const grid = document.getElementById('metrics-grid');
  if (!grid) return;
  const totalMsgs = state.conversations.reduce((n,c) => n + c.messages.filter(x => x.role==='user'||x.role==='assistant').length, 0);
  const metrics = [
    ['Conversas', state.conversations.length, ''],
    ['Mensagens', totalMsgs, ''],
    ['Custo total', '$' + state.totalCost.toFixed(4), 'amber'],
    ['Custo em R$', 'R$' + (state.totalCost * state.usdToBrl).toFixed(2).replace('.',','), 'amber'],
    ['Agentes', state.agents.length, 'violet'],
    ['Skills', state.skills.length, 'violet'],
  ];
  grid.innerHTML = '';
  metrics.forEach(([label, val, cls]) => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `<div class="metric-label">${label}</div><div class="metric-val ${cls}">${val}</div>`;
    grid.appendChild(card);
  });
}

/* ---------- Mic (best-effort ditado) ---------- */
function setupMic(){
  const btn = document.getElementById('mic-btn');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){ btn.style.opacity = '.3'; btn.title = 'Ditado não suportado neste navegador'; return; }
  const rec = new SR();
  rec.lang = 'pt-BR';
  rec.continuous = false;
  rec.interimResults = false;
  let listening = false;
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const input = document.getElementById('chat-input');
    input.value = (input.value ? input.value + ' ' : '') + text;
  };
  rec.onend = () => { listening = false; btn.classList.remove('recording'); };
  btn.onclick = () => {
    if (listening){ rec.stop(); listening = false; btn.classList.remove('recording'); }
    else { rec.start(); listening = true; btn.classList.add('recording'); }
  };
}

/* ---------- Imagem ---------- */
async function generateImage(){
  const prompt = document.getElementById('image-prompt').value.trim();
  const model = document.getElementById('image-model-select').value;
  if (!prompt || !state.apiKey) return;
  const btn = document.getElementById('gen-image-btn');
  btn.disabled = true; btn.textContent = 'Gerando...';
  try{
    const res = await orFetch({ model, messages:[{role:'user', content: prompt}], modalities:['image','text'] });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const msg = data.choices[0].message;
    const images = msg.images || [];
    const grid = document.getElementById('img-grid');
    images.forEach(img => {
      const url = img.image_url?.url || img.url || img;
      const card = document.createElement('div');
      card.className = 'img-card';
      card.innerHTML = `<img src="${url}"><a href="${url}" download="vtz-imagem.png">Baixar</a>`;
      grid.prepend(card);
    });
    if (!images.length) appendImageNote('Modelo não retornou imagem — verifique output_modalities.');
  }catch(e){ appendImageNote('Erro: ' + e.message); }
  finally{ btn.disabled = false; btn.textContent = 'Gerar'; }
}
function appendImageNote(text){
  const grid = document.getElementById('img-grid');
  const note = document.createElement('div');
  note.className = 'img-card';
  note.style.padding = '14px'; note.style.fontSize = '12px'; note.style.color = 'var(--text-dim)';
  note.textContent = text;
  grid.prepend(note);
}

/* ---------- Vídeo (Replicate, via Backend VTz OS) ---------- */
const FALLBACK_VIDEO_MODELS = [
  { id:'kling-v3',     name:'Kling AI v3.0 (recomendado)',  type:'text-to-video',  max_duration:10 },
  { id:'kling-v2',     name:'Kling AI v2.0',                type:'text-to-video',  max_duration:10 },
  { id:'kling-v1',     name:'Kling AI v1.0',                type:'text-to-video',  max_duration:10 },
  { id:'runway-gen3',  name:'Runway Gen-3.5 Motion',         type:'text-to-video',  max_duration:25 },
  { id:'luma-dream',   name:'Luma Dream Machine',            type:'text-to-video',  max_duration:5  },
  { id:'veo-2',        name:'Google Veo 2.0',                type:'text-to-video',  max_duration:6  },
  { id:'seedance',     name:'Seedance (Imagem → Vídeo)',     type:'image-to-video', max_duration:5  },
  { id:'hailuo',       name:'Hailuo Video Generation',       type:'text-to-video',  max_duration:10 },
];
async function loadVideoModels(){
  const sel = document.getElementById('video-model-select');
  let models = FALLBACK_VIDEO_MODELS;
  if (backendUrl()){
    try{
      const d = await fetch(backendUrl() + '/api/video/models', { headers: backendHeaders() }).then(okJson);
      if (d.models && d.models.length) models = d.models;
    }catch(_){ /* sem backend/erro — usa a lista fixa mesmo assim (só pra visualizar) */ }
  }
  state.videoModels = models;
  sel.innerHTML = '';
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name + (m.max_duration ? ` (até ${m.max_duration}s)` : '');
    opt.dataset.type = m.type || 'text-to-video';
    sel.appendChild(opt);
  });
  updateVideoModelFields();
}
/* créditos aproximados por segundo de vídeo, por modelo (estimativa p/ UI) */
const VIDEO_CREDIT_RATES = {
  'kling-v3':1.4, 'kling-v2':1.1, 'kling-v1':0.8, 'runway-gen3':2.0,
  'luma-dream':1.2, 'veo-2':2.5, 'seedance':1.0, 'hailuo':1.3,
};
function updateVideoCost(){
  const sel = document.getElementById('video-model-select');
  const dur = parseInt(document.getElementById('video-duration')?.value, 10) || 5;
  const rate = VIDEO_CREDIT_RATES[sel?.value] ?? 1.2;
  let credits = rate * dur;
  if (document.getElementById('video-audio-chip')?.classList.contains('on')) credits *= 1.2;
  const el = document.getElementById('video-cost');
  if (el) el.textContent = `~${credits.toFixed(1)} créditos`;
}
function updateVideoModelFields(){
  const sel = document.getElementById('video-model-select');
  const opt = sel.options[sel.selectedIndex];
  const isImg2Vid = opt?.dataset.type === 'image-to-video';
  document.getElementById('video-image-url').style.display = isImg2Vid ? 'block' : 'none';
  const durationInput = document.getElementById('video-duration');
  const model = state.videoModels?.find(m => m.id === sel.value);
  if (model?.max_duration){
    durationInput.max = model.max_duration;
    durationInput.title = `Até ${model.max_duration}s`;
    if (parseInt(durationInput.value,10) > model.max_duration) durationInput.value = model.max_duration;
  } else {
    durationInput.removeAttribute('max');
    durationInput.title = 'Duração em segundos';
  }
  updateVideoCost();
}
/* revisão de prompt: usa o OpenRouter pra reescrever o prompt de forma mais rica p/ vídeo */
async function revisePrompt(raw){
  if (!state.apiKey) throw new Error('Precisa da chave do OpenRouter (Config → Geral) pra revisar o prompt.');
  const body = {
    model: state.model && !state.model.startsWith('__') ? state.model : 'openai/gpt-4.1-mini',
    messages: [
      { role:'system', content:'Você melhora prompts de geração de vídeo. Reescreva o pedido do usuário num prompt visual, cinematográfico e detalhado (câmera, luz, movimento, estilo), em UMA frase densa. Responda SÓ com o prompt, sem aspas nem explicação.' },
      { role:'user', content: raw },
    ],
    max_tokens: 220,
  };
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + state.apiKey },
    body: JSON.stringify(body),
  }).then(okJson);
  return (r.choices?.[0]?.message?.content || raw).trim();
}
async function generateVideo(){
  let prompt = document.getElementById('video-prompt').value.trim();
  const model = document.getElementById('video-model-select').value;
  const durationRaw = document.getElementById('video-duration').value.trim();
  const imageUrl = document.getElementById('video-image-url').value.trim();
  const aspect = document.getElementById('video-aspect')?.value || '';
  const withAudio = document.getElementById('video-audio-chip')?.classList.contains('on');
  const doRevise = document.getElementById('video-revise-chip')?.classList.contains('on');
  if (!prompt || !model) return;
  if (!backendUrl()){ await autoDetectBackend(); }
  if (!backendUrl()){ appendVideoNote('Backend não encontrado. Ligue o Backend VTz OS primeiro (run.bat).'); return; }
  if (!state.replicateKey){ appendVideoNote('Cole sua chave do Replicate em Config → Geral → Replicate API Key.'); return; }
  const btn = document.getElementById('gen-video-btn');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try{
    if (doRevise){
      btn.textContent = 'Revisando...';
      try{ prompt = await revisePrompt(prompt); document.getElementById('video-prompt').value = prompt; toast('Prompt revisado pela IA.'); }
      catch(e){ toast('Não deu pra revisar: ' + e.message, 'warn'); }
      btn.textContent = 'Enviando...';
    }
    const payload = { model, prompt };
    if (durationRaw) payload.duration = parseInt(durationRaw, 10);
    if (imageUrl) payload.image_url = imageUrl;
    if (aspect) payload.aspect_ratio = aspect;
    if (withAudio) payload.audio = true;
    const d = await fetch(backendUrl() + '/api/video/generate', {
      method:'POST', headers: videoHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify(payload),
    }).then(okJson);
    const grid = document.getElementById('video-grid');
    const card = document.createElement('div');
    card.className = 'img-card';
    card.dataset.startedAt = String(Date.now());
    card.innerHTML = `<div class="vid-progress">`
      + `<div class="hint" style="font-size:11px; margin-bottom:8px;">${esc(d.model_name || model)}</div>`
      + `<div class="spinner"></div>`
      + `<div class="vid-status">Gerando… (${esc(d.status || 'starting')})</div>`
      + `<div class="vid-elapsed">0s</div>`
      + `<button class="vid-cancel-btn" type="button">Cancelar</button>`
      + `</div>`;
    grid.prepend(card);
    card.querySelector('.vid-cancel-btn').onclick = () => cancelVideoPrediction(d.id, card);
    addRunningTask(d.id, 'Vídeo: ' + (d.model_name || model));
    pollVideoPrediction(d.id, card);
  }catch(e){ appendVideoNote('Erro: ' + e.message); }
  finally{ btn.disabled = false; btn.textContent = 'Gerar'; }
}
async function pollVideoPrediction(id, card, attempt = 0){
  if (card.dataset.canceled) return;
  const statusEl = card.querySelector('.vid-status');
  const elapsedEl = card.querySelector('.vid-elapsed');
  if (elapsedEl){
    const secs = Math.round((Date.now() - Number(card.dataset.startedAt || Date.now())) / 1000);
    elapsedEl.textContent = secs + 's';
  }
  if (attempt > 150){ if (statusEl) statusEl.textContent = 'Tempo esgotado — confira o resultado direto no replicate.com.'; removeRunningTask(id); return; }
  try{
    const d = await fetch(backendUrl() + '/api/video/prediction/' + encodeURIComponent(id), { headers: videoHeaders() }).then(okJson);
    if (d.status === 'succeeded'){
      const out = Array.isArray(d.output) ? d.output[0] : d.output;
      if (out) card.innerHTML = `<video src="${out}" controls></video><a href="${out}" download="vtz-video.mp4">Baixar</a>`;
      else { card.className = 'img-card vid-progress'; card.innerHTML = `<div class="vid-status">Concluído, mas sem output reconhecível.</div>`; }
      removeRunningTask(id);
      return;
    }
    if (d.status === 'failed' || d.status === 'canceled'){
      card.className = 'img-card vid-progress';
      card.innerHTML = `<div class="vid-status">${d.status === 'canceled' ? 'Cancelado.' : 'Falhou: ' + esc(d.error || d.status)}</div>`;
      removeRunningTask(id);
      return;
    }
    if (statusEl) statusEl.textContent = `Gerando… (${d.status || 'processing'})`;
    setTimeout(() => pollVideoPrediction(id, card, attempt + 1), 3000);
  }catch(e){
    if (statusEl) statusEl.textContent = 'Erro ao consultar: ' + e.message;
  }
}
async function cancelVideoPrediction(id, card){
  const btn = card.querySelector('.vid-cancel-btn');
  if (btn){ btn.disabled = true; btn.textContent = 'Cancelando...'; }
  try{
    await fetch(backendUrl() + '/api/video/prediction/' + encodeURIComponent(id) + '/cancel', {
      method: 'POST', headers: videoHeaders(),
    }).then(okJson);
    const statusEl = card.querySelector('.vid-status');
    if (statusEl) statusEl.textContent = 'Cancelado.';
    card.dataset.canceled = '1';
    removeRunningTask(id);
  }catch(e){
    if (btn){ btn.disabled = false; btn.textContent = 'Cancelar'; }
  }
}
function appendVideoNote(text){
  const grid = document.getElementById('video-grid');
  const note = document.createElement('div');
  note.className = 'img-card';
  note.style.padding = '14px'; note.style.fontSize = '12px'; note.style.color = 'var(--text-dim)';
  note.textContent = text;
  grid.prepend(note);
}
