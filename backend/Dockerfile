# ---- Etapa 1: compilacion con Maven + JDK 21 ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

# ---- Etapa 2: imagen final ligera (JRE) ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring \
    && mkdir -p /app/documents \
    && chown spring:spring /app/documents
COPY --from=build /app/target/*.jar app.jar
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
EXPOSE 8080
# El entrypoint garantiza que /app/documents sea escribible para el usuario
# spring aunque el volumen lo cree Docker con otro propietario, y luego
# ejecuta la aplicacion bajando privilegios a spring:spring.
ENTRYPOINT ["/app/entrypoint.sh"]