@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Menjalankan Seluruh Pengujian (All Tests)

echo ================================================================================
echo  [TEST SUITE] MENJALANKAN SELURUH PENGUJIAN REGRESI DAN ADAPTER BARU
echo ================================================================================
echo.

set "PYTHON_EXE="
if exist "C:\Python312\python.exe" (
    set "PYTHON_EXE=C:\Python312\python.exe"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else (
    set "PYTHON_EXE=python"
)

echo [1/3] Menjalankan Pipeline Unit Test (SBF DSP, Hampel, Bucketing, ANOVA)...
"%PYTHON_EXE%" tests/test_pipeline.py
if %ERRORLEVEL% NEQ 0 (
    echo [GAGAL] Pipeline test gagal!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Menjalankan Kyle OCT Multi-Protocol Unit Test...
"%PYTHON_EXE%" tests/test_kyle_oct.py
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
echo  [OK] SELURUH TEST BERHASIL DENGAN NILAI 100%%!
echo ================================================================================
pause
