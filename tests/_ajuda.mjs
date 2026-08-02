/* Peças comuns dos testes de ponta a ponta do painel.
 *
 * POR QUE ESTES TESTES EXISTEM AQUI, E NÃO NUM RASCUNHO: eles já foram escritos
 * uma vez, rodaram, passaram — e sumiram junto com o ambiente antes de serem
 * commitados. Teste que não está no repositório não é teste, é uma lembrança de
 * que algo funcionou um dia.
 *
 * POR QUE NO NAVEGADOR DE VERDADE: o app é um IIFE. Nada é exportado, nada é
 * importável — o único jeito honesto de exercitar o código é pelo mesmo caminho
 * que uma pessoa usa. Chamar função interna por dentro provaria que a função
 * existe, não que o app funciona.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* fileURLToPath e não new URL().pathname: no Windows o pathname vem como
   "/C:/..." e vira caminho inválido ao resolver. Mesma armadilha que já mordeu
   o prepare-webapp.js do repo servidor. */
export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

/** Serve o painel como um servidor estático serviria. */
export async function servePainel(porta){
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const arq = path.join(RAIZ, rel);
    // Confere que o caminho não escapou da raiz — o teste serve o repo inteiro.
    if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()){
      res.writeHead(404); res.end('nao'); return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
    res.end(fs.readFileSync(arq));
  });
  await new Promise(r => srv.listen(porta, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${porta}`,
    fecha: () => new Promise(r => srv.close(r)),
  };
}

/* --no-proxy-server: em ambiente com proxy configurado por variável, o Chromium
   tenta tunelar até 127.0.0.1 e falha com ERR_TUNNEL_CONNECTION_FAILED — que
   parece defeito do app e não é.
   swiftshader: sem GPU no CI, a cena WebGL do JARVIS não sobe sem isso. */
export function abreNavegador(){
  return chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--no-proxy-server'],
  });
}

/* reducedMotion: sem isso, transições de CSS não avançam em headless e o teste
   mede um estado intermediário — falso negativo que some ao rodar de novo. */
export async function novoContexto(navegador, opts = {}){
  return navegador.newContext({
    viewport: { width: 1360, height: 900 },
    reducedMotion: 'reduce',
    ...opts,
  });
}

/* Catálogo de modelos falso. O teste não pode depender do catálogo real: ele
   muda toda semana e levaria a suíte junto. */
export const CATALOGO_MINIMO = [
  { id:'anthropic/claude-sonnet-5', name:'Sonnet 5',
    pricing:{prompt:'0.000002', completion:'0.00001'}, context_length:200000, created:220 },
  { id:'google/gemini-2.5-flash', name:'Gemini Flash',
    pricing:{prompt:'0.0000003', completion:'0.0000012'}, context_length:1048576, created:100 },
];

export async function fingeCatalogo(ctx, modelos = CATALOGO_MINIMO){
  await ctx.route('**/openrouter.ai/api/v1/models*', rota => rota.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: modelos }),
  }));
}

/* Toast some sozinho em poucos segundos. Ler o DOM depois mediria "já sumiu";
   observar a inserção é o único jeito de saber se ele APARECEU.
   `document` e não `document.body`: isto roda antes de existir body. */
export async function gravaAvisos(ctx){
  await ctx.addInitScript(() => {
    window.__avisos = [];
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && /toast/i.test(n.className || '')) window.__avisos.push(n.innerText || '');
    }))).observe(document, { childList: true, subtree: true });
  });
}

export const avisos = (p) =>
  p.evaluate(() => (window.__avisos || []).join(' | ').replace(/\s+/g, ' '));

/** Abre Configurações numa categoria. É o caminho que a pessoa percorre. */
export async function abreConfig(p, categoria){
  await p.evaluate(() => document.getElementById('account-btn')?.click());
  await p.waitForTimeout(250);
  await p.evaluate(() => [...document.querySelectorAll('#account-menu button')]
    .find(e => /^Configura/i.test(e.textContent.trim()))?.click());
  await p.waitForTimeout(450);
  await p.evaluate((c) => document.querySelector(`#cfg-nav [data-cat="${c}"]`)?.click(), categoria);
  await p.waitForTimeout(600);
}

/* Configurações é uma VIEW, não um modal — voltar é pela navegação lateral. */
export async function voltaProChat(p){
  await p.evaluate(() => document.querySelector('.side-nav-item[data-view="chat"]')?.click());
  await p.waitForTimeout(600);
}

/* Confere que a porta está LIVRE antes de o teste subir algo nela.
 *
 * POR QUE ISTO EXISTE: um teste que derruba e religa um backend deixa processo
 * órfão se for interrompido no meio. Na execução seguinte, o backend novo não
 * consegue abrir a porta, mas o teste faz a chamada de saúde e recebe "ok" — do
 * processo VELHO, que continua lá com o banco antigo. A partir daí o teste
 * conversa com um servidor que não é o dele e falha dizendo qualquer outra
 * coisa: "o servidor deveria estar vazio e não está". Já custou meia hora.
 *
 * Falhar aqui, dizendo o nome do problema, vale mais que qualquer diagnóstico
 * depois.
 */
export async function exigePortaLivre(porta){
  const ocupada = await new Promise(ok => {
    const s = http.createServer();
    s.once('error', () => ok(true));
    s.once('listening', () => s.close(() => ok(false)));
    s.listen(porta, '127.0.0.1');
  });
  if (ocupada){
    throw new Error(
      `A porta ${porta} já está ocupada. Provavelmente sobrou um servidor de uma ` +
      `execução anterior interrompida. Derrube com:\n` +
      `  pkill -f "uvicorn app.main:app --port ${porta}"\n` +
      `Seguir daqui faria o teste conversar com o servidor errado.`);
  }
}

/** Placar simples; cada teste imprime as próprias linhas. */
export function placar(){
  const falhas = [];
  return {
    falhas,
    checa(nome, cond, extra = ''){
      console.log((cond ? '  ok  ' : 'FALHA ') + nome + (cond ? '' : '  ' + JSON.stringify(extra)));
      if (!cond) falhas.push(nome);
    },
    fim(){
      console.log('\n' + (falhas.length
        ? `${falhas.length} FALHA(S): ${falhas.join(', ')}`
        : 'tudo passou'));
      return falhas.length ? 1 : 0;
    },
  };
}

/* O repo `servidor` é irmão deste (mesmo padrão do prepare-webapp.js de lá).
   Os testes que precisam do backend REAL pulam com aviso quando ele não está
   por perto — pular dizendo por quê é melhor que falhar dizendo outra coisa. */
export function achaServidor(){
  const candidatos = [
    process.env.VTZ_SERVIDOR_PATH || '',
    path.resolve(RAIZ, '..', 'servidor'),
  ].filter(Boolean);
  return candidatos.find(c => fs.existsSync(path.join(c, 'app', 'main.py'))) || null;
}

/* Como chamar o Python nesta máquina.
 *
 * Os testes de integração faziam `spawn('python3', ...)` — convenção de
 * Linux/macOS. No Windows `python3` não existe (ou é o atalho da Microsoft
 * Store, que abre a loja em vez de rodar), então a suíte inteira reprovava com
 * "o backend não subiu" em qualquer máquina Windows.
 *
 * Isso importa mais do que parece: o projeto decidiu que instalador, voz e
 * .msi se depuram MELHOR na máquina do Victor, que é Windows. Um arnês que só
 * roda em Linux empurra toda verificação de volta pro CI, que é o oposto.
 *
 * VTZ_PYTHON permite apontar um interpretador específico quando a heurística
 * não serve (vários Pythons instalados, venv, etc).
 */
export function comandoPython() {
  const escolhido = process.env.VTZ_PYTHON;
  if (escolhido) return { cmd: escolhido, prefixo: [] };
  // `py -3.12` é o lançador oficial do Windows; a versão é a mesma que o
  // projeto exige por causa do torch (ver CLAUDE.md).
  if (process.platform === 'win32') return { cmd: 'py', prefixo: ['-3.12'] };
  return { cmd: 'python3', prefixo: [] };
}
