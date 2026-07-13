@echo off
REM ============================================================
REM  VTz LLM - Deploy para Firebase Hosting (vtz-life-47067)
REM  Publica o index.html e as regras do Firestore.
REM ============================================================
setlocal

echo.
echo === VTz LLM - Deploy ===
echo.

REM 1) Verifica se o Firebase CLI esta instalado
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
firebase projects:list >nul 2>nul
if errorlevel 1 (
  echo Nao logado. Abrindo login do Firebase...
  firebase login
)

REM 3) Publica hosting + regras do Firestore
echo.
echo Publicando hosting e regras do Firestore...
firebase deploy --only hosting,firestore:rules --project vtz-life-47067
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
