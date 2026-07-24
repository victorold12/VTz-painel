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

/* Agente Local (servidor/docs/SEGURANCA-AGENTE-LOCAL.md): o backend só encaminha
   (Seção 0); quem decide o tier e executa é o agente, na máquina do usuário.
   Duas tools — pc_action (comando de sistema) e pc_file (arquivo estruturado).
   Ambas passam pelo mesmo gate de 4 camadas no PC: leitura/escrita nas pastas
   permitidas roda sozinho; fora do padrão pede confirmação nativa lá (pode
   demorar); destrutivo é bloqueado. */

/* Acha um agente online e manda uma ação; devolve {agent, data} ou uma string
   de erro/aviso legível pro modelo repassar ao usuário. */
async function callAgentAction(action, actionArgs){
  if (!backendUrl()) return 'Erro: backend não encontrado, não dá pra acionar o Agente Local.';
  try{
    const agentsRes = await fetch(backendUrl() + '/api/agents', { headers: backendHeaders() }).then(okJson);
    const agent = (agentsRes.agents || []).find(a => a.online && !a.revoked);
    if (!agent) return 'Nenhum Agente Local pareado e online agora. Peça pro usuário parear/abrir o Agente Local em Configurações > Agente Local.';
    const r = await fetch(backendUrl() + `/api/agents/${encodeURIComponent(agent.agent_id)}/command`, {
      method:'POST', headers: backendHeaders({ 'Content-Type':'application/json' }),
      body: JSON.stringify({ action, args: actionArgs, timeout:90 }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { error: 'Erro ao acionar o Agente Local: ' + (d.detail || ('HTTP ' + r.status)) };
    if (!d.ok) return { error: 'Ação recusada/negada pelo Agente Local: ' + (d.data?.error || 'sem detalhe'), agent: agent.name };
    return { agent: agent.name, data: d.data || {} };
  }catch(e){ return 'Erro ao acionar o Agente Local: ' + e.message; }
}

TOOLS.pc_action = {
  def:{
    type:'function',
    function:{
      name:'pc_action',
      description:'Executa um COMANDO DE SISTEMA no PC do usuário via Agente Local pareado (ex.: git, npm, listar processos). Para ler/escrever/criar/apagar arquivo ou pasta, prefira pc_file. O comando passa por allowlist no PC; fora do padrão pede confirmação nativa lá (pode demorar). Só funciona com um Agente Local pareado e online — se der erro dizendo isso, avise o usuário para abrir/parear o Agente Local em Configurações.',
      parameters:{
        type:'object',
        properties:{
          command:{ type:'string', description:'Comando exato, ex.: "git status", "npm run build".' },
        },
        required:['command'],
      },
    },
  },
  exec: async (args) => {
    const res = await callAgentAction('run', { command: String(args.command || '') });
    if (typeof res === 'string') return res;
    if (res.error) return res.error;
    const stdout = String(res.data.stdout || '').trim().slice(0, 3000);
    const stderr = String(res.data.stderr || '').trim().slice(0, 1000);
    return JSON.stringify({ agent: res.agent, stdout, stderr });
  }
};

TOOLS.pc_file = {
  def:{
    type:'function',
    function:{
      name:'pc_file',
      description:'Lê, escreve, lista, cria ou apaga ARQUIVO/PASTA no PC do usuário via Agente Local pareado. Fica restrito às pastas que o usuário permitiu (ex.: Downloads); fora delas ou em arquivos sensíveis, o PC pede confirmação nativa (pode demorar). Apagar pasta sempre pede confirmação. Só funciona com um Agente Local pareado e online.',
      parameters:{
        type:'object',
        properties:{
          op:{ type:'string', enum:['read','list','write','mkdir','delete'], description:'read=ler arquivo, list=listar pasta, write=escrever/criar arquivo, mkdir=criar pasta, delete=apagar.' },
          path:{ type:'string', description:'Caminho do arquivo ou pasta, ex.: "C:\\\\Users\\\\nome\\\\Downloads\\\\nota.txt".' },
          content:{ type:'string', description:'Conteúdo a escrever (só para op="write").' },
        },
        required:['op','path'],
      },
    },
  },
  exec: async (args) => {
    const op = String(args.op || '');
    const actionArgs = { path: String(args.path || '') };
    if (op === 'write') actionArgs.content = String(args.content ?? '');
    const res = await callAgentAction('fs_' + op, actionArgs);
    if (typeof res === 'string') return res;
    if (res.error) return res.error;
    const out = String(res.data.stdout || '').slice(0, 3000);
    const meta = res.data.truncated ? ' (conteúdo truncado)' : '';
    return JSON.stringify({ agent: res.agent, op, result: out + meta });
  }
};

/* Formata o resultado cru de pc_action/pc_file (JSON) como markdown legível,
   pra mostrar no chat antes da resposta do modelo. */
function formatPcActionResult(result){
  try{
    const d = JSON.parse(result);
    if (d && typeof d === 'object' && ('stdout' in d || 'stderr' in d)){
      const parts = [`**Agente Local** (${esc(d.agent || '?')}) executou:`];
      if (d.stdout) parts.push('```\n' + d.stdout + '\n```');
      if (d.stderr) parts.push('_stderr:_\n```\n' + d.stderr + '\n```');
      if (!d.stdout && !d.stderr) parts.push('_(sem saída)_');
      return parts.join('\n');
    }
    if (d && typeof d === 'object' && 'op' in d && 'result' in d){
      const parts = [`**Agente Local** (${esc(d.agent || '?')}) — \`${esc(d.op)}\`:`];
      parts.push('```\n' + String(d.result || '(sem saída)') + '\n```');
      return parts.join('\n');
    }
  }catch(e){ /* não é JSON -> é mensagem de erro/aviso simples, mostra cru */ }
  return String(result);
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
  // Rodando dentro do app Electron: herda a URL do backend que foi usada no
  // pareamento (injetada pelo preload). Sem isto, o painel não sabia qual
  // backend usar e a aba "Agente Local" ficava vazia mesmo com o agente
  // pareado. Só adota se ainda não há backend configurado neste painel.
  if (window.jarvisDesktop?.backendUrl && !state.backendUrl){
    state.backendUrl = String(window.jarvisDesktop.backendUrl).replace(/\/+$/, '');
    localStorage.setItem('vtz_backend_url', state.backendUrl);
  }

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
    if (state.backendUrl){ _memSynced = false; syncMemoryWithBackend(); } // fonte única: sincroniza a memória (Seção 7)
    toast(state.backendUrl ? 'Backend salvo.' : 'Backend removido (volta ao modo local).');
  });
  const beTokenInput = document.getElementById('backend-token-input');
  beTokenInput.value = state.backendToken;
  beTokenInput.addEventListener('change', () => {
    state.backendToken = beTokenInput.value.trim();
    localStorage.setItem('vtz_backend_token', state.backendToken);
    if (state.backendUrl){ _memSynced = false; syncMemoryWithBackend(); } // token novo pode destravar a memória (Seção 7)
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
  document.getElementById('pair-confirm-btn').onclick = confirmPairing;
  document.getElementById('pair-deny-btn').onclick = denyPairing;
  document.getElementById('pair-code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); confirmPairing(); } });
  document.getElementById('agents-refresh-btn').onclick = refreshAgentsList;
  document.getElementById('audit-refresh-btn').onclick = refreshAuditList;
  document.getElementById('audit-verify-btn').onclick = verifyAuditChain;
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

  // Se já havia um backend salvo, sincroniza a memória com ele na abertura
  // (fonte única — Seção 7). autoDetectBackend só roda quando NÃO há URL salva,
  // então este é o gatilho pro caso de URL já configurada (ex.: Render).
  if (state.backendUrl) syncMemoryWithBackend();
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
