/* Passa TODO tipo de resposta pelo renderizador e olha o que sai.
 *
 * Nasceu de uma fórmula chegando crua na tela: "$ q = \frac{80}{0.004} $". Mas
 * o pedido foi mais amplo — "veja se alguma mais faz isso" —, então aqui está
 * cada forma que uma resposta de modelo costuma tomar. O que o teste procura é
 * sinal de renderizador quebrado: delimitador sobrando, comando LaTeX cru,
 * marcador interno vazando pro texto.
 *
 * O que ele NÃO faz é julgar se a fórmula ficou bonita — isso é problema do
 * KaTeX, que tem teste próprio. A pergunta aqui é: o texto do modelo virou HTML
 * sem sobrar lixo pra pessoa ler?
 */
import { servePainel, abreNavegador, novoContexto, placar, exigePortaLivre } from './_ajuda.mjs';

const MARCA = /[]/;   // os marcadores internos da extração de matemática

const { checa, fim } = placar();
await exigePortaLivre(8207);
const estatico = await servePainel(8207);
const b = await abreNavegador();
const ctx = await novoContexto(b);
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));
/* Bancada, e não o index.html: o bundle de produção é uma IIFE minificada, e
   `safeRenderMarkdown` não existe no `window` — este teste ficou quebrado desde
   que o build passou a empacotar assim, falhando com "is not defined". A
   bancada carrega os arquivos REAIS de src/js como scripts clássicos, sem
   mudar o produto pra acomodar o teste (ver src/js/_harness-markdown.html). */
await p.goto(estatico.url + '/src/js/_harness-markdown.html');
await p.waitForTimeout(1800);

const renderiza = (md) => p.evaluate(t => {
  const d = document.createElement('div');
  d.innerHTML = safeRenderMarkdown(t);
  document.body.appendChild(d);
  const r = { html: d.innerHTML, texto: d.innerText };
  d.remove();
  return r;
}, md);

checa('o KaTeX carregou', await p.evaluate(() => typeof katex !== 'undefined'));

console.log('— matemática (o defeito relatado)');
const CASOS_MAT = [
  ['cifrão em linha',      'A conta: $q = \\frac{80 \\cdot 0.04 \\cdot 20}{0.004} = 16000\\,\\text{W}$ e pronto.'],
  ['cifrão duplo (bloco)', 'Resultado:\n\n$$E = mc^2$$\n\nSimples.'],
  ['colchete',             'Veja:\n\n\\[\\int_0^1 x^2\\,dx = \\frac{1}{3}\\]\n'],
  ['parêntese',            'O valor \\(\\alpha = 0.5\\) é o padrão.'],
  ['índice com underline', 'Para cada $x_{i}$ temos $y_{i} = 2x_{i}$.'],
  ['raiz e somatório',     '$$\\sum_{i=1}^{n} \\sqrt{x_i^2 + 1}$$'],
  ['matriz',               '$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$'],
];
for (const [nome, md] of CASOS_MAT){
  const r = await renderiza(md);
  checa(`${nome}: virou fórmula`, /katex/.test(r.html), r.html.slice(0, 110));
  checa(`${nome}: sem comando LaTeX na tela`,
        !/\\frac|\\cdot|\\sum|\\int|\\sqrt|\\text|\\begin|\\alpha/.test(r.texto), r.texto.slice(0, 90));
  checa(`${nome}: sem delimitador sobrando`,
        !/\$\$|\\\[|\\\]|\\\(|\\\)/.test(r.texto), r.texto.slice(0, 90));
  checa(`${nome}: sem marcador vazando`, !MARCA.test(r.texto), JSON.stringify(r.texto.slice(0, 60)));
}

/* Fórmula inválida não pode derrubar a resposta inteira: o usuário perderia o
   texto por causa de uma chave que o modelo esqueceu de fechar. */
{
  const r = await renderiza('Isto quebra: $\\frac{1}{$ mas o resto continua legível.');
  checa('fórmula inválida: o texto ao redor sobrevive', /o resto continua legível/.test(r.texto), r.texto.slice(0, 90));
  checa('fórmula inválida: sem marcador vazando', !MARCA.test(r.texto), JSON.stringify(r.texto.slice(0, 60)));
}

console.log('— cifrão que NÃO é matemática');
for (const [nome, md] of [
  ['preço',              'Custa $50 e o outro $80.'],
  ['variável em código', 'Rode `echo $PATH` no terminal.'],
  ['bloco de código',    '```bash\nexport CHAVE=$MINHA\necho $HOME\n```'],
]){
  const r = await renderiza(md);
  checa(`${nome}: não virou fórmula`, !/katex/.test(r.html), r.html.slice(0, 100));
  checa(`${nome}: cifrão preservado`, r.texto.includes('$'), JSON.stringify(r.texto.slice(0, 70)));
}

console.log('— outras formas de resposta');
for (const [nome, md, ok] of [
  ['tabela',           '| a | b |\n|---|---|\n| 1 | 2 |',        h => /<table/.test(h)],
  ['código tipado',    '```python\ndef f(x):\n    return x*2\n```', h => /<pre/.test(h) && /<code/.test(h)],
  ['lista aninhada',   '- um\n  - dois\n    - três',              h => (h.match(/<ul/g) || []).length >= 2],
  ['lista numerada',   '1. um\n2. dois',                          h => /<ol/.test(h)],
  ['citação',          '> texto citado',                          h => /<blockquote/.test(h)],
  ['link',             '[VTz](https://exemplo.com)',              h => /<a [^>]*href="https:\/\/exemplo\.com"/.test(h)],
  ['negrito e itálico','**forte** e *torto*',                     h => /<strong/.test(h) && /<em/.test(h)],
  ['títulos',          '# Um\n\n## Dois',                         h => /<h1/.test(h) && /<h2/.test(h)],
  ['riscado',          '~~riscado~~',                             h => /<del|<s>/.test(h)],
  ['régua',            'a\n\n---\n\nb',                           h => /<hr/.test(h)],
  ['parágrafos',       'linha um\n\nlinha dois',                  h => (h.match(/<p>/g) || []).length >= 2],
]){
  const r = await renderiza(md);
  checa(nome, ok(r.html), r.html.slice(0, 120));
}

console.log('— segurança (o desvio da matemática não pode ter afrouxado o sanitize)');
for (const [nome, md] of [
  ['script',          '<script>window.__furou = 1<\/script>'],
  ['onerror',         '<img src=x onerror="window.__furou=1">'],
  ['link javascript', '[clique](javascript:window.__furou=1)'],
  ['iframe',          '<iframe src="https://exemplo.com"></iframe>'],
]){
  const r = await renderiza(md);
  checa(`${nome}: neutralizado`, !/<script|onerror=|javascript:|<iframe/i.test(r.html), r.html.slice(0, 110));
}
checa('nada executou', await p.evaluate(() => !window.__furou));

/* Fórmula não é conteúdo confiável: se o KaTeX aceitasse \href ou macros com
   \includegraphics, o desvio viraria um caminho de injeção que passa longe do
   DOMPurify. `trust:false` fecha isso — e é aqui que se verifica. */
{
  const r = await renderiza('$\\href{javascript:window.__furou=1}{clique}$');
  /* Procurar a string "javascript:" no HTML inteiro reprova o inocente: com
     `trust:false` o KaTeX renderiza `\href` como TEXTO e ainda ecoa o LaTeX
     original dentro de <annotation encoding="application/x-tex">. O
     "javascript:" aparece ali como conteúdo exibido, não como destino.

     O que importa é se virou LINK CLICÁVEL. Medido: nenhum <a> é criado, e
     nada executa. (Esta asserção nunca tinha rodado — o teste morria antes,
     porque chamava safeRenderMarkdown num bundle IIFE que não a expõe.) */
  checa('KaTeX não cria link javascript:',
    !/<a[^>]+href\s*=\s*["']?\s*javascript:/i.test(r.html), r.html.slice(0, 140));
}

console.log('— misturas, que é onde renderizador costuma quebrar');
for (const [nome, md] of [
  ['fórmula em tabela',       '| item | valor |\n|---|---|\n| energia | $E=mc^2$ |'],
  ['fórmula em lista',        '- primeiro: $a^2+b^2=c^2$\n- segundo: $x_1$'],
  ['fórmula e código juntos', 'A fórmula $y=2x$ e o código `y = 2*x` na mesma linha.'],
  ['duas na mesma linha',     'De $a=1$ até $b=2$.'],
  ['negrito colado',          '**Importante:** $\\Delta t = 5$'],
  ['fórmula dentro de citação','> Pelo teorema, $c^2 = a^2 + b^2$.'],
]){
  const r = await renderiza(md);
  checa(`${nome}: sem marcador vazando`, !MARCA.test(r.texto), JSON.stringify(r.texto.slice(0, 80)));
  checa(`${nome}: virou fórmula`, /katex/.test(r.html), r.html.slice(0, 100));
}

checa('sem erro de página', erros.length === 0, erros.slice(0, 3));

const saida = fim();
await b.close();
await estatico.fecha();
process.exit(saida);
