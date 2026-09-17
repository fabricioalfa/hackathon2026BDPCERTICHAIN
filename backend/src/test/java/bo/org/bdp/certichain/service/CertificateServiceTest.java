package bo.org.bdp.certichain.service;

import bo.org.bdp.certichain.dto.VerificationResponse;
import bo.org.bdp.certichain.entity.Certificate;
import bo.org.bdp.certichain.repository.CertificateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CertificateServiceTest {

    private static final String UUID = "CC-test-12345";
    private static final String HASH = "a".repeat(64);

    private CertificateRepository certificateRepository;
    private FabricService fabricService;
    private CertificateService service;
    private Certificate cert;

    @BeforeEach
    void setUp() {
        certificateRepository = mock(CertificateRepository.class);
        HashService hashService = mock(HashService.class);
        QrService qrService = new QrService();
        fabricService = mock(FabricService.class);

        service = new CertificateService(certificateRepository, hashService, qrService, fabricService);

        cert = new Certificate();
        cert.setUuid(UUID);
        cert.setDocumentHash(HASH);
        cert.setTitle("Carnet de identidad N 123");
        cert.setDocType("IDENTIDAD");
        cert.setStatus("ACTIVE");
        cert.setIssueDate(Instant.now());
        cert.setTxId("tx-0001");
        cert.setQrUrl("http://localhost:4200/verify?uuid=" + UUID);

        when(certificateRepository.findByUuid(anyString())).thenReturn(Optional.of(cert));
    }

    @Test
    void verificaCertificadoRegistradoSinHash() {
        when(fabricService.exists(UUID)).thenReturn(true);

        VerificationResponse res = service.verify(UUID, null);

        assertThat(res.valid()).isTrue();
        assertThat(res.message()).containsIgnoringCase("registrado");
        assertThat(res.certificate().uuid()).isEqualTo(UUID);
    }

    @Test
    void verificaCertificadoConHashCorrecto() {
        when(fabricService.exists(UUID)).thenReturn(true);
        when(fabricService.verifyHash(UUID, HASH)).thenReturn(true);

        VerificationResponse res = service.verify(UUID, HASH);

        assertThat(res.valid()).isTrue();
        assertThat(res.message()).containsIgnoringCase("auténtico");
    }

    @Test
    void rechazaHashIncorrecto() {
        when(fabricService.exists(UUID)).thenReturn(true);
        when(fabricService.verifyHash(anyString(), anyString())).thenReturn(false);

        VerificationResponse res = service.verify(UUID, "deadbeef");

        assertThat(res.valid()).isFalse();
        assertThat(res.message()).containsIgnoringCase("no coincide");
    }

    @Test
    void rechazaCertificadosSinRegistroEnLedger() {
        when(fabricService.exists(UUID)).thenReturn(false);
        cert.setTxId(null);

        VerificationResponse res = service.verify(UUID, null);

        assertThat(res.valid()).isFalse();
        assertThat(res.message()).containsIgnoringCase("no está registrado");
    }

    @Test
    void validaCertificadosHistoricosConLedgerVacío() {
        // Certificados emitidos en versiones anteriores: tienen tx_id pero la
        // tabla ledger_entry (creada despues) puede estar vacia. El fallback
        // debe validarlos contra el hash sellado en el propio certificado.
        when(fabricService.exists(UUID)).thenReturn(false);
        cert.setTxId("tx-legacy-0001");

        assertThat(service.verify(UUID, null).valid()).isTrue();
        assertThat(service.verify(UUID, HASH).valid()).isTrue();
        assertThat(service.verify(UUID, "hash-distinto").valid()).isFalse();
    }
}