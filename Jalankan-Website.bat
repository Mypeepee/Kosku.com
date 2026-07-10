@echo off
title Solusindo Aset - Launcher
cd /d "D:\SolusindoAset.com"

echo ==================================================
echo    SOLUSINDO ASET - Menjalankan Website (CEPAT)
echo ==================================================
echo.

REM --- 1) Pastikan sudah ada hasil build produksi ---
if not exist ".next\BUILD_ID" (
    echo [INFO] Belum ada build produksi. Membangun dulu, mohon tunggu 2-5 menit...
    call npm run build
    if errorlevel 1 (
        echo.
        echo [GAGAL] Build error. Periksa pesan merah di atas.
        pause
        exit /b 1
    )
)

REM --- 2) Jalankan SERVER PRODUKSI di jendela terpisah ---
echo [INFO] Menjalankan server produksi...
start "Website (Production)" powershell -NoExit -Command "cd 'D:\SolusindoAset.com'; npm run start"

REM --- 3) Tunggu sampai server benar-benar siap di port 3000 ---
echo [INFO] Menunggu server siap di http://localhost:3000 ...
:waitport
timeout /t 3 >nul
netstat -ano | findstr "LISTENING" | findstr ":3000" >nul
if errorlevel 1 goto waitport

REM --- 4) Baru nyalakan CLOUDFLARE TUNNEL ---
echo [INFO] Server siap. Menyalakan Cloudflare Tunnel...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --credentials-file C:\Users\liemi\.cloudflared\c175aab8-2f40-4512-93d5-c0e480e881f5.json run c175aab8-2f40-4512-93d5-c0e480e881f5"

echo.
echo [SELESAI] Website berjalan. Jendela ini akan tertutup otomatis.
timeout /t 6 >nul
