/* Monta headers pra chamadas ao backend, incluindo o token de acesso quando configurado. */
function backendHeaders(extra){
  const h = Object.assign({}, extra || {});
  if (state.backendToken) h['X-Backend-Token'] = state.backendToken;
  return h;
}
/* Mesma coisa, mas também injeta a chave do Replicate (usada só na aba Vídeo). */
function videoHeaders(extra){
  const h = backendHeaders(extra);
  if (state.replicateKey) h['X-Replicate-Key'] = state.replicateKey;
  return h;
}
/* Foco de busca: direciona o modelo pra priorizar certas fontes (viés, não filtro rígido). */
const SEARCH_FOCUS = {
  reddit:   { label:'Reddit', hint:'priorize discussões e opiniões reais de usuários no Reddit (site:reddit.com)' },
  youtube:  { label:'YouTube', hint:'priorize vídeos, análises e tutoriais do YouTube (site:youtube.com)' },
  academic: { label:'Acadêmico', hint:'priorize fontes acadêmicas e científicas: papers, estudos, journals (scholar, pubmed, arxiv). Cite os estudos.' },
  news:     { label:'Notícias', hint:'priorize notícias recentes de veículos de imprensa confiáveis, com data' },
  shopping: { label:'Compras', hint:'priorize lojas e páginas de produto com preço atual; compare preços entre lojas' },
};
const BOOT_TS = Date.now();
if (localStorage.getItem('vtz_templates') === null){
  state.templates = [
    { id: uid(), name:'Relatório incubadora', content:'Estruture um relatório de atividades da incubadora para a empresa {{empresa}}, cobrindo o período {{período}}. Inclua: eventos mapeados, custos estimados e próximos passos. Formato: headers claros, objetivo, pronto pra .docx.' },
    { id: uid(), name:'Revisão de código VTZ OS', content:'Revise este código do VTZ OS focando em: bugs, performance e legibilidade. Aponte problemas com justificativa e entregue a versão corrigida completa:\n\n```\n{{código}}\n```' },
    { id: uid(), name:'Script FPS reversível', content:'Crie um script .bat de otimização de {{alvo}} para Windows 11, seguro para anti-cheat, com backup automático e um restaurar.bat que desfaz tudo.' },
  ];
  localStorage.setItem('vtz_templates', JSON.stringify(state.templates));
}

/* ---------- Helpers de conteúdo multimodal ---------- */
/* Extrai texto plano de content (string ou array de parts) */
function contentToText(content){
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter(p => p.type === 'text').map(p => p.text).join('\n');
  return '';
}
/* Converte um File em part da API OpenRouter. Suporte real:
   imagem (image_url), PDF (file), áudio (input_audio), texto (inline no prompt).
   Vídeo: só alguns modelos (Gemini) aceitam — enviado como file, pode falhar em outros. */
function fileToPart(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler ' + file.name));
    reader.onload = () => {
      const dataUrl = reader.result;
      if (file.type.startsWith('image/')){
        resolve({ type:'image_url', image_url:{ url: dataUrl } });
      } else if (file.type === 'application/pdf'){
        resolve({ type:'file', file:{ filename: file.name, file_data: dataUrl } });
      } else if (file.type.startsWith('audio/')){
        const fmt = file.type.includes('wav') ? 'wav' : 'mp3';
        resolve({ type:'input_audio', input_audio:{ data: dataUrl.split(',')[1], format: fmt } });
      } else if (file.type.startsWith('video/')){
        resolve({ type:'file', file:{ filename: file.name, file_data: dataUrl } });
      } else {
        // texto/código: inline como parte de texto
        const txtReader = new FileReader();
        txtReader.onload = () => resolve({ type:'text', text:`[Arquivo: ${file.name}]\n${txtReader.result}` });
        txtReader.onerror = () => reject(new Error('Falha ao ler ' + file.name));
        txtReader.readAsText(file);
        return;
      }
    };
    reader.readAsDataURL(file);
  });
}
/* Remove campos internos (_router, _feedback, _att) antes de mandar pra API */
function sanitizeForApi(messages){
  return messages.filter(m => !m._local).map(m => {
    const { _router, _feedback, _att, _compare, _local, ts, ...rest } = m;
    return rest;
  });
}
