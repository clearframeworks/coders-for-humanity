@echo off
set "KEYFILE=%LOCALAPPDATA%\PCPhoneBridge\access-key.txt"
if not exist "%KEYFILE%" (echo Start the bridge once to create your key. & pause & exit /b 1)
notepad "%KEYFILE%"
