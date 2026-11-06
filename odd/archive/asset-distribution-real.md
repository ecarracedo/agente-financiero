# Feature: AssetDistributionCard con datos reales de cartera

Objective: reemplazar el mock hardcodeado de `AssetDistributionCard` ("Distribución de Activos",
"$148,650.80", 62%/23%/10%/5% de Acciones/ETFs/Cripto/Efectivo) por información calculada desde las
posiciones reales y sus precios de mercado, actualizada junto con el resto del workspace.
Branch: `dev`. Delivery: un work unit, un commit. Test runner: `npm test` (Vitest) en `frontend/`.
Estado: solo spec, sin implementación.

## Specs

- **S1. La tarjeta usa la fuente real, no valores hardcodeados.** Debe recibir por props las
  posiciones ya cargadas por el workspace (`PortfolioPosition[]` de `GET /api/v1/portfolio`:
  `ticker`, `broker`, `category`, `quantity`, `average_price`, `currency`) y las valuaciones por
  moneda (`GET /api/v1/valuations`). El usuario pidió: "que vaya actualizando y dandome informacion
  de los activos en cartera". Ningún monto, porcentaje, ticker o total puede estar literal en el
  componente. La elección de fuente fue: "Datos reales por categoría".
- **S2. Una sección por moneda, nunca sumadas entre sí.** Las valuaciones del backend vienen
  agrupadas por moneda (`CurrencyValuationResponse`: `currency`, `invested_value`, `market_value`,
  `gain_loss`, `gain_loss_percent`, `unpriced_tickers`) y el resto del dashboard ya cumple que
  "renders each currency as a separate valuation group, never summed together". La tarjeta debe
  respetar esa regla: un total, un donut y una barra por moneda; jamás un "VALOR TOTAL" que mezcle
  USD+EUR+ARS sin conversión cambiaria (no existe endpoint de FX en el contrato).
- **S3. Agrupación por `category` real de cada posición.** Las clases ilustrativas del mock
  (Acciones/ETFs/Cripto/Efectivo) no existen como tales en la DB: `category` es texto libre
  normalizado por el catálogo (`Acciones`, `Cedear`, `Cripto`, …). Cada categoría real (grupo
  moneda+categoría) muestra: valor valorizado, porcentaje sobre el total valorizado de su moneda,
  cantidad de tickers y lista de tickers (p. ej. "2 Activos (NVDA, AAPL)"). La tarjeta "Efectivo"
  y todo colateral FIAT desaparecen: no hay fuente de efectivo en el contrato (el "$28,500.00 /
  COLATERAL FIAT" de `PortfolioSummary` es el mismo problema y queda fuera de este spec).
- **S4. Valorización a precio de mercado actual, vía el mismo mecanismo de HoldingsTable.**
  Cada posición se valúa como `quantity × current_price`, donde `current_price` sale de
  `GET /api/v1/analysis/{ticker}` (`marketApi.getAnalysis(ticker, '1mo')`), exactamente igual que
  `HoldingsTable` ya hace por ticker. La tarjeta reacciona al mismo `refreshKey`/timer de
  actualización del workspace y al re-fetch tras operar (`onPositionsChange`), para "ir
  actualizando". Formato monetario global obligatorio: "$ 1.000,00" (símbolo $, espacio, punto de
  miles, coma decimal, 2 decimales), como ya usan `PortfolioSummary` y `HoldingsTable`
  (`toLocaleString('es-AR', …)`).
- **S5. Posiciones sin precio se excluyen y se declaran, nunca cuentan como cero.**
  Si el análisis devuelve `status: 'UNKNOWN'`/`current_price: null` o la request falla, esa posición
  no entra al total ni a los porcentajes, y la tarjeta indica cuántos tickers quedaron sin valuar
  (reutilizando el concepto de `unpriced_tickers` de las valuaciones). Solo posiciones valorizadas
  pueden componer el 100% que muestra el donut.
- **S6. Desaparecen los adornos sin fuente.** Sin "Score: 9.4/10", sin "Cartera Balanceada", sin
  badge "TIEMPO REAL" sobre números estáticos, sin deltas "+3.8% 24h" inventados y sin "Riesgo
  Moderado". Lo que el donut/barra sí puede mostrar: categorías con porcentaje real, valor y
  tickers; el centro del donut muestra el total valorizado de la moneda alcanzada (no un 100% mudo).
- **S7. Estados vacíos y de carga honestos.** Cartera vacía → mensaje de que aún no hay posiciones
  para distribuir (no ceros ni un donut vacío que simule datos). Mientras los precios llegan, la
  tarjeta muestra estado de carga por moneda; un fallo de un ticker no bloquea el resto, sigue S5.
- **S8. Tests con el harness MSW existente, RED antes de GREEN.** Nuevo
  `AssetDistributionCard.test.tsx` (o casos en `PortfolioWorkspace.test.tsx`) usando
  `renderWithRouter`, fixtures compartidas y handlers MSW: (a) con el fixture actual (AAPL×10,
  precio 190.00 USD) la tarjeta muestra USD $ 1.900,00 y categoría Acciones al 100%; (b) suma de
  porcentajes por moneda = 100%; (c) dos monedas se muestran como secciones separadas, nunca
  combinadas; (d) ticker con análisis `UNKNOWN` queda fuera del total y se declara sin valuar;
  (e) cartera vacía muestra el estado vacío; (f) actualizar precios (como el caso
  `quoteCalls` 190→205 de `HoldingsTable`) mueve los porcentajes. El test debe observarse en RED
  contra el componente mock actual antes de implementar.
- **S9. No tocar backend ni contrato.** Sin cambios en endpoints, schemas, DB ni fixtures de
  contrato: la fuente (portfolio + valuations + analysis por ticker) ya existe y alcanza para S1–S8.
  Sin cambios en `HoldingsTable`, `PortfolioSummary` ni tablas de valuación: este spec es solo la
  tarjeta de distribución (su hardcodeado "$28,500.00 COLATERAL FIAT" en `PortfolioSummary.tsx`
  queda registrado como deuda conocida, fuera de este cambio).

## Tasks

- [x] T1 — RED: escribir los tests de S8 contra el componente actual y observar el fallo.
- [x] T2 — `AssetDistributionCard`: recibir `positions`+`valuations`, pedir precios por ticker
  (S4), agrupar por moneda+categoría real (S2, S3), donut/barra/cards calculados y formato
  "$ 1.000,00"; retirar score/24h/efectivo/badge estático (S6); estados vacío/carga/sin-valuar (S5,
  S7).
- [x] T3 — `PortfolioWorkspace`: pasarle `data.positions` y `data.valuations` ya cargados.
- [x] T4 — GREEN: suite `frontend` completa en verde; format/lint del repo si aplica.
- [x] T5 — Cerrar con línea de riesgo (`Risk: none` o el ítem que corresponda) y commit de work unit
  en `dev` (sin push ni PR: decisión del usuario).

## Log

- L1. Pedido original del usuario, verbatim: "[Image 1] Me gustaria ir trabajando en esta area, que
  vaya actualizando y dandome informacion de los activos en cartera" (captura de la tarjeta
  "Distribución de Activos" con $148,650.80 y 62%/23%/10%/5%).
- L2. Verificación en código: `frontend/src/features/portfolio/AssetDistributionCard.tsx` no recibe
  props y hardcodea montos/porcentajes/tickers; `PortfolioWorkspace.tsx` ya tiene
  `data.positions`+`data.valuations` cargados pero no se los pasa. `HoldingsTable.tsx` ya pide
  precios por ticker vía `marketApi.getAnalysis` y muestra "Próxima actualización en …" con timer.
- L3. Decisión del usuario ante la pregunta de fuente de datos: "Datos reales por categoría"
  (posiciones + precios de mercado + valuaciones, agrupado por `category` real, sin sumar monedas).
- L4. Alcance acordado ahora: solo este spec; implementación pendiente de autorización expresa.
- L5. Implementado con autorización ("empecemos"): RED observado (5 tests fallando contra el mock),
  GREEN con 5/5 tests nuevos en verde, `tsc --noEmit` y `eslint` limpios en los archivos tocados.
  Suite completa: 13 fallos preexistentes verificados también en árbol limpio (9 de ellos en
  `PortfolioWorkspace`/`CurrencyAmount` por el formato es-AR "$ 1.000,00" de un commit anterior;
  el resto en alerts/transactions), ninguno causado por este cambio.
- L6. Evidencia: `AssetDistributionCard` agrupa por moneda+categoría con `quantity × current_price`,
  excluye sin-valuar y los declara, formato "$ 1.000,00"; commit de work unit en `dev`, sin push.

Risk: none
