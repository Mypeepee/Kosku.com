@echo off
title Cek RAM - Solusindo Aset
cd /d "D:\SolusindoAset.com"

echo ==================================================
echo    CEK SISA RAM
echo ==================================================
echo.

powershell -NoProfile -Command ^
  "$o=Get-CimInstance Win32_OperatingSystem;" ^
  "$free=$o.FreePhysicalMemory/1MB; $tot=$o.TotalVisibleMemorySize/1MB; $pakai=$tot-$free;" ^
  "Write-Host ('RAM total   : {0:N1} GB' -f $tot);" ^
  "Write-Host ('RAM terpakai: {0:N1} GB' -f $pakai);" ^
  "Write-Host ('RAM bebas   : {0:N1} GB' -f $free);" ^
  "Write-Host '';" ^
  "if($free -lt 1.5){ Write-Host 'SARAN: RAM mepet -> tutup Chrome/website dulu, atau pakai --concurrency 1.' -ForegroundColor Red }" ^
  "elseif($free -lt 3){ Write-Host 'SARAN: cukup untuk scrape dengan --concurrency 1.' -ForegroundColor Yellow }" ^
  "else{ Write-Host 'SARAN: aman, bisa --concurrency 2 atau 3 untuk lebih cepat.' -ForegroundColor Green }"

echo.
pause
