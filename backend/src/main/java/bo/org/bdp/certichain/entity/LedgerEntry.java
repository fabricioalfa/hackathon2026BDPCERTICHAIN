package bo.org.bdp.certichain.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Registro del "ledger" del certificado.
 *
 * En el MVP reemplaza al stub en memoria, de modo que los hashes persisten
 * entre reinicios del backend. Cuando se integre Hyperledger Fabric real,
 * esta tabla queda como respaldo/caché local de trazabilidad.
 */
@Entity
@Table(name = "ledger_entry")
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 128)
    private String uuid;

    @Column(nullable = false, length = 128)
    private String hash;

    @Column(name = "tx_id", length = 128)
    private String txId;

    @Column(length = 100)
    private String issuer;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getHash() { return hash; }
    public void setHash(String hash) { this.hash = hash; }

    public String getTxId() { return txId; }
    public void setTxId(String txId) { this.txId = txId; }

    public String getIssuer() { return issuer; }
    public void setIssuer(String issuer) { this.issuer = issuer; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}