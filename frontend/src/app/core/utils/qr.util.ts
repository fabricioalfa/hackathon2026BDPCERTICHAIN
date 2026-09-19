import * as QRCode from 'qrcode';

/**
 * URL pública de verificación que codifica el QR, construida con el origen
 * desde el que se está VIENDO la app (localhost, LAN o el túnel de la demo).
 * Así el QR siempre resulta escaneable desde el celular, aunque el
 * certificado se haya emitido desde otro origen.
 *
 * El UUID va en la RUTA (`/verify/{uuid}`) y no en el query string porque
 * algunos escáneres de QR de celular descartan los parámetros `?uuid=...` y
 * abrirían la página sin datos.
 */
export function verificationUrl(uuid: string): string {
  const origin = window.location.origin || 'http://localhost:4200';
  return `${origin}/verify/${uuid}`;
}

/**
 * Genera (en el cliente) la imagen PNG en base64 del QR de verificación.
 * Si la generación falla, devuelve el QR del backend como respaldo.
 */
export async function qrDataUrlFor(uuid: string, fallback?: string): Promise<string> {
  try {
    return await QRCode.toDataURL(verificationUrl(uuid), { width: 240, margin: 1 });
  } catch {
    return fallback ?? '';
  }
}