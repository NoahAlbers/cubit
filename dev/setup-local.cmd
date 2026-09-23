@echo off
setlocal
for %%I in ("%~dp0..") do set "TONIC_ROOT=%%~fI"
set "TONIC_NODE=%TONIC_ROOT%\.private\tools\node17\node.exe"
if exist "%TONIC_NODE%" goto verify_node
if not exist "%TONIC_ROOT%\.private\tools\node17" mkdir "%TONIC_ROOT%\.private\tools\node17"
curl.exe --fail --location "https://nodejs.org/dist/v17.6.0/win-x64/node.exe" --output "%TONIC_NODE%.download"
if errorlevel 1 exit /b 1
certutil.exe -hashfile "%TONIC_NODE%.download" SHA256 | findstr.exe /i /c:"7b47df21d0f089efdcdf03f1596a7c53414083e84e296cad4119723fed263bab" >nul
if errorlevel 1 (
  echo Node download checksum mismatch.
  exit /b 1
)
move "%TONIC_NODE%.download" "%TONIC_NODE%" >nul
if errorlevel 1 exit /b 1
:verify_node
certutil.exe -hashfile "%TONIC_NODE%" SHA256 | findstr.exe /i /c:"7b47df21d0f089efdcdf03f1596a7c53414083e84e296cad4119723fed263bab" >nul
if errorlevel 1 (
  echo Portable Node checksum mismatch.
  exit /b 1
)
"%TONIC_NODE%" "%~dp0setup-native.cjs"
exit /b %errorlevel%
