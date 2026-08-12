package bo.org.bdp.certichain.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;

public record IssueCertificateRequest(
        @NotBlank(message = "El titulo es obligatorio")
        String title,

        @NotBlank(message = "El tipo de documento es obligatorio")
        String docType,

        String holderDni,
        String holderName,

        Instant expiryDate,

        String metadataJson,

        String base64Content
) {}
