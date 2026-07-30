/* ============================================================
   CENA JARVIS (Seções 6 e 14 do prompt mestre) — portada do preview
   preview/estados-visuais.html pro painel de verdade, que é o que o
   .msi empacota. Motor (partículas, ondas, FSM, FileCard, driver de
   streaming) veio verbatim de lá; só o wiring é do painel.

   Escopo: tudo aqui vive dentro de uma IIFE porque o build concatena
   os módulos num único escopo e nomes como ICONS/esc/ico já existem
   em 00-core-state.js. Só o que o painel precisa chamar sai pra fora.
   ============================================================ */
(function(){

const SW = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  chat:`<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>`,
  library:`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
  archive:`<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>`,
  folder:`<path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z"/>`,
  bot:`<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1.4"/><path d="M9 13.5h.01M15 13.5h.01"/><path d="M9.5 17h5"/>`,
  chevronDown:`<path d="m6 9 6 6 6-6"/>`,
  settings:`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H22a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>`,
  download:`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>`,
  image:`<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>`,
  bulb:`<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.1 14a5 5 0 1 0-6.2 0 3.3 3.3 0 0 1 1.1 2h4a3.3 3.3 0 0 1 1.1-2z"/>`,
  map:`<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>`,
  file:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>`,
  slides:`<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4M8 21h8"/>`,
  code:`<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>`,
  tools:`<path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.8 2.8 0 0 1-4-4z"/><path d="m17.6 3.5 2.9 2.9"/>`,
  plus:`<path d="M12 5v14M5 12h14"/>`,
  mic:`<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0"/><path d="M12 17v5"/>`,
  arrowUp:`<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>`,
  arrowLeft:`<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>`,
  clip:`<path d="M21.4 11.1 12.3 20a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.7 1.7 0 0 1-2.4-2.4l8.3-8.3"/>`,
  cmd:`<path d="M15 6a3 3 0 1 1 3 3h-3zM9 6a3 3 0 1 0-3 3h3zM15 18a3 3 0 1 0 3-3h-3zM9 18a3 3 0 1 1-3-3h3z"/><rect x="9" y="9" width="6" height="6"/>`,
  sparkle:`<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.4 6.4 2.8 2.8M14.8 14.8l2.8 2.8M17.6 6.4l-2.8 2.8M9.2 14.8l-2.8 2.8"/>`,
  search:`<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>`,
  cpu:`<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>`,
  mail:`<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>`,
  square:`<rect x="6" y="6" width="12" height="12" rx="2"/>`,
  check:`<path d="m5 13 4 4L19 7"/>`,
  x:`<path d="M18 6 6 18M6 6l12 12"/>`,
  copy:`<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
  refresh:`<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>`,
  play:`<path d="m7 4 12 8-12 8z"/>`,
  sheet:`<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>`,
  terminal:`<path d="m5 8 4 4-4 4"/><path d="M13 16h6"/>`,
  film:`<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M17 4v16M2 12h20"/>`,
  music:`<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>`,
  box:`<path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v9"/>`,
  chip:`<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/>`
};
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function ico(name, cls){
  return `<svg class="icon ${cls||''}" ${SW}>${ICONS[name]||ICONS.file}</svg>`;
}
// hidrata todos os <i data-ico>
function hydrateIcons(root){
  (root||document).querySelectorAll('i[data-ico]').forEach(el=>{
    el.outerHTML = ico(el.dataset.ico);
  });
}

/* ---------- 2. REGISTRO DE TIPOS DE ARQUIVO ----------
   Todo tipo que o backend puder gerar. Ext desconhecida cai no default
   e usa a própria extensão como tag — nunca quebra.               */
const KINDS = [
  {g:'doc',   ext:['pdf'],                                   tag:'PDF',   tint:'#ff6b6b', glyph:'file'},
  {g:'doc',   ext:['docx','doc','odt','rtf'],                 tag:'DOCX',  tint:'#8b5cf6', glyph:'file'},
  {g:'doc',   ext:['txt','md','log'],                         tag:'TEXT',  tint:'#9a9aa5', glyph:'file'},
  {g:'sheet', ext:['xlsx','xls','csv','ods','tsv'],           tag:'SHEET', tint:'#4fd1c5', glyph:'sheet'},
  {g:'slide', ext:['pptx','ppt','odp'],                       tag:'SLIDE', tint:'#ffb454', glyph:'slides'},
  {g:'code',  ext:['py','js','ts','jsx','tsx','json','html','css','xml','yml','yaml','sql','c','cpp','cs','java','go','rs','php','rb','lua','ipynb'], tag:'CODE', tint:'#a78bfa', glyph:'code'},
  {g:'script',ext:['bat','cmd','ps1','reg','vbs','sh','zsh'], tag:'SCRIPT',tint:'#ff9d6b', glyph:'terminal'},
  {g:'image', ext:['png','jpg','jpeg','gif','webp','svg','bmp','ico','avif','tiff'], tag:'IMG', tint:'#f472b6', glyph:'image'},
  {g:'video', ext:['mp4','mov','avi','mkv','webm','m4v'],     tag:'VIDEO', tint:'#60a5fa', glyph:'film'},
  {g:'audio', ext:['mp3','wav','flac','ogg','m4a','aac'],     tag:'AUDIO', tint:'#34d399', glyph:'music'},
  {g:'zip',   ext:['zip','rar','7z','tar','gz','xz'],         tag:'ZIP',   tint:'#fbbf24', glyph:'box'},
  {g:'bin',   ext:['exe','msi','dll','iso','apk','bin'],      tag:'BIN',   tint:'#fb923c', glyph:'chip'}
];
const KIND_MAP = (()=>{ const m={}; KINDS.forEach(k=>k.ext.forEach(e=>m[e]=k)); return m; })();
function kindOf(ext){
  const e = String(ext||'').replace(/^\./,'').toLowerCase();
  return KIND_MAP[e] || {g:'other', tag:(e||'FILE').toUpperCase().slice(0,6), tint:'#9a9aa5', glyph:'file'};
}
function hexA(hex,a){
  const n=parseInt(hex.slice(1),16);
  return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;
}
function fmtSize(bytes){
  if(bytes==null) return '—';
  if(bytes < 1024) return bytes+' B';
  if(bytes < 1048576) return (bytes/1024).toFixed(2)+' KB';
  if(bytes < 1073741824) return (bytes/1048576).toFixed(2)+' MB';
  return (bytes/1073741824).toFixed(2)+' GB';
}

/* ---------- 3. STATE MACHINE ----------
   Nós do JARVIS + estados do chat, independentes.
   Transições disparadas por EVENTO, nunca por tempo fixo.        */
/* `erro` é um nó como qualquer outro, alcançável de todos os demais. Antes o
   erro não era estado: a mensagem ia pra legenda e a cena voltava pra idle, onde
   o CSS esconde a legenda — a cena fechava a escuta e ficava muda, parecendo que
   o pedido tinha sido ignorado. Estado de verdade significa que a tela sabe
   mostrar erro sem ninguém forçar estilo por fora. */
const JARVIS_GRAPH = {
  idle:       ['listening','erro'],
  listening:  ['thinking','idle','erro'],
  thinking:   ['delivering','idle','erro'],
  delivering: ['idle','listening','erro'],
  erro:       ['idle','listening']
};
class FSM {
  constructor(graph, initial){
    this.graph = graph; this.state = initial; this.listeners = [];
  }
  can(next){ return (this.graph[this.state]||[]).includes(next); }
  go(next, payload){
    if(next === this.state) return false;
    if(!this.can(next)){
      // salto não previsto (ex.: dev console) — permite, mas passa por idle
      console.warn(`[FSM] salto ${this.state} → ${next} fora do grafo`);
    }
    const prev = this.state;
    this.state = next;
    this.listeners.forEach(fn => fn(next, prev, payload));
    return true;
  }
  on(fn){ this.listeners.push(fn); return this; }
}
const jfsm = new FSM(JARVIS_GRAPH, 'idle');

/* ---------- 4. INTERFACE DRIVER ----------
   ESTE é o contrato do backend. Quando o VTZ OS real existir,
   ele implementa estes 5 métodos e NADA na UI muda.              */
class Driver {
  startListening(){ throw 'not implemented'; }
  stopListening(){ throw 'not implemented'; }
  submit(text){ throw 'not implemented'; }
  cancel(){ throw 'not implemented'; }
  // saídas que o driver EMITE para a UI:
  //   onAudioLevel(level 0..1)
  //   onTranscript(text, isFinal)
  //   onStep({index, label, status:'active'|'done'})
  //   onFileProgress({id, name, ext, size, status, progress 0..100})
  //   onResult({query, answer, steps[], files[]})
  //   onError(msg)
}

/* ================================================================
   5. MOTOR DE PARTÍCULAS — UM buffer, TRÊS alvos, morph contínuo.
   Radial(ref 7) · Vórtice(ref 5) · Esfera(ref 4) não são três
   animações: são três posições do MESMO sistema. A transição entre
   estados é interpolação de peso, então nunca existe corte seco.
   ================================================================ */
const VS = `
attribute vec3 aRad, aVor, aSph;
attribute vec3 aMisc;               // x=seed  y=sizeMul  z=ringFlag
uniform vec3  uW;                   // pesos: radial, vortex, sphere
uniform float uTime, uAudio, uAspect, uOffsetX, uScale, uPix;
varying float vDepth, vAlpha;

vec3 rotY(vec3 p, float a){
  float c = cos(a), s = sin(a);
  return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}

void main(){
  float seed = aMisc.x;

  /* --- alvo 1: padrão radial de pontos (escutando) --- */
  vec3 pr  = aRad;
  float ra = atan(pr.y, pr.x);
  float rr = length(pr.xy);
  float a2 = ra + uTime * 0.16 + rr * 0.42;
  float pulse = 1.0 + uAudio * 0.34 * sin(rr * 8.0 - uTime * 5.0);
  float rr2 = rr * pulse;
  pr = vec3(cos(a2) * rr2, sin(a2) * rr2, sin(rr * 5.0 - uTime * 1.7) * 0.05);

  /* --- alvo 2: vórtice cilíndrico (pensando) --- */
  vec3 pv  = aVor;
  float vr = length(pv.xz);
  float va = atan(pv.z, pv.x);
  float y  = pv.y;
  if(aMisc.z < 0.5){                        // partícula de fluxo
    float f = fract((y * 0.5 + 0.5) - uTime * 0.17 + seed * 0.37);
    y = f * 2.0 - 1.0;
    vr *= 0.82 + 0.34 * (1.0 - abs(y));     // estrangula no meio (ampulheta)
  }
  va += uTime * (0.62 + 0.3 * (1.0 - abs(y))) + y * 0.75;
  pv = vec3(cos(va) * vr, y, sin(va) * vr);

  /* --- alvo 3: esfera halftone na mão (entregando) --- */
  vec3 ps = rotY(aSph, uTime * 0.22);
  ps *= 1.0 + sin(uTime * 1.5 + seed * 6.283) * 0.022;
  ps += vec3(sin(uTime*1.1 + seed*19.0),
             cos(uTime*0.9 + seed*23.0),
             sin(uTime*1.3 + seed*13.0)) * 0.013;

  /* --- morph: a interpolação É o handoff --- */
  vec3 p = pr * uW.x + pv * uW.y + ps * uW.z;
  p *= uScale;
  p.x += uOffsetX;

  float z = p.z + 3.30;
  vec2 proj = p.xy * (2.35 / z);
  proj.x /= uAspect;

  vDepth  = clamp((3.30 - p.z) / 2.4, 0.0, 1.0);
  vAlpha  = 0.26 + 0.60 * vDepth;
  gl_Position  = vec4(proj, 0.0, 1.0);
  gl_PointSize = aMisc.y * uPix * (2.30 / z) * (1.0 + uAudio * 0.45);
}`;

const FS = `
precision mediump float;
uniform vec3 uColA, uColB;
uniform float uAlpha;
varying float vDepth, vAlpha;
void main(){
  float d = length(gl_PointCoord - vec2(0.5));
  if(d > 0.5) discard;
  float a = smoothstep(0.5, 0.26, d);
  vec3 col = mix(uColB, uColA, vDepth * vDepth);
  gl_FragColor = vec4(col, a * vAlpha * uAlpha);
}`;

class ParticleEngine {
  constructor(canvas){
    this.cv = canvas;
    this.gl = canvas.getContext('webgl', {alpha:true, antialias:false, premultipliedAlpha:false});
    this.ok = !!this.gl;
    if(!this.ok){ console.warn('WebGL indisponível'); return; }
    // Densidade alta por decisão de brief (fidelidade > otimização).
    // Único corte: renderer POR SOFTWARE (SwiftShader/llvmpipe), onde 24k pontos
    // derrubam pra ~1fps. Não é fallback pra GPU fraca — é pra ausência de GPU.
    let soft = false;
    try{
      const dbg = this.gl.getExtension('WEBGL_debug_renderer_info');
      const r = dbg ? String(this.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      soft = /swiftshader|llvmpipe|software|basic render/i.test(r);
    }catch(e){}
    this.N = soft ? 3500 : (window.innerWidth < 900 ? 9000 : 24000);
    if(soft) console.warn('[VTz] renderer por software detectado — densidade reduzida');
    this.W = {r:0, v:0, s:0};          // pesos atuais
    this.T = {r:0, v:0, s:0};          // pesos alvo
    this.audio = 0; this.audioT = 0;
    this.offX = 0; this.offXT = 0;
    this.scale = 1; this.scaleT = 1;
    this.alpha = 0; this.alphaT = 0;
    this.t0 = performance.now();
    this._build();
    this._resize();
    addEventListener('resize', ()=>this._resize());
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _compile(type, src){
    const gl = this.gl, sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(sh);
    return sh;
  }

  _build(){
    const gl = this.gl, N = this.N;
    const prog = gl.createProgram();
    gl.attachShader(prog, this._compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, this._compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw gl.getProgramInfoLog(prog);
    gl.useProgram(prog); this.prog = prog;

    const rad = new Float32Array(N*3),
          vor = new Float32Array(N*3),
          sph = new Float32Array(N*3),
          msc = new Float32Array(N*3);
    const TAU = Math.PI*2, GOLD = Math.PI*(3-Math.sqrt(5));
    const RINGS = 46, PER = Math.floor(N/RINGS);

    for(let i=0;i<N;i++){
      const i3 = i*3, rnd = Math.random();

      /* alvo 1 — radial: anéis concêntricos com twist, furo no centro */
      const ring = Math.floor(i/PER), k = i % PER;
      const rr = 0.30 + 0.72 * (ring/RINGS);
      const ra = (k/PER)*TAU + ring*0.135;
      rad[i3]   = Math.cos(ra)*rr;
      rad[i3+1] = Math.sin(ra)*rr;
      rad[i3+2] = 0;

      /* alvo 2 — vórtice: 22% formam os dois anéis brilhantes, resto flui */
      const isRing = rnd < 0.22;
      const va = Math.random()*TAU;
      if(isRing){
        const top = Math.random() < 0.5 ? 1 : -1;
        const vr = 0.96 + (Math.random()-0.5)*0.035;
        vor[i3]   = Math.cos(va)*vr;
        vor[i3+1] = top * (0.94 + Math.random()*0.05);
        vor[i3+2] = Math.sin(va)*vr;
      } else {
        const wall = Math.random() < 0.72;
        const vr = wall ? 0.86 + Math.random()*0.20 : Math.random()*0.16;
        vor[i3]   = Math.cos(va)*vr;
        vor[i3+1] = Math.random()*2 - 1;
        vor[i3+2] = Math.sin(va)*vr;
      }

      /* alvo 3 — esfera (distribuição fibonacci = halftone regular) */
      const yy = 1 - (i/(N-1))*2;
      const rp = Math.sqrt(Math.max(0, 1-yy*yy));
      const th = GOLD * i;
      const R  = 0.72 * (0.90 + Math.random()*0.13);
      sph[i3]   = Math.cos(th)*rp*R;
      sph[i3+1] = yy*R;
      sph[i3+2] = Math.sin(th)*rp*R;

      msc[i3]   = Math.random();                     // seed
      msc[i3+1] = 0.42 + Math.random()*0.78;         // sizeMul
      msc[i3+2] = isRing ? 1 : 0;                    // ringFlag
    }

    const bind = (name, data)=>{
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    };
    bind('aRad', rad); bind('aVor', vor); bind('aSph', sph); bind('aMisc', msc);

    this.u = {};
    ['uW','uTime','uAudio','uAspect','uOffsetX','uScale','uPix','uColA','uColB','uAlpha']
      .forEach(n => this.u[n] = gl.getUniformLocation(prog, n));

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);   // aditivo: partícula empilha luz
  }

  _resize(){
    const dpr = Math.min(devicePixelRatio||1, 2);
    const w = this.cv.clientWidth||innerWidth, h = this.cv.clientHeight||innerHeight;
    this.cv.width = w*dpr; this.cv.height = h*dpr;
    this.gl.viewport(0,0,this.cv.width,this.cv.height);
    this.aspect = w/h; this.dpr = dpr;
  }

  /* API — chamada pela state machine, não pela UI */
  setTarget({r=0,v=0,s=0, offX=0, scale=1, alpha=1}){
    this.T = {r,v,s}; this.offXT = offX; this.scaleT = scale; this.alphaT = alpha;
  }
  setAudio(level){ this.audioT = Math.max(0, Math.min(1, level)); }

  /* Degradação por FPS MEDIDO. A detecção de renderer por software (no
     construtor) só pega a ausência total de GPU; uma integrada fraca se declara
     hardware e engasga do mesmo jeito nos 24 mil pontos — e aí a cena que devia
     impressionar vira uma apresentação de slides.

     Mede a média móvel e corta pela metade quando cai abaixo de 40fps por 2
     segundos seguidos. Corta no máximo duas vezes (24k → 12k → 6k): abaixo
     disso o problema não é densidade, e ficar reduzindo pra sempre trocaria uma
     cena feia por uma cena vazia. Nunca volta a subir — oscilar a densidade na
     tela chama mais atenção que a queda de fps. */
  _vigiaFps(now){
    if (!this._fpsT){ this._fpsT = now; this._fpsN = 0; this._cortes = 0; this._ruim = 0; return; }
    this._fpsN += 1;
    const janela = now - this._fpsT;
    if (janela < 1000) return;
    const fps = this._fpsN * 1000 / janela;
    this._fpsT = now; this._fpsN = 0;
    if (this._cortes >= 2) return;
    this._ruim = (fps < 40) ? this._ruim + 1 : 0;
    if (this._ruim >= 2){
      this._ruim = 0; this._cortes += 1;
      this.N = Math.max(1500, Math.round(this.N / 2));
      console.warn(`[VTz] ${fps.toFixed(0)}fps na cena JARVIS — densidade reduzida para ${this.N} pontos`);
    }
  }

  _loop(now){
    requestAnimationFrame(this._loop);
    const gl = this.gl, dt = 1/60;
    if (this.alpha > 0.01) this._vigiaFps(now);
    const k = 1 - Math.pow(0.002, dt);        // suavização exponencial
    this.W.r += (this.T.r - this.W.r)*k*1.7;
    this.W.v += (this.T.v - this.W.v)*k*1.7;
    this.W.s += (this.T.s - this.W.s)*k*1.7;
    this.offX  += (this.offXT  - this.offX )*k*1.5;
    this.scale += (this.scaleT - this.scale)*k*1.5;
    this.alpha += (this.alphaT - this.alpha)*k*2.2;
    this.audio += (this.audioT - this.audio)*0.18;

    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if(this.alpha < 0.01) return;

    const u = this.u;
    gl.uniform3f(u.uW, this.W.r, this.W.v, this.W.s);
    gl.uniform1f(u.uTime, (now - this.t0)/1000);
    gl.uniform1f(u.uAudio, this.audio);
    gl.uniform1f(u.uAspect, this.aspect);
    gl.uniform1f(u.uOffsetX, this.offX);
    gl.uniform1f(u.uScale, this.scale);
    gl.uniform1f(u.uPix, 1.05*this.dpr);
    gl.uniform3f(u.uColA, 1.0, 0.99, 1.0);          // núcleo: branco
    gl.uniform3f(u.uColB, 0.545, 0.361, 0.965);     // fundo: --violet #8b5cf6
    gl.uniform1f(u.uAlpha, this.alpha);
    gl.drawArrays(gl.POINTS, 0, this.N);
  }
}

/* ================================================================
   6. WAVEFIELD — ondas orgânicas do menu JARVIS (ref 6)
   Shader em loop contínuo. Não é imagem, não é GIF.
   ================================================================ */
const WFS = `
precision mediump float;
uniform vec2 uRes; uniform float uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p  = vec2(uv.x*1.7, uv.y);
  float t = uTime*0.045;
  // domain warping: dá o aspecto de fumaça/tecido da referência
  vec2 q = vec2(fbm(p*2.4 + t), fbm(p*2.4 + vec2(3.1,1.7) - t));
  vec2 r = vec2(fbm(p*2.9 + q*1.9 + t*1.4), fbm(p*2.9 + q*1.9 + vec2(8.3,2.8)));
  float n = fbm(p*2.2 + r*1.35);
  float veil = pow(smoothstep(0.28, 0.92, n), 1.7);
  vec3 col = mix(vec3(0.006,0.006,0.010), vec3(0.085,0.082,0.105), veil);
  col += vec3(0.545,0.361,0.965) * pow(veil, 5.0) * 0.30;   // veios violeta
  col += vec3(0.310,0.820,0.771) * pow(veil, 9.0) * 0.10;   // fio teal (--good)
  float vig = 1.0 - 0.62*length(uv - 0.5);
  gl_FragColor = vec4(col*vig, 1.0);
}`;

class WaveField {
  constructor(canvas){
    this.cv = canvas;
    const gl = this.gl = canvas.getContext('webgl', {antialias:false});
    if(!gl){ canvas.style.background = '#050508'; return; }
    const mk=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(sh);return sh;};
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, WFS));
    gl.linkProgram(p); gl.useProgram(p);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const la = gl.getAttribLocation(p,'a');
    gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la,2,gl.FLOAT,false,0,0);
    this.uRes = gl.getUniformLocation(p,'uRes');
    this.uTime = gl.getUniformLocation(p,'uTime');
    this.t0 = performance.now();
    this._resize(); addEventListener('resize',()=>this._resize());
    const loop = (now)=>{ requestAnimationFrame(loop);
      if(document.body.dataset.jscene !== 'jarvis') return;   // não queima GPU no chat
      gl.uniform2f(this.uRes, this.cv.width, this.cv.height);
      gl.uniform1f(this.uTime, (now-this.t0)/1000);
      gl.drawArrays(gl.TRIANGLES,0,3);
    };
    requestAnimationFrame(loop);
  }
  _resize(){
    const dpr = Math.min(devicePixelRatio||1, 1.5);
    this.cv.width  = (this.cv.clientWidth ||innerWidth )*dpr;
    this.cv.height = (this.cv.clientHeight||innerHeight)*dpr;
    this.gl.viewport(0,0,this.cv.width,this.cv.height);
  }
}

/* ================================================================
   7. COMPONENTE FILECARD (ref 3)
   Design fixo. Nome, extensão, tag, tamanho, label e progresso
   vêm SEMPRE do driver — nada hardcoded, nada travado em 74%.
   ================================================================ */
class FileCard {
  constructor(mount, data){
    this.k = kindOf(data.ext);
    this.el = document.createElement('div');
    this.el.className = 'filecard';
    this.el.style.setProperty('--fc-tint', this.k.tint);
    this.el.style.setProperty('--fc-glow', hexA(this.k.tint, .85));
    this.el.innerHTML = `
      <button class="fc-close" title="Fechar">${ico('x')}</button>
      <div class="fc-top">
        <div class="fc-thumb">
          <div class="fc-sheet"></div><div class="fc-fold"></div>
          <div class="fc-glyph">${ico(this.k.glyph)}</div>
          <div class="fc-tag">${this.k.tag}</div>
        </div>
        <div class="fc-meta">
          <div class="fc-name"></div>
          <div class="fc-size"></div>
        </div>
      </div>
      <div class="fc-progress">
        <div class="fc-prow">
          <div class="fc-spin"></div>
          <div class="fc-status"></div>
          <div class="fc-pct">0%</div>
        </div>
        <div class="fc-track"><div class="fc-bar"></div></div>
      </div>
      <div class="fc-actions">
        <button class="fc-btn primary">${ico('download')}Baixar</button>
        <button class="fc-btn">${ico('copy')}Copiar caminho</button>
      </div>`;
    this.$ = q => this.el.querySelector(q);
    this.el.querySelector('.fc-close').onclick = ()=> this.dismiss();
    mount.appendChild(this.el);
    this.update(data);
  }
  update(d){
    if(d.name != null || d.ext != null){
      this._name = d.name ?? this._name ?? 'arquivo';
      this._ext  = (d.ext ?? this._ext ?? '').replace(/^\./,'');
      const jaTemExt = this._ext &&
        this._name.toLowerCase().endsWith('.' + this._ext.toLowerCase());
      this.$('.fc-name').textContent =
        (this._ext && !jaTemExt) ? `${this._name}.${this._ext}` : this._name;
      const k = kindOf(this._ext);
      if(k.tag !== this.k.tag){
        this.k = k;
        this.el.style.setProperty('--fc-tint', k.tint);
        this.el.style.setProperty('--fc-glow', hexA(k.tint,.85));
        this.$('.fc-tag').textContent = k.tag;
        this.$('.fc-glyph').innerHTML = ico(k.glyph);
      }
    }
    if(d.size != null) this.$('.fc-size').textContent = fmtSize(d.size);
    if(d.status != null) this.$('.fc-status').textContent = d.status;
    if(d.progress != null){
      const p = Math.max(0, Math.min(100, d.progress));
      this.$('.fc-bar').style.width = p + '%';
      this.$('.fc-pct').textContent = Math.round(p) + '%';
      if(p >= 100 && !this.el.classList.contains('done')){
        this.el.classList.add('done');
        this.$('.fc-spin').innerHTML = ico('check');
        if(d.status == null) this.$('.fc-status').textContent = 'Concluído';
      }
    }
    return this;
  }
  dismiss(){
    this.el.classList.add('out');
    setTimeout(()=> this.el.remove(), 340);
  }
}

/* ================================================================
/* Config do backend: reusa o que o painel já sabe (state.backendUrl,
   backendHeaders, state.apiKey). Não duplica fonte de verdade. */
const JMODEL_DEFAULT = (typeof MODEL_DEFAULT !== 'undefined') ? MODEL_DEFAULT : '__router__';
/* A chave é 'vtz_or_model' — a mesma que o seletor de modelos do painel grava
   (17-fallback-models.js). Antes esta cena lia 'vtz_model', chave que NINGUÉM
   escreve: o getItem devolvia null sempre, e o JARVIS ignorava silenciosamente
   o modelo escolhido no painel, rodando sempre no padrão. */
function jarvisModeloEscolhido(){
  return localStorage.getItem('vtz_or_model') || JMODEL_DEFAULT;
}
const API = {
  get base(){ return backendUrl(); },
  get model(){
    const v = jarvisModeloEscolhido();
    return v.startsWith('__') ? '' : v;
  },
  get route(){
    const v = jarvisModeloEscolhido();
    return {'__router__':'auto', '__router_free__':'free', '__fusion__':'fusion'}[v] || '';
  },
  get agentId(){ return jarvisState.agentId || ''; },
  headers(){
    /* X-OR-Key é o que autoriza o backend a chamar o OpenRouter. Sem ele o
       /api/agent responde erro de chave — foi o que faltava no preview. */
    return backendHeaders({ 'Content-Type':'application/json', 'X-OR-Key': state.apiKey || '' });
  }
};

/* `maxMs` é rede de segurança, e existe por um defeito real: o `speechEnd` só
   sai depois de o volume cruzar `threshold` uma vez. Microfone baixo, ganho no
   mínimo ou ruído de fundo abafado nunca cruzam — e aí o laço rodava PARA
   SEMPRE, com a cena parada em "escutando" e nenhuma mensagem. Era o sintoma
   "ele fica escutando e não fala nada".

   O comentário antigo dizia "quem fecha a escuta é o VAD, não um timer". Estava
   certo no caso normal e errado no caso ruim: sem teto, um VAD que não dispara
   não tem quem o socorra. */
const VAD = { startMs:600, silenceMs:1100, threshold:0.055, maxMs:15000 };

class BackendDriver extends Driver {
  constructor(){
    super();
    this.h = {}; this.stream = null; this.ctx = null; this.abort = null;
    this._live = false; this._t0 = 0; this._quietSince = 0; this._spoke = false;
  }
  on(evt, fn){ (this.h[evt] = this.h[evt] || []).push(fn); return this; }
  emit(evt, ...a){ (this.h[evt]||[]).forEach(f => f(...a)); }

  /* ---------- ÁUDIO REAL ---------- */
  async startListening(){
    if(!navigator.mediaDevices?.getUserMedia){
      this.emit('error','Este navegador não expõe microfone.');
      return false;
    }
    try{
      this.stream = await navigator.mediaDevices.getUserMedia({audio:true});
    }catch(e){
      this.emit('error','Microfone negado — libere o acesso para falar com o JARVIS.');
      return false;
    }
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(this.stream);
    const an  = ctx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.75;
    src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    this.ctx = ctx; this._live = true;
    this._t0 = performance.now(); this._quietSince = 0; this._spoke = false;

    // STT real, se o navegador tiver. O transcript vem do reconhecimento, não de texto fixo.
    this._startSTT();
    /* Grava em paralelo. No aplicativo de desktop o reconhecimento do navegador
       não existe, e sem estes bytes não haveria o que mandar pro whisper do PC —
       falar com o JARVIS no .msi era impossível por construção. Gravar sempre
       (e descartar quando não precisa) evita ter que decidir antes de saber se o
       reconhecimento vai funcionar. */
    this._gravaAudio();

    const tick = ()=>{
      if(!this._live) return;
      an.getByteFrequencyData(buf);
      let s = 0; for(let i=0;i<buf.length;i++) s += buf[i];
      const lvl = Math.min(1, (s/buf.length/128) * 1.6);
      this.emit('audio', lvl);

      const now = performance.now();
      /* Teto absoluto. Dois desfechos diferentes de propósito: se houve fala, o
         que foi dito vale e segue como se o silêncio tivesse fechado; se não
         houve som nenhum, o problema é de captação e dizer isso é o que evita a
         pessoa ficar olhando pra uma tela muda. */
      if(now - this._t0 > VAD.maxMs){
        this._live = false;
        if(this._spoke){ this.emit('speechEnd'); }
        else{
          this.emit('error','Não captei áudio nenhum em ' + Math.round(VAD.maxMs/1000) +
            's. Confira se o microfone certo está selecionado e se o volume de entrada não está no mínimo.');
        }
        return;
      }
      if(now - this._t0 > VAD.startMs){
        if(lvl > VAD.threshold){ this._spoke = true; this._quietSince = 0; }
        else if(this._spoke){
          if(!this._quietSince) this._quietSince = now;
          else if(now - this._quietSince > VAD.silenceMs){
            this.emit('speechEnd');           // ← evento real fecha a escuta
            return;
          }
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
    return true;
  }
  _gravaAudio(){
    this.pedacos = []; this.gravador = null;
    if (!window.MediaRecorder || !this.stream) return;
    try{
      const g = new MediaRecorder(this.stream);
      g.ondataavailable = e => { if (e.data && e.data.size) this.pedacos.push(e.data); };
      g.start();
      this.gravador = g;
    }catch(e){ /* sem gravador: sobra o reconhecimento do navegador, se houver */ }
  }
  /* O áudio da última escuta. ASSÍNCRONO de propósito: o MediaRecorder entrega
     o último pedaço DEPOIS do stop(), num evento. Ler os pedaços na hora — que
     é o que eu fazia — devolvia vazio ou cortado, e o sintoma era "não gravou
     nada" com o microfone funcionando perfeitamente.

     Devolve null quando não há nada, e quem chama trata isso como "não deu",
     não como silêncio. */
  async audioGravado(){
    if (this._flush) await this._flush;
    if (!this.pedacos || !this.pedacos.length) return null;
    return new Blob(this.pedacos, { type: this.pedacos[0].type || 'audio/webm' });
  }
  _startSTT(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    /* Guardado, e não ignorado. Sem reconhecimento o transcript fica vazio, e o
       caminho antigo era voltar pra idle CALADO — indistinguível de "o JARVIS
       me ignorou". Isso é o normal no aplicativo de desktop: o reconhecimento
       do Chrome depende de um serviço do Google que não vem no Electron. */
    this.sttDisponivel = !!SR;
    if(!SR) return;
    try{
      const r = new SR();
      r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true;
      r.onresult = ev =>{
        let txt = '', done = false;
        for(let i = ev.resultIndex; i < ev.results.length; i++){
          txt += ev.results[i][0].transcript;
          if(ev.results[i].isFinal) done = true;
        }
        this.emit('transcript', txt.trim(), done);
      };
      r.onerror = ()=>{};
      r.start(); this.rec = r;
    }catch(e){ this.sttDisponivel = false; /* a escuta segue só com o nível de áudio */ }
  }
  stopListening(){
    this._live = false;
    this.emit('audio', 0);
    /* Para o gravador ANTES de soltar as faixas do microfone: parar a faixa
       primeiro deixa o último pedaço sem chegar, e a gravação perde o fim da
       frase — justo a parte que costuma carregar o verbo. */
    if(this.gravador){
      const g = this.gravador;
      this.gravador = null;
      /* Promessa resolvida no `onstop`: é o único ponto em que dá pra afirmar
         que todos os pedaços chegaram. O teto de 3s evita travar pra sempre se
         o evento não vier. */
      this._flush = new Promise(ok => {
        let feito = false;
        const pronto = () => { if (!feito){ feito = true; ok(); } };
        try{
          if (g.state === 'inactive') return pronto();
          g.onstop = pronto;
          g.stop();
          setTimeout(pronto, 3000);
        }catch(e){ pronto(); }
      });
    }
    if(this.rec){ try{ this.rec.stop(); }catch(e){} this.rec = null; }
    if(this.stream){ this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if(this.ctx){ this.ctx.close().catch(()=>{}); this.ctx = null; }
  }

  /* ---------- PIPELINE REAL ---------- */
  async submit(text, opts={}){
    if(!API.base){
      this.emit('error','Backend não configurado. Abra Configurações → Backend e aponte a URL do VTz OS.');
      return;
    }
    this.abort = new AbortController();
    const body = {
      messages:[{role:'user', content:text}],
      stream:true
    };
    if(API.model) body.model = API.model;
    if(API.route) body.route = API.route;             // roteamento automático (RouteLLM)
    if(API.agentId) body.agent_id = API.agentId;     // habilita ações de PC via Agente Local

    try{
      const r = await fetch(API.base + '/api/agent', {
        method:'POST', headers: API.headers(), body: JSON.stringify(body),
        signal: this.abort.signal
      });
      if(!r.ok){
        this.emit('error', `Backend respondeu ${r.status}. ${r.status===401?'Token inválido.':''}`);
        return;
      }
      await this._consume(r, text, opts);
    }catch(e){
      if(e.name !== 'AbortError') this.emit('error','Falha ao falar com o backend: ' + e.message);
    }
  }

  /* Lê o stream do backend e traduz os eventos DELE nos eventos da UI.
     Cada `step`, `file` e `token` abaixo veio do servidor — nada é inventado. */
  async _consume(res, query, opts){
    const reader = res.body?.getReader();
    if(!reader){                                     // resposta não-stream: usa como veio
      const j = await res.json().catch(()=>null);
      this.emit('result', {query, answer:(j?.content ?? j?.answer ?? ''), files:[]});
      return;
    }
    const dec = new TextDecoder();
    let bufr = '', answer = '', stepsAnnounced = false, finished = false;
    const files = [];

    const handle = ev =>{
      switch(ev.type){
        case 'plan':                                  // orquestrador anunciou as etapas
          if(Array.isArray(ev.steps) && ev.steps.length && opts.withSteps !== false){
            stepsAnnounced = true;
            this.emit('stepsBegin', ev.steps.map(s => s.label ?? String(s)));
          }
          break;
        case 'step':
          this.emit('step', {index:ev.index, label:ev.label, status:ev.status || 'active'});
          break;
        case 'tool':                                  // ferramenta em execução vira etapa viva
          if(!stepsAnnounced) this.emit('step', {index:ev.index ?? 0, label:ev.label || ev.name, status:'active'});
          break;
        case 'file_begin':
          files.push(ev.id);
          this.emit('fileBegin', {id:ev.id, name:ev.name, ext:ev.ext, size:ev.size,
                                  status:ev.status || 'Iniciando…', progress:ev.progress ?? 0});
          break;
        case 'file_progress':
          this.emit('fileProgress', {id:ev.id, progress:ev.progress, status:ev.status, path:ev.path});
          break;
        case 'token':
        case 'delta':
          answer += ev.text ?? ev.content ?? '';
          this.emit('token', ev.text ?? ev.content ?? '');
          break;
        case 'route':                                 // RouteLLM decidiu (ou não deu)
          this.emit('route', ev);
          break;
        case 'usage':
          this.emit('usage', ev);                     // tokens/custo reais
          break;
        case 'error':
          this.emit('error', ev.message || 'Erro no backend.');
          break;
        case 'done':
          finished = true;
          this.emit('result', {query, answer: ev.answer ?? answer, files, steps: ev.steps, meta: ev.meta});
          break;
      }
    };

    while(true){
      const {value, done} = await reader.read();
      if(done) break;
      bufr += dec.decode(value, {stream:true});
      const lines = bufr.split('\n');
      bufr = lines.pop();
      for(const line of lines){
        const s = line.trim();
        if(!s) continue;
        const payload = s.startsWith('data:') ? s.slice(5).trim() : s;   // aceita SSE e NDJSON
        if(!payload || payload === '[DONE]') continue;
        try{ handle(JSON.parse(payload)); }
        catch(e){ answer += payload; this.emit('token', payload); }      // stream de texto puro
      }
    }
    // fim do stream sem 'done' explícito: entrega o que o servidor mandou.
    // Se o 'done' já veio, NÃO reemite — senão sobrescreveria os passos que ele trouxe.
    if(!finished && (answer || files.length)) this.emit('result', {query, answer, files});
  }

  cancel(){
    if(this.abort){ this.abort.abort(); this.abort = null; }
    this.stopListening();
  }
}
const driver = new BackendDriver();


/* ================================================================
   WIRING DO OVERLAY — no painel o JARVIS é uma cena em cima do app,
   não uma página separada. Abre pelo item J.A.R.V.I.S. da barra
   lateral; ESC ou "Voltar ao painel" fecha.
   ================================================================ */
const jarvisState = { agentId: null, aberto: false, montado: false };
let jEngine = null, jWave = null, jCards = {}, jQuery = '', jActiveReq = null;

const jq  = s => document.querySelector(s);
const jqq = s => [...document.querySelectorAll(s)];

const POSE = {
  idle:       {r:.35, v:.10, s:.05, offX:0,    scale:0.90, alpha:0   },
  listening:  {r:1,   v:0,   s:0,   offX:0,    scale:0.78, alpha:1   },
  thinking:   {r:0,   v:1,   s:0,   offX:0,    scale:0.74, alpha:1   },
  delivering: {r:0,   v:0,   s:1,   offX:0.80, scale:0.66, alpha:1   },
  /* Mesma pose de repouso do idle: no erro a cena para, quem fala é a legenda. */
  erro:       {r:.35, v:.10, s:.05, offX:0,    scale:0.90, alpha:0   }
};
const CAPTION = {
  listening: {text:'Ouvindo…',            sub:'escutando'},
  thinking:  {text:'Processando pedido…', sub:'pensando'},
};

const VU_N = 22;

/* Só liga os motores WebGL quando o overlay abre pela primeira vez: abrir
   dois contextos WebGL no boot do painel custa memória por nada. */
function jarvisMonta(){
  if (jarvisState.montado) return;
  jarvisState.montado = true;
  hydrateIcons(jq('#jarvis-overlay'));
  jEngine = new ParticleEngine(jq('#particle-canvas'));
  jWave   = new WaveField(jq('#wave-canvas'));

  jq('#j-vu').innerHTML = Array.from({length:VU_N}, ()=>'<i></i>').join('');
  const vuBars = jqq('#j-vu i');
  driver.on('audio', lvl => {
    if (jEngine) jEngine.setAudio(lvl);
    vuBars.forEach((b,i)=>{
      const d = Math.abs(i - (VU_N-1)/2) / ((VU_N-1)/2);
      const h = 4 + lvl * 24 * (1 - d*0.68) * (0.72 + Math.random()*0.5);
      b.style.height  = h.toFixed(1)+'px';
      b.style.opacity = (0.45 + lvl*0.55).toFixed(2);
    });
  });

  jfsm.on(next => {
    document.body.dataset.jstate = next;
    if (jEngine) jEngine.setTarget(POSE[next]);
    jq('#j-statechip').textContent = next.toUpperCase();
    const cap = CAPTION[next];
    if (cap){ jq('#j-cap-text').textContent = cap.text; jq('#j-cap-sub').textContent = cap.sub; }
    if (next !== 'listening') driver.stopListening();
    if (next === 'idle'){ jq('#j-deliver').innerHTML = ''; if (jEngine) jEngine.setAudio(0); }
  });

  jq('#j-back').onclick = fechaJarvis;
  jq('#j-mic').onclick  = ()=> startListening();
  jq('#j-stop').onclick = ()=>{
    if (jfsm.state === 'listening'){
      driver.stopListening();
      const q = (jQuery || '').trim();
      if (q) runThinking(q); else jfsm.go('idle');
    } else {
      driver.cancel(); jfsm.go('idle');
    }
  };
  jq('#j-go').onclick = ()=> runThinking(jq('#j-input').value.trim());
  /* Chip só PREENCHE o campo. Quem executa é você, no Executar ou no Enter. */
  jqq('#jarvis-overlay [data-jfill]').forEach(el => el.onclick = ()=>{
    const alvo = jq('#j-input');
    alvo.value = el.dataset.jfill; alvo.focus();
  });
  jq('#j-input').addEventListener('keydown', e=>{
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); runThinking(jq('#j-input').value.trim()); }
  });
}

async function abreJarvis(){
  jarvisMonta();
  jarvisState.aberto = true;
  document.body.dataset.jscene = 'jarvis';
  /* O estado precisa estar escrito no body ANTES de a cena aparecer: é o
     data-jstate que libera o painel idle (sem ele o CSS deixa .j-idle com
     pointer-events:none e nada é clicável). Não dá pra depender do jfsm.go
     abaixo, que não dispara quando já está em idle. */
  document.body.dataset.jstate = jfsm.state;
  jq('#jarvis-overlay').classList.add('open');
  jq('#jarvis-overlay').setAttribute('aria-hidden','false');
  jfsm.go('idle');
  /* Descobre o PC pareado: sem isso o backend não recebe agent_id e as ações
     de arquivo/execução ficam fora do alcance do JARVIS. */
  jarvisState.agentId = await jarvisDescobreAgente();
  const marca = jq('#j-agent');
  if (marca) marca.textContent = jarvisState.agentId ? 'PC conectado' : 'sem PC pareado';
}

function fechaJarvis(){
  limpaErroJarvis();
  jarvisState.aberto = false;
  document.body.dataset.jscene = 'painel';
  document.body.dataset.jstate = 'idle';
  jq('#jarvis-overlay').classList.remove('open');
  jq('#jarvis-overlay').setAttribute('aria-hidden','true');
  jfsm.go('idle');
  driver.cancel();
  jActiveReq = null;
}

/* Mesma descoberta que a aba de Voz usa — um só critério de "qual PC". */
async function jarvisDescobreAgente(){
  if (typeof vozDescobreAgente === 'function') return vozDescobreAgente();
  return null;
}

function startListening(text){
  limpaErroJarvis();
  jQuery = text || '';
  jfsm.go('listening');
  driver.startListening();   // quem fecha a escuta é o VAD (speechEnd), não um timer
}

driver.on('transcript', (txt)=>{
  if (!jarvisState.aberto) return;
  if (txt) jQuery = txt;
  jq('#j-cap-sub').textContent = txt ? txt.slice(-64) : 'escutando';
});

/* Manda o áudio gravado pro whisper DO SEU PC, pelo Agente Local.

   É o caminho que faz o JARVIS ouvir no aplicativo de desktop, onde o
   reconhecimento do navegador simplesmente não existe. O áudio não fica no
   servidor: passa por ele, vai pro seu PC, e o arquivo temporário é apagado lá
   assim que o texto volta. */
async function transcreveNoPc(blob){
  const agente = API.agentId || await jarvisDescobreAgente();
  if (!backendUrl() || !agente) return null;
  try{
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 8192){
      bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
    }
    const fmt = (blob.type.split('/')[1] || 'webm').split(';')[0];
    const r = await fetch(backendUrl() + '/api/voice/' + encodeURIComponent(agente) + '/transcribe', {
      method:'POST', headers: backendHeaders({ 'Content-Type':'application/json' }),
      body: JSON.stringify({ audio_base64: btoa(bin), format: fmt }),
    });
    const j = await r.json().catch(() => ({}));
    if (j && j.ok === false) return { erro: j.data?.reason || j.data?.hint || j.detail || 'o PC recusou' };
    return { texto: (j.data?.text || j.text || '').trim() };
  }catch(e){ return { erro: e.message }; }
}

driver.on('speechEnd', async ()=>{
  if (jfsm.state !== 'listening') return;
  driver.stopListening();
  let q = (jQuery || '').trim();

  /* Sem texto do navegador, tenta o whisper do PC antes de desistir. A legenda
     muda porque transcrever leva alguns segundos e uma tela parada aqui parece
     travamento — o mesmo defeito que a gente já corrigiu na escuta. */
  if (!q && !driver.sttDisponivel){
    const audio = await driver.audioGravado();
    if (audio && backendUrl()){
      jq('#j-cap-text').textContent = 'Transcrevendo no seu PC…';
      const r = await transcreveNoPc(audio);
      if (r && r.texto) q = r.texto;
      else if (r && r.erro){
        mostraErroJarvis('Não consegui transcrever no seu PC: ' + r.erro +
          '. Confira o modelo do whisper em Configurações › Voz — ou digite abaixo.');
        return;
      }
    }
  }

  if (!q){
    /* Voltar pra idle sem dizer nada era o pior desfecho: parecia que o JARVIS
       tinha ouvido e escolhido ignorar. Agora a cena diz QUAL dos dois casos
       aconteceu, porque a saída é diferente em cada um. */
    if (!driver.sttDisponivel){
      /* Três motivos diferentes, três saídas diferentes. Dizer sempre "nenhum PC
         respondeu" culparia o PC até quando o problema é não haver áudio. */
      const semAudio = !(await driver.audioGravado());
      const motivo = !backendUrl()
        ? 'o Backend VTz OS não está configurado — é por ele que o áudio chega no whisper do seu PC.'
        : semAudio
          ? 'não consegui gravar o áudio neste navegador.'
          : 'nenhum PC pareado respondeu — abra o Agente Local.';
      mostraErroJarvis('Ouvi você, mas não tenho como transcrever: o reconhecimento do ' +
        'navegador não existe aqui, e ' + motivo + ' Digite o pedido abaixo.');
    } else {
      mostraErroJarvis('Não entendi o que você disse. Fale um pouco mais alto, ou digite abaixo.');
    }
    return;
  }
  runThinking(q);
});

/* Mostrar o erro é mais delicado do que parece: a legenda (.j-caption) só é
   visível em listening/thinking, e todo caminho de erro termina em idle. Escrever
   nela e ir pra idle apagava a mensagem da tela — a cena fechava a escuta e ficava
   muda, parecendo que o JARVIS simplesmente ignorou o pedido.

   Então: marca data-jerro no body (o CSS mantém a legenda de pé enquanto durar) E
   manda um toast, que vive fora da cena e aparece de qualquer jeito. */
/* O texto entra ANTES da transição de propósito: CAPTION não tem entrada pra
   `erro`, então o listener da FSM não reescreve a legenda e a mensagem
   sobrevive. O toast é reforço — vive fora da cena e aparece de qualquer jeito. */
function mostraErroJarvis(msg){
  jq('#j-cap-text').textContent = msg;
  jq('#j-cap-sub').textContent  = 'erro';
  jfsm.go('erro');
  try{ toast(msg, 'err'); }catch(e){ /* toast é reforço, não pode derrubar o erro */ }
}
function limpaErroJarvis(){
  if (jfsm.state === 'erro') jfsm.go('idle');
}

/* Um só dono do erro: qualquer 'error' do driver cai na legenda do JARVIS
   enquanto ele estiver aberto. Sem isso, erro de microfone ficava sem dono. */
driver.on('error', msg =>{
  if (!jarvisState.aberto) return;
  if (jActiveReq){ jActiveReq(msg); return; }
  mostraErroJarvis(msg);
});

function resetPipe(){
  ['stepsBegin','step','fileBegin','fileProgress','result','token','route']
    .forEach(e => driver.h[e] = []);
}

function runThinking(text){
  const q = (text || jQuery || jq('#j-input').value.trim() || '').trim();
  if (!q) return;                        // sem pedido real, nada roda
  limpaErroJarvis();
  jQuery = q;
  driver.stopListening();
  jfsm.go('thinking');
  jCards = {};
  const byId = {};                       // indexado por id — nunca duplica
  resetPipe();

  // no JARVIS não existe stepper (regra do brief) — a etapa vira legenda
  driver.on('step', s => {
    if (s.status === 'active') jq('#j-cap-text').textContent = s.label + '…';
  });
  driver.on('fileBegin',    d => byId[d.id] = Object.assign({}, d));
  driver.on('fileProgress', d => { if (byId[d.id]) Object.assign(byId[d.id], d); });
  driver.on('result',       r => { jActiveReq = null; deliver(r, Object.values(byId)); });
  jActiveReq = msg => mostraErroJarvis(msg);
  driver.submit(q);
}

/* ---------- O JARVIS FALA A RESPOSTA ----------

   Faltava isto, e é o que separava "um chat com uma esfera bonita" de um
   assistente de voz: a cena escutava, pensava, executava e ENTREGAVA POR
   ESCRITO. Quem falou com ele tinha que ler a resposta na tela.

   ORDEM DE TENTATIVA, e o porquê de cada degrau:
     1. o TTS do seu PC (Chatterbox clona a sua voz; Kokoro é mais leve) — é a
        voz que você configurou, e é a única que soa como JARVIS
     2. a voz do navegador — robótica, mas existe em qualquer máquina e nunca
        depende de você ter instalado nada

   Falhar em falar NUNCA pode derrubar a entrega: a resposta na tela já está lá,
   e ficar mudo é pior que ficar sem áudio bonito. Por isso todo o caminho está
   dentro de try/catch e o erro só vai pro console. */
function jarvisPodeFalar(){
  // respeita a mesma preferência da aba de Voz — um só interruptor pro app todo
  return state.voiceAutoSpeak !== false;
}

function falaPeloNavegador(texto){
  try{
    if (!window.speechSynthesis) return false;
    speechSynthesis.cancel();                 // não empilha falas antigas
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    if (state.voiceName){
      const v = speechSynthesis.getVoices().find(x => x.name === state.voiceName);
      if (v) u.voice = v;
    }
    speechSynthesis.speak(u);
    return true;
  }catch(e){ return false; }
}

async function falaJarvis(texto){
  const t = String(texto || '').trim();
  if (!t || !jarvisPodeFalar()) return;
  /* Corta pra não transformar uma resposta longa em três minutos de áudio —
     o texto inteiro continua na tela. */
  const dizer = t.length > 600 ? t.slice(0, 600) + '…' : t;

  const agente = API.agentId || (typeof vozState === 'object' && vozState?.agentId) || null;
  if (backendUrl() && agente){
    try{
      const r = await fetch(backendUrl() + '/api/voice/' + encodeURIComponent(agente) + '/speak', {
        method:'POST', headers: backendHeaders({ 'Content-Type':'application/json' }),
        body: JSON.stringify({ text: dizer }),
      });
      const j = await r.json().catch(() => ({}));
      if (j && j.audio_base64){
        const bin = atob(j.audio_base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([arr], { type: j.mime || 'audio/wav' }));
        const a = new Audio(url);
        a.onended = () => URL.revokeObjectURL(url);
        await a.play();
        return;
      }
      /* `delegate:'browser'` é o próprio agente dizendo "não tenho motor de pé,
         fala você" — não é erro, é o contrato. */
    }catch(e){ console.warn('[jarvis] TTS do PC falhou:', e && e.message); }
  }
  falaPeloNavegador(dizer);
}

function deliver(r, files){
  const jDeliver = jq('#j-deliver');
  jDeliver.innerHTML = `
    <div class="j-dl-head">${ico('check')}Entregue</div>
    <div class="j-dl-query">"${esc(r.query || '')}"</div>
    <div class="j-dl-answer">${esc(r.answer || '').replace(/\n/g, '<br>')}</div>
    ${(r.steps && r.steps.length) ? `<div class="j-dl-steps">${
        r.steps.map((s,i) => `<div class="j-dl-step"><b>${i+1}</b>${
          esc(typeof s === 'string' ? s : (s.label ?? ''))
        }</div>`).join('')
      }</div>` : ''}
    <div class="j-dl-files" id="j-dl-files"></div>
    <div class="j-dl-actions">
      <button class="fc-btn primary" id="j-again">${ico('refresh')}Nova tarefa</button>
      <button class="fc-btn" id="j-tochat">${ico('chat')}Ver no chat</button>
    </div>`;
  const mount = jq('#j-dl-files');
  files.forEach(f => { if (f.name) jCards[f.id] = new FileCard(mount, {...f, progress:100, status:'Concluído'}); });
  /* Sem await: a fala acontece POR CIMA da entrega já desenhada. Esperar o áudio
     pra só então mostrar o resultado deixaria a tela parada durante a síntese. */
  falaJarvis(r.answer);
  jfsm.go('delivering');
  /* Tarefa do JARVIS costuma ser longa e você sai da frente — aviso nativo do
     Windows quando ela termina. O processo principal só mostra se a janela não
     estiver em foco (ver setupNotificacoes no Electron). */
  if (window.jarvisDesktop?.notify){
    const arq = files.filter(f => f.name).map(f => f.name).join(', ');
    window.jarvisDesktop.notify('JARVIS: tarefa entregue',
      arq ? `Pronto: ${arq}` : String(r.answer || '').replace(/\s+/g, ' ').slice(0, 180));
  }
  jq('#j-again').onclick  = ()=> jfsm.go('idle');
  /* "Ver no chat": fecha o overlay e deixa o pedido no compositor do painel.
     Não reenvia sozinho — quem manda é você. */
  jq('#j-tochat').onclick = ()=>{
    const pedido = jQuery;
    fechaJarvis();
    const campo = document.getElementById('chat-input');
    if (campo){ campo.value = pedido; campo.focus(); campo.dispatchEvent(new Event('input')); }
  };
}

function setupJarvis(){
  const entrada = document.getElementById('jarvis-entry');
  if (entrada) entrada.onclick = abreJarvis;
  addEventListener('keydown', e=>{
    if (!jarvisState.aberto) return;
    if (e.target.matches('textarea,input,select')) return;
    if (e.code === 'Space'){
      e.preventDefault();
      jfsm.state === 'idle' ? startListening() : jfsm.go('idle');
    }
    if (e.key === 'Escape') fechaJarvis();
  });
}


window.setupJarvis = setupJarvis;
window.abreJarvis  = abreJarvis;
/* usado pelo consumo do wake word: o PC ouviu, o painel executa */
window.runThinkingJarvis = runThinking;
})();
