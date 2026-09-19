package bo.org.bdp.certichain.service;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

@Service
public class HashService {

    /**
     * Genera el hash SHA-256 del contenido del documento.
     * El hash es lo que se registra en blockchain (no el documento completo).
     */
    public String sha256(String content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo calcular SHA-256", e);
        }
    }

    public String sha256(byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content);
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo calcular SHA-256", e);
        }
    }

    /**
     * Hash de auditoría de los datos del titular: SHA-256 de la concatenación
     * canónica {@code nombre|CI/DNI|fechaNacimiento} (campos recortados y con
     * {@code ""} si faltan). Es recalculable por un auditor a partir únicamente
     * de esos tres datos, permitiendo controlar la inmutabilidad: si se altera
     * cualquiera de ellos, el hash ya no coincide con el sellado en el ledger.
     */
    public String sha256Holder(String holderName, String holderDni, String holderDateOfBirth) {
        String canonical = String.join("|",
                trimToNull(holderName),
                trimToNull(holderDni),
                trimToNull(holderDateOfBirth));
        return sha256(canonical);
    }

    private static String trimToNull(String value) {
        return value == null ? "" : value.trim();
    }
}
