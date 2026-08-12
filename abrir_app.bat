@echo off
cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Python nao encontrado. Instale o Python e tente novamente.
    pause
    exit /b 1
)

start "Minha Pressao" http://localhost:8000
python -m http.server 8000
