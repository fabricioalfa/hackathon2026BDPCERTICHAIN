package bo.org.bdp.certichain.dto;

/**
 * Resultado de una verificacion publica de certificado.
 * - Solo UUID: confirma que el documento esta registrado en el ledger.
 * - UUID + hash: confirma ademas que el hash proporcionado es el sellado.
 */
public record VerificationResponse(boolean valid, String message, CertificateResponse certificate) {}