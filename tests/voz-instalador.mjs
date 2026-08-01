/* O botão gera um .bat que vai RODAR NA MÁQUINA DE ALGUÉM. Um teste que só
 * conferisse "o botão existe" seria teatro — o que importa é o conteúdo do
 * arquivo, e o conteúdo é o que pode dar errado em silêncio.
 *
 * O que fica travado aqui:
 *   - a seção aparece MESMO SEM PC pareado (é o momento em que ela serve)
 *   - o arquivo baixa com nome de .bat e conteúdo de .bat
 *   - quebra de linha CRLF: .bat com quebra do Unix roda torto no cmd, e o
 *     sintoma é uma linha simplesmente não executar, sem erro nenhum
 *   - confere Python e Git ANTES de tentar qualquer coisa
 *   - clona ao lado do próprio arquivo (`cd /d "%~dp0"`), não no disco todo
 *   - usa ambiente virtual: desinstalar é apagar a pasta, não caçar pacote
 *   - não inventa comando quando a instalação depende da máquina — manda ler
 *     o README em vez de instalar a variante errada
 *   - a porta que sai no texto é a MESMA que o Agente Local procura
 */
import {
  servePainel, abreNavegador, novoContexto, fingeCatalogo,
  abreConfig, placar, exigePortaLivre,
} from './_ajuda.mjs';

const { checa, fim } = placar();
await exigePortaLivre(8200);
const estatico = await servePainel(8200);

const b = await abreNavegador();
const ctx = await novoContexto(b, { acceptDownloads: true });
await fingeCatalogo(ctx);
/* SEM backend e SEM agente pareado, de propósito: é exatamente o estado de quem
   ainda não instalou nada — e era o estado em que a seção ficava escondida. */
await ctx.addInitScript(() => localStorage.setItem('vtz_or_key', 'sk-t'));
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));
await p.goto(estatico.url + '/index.html');
await p.waitForTimeout(2600);

console.log('— a seção aparece mesmo sem PC pareado');
await abreConfig(p, 'voz');
const visivel = await p.evaluate(() => {
  const el = document.getElementById('voz-instalar');
  if (!el) return { existe: false };
  const r = el.getBoundingClientRect();
  return { existe: true, visivel: r.height > 0, corpoEscondido: !!document.getElementById('voz-body')?.hidden };
});
checa('a seção existe', visivel.existe, visivel);
checa('e está visível', visivel.visivel === true, visivel);
checa('mesmo com o resto da aba escondido', visivel.corpoEscondido === true, visivel);

async function baixa(botao){
  const [dl] = await Promise.all([
    p.waitForEvent('download', { timeout: 15000 }),
    p.click(botao),
  ]);
  const caminho = await dl.path();
  const fs = await import('node:fs');
  return { nome: dl.suggestedFilename(), txt: fs.readFileSync(caminho, 'utf-8') };
}

for (const [motor, botao, porta, repo] of [
  ['Chatterbox', '#voz-inst-chatterbox', '8004', 'devnen/Chatterbox-TTS-Server'],
  ['Kokoro',     '#voz-inst-kokoro',     '8880', 'remsky/Kokoro-FastAPI'],
]){
  console.log('— ' + motor);
  const { nome, txt } = await baixa(botao);
  checa(motor + ': nome termina em .bat', nome.endsWith('.bat'), nome);
  checa(motor + ': começa como script do Windows', txt.startsWith('@echo off'), txt.slice(0, 30));

  /* CRLF de verdade: procurar por \n sem \r antes pega o erro que faria o
     script rodar pela metade sem avisar. */
  const lfSozinho = (txt.match(/(?<!\r)\n/g) || []).length;
  checa(motor + ': quebra de linha é CRLF (senão o cmd engasga)', lfSozinho === 0, lfSozinho + ' linha(s) só com LF');

  checa(motor + ': confere Git antes de usar', /where git/.test(txt));
  checa(motor + ': confere Python antes de usar', /where python/.test(txt));
  checa(motor + ': e diz onde instalar o que falta',
    /git-scm\.com/.test(txt) && /python\.org/.test(txt));
  checa(motor + ': instala ao lado do próprio arquivo', /cd \/d "%~dp0"/.test(txt));
  checa(motor + ': clona o repositório certo', txt.includes(repo), repo);
  /* `-m venv .venv` sem cravar o executável: desde que o script passou a
     escolher a versão compatível, quem cria o ambiente é `%PYEXE%` (que vale
     `py -3.12`, ou `python` quando o do PATH já serve). Exigir literalmente
     "python -m venv" reprovava justamente a correção. */
  checa(motor + ': usa ambiente virtual isolado', /-m venv \.venv/.test(txt));
  checa(motor + ': instala as dependências do projeto', /pip install -r requirements\.txt/.test(txt));
  checa(motor + ': manda ler o README quando depende da máquina',
    /README/.test(txt) && /torch/i.test(txt));
  checa(motor + ': diz a porta que o JARVIS procura', txt.includes(porta), porta);
  checa(motor + ': avisa que o modelo baixa na primeira vez', /primeira vez/i.test(txt));
  /* Um `rmdir /s`, `del /q` ou `format` solto aqui seria catastrófico e
     silencioso. A regra NÃO é "nenhum apagar existe" — o script apaga o próprio
     `.venv` de propósito, quando descobre que um ambiente sobrou de uma
     tentativa com o Python errado (reaproveitar significaria falhar de novo pelo
     mesmo motivo, agora sem nem a pista da versão na tela). A regra é que TODO
     apagar aponte pra algo que o próprio script criou. */
  const destrutivas = txt.split('\r\n').filter(l => /rmdir|del \/|format |reg delete/i.test(l));
  checa(motor + ': só apaga o que ele mesmo criou',
    destrutivas.every(l => /\.venv/.test(l)), destrutivas);
  checa(motor + ': para no primeiro erro em vez de seguir quebrado',
    /exit \/b 1/.test(txt));
}

console.log('— a tela explica o que fazer com o arquivo');
const msg = await p.evaluate(() => document.getElementById('voz-inst-msg')?.innerText || '');
checa('confirma o download', /baixado/i.test(msg), msg.slice(0, 120));
checa('e manda ler antes de rodar', /Bloco de Notas|leia/i.test(msg), msg.slice(0, 160));

/* ============================================================
   No navegador o botão de TUDO tem que continuar BAIXANDO. É metade do pedido
   do instalador embutido ("no navegador, manter o download como está"), e a
   forma de quebrar isso é sutil: bastaria a tela decidir o modo ao carregar,
   em vez de no clique, pra a mesma build passar a se comportar diferente. */
console.log('— fora do Electron, TUDO continua baixando um .bat');
const tudo = await baixa('#voz-inst-tudo');
checa('nome do arquivo de TUDO', tudo.nome === 'instalar-tudo.bat', tudo.nome);
checa('conteúdo é script do Windows', tudo.txt.startsWith('@echo off'), tudo.txt.slice(0, 30));
checa('instala em Documentos\\VTz LLM', /VTz LLM/.test(tudo.txt));

/* ===== O que a execução na máquina do Victor custou pra descobrir =====
   Cada asserção abaixo corresponde a um defeito que só apareceu rodando de
   verdade — nenhum deles derrubou o CI, porque o CI instalava e nunca ligava. */

/* 1. ORDEM. Instalar o requirements (que fixa torch 2.5.1) e só depois forçar
      2.6.0 obriga o pip a DESINSTALAR — a operação mais frágil daqui, porque
      mexe em milhares de arquivos em uso. Foi interrompida no meio por uma
      pasta do PATH que o Windows recusa atravessar, o rollback não conseguiu
      restaurar, e sobrou um torch pela metade. Os sintomas ("cannot import
      name 'autocast'") não têm nenhuma relação aparente com a causa. */
{
  const iTorch = tudo.txt.indexOf('pip install torch==2.6.0');
  const iReq   = tudo.txt.indexOf('pip install -r "requirements-jarvis.txt"');
  checa('torch é instalado ANTES das dependências', iTorch > 0 && iReq > 0 && iTorch < iReq,
    { iTorch, iReq });
  checa('e o requirements usado não tem as linhas de torch',
    tudo.txt.includes('requirements_sem_torch') && tudo.txt.includes("-notmatch '^\\s*torch"),
    tudo.txt.slice(tudo.txt.indexOf('-notmatch'), tudo.txt.indexOf('-notmatch') + 60));
  /* torchsde é dependência real do Chatterbox: o filtro não pode levá-lo junto. */
  checa('o filtro usa fronteira de palavra (não mata torchsde)',
    tudo.txt.includes('torch(vision|audio)?\\b'));
}

/* 2. O venv corrompido tem que ser RECONHECIDO. Sem isto o script segue e
      declara vitória sobre um ambiente que não roda. */
checa('confere se o torch sobreviveu à instalação',
  /python -c "import torch; torch\.zeros\(1\)"/.test(tudo.txt));

/* 3. Projeto sem requirements.txt. O Kokoro-FastAPI usa pyproject.toml, e o
      script recusava instalar — ou seja, o Kokoro nunca foi instalado por
      aqui, e o venv vazio depois falhava com "No module named uvicorn". */
checa('instala projeto que só tem pyproject.toml',
  /pyproject\.toml/.test(tudo.txt) && /pip install \./.test(tudo.txt));

/* 4. `-AsHashtable` só existe no PowerShell 6+; o Windows roda o 5.1. Este
      passo falhava em TODA máquina, sempre, e calado. */
checa('não usa -AsHashtable (não existe no PowerShell do Windows)',
  !/AsHashtable/.test(tudo.txt));

/* 5. O Kokoro não tem server.py — o ligar-vozes.bat mandava um comando que não
      existe, inclusive no login do Windows pelo atalho da Inicialização. */
checa('o ligar-vozes sobe o Kokoro pelo uvicorn',
  /uvicorn api\.src\.main:app --host 127\.0\.0\.1 --port 8880/.test(tudo.txt));

/* ============================================================
   DENTRO do Electron o MESMO botão instala aqui dentro.

   A ponte é falsificada porque o que está sendo testado é a decisão do painel,
   não o Electron: se ele chama a ponte em vez de baixar, se manda o modelo que
   está selecionado na tela, e se o log aparece na hora em vez de no fim. Um
   teste que só conferisse "a função existe" não pegaria nenhuma das três.
   ============================================================ */
console.log('— dentro do Electron, o mesmo botão instala sem baixar nada');
/* Contexto NOVO, e a ponte instalada por addInitScript: o build é um IIFE, então
   as funções do painel não existem em `window` e não dá pra religar os botões de
   fora. Injetar antes do app carregar é também o que acontece de verdade — o
   preload do Electron roda antes do documento. */
const ctxE = await novoContexto(b, { acceptDownloads: true });
await fingeCatalogo(ctxE);
await ctxE.addInitScript(() => {
  localStorage.setItem('vtz_or_key', 'sk-t');
  window.__chamadas = [];
  let emite = null;
  window.jarvisDesktop = {
    isElectron: true,
    platform: 'win32',
    vozes: {
      estado: async () => ({ suportado: true, rodando: false,
                             motores: [{ id:'chatterbox', instalado: true }] }),
      instalar: async (modelo) => {
        window.__chamadas.push(modelo);
        emite?.({ tipo:'fase', fase:'instalando', texto:'Rodando o instalador…' });
        emite?.({ tipo:'linha', texto:'--- [1/7] Git' });
        emite?.({ tipo:'linha', texto:'      [ok] ja instalado.' });
        /* Saída de terceiros com cara de HTML: é o que chegaria se um caminho de
           pacote (ou um pacote malicioso) trouxesse marcação. */
        emite?.({ tipo:'linha', texto:'<img src=x onerror="window.__xss=1">' });
        emite?.({ tipo:'fim', ok:true, texto:'Pronto.' });
        return { ok: true };
      },
      ligar: async () => ({ ok: true }),
      cancelar: async () => ({ ok: true }),
      aoProgredir: (cb) => { emite = cb; return () => { emite = null; }; },
    },
  };
});
const pe = await ctxE.newPage();
const errosE = [];
pe.on('pageerror', e => errosE.push(e.message));
await pe.goto(estatico.url + '/index.html');
await pe.waitForTimeout(2600);
await abreConfig(pe, 'voz');
/* ajustaTextoInstaladores() é assíncrono: pergunta o estado à ponte. */
await pe.waitForTimeout(400);

const rotulo = await pe.evaluate(() => document.getElementById('voz-inst-tudo')?.textContent || '');
checa('o botão passa a dizer que instala, não que baixa',
  /instalar/i.test(rotulo) && !/baixar/i.test(rotulo), rotulo);

/* Escolhe um modelo diferente do padrão: se o painel mandasse "base" cravado
   pra ponte, este é o teste que pegaria.

   A lista de modelos é preenchida por vozRenderStt(), que só roda quando existe
   um PC pareado — e aqui, de propósito, não existe (é o estado de quem ainda vai
   instalar; sem pareamento o instalador usa "base", que é o padrão certo). Então
   o teste monta a opção à mão pra chegar no estado de DEPOIS do pareamento, que
   é quando trocar de modelo e reinstalar faz sentido. */
const trocou = await pe.evaluate(() => {
  const s = document.getElementById('voz-stt-model');
  if (!s) return false;
  s.innerHTML = '<option value="base">base</option><option value="small">small</option>';
  s.value = 'small';
  return s.value === 'small';
});
checa('deu pra escolher outro modelo do whisper', trocou === true);

let baixouAlgo = false;
pe.once('download', () => { baixouAlgo = true; });
await pe.click('#voz-inst-tudo');
await pe.waitForTimeout(800);

const dentro = await pe.evaluate(() => ({
  chamadas: window.__chamadas,
  painelVisivel: !document.getElementById('voz-inst-painel')?.hidden,
  log: document.getElementById('voz-inst-log')?.textContent || '',
  fase: document.getElementById('voz-inst-fase')?.textContent || '',
  xss: !!window.__xss,
  temImg: !!document.getElementById('voz-inst-log')?.querySelector('img'),
}));

checa('chamou a ponte do desktop', dentro.chamadas.length === 1, dentro.chamadas);
checa('e mandou o modelo escolhido na tela, não um fixo',
  dentro.chamadas[0] === 'small', dentro.chamadas);
checa('NÃO baixou arquivo nenhum', baixouAlgo === false);
checa('abriu o painel de progresso', dentro.painelVisivel === true);
checa('e mostra as linhas do instalador em tempo real',
  /\[1\/7\] Git/.test(dentro.log) && /ja instalado/.test(dentro.log), dentro.log.slice(0, 300));
checa('a fase aparece pra quem está olhando', dentro.fase.length > 0, dentro.fase);

/* O log recebe saída de pip, git e PowerShell — texto de terceiros. Escrito como
   HTML, um caminho com "<" sumiria com metade da linha, e coisa pior seria
   possível numa janela que já tem a ponte pro processo principal. */
checa('o log não executa o que veio do instalador', dentro.xss === false);
checa('nem cria elemento a partir dele', dentro.temImg === false);
checa('mostra o texto como veio', dentro.log.includes('<img src=x'), dentro.log.slice(-120));

checa('sem erro de página (navegador)', erros.length === 0, erros.slice(0, 3));
checa('sem erro de página (desktop)', errosE.length === 0, errosE.slice(0, 3));

const saida = fim();
await b.close();
await estatico.fecha();
process.exit(saida);
