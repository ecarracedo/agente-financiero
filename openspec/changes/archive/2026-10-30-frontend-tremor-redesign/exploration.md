# Exploration: frontend Tremor redesign

## Question

El frontend "le falta y no está muy amigable para probar". ¿Qué falta exactamente, y qué tiene que cambiar para que sea agradable de usar, fácil de levantar a mano y fácil de testear?

## Method

Inventario de solo lectura sobre `frontend/src/**` y `frontend/package.json`, contrastado contra el conjunto de requisitos ya escrito en `openspec/changes/financial-agent-modernization/specs/financial-web-frontend/spec.md` (61 líneas). Durante la exploración no se modificó ningún archivo. La evidencia externa sobre Tremor se contrastó contra la documentación oficial.

## Current stack

React 19.3, react-dom 19.3, TypeScript 5.9, Vite 8.3, Vitest 5 con jsdom y Testing Library, y `recharts` 3.10. `npm test` reporta 91 tests en 15 archivos. Los tipos de API se generan desde OpenAPI (`npm run generate:api`) y hay un chequeo de drift.

Las únicas dependencias de runtime son `react`, `react-dom` y `recharts` (`frontend/package.json:16-41`).

## Findings

### 1. Navigation and shell

Shell de una sola página con barra de tabs y **sin router**. `App.tsx:36-98` guarda `tab` en `useState`, el `<nav aria-label="Workspaces">` está en `:83-94` y `renderWorkspace()` en `:56-75`. Los tabs usan `aria-pressed`. No hay URL ni deep-link, y cambiar de tab desmonta el workspace anterior, así que se pierde su estado. El header muestra `Backend: {ready|unavailable}` desde `api.ready()` (`App.tsx:41-54`, `:79-82`) y es solo informativo: los workspaces renderizan igual.

### 2. Screens

| Workspace | Archivo | Qué muestra |
|---|---|---|
| Portfolio | `features/portfolio/PortfolioWorkspace.tsx:18-37` | Resumen, tabla de holdings y tabla de valuaciones agrupadas por moneda (`ValuationsTable.tsx:27-39`) |
| Transactions | `TransactionsWorkspace.tsx:24-104` + `TransactionForm.tsx` | Formulario de compra/venta de 8 campos, filtro de historial por ticker **y** broker, tabla con delete. El historial solo carga después de completar ambos (`:62-69`) |
| Market | `MarketWorkspace.tsx:38-181` | Selector de ticker (portfolio, wishlist o búsqueda libre), período, modo línea/área, `MarketChart` con línea objetivo y marcadores de transacciones, `OpportunityList`, y `AlertsPanel` embebido (`:167-178`) |
| Alerts | `alerts/AlertsPanel.tsx:37-142` | **No es un tab.** Vive dentro de Market. Formulario de intención (neutral, stop-loss, buy, sell) más precio objetivo, botón de chequeo y `AlertStatus` con idle/loading/crossing/no-crossing/unavailable-503/error |
| Wishlist | `WishlistWorkspace.tsx:20-112` | Alta de ticker y tabla con borrador de objetivo por fila, guardar, limpiar, quitar |
| Bibliography | `BibliographyWorkspace.tsx:58-124` | Alta con título y autor obligatorios más opcionales, tabla y delete |
| Tools / split | `tools/split/SplitWorkspace.tsx:45-128` | Cantidad, precio promedio, dirección y ratio, con resultado en un `<dl>` |

### 3. UI primitives and their limits

- `DataTable.tsx:24-56` renderiza una tabla semántica con `<th scope="col">`. No tiene caption, orden, paginación, acciones de fila, alineación numérica ni `aria-label`. El estado vacío es un `<p>` plano con "No data".
- `FormControls.tsx:15-93` ofrece `TextField`, `TextAreaField` y `SelectField`, cada uno envuelto en `<label htmlFor>` con `onChange(value)` controlado. **No** tiene prop de error ni de ayuda, ni `aria-invalid`, ni `aria-describedby`, ni `required`, ni tipo numérico, ni botón o formulario compartido.
- `AsyncStates.tsx:6-13`: `LoadingState` es un `<p role="status">` y `ErrorState` un `<p role="alert">`. No hay componentes de estado vacío ni de éxito; los mensajes de éxito son `<p role="status">` ad hoc (por ejemplo `TransactionsWorkspace.tsx:77`).
- `CurrencyAmount.tsx:20-29` renderiza `{amount} {currency}` o "Not available". No formatea, no usa locale, y no da señal de signo ni de color para ganancia o pérdida.

### 4. Styling: there is none

Un grep de `style=`, `className` y `.css` sobre `frontend` no encontró nada. No hay archivos CSS bajo `src/` ni `public/`, `index.html:1-12` no referencia ninguna hoja de estilos ni fuente, `main.tsx:1-15` no importa CSS y `vite.config.ts:9` solo usa el plugin de React. **Tailwind no está instalado.** El render es HTML crudo sin estilos: cualquier sistema de estilos es dependencia netamente nueva.

### 5. Feedback and validation

- Cargando: texto plano, sin skeleton ni spinner (`PortfolioWorkspace.tsx:24`, `MarketWorkspace.tsx:92,128`).
- Vacío: un `<p>` pelado. Transactions no muestra nada hasta que se envían ticker y broker.
- Errores: `ErrorState` con `describeApiError(...)` (`PortfolioWorkspace.tsx:25`, `WishlistWorkspace.tsx:95,99`), pero el texto nunca se ata a un campo.
- Validación en cliente: mínima. Transactions usa `noValidate` (`TransactionForm.tsx:65`) y no valida nada, así que decide el backend. Bibliography chequea título y autor (`:73-77`), alerts chequea el precio objetivo (`:56-59`) y el filtro de historial falla en silencio (`TransactionsWorkspace.tsx:66`).
- Operaciones rechazadas: sí se muestran como error y el formulario no se limpia (`TransactionsWorkspace.tsx:46-49`, `TransactionForm.tsx:53`); 409 y 404 nunca se muestran como éxito.
- Deletes en transactions, bibliography y wishlist **sin confirmación**. El mensaje de éxito persiste hasta la próxima acción. Un delete fallido en transactions reusa `submitError`.

### 6. Testability and tryability

- Los tests mockean el borde de módulo con `vi.mock('../../api/client')` y cada `*Api` de feature. **No hay MSW** (aparece solo en `package-lock.json`). `App.test.tsx:10-68` mockea seis módulos y los re-arma en `beforeEach`: agregar un endpoint obliga a editar muchos mocks.
- `frontend/tests/setup.ts` solo registra jest-dom. No hay helper de render ni fábrica de fixtures; `PortfolioWorkspace.test.tsx:15-43` define sus datos inline.
- **No hay ruta de datos de demo ni de seed** en `vite.config.ts`, `package.json` ni `src/`. `vite.config.ts:5-19` proxea `/api` a `http://localhost:8000` y todos los workspaces salvo Split piden datos al montar: sin backend solo se ven estados de error.
- Puntos a favor: los roles y labels accesibles ya son consistentes (`aria-labelledby`, `label htmlFor`, `role=status`/`alert`) y los tests usan `getByLabelText`/`getByRole`. El único `data-testid` es `market-chart` (`MarketChart.tsx:65`).

### 7. The API surface is already complete

`types.ts` declara 15 rutas `/api/v1` más `/health` y `/ready`, y **todas las rutas `/api/v1` ya las llama algún workspace**. `api.health` está envuelta (`client.ts:52`) pero la UI nunca la usa (usa `/ready`). O sea: al frontend no le faltan capacidades de backend, le falta presentación, estructura y testabilidad.

### 8. External evidence: two Tremor flavors

| | Tremor Raw | `@tremor/react` (npm) |
|---|---|---|
| Distribución | Copiar y pegar; **no** está publicado en un registry | `npm install @tremor/react` |
| Estilos | Tailwind CSS 4 vía PostCSS | Su documentación asume Tailwind 3 (`@tailwind base/components/utilities`) |
| Charts | Recharts `^2.15` | Trae su propio Recharts, Headless UI, date-fns, react-day-picker, Floating UI y tailwind-merge |
| Peer React | `^18.3` | `>= 18` |
| Costo | Los componentes pasan a ser código propio | Una dependencia más, con su propio stack de charts |

Ninguno de los dos es gratis para este proyecto: Tailwind es dependencia nueva en ambos casos, y la alineación de Recharts es una decisión real porque `MarketChart` ya usa Recharts 3.10 con overlays de dominio (línea objetivo y marcadores de transacciones) que los wrappers de Tremor no cubren igual.

## Consequences

Lo que hace que el frontend se sienta incompleto no es la funcionalidad: es que **no hay capa visual**, **no hay forma de probarlo sin levantar todo el backend**, y **el feedback al usuario es débil**. Los tres ejes están confirmados con evidencia y son independientes entre sí.

## Open decision

Sabor de Tremor y alineación de Recharts. Recomendación en `proposal.md`; queda pendiente de confirmación del usuario antes de escribir spec, design y tasks.
