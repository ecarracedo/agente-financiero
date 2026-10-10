## Exploration: Modernización full-stack del agente financiero

### Current State
La aplicación es un monolito Streamlit. `main.py` (1005 líneas) concentra UI, formularios, validación, alertas, charts y calculadora de split. `Portfolio` consulta Peewee directamente y arma resultados con pandas; `src/models/database.py` guarda cuatro entidades en SQLite (`finance.db`). `src/external/market_data.py` importa Streamlit para flags/caché y `src/ui/auto_refresh.py` guarda estado en `st.session_state`.

No hay API HTTP, frontend React, PostgreSQL, Docker/Compose, CI ni AWS Strands en el código actual. `requirements.txt` es un freeze amplio: incluye LangChain, PyTorch, Transformers y SQLAlchemy sin importación desde `src/`, y no declara FastAPI ni Strands. `test.ipynb` es un experimento desconectado que compara precios con el umbral fijo 20 aunque el nombre sugiera SMA20.

Las capacidades documentadas/implementadas incluyen posiciones por ticker/broker/categoría, compra/venta e historial con recálculo tras borrar operaciones, valuación y P&L, precios objetivo/alertas, datos de mercado e históricos, señales de máximo/mínimo anual y medias 50/200, gráficos de cartera y activos con líneas de promedio/objetivo/transacciones, wishlist, bibliografía y calculadora de split. La importación Excel solo aparece en un script legado, no como flujo activo de UI.

### Affected Areas
- `main.py`, `src/ui/`, `src/services/`, `src/models/` — extraer reglas/casos de uso y luego retirar Streamlit, Peewee y SQLite.
- `src/external/market_data.py` — mantener el proveedor de mercado, aislado de UI y caché.
- `src/scripts/` — reemplazar migraciones ad hoc por Alembic y un importador seguro SQLite→PostgreSQL.
- `tests/` y `verify/` — caracterizar reglas y retirar scripts manuales obsoletos solo con cobertura equivalente.
- `frontend/` — nueva aplicación React+TypeScript.
- `backend/` — nueva API FastAPI, dominio, persistencia PostgreSQL y módulo de agentes.
- `compose.yaml`, `compose.dev.yaml` y configuración de Coolify — desarrollo local y despliegue.
- `requirements.txt` y documentación — reemplazar el freeze por dependencias explícitas y documentar instalación, uso, migración y operación.
- `test.ipynb` — conservar solo como investigación con propósito vigente; no convertir su umbral fijo en lógica contractual.
- `openspec/changes/database-backups/` — la propuesta de backup de SQLite debe supersederse; la nueva plataforma requiere política de backup/restauración para PostgreSQL.

### Approaches
1. **Migración completa por etapas con convivencia temporal** — construir React+TypeScript (Vite), FastAPI, PostgreSQL, SQLAlchemy/Alembic y Strands Agents SDK. Migrar las capacidades existentes por cortes verticales y validar paridad; retirar Streamlit y SQLite solo cuando todas las capacidades y datos estén migrados.
   - Pros: cumple el objetivo de eliminar Streamlit sin exigir una sustitución big-bang; permite comparar resultados y proteger datos durante la transición.
   - Contras: durante la migración hay dos interfaces y se debe controlar cuidadosamente qué sistema escribe los datos.
   - Effort: High.

2. **Reescritura big-bang** — reemplazar interfaz, backend, persistencia y agentes en un único release.
   - Pros: no mantiene dos aplicaciones en paralelo.
   - Contras: alto riesgo de regresiones financieras, migración difícil de validar y demora hasta poder usar la nueva plataforma.
   - Effort: Very High.

### Recommendation
Preservar el comportamiento de negocio, no la estructura tecnológica. Extraer reglas de `src/services/` y de los bloques relevantes de `main.py` a casos de uso/domain sin dependencia de Streamlit ni consultas ORM directas; cubrirlas primero con pruebas deterministas. Mantener adaptadores de persistencia, mercado y agentes. Usar un monolito modular (no microservicios): React+TypeScript/Vite, FastAPI, PostgreSQL, SQLAlchemy 2/Alembic y AWS Strands Agents SDK en backend. Limitar herramientas de agentes a casos de uso explícitos y comenzar en solo lectura.

La migración será completa pero por cortes verticales: Compose + API + PostgreSQL; cartera/transacciones e importación; valuación/historial; mercado/análisis/gráficos/alertas; wishlist/bibliografía/split; agente; Coolify; y retiro final de Streamlit/SQLite. Criterio final: paridad de capacidades, datos reconciliados, restauración probada y ninguna dependencia/ruta runtime de Streamlit o SQLite. Evitar escritura dual y definir una sola fuente de verdad por fase.

La fuente primaria a migrar es `finance.db`, no una reimportación destructiva del Excel. `src/scripts/migrate.py` borra posiciones, importa solo la última fila de algunas hojas y no conserva historial ni precio promedio; `main.py` declara una ruta absoluta de Excel que no usa. El importador nuevo debe ser idempotente, transaccional, respaldado, validado y producir reporte de reconciliación. Mantener el archivo SQLite original hasta aceptar el corte.

Separar Compose de desarrollo (hot reload, API y PostgreSQL de prueba) del Compose de producción consumible por Coolify, con secrets externos a la imagen, healthchecks y volumen persistente. No publicar datos sin autenticación ni exponer PostgreSQL. Definir si será single-user o multi-user antes de diseñar ownership.

### Preservation and Cleanup
- Caracterizar y preservar: promedio ponderado en compras, cantidad/costo al vender, recálculo al borrar transacciones, valuación/P&L, categorías/broker, normalización `.BA`, señales técnicas, alertas, gráficos y split.
- Resolver contradicciones: README/changelog y código dejan promedio sin cambios al vender; `tests/test_avg_price.py` espera `2.925` en el mismo escenario donde el código conserva `2.595`. La suite temporal falla 4/4: dos pruebas llaman un método inexistente, una contradice la regla publicada y el test de valuación parchea `src.market_data`, módulo que no existe.
- No portar sin revisión: `update_position` persiste la transacción antes de validar y oculta excepciones; no valida sobreventas ni usa una transacción atómica. Una condición de alertas es inalcanzable. La suite no cubre alertas, mercado, migraciones, wishlist, bibliografía ni split.
- Retirar después de cobertura equivalente: UI/dependencias Streamlit, scripts de migración Peewee, scripts manuales con imports obsoletos, dependencias no usadas y prototipos sin propósito vigente. El notebook tiene una regla fija `price < 20`, no una SMA20 real.
- No borrar `finance.db`, planillas ni datos financieros por ser tecnología antigua; respaldar, migrar, reconciliar y confirmar antes de eliminar datos locales.

### Risks
- Las pruebas actuales no son un baseline fiable: 4/4 fallan; hay que resolver reglas financieras antes de exigir paridad.
- Cambios accidentales en cantidades, promedios, divisas o transacciones durante extracción y migración; pruebas de caracterización y reconciliación antes del corte.
- Escrituras en ambos sistemas pueden producir divergencia; establecer una única fuente de verdad por hito.
- Un agente podría exponer datos o inducir acciones financieras; aislar credenciales, limitar herramientas y requerir confirmación humana para acciones futuras.
- Desplegar la app financiera en Coolify sin autenticación, backups probados y volúmenes persistentes expone datos y disponibilidad.

### Ready for Proposal
Yes — proponer la modernización completa con capacidades actuales como alcance de paridad, migración segura SQLite→PostgreSQL, Strands en backend, Compose/Coolify y eliminación de Streamlit/SQLite como criterio final. Antes de especificar, decidir single-user/multi-user y acordar las reglas contradictorias de promedio y alertas; el primer agente debe ser de solo lectura.
