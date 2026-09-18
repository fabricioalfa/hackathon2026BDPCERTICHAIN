package bo.org.bdp.certichain.exception;

public class DuplicateCertificateException extends RuntimeException {
    public DuplicateCertificateException(String message) {
        super(message);
    }
}