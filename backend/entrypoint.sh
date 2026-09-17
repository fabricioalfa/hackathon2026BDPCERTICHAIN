#!/bin/sh
# ============================================================
# CERTICHAIN BDP - Entrypoint del backend
# 1) Si corre como root, arregla el propietario del directorio
#    de documentos (los volumenes creados por Docker nacen como
#    root) y luego baja privilegios al usuario 'spring'.
# 2) Si ya corre como 'spring', arranca directamente.
# ============================================================
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/documents
  chown -R spring:spring /app/documents
  exec su -s /bin/sh spring -c 'exec java -jar /app/app.jar'
fi

exec java -jar /app/app.jar