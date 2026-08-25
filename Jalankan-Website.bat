@echo off
setlocal enabledelayedexpansion
title Solusindo Aset - Launcher
cd /d "D:\SolusindoAset.com"

echo ==================================================
echo    SOLUSINDO ASET - Menjalankan Website
echo ==================================================
echo.

REM ============================================================
REM  0) PENGAMAN: "npm run dev" tidak boleh jalan bersamaan.
REM     next dev menimpa folder .next dan menghapus BUILD_ID,
REM     sehingga server produksi menyajikan versi lama / hang.
REM ============================================================
powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*SolusindoAset*' -and $_.CommandLine -like '*next*dev*' }; if ($p) { exit 1 }; exit 0"
if errorlevel 1 (
    echo [BERHENTI] Terdeteksi "npm run dev" sedang berjalan.
    echo            Mode dev menimpa folder .next dan MERUSAK build produksi.
    echo            Tutup dulu jendela dev itu, baru jalankan launcher ini.
    echo.
    pause
    exit /b 1
)

REM --- Kalau port 3000 masih dipakai, tawarkan restart ---
netstat -ano | findstr "LISTENING" | findstr ":3000" >nul
if errorlevel 1 goto :port_bebas

echo [PERHATIAN] Port 3000 sudah dipakai - berarti server lama masih jalan.
echo             Untuk memakai kode terbaru, server lama harus dimatikan dulu.
echo.
choice /C YT /N /M "Matikan server lama lalu jalankan ulang? [Y=ya, T=tidak] "
if errorlevel 2 goto :batal
echo [INFO] Mematikan server lama di port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 3 >nul
goto :port_bebas

:batal
echo.
echo [BATAL] Server lama dibiarkan jalan. Tidak ada yang diubah.
pause
exit /b 0

:port_bebas

REM ============================================================
REM  1) Tentukan apakah perlu build ulang.
REM     Patokannya BUKAN sekadar ada/tidaknya BUILD_ID, tapi
REM     apakah build terakhir dibuat dari commit yang sama
REM     dengan kode saat ini. Tanpa ini, "git pull" tidak akan
REM     pernah terlihat di website.
REM ============================================================
set "HEAD_COMMIT="
for /f "delims=" %%i in ('git rev-parse HEAD 2^>nul') do set "HEAD_COMMIT=%%i"

set "BUILT_COMMIT="
if exist ".next\.built-from-commit" set /p BUILT_COMMIT=<".next\.built-from-commit"

set "PERLU_BUILD="
if not exist ".next\BUILD_ID" set "PERLU_BUILD=1"
if not "%HEAD_COMMIT%"=="%BUILT_COMMIT%" set "PERLU_BUILD=1"

if not defined PERLU_BUILD goto :jalankan

echo [INFO] Perlu build ulang.
echo        Commit kode saat ini : %HEAD_COMMIT%
echo        Build terakhir dari  : %BUILT_COMMIT%
echo.

REM --- Peringatan kalau skema database ikut berubah ---
if defined BUILT_COMMIT (
    git diff --name-only %BUILT_COMMIT% %HEAD_COMMIT% -- prisma/schema.prisma 2>nul | findstr /i "schema.prisma" >nul
    if not errorlevel 1 (
        echo [PENTING] prisma/schema.prisma BERUBAH sejak build terakhir.
        echo           Database kemungkinan perlu disesuaikan, jika tidak
        echo           akan muncul error "table/column does not exist".
        echo           Cek dulu dengan perintah ini di terminal terpisah:
        echo             npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
        echo           Kalau isinya aman ^(tidak ada DROP^), terapkan dengan:
        echo             npx prisma db push --skip-generate
        echo.
        pause
    )
)

echo [INFO] Memasang dependency ^(npm install^)...
call npm install
if errorlevel 1 (
    echo.
    echo [GAGAL] npm install error. Periksa pesan merah di atas.
    pause
    exit /b 1
)

echo [INFO] Menyegarkan Prisma Client...
call npx prisma generate

REM --- Hapus sisa build lama supaya tidak tercampur ---
if exist ".next" (
    echo [INFO] Membersihkan folder .next lama...
    rmdir /s /q ".next"
)

echo [INFO] Membangun versi produksi, mohon tunggu 3-10 menit...
call npm run build
if errorlevel 1 (
    echo.
    echo [GAGAL] Build error. Periksa pesan merah di atas.
    echo         Kalau pesannya soal "memory allocation ... failed",
    echo         berarti RAM kurang. Tutup dulu aplikasi berat
    echo         ^(Ollama/LM Studio/Chrome^), lalu ulangi.
    pause
    exit /b 1
)

REM --- Catat commit yang dipakai build ini ---
> ".next\.built-from-commit" echo %HEAD_COMMIT%
echo [OK] Build selesai untuk commit %HEAD_COMMIT%
echo.

:jalankan
if not defined PERLU_BUILD echo [INFO] Build sudah sesuai kode terbaru. Lewati build.

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
start "Cloudflare Tunnel" cmd /k "D:\SolusindoAset.com\Cloudflare-Tunnel.bat"

echo.
echo [SELESAI] Website berjalan. Jendela ini akan tertutup otomatis.
timeout /t 6 >nul
