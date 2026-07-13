# VTz LLM — Deploy e configuração do Firebase

App de chat multi-modelo, arquivo único `index.html`. Este pacote publica no
**Firebase Hosting** (projeto `vtz-life-47067`) e ativa login + sincronização na nuvem.

> A chave do OpenRouter **não** vem no código — cada usuário cola a dele na UI.
> A `apiKey` do Firebase no `index.html` é **pública por design** (é assim que o
> Firebase Web funciona); quem protege os dados são as regras do Firestore.

---

## Parte A — 4 cliques no console Firebase (uma vez só)

Sem isso o login fica desabilitado (o app avisa e continua funcionando 100% local).
Abra: https://console.firebase.google.com/project/vtz-life-47067

1. **Ativar login Google**
   Authentication → *Get started* → aba *Sign-in method* → **Google** → *Enable* →
   escolha o e-mail de suporte → *Save*.

2. **Criar o Firestore** — *neste projeto já existe* (banco `(default)`), então
   pode pular. Só crie se ainda não houver: Firestore Database → *Create database*
   → modo **Production** → região (ex.: `southamerica-east1`) → *Enable*.

   > **Importante:** o projeto `vtz-life-47067` já tem outro app usando a coleção
   > `users` (dados de treino). O VTz LLM grava numa coleção separada
   > (`vtzllm_users`), então os dois **não se sobrescrevem**. As regras cobrem as
   > duas coleções, cada usuário só acessa o próprio documento.

3. **Publicar as regras** (feito pelo `deploy.bat`, ou manual)
   Firestore → aba *Rules* → cole o conteúdo de `firestore.rules` → *Publish*.
   As regras garantem que cada usuário só lê/escreve `users/{seu-uid}`.

4. **Autorizar os domínios do login**
   Authentication → *Settings* → *Authorized domains* → confirme que estão lá:
   `vtz-life-47067.web.app`, `vtz-life-47067.firebaseapp.com` e `localhost`.

> **Login Google não funciona abrindo o arquivo como `file://`.**
> Use `http://localhost` (teste) ou o domínio publicado.

---

## Parte B — Publicar o site

### Pré-requisitos (uma vez)
```bat
npm install -g firebase-tools
firebase login
```

### Publicar
Dê dois cliques em **`deploy.bat`** (ou rode no terminal):
```bat
deploy.bat
```
Ele publica o hosting e as regras do Firestore em `vtz-life-47067`.
Ao final: **https://vtz-life-47067.web.app**

### Reverter (se algo sair errado)
```bat
rollback.bat
```
Volta o site para a versão anterior. O Firebase mantém o histórico de releases;
também dá pra reverter pelo console (Hosting → Histórico de versões → *Reverter*).

---

## Arquivos deste pacote
| Arquivo | Função |
|---|---|
| `index.html` | O app inteiro (single-file). |
| `firebase.json` | Config do Hosting + aponta as regras do Firestore. |
| `.firebaserc` | Fixa o projeto `vtz-life-47067`. |
| `firestore.rules` | Segurança: cada usuário só acessa o próprio doc. |
| `deploy.bat` | Publica hosting + regras (Windows). |
| `rollback.bat` | Reverte para a versão anterior (Windows). |

---

## Teste sem deploy (local)
Servir em localhost (login Google funciona aqui):
```bat
firebase serve --only hosting --project vtz-life-47067
```
ou, sem Firebase CLI, um servidor estático qualquer (ex.: `python -m http.server`).
Abrir direto `file://` funciona pro chat, mas **não** pro login Google.

---

## Checklist de validação com internet real (pendência do handoff)
Faça na sua máquina com a chave real do OpenRouter colada na UI:
- Config → **Testar conexão** (chave / catálogo / chat sem-stream / chat com-stream).
- Streaming ao vivo, multimodal (enviar imagem), busca web (🌐), Fusion.
- Geração de arquivos: PDF, .docx, .xlsx.
- Login Google + sincronização entre dois dispositivos.

> Nada disso foi confirmado de ponta a ponta ainda — o ambiente de desenvolvimento
> bloqueia o `openrouter.ai`. Este é o maior gap restante.
