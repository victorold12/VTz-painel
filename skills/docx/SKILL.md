---
name: Gerar DOCX profissional (VTz)
description: Gera documentos Word (.docx) client-side com a lib docx.js, com design system fixo e QA visual automático. Use sempre que o pedido envolver Word, .docx, contrato, relatório editável.
keywords: docx, word, .docx, documento word, relatório word, contrato, ata, editável
---

# Skill: Gerar DOCX (VTz)

Autocontido — siga só este arquivo, sem depender de nenhuma outra conversa ou contexto.

## 1. Trigger

Carregue esta skill quando o pedido do usuário contiver:

- Palavras: "word", "docx", ".docx", "documento editável", "contrato", "ata de reunião" (quando o destino for arquivo Word).
- Extensão de arquivo mencionada: `.docx`.
- Pedido explícito de algo "editável no Word/LibreOffice/Google Docs".

Se o pedido for de PDF final não-editável, use a skill `pdf`. Se for apresentação, use `pptx`.

## 2. Decisão de abordagem

100% client-side, sem backend. A lib é **docx.js (pacote `docx`) 8.5.0**, build UMD, carregada globalmente como `window.docx`.

| Tipo de tarefa | Ferramenta / função | Observação |
|---|---|---|
| Documento novo a partir de markdown | `downloadDocx(markdown, nomeArquivo)` — `src/js/06-pdf-renderer.js` | Converte títulos, parágrafos, listas, tabelas, código e negrito/itálico em `.docx` real (não HTML disfarçado). |
| Editar um `.docx` existente enviado pelo usuário | **Não é possível neste ambiente.** Não há parser de `.docx` binário carregado (não instale um sem aprovação — ver Restrições do projeto). Peça pro usuário colar o conteúdo relevante como texto, ou gere um `.docx` novo a partir do que ele descrever. | `docx.js` só GERA documentos, não LÊ/edita os existentes. |
| Converter markdown já existente na conversa | Mesma `downloadDocx` — o botão "Baixar como Word (.docx)" no menu de mensagem já chama isso sobre o texto puro da mensagem. | |

Seu papel como modelo é escrever o markdown-fonte bem estruturado; a função converte e o app roda QA visual antes de entregar (seção 6).

## 3. Gotchas técnicos (docx.js 8.5.0)

Bugs reais desta lib que corrompem o `.docx` ou falham silenciosamente:

1. **`size` em `TextRun` é em meio-pontos, não pontos.** `size: 22` = 11pt real; `size: 11` geraria texto de 5.5pt (minúsculo, quase ilegível) sem nenhum aviso. Sempre multiplique o tamanho desejado em pt por 2.
2. **`Packer.toBuffer()` é API de Node — não existe/falha no navegador.** No client-side use sempre `Packer.toBlob()` (é o que o projeto já faz) seguido de `triggerDownload`.
3. **Larguras de coluna em `WidthType.PERCENTAGE` devem somar ~100 entre as células de uma linha.** Se a soma passar de 100 (ou ficar muito abaixo), o Word redistribui de forma imprevisível — sempre calcule `100/numeroDeColunas` por célula, como o código já faz.
4. **Parágrafo com `children: []` (array vazio de `TextRun`) pode quebrar em algumas versões 8.x.** Para uma linha em branco, use `new Paragraph({ text: '' })` (atalho que funciona), nunca `new Paragraph({ children: [] })`.
5. **Estilo de `HeadingLevel` sozinho não garante a aparência.** O tema padrão do Word do usuário pode sobrescrever cor/fonte de headings nativos. Por isso o renderer sempre define `bold: true` explícito no `TextRun` MESMO usando `heading:`, garantindo que o negrito apareça independente do tema do Word de quem abrir o arquivo.
6. **Bullets (`bullet: { level: 0 }`) dependem de `numbering.xml` sendo interpretado corretamente pelo app que abre o arquivo.** Em alguns fluxos de importação (ex. copiar/colar de um `.docx` gerado pra dentro do Google Docs via certas rotas) o bullet pode aparecer como travessão simples — comportamento de interoperabilidade da lib, não bug: não tem correção client-side, é aceitável.

## 4. Sistema de design obrigatório

Mesma paleta de 10 cores do resto do projeto (`src/js/26-doc-design-tokens.js`, `DOC_PALETTES`) — escolha por contexto, nunca livre:

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

A cor primária vira o preenchimento do cabeçalho de tabela (texto branco em cima); linhas alternadas usam um tom bem claro derivado da secundária (ex.: `#F5F4FA`), nunca a cor cheia — senão o corpo fica pesado.

**Tipografia** (fonte Calibri, padrão corporativo Word; código em Consolas):

| Elemento | Tamanho (`size` em half-points) | Peso |
|---|---|---|
| Título (Heading 1) | 32 (16pt) | bold |
| H2 | 26 (13pt) | bold |
| H3 | 24 (12pt) | bold |
| Corpo | 22 (11pt) | normal |
| Código inline/bloco | 20 (10pt), fonte Consolas | normal |

**Espaçamento:** `spacing: { before: 160, after: 80 }` em twips para headings (padrão já no código); parágrafo de corpo `after: 120`. Nunca emende tabela direto em heading sem parágrafo de respiro.

**Regra do elemento visual obrigatório:** documentos com dados tabulares SEMPRE em tabela real (`Table`/`TableRow`/`TableCell`), nunca listado em texto corrido com separador manual (tipo "Item: Valor, Item: Valor"). Toda seção de mais de 3 parágrafos deve ter pelo menos um heading, lista ou tabela quebrando o bloco — nunca um muro de texto.

## 5. Lista negra ("Avoid")

Nunca gere `.docx` com:

- Faixa de cor decorativa sem função (tabelas e headings coloridos sim; retângulo decorativo vazio não).
- Sublinhado sob título (negrito + cor já dão hierarquia).
- Fundo bege/creme no corpo do documento.
- Gradiente — Word não renderiza gradiente em preenchimento de texto/tabela de forma confiável; nem tente.
- Parágrafo de corpo centralizado — sempre justificado ou alinhado à esquerda.
- Emoji como marcador de lista.
- Tabela com cabeçalho e corpo na mesma cor (sem contraste de destaque pro cabeçalho).

## 6. QA obrigatório

Automatizado em `src/js/28-visual-qa-loop.js`, acionado pelo botão "Baixar como Word (.docx)" do menu de mensagem. Como `.docx` binário não é rasterizável diretamente no navegador (não há lib de renderização de Word carregada, e instalar uma é desproporcional pro ganho), o loop usa uma **prévia HTML espelho**: a mesma estrutura de blocos (`mdToBlocks`) que gera o `.docx` também gera um HTML com os mesmos tokens de design (fonte, cores, espaçamento equivalente em px), off-screen, capturado via `html2canvas`. Fluxo:

1. Gera o `.docx` real (blob) e, em paralelo, a prévia HTML espelho.
2. Rasteriza a prévia (1 imagem por "página" simulada, quebrada por altura equivalente a A4).
3. Reenvia as imagens pro modelo ativo como `image_url`, pedindo crítica em JSON (overflow, contraste, alinhamento, hierarquia confusa).
4. Se houver defeito, corrige o markdown-fonte e regenera ambos (docx real + prévia) — máximo 2 iterações.
5. Só então libera o download do `.docx`.

A prévia é uma aproximação fiel do layout (mesmas fontes, cores e proporções), não um render pixel-a-pixel do Word — suficiente pra pegar os erros que importam: overflow, contraste e hierarquia.
