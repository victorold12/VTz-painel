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
  checa(motor + ': usa ambiente virtual isolado', /python -m venv \.venv/.test(txt));
  checa(motor + ': instala as dependências do projeto', /pip install -r requirements\.txt/.test(txt));
  checa(motor + ': manda ler o README quando depende da máquina',
    /README/.test(txt) && /torch/i.test(txt));
  checa(motor + ': diz a porta que o JARVIS procura', txt.includes(porta), porta);
  checa(motor + ': avisa que o modelo baixa na primeira vez', /primeira vez/i.test(txt));
  /* Um `rmdir /s`, `del /q` ou `format` aqui seria catastrófico e silencioso.
     O script só clona e instala — nada que apague. */
  checa(motor + ': não apaga nada no PC de ninguém',
    !/rmdir|del \/|format |reg delete/i.test(txt));
  checa(motor + ': para no primeiro erro em vez de seguir quebrado',
    /exit \/b 1/.test(txt));
}

console.log('— a tela explica o que fazer com o arquivo');
const msg = await p.evaluate(() => document.getElementById('voz-inst-msg')?.innerText || '');
checa('confirma o download', /baixado/i.test(msg), msg.slice(0, 120));
checa('e manda ler antes de rodar', /Bloco de Notas|leia/i.test(msg), msg.slice(0, 160));

checa('sem erro de página', erros.length === 0, erros.slice(0, 3));

const saida = fim();
await b.close();
await estatico.fecha();
process.exit(saida);
