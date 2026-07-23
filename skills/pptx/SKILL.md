---
name: Gerar PPTX profissional (VTz)
description: Gera apresentações PowerPoint (.pptx) client-side com PptxGenJS, com design system fixo e QA visual automático. Use sempre que o pedido envolver PowerPoint, .pptx, deck, apresentação, slides editáveis.
keywords: pptx, powerpoint, apresentação, slides, deck, .pptx, keynote
---

# Skill: Gerar PPTX (VTz)

Autocontido — siga só este arquivo, sem depender de nenhuma outra conversa ou contexto.

## 1. Trigger

Carregue esta skill quando o pedido contiver:

- Palavras: "powerpoint", "pptx", ".pptx", "apresentação" (quando o destino for arquivo editável, não PDF), "deck", "slides" (editáveis).
- Extensão mencionada: `.pptx`.

Se o pedido for de slides em PDF (não editáveis), use a skill `pdf` (`downloadSlidesPdf`). Se for painel/dashboard web, use `dashboard-html`.

## 2. Decisão de abordagem

100% client-side. A lib é **PptxGenJS**, carregada via CDN globalmente como `window.PptxGenJS`.

| Tipo de tarefa | Ferramenta / função | Observação |
|---|---|---|
| Apresentação nova a partir de markdown | `downloadPptx(markdown, nomeArquivo, { palette })` — `src/js/27-pptx-dashboard-renderer.js` | Cada `# `/`## ` ou `---` no markdown inicia um slide novo (mesma convenção de quebra que `downloadSlidesPdf`, pra consistência entre skills). |
| Editar um `.pptx` existente enviado pelo usuário | **Não é possível neste ambiente.** PptxGenJS só GERA, não lê `.pptx` binário existente. Não instale um parser sem aprovação. Peça o conteúdo em texto e gere um deck novo. | |
| Poucos slides (1–3), foco em 1 ideia por slide | Mesma função — o parser de markdown já limita a 1 tópico por slide se você estruturar com `## ` por slide. | |

Seu papel como modelo é escrever markdown com quebras de slide claras (`## Título do slide`) e conteúdo enxuto por slide — a função converte, o app roda QA visual (seção 6) e só então libera o download.

## 3. Gotchas técnicos (PptxGenJS)

Bugs reais desta lib que corrompem o layout ou falham em silêncio:

1. **Coordenadas e tamanhos são em POLEGADAS por padrão, não px nem pt.** Passar `x: 40` (pensando em pt ou px) posiciona o elemento 40 polegadas pra direita — fora do slide, invisível, sem erro. Sempre converta: `1in = 72pt = 96px`. O renderer do projeto centraliza essa conversão numa função helper (`inches()`), nunca calcule na mão espalhado pelo código.
2. **Texto não encolhe sozinho pra caber na caixa.** Sem a opção `fit: 'shrink'` (ou `autoFit: true` dependendo da versão) em `addText`, título longo estoura pra fora do textbox — visualmente cortado, sem exceção JS. Sempre usar `fit: 'shrink'` em títulos de slide, que por natureza têm tamanho variável.
3. **Cor é hex de 6 dígitos SEM `#` na frente.** `color: '#6D28D9'` falha silenciosamente (ou lança erro dependendo da versão) — o formato correto é `color: '6D28D9'`. Isso é o oposto da convenção CSS/jsPDF e é a causa nº1 de "cor não aplicou" nesta lib.
4. **Layout do slide (`pptx.layout`) deve ser definido ANTES de adicionar qualquer slide.** Setar `pptx.layout = 'LAYOUT_16x9'` depois de já ter chamado `addSlide()` não tem efeito nos slides já criados. Sempre definir layout logo após instanciar `new PptxGenJS()`.
5. **`pptx.writeFile()` depende de gesto direto do usuário (clique) em alguns navegadores** — se chamado depois de um `await` longo (ex.: depois do loop de QA visual, que envolve chamada de rede pro modelo), o navegador pode bloquear o download automático por não reconhecer mais como resultado direto de clique. Por isso o renderer deste projeto usa `pptx.write('blob')` (não `writeFile`) e entrega o blob pro mesmo `triggerDownload()` já usado por PDF/DOCX, que não depende de gesto síncrono.
6. **Tabelas (`addTable`) não quebram texto automaticamente dentro de célula de altura fixa** — texto longo é cortado visualmente na borda da célula. Para células com texto longo, calcule a altura da linha a partir do número de caracteres antes de fixar `h`, ou prefira menos texto por célula (slide não é documento — resuma).

## 4. Sistema de design obrigatório

Mesma paleta de 10 cores do projeto (`src/js/26-doc-design-tokens.js`), agora em formato SEM `#` (ver gotcha #3):

| Paleta | Primária | Secundária | Acento |
|---|---|---|---|
| violeta-executivo (padrão VTZ) | `6D28D9` | `1E1B4B` | `F59E0B` |
| slate-corporativo | `0F172A` | `334155` | `06B6D4` |
| esmeralda-financeiro | `065F46` | `064E3B` | `FBBF24` |
| terracota-editorial | `9A3412` | `451A03` | `0EA5E9` |
| azul-tech | `1D4ED8` | `0C1B3A` | `F97316` |
| grafite-minimal | `18181B` | `3F3F46` | `DC2626` |
| borgonha-premium | `881337` | `1C1917` | `D4A017` |
| petroleo-consultoria | `134E4A` | `0F2027` | `E11D48` |
| ameixa-criativo | `6B21A8` | `2E1065` | `22D3EE` |
| carvao-dados | `111827` | `1F2937` | `10B981` |

**Tipografia** (fonte Arial — a mais previsível entre plataformas PowerPoint):

| Elemento | Tamanho (pt) | Peso |
|---|---|---|
| Título do slide | 26–30pt (ajuste automático via `fit: 'shrink'`) | bold |
| Subtítulo/label de seção | 16pt | bold |
| Corpo/bullet | 14pt | normal |
| Legenda/rodapé (numeração, marca) | 10pt | normal |

**Espaçamento:** margem do slide 0.6in (≈ 56pt/43px) em todos os lados — mesmo valor usado nos slides em PDF, pra dar consistência caso o usuário peça os dois formatos do mesmo conteúdo. Gap entre elementos: 0.2–0.3in.

**Regra do elemento visual obrigatório (a mais importante em slide):** nenhum slide pode ser só texto corrido. Todo slide precisa de pelo menos um destes: tabela, card de KPI/número em destaque, gráfico (barra/pizza simples via `addChart` ou desenho manual com `addShape`), ou lista com ícone/marcador visual — nunca um bloco de parágrafo sozinho ocupando o slide inteiro. Se o conteúdo é só um parágrafo, transforme os pontos-chave em bullets curtos com destaque numérico ou de palavra-chave em cor de acento.

## 5. Lista negra ("Avoid")

Nunca gere `.pptx` com:

- Faixa de cor decorativa vazia (a única barra aceitável é a barra de título, que carrega texto).
- Sublinhado sob título.
- Fundo bege/creme.
- Gradiente genérico azul→roxo de fundo de slide inteiro.
- Texto de corpo centralizado (bullets e parágrafos alinhados à esquerda; só títulos/números de destaque podem centralizar).
- Ícone de baixo contraste.
- Emoji como bullet.
- Slide title + subtítulo genérico tipo "Introdução" / "Conclusão" sem contexto — sempre nomeie o slide pelo conteúdo real ("Custos por trimestre", não "Dados").

## 6. QA obrigatório

Automatizado em `src/js/28-visual-qa-loop.js`, acionado pelo botão "Baixar PPTX" do menu de mensagem. Como `.pptx` binário também não é rasterizável nativamente no navegador, o loop usa o mesmo princípio do `docx`: `downloadPptx` monta cada slide a partir de uma estrutura intermediária de blocos, e essa MESMA estrutura alimenta um mirror HTML (`div` de 1280×720px por slide, replicando os tokens de design acima em px) renderizado off-screen e capturado via `html2canvas`, 1 PNG por slide. Fluxo:

1. Gera o `.pptx` real (blob) e o mirror HTML dos mesmos slides, a partir da mesma estrutura de dados (garante que o que é screenshotado é fiel ao que o `.pptx` contém).
2. Rasteriza cada slide em PNG.
3. Reenvia as imagens pro modelo ativo como `image_url`, pedindo crítica em JSON por slide (texto cortado, elemento sobreposto, contraste ruim, slide vazio/sem elemento visual).
4. Se houver defeito, corrige os dados-fonte do(s) slide(s) afetado(s) e regenera só eles — máximo 2 iterações.
5. Só então libera o download do `.pptx`.
