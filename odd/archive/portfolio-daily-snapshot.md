# Snapshot diario de valor del portafolio

Objective: Guardar una foto del valor total del portafolio una vez al día (17 hs Argentina, UTC-3, configurable) para que el gráfico de rendimiento histórico lea de esa tabla en lugar de recalcular bajo demanda. Incluye tabla de configuración para hora y zona horaria del snapshot.

Branch: feature/portfolio-daily-snapshot
Delivery strategy: ask-on-risk (default)
Test runner: pytest (backend) y vitest (frontend)

## Specs

S1: Tabla `portfolio_daily_snapshots` con `id`, `date` (date única), `total_value` (monto total del portafolio ese día), `created_at`. Una fila por día.

S2: Tabla `app_settings` con `key`, `value` para guardar configuración: `snapshot_hour` (default 17), `snapshot_timezone` (default America/Argentina/Buenos_Aires / UTC-3).

S3: Endpoint `POST /api/v1/portfolio/snapshots` genera snapshots estimados de los últimos N días (default 30) en ARS. Lee todas las transacciones, valúa con precios actuales (proveedor, o costo promedio como fallback), convierte USD a ARS usando CCL (bonos GD30/GD30D 1:1 vía MEP; AAPL cedears 20:1 vía CCL). Guarda una fila por día.

S4: Endpoint `GET /api/v1/portfolio/snapshots` devuelve la lista de snapshots ordenada por fecha, con `date`, `total_value`, `cumulative_return` (vs el primer snapshot).

S5: Endpoint `GET /api/v1/portfolio/snapshot/schedule` y `PUT /api/v1/portfolio/snapshot/schedule` para leer/escribir la hora y zona horaria del snapshot.

S6: El frontend `HistoricalChartCard` consume `GET /api/v1/portfolio/snapshots` para dibujar la curva. No recalcula bajo demanda. Elimina el benchmark y los datos hardcodeados.

## Tasks

| ID | S# | Route | Status | Commit |
|----|----|-------|--------|--------|
| T1 | S1/S2 | inline | done | c63084c |
| T2 | S1/S2 | inline | done | c63084c |
| T3 | S1/S2 | inline | done | c63084c |
| T4 | S3 | inline | done | c63084c |
| T5 | S3 | inline | done | c63084c |
| T6 | S4 | inline | done | c63084c |
| T7 | S4 | inline | done | c63084c |
| T8 | S5 | inline | done | c63084c |
| T9 | S5 | inline | done | c63084c |

## Log

L1: Cambiar de enfoque: snapshot diario a las 17 hs Argentina (UTC-3) en lugar de cálculo bajo demanda.

L2: Backend implementado: modelos SQLAlchemy (`portfolio_daily_snapshots`, `app_settings`), migración alembic `a0007_daily_snapshot`, puertos de repositorio, `PortfolioSnapshotUseCases`, schemas Pydantic, endpoints FastAPI (POST/GET snapshots, GET/PUT schedule), openapi.json regenerado. 223 backend tests pasan.

L3: Frontend implementado: `HistoricalChartCard` consume `GET /api/v1/portfolio/snapshots`, elimina benchmark y datos hardcodeados, agrega estados de carga/error/vacío, formatea moneda como "$ 1.000,00". TypeScript limpio. Handler MSW agregado para tests. Frontend tests pasan (1 flaky preexistente aislado).

L4: Cambio a estimado en ARS: valúa con precios actuales del proveedor (o costo promedio como fallback), convierte USD a ARS vía CCL/MEP. Genera 30 snapshots diarios. Valor más reciente: $8.749.211,75.

Risk: item 1 (data / stored data) — se escriben tablas nuevas (snapshots, settings). Solo lectura de transacciones existentes y precios de mercado. Risk: item 1.
