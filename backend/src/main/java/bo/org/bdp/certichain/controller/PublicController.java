package bo.org.bdp.certichain.controller;

import bo.org.bdp.certichain.dto.CertificateResponse;
import bo.org.bdp.certichain.service.CertificateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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
            description = "Valida un certificado por su UUID y el hash del documento (consulta blockchain)")
    public ResponseEntity<CertificateResponse> verify(@RequestParam String uuid,
                                                      @RequestParam String hash) {
        return ResponseEntity.ok(certificateService.verify(uuid, hash));
    }

    @GetMapping("/certificate")
    @Operation(summary = "Consultar certificado publico", description = "Permite ver los datos del certificado desde el QR")
    public ResponseEntity<CertificateResponse> getPublicCertificate(@RequestParam String uuid) {
        return ResponseEntity.ok(certificateService.findByUuid(uuid));
    }
}
