@echo off
REM ============================================================
REM  VTz LLM - Reverter deploy do Firebase Hosting
REM  Volta o site publicado para a versao anterior (1 clique).
REM  Firebase guarda o historico; isto reativa o release anterior.
REM ============================================================
setlocal

echo.
echo === VTz LLM - Rollback do Hosting ===
echo.

where firebase >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Firebase CLI nao encontrado. Instale:  npm install -g firebase-tools
  pause
  exit /b 1
)

echo Isto vai reverter https://vtz-life-47067.web.app para a versao ANTERIOR.
set /p CONF="Confirmar? (S/N): "
if /I not "%CONF%"=="S" (
  echo Cancelado.
  pause
  exit /b 0
)

firebase hosting:rollback --project vtz-life-47067
if errorlevel 1 (
  echo.
  echo [AVISO] Rollback automatico falhou nesta versao do CLI.
  echo Reverta manualmente: console Firebase - Hosting - Historico de versoes - "Reverter" na versao desejada.
  pause
  exit /b 1
)

echo.
echo === Rollback concluido ===
pause
endlocal
