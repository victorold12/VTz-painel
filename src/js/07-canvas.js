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

