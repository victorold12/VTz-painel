/* ===== Sistema de design para documentos gerados (PDF, DOCX, PPTX, dashboard-html) =====
   Fonte única de verdade: as skills em skills/{pdf,docx,pptx,dashboard-html}/SKILL.md
   descrevem estes MESMOS valores em texto pro modelo seguir ao escrever markdown/HTML;
   este módulo os aplica em código nos geradores. Nunca deixar o modelo escolher cor
   livremente — sempre uma destas 10 paletas. */
const DOC_PALETTES = {
  'violeta-executivo':   { primary:'#6D28D9', secondary:'#1E1B4B', accent:'#F59E0B', bgLight:'#FAF9FC', bgDark:'#150F2E', textOnPrimary:'#FFFFFF' },
  'slate-corporativo':   { primary:'#0F172A', secondary:'#334155', accent:'#06B6D4', bgLight:'#F8FAFC', bgDark:'#0B1220', textOnPrimary:'#FFFFFF' },
  'esmeralda-financeiro':{ primary:'#065F46', secondary:'#064E3B', accent:'#FBBF24', bgLight:'#F5FBF8', bgDark:'#062A22', textOnPrimary:'#FFFFFF' },
  'terracota-editorial': { primary:'#9A3412', secondary:'#451A03', accent:'#0EA5E9', bgLight:'#FDF8F5', bgDark:'#2B1206', textOnPrimary:'#FFFFFF' },
  'azul-tech':           { primary:'#1D4ED8', secondary:'#0C1B3A', accent:'#F97316', bgLight:'#F7F9FE', bgDark:'#0A1226', textOnPrimary:'#FFFFFF' },
  'grafite-minimal':     { primary:'#18181B', secondary:'#3F3F46', accent:'#DC2626', bgLight:'#FAFAFA', bgDark:'#0C0C0D', textOnPrimary:'#FFFFFF' },
  'borgonha-premium':    { primary:'#881337', secondary:'#1C1917', accent:'#D4A017', bgLight:'#FDF7F8', bgDark:'#1F0A11', textOnPrimary:'#FFFFFF' },
  'petroleo-consultoria':{ primary:'#134E4A', secondary:'#0F2027', accent:'#E11D48', bgLight:'#F5FAF9', bgDark:'#081715', textOnPrimary:'#FFFFFF' },
  'ameixa-criativo':     { primary:'#6B21A8', secondary:'#2E1065', accent:'#22D3EE', bgLight:'#FAF7FD', bgDark:'#1A0B2E', textOnPrimary:'#FFFFFF' },
  'carvao-dados':        { primary:'#111827', secondary:'#1F2937', accent:'#10B981', bgLight:'#F9FAFB', bgDark:'#08090C', textOnPrimary:'#FFFFFF' },
};
const DOC_PALETTE_ORDER = Object.keys(DOC_PALETTES);
function pickDocPalette(seed){
  if (seed && DOC_PALETTES[seed]) return DOC_PALETTES[seed];
  const key = DOC_PALETTE_ORDER[Math.floor(Math.random() * DOC_PALETTE_ORDER.length)];
  return DOC_PALETTES[key];
}
/* Tipografia — mesmos números usados por downloadRichPdf/downloadSlidesPdf (pt) e
   pelo dashboard-html (px), pra manter hierarquia consistente entre formatos. */
const DOC_TYPE_SCALE = {
  pageTitle:   { pt:19, px:30, weight:700 },
  slideTitle:  { pt:26, px:34, weight:700 },
  h2:          { pt:15, px:20, weight:700 },
  h3:          { pt:13, px:16, weight:600 },
  body:        { pt:11, px:14, weight:400, lineHeight:1.5 },
  caption:     { pt:9,  px:11, weight:400 },
};
/* Espaçamento — margens de página A4 (48pt já validado no jsPDF), slide 16:9 (56pt),
   e grid de cards em px pro dashboard-html. */
const DOC_SPACING = {
  pageMarginPt: 48,
  slideMarginPt: 56,
  blockGapPt: 16,
  cardGapPx: 20,
  cardPadPx: 24,
  sectionGapPx: 32,
};
/* Lista negra: nenhum gerador deste projeto deve produzir estes clichês. */
const DOC_AVOID = [
  'faixa ou barra de cor puramente decorativa (sem dado nenhum atrelado)',
  'sublinhado sob título',
  'fundo bege/creme genérico',
  'gradiente azul→roxo genérico',
  'parágrafo de corpo centralizado (corpo é sempre alinhado à esquerda)',
  'ícone de baixo contraste (cinza claro sobre branco)',
  'emoji como marcador de lista no lugar de bullet/ícone real',
  'border-radius idêntico e genérico (8px) em todos os elementos sem propósito',
  'glassmorphism/sombra pesada aplicada sem necessidade funcional',
];
