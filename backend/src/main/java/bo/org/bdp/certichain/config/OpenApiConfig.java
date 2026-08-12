package bo.org.bdp.certichain.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.Components;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI certichainOpenAPI() {
        final String securitySchemeName = "bearerAuth";
        return new OpenAPI()
                .info(new Info()
                        .title("CERTICHAIN BDP API")
                        .version("1.0.0")
                        .description("""
                                API REST de la plataforma CERTICHAIN BDP.

                                Emision, registro en blockchain, verificacion y trazabilidad
                                de certificados digitales y documentos institucionales.

                                **Autenticacion:** usa el endpoint /api/auth/login y copia el
                                token en el boton 'Authorize' (bearer).
                                """)
                        .contact(new Contact().name("Equipo CERTICHAIN BDP")))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components().addSecuritySchemes(securitySchemeName,
                        new SecurityScheme()
                                .name(securitySchemeName)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
