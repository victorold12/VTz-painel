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
  /* Uma linha de PowerShell embutida no .bat. O cmd sozinho não lê JSON nem
     descompacta zip; o PowerShell existe em todo Windows 10/11 e faz os dois.
     -NoProfile pra não carregar o perfil da pessoa (mais rápido e previsível). */
  const ps = (cmd) => 'powershell -NoProfile -ExecutionPolicy Bypass -Command "' +
                      cmd.replace(/"/g, '\\"') + '"';
  const L = [
    '@echo off',
    'chcp 65001 >nul',
    'setlocal EnableExtensions',
    'title JARVIS - baixar e organizar tudo',
    'cd /d "%~dp0"',
    '',
    'REM ============ onde tudo vai morar ============',
    'REM Uma raiz só, com as coisas separadas por assunto. Apagar esta pasta',
    'REM desinstala tudo que este script trouxe — nada vai parar no Windows,',
    'REM em Arquivos de Programas, nem no registro.',
    /* Pasta FIXA, e não "ao lado do .bat". O Victor rodou `cd JARVIS\\vozes\\...`
       a partir da pasta pessoal e não achou nada — porque o .bat estava em
       Downloads, e o caminho dependia de onde o arquivo tinha parado. Endereço
       previsível vale mais que flexibilidade aqui: dá pra escrever no LEIA-ME,
       no atalho e no suporte sem perguntar onde foi salvo.

       O caminho de Documentos vem do registro: em Windows em português a pasta
       APARECE como "Documentos", mas o nome real no disco costuma ser
       "Documents" — e pode ter sido movida pro OneDrive. Perguntar ao Windows
       acerta nos três casos; chutar acerta em um. */
    'set "RAIZ="',
    'for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders" /v Personal 2^>nul`) do set "DOCS=%%B"',
    'if not defined DOCS set "DOCS=%USERPROFILE%\\Documents"',
    'set "RAIZ=%DOCS%\\VTz LLM"',
    'set "VOZES=%RAIZ%\\vozes"',
    'set "WPROG=%RAIZ%\\whisper\\programa"',
    'set "WMOD=%RAIZ%\\whisper\\modelos"',
    'set "FALHOU="',
    '',
    'echo.',
    'echo ===============================================',
    'echo  JARVIS - baixar e organizar as dependencias',
    'echo ===============================================',
    'echo.',
    'echo  Vai criar esta arvore:',
    'echo.',
    'echo     Documentos\\VTz LLM\\',
    'echo       vozes\\' + cb.pasta + '\\      voz clonada',
    'echo       vozes\\' + kk.pasta + '\\      vozes prontas',
    'echo       whisper\\programa\\               transcricao',
    'echo       whisper\\modelos\\                modelo ' + mw,
    'echo       LEIA-ME.txt                      como ligar cada coisa',
    'echo       resumo-da-instalacao.txt         o que entrou e o que nao',
    'echo.',
    'echo  Sao varios GB. Cada etapa pula sozinha se ja estiver feita,',
    'echo  entao rodar de novo e seguro - e e assim que se conserta uma',
    'echo  etapa que falhou.',
    'echo.',
    'echo  Instalado em: %RAIZ%',
    'echo  Desinstalar = apagar essa pasta.',
    'echo.',
    'call :pausa',
    'echo.',
    '',
    'if not exist "%VOZES%" mkdir "%VOZES%"',
    'if not exist "%WPROG%" mkdir "%WPROG%"',
    'if not exist "%WMOD%"  mkdir "%WMOD%"',
    '',
    'REM ============ 1. winget ============',
    'where winget >nul 2>nul',
    'if errorlevel 1 (',
    '  echo [ATENCAO] winget nao encontrado. Ele vem no "Instalador de Aplicativo"',
    '  echo           da Microsoft Store. Sem ele eu nao instalo Git/Python/ffmpeg',
    '  echo           sozinho; o resto segue e no fim eu digo o que faltou.',
    '  set "SEMWINGET=1"',
    '  echo.',
    ')',
    '',
    'REM ============ 2. Git ============',
    'echo --- [1/7] Git',
    'call :garante "git --version" Git.Git Git https://git-scm.com',
    'echo.',
    '',
    'REM ============ 3. Python 3.12 ============',
    'REM 3.12 por causa do Chatterbox: ele fixa torch==2.5.1, que nao tem',
    'REM instalador pra Python 3.13+. Conviver com um Python mais novo no',
    'REM mesmo PC nao da problema - o lancador `py` escolhe qual usar.',
    'echo --- [2/7] Python 3.12',
    'call :garante "py -3.12 --version" Python.Python.3.12 Python3.12 https://www.python.org/downloads/',
    'echo.',
    '',
    'REM ============ 4. ffmpeg ============',
    /* O winget NAO e universal: ele vem no "Instalador de Aplicativo" da
       Microsoft Store, e na maquina do Victor simplesmente nao existe. O passo
       antigo dependia so dele e sempre falhava ali, deixando a ESCUTA
       ("Ei, JARVIS") sem gravador — sem nunca dizer que havia outro caminho.

       Agora tenta o winget e, se nao der, baixa direto do GitHub: exatamente o
       que este script ja faz pro whisper.cpp, com a mesma tecnica de perguntar
       qual e o anexo da versao mais nova em vez de cravar um nome de arquivo
       que muda a cada release. */
    'echo --- [3/7] ffmpeg',
    'ffmpeg -version >nul 2>nul',
    'if not errorlevel 1 (',
    '  echo      [ok] ja instalado no PATH.',
    ') else (',
    '  if not defined SEMWINGET (',
    '    echo      tentando pelo winget...',
    '    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements >nul 2>nul',
    '    call :recarrega_path',
    '  )',
    '  ffmpeg -version >nul 2>nul',
    '  if errorlevel 1 call :baixa_ffmpeg',
    ')',
    'echo.',
    '',
    'REM ============ 5. modelo do whisper ============',
    'echo --- [4/7] Modelo do whisper (' + mw + ')',
    'set "WBIN=%WMOD%\\ggml-' + mw + '.bin"',
    'if exist "%WBIN%" (',
    '  echo      [ok] ja baixado.',
    ') else (',
    '  echo      baixando; e grande, pode demorar bastante.',
    '  curl -L --fail --progress-bar -o "%WBIN%" "' + WHISPER_URL_BASE + '/ggml-' + mw + '.bin" || (',
    '    echo      [ERRO] download falhou.',
    '    del /q "%WBIN%" 2>nul',
    '    set "FALHOU=%FALHOU% modelo-whisper"',
    '  )',
    ')',
    /* Tamanho pelo PowerShell, não por `set /a`: a aritmética do cmd é de 32
       bits e o large-v3 tem uns 3,1 GB — com `set /a` a conta estoura e a
       checagem reprovaria um download perfeito. */
    /* `usebackq` + crase: no `for /f` comum a string do comando é delimitada por
       ASPA SIMPLES, e o cmd não tem escape pra aspa simples dentro dela — o
       comando terminaria no meio do caminho do PowerShell. Com crase as aspas
       simples ficam livres. */
    'if exist "%WBIN%" (',
    '  for /f "usebackq" %%A in (`' + ps("[int]((Get-Item '%WBIN%').Length/1MB)") + '`) do set "WMB=%%A"',
    '  call :confere_tamanho',
    ')',
    'echo.',
    '',
    'REM ============ 6. programa do whisper.cpp ============',
    'REM NAO chuto o nome do arquivo: ele muda a cada release. Pergunto ao',
    'REM GitHub qual e o anexo de Windows da versao mais nova, na hora. Assim',
    'REM o script continua valendo depois que o projeto publicar outra versao.',
    'echo --- [5/7] Programa do whisper.cpp',
    'if exist "%WPROG%\\whisper-cli.exe" (',
    '  echo      [ok] ja esta aqui.',
    ') else (',
    '  echo      procurando a versao mais nova...',
    '  ' + ps(
      "$ErrorActionPreference='Stop'; " +
      "try{ " +
        "$r=Invoke-RestMethod -Uri 'https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest' -Headers @{'User-Agent'='jarvis'}; " +
        "$zips=$r.assets | Where-Object { $_.name -like '*.zip' }; " +
        "$a=$zips | Where-Object { $_.name -match 'win' -and $_.name -match 'x64' } | Select-Object -First 1; " +
        "if(-not $a){ $a=$zips | Where-Object { $_.name -match 'win|x64|bin' } | Select-Object -First 1 } " +
"if(-not $a){ throw ('nenhum anexo servivel. Anexos desta release: ' + (($r.assets | ForEach-Object { $_.name }) -join ', ')) } " +
        "Write-Host ('      achei: ' + $a.name); " +
        "$z=Join-Path $env:TEMP $a.name; " +
        "Invoke-WebRequest -Uri $a.browser_download_url -OutFile $z; " +
        "Expand-Archive -Path $z -DestinationPath '%WPROG%' -Force; " +
        "Remove-Item $z -Force; " +
        "$exe=Get-ChildItem -Path '%WPROG%' -Recurse -Filter 'whisper-cli.exe' | Select-Object -First 1; " +
        "if(-not $exe){ $exe=Get-ChildItem -Path '%WPROG%' -Recurse -Filter 'main.exe' | Select-Object -First 1 } " +
        "if(-not $exe){ throw 'baixou e extraiu, mas nao achei whisper-cli.exe nem main.exe dentro' } " +
        /* Copia a PASTA INTEIRA onde o .exe estava, nao so o .exe.
           O zip do whisper.cpp traz o binario dentro de "Release\", junto das
           DLLs dele (ggml.dll, whisper.dll, ggml-cpu.dll...). Copiar so o
           executavel pra cima o separava das proprias bibliotecas: o arquivo
           ficava exatamente onde o stt.json apontava, e morria na execucao com
           codigo 3221225781 (0xC0000135, "DLL nao encontrada") — sem mensagem
           nenhuma no stderr. O instalador dizia "[ok] instalado", o caminho
           conferia, e a transcricao nunca funcionou. Mesma familia do BOM:
           parece certo, esta no lugar, e nao roda. */
        "if($exe.Directory.FullName -ne (Get-Item '%WPROG%').FullName){ " +
          "Copy-Item (Join-Path $exe.Directory.FullName '*') '%WPROG%' -Recurse -Force } " +
        "Write-Host '      [ok] instalado.'; exit 0 " +
      "}catch{ Write-Host ('      [ERRO] ' + $_.Exception.Message); exit 1 }"
    ),
    '  if errorlevel 1 (',
    '    echo      Pegue o zip de Windows a mao em:',
    '    echo          https://github.com/ggml-org/whisper.cpp/releases',
    '    echo      e ponha whisper-cli.exe em: %WPROG%',
    '    set "FALHOU=%FALHOU% whisper-cli"',
    '  )',
    ')',
    'echo.',
    '',
    'REM ============ 7. Chatterbox e Kokoro ============',
    /* JARVIS_PULAR_VOZES: escape pro CI. O `pip install` do torch é de longe o
       passo mais lento, e quando o que se quer testar é a mecânica do script
       (pastas, PATH, whisper, stt.json) esperar por ele desperdiça minutos de
       Windows a cada iteração. Fora do CI ninguém define isso. */
    'echo --- [6/7] ' + cb.nome + ' (clona a sua voz)',
    'if defined JARVIS_PULAR_VOZES (',
    '  echo      [pulado] JARVIS_PULAR_VOZES ligado.',
    ') else (',
    '  call :instala_python_repo "' + cb.repo + '" "' + cb.pasta + '" 1 chatterbox chatterbox-tts sim sim',
    ')',
    'echo.',
    'echo --- [7/7] ' + kk.nome + ' (vozes prontas)',
    'if defined JARVIS_PULAR_VOZES (',
    '  echo      [pulado] JARVIS_PULAR_VOZES ligado.',
    ') else (',
    '  call :instala_python_repo "' + kk.repo + '" "' + kk.pasta + '" 2',
    ')',
    'echo.',
    '',
    'REM ============ apontar o Agente Local pras pastas novas ============',
    'REM Sem isto o agente procuraria o modelo em ~/.jarvis-agente/whisper-models',
    'REM e nao acharia nada - a organizacao em pastas viraria justamente o',
    'REM motivo de nao funcionar. Mescla no stt.json que ja existe, em vez de',
    'REM sobrescrever: as escolhas de modelo e threads sao preservadas.',
    'echo --- Apontando o Agente Local pras pastas',
    /* `ConvertFrom-Json -AsHashtable` NAO existe no PowerShell 5.1, que e o que
       o `powershell.exe` do Windows roda — o -AsHashtable chegou no PowerShell 6,
       que e o `pwsh.exe` e nao vem instalado. Ou seja, este passo falhava em
       TODA maquina, sempre, com "Nao e possivel localizar um parametro que
       coincida com o nome de parametro 'AsHashtable'". E falhava calado: o
       catch transformava em "[aviso]" e o script seguia dizendo que terminou.
       O efeito era o Agente Local procurando o modelo do whisper na pasta
       antiga e nao achando nada.

       PSObject + Add-Member -Force funciona nas duas versoes, e preserva as
       chaves que ja estavam no arquivo (modelo e threads escolhidos a mao). */
    ps(
      "$ErrorActionPreference='Stop'; " +
      "try{ " +
        "$d=Join-Path $env:USERPROFILE '.jarvis-agente'; " +
        "if(-not (Test-Path $d)){ New-Item -ItemType Directory -Path $d | Out-Null } " +
        "$f=Join-Path $d 'stt.json'; " +
        "$c=$null; " +
        "if(Test-Path $f){ try{ $c=Get-Content $f -Raw | ConvertFrom-Json }catch{ $c=$null } } " +
        "if($null -eq $c){ $c=New-Object PSObject } " +
        "$c | Add-Member -NotePropertyName modelsDir -NotePropertyValue '%WMOD%' -Force; " +
        "$exe=Join-Path '%WPROG%' 'whisper-cli.exe'; " +
        "if(Test-Path $exe){ $c | Add-Member -NotePropertyName binary -NotePropertyValue $exe -Force } " +
        "$c | Add-Member -NotePropertyName model -NotePropertyValue '" + mw + "' -Force; " +
        /* WriteAllText com UTF8Encoding($false), e NAO `Set-Content -Encoding
           UTF8`: no PowerShell 5.1 — que e o que o Windows tem — o -Encoding
           UTF8 grava BOM. O JSON.parse do Node estoura no BOM, e todo
           carregador do agente envolve o parse num catch que devolve os
           padroes. Resultado: o arquivo ficava no disco com o conteudo CERTO e
           o agente ignorava tudo, em silencio dos dois lados. O instalador
           dizia "[ok] stt.json atualizado" e o whisper continuava procurando o
           modelo na pasta velha. */
        "[System.IO.File]::WriteAllText($f, ($c | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding $false)); " +
        "Write-Host '      [ok] stt.json atualizado.' " +
      "}catch{ Write-Host ('      [aviso] nao consegui escrever stt.json: ' + $_.Exception.Message) }"
    ),
    'echo.',
    '',
    'REM ============ papeis que ficam na pasta ============',
    /* ============ ligar as vozes sem digitar nada ============
       Pedido depois de errar o `cd` duas vezes: ninguem quer decorar caminho de
       venv pra ouvir a propria voz. Este .bat sobe os dois servidores em
       janelas minimizadas, e o atalho na Inicializacao faz isso no login.

       DUAS janelas separadas, e nao uma: cada servidor precisa do venv DELE
       ativo, e o Chatterbox baixa 2 GB na primeira execucao — misturar os dois
       na mesma janela esconde qual esta baixando e qual quebrou.

       `cmd /k` e NAO `cmd /c`, e sem /min. A primeira versao usava /c minimizado:
       quando o servidor falhava, a janela fechava sozinha levando a mensagem de
       erro junto, e pro usuario parecia que nada tinha acontecido. Ficar aberta
       e o ponto — quem sobe bem fica mostrando o log, quem quebra fica mostrando
       o motivo. Janela sobrando na barra e um preco baratissimo por isso.

       O atalho fica na pasta Inicializar do USUARIO, nao no registro nem como
       servico: some arrastando pra lixeira, e da pra ver que existe. Iniciar
       junto com o Windows e invasivo o bastante pra ter que ser obvio. */
    'echo --- Atalhos pra ligar as vozes',
    '> "%RAIZ%\\ligar-vozes.bat" (',
    '  echo @echo off',
    '  echo title Ligando as vozes do JARVIS',
    '  echo cd /d "%%~dp0"',
    '  echo if exist "vozes\\' + cb.pasta + '\\.venv\\Scripts\\activate.bat" (',
    '  echo   start "Chatterbox ^(porta ' + cb.porta + '^)" cmd /k "cd /d vozes\\' + cb.pasta + ' ^&^& call .venv\\Scripts\\activate.bat ^&^& python server.py"',
    '  echo ^) else ^( echo [pulado] Chatterbox nao instalado. ^)',
    '  echo if exist "vozes\\' + kk.pasta + '\\.venv\\Scripts\\activate.bat" (',
    /* O Kokoro NAO tem server.py — a entrada dele e `api.src.main:app` pelo
       uvicorn. Esta linha mandava `python server.py` nos dois, entao o Kokoro
       falhava com "can't open file server.py" toda vez que este .bat rodava,
       inclusive no login do Windows pelo atalho da Inicializacao. */
    '  echo   start "Kokoro ^(porta ' + kk.porta + '^)" cmd /k "cd /d vozes\\' + kk.pasta + ' ^&^& call .venv\\Scripts\\activate.bat ^&^& python -m uvicorn api.src.main:app --host 127.0.0.1 --port ' + kk.porta + '"',
    '  echo ^) else ^( echo [pulado] Kokoro nao instalado. ^)',
    '  echo echo.',
    '  echo echo Os dois servidores estao subindo em janelas minimizadas.',
    '  echo echo Na PRIMEIRA vez o Chatterbox baixa ~2 GB e demora - deixe terminar.',
    '  echo echo Abra o JARVIS: Configuracoes ^^^> Voz.',
    '  echo timeout /t 6 ^>nul',
    ')',
    'echo      [ok] ligar-vozes.bat criado.',
    '',
    /* O atalho é criado pelo PowerShell (COM WScript.Shell); o cmd sozinho não
       sabe escrever .lnk. Sobrescrever é de propósito: rodar o instalador de
       novo não deve acumular atalhos repetidos na Inicialização. */
    ps(
      "$ErrorActionPreference='Stop'; " +
      "try{ " +
        "$ini=[Environment]::GetFolderPath('Startup'); " +
        "$lnk=Join-Path $ini 'JARVIS - vozes.lnk'; " +
        "$w=New-Object -ComObject WScript.Shell; " +
        "$a=$w.CreateShortcut($lnk); " +
        "$a.TargetPath='%RAIZ%\\ligar-vozes.bat'; " +
        "$a.WorkingDirectory='%RAIZ%'; " +
        "$a.WindowStyle=7; " +
        "$a.Description='Sobe Chatterbox e Kokoro para o JARVIS'; " +
        "$a.Save(); " +
        "Write-Host '      [ok] vao ligar sozinhos quando voce entrar no Windows.'; " +
        "Write-Host ('      Pra desligar isso, apague: ' + $lnk) " +
      "}catch{ Write-Host ('      [aviso] nao consegui criar o atalho de inicializacao: ' + $_.Exception.Message) }"
    ),
    'echo.',
    '',
    '> "%RAIZ%\\LEIA-ME.txt" (',
    '  echo JARVIS - dependencias instaladas aqui',
    '  echo =====================================',
    '  echo.',
    '  echo vozes\\' + cb.pasta,
    '  echo     Clona a SUA voz. Para ligar:',
    '  echo         cd vozes\\' + cb.pasta,
    '  echo         .venv\\Scripts\\activate.bat',
    '  echo         python server.py',
    '  echo     O JARVIS procura na porta ' + cb.porta + '.',
    '  echo.',
    '  echo vozes\\' + kk.pasta,
    '  echo     Vozes prontas, mais leve. Mesmos passos, porta ' + kk.porta + '.',
    '  echo     E o reserva: entra sozinho se o Chatterbox nao estiver de pe.',
    '  echo.',
    '  echo whisper\\programa   - whisper-cli.exe, transcreve o que voce fala',
    '  echo whisper\\modelos    - ggml-' + mw + '.bin',
    '  echo     O Agente Local ja foi apontado pra ca ^(stt.json^).',
    '  echo.',
    '  echo Desinstalar tudo: apagar a pasta JARVIS.',
    '  echo Git, Python e ffmpeg foram instalados pelo winget e ficam fora',
    '  echo daqui - remova por "Adicionar ou remover programas" se quiser.',
    ')',
    '',
    '> "%RAIZ%\\resumo-da-instalacao.txt" (',
    '  echo Instalacao rodada em %DATE% %TIME%',
    '  if defined FALHOU ( echo Ficou faltando:%FALHOU% ) else ( echo Tudo entrou. )',
    ')',
    '',
    'echo ===============================================',
    'if defined FALHOU (',
    '  echo  Terminou, mas ficou faltando:%FALHOU%',
    '  echo  O resto esta instalado e funciona. Resolva o que falta e rode',
    '  echo  este arquivo de novo - ele pula tudo que ja deu certo.',
    ') else (',
    '  echo  Tudo instalado e organizado.',
    ')',
    'echo ===============================================',
    'echo.',
    'echo  Pasta: %RAIZ%',
    'echo  Leia o LEIA-ME.txt de la pra saber como ligar cada coisa.',
    'echo.',
    'echo  No app: Configuracoes ^> Voz ^> escolha o motor ^> Salvar.',
    'echo.',
    'call :pausa',
    'exit /b 0',
    '',
    'REM ---------- sub-rotinas ----------',
    /* `pause` espera tecla — e um script que espera tecla nunca termina numa
       maquina sem ninguem na frente. Com JARVIS_SEM_PAUSA=1 ele roda direto,
       que e como o CI do Windows executa isto pra valer de verdade num Windows
       real, em vez de eu conferir chaves e escapes no olho e torcer. */
    ':pausa',
    'if defined JARVIS_SEM_PAUSA exit /b 0',
    'pause',
    'exit /b 0',
    '',
    /* :garante "<comando de teste>" <id-winget> <nome-no-resumo> <site>
       Confere -> instala -> RECARREGA O PATH -> confere de novo.

       O passo do meio é o que faltava e derrubou a primeira tentativa inteira:
       quando o winget instala Git ou Python, a janela do .bat que JÁ ESTÁ
       ABERTA continua com o PATH antigo. O Windows só entrega o PATH novo pra
       processos criados DEPOIS da instalação. O script instalava o Python 3.12
       com sucesso e, três linhas abaixo, `py -3.12` falhava — e tudo que
       dependia dele caía em cascata, como se nada tivesse sido instalado.

       Reler o PATH do registro resolve dentro da própria janela. E a segunda
       conferida existe porque antes eu chamava `winget install` e seguia em
       frente sem olhar: se ele falhasse, o script mentia por omissão. */
    ':garante',
    'setlocal',
    'set "TESTE=%~1"',
    'set "WID=%~2"',
    'set "NOME=%~3"',
    'set "SITE=%~4"',
    '%TESTE% >nul 2>nul',
    'if not errorlevel 1 ( echo      [ok] ja instalado. & endlocal & exit /b 0 )',
    'if defined SEMWINGET (',
    '  echo      [FALTA] %NOME%. Instale em %SITE% e rode este arquivo de novo.',
    '  endlocal & set "FALHOU=%FALHOU% %~3" & exit /b 0',
    ')',
    'echo      instalando pelo winget...',
    'winget install --id %WID% -e --accept-source-agreements --accept-package-agreements',
    'call :recarrega_path',
    '%TESTE% >nul 2>nul',
    'if not errorlevel 1 ( echo      [ok] instalado. & endlocal & exit /b 0 )',
    'echo      [ATENCAO] instalou, mas este terminal ainda nao enxerga %NOME%.',
    'echo                Isso e normal: o Windows so entrega o PATH novo pra',
    'echo                janelas abertas DEPOIS da instalacao. FECHE esta janela',
    'echo                e rode este arquivo de novo - ele pula o que ja entrou.',
    'endlocal & set "FALHOU=%FALHOU% %~3" & exit /b 0',
    '',
    /* Relê o PATH das duas chaves do registro (máquina e usuário). É o que o
       Explorer faz ao abrir um terminal novo; aqui evita ter que fechar a
       janela no meio da instalação. */
    ':recarrega_path',
    'for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path 2^>nul`) do set "PATH_M=%%B"',
    'for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\\Environment" /v Path 2^>nul`) do set "PATH_U=%%B"',
    'if defined PATH_M set "PATH=%PATH_M%"',
    'if defined PATH_U set "PATH=%PATH%;%PATH_U%"',
    'exit /b 0',
    '',
    /* Copia o requirements.txt tirando as linhas de torch, quando a versao certa
       do torch JA foi instalada antes. Sem isso o pip leria "torch==2.5.1",
       decidiria que precisa trocar o 2.6.0 que acabou de entrar, e faria
       exatamente a desinstalacao que este arranjo existe pra evitar.

       `torch\\b` e nao `torch`: pacotes como `torchsde` (que o Chatterbox usa de
       verdade) NAO podem ser removidos da lista. A fronteira de palavra separa
       "torch" de "torchsde", e o grupo opcional cobre torchvision/torchaudio. */
    ':requirements_sem_torch',
    'if not defined ALINHA_TORCH (',
    '  copy /y "requirements.txt" "requirements-jarvis.txt" >nul',
    '  exit /b 0',
    ')',
    ps(
      "try{ " +
        "$L=Get-Content 'requirements.txt' | Where-Object { $_ -notmatch '^\\s*torch(vision|audio)?\\b\\s*[=<>!~]' }; " +
        "Set-Content 'requirements-jarvis.txt' $L -Encoding UTF8; " +
    /* Sem `^(` aqui: o `^` so escapa fora de aspas. Como a linha inteira do
       PowerShell vai entre aspas duplas, o cmd nao mexe nos parenteses — e um
       `^` escrito a mao sairia impresso na tela. */
        "Write-Host ('      ' + $L.Count + ' dependencias (as linhas de torch saem: a versao certa ja entrou)') " +
      "}catch{ Copy-Item 'requirements.txt' 'requirements-jarvis.txt' -Force }"
    ),
    /* Se o PowerShell falhar por qualquer motivo, seguir sem o arquivo faria o
       pip reclamar de um caminho inexistente — pior que instalar com a lista
       original. */
    'if not exist "requirements-jarvis.txt" copy /y "requirements.txt" "requirements-jarvis.txt" >nul',
    'exit /b 0',
    '',
    /* Baixa o ffmpeg sem winget e sem mexer no PATH do usuario.
       Mexer no PATH seria invasivo e so valeria pra processos abertos DEPOIS —
       o mesmo tropeco que ja derrubou este script uma vez. Em vez disso grava o
       caminho no listener.json, do jeito que o whisper ja faz com o stt.json. */
    ':baixa_ffmpeg',
    'if exist "%RAIZ%\\ffmpeg\\ffmpeg.exe" (',
    '  echo      [ok] ja baixado aqui.',
    '  goto :aponta_ffmpeg',
    ')',
    'echo      baixando do GitHub ^(sem winget^)...',
    'if not exist "%RAIZ%\\ffmpeg" mkdir "%RAIZ%\\ffmpeg"',
    ps(
      "$ErrorActionPreference='Stop'; " +
      "try{ " +
        "$r=Invoke-RestMethod -Uri 'https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest' -Headers @{'User-Agent'='jarvis'}; " +
        "$a=$r.assets | Where-Object { $_.name -match 'win64' -and $_.name -match 'gpl' -and $_.name -like '*.zip' -and $_.name -notmatch 'shared' } | Select-Object -First 1; " +
        "if(-not $a){ throw ('nenhum anexo win64 nesta release: ' + (($r.assets | ForEach-Object { $_.name }) -join ', ')) } " +
        "Write-Host ('      achei: ' + $a.name); " +
        "$z=Join-Path $env:TEMP $a.name; " +
        "Invoke-WebRequest -Uri $a.browser_download_url -OutFile $z; " +
        "$tmp=Join-Path $env:TEMP 'jarvis-ffmpeg'; " +
        "if(Test-Path $tmp){ Remove-Item $tmp -Recurse -Force } " +
        "Expand-Archive -Path $z -DestinationPath $tmp -Force; " +
        "$exe=Get-ChildItem -Path $tmp -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1; " +
        "if(-not $exe){ throw 'baixou e extraiu, mas nao achei ffmpeg.exe dentro' } " +
        "Copy-Item $exe.FullName (Join-Path '%RAIZ%\\ffmpeg' 'ffmpeg.exe') -Force; " +
        "Remove-Item $z,$tmp -Recurse -Force; " +
        "Write-Host '      [ok] baixado.'; exit 0 " +
      "}catch{ Write-Host ('      [ERRO] ' + $_.Exception.Message); exit 1 }"
    ),
    'if errorlevel 1 (',
    '  echo      Pegue o ffmpeg a mao em https://ffmpeg.org/download.html',
    '  echo      e ponha ffmpeg.exe em: %RAIZ%\\ffmpeg',
    '  set "FALHOU=%FALHOU% ffmpeg"',
    '  exit /b 0',
    ')',
    '',
    ':aponta_ffmpeg',
    /* Sem isto o download seria inutil: o listener procura "ffmpeg" no PATH, e
       a pasta nova nao esta la. Mescla no listener.json em vez de sobrescrever,
       pra preservar o que a pessoa ja escolheu (trecho, dispositivo). */
    ps(
      "try{ " +
        "$d=Join-Path $env:USERPROFILE '.jarvis-agente'; " +
        "if(-not (Test-Path $d)){ New-Item -ItemType Directory -Path $d | Out-Null } " +
        "$f=Join-Path $d 'listener.json'; " +
        "$c=$null; if(Test-Path $f){ try{ $c=Get-Content $f -Raw | ConvertFrom-Json }catch{ $c=$null } } " +
        "if($null -eq $c){ $c=New-Object PSObject } " +
        "$c | Add-Member -NotePropertyName ffmpegPath -NotePropertyValue (Join-Path '%RAIZ%\\ffmpeg' 'ffmpeg.exe') -Force; " +
        /* WriteAllText com UTF8Encoding($false), e NAO `Set-Content -Encoding
           UTF8`: no PowerShell 5.1 — que e o que o Windows tem — o -Encoding
           UTF8 grava BOM. O JSON.parse do Node estoura no BOM, e todo
           carregador do agente envolve o parse num catch que devolve os
           padroes. Resultado: o arquivo ficava no disco com o conteudo CERTO e
           o agente ignorava tudo, em silencio dos dois lados. O instalador
           dizia "[ok] stt.json atualizado" e o whisper continuava procurando o
           modelo na pasta velha. */
        "[System.IO.File]::WriteAllText($f, ($c | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding $false)); " +
        "Write-Host '      [ok] a escuta ja sabe onde achar o ffmpeg.' " +
      "}catch{ Write-Host ('      [aviso] nao consegui escrever listener.json: ' + $_.Exception.Message) }"
    ),
    'exit /b 0',
    '',
    ':confere_tamanho',
    /* Um redirecionamento pra página de erro chega como HTML de poucos KB e
       ficaria salvo com o nome do modelo — pra falhar bem depois, dentro do
       whisper, com uma mensagem que não ajuda ninguém. */
    'if not defined WMB ( echo      [aviso] nao consegui medir o arquivo; seguindo. & exit /b 0 )',
    'if %WMB% LSS ' + minMb + ' (',
    '  echo      [ERRO] veio so %WMB% MB; o modelo ' + mw + ' tem uns ' + minMb + ' MB ou mais.',
    '  echo             Provavelmente baixou uma pagina de erro no lugar do modelo.',
    '  del /q "%WBIN%" 2>nul',
    '  set "FALHOU=%FALHOU% modelo-whisper"',
    ') else ( echo      [ok] %WMB% MB. )',
    'exit /b 0',
    '',
    /* Chatterbox e Kokoro seguem o mesmo ritual (clonar, venv, requirements);
       muda só se exige Python 3.12. Uma sub-rotina evita duas cópias
       divergirem com o tempo. */
    /* ===== `&` SIMPLES, NUNCA `^&`, nas linhas de saida por erro =====
       Parece que o `&` precisa de escape dentro de um bloco `( )`. NAO precisa —
       e escapar quebra tudo em silencio: o `^&` faz o `&` virar ARGUMENTO
       LITERAL do `popd`, entao `endlocal`, `set` e `exit /b 0` nunca executam. O
       script imprime "[ERRO] ..." e seguem em frente ate imprimir "[ok] pronto",
       nas duas linhas seguidas.

       Aconteceu de verdade com o Kokoro na maquina do Victor:

           [ERRO] instalacao pelo pyproject.toml falhou.
           [ok] pronto em ...\Kokoro-FastAPI

       Medido num cmd real, a tres niveis de aninhamento: com `&` simples o
       `exit /b` roda E o FALHOU propaga pra fora do setlocal; com `^&`, nenhum
       dos dois. Nao troque sem rodar um .bat de teste. */
    ':instala_python_repo',
    'setlocal',
    'set "REPO=%~1"',
    'set "PASTA=%VOZES%\\%~2"',
    'set "PRECISA312=%~3"',
    'set "MODULO=%~4"',
    'set "PACOTE=%~5"',
    'set "ALINHA_TORCH=%~6"',
    'set "DESLIGA_MARCA=%~7"',
    /* 0 = qualquer Python serve | 1 = exige 3.12 | 2 = prefere 3.12, aceita outro.
       O Kokoro virou 2 depois do teste no Windows: ele nao FIXA torch como o
       Chatterbox, mas o `python` do PATH e o mais novo instalado, e foi nele
       que o pip quebrou no runner. Preferir uma versao conhecida-boa custa nada
       e some com a classe inteira do problema. */
    'set "PY=python"',
    'if not "%PRECISA312%"=="0" ( py -3.12 --version >nul 2>nul && set "PY=py -3.12" )',
    'if "%PRECISA312%"=="1" if "%PY%"=="python" (',
    '  echo      [pulado] precisa do Python 3.12, que nao esta disponivel.',
    '  goto :repo_falhou_cedo',
    ')',
    'where git >nul 2>nul || (',
    '  echo      [pulado] precisa do Git.',
    '  goto :repo_falhou_cedo',
    ')',
    'if exist "%PASTA%" (',
    '  echo      atualizando...',
    '  pushd "%PASTA%" & git pull >nul 2>nul & popd',
    ') else (',
    '  echo      clonando %REPO% ...',
    '  git clone --depth 1 "%REPO%" "%PASTA%" || (',
    '    echo      [ERRO] nao consegui clonar.',
    '    goto :repo_falhou_cedo',
    '  )',
    ')',
    'pushd "%PASTA%"',
    'if exist ".venv" (',
    '  call ".venv\\Scripts\\activate.bat"',
    '  if "%PRECISA312%"=="1" (',
    '    python -c "import sys; raise SystemExit(0 if sys.version_info[:2]==(3,12) else 1)" >nul 2>nul',
    '    if errorlevel 1 (',
    '      echo      [refazendo] ambiente criado com Python incompativel.',
    '      call deactivate >nul 2>nul',
    '      rmdir /s /q ".venv"',
    '    )',
    '  )',
    ')',
    'if not exist ".venv" %PY% -m venv .venv',
    'call ".venv\\Scripts\\activate.bat"',
    'python -m pip install --upgrade pip >nul',
    /* ===== setuptools: a peca que sumiu debaixo do projeto inteiro =====
       Ate o Python 3.11, todo venv novo vinha com setuptools dentro, e por isso
       `import pkg_resources` sempre funcionou. No 3.12 o venv passou a vir
       LIMPO — e este instalador usa `py -3.12` de proposito, por causa do torch.

       Quem paga a conta e o `perth` (a marca-d'agua da Resemble): ele importa
       pkg_resources e, quando falha, o __init__ dele ENGOLE o ImportError e
       deixa `PerthImplicitWatermarker` valendo None. O Chatterbox entao morre
       carregando o modelo com "TypeError: 'NoneType' object is not callable" —
       uma mensagem que nao cita marca-d'agua, nem setuptools, nem pkg_resources.

       Foi essa cadeia que fez o projeto passar sessoes chutando o nome de uma
       chave no config.yaml. Nenhuma chave resolveria: o crash acontece dentro
       do pacote chatterbox, antes de qualquer configuracao do servidor.
       Confirmado em github.com/resemble-ai/Perth/issues/7.

       Vai pra TODOS os motores, nao so pro Chatterbox: bibliotecas Python
       escritas antes do 3.12 assumem pkg_resources sem declarar, e este e o
       tipo de falta que aparece longe da causa. */
    /* `setuptools<82` e NAO `--upgrade setuptools`. O pkg_resources foi REMOVIDO
       no setuptools 82.0.0 — entao pedir a versao mais nova instala justamente
       a que nao tem o que o perth precisa. A primeira tentativa deste conserto
       fez exatamente isso: instalou setuptools, e o `import pkg_resources`
       continuou falhando. Conserto certo, versao errada.
       (setuptools.pypa.io/en/stable/history.html — removido na v82) */
    'python -m pip install "setuptools<82" wheel >nul || echo      [aviso] nao consegui instalar setuptools.',
    /* Nem todo projeto Python usa requirements.txt. O Kokoro-FastAPI declara as
       dependencias no pyproject.toml, e o script recusava instalar dizendo "sem
       requirements.txt; veja o README" — ou seja, o Kokoro NUNCA foi instalado
       por este instalador. O venv ficava criado e vazio, e o servidor morria
       depois com "No module named uvicorn", que parece outro problema. */
    'set "USA_PYPROJECT="',
    'if not exist "requirements.txt" (',
    '  if exist "pyproject.toml" (',
    '    set "USA_PYPROJECT=1"',
    '  ) else (',
    '    echo      [ATENCAO] sem requirements.txt nem pyproject.toml; veja o README de %REPO%.',
    '    goto :repo_falhou',
    '  )',
    ')',
    '',
    /* ===== O torch vai ANTES, e nao depois =====
       A ordem antiga era: instalar requirements.txt (que fixa torch==2.5.1) e
       DEPOIS forcar 2.6.0. Isso obriga o pip a DESINSTALAR o 2.5.1 pra por o
       2.6.0 no lugar — e desinstalar é a operacao mais fragil que existe aqui,
       porque mexe em milhares de arquivos ja em uso.

       Na maquina do Victor o pip foi interrompido exatamente ai, por uma pasta
       do PATH que o Windows recusa atravessar (o Codex da OpenAI instala a sua
       como junção; o erro sai como "ponto de montagem nao confiavel"). O
       rollback nao conseguiu restaurar: "ERROR: Failed to restore ...\torch\".
       O resultado foi um torch pela metade, que depois produz erros que nao
       parecem ter nada a ver — "No module named 'torch.distributed.tensor'" e
       "cannot import name 'autocast' from 'torch.amp'".

       Instalando a versao certa PRIMEIRO, e tirando as linhas de torch do
       requirements, nao existe desinstalacao nenhuma pra ser interrompida. */
    'if defined ALINHA_TORCH (',
    '  echo      instalando torch 2.6.0 ^(antes das dependencias, pra nao ter que trocar depois^)...',
    '  pip install torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 || (',
    '    echo      [ERRO] nao consegui instalar o torch.',
    '    goto :repo_falhou',
    '  )',
    ')',
    '',
    'if defined USA_PYPROJECT (',
    '  echo      sem requirements.txt; instalando pelo pyproject.toml...',
    '  pip install . || (',
    /* A causa real na maquina do Victor nao foi "falta cmake", como o erro
       sugeria: foi "CMAKE_C_COMPILER not set" — uma dependencia do Kokoro nao
       tem wheel pronta pro Python 3.12 e tenta COMPILAR do zero, o que exige as
       Build Tools do Visual Studio (varios GB). Despejar 37 linhas de traceback
       do CMake mandava cacar a coisa errada; nomear as duas causas provaveis
       custa quatro linhas e resolve a duvida. */
    '    echo      [ERRO] instalacao pelo pyproject.toml falhou. As duas causas comuns:',
    '    echo             "CMAKE_C_COMPILER not set" ou "Microsoft Visual C++ 14.0"',
    '    echo                 = alguma dependencia compila do zero e falta compilador.',
    '    echo                   Instale o "Build Tools for Visual Studio" ^(varios GB^):',
    '    echo                   https://visualstudio.microsoft.com/visual-cpp-build-tools/',
    '    echo             qualquer outra coisa = veja o README de %REPO%',
    '    echo             O ' + kk.nome + ' e o RESERVA: sem ele o ' + cb.nome + ' continua falando.',
    '    goto :repo_falhou',
    '  )',
    ') else (',
    /* Nome FIXO, e nao uma variavel devolvida pela sub-rotina: o cmd expande o
       bloco inteiro do `if` ANTES de executar qualquer coisa dentro dele, entao
       um %REQ% definido pelo `call` chegaria aqui ainda vazio. */
    '  call :requirements_sem_torch',
    '  pip install -r "requirements-jarvis.txt" || (',
    '    echo      [ERRO] instalacao das dependencias falhou.',
    '    echo             "Could not find a version ... torch" = Python incompativel.',
    '    echo             erro de compilador ou CUDA = placa de video.',
    '    goto :repo_falhou',
    '  )',
    ')',
    /* O requirements.txt do Chatterbox instala TUDO menos o motor: `pip install`
       termina com sucesso, e `import chatterbox` estoura na primeira execução.
       Como o instalador declarava vitória ali, o erro só aparecia depois, numa
       janela minimizada que fechava sozinha. Conferir o import fecha esse buraco
       — sucesso do pip nao e prova de que da pra usar. */
    'if defined MODULO (',
    '  python -c "import %MODULO%" >nul 2>nul',
    '  if errorlevel 1 (',
    '    echo      faltou o motor ^(%MODULO%^); instalando %PACOTE%...',
    '    pip install %PACOTE% || (',
    '      echo      [ERRO] nao consegui instalar %PACOTE%.',
    '      goto :repo_falhou',
    '    )',
    '  )',
    ')',
    /* ===== O que a noite de 31/07 custou pra descobrir =====
       Cada linha abaixo corresponde a um erro que o Victor comeu na mao. Nenhuma
       veio de documentacao — todas de execucao real, e por isso ficam aqui em
       vez de num README que ninguem le.

       1. torch. O requirements.txt fixa 2.5.1; o chatterbox-tts exige 2.6.0. O
          pip sobe o torch e DEIXA o torchvision velho -> "ponto de entrada nao
          encontrado", que nao parece problema de versao nenhum. Alinhar os tres
          juntos e a unica forma de nao cair nisso.
       2. resemble-perth. Vem instalado mas o __init__ engole ImportError e deixa
          a classe como None; o servidor entao morre em "NoneType is not
          callable" 4 GB depois de baixar o modelo. A marca-d'agua so identifica
          audio gerado por IA — nao participa de sintetizar fala. Desligar troca
          um travamento total por uma funcao que ninguem aqui usa. */
    /* Sucesso do pip nao e prova de que da pra usar — a lição que este projeto
       ja pagou duas vezes. Aqui ela aparece na forma mais cruel: o pip pode ser
       INTERROMPIDO no meio e ainda assim o script seguir, porque o passo
       seguinte nao tinha por que desconfiar.

       Um torch pela metade nao falha no import de cara: falha lá dentro, com
       "cannot import name 'autocast'" ou "No module named
       'torch.distributed.tensor'" — mensagens que mandam procurar bug no
       Chatterbox, no CUDA, na versao do Python. Em nenhuma delas aparece a
       palavra que explicaria tudo: o pacote esta corrompido no disco.

       Nao da pra consertar um venv nesse estado; da pra reconhecer e refazer.
       Apagar aqui e o certo: a proxima execucao recria limpo, e o script ja
       existe pra ser rodado de novo. */
    'if defined ALINHA_TORCH (',
    '  python -c "import torch; torch.zeros(1)" >nul 2>nul',
    '  if errorlevel 1 (',
    '    echo      [ERRO] o torch ficou quebrado neste ambiente.',
    '    echo             O pip foi interrompido no meio de uma instalacao. A causa',
    '    echo             mais comum e uma pasta do PATH que o Windows recusa',
    '    echo             atravessar ^(o erro sai como "ponto de montagem nao',
    '    echo             confiavel"^); antivirus e disco cheio dao no mesmo.',
    '    echo             Apagando o ambiente - rode este arquivo de novo pra',
    '    echo             recria-lo limpo.',
    '    call deactivate >nul 2>nul',
    '    rmdir /s /q ".venv"',
    '    goto :repo_falhou',
    '  )',
    ')',
    /* Confere que o perth resolve ANTES de declarar vitoria. Se
       PerthImplicitWatermarker ainda for None aqui, o servidor vai subir, abrir
       a porta e morrer carregando o modelo — respondendo ao painel sem falar,
       que e o pior estado possivel porque parece que funcionou.

       O `pip install` de setuptools acima ja deve ter resolvido; esta segunda
       tentativa cobre o caso de o proprio resemble-perth nao ter entrado. E se
       ainda assim falhar, o script DIZ, em vez de deixar a descoberta pro
       usuario ouvir silencio depois. */
    'if defined DESLIGA_MARCA (',
    '  python -c "import perth,sys; sys.exit(0 if perth.PerthImplicitWatermarker else 1)" >nul 2>nul',
    '  if errorlevel 1 (',
    '    echo      a marca-d^\'agua nao carregou; instalando resemble-perth e setuptools...',
    '    pip install "setuptools<82" resemble-perth >nul 2>nul',
    '    python -c "import perth,sys; sys.exit(0 if perth.PerthImplicitWatermarker else 1)" >nul 2>nul',
    '    if errorlevel 1 (',
    '      echo      [ATENCAO] o perth continua sem carregar. O servidor vai subir e',
    '      echo                abrir a porta, mas o modelo NAO vai carregar - ele',
    '      echo                responde e nao fala. Causa conhecida: falta pkg_resources',
    '      echo                ^(setuptools^). Veja github.com/resemble-ai/Perth/issues/7',
    /* Sem `set "FALHOU=..."` aqui: esta sub-rotina roda dentro de um `setlocal`,
       entao a variavel morreria no `endlocal` e a linha seria codigo que nao faz
       nada — pior que nao existir, porque parece que faz. Quem registra esta
       falha e a mensagem acima, e quem a pega no automatico e o sobe-vozes.js,
       que le o stdout do servidor e reprova modelo que nao carregou. */
    '    ) else ( echo      [ok] marca-d^\'agua carregando. )',
    '  ) else ( echo      [ok] marca-d^\'agua carregando. )',
    ')',
    /* O passo abaixo desliga a marca-d'agua na CONFIGURACAO do servidor, quando
       ela existe. Ele NAO e o que conserta o travamento — isso ficou provado
       quando o Chatterbox quebrou no CI com o config.yaml ja editado. Fica
       porque gerar audio sem marca-d'agua continua sendo o que se quer aqui. */
    'if defined DESLIGA_MARCA if exist "config.yaml" (',
    '  echo      desligando a marca-d^\'agua ^(perth^)...',
    '  ' + ps(
      "try{ " +
        "$f='config.yaml'; $t=Get-Content $f -Raw; " +
        "$n=[regex]::Replace($t,'(?im)^(\\s*enable_watermarking\\s*:\\s*)true\\s*$','${1}false'); " +
        "if($n -ne $t){ Set-Content $f $n -Encoding UTF8; Write-Host '      [ok] marca-d''agua desligada.' } " +
        "else { Write-Host '      (nada pra desligar no config.yaml)' } " +
      "}catch{ Write-Host ('      [aviso] nao consegui editar config.yaml: ' + $_.Exception.Message) }"
    ),
    ')',
    'echo      [ok] pronto em %PASTA%',
    'popd',
    'endlocal & exit /b 0',
    '',
    /* ===== POR QUE `goto` E NAO `exit /b` NOS CAMINHOS DE ERRO =====
       `exit /b` dentro de `comando || ( ... )` que por sua vez esta dentro de
       `if ( ... )` NAO sai da sub-rotina: o cmd engole a saida e a execucao
       segue na linha de baixo. Reproduzido nesta maquina, num .bat de 15 linhas:

           if defined FLAG (
             cmd /c exit 1 || ( echo [ERRO]; endlocal ^& exit /b 0 )
           )
           echo [ok] NAO DEVIA APARECER     <- aparecia

       Foi exatamente o que aconteceu com o Kokoro: o instalador imprimiu
       "[ERRO] instalacao pelo pyproject.toml falhou" e, tres linhas depois,
       "[ok] pronto em ...". Declarar vitoria sobre uma falha e o defeito que
       este projeto mais combate, e ele voltou por uma regra de escape do cmd.

       `goto` atravessa qualquer nivel de parenteses. Um ponto de saida so, e
       nao ha como um caminho novo esquecer de sair.

       O `:repo_falhou` cai POR DENTRO no `:repo_falhou_cedo` de proposito:
       quem ja tinha feito `pushd` precisa do `popd`, quem falhou antes dele
       nao — e o resto da limpeza e identico nos dois casos. */
    ':repo_falhou',
    'popd',
    ':repo_falhou_cedo',
    'endlocal & set "FALHOU=%FALHOU% %~2" & exit /b 0',
  ];
  return L.join('\r\n') + '\r\n';
}

/* ============================================================
   INSTALAR DENTRO DO APP (Electron)

   O download do .bat resolvia o problema técnico e não resolvia o humano. Entre
   "baixar um arquivo" e "ter voz clonada" sobravam quatro passos que ninguém
   faz com prazer: achar o arquivo em Downloads, abrir no Bloco de Notas, rodar,
   e acompanhar numa janela preta que fecha sozinha justamente quando dá errado
   — levando junto a mensagem de erro. Cada passo era um lugar pra desistir.

   Aqui o app roda O MESMO .bat e mostra a saída nesta tela. O arquivo continua
   existindo, continua sendo gerado pelo mesmo código, e continua sendo testado
   num Windows de verdade pelo testa-instalador.yml — trocar isso por uma
   reimplementação em JavaScript jogaria fora a única prova de execução real que
   este projeto tem.

   NO NAVEGADOR NADA MUDA. Sem a casca Electron não existe como executar coisa
   nenhuma no PC (e ainda bem), então o botão continua baixando o .bat. É por
   isso que a decisão é tomada no clique, e não no carregamento da tela: a mesma
   build do painel roda nos dois lugares.

   O QUE NÃO SE PERDEU NO CAMINHO: a confirmação. Instalar programa continua
   sendo a coisa mais invasiva que este app faz. Quem pergunta agora é o diálogo
   nativo do Windows, disparado pelo processo principal — dizendo o que vai
   baixar, onde vai instalar e como desinstalar. O que sumiu foi o terminal, não
   o consentimento.
   ============================================================ */
const VOZ_LOG_MAX = 600;   /* o pip imprime aos milhares; o DOM não aguenta tudo */
let _vozInst = { rodando:false, desinscreve:null, linhas:[] };

/* Devolve a ponte só quando ela REALMENTE serve. `window.jarvisDesktop.vozes`
   existe em qualquer Electron, mas o instalador é um .bat: em macOS/Linux o
   honesto é voltar pro download em vez de oferecer um botão que não anda. */
async function vozPonteDesktop(){
  const v = window.jarvisDesktop?.vozes;
  if (!v || typeof v.instalar !== 'function') return null;
  try{
    const e = await v.estado();
    return e?.suportado ? v : null;
  }catch(err){ return null; }
}

function vozInstEl(id){ return document.getElementById(id); }

function abrePainelInstalacao(){
  const p = vozInstEl('voz-inst-painel');
  if (p) p.hidden = false;
  _vozInst.linhas = [];
  const log = vozInstEl('voz-inst-log');
  if (log) log.textContent = '';
}

function fasedaInstalacao(txt){
  const el = vozInstEl('voz-inst-fase');
  if (el) el.textContent = txt || '';
}

/* textContent, nunca innerHTML: isto aqui é saída de pip, git e PowerShell —
   texto de terceiros. Um caminho de arquivo com "<" já bastaria pra sumir com
   metade da linha; um pacote com nome malicioso seria pior. */
function logInstalacao(linha){
  _vozInst.linhas.push(String(linha ?? ''));
  if (_vozInst.linhas.length > VOZ_LOG_MAX) _vozInst.linhas.splice(0, _vozInst.linhas.length - VOZ_LOG_MAX);
  const log = vozInstEl('voz-inst-log');
  if (!log) return;
  log.textContent = _vozInst.linhas.join('\n');
  /* Só acompanha o fim se a pessoa já estava no fim. Rolar à força enquanto
     alguém lê uma linha de erro lá em cima é a forma mais rápida de esconder
     justamente o que ela foi procurar. */
  const noFim = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  if (noFim) log.scrollTop = log.scrollHeight;
}

function botoesInstalacao(){
  const c = vozInstEl('voz-inst-cancelar');
  const f = vozInstEl('voz-inst-fechar');
  if (c) c.hidden = !_vozInst.rodando;
  if (f) f.hidden = _vozInst.rodando;
  const t = vozInstEl('voz-inst-tudo');
  if (t) t.disabled = _vozInst.rodando;
}

async function instalaVozesNoApp(v){
  if (_vozInst.rodando) return;
  const modelo = vozInstEl('voz-stt-model')?.value || 'base';

  abrePainelInstalacao();
  fasedaInstalacao('Esperando você confirmar na janela do Windows…');
  logInstalacao('Modelo do whisper escolhido: ' + modelo);

  _vozInst.desinscreve?.();
  _vozInst.desinscreve = v.aoProgredir((ev) => {
    if (!ev) return;
    if (ev.tipo === 'linha') logInstalacao(ev.texto);
    else if (ev.tipo === 'fase'){ fasedaInstalacao(ev.texto); logInstalacao('=== ' + ev.texto); }
    else if (ev.tipo === 'fim'){ fasedaInstalacao(ev.texto); logInstalacao('=== ' + ev.texto); }
  });

  _vozInst.rodando = true;
  botoesInstalacao();
  const msg = vozInstEl('voz-inst-msg');
  if (msg){ msg.textContent = ''; msg.className = 'hint'; }

  try{
    const r = await v.instalar(modelo);
    if (r?.ok){
      fasedaInstalacao('Instalado.');
      if (msg){
        msg.textContent = 'Pronto. Os motores subiram sozinhos — a aba já deve mostrar ' +
          '"no ar" em instantes. Na primeira vez o Chatterbox ainda baixa ~2 GB de modelo ' +
          'antes de conseguir falar.';
        msg.className = 'hint ok';
      }
    }else{
      fasedaInstalacao(r?.cancelado ? 'Cancelado.' : 'Não terminou.');
      if (msg){
        msg.textContent = (r?.erro || 'A instalação não terminou.') +
          (r?.cancelado ? '' : ' Rodar de novo é seguro: ele pula tudo que já deu certo.');
        msg.className = r?.cancelado ? 'hint' : 'hint erro';
      }
    }
  }catch(e){
    fasedaInstalacao('Falhou.');
    logInstalacao('[erro] ' + e.message);
    if (msg){ msg.textContent = 'Não consegui falar com o instalador: ' + e.message; msg.className = 'hint erro'; }
  }finally{
    _vozInst.rodando = false;
    botoesInstalacao();
    /* Relê o estado dos motores: é o que faz a linha "no ar" aparecer sem F5,
       e o que prova que a instalação valeu de alguma coisa. */
    vozCarregar().catch(() => {});
  }
}

/* Decide no CLIQUE, não no carregamento: a mesma build roda no navegador e
   dentro do Electron. */
async function instalarTudo(){
  const v = await vozPonteDesktop();
  if (!v) return baixaInstaladorTudo();
  return instalaVozesNoApp(v);
}

/* Ajusta o texto da seção quando dá pra instalar aqui dentro. Se a ponte não
   existir, o HTML fica como está — falando de download, que é o que acontece. */
async function ajustaTextoInstaladores(){
  const v = await vozPonteDesktop();
  if (!v) return;
  const b = vozInstEl('voz-inst-tudo');
  if (b) b.textContent = 'Instalar TUDO neste PC';
  const explica = vozInstEl('voz-inst-explica');
  if (explica){
    explica.innerHTML = 'O de <b>TUDO</b> resolve a lista inteira sem você sair daqui: Git, ' +
      'Python 3.12, ffmpeg, Chatterbox, Kokoro e o modelo do whisper. O JARVIS pede sua ' +
      'confirmação, mostra cada etapa abaixo em tempo real, e no fim <b>liga os motores ' +
      'sozinho</b>. Instala em <b>Documentos\\VTz LLM</b>; desinstalar é apagar essa pasta. ' +
      'São <b>vários GB</b> — dá pra cancelar no meio e continuar depois, que ele pula o ' +
      'que já ficou pronto.';
  }
  /* Já instalado de uma sessão anterior? Sobe sem reinstalar nada. O atalho da
     Inicialização do Windows cobre o login; isto cobre quem instalou, fechou o
     app e voltou antes de reiniciar a máquina. */
  const ligar = vozInstEl('voz-inst-ligar');
  if (ligar){
    try{
      const e = await v.estado();
      ligar.hidden = !(e?.motores || []).some(m => m.instalado);
    }catch(err){ ligar.hidden = true; }
  }
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

/* Reconexão automática enquanto a aba Voz está aberta.

   Sem isto o estado dos motores era lido UMA vez, ao carregar. Quem instalava,
   ligava os servidores e voltava pro app continuava vendo "não está rodando" —
   e a conclusão natural é que a instalação falhou, quando só faltava um F5.
   Agora a tela procura sozinha a cada 12s, e para quando você sai da aba: é
   uma chamada ao PC pareado, não vale gastar com ela em segundo plano. */
let _vozRelogio = null;
function paraProcuraVozes(){ if (_vozRelogio){ clearInterval(_vozRelogio); _vozRelogio = null; } }
function comecaProcuraVozes(){
  paraProcuraVozes();
  _vozRelogio = setInterval(() => {
    const aba = document.querySelector('.cfg-group[data-cat="voz"]');
    /* offsetParent nulo = escondido. Se a pessoa saiu da aba, para sozinho. */
    if (!aba || !aba.offsetParent){ paraProcuraVozes(); return; }
    vozCarregar().catch(() => {});
  }, 12000);
}

function setupInstaladoresVoz(){
  const c = document.getElementById('voz-inst-chatterbox');
  if (c) c.onclick = () => baixaInstaladorVoz('chatterbox');
  const k = document.getElementById('voz-inst-kokoro');
  if (k) k.onclick = () => baixaInstaladorVoz('kokoro');
  const t = document.getElementById('voz-inst-tudo');
  if (t) t.onclick = () => instalarTudo();

  const canc = document.getElementById('voz-inst-cancelar');
  if (canc) canc.onclick = async () => {
    canc.disabled = true;
    try{
      await window.jarvisDesktop?.vozes?.cancelar();
      logInstalacao('=== cancelando (derrubando o instalador e o que ele abriu)…');
    }catch(e){ logInstalacao('[erro ao cancelar] ' + e.message); }
    finally{ canc.disabled = false; }
  };

  const fech = document.getElementById('voz-inst-fechar');
  if (fech) fech.onclick = () => {
    const p = document.getElementById('voz-inst-painel');
    if (p) p.hidden = true;
    /* Solta o ouvinte do IPC ao fechar: sem isso, abrir e fechar a aba dez
       vezes deixaria dez inscrições vivas escrevendo a mesma linha dez vezes. */
    _vozInst.desinscreve?.();
    _vozInst.desinscreve = null;
  };

  const ligar = document.getElementById('voz-inst-ligar');
  if (ligar) ligar.onclick = async () => {
    const v = await vozPonteDesktop();
    if (!v) return;
    ligar.disabled = true;
    abrePainelInstalacao();
    fasedaInstalacao('Ligando os motores…');
    _vozInst.desinscreve?.();
    _vozInst.desinscreve = v.aoProgredir((ev) => { if (ev?.tipo === 'linha') logInstalacao(ev.texto); });
    botoesInstalacao();
    try{
      const r = await v.ligar();
      fasedaInstalacao(r?.ok ? 'Motores no ar.' : 'Nenhum motor subiu — veja o log.');
      vozCarregar().catch(() => {});
    }catch(e){ fasedaInstalacao('Falhou: ' + e.message); }
    finally{ ligar.disabled = false; }
  };

  ajustaTextoInstaladores();

  const rec = document.getElementById('voz-reconectar');
  if (rec) rec.onclick = async () => {
    rec.disabled = true;
    vozMsg('Procurando Chatterbox e Kokoro neste PC…');
    try{
      await vozCarregar();
      const ligados = Object.entries(vozState.engines || {}).filter(([, e]) => e && e.up).map(([id]) => id);
      vozMsg(ligados.length
        ? 'Encontrei: ' + ligados.join(' e ') + '.'
        : 'Nenhuma voz respondeu. Elas estão RODANDO? Abra Documentos\\VTz LLM e execute ligar-vozes.bat.',
        ligados.length ? 'ok' : 'erro');
      comecaProcuraVozes();
    }catch(e){
      vozMsg('Não consegui perguntar ao seu PC: ' + e.message, 'erro');
    }finally{ rec.disabled = false; }
  };
  comecaProcuraVozes();
}
