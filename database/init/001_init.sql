-- ============================================================
-- CERTICHAIN BDP - Inicializacion de PostgreSQL
-- Se ejecuta automaticamente la primera vez que se crea el
-- volumen (docker-entrypoint-initdb.d).
-- El esquema principal lo gestiona Hibernate (ddl-auto: update);
-- aqui solo se crean objetos auxiliares y datos de referencia.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla auxiliar para auditoria manual (opcional)
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   VARCHAR(128),
    detail      TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE audit_log IS
    'Registro de auditoria de acciones sobre certificados y documentos.';

CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON audit_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_created
    ON audit_log (created_at);
