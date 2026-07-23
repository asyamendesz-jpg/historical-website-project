@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Opening index.html ...
start "" "%~dp0index.html"
echo Opening instruction.html ...
start "" "%~dp0instruction.html"
echo.
echo If the page is blank, run: npx --yes serve .
pause
