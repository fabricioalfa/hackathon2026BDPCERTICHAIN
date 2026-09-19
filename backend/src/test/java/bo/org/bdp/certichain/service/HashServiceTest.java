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
    void sha256HolderEsEstableYRecalculable() {
        String hash = service.sha256Holder("Juan Perez", "1234567", "01/01/1990");

        assertThat(hash).hasSize(64).matches("[0-9a-f]{64}");
        assertThat(service.sha256Holder("Juan Perez", "1234567", "01/01/1990")).isEqualTo(hash);
        // Equivalente exacto: SHA-256("Juan Perez|1234567|01/01/1990")
        assertThat(hash).isEqualTo(service.sha256("Juan Perez|1234567|01/01/1990"));
    }

    @Test
    void sha256HolderRecortaEspacios() {
        String limpio = service.sha256Holder("Juan Perez", "1234567", "01/01/1990");
        String conEspacios = service.sha256Holder("  Juan Perez  ", "  1234567 ", " 01/01/1990 ");

        assertThat(conEspacios).isEqualTo(limpio);
    }

    @Test
    void sha256HolderDetectaAlteracionDeCualquierCampo() {
        String base = service.sha256Holder("Juan Perez", "1234567", "01/01/1990");

        assertThat(service.sha256Holder("Juan Peres", "1234567", "01/01/1990")).isNotEqualTo(base);
        assertThat(service.sha256Holder("Juan Perez", "1234568", "01/01/1990")).isNotEqualTo(base);
        assertThat(service.sha256Holder("Juan Perez", "1234567", "02/02/1990")).isNotEqualTo(base);
    }

    @Test
    void sha256HolderCamposVaciosUsanCadenaVacia() {
        assertThat(service.sha256Holder(null, "1234567", null)).isEqualTo(service.sha256("|1234567|"));
    }

    @Test
    void buildVerificationUrlContieneUuid() {
        QrService qr = new QrService();
        String url = qr.buildVerificationUrl("http://localhost:4200", "CC-abc");

        assertThat(url).isEqualTo("http://localhost:4200/verify?uuid=CC-abc");
    }
}