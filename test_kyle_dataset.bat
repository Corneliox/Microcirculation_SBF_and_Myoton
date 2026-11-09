@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Uji Dataset Baru KYLE OCT - Microcirculation and Myoton Suite

echo ================================================================================
echo  [TEST] UJI VERIFIKASI DATASET BARU: KYLE OCT.xlsx
echo  Microcirculation (SBF) and Myotonometer Research Suite
echo ================================================================================
echo.

:: 1. Auto-detect Python executable
set "PYTHON_EXE="
if exist "C:\Python312\python.exe" (
    set "PYTHON_EXE=C:\Python312\python.exe"
) else if exist "C:\Python311\python.exe" (
    set "PYTHON_EXE=C:\Python311\python.exe"
) else if exist "C:\Python310\python.exe" (
    set "PYTHON_EXE=C:\Python310\python.exe"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
) else (
    py --version >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set "PYTHON_EXE=py"
    ) else (
        python --version >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            set "PYTHON_EXE=python"
        )
    )
)

if not defined PYTHON_EXE (
    echo [ERROR] Python tidak terdeteksi di sistem PATH atau direktori standar!
    echo Silakan pastikan Python 3.10+ sudah terinstal.
    pause
    exit /b 1
)

echo [INFO] Menggunakan Python: %PYTHON_EXE%
echo.

:: 2. Jalankan Unit Test Python (test_kyle_oct.py)
echo [1/3] Menjalankan Unit Test Python (tests/test_kyle_oct.py)...
"%PYTHON_EXE%" tests/test_kyle_oct.py
if %ERRORLEVEL% NEQ 0 (
    echo [GAGAL] Terjadi kesalahan pada pengujian Python adapter!
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Unit Test Python LULUS 100%%!
echo.

:: 3. Jalankan Pengujian Parser JavaScript jika Node.js tersedia
echo [2/3] Menjalankan Pengujian Parser JavaScript (Node.js)...
node -v >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    node webapp/test_kyle_parser.js
    if !ERRORLEVEL! NEQ 0 (
        echo [GAGAL] Terjadi kesalahan pada parser JavaScript!
        pause
        exit /b !ERRORLEVEL!
    )
    echo [OK] Pengujian Parser JavaScript LULUS!
) else (
    echo [INFO] Node.js tidak terdeteksi di PATH global. Melewati uji JS langsung.
)
echo.

:: 4. Tampilkan Tabel Ringkasan Lengkap 6 Protokol
echo [3/3] Memproses dan Menampilkan Ringkasan 6 Protokol Spasial 9-Titik...
echo.
"%PYTHON_EXE%" scripts/verify_kyle_summary.py
if %ERRORLEVEL% NEQ 0 (
    echo [GAGAL] Terjadi kesalahan saat membaca berkas ringkasan!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ================================================================================
echo  [SUKSES] PENGUJIAN SELESAI DENGAN SUKSES!
echo  Format baru KYLE OCT.xlsx sudah 100%% didukung oleh aplikasi.
echo ================================================================================
echo.

:: Pilihan untuk membuka aplikasi GUI
set "OPEN_APP=N"
set /p "OPEN_APP=Apakah Anda ingin membuka aplikasi Web atau Desktop sekarang? [Y/N, default=N]: "
if /i "!OPEN_APP!"=="Y" (
    echo.
    echo Menjalankan aplikasi web server lokal Vite...
    cd webapp
    start http://localhost:5173
    call npm run dev
) else (
    echo.
    echo Pengujian selesai. Anda dapat menjalankan aplikasi kapan saja dengan run_desktop_app.bat
    pause
)
