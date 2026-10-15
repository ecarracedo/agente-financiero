# Proposal: Endurecer el despliegue y ejecutar el corte del legado

## Intent
Cerrar el alcance que quedó pendiente al archivar `financial-agent-modernization`: validar y endurecer el stack ya desplegado, documentar su operación, y ejecutar el corte del legado únicamente después de que un gate de paridad lo apruebe. No se toca el dominio financiero ni los contratos `/api/v1` ya publicados.

## Scope

### In Scope
- Validar el recorrido principal end-to-end con Playwright contra Compose, incluyendo reinicio de servicios y fallo de dependencia.
- Cerrar el control de acceso de la API publicada en `compose.yaml` y la decisión abierta de acceso single-user.
- Endurecer el proxy de `frontend/nginx.conf` y su test de despliegue.
- Cumplir la ejecución acotada del agente (timeout, reintentos y latencia observada).
- Alinear los gates de calidad con el intérprete que el repositorio declara.
- Documentar setup, variables, migración, rollback y operación; actualizar los manifiestos de dependencias.
- Ejecutar el gate de paridad —backup, freeze de escrituras, reconciliación y restauración— registrando aceptación y rollback.
- Retirar `main.py`, `src/ui/`, Peewee y el runtime SQLite una vez aprobado el gate.

### Out of Scope
- Cambios al dominio financiero o a los contratos `/api/v1` ya publicados.
- Microservicios, trading automático y sincronización cloud.
- El rediseño visual del frontend, que vive en el change `frontend-tremor-redesign`.

## Capabilities

### New Capabilities
- `legacy-cutover`: procedimiento de corte con gate de paridad, backup, freeze de escrituras, reconciliación, restauración y aceptación, más la retirada del runtime legado y la documentación de operación.

### Modified Capabilities
- `containerized-deployment`: control de acceso de la API publicada, validación del despliegue, endurecimiento del proxy y gates de calidad en el intérprete del proyecto.
- `postgres-data-migration`: paridad y reversibilidad exigidas antes del corte.
- `read-only-financial-agent`: ejecución acotada del runtime del agente.

## Approach
Dos mitades ordenadas. Primero se cierra y endurece lo que ya está desplegado —acceso, proxy, gates y validación end-to-end— porque nada de eso puede quedar abierto cuando el legado desaparezca. Recién entonces se documenta y se ensaya el corte, y el gate de paridad queda como la única puerta que habilita la retirada. La retirada del legado va última y depende de una aprobación registrada, porque es la única parte destructiva del change.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `compose.yaml` | Modified | Control de acceso de la API publicada. |
| `frontend/nginx.conf` | Modified | Endurecimiento del proxy. |
| `backend/tests/test_deployment_config.py` | Modified | Cubre el endurecimiento y el acceso. |
| `backend/app/agents/` | Modified | Ejecución acotada del runtime. |
| `backend/pyproject.toml`, `openspec/config.yaml` | Modified | Gates e intérprete. |
| `README.md`, manifiestos de dependencias | Modified | Operación del stack. |
| `tests/`, `verify/` | Modified | Suite E2E y ensayos del corte. |
| `main.py`, `src/ui/`, `requirements.txt` | Removed | Retirada del legado tras aprobar el gate. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Pérdida de datos en el corte | High | Backup, freeze de escrituras, reconciliación y restauración ensayados antes. |
| Retirar el legado con paridad incompleta | Medium | Gate de paridad aprobado y registrado como única puerta. |
| API publicada sin control de acceso | High | Se cierra en la Fase 1, antes de cualquier corte. |
| Endurecer el proxy rompe el enrutado | Medium | Test de despliegue dedicado más sonda contra el stack vivo. |

## Rollback Plan
Mientras el gate de paridad no esté aprobado, el legado y `finance.db` quedan intactos y cualquier corte se deshace volviendo a la aplicación anterior. Después de la retirada, el rollback consiste en restaurar el backup de PostgreSQL registrado en el gate y volver al commit anterior, que todavía contiene el código legado.

## Dependencies
- Acceso a Coolify y a un dominio para validar el despliegue.
- Playwright incorporado al frontend para los flujos end-to-end.
- Decisión del usuario sobre el acceso single-user.

## Success Criteria
- [ ] El recorrido principal end-to-end pasa contra Compose, y reinicio y fallo de dependencia tienen comportamiento verificado.
- [ ] La API publicada tiene control de acceso y el proxy está endurecido, ambos cubiertos por tests.
- [ ] El runtime del agente tiene timeout, reintentos y latencia observada.
- [ ] `README.md` y los manifiestos describen setup, variables, migración, rollback y operación.
- [ ] El gate de paridad, backup, freeze, reconciliación y restauración quedó ejecutado y registrado con su rollback.
- [ ] `main.py`, `src/ui/`, Peewee y el runtime SQLite ya no son necesarios en producción.
