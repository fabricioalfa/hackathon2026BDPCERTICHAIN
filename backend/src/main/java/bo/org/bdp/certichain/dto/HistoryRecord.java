package bo.org.bdp.certichain.dto;

import java.time.Instant;

public record HistoryRecord(
        String uuid,
        String holderName,
        String holderDni,
        String docType,
        Instant issueDate,
        String issuedBy
) {}