@echo off
setlocal
for %%I in ("%~dp0..") do set "CUBIT_ROOT=%%~fI"
if not exist "%CUBIT_ROOT%\.private\tools\node22-22.23.3\node.exe" (
  echo Native Cubit is not set up in this workspace.
  exit /b 1
)
"%CUBIT_ROOT%\.private\tools\node22-22.23.3\node.exe" "%~dp0native-local.cjs" stop
exit /b %errorlevel%
