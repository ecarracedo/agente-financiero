# Snapshot diario de valor del portafolio

Objective: Guardar una foto del valor total del portafolio una vez al día (17 hs Argentina, UTC-3, configurable) para que el gráfico de rendimiento histórico lea de esa tabla en lugar de recalcular bajo demanda. Incluye tabla de configuración para hora y zona horaria del snapshot.

Branch: feature/portfolio-daily-snapshot
Delivery strategy: ask-on-risk (default)
Test runner: pytest (backend) y vitest (frontend)

## Specs

S1: Tabla `portfolio_daily_snapshots` con `id`, `date` (date única), `total_value` (monto total del portafolio ese día), `created_at`. Una fila por día.

S2: Tabla `app_settings` con `key`, `value` para guardar configuración: `snapshot_hour` (default 17), `snapshot_timezone` (default America/Argentina/Buenos_Aires / UTC-3).

S3: Endpoint `POST /api/v1/portfolio/snapshots` genera el snapshot del día actual (o fecha dada): lee todas las transacciones, trae precios de cierre de cada ticker (en paralelo), calcula el valor total y guarda una fila (idempotente: si ya existe para esa fecha, la reemplaza).

S4: Endpoint `GET /api/v1/portfolio/snapshots` devuelve la lista de snapshots ordenada por fecha, con `date`, `total_value`, `cumulative_return` (vs el primer snapshot).

S5: Endpoint `GET /api/v1/portfolio/snapshot/schedule` y `PUT /api/v1/portfolio/snapshot/schedule` para leer/escribir la hora y zona horaria del snapshot.

S6: El frontend `HistoricalChartCard` consume `GET /api/v1/portfolio/snapshots` para dibujar la curva. No recalcula bajo demanda. Elimina el benchmark y los datos hardcodeados.

## Tasks

| ID | S# | Route | Status | Commit |
|----|----|-------|--------|--------|
| T1 | S1/S2 | inline | done | — |
| T2 | S1/S2 | inline | done | — |
| T3 | S1/S2 | inline | done | — |
| T4 | S3 | inline | done | — |
| T5 | S3 | inline | done | — |
| T6 | S4 | inline | done | — |
| T7 | S4 | inline | done | — |
| T8 | S5 | inline | done | — |
| T9 | S5 | inline | done | — |

## Log

L1: Cambiar de enfoque: snapshot diario a las 17 hs Argentina (UTC-3) en lugar de cálculo bajo demanda.

L2: Backend implementado: modelos SQLAlchemy (`portfolio_daily_snapshots`, `app_settings`), migración alembic `a0007_daily_snapshot`, puertos de repositorio, `PortfolioSnapshotUseCases`, schemas Pydantic, 4 endpoints FastAPI, openapi.json regenerado, 6 tests nuevos. Backend 223 tests pasan.

L3: Frontend implementado: `HistoricalChartCard` consume `GET /api/v1/portfolio/snapshots`, elimina benchmark y datos hardcodeados, agrega estados de carga/error/vacío, formatea moneda como "$ 1.000,00". TypeScript limpio. Handler MSW agregado para tests. Frontend tests pasan (1 flaky preexistente aislado).

Risk: item 1 (data / stored data) — se escriben tablas nuevas (snapshots, settings). Solo lectura de transacciones existentes y precios de mercado. Risk: item 1.
