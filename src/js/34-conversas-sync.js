/* ============================================================
   ESPELHO DAS CONVERSAS NO BACKEND VTz OS (Seção 7)

   O localStorage continua sendo onde a conversa é escrita — o app
   funciona sem backend nenhum. Isto é o espelho: faz a conversa
   aparecer no outro dispositivo e sobreviver a "limpar o cache".

   Isto é DIFERENTE do sync do Google (pushToCloud, 12-menus.js).
   Aquele vai pro Firebase; este vai pro teu servidor. Os dois podem
   estar ligados ao mesmo tempo e não se atropelam: cada um lê o
   localStorage e escreve no seu próprio destino.

   CONFLITO: última escrita ganha, por conversa. Nunca mescla lista de
   mensagens — juntar as mensagens de dois aparelhos produziria uma
   conversa que nunca aconteceu.

   UNIDADE DE TEMPO: o painel guarda updatedAt em MILISSEGUNDOS
   (Date.now()); o backend guarda em SEGUNDOS (time.time()). Toda
   conversão passa por msParaS/sParaMs — misturar as duas faria todo
   carimbo local parecer 50 mil anos no futuro e vencer tudo.
   ============================================================ */
const msParaS = (ms) => (Number(ms) || 0) / 1000;
const sParaMs = (s) => (Number(s) || 0) * 1000;

const CONV_LOTE = 150;                    // o backend recusa acima de 200
const CHAVE_DESDE = 'vtz_conv_sync_desde';
const CHAVE_LAPIDES = 'vtz_conv_lapides';

let _convSyncTimer = null;
let _convSyncRodando = false;
const convSync = { estado: 'parado', ultimo: null, erro: null, baixadas: 0, subidas: 0 };

/* Lápides locais: o que foi apagado aqui e o servidor ainda não sabe. Sem
   guardar isso, apagar no PC não apagaria no celular — o celular reenviaria a
   conversa e ela voltaria. */
function lapidesLocais(){
  try{ return JSON.parse(localStorage.getItem(CHAVE_LAPIDES) || '[]'); }
  catch(e){ return []; }
}
function registraLapide(id){
  const l = lapidesLocais();
  if (!l.includes(id)){
    l.push(id);
    localStorage.setItem(CHAVE_LAPIDES, JSON.stringify(l.slice(-500)));
  }
}
function limpaLapides(ids){
  const restantes = lapidesLocais().filter(x => !ids.includes(x));
  localStorage.setItem(CHAVE_LAPIDES, JSON.stringify(restantes));
}

/* Converte a conversa do painel pro formato da rota. O que o backend não
   conhece vai em `extra` e volta igual — o servidor não opina sobre o formato
   interno da conversa. */
function convParaBackend(c){
  const { id, title, pinned, messages, updatedAt, ...resto } = c;
  return {
    id,
    title: title || '',
    pinned: !!pinned,
    updated_at: msParaS(updatedAt || Date.now()),
    messages: messages || [],
    extra: resto,
  };
}

function convDoBackend(c){
  const { id, title, pinned, messages, updated_at, ...resto } = c;
  return { id, title: title || '', pinned: !!pinned, messages: messages || [],
           updatedAt: sParaMs(updated_at), ...resto };
}

async function convApi(caminho, opts){
  const r = await fetch(backendUrl() + caminho,
                        Object.assign({ headers: backendHeaders() }, opts || {}));
  if (!r.ok){
    let motivo = await r.text().catch(() => '');
    try{ motivo = JSON.parse(motivo).detail || motivo; }catch(e){}
    throw new Error(`HTTP ${r.status}${motivo ? ' — ' + String(motivo).slice(0, 160) : ''}`);
  }
  return r.json();
}

/* ---------- baixar ---------- */
async function convBaixa(){
  const desde = Number(localStorage.getItem(CHAVE_DESDE) || 0);
  const d = await convApi('/api/conversations?since=' + desde);
  let aplicadas = 0;

  (d.conversations || []).forEach(remota => {
    const local = state.conversations.find(c => c.id === remota.id);
    const remotaMs = sParaMs(remota.updated_at);
    /* Só sobrescreve se a do servidor for MAIS NOVA. Se a local estiver na
       frente, ela é que vai subir no próximo empurrão. */
    if (local && (local.updatedAt || 0) >= remotaMs) return;
    const convertida = convDoBackend(remota);
    if (local) Object.assign(local, convertida);
    else state.conversations.push(convertida);
    aplicadas += 1;
  });

  (d.deleted || []).forEach(morta => {
    const idx = state.conversations.findIndex(c => c.id === morta.id);
    if (idx < 0) return;
    /* Apagada no servidor depois da última edição local: sai daqui também.
       Se a edição local é mais nova, ela sobe e ressuscita — foi escolha de
       quem mexeu nela depois de apagar em outro lugar. */
    if ((state.conversations[idx].updatedAt || 0) <= sParaMs(morta.deleted_at)){
      state.conversations.splice(idx, 1);
      aplicadas += 1;
    }
  });

  if (aplicadas){
    /* Escreve direto no localStorage em vez de chamar persistConversations():
       aquele agenda outra sincronização, e chamar daqui viraria laço. */
    localStorage.setItem('vtz_conversations', JSON.stringify(state.conversations));
    if (!state.conversations.find(c => c.id === state.currentConvId)){
      state.currentConvId = state.conversations[0]?.id || null;
    }
    try{ renderHistoryList(); renderChat(); }catch(e){ /* render não pode derrubar o sync */ }
  }
  localStorage.setItem(CHAVE_DESDE, String(d.server_time || desde));
  convSync.baixadas += aplicadas;
  return aplicadas;
}

/* ---------- subir ---------- */
async function convSobe(){
  const lapides = lapidesLocais();
  /* Conversa sem mensagem não sobe. O painel cria uma "Nova conversa" vazia a
     cada abertura; espelhar isso encheria todos os aparelhos de conversa em
     branco — uma por boot, em cada um deles. */
  const todas = state.conversations
    .filter(c => (c.messages || []).length > 0)
    .map(convParaBackend);
  let subidas = 0, recusadas = [];

  for (let i = 0; i < todas.length; i += CONV_LOTE){
    const lote = todas.slice(i, i + CONV_LOTE);
    const corpo = { conversations: lote };
    if (i === 0 && lapides.length) corpo.deleted = lapides.slice(0, CONV_LOTE);
    const d = await convApi('/api/conversations', {
      method: 'PUT',
      headers: backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(corpo),
    });
    subidas += (d.gravadas || []).length;
    recusadas = recusadas.concat(d.recusadas || []);
    if (i === 0 && corpo.deleted) limpaLapides(corpo.deleted);
    if (d.aviso_relogio) console.warn('[sync]', d.aviso_relogio);
    if (d.aviso) console.warn('[sync]', d.aviso);
  }

  /* Recusada = o servidor tem versão mais nova. Zera o marcador pra a próxima
     descida trazer essas conversas em vez de o painel achar que subiu tudo. */
  if (recusadas.length) localStorage.setItem(CHAVE_DESDE, '0');
  convSync.subidas += subidas;
  return { subidas, recusadas: recusadas.length };
}

async function syncConversas(motivo){
  if (!backendUrl() || _convSyncRodando) return;
  _convSyncRodando = true;
  convSync.estado = 'sincronizando';
  convSync.erro = null;
  renderConvSync();
  try{
    await convBaixa();
    const s = await convSobe();
    if (s.recusadas) await convBaixa();   // pega o que o servidor tinha mais novo
    convSync.estado = 'ok';
    convSync.ultimo = Date.now();
  }catch(e){
    convSync.estado = 'erro';
    convSync.erro = e.message;
    if (motivo === 'manual') toast('Sincronização falhou: ' + e.message, 'err');
  }finally{
    _convSyncRodando = false;
    renderConvSync();
  }
}

/* Chamado por persistConversations. Debounce porque salvar acontece a cada
   mensagem e não faz sentido um PUT por token digitado. */
function scheduleBackendSync(){
  if (!backendUrl()) return;
  clearTimeout(_convSyncTimer);
  _convSyncTimer = setTimeout(() => syncConversas('auto'), 4000);
}

/* ---------- tela ---------- */
function renderConvSync(){
  const el = document.getElementById('conv-sync-estado');
  if (!el) return;
  if (!backendUrl()){
    el.textContent = 'Sem Backend VTz OS: as conversas ficam só neste navegador.';
    el.className = 'hint';
    return;
  }
  const hora = convSync.ultimo
    ? new Date(convSync.ultimo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;
  if (convSync.estado === 'sincronizando'){ el.textContent = 'Sincronizando…'; el.className = 'hint'; return; }
  if (convSync.estado === 'erro'){ el.textContent = 'Falhou: ' + convSync.erro; el.className = 'hint erro'; return; }
  el.textContent = hora
    ? `Sincronizado às ${hora} — ${convSync.baixadas} baixada(s), ${convSync.subidas} subida(s) nesta sessão.`
    : 'Pronto pra sincronizar.';
  el.className = 'hint ' + (hora ? 'ok' : '');
}

/* ---------- backup automático do servidor ---------- */
async function renderAutoBackup(){
  const box = document.getElementById('auto-backup');
  if (!box) return;
  if (!backendUrl()){ box.innerHTML = '<p class="hint">Precisa do Backend VTz OS.</p>'; return; }
  try{
    const d = await convApi('/api/backup/auto');
    const lst = await convApi('/api/backup/auto/list');
    const ultimo = d.ultimo;
    let html = `<div class="ab-linha"><span>Agendamento</span><b class="${d.ligado ? 'ok' : 'off'}">` +
      (d.ligado ? `a cada ${esc(String(d.cada_horas))}h` : 'desligado') + '</b></div>' +
      `<div class="ab-linha"><span>Snapshots guardados</span><b>${d.existem} (mantém ${d.manter})</b></div>` +
      `<div class="ab-linha"><span>Último</span><b>` +
      (ultimo ? `${esc(ultimo.arquivo)} · ${(ultimo.bytes / 1024).toFixed(0)} KB` : '—') + '</b></div>' +
      `<p class="ab-aviso">${esc(d.aviso)}</p>`;
    if (!d.ligado){
      html += '<p class="hint" style="margin-top:8px;">Pra ligar, defina <code>BACKUP_EVERY_HOURS=6</code> ' +
        'no ambiente do servidor (e <code>BACKUP_KEEP</code> se quiser guardar mais que 14).</p>';
    }
    if ((lst.snapshots || []).length){
      html += '<div class="ab-lista">' + lst.snapshots.slice(0, 6).map(s =>
        `<a class="ab-item" href="${esc(backendUrl())}/api/backup/auto/download/${esc(s.arquivo)}" ` +
        `download>${esc(s.arquivo)} <i>${(s.bytes / 1024).toFixed(0)} KB</i></a>`).join('') + '</div>';
    }
    box.innerHTML = html;
  }catch(e){ box.innerHTML = `<p class="hint erro">${esc(e.message)}</p>`; }
}

function setupConversasSync(){
  const btn = document.getElementById('conv-sync-btn');
  if (btn) btn.onclick = () => syncConversas('manual');
  const ab = document.getElementById('auto-backup-btn');
  if (ab) ab.onclick = async () => {
    const msg = document.getElementById('auto-backup-msg');
    try{
      if (msg){ msg.textContent = 'Gerando snapshot…'; msg.className = 'hint'; }
      const d = await convApi('/api/backup/auto/run', { method: 'POST' });
      if (msg){
        msg.textContent = `Snapshot escrito: ${(d.bytes / 1024).toFixed(0)} KB, ` +
          `${d.conversas} conversa(s), ${d.nos} nó(s) de memória.`;
        msg.className = 'hint ok';
      }
      renderAutoBackup();
    }catch(e){
      if (msg){ msg.textContent = 'Falhou: ' + e.message; msg.className = 'hint erro'; }
    }
  };
  renderConvSync();
  /* Primeira sincronização no boot: é o que traz o que foi escrito em outro
     dispositivo enquanto este estava fechado. */
  if (backendUrl()) setTimeout(() => syncConversas('boot'), 2500);
}
