package bo.org.bdp.certichain.controller;

import bo.org.bdp.certichain.dto.CertificateResponse;
import bo.org.bdp.certichain.dto.IssueCertificateRequest;
import bo.org.bdp.certichain.entity.User;
import bo.org.bdp.certichain.repository.UserRepository;
import bo.org.bdp.certichain.service.CertificateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/certificates")
@Tag(name = "Certificados", description = "Emision, consulta y gestion de certificados digitales")
public class CertificateController {

    private final CertificateService certificateService;
    private final UserRepository userRepository;

    public CertificateController(CertificateService certificateService, UserRepository userRepository) {
        this.certificateService = certificateService;
        this.userRepository = userRepository;
    }

    @PostMapping
    @Operation(summary = "Emitir certificado", description = "Calcula el hash, lo registra en blockchain y emite el certificado con QR")
    public ResponseEntity<CertificateResponse> issue(@Valid @RequestBody IssueCertificateRequest request,
                                                     Authentication authentication) {
        User issuer = resolveUser(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(certificateService.issue(request, issuer));
    }

    @GetMapping
    @Operation(summary = "Listar certificados", description = "Devuelve todos los certificados emitidos")
    public ResponseEntity<List<CertificateResponse>> findAll() {
        return ResponseEntity.ok(certificateService.findAll());
    }

    @GetMapping("/{uuid}")
    @Operation(summary = "Consultar certificado por UUID")
    public ResponseEntity<CertificateResponse> findByUuid(@PathVariable String uuid) {
        return ResponseEntity.ok(certificateService.findByUuid(uuid));
    }

    private User resolveUser(Authentication authentication) {
        String username = authentication.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("Usuario autenticado no encontrado"));
    }
}
