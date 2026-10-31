# Apply Spec: Modernización full-stack del agente financiero

Este documento es la especificación de ejecución del `sdd-apply`. Define, tarea por tarea, qué implementar, dónde, con qué contratos, qué decisiones quedan abiertas y cómo se verifica cada corte. No reemplaza `proposal.md`, `design.md`, `tasks.md` ni los `specs/*/spec.md`: los aterriza en trabajo ejecutable. Las reglas de dominio ya registradas en `design.md` (Decimal/`NUMERIC`, single-user, moneda ISO por operación, intents `NEUTRAL`/`STOP_LOSS`/`BUY`/`SELL`, Strands read-only, Compose dev/prod) son vinculantes.

> Estado del pipeline: los artefactos SDD viven en `openspec/changes/financial-agent-modernization/` en el sistema de archivos. Engram no contiene artefactos SDD de este change; apply y archive deben leer y escribir aquí.

---

## 1. Objetivo y alcance del `sdd-apply`

**Objetivo.** Completar las tareas pendientes del change (`3.4` y Fases 4–7) hasta que sus criterios de aceptación sean verificables y pasen los gates de `pytest`, `mypy`, `ruff`, Compose/readiness y E2E.

**Alcance.**

- Cerrar el contrato HTTP `/api/v1` (tarea 3.4) y las tres deudas de gate que lo bloquean: serialización de `Decimal`, tipado del `Callable` de unit-of-work y manifiesto de paquetes.
- Implementar el migrador SQLite→PostgreSQL (Fase 4), el frontend React (Fase 5), el agente Strands read-only y el despliegue Compose/Coolify (Fase 6), y el corte/limpieza (Fase 7).
- Mantener Streamlit y `finance.db` operativos hasta que el gate de paridad de 7.2 los declare reemplazables.

**No objetivo.** Producir nuevas funcionalidades financieras, cambiar reglas de negocio ya caracterizadas, ni ampliar capacidades más allá de la paridad con la aplicación Streamlit actual.

**Fuera de alcance** (ver sección 5): microservicios, trading automático/ejecución de órdenes, sincronización cloud.

---

## 2. Estado actual verificado

### 2.1 Lo que ya funciona

| Área | Estado |
|------|--------|
| Dominio `Decimal` | `backend/app/domain/` con compra ponderada, venta sin alterar promedio, rechazo de sobreventa, valuación por moneda, análisis técnico y alertas por intent — unit tests verdes. |
| Casos de uso | `backend/app/application/` con cartera, historial, borrado/recálculo, analítica, alertas y recursos — tests verdes. |
| Persistencia | SQLAlchemy 2 + Alembic (`a0001_initial`, `a0002_target_alerts`), repositorios sin ownership de commit, unit-of-work. |
| Compose base | `compose.yaml` + `Dockerfile.backend`; PostgreSQL con `expose` (no `ports`), backend dependiente del healthcheck y Alembic antes de Uvicorn. |
| Verificación previa | Stack Compose en vivo alcanzó `a0002_target_alerts (head)` y `/ready` → 200 (registrado en `apply-progress.md`, no re-ejecutado en esta sesión). |

### 2.2 Defectos ya corregidos por el orquestador

- `backend/app/main.py`: un `Engine` inyectado se trataba como `callable` (`TypeError: 'Engine' object is not callable`), rompiendo todas las rutas `/api/v1`. Ahora `engine_provider` es una función anidada que devuelve el engine inyectado o el default perezoso.
- `backend/tests/test_api.py`: el fixture usaba SQLite en memoria con `TestClient` hilo-secundario y fallaba con "no such table". Ahora usa `StaticPool` + `check_same_thread=False`.

### 2.3 Snapshot de gates (ground truth de esta sesión)

Comandos ejecutados en esta sesión (sin escritura fuera de `apply-spec.md`):

| Gate | Comando | Resultado observado |
|------|---------|---------------------|
| Tests | `python -m pytest -q -p no:cacheprovider` | **3 failed, 75 passed** (78 colectados) |
| Mypy (bloqueante del change) | `PYENV_VERSION=3.12.10 python -m mypy backend/app/main.py --no-incremental` | **3 errors** en `main.py:54,58,59` (`arg-type`) |
| Mypy (repo) | `PYENV_VERSION=3.12.10 python -m mypy .` | ~**92 errores / 25 archivos** (mayoría legacy: `streamlit`, `plotly`, `pandas`, `peewee`, `src/`); falta `types-PyYAML` |
| Ruff (backend) | `python -m ruff check backend --no-cache` | **1 error** — `F401` import `datetime` sin usar en `backend/tests/test_api.py:3` |
| Ruff (repo) | `python -m ruff check .` | ~61 errores, casi todos legacy (`src/ui/*`, `main.py`) |

**Los 3 tests que fallan** (`backend/tests/test_api.py`):

1. `test_transaction_endpoints_record_history_and_reject_oversale`
2. `test_delete_transaction_endpoint_rebuilds_position`
3. `test_valuation_and_analysis_endpoints_preserve_currency`

Causa raíz común: el API serializa `Decimal` proveniente de persistencia con la escala `Numeric(30,10)` (p. ej. `"1.0000000000"`, `"4.0000000000"`, `"30.0000000000"`) mientras el contrato ejecutable espera strings normalizados (`"1"`, `"4"`, `"30"`). Detalle observado: una posición recién creada desde el request serializa `"2"` (Decimal sin escala), pero al releerse de la DB y operar sobre ella el resultado arrastra 10 decimales.

### 2.4 Deuda pendiente (OPEN)

- **Contrato Decimal del API** (sección 3.A).
- **Tipo `Callable[[], PortfolioUnitOfWorkPort]`** en `main.py` (sección 3.B).
- **Paquetes setuptools faltantes** `backend.app.application` y `backend.app.api` (sección 3.C).
- **Tareas pendientes:** 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3 (14 tareas).

### 2.5 Notas de entorno

- Python disponible `3.13.3`; `backend/pyproject.toml` declara `requires-python = ">=3.13"`. Mypy se ejecuta con `PYENV_VERSION=3.12.10`.
- Docker + Compose disponibles, pero el stack en vivo **no** se ejecutó en esta verificación.
- `finance.db` fuente actual: tablas `portfolioitem` (8 filas, con `target_price`, sin `alert_intent` ni moneda), `"transaction"` (9 filas), `wishlistitem` (0), `bibliographyitem` (0). Columnas legacy en `src/models/database.py`.

---

## 3. Decisiones de contrato abiertas

Cada decisión se presenta con opciones, tradeoffs y una recomendación. El apply debe registrar la resolución elegida (idealmente con confirmación humana) antes de implementar la tarea que la consume.

### 3.A Serialización de `Decimal` en el API

**Contexto.** `backend/app/api/routes.py` serializa dataclasses de dominio (`PortfolioPosition`) o `dict` directamente como `response_model`, sin schemas de respuesta dedicados. Los `Decimal` que pasaron por `Numeric(30,10)` salen con 10 decimales fijos; los que provienen del request salen sin escala. El contrato ejecutable (`backend/tests/test_api.py`) exige strings normalizados: `"2"`, `"1"`, `"10"`, `"15"`, `"30"`, `"20"`, `"200"`.

**Opciones.**

| Opción | Descripción | Tradeoff |
|--------|-------------|----------|
| A1 (recomendada) | Schemas Pydantic de respuesta dedicados + un serializador de campo compartido que canonicaliza `Decimal` a string sin ceros finales ni notación científica. | Explícito, testeable, independiente del adaptador, no filtra escala de persistencia. Requiere tocar `schemas.py` y `routes.py`. |
| A2 | Encoder JSON global en la app (`json_encoders`) o middleware que normalice. | Afecta a toda la app (incluye no-API), menos explícito y más difícil de testear por endpoint. |
| A3 | Mantener la escala `Numeric(30,10)` y relajar el test. | Rompe el contrato ya escrito y expone detalle de persistencia; rechazada. |

**Recomendación: A1 — CONFIRMADA (usuario, 2026-10-10), con matiz de 2 decimales.** Crear `backend/app/api/serialization.py` con dos helpers:

- `format_money(value: Decimal) -> str`: redondea a **2 decimales con `ROUND_HALF_UP`** y canonicaliza (sin ceros finales, sin exponente). `Decimal("30.0000000000")` → `"30"`, `Decimal("2.5000000000")` → `"2.5"`, `Decimal("2.567")` → `"2.57"`. Se aplica a campos monetarios (`unit_price`, `average_price`, `target_price`, `market_value`, P&L).
- `format_quantity(value: Decimal) -> str`: **sin cap**, solo canonicaliza (sin ceros finales, sin exponente). Preserva unidades fraccionarias. Se aplica a `quantity`.

Regla de precisión: el redondeo ocurre **solo en la serialización de salida**; el almacenamiento `NUMERIC` y la aritmética de dominio NO se tocan (evita descuadres "suma de partes ≠ total"). Definir schemas de respuesta con `model_config = ConfigDict(from_attributes=True)` y usarlos como `response_model`; los campos monetarios y de cantidad se tipan como el tipo anotado que serializa con el helper correspondiente.

**Contrato ejecutable:** SÍ — **los tests existentes de `backend/tests/test_api.py` son la fuente de verdad del contrato**. El apply debe hacerlos pasar sin debilitarlos, quitarlos ni cambiar sus asserts. Si en el futuro se requiere otro formato (por ejemplo cantidad fija de decimales), es una decisión nueva que exige actualizar explícitamente ese test y este documento.

### 3.B Fix de protocolo `Callable[[], PortfolioUnitOfWorkPort]` (mypy)

**Contexto.** `PortfolioUnitOfWorkFactory = Callable[[], PortfolioUnitOfWorkPort]` en `application/ports.py`. En `main.py` la factoría local se infiere `Callable[[], SqlAlchemyPortfolioUnitOfWork]`, cuyo tipo de retorno no es asignable al alias del puerto (el tipo de retorno de un `Callable` es invariante). Errores en `main.py:54,58,59`.

**Opciones.**

| Opción | Descripción | Tradeoff |
|--------|-------------|----------|
| B1 (recomendada) | Anotar la factoría con el alias `PortfolioUnitOfWorkFactory`/`PortfolioUnitOfWorkPort` y declarar en `SqlAlchemyPortfolioUnitOfWork` los atributos públicos tipados (`portfolio: PortfolioRepositoryPort`, `resources: ResourceRepositoryPort`). | Respeta la inversión de dependencias (application no depende del adaptador); mayúsculo beneficio de tipado. |
| B2 | Cambiar `PortfolioUseCases.__init__` (y demás) para aceptar `Callable[[], SqlAlchemyPortfolioUnitOfWork]`. | Acopla application al adaptador; viola la arquitectura hexagonal; rechazada. |
| B3 | `# type: ignore[arg-type]` en las tres llamadas. | Oculta el problema y deshabilita el gate; rechazada. |

**Recomendación: B1.** Importar el alias en `main.py` y tipar `def unit_of_work_factory() -> PortfolioUnitOfWorkPort:`. En `SqlAlchemyPortfolioUnitOfWork`, declarar los atributos de instancia con tipo de puerto para que mypy valide la conformancia estructural (hoy solo se asignan en `__enter__`).

### 3.C Paquetes setuptools faltantes

**Contexto.** `backend/pyproject.toml` `[tool.setuptools].packages` incluye `backend`, `backend.app`, `backend.app.domain`, `backend.app.adapters`, `backend.app.adapters.persistence`, pero omite `backend.app.application` y `backend.app.api` (y omitirá los nuevos `backend.app.agents`, `backend.app.adapters.migration`). Una distribución instalada perdería esos módulos.

**Opciones.**

| Opción | Descripción | Tradeoff |
|--------|-------------|----------|
| C1 (recomendada) | Agregar explícitamente los paquetes faltantes y los que creen las Fases 4–6, y extender `backend/tests/test_project_manifest.py` para cubrirlos. | Coherente con el estilo actual; mantiene verde el test de manifiesto sin reescribir su lectura de `packages`. |
| C2 | Migrar a `[tool.setuptools.packages.find]`. | Más robusto ante futuros paquetes, pero el test actual lee `project["tool"]["setuptools"]["packages"]` y fallaría; exigiría reescribir el test. |

**Recomendación: C1.** Lista explícita + actualización del test de manifiesto.

---

## 4. Especificación tarea por tarea

Convenciones aplicables a todas las tareas (reglas del repo):

- **Docstrings en INGLÉS** en todo el código nuevo.
- Tests unitarios/integración nuevos en `backend/tests/` (backend) o `tests/` (legacy/dominio raíz); tests de frontend en `frontend/`.
- Scripts manuales con prefijo `verify_` dentro de `verify/`.
- Actualizar `README.md` ante cambios de instalación/uso/configuración; registrar features/bugfixes en `CHANGELOG.md` (y `CHANGELOG_es.md`) al hacer merge `dev`→`main`.
- TDD estricto: RED (test que falla) → GREEN (mínimo cambio) → TRIANGULATE (casos alternos/negativos) → REFACTOR.
- No tocar `finance.db` real en tests; usar copias temporales.

---

### Tarea 3.4 — Exponer y estabilizar los contratos `/api/v1`

**Objetivo.** Cerrar el contrato HTTP del backend: schemas de respuesta dedicados con normalización canónica de `Decimal`, `response_model` explícito en todas las rutas, OpenAPI completo y los 3 tests de `test_api.py` en verde; además resolver las deudas de gate que lo bloquean (3.B mypy, 3.C paquetes, F401 de ruff).

**Archivos.**

- Crear: `backend/app/api/serialization.py`; opcionalmente `backend/tests/test_api_contract.py` para casos de serialización aislados.
- Modificar: `backend/app/api/schemas.py` (schemas de respuesta), `backend/app/api/routes.py` (`response_model` + mapeo), `backend/app/adapters/persistence/unit_of_work.py` (atributos tipados), `backend/app/main.py` (tipar `unit_of_work_factory` con el puerto), `backend/pyproject.toml` (paquetes), `backend/tests/test_project_manifest.py` (nuevos paquetes), `backend/tests/test_api.py` (quitar import `datetime` sin usar; **no** cambiar asserts).

**Contratos/Interfaces.**

- `format_decimal(value: Decimal) -> str`: string canónico sin ceros finales ni exponente.
- Tipos de respuesta: `PortfolioPositionResponse`, `TransactionSummaryResponse`, `CurrencyValuationResponse`, `MarketAnalysisResponse`, `WishlistItemResponse`, `BibliographyItemResponse`, `TargetAlertEventResponse`, `AlertCheckResponse`, `SplitProjectionResponse`, `MutationResponse`.
- Cada campo monetario es `Decimal` con el serializador canónico; campos opcionales permanecen `| None` (no se convierten a `"0"`).
- `response_model` en: `GET /portfolio`, `POST /transactions`, `GET /transactions`, `GET /valuations`, `GET /analysis/{ticker}`, `POST .../alert/check`, `GET /wishlist`, `GET /bibliography`, `POST /splits`.

**Decisiones.** 3.A (A1), 3.B (B1), 3.C (C1). El contrato es el de `test_api.py` existente.

**Plan TDD.**

- RED: los 3 tests de `test_api.py` ya fallan (evidencia observada). Añadir casos RED en `test_api_contract.py` para `format_decimal` (escala 10 → entero canónico; valor con decimales significativos; `None` en valuación no disponible).
- GREEN: implementar serializador, schemas y `response_model`; corregir tipado de `main.py`/unit-of-work; agregar paquetes.
- TRIANGULATE: venta con Decimal persistido, valuación con `market_value=None`, split con ratio no entero, análisis con `status="UNKNOWN"`.
- REFACTOR: reutilizar el tipo anotado de `Decimal` en todos los schemas; sin duplicar serializadores.

**Criterios de aceptación.**

- `python -m pytest -q` → 0 fallos; los 3 tests nombrados pasan sin modificar asserts.
- `PYENV_VERSION=3.12.10 python -m mypy backend/app/main.py --no-incremental` → 0 errores (los 3 `arg-type` resueltos).
- `python -m ruff check backend --no-cache` → 0 errores.
- `/openapi.json` incluye `/api/v1/transactions`, `/api/v1/portfolio/{ticker}/alert`, `/api/v1/valuations`, `/api/v1/splits`.
- Toda respuesta monetaria es string canónico verificable.

**Dependencias.** Ninguna pendiente; habilita Fases 5 (cliente OpenAPI) y 6 (agente/despliegue).

**Riesgos.** Regresión de contrato si se relajan asserts (prohibido); fuga de escala si algún endpoint queda sin `response_model`; que `from_attributes` no mapee dataclasses frozen con campos extra (validar con test).

---

### Tarea 4.1 — Lector/validador dry-run de la copia SQLite

**Objetivo.** Leer una copia inmutable de `finance.db` sin escribir en el destino, validar campos requeridos/tipos/relaciones y producir un reporte de reconciliación previo, incluyendo el mapeo explícito de moneda.

**Archivos.**

- Crear: `backend/app/adapters/migration/__init__.py`, `backend/app/adapters/migration/source.py` (lector `sqlite3` read-only), `backend/app/adapters/migration/validation.py` (reglas), `backend/app/adapters/migration/report.py` (modelos de reporte), `backend/tests/test_migration_dry_run.py`, `verify/verify_migration_dry_run.py`.
- Modificar: `backend/pyproject.toml` (agregar `backend.app.adapters.migration` a packages y al test de manifiesto).

**Contratos/Interfaces.**

- Dataclasses de origen: `SourcePortfolioItem`, `SourceTransaction`, `SourceWishlistItem`, `SourceBibliographyItem` (columnas según `src/models/database.py`; `operation_type` legacy `"Compra"`/`"Venta"`).
- `read_source(path) -> SourceSnapshot` abre la copia en modo solo lectura (`file:...?mode=ro`).
- `CurrencyMapping` explícito `dict[str, str]` (o archivo de configuración) que asigna moneda por fila/ticker; **nunca** infiere.
- `ValidationReport`: conteos por entidad, filas rechazadas con motivo, filas con moneda no resuelta, `ready: bool`.
- El dry-run **no escribe** en el destino; abre la fuente con `mode=ro`.

**Decisiones.** Moneda: mapeo explícito obligatorio (design.md + spec `postgres-data-migration`). `finance.db` fuente actual: 8 posiciones, 9 transacciones, 0 wishlist, 0 bibliografía.

**Plan TDD.**

- RED: tests con una copia SQLite temporal (fixtures; nunca `finance.db`) que esperan reporte con conteos y filas no resueltas.
- GREEN: implementar lector y validador.
- TRIANGULATE: fila con monto inválido, `target_price` nulo, `operation_type` desconocido, moneda no mapeada, DB de origen ausente.
- REFACTOR: separar lectura, validación y formato del reporte.

**Criterios de aceptación.**

- `verify/verify_migration_dry_run.py` produce reporte con conteos y filas no resueltas sin modificar la fuente ni el destino.
- Test de que abrir la fuente en `mode=ro` falla al intentar escribir.
- `python -m pytest -q backend/tests/test_migration_dry_run.py` verde.

**Dependencias.** 2.3/2.4 (modelos/DB destino). Precede a 4.2.

**Riesgos.** Copiar `finance.db` equivocadamente en tests; inferir moneda silenciosamente (prohibido); mal mapeo `date`→`occurred_at` con zona horaria.

---

### Tarea 4.2 — Import transaccional e idempotente con IDs de origen y reconciliación

**Objetivo.** Importar el `SourceSnapshot` validado a PostgreSQL en una transacción atómica, idempotente (repetible sin duplicar) y reconciliable, con rollback ante fallo.

**Archivos.**

- Crear: `backend/app/adapters/migration/importer.py`, `backend/app/adapters/migration/runner.py` (orquestación dry-run + import + reconcile), `backend/app/adapters/migration/__main__.py` (CLI `python -m backend.app.adapters.migration`), `backend/alembic/versions/a0003_migration_source_ids.py`, `backend/tests/test_migration_import.py`.
- Modificar: `backend/app/adapters/persistence/models.py` (columnas `source_id` únicas por entidad, nullable para datos nativos), `backend/pyproject.toml`/manifiesto.

**Contratos/Interfaces.**

- Idempotencia por ID de origen: agregar `source_id: int | None` con `UniqueConstraint` en `portfolio_positions`, `portfolio_transactions`, `wishlist_items`, `bibliography_items` (migración `a0003`).
- Mapeo `operation_type`: `"Compra"`→`"BUY"`, `"Venta"`→`"SELL"`; valor desconocido → rechazo validado.
- Moneda obligatoria desde `CurrencyMapping`; sin mapping no se marca `ready`.
- `ImportResult`/`ReconciliationReport`: insertados, actualizados, omitidos por duplicado, rechazados; comparación de conteos y saldos por entidad.
- El import corre dentro de una única transacción del destino; commit solo si `ValidationReport.ready`.

**Decisiones.** Idempotencia y reconciliación por ID de origen (design.md). Alert intents legacy quedan `NULL` (no se infiere STOP_LOSS/BUY/SELL).

**Plan TDD.**

- RED: test de import sobre copia temporal → conteos equivalentes; segundo run no duplica; validación fallida revierte todo.
- GREEN: implementar importer + migración `a0003`.
- TRIANGULATE: repetir import tras importar parcialmente; transacción con ID de origen colisionante; rollback deja destino intacto; conteos reconciliados.
- REFACTOR: reutilizar repositorios/UoW existentes.

**Criterios de aceptación.**

- Import repetido sobre el mismo origen no crea duplicados.
- Fallo de validación → destino sin cambios (transacción revertida).
- `ReconciliationReport` reporta mapeadas vs no resueltas.
- Migración `a0003` corre en limpio y contra esquema existente.

**Dependencias.** 4.1 (validador). Habilita 4.3 y 7.2.

**Riesgos.** Colisión de unicidad con datos nativos; pérdida de precisión float→Decimal al importar legacy (documentar cuantización); escritura parcial si la transacción no cubre todas las entidades.

---

### Tarea 4.3 — Ensayo de migración sobre copia de `finance.db`

**Objetivo.** Ejecutar el flujo completo sobre una copia de `finance.db`, comparar conteos/saldos por entidad y documentar el procedimiento de restauración, sin modificar nunca la fuente.

**Archivos.**

- Crear: `verify/verify_migration_rehearsal.py`; documentar procedimiento en `README.md` (sección migración) y/o `docs/operations/migration.md`.
- Modificar: `apply-progress.md` con evidencia.

**Contratos/Interfaces.**

- Copia de seguridad previa (`finance.db` → archivo versionado temporal fuera de git).
- Reconciliación: 4 entidades, conteos origen vs destino, saldos de `avg_price`/`quantity` y total de transacciones.
- Procedimiento de restauración probado (destino vuelve al último backup válido; fuente intacta).

**Decisiones.** La fuente se conserva y nunca se modifica (proposal/design). No borrar `finance.db`.

**Plan TDD.**

- RED: script de verificación que falla si los conteos difieren o si detecta modificación de la fuente (hash antes/después).
- GREEN: correr dry-run + import + reconcile sobre la copia.
- TRIANGULATE: reejecución idempotente; discrepancia simulada → reporte + rollback.
- REFACTOR: parametrizar rutas origen/destino.

**Criterios de aceptación.**

- Hash de `finance.db` igual antes y después.
- Reporte de reconciliación con conteos coincidentes (8/9/0/0 sobre la copia actual).
- Restauración documentada y ejecutada al menos una vez.

**Dependencias.** 4.2. Insumo para 7.2.

**Riesgos.** Ejecutar por error contra la DB de producción; mezclar datos de ensayo con reales; no restaurar antes de liberar espacio.

---

### Tarea 5.1 — Scaffold `frontend/` con Vite + React + TypeScript y cliente OpenAPI

**Objetivo.** Crear el proyecto frontend con toolchain (Vite, React, TypeScript), testing (Vitest + React Testing Library) y un cliente tipado generado desde el OpenAPI del backend.

**Archivos.**

- Crear: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/api/client.ts`, `frontend/src/api/types.ts` (generados con `openapi-typescript`), `frontend/src/api/http.ts`, `frontend/tests/setup.ts`, `frontend/src/App.test.tsx`, `frontend/.eslintrc`/`eslint.config.js`.
- Modificar: `.gitignore` (artefactos node), `README.md` (comandos frontend).

**Contratos/Interfaces.**

- `types.ts` generado desde `http://localhost:8000/openapi.json` (o artefacto versionado). Script `npm run generate:api`.
- Cliente `http.ts` con `baseUrl` configurable por entorno (`VITE_API_BASE_URL`), manejo de errores y parseo de strings monetarios como strings (no `Number`).
- Estados de carga/error tipados.

**Decisiones.** Frontend React/Vite + contrato OpenAPI (design.md). No acceso directo a DB.

**Plan TDD.**

- RED: test de que el cliente arma URLs base y propaga errores HTTP; test de render mínimo de `App`.
- GREEN: scaffold + cliente.
- TRIANGULATE: respuesta 422/503, base URL ausente, tipo de dato monetario string.
- REFACTOR: separar generación de tipos del cliente de runtime.

**Criterios de aceptación.**

- `npm run build` y `npm test` verdes en `frontend/`.
- Tipos generados compilan contra el OpenAPI real.
- `App` renderiza sin backend real (cliente mockeado).

**Dependencias.** 3.4 (OpenAPI estable). Habilita 5.2–5.4 y 6.2/6.3.

**Riesgos.** Drift entre tipos generados y API (versionar el artefacto OpenAPI); dependencias npm que requieran red en CI (documentar).

---

### Tarea 5.2 — Cartera, operaciones e historial en el frontend

**Objetivo.** Implementar las vistas de resumen de cartera, posiciones, valuación/P&L, formularios de compra/venta e historial con refresco tras mutación y presentación de errores.

**Archivos.**

- Crear: `frontend/src/features/portfolio/*`, `frontend/src/features/transactions/*`, `frontend/src/components/*` (tabla, formulario, estados carga/error), tests `*.test.tsx` por feature.
- Modificar: `frontend/src/App.tsx` (ruteo/tabs).

**Contratos/Interfaces.**

- Usa `/api/v1/portfolio`, `/api/v1/transactions` (GET/POST/DELETE), `/api/v1/valuations`.
- Montos mostrados como string + etiqueta de moneda; totales agrupados por moneda; nunca suma entre monedas.
- Operación rechazada (422) se muestra como error, no como éxito.

**Decisiones.** Moneda ISO por operación y valuación por moneda (design.md).

**Plan TDD.**

- RED: flujo de compra refresca posiciones e historial; venta inválida muestra error.
- GREEN: componentes + hooks de datos.
- TRIANGULATE: estados de carga/error, respuesta con `market_value=None` (mostrar "no disponible", no 0), múltiples monedas.
- REFACTOR: extraer hooks de fetching.

**Criterios de aceptación.**

- `frontend` tests verdes para compra/venta/borrado y errores.
- Valuación muestra monedas separadas.
- Escenario de spec `Portfolio workspace → Record an operation` cubierto.

**Dependencias.** 5.1.

**Riesgos.** Redondear strings monetarios a float en UI; confundir monedas; condiciones de carrera de refresco.

---

### Tarea 5.3 — Gráficos, oportunidades y alertas

**Objetivo.** Implementar visualización de históricos con overlays (líneas de objetivo, marcadores de transacción), selector de ticker/periodo, oportunidades y configuración visualización de alertas por intent.

**Archivos.**

- Crear: `frontend/src/features/market/*` (charts, selector), `frontend/src/features/alerts/*` (intent selector, estado de alerta), tests `*.test.tsx`.
- Modificar: `frontend/src/App.tsx`.

**Contratos/Interfaces.**

- Usa `/api/v1/analysis/{ticker}`, `/api/v1/portfolio/{ticker}/alert` (PUT/POST check), `/api/v1/wishlist/{ticker}/alert`.
- Selector de intent: `NEUTRAL`/`STOP_LOSS`/`BUY`/`SELL`; muestra mensaje específico del evento.
- Datos de mercado no disponibles se muestran "no disponible", no 0.

**Decisiones.** Intents y mensajes (design.md + `domain/alerts.py`). Gráficos con librería liviana (p. ej. `lightweight-charts`/`recharts`) — decidir en implementación y registrar.

**Plan TDD.**

- RED: overlay de objetivo y marcadores de transacción renderizados; intent guardado; crossing muestra mensaje.
- GREEN: componentes de chart/alertas.
- TRIANGULATE: precio faltante → estado "no disponible"; periodo inválido; cruce repetido no re-emite; monedas distintas no combinadas.
- REFACTOR: aislar formateo de series.

**Criterios de aceptación.**

- Tests verdes para chart, overlays y alertas por intent.
- Escenarios `Market visualization and alerts` cubiertos.

**Dependencias.** 5.1, 5.2.

**Riesgos.** Llamadas a proveedor de mercado en tests (prohibido: mockear); romper contrato de intent; render incorrecto de `None`.

---

### Tarea 5.4 — Wishlist, bibliografía y calculadora de split

**Objetivo.** Implementar CRUD de wishlist y bibliografía y la calculadora de split con resultados de ratios, integradas al backend.

**Archivos.**

- Crear: `frontend/src/features/wishlist/*`, `frontend/src/features/bibliography/*`, `frontend/src/features/tools/split/*`, tests `*.test.tsx`.
- Modificar: `frontend/src/App.tsx`.

**Contratos/Interfaces.**

- Usa `/api/v1/wishlist` (GET/POST/PUT/DELETE), `/api/v1/bibliography` (GET/POST/DELETE), `/api/v1/splits`.
- Split forward/reverse devuelve `quantity`, `average_price`, `ratio` como strings canónicos.

**Decisiones.** Proyección de split ya definida en `domain/calculations.py`.

**Plan TDD.**

- RED: CRUD persiste y refleja cambios; split forward y reverse con valores esperados.
- GREEN: features + hooks.
- TRIANGULATE: duplicado de wishlist (409), ratio inválido (422), edición/borrado inexistente (404).
- REFACTOR: componentes de formulario reutilizables.

**Criterios de aceptación.**

- Tests verdes de CRUD y split.
- Escenarios `Supporting resources` cubiertos extremo a extremo vía UI.

**Dependencias.** 5.1.

**Riesgos.** Duplicar lógica de split en el frontend (debe delegar al backend); manejo inconsistente de errores 404/409.

---

### Tarea 6.1 — Integrar Strands read-only en `backend/app/agents/`

**Objetivo.** Integrar AWS Strands con un allowlist de herramientas read-only que consulte casos de uso existentes, rechace solicitudes de mutación y reporte incertidumbre ante fallo del proveedor.

**Archivos.**

- Crear: `backend/app/agents/__init__.py`, `backend/app/agents/tools.py` (`FinancialReadTools`), `backend/app/agents/config.py` (modelo/región por entorno), `backend/app/agents/service.py`, `backend/tests/test_agent_tools.py`, `backend/tests/test_agent_boundaries.py`.
- Modificar: `backend/app/api/routes.py` (endpoint de análisis del agente si corresponde según `design.md`: `/api/v1/.../analysis`), `backend/pyproject.toml` (dependencia Strands + paquete `backend.app.agents` + manifiesto), `.env.example`.

**Contratos/Interfaces.**

- `FinancialReadTools`: allowlist explícita (leer cartera, valuación, análisis, historial); sin SQL arbitrario ni operaciones de escritura.
- Solicitud de comprar/vender/borrar/alterar → rechazo o ruteo a confirmación explícita; ninguna mutación.
- Config por entorno: modelo y región AWS; yfinance como proveedor inicial; fallo de proveedor → respuesta de incertidumbre sin inventar precios.
- Credenciales no expuestas en la respuesta.

**Decisiones.** Strands read-only detrás de casos de uso y permisos (design.md). Límites de caché/modelo/región se configuran por entorno antes de producción.

**Plan TDD.**

- RED: tool read-only devuelve análisis; tool no permitida no es invocable; pedido de mutación no cambia datos.
- GREEN: implementar tools + servicio con proveedor mockeado.
- TRIANGULATE: fallo de proveedor → incertidumbre; credenciales ausentes; región/modelo inválidos.
- REFACTOR: separar definición de tools de la orquestación del agente.

**Criterios de aceptación.**

- Tests verdes de allowlist, rechazo de mutación y fallo de proveedor (sin red real).
- Ninguna ruta del agente puede escribir en la DB.
- Escenarios `Read-only analysis` y `Tool and credential boundaries` cubiertos.

**Dependencias.** 3.4. Comparte stack con 6.2.

**Riesgos.** Dependencia pesada de Strands (aislar import lazy); fuga de credenciales; que el agente acceda a SQL directo (prohibido).

---

### Tarea 6.2 — Dockerfiles, `compose.yaml`, `compose.dev.yaml`, `.env.example`

**Objetivo.** Definir el despliegue base y el override de desarrollo con frontend, backend y PostgreSQL; hot reload en dev, healthchecks, volumen persistente y DB no expuesta.

**Archivos.**

- Crear: `Dockerfile.frontend`, `frontend/nginx.conf` (o equivalente), `compose.dev.yaml`, `backend/tests/test_deployment_config.py`.
- Modificar: `compose.yaml` (servicio frontend, secretos por entorno), `.env.example`, `.gitignore`, `README.md`.

**Contratos/Interfaces.**

- `compose.yaml`: PostgreSQL con `expose` (no `ports`), volumen `postgres_data`, healthcheck; backend depende del healthcheck y aplica Alembic antes de Uvicorn; frontend sirve la SPA y proxya `/api`.
- `compose.dev.yaml`: override con hot reload (backend/uvicorn reload, Vite dev server) y datos de prueba aislados.
- Secretos sólo por variables de entorno (`POSTGRES_*`, `VITE_API_BASE_URL`); nunca en la imagen.
- Fallo de PostgreSQL → `/ready` 503 y el frontend muestra estado de error usable.

**Decisiones.** Compose base + override dev para Coolify (design.md). `compose.yaml` actual ya cumple DB privada y healthcheck del backend.

**Plan TDD.**

- RED: tests estáticos que validan que PostgreSQL no publica `ports`, que el backend depende del healthcheck, que existe el override dev y que `.env.example` declara las variables.
- GREEN: escribir Dockerfiles/compose/override.
- TRIANGULATE: `docker compose config` con y sin variables; arranque con DB caída → readiness falla.
- REFACTOR: extraer variables comunes.

**Criterios de aceptación.**

- `docker compose config` válido; `docker compose up` → servicios healthy y `/ready` 200.
- `compose.dev.yaml` levanta frontend/backend/PostgreSQL con reload.
- Escenarios `Development environment` cubiertos.

**Dependencias.** 3.4, 5.1. Habilita 6.3.

**Riesgos.** Exponer PostgreSQL por accidente; secretos en la imagen; healthcheck demasiado agresivo; duplicación entre compose base y dev.

---

### Tarea 6.3 — Validación de despliegue Coolify y flujos E2E con Playwright

**Objetivo.** Validar el despliegue tipo Coolify (variables externas, health, DB privada, volumen persistente, reinicio) y cubrir el recorrido principal con Playwright contra Compose.

**Archivos.**

- Crear: `e2e/playwright.config.ts`, `e2e/tests/*.spec.ts`, `e2e/package.json` (o dentro de `frontend/`), `docs/deployment/coolify.md` (o sección en `README.md`), `verify/verify_deployment.py` (smoke de health/readiness).
- Modificar: `README.md`.

**Contratos/Interfaces.**

- Recorrido E2E: abrir la app, registrar compra, ver posición/valuación, ver chart con overlay, configurar alerta.
- Escenarios de reinicio: servicios vuelven a ready; datos persisten en el volumen; secretos no están en la imagen.
- Coolify: configuración documentada con variables externas, health checks y PostgreSQL no público.

**Decisiones.** Coolify single-user (design.md); control de acceso single-user sigue como open question de `design.md` (documentar y mantener en backlog si no se resuelve aquí).

**Plan TDD.**

- RED: specs Playwright que fallan sin frontend/deploy.
- GREEN: levantar Compose y hacer pasar el recorrido.
- TRIANGULATE: reinicio de contenedores; DB caída → error visible; persistencia tras reinicio.
- REFACTOR: helpers de navegación.

**Criterios de aceptación.**

- Suite Playwright verde contra Compose.
- `verify/verify_deployment.py` confirma `/health` y `/ready`.
- Escenarios `Coolify deployment` cubiertos (documental + smoke).

**Dependencias.** 6.2 (y Fase 5). Es el gate E2E del change.

**Riesgos.** Playwright requiere red/navegador en CI; Coolify real no disponible (documentar como validación documental + smoke local); flakiness de arranque.

---

### Tarea 7.1 — README + manifiestos de dependencias

**Objetivo.** Documentar el nuevo stack: setup, variables, migración, rollback y operación; y ordenar los manifiestos de dependencias.

**Archivos.**

- Modificar: `README.md`, `CHANGELOG.md`, `CHANGELOG_es.md`, `backend/pyproject.toml`, `frontend/package.json` (+ lockfile), `requirements.txt` (marcar legacy o eliminarlo sólo en 7.3).
- Crear (si hace falta): `docs/operations/*.md`.

**Contratos/Interfaces.**

- README: requisitos, `docker compose up`, desarrollo (`compose.dev.yaml`), variables de entorno, migración SQLite→PostgreSQL (dry-run + import + reconcile), rollback/restauración, operación (health/readiness), frontend.
- CHANGELOG: features y bugfixes del change al hacer merge `dev`→`main` (regla del repo).

**Decisiones.** Reglas del repo AGENTS.md (docstrings en inglés; `README.md` siempre actualizado; CHANGELOG al merge).

**Plan TDD.** Cambio de documentación: sin RED/GREEN significativo; verificación proporcional = revisar que todos los comandos documentados existen y corren (smoke).

**Criterios de aceptación.**

- Un nuevo operador puede levantar el stack sólo con el README.
- Todos los comandos documentados son ejecutables.
- CHANGELOG actualizado antes del merge a `main`.

**Dependencias.** 4.3, 5.4, 6.3.

**Riesgos.** Documentar comandos que requieren secretos reales; README desactualizado respecto de `compose.dev.yaml`.

---

### Tarea 7.2 — Gate de paridad, backup, freeze, reconciliación y restauración

**Objetivo.** Ejecutar y registrar el gate de corte: paridad funcional, backup, congelamiento de escrituras legacy, reconciliación y restauración probada, con aceptación y rollback documentados.

**Archivos.**

- Crear: `verify/verify_parity_gate.py`, `verify/verify_restore.py`, `docs/operations/cutover.md` (o sección en `README.md`).
- Modificar: `apply-progress.md` y `verify-report.md` (evidencia).

**Contratos/Interfaces.**

- Paridad: checklist de capacidades (cartera, operaciones, historial, valuación/P&L, mercado/señales, alertas, wishlist, bibliografía, split) contra la app Streamlit.
- Backup: snapshot de PostgreSQL y copia de `finance.db` antes del corte.
- Freeze: detener escrituras legacy; una única fuente de verdad.
- Restauración: procedimiento probado que devuelve el destino al último backup válido.

**Decisiones.** Fuente de verdad por fase (design.md). El corte no se ejecuta hasta que 4.3 y la paridad pasen.

**Plan TDD.**

- RED: script de gate que falla si falta cualquier capacidad o si un conteo/saldo discrepa.
- GREEN: correr el gate con la evidencia recopilada.
- TRIANGULATE: restauración simulada; discrepancia forzada → aborta el corte.
- REFACTOR: parametrizar rutas de backup.

**Criterios de aceptación.**

- Gate de paridad registrado y aprobado.
- Backup y restauración ejecutados y documentados.
- Aceptación y rollback registrados en `apply-progress.md`.

**Dependencias.** 4.3, 5.4, 6.3. Precede a 7.3.

**Riesgos.** Ejecutar el corte sin restauración probada; pérdida de datos; escribir en ambos sistemas tras el freeze.

---

### Tarea 7.3 — Retiro del runtime legacy

**Objetivo.** Retirar `main.py`, `src/ui/`, Peewee, SQLite en runtime y scripts/dependencias obsoletos, sólo después de aprobar el gate de 7.2, conservando la copia de datos según decisión del usuario.

**Archivos.**

- Eliminar (sólo tras gate aprobado): `main.py`, `src/ui/`, `src/services/` legacy no reutilizado, `src/models/database.py`, `src/scripts/` obsoletos, `debug_wishlist.py`, scripts `verify_*` obsoletos.
- Modificar: `requirements.txt` (quitar `streamlit`, `peewee`, `plotly`, `pandas`, etc. si ya no se usan), `README.md`, `.gitignore`.
- Conservar: copia de `finance.db` según decisión del usuario (no borrar datos financieros por defecto).

**Contratos/Interfaces.**

- Ninguna ruta de runtime importa `streamlit`, `peewee` ni abre SQLite.
- El manifest final no incluye dependencias legacy.

**Decisiones.** Retiro solo tras gate aprobado (design.md “Safe staged retirement”). No borrar `finance.db` sin confirmación explícita.

**Plan TDD.**

- RED: test que detecta imports legacy (`streamlit`, `peewee`) en el runtime de producción.
- GREEN: remover archivos y dependencias.
- TRIANGULATE: build de imágenes finales sin legacy; arranque sin Streamlit/SQLite.
- REFACTOR: limpiar imports/utilidades muertas.

**Criterios de aceptación.**

- Imágenes de producción arrancan sin Streamlit/SQLite/Peewee.
- Escenario `Legacy runtime removal → Run without legacy dependencies` cubierto.
- Copia de datos preservada/documentada.

**Dependencias.** 7.2 (gate aprobado).

**Riesgos.** Borrar datos financieros por error; romper tests legacy de `tests/` que dependen de Peewee (retirarlos con cobertura equivalente ya validada); referencias residuales en docs.

---

## 5. Fuera de alcance

Según `proposal.md`, quedan explícitamente fuera del change:

- **Microservicios.** Se implementa un monolito modular, no servicios distribuidos.
- **Trading automático, ejecución de órdenes o recomendaciones sin confirmación humana.** El agente es read-only y toda mutación futura exige confirmación explícita.
- **Sincronización cloud.** No se sincronizan datos entre entornos ni nubes.

Tampoco entra en alcance: FX implícito o conversión de monedas (v1 agrupa por moneda), y cambio de reglas financieras ya caracterizadas.

---

## 6. Estrategia de entrega

El change supera ampliamente las ~400 líneas autoradas. La heurística de ~400 líneas es sólo de planificación; **nunca** se omiten tests ni se parte artificialmente para encajar.

**Estrategia recomendada: Stacked PRs a `main`.** Cada corte puede integrarse de forma independiente con sus tests, y el frontend/deploy dependen del API ya verde. El retiro legacy (7.3) es obligatoriamente el último.

**Orden de ejecución y dependencias.**

```
3.4 (API + gates) ──┬─> 5.1 ─> 5.2 ─> 5.3 ─> 5.4 ──┐
                    │                                 ├─> 6.3 ─> 7.1 ─> 7.2 ─> 7.3
4.1 ─> 4.2 ─> 4.3 ──┴─> 6.1 ───────────────> 6.2 ────┘
```

**Cortes de work-unit (candidatos a PR).**

| PR | Contenido | Depende de | Líneas aprox. | Nota |
|----|-----------|-----------|---------------|------|
| P1 | 3.4 contrato API + serialización Decimal + mypy + paquetes (tests incluidos) | — | ~250–350 | Desbloquea todo; gate base |
| P2 | Fase 4 migrador completo (4.1–4.3 + migración `a0003`) | P1 | >400 | Independiente del frontend |
| P3 | Fase 5 frontend (5.1–5.4) | P1 | >400, probable subdivisión por feature | Subdividir en 5.1 scaffold, 5.2 cartera, 5.3 mercado/alertas, 5.4 recursos |
| P4 | Fase 6 agente Strands (6.1) | P1 | ~300–400 | Aislado |
| P5 | Fase 6 despliegue (6.2–6.3) | P3, P4 | >400 | Incluye E2E |
| P6 | Corte y limpieza (7.1–7.3) | todas | variable | 7.3 sólo tras gate |

**Reglas de slicing.**

- Cada PR lleva sus tests y docs con el comportamiento que verifican.
- Si un PR supera 400 líneas sin corte cohesivo posible, reportar el exceso y recomendar `size:exception` (no comprimir código).
- Cada PR hijo incluye diagrama de dependencia marcando el actual con 📍 y declara inicio, fin, dependencia previa, seguimiento y fuera de alcance.
- El frontend (P3/P5) probablemente requiere otra ronda de subdivisión.

---

## 7. Checklist de verificación final

Gates exactos a ejecutar antes de aceptar el change. Los comandos legacy de `mypy`/`ruff` sobre todo el repo pueden conservar errores preexistentes; el gate exigible es el backend y el frontend del change.

- [ ] `python -m pytest -q` → todos verdes (0 fallos); los 3 tests de `test_api.py` pasan sin modificar asserts.
- [ ] `python -m pytest backend/tests -q` → verde (incluye migración, agentes, deploy config).
- [ ] `PYENV_VERSION=3.12.10 python -m mypy backend` → sin errores nuevos; `main.py` limpio; documentar deuda legacy si quedara en `src/`.
- [ ] `python -m ruff check backend --no-cache` → 0 errores (incluye F401 de `test_api.py`).
- [ ] `frontend/`: `npm ci`, `npm run build`, `npm test` → verdes.
- [ ] `docker compose config` → válido; PostgreSQL sin `ports` públicos.
- [ ] `docker compose up` → PostgreSQL/backend/frontend healthy; `/health` 200 y `/ready` 200.
- [ ] `docker compose -f compose.yaml -f compose.dev.yaml config` → override dev válido con hot reload.
- [ ] `alembic upgrade head` sobre DB limpia → `a0003` head (o superior) sin error.
- [ ] `verify/verify_migration_rehearsal.py` → reconciliación con conteos coincidentes y hash de `finance.db` intacto.
- [ ] Suite Playwright E2E contra Compose → recorrido principal verde.
- [ ] `verify/verify_parity_gate.py` → gate de paridad aprobado y registrado.
- [ ] `verify/verify_restore.py` → restauración probada.
- [ ] Tras aprobar el gate: arranque de imágenes finales sin `streamlit`/`peewee`/SQLite.
- [ ] `README.md` actualizado; `CHANGELOG.md`/`CHANGELOG_es.md` registrados antes del merge `dev`→`main`.

**Nota de contrato:** mientras los gates de `pytest`, `mypy backend` y `ruff backend` no estén verdes, el change permanece en `FAIL` según `verify-report.md`, y el native review no puede recibir `completed`.
