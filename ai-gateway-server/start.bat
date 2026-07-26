@echo off
cd /d %~dp0\..
if not exist ai-gateway-server\config.php (
  copy ai-gateway-server\config.example.php ai-gateway-server\config.php >nul
  echo Created ai-gateway-server\config.php. Set a secure token, then run this file again.
  pause
  exit /b 1
)
php -S 127.0.0.1:8765 ai-gateway-server/router.php
