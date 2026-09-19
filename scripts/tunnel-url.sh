#!/usr/bin/env bash
# ============================================================
# CERTICHAIN BDP - Imprime la URL publica del tunel (demo).
# Espera hasta ~45s a que cloudflared entregue la URL
# https://<palabras>.trycloudflare.com y la muestra lista.
# Uso: make url  |  bash scripts/tunnel-url.sh
# ============================================================
set -euo pipefail

CONTAINER="certichain-tunnel"
SERVICE="tunnel"

wait_tunnel() {
  if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -qx 'true'; then
    echo "El tunel no esta corriendo. Ejecuta primero: make up" >&2
    return 1
  fi
  for _ in $(seq 1 45); do
    URL=$(docker logs "$CONTAINER" 2>&1 \
      | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' \
      | head -1 || true)
    if [ -n "${URL:-}" ]; then
      echo "$URL"
      return 0
    fi
    sleep 1
  done
  return 1
}

URL=$(wait_tunnel || true)
if [ -z "${URL:-}" ]; then
  echo "Todavia no hay URL publica. Chequee el tunel con: docker compose logs tunnel" >&2
  echo "Si no hay internet o Cloudflare lo bloquea, use: make tunnel-lan" >&2
  exit 1
fi

echo ""
echo "=============================================================="
echo "  ACCEDE A LA APP CON ESTA URL (no uses localhost):"
echo ""
echo "    $URL"
echo ""
echo "  Esa misma URL viaja en el QR: emiti un certificado y escanealo."
echo "=============================================================="
echo ""