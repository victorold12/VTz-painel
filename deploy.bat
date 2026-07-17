@echo off
REM ============================================================
REM  VTz LLM - Deploy para Firebase Hosting (vtz-life-47067)
REM  Publica o index.html e as regras do Firestore.
REM ============================================================
setlocal

echo.
echo === VTz LLM - Deploy ===
echo.

REM Garante que roda na pasta do proprio .bat (onde estao index.html/firebase.json)
cd /d "%~dp0"

REM 1) Verifica se o Firebase CLI esta instalado
REM    (firebase e um .cmd; toda chamada usa CALL para o script nao encerrar aqui)
where firebase >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Firebase CLI nao encontrado.
  echo Instale com:  npm install -g firebase-tools
  echo Depois faca login:  firebase login
  echo.
  pause
  exit /b 1
)

REM 2) Garante que esta logado
echo Verificando login...
call firebase projects:list >nul 2>nul
if errorlevel 1 (
  echo Nao logado. Abrindo login do Firebase...
  call firebase login
)

REM 3) Recompila app.js/style.css a partir de src/ (se o Node estiver instalado).
REM    Sem Node, publica a versao ja compilada que esta no repo (fallback seguro).
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [AVISO] Node.js nao encontrado - pulando build, publicando app.js/style.css ja existentes.
  echo Para builds atualizados, instale o Node: https://nodejs.org
) else (
  echo.
  echo Compilando src/ para app.js e style.css...
  if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
      echo [ERRO] npm install falhou.
      pause
      exit /b 1
    )
  )
  call npm run build
  if errorlevel 1 (
    echo [ERRO] Build falhou. Veja a mensagem acima.
    pause
    exit /b 1
  )
)

REM 4) Publica hosting + regras do Firestore
echo.
echo Publicando hosting e regras do Firestore...
call firebase deploy --only hosting,firestore:rules --project vtz-life-47067
if errorlevel 1 (
  echo.
  echo [ERRO] Deploy falhou. Veja a mensagem acima.
  pause
  exit /b 1
)

echo.
echo === Deploy concluido ===
echo App no ar: https://vtz-life-47067.web.app
echo.
echo Para REVERTER para uma versao anterior do site, rode:  rollback.bat
echo (ou use o console: Hosting - Historico de versoes - Reverter)
echo.
pause
endlocal
