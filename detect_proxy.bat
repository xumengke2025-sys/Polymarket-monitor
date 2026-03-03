@echo off
cd /d "%~dp0"
echo Running Proxy Detector...
node detect_proxy.js
pause
