@echo off
setlocal
for %%I in ("%~dp0..") do set "CUBIT_ROOT=%%~fI"
set "CUBIT_NODE=%CUBIT_ROOT%\.private\tools\node22-22.23.3\node.exe"
if exist "%CUBIT_NODE%" goto verify_node
if not exist "%CUBIT_ROOT%\.private\tools\node22-22.23.3" mkdir "%CUBIT_ROOT%\.private\tools\node22-22.23.3"
curl.exe --fail --location "https://nodejs.org/dist/v22.23.3/win-x64/node.exe" --output "%CUBIT_NODE%.download"
if errorlevel 1 exit /b 1
certutil.exe -hashfile "%CUBIT_NODE%.download" SHA256 | findstr.exe /i /c:"9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e" >nul
if errorlevel 1 (
  echo Node download checksum mismatch.
  exit /b 1
)
move "%CUBIT_NODE%.download" "%CUBIT_NODE%" >nul
if errorlevel 1 exit /b 1
:verify_node
certutil.exe -hashfile "%CUBIT_NODE%" SHA256 | findstr.exe /i /c:"9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e" >nul
if errorlevel 1 (
  echo Portable Node checksum mismatch.
  exit /b 1
)
"%CUBIT_NODE%" "%~dp0setup-native.cjs"
exit /b %errorlevel%
