# Tasks: Modernización full-stack del agente financiero

## Phase 1: Decisiones y contratos

- [x] 1.1 Resolver y registrar en `design.md` single/multi-user, monedas/precisión, proveedor de mercado y primer caso del agente.
- [x] 1.2 Escribir pruebas de caracterización en `tests/` para promedio, ventas, borrado/reconstrucción, valuación, señales técnicas y split; ejecutar RED/GREEN sin usar `finance.db`.

## Phase 2: Backend y persistencia

- [x] 2.1 Crear `backend/pyproject.toml` y `backend/app/main.py` con app factory y health route; probar respuesta y OpenAPI antes de implementarlos.
- [x] 2.2 Implementar entidades/reglas `Decimal` en `backend/app/domain/`; probar compras, ventas, sobreventa atómica y split antes del código.
- [x] 2.3 Crear modelos SQLAlchemy y repositorios en `backend/app/adapters/persistence/`; cubrir CRUD y transacciones con tests.
- [x] 2.4 Configurar Alembic y PostgreSQL en Compose; probar migración de esquema y readiness contra una DB limpia.

## Phase 3: Casos de uso y API

- [x] 3.1 Implementar casos de uso de posiciones e historial en `backend/app/application/`; probar compra, venta, eliminación y recálculo.
- [x] 3.2 Implementar valuación, P&L, alertas configurables (neutral, stop-loss, compra, venta) y análisis de mercado; probar cruces, mensajes, datos faltantes y no repetición.
- [x] 3.3 Implementar wishlist, bibliografía y split; probar alta, edición, borrado, consulta y ratios válidos.
- [x] 3.4 Exponer contratos `/api/v1/` en `backend/app/api/`; probar escenarios HTTP, errores y OpenAPI.

## Phase 4: Migración de datos

- [x] 4.1 Crear lector/validador dry-run para copia SQLite en `backend/app/adapters/migration/`; probar campos requeridos, tipos y reporte sin escribir.
- [x] 4.2 Implementar import transaccional e idempotente con IDs de origen y reconciliación; probar repetición, rollback y discrepancias.
- [x] 4.3 Ensayar migración de una copia de `finance.db`, comparar conteos/saldos por entidad y documentar restauración; nunca modificar la fuente.

## Phase 5: Frontend React

- [x] 5.1 Crear `frontend/` con Vite, React, TypeScript y cliente generado desde OpenAPI; probar configuración y estados del cliente.
- [ ] 5.2 Implementar cartera, operaciones e historial en `frontend/src/`; probar flujos de compra/venta, errores y refresco de datos.
- [ ] 5.3 Implementar gráficos, oportunidades y alertas; probar overlays, ticker/periodo, precio faltante y estados objetivo.
- [ ] 5.4 Implementar wishlist, bibliografía y calculadora de split; probar CRUD y resultados de ratios.

## Phase 6: Agente y despliegue

- [ ] 6.1 Integrar Strands en `backend/app/agents/` con allowlist read-only; probar consultas y que solicitudes de mutación no cambien datos.
- [ ] 6.2 Crear Dockerfiles y `compose.yaml`, `compose.dev.yaml`, `.env.example`; probar hot reload, healthchecks, volumen persistente y DB no expuesta.
- [ ] 6.3 Validar despliegue Coolify y flujos E2E con Playwright contra Compose; probar reinicio, errores de dependencia y recorrido principal.

## Phase 7: Corte y limpieza

- [ ] 7.1 Actualizar `README.md` y manifiestos de dependencias; documentar setup, variables, migración, rollback y operación.
- [ ] 7.2 Ejecutar gate de paridad, backup, freeze de escrituras, reconciliación y restauración antes del corte; registrar aceptación y rollback.
- [ ] 7.3 Retirar `main.py`, `src/ui/`, Peewee, SQLite runtime, scripts/dependencias obsoletos solo tras aprobar el gate; conservar copia de datos según decisión del usuario.
