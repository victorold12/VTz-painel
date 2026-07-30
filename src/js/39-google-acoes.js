/* ============================================================
   E-MAIL E AGENDA — as ferramentas que o modelo pode usar

   Até aqui o Google era só leitura: dava pra listar e-mail e arquivo do Drive.
   Isso é "assistente que lê"; enviar e marcar compromisso é o que faz virar
   assistente pessoal.

   A DECISÃO QUE MANDA NESTE ARQUIVO: enviar e-mail é IRREVERSÍVEL. Não existe
   desenviar. Um modelo entendendo mal um pedido e mandando mensagem em seu nome
   é um estrago que nenhuma mensagem de erro conserta depois.

   Então o envio atravessa uma confirmação SUA, com o texto inteiro na tela,
   antes de sair. É o mesmo princípio do Agente Local (nível 2: ação suspeita
   pede confirmação na máquina de quem manda) aplicado aqui — só que a ação sai
   do servidor, então a trava tem que ficar do lado de cá, no caminho.

   Marcar evento NÃO pede confirmação: é reversível em dois cliques na agenda, e
   pedir confirmação pra tudo treina a pessoa a clicar "sim" sem ler — que é
   exatamente o que não pode acontecer no e-mail.
   ============================================================ */

/* Confirmação com o conteúdo à vista. `confirm()` do navegador de propósito:
   é modal de verdade (o modelo não continua enquanto ela está aberta) e não
   depende de nenhum componente nosso estar montado — inclusive na cena JARVIS,
   onde o chat nem está na tela. */
function confirmaEnvioEmail(args){
  const corpo = String(args.corpo || '');
  const previa = corpo.length > 900 ? corpo.slice(0, 900) + '\n\n[…]' : corpo;
  return confirm(
    'ENVIAR E-MAIL EM SEU NOME?\n\n' +
    'Para: ' + (args.para || '') + '\n' +
    'Assunto: ' + (args.assunto || '(sem assunto)') + '\n\n' +
    previa + '\n\n' +
    '— Isto não tem como ser desfeito.'
  );
}

TOOLS.enviar_email = {
  def:{
    type:'function',
    function:{
      name:'enviar_email',
      description:'Envia um e-mail pelo Gmail do usuário. IRREVERSÍVEL: o usuário vê o texto ' +
        'inteiro e confirma antes de sair. Escreva a mensagem completa e pronta — não use ' +
        'marcadores tipo [nome] esperando alguém preencher depois. Um destinatário por chamada.',
      parameters:{
        type:'object',
        properties:{
          para:{ type:'string', description:'E-mail do destinatário (um só).' },
          assunto:{ type:'string', description:'Assunto.' },
          corpo:{ type:'string', description:'Texto do e-mail, completo.' },
        },
        required:['para','corpo'],
      },
    },
  },
  exec: async (args) => {
    if (!backendUrl()) return 'Erro: sem Backend VTz OS configurado, não dá pra enviar e-mail.';
    if (!confirmaEnvioEmail(args)){
      /* Recusa é resposta legítima, não erro. O modelo precisa saber que NÃO
         foi enviado — senão ele responde "pronto, mandei" e a pessoa fica
         achando que o e-mail saiu. */
      return 'O usuário CANCELOU o envio. O e-mail NÃO foi enviado. ' +
        'Não diga que enviou. Pergunte o que ele quer mudar.';
    }
    try{
      const d = await pontejson('/api/connectors/google/gmail/send', {
        method:'POST',
        headers: backendHeaders({ 'Content-Type':'application/json' }),
        body: JSON.stringify({ to: args.para, subject: args.assunto || '', body: args.corpo }),
      });
      toast('E-mail enviado para ' + d.to, 'ok');
      return `Enviado para ${d.to} (assunto: ${d.subject}).`;
    }catch(e){
      /* 403 aqui quase sempre é o consentimento antigo, que não cobre o envio.
         Dizer só "erro 403" faria a pessoa procurar defeito no lugar errado. */
      if (/403/.test(e.message)){
        return 'Não enviei: o acesso concedido ao Google não cobre envio de e-mail. ' +
          'Diga ao usuário para reconectar em Configurações > Conectores > Google.';
      }
      return 'Erro ao enviar: ' + e.message;
    }
  },
};

TOOLS.ver_agenda = {
  def:{
    type:'function',
    function:{
      name:'ver_agenda',
      description:'Lê os próximos compromissos do Google Agenda do usuário. Use quando a ' +
        'pergunta envolver disponibilidade, horário, "o que eu tenho", conflito de agenda ' +
        'ou antes de marcar qualquer coisa nova.',
      parameters:{
        type:'object',
        properties:{
          dias:{ type:'integer', description:'Quantos dias à frente olhar (padrão 7).' },
        },
      },
    },
  },
  exec: async (args) => {
    if (!backendUrl()) return 'Erro: sem Backend VTz OS configurado.';
    try{
      const dias = Math.max(1, Math.min(Number(args.dias) || 7, 90));
      const d = await pontejson('/api/connectors/google/calendar/events?days=' + dias);
      if (!d.count) return `Nada marcado nos próximos ${dias} dias.`;
      return JSON.stringify({ hoje: new Date().toISOString(), eventos: d.events });
    }catch(e){ return 'Erro ao ler a agenda: ' + e.message; }
  },
};

TOOLS.marcar_evento = {
  def:{
    type:'function',
    function:{
      name:'marcar_evento',
      description:'Cria um compromisso no Google Agenda do usuário. ANTES de marcar, use ' +
        'ver_agenda para checar conflito de horário. Datas em ISO 8601 no horário de ' +
        'Brasília, ex.: 2026-08-02T15:00. Sem hora de fim, dura uma hora.',
      parameters:{
        type:'object',
        properties:{
          titulo:{ type:'string' },
          inicio:{ type:'string', description:'ISO 8601, ex.: 2026-08-02T15:00' },
          fim:{ type:'string', description:'ISO 8601. Opcional.' },
          descricao:{ type:'string' },
          local:{ type:'string' },
        },
        required:['titulo','inicio'],
      },
    },
  },
  exec: async (args) => {
    if (!backendUrl()) return 'Erro: sem Backend VTz OS configurado.';
    try{
      const d = await pontejson('/api/connectors/google/calendar/events', {
        method:'POST',
        headers: backendHeaders({ 'Content-Type':'application/json' }),
        body: JSON.stringify({
          titulo: args.titulo, inicio: args.inicio, fim: args.fim || null,
          descricao: args.descricao || '', local: args.local || '',
        }),
      });
      toast('Marcado: ' + d.titulo, 'ok');
      return `Marcado "${d.titulo}" para ${d.inicio}. Link: ${d.link}`;
    }catch(e){
      if (/403/.test(e.message)){
        return 'Não marquei: o acesso concedido ao Google não cobre o calendário. ' +
          'Diga ao usuário para reconectar em Configurações > Conectores > Google.';
      }
      return 'Erro ao marcar: ' + e.message;
    }
  },
};

/* O consentimento antigo não cobre os escopos novos, e o token velho continua
   valendo pros escopos VELHOS — então o sintoma é "o envio parou de funcionar
   do nada" com o resto do Google normal. Avisar no boot é o que transforma isso
   num aviso de dois cliques em vez de meia hora de investigação. */
async function checaEscoposGoogle(){
  if (!backendUrl()) return;
  try{
    const d = await pontejson('/api/connectors/google/status');
    if (d.precisa_reconectar && d.aviso){
      toast(d.aviso, 'warn');
      const el = document.getElementById('google-status');
      if (el){ el.textContent = d.aviso; el.className = 'hint aviso'; }
    }
  }catch(e){ /* sem Google configurado: nada a avisar */ }
}

function setupGoogleAcoes(){
  setTimeout(() => checaEscoposGoogle(), 5000);   // depois do cutucão que acorda o backend
}
