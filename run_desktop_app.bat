@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Microcirculation and Myoton Research Suite - GUI Launcher

echo ================================================================================
echo  [LAUNCHER] MENJALANKAN MICROCIRCULATION AND MYOTON RESEARCH SUITE
echo ================================================================================
echo.

cd /d "%~dp0webapp"

if not exist "node_modules" (
    echo Menginstal modul dependensi node (pertama kali saja)...
    call npm install
)

echo Membuka browser pada http://localhost:5173 ...
start http://localhost:5173

echo Memulai Vite Dev Server...
call npm run dev
pause
