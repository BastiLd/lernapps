@echo off
chcp 65001 >nul
title Lernapps - Installation
cd /d "%~dp0"

where node >nul 2>nul
if not errorlevel 1 goto :node_ok

echo Node.js wurde nicht gefunden - wird jetzt installiert ...
where winget >nul 2>nul
if errorlevel 1 (
  echo winget wurde nicht gefunden.
  echo Bitte Node.js manuell von https://nodejs.org installieren und dieses Skript erneut starten.
  pause
  exit /b 1
)

winget install -e --id OpenJS.NodeJS.LTS --scope user --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo.
  echo Die Node.js-Installation ist fehlgeschlagen - siehe Meldungen oben.
  pause
  exit /b 1
)

echo PATH wird aktualisiert ...
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul`) do set "SysPath=%%B"
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul`) do set "UserPath=%%B"
set "PATH=%SysPath%;%UserPath%"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js wurde installiert, ist in diesem Fenster aber noch nicht verfuegbar.
  echo Bitte dieses Fenster schliessen und install.bat erneut starten.
  pause
  exit /b 1
)

:node_ok
echo Node.js gefunden:
node -v

echo.
echo Installiere Pakete ^(kann beim ersten Mal etwas dauern^) ...
call npm install
if errorlevel 1 (
  echo.
  echo npm install ist fehlgeschlagen - siehe Meldungen oben.
  pause
  exit /b 1
)

echo.
echo Fertig installiert. Du kannst jetzt start.bat verwenden.
pause
