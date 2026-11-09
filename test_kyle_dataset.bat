@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
title Uji Dataset Baru KYLE OCT - Microcirculation & Myoton Suite

echo ================================================================================
echo  🔬 UJI VERIFIKASI DATASET BARU: KYLE OCT.xlsx
echo  Microcirculation (SBF) ^& Myotonometer Research Suite
echo ================================================================================
echo.

:: 1. Cek ketersediaan Python
python --version > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python tidak terdeteksi di sistem PATH!
    echo Silakan pastikan Python 3.10+ sudah terinstal.
    pause
    exit /b 1
)

:: 2. Jalankan Unit Test Python (test_kyle_oct.py)
echo [1/3] Menjalankan Unit Test Python (test_kyle_oct.py)...
python tests/test_kyle_oct.py
if %ERRORLEVEL% NEQ 0 (
    echo [GAGAL] Terjadi kesalahan pada pengujian Python adapter!
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Unit Test Python LULUS 100%%!
echo.

:: 3. Jalankan Pengujian Parser JavaScript (test_kyle_parser.js)
echo [2/3] Menjalankan Pengujian Parser JavaScript (Node.js)...
node -v > nul 2>&1
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
python scripts/verify_kyle_summary.py
if %ERRORLEVEL% NEQ 0 (
    echo [GAGAL] Terjadi kesalahan saat membaca berkas ringkasan!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ================================================================================
echo  ✅ PENGUJIAN SELESAI DENGAN SUKSES!
echo  Format baru KYLE OCT.xlsx sudah 100%% didukung oleh aplikasi.
echo ================================================================================
echo.

:: Pilihan untuk membuka aplikasi GUI
set /p OPEN_APP="Apakah Anda ingin membuka aplikasi Web / Desktop sekarang? (Y/N): "
if /i "%OPEN_APP%"=="Y" (
    echo.
    echo Menjalankan aplikasi web server lokal (Vite)...
    cd webapp
    start http://localhost:5173
    npm run dev
) else (
    echo.
    echo Terima kasih! Anda dapat menjalankan aplikasi kapan saja dengan run_desktop_app.bat
    pause
)
