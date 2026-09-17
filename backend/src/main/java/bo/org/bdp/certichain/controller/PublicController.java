package bo.org.bdp.certichain.controller;

import bo.org.bdp.certichain.dto.CertificateResponse;
import bo.org.bdp.certichain.dto.VerificationResponse;
import bo.org.bdp.certichain.service.CertificateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
@Tag(name = "Verificacion publica", description = "Endpoints sin autenticacion para validar certificados (QR)")
public class PublicController {

    private final CertificateService certificateService;

    public PublicController(CertificateService certificateService) {
        this.certificateService = certificateService;
    }

    @GetMapping("/verify")
    @Operation(summary = "Verificar certificado",
            description = "Valida por UUID (consulta el ledger). El hash es opcional: si se indica, ademas se verifica la integridad del documento")
    public ResponseEntity<VerificationResponse> verify(@RequestParam String uuid,
                                                       @RequestParam(required = false) String hash) {
        return ResponseEntity.ok(certificateService.verify(uuid, hash));
    }

    @GetMapping("/certificate")
    @Operation(summary = "Consultar certificado publico", description = "Permite ver los datos del certificado desde el QR")
    public ResponseEntity<CertificateResponse> getPublicCertificate(@RequestParam String uuid) {
        return ResponseEntity.ok(certificateService.findByUuid(uuid));
    }

    @GetMapping("/certificate/{uuid}/document")
    @Operation(summary = "Descargar documento custodado",
            description = "Devuelve la imagen/escaneo original del certificado (verificable contra la fotocopia fisica)")
    public ResponseEntity<byte[]> downloadPublicDocument(@PathVariable String uuid) {
        CertificateService.DocumentData doc = certificateService.loadDocument(uuid);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(doc.mime()))
                .header("Content-Disposition", "inline; filename=\"" + uuid + "\"")
                .body(doc.bytes());
    }
}