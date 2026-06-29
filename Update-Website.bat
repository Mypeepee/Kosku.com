@echo off
title Solusindo Aset - Build Ulang
cd /d "D:\SolusindoAset.com"

echo ==================================================
echo    SOLUSINDO ASET - Build Ulang (setelah ubah kode)
echo ==================================================
echo.

echo [INFO] Menghentikan server lama di port 3000 jika ada...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000"') do taskkill /F /PID %%a >nul 2>&1

echo [INFO] Membersihkan build lama...
if exist ".next" rmdir /S /Q ".next"

echo [INFO] Membangun versi produksi baru. Mohon tunggu 2-5 menit...
call npm run build
if errorlevel 1 (
    echo.
    echo [GAGAL] Build error. Periksa pesan merah di atas.
    pause
    exit /b 1
)

echo.
echo [SUKSES] Build selesai!
echo Sekarang klik dua kali "Jalankan-Website.bat" untuk menyalakan website.
pause
