@echo off
setlocal enabledelayedexpansion
title Oli - Bot

rem ============================================
rem Mantem o bot no ar nesta maquina.
rem Se o processo cair, espera 15s e sobe de novo.
rem
rem A saida aparece nesta janela, que e onde o QR Code e desenhado na
rem primeira execucao, e tambem em logs\bot.log, via LOG_FILE.
rem
rem Instale o inicio automatico com:
rem   powershell -ExecutionPolicy Bypass -File scripts\instalar-auto-start.ps1
rem ============================================

cd /d "%~dp0.."
if not exist "logs" mkdir "logs"
set "LOG=%CD%\logs\bot.log"
set "LOG_FILE=logs\bot.log"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no PATH. Instale o Node 18 ou superior.
  pause
  exit /b 1
)

:loop
rem Rotaciona ao passar de 10 MB, para o log nao encher o disco.
set "SIZE=0"
if exist "%LOG%" for %%A in ("%LOG%") do set "SIZE=%%~zA"
if !SIZE! GTR 10485760 (
  if exist "%LOG%.1" del /q "%LOG%.1"
  move /y "%LOG%" "%LOG%.1" >nul
)

rem Sem esta limpeza, um Chrome sobrevivente da queda anterior segura a
rem pasta .wwebjs_auth e todas as proximas tentativas falham em sequencia.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0limpar-chrome-orfao.ps1"

echo.
echo ==================================================
echo [%date% %time%] subindo o bot
echo ==================================================

node index.js

echo [%date% %time%] o bot encerrou; nova tentativa em 15 segundos
timeout /t 15 /nobreak >nul
goto loop
