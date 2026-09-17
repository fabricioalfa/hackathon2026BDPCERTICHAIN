package bo.org.bdp.certichain.repository;

import bo.org.bdp.certichain.entity.LedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, Long> {
    Optional<LedgerEntry> findByUuid(String uuid);
}