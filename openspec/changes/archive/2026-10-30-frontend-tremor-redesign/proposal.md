# Proposal: Rediseño del frontend con Tremor

## Intent

El frontend funciona pero no tiene capa visual ni forma de probarlo sin levantar el backend, y su feedback al usuario es débil. Un inventario de solo lectura (`exploration.md`) confirmó tres carencias concretas: no existe ningún sistema de estilos (ni CSS, ni Tailwind, ni clases), no hay ruta de datos de demo ni fixtures, y los formularios no dan error por campo. El objetivo es que la app se vea y se sienta terminada, que se pueda levantar y probar a mano sin backend, y que sus tests dejen de mockear el mundo entero.

## Scope

### In Scope

- Adoptar **Tailwind CSS 4 + Tremor Raw** (componentes copiados al repo) como capa visual, y rediseñar el shell y los siete workspaces sobre esos componentes.
- Navegación con deep-link y estado preservado entre workspaces; Alerts deja de estar escondido dentro de Market.
- Estados visibles: skeleton de carga, estado vacío propio, error y éxito que se limpia; errores de validación por campo con `aria-invalid` y `aria-describedby`.
- Tablas con caption, orden, alineación numérica y acciones de fila; confirmación en acciones destructivas; señal de signo y color para ganancia/pérdida y estados de alerta.
- **Harness de desarrollo**: modo de datos de demo para correr la UI sin backend, MSW con fixtures compartidas y un helper de render único.
- Mantener los overlays de dominio del gráfico de mercado (línea objetivo y marcadores de transacciones).

### Out of Scope

- Cambiar contratos del backend o agregar endpoints: el inventario mostró que todas las rutas `/api/v1` ya se consumen.
- Reescritura del dominio financiero, autenticación y control de acceso (eso es R1, en 6.3).
- Los tres hallazgos diferidos de la review del follow-up (R4-001, R2-1, R2-2): viven en 6.3.

## Capabilities

### New Capabilities

- `frontend-dev-harness`: modo de datos de demo, fixtures compartidas, MSW y helper de render para poder levantar y testear la UI sin backend.

### Modified Capabilities

- `financial-web-frontend`: se agregan requisitos de sistema visual, navegación con deep-link, estado preservado, feedback por campo, confirmación destructiva, estados de carga/vacío/éxito y accesibilidad; se preservan los requisitos de cartera, mercado, alertas, moneda y independencia de framework hoy vigentes.

## Approach

Tailwind 4 como base y **Tremor Raw copiado al repo** en lugar del paquete `@tremor/react`. Razón: el paquete npm trae su propio Recharts, lo que dejaría dos majors de charts en el bundle, y su documentación asume Tailwind 3. Con Tremor Raw el proyecto conserva **un solo Recharts (3.10)** y reutiliza el `MarketChart` actual, que ya tiene overlays de dominio que los wrappers de Tremor no cubren. Se copian solo los componentes no-chart necesarios (Card, Table, Badge, Button, Tabs, Dialog, Select, Metric, Callout, ProgressBar y similares); los charts se quedan como están. La migración es incremental por workspace, con el harness de test primero para que cada corte tenga red de seguridad.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/package.json`, `vite.config.ts`, `frontend/src/index.css` | Modified/New | Tailwind 4, PostCSS y estilos base |
| `frontend/src/components/tremor/**` | New | Componentes de Tremor Raw copiados al repo |
| `frontend/src/App.tsx`, `frontend/src/main.tsx` | Modified | Shell, navegación con router y estado preservado |
| `frontend/src/components/**` | Modified | DataTable, FormControls, AsyncStates y CurrencyAmount con estilos y accesibilidad |
| `frontend/src/features/**` | Modified | Los siete workspaces sobre los componentes de Tremor |
| `frontend/tests/**`, `frontend/src/**/*.test.tsx` | Modified | MSW, fixtures y helper de render compartido |
| `frontend/src/dev/**` | New | Modo de datos de demo |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tremor Raw declara peer React `^18.3` y el proyecto usa 19.3 | Med | Verificar en el primer corte; los primitivos subyacentes son Radix, que ya soporta React 19 |
| El rediseño rompe los 91 tests existentes | High | Harness (MSW + helper de render) primero; los tests se migran por workspace, no de una |
| Tailwind 4 cambia la configuración respecto de la doc que asume v3 | Med | Fijar Tailwind 4 desde el inicio y no mezclar guías de v3 |
| Sobrecarga por copiar componentes que después hay que mantener | Med | Copiar solo lo usado; nada de imports especulativos |

## Rollback Plan

Cada workspace se migra en su propio commit con su suite verde. Si Tremor Raw resulta incompatible con React 19, se revierte solo el corte visual (`git revert` del commit de Tailwind más los de componentes) y el frontend vuelve al estado sin estilos, que ya funciona. El harness de test y el modo demo son independientes del rediseño y se pueden conservar o revertir por separado.

## Dependencies

- Tailwind CSS 4 (dependencia nueva).
- Tremor Raw como código copiado, no como paquete.
- **Orden de archivo**: la capability `financial-web-frontend` todavía vive como delta dentro del change sin archivar `financial-agent-modernization`. Hay que archivar ese change **antes** que este, o los merges de delta pueden pisarse.

## Success Criteria

- [ ] La UI se ve y se usa de punta a punta con Tailwind y Tremor, sin HTML crudo sin estilos en ningún workspace.
- [ ] `npm run dev` permite recorrer y probar la app sin backend, con datos de demo.
- [ ] Los tests de frontend pasan sin mockear el cliente de API módulo por módulo, con fixtures compartidas.
- [ ] Los formularios muestran error por campo y las acciones destructivas piden confirmación.
- [ ] El gráfico de mercado conserva línea objetivo y marcadores de transacciones.
- [ ] `npm test`, `npm run lint` y `npm run build` pasan en verde.
