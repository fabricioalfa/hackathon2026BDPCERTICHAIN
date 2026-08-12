package bo.org.bdp.certichain.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.Base64;

@Service
public class QrService {

    /**
     * Genera un codigo QR (PNG) en base64 a partir de un texto/URL.
     */
    public String generateQrBase64(String content, int size) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return Base64.getEncoder().encodeToString(out.toByteArray());
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo generar el codigo QR", e);
        }
    }

    /**
     * Construye la URL publica de verificacion que codifica el QR.
     */
    public String buildVerificationUrl(String frontendBaseUrl, String uuid) {
        return frontendBaseUrl + "/verify?uuid=" + uuid;
    }
}
