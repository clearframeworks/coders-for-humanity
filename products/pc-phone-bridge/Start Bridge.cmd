@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js 20 or newer is required. & pause & exit /b 1)
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:46820'"
node bridge.js serve
pause
