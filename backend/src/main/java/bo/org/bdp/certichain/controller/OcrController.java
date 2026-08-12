package bo.org.bdp.certichain.controller;

import bo.org.bdp.certichain.service.OcrService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;

@RestController
@RequestMapping("/api/ocr")
@Tag(name = "OCR", description = "Lectura de carnet/folio con Tesseract")
public class OcrController {

    private final OcrService ocrService;

    public OcrController(OcrService ocrService) {
        this.ocrService = ocrService;
    }

    @PostMapping("/extract")
    @Operation(summary = "Extraer texto de un documento",
            description = "Recibe una imagen (carnet/folio) y devuelve el texto extraido y el DNI detectado")
    public ResponseEntity<OcrService.OcrResult> extract(@RequestParam("file") MultipartFile file) throws IOException {
        String base64 = Base64.getEncoder().encodeToString(file.getBytes());
        return ResponseEntity.ok(ocrService.extractFromBase64(base64));
    }
}
