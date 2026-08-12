package bo.org.bdp.certichain.dto;

public record AuthResponse(
        String token,
        String username,
        String fullName,
        String role
) {}
