#!/usr/bin/env bash
# ============================================================
# CERTICHAIN BDP - Tunel publico para la demo (sin cuenta)
#
# Expone el frontend (por defecto http://localhost:4200) con una URL
# publica https://xxxx.trycloudflare.com que funciona desde el celular.
#
# Uso:
#   ./scripts/tunnel.sh [puerto]          # por defecto 4200
#   make tunnel
#
# El QR de verificacion se genera con el origen desde el que se emite,
# asi que NO hace falta configurar nada mas: emite desde la URL del
# tunel y el QR ya quedará escaneable. No muevas/cierres esta terminal.
#
# Si no tenes internet o Cloudflare fallara, usa "tunnel-lan"
# (./scripts/tunnel.sh lan) que muestra la IP local de tu wifi.
# ============================================================
set -euo pipefail

PORT="${1:-4200}"

if [ "${PORT}" = "lan" ] || [ "${PORT}" = "--lan" ]; then
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ -z "${IP}" ]; then
    echo "No se pudo detectar la IP local."
    exit 1
  fi
  echo "=== Demo por LAN ==="
  echo "Conecta tu celular a la MISMA red wifi y abre:"
  echo "  http://${IP}:${PORT}"
  echo "Y para que el QR apunte aca, emití usando esa misma URL."
  exit 0
fi

echo "Abriendo tunel hacia http://localhost:${PORT} ..."
echo "Espera el mensaje que dice la URL  https://....trycloudflare.com"
echo "Abri la web usando ESA url (no localhost): el QR se genera solo."
echo "Presiona Ctrl+C cuando quieras cerrar el tunel."
echo

if command -v cloudflared >/dev/null 2>&1; then
  cloudflared tunnel --url "http://localhost:${PORT}"
else
  echo "[cloudflared] no encontrado en el host. Usando imagen de Docker..."
  docker pull cloudflare/cloudflared:latest >/dev/null 2>&1 || true
  docker run --rm -it --network host cloudflare/cloudflared tunnel --url "http://localhost:${PORT}"
fi