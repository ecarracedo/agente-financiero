# Tasks: Endurecer el despliegue y ejecutar el corte del legado

Origen: hereda las tareas 6.3, 7.1, 7.2 y 7.3 que quedaron pendientes en `financial-agent-modernization`, más los hallazgos diferidos a este alcance (R1, R4-002, R4-001, R2-1, R2-2) y la deuda de gates detectada al archivarlo.

## Phase 1: Acceso y endurecimiento

- [ ] 1.1 Cerrar la decisión de acceso single-user y aplicar control de acceso a la API publicada en `compose.yaml`; cubrir con test antes del cambio. (R1-nginx-api-exposed)
- [ ] 1.2 Endurecer `frontend/nginx.conf` y su test en `backend/tests/test_deployment_config.py`; probar el enrutado y la re-resolución contra el stack vivo. (R4-001, R2-1, R2-2)
- [ ] 1.3 Instalar `mypy` y `black` en el intérprete del proyecto y acotar los gates para que no barran el árbol scratch `verify/`; actualizar `openspec/config.yaml`.

## Phase 2: Validación del despliegue

- [ ] 2.1 Incorporar Playwright al frontend y cubrir el recorrido principal end-to-end contra Compose. (hereda 6.3)
- [ ] 2.2 Validar reinicio de servicios y fallo de dependencia en el despliegue, y registrar el resultado en el change. (hereda 6.3)

## Phase 3: Ejecución acotada del agente

- [ ] 3.1 Acotar el runtime del agente con timeout, reintentos y latencia observada, y cubrirlo con test. (R4-002)

## Phase 4: Documentación y ensayo del corte

- [ ] 4.1 Actualizar `README.md` y los manifiestos de dependencias; documentar setup, variables, migración, rollback y operación. (hereda 7.1)
- [ ] 4.2 Ejecutar y registrar el gate de paridad: backup, freeze de escrituras, reconciliación y restauración, con aceptación y rollback. (hereda 7.2)

## Phase 5: Retirada del legado

- [ ] 5.1 Retirar `main.py`, `src/ui/`, Peewee, el runtime SQLite y los scripts y dependencias obsoletos, solo con el gate de 4.2 aprobado y conservando copia de los datos. (hereda 7.3)

## Phase 6: Verificación

- [ ] 6.1 Correr los gates completos (pytest, frontend, type-check acotado, drift) y registrar el reporte de verificación del change.
