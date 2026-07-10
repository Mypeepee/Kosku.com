@echo off
title Solusindo Aset - Scraper Lelang (v2 API)
cd /d "D:\SolusindoAset.com"

echo ==================================================
echo    SCRAPER LELANG (terminal) v2 - lelang.go.id
echo    Mode: API langsung (tanpa Chrome) - gambar ^&
echo    lampiran LENGKAP, jelajah semua halaman.
echo ==================================================
echo.

set /p KATEGORI="Kategori (Rumah/Apartemen/Ruko/Tanah/Gudang/Hotel dan Villa/Toko/Pabrik) [Rumah]: "
if "%KATEGORI%"=="" set KATEGORI=Rumah

set /p MAXPAGES="Maksimal halaman [kosong = semua; 1 halaman = 100 listing]: "

set ARGS=--kategori "%KATEGORI%" --agent AG108 --concurrency 8
if not "%MAXPAGES%"=="" set ARGS=%ARGS% --max-pages %MAXPAGES%

echo.
echo [INFO] Menjalankan: node scripts/scrape-lelang.mjs %ARGS%
echo [INFO] Tekan CTRL+C untuk berhenti.
echo.

node scripts/scrape-lelang.mjs %ARGS%

echo.
echo [SELESAI] Tekan tombol apa saja untuk menutup.
pause >nul
