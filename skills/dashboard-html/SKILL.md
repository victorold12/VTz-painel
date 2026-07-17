---
name: Gerar dashboard/painel HTML profissional (VTz)
description: Gera dashboards e painéis interativos em HTML autocontido (sem libs externas), com design system fixo e QA visual automático. Use sempre que o pedido envolver dashboard, painel, relatório interativo, visualização de dados em HTML.
keywords: dashboard, painel html, dashboard interativo, relatório interativo, html interativo, kpi, métricas, visualização de dados
---

# Skill: Gerar dashboard-html (VTz)

Autocontido — siga só este arquivo, sem depender de nenhuma outra conversa ou contexto.

## 1. Trigger

Carregue esta skill quando o pedido contiver:

- Palavras: "dashboard", "painel" (de dados/métricas, não o painel de configurações do app), "relatório interativo", "visualização de dados", "KPIs", "métricas em tela".
- Pedido de algo pra "abrir no navegador" em vez de baixar como arquivo de escritório.

Se o pedido for de arquivo pra imprimir/entregar formal (PDF/Word/PowerPoint), use as skills `pdf`, `docx` ou `pptx` — este aqui é pra visualização em tela, não pra imprimir.

## 2. Decisão de abordagem

100% client-side, **sem nenhuma lib externa** — só HTML/CSS/SVG nativos, porque:
(a) o dashboard é o próprio HTML final entregue ao usuário (não passa por conversão), então qualquer dependência externa vira um risco de quebra fora deste ambiente;
(b) o projeto não tem nenhuma lib de gráfico carregada (não é Chart.js, D3 nem Recharts) — **gráficos são SVG desenhado à mão** por funções helper, não instale uma lib de charting nova sem aprovação.

| Tipo de tarefa | Ferramenta / função | Observação |
|---|---|---|
| Dashboard novo a partir de uma especificação (KPIs, tabelas, séries) | `generateDashboardHtml(spec, { palette })` — `src/js/27-pptx-dashboard-renderer.js` | `spec = { title, kpis:[{label,value,delta}], charts:[{type:'bar'\|'line'\|'donut', title, data}], tables:[{title, rows}] }` |
| Dashboard a partir de markdown solto (o modelo só tem texto/tabelas) | `buildDashboardSpecFromMarkdown(markdown, title)` — mesmo arquivo | Extrai tabelas do markdown e as transforma em cards de KPI (quando a tabela tem 2 colunas tipo métrica/valor) ou gráfico de barra (quando a 2ª coluna é numérica em série). |
| Visualizar antes de baixar | `openHtmlPreview(html)` — `src/js/07-canvas.js`, já existente | Abre em iframe sandbox — reuse, não crie um preview novo. |

Prefira sempre montar a `spec` estruturada (primeira linha da tabela) em vez de depender do parser de markdown solto — o resultado fica mais previsível e o QA visual (seção 6) tem menos chance de achar defeito.

## 3. Gotchas técnicos (HTML/CSS/SVG puro)

Bugs reais que corrompem o layout em ambientes onde este HTML pode acabar rodando (navegador comum, iframe sandbox, ou webview embutido do VTZ OS via pywebview):

1. **SVG não quebra texto automaticamente.** Um `<text>` com label longo simplesmente vaza pra fora do `viewBox` — sem erro, sem clipping visível a menos que você adicione `overflow: hidden` no container. Sempre trunque labels de eixo/legenda a ~16 caracteres com reticências antes de desenhar, ou quebre em `<tspan>` manualmente.
2. **`viewBox` sem `width`/`height` explícitos no CSS do container pode colapsar pra altura 0** em certos contextos de layout (flexbox sem `min-height`). Sempre defina `width: 100%; height: <valor fixo>px` no wrapper do gráfico, nunca só o `viewBox`.
3. **`gap` em flexbox tem suporte só a partir do Chromium 84 (2020).** O VTZ OS roda parte da stack em webview via pywebview, que pode embutir um Chromium mais antigo dependendo da versão do sistema. Prefira **CSS Grid com `gap`** (suporte mais antigo e mais consistente) pro layout geral dos cards, e reserve flexbox só pra alinhamentos internos simples sem depender de `gap`.
4. **Dentro do iframe `sandbox="allow-scripts allow-modals"` (sem `allow-same-origin`)**, `window.parent` e `document.domain` ficam bloqueados — não tente acessar o documento pai de dentro do dashboard gerado. O dashboard deve ser 100% autossuficiente (todo CSS/JS inline, nenhuma referência externa).
5. **Cores em CSS custom properties (`--primary`) não se propagam pra dentro de um `<svg>` referenciado por `<img src="data:...">`** (SVG como imagem perde acesso ao CSS do documento pai) — como os gráficos aqui são SVG inline no próprio HTML (não `<img>`), isso não é problema, mas é o motivo de nunca extrair os gráficos pra arquivo `.svg` separado depois: eles dependem das variáveis CSS do documento.

## 4. Sistema de design obrigatório

Mesma paleta de 10 cores do projeto (`src/js/26-doc-design-tokens.js`), em hex CSS normal:

| Paleta | Primária | Secundária | Acento | Fundo claro |
|---|---|---|---|---|
| violeta-executivo (padrão VTZ) | `#6D28D9` | `#1E1B4B` | `#F59E0B` | `#FAF9FC` |
| slate-corporativo | `#0F172A` | `#334155` | `#06B6D4` | `#F8FAFC` |
| esmeralda-financeiro | `#065F46` | `#064E3B` | `#FBBF24` | `#F5FBF8` |
| terracota-editorial | `#9A3412` | `#451A03` | `#0EA5E9` | `#FDF8F5` |
| azul-tech | `#1D4ED8` | `#0C1B3A` | `#F97316` | `#F7F9FE` |
| grafite-minimal | `#18181B` | `#3F3F46` | `#DC2626` | `#FAFAFA` |
| borgonha-premium | `#881337` | `#1C1917` | `#D4A017` | `#FDF7F8` |
| petroleo-consultoria | `#134E4A` | `#0F2027` | `#E11D48` | `#F5FAF9` |
| ameixa-criativo | `#6B21A8` | `#2E1065` | `#22D3EE` | `#FAF7FD` |
| carvao-dados | `#111827` | `#1F2937` | `#10B981` | `#F9FAFB` |

O dashboard deve suportar tema claro E escuro (o resto do app VTz é "Glass"/dark por padrão) — gere sempre com `prefers-color-scheme` ou toggle simples, usando `bgDark`/`bgLight` de `DOC_PALETTES`.

**Tipografia** (`font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` — stack nativo, zero dependência de fonte externa):

| Elemento | Tamanho | Peso |
|---|---|---|
| Título do dashboard | 30px | 700 |
| Título de seção/card | 20px | 700 |
| Valor de KPI em destaque | 34px | 800 |
| Corpo/label | 14px | 400 |
| Legenda/caption (delta, timestamp) | 11px | 400 |

**Espaçamento:** grid de cards com `gap: 20px`, padding interno de card `24px`, gap entre seções `32px`. Nunca cards colados sem respiro.

**Regra do elemento visual obrigatório:** cada card de KPI precisa de um indicador visual de tendência (seta/cor verde-vermelho pro delta), nunca só o número seco. Cada seção de dados precisa de pelo menos 1 gráfico OU tabela — nunca uma seção inteira em texto corrido. Se o usuário só deu números soltos sem série temporal, ainda assim monte cards de KPI (não é opcional — "dashboard" implica visual, não lista).

## 5. Lista negra ("Avoid")

Nunca gere dashboard com:

- Faixa de cor decorativa no topo sem dado nenhum atrelado (a barra superior, se existir, deve conter o título/nav, nunca ser só decorativa).
- Sublinhado sob título.
- Fundo bege/creme.
- Gradiente genérico azul→roxo de fundo (gradientes SÓ em barra de progresso ou área de gráfico onde comunicam intensidade/valor — nunca decorativo).
- Texto de corpo centralizado dentro de cards (número do KPI pode centralizar; texto de descrição não).
- Ícone de baixo contraste (cinza claro sobre branco) — ícones usam sempre a cor primária ou acento da paleta.
- Emoji como ícone de card KPI — use SVG simples (linhas, não preenchido pesado) na cor da paleta.
- Todos os `border-radius` idênticos e genéricos (ex.: 8px em tudo sem variar por hierarquia) — cards principais podem ter raio maior que badges/pills internos, mas de forma proposital, não aleatória.

## 6. QA obrigatório

Automatizado em `src/js/28-visual-qa-loop.js`, acionado por quem chama `generateDashboardHtml` seguido de `runVisualQaLoop('dashboard', ...)`. Como o resultado JÁ é HTML final (sem conversão pra outro formato), este é o caso mais direto:

1. Gera o HTML completo.
2. Renderiza no iframe sandbox existente (`openHtmlPreview`) e captura via `html2canvas` (rodando dentro do próprio contexto do iframe, que tem `allow-scripts`).
3. Reenvia a imagem pro modelo ativo como `image_url`, pedindo crítica em JSON: overflow de texto nos cards, sobreposição de elementos do gráfico, contraste baixo entre texto e fundo, cards desalinhados no grid.
4. Se houver defeito, corrige o HTML/CSS gerado e repete — máximo 2 iterações.
5. Só então o HTML final fica disponível pra abrir/baixar.

Diferente de PDF/DOCX/PPTX, aqui não existe "mirror aproximado" — o que é rasterizado É o entregável, então o QA aqui é o mais confiável dos quatro formatos.
