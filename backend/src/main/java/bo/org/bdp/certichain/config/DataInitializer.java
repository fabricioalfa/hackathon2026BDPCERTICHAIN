package bo.org.bdp.certichain.config;

import bo.org.bdp.certichain.entity.User;
import bo.org.bdp.certichain.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    @Bean
    CommandLineRunner seedUsers(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.count() == 0) {
                User admin = new User();
                admin.setUsername("admin");
                admin.setPassword(passwordEncoder.encode("admin123"));
                admin.setFullName("Funcionario Autorizado BDP");
                admin.setRole("ADMIN");
                admin.setEnabled(true);
                userRepository.save(admin);

                User operator = new User();
                operator.setUsername("operador");
                operator.setPassword(passwordEncoder.encode("operador123"));
                operator.setFullName("Funcionario de Operaciones");
                operator.setRole("OPERATOR");
                operator.setEnabled(true);
                userRepository.save(operator);

                log.info("Usuarios semilla creados: admin / operador");
            }
        };
    }
}
