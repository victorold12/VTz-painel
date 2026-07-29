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
