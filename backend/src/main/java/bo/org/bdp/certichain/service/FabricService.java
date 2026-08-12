package bo.org.bdp.certichain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * Puente hacia Hyperledger Fabric.
 *
 * MVP: registra el hash en el "ledger" con un stub local (en memoria) para que
 * la demo funcione sin red Fabric levantada. Cuando la red este disponible,
 * se reemplaza el cuerpo de {@link #registerCertificate} y {@link #verifyHash}
 * por las llamadas al SDK de Fabric (Gateway) usando {@code fabric.peer-endpoint}.
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

    private final java.util.concurrent.ConcurrentMap<String, LedgerEntry> localLedger =
            new java.util.concurrent.ConcurrentHashMap<>();

    public record LedgerEntry(String hash, String uuid, String issuer, Instant timestamp) {}

    /**
     * Registra el hash del documento en el ledger.
     * @return txId transaccion de fabric.
     */
    public String registerCertificate(String uuid, String hash, String issuer) {
        String txId = "tx-" + UUID.randomUUID();
        LedgerEntry entry = new LedgerEntry(hash, uuid, issuer, Instant.now());
        localLedger.put(uuid, entry);
        log.info("[FABRIC-STUB] channel={} chaincode={} peer={} tx={} hash={}",
                channel, chaincode, peerEndpoint, txId, hash);
        return txId;
    }

    /**
     * Verifica que un hash exista en el ledger para un certificado dado.
     */
    public boolean verifyHash(String uuid, String hash) {
        LedgerEntry entry = localLedger.get(uuid);
        if (entry == null) {
            return false;
        }
        return entry.hash().equals(hash);
    }

    /**
     * Devuelve la entrada del ledger para trazabilidad, si existe.
     */
    public LedgerEntry getLedgerEntry(String uuid) {
        return localLedger.get(uuid);
    }
}
