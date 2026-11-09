@echo off
setlocal enabledelayedexpansion

title Microcirculation and Myoton Research Suite - GUI Launcher
cd /d "%~dp0"

echo ================================================================================
echo  MICROCIRCULATION (SBF) AND MYOTON RESEARCH SUITE - GUI LAUNCHER
echo ================================================================================
echo.

:: 1. Temukan direktori webapp
set "WEBAPP_DIR="
if exist "%~dp0webapp\package.json" (
    set "WEBAPP_DIR=%~dp0webapp"
) else if exist "%~dp006_Microcirculation_SBF_and_Myoton\webapp\package.json" (
    set "WEBAPP_DIR=%~dp006_Microcirculation_SBF_and_Myoton\webapp"
)

if not defined WEBAPP_DIR (
    echo [ERROR] Direktori webapp tidak ditemukan!
    echo Pastikan file ini berada di dalam folder proyek.
    pause
    exit /b 1
)

cd /d "!WEBAPP_DIR!"

:: 2. Pastikan path Node.js terdeteksi
if exist "C:\Program Files\nodejs" (
    set "PATH=C:\Program Files\nodejs;!PATH!"
)

where npm >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] npm tidak terdeteksi di sistem PATH!
    echo Silakan pastikan Node.js 18+ sudah terinstal dari https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Direktori Webapp : !WEBAPP_DIR!
echo.

:: 3. Periksa dan pasang node_modules jika belum ada
if not exist "node_modules" (
    echo [INFO] Memasang dependensi Node.js pertama kali...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Gagal memasang dependensi npm.
        pause
        exit /b !ERRORLEVEL!
    )
)

:: 4. Pemilihan Mode Tampilan
echo --------------------------------------------------------------------------------
echo  Pilih Mode Tampilan Aplikasi:
echo   [1] Aplikasi Desktop Windows (Native Electron Window - Disarankan)
echo   [2] Aplikasi Web Browser (Vite Server otomatis di peramban)
echo --------------------------------------------------------------------------------
echo.

set "MODE=1"
set /p "MODE=Pilihan Anda [1=Desktop, 2=Browser, Tekan Enter untuk Desktop]: "

if "!MODE!"=="2" (
    echo.
    echo [INFO] Menjalankan server web dan membuka peramban...
    call npm run dev -- --open
) else (
    echo.
    echo [INFO] Membuka jendela aplikasi Desktop Electron...
    call npm run dev:electron
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo [INFO] Beralih otomatis ke mode Web Browser...
        call npm run dev -- --open
    )
)

pause
