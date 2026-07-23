/* ===== Loop de correção visual (Passo 3 das skills de documento) =====
   gera → rasteriza em imagem (html2canvas) → reenvia pro modelo ativo como
   image_url pedindo crítica em JSON → corrige o texto-fonte → re-renderiza.
   Máx. 2 iterações pra nunca travar o usuário. Não é uma skill separada — é
   chamado de dentro do fluxo de download de cada skill visual (pdf/docx/pptx/
   dashboard-html), como pedido no Passo 3 da tarefa. */

const QA_MAX_ITERATIONS = 2;

function resolveActiveModel(conv){
  let m = (conv && conv.model) || state.model;
  if (m === '__router__' || !m) m = state.routerConfig.balanced || state.routerConfig.fast;
  return m || (state.models.find(x => !isImageModel(x))?.id) || '';
}

/* Container off-screen (fora da viewport, não afeta layout real) pra montar o
   mirror HTML e deixar o navegador desenhar antes de capturar. */
function makeOffscreenContainer(){
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed; left:-99999px; top:0; z-index:-1; pointer-events:none;';
  document.body.appendChild(div);
  return div;
}
function nextPaint(){ return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }

/* Rasteriza cada elemento que casa com `selector` dentro do html fornecido.
   Se `selector` não casar nada, rasteriza o container inteiro (1 imagem só). */
async function rasterizeMirrorToImages(html, selector){
  if (typeof html2canvas === 'undefined'){ throw new Error('html2canvas não carregou (offline?)'); }
  const container = makeOffscreenContainer();
  container.innerHTML = html;
  await nextPaint();
  try{
    const targets = selector ? Array.from(container.querySelectorAll(selector)) : [container];
    const nodes = targets.length ? targets : [container];
    const images = [];
    for (const node of nodes){
      const canvas = await html2canvas(node, { backgroundColor: null, scale: 1, useCORS: true, logging: false });
      images.push(canvas.toDataURL('image/png'));
    }
    return images;
  } finally {
    container.remove();
  }
}

/* Mirror de página A4 pra PDF/DOCX — reaproveita mdToBlocks. Paginação é uma
   aproximação por nº de blocos (não pixel-perfeita), suficiente pra achar
   overflow/contraste/hierarquia (ver seção 6 dos SKILL.md de pdf/docx). */
function mdToMirrorPagesHtml(md, opts = {}){
  const palette = pickDocPalette(opts.palette);
  const blocks = mdToBlocks(md);
  const BLOCKS_PER_PAGE = 12;
  const pages = [];
  for (let i = 0; i < blocks.length; i += BLOCKS_PER_PAGE) pages.push(blocks.slice(i, i + BLOCKS_PER_PAGE));
  // evita heading órfão: se a página terminou com um 'h' sem corpo depois dele
  // na mesma página, empurra o heading pro início da próxima (senão vira um
  // vão vazio embaixo, exatamente o tipo de defeito que o QA visual deve pegar).
  for (let i = 0; i < pages.length - 1; i++){
    const page = pages[i];
    // remove 'gap' pendurado no fim (é só espaço em branco, sem sentido logo
    // antes de uma quebra de página) e, se sobrar um heading no fim sem corpo
    // depois dele na mesma página, empurra pra próxima — senão vira um vão
    // vazio embaixo, exatamente o tipo de defeito que o QA visual deve pegar.
    while (page.length && page[page.length - 1].type === 'gap') page.pop();
    while (page.length && page[page.length - 1].type === 'h'){
      pages[i + 1].unshift(page.pop());
    }
  }
  let cleanPages = pages.filter(p => p.length);
  if (!cleanPages.length) cleanPages = [[]];
  const blockHtml = b => {
    if (b.type === 'h'){
      const sizes = { 1:30, 2:22, 3:18, 4:16 };
      return `<h${b.level} style="font-size:${sizes[b.level]||16}px; color:${b.level<=2?palette.primary:'#282832'}">${esc(b.text)}</h${b.level}>`;
    }
    if (b.type === 'p') return `<p>${esc(stripMd(b.text))}</p>`;
    if (b.type === 'li') return `<div class="mp-li">${b.ordered?'›':'•'} ${esc(stripMd(b.text))}</div>`;
    if (b.type === 'table'){
      const rows = b.rows.map((r,ri) => `<tr>${r.map(c => `<${ri===0?'th':'td'}>${esc(c)}</${ri===0?'th':'td'}>`).join('')}</tr>`).join('');
      return `<table class="mp-table">${rows}</table>`;
    }
    if (b.type === 'code') return `<pre class="mp-code">${esc(b.lines.join('\n'))}</pre>`;
    if (b.type === 'hr') return `<hr>`;
    return '';
  };
  const css = `
    .mp-page{ width:794px; min-height:1123px; background:#fff; padding:64px; box-sizing:border-box;
      font-family:Arial,sans-serif; color:#1E1E28; margin-bottom:24px; }
    .mp-page p{ font-size:14px; line-height:1.5; text-align:left; margin:6px 0; }
    .mp-li{ font-size:14px; margin:4px 0; }
    .mp-table{ width:100%; border-collapse:collapse; margin:12px 0; }
    .mp-table th{ background:${palette.primary}; color:#fff; padding:8px; font-size:12px; text-align:left; }
    .mp-table td{ padding:8px; font-size:12px; border-bottom:1px solid #e5e5ea; }
    .mp-code{ background:#f4f4f6; padding:12px; font-family:Consolas,monospace; font-size:12px; }
  `;
  const body = cleanPages.map((p,pi) => `<div class="mp-page" data-page="${pi+1}">${p.map(blockHtml).join('')}</div>`).join('\n');
  return `<style>${css}</style>${body}`;
}

/* ---------- Chamadas ao modelo (crítica + correção) ---------- */
const QA_CRITIQUE_SYSTEM = `Você inspeciona imagens de páginas/slides de um documento gerado e aponta SÓ defeitos visuais reais — não opine sobre o conteúdo textual em si. Procure especificamente: texto cortado ou saindo da caixa/página (overflow), elementos sobrepostos, contraste baixo entre texto e fundo, alinhamento quebrado (coisas desalinhadas que deveriam estar em grade/coluna), página ou slide vazio ou sem nenhum elemento visual (tabela/gráfico/card). Responda SOMENTE com um JSON válido no formato exato: {"ok": boolean, "defeitos": [{"pagina": number, "tipo": string, "descricao": string}]}. Se não achar nenhum defeito, responda {"ok": true, "defeitos": []}. Nunca escreva texto fora do JSON.`;

async function critiqueRenderedImages(images, kind, modelId, signal){
  const content = [
    { type:'text', text: `Inspecione estas ${images.length} imagem(ns) de um "${kind}" gerado pelo sistema VTz. Aponte defeitos visuais reais seguindo as regras do seu system prompt.` },
    ...images.map(url => ({ type:'image_url', image_url:{ url } })),
  ];
  const res = await orFetch({
    model: modelId,
    messages: [{ role:'system', content: QA_CRITIQUE_SYSTEM }, { role:'user', content }],
  }, { signal });
  if (!res.ok) throw new Error('QA visual: API ' + res.status);
  const data = await res.json();
  const raw = (data.choices?.[0]?.message?.content || '').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  try{
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return { ok: !!parsed.ok, defeitos: Array.isArray(parsed.defeitos) ? parsed.defeitos : [] };
  }catch(_){
    return { ok: true, defeitos: [] }; // resposta não-JSON: não trava o usuário, segue sem correção
  }
}

async function fixContentWithModel(content, defeitos, kind, modelId, signal){
  const listaDefeitos = defeitos.map(d => `- (página/slide ${d.pagina ?? '?'}) [${d.tipo}] ${d.descricao}`).join('\n');
  const sys = kind === 'dashboard'
    ? 'Você corrige HTML de um dashboard com base numa lista de defeitos visuais. Responda SOMENTE com o HTML completo corrigido, começando em <!doctype html>. Não corte nada além do necessário pra corrigir os defeitos apontados.'
    : 'Você corrige o markdown-fonte de um documento com base numa lista de defeitos visuais encontrados na versão renderizada. Responda SOMENTE com o markdown completo corrigido — mantenha todo o conteúdo e estrutura que não tem defeito.';
  const res = await orFetch({
    model: modelId,
    messages: [
      { role:'system', content: sys },
      { role:'user', content: `Defeitos encontrados:\n${listaDefeitos}\n\nConteúdo atual:\n\n${content}` },
    ],
  }, { signal });
  if (!res.ok) throw new Error('QA visual (correção): API ' + res.status);
  const data = await res.json();
  const fixed = (data.choices?.[0]?.message?.content || '').trim();
  return fixed || content; // se o modelo não devolver nada, mantém o conteúdo original
}

/* ---------- Orquestração genérica ---------- */
/* content: string (markdown, ou HTML no caso do dashboard).
   toMirrorHtml(content) -> { html, selector } pro rasterizador.
   Retorna { content, iterations, lastCritique }. */
async function runVisualQaLoop(kind, content, toMirrorHtml, opts = {}){
  const modelId = opts.modelId || resolveActiveModel(opts.conv);
  if (!modelId || !state.apiKey) return { content, iterations: 0, lastCritique: null, skipped: true };
  let current = content, lastCritique = null;
  for (let iter = 0; iter < QA_MAX_ITERATIONS; iter++){
    let images;
    try{
      const { html, selector } = toMirrorHtml(current);
      images = await rasterizeMirrorToImages(html, selector);
    }catch(e){
      return { content: current, iterations: iter, lastCritique, skipped: true, error: e.message };
    }
    let critique;
    try{
      critique = await critiqueRenderedImages(images, kind, modelId, opts.signal);
    }catch(e){
      return { content: current, iterations: iter, lastCritique, skipped: true, error: e.message };
    }
    lastCritique = critique;
    if (critique.ok || !critique.defeitos.length) break;
    try{
      current = await fixContentWithModel(current, critique.defeitos, kind, modelId, opts.signal);
    }catch(e){
      break; // não conseguiu corrigir: entrega a última versão válida em vez de travar
    }
  }
  return { content: current, iterations: QA_MAX_ITERATIONS, lastCritique };
}

/* ---------- Wrappers por formato (chamados pelo menu de mensagem) ---------- */
async function qaAndDownloadPdf(md, name, opts = {}){
  toast('Gerando PDF e revisando o layout…');
  const { content } = await runVisualQaLoop('pdf', md, m => ({ html: mdToMirrorPagesHtml(m, opts), selector: '.mp-page' }), opts);
  downloadRichPdf(content, name);
}
async function qaAndDownloadSlidesPdf(md, name, opts = {}){
  toast('Gerando slides e revisando o layout…');
  const { content } = await runVisualQaLoop('pdf-slides', md, m => ({ html: pptxSlidesToMirrorHtml(m, opts).html, selector: '.mirror-slide' }), opts);
  downloadSlidesPdf(content, name);
}
async function qaAndDownloadDocx(md, name, opts = {}){
  toast('Gerando Word e revisando o layout…');
  const { content } = await runVisualQaLoop('docx', md, m => ({ html: mdToMirrorPagesHtml(m, opts), selector: '.mp-page' }), opts);
  downloadDocx(content, name);
}
async function qaAndDownloadPptx(md, name, opts = {}){
  toast('Gerando PowerPoint e revisando os slides…');
  const { content } = await runVisualQaLoop('pptx', md, m => { const r = pptxSlidesToMirrorHtml(m, opts); return { html: r.html, selector: '.mirror-slide' }; }, opts);
  await downloadPptx(content, name, opts);
}
async function qaAndDownloadDashboard(spec, name, opts = {}){
  toast('Gerando dashboard e revisando o layout…');
  const initialHtml = generateDashboardHtml(spec, opts);
  const { content } = await runVisualQaLoop('dashboard', initialHtml, html => ({ html, selector: null }), opts);
  downloadTextFile(name, content);
  return content;
}
