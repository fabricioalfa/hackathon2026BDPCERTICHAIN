# CERTICHAIN BDP

Plataforma de certificación y trazabilidad digital de garantías y documentos con blockchain.

**Banco de Desarrollo Productivo - S.A.M.** | Hackathon

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Angular 21 + PrimeNG 21 |
| Backend | Spring Boot 3.5 (REST API + Swagger/OpenAPI 3) |
| Blockchain | Hyperledger Fabric 2.5 LTS (Chaincode en Go) |
| OCR | Tesseract (microservicio Python/FastAPI) |
| BD Auxiliar | PostgreSQL 16 |
| Infra | Docker Compose + Kubernetes (manifiestos base) |

## Estructura del proyecto

```
certichain-bdp/
├── backend/            # Spring Boot REST API
├── frontend/           # Angular 21 + PrimeNG 21
├── blockchain/
│   ├── chaincode/      # Chaincode en Go
│   └── network/        # Red Fabric (test-network 1 org)
├── ocr/                # Microservicio Tesseract
├── database/init/      # SQL de inicialización
├── infra/k8s/          # Manifiestos Kubernetes (base)
├── infra/nginx/        # Reverse proxy de desarrollo
├── docs/               # Documentación y propuesta
├── docker-compose.yml  # Orquestación principal
├── Makefile            # Comandos cortos
└── .env.example        # Variables de entorno (copiar a .env)
```

## Requisitos para levantar la plataforma

Solo necesitas **Docker** para la demo completa (postgres, backend, frontend y OCR corren en contenedores):

- **Docker Engine** 24+ y **Docker Compose** v2
  - Linux: `sudo apt install docker.io docker-compose`
  - Windows/Mac: instalar *Docker Desktop*

> Node.js, JDK, Go y Tesseract **no** son necesarios para la demo: solo se usan si desarrollas o compilas localmente.

## Cómo levantar la plataforma (guía rápida)

### 1. Clonar el repositorio

```bash
git clone https://github.com/fabricioalfa/hackathon2026BDPCERTICHAIN.git
cd hackathon2026BDPCERTICHAIN
```

### 2. Crear el archivo de entorno

```bash
cp .env.example .env
```

(El `.env` ya trae valores por defecto que funcionan; solo cámbialos si necesitas puertos o credenciales distintas.)

### 3. Levantar los servicios

```bash
docker compose up -d --build
```

Esto levanta 4 servicios: `postgres`, `backend`, `frontend` y `ocr`. La primera vez tarda unos minutos (descarga imágenes y compila).

### 4. Verificar que todo está corriendo

```bash
docker compose ps
```

Debes ver los 4 servicios con estado `Up` y `healthy` (el backend y postgres tardan ~30s en quedar sanos).

### 5. Abrir la aplicación

| Servicio | URL |
|---|---|
| Frontend (app web) | http://localhost:4200 |
| Swagger UI (docs API) | http://localhost:8080/swagger-ui.html |
| OpenAPI JSON | http://localhost:8080/v3/api-docs |
| OCR health | http://localhost:8090/api/ocr/health |
| Backend health | http://localhost:8080/actuator/health |
| PostgreSQL | localhost:5432 (usuario `certichain`) |

**Credenciales demo:**
- Administrador: `admin` / `admin123`
- Operador: `operador` / `operador123`

## Probar la demo (flujo del negocio)

1. **Iniciar sesión** en http://localhost:4200 con `admin/admin123`.
2. **Emitir un certificado** (menú *Emitir*):
   - **Sube la fotocopia/escaneo del carnet de identidad** (arrastra el archivo sobre el recuadro punteado o haz clic para seleccionarlo).
   - El OCR lee el documento en automático y extrae **nro de carnet / CI**, **nombre completo** y **fecha de nacimiento**, autocompletando los campos. Verifica y corrige si hace falta.
   - Completa el título y tipo de documento y presiona *Emitir*. El hash SHA-256 se calcula sobre los datos **y la imagen original**, de modo que la fotocopia queda custodiada a prueba de manipulación.
   - Al emitir se muestra el **QR de verificación** y la **vista previa del documento custodiado**.
3. **Ver certificados** (menú *Certificados*): lista todos los emitidos con su hash, QR y documento custodiado (descargable desde el detalle).
4. **Verificar autenticidad** (menú *Verificar*): la URL pública `http://localhost:4200/verify?uuid=CC-...` (la que codifica el QR) valida el certificado sin necesidad de cuenta. Si agregás el **hash SHA-256** se valida además la integridad total: altera un solo carácter del hash y la verificación falla.

> Cualquier persona con la URL `/verify?uuid=...` (por ejemplo, escaneando el QR impreso en el documento) puede autenticar un certificado sin login. El endpoint público es `/api/public/verify` y la descarga del original custodiado es `/api/public/certificate/{uuid}/document`.

## Comandos útiles (Makefile)

```bash
make up          # Levanta postgres + backend + frontend + ocr
make down        # Detiene los servicios (conserva la BD)
make down-v      # Detiene y borra la BD (empezar de cero)
make reset       # down-v + up
make ps          # Estado de los servicios
make logs        # Logs en tiempo real
make backend-test    # Tests del backend
make frontend-serve  # Angular en modo desarrollo (http://localhost:4200)
```

Sin Makefile, los comandos equivalentes son `docker compose up -d --build`, `docker compose down`, `docker compose ps` y `docker compose logs -f`.

## Desarrollar y reconstruir tras cambios

Cada vez que cambies código de un servicio, reconstruye ese contenedor:

```bash
docker compose up -d --build backend    # backend (Spring Boot)
docker compose up -d --build frontend   # frontend (Angular)
docker compose up -d --build ocr        # OCR (FastAPI)
```

Logs en vivo:

```bash
docker compose logs -f backend
```

## Solución de problemas

| Problema | Solución |
|---|---|
| `docker compose ps` no muestra servicios | Ejecuta `docker compose up -d --build` primero |
| El backend no arranca (puerto 8080 ocupado) | `sudo lsof -i :8080` y libera el puerto, o cambia `SERVER_PORT` en `.env` |
| El puerto 4200/8080/8090 ya está en uso | Ajusta el mapeo de puertos en `docker-compose.yml` o el `.env` |
| Pantalla en blanco en el frontend | Recarga forzada: `Ctrl+Shift+R` (limpia caché del bundle viejo) |
| OCR no extrae los datos | Verifica http://localhost:8090/api/ocr/health y que la imagen sea clara (buena luz, nítida, bien encuadrada) |
| El OCR ignora algunos campos | Toca *Relanzar OCR* o completa los campos manualmente; la fotocopia debe verse legible |
| No veo la fecha de nacimiento/nombre en un certificado viejo | Fuerza `make reset` para que Hibernate agregue la columna y emite de nuevo |
| Quiero empezar de cero | `make reset` (borra la BD y vuelve a levantar todo) |

## Notas técnicas

### Módulo OCR
El microservicio `ocr/` usa Tesseract + OpenCV y está optimizado para **carnets de identidad bolivianos**: preprocesa la imagen (escala, contraste y binarización) para tolerar fotocopias, y extrae **CI, nombre completo y fecha de nacimiento**. Prueba varias configuraciones de Tesseract y elige la lectura más confiable.

### Módulo Fabric
El `FabricService` del backend usa un **ledger simulado persistente en PostgreSQL** (tabla `ledger_entry`) para que la demo funcione sin levantar red blockchain: cada emisión registra un `txId` + hash y las verificaciones quedan disponibles incluso reiniciando el backend. Cuando la red Hyperledger Fabric esté disponible, el cuerpo de `registerCertificate`/`verifyHash` se reemplaza por el SDK de Fabric (Gateway) usando `fabric.peer-endpoint`, conservando esta tabla como respaldo local. El chaincode real ya está listo y compila en `blockchain/chaincode`.

### Custodia de documentos
Al emitir con una imagen/escaneo, el original se custodia en `<DOCUMENTS_DIR>` (por defecto `data/documents`), se detecta su tipo (`pdf`, `png`, `jpg`, etc.), se sirve por `GET /api/public/certificate/{uuid}/document` y el certificado queda con `documentAvailable=true`. El entrypoint del contenedor garantiza que ese directorio sea escribible por el usuario `spring` aunque el volumen lo cree Docker como `root`.

### Kubernetes
No es necesario para el hackathon: todo corre con Docker Compose. Los manifiestos en `infra/k8s/` están preparados para escalar a producción (Fase IV).

### Seguridad
- Autenticación JWT en la API.
- Secretos en `.env` (nunca commiteados; hay un `.env.example` como plantilla).
- CORS restringido al origen del frontend.
