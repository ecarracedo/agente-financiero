# Proposal: Modernización full-stack del agente financiero

## Intent
Reemplazar Streamlit/SQLite por una plataforma mantenible, conservando las reglas financieras y capacidades actuales. Debe soportar Docker Compose, Coolify y AWS Strands sin acciones financieras autónomas inicialmente.

## Scope

### In Scope
- Extraer dominio y casos de uso, crear backend FastAPI y PostgreSQL con SQLAlchemy/Alembic.
- Crear frontend React+TypeScript.
- Migrar `finance.db` con idempotencia, reconciliación y rollback; integrar Strands en análisis de solo lectura.
- Crear Compose, healthchecks, secrets y documentación.
- Retirar tecnología obsoleta solo después de demostrar paridad.

### Out of Scope
- Microservicios.
- Trading automático, ejecución de órdenes o recomendaciones sin confirmación humana.
- Sincronización cloud.

## Capabilities

### New Capabilities
- `financial-domain-api`: Casos de uso y API para cartera, operaciones, valuación, mercado, alertas, wishlist y bibliografía.
- `financial-web-frontend`: Interfaz React para las capacidades actuales.
- `postgres-data-migration`: Persistencia PostgreSQL, migraciones y migración reconciliable desde SQLite.
- `read-only-financial-agent`: Agente Strands con herramientas explícitas de análisis sin mutaciones.
- `containerized-deployment`: Compose de desarrollo y despliegue compatible con Coolify.

### Modified Capabilities
- None.

## Approach
Migración incremental por cortes verticales en un monolito modular. Primero se caracterizan reglas y dominio; luego API, PostgreSQL, frontend y migrador. Una fuente de verdad por fase; SQLite se conserva hasta validar reconciliación. Strands queda detrás de casos de uso y permisos.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/` | New | API, dominio, DB y agentes. |
| `frontend/` | New | React+TypeScript/Vite. |
| `src/`, `main.py` | Removed/Migrated | Lógica extraída; Streamlit retirado al final. |
| `finance.db`, `src/scripts/` | Migrated | Importación a PostgreSQL. |
| `compose*.yaml`, Dockerfiles | New | Compose y Coolify. |
| `tests/`, `README.md`, `requirements.txt` | Modified | Contratos, docs y dependencias. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Regresión financiera | High | Caracterización, fixtures y reconciliación. |
| Pérdida de datos | High | Backup, migración transaccional y rollback. |
| Permisos excesivos del agente | Medium | Solo lectura, allowlist y confirmación humana. |
| Despliegue inseguro | Medium | Auth, secrets, healthchecks y DB privada. |

## Rollback Plan
Mantener la aplicación y `finance.db` durante la transición. Cada corte debe poder desactivarse; ante discrepancias, detener escrituras, restaurar PostgreSQL o volver a la app anterior.

## Dependencies
- PostgreSQL, Docker/Compose, Coolify y credenciales AWS.
- Decidir single-user o multi-user antes de ownership y autenticación.

## Success Criteria
- [ ] Capacidades actuales con paridad funcional verificada.
- [ ] SQLite→PostgreSQL reproducible y reconciliado.
- [ ] Frontend, API, PostgreSQL y agente funcionan en Compose y Coolify.
- [ ] Streamlit, SQLite y residuos se eliminan sin pérdida de lógica ni datos.
