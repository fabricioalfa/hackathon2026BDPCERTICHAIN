package bo.org.bdp.certichain.service;

import bo.org.bdp.certichain.entity.LedgerEntry;
import bo.org.bdp.certichain.repository.LedgerEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

/**
 * Puente hacia Hyperledger Fabric.
 *
 * MVP: registra el hash en la tabla {@code ledger_entry} (PostgreSQL) de modo
 * que las verificaciones sobreviven a reinicios del backend. Cuando la red
 * Fabric este disponible, el cuerpo de {@link #registerCertificate} y
 * {@link #verifyHash} se reemplaza por el SDK de Fabric (Gateway) usando
 * {@code fabric.peer-endpoint}, conservando esta tabla como respaldo local.
 */
@Service
public class FabricService {

    private static final Logger log = LoggerFactory.getLogger(FabricService.class);

    @Value("${fabric.channel:certchain}")
    private String channel;

    @Value("${fabric.chaincode:certchain}")
    private String chaincode;

    @Value("${fabric.peer-endpoint:localhost:7051}")
    private String peerEndpoint;

    private final LedgerEntryRepository ledgerRepository;

    public FabricService(LedgerEntryRepository ledgerRepository) {
        this.ledgerRepository = ledgerRepository;
    }

    /**
     * Registra el hash del documento en el ledger.
     * @return txId transaccion (fabric o simulada).
     */
    public String registerCertificate(String uuid, String hash, String issuer) {
        String txId = "tx-" + UUID.randomUUID();

        LedgerEntry entry = new LedgerEntry();
        entry.setUuid(uuid);
        entry.setHash(hash);
        entry.setTxId(txId);
        entry.setIssuer(issuer);
        ledgerRepository.save(entry);

        log.info("[LEDGER] channel={} chaincode={} peer={} tx={} hash={}",
                channel, chaincode, peerEndpoint, txId, hash);
        return txId;
    }

    /**
     * Verifica que un hash exista en el ledger para un certificado dado.
     */
    public boolean verifyHash(String uuid, String hash) {
        return ledgerRepository.findByUuid(uuid)
                .map(entry -> entry.getHash().equals(hash))
                .orElse(false);
    }

    /**
     * Indica si el certificado existe en el ledger (para verificaciones solo UUID).
     */
    public boolean exists(String uuid) {
        return ledgerRepository.findByUuid(uuid).isPresent();
    }

    /**
     * Devuelve la entrada del ledger para trazabilidad, si existe.
     */
    public Optional<LedgerEntry> getLedgerEntry(String uuid) {
        return ledgerRepository.findByUuid(uuid);
    }
}