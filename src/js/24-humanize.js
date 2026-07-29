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
/* Sufixos que o mercado inteiro usa pra dizer "versão reduzida desta família".
   Não é heurística chutada: é convenção de nome da OpenAI, Google, Anthropic e
   Meta ao mesmo tempo. Serve pra não chamar de "raciocínio geral avançado" um
   modelo que a própria fabricante vende como o rapidinho da linha. */
const VARIANTE_REDUZIDA = /(nano|mini|lite|tiny|instant|flash-lite|[-_]([89]|[0-9]\.[0-9])b\b)/i;

/* Melhor modelo do catálogo que casa com um padrão de família.

   O QUE ISTO CONSERTA: antes era `state.models.find(x => x.id.includes(pat))` —
   o PRIMEIRO que o OpenRouter devolveu, e essa ordem é dele, não nossa. Com o
   catálogo ao vivo, "gpt-5" podia cair em `gpt-5-nano` e ser entregue ao
   classificador rotulado "raciocínio geral avançado". O classificador então
   mandava a tarefa difícil pro modelo mais fraco da família, acreditando estar
   fazendo o contrário — e o sintoma no chat era só "a resposta veio ruim".

   ORDEM: variante cheia antes de reduzida; depois o mais novo (o catálogo ao
   vivo traz `created`); depois o de contexto maior. Preço NÃO entra: caro não é
   sinônimo de bom, e usar preço como nota faria o roteador preferir o modelo
   errado toda vez que um lançamento novo baixasse o preço da família. */
function melhorDaFamilia(padrao){
  const casam = state.models.filter(x => x && typeof x.id === 'string'
    && x.id.includes(padrao) && !isImageModel(x));
  if (!casam.length) return null;
  return casam.slice().sort((a, b) => {
    const ra = VARIANTE_REDUZIDA.test(a.id) ? 1 : 0;
    const rb = VARIANTE_REDUZIDA.test(b.id) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    const ca = Number(a.created) || 0, cb = Number(b.created) || 0;
    if (ca !== cb) return cb - ca;
    return (Number(b.context_length) || 0) - (Number(a.context_length) || 0);
  })[0];
}

/* Preço de saída em dólar por milhão de tokens — é o número que domina a conta
   numa conversa (a resposta custa 4–5x o que custa a pergunta). */
function precoSaidaM(m){
  return parseFloat(m?.pricing?.completion || 0) * 1e6;
}

function routerCandidates(freeOnly){
  if (freeOnly) return freeCandidates();
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
    const m = melhorDaFamilia(pat);
    if (m && !picks.some(p => p.id === m.id)) picks.push({ id: m.id, role, preco: precoSaidaM(m) });
  }
  return picks;
}
