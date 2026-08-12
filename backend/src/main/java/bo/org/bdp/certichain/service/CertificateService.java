package bo.org.bdp.certichain.service;

import bo.org.bdp.certichain.dto.CertificateResponse;
import bo.org.bdp.certichain.dto.IssueCertificateRequest;
import bo.org.bdp.certichain.entity.Certificate;
import bo.org.bdp.certichain.entity.User;
import bo.org.bdp.certichain.repository.CertificateRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
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
     * 1) Calcular hash del documento.
     * 2) Registrar el hash en blockchain (Fabric).
     * 3) Persistir metadatos en PostgreSQL.
     * 4) Generar codigo QR con URL de verificacion.
     */
    @Transactional
    public CertificateResponse issue(IssueCertificateRequest request, User issuer) {
        String uuid = "CC-" + UUID.randomUUID();
        String contentToHash = String.join("|",
                uuid,
                request.title(),
                request.docType(),
                request.holderDni() == null ? "" : request.holderDni(),
                request.holderName() == null ? "" : request.holderName(),
                request.metadataJson() == null ? "" : request.metadataJson(),
                request.base64Content() == null ? "" : request.base64Content());
        String hash = hashService.sha256(contentToHash);

        String txId = fabricService.registerCertificate(uuid, hash, issuer.getUsername());

        Certificate cert = new Certificate();
        cert.setUuid(uuid);
        cert.setDocumentHash(hash);
        cert.setTxId(txId);
        cert.setTitle(request.title());
        cert.setDocType(request.docType());
        cert.setHolderDni(request.holderDni());
        cert.setHolderName(request.holderName());
        cert.setExpiryDate(request.expiryDate());
        cert.setMetadataJson(request.metadataJson());
        cert.setStatus("ACTIVE");
        cert.setIssuedBy(issuer);

        String qrPayload = qrService.buildVerificationUrl(frontendBaseUrl, uuid);
        cert.setQrUrl(qrPayload);

        Certificate saved = certificateRepository.save(cert);
        return CertificateResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public CertificateResponse verify(String uuid, String providedHash) {
        Certificate cert = certificateRepository.findByUuid(uuid)
                .orElseThrow(() -> new IllegalArgumentException("Certificado no encontrado: " + uuid));

        boolean validOnChain = fabricService.verifyHash(uuid, providedHash);
        if (!validOnChain) {
            throw new IllegalArgumentException("El hash no coincide con el registrado en blockchain.");
        }
        return CertificateResponse.from(cert);
    }

    @Transactional(readOnly = true)
    public List<CertificateResponse> findAll() {
        return certificateRepository.findAll().stream()
                .map(CertificateResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CertificateResponse findByUuid(String uuid) {
        return certificateRepository.findByUuid(uuid)
                .map(CertificateResponse::from)
                .orElseThrow(() -> new IllegalArgumentException("Certificado no encontrado: " + uuid));
    }
}
