@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Khoi dong AI ToHieuQuiz

:: Yeu cau quyen Administrator neu chua co.
fltmc >nul 2>&1
if errorlevel 1 (
  echo Dang yeu cau quyen Administrator...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
  exit /b
)

echo.
echo ================================================
echo       KHOI DONG HE THONG AI TOHIEUQUIZ
echo ================================================
echo.

:: Giu endpoint cu ai.thitong.site hoat dong.
sc.exe query Cloudflared | findstr /I "RUNNING" >nul
if errorlevel 1 (
  echo [1/3] Dang bat Cloudflared cu...
  net start Cloudflared >nul 2>&1
) else (
  echo [1/3] Cloudflared cu dang chay.
)

:: Bat AIClient-2-API.
echo [2/3] Dang bat AIClient-2-API...
schtasks.exe /Query /TN "AIClient2API Production" >nul 2>&1
if errorlevel 1 (
  echo LOI: Khong tim thay Scheduled Task "AIClient2API Production".
  goto :failed
)
schtasks.exe /Run /TN "AIClient2API Production" >nul 2>&1

:: Bat tunnel VPC moi cua ToHieuQuiz.
echo [3/3] Dang bat ToHieuQuiz AI Tunnel...
schtasks.exe /Query /TN "ToHieuQuiz AI Tunnel" >nul 2>&1
if errorlevel 1 (
  echo LOI: Khong tim thay Scheduled Task "ToHieuQuiz AI Tunnel".
  goto :failed
)
schtasks.exe /Run /TN "ToHieuQuiz AI Tunnel" >nul 2>&1

echo.
echo Dang cho AIClient-2-API va VPC Tunnel san sang...
for /L %%I in (1,1,30) do (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $h=Invoke-WebRequest 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 3; $m=Invoke-WebRequest 'http://127.0.0.1:20243/metrics' -UseBasicParsing -TimeoutSec 3; if ($h.StatusCode -eq 200 -and $m.Content -match 'cloudflared_tunnel_ha_connections\s+[1-9]') { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 goto :ready
  timeout.exe /t 2 /nobreak >nul
)

goto :failed

:ready
echo.
echo ================================================
echo THANH CONG: He thong AI da san sang.
echo Local UI : http://127.0.0.1:3000
echo AI API   : https://ai.thtohieu.com/v1
echo ================================================
echo.
if /I "%~1"=="--no-open" exit /b 0
start "" "http://127.0.0.1:3000"
timeout.exe /t 4 /nobreak >nul
exit /b 0

:failed
echo.
echo ================================================
echo KHONG THE KHOI DONG DAY DU HE THONG AI.
echo Hay chup man hinh cua so nay de kiem tra.
echo ================================================
echo.
pause
exit /b 1