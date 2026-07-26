#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f ai-gateway-server/config.php ]; then
  cp ai-gateway-server/config.example.php ai-gateway-server/config.php
  echo "Created ai-gateway-server/config.php. Set a secure token, then run this script again."
  exit 1
fi
exec php -S 127.0.0.1:8765 ai-gateway-server/router.php
