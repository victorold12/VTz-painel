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

/* ---------- cofre local do texto indexado ----------

   POR QUE ISTO EXISTE. O índice mora no SQLite do backend, e no plano grátis do
   Render esse disco é EFÊMERO: some a cada deploy e a cada vez que o serviço
   acorda de hibernar. Sem defesa, você indexaria seus documentos e um dia
   qualquer o assistente simplesmente pararia de saber deles — sem erro, sem
   aviso, só respostas piores. É a pior forma de perder dado: silenciosa.

   Então o painel guarda uma cópia do TEXTO de cada documento indexado e, no
   boot, compara com o que o servidor diz ter. O que faltar, ele reenvia sozinho.

   IndexedDB e não localStorage: localStorage tem teto de ~5MB e é síncrono —
   guardar o texto de alguns documentos ali estouraria a cota e derrubaria
   TAMBÉM as conversas, que moram no mesmo lugar. O risco de gravar o documento
   junto das conversas não vale a economia de vinte linhas. */
const COFRE_DB = 'vtz-docs';
const COFRE_LOJA = 'textos';

function abreCofre(){
  return new Promise((ok, falha) => {
    let req;
    try{ req = indexedDB.open(COFRE_DB, 1); }
    catch(e){ return falha(e); }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(COFRE_LOJA)) db.createObjectStore(COFRE_LOJA, { keyPath:'name' });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error || new Error('IndexedDB indisponível'));
  });
}

/* Toda operação do cofre tolera falha: navegador em aba anônima, cota cheia ou
   IndexedDB bloqueado por política não podem impedir de indexar um documento.
   Sem cofre você perde a recuperação automática, não a funcionalidade. */
async function cofreGrava(name, text){
  try{
    const db = await abreCofre();
    await new Promise((ok, falha) => {
      const tx = db.transaction(COFRE_LOJA, 'readwrite');
      tx.objectStore(COFRE_LOJA).put({ name, text, at: Date.now() });
      tx.oncomplete = ok; tx.onerror = () => falha(tx.error);
    });
    db.close();
  }catch(e){ console.warn('[docs] cofre local indisponível:', e && e.message); }
}

async function cofreLista(){
  try{
    const db = await abreCofre();
    const itens = await new Promise((ok, falha) => {
      const req = db.transaction(COFRE_LOJA, 'readonly').objectStore(COFRE_LOJA).getAll();
      req.onsuccess = () => ok(req.result || []);
      req.onerror = () => falha(req.error);
    });
    db.close();
    return itens;
  }catch(e){ return []; }
}

async function cofreApaga(name){
  try{
    const db = await abreCofre();
    await new Promise((ok) => {
      const tx = db.transaction(COFRE_LOJA, 'readwrite');
      tx.objectStore(COFRE_LOJA).delete(name);
      tx.oncomplete = ok; tx.onerror = ok;
    });
    db.close();
  }catch(e){ /* já não estava lá, ou sem cofre: nada a fazer */ }
}

/* Compara o que o servidor tem com o que o cofre guarda e reenvia a diferença.

   SÓ REENVIA O QUE FALTA. Reenviar tudo a cada boot seria mais simples e
   errado: gastaria embeddings de novo em documento que já está lá, toda vez
   que o painel abrisse. */
async function recuperaIndice(){
  if (!backendUrl()) return { faltavam: 0 };
  let noServidor;
  try{ noServidor = await pontejson('/api/docs'); }
  catch(e){ return { faltavam: 0 }; }   // backend fora do ar: não é hora de reindexar

  const locais = await cofreLista();
  if (!locais.length) return { faltavam: 0 };

  const nomesLa = new Set((noServidor.documents || []).map(d => d.name));
  const faltando = locais.filter(l => !nomesLa.has(l.name));
  if (!faltando.length) return { faltavam: 0 };

  /* O servidor perdeu o índice — quase sempre porque o container foi recriado.
     Avisa ANTES de reenviar: se forem muitos documentos isso demora, e uma tela
     parada sem explicação parece travamento. */
  try{ toast(`O servidor perdeu ${faltando.length} documento(s) do índice. Reenviando…`, 'warn'); }catch(e){}

  let refeitos = 0;
  for (const doc of faltando){
    try{
      await pontejson('/api/docs', {
        method: 'POST',
        headers: backendHeaders({ 'Content-Type':'application/json' }),
        body: JSON.stringify({ name: doc.name, text: doc.text }),
      });
      refeitos += 1;
    }catch(e){ /* um documento que falha não pode impedir os outros */ }
  }
  try{
    toast(refeitos === faltando.length
      ? `Índice recuperado: ${refeitos} documento(s) de volta.`
      : `Recuperei ${refeitos} de ${faltando.length}. Tente "Reindexar tudo".`,
      refeitos === faltando.length ? 'ok' : 'warn');
  }catch(e){}
  renderDocumentos();
  return { faltavam: faltando.length, refeitos };
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
    /* Guarda o texto DEPOIS de o servidor confirmar. Guardar antes deixaria no
       cofre um documento que nunca foi indexado, e a recuperação passaria a
       "recuperar" algo que nunca existiu lá. */
    await cofreGrava(d.name, texto);
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
    /* Tira do cofre TAMBÉM, senão a recuperação automática traria de volta no
       próximo boot o documento que você acabou de mandar apagar. */
    if (nome) await cofreApaga(nome);
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
  /* Sem await: recuperar índice não pode segurar a montagem da tela. E com
     folga no boot — o cutucão que acorda o backend sai primeiro. */
  setTimeout(() => recuperaIndice(), 4000);
}
