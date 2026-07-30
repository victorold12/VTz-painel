/* ============================================================
   ABRIR NO CELULAR (QR)

   O painel já é uma página web, e o Agente Local já obedece comandos vindos do
   backend. Então "controlar o PC pelo celular" não precisa de app novo nem de
   protocolo novo: precisa que o celular abra ESTA página apontada pro MESMO
   backend. O QR é só o atalho pra isso — sem ele, a alternativa é digitar uma
   URL e um token aleatório numa tela de toque.

   O QR CARREGA UM SEGREDO. É o token do backend, e quem fotografar a tela entra
   no seu servidor. Duas defesas, as duas por isso:
     - a tela diz o que está ali dentro, em vez de mostrar um quadrado mudo
     - o código some sozinho depois de QR_VALIDADE_MS

   E do lado de quem abre: os parâmetros são apagados da barra de endereço assim
   que lidos (history.replaceState). Sem isso o token ficaria no histórico do
   navegador do celular, e num print de tela.
   ============================================================ */
const QR_VALIDADE_MS = 120000;
let _qrTimer = null;

/* Lê ?backend=&token= e guarda. Roda no carregamento do módulo, não num
   setup(): quando os setups rodam, state.backendUrl já foi lido do localStorage
   (01-memory-graph-migrate.js), e escrever só no localStorage aqui deixaria a
   memória e o disco discordando até o próximo reload. Por isso escreve nos dois. */
function aplicaConfigDaUrl(){
  let p;
  try{ p = new URLSearchParams(location.search); }catch(e){ return false; }
  const url = (p.get('backend') || '').trim();
  const token = (p.get('token') || '').trim();
  if (!url && !token) return false;

  if (url){
    /* Só http(s). Um parâmetro vindo de fora não pode virar javascript: nem
       apontar o painel pra um esquema estranho. */
    let limpa = '';
    try{
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:') limpa = u.href.replace(/\/+$/, '');
    }catch(e){ /* URL inválida: ignora, não derruba o boot */ }
    if (limpa){
      localStorage.setItem('vtz_backend_url', limpa);
      if (typeof state === 'object' && state) state.backendUrl = limpa;
    }
  }
  if (token){
    localStorage.setItem('vtz_backend_token', token);
    if (typeof state === 'object' && state) state.backendToken = token;
  }

  /* Tira da barra de endereço. O token não pode ficar no histórico. */
  try{
    p.delete('backend'); p.delete('token');
    const resto = p.toString();
    history.replaceState(null, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
  }catch(e){ /* navegador antigo: pior caso o parâmetro fica; o resto funcionou */ }
  return true;
}
const _veioDeQr = aplicaConfigDaUrl();

/* O endereço que o celular precisa abrir. Se o painel está sendo servido por
   http(s), é a própria origem. No app de desktop a página é file://, que o
   celular não alcança — nesse caso não há QR possível e a tela explica. */
function enderecoDoPainel(){
  if (location.protocol === 'file:') return null;
  return location.origin + location.pathname;
}

function montaLinkCelular(){
  const base = enderecoDoPainel();
  if (!base) return null;
  const p = new URLSearchParams();
  if (backendUrl()) p.set('backend', backendUrl());
  if (state.backendToken) p.set('token', state.backendToken);
  const q = p.toString();
  return base + (q ? '?' + q : '');
}

async function mostraQrCelular(){
  const caixa = document.getElementById('qr-celular');
  if (!caixa) return;
  clearTimeout(_qrTimer);

  const base = enderecoDoPainel();
  if (!base){
    caixa.innerHTML = '<p class="hint">Este é o aplicativo do PC, e a página dele mora no seu ' +
      'disco (<code>file://</code>) — o celular não tem como abrir esse endereço. Publique o ' +
      'painel (Render, GitHub Pages, qualquer servidor) e abra por lá pra gerar o QR.</p>';
    return;
  }
  if (!backendUrl()){
    caixa.innerHTML = '<p class="hint">Configure o Backend VTz OS primeiro. Sem ele o celular ' +
      'abriria o painel mas não alcançaria o seu PC.</p>';
    return;
  }
  if (typeof QRCode === 'undefined'){
    caixa.innerHTML = '<p class="hint erro">O gerador de QR não carregou. Recarregue a página.</p>';
    return;
  }

  const link = montaLinkCelular();
  const temToken = !!state.backendToken;
  caixa.innerHTML =
    '<canvas id="qr-canvas" width="240" height="240" aria-label="Código QR para abrir no celular"></canvas>' +
    '<div class="qr-lado">' +
      '<p class="hint"><b>Aponte a câmera do celular.</b> Ele abre este painel já ligado ao seu ' +
        'Backend VTz OS — e, com o PC pareado, os comandos chegam aqui.</p>' +
      (temToken
        ? '<p class="hint aviso">Este código contém o <b>token de acesso</b> do seu backend. ' +
          'Quem fotografar a tela entra no seu servidor. Ele some sozinho em 2 minutos.</p>'
        : '<p class="hint">Sem token configurado: no celular você vai precisar digitá-lo à mão.</p>') +
      '<p class="hint" id="qr-conta"></p>' +
    '</div>';

  try{
    await QRCode.toCanvas(document.getElementById('qr-canvas'), link,
      { width: 240, margin: 1, color: { dark: '#0b0b0f', light: '#ffffff' } });
  }catch(e){
    caixa.innerHTML = '<p class="hint erro">Não consegui gerar o QR: ' + esc(e.message) + '</p>';
    return;
  }

  const conta = document.getElementById('qr-conta');
  const fim = Date.now() + QR_VALIDADE_MS;
  const tick = () => {
    const resta = Math.max(0, Math.round((fim - Date.now()) / 1000));
    if (conta) conta.textContent = `Some em ${resta}s`;
    if (resta <= 0){
      caixa.innerHTML = '<p class="hint">O código expirou. Gere outro quando precisar.</p>';
      return;
    }
    _qrTimer = setTimeout(tick, 1000);
  };
  tick();
}

function setupQrCelular(){
  const b = document.getElementById('qr-celular-btn');
  if (b) b.onclick = () => mostraQrCelular();
  /* Quem acabou de chegar pelo QR merece saber que deu certo — senão a tela
     parece igual à de antes e a pessoa fica sem saber se funcionou. */
  if (_veioDeQr){
    try{ toast('Backend configurado pelo QR. Você está ligado ao seu PC.', 'ok'); }catch(e){}
  }
}
