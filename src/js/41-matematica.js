/* Renderiza matemática nas respostas — o que chegava como
   "$ q = \frac{80 \cdot 0.04}{0.004} = 16000 \text{W} $" e o usuário lia cru.

   ORDEM IMPORTA, e é a única parte difícil disto. LaTeX e Markdown disputam os
   mesmos caracteres: `_` vira itálico, `*` vira negrito, `\\` some, e uma chave
   com underline no meio (`x_{i}`) sai destruída antes de o KaTeX ver. Então a
   fórmula é ARRANCADA do texto primeiro, guardada, o markdown roda no que
   sobrou, e a fórmula renderizada volta pro lugar no fim.

   Marcador com caracteres privados do Unicode () porque um marcador
   textual comum ("@@MATH0@@") pode aparecer no meio de um bloco de código e ser
   substituído por engano — e também porque o DOMPurify preserva esses
   caracteres, enquanto um <span> marcador poderia ser reorganizado pelo parser
   de markdown.

   O KaTeX roda em modo tolerante: fórmula inválida vira o texto original em
   vermelho, no lugar dela, em vez de estourar e derrubar a mensagem inteira. */

/* Delimitadores, do mais específico pro menos: $$ antes de $ (senão o $$ é
   lido como dois $ vazios), e \[ \] \( \) que vários modelos usam. */
const DELIMS_MATEMATICA = [
  { abre: '$$',  fecha: '$$',  bloco: true  },
  { abre: '\\[', fecha: '\\]', bloco: true  },
  { abre: '\\(', fecha: '\\)', bloco: false },
  { abre: '$',   fecha: '$',   bloco: false },
];

function katexDisponivel(){ return typeof katex !== 'undefined'; }

/* Percorre o texto UMA vez, respeitando blocos de código. Uma regex sozinha não
   dá conta: `$` aparece em código shell e em preço ("custa $5 e depois $10"),
   e sem olhar o contexto isso viraria fórmula. */
function extraiMatematica(texto){
  const achados = [];
  let saida = '';
  let i = 0;
  while (i < texto.length){
    /* Bloco de código cercado: copia inteiro sem olhar dentro. */
    if (texto.startsWith('```', i)){
      const fim = texto.indexOf('```', i + 3);
      const ate = fim === -1 ? texto.length : fim + 3;
      saida += texto.slice(i, ate); i = ate; continue;
    }
    /* Código em linha: idem. É aqui que `$PATH` e `$HOME` ficam a salvo. */
    if (texto[i] === '`'){
      const fim = texto.indexOf('`', i + 1);
      const ate = fim === -1 ? texto.length : fim + 1;
      saida += texto.slice(i, ate); i = ate; continue;
    }
    const d = DELIMS_MATEMATICA.find(x => texto.startsWith(x.abre, i));
    if (d){
      const fim = texto.indexOf(d.fecha, i + d.abre.length);
      if (fim !== -1){
        const corpo = texto.slice(i + d.abre.length, fim);
        /* Cifrão simples precisa da regra de colagem, senão "Custa $50 e $80"
           vira fórmula: o trecho entre os dois cifrões é "50 e ", que parece
           conteúdo. A regra que o markdown-it usa resolve — em matemática o
           cifrão fica COLADO no conteúdo dos dois lados, e em dinheiro não:

             $q=\frac{a}{b}$   abre em 'q', fecha depois de '}'  -> fórmula
             $50 e $80          fecha depois de um espaço          -> dinheiro

           E fechamento seguido de dígito ("$5 a $10") também é preço. */
        let colagemOk = true;
        if (d.abre === '$'){
          const depoisDoAbre = corpo[0];
          const antesDoFecha  = corpo[corpo.length - 1];
          const depoisDoFecha = texto[fim + 1] || '';
          colagemOk = !/\s/.test(depoisDoAbre || ' ')
                   && !/\s/.test(antesDoFecha || ' ')
                   && !/\d/.test(depoisDoFecha);
        }
        if (corpo.trim() && colagemOk){
          saida += '' + achados.length + '';
          achados.push({ corpo, bloco: d.bloco });
          i = fim + d.fecha.length;
          continue;
        }
      }
    }
    saida += texto[i]; i++;
  }
  return { texto: saida, achados };
}

function devolveMatematica(html, achados){
  if (!achados.length) return html;
  return html.replace(/(\d+)/g, (_, n) => {
    const m = achados[Number(n)];
    if (!m) return '';
    try{
      return katex.renderToString(m.corpo, {
        displayMode: m.bloco,
        throwOnError: false,
        /* Mostra a fórmula crua em vermelho quando ela é inválida. Some com a
           mensagem seria pior: o usuário perderia a resposta por causa de um
           parêntese que o modelo esqueceu. */
        errorColor: '#c0392b',
        strict: false,
        trust: false,
      });
    }catch(e){
      const div = document.createElement('div');
      div.textContent = m.bloco ? m.corpo : m.corpo;
      return '<code class="math-erro">' + div.innerHTML + '</code>';
    }
  });
}
