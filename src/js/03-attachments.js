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
