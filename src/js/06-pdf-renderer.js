/* ===== Renderizador de PDF formatado + slides (client-side, jsPDF) =====
   O modelo escreve markdown; estas funções convertem em PDF com layout real
   (títulos, listas, tabelas em grade, código, slides). Sem backend, sem link falso. */
const VTZ_VIOLET = [139, 92, 246];
function getJsPDF(){ return window.jspdf?.jsPDF || window.jsPDF || null; }

/* Helpers de markdown inline (compartilhados por PDF e Word). */
function mdLinkify(s){ return String(s).replace(/\[(.+?)\]\((.+?)\)/g,'$1 ($2)'); }
function stripMd(s){ return mdLinkify(s).replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1').replace(/`(.+?)`/g,'$1'); }
/* Quebra "texto **negrito** e `código`" em segmentos com estilo. */
function inlineSegments(s){
  s = mdLinkify(s);
  const segs = [], re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null){
    if (m.index > last) segs.push({ text: s.slice(last, m.index) });
    if (m[2] !== undefined) segs.push({ text: m[2], bold: true });
    else if (m[3] !== undefined) segs.push({ text: m[3], italic: true });
    else if (m[4] !== undefined) segs.push({ text: m[4], code: true });
    last = re.lastIndex;
  }
  if (last < s.length) segs.push({ text: s.slice(last) });
  return segs.length ? segs : [{ text: s }];
}

/* Parseia markdown em blocos estruturados (independe do DOM).
   Títulos e tabelas ficam em texto plano; parágrafos e listas guardam o
   markdown inline (**negrito**, *itálico*, `código`) pra render com estilo. */
function mdToBlocks(md){
  const blocks = [];
  const lines = String(md).replace(/\r/g,'').split('\n');
  let i = 0;
  while (i < lines.length){
    const ln = lines[i], t = ln.trim();
    if (t.startsWith('```')){                       // bloco de código
      const code = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')){ code.push(lines[i]); i++; }
      i++; blocks.push({ type:'code', lines: code }); continue;
    }
    if (/^\s*\|.*\|\s*$/.test(ln)){                 // tabela
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])){
        const cells = lines[i].trim().replace(/^\||\|$/g,'').split('|').map(c => stripMd(c.trim()));
        const isSep = cells.every(c => /^:?-+:?$/.test(c.replace(/\s/g,'')));
        if (!isSep) rows.push(cells);
        i++;
      }
      if (rows.length) blocks.push({ type:'table', rows }); continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)){ blocks.push({ type:'hr' }); i++; continue; }
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h){ blocks.push({ type:'h', level: h[1].length, text: stripMd(h[2]) }); i++; continue; }
    const li = t.match(/^([-*+]|\d+\.)\s+(.*)$/);
    if (li){ blocks.push({ type:'li', ordered: /\d+\./.test(li[1]), text: mdLinkify(li[2]) }); i++; continue; }
    if (t === ''){ blocks.push({ type:'gap' }); i++; continue; }
    blocks.push({ type:'p', text: mdLinkify(t) }); i++;
  }
  return blocks;
}

/* Desenha uma tabela em grade. Retorna o novo y. addPage() devolve o y do topo. */
function pdfDrawTable(doc, rows, x0, y, totalW, pageBottom, addPage){
  const cols = Math.max(...rows.map(r => r.length));
  const colW = totalW / cols, cellPad = 4, lineH = 12;
  rows.forEach((row, ri) => {
    const wrapped = []; let maxLines = 1;
    for (let c = 0; c < cols; c++){
      doc.setFont('helvetica', ri===0?'bold':'normal'); doc.setFontSize(9);
      const w = doc.splitTextToSize(String(row[c]||''), colW - cellPad*2);
      wrapped.push(w); maxLines = Math.max(maxLines, w.length);
    }
    const rowH = maxLines*lineH + cellPad*2;
    if (y + rowH > pageBottom){ y = addPage(); }
    if (ri===0){ doc.setFillColor(...VTZ_VIOLET); doc.rect(x0,y,totalW,rowH,'F'); }
    else if (ri%2===0){ doc.setFillColor(245,244,250); doc.rect(x0,y,totalW,rowH,'F'); }
    for (let c = 0; c < cols; c++){
      const x = x0 + c*colW;
      doc.setDrawColor(210,206,222); doc.setLineWidth(0.5); doc.rect(x,y,colW,rowH);
      doc.setFont('helvetica', ri===0?'bold':'normal'); doc.setFontSize(9);
      if (ri===0) doc.setTextColor(255,255,255); else doc.setTextColor(45,45,55);
      (wrapped[c]||[]).forEach((line,li) => doc.text(line, x+cellPad, y+cellPad+lineH*(li+1)-3));
    }
    y += rowH;
  });
  return y + 8;
}

/* PDF de documento formatado (retrato): títulos, listas, tabelas, código. */
function downloadRichPdf(md, name){
  const J = getJsPDF();
  if (!J){ toast('Biblioteca de PDF não carregou (offline?).', 'err'); return; }
  const doc = new J({ unit:'pt', format:'a4' });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const M = 48, CW = pw - M*2;
  let y = M;
  const need = h => { if (y + h > ph - M){ doc.addPage(); y = M; } };
  const drawText = (raw, { size=11, style='normal', color=[30,30,30], lh=15, indent=0, bullet=null }={}) => {
    const forceBold = style === 'bold';
    const maxW = CW - indent - (bullet ? 14 : 0);
    const x0 = M + indent + (bullet ? 14 : 0);
    const setFontFor = w => {
      const b = forceBold || w.bold, it = w.italic;
      const st = b && it ? 'bolditalic' : b ? 'bold' : it ? 'italic' : 'normal';
      doc.setFont(w.code ? 'courier' : 'helvetica', (w.code && !b) ? 'normal' : st);
      doc.setFontSize(size);
    };
    // tokeniza os segmentos inline em palavras que carregam o estilo
    const words = [];
    inlineSegments(raw).forEach(s => String(s.text).split(/(\s+)/).forEach(w => { if (w !== '') words.push(Object.assign({ t:w }, s)); }));
    let line = [], lineW = 0, firstLine = true;
    const flush = () => {
      need(lh);
      if (bullet && firstLine){ doc.setFont('helvetica','normal'); doc.setFontSize(size); doc.setTextColor(...VTZ_VIOLET); doc.text(bullet, M+indent, y); }
      let x = x0;
      line.forEach(w => { setFontFor(w); doc.setTextColor(...color); doc.text(w.t, x, y); x += doc.getTextWidth(w.t); });
      y += lh; line = []; lineW = 0; firstLine = false;
    };
    words.forEach(w => {
      setFontFor(w);
      const ww = doc.getTextWidth(w.t);
      if (lineW + ww > maxW && line.length && w.t.trim() !== ''){ flush(); }
      if (!line.length && w.t.trim() === '') return;      // ignora espaço no início da linha
      line.push(w); lineW += ww;
    });
    if (line.length) flush();
  };
  mdToBlocks(md).forEach(b => {
    switch(b.type){
      case 'h': {
        const map = { 1:[19,10], 2:[15,8], 3:[13,6], 4:[11,5] };
        const [sz, sp] = map[b.level] || map[4];
        y += sp;
        drawText(b.text, { size:sz, style:'bold', color: b.level<=2 ? VTZ_VIOLET : [40,40,40], lh: sz+4 });
        y += sp*0.5; break;
      }
      case 'p': drawText(b.text); y += 4; break;
      case 'li': drawText(b.text, { indent:12, bullet: b.ordered ? '›' : '•' }); break;
      case 'table': y = pdfDrawTable(doc, b.rows, M, y, CW, ph - M, () => { doc.addPage(); return M; }); break;
      case 'code': {
        doc.setFont('courier','normal'); doc.setFontSize(9);
        const wrappedAll = [];
        b.lines.forEach(l => doc.splitTextToSize(l || ' ', CW - 16).forEach(x => wrappedAll.push(x)));
        const boxH = wrappedAll.length*12 + 12;
        need(Math.min(boxH, ph - M*2));
        doc.setFillColor(244,244,246); doc.rect(M, y, CW, boxH, 'F');
        doc.setTextColor(60,60,70);
        let cy = y + 14;
        wrappedAll.forEach(ll => { if (cy > ph - M){ doc.addPage(); cy = M + 14; } doc.text(ll, M+8, cy); cy += 12; });
        y = cy + 8; break;
      }
      case 'hr': y += 6; need(1); doc.setDrawColor(220,218,228); doc.line(M, y, pw-M, y); y += 10; break;
      case 'gap': y += 6; break;
    }
  });
  triggerDownload(name, doc.output('blob'));
}

/* Divide markdown em slides: cada '# ' ou '## ' inicia um slide; '---' também. */
function slideChunks(md){
  const blocks = mdToBlocks(md), slides = [];
  let cur = null;
  const push = () => { if (cur && (cur.title || cur.body.length)) slides.push(cur); };
  blocks.forEach(b => {
    if (b.type === 'h' && b.level <= 2){ push(); cur = { title: b.text, body: [] }; return; }
    if (b.type === 'hr'){ push(); cur = { title:'', body: [] }; return; }
    if (!cur) cur = { title:'', body: [] };
    if (b.type !== 'gap') cur.body.push(b);
  });
  push();
  return slides.length ? slides : [{ title:'', body: blocks.filter(b => b.type !== 'gap') }];
}

/* PDF de slides (paisagem): 1 seção por página, título em faixa violeta, rodapé numerado. */
function downloadSlidesPdf(md, name){
  const J = getJsPDF();
  if (!J){ toast('Biblioteca de PDF não carregou (offline?).', 'err'); return; }
  const doc = new J({ unit:'pt', format:'a4', orientation:'landscape' });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const M = 56, CW = pw - M*2;
  const slides = slideChunks(md);
  slides.forEach((s, si) => {
    if (si > 0) doc.addPage();
    doc.setFillColor(250,249,253); doc.rect(0,0,pw,ph,'F');
    doc.setFillColor(...VTZ_VIOLET); doc.rect(0,0,pw,68,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor(255,255,255);
    doc.text(doc.splitTextToSize(s.title || `Slide ${si+1}`, CW)[0], M, 44);
    let y = 110;
    s.body.forEach(b => {
      if (b.type === 'table'){ y = pdfDrawTable(doc, b.rows, M, y, CW, ph - M, () => M); return; }
      if (b.type === 'code'){
        doc.setFont('courier','normal'); doc.setFontSize(11); doc.setTextColor(60,60,70);
        b.lines.forEach(l => { if (y < ph - M){ doc.text(String(l).slice(0,120), M, y); y += 18; } });
        return;
      }
      const isH = b.type === 'h', isLi = b.type === 'li';
      doc.setFont('helvetica', isH ? 'bold' : 'normal');
      doc.setFontSize(isH ? 16 : 15); doc.setTextColor(35,35,45);
      const text = (isLi ? '•  ' : '') + stripMd(b.text || '');
      doc.splitTextToSize(text, CW).forEach(line => {
        if (y > ph - M) return;                     // slide deve ser conciso; excedente não estoura
        doc.text(line, M, y); y += isH ? 26 : 24;
      });
      if (isH) y += 4;
    });
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(150,148,160);
    doc.text('VTz LLM', M, ph - 24);
    doc.text(`${si+1} / ${slides.length}`, pw - M - 32, ph - 24);
  });
  triggerDownload(name, doc.output('blob'));
}
/* .docx formatado — via docx.js. Markdown vira documento Word real:
   títulos com estilo, tabelas em grade, listas, código e negrito/itálico. */
function downloadDocx(md, name){
  if (typeof docx === 'undefined'){ toast('Biblioteca de Word não carregou (offline?).', 'err'); return; }
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } = docx;
  const VIOLET = '8B5CF6';
  const HMAP = { 1:HeadingLevel.HEADING_1, 2:HeadingLevel.HEADING_2, 3:HeadingLevel.HEADING_3, 4:HeadingLevel.HEADING_4 };
  const runs = raw => inlineSegments(raw).map(s => new TextRun({
    text: s.text, bold: !!s.bold, italics: !!s.italic,
    font: s.code ? 'Consolas' : 'Calibri', size: s.code ? 20 : 22,
  }));
  const children = [];
  mdToBlocks(md).forEach(b => {
    if (b.type === 'h'){
      children.push(new Paragraph({ heading: HMAP[b.level] || HeadingLevel.HEADING_4, spacing:{ before:160, after:80 }, children:[ new TextRun({ text:b.text, bold:true }) ] }));
    } else if (b.type === 'p'){
      children.push(new Paragraph({ spacing:{ after:120 }, children: runs(b.text) }));
    } else if (b.type === 'li'){
      children.push(new Paragraph({ bullet:{ level:0 }, children: runs(b.text) }));
    } else if (b.type === 'code'){
      b.lines.forEach(l => children.push(new Paragraph({ shading:{ fill:'F2F2F6' }, children:[ new TextRun({ text: l || ' ', font:'Consolas', size:20 }) ] })));
      children.push(new Paragraph({ text:'' }));
    } else if (b.type === 'table'){
      const cols = Math.max(...b.rows.map(r => r.length));
      const rows = b.rows.map((r, ri) => new TableRow({ children: Array.from({ length: cols }).map((_, c) => new TableCell({
        width:{ size: Math.floor(100/cols), type: WidthType.PERCENTAGE },
        shading: ri === 0 ? { fill: VIOLET } : (ri % 2 === 0 ? { fill:'F5F4FA' } : undefined),
        children:[ new Paragraph({ children:[ new TextRun({ text: r[c] || '', bold: ri === 0, color: ri === 0 ? 'FFFFFF' : '000000', size:20 }) ] }) ],
      })) }));
      children.push(new Table({ width:{ size:100, type: WidthType.PERCENTAGE }, rows }));
      children.push(new Paragraph({ text:'' }));
    } else if (b.type === 'hr'){
      children.push(new Paragraph({ border:{ bottom:{ color:'CCCCCC', space:1, style: BorderStyle.SINGLE, size:6 } } }));
    }
  });
  const d = new Document({ sections:[{ children }] });
  Packer.toBlob(d).then(blob => triggerDownload(name, blob)).catch(e => toast('Falha ao gerar Word: ' + e.message, 'err'));
}
/* Extrai blocos ```lang ... ``` do markdown cru (independe do DOM) */
function extractCodeBlocks(markdown){
  const blocks = [];
  const re = /```([\w+.#-]*)\s*\n([\s\S]*?)```/g;
  let m;
  while((m = re.exec(markdown)) !== null){
    const code = m[2].replace(/\n$/, '');
    if (code.trim()) blocks.push({ lang: m[1] || '', code });
  }
  return blocks;
}

/* Botão de copiar em cada bloco de código dentro da mensagem */
function enhanceCodeBlocks(scope){
  scope.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement && pre.parentElement.classList.contains('code-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.replaceWith(wrap);
    wrap.appendChild(pre);
    const btn = document.createElement('button');
    btn.className = 'code-copy';
    btn.setAttribute('aria-label','Copiar este bloco');
    btn.innerHTML = iconHTML('copy');
    btn.onclick = () => {
      navigator.clipboard.writeText(pre.innerText).then(() => {
        btn.classList.add('ok');
        setTimeout(() => btn.classList.remove('ok'), 1200);
      }).catch(() => {});
    };
    wrap.appendChild(btn);

    // Baixar este bloco como arquivo, com extensão detectada da linguagem
    const codeEl = pre.querySelector('code');
    const langMatch = (codeEl?.className || '').match(/language-([\w+.#-]+)/);
    const lang = langMatch ? langMatch[1] : '';
    const dl = document.createElement('button');
    dl.className = 'code-copy code-dl';
    dl.setAttribute('aria-label','Baixar como arquivo');
    dl.innerHTML = iconHTML('download');
    dl.onclick = () => {
      const idx = [...scope.querySelectorAll('pre')].indexOf(pre) + 1;
      downloadTextFile(guessFilename(pre.innerText, lang, idx), pre.innerText);
      dl.classList.add('ok');
      setTimeout(() => dl.classList.remove('ok'), 1200);
    };
    wrap.appendChild(dl);

    // Canvas: prévia ao vivo pra blocos que são HTML/SVG
    const looksHtml = /^html?$|^svg$|^xml$/i.test(lang) || /<(!doctype|html|body|head|div|section|svg|h[1-6]|table|canvas|style)\b/i.test(pre.innerText);
    if (looksHtml){
      const pv = document.createElement('button');
      pv.className = 'code-copy code-preview';
      pv.setAttribute('aria-label','Ver prévia');
      pv.innerHTML = iconHTML('play');
      pv.onclick = () => openHtmlPreview(pre.innerText);
      wrap.appendChild(pv);
    }
  });
}

