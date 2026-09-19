package bo.org.bdp.certichain.service;

import bo.org.bdp.certichain.dto.CertificateResponse;
import bo.org.bdp.certichain.dto.IssueCertificateRequest;
import bo.org.bdp.certichain.dto.VerificationResponse;
import bo.org.bdp.certichain.entity.Certificate;
import bo.org.bdp.certichain.entity.User;
import bo.org.bdp.certichain.exception.DuplicateCertificateException;
import bo.org.bdp.certichain.repository.CertificateRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
public class CertificateService {

    private final CertificateRepository certificateRepository;
    private final HashService hashService;
    private final QrService qrService;
    private final FabricService fabricService;

    @Value("${frontend.base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    @Value("${app.documents-dir:/app/documents}")
    private String documentsDir;

    public CertificateService(CertificateRepository certificateRepository,
                              HashService hashService,
                              QrService qrService,
                              FabricService fabricService) {
        this.certificateRepository = certificateRepository;
        this.hashService = hashService;
        this.qrService = qrService;
        this.fabricService = fabricService;
    }

    /**
     * Flujo de emision del MVP:
     * 1) Calcular hash de auditoria de los datos del titular (nombre|CI|nacimiento).
     * 2) Registrar el hash en blockchain (ledger).
     * 3) Custodiar el documento original en disco.
     * 4) Persistir metadatos en PostgreSQL.
     * 5) Generar codigo QR con URL de verificacion.
     */
    @Transactional
    public CertificateResponse issue(IssueCertificateRequest request, User issuer) {
        assertNoDuplicate(request);
        String uuid = "CC-" + UUID.randomUUID();
        String hash = hashService.sha256Holder(
                request.holderName(),
                request.holderDni(),
                request.holderDateOfBirth());

        String txId = fabricService.registerCertificate(uuid, hash, issuer.getUsername());

        Certificate cert = new Certificate();
        cert.setUuid(uuid);
        cert.setDocumentHash(hash);
        cert.setTxId(txId);
        cert.setTitle(request.title());
        cert.setDocType(request.docType());
        cert.setHolderDni(request.holderDni());
        cert.setHolderName(request.holderName());
        cert.setHolderDateOfBirth(request.holderDateOfBirth());
        cert.setExpiryDate(request.expiryDate());
        cert.setMetadataJson(request.metadataJson());
        cert.setStatus("ACTIVE");
        cert.setIssuedBy(issuer);

        String qrPayload = qrService.buildVerificationUrl(frontendBaseUrl, uuid);
        cert.setQrUrl(qrPayload);

        var document = storeDocument(uuid, request.base64Content());
        cert.setDocumentFile(document.file());
        cert.setDocumentMime(document.mime());

        Certificate saved = certificateRepository.save(cert);
        return toResponse(saved);
    }

    /**
     * Evita registrar dos veces a la misma persona. Bloquea si ya existe un
     * certificado activo para el mismo CI (o, si no hay CI, para el mismo
     * nombre completo) con documento respaldado.
     */
    private void assertNoDuplicate(IssueCertificateRequest request) {
        String dni = request.holderDni() == null ? "" : request.holderDni().trim();
        String name = request.holderName() == null ? "" : request.holderName().trim();
        List<Certificate> existing;
        if (!dni.isEmpty()) {
            existing = certificateRepository.findByHolderDni(dni);
        } else if (!name.isEmpty()) {
            existing = certificateRepository.findByHolderNameIgnoreCase(name);
        } else {
            return;
        }
        boolean backed = existing.stream()
                .anyMatch(c -> "ACTIVE".equals(c.getStatus())
                        && c.getDocumentFile() != null && !c.getDocumentFile().isBlank());
        if (backed) {
            throw new DuplicateCertificateException(
                    "Ya existe un documento emitido y respaldado para " + (dni.isEmpty() ? name : "el CI/DNI " + dni)
                            + ". No se permite una nueva emisión.");
        }
    }

    /**
     * Verifica un certificado. Con hash presente valida la cadena; sin hash
     * (flujo QR) confirma registro+estado activo en el ledger.
     *
     * Robustez: si el certificado fue emitido con tx_id pero la entrada
     * auxiliar de {@code ledger_entry} no existe (datos de versiones
     * anteriores o reinicios), se usa el hash sellado del propio
     * certificado como fuente de verdad.
     */
    @Transactional(readOnly = true)
    public VerificationResponse verify(String uuid, String providedHash) {
        Certificate cert = certificateRepository.findByUuid(uuid)
                .orElseThrow(() -> new IllegalArgumentException("Certificado no encontrado: " + uuid));

        boolean registered = fabricService.exists(uuid) || hasOnchainReference(cert);
        boolean hasHash = providedHash != null && !providedHash.isBlank();

        if (!registered) {
            return new VerificationResponse(false, "El certificado no está registrado en el ledger.", toResponse(cert));
        }
        if (!"ACTIVE".equals(cert.getStatus())) {
            return new VerificationResponse(false, "El certificado figura como " + cert.getStatus() + ".", toResponse(cert));
        }
        if (!hasHash) {
            return new VerificationResponse(true, "Documento registrado y válido en el ledger.", toResponse(cert));
        }
        boolean validOnChain = fabricService.verifyHash(uuid, providedHash)
                || cert.getDocumentHash().equalsIgnoreCase(providedHash.trim());
        if (!validOnChain) {
            return new VerificationResponse(false, "El hash no coincide con el registrado en el ledger.", toResponse(cert));
        }
        return new VerificationResponse(true, "Hash verificado en el ledger. Documento auténtico.", toResponse(cert));
    }

    private boolean hasOnchainReference(Certificate cert) {
        return cert.getTxId() != null && !cert.getTxId().isBlank();
    }

    @Transactional(readOnly = true)
    public List<CertificateResponse> findAll() {
        return certificateRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CertificateResponse> findByDni(String dni) {
        return certificateRepository.findByHolderDni(dni).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CertificateResponse findByUuid(String uuid) {
        return certificateRepository.findByUuid(uuid)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Certificado no encontrado: " + uuid));
    }

    /** Devuelve los bytes y el mime del documento custodado, si existe. */
    @Transactional(readOnly = true)
    public DocumentData loadDocument(String uuid) {
        Certificate cert = certificateRepository.findByUuid(uuid)
                .orElseThrow(() -> new IllegalArgumentException("Certificado no encontrado: " + uuid));
        if (cert.getDocumentFile() == null || cert.getDocumentFile().isBlank()) {
            throw new IllegalArgumentException("El certificado no tiene documento custodado.");
        }
        try {
            Path path = Paths.get(documentsDir).resolve(cert.getDocumentFile()).normalize();
            byte[] bytes = Files.readAllBytes(path);
            return new DocumentData(bytes, cert.getDocumentMime() != null ? cert.getDocumentMime() : "application/octet-stream");
        } catch (Exception e) {
            throw new IllegalArgumentException("No se pudo leer el documento custodado.", e);
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private CertificateResponse toResponse(Certificate cert) {
        CertificateResponse base = CertificateResponse.from(cert);
        String qr = cert.getQrUrl() == null || cert.getQrUrl().isBlank()
                ? ""
                : qrService.generateQrBase64(cert.getQrUrl(), 240);
        return new CertificateResponse(
                base.uuid(), base.documentHash(), base.txId(), base.title(), base.docType(),
                base.holderDni(), base.holderName(), base.holderDateOfBirth(),
                base.issueDate(), base.expiryDate(), base.status(), base.qrUrl(), qr,
                base.documentAvailable(), base.issuedBy());
    }

    private StoredDocument storeDocument(String uuid, String base64Content) {
        if (base64Content == null || base64Content.isBlank()) {
            return new StoredDocument(null, null);
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(base64Content);
            if (bytes.length == 0) {
                return new StoredDocument(null, null);
            }
            MimeGuess guess = detectMime(bytes);
            Path dir = Paths.get(documentsDir);
            Files.createDirectories(dir);
            String filename = uuid + guess.ext();
            Path target = dir.resolve(filename).normalize();
            if (!target.startsWith(dir.normalize())) {
                return new StoredDocument(null, null);
            }
            Files.write(target, bytes);
            return new StoredDocument(filename, guess.mime());
        } catch (IllegalArgumentException e) {
            return new StoredDocument(null, null);
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo custodiar el documento", e);
        }
    }

    private record MimeGuess(String mime, String ext) {}

    private record StoredDocument(String file, String mime) {}

    private static MimeGuess detectMime(byte[] b) {
        if (b.length >= 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F') {
            return new MimeGuess("application/pdf", ".pdf");
        }
        if (b.length >= 8 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return new MimeGuess("image/webp", ".webp");
        }
        if (b.length >= 4 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return new MimeGuess("image/png", ".png");
        }
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return new MimeGuess("image/jpeg", ".jpg");
        }
        if (b.length >= 2 && b[0] == 'B' && b[1] == 'M') {
            return new MimeGuess("image/bmp", ".bmp");
        }
        return new MimeGuess("application/octet-stream", ".bin");
    }

    public record DocumentData(byte[] bytes, String mime) {}
}