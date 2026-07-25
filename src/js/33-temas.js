/* ============================================================
   TEMAS — dois eixos independentes:
     data-theme  → base (escuro/claro), que já existia
     data-accent → cor de destaque, nova

   Separar os eixos é o que evita duplicar o tema inteiro pra cada
   cor: 2 bases × 6 acentos com um bloco de CSS por acento, em vez
   de 12 temas copiados que sairiam do lugar um do outro.
   ============================================================ */
const ACENTOS = [
  { id:'violeta',  nome:'Violeta',  cor:'#8b5cf6' },   // padrão do painel
  { id:'ciano',    nome:'Ciano',    cor:'#22d3ee' },   // a cor do JARVIS
  { id:'ambar',    nome:'Âmbar',    cor:'#f59e0b' },
  { id:'verde',    nome:'Verde',    cor:'#34d399' },
  { id:'azul',     nome:'Azul',     cor:'#60a5fa' },
  { id:'rosa',     nome:'Rosa',     cor:'#f472b6' },
  { id:'grafite',  nome:'Grafite',  cor:'#a1a1b5' },
];

function applyAccent(id){
  const achado = ACENTOS.find(a => a.id === id) ? id : 'violeta';
  state.accent = achado;
  /* 'violeta' é o valor que já está nos tokens do :root — não precisa (e não
     deve) de atributo, senão vira uma segunda fonte de verdade pra mesma cor. */
  if (achado === 'violeta') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = achado;
  localStorage.setItem('vtz_accent', achado);
  renderTemaGrid();
}

function renderTemaGrid(){
  const grid = document.getElementById('tema-grid');
  if (grid){
    grid.innerHTML = '';
    ACENTOS.forEach(a => {
      const b = document.createElement('button');
      b.className = 'tema-op' + (state.accent === a.id ? ' on' : '');
      b.innerHTML = `<span class="tema-bola" style="background:${a.cor}"></span>${esc(a.nome)}`;
      b.onclick = () => applyAccent(a.id);
      grid.appendChild(b);
    });
  }
  const esc_ = document.getElementById('tema-escuro');
  const cla_ = document.getElementById('tema-claro');
  if (esc_) esc_.classList.toggle('on', state.theme === 'dark');
  if (cla_) cla_.classList.toggle('on', state.theme === 'light');
}

function setupTemas(){
  const esc_ = document.getElementById('tema-escuro');
  const cla_ = document.getElementById('tema-claro');
  if (esc_) esc_.onclick = () => { applyTheme('dark'); renderTemaGrid(); };
  if (cla_) cla_.onclick = () => { applyTheme('light'); renderTemaGrid(); };
  applyAccent(localStorage.getItem('vtz_accent') || 'violeta');
}
