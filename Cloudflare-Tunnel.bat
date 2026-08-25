@echo off
title Cloudflare Tunnel - Auto Restart
cd /d "D:\SolusindoAset.com"

echo ==================================================
echo    CLOUDFLARE TUNNEL - WATCHDOG (Auto Restart)
echo ==================================================
echo.
echo  Tunnel akan otomatis restart jika mati.
echo  Tekan Ctrl+C untuk menghentikan.
echo ==================================================
echo.

:loop
echo.
echo [%date% %time%] Memulai Cloudflare Tunnel...
echo ---------------------------------------------------
"D:\dokumen\OM DAS Web AntiGravity\cloudflared.exe" tunnel run --token eyJhIjoiMjlkMjc0ODhlMTAxZjAyYjdiZDYwNTlmYWE0N2IzMjMiLCJ0IjoiYzU2NjBmNzQtNGQ0ZC00OTlmLTk4MGUtMTU2YmU3N2ZiN2YwIiwicyI6IjEwanJGVlJFa1dzZmt6eHpIZXFLNWs4K1FMdGVERUFFbnFTYU5VZUI4VkU9In0=
echo.
echo [%date% %time%] !! TUNNEL MATI - Restart dalam 5 detik...
timeout /t 5 /nobreak >nul
goto loop
