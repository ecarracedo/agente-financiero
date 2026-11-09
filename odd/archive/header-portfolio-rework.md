# Header + Portfolio rework
Branch: dev. Delivery: single change. Test runner: pytest backend/tests, npm test (frontend).

## Specs
- S1: "Portfolio Institucional el total en ARS (Lo que hay en USD a dolar CCL)"
- S2: "Position cambiar por Posiciones"
- S3: "Poder de compra sacarlo"
- S4: "Currencies cambiar por moneda"
- S5: "Fixed Engine online sacarlo"
- S6: "Trader Pro Institucional sacarlo"
- S7: "Buscar activo por ahora sacarlo"
- S8: "La parte de SPX, NDX, BTC tiene que ser configurable y agregar los indices/activos que quiero mostar que si muestre 4 pero si agrego mas que vaya haciendo como una calesita"
- S9: "Trabajar en la logica donde dice 4.26% y 24H 1.25%"
- S10 (decision): "usemos eso" — MEP = GD30/GD30D, CCL = Cedear ARS / ADR USD (metodología RAVA), calculado con providers propios, sin scrapear RAVA.

## Tasks
- T1 (S2,S3,S4,S5): PortfolioSummary cleanup — Posiciones, Moneda, sin Poder de compra ni Fixed Engine. Route: inline. Status: done.
- T2 (S1,S9,S10): ARS total con CCL calculado + TOTAL/24H sin hardcodeo. Route: inline. Status: done.
- T3 (S6,S7,S8): Header sin Trader Pro ni Buscar, ticker tape configurable con carrusel de 4. Route: inline. Status: done.
- T4: Tests RED/GREEN + suite. Route: inline. Status: done.

## Log
- L1: "Necesito trabajar en esta seccion, ahi te paso los puntos para el spec" + lista S1-S9 verbatim arriba.
- L2: "usemos por ahora USDARS de finance" → reemplazado por L3.
- L3: "usemos estos dolares https://www.rava.com/cotizaciones/dolares" → RAVA no tiene API directa (iframe JS a mercado.rava.com); se adopta su metodología con providers propios (S10).
- L4: Evidencia — backend 218 passed, test_fx 4 passed; frontend 185 passed, build ok, drift ok, lint 0 errors (1 warning preexistente en QuickOrderCard). CCL = AAPL.BA*20/AAPL (ratio BYMA 20:1 verificado), MEP = GD30/GD30D (PPI). TOTAL = gain_loss_percent del backend; 24H = variación ponderada por tenencia desde las series 1mo (últimos dos closes), sin hardcodeo.
- Risk: item 3 (contrato nuevo /api/v1/fx/dollars consumido por el front) y item 6 parcial (24H depende de series con granularidad mensual en fixtures; en vivo usa 1mo).
- L5: "No me esta mostrando el total" — causa: backend Docker con imagen vieja (404 en /fx/dollars). Fix: rebuild backend, VITE_PROXY_TARGET apuntando a la IP del contenedor (172.18.0.2:8000, el compose ya no publica 18080) y restart de Vite. Verificado: /api/v1/fx/dollars responde 401 sin cookie (endpoint vivo).
- L6: "tiene que sumarlo a la cartera de ARS" — total ARS ahora = cartera ARS + USD×CCL; TOTAL combinado (ganancia USD a CCL + ganancia ARS sobre invertido combinado). Test nuevo en verde (19 passed).
- L7: "la configuracion debe estar en Configuracion y reutilizar la busqueda de activos" — tape movido a SettingsPage como sección "Cinta de índices" con TickerSearch (marketApi.searchTickers); tapeSettings.ts con subscribe (patrón catalogSettings); header tape suscripto, sin config inline. Front 187 passed, build ok.
- L8: "la animacion no es buena tiene que ser como una calesita y sin las flechas" — TickerTape reescrito como scrolling continuo con keyframes `tape-scroll` (translateX 0 → -50% sobre contenido duplicado para bucle sin salto), sin flechas ni paginación, velocidad proporcional a la cantidad de símbolos. Front 187 passed, build ok, lint 0 errors.
