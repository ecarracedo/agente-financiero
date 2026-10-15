# Design: Endurecer el despliegue y ejecutar el corte del legado

## Context

`financial-agent-modernization` entregó fases 1 a 6.2 y se archivó el 2026-10-15. Lo que quedaba abierto era operativo, no funcional: el stack está desplegado pero nadie validó el recorrido end-to-end contra Compose, la API publicada no tiene control de acceso, el proxy arrastra advertencias de endurecimiento, el runtime del agente no está acotado, y el legado sigue en pie porque nunca se ejecutó un gate de paridad. Este change cierra eso y recién entonces retira el legado.

## Decisions

### D1 — Control de acceso: no publicar la API en vez de construir autenticación

**Decisión**: la API deja de publicar su puerto al host y queda alcanzable solo a través del proxy del frontend, que ya la enruta.

**Rationale**: el producto es single-user y no tiene sistema de identidad. Construir autenticación sería alcance nuevo y no pedido. La API ya está detrás de nginx (`location ~ ^/(api/|health$|ready$)`, `frontend/nginx.conf:29`), así que dejar de publicar el puerto elimina la exposición sin agregar superficie. Si el despliegue real necesita acceso directo a la API, la alternativa es autenticación, y eso debe decidirse explícitamente antes de reabrir el puerto.

**Nota**: la decisión de acceso single-user en Coolify queda cerrada con esta elección; el escenario de dominio público sigue siendo responsabilidad de la configuración de Coolify.

### D2 — El type checker corre donde corre el código

**Decisión**: `mypy` y `black` pasan a las dependencias de desarrollo de `backend/pyproject.toml`, y se instalan en el intérprete que fija `.python-version` (3.13.3).

**Rationale**: hoy `mypy` existe solo en el intérprete global 3.12.10, que es ajeno al proyecto y arrastra paquetes de otros repositorios. Un type checker que analiza código 3.13 desde un intérprete 3.12 no es una garantía reproducible. Además `build_command: mypy .` barre el árbol scratch `verify/strands_src` y produce ~198 errores irrelevantes, así que el gate se acota a los paquetes del backend.

### D3 — La validación end-to-end corre contra Compose, no contra mocks

**Decisión**: Playwright se incorpora al frontend y conduce el recorrido principal contra el stack Compose real.

**Rationale**: el propósito de esta validación es demostrar que el despliegue funciona, no que el frontend funciona aislado. Un stack mockeado no habría detectado, por ejemplo, el problema de re-resolución del proxy. Los mocks a nivel de red ya existen para los tests de componentes (MSW), y esa capa no se reemplaza.

### D4 — El gate de paridad es un artefacto, no una intención

**Decisión**: el gate de 4.2 debe quedar ejecutado y registrado —backup, freeze de escrituras, reconciliación por entidad, restauración demostrada y camino de rollback— antes de que la tarea 5.1 pueda empezar.

**Rationale**: la retirada es la única parte destructiva del change. Convertir el gate en un artefacto registrado evita que la paridad quede como un supuesto. `openspec/config.yaml` pide advertir antes de cambios destructivos; este design lo hace estructural.

### D5 — Un solo change con dos mitades ordenadas

**Decisión**: validación/endurecimiento y corte conviven en un change, en fases ordenadas.

**Rationale**: decisión confirmada por el usuario. Espeja la estructura de fases del change original y mantiene un solo hilo de dependencias, donde la Fase 5 depende explícitamente de la Fase 4.

## Cutover flow

```text
Fase 1-2  cerrar acceso + endurecer proxy + validar despliegue
              |
              v
Fase 3    acotar runtime del agente
              |
              v
Fase 4    documentar ----> ensayar gate
              |                |
              |                v
              |        +---------------------+
              |        | paridad reconciliada?|
              |        +---------------------+
              |           |            |
              |         no|            |si
              |           v            v
              |    legado queda    registrar aceptacion
              |    en pie          y rollback
              |                        |
              v                        v
Fase 5 ------------------------> retirar Streamlit/SQLite/Peewee
                                           |
                                           v
                                    Fase 6 verificacion
```

## Open questions

- Mecanismo exacto de acceso si el despliegue requiere llamar la API directamente: publicar con autenticación o mantener solo el proxy. Se cierra en la tarea 1.1 y se registra aquí.
