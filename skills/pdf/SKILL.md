---
name: Gerar PDF profissional (VTz)
description: Gera relatórios e slides em PDF client-side com jsPDF, com design system fixo e QA visual automático. Use sempre que o pedido envolver PDF, relatório, laudo, dossiê ou apresentação exportável.
keywords: pdf, relatório em pdf, gerar pdf, documento pdf, exportar pdf, laudo, dossiê, slides pdf, apresentação pdf
---

# Skill: Gerar PDF (VTz)

Autocontido — siga só este arquivo, sem depender de nenhuma outra conversa ou contexto.

## 1. Trigger

Carregue esta skill quando o pedido do usuário contiver qualquer um destes sinais:

- Palavras: "pdf", "relatório" (quando o destino for arquivo, não só a resposta no chat), "laudo", "dossiê", "exportar em pdf", "gerar um pdf", "apresentação em pdf", "slides em pdf".
- Extensão de arquivo mencionada: `.pdf`.
- Pedido de "documento formatado pra imprimir/entregar".

Não carregue para pedidos de apresentação editável (`.pptx` — ver skill `pptx`) nem documento editável no Word (`.docx` — ver skill `docx`).

## 2. Decisão de abordagem

Este projeto é 100% client-side (sem backend Node/Python no runtime de produção — só o navegador). A geração de PDF é feita pela lib **jsPDF 2.5.1** já carregada globalmente (`window.jspdf.jsPDF`), sem servidor, sem link falso.

| Tipo de tarefa | Ferramenta / função | Observação |
|---|---|---|
| Relatório/documento formatado (retrato) | `downloadRichPdf(markdown, nomeArquivo)` — `src/js/06-pdf-renderer.js` | Converte markdown (títulos, listas, tabelas, código, negrito/itálico) em PDF A4 com paginação automática. |
| Apresentação/slides (paisagem, 1 seção por página) | `downloadSlidesPdf(markdown, nomeArquivo)` — mesmo arquivo | Cada `# ` ou `## ` no markdown vira um novo slide; `---` também quebra slide. |
| Editar um PDF já existente enviado pelo usuário | **Não faça isso.** Não há lib de edição de PDF binário no ambiente (não instale uma nova sem aprovação — ver Restrições do projeto). Peça o conteúdo em texto/markdown e gere um PDF novo, ou oriente o usuário a editar no app de origem. | Client-side não tem parser de PDF existente carregado; forçar isso quebra o arquivo. |
| Converter conversa inteira em PDF | Fluxo já existente "Pages" (`src/js/14-pages-export.js`) — não duplique. | |

Em ambos os casos (`downloadRichPdf`/`downloadSlidesPdf`), você (o modelo) só precisa **escrever o markdown corretamente estruturado** na sua resposta de chat — o botão de download no menu da mensagem já chama a função certa e, antes de entregar o arquivo ao usuário, o app roda o **loop de QA visual** automaticamente (seção 6). Você não gera o PDF diretamente; você gera o markdown-fonte que a função converte.

## 3. Gotchas técnicos (jsPDF 2.5.1)

Bugs reais desta lib que corrompem o layout ou falham em silêncio (sem exceção, sem log):

1. **`doc.text()` não quebra linha sozinho.** Sem passar por `splitTextToSize()` antes, texto longo simplesmente sai da margem da página sem erro. O renderer do projeto já faz isso (`drawText`/`pdfDrawTable`) — se você adicionar texto novo fora dessas funções, replique o padrão.
2. **Sem paginação automática.** jsPDF nunca insere `addPage()` sozinho ao estourar o `y` da página — o conteúdo é desenhado fora da página e simplesmente não aparece (não trava, não avisa). Sempre cheque `y` contra a altura útil da página antes de desenhar (padrão `need(h)` já implementado).
3. **Fontes core (Helvetica/Courier) não têm emoji nem a maioria dos caracteres Unicode fora de Latin-1.** Emoji ou caracteres especiais (ex.: setas exóticas, CJK) viram caixas vazias ou nada — sem erro. **Nunca use emoji no corpo do PDF**; use os marcadores `•`/`›` já definidos no renderer.
4. **Cores são RGB 0–255 em array, nunca hex string.** `doc.setFillColor('#6D28D9')` falha silenciosamente (fica preto ou não aplica). Sempre converta hex → `[r,g,b]` antes (ver `VTZ_VIOLET = [139,92,246]` no código como referência de padrão).
5. **Tabela markdown "torta"** (linhas com número de colunas diferente) gera células vazias ou desalinhadas, porque a largura de coluna é calculada por `Math.max(...linhas.map(r=>r.length))`. Sempre gere tabelas com o mesmo número de colunas em todas as linhas, cabeçalho incluso.

## 4. Sistema de design obrigatório

**Nunca escolha cor livremente.** Use sempre uma das 10 paletas abaixo (primária / secundária / acento), já implementadas em `src/js/26-doc-design-tokens.js` (`DOC_PALETTES`):

| Paleta | Primária | Secundária | Acento |
|---|---|---|---|
| violeta-executivo (padrão VTZ) | `#6D28D9` | `#1E1B4B` | `#F59E0B` |
| slate-corporativo | `#0F172A` | `#334155` | `#06B6D4` |
| esmeralda-financeiro | `#065F46` | `#064E3B` | `#FBBF24` |
| terracota-editorial | `#9A3412` | `#451A03` | `#0EA5E9` |
| azul-tech | `#1D4ED8` | `#0C1B3A` | `#F97316` |
| grafite-minimal | `#18181B` | `#3F3F46` | `#DC2626` |
| borgonha-premium | `#881337` | `#1C1917` | `#D4A017` |
| petroleo-consultoria | `#134E4A` | `#0F2027` | `#E11D48` |
| ameixa-criativo | `#6B21A8` | `#2E1065` | `#22D3EE` |
| carvao-dados | `#111827` | `#1F2937` | `#10B981` |

Escolha a paleta pelo contexto do pedido (financeiro → esmeralda-financeiro; tech/dev → azul-tech ou carvao-dados; institucional → slate-corporativo; sem pista clara → violeta-executivo, é o padrão da marca VTZ).

**Tipografia** (pt, fonte Helvetica — única nativa sem embutir arquivo de fonte):

| Elemento | Tamanho | Peso |
|---|---|---|
| Título de página (H1) | 19pt | bold |
| H2 | 15pt | bold |
| H3 | 13pt | bold |
| Corpo | 11pt | normal, `line-height` 15pt |
| Legenda/rodapé | 9pt | normal |

**Espaçamento:** margem de página 48pt (A4 retrato) ou 56pt (paisagem/slides). Gap entre blocos: 16pt. Nunca cole tabela direto embaixo de título sem esse respiro.

**Regra do elemento visual obrigatório:** todo relatório de mais de 1 página precisa ter pelo meno uma tabela, ou usar headers coloridos com hierarquia visual clara — nunca entregue páginas de parágrafo corrido sem nenhuma estrutura (headers, listas ou tabela). Se os dados permitem tabela, use tabela — não escreva em prosa o que cabe em grade.

## 5. Lista negra ("Avoid")

Nunca gere PDF com:

- Faixa/barra de cor decorativa sem função (a única faixa colorida aceitável é a faixa de título dos slides, que já carrega o título — nunca uma faixa "decorativa" vazia).
- Sublinhado sob título (use cor + peso, nunca `<u>`).
- Fundo bege/creme genérico.
- Gradiente azul→roxo genérico.
- Parágrafo de corpo centralizado — corpo é sempre alinhado à esquerda.
- Emoji como marcador de lista (ver gotcha #3 — nem renderiza).
- Título centralizado com "ícone decorativo" do lado sem propósito informativo.

## 6. QA obrigatório

O app já automatiza isto — implementado em `src/js/28-visual-qa-loop.js`, acionado pelos botões "Baixar PDF" e "Baixar slides (PDF)" do menu de mensagem (`21-super-gems.js`). Fluxo real:

1. Gera o PDF em memória (blob), sem baixar ainda.
2. Rasteriza cada página num mirror HTML/CSS equivalente (mesmos tokens de design) via `html2canvas`, produzindo 1 PNG por página.
3. Reenvia essas imagens pro modelo ativo da conversa como `image_url`, pedindo uma crítica em JSON: `{ ok: bool, defeitos: [{ pagina, tipo, descricao }] }`, cobrindo overflow de texto, sobreposição de elementos, contraste ruim e alinhamento quebrado.
4. Se `ok === false`, corrige o markdown-fonte nos pontos apontados e refaz só as páginas afetadas (máximo 2 iterações, pra não travar o usuário num loop infinito).
5. Só então dispara o download real do PDF final.

Como autor do markdown, seu papel é: escrever conteúdo bem estruturado (títulos claros, tabelas com colunas consistentes, parágrafos curtos) pra minimizar defeitos na primeira passada — o loop cobre o resto.
