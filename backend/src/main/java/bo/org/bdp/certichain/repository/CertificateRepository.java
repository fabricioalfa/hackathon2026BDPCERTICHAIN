package bo.org.bdp.certichain.repository;

import bo.org.bdp.certichain.entity.Certificate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CertificateRepository extends JpaRepository<Certificate, Long> {
    Optional<Certificate> findByUuid(String uuid);
    List<Certificate> findByHolderDni(String holderDni);
    List<Certificate> findByDocType(String docType);
    List<Certificate> findByStatus(String status);
    List<Certificate> findByHolderNameIgnoreCase(String holderName);
    boolean existsByHolderDni(String holderDni);
}
