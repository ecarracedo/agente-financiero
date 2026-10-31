# Proposal: Estabilizar pruebas de cartera

## Intent
La suite actual bloquea SDD y la migración: las cuatro pruebas fallan por acoplamiento a la base global, métodos inexistentes, un mock obsoleto y una expectativa que contradice el contrato vigente. Este cambio repara la infraestructura de pruebas sin cambiar la lógica financiera.

## Scope

### In Scope
- Aislar las pruebas de `finance.db` con una base SQLite temporal.
- Alinear las pruebas con la regla vigente: vender reduce cantidad, pero no altera el promedio de las posiciones restantes.
- Reemplazar referencias a APIs inexistentes y corregir mocks según los módulos reales.
- Dejar `pytest` verde y documentar el baseline para los siguientes cambios SDD.

### Out of Scope
- Cambiar reglas de negocio o implementar nuevas funcionalidades.
- Migrar SQLite a PostgreSQL, crear API, frontend React o integrar Strands.
- Refactorizar la aplicación completa o eliminar archivos de producción.

## Capabilities

### New Capabilities
- `portfolio-test-infrastructure`: Las pruebas de cartera ejecutan de forma aislada y reproducible.

### Modified Capabilities
- None.

## Approach
Configurar fixtures de pytest que reemplacen temporalmente la conexión de Peewee por una base SQLite temporal, creen las tablas y reviertan el estado al finalizar cada prueba. Actualizar las pruebas para usar la API pública existente. Mantener las expectativas alineadas con README y changelog.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `tests/` | Modified | Fixtures, mocks y expectativas corregidas. |
| `src/models/database.py` | Potentially modified | Solo para habilitar binding limpio; sin cambiar esquema. |
| `src/services/portfolio.py` | No behavior change | Verificar API; no modificar reglas salvo defecto demostrado. |
| `pytest` configuration | New/Modified | Registrar fixtures/configuración compartida si resulta necesario. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| El fixture no cubre todas las consultas | Medium | Ejecutar suite completa y comprobar aislamiento. |
| Se normaliza una expectativa equivocada | Low | Usar README, changelog y comportamiento actual; no modificar producción. |

## Rollback Plan
Revertir cambios en `tests/` y configuración de pytest. `finance.db` no se modifica ni elimina.

## Dependencies
- `pytest` y `peewee`, disponibles en el entorno.

## Success Criteria
- [ ] `pytest` ejecuta todas las pruebas sin tocar la base real.
- [ ] Las pruebas pasan reproduciblemente en ejecuciones consecutivas.
- [ ] La suite verifica compra, venta, promedio, cantidad y valuación.
- [ ] No se modifica el comportamiento financiero de producción.
