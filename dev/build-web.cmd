@echo off
setlocal
cd /d "%~dp0.."
".private\tools\node22-22.23.3\node.exe" "dev\build-web.cjs"
