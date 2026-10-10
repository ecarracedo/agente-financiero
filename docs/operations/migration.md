# Migración de datos: SQLite (`finance.db`) → destino relacional

Este documento describe el procedimiento para migrar los datos legados de
`finance.db` hacia la base de datos destino (SQLite temporal en el ensayo;
PostgreSQL en el corte real). La fuente **nunca se modifica**: todo el flujo se
ejecuta sobre una copia de trabajo.

## 1. Requisito de mapeo de moneda (explícito, nunca inferido)

El esquema legado de SQLite **no almacena la moneda**. La migración exige un
mapeo explícito `ticker → moneda`; si un registro monetario no tiene mapeo, la
validación lo reporta como no resuelto y el destino **no** queda listo. La
moneda no se infiere en tiempo de ejecución bajo ninguna circunstancia.

Para los ocho tickers legados el mapeo es `ARS`. Cree un archivo JSON con:

```json
{
  "ALUA.BA": "ARS",
  "BYMA.BA": "ARS",
  "CEPU.BA": "ARS",
  "COME.BA": "ARS",
  "ECOG.BA": "ARS",
  "EDN.BA": "ARS",
  "MORI.BA": "ARS",
  "PAMP.BA": "ARS"
}
```

Guarde ese contenido en una ruta temporal, por ejemplo `/tmp/ars.json`, y
pásela con `--currency-map`.

## 2. Preparar el destino

El importador/CLI **no crea** las tablas: se asume que el esquema destino ya
existe y está gestionado por Alembic. Aplique la cadena completa antes de
importar:

```bash
DATABASE_URL="$DATABASE_URL" python -m alembic -c backend/alembic.ini upgrade head
```

En el ensayo, el destino es un archivo SQLite temporal. En el corte real,
`DATABASE_URL` apunta a PostgreSQL.

## 3. Preservar la fuente

Copie `finance.db` a una ruta de trabajo y ejecute todo contra la copia. La
fuente permanece intacta:

```bash
cp finance.db /tmp/legacy-copy.db
sha256sum finance.db    # anote el hash antes
```

## 4. Flujo completo: dry-run → import → reconcile

### 4.1 Dry-run (solo lectura, no escribe nada)

```bash
python -m backend.app.adapters.migration dry-run \
  --source /tmp/legacy-copy.db \
  --currency-map /tmp/ars.json
```

Salida esperada: `{"ready": true, "counts": {...}}`. Si `ready` es `false`,
revise las filas `REJECTED`/`UNRESOLVED` antes de continuar. Con el mapeo `ARS`
completo y la copia actual, la validación queda `ready: true`.

### 4.2 Import (transaccional e idempotente)

```bash
python -m backend.app.adapters.migration import \
  --source /tmp/legacy-copy.db \
  --currency-map /tmp/ars.json \
  --database-url "$DATABASE_URL"
```

Salida esperada: `{"committed": true, "inserted": 17, "updated": 0, "skipped": 0}`.
El import corre en **una sola transacción** del destino y solo confirma si la
validación está lista; ante cualquier error revierte todo.

### 4.3 Reconcile (comparación origen vs destino)

```bash
python -m backend.app.adapters.migration reconcile \
  --source /tmp/legacy-copy.db \
  --database-url "$DATABASE_URL"
```

Salida esperada: `reconciliation matched: True`.

### 4.4 Reejecución idempotente

Volver a ejecutar el `import` sobre el mismo origen **no** duplica registros:
la segunda corrida reporta `inserted: 0`, `updated: 0`, `skipped: 17` y la
reconciliación sigue en `matched: True`.

## 5. Expectativa de reconciliación (copia actual)

Sobre la copia actual de `finance.db`:

| Entidad            | Conteo origen | Conteo destino |
|--------------------|---------------|----------------|
| portfolio_items    | 8             | 8              |
| transactions       | 9             | 9              |
| wishlist_items     | 0             | 0              |
| bibliography_items | 0             | 0              |

Además deben coincidir los saldos: suma de `quantity` (953) y de
`average_price` (12113) en portafolio; suma de `quantity` (953) y `unit_price`
(14369) en transacciones. El reporte global debe indicar `matched: True`.

## 6. Ensayo completo reproducible

`verify/verify_migration_rehearsal.py` ejecuta todo el flujo (dry-run → import →
reconcile → reimport idempotente → restauración) sobre una **copia** de
`finance.db` con un destino SQLite temporal, sin tocar la fuente:

```bash
python verify/verify_migration_rehearsal.py \
  --source finance.db \
  --currency-map /tmp/ars.json
```

Bandera de éxito: `rehearsal OK` y `exit 0`. El script verifica el `sha256` de
la fuente antes y después, y que la copia de trabajo no cambia. El destino es
temporal por defecto (`--workdir`/`--database-url` lo parametrizan); el corte
real puede apuntar a PostgreSQL sin cambiar el guion de importación.

## 7. Procedimiento de restauración

Si la reconciliación detecta una discrepancia, el destino se restaura a su
último respaldo válido y se vuelve a verificar. La fuente nunca se toca.

### 7.1 Respaldo del destino (antes de migrar)

- PostgreSQL:
  ```bash
  pg_dump --format=custom --file=/tmp/destination-backup.dump "$DATABASE_URL"
  ```
- SQLite (ensayo): copie el archivo de la base destino.

### 7.2 Restauración (si algo falla)

- PostgreSQL:
  ```bash
  pg_restore --clean --if-exists --dbname="$DATABASE_URL" /tmp/destination-backup.dump
  ```
- SQLite (ensayo): copie el respaldo sobre el archivo destino.

### 7.3 Re-verificar tras restaurar

```bash
python -m backend.app.adapters.migration reconcile \
  --source /tmp/legacy-copy.db \
  --database-url "$DATABASE_URL"
```

Debe volver a `reconciliation matched: True`. El ensayo ejecuta exactamente
esta restauración: perturba el destino (borra filas), confirma que la
reconciliación deja de coincidir, restaura desde el respaldo y comprueba que la
reconciliación vuelve a `matched: True`.

## 8. Riesgos conocidos

- **Fechas naive / zona horaria (PostgreSQL):** el origen legado guarda fechas
  sin zona. En SQLite se almacenan tal cual; en PostgreSQL la columna
  `occurred_at` es `DateTime(timezone=True)`, por lo que el corte real debe
  fijar explícitamente la zona (UTC o `America/Argentina/Buenos_Aires`) para
  evitar corrimientos. Verifíquelo durante el corte real.
- **Precisión float → Decimal:** los montos legados son `float` y se cuantizan
  a `Numeric(30, 10)`; la reconciliación compara con la misma conversión.
- **Esquema destino ausente:** el importador no crea tablas; aplique Alembic
  antes de importar o el `import` fallará.
