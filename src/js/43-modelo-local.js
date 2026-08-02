/* ===========================================================================
   MODELO LOCAL — responder de graça, e mais rápido, quando a pergunta é simples

   O painel fala com o OpenRouter direto do navegador. Este arquivo acrescenta
   um segundo destino: um Ollama rodando na PRÓPRIA máquina. Pergunta simples
   ("oi", "que horas são", "obrigado") não precisa de modelo de fronteira — e
   nesta máquina o local responde em ~300ms contra ~2s da nuvem, então o ganho
   não é só de custo.

   ---------------------------------------------------------------------------
   POR QUE A CHAMADA NÃO SAI DAQUI DIRETO

   O Ollama tem lista de origens própria e responde 403 pra quem não está nela.
   Medido: `https://…pages.dev` -> 403, `Origin: null` -> 403. Ou seja, o painel
   publicado e o app Electron (que carrega por file://) seriam ambos recusados.

   A saída não é afrouxar o `OLLAMA_ORIGINS` do Victor — isso abriria a GPU dele
   pra qualquer site aberto no navegador. A saída é a ponte do Electron: o
   processo principal é Node, não tem origem, não tem CORS. Ver o bloco MODELO
   LOCAL em servidor/electron-shell/src/main.js.

   Quando a ponte não existe (painel aberto no navegador), ainda se tenta o
   `fetch` direto: servido de `http://localhost:*` o Ollama aceita, e nesse caso
   funciona sem o app. Fora daí, o local simplesmente não está disponível — e
   isso é estado NORMAL, não erro. A nuvem responde igual.

   ---------------------------------------------------------------------------
   SOBRE A DUPLICAÇÃO DA HEURÍSTICA

   `servidor/app/complexidade.py` tem a mesma pontuação, em Python. Não é
   descuido: a decisão precisa acontecer ONDE a chamada é feita, e as duas
   pontas fazem chamada — o backend pros agentes, o painel pro chat. Mandar o
   painel perguntar ao backend qual engine usar custaria uma ida ao Render
   ANTES de cada resposta local, que é o oposto do ponto.

   O preço dessa escolha é deriva entre as duas. O antídoto são os limiares e as
   marcas ficarem idênticos e testados dos dois lados — se mudar aqui, mude lá.
   =========================================================================== */

/* Espelham complexidade.py. Mesmos números dos dois lados, de propósito. */
const LOCAL_LIMIAR_SIMPLES = 3;   // <= isto: o local dá conta

const MARCAS_CODIGO_LOCAL = /```|\bdef \b|\bclass \b|=>|;\s*$|\bimport \b|<\/\w+>/m;
/* A alternância c/qu do português: "explicar" tem C, "explique" tem QU. Uma
   raiz `explic\w*` casaria com "explicação" e NÃO com "explique" — que é a
   forma imperativa, a mais provável numa pergunta ao assistente. Custou uma
   investigação no lado Python até os códigos de caractere mostrarem `e,x,p,l,i,q`
   onde se esperava um `c`. */
const MARCAS_RACIOCINIO_LOCAL = /\b(por que|porque|compar\w*|analis\w*|expli[cq]\w*|justifi[cq]\w*|verifi[cq]\w*|demonstr\w*|arquitetur\w*|refator\w*|otimiz\w*|debug|erros?|exceç\w*|traceback|passo a passo)\b/gi;
const MARCAS_SIMPLES_LOCAL = /^\s*(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad|valeu|tchau|ok|sim|não|nao)\b/i;

function pontuaLocal(texto){
  const t = String(texto || '').trim();
  if (!t) return 0;
  let p = 0;
  if (t.length > 2000) p += 4;
  else if (t.length > 600) p += 2;
  else if (t.length > 200) p += 1;
  if (MARCAS_CODIGO_LOCAL.test(t)) p += 3;
  /* Conta marcas DISTINTAS, não presença: "compare X e justifique, passo a
     passo" é raciocínio puro em 60 caracteres. */
  const achadas = new Set((t.match(MARCAS_RACIOCINIO_LOCAL) || []).map(s => s.toLowerCase()));
  p += Math.min(achadas.size * 2, 6);
  /* Saudação e confirmação nunca precisam de modelo forte. Por último, pra
     sobrepor o resto. */
  if (MARCAS_SIMPLES_LOCAL.test(t) && t.length < 80) return 0;
  return p;
}

/* Última mensagem do usuário é o que decide — o histórico já foi resolvido. */
function textoDoPayload(payload){
  const msgs = Array.isArray(payload?.messages) ? payload.messages : [];
  for (let i = msgs.length - 1; i >= 0; i--){
    if (msgs[i]?.role === 'user') return contentToText(msgs[i].content);
  }
  return '';
}

/* ---------------------------------------------------------------------------
   Detecção. Cacheada porque roda antes de CADA chamada e a resposta muda
   devagar (ligar/desligar o Ollama). 30s é curto o bastante pra perceber a
   mudança e longo o bastante pra não sondar a cada tecla. */
let _localCache = { quando: 0, valor: null };

async function modeloLocalEstado(forcar){
  const agora = Date.now();
  if (!forcar && _localCache.valor && agora - _localCache.quando < 30000) return _localCache.valor;

  let valor = { ok: false, via: null, motivo: 'sem modelo local nesta máquina' };
  try{
    if (window.jarvisDesktop?.local?.estado){
      const e = await window.jarvisDesktop.local.estado();
      valor = e?.ok ? { ok: true, via: 'ponte', modelo: e.modelo, cabeNaGpu: e.cabeNaGpu }
                    : { ok: false, via: 'ponte', motivo: e?.motivo || 'indisponível' };
    } else {
      /* Sem app: só funciona se o painel estiver em localhost (o Ollama aceita
         essa origem). Falha rápido pra não travar a resposta. */
      const r = await fetch('http://127.0.0.1:11434/api/tags',
        { signal: AbortSignal.timeout(1200) });
      const lista = r.ok ? ((await r.json())?.models || []) : [];
      valor = lista.length
        ? { ok: true, via: 'direto', modelo: lista[0].name }
        : { ok: false, via: 'direto', motivo: 'no ar, mas sem modelo baixado' };
    }
  }catch(e){
    valor = { ok: false, via: null, motivo: String(e?.message || e).slice(0, 80) };
  }
  _localCache = { quando: agora, valor };
  return valor;
}

/* ---------------------------------------------------------------------------
   Resposta do local no MESMO formato do OpenRouter.

   Devolve um `Response` de verdade pra quem chamou não precisar saber de nada:
   `res.ok`, `res.json()` e a leitura de `res.body` funcionam igual. Meia
   integração — um objeto "parecido" — obrigaria a mexer em todos os oito
   chamadores de orFetch, e é assim que se introduz regressão. */
function respostaJson(dados){
  return new Response(JSON.stringify(dados),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/* O chat principal pede streaming e lê `res.body` linha a linha. O local
   responde inteiro, então o SSE é sintetizado aqui.

   NÃO é streaming de mentira pra enganar o olho: é o formato que o chamador
   espera, com o conteúdo que existe. Em resposta de ~300ms não há diferença
   perceptível, e abrir um segundo caminho (streaming por evento de IPC)
   dobraria a superfície pra ganhar nada. */
function respostaSSE(dados){
  const msg = dados?.choices?.[0]?.message || {};
  const eventos = [
    { choices: [{ delta: { role: 'assistant', content: msg.content || '' }, index: 0 }] },
    { choices: [{ delta: {}, index: 0, finish_reason: dados?.choices?.[0]?.finish_reason || 'stop' }],
      usage: dados?.usage },
  ];
  const corpo = eventos.map(e => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(corpo, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

async function chamaLocal(payload, estado){
  const pedido = {
    model: estado.modelo,
    messages: payload.messages,
    max_tokens: payload.max_tokens,
  };
  let dados;
  if (estado.via === 'ponte'){
    const r = await window.jarvisDesktop.local.chat(pedido);
    if (!r?.ok) throw new Error(r?.erro || 'o modelo local falhou');
    dados = r.dados;
  } else {
    const r = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido),
      signal: AbortSignal.timeout(180000),
    });
    if (!r.ok) throw new Error(`o modelo local respondeu ${r.status}`);
    dados = await r.json();
  }
  /* Marca de onde veio. Sem isto o painel diria que um modelo da nuvem
     respondeu — e trocar de modelo sem avisar é enganoso, ainda mais quando o
     local erra mais. */
  dados._provider = 'ollama';
  dados.model = `local:${estado.modelo}`;
  return payload.stream ? respostaSSE(dados) : respostaJson(dados);
}

/* ---------------------------------------------------------------------------
   O ponto de entrada usado pelo orFetch.

   Devolve `null` quando a resposta deve ir pra nuvem — e é `null` em todo caso
   de dúvida. A assimetria manda: errar pra cima (nuvem sem precisar) custa meio
   centavo; errar pra baixo (local numa pergunta difícil) custa uma resposta
   ruim e provavelmente uma segunda tentativa, que sai mais caro que a economia.

   Se o local FALHAR no meio, também devolve null: a nuvem atende e o usuário
   nem fica sabendo. Cair pra nuvem é o comportamento correto, não é remendo. */
async function talvezLocal(payload){
  try{
    if (localStorage.getItem('vtz_local_desligado') === '1') return null;
    if (payload?.tools?.length) return null;      // escolher ferramenta é onde 3B mais erra
    if (payload?.plugins?.length) return null;    // extensão do OpenRouter; o local não tem
    if (isImageModel({ id: payload?.model || '' })) return null;

    const texto = textoDoPayload(payload);
    if (!texto) return null;
    if (pontuaLocal(texto) > LOCAL_LIMIAR_SIMPLES) return null;

    const estado = await modeloLocalEstado();
    if (!estado.ok) return null;

    const res = await chamaLocal(payload, estado);
    /* Contabiliza a chamada com custo ZERO — não é ausência de dado, é gasto
       nulo, e o painel precisa distinguir os dois pra o gráfico de economia
       fazer sentido. */
    try{
      registraChamadaLocal({
        model: `local:${estado.modelo}`, tokens_in: 0, tokens_out: 0,
        custo_usd: 0, origem: 'chat-local',
      });
    }catch(e){ /* medir nunca quebra o medido */ }
    return res;
  }catch(e){
    /* Local falhou: a nuvem assume. Silencioso de propósito — o usuário pediu
       uma resposta, não um relatório de infraestrutura. */
    return null;
  }
}
