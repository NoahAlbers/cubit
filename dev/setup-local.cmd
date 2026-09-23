@echo off
setlocal
for %%I in ("%~dp0..") do set "CUBIT_ROOT=%%~fI"
set "CUBIT_NODE=%CUBIT_ROOT%\.private\tools\node17\node.exe"
if exist "%CUBIT_NODE%" goto verify_node
if not exist "%CUBIT_ROOT%\.private\tools\node17" mkdir "%CUBIT_ROOT%\.private\tools\node17"
curl.exe --fail --location "https://nodejs.org/dist/v17.6.0/win-x64/node.exe" --output "%CUBIT_NODE%.download"
if errorlevel 1 exit /b 1
certutil.exe -hashfile "%CUBIT_NODE%.download" SHA256 | findstr.exe /i /c:"7b47df21d0f089efdcdf03f1596a7c53414083e84e296cad4119723fed263bab" >nul
if errorlevel 1 (
  echo Node download checksum mismatch.
  exit /b 1
)
move "%CUBIT_NODE%.download" "%CUBIT_NODE%" >nul
if errorlevel 1 exit /b 1
:verify_node
certutil.exe -hashfile "%CUBIT_NODE%" SHA256 | findstr.exe /i /c:"7b47df21d0f089efdcdf03f1596a7c53414083e84e296cad4119723fed263bab" >nul
if errorlevel 1 (
  echo Portable Node checksum mismatch.
  exit /b 1
)
"%CUBIT_NODE%" "%~dp0setup-native.cjs"
exit /b %errorlevel%
