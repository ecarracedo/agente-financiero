# Design: Estabilizar pruebas de cartera

## Technical Approach
Agregar fixtures compartidos de pytest para enlazar temporalmente los modelos Peewee a una base SQLite temporal. Las pruebas usarán la API existente de `Portfolio` y los modelos ya definidos, corregirán rutas de patch según los imports reales y conservarán el contrato de promedio vigente. No se cambia el esquema ni la lógica de producción.

## Architecture Decisions

### Decision: Aislar con SQLite temporal por test

**Choice**: Usar una instancia SQLite temporal por test o fixture function, crear las cuatro tablas y enlazar los modelos durante el contexto.
**Alternatives considered**: Usar `finance.db` con limpieza manual; usar una base SQLite global en memoria.
**Rationale**: Evita pérdida de datos y contaminación entre pruebas. Una instancia por test hace visible cualquier dependencia accidental del estado previo.

### Decision: Reutilizar la API pública existente

**Choice**: Verificar posiciones mediante `Portfolio.get_transactions`, `get_holdings_with_valuations` y consultas de modelos donde no exista un accessor público.
**Alternatives considered**: Agregar `get_portfolio_item` solo para satisfacer las pruebas; monkey-patchear ese método en cada archivo.
**Rationale**: No agrega API productiva sin necesidad y elimina helpers dinámicos que ocultaron el fallo real.

### Decision: Parchar el proveedor en su ruta de uso

**Choice**: Parchar `src.external.market_data.get_current_price`, que es el módulo importado por `Portfolio.get_holdings_with_valuations`.
**Alternatives considered**: Parchar `src.market_data.get_current_price`, ruta inexistente; interceptar yfinance.
**Rationale**: El patch debe sustituir el contrato que usa el servicio y evitar llamadas de red en pruebas.

### Decision: Mantener el promedio al vender

**Choice**: Esperar que una venta reduzca cantidad y conserve `avg_price`.
**Alternatives considered**: Recalcular costo neto como esperaba una prueba antigua.
**Rationale**: README, changelog y código vigente documentan explícitamente este comportamiento.

## Data Flow

    pytest fixture
        |
        v
    Temporary SQLite DB -> Peewee model binding -> Portfolio service -> test assertions
                                                        |
                                                        v
                                      mocked market_data provider (no network)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `tests/conftest.py` | Create | Fixture de DB temporal, tablas y aislamiento. |
| `tests/test_avg_fix.py` | Modify | Usar fixture y API válida. |
| `tests/test_avg_price.py` | Modify | Usar fixture y expectativa vigente. |
| `tests/test_qty_fix.py` | Modify | Usar fixture y API válida. |
| `tests/test_valuation.py` | Modify | Usar fixture y patch correcto. |
| `src/models/database.py` | No change expected | Solo tocar si el binding temporal no puede hacerse desde tests. |
| `src/services/portfolio.py` | No change expected | El objetivo es validar el comportamiento actual. |

## Interfaces / Contracts

Fixture conceptual:

```python
@pytest.fixture
def database():
    test_db = SqliteDatabase(":memory:")
    with test_db.bind_ctx(MODELS):
        test_db.create_tables(MODELS)
        yield test_db
        test_db.drop_tables(MODELS)
```

El fixture debe garantizar que el binding cubra `PortfolioItem`, `Transaction`, `WishlistItem` y `BibliographyItem`, y que la conexión esté abierta durante las aserciones.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Compras, ventas, promedio y cantidad | Pruebas existentes corregidas sobre DB temporal. |
| Unit | Valuación y P&L | Mock del proveedor real y valores deterministas. |
| Integration | Aislamiento entre tests | Ejecutar suite completa dos veces y verificar que no toca `finance.db`. |
| E2E | No aplicable | Este cambio no modifica UI. |

## Migration / Rollout

No migration required. Ejecutar primero la suite corregida en aislamiento; después ejecutar `pytest` desde el repo y comprobar que `finance.db` no cambia. La configuración queda lista para que futuras fases migren la lógica fuera de Streamlit.

## Open Questions

- [ ] Confirmar si el proyecto prefiere `:memory:` o archivo temporal para facilitar inspección de fallos; el diseño prioriza `:memory:`.
