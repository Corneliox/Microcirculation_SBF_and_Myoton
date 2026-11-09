@echo off
chcp 65001 > nul
title Menjalankan Seluruh Pengujian (All Tests)

echo ================================================================================
echo  🧪 MENJALANKAN SELURUH PENGUJIAN REGRESI & ADAPTER BARU
echo ================================================================================
echo.

echo [1/3] Menjalankan Pipeline Unit Test (SBF DSP, Hampel, Bucketing, ANOVA)...
python tests/test_pipeline.py
if %ERRORLEVEL% NEQ 0 (
    echo [GAGAL] Pipeline test gagal!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Menjalankan Kyle OCT Multi-Protocol Unit Test...
python tests/test_kyle_oct.py
if %ERRORLEVEL% NEQ 0 (
    echo [GAGAL] Kyle OCT test gagal!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Menjalankan JavaScript Parser Test...
node webapp/test_kyle_parser.js
if %ERRORLEVEL% NEQ 0 (
    echo [GAGAL] JS test gagal!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ================================================================================
echo  ✅ SELURUH TEST BERHASIL DENGAN NILAI 100%%!
echo ================================================================================
pause
