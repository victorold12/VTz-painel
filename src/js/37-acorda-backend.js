/* ============================================================
   MANTER O SERVIDOR ACORDADO

   O problema é do plano grátis, não do código: o Render derruba o container
   depois de ~15 minutos sem requisição, e a próxima chamada espera ele subir de
   novo. Do lado de cá isso aparece como meio minuto de tela parada na PRIMEIRA
   mensagem — e o pior é que parece defeito do app.

   Duas metades, e vale saber qual é qual:

     1. ESTA, de graça e sem depender de nada: com o painel aberto, cutuca
        /api/health de tempos em tempos. Cobre a sessão inteira — você não
        espera de novo no meio de uma conversa. E no boot o cutucão sai ANTES de
        você terminar de ler a tela, então o servidor costuma já estar de pé
        quando a primeira mensagem sai.

     2. A OUTRA, que este código não faz: um cutucador de fora (cron-job.org,
        UptimeRobot) pra o servidor nunca dormir, nem com tudo fechado. É o que
        cobre o primeiro acesso do dia. Fica no README do repo `servidor`,
        com a conta das horas do plano grátis — que é o motivo de isto aqui não
        tentar resolver sozinho.

   POR QUE NÃO CUTUCAR SEMPRE: o plano grátis dá 750 horas de instância por mês,
   e um serviço acordado 24/7 consome ~730. Uma aba esquecida aberta a noite
   inteira gastaria essa margem à toa. Por isso o ping para quando a aba fica
   escondida por muito tempo — quem não está olhando não precisa de servidor
   quente.

   E POR QUE NÃO EM localhost: backend na sua máquina não hiberna. Cutucar seria
   ruído no log e nada mais.
   ============================================================ */
const ACORDA_INTERVALO_MS = 10 * 60 * 1000;   // < 15min de ociosidade do Render
const ACORDA_LIMITE_MS = 8000;                // além disso, é hibernação, não lentidão
const ACORDA_ABANDONO_MS = 30 * 60 * 1000;    // aba escondida esse tanto: para de cutucar

let _acordaTimer = null;
let _acordaVisivelEm = Date.now();
let _acordaUltimo = null;   // { quando, ms, ok } — só pra tela de configuração

/* Só faz sentido pra servidor remoto. Um backend em localhost/127.0.0.1 é um
   processo na sua máquina: ele não dorme, e cutucar não muda nada. */
function backendHiberna(){
  const u = backendUrl();
  if (!u) return false;
  try{
    const h = new URL(u).hostname;
    return !(h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local'));
  }catch(e){ return false; }
}

async function cutucaBackend(motivo){
  if (!backendHiberna()) return null;
  const t0 = Date.now();
  try{
    /* Sem token de propósito: /api/health é a única rota aberta do backend, e é
       exatamente por isso que ela serve pra isto. Um cutucão não precisa de
       credencial, e assim o mesmo endereço serve pro cron de fora. */
    const ctrl = new AbortController();
    const corta = setTimeout(() => ctrl.abort(), 60000);
    const r = await fetch(backendUrl() + '/api/health', { signal: ctrl.signal, cache: 'no-store' })
      .finally(() => clearTimeout(corta));
    const ms = Date.now() - t0;
    _acordaUltimo = { quando: Date.now(), ms, ok: r.ok };
    /* Demorou muito no boot = estava hibernando. Vale um aviso, senão a pessoa
       acha que o app travou. Nos cutucões seguintes não avisa nada: a graça é
       ser invisível. */
    if (motivo === 'boot' && ms > ACORDA_LIMITE_MS){
      try{ toast(`Servidor estava hibernando — acordou em ${(ms / 1000).toFixed(0)}s. Já pode mandar.`, 'ok'); }catch(e){}
    }
    pintaAcorda();
    return ms;
  }catch(e){
    _acordaUltimo = { quando: Date.now(), ms: Date.now() - t0, ok: false };
    pintaAcorda();
    return null;   // sem rede, backend fora do ar: silêncio, o app funciona local
  }
}

function agendaCutucao(){
  clearTimeout(_acordaTimer);
  if (!backendHiberna()) return;
  _acordaTimer = setTimeout(() => {
    const escondidoHa = document.hidden ? Date.now() - _acordaVisivelEm : 0;
    if (escondidoHa < ACORDA_ABANDONO_MS) cutucaBackend('rotina');
    agendaCutucao();
  }, ACORDA_INTERVALO_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden){ _acordaVisivelEm = Date.now(); return; }
  _acordaVisivelEm = Date.now();
  /* Voltou pra aba depois de muito tempo: o servidor provavelmente dormiu.
     Cutuca agora, enquanto a pessoa ainda está lendo a tela, em vez de deixar a
     espera cair em cima da primeira mensagem. */
  const parado = _acordaUltimo ? Date.now() - _acordaUltimo.quando : Infinity;
  if (parado > ACORDA_INTERVALO_MS) cutucaBackend('volta');
  agendaCutucao();
});

function pintaAcorda(){
  const el = document.getElementById('acorda-estado');
  if (!el) return;
  if (!backendUrl()){ el.textContent = 'Sem backend configurado.'; el.className = 'hint'; return; }
  if (!backendHiberna()){
    el.textContent = 'Backend na sua própria máquina — esse não hiberna, nada a fazer aqui.';
    el.className = 'hint ok';
    return;
  }
  if (!_acordaUltimo){ el.textContent = 'Ainda não cutuquei desde que o painel abriu.'; el.className = 'hint'; return; }
  const h = new Date(_acordaUltimo.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (!_acordaUltimo.ok){
    el.textContent = `Não respondeu às ${h}. Fora do ar, sem rede, ou ainda subindo.`;
    el.className = 'hint erro';
    return;
  }
  const s = (_acordaUltimo.ms / 1000).toFixed(1);
  el.textContent = _acordaUltimo.ms > ACORDA_LIMITE_MS
    ? `Estava hibernando: respondeu em ${s}s às ${h}. Agora fica acordado enquanto o painel estiver aberto.`
    : `Acordado — respondeu em ${s}s às ${h}.`;
  el.className = 'hint ok';
}

function setupAcordaBackend(){
  pintaAcorda();
  /* Sem await: acordar o servidor não pode segurar a montagem da tela. O ganho
     é justamente a espera acontecer enquanto a pessoa ainda está lendo. */
  cutucaBackend('boot');
  agendaCutucao();
}
