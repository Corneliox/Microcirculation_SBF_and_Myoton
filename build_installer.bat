@echo off
setlocal enabledelayedexpansion

title Microcirculation and Myoton Suite - Build Single Electron Installer
cd /d "%~dp0"

echo ================================================================================
echo  MICROCIRCULATION & MYOTON SUITE - SINGLE ELECTRON INSTALLER BUILDER
echo  Version: 3.0.0
echo ================================================================================
echo.

:: 1. Cek direktori webapp
set "WEBAPP_DIR="
if exist "%~dp0webapp\package.json" (
    set "WEBAPP_DIR=%~dp0webapp"
) else if exist "%~dp006_Microcirculation_SBF_and_Myoton\webapp\package.json" (
    set "WEBAPP_DIR=%~dp006_Microcirculation_SBF_and_Myoton\webapp"
)

if not defined WEBAPP_DIR (
    echo [ERROR] Direktori webapp tidak ditemukan!
    pause
    exit /b 1
)

:: 2. Pastikan path Node.js terdeteksi
if exist "C:\Program Files\nodejs" (
    set "PATH=C:\Program Files\nodejs;!PATH!"
)

where npm >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] npm tidak terdeteksi di sistem PATH!
    echo Silakan install Node.js 18+ dari https://nodejs.org/
    pause
    exit /b 1
)

:: 3. Setup toolset environment variables if cached locally
if exist "%LOCALAPPDATA%\electron-builder\Cache\nsis\nsis-3.0.4.1" (
    set "ELECTRON_BUILDER_NSIS_DIR=%LOCALAPPDATA%\electron-builder\Cache\nsis\nsis-3.0.4.1"
)
if exist "%LOCALAPPDATA%\electron-builder\Cache\nsis\nsis-resources-3.4.1" (
    set "ELECTRON_BUILDER_NSIS_RESOURCES_DIR=%LOCALAPPDATA%\electron-builder\Cache\nsis\nsis-resources-3.4.1"
)

cd /d "!WEBAPP_DIR!"

echo [1/3] Memastikan dependensi npm terpasang...
if not exist "node_modules" (
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Gagal memasang node_modules.
        pause
        exit /b 1
    )
)

echo.
echo [2/3] Membangun bundle frontend Vite...
call npm run build
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Vite build gagal.
    pause
    exit /b 1
)

echo.
echo [3/3] Mengemas aplikasi menjadi 1 Single NSIS Installer...
call npx electron-builder --win nsis --x64
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Pembuatan installer gagal.
    pause
    exit /b 1
)

echo.
echo ================================================================================
echo  SUKSES: Single Installer v3.0.0 berhasil dibuat!
echo  Lokasi installer:
echo  !WEBAPP_DIR!\release\Microcirculation ^& Myoton Suite Setup 3.0.0.exe
echo ================================================================================
echo.
pause
exit /b 0
