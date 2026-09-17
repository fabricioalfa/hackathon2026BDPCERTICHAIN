package bo.org.bdp.certichain.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class HashServiceTest {

    private final HashService service = new HashService();

    @Test
    void generaSha256HexEnMinusculas() {
        String hash = service.sha256("CERTICHAIN BDP demo");

        assertThat(hash).hasSize(64).isEqualTo(hash.toLowerCase());
        assertThat(hash).matches("[0-9a-f]{64}");
    }

    @Test
    void hashDeBytesEsEstable() {
        byte[] content = "documento resolucion bdp 2026".getBytes(StandardCharsets.UTF_8);

        assertThat(service.sha256(content)).isEqualTo(service.sha256(content));
    }

    @Test
    void hashDeDatosDistintosDifiere() {
        assertThat(service.sha256("a")).isNotEqualTo(service.sha256("b"));
    }

    @Test
    void buildVerificationUrlContieneUuid() {
        QrService qr = new QrService();
        String url = qr.buildVerificationUrl("http://localhost:4200", "CC-abc");

        assertThat(url).isEqualTo("http://localhost:4200/verify?uuid=CC-abc");
    }
}