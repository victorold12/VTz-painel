/* ============================================================
   INSTALAR COMO APLICATIVO (PWA)

   O que isso resolve, na prática: o painel guarda as conversas no navegador,
   então ele já FUNCIONA offline — mas até aqui não ABRIA offline, porque o
   navegador precisava baixar index.html/app.js/style.css. Um service worker
   fecha essa lacuna: com os arquivos em cache, o app abre no avião, no metrô e
   no Wi-Fi caindo. E com o manifest, o celular oferece instalar na tela de
   início, o que também tira a barra de endereço (mais tela pro chat).

   ESTRATÉGIA DE CACHE — ver o comentário no sw.js. Resumo: REDE PRIMEIRO. Os
   arquivos aqui não têm hash no nome (é sempre "app.js"), então cache-first
   prenderia o usuário numa versão antiga pra sempre, e o sintoma seria "o bug
   que você corrigiu continua aqui". Rede primeiro custa alguns milissegundos e
   evita a classe inteira de bug.

   ONDE ISTO NÃO RODA, DE PROPÓSITO:
     - file:// — é assim que o aplicativo de desktop (Electron) carrega a
       página. Service worker não existe nesse esquema, e o app já é nativo:
       não há nada pra instalar nem pra cachear.
     - contexto inseguro (http:// que não seja localhost) — o navegador recusa,
       e é bom que recuse: um SW é código que fica.
   ============================================================ */
let _promptInstalar = null;   // guardado do beforeinstallprompt; só serve uma vez
let _jaInstalado = false;

function pwaPodeTer(){
  if (location.protocol === 'file:') return false;
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/* Instalado = rodando em janela própria. display-mode:standalone cobre Android e
   desktop; navigator.standalone é a versão do iOS, que nunca implementou a
   media query. */
function pwaRodandoInstalado(){
  try{
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  }catch(e){}
  return navigator.standalone === true;
}

function registraServiceWorker(){
  if (!pwaPodeTer()) return;
  navigator.serviceWorker.register('sw.js', { scope: './' }).then((reg) => {
    /* Versão nova baixada com uma antiga já no controle: os arquivos em cache
       são de ontem até a página recarregar. Em vez de recarregar por conta
       própria no meio de uma conversa (perderia o que estava sendo digitado),
       avisa e deixa a escolha com quem está usando. */
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if (!novo) return;
      novo.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller){
          try{ toast('Versão nova do painel baixada. Recarregue para usá-la.', 'ok'); }catch(e){}
        }
      });
    });
  }).catch((e) => {
    /* Falhar aqui não pode derrubar nada: sem service worker o app continua
       inteiro, só não abre offline. */
    console.warn('[pwa] service worker não registrou:', e && e.message);
  });
}
registraServiceWorker();

/* O navegador dispara isto quando decide que o app é instalável. Precisa ser
   capturado no carregamento — não dá pra pedir depois, do nada: `prompt()` só
   funciona a partir deste evento, e só com um clique de verdade atrás. */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _promptInstalar = e;
  pintaEstadoPwa();
});

window.addEventListener('appinstalled', () => {
  _jaInstalado = true;
  _promptInstalar = null;
  pintaEstadoPwa();
  try{ toast('Instalado. Procure o ícone VTz na tela de início.', 'ok'); }catch(e){}
});

/* Texto honesto pra cada caso — inclusive os que não têm botão. O pior estado
   possível seria um botão que não faz nada e nenhuma explicação. */
function pintaEstadoPwa(){
  const btn = document.getElementById('pwa-instalar-btn');
  const txt = document.getElementById('pwa-estado');
  if (!btn || !txt) return;

  if (location.protocol === 'file:'){
    btn.disabled = true;
    txt.innerHTML = 'Você já está no <b>aplicativo de desktop</b> — ele é o programa instalado. ' +
      'Esta opção vale pro painel aberto no navegador.';
    return;
  }
  if (_jaInstalado || pwaRodandoInstalado()){
    btn.disabled = true;
    txt.textContent = 'Já instalado — você está na janela do aplicativo.';
    return;
  }
  if (_promptInstalar){
    btn.disabled = false;
    txt.textContent = 'Pronto pra instalar neste aparelho.';
    return;
  }
  btn.disabled = true;
  /* Sem o evento: ou é iPhone (o Safari nunca implementou; a instalação é
     manual pelo menu Compartilhar), ou já está instalado, ou o navegador ainda
     não decidiu. Dizer isso é mais útil que "indisponível". */
  txt.innerHTML = 'No <b>iPhone/iPad</b>: toque em <b>Compartilhar</b> e depois em ' +
    '<b>Adicionar à Tela de Início</b>. Em outros navegadores o convite aparece ' +
    'sozinho depois de algumas visitas — ou pelo menu do navegador, em "Instalar".';
}

async function instalaPwa(){
  if (!_promptInstalar) return;
  const p = _promptInstalar;
  _promptInstalar = null;            // o evento é de uso único; guardar depois não serve
  try{
    p.prompt();
    const r = await p.userChoice;
    if (r && r.outcome === 'accepted') _jaInstalado = true;
    else try{ toast('Instalação cancelada.'); }catch(e){}
  }catch(e){
    try{ toast('Não consegui abrir o instalador: ' + e.message, 'warn'); }catch(_){}
  }
  pintaEstadoPwa();
}

function setupPwa(){
  const b = document.getElementById('pwa-instalar-btn');
  if (b) b.onclick = () => instalaPwa();
  pintaEstadoPwa();
}
