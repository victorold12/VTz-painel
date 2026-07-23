/* ===== Geradores de PPTX e dashboard-html (client-side) =====
   Companheiros de src/js/06-pdf-renderer.js: mesma filosofia (markdown/spec vira
   arquivo real, sem backend, sem link falso), reaproveitando mdToBlocks/slideChunks
   já existentes. Design tokens vêm de 26-doc-design-tokens.js. Ver skills/pptx/SKILL.md
   e skills/dashboard-html/SKILL.md pras regras completas que guiam o conteúdo. */

/* ---------- Helpers de cor/unidade ---------- */
function hexNoHash(hex){ return String(hex || '').replace('#', '').toUpperCase(); }
function hexToRgbArr(hex){
  const h = hexNoHash(hex);
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
/* PptxGenJS trabalha em polegadas — nunca passe px/pt direto (gotcha #1 do SKILL.md). */
function pxToIn(px){ return px / 96; }
function ptToIn(pt){ return pt / 72; }

/* ---------- PPTX ---------- */
function getPptxGen(){ return window.PptxGenJS || null; }

/* Mesma convenção de quebra de slide usada em downloadSlidesPdf: '# '/'## ' ou '---'. */
function pptxSlideChunks(md){ return slideChunks(md); }

function pptxShapeType(pptx, name){
  return (pptx.ShapeType && pptx.ShapeType[name]) || name;
}

function downloadPptx(md, name, opts = {}){
  const Gen = getPptxGen();
  if (!Gen){ toast('Biblioteca de PowerPoint não carregou (offline?).', 'err'); return Promise.reject(new Error('PptxGenJS ausente')); }
  const palette = pickDocPalette(opts.palette);
  const primary = hexNoHash(palette.primary), secondary = hexNoHash(palette.secondary), accent = hexNoHash(palette.accent);
  const bgLight = hexNoHash(palette.bgLight);

  const pptx = new Gen();
  pptx.layout = 'LAYOUT_16x9'; // 10in x 5.63in — precisa ser setado ANTES de addSlide (gotcha #4)
  const SW = 10, SH = 5.63, M = ptToIn(DOC_SPACING.slideMarginPt); // margem = mesmo valor dos slides em PDF

  const slides = pptxSlideChunks(md);
  slides.forEach((s, si) => {
    const slide = pptx.addSlide();
    slide.background = { color: bgLight };

    // barra de título — mesma altura em todos os slides, carrega o texto (não é decorativa)
    const titleBarH = 1.05;
    slide.addShape(pptxShapeType(pptx, 'rect'), { x:0, y:0, w:SW, h:titleBarH, fill:{ color: primary }, line:{ type:'none' } });
    slide.addText(stripMd(s.title || `Slide ${si+1}`), {
      x: M, y:0, w: SW - M*2, h: titleBarH, fontFace:'Arial', fontSize:26, bold:true,
      color:'FFFFFF', valign:'middle', fit:'shrink', // fit:'shrink' evita overflow de título longo (gotcha #2)
    });

    let y = titleBarH + ptToIn(DOC_SPACING.blockGapPt);
    const bodyW = SW - M*2;
    let hasVisual = false;

    s.body.forEach(b => {
      if (y > SH - M) return; // slide deve ser conciso; excedente não estoura (mesma regra do PDF)
      if (b.type === 'table'){
        hasVisual = true;
        const cols = Math.max(...b.rows.map(r => r.length));
        const rows = b.rows.map((r, ri) => Array.from({ length: cols }).map((_, c) => ({
          text: r[c] || '',
          options: ri === 0
            ? { bold:true, color:'FFFFFF', fill:{ color: primary }, fontSize:12 }
            : { fill:{ color: ri % 2 === 0 ? bgLight : 'FFFFFF' }, fontSize:11, color:'333333' },
        })));
        const rowH = Math.min(0.4, (SH - M - y) / rows.length);
        slide.addTable(rows, { x:M, y, w:bodyW, h: rowH*rows.length, fontFace:'Arial', border:{ type:'solid', color:'DDDDDD', pt:0.5 } });
        y += rowH*rows.length + ptToIn(DOC_SPACING.blockGapPt);
        return;
      }
      if (b.type === 'code'){
        const h = Math.min(1.6, 0.25 + b.lines.length * 0.22);
        slide.addShape(pptxShapeType(pptx, 'rect'), { x:M, y, w:bodyW, h, fill:{ color:'F2F2F6' }, line:{ type:'none' } });
        slide.addText(b.lines.slice(0, 8).join('\n'), { x:M+0.1, y:y+0.05, w:bodyW-0.2, h:h-0.1, fontFace:'Consolas', fontSize:11, color:'3C3C46', valign:'top' });
        y += h + ptToIn(DOC_SPACING.blockGapPt);
        return;
      }
      const isH = b.type === 'h', isLi = b.type === 'li';
      const text = isLi ? '•  ' + stripMd(b.text || '') : stripMd(b.text || '');
      const h = isH ? 0.45 : 0.38;
      slide.addText(text, {
        x:M, y, w:bodyW, h, fontFace:'Arial',
        fontSize: isH ? 18 : 14, bold: isH, color: isH ? secondary : '2A2A32',
        align:'left', valign:'top',
      });
      y += h;
    });

    // regra do elemento visual obrigatório: se o slide só tem texto corrido (sem
    // tabela/lista), garante pelo menos 1 elemento visual — aqui, um card de
    // destaque com o próprio título repetido em ênfase (não é faixa decorativa
    // vazia: carrega conteúdo, é o "pull quote" do slide).
    if (!hasVisual && s.body.some(b => b.type === 'p')){
      const cardY = Math.max(y, SH - 1.5);
      slide.addShape(pptxShapeType(pptx, 'rect'), { x:M, y:cardY, w:bodyW, h:0.9, fill:{ color: bgLight }, line:{ color: accent, width:1.5 } });
      slide.addText(stripMd(s.title || ''), { x:M+0.2, y:cardY, w:bodyW-0.4, h:0.9, fontFace:'Arial', fontSize:15, bold:true, color: primary, valign:'middle', italic:true });
    }

    // rodapé — numeração + marca (linha fina em acento, com função: separa rodapé do corpo)
    slide.addShape(pptxShapeType(pptx, 'line'), { x:M, y:SH-0.42, w:bodyW, h:0, line:{ color: accent, width:0.75 } });
    slide.addText('VTz LLM', { x:M, y:SH-0.38, w:3, h:0.3, fontFace:'Arial', fontSize:9, color:'8A8894' });
    slide.addText(`${si+1} / ${slides.length}`, { x:SW-M-1.2, y:SH-0.38, w:1.2, h:0.3, fontFace:'Arial', fontSize:9, color:'8A8894', align:'right' });
  });

  return pptx.write('blob').then(blob => { triggerDownload(name, blob); return blob; })
    .catch(e => { toast('Falha ao gerar PowerPoint: ' + e.message, 'err'); throw e; });
}

/* Estrutura intermediária: os MESMOS slides (título + blocos) usados por downloadPptx,
   pra alimentar tanto o pptx real quanto o mirror HTML do QA visual — garante que o
   que é rasterizado é fiel ao que o arquivo contém. */
function pptxSlidesToMirrorHtml(md, opts = {}){
  const palette = pickDocPalette(opts.palette);
  const slides = pptxSlideChunks(md);
  const slideHtml = (s, si) => {
    const bodyHtml = s.body.map(b => {
      if (b.type === 'table'){
        const rows = b.rows.map((r, ri) => `<tr>${r.map(c => `<${ri===0?'th':'td'}>${esc(c)}</${ri===0?'th':'td'}>`).join('')}</tr>`).join('');
        return `<table class="mirror-table">${rows}</table>`;
      }
      if (b.type === 'code') return `<pre class="mirror-code">${esc(b.lines.slice(0,8).join('\n'))}</pre>`;
      if (b.type === 'h') return `<h3 style="color:${palette.secondary}">${esc(stripMd(b.text))}</h3>`;
      if (b.type === 'li') return `<div class="mirror-li">• ${esc(stripMd(b.text))}</div>`;
      return `<p>${esc(stripMd(b.text))}</p>`;
    }).join('');
    return `<section class="mirror-slide" data-slide="${si+1}">
      <div class="mirror-titlebar" style="background:${palette.primary}">${esc(stripMd(s.title || 'Slide ' + (si+1)))}</div>
      <div class="mirror-body">${bodyHtml}</div>
      <div class="mirror-footer">VTz LLM<span>${si+1} / ${slides.length}</span></div>
    </section>`;
  };
  const css = `
    .mirror-slide{ width:1280px; height:720px; background:${palette.bgLight}; position:relative;
      font-family:Arial,sans-serif; box-sizing:border-box; overflow:hidden; margin-bottom:24px; }
    .mirror-titlebar{ height:140px; color:#fff; font-size:34px; font-weight:700; display:flex;
      align-items:center; padding:0 56px; box-sizing:border-box; }
    .mirror-body{ padding:24px 56px; }
    .mirror-body h3{ font-size:20px; margin:8px 0; }
    .mirror-body p{ font-size:16px; color:#2a2a32; line-height:1.5; text-align:left; margin:8px 0; }
    .mirror-li{ font-size:16px; color:#2a2a32; margin:6px 0; }
    .mirror-table{ width:100%; border-collapse:collapse; margin:12px 0; }
    .mirror-table th{ background:${palette.primary}; color:#fff; padding:8px 10px; font-size:13px; text-align:left; }
    .mirror-table td{ padding:8px 10px; font-size:13px; border-bottom:1px solid #e5e5ea; }
    .mirror-code{ background:#f2f2f6; padding:12px; font-family:Consolas,monospace; font-size:13px; border-radius:4px; }
    .mirror-footer{ position:absolute; bottom:20px; left:56px; right:56px; display:flex;
      justify-content:space-between; font-size:12px; color:#8a8894; border-top:2px solid ${palette.accent}; padding-top:8px; }
  `;
  const body = slides.map(slideHtml).join('\n');
  return { html: `<style>${css}</style>${body}`, count: slides.length };
}

/* ---------- Dashboard HTML ---------- */

/* Extrai tabelas markdown e monta uma spec de dashboard: tabela 2 colunas com 2ª
   coluna numérica vira gráfico de barra; tabela "métrica/valor" curta vira KPIs. */
function buildDashboardSpecFromMarkdown(md, title){
  const tables = extractMarkdownTables(md);
  const kpis = [], charts = [];
  tables.forEach((rows, ti) => {
    const [header, ...body] = rows;
    if (!body.length) return;
    const numericCol = body.every(r => /^-?[\d.,%$R$\s]+$/.test((r[1]||'').trim()));
    if (numericCol && body.length <= 4){
      body.forEach(r => kpis.push({ label: r[0], value: r[1] }));
    } else if (numericCol){
      charts.push({
        type: 'bar', title: header[1] || `Tabela ${ti+1}`,
        data: body.map(r => ({ label: r[0], value: parseFloat(String(r[1]).replace(/[^\d.\-]/g,'')) || 0 })),
      });
    } else {
      charts.push({ type:'table', title: header.join(' / '), rows });
    }
  });
  return { title: title || 'Dashboard', kpis, charts, tables: [] };
}

function svgBarChart(data, palette, w = 520, h = 260){
  const max = Math.max(...data.map(d => d.value), 1);
  const padL = 40, padB = 36, padT = 12, padR = 12;
  const chartW = w - padL - padR, chartH = h - padT - padB;
  const bw = chartW / data.length * 0.6, gap = chartW / data.length;
  const bars = data.map((d, i) => {
    const bh = (d.value / max) * chartH;
    const x = padL + i*gap + (gap - bw)/2;
    const y = padT + chartH - bh;
    const label = String(d.label).length > 12 ? String(d.label).slice(0,11) + '…' : d.label;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${palette.primary}" rx="3"/>
      <text x="${(x+bw/2).toFixed(1)}" y="${(padT+chartH+16).toFixed(1)}" font-size="11" fill="#6b6b76" text-anchor="middle">${esc(label)}</text>
      <text x="${(x+bw/2).toFixed(1)}" y="${(y-6).toFixed(1)}" font-size="11" fill="#2a2a32" text-anchor="middle" font-weight="600">${d.value}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}px" role="img" aria-label="Gráfico de barras">
    <line x1="${padL}" y1="${padT+chartH}" x2="${w-padR}" y2="${padT+chartH}" stroke="#e0dee4" stroke-width="1"/>
    ${bars}
  </svg>`;
}
function svgDonutChart(data, palette, w = 260, h = 260){
  const total = data.reduce((s,d) => s+d.value, 0) || 1;
  const cx = w/2, cy = h/2, r = Math.min(w,h)/2 - 12, thickness = r*0.38;
  const colors = [palette.primary, palette.accent, palette.secondary, '#9CA3AF'];
  let acc = -90;
  const segs = data.map((d, i) => {
    const frac = d.value/total, angle = frac*360;
    const large = angle > 180 ? 1 : 0;
    const x1 = cx + r*Math.cos(acc*Math.PI/180), y1 = cy + r*Math.sin(acc*Math.PI/180);
    acc += angle;
    const x2 = cx + r*Math.cos(acc*Math.PI/180), y2 = cy + r*Math.sin(acc*Math.PI/180);
    return `<path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${colors[i%colors.length]}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}px" role="img" aria-label="Gráfico de rosca">
    ${segs}
    <circle cx="${cx}" cy="${cy}" r="${r-thickness}" fill="var(--dash-card-bg,#fff)"/>
  </svg>`;
}
function svgLineChart(data, palette, w = 520, h = 260){
  const max = Math.max(...data.map(d => d.value), 1), min = Math.min(...data.map(d => d.value), 0);
  const padL = 40, padB = 36, padT = 12, padR = 12;
  const chartW = w - padL - padR, chartH = h - padT - padB;
  const pts = data.map((d, i) => {
    const x = padL + (i/(data.length-1||1))*chartW;
    const y = padT + chartH - ((d.value-min)/((max-min)||1))*chartH;
    return [x, y];
  });
  const path = pts.map((p,i) => (i===0?'M':'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const dots = pts.map((p,i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="${palette.accent}"/>
    <text x="${p[0].toFixed(1)}" y="${(padT+chartH+16).toFixed(1)}" font-size="11" fill="#6b6b76" text-anchor="middle">${esc(String(data[i].label).slice(0,10))}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}px" role="img" aria-label="Gráfico de linha">
    <line x1="${padL}" y1="${padT+chartH}" x2="${w-padR}" y2="${padT+chartH}" stroke="#e0dee4" stroke-width="1"/>
    <path d="${path}" fill="none" stroke="${palette.primary}" stroke-width="2.5"/>
    ${dots}
  </svg>`;
}

/* Gera o HTML autocontido do dashboard — sem libs externas (gotcha do SKILL.md:
   nada de Chart.js/D3, gráficos são SVG desenhado à mão). */
function generateDashboardHtml(spec, opts = {}){
  const palette = pickDocPalette(opts.palette);
  const kpiCards = (spec.kpis || []).map(k => {
    const deltaNum = parseFloat(String(k.delta || '').replace(/[^\d.\-]/g,''));
    const deltaUp = !isNaN(deltaNum) && deltaNum >= 0;
    const deltaHtml = k.delta ? `<span class="kpi-delta ${deltaUp?'up':'down'}">${deltaUp?'▲':'▼'} ${esc(String(k.delta))}</span>` : '';
    return `<div class="kpi-card">
      <div class="kpi-label">${esc(k.label)}</div>
      <div class="kpi-value">${esc(String(k.value))}</div>
      ${deltaHtml}
    </div>`;
  }).join('');

  const chartCards = (spec.charts || []).map(c => {
    if (c.type === 'table'){
      const [header, ...body] = c.rows;
      const rows = body.map(r => `<tr>${r.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('');
      return `<div class="chart-card"><h3>${esc(c.title||'Tabela')}</h3>
        <table class="dash-table"><thead><tr>${header.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    const svg = c.type === 'donut' ? svgDonutChart(c.data, palette) : c.type === 'line' ? svgLineChart(c.data, palette) : svgBarChart(c.data, palette);
    return `<div class="chart-card"><h3>${esc(c.title||'')}</h3><div class="chart-wrap">${svg}</div></div>`;
  }).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(spec.title || 'Dashboard')}</title>
<style>
  :root{
    --primary:${palette.primary}; --secondary:${palette.secondary}; --accent:${palette.accent};
    --bg:${palette.bgLight}; --card-bg:#ffffff; --text:#1F2430; --text-mut:#6B6B76;
    --dash-card-bg:#ffffff;
  }
  @media (prefers-color-scheme: dark){
    :root{ --bg:${palette.bgDark}; --card-bg:#1B1F2A; --text:#F1F1F5; --text-mut:#A0A0AC; --dash-card-bg:#1B1F2A; }
  }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--bg); color:var(--text); padding:32px; }
  header{ margin-bottom:32px; }
  h1{ font-size:30px; font-weight:700; margin:0 0 4px; }
  .subtitle{ font-size:14px; color:var(--text-mut); }
  .kpi-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:20px; margin-bottom:32px; }
  .kpi-card{ background:var(--card-bg); border-radius:12px; padding:24px; border-left:4px solid var(--primary); }
  .kpi-label{ font-size:14px; color:var(--text-mut); margin-bottom:8px; }
  .kpi-value{ font-size:34px; font-weight:800; color:var(--primary); }
  .kpi-delta{ display:inline-block; margin-top:8px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; }
  .kpi-delta.up{ color:#065F46; background:#D1FAE5; }
  .kpi-delta.down{ color:#991B1B; background:#FEE2E2; }
  .chart-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(320px,1fr)); gap:20px; }
  .chart-card{ background:var(--card-bg); border-radius:12px; padding:24px; }
  .chart-card h3{ font-size:16px; font-weight:700; margin:0 0 16px; color:var(--secondary); }
  .chart-wrap{ width:100%; }
  .dash-table{ width:100%; border-collapse:collapse; font-size:13px; }
  .dash-table th{ text-align:left; padding:8px 10px; background:var(--primary); color:#fff; font-size:12px; }
  .dash-table td{ padding:8px 10px; border-bottom:1px solid rgba(128,128,128,.2); }
</style>
</head>
<body>
  <header>
    <h1>${esc(spec.title || 'Dashboard')}</h1>
    <div class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
  </header>
  ${kpiCards ? `<div class="kpi-grid">${kpiCards}</div>` : ''}
  ${chartCards ? `<div class="chart-grid">${chartCards}</div>` : ''}
</body>
</html>`;
}

function downloadDashboardHtml(spec, name, opts = {}){
  const html = generateDashboardHtml(spec, opts);
  downloadTextFile(name, html);
  return html;
}
