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
