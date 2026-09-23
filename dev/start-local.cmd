@echo off
setlocal
for %%I in ("%~dp0..") do set "TONIC_ROOT=%%~fI"
if not exist "%TONIC_ROOT%\.private\tools\node17\node.exe" (
  echo Run dev\setup-local.cmd first.
  exit /b 1
)
"%TONIC_ROOT%\.private\tools\node17\node.exe" "%~dp0native-local.cjs" start
exit /b %errorlevel%
