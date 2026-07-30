/* Service worker do painel.
 *
 * O QUE ELE FAZ: deixa o app abrir sem internet e instalável no celular.
 * O QUE ELE NÃO FAZ, DE PROPÓSITO: não toca em nada que não seja desta origem.
 *
 * A escolha de estratégia é o ponto delicado. O erro clássico de PWA é
 * cache-first num arquivo de nome fixo: `app.js` fica preso na versão antiga e o
 * usuário roda código velho para sempre, sem sintoma nenhum além de "o bug que
 * foi corrigido continua aqui". Como este projeto não põe hash no nome dos
 * arquivos, cache-first seria exatamente essa armadilha.
 *
 * Então: REDE PRIMEIRO, cache como rede reserva. Online você tem sempre a versão
 * certa; offline o app abre. Custa alguns milissegundos e evita a classe inteira
 * de bug "por que a correção não apareceu?".
 */
const VERSAO = 'vtz-v1';
const CONCHA = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.webmanifest',
  './icons/icone-192.png',
  './icons/icone-512.png',
  './vendor/marked.min.js',
  './vendor/purify.min.js',
  './vendor/xlsx.full.min.js',
  './vendor/jspdf.umd.min.js',
  './vendor/docx.umd.min.js',
  './vendor/pptxgen.bundle.js',
  './vendor/html2canvas.min.js',
  './vendor/qrcode.min.js',
];

self.addEventListener('install', (evt) => {
  evt.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    /* addAll falha inteiro se UM arquivo faltar, e aí o app fica sem service
       worker nenhum por causa de um vendor renomeado. Um a um, tolerando falha:
       melhor um cache incompleto que nenhum. */
    await Promise.all(CONCHA.map((u) => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evt) => {
  const req = evt.request;

  /* Só GET desta origem. Deixa passar intocado:
       - OpenRouter e o Backend VTz OS (resposta de modelo não se cacheia)
       - POST/PUT/DELETE
       - a extensão do navegador e qualquer outra origem
     Interceptar isso seria, na melhor hipótese, inútil; na pior, servir resposta
     velha de uma conversa. */
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  evt.respondWith((async () => {
    try {
      const daRede = await fetch(req);
      /* Guarda só o que deu certo. Cachear um 404 deixaria o app quebrado
         mesmo depois de o arquivo voltar. */
      if (daRede && daRede.ok) {
        const cache = await caches.open(VERSAO);
        cache.put(req, daRede.clone()).catch(() => {});
      }
      return daRede;
    } catch (e) {
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      /* Navegação offline sem cache do endereço exato (ex.: veio de um QR com
         parâmetros): cai no index, que é o app inteiro de qualquer forma. */
      if (req.mode === 'navigate') {
        const raiz = await caches.match('./index.html');
        if (raiz) return raiz;
      }
      throw e;
    }
  })());
});
