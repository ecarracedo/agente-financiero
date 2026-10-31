# Design: Modernización full-stack del agente financiero

## Technical Approach

Construir un monolito modular Python por capacidades. Extraer reglas de `src/services/` y `main.py` fuera de UI/pandas/ORM; exponerlas con FastAPI/PostgreSQL. React+TypeScript/Vite será el frontend final. Strands solo tendrá herramientas read-only. Conservar Streamlit y `finance.db` hasta paridad y corte aprobado.

## Architecture Decisions

| Decision | Choice | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Backend | Modular `backend/app/{domain,application,adapters,api,agents}` | Microservicios/routers con lógica | Python existente; separa reglas y transporte. |
| Users | Single-user privado, sin tenant en v1 | Multi-user | Alcance inicial; definir control de acceso para Coolify. |
| Persistence | SQLAlchemy 2/Alembic; PostgreSQL final | Peewee o DB compartida | Repositorios y migraciones versionadas. |
| Money | `Decimal`/`NUMERIC`, currency ISO por operación, sin FX en v1 | floats o inferencia | Evita precisión binaria y sumas entre monedas. |
| Alerts | Guardar intent (`NEUTRAL`, `STOP_LOSS`, `BUY`, `SELL`) y cruces | Inferir intención del precio actual | Mensaje estable y sin disparos repetidos. |
| Frontend | React/Vite, `/api/v1`, cliente OpenAPI | DB directa/UI Python | Contrato verificable e independiente. |
| Agents | Strands read-only; modelo/región por entorno; yfinance inicial | SQL/ORM/órdenes | Permisos explícitos y menor riesgo. |
| Runtime | Compose base + override dev para Coolify | Config duplicada | Servicios comunes, hot reload solo en dev. |

## Data Flow

    React SPA -> FastAPI routers -> application use cases -> domain rules
                                      |                       |
                                      v                       v
                             SQLAlchemy repositories     market-data adapter
                                      |                  Strands read-only tools
                                      v
                                  PostgreSQL

El agente usa casos read-only, nunca SQL directo. OpenAPI es el contrato compartido.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/pyproject.toml`, `backend/app/` | Create | Capas API/dominio/adaptadores/agentes. |
| `backend/alembic/`, `backend/tests/` | Create | Migraciones y unit/integration tests. |
| `frontend/package.json`, `frontend/src/` | Create | SPA React y cliente OpenAPI. |
| Dockerfiles, `compose*.yaml`, `.env.example` | Create | Entornos dev/prod, health y config. |
| `tests/`, `README.md`, `requirements.txt` | Modify | Caracterización, docs, dependencias. |
| `main.py`, `src/`, `verify/` | Remove after parity | Quitar Streamlit/Peewee/scripts tras gates. |

## Interfaces / Contracts

- HTTP: rutas `/api/v1/{portfolio,transactions,valuations,market,alerts,wishlist,bibliography,analysis}` con schemas Pydantic; validar antes de mutar.
- Dominio: `Decimal`, currency ISO, ticker/broker/categoría/fecha; compra ponderada, venta conserva promedio y rechaza sobreventa atómicamente.
- Valuation: agrupar por moneda; nunca sumar/importar FX implícito.
- Alerts: evaluar precio previo/actual, target e intent; neutral ambos sentidos, buy/stop-loss abajo, sell arriba; guardar estado anti-repetición.
- Persistence: repositorios; transacción cubre operación y posición.
- Migration: copia SQLite inmutable, import transaccional, IDs/reconciliación; mapeo explícito de moneda e intent legacy.
- Agent: `FinancialReadTools`, sin writes ni SQL arbitrario.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Reglas, promedio, valuación, señales y split | pytest con objetos/puertos falsos; sin DB ni red. |
| Integration | Repositorios, transacciones, API y migración | pytest + PostgreSQL Compose; fixture SQLite de origen. |
| Frontend | formularios, estados y gráficos | Vitest + React Testing Library; cliente API mockeado. |
| E2E | corte vertical y despliegue | Playwright contra Compose, smoke de health/readiness y flujos críticos. |

Caracterizar sobre DB aislada; los cuatro tests actuales pasan. Probar sobreventa/atomicidad; no llamar yfinance en CI.

## Migration / Rollout

1. Congelar reglas; resolver discrepancias de moneda, precisión y alertas.
2. Crear backend, DB y tests en paralelo; conservar Streamlit como runtime actual.
3. Importar copia de `finance.db` con dry-run y reporte; no compartir escrituras ni modificar fuente.
4. Portar capacidades por cortes y comprobar paridad.
5. En el corte, detener escrituras legacy, respaldar, importar/reconciliar y habilitar React/API; conservar snapshot para rollback.
6. Retirar Streamlit/SQLite/Peewee y residuos tras aceptación y restauración probada.

## Open Questions

- [ ] ¿Qué mecanismo protegerá el acceso al despliegue single-user en Coolify?
- [ ] ¿Qué fuente FX usar en una fase futura si se requieren totales convertidos?
- [ ] Definir límites de caché/atribución de yfinance y seleccionar modelo/región AWS mediante entorno antes del agente productivo.
- [ ] Mapear explícitamente la intención de alertas antiguas durante migración; no inferir stop-loss/buy/sell desde el precio actual.
