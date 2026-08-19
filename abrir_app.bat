@echo off
cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "Minha Pressao" http://localhost:8000
    python -m http.server 8000
    exit /b 0
)

where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Python nao encontrado. Usando Node.js/npx como alternativa...
    start "Minha Pressao" http://localhost:8000
    npx --yes serve -l 8000 .
    exit /b 0
)

echo Nao foi possivel encontrar Python nem Node.js/npx.
echo Instale um deles para executar o app localmente e tente novamente.
pause
exit /b 1
