package bo.org.bdp.certichain.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "certificate")
public class Certificate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 128)
    private String uuid;

    @Column(name = "document_hash", nullable = false, length = 128)
    private String documentHash;

    @Column(name = "tx_id", length = 128)
    private String txId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "doc_type", nullable = false, length = 50)
    private String docType;

    @Column(name = "holder_dni", length = 20)
    private String holderDni;

    @Column(name = "holder_name", length = 255)
    private String holderName;

    @Column(name = "issue_date", nullable = false)
    private Instant issueDate = Instant.now();

    @Column(name = "expiry_date")
    private Instant expiryDate;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "qr_url", length = 512)
    private String qrUrl;

    @Column(name = "metadata_json", columnDefinition = "text")
    private String metadataJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issued_by")
    private User issuedBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getDocumentHash() { return documentHash; }
    public void setDocumentHash(String documentHash) { this.documentHash = documentHash; }

    public String getTxId() { return txId; }
    public void setTxId(String txId) { this.txId = txId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDocType() { return docType; }
    public void setDocType(String docType) { this.docType = docType; }

    public String getHolderDni() { return holderDni; }
    public void setHolderDni(String holderDni) { this.holderDni = holderDni; }

    public String getHolderName() { return holderName; }
    public void setHolderName(String holderName) { this.holderName = holderName; }

    public Instant getIssueDate() { return issueDate; }
    public void setIssueDate(Instant issueDate) { this.issueDate = issueDate; }

    public Instant getExpiryDate() { return expiryDate; }
    public void setExpiryDate(Instant expiryDate) { this.expiryDate = expiryDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getQrUrl() { return qrUrl; }
    public void setQrUrl(String qrUrl) { this.qrUrl = qrUrl; }

    public String getMetadataJson() { return metadataJson; }
    public void setMetadataJson(String metadataJson) { this.metadataJson = metadataJson; }

    public User getIssuedBy() { return issuedBy; }
    public void setIssuedBy(User issuedBy) { this.issuedBy = issuedBy; }
}
