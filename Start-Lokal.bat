@echo off
chcp 65001 >nul
title Lernapps (lokal)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte von https://nodejs.org installieren.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installiere Pakete ^(nur beim ersten Mal^) ...
  call npm install
)
if not exist dist\index.html (
  echo Baue die App ^(nur beim ersten Mal^) ...
  call npm run build
)
node scripts\serve.mjs --open
pause
