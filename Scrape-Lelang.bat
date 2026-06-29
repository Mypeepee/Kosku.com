@echo off
title Solusindo Aset - Scraper Lelang
cd /d "D:\SolusindoAset.com"

echo ==================================================
echo    SCRAPER LELANG (terminal) - lelang.go.id
echo ==================================================
echo.

set /p KATEGORI="Kategori (Rumah/Apartemen/Ruko/Tanah/Gudang/Hotel dan Villa/Toko/Pabrik) [Rumah]: "
if "%KATEGORI%"=="" set KATEGORI=Rumah

set /p MAXPAGES="Maksimal halaman [kosong = sampai habis]: "

set ARGS=--kategori "%KATEGORI%"
if not "%MAXPAGES%"=="" set ARGS=%ARGS% --max-pages %MAXPAGES%

echo.
echo [INFO] Menjalankan: node scripts/scrape-lelang.mjs %ARGS%
echo [INFO] Tekan CTRL+C untuk berhenti.
echo.

node scripts/scrape-lelang.mjs %ARGS%

echo.
echo [SELESAI] Tekan tombol apa saja untuk menutup.
pause >nul
