@echo off
setlocal
for %%I in ("%~dp0..") do set "TONIC_ROOT=%%~fI"
if not exist "%TONIC_ROOT%\.private\tools\node17\node.exe" (
  echo Native Tonic is not set up in this workspace.
  exit /b 1
)
"%TONIC_ROOT%\.private\tools\node17\node.exe" "%~dp0native-local.cjs" stop
exit /b %errorlevel%
