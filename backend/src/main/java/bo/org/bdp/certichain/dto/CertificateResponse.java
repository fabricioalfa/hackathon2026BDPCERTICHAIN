package bo.org.bdp.certichain.dto;

import bo.org.bdp.certichain.entity.Certificate;

import java.time.Instant;

public record CertificateResponse(
        String uuid,
        String documentHash,
        String txId,
        String title,
        String docType,
        String holderDni,
        String holderName,
        String holderDateOfBirth,
        Instant issueDate,
        Instant expiryDate,
        String status,
        String qrUrl,
        String qrBase64,
        boolean documentAvailable,
        String issuedBy
) {
    public static CertificateResponse from(Certificate c) {
        return new CertificateResponse(
                c.getUuid(),
                c.getDocumentHash(),
                c.getTxId(),
                c.getTitle(),
                c.getDocType(),
                c.getHolderDni(),
                c.getHolderName(),
                c.getHolderDateOfBirth(),
                c.getIssueDate(),
                c.getExpiryDate(),
                c.getStatus(),
                c.getQrUrl(),
                null,
                c.getDocumentFile() != null && !c.getDocumentFile().isBlank(),
                c.getIssuedBy() != null ? c.getIssuedBy().getUsername() : null
        );
    }
}