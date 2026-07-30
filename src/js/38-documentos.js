/* ============================================================
   MEUS DOCUMENTOS (RAG)

   O PROBLEMA QUE ISTO RESOLVE. "Conhecimento do projeto" é um campo de texto
   colado inteiro no prompt a cada mensagem. Serve pra meia página de instrução
   e falha em tudo mais: um PDF de 80 páginas não cabe na janela, e mesmo
   cabendo você pagaria por ele em TODA mensagem pra usar três parágrafos.

   Aqui o documento é quebrado em pedaços no backend, cada pedaço vira um vetor,
   e só os pedaços que interessam à pergunta chegam ao modelo. Paga-se pelo que
   se usa.

   POR QUE O TEXTO É EXTRAÍDO AQUI, NO NAVEGADOR: o painel já sabe ler arquivo
   pra montar as mensagens. Mandar TEXTO em vez do arquivo deixa o backend sem
   dependência nova (nada de pypdf) e sem um megabyte de binário subindo por
   HTTP — que num plano grátis é a diferença entre indexar e estourar o tempo.

   E POR QUE UMA FERRAMENTA, NÃO INJEÇÃO AUTOMÁTICA: se o painel buscasse nos
   documentos antes de toda mensagem, "oi" custaria uma busca e um punhado de
   tokens de contexto. Como ferramenta, o modelo chama quando a pergunta pede —
   e quando não chama, não custa nada.
   ============================================================ */
let _docsCache = [];

/* Extrai texto do arquivo. PDF depende do que o navegador consegue: aqui só
   sai texto de PDF com camada de texto (o normal). PDF que é foto de papel
   escaneado não tem texto pra extrair — e isso é dito, não escondido, senão a
   pessoa indexa um arquivo vazio e nunca entende por que a busca não acha. */
async function textoDoArquivo(file){
  const nome = file.name || 'documento';
  if (/\.(txt|md|csv|json|log|xml|yml|yaml|html?|js|ts|py|css)$/i.test(nome) ||
      file.type.startsWith('text/')){
    return await file.text();
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(nome)){
    throw new Error('PDF ainda não: por enquanto indexo .txt, .md, .csv e código. ' +
      'Abra o PDF, copie o texto e salve como .txt — ou use o PDF como anexo ' +
      'normal da conversa, que continua funcionando.');
  }
  /* Extensão desconhecida: tenta como texto, mas confere antes de aceitar.
     .docx e .xlsx são ZIP; lidos como texto viram lixo com bytes de controle no
     meio. Indexar isso não dá erro — dá um documento cheio de ruído que nunca
     casa com pergunta nenhuma, e a pessoa nunca descobre por quê.

     O sinal é byte de controle C0 (fora de tab, quebra de linha e retorno):
     texto de verdade não tem nenhum; arquivo binário tem aos montes. */
  const bruto = await file.text();
  const controle = (bruto.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g) || []).length;
  if (controle > bruto.length * 0.01){
    throw new Error(`Não consigo ler "${nome}" como texto (parece binário). ` +
      'Formatos aceitos: .txt, .md, .csv, .json e arquivos de código.');
  }
  return bruto;
}

async function enviaDocumento(file){
  const msg = document.getElementById('docs-msg');
  const diz = (t, cls) => { if (msg){ msg.textContent = t; msg.className = 'hint ' + (cls || ''); } };
  try{
    diz(`Lendo ${file.name}…`);
    const texto = await textoDoArquivo(file);
    if (!texto.trim()) throw new Error('O arquivo está vazio.');
    diz(`Indexando ${file.name} (${(texto.length / 1000).toFixed(0)} mil caracteres)…`);
    const d = await pontejson('/api/docs', {
      method: 'POST',
      headers: backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: file.name, text: texto }),
    });
    diz(`${d.name}: ${d.chunks} pedaço(s) indexado(s).` +
        (d.note ? ' ' + d.note : ''), d.note ? 'aviso' : 'ok');
    renderDocumentos();
  }catch(e){
    diz('Falhou: ' + e.message, 'erro');
  }
}

async function renderDocumentos(){
  const caixa = document.getElementById('docs-lista');
  if (!caixa) return;
  if (!backendUrl()){
    caixa.innerHTML = '<p class="hint">Precisa do Backend VTz OS — é lá que o índice mora.</p>';
    return;
  }
  try{
    const d = await pontejson('/api/docs');
    _docsCache = d.documents || [];
    if (!_docsCache.length){
      caixa.innerHTML = '<p class="hint">Nenhum documento indexado ainda.</p>';
      return;
    }
    /* O modo é a informação mais importante desta tela e a mais fácil de
       esconder: em modo léxico a busca acha por PALAVRA, então perguntar
       "onde eu moro" não encontra "Victor mora em Maricá". Quem não souber
       disso vai achar que o RAG não funciona. */
    const cabeca = d.mode === 'semantic'
      ? '<p class="hint ok">Busca por significado ligada.</p>'
      : '<p class="hint aviso">Busca por <b>termos</b>, não por significado — ' +
        'só acha se a palavra bater. Para ligar a busca semântica: ' +
        '<code>EMBEDDINGS_BASE</code> e <code>EMBEDDINGS_MODEL</code> no servidor, ' +
        'depois <b>Reindexar</b>.</p>';
    caixa.innerHTML = cabeca + '<div class="doc-lista">' + _docsCache.map(x =>
      `<div class="doc-item"><span class="doc-nome">${esc(x.name)}</span>` +
      `<i>${x.chunks} pedaço(s) · ${(x.chars / 1000).toFixed(0)}k car.</i>` +
      `<button class="doc-del" data-doc="${esc(x.doc_id)}" title="Apagar do índice">✕</button></div>`
    ).join('') + '</div>';
    caixa.querySelectorAll('.doc-del').forEach(b => {
      b.onclick = () => apagaDocumento(b.dataset.doc, b.closest('.doc-item')?.querySelector('.doc-nome')?.textContent);
    });
  }catch(e){
    caixa.innerHTML = `<p class="hint erro">${esc(e.message)}</p>`;
  }
}

async function apagaDocumento(docId, nome){
  if (!confirm(`Tirar "${nome || docId}" do índice? O arquivo no seu PC não é tocado.`)) return;
  try{
    await pontejson('/api/docs/' + encodeURIComponent(docId), { method: 'DELETE' });
    toast('Documento removido do índice.');
    renderDocumentos();
  }catch(e){ toast('Falhou: ' + e.message, 'warn'); }
}

/* A ferramenta que o modelo chama. Fica ao lado de pc_action/pc_file no mesmo
   registro — o loop de tool-calling em 25-routellm-init-tail.js não precisa
   saber que ela existe. */
TOOLS.buscar_meus_documentos = {
  def:{
    type:'function',
    function:{
      name:'buscar_meus_documentos',
      description:'Busca nos documentos que o usuário indexou (e na memória de longo prazo dele). ' +
        'Use SEMPRE que a pergunta parecer depender de algo pessoal, de um arquivo dele, de um ' +
        'contrato, anotação, manual ou histórico — em vez de responder de memória própria. ' +
        'Devolve trechos com o nome do documento de origem: CITE a origem na resposta.',
      parameters:{
        type:'object',
        properties:{
          consulta:{ type:'string', description:'O que procurar, em linguagem natural.' },
        },
        required:['consulta'],
      },
    },
  },
  exec: async (args) => {
    if (!backendUrl()) return 'Erro: sem Backend VTz OS configurado, não há índice pra consultar.';
    try{
      const d = await pontejson('/api/memory/search?limit=6&q=' +
        encodeURIComponent(String(args.consulta || '').slice(0, 400)));
      if (!d.results || !d.results.length){
        return 'Nada encontrado nos documentos nem na memória. ' +
          'Diga isso ao usuário em vez de inventar uma resposta.';
      }
      /* Devolve o modo junto: em busca léxica, não achar NÃO significa que o
         assunto não está lá — significa que a palavra não bateu. O modelo
         precisa dessa diferença pra não afirmar ausência com confiança. */
      return JSON.stringify({
        modo: d.mode,
        aviso: d.mode === 'lexical'
          ? 'busca por termos; ausência aqui não prova ausência no documento'
          : undefined,
        trechos: d.results.map(r => ({
          origem: r.source || (r.kind === 'daily' ? 'resumo do dia ' + r.ref : 'memória'),
          texto: r.text,
        })),
      });
    }catch(e){ return 'Erro ao consultar o índice: ' + e.message; }
  },
};

function setupDocumentos(){
  const inp = document.getElementById('docs-file');
  const btn = document.getElementById('docs-add-btn');
  if (btn && inp){
    btn.onclick = () => inp.click();
    inp.addEventListener('change', async (e) => {
      const arquivos = [...(e.target.files || [])];
      for (const f of arquivos) await enviaDocumento(f);   // um por vez: o erro fica no arquivo certo
      inp.value = '';
    });
  }
  const re = document.getElementById('docs-reindex-btn');
  if (re) re.onclick = async () => {
    const msg = document.getElementById('docs-msg');
    try{
      if (msg){ msg.textContent = 'Reindexando…'; msg.className = 'hint'; }
      const d = await pontejson('/api/memory/reindex', { method: 'POST' });
      if (msg){
        msg.textContent = `Reindexado: ${d.doc_chunks || 0} pedaço(s) de documento, ` +
          `${d.nodes} da memória. Modo: ${d.mode === 'semantic' ? 'significado' : 'termos'}.`;
        msg.className = 'hint ' + (d.mode === 'semantic' ? 'ok' : 'aviso');
      }
      renderDocumentos();
    }catch(e){ if (msg){ msg.textContent = 'Falhou: ' + e.message; msg.className = 'hint erro'; } }
  };
  renderDocumentos();
}
