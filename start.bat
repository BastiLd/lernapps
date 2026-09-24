@echo off
chcp 65001 >nul
title Lernapps (lokal)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden - starte Installation ...
  call "%~dp0install.bat"
  if errorlevel 1 exit /b 1
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo Node.js ist in diesem Fenster weiterhin nicht verfuegbar.
    echo Bitte dieses Fenster schliessen, neu oeffnen und start.bat erneut starten.
    pause
    exit /b 1
  )
)
if not exist node_modules (
  echo Installiere Pakete ^(nur beim ersten Mal, dauert etwas^) ...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install ist fehlgeschlagen - siehe Meldungen oben.
    pause
    exit /b 1
  )
)
node scripts\build-if-needed.mjs
if errorlevel 1 (
  echo.
  echo Der Build ist fehlgeschlagen - siehe Meldungen oben.
  pause
  exit /b 1
)
node scripts\serve.mjs --open
pause
