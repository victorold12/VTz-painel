# VTz-painel (JARVIS)

Painel web do VTz OS. Metade de um sistema de dois repositórios — a outra é
`victorold12/servidor` (backend FastAPI + Agente Local + casca Electron + `.msi`).

## Onde está a memória do projeto

**O arquivo principal é `../servidor/CLAUDE.md`.** Leia ele. Tem o grafo de
conhecimento, as decisões que valem entre sessões, e as armadilhas já pagas.
Ele mora lá porque o grafo cobre os dois repositórios e precisava de um dono só.

Se o `servidor` não estiver clonado nesta sessão, peça pra anexar:
`add_repo(owner="victorold12", repo="servidor")`.

## Específico deste repositório

**O build é IIFE, não módulos.** `esbuild` com `format:'iife'` e `bundle:false`
— os arquivos de `src/js/*` são **concatenados num escopo só**. Consequência
prática: declarações de função no topo de cada arquivo enxergam umas às outras
sem `import`. Não adianta procurar `import`/`export`; não existem.

**`app.js` e `style.css` são gerados.** Nunca edite os dois direto: edite
`src/js/*` e `src/css/*`, e rode `npm run build`. E **commite o resultado** — o
site é servido estático, então o build precisa estar no repositório.

**A ordem dos arquivos importa.** Os nomes começam com número (`10-`, `31-`,
`40-`) porque essa é a ordem de concatenação.

**CSP.** O `index.html` declara a política, e o CI **falha** se o `authDomain`
em `src/js/12-menus.js` divergir dela. Mexeu num, confira o outro.
