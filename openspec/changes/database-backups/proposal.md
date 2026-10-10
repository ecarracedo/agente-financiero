# Proposal: Copias de seguridad de SQLite

## Intent
`finance.db` conserva el historial financiero local y el proyecto no documenta un mecanismo de backup. Una pérdida o corrupción del archivo puede borrar datos que no se reconstruyen fácilmente. Este cambio formaliza la mejora de backup ya priorizada en `BACKLOG.md`.

## Scope

### In Scope
- Crear snapshots locales consistentes de la base SQLite en puntos automáticos definidos por el flujo de la aplicación y las migraciones.
- Aplicar retención configurable para limitar el uso de disco.
- Probar recuperación en una base temporal y documentar el procedimiento.

### Out of Scope
- Sincronización o almacenamiento en la nube.
- Cambios al esquema financiero o al cálculo de cartera.
- Gestión de backups fuera de la aplicación.

## Capabilities

### New Capabilities
- `database-backups`: Crear, conservar y recuperar copias locales de la base SQLite.

### Modified Capabilities
- None.

## Approach
Centralizar el backup en el módulo de base de datos y usar una operación de SQLite que produzca snapshots consistentes incluso con la base abierta. Definir los disparadores y la política de retención en la fase de especificación; cubrir creación y restauración con pruebas aisladas y actualizar las instrucciones de recuperación.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/models/database.py` | Modified | Centralizar la operación segura de backup. |
| `src/scripts/` | Modified | Integrar la protección con operaciones de mantenimiento que puedan alterar el esquema. |
| `tests/` | Modified | Probar backup, restauración y retención con bases temporales. |
| `README.md` | Modified | Documentar ubicación y recuperación de copias. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Acumulación de archivos grandes | Medium | Retención configurable y limpieza verificable. |
| Exposición de datos financieros locales | Low | Mantener snapshots en el equipo y documentar sus permisos. |

## Rollback Plan
Desactivar los disparadores de backup y retirar la integración sin modificar ni eliminar `finance.db`; conservar las copias existentes hasta confirmar que ya no se necesitan. No se requiere migración de esquema.

## Dependencies
- Ninguna dependencia externa prevista.

## Success Criteria
- [ ] Una copia creada desde una base con datos puede restaurarse y conserva los registros esperados.
- [ ] La política de retención conserva la cantidad configurada y no toca la base activa.
- [ ] La documentación permite localizar y recuperar una copia.
