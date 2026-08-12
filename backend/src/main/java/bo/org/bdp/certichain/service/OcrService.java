package bo.org.bdp.certichain.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;

@Service
public class OcrService {

    private static final Logger log = LoggerFactory.getLogger(OcrService.class);

    private final String ocrUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OcrService(@Value("${ocr.url:http://localhost:8090/api/ocr}") String ocrUrl) {
        this.ocrUrl = ocrUrl;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    /**
     * Envia una imagen (base64) al microservicio OCR y extrae el DNI detectado,
     * ademas de devolver el texto crudo.
     */
    public OcrResult extractFromBase64(String base64Content) {
        try {
            String jsonBody = objectMapper.writeValueAsString(Map.of("base64", base64Content));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ocrUrl + "/extract-base64"))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("OCR HTTP {} - {}", response.statusCode(), response.body());
            }

            JsonNode json = objectMapper.readTree(response.body());
            String text = json.path("text").asText("");
            String dni = json.hasNonNull("detectedDni") ? json.get("detectedDni").asText() : null;
            return new OcrResult(text, dni);
        } catch (Exception e) {
            log.warn("OCR no disponible ({}) - se continua sin extraccion", e.getMessage());
            return new OcrResult("", null);
        }
    }

    public record OcrResult(String text, String detectedDni) {}
}
