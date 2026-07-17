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

/* skill "Gerar arquivo → Claude" — definida à parte pra poder ser garantida
   tanto no seed de 1ª execução quanto numa migração pra instalações que já
   tinham vtz_skills salvo antes dela existir (ver bloco de migração abaixo). */
function makeClaudeRedirectSkill(){
  return { id: uid(), name:'Gerar arquivo → Claude', trigger:'',
    instructions:'Quando o pedido for de um ARQUIVO DE ESCRITÓRIO formatado (PDF, Word/.docx, PowerPoint/.pptx, dashboard/painel HTML): não tente gerar esse arquivo aqui — este painel não produz PDF/Word/PPTX com qualidade real. Em vez disso, faça só 2 coisas: escreva 1 frase curta explicando que a geração real do arquivo fica melhor direto no Claude; depois coloque um prompt completo e bem estruturado (cobrindo contexto, dados, tom e estrutura esperada do que foi pedido) dentro de um bloco de código cercado com a linguagem claude-redirect — 3 crases, a palavra claude-redirect, o prompt, 3 crases de novo. O app renderiza esse bloco como um botão "Continuar no Claude" e monta o link sozinho; você não precisa escrever URL nenhuma. Não gere o conteúdo do documento na resposta — nem em Python/reportlab, nem em nenhuma outra linguagem: você não tem como executar esse código aqui, então ele não produz arquivo nenhum pro usuário. Quando o pedido for geração de CÓDIGO ou conteúdo grande de texto pra ficar aqui no chat (não um arquivo de escritório): gere normalmente, como sempre — e, só como opção no fim da resposta, pode oferecer o mesmo bloco claude-redirect com um prompt equivalente, caso o usuário prefira continuar no Claude. Nunca obrigatório nesse caso.',
    active:true };
}

/* seed de skills na primeira execução */
if (localStorage.getItem('vtz_skills') === null){
  state.skills = [
    { id: uid(), name:'VTZ Design System', trigger:'design, ui, interface, tema, glass', instructions:'Aplique o design system VTZ: tema Glass (superfícies translúcidas com blur) como padrão, acento violeta, tipografia nativa do sistema, preto como base.', active:false },
    { id: uid(), name:'Automação Windows (.bat)', trigger:'windows, script, automação, .bat, .reg', instructions:'Sempre que gerar scripts de automação Windows, acompanhe o .py (ou .ps1) com um .bat de execução. Para mudanças de registro, inclua backup e restauração reversíveis.', active:false },
    { id: uid(), name:'Incubadora Maricá', trigger:'incubadora, evento, maricá, relatório', instructions:'Contexto: mapeamento de eventos e relatórios para 5 empresas incubadas em Maricá-RJ. Tom objetivo, formatação clara com headers, atenção à sensibilidade política local.', active:false },
    makeClaudeRedirectSkill(),
  ];
  localStorage.setItem('vtz_skills', JSON.stringify(state.skills));
}

/* migração: garante a skill acima mesmo em instalações que já tinham
   vtz_skills salvo (o seed acima só roda em localStorage vazio — sem isso,
   quem já usava o app antes nunca ganha a skill nova). Idempotente: só
   adiciona se ainda não existir pelo nome. */
if (!state.skills.some(s => s.name === 'Gerar arquivo → Claude')){
  state.skills.push(makeClaudeRedirectSkill());
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
