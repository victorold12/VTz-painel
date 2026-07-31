/* Aba de voz (Config > Voz) — Seção 14 do prompt mestre.

   Chatterbox é o principal (clona a sua voz a partir de uma amostra), Kokoro o
   fallback (vozes prontas), navegador o último recurso. Tudo roda no SEU PC,
   pelo Agente Local; esta tela só conversa com ele através do backend, porque o
   agente é sempre cliente e nunca abre porta (Seção 8).

   Nada aqui valida faixa de calibração: quem valida é o agente, que é o dono da
   configuração. Validar nos dois lados criaria duas verdades, e a que importa é
   a da máquina onde o áudio toca. */

/* `porta` e `comoInstalar` existem porque "não está rodando" sozinho é um beco
   sem saída: o painel constatava o problema e não dizia o que fazer, e não havia
   documentação nenhuma no repositório. Os dois são servidores Python que rodam
   NO SEU PC — não vêm no instalador de propósito (juntos passam de 3 GB, contra
   110 MB do app inteiro). Quem não quiser instalar nada usa o Navegador. */
const VOZ_MOTORES = [
  { id:'chatterbox', nome:'Chatterbox', tag:'principal', porta: 8004,
    desc:'Clona a sua voz a partir de uma amostra. Roda local.',
    comoInstalar: 'Servidor Python no seu PC, porta 8004. Precisa de Python 3.11+ e ' +
      'baixa ~2 GB de modelo na primeira vez (funciona melhor com placa de vídeo). ' +
      'Instruções: github.com/resemble-ai/chatterbox' },
  { id:'kokoro', nome:'Kokoro', tag:'fallback', porta: 8880,
    desc:'Vozes prontas, mais leve. Usado se o Chatterbox não estiver de pé.',
    comoInstalar: 'Servidor Python no seu PC, porta 8880. Bem mais leve que o ' +
      'Chatterbox (~350 MB) e roda bem só com processador, mas não clona a sua voz. ' +
      'Instruções: github.com/remsky/Kokoro-FastAPI' },
  { id:'navegador', nome:'Navegador', tag:'sem instalar',
    desc:'Voz do próprio sistema. Sempre funciona, soa mais robótica.' },
];

/* Vozes prontas do Kokoro em português — só aparecem quando o motor é Kokoro. */
const VOZ_KOKORO = [
  { id:'pf_dora',  nome:'Dora (feminina, PT-BR)' },
  { id:'pm_alex',  nome:'Alex (masculina, PT-BR)' },
  { id:'pm_santa', nome:'Santa (masculina, PT-BR)' },
];

/* Nome e explicação de cada controle. "exaggeration" e "cfg_weight" não
   significam nada pra quem só quer que a voz soe melhor. */
const VOZ_CALIB = {
  exaggeration:{ nome:'Expressividade', desc:'Quanta emoção o Chatterbox coloca na fala. Baixo soa mais neutro.' },
  cfg_weight:  { nome:'Fidelidade à referência', desc:'Quanto ele segue a amostra. Menor deixa a fala mais solta e rápida.' },
  temperature: { nome:'Variação', desc:'Quanto a entonação muda entre falas iguais.' },
  speed:       { nome:'Velocidade', desc:'Ritmo da fala (Kokoro).' },
};
const VOZ_CALIB_POR_MOTOR = {
  chatterbox:['exaggeration','cfg_weight','temperature'],
  kokoro:['speed'],
  navegador:[],
};

const VOZ_FRASE_TESTE = 'Olá, senhor. Sistemas operando normalmente.';
const VOZ_MAX_AMOSTRA = 8 * 1024 * 1024;

const vozState = {
  agentId:null, cfg:null, ranges:null, engines:null,
  samples:[], stt:null, sttModels:[], pend:{},
};

function vozMsg(texto, tipo){
  const el = document.getElementById('voz-msg');
  if (!el) return;
  el.textContent = texto || '';
  el.className = 'hint voz-msg' + (tipo ? ' ' + tipo : '');
}

async function vozApi(metodo, caminho, corpo){
  if (!backendUrl()) throw new Error('Backend VTz OS não configurado.');
  if (!vozState.agentId) throw new Error('Nenhum Agente Local pareado.');
  const r = await fetch(
    backendUrl() + '/api/voice/' + encodeURIComponent(vozState.agentId) + caminho,
    { method: metodo,
      headers: backendHeaders({ 'Content-Type':'application/json' }),
      body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || ('Backend respondeu ' + r.status));
  return j;
}

/* valor corrente de um campo: o pendente (ainda não salvo), senão o do PC */
const vozVal = (k) => (vozState.pend[k] !== undefined ? vozState.pend[k] : vozState.cfg?.[k]);

function vozRenderMotores(){
  const alvo = document.getElementById('voz-engines');
  if (!alvo) return;
  const atual = vozVal('engine');
  alvo.innerHTML = VOZ_MOTORES.map(m => {
    const est = vozState.engines?.[m.id];
    // 'navegador' não é servidor: dizer que está "fora do ar" seria errado
    const dot = m.id === 'navegador' ? 'up' : est ? (est.up ? 'up' : 'down') : 'unknown';
    const estado = m.id === 'navegador' ? 'disponível'
                 : est ? (est.up ? 'no ar' : (est.reason || 'fora do ar')) : '—';
    return '<button class="voz-engine' + (m.id === atual ? ' on' : '') + '" data-eng="' + m.id + '">'
      + '<span class="voz-en-top"><b>' + esc(m.nome) + '</b>'
      + '<span class="voz-tag">' + esc(m.tag) + '</span>'
      + '<span class="voz-dot ' + dot + '"></span></span>'
      + '<span class="voz-desc">' + esc(m.desc) + '</span>'
      + '<span class="voz-state">' + esc(estado) + '</span></button>';
  }).join('');

  alvo.querySelectorAll('.voz-engine').forEach(b => b.onclick = () => {
    vozState.pend.engine = b.dataset.eng;
    vozRenderTudo();
    vozMsg('Motor alterado — clique em Salvar pra aplicar.');
  });

  const est = vozState.engines?.[atual];
  const motor = VOZ_MOTORES.find(m => m.id === atual);
  const hint = document.getElementById('voz-engine-hint');
  if (atual === 'navegador'){
    hint.textContent = 'A fala sai pelo navegador. Nada pra instalar, mas a voz não é clonada.';
  } else if (!est?.up){
    /* `!est?.up` e não `est && !est.up`: sem PC pareado o estado é DESCONHECIDO,
       e a versão antiga deixava a dica em branco justamente aí — o momento em que
       a pessoa mais precisa saber o que falta. Desconhecido e fora do ar levam à
       mesma orientação.

       Antes esta mensagem só dizia que não estava rodando — e não havia lugar
       nenhum, no app ou no repositório, que explicasse como fazer rodar. */
    hint.textContent = 'O ' + (motor?.nome || atual) + ' não está rodando na porta ' +
      (motor?.porta || '?') + ' deste PC. Enquanto isso a fala sai pelo Navegador, ' +
      'que sempre funciona. Para ligar: ' + (motor?.comoInstalar || '');
  } else {
    hint.textContent = '';
  }
}

function vozRenderVoz(){
  const motor = vozVal('engine');
  const secVoz = document.getElementById('voz-voice-sec');
  const secAm  = document.getElementById('voz-samples-sec');
  if (motor === 'navegador'){ secVoz.hidden = true; secAm.hidden = true; return; }
  secVoz.hidden = false;
  secAm.hidden = motor !== 'chatterbox';

  const atual = vozVal('voice');
  const opcoes = motor === 'kokoro' ? VOZ_KOKORO
               : vozState.samples.map(s => ({ id:s.name, nome:s.name }));
  document.getElementById('voz-voice').innerHTML =
    '<option value="">' + (motor === 'chatterbox' ? 'Voz padrão do modelo' : 'Padrão') + '</option>'
    + opcoes.map(o => '<option value="' + esc(o.id) + '"'
        + (o.id === atual ? ' selected' : '') + '>' + esc(o.nome) + '</option>').join('');

  document.getElementById('voz-voice-hint').textContent = motor === 'chatterbox'
    ? (vozState.samples.length ? 'Escolha uma das suas vozes clonadas.'
       : 'Sem amostra ainda — suba um áudio abaixo pra clonar a sua voz.')
    : 'Vozes prontas do Kokoro (não clona).';

  document.getElementById('voz-voice').onchange = (e) => {
    vozState.pend.voice = e.target.value || null;
    vozRenderAmostras();
    vozMsg('Voz alterada — clique em Salvar.');
  };
}

function vozRenderAmostras(){
  const el = document.getElementById('voz-samples');
  const atual = vozVal('voice');
  if (!vozState.samples.length){
    el.innerHTML = '<p class="hint">Nenhuma amostra ainda. Suba alguns segundos da sua voz '
      + 'pra o JARVIS falar com ela.</p>';
    return;
  }
  const tam = (n) => n >= 1048576 ? (n/1048576).toFixed(1) + ' MB' : Math.round(n/1024) + ' KB';
  el.innerHTML = vozState.samples.map(s =>
    '<div class="voz-sample' + (s.name === atual ? ' on' : '') + '">'
    + '<span class="voz-sm-name">' + esc(s.name) + '</span>'
    + '<span class="voz-sm-size">' + tam(s.size || 0) + '</span>'
    + '<button data-del="' + esc(s.name) + '" title="Apagar">✕</button></div>').join('');

  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    try{
      vozMsg('Apagando…');
      await vozApi('DELETE', '/sample/' + encodeURIComponent(b.dataset.del));
      await vozCarregar();
      vozMsg('Amostra apagada.', 'ok');
    }catch(e){ vozMsg(e.message, 'erro'); }
  });
}

function vozRenderCalib(){
  const motor = vozVal('engine');
  const campos = VOZ_CALIB_POR_MOTOR[motor] || [];
  const el = document.getElementById('voz-calib');
  if (!campos.length){ el.innerHTML = ''; return; }

  el.innerHTML = '<h4 style="margin:18px 0 8px;">Calibração</h4>' + campos.map(k => {
    const f = vozState.ranges?.[k] || { min:0, max:1 };
    const v = vozVal(k) ?? f.min;
    return '<div class="voz-slider">'
      + '<span class="voz-sname">' + VOZ_CALIB[k].nome + '</span>'
      + '<span class="voz-sval" id="voz-v-' + k + '">' + Number(v).toFixed(2) + '</span>'
      + '<input type="range" id="voz-r-' + k + '" min="' + f.min + '" max="' + f.max
      + '" step="' + ((f.max - f.min) / 100) + '" value="' + v + '">'
      + '<span class="hint voz-sdesc">' + VOZ_CALIB[k].desc + '</span></div>';
  }).join('');

  campos.forEach(k => {
    const r = document.getElementById('voz-r-' + k);
    r.oninput = () => {
      vozState.pend[k] = parseFloat(r.value);
      document.getElementById('voz-v-' + k).textContent = vozState.pend[k].toFixed(2);
    };
  });
}

function vozRenderStt(){
  const sel = document.getElementById('voz-stt-model');
  const atual = vozState.stt?.model;
  const modelos = vozState.sttModels.length ? vozState.sttModels
                : ['tiny','base','small','medium','large-v3'];
  sel.innerHTML = modelos.map(m => {
    const nota = m === 'base' ? ' — padrão, leve'
               : m === 'tiny' ? ' — mais rápido, menos preciso'
               : m.startsWith('large') ? ' — mais preciso, muita RAM' : '';
    return '<option value="' + m + '"' + (m === atual ? ' selected' : '') + '>' + m + nota + '</option>';
  }).join('');
  sel.onchange = (e) => {
    vozState.pend._stt_model = e.target.value;
    vozMsg('Modelo alterado — clique em Salvar.');
  };
  document.getElementById('voz-stt-hint').textContent = vozState.stt?.model_present
    ? 'Modelo pronto em ' + vozState.stt.model_path
    : (vozState.stt?.hint || 'Modelo do whisper ainda não baixado.');
}

function vozRenderTudo(){
  vozRenderMotores(); vozRenderVoz(); vozRenderAmostras();
  vozRenderCalib(); vozRenderStt();
}

async function vozCarregar(){
  const j = await vozApi('GET', '/status');
  if (j.ok === false) throw new Error(j.reason || j.error || 'o agente não respondeu');
  vozState.cfg = j.config || {};
  vozState.ranges = j.ranges || {};
  vozState.engines = j.engines || {};
  vozState.samples = j.samples || [];
  vozState.stt = j.stt || {};
  vozState.sttModels = j.stt_models || [];
  vozState.pend = {};
  vozRenderTudo();
  vozMsg('');
}

/* Descobre pra qual PC pedir a configuração.

   Usa o cache da aba Agente Local quando ele existe, mas busca sozinho se não —
   depender de o usuário ter aberto a outra aba primeiro deixaria esta tela
   vazia sem motivo aparente. Prefere um agente online. */
async function vozDescobreAgente(){
  let agentes = (typeof _pcAgents !== 'undefined' && _pcAgents) || [];
  if (!agentes.length && backendUrl()){
    try{
      const d = await fetch(backendUrl() + '/api/agents',
                            { headers: backendHeaders() }).then(okJson);
      agentes = d.agents || [];
    }catch(e){ agentes = []; }
  }
  const validos = agentes.filter(a => !a.revoked);
  return (validos.find(a => a.online) || validos[0])?.agent_id || null;
}

/* Chamado quando a aba Voz abre (ver setupConfigNav). */
async function refreshVoiceConfig(){
  const corpo = document.getElementById('voz-body');
  const aviso = document.getElementById('voz-indisponivel');
  vozState.agentId = await vozDescobreAgente();

  if (!backendUrl() || !vozState.agentId){
    // sem backend/agente não há o que configurar: dizer isso é melhor que
    // mostrar sliders que não fazem nada
    corpo.hidden = true;
    aviso.hidden = false;
    aviso.innerHTML = 'A voz do JARVIS roda no seu PC, pelo Agente Local. '
      + (!backendUrl() ? 'Configure o <b>Backend VTz OS</b>' : 'Pareie o <b>Agente Local</b>')
      + ' pra ajustar motor, voz e calibração aqui.';
    return;
  }
  corpo.hidden = false;
  aviso.hidden = true;
  try{ await vozCarregar(); await refreshEscuta(); ligaWakePolling(); }
  catch(e){
    corpo.hidden = true;
    aviso.hidden = false;
    aviso.innerHTML = 'Não consegui falar com o Agente Local.<br><b>' + esc(e.message) + '</b>';
  }
}

function setupVoiceConfig(){
  const up = document.getElementById('voz-upload');
  if (!up) return;
  setupEscuta();
  /* Antes do `return` por falta de agente pareado, de propósito: baixar o
     instalador é justamente o que você faz ANTES de ter os motores de pé, e
     exigir PC pareado pra isso seria pedir o resultado como pré-requisito. */
  setupInstaladoresVoz();

  up.onclick = () => document.getElementById('voz-file').click();

  document.getElementById('voz-file').onchange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > VOZ_MAX_AMOSTRA){ vozMsg('Arquivo maior que 8 MB.', 'erro'); return; }
    try{
      vozMsg('Enviando…');
      const bytes = new Uint8Array(await f.arrayBuffer());
      // base64 em pedaços: fromCharCode com o array inteiro estoura a pilha
      let bin = '';
      for (let i = 0; i < bytes.length; i += 8192){
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      }
      const j = await vozApi('POST', '/sample', { name:f.name, data_base64: btoa(bin) });
      if (j.ok === false) throw new Error(j.error || 'o agente recusou');
      await vozCarregar();
      vozMsg('"' + (j.saved?.name || f.name) + '" salva no seu PC.', 'ok');
    }catch(err){ vozMsg(err.message, 'erro'); }
  };

  document.getElementById('voz-test').onclick = async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    try{
      vozMsg('Gerando áudio…');
      const overrides = Object.assign({}, vozState.pend);
      delete overrides._stt_model;
      const j = await vozApi('POST', '/speak', { text: VOZ_FRASE_TESTE, overrides });

      if (j.ok === false){
        if (j.delegate === 'browser' && window.speechSynthesis){
          const u = new SpeechSynthesisUtterance(VOZ_FRASE_TESTE);
          u.lang = 'pt-BR';
          speechSynthesis.speak(u);
          vozMsg('Falando pelo navegador.', 'ok');
        }else{
          vozMsg(j.reason || 'não consegui gerar o áudio', 'erro');
        }
        return;
      }
      const bin = atob(j.audio_base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type:j.mime || 'audio/wav' }));
      const a = new Audio(url);
      a.onended = () => URL.revokeObjectURL(url);
      try{
        await a.play();
      }catch(err){
        // o motor respondeu mas o áudio não toca. O erro cru do navegador
        // ("no supported source was found") não diz nada útil.
        URL.revokeObjectURL(url);
        vozMsg('O ' + j.engine + ' devolveu ' + (j.bytes || arr.length)
          + ' bytes, mas o navegador não conseguiu tocar (formato '
          + (j.mime || 'desconhecido') + ').', 'erro');
        return;
      }
      vozMsg(j.fallback ? 'Tocando — foi o ' + j.engine + ' (fallback).'
                        : 'Tocando (' + j.engine + ').', 'ok');
    }catch(err){ vozMsg(err.message, 'erro'); }
    finally{ btn.disabled = false; }
  };

  document.getElementById('voz-save').onclick = async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    try{
      const pend = Object.assign({}, vozState.pend);
      const modeloStt = pend._stt_model;
      delete pend._stt_model;
      if (!Object.keys(pend).length && !modeloStt){ vozMsg('Nada mudou.'); return; }
      vozMsg('Salvando…');
      if (Object.keys(pend).length) await vozApi('PUT', '/config', pend);
      if (modeloStt) await vozApi('PUT', '/stt', { model: modeloStt });
      await vozCarregar();
      vozMsg('Salvo no seu PC.', 'ok');
    }catch(err){ vozMsg(err.message, 'erro'); }
    finally{ btn.disabled = false; }
  };
}

/* ============================================================
   ESCUTA CONTÍNUA — "Ei, JARVIS" sem clicar em nada (Seção 9)

   Regra desta tela: o custo aparece ANTES de ligar. O loop passa
   cada trecho pelo whisper, então não é de graça, e a estimativa
   vem do próprio agente (não é chute do painel).
   ============================================================ */
let _escutaState = { setup: null, cfg: null, running: false };

async function refreshEscuta(){
  const box = document.getElementById('voz-escuta');
  if (!box) return;
  try{
    const j = await vozApi('GET', '/listen');
    if (j.ok === false) throw new Error(j.reason || j.error || 'o agente recusou');
    _escutaState = { setup: j.setup || {}, cfg: j.config || {}, running: !!j.running,
                     chunks: j.chunks, hits: j.hits, erros: j.erros, ultimo: j.ultimoTexto };
    renderEscuta();
  }catch(e){
    box.innerHTML = `<p class="hint erro">Não deu pra ler o estado da escuta: ${esc(e.message)}</p>`;
  }
}

function renderEscuta(){
  const box = document.getElementById('voz-escuta');
  const s = _escutaState.setup || {};
  const pronto = !!s.ready;
  const linhas = [
    ['Gravador de áudio', s.recorder || 'nenhum encontrado', !!s.recorder],
    ['Modelo do whisper', s.whisper_model + (s.whisper_model_present ? '' : ' (não baixado)'),
     !!s.whisper_model_present],
    ['Estado', _escutaState.running ? 'ouvindo agora' : 'parada', _escutaState.running],
  ];
  let html = linhas.map(([k, v, ok]) =>
    `<div class="voz-esc-linha"><span>${esc(k)}</span>` +
    `<b class="${ok ? 'ok' : 'off'}">${esc(String(v))}</b></div>`).join('');

  const c = s.custo || {};
  if (c.aviso){
    html += `<p class="voz-esc-custo">${esc(c.transcricoes_por_hora)} transcrições por hora · ${esc(c.aviso)}</p>`;
  }
  if (!pronto && s.recorder_hint){
    html += `<p class="hint" style="margin-top:8px;">Pra habilitar: ${esc(s.recorder_hint)}</p>`;
  }
  if (_escutaState.running && typeof _escutaState.chunks === 'number'){
    html += `<p class="hint" style="margin-top:8px;">${_escutaState.chunks} trecho(s) ouvido(s), ` +
      `${_escutaState.hits || 0} vez(es) que o nome apareceu` +
      (_escutaState.ultimo ? ` · último: "${esc(String(_escutaState.ultimo).slice(0, 60))}"` : '') + '</p>';
  }
  box.innerHTML = html;

  const chunk = document.getElementById('voz-chunk');
  if (chunk && _escutaState.cfg?.chunkSec) chunk.value = _escutaState.cfg.chunkSec;
  const btn = document.getElementById('voz-escuta-toggle');
  if (btn){
    btn.textContent = _escutaState.running ? 'Desligar escuta' : 'Ligar escuta';
    btn.disabled = !pronto && !_escutaState.running;
  }
}

function escutaMsg(txt, cls){
  const el = document.getElementById('voz-escuta-msg');
  if (el){ el.textContent = txt; el.className = 'hint ' + (cls || ''); }
}

function setupEscuta(){
  const btn = document.getElementById('voz-escuta-toggle');
  if (!btn) return;
  btn.onclick = async () => {
    btn.disabled = true;
    try{
      if (_escutaState.running){
        await vozApi('POST', '/listen/stop');
        escutaMsg('Escuta desligada. O microfone parou.', 'ok');
      } else {
        const chunk = Number(document.getElementById('voz-chunk')?.value);
        if (Number.isFinite(chunk)) await vozApi('PUT', '/listen', { chunkSec: chunk, enabled: true });
        const j = await vozApi('POST', '/listen/start');
        if (j.ok === false) throw new Error(j.reason || j.hint || 'o agente recusou');
        escutaMsg(`Ouvindo pelo ${j.recorder}. ${j.custo?.aviso || ''}`, 'ok');
      }
      await refreshEscuta();
    }catch(e){ escutaMsg(e.message, 'erro'); }
    finally{ btn.disabled = false; }
  };
}

/* ============================================================
   Consumo do wake word: o PC ouviu, o painel executa.
   Quem decide é o painel — o agente só avisa (ver /wake no hub).
   ============================================================ */
let _wakeTimer = null;

async function puxaWake(){
  if (!backendUrl() || !vozState.agentId) return;
  try{
    const r = await fetch(backendUrl() + '/api/agents/' +
                          encodeURIComponent(vozState.agentId) + '/wake',
                          { headers: backendHeaders() });
    if (!r.ok) return;
    const d = await r.json();
    for (const ev of (d.events || [])){
      /* Sem comando depois do nome ("ei jarvis" e mais nada) não há o que
         executar: abre a cena e fica escutando, em vez de inventar tarefa. */
      if (typeof abreJarvis === 'function') await abreJarvis();
      if (ev.command && typeof runThinkingJarvis === 'function') runThinkingJarvis(ev.command);
    }
  }catch(e){ /* backend fora do ar não deve poluir o console num loop */ }
}

function ligaWakePolling(){
  if (_wakeTimer) return;
  /* 2s é o intervalo: a fila do backend guarda por 2 min, então nada se perde,
     e é leve o suficiente pra não pesar no app. */
  _wakeTimer = setInterval(() => { if (_escutaState.running) puxaWake(); }, 2000);
}

/* ============================================================
   INSTALADOR DOS MOTORES DE VOZ (.bat)

   O PROBLEMA: a tela dizia "o Chatterbox não está rodando na porta 8004" e
   mandava a pessoa pro GitHub. Entre ler o README de um projeto Python e ter
   voz clonada funcionando existem seis passos que ninguém faz por diversão — e
   o resultado prático era a voz local nunca sair do papel.

   POR QUE UM .bat E NÃO EXECUTAR PELO AGENTE LOCAL: instalar programa é a coisa
   mais invasiva que existe neste app. O Agente Local tem o gate de 4 níveis
   justamente pra impedir que um clique (ou um modelo) mande instalar coisa na
   sua máquina. Baixar um arquivo que VOCÊ abre, lê e roda mantém a decisão com
   você, e deixa visível exatamente o que vai acontecer. É também o formato que
   este projeto já usa pra Windows (deploy.bat, rollback.bat).

   O QUE O SCRIPT NÃO INVENTA: os comandos vêm do padrão que os dois
   repositórios usam — clonar, criar venv, `pip install -r requirements.txt`.
   Onde a instalação depende da máquina (placa de vídeo, versão do torch), o
   script NÃO adivinha: ele para e manda ler o README, em vez de instalar a
   variante errada e falhar meia hora depois no primeiro áudio.
   ============================================================ */
const VOZ_INSTALADORES = {
  chatterbox: {
    nome: 'Chatterbox',
    repo: 'https://github.com/devnen/Chatterbox-TTS-Server',
    pasta: 'Chatterbox-TTS-Server',
    porta: 8004,
    peso: '~2 GB de modelo na primeira execução',
    aviso: 'Funciona sem placa de vídeo, mas fica lento. Com placa NVIDIA, ' +
           'instale o torch com CUDA seguindo o README do repositório.',
    /* O Chatterbox fixa torch==2.5.1, e o torch só publica instalador pras
       versões de Python que existiam quando ele saiu. Num Python novo demais o
       pip não acha NADA e a mensagem dele ("Could not find a version that
       satisfies") não diz por quê — parece falta de internet ou repositório
       fora do ar. Aconteceu de verdade: Python 3.14 no PC, e o script mandou
       ler a seção de placa de vídeo do README, que não tinha nada a ver. */
    pythons: ['3.12', '3.11', '3.10'],
    porqueEssePython: 'ele fixa torch==2.5.1, que nao tem instalador pra Python 3.13 ou mais novo',
  },
  kokoro: {
    nome: 'Kokoro',
    repo: 'https://github.com/remsky/Kokoro-FastAPI',
    pasta: 'Kokoro-FastAPI',
    porta: 8880,
    peso: '~350 MB de modelo',
    aviso: 'Roda bem só com processador. Não clona a sua voz — usa vozes prontas.',
  },
};

/* Escolhe COM QUAL Python criar o ambiente, quando o motor exige uma faixa.
   Sem isto o script usa o `python` do PATH — que é o mais NOVO instalado, e
   justamente o que costuma não ter instalador de torch ainda.

   O lançador `py` do Windows resolve: ele lista as versões instaladas e deixa
   pedir uma. Vem junto com o instalador oficial do python.org, então quem tem
   Python tem o `py`.

   Motor sem faixa declarada (Kokoro) não passa por aqui — não inventa
   exigência pra quem já funciona. */
function blocoPythonCompativel(m){
  if (!Array.isArray(m.pythons) || !m.pythons.length) {
    return ['set "PYEXE=python"', ''];
  }
  const faixa = m.pythons.join(', ');
  const L = [
    'REM --- Python compativel: ' + (m.porqueEssePython || 'o projeto exige uma faixa') + '. ---',
    'set "PYEXE="',
  ];
  for (const v of m.pythons){
    L.push('if not defined PYEXE ( py -' + v + ' --version >nul 2>nul && set "PYEXE=py -' + v + '" )');
  }
  /* Sem o lançador `py` (acontece com Python da Microsoft Store), ainda vale
     perguntar ao `python` do PATH: se ELE já estiver na faixa, está resolvido.
     Sem esta linha o script mandaria instalar uma versão que a pessoa tem. */
  L.push('if not defined PYEXE ( ' + testePythonDoVenv(m) + ' && set "PYEXE=python" )');
  L.push(
    'if not defined PYEXE (',
    '  echo [FALTA] O ' + m.nome + ' precisa de Python ' + faixa + '.',
    '  echo         Motivo: ' + (m.porqueEssePython || '') + '.',
    '  echo         O Python que voce tem no PATH e este:',
    '  python --version',
    '  echo.',
    '  echo   Instale a versao pedida ^(pode ter as duas no mesmo PC, uma nao atrapalha a outra^):',
    '  echo       winget install Python.Python.' + m.pythons[0],
    '  echo   ou baixe em https://www.python.org/downloads/',
    '  echo   Depois rode este arquivo de novo.',
    '  pause & exit /b 1',
    ')',
    'echo [ok] Usando Python compativel:',
    '%PYEXE% --version',
    'echo.',
    ''
  );
  return L;
}

/* Uma linha de .bat que sai com codigo 1 se o Python ATIVO estiver fora da
   faixa do motor. Motor sem faixa aceita qualquer um (sai sempre 0). */
function testePythonDoVenv(m){
  if (!Array.isArray(m.pythons) || !m.pythons.length) return 'cmd /c exit 0';
  const tuplas = m.pythons.map(v => '(' + v.split('.').join(',') + ')').join(',');
  return 'python -c "import sys; raise SystemExit(0 if sys.version_info[:2] in [' +
         tuplas + '] else 1)" >nul 2>nul';
}

function scriptInstaladorVoz(id){
  const m = VOZ_INSTALADORES[id];
  if (!m) return null;
  /* CRLF: .bat com quebra de linha do Unix roda torto no cmd do Windows —
     algumas linhas simplesmente não executam, e sem erro. */
  const L = [
    '@echo off',
    'chcp 65001 >nul',
    'setlocal',
    'title Instalar ' + m.nome + ' - voz do JARVIS',
    'echo.',
    'echo ===============================================',
    'echo  ' + m.nome + ' - servidor de voz local do JARVIS',
    'echo ===============================================',
    'echo.',
    'echo  Este script vai:',
    'echo    1. conferir se Python e Git estao instalados',
    'echo    2. clonar ' + m.repo,
    'echo    3. criar um ambiente virtual isolado (venv)',
    'echo    4. instalar as dependencias do projeto',
    'echo.',
    'echo  Download: ' + m.peso.replace(/~/g, 'aprox. '),
    'echo  Porta que o JARVIS espera: ' + m.porta,
    'echo.',
    'echo  ' + m.aviso.replace(/[.]$/, ''),
    'echo.',
    'pause',
    'echo.',
    '',
    'REM --- pre-requisitos. Falhar aqui, dizendo o que falta, vale mais que',
    'REM     falhar tres minutos adiante com um erro de compilador. ---',
    'where git >nul 2>nul',
    'if errorlevel 1 (',
    '  echo [FALTA] Git nao encontrado. Instale em https://git-scm.com e rode de novo.',
    '  pause & exit /b 1',
    ')',
    'where python >nul 2>nul',
    'if errorlevel 1 (',
    '  echo [FALTA] Python nao encontrado. Instale 3.11 ou superior em',
    '  echo         https://python.org  ^(marque "Add python.exe to PATH" no instalador^)',
    '  pause & exit /b 1',
    ')',
    'echo [ok] Git e Python encontrados.',
    'python --version',
    'echo.',
    '',
    ...blocoPythonCompativel(m),
    'REM --- clona ao lado deste .bat, nao no disco todo ---',
    'cd /d "%~dp0"',
    'if exist "' + m.pasta + '" (',
    '  echo [ja existe] Pasta ' + m.pasta + ' encontrada. Atualizando...',
    '  cd "' + m.pasta + '"',
    '  git pull || echo [aviso] git pull falhou; seguindo com o que ja esta aqui.',
    ') else (',
    '  echo Clonando ' + m.repo + ' ...',
    '  git clone --depth 1 ' + m.repo + ' "' + m.pasta + '" || (',
    '    echo [ERRO] Nao consegui clonar. Sem internet, ou o repositorio mudou de endereco.',
    '    pause & exit /b 1',
    '  )',
    '  cd "' + m.pasta + '"',
    ')',
    'echo.',
    '',
    'REM --- venv: as dependencias ficam NESTA pasta, nao no Python do sistema.',
    'REM     Desinstalar = apagar a pasta. ---',
    /* Ambiente que já existe pode ter sido criado com o Python errado numa
       tentativa anterior — e aí reaproveitar significa falhar de novo pelo
       mesmo motivo, agora sem nem a pista da versão na tela. Confere e refaz. */
    'if exist ".venv" (',
    '  call ".venv\\Scripts\\activate.bat"',
    '  ' + testePythonDoVenv(m),
    '  if errorlevel 1 (',
    '    echo [refazendo] O ambiente aqui foi criado com um Python incompativel.',
    '    echo              Apagando .venv e criando de novo com o certo.',
    '    call deactivate >nul 2>nul',
    '    rmdir /s /q ".venv"',
    '  )',
    ')',
    'if not exist ".venv" (',
    '  echo Criando ambiente virtual...',
    '  %PYEXE% -m venv .venv || ( echo [ERRO] Falha ao criar o venv. & pause & exit /b 1 )',
    ')',
    'call ".venv\\Scripts\\activate.bat"',
    'python -m pip install --upgrade pip',
    'echo.',
    '',
    'if not exist "requirements.txt" (',
    '  echo [ATENCAO] Este repositorio nao tem requirements.txt no formato esperado.',
    '  echo           O projeto pode ter mudado a forma de instalar.',
    '  echo           Abra o README em ' + m.repo + ' e siga de la.',
    '  pause & exit /b 1',
    ')',
    'echo Instalando dependencias ^(demora; o download grande e aqui^)...',
    /* A ordem das causas aqui importa. A primeira versão listava a placa de
       vídeo primeiro, e mandou o Victor caçar CUDA num erro que era de versão
       de Python — o pip diz "Could not find a version that satisfies", que
       parece internet caída ou repositório fora do ar, e não é. */
    'pip install -r requirements.txt || (',
    '  echo.',
    '  echo [ERRO] A instalacao falhou. Olhe a ULTIMA linha vermelha acima:',
    '  echo.',
    '  echo   "Could not find a version that satisfies ... torch"',
    '  echo       = Python incompativel, NAO e a sua placa de video.',
    '  echo         Este script ja tenta escolher a versao certa; se caiu aqui,',
    '  echo         o projeto mudou o que ele exige. Veja no requirements.txt',
    '  echo         qual torch ele pede e em que Python esse torch existe.',
    '  echo.',
    '  echo   erro de compilador, CUDA, ou "no kernel image"',
    '  echo       = ai sim e a placa de video. Siga a secao de instalacao do',
    '  echo         README em ' + m.repo,
    '  echo.',
    '  pause & exit /b 1',
    ')',
    'echo.',
    'echo ===============================================',
    'echo  Instalado em: %CD%',
    'echo ===============================================',
    'echo.',
    'echo  Para LIGAR o servidor, rode nesta pasta:',
    'echo      .venv\\Scripts\\activate.bat',
    'echo      python server.py',
    'echo  ^(se o README indicar outro comando, use o dele^)',
    'echo.',
    'echo  Na primeira vez ele baixa o modelo - ' + m.peso.replace(/~/g, 'aprox. ') + '.',
    'echo  Deixe terminar antes de testar a voz no JARVIS.',
    'echo.',
    'echo  Depois, no app: Configuracoes ^> Voz ^> escolha ' + m.nome + ' ^> Salvar.',
    'echo  O JARVIS procura na porta ' + m.porta + ' deste PC.',
    'echo.',
    'pause',
  ];
  return L.join('\r\n') + '\r\n';
}

/* ============================================================
   INSTALADOR DE TUDO NUMA PASSADA

   Pedido do Victor: "quando eu baixar o app via .msi, baixa todas as
   dependências de tudo".

   POR QUE NÃO DENTRO DO .msi: são vários GB. Instalador do Windows que fica 40
   minutos baixando não tem barra de progresso própria, não retoma de onde
   parou, e uma queda de rede no meio deixa a instalação pela metade — com
   direito a entrada no "Adicionar ou remover programas" apontando pra algo que
   não funciona. Fora que roda como administrador, então o estrago é maior. O
   .msi continua sendo 110 MB que instala em segundos; o peso vem depois, aqui,
   onde dá pra ver, cancelar e repetir.

   O QUE ELE FAZ: uma lista de etapas independentes. Cada uma confere se já
   está feita e pula. Uma falhar não derruba as outras — no fim ele diz o que
   entrou e o que não, em vez de morrer na primeira e esconder o resto.

   O QUE ELE NÃO INVENTA: o binário do whisper.cpp. O nome do arquivo muda a
   cada release, e eu não tenho como conferir daqui — chutar significaria um
   link quebrado dentro de um script que a pessoa roda achando que resolve.
   ============================================================ */
const WHISPER_URL_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

/* Tamanho mínimo plausível de cada modelo, em MB. Serve pra UMA coisa: se o
   download trouxer uma página de erro em vez do modelo (link mudou, HF fora do
   ar), o arquivo sai com poucos KB, e sem esta checagem ele ficaria lá com
   nome certo e conteúdo de HTML — pra falhar depois, dentro do whisper, com
   uma mensagem que não ajuda ninguém. */
const WHISPER_MB_MIN = { tiny: 60, base: 120, small: 400, medium: 1200, 'large-v3': 2500 };

function scriptInstalaTudo(modeloWhisper){
  const mw = WHISPER_MB_MIN[modeloWhisper] ? modeloWhisper : 'base';
  const minMb = WHISPER_MB_MIN[mw];
  const cb = VOZ_INSTALADORES.chatterbox;
  const kk = VOZ_INSTALADORES.kokoro;
  const L = [
    '@echo off',
    'chcp 65001 >nul',
    'setlocal',
    'title Instalar tudo - JARVIS',
    'cd /d "%~dp0"',
    'set "FALHOU="',
    'echo.',
    'echo ===============================================',
    'echo  JARVIS - instalar todas as dependencias',
    'echo ===============================================',
    'echo.',
    'echo  Etapas: Git, Python 3.12, ffmpeg, Chatterbox, Kokoro,',
    'echo          e o modelo do whisper (' + mw + ').',
    'echo.',
    'echo  Sao varios GB no total. Cada etapa pula sozinha se ja estiver',
    'echo  feita, entao voce pode rodar este arquivo quantas vezes quiser.',
    'echo.',
    'echo  Tudo e instalado NESTA pasta (ou no seu usuario), nunca no Windows.',
    'echo  Desinstalar = apagar as pastas que aparecem no fim.',
    'echo.',
    'pause',
    'echo.',
    '',
    'REM =============== 1. winget ===============',
    'where winget >nul 2>nul',
    'if errorlevel 1 (',
    '  echo [ATENCAO] winget nao encontrado. Ele vem no "Instalador de Aplicativo"',
    '  echo           da Microsoft Store. Sem ele eu nao instalo Git/Python/ffmpeg',
    '  echo           sozinho - as outras etapas seguem, e no fim eu digo o que faltou.',
    '  set "SEMWINGET=1"',
    '  echo.',
    ')',
    '',
    'REM =============== 2. Git ===============',
    'echo --- Git',
    'where git >nul 2>nul',
    'if errorlevel 1 (',
    '  if defined SEMWINGET (',
    '    echo [FALTA] Git. Instale em https://git-scm.com',
    '    set "FALHOU=%FALHOU% Git"',
    '  ) else (',
    '    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements',
    '  )',
    ') else ( echo [ok] ja instalado. )',
    'echo.',
    '',
    'REM =============== 3. Python 3.12 ===============',
    'REM O 3.12 e por causa do Chatterbox: ele fixa torch==2.5.1, que nao tem',
    'REM instalador pra Python 3.13+. Ter o 3.12 ao lado do seu Python nao',
    'REM atrapalha nada - o lancador `py` escolhe qual usar.',
    'echo --- Python 3.12',
    'py -3.12 --version >nul 2>nul',
    'if errorlevel 1 (',
    '  if defined SEMWINGET (',
    '    echo [FALTA] Python 3.12. Baixe em https://www.python.org/downloads/',
    '    set "FALHOU=%FALHOU% Python3.12"',
    '  ) else (',
    '    winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements',
    '  )',
    ') else ( echo [ok] ja instalado. )',
    'echo.',
    '',
    'REM =============== 4. ffmpeg ===============',
    'REM Sem ffmpeg a escuta continua ("Ei, JARVIS") nao grava nada.',
    'echo --- ffmpeg',
    'where ffmpeg >nul 2>nul',
    'if errorlevel 1 (',
    '  if defined SEMWINGET (',
    '    echo [FALTA] ffmpeg. Instale em https://ffmpeg.org',
    '    set "FALHOU=%FALHOU% ffmpeg"',
    '  ) else (',
    '    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements',
    '  )',
    ') else ( echo [ok] ja instalado. )',
    'echo.',
    '',
    'REM =============== 5. modelo do whisper ===============',
    'echo --- Modelo do whisper (' + mw + ')',
    'set "WDIR=%USERPROFILE%\\.jarvis-agente\\whisper-models"',
    'set "WBIN=%WDIR%\\ggml-' + mw + '.bin"',
    'if not exist "%WDIR%" mkdir "%WDIR%"',
    'if exist "%WBIN%" (',
    '  echo [ok] ja baixado.',
    ') else (',
    '  echo Baixando... isto e grande, pode demorar.',
    '  curl -L --fail --progress-bar -o "%WBIN%" "' + WHISPER_URL_BASE + '/ggml-' + mw + '.bin" || (',
    '    echo [ERRO] download falhou.',
    '    del /q "%WBIN%" 2>nul',
    '    set "FALHOU=%FALHOU% modelo-whisper"',
    '  )',
    ')',
    /* Conferir o tamanho é o que separa "baixou" de "baixou o arquivo certo":
       um redirecionamento pra página de erro vem como HTML de poucos KB. */
    /* O tamanho vem pelo PowerShell, não por `set /a`: a aritmética do cmd é
       de 32 bits (para em 2.147.483.647) e o large-v3 tem uns 3,1 GB. Com
       `set /a` a conta estoura e dá número errado — a checagem reprovaria um
       download perfeito. */
    'if exist "%WBIN%" (',
    '  for /f %%A in (\'powershell -NoProfile -Command "[int]((Get-Item \'\'%WBIN%\'\').Length/1MB)"\') do set "WMB=%%A"',
    '  call :confere_tamanho',
    ')',
    'echo.',
    '',
    'REM =============== 6. binario do whisper.cpp ===============',
    'echo --- Programa do whisper.cpp',
    'where whisper-cli >nul 2>nul',
    'if errorlevel 1 (',
    '  echo [FALTA] whisper-cli nao esta no PATH.',
    '  echo         Este e o unico item que eu NAO baixo sozinho: o nome do',
    '  echo         arquivo muda a cada versao do whisper.cpp, e um link chutado',
    '  echo         aqui viraria erro na sua mao. Pegue o zip de Windows em:',
    '  echo             https://github.com/ggml-org/whisper.cpp/releases',
    '  echo         Extraia e deixe whisper-cli.exe numa pasta do PATH.',
    '  set "FALHOU=%FALHOU% whisper-cli"',
    ') else ( echo [ok] encontrado. )',
    'echo.',
    '',
    'REM =============== 7. Chatterbox ===============',
    'echo --- ' + cb.nome + ' (voz clonada)',
    'call :instala_python_repo "' + cb.repo + '" "' + cb.pasta + '" 1',
    'echo.',
    '',
    'REM =============== 8. Kokoro ===============',
    'echo --- ' + kk.nome + ' (vozes prontas)',
    'call :instala_python_repo "' + kk.repo + '" "' + kk.pasta + '" 0',
    'echo.',
    '',
    'REM =============== fim ===============',
    'echo ===============================================',
    'if defined FALHOU (',
    '  echo  Terminou, mas ficou faltando:%FALHOU%',
    '  echo  O resto esta instalado e funciona. Resolva os itens acima e',
    '  echo  rode este arquivo de novo - ele pula tudo que ja deu certo.',
    ') else (',
    '  echo  Tudo instalado.',
    ')',
    'echo ===============================================',
    'echo.',
    'echo  Para LIGAR as vozes, em cada pasta:',
    'echo      .venv\\Scripts\\activate.bat  e depois  python server.py',
    'echo  Depois, no app: Configuracoes ^> Voz.',
    'echo.',
    'echo  Instalado em: %~dp0',
    'echo  Modelos do whisper em: %USERPROFILE%\\.jarvis-agente\\whisper-models',
    'echo.',
    'pause',
    'exit /b 0',
    '',
    'REM ---------- sub-rotinas ----------',
    ':confere_tamanho',
    'if not defined WMB ( echo [aviso] nao consegui medir o arquivo; seguindo. & exit /b 0 )',
    'if %WMB% LSS ' + minMb + ' (',
    '  echo [ERRO] o arquivo baixado tem so %WMB% MB; o modelo ' + mw + ' tem uns ' + minMb + ' MB ou mais.',
    '  echo        Provavelmente veio uma pagina de erro no lugar do modelo.',
    '  del /q "%WBIN%" 2>nul',
    '  set "FALHOU=%FALHOU% modelo-whisper"',
    ') else ( echo [ok] %WMB% MB. )',
    'exit /b 0',
    '',
    /* Chatterbox e Kokoro são o mesmo ritual (clonar, venv, requirements); o
       que muda é só se exige Python 3.12. Uma sub-rotina evita duas cópias
       divergirem com o tempo. */
    ':instala_python_repo',
    'setlocal',
    'set "REPO=%~1"',
    'set "PASTA=%~2"',
    'set "PRECISA312=%~3"',
    'set "PY=python"',
    'if "%PRECISA312%"=="1" (',
    '  py -3.12 --version >nul 2>nul && set "PY=py -3.12"',
    ')',
    'if "%PY%"=="python" if "%PRECISA312%"=="1" (',
    '  echo [pulado] precisa do Python 3.12 e ele nao esta disponivel.',
    '  endlocal & set "FALHOU=%FALHOU% %~2" & exit /b 0',
    ')',
    'where git >nul 2>nul || (',
    '  echo [pulado] precisa do Git.',
    '  endlocal & set "FALHOU=%FALHOU% %~2" & exit /b 0',
    ')',
    'if exist "%PASTA%" (',
    '  echo Atualizando %PASTA%...',
    '  pushd "%PASTA%" & git pull >nul 2>nul & popd',
    ') else (',
    '  echo Clonando %REPO% ...',
    '  git clone --depth 1 "%REPO%" "%PASTA%" || (',
    '    echo [ERRO] nao consegui clonar.',
    '    endlocal & set "FALHOU=%FALHOU% %~2" & exit /b 0',
    '  )',
    ')',
    'pushd "%PASTA%"',
    'if exist ".venv" (',
    '  call ".venv\\Scripts\\activate.bat"',
    '  if "%PRECISA312%"=="1" (',
    '    python -c "import sys; raise SystemExit(0 if sys.version_info[:2]==(3,12) else 1)" >nul 2>nul',
    '    if errorlevel 1 (',
    '      echo [refazendo] ambiente criado com Python incompativel.',
    '      call deactivate >nul 2>nul',
    '      rmdir /s /q ".venv"',
    '    )',
    '  )',
    ')',
    'if not exist ".venv" %PY% -m venv .venv',
    'call ".venv\\Scripts\\activate.bat"',
    'python -m pip install --upgrade pip >nul',
    'if exist "requirements.txt" (',
    '  pip install -r requirements.txt || (',
    '    echo [ERRO] instalacao das dependencias falhou.',
    '    popd & endlocal & set "FALHOU=%FALHOU% %~2" & exit /b 0',
    '  )',
    '  echo [ok] %PASTA% pronto.',
    ') else (',
    '  echo [ATENCAO] sem requirements.txt; veja o README de %REPO%.',
    '  popd & endlocal & set "FALHOU=%FALHOU% %~2" & exit /b 0',
    ')',
    'popd',
    'endlocal & exit /b 0',
  ];
  return L.join('\r\n') + '\r\n';
}

function baixaInstaladorTudo(){
  const msg = document.getElementById('voz-inst-msg');
  const mw = document.getElementById('voz-stt-model')?.value || 'base';
  try{
    const url = URL.createObjectURL(new Blob([scriptInstalaTudo(mw)], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'instalar-tudo.bat';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    if (msg){
      msg.innerHTML = '<b>instalar-tudo.bat</b> baixado (modelo do whisper: <b>' + esc(mw) +
        '</b>). Coloque numa pasta onde as vozes possam viver — ele instala ao lado do ' +
        'arquivo. <b>Abra no Bloco de Notas antes de rodar.</b> Pode rodar de novo depois: ' +
        'pula o que já estiver feito.';
      msg.className = 'hint ok';
    }
  }catch(e){
    if (msg){ msg.textContent = 'Não consegui gerar o arquivo: ' + e.message; msg.className = 'hint erro'; }
  }
}

function baixaInstaladorVoz(id){
  const m = VOZ_INSTALADORES[id];
  const txt = scriptInstaladorVoz(id);
  const msg = document.getElementById('voz-inst-msg');
  if (!txt){ if (msg){ msg.textContent = 'Motor desconhecido.'; msg.className = 'hint erro'; } return; }
  try{
    const nome = 'instalar-' + id + '.bat';
    const url = URL.createObjectURL(new Blob([txt], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    if (msg){
      msg.innerHTML = '<b>' + esc(nome) + '</b> baixado. Coloque numa pasta onde você queira ' +
        'que o ' + esc(m.nome) + ' viva (ele instala ao lado do arquivo), <b>abra no Bloco de ' +
        'Notas pra ver o que faz</b>, e então rode com duplo clique.';
      msg.className = 'hint ok';
    }
  }catch(e){
    if (msg){ msg.textContent = 'Não consegui gerar o arquivo: ' + e.message; msg.className = 'hint erro'; }
  }
}

function setupInstaladoresVoz(){
  const c = document.getElementById('voz-inst-chatterbox');
  if (c) c.onclick = () => baixaInstaladorVoz('chatterbox');
  const k = document.getElementById('voz-inst-kokoro');
  if (k) k.onclick = () => baixaInstaladorVoz('kokoro');
  const t = document.getElementById('voz-inst-tudo');
  if (t) t.onclick = () => baixaInstaladorTudo();
}
