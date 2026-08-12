# ============================================================
# CERTICHAIN BDP - Makefile
# Comandos cortos para el desarrollo y la demo.
# Uso: make up | make down | make build | make chaincode | ...
# ============================================================

.PHONY: help up down build down-v reset logs ps chaincode-up chaincode-down \
        backend-run frontend-install frontend-serve backend-test backend-build

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ---------- Orquestación principal ----------
up: ## Levanta Postgres + Backend + Frontend + OCR
	docker compose up -d --build

down: ## Detiene los servicios (sin borrar volúmenes)
	docker compose down

down-v: ## Detiene servicios y borra volúmenes de BD
	docker compose down -v

reset: down-v up ## Reinicio limpio de todos los servicios

logs: ## Logs de todos los servicios
	docker compose logs -f

ps: ## Estado de los servicios
	docker compose ps

# ---------- Hyperledger Fabric ----------
chaincode-build: ## Compila el chaincode Go
	cd blockchain/chaincode && go build -o /dev/null .

chaincode-up: ## Levanta la red Fabric de prueba (ver blockchain/network)
	docker compose -f blockchain/network/docker-compose.yml up -d
	@echo "Crea el channel y despliega el chaincode con blockchain/network/scripts/start.sh"

chaincode-down: ## Detiene la red Fabric
	docker compose -f blockchain/network/docker-compose.yml down -v

# ---------- Backend (desarrollo local) ----------
backend-build: ## Compila el backend sin Docker
	cd backend && ./mvnw clean package -DskipTests

backend-run: ## Corre el backend localmente (requiere Postgres arriba)
	cd backend && ./mvnw spring-boot:run

backend-test: ## Ejecuta los tests del backend
	cd backend && ./mvnw test

# ---------- Frontend (desarrollo local) ----------
frontend-install: ## Instala dependencias del frontend
	cd frontend && npm install

frontend-serve: ## Corre Angular en modo desarrollo (http://localhost:4200)
	cd frontend && npm start

# ---------- OCR ----------
ocr-run: ## Corre el microservicio OCR localmente
	cd ocr && python -m uvicorn app:app --reload --port 8090
