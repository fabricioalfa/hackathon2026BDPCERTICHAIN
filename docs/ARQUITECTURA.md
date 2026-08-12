# CERTICHAIN BDP - Arquitectura y Guías Técnicas

## 1. Arquitectura general

```
┌──────────────┐        ┌──────────────────┐        ┌──────────────┐
│  Angular 21  │  HTTP  │  Spring Boot 3.5 │  JPA   │  PostgreSQL  │
│  + PrimeNG   │───────▶│   REST API +JWT  │───────▶│  (metadata)  │
└──────────────┘        │  :8080           │        └──────────────┘
                        └────────┬─────────┘
                                 │ RestClient
                        ┌────────▼─────────┐
                        │  OCR (FastAPI)   │
                        │  Tesseract :8090 │
                        └──────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │ Hyperledger      │  chaincode Go
                        │ Fabric (hash +   │  (emitir, verificar,
                        │  trazabilidad)   │   historial)
                        └──────────────────┘
```

## 2. Diagrama de secuencia - Emisión de certificado

```
Funcionario → Angular → POST /api/certificates (JWT)
  1. Spring Boot calcula hash SHA-256 del contenido
  2. FabricService registra hash en ledger → txId
  3. Se persiste metadata en PostgreSQL
  4. Se construye URL de verificación + QR
  5. Respuesta: {uuid, hash, txId, status: ACTIVE}
```

## 3. Diagrama de secuencia - Verificación (QR)

```
Usuario → Angular → GET /api/public/verify?uuid=CC-...&hash=...
  1. Backend busca el certificado por uuid en PostgreSQL
  2. FabricService.verifyHash(uuid, hash) consulta el ledger
  3. Si coincide → 200 {certificado válido}
     Si no     → 400 {hash no coincide}
```

## 4. Endpoints de la API

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | público | Login → token JWT |
| POST | `/api/certificates` | JWT | Emitir certificado |
| GET | `/api/certificates` | JWT | Listar certificados |
| GET | `/api/certificates/{uuid}` | JWT | Detalle por UUID |
| GET | `/api/public/verify` | público | Verificar hash |
| GET | `/api/public/certificate` | público | Datos públicos del cert |
| POST | `/api/ocr/extract` | JWT | OCR sobre imagen |
| GET | `/swagger-ui.html` | público | Documentación interactiva |
| GET | `/actuator/health` | público | Health check |

## 5. Chaincode (funciones)

| Función | Descripción |
|---|---|
| `Emitir` | Registra certificado en el ledger |
| `Consultar` | Obtiene certificado por UUID |
| `VerificarHash` | Confirma hash contra el ledger |
| `Revocar` | Cambia estado a REVOKED |
| `Historial` | Trazabilidad completa (GetHistoryForKey) |
| `ListarTodos` | Lista todos los certificados |

## 6. Hardware limitado - decisiones

- Red Fabric mínima: 1 org, 1 peer, 1 orderer.
- Límites de memoria por contenedor en `docker-compose.yml`.
- K8s solo como manifiestos base (sin cluster local).
- Angular usa lazy-loading por feature (bundle reducido).
- Java 21 (JDK) para el backend (más liviano en RAM que versiones mayores).
