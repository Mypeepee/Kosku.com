@echo off
:: ============================================
:: Fix Cloudflare Tunnel Service (Clean Install)
:: HARUS dijalankan sebagai Administrator!
:: ============================================

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Harus dijalankan sebagai Administrator!
    pause
    exit /b 1
)

set CLOUDFLARED_EXE=D:\dokumen\OM DAS Web AntiGravity\cloudflared.exe

echo.
echo ============================================
echo  FIX CLOUDFLARE TUNNEL SERVICE
echo ============================================
echo.

:: Step 1: Stop dan hapus service yang salah
echo [1/5] Menghentikan service dan proses...
sc stop cloudflared >nul 2>&1
timeout /t 3 /nobreak >nul
taskkill /f /im cloudflared.exe >nul 2>&1
timeout /t 2 /nobreak >nul
sc delete cloudflared >nul 2>&1
timeout /t 3 /nobreak >nul
echo       Done.

:: Step 2: Bersihkan registry key yang menyebabkan error "already exists"
echo [2/5] Membersihkan registry keys lama...
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\EventLog\Application\Cloudflared" /f >nul 2>&1
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\cloudflared" /f >nul 2>&1
timeout /t 2 /nobreak >nul
echo       Done.

:: Step 3: Bersihkan file config lama
echo [3/5] Membersihkan config lama...
if exist "C:\Program Files (x86)\cloudflared\config.yml" del /f "C:\Program Files (x86)\cloudflared\config.yml"
if exist "C:\ProgramData\cloudflared\token" del /f "C:\ProgramData\cloudflared\token"
echo       Done.

:: Step 4: Install ulang dengan cloudflared service install (cara yang benar)
echo [4/5] Menginstall Cloudflare Tunnel sebagai Windows Service...
echo.
"%CLOUDFLARED_EXE%" service install eyJhIjoiMjlkMjc0ODhlMTAxZjAyYjdiZDYwNTlmYWE0N2IzMjMiLCJ0IjoiYzU2NjBmNzQtNGQ0ZC00OTlmLTk4MGUtMTU2YmU3N2ZiN2YwIiwicyI6IjEwanJGVlJFa1dzZmt6eHpIZXFLNWs4K1FMdGVERUFFbnFTYU5VZUI4VkU9In0=
echo.

if %errorlevel% neq 0 (
    echo !! cloudflared service install GAGAL lagi.
    echo.
    echo Coba cara manual: buka PowerShell as Admin dan jalankan:
    echo   New-Service -Name "cloudflared" -BinaryPathName '"%CLOUDFLARED_EXE%" tunnel run --token ...' -StartupType Automatic
    pause
    exit /b 1
)

:: Step 5: Verifikasi
echo [5/5] Memverifikasi service...
timeout /t 8 /nobreak >nul
echo.
echo --- Status Service ---
sc query cloudflared
echo.
sc qc cloudflared
echo.

sc query cloudflared | findstr "RUNNING" >nul 2>&1
if %errorlevel% equ 0 (
    echo ============================================
    echo  SUKSES! Cloudflare Tunnel berjalan dengan
    echo  benar sebagai Windows Service.
    echo ============================================
) else (
    echo  Service belum running, coba: sc start cloudflared
)

echo.
pause
