# Registro de Cambios

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Agregado
- **Posiciones en Cartera**: Columnas Total y Variación con cotizaciones en vivo, más columna de P&L.
- **Registrar Transacción**: Selectores de broker y tipo de activo; precio editable manualmente.
- **Gestión de Tenencias**: Botón "Vender" para vender la posición completa al precio actual. La cartera inicia vacía en modo demo.
- **Edición de Posiciones**: Broker y tipo de activo editables en línea, con aplicación optimista y reversión si falla la actualización.
- **Catálogo de Cartera**: Brokers y tipos de activo configurables desde Configuración y persistidos localmente.
- **Filtros de Tenencias**: Filtrado por ticker, tipo de activo y broker, con contador de resultados y acción para limpiar.
- **Últimas Transacciones**: La tarjeta muestra las últimas tres operaciones registradas en lugar de datos de ejemplo.
- **API de Transacciones**: `GET /api/v1/transactions` acepta un `limit` opcional y, sin ticker, devuelve las operaciones más recientes de toda la cartera.
- **Alias de cotización**: Los símbolos de broker se vinculan al nombre oficial del instrumento en PPI desde Configuración. Los alias viven en la tabla `ticker_aliases` detrás de `GET/POST/DELETE /api/v1/ticker-aliases`, sin listas hardcodeadas en el proveedor. El editor ofrece solo los activos en cartera: elegís uno y escribís su alias.
- **Datos de Mercado Local (Proveedor PPI)**: Bonos Argentinos (`AE38`, `AL30`, `AL30D`, `GD30`, etc.) y Fondos Comunes de Inversión (`AL.DIVER.A` -> Allaria Diversificado Clase A) ahora cotizan desde las páginas públicas de Portfolio Personal Inversiones, con caché diaria. Para acciones, Cedears y cripto se sigue usando yfinance.

### Cambiado
- **Script de arranque**: `scripts/start.sh` reemplaza a `scripts/start-demo.sh` y levanta el servidor de desarrollo de Vite contra el backend real en lugar de los datos de demo (MSW).

### Corregido
- **Tabla de Posiciones**: Un broker o tipo de activo que ya no está en el catálogo se sigue mostrando en su selector en lugar de dejar el control vacío.
- **Catálogo de Cartera**: El memo del catálogo detecta cambios hechos en `localStorage` por otra vía, así que nunca sirve un catálogo viejo.
- **Alias de cotización**: Se agregaron pruebas de contrato de API para `GET/POST/DELETE /api/v1/ticker-aliases` (incluido upsert por ticker de broker) y una prueba del proveedor que demuestra que un alias guardado en la base de datos toma efecto tras invalidar el caché.

## [1.2.0] - 2025-12-18

### Agregado
- **Calculadora de Split**:
  - Nueva pestaña "🛠️ Herramientas" para utilidades.
  - Calculadora interactiva para splits directos e inversos.
  - Proyección instantánea de nueva cantidad y costo promedio ajustado.
- **Mejoras Arquitectónicas**:
  - Estructura modular del proyecto: `models/`, `services/`, `ui/`, `external/`, y `scripts/`.
  - Organización de código y mantenibilidad mejoradas.

### Corregido
- **Tabla de Tenencias**: Resuelto el error `TypeError` causado por un argumento de ancho incorrecto en `st.dataframe`.

## [1.1.0] - 2025-12-09

### Agregado
- **Pestaña de Gráficos Interactivos**:
  - Gráficos de pantalla completa impulsados por Plotly.
  - Opción para alternar entre vistas de **Velas Japonesas** y **Área/Línea**.
  - **Escala de Ejes Dinámica**: Agrega automáticamente un 40% de espacio vertical extra cuando el precio está cerca de máximos.
  - **Integración de Alertas de Precio**: Muestra los precios objetivo configurados (en Portafolio o Lista de Deseos) como líneas punteadas rojas en el gráfico.
  - Encabezado de precios en tiempo real con métricas de variación diaria.


### Cambiado
- **Auto-Actualización**: Se reemplazó la recarga completa de página por actualizaciones parciales usando `st.fragment` en la tabla de tenencias.
- **Interfaz (UI)**: Limpieza de métricas duplicadas en la barra lateral y corrección de títulos duplicados.

### Corregido
- **Error de Botón**: Corregido uso de parámetro obsoleto `width` en `st.button`.

## [1.0.0] - 2025-12-05

### Agregado
- **Sistema de Gestión de Portafolio**
  - Base de datos SQLite para almacenamiento persistente de datos del portafolio
  - Soporte para múltiples categorías de activos: Acciones, Cedears, Bonos, ONs, Cripto, FCI, Letras
  - Soporte multi-broker con seguimiento de posiciones separado por broker
  - Cálculo de precio promedio ponderado para tenencias

- **Gestión de Transacciones**
  - Registro de operaciones de Compra/Venta con fecha, precio, cantidad, broker y categoría
  - Vista de historial de transacciones con registro completo de auditoría
  - Eliminación de transacciones individuales con recálculo automático del portafolio
  - Reseteo automático de fecha al día actual después de registrar operaciones

- **Datos de Mercado en Tiempo Real**
  - Integración con yfinance para obtención de precios en vivo
  - Sistema de auto-actualización con intervalos configurables (1min, 5min, 15min, 30min, 1h)
  - Botón manual "Actualizar Ahora" con capacidad de forzar actualización
  - Caché de precios para minimizar llamadas a la API
  - Visualización de timestamp de última actualización

- **Visualización del Portafolio**
  - Gráficos interactivos mostrando composición del portafolio por categoría
  - Gráfico de torta de distribución de activos
  - Tabla detallada de tenencias con:
    - Precios actuales
    - Cálculo de valor total
    - Ganancia/Pérdida en dólares y porcentaje
    - Rendimiento codificado por colores (verde para ganancias, rojo para pérdidas)

- **Funcionalidad de Lista de Deseos**
  - Seguimiento de oportunidades de inversión potenciales
  - Validación de mercado para símbolos de ticker
  - Seguimiento separado para mercados de EE.UU. y Argentina (sufijo .BA)
  - Agregar/eliminar elementos de la lista de deseos

- **Gestión de Bibliografía**
  - Organizar recursos de aprendizaje financiero
  - Soporte para libros, artículos y videos
  - Categorización y seguimiento de metadatos

- **Interfaz de Usuario**
  - Interfaz web basada en Streamlit
  - Pestañas organizadas: Portafolio, Operaciones, Oportunidades, Lista de Deseos, Bibliografía
  - Diseño responsivo con actualizaciones en tiempo real
  - Validación de entrada y manejo de errores

- **Herramientas de Desarrollo**
  - Script de inicialización de base de datos (`src/create_empty_db.py`)
  - Suite de pruebas para cálculos de precio promedio
  - Scripts de verificación para integridad del portafolio

### Corregido
- Corregida la lógica de cálculo de precio promedio: vender acciones ya no afecta el precio promedio de las acciones restantes
- Reducción adecuada de cantidad al vender activos
- Manejo de errores al vender posiciones inexistentes
- Validación de mercado para prevenir errores de ticker entre mercados (ej. sufijo .BA en mercado de EE.UU.)

### Cambiado
- Reorganizada la estructura del proyecto:
  - Archivos de prueba movidos al directorio `tests/`
  - Scripts de verificación movidos al directorio `verify/`
  - Eliminados scripts de utilidad sin uso
- Actualizado README con instrucciones completas de configuración
- Mejorado formulario de transacciones con reseteo automático de campos

### Detalles Técnicos
- **Esquema de Base de Datos**: Tablas PortfolioItem, Transaction, WishlistItem, BibliographyItem
- **Dependencias**: Streamlit, yfinance, pandas, peewee, plotly
- **Versión de Python**: 3.13 recomendado

---

## Notas de la Versión

Esta es la primera versión estable (MVP) de la aplicación Agente Financiero. El sistema proporciona una solución completa para gestionar un portafolio de acciones con datos de mercado en tiempo real, seguimiento de transacciones y análisis de rendimiento.

**Aspectos Destacados:**
- ✅ Operaciones CRUD completas para gestión de portafolio
- ✅ Actualizaciones de precios en tiempo real con auto-actualización
- ✅ Seguimiento preciso de costo promedio ponderado
- ✅ Soporte multi-activo y multi-broker
- ✅ Historial de transacciones con capacidad de eliminación
- ✅ Seguimiento visual de rendimiento con ganancias/pérdidas codificadas por color

**Limitaciones Conocidas:**
- Los datos de precios dependen de la disponibilidad de la API de yfinance y pueden tener retrasos
- Sin autenticación de usuario (aplicación de usuario único)
- Sin funcionalidad de exportación de datos todavía

**Hoja de Ruta Futura:**
- Informes y análisis de rendimiento del portafolio
- Exportación de datos a CSV/Excel
- Gráficos avanzados e indicadores técnicos
- Soporte multi-moneda
