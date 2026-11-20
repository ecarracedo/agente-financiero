# Reglas del Agente (AI Rules)
## 1. Código y Calidad
- **Docstrings**: Todas las funciones y clases deben tener docstrings detallados en **INGLÉS**.
- **Limpieza**: Verificar y eliminar archivos o funciones que ya no se utilicen. Mantener el código limpio.
- **Formato moneda global**: Todo monto monetario debe mostrarse como "$ 1.000,00" (símbolo $, separador de miles con punto, separador decimal con coma, 2 decimales, espacio entre símbolo y número).
## 2. Base de Datos (PostgreSQL)
- **Schema**: Actualizar los modelos en `backend/app/adapters/persistence/models.py` y agregar la migración Alembic correspondiente en `backend/alembic/versions/` ante cualquier cambio de estructura.
- **Inicialización**: Aplicar `python -m alembic -c backend/alembic.ini upgrade head` para asegurar consistencia; el arranque de Compose ya lo ejecuta.
## 3. Testing y Verificación
- **Tests Unitarios**: Guardar los tests de backend en `backend/tests/` y los de frontend junto a su componente en `frontend/src/`.
- **Scripts de Verificación**: Guardar scripts temporales o de prueba manual con el prefijo `verify_` fuera del repositorio, en `/tmp/opencode/`. No recrear la carpeta `verify/`: fue retirada junto al flujo OpenSpec.
## 4. Documentación
- **README.md**: Actualizar SIEMPRE tras cambios importantes en instalación, uso o configuración.
- **CHANGELOG**: 
  - SIEMPRE actualizar `CHANGELOG.md` con los cambios realizados antes de hacer merge a `main`. Agregar bajo `[Unreleased]` o crear nueva versión.
  - Al hacer merge de `dev` a `main`, registrar nuevos features y bugfixes en `CHANGELOG.md` (y `CHANGELOG_es.md` si aplica).
## 5. Flujo de Trabajo (Git)
- **Auto-Merge**: Cuando se realizan cambios en `dev` y se solicita merge a `main`, realizar el merge automáticamente sin esperar confirmación final si los tests pasan. Se recomienda realizar el merge localmente y luego subir los cambios a github. Luego pasar a `dev` para continuar con el desarrollo.
- **Sincronización**: Si se solicita "sincronizar con github" o "subir cambios", realizar el `git push` directamente sin esperar confirmación extra.
- **Cierre de sesión ("Cerremos por hoy")**: Cuando el usuario diga "Cerremos por hoy" (o equivalente), ejecutar el ritual de cierre completo sin esperar confirmación extra, en este orden: (1) documentar lo hecho en `CHANGELOG.md` y `CHANGELOG_es.md` si aplica y cerrar el feature doc correspondiente (`odd/tasks/<feature>.md`: tareas completadas, log con evidencia, línea de riesgo) y archivarlo moviéndolo a `odd/archive/`; (2) commitear documentación y archivo en `dev`; (3) `git push` de `dev`; (4) merge de `dev` a `main` localmente; (5) `git push` de `main`; (6) volver a `dev` y dejar el repo limpio. Responder solo con el resultado del ritual.
## 6. Comunicación
- **Resúmenes cortos y claros**: Responder primero el resultado o la decisión, en pocas líneas. No repetir lo ya dicho, no narrar el proceso paso a paso y no listar opciones que no cambian la decisión. Ampliar solo si se pide o si hay una bifurcación real que el usuario deba elegir.
## 7. Estilo UI (baseline)
- **Baseline visual**: La tarjeta "Registrar Transacciones" (`frontend/src/features/portfolio/QuickOrderCard.tsx`) es la referencia obligatoria para toda UI nueva o modificada. Antes de crear o ajustar formularios, tarjetas, controles o mensajes, copiar sus tokens. No introducir otra escala tipográfica ni otro sistema de colores.
- **Contenedor y encabezado**: `bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 border border-[#3d494c]/20`. Título `text-base font-semibold font-headline`; icono `material-symbols-outlined text-[20px] text-[#4cd7f6]`; badge `text-[10px] font-mono uppercase`.
- **Campos**: etiqueta `text-[10px] font-mono text-[#869397] uppercase`; grupo `flex flex-col gap-1`; input o select dentro de `bg-[#1c2028] px-2.5 py-1.5 rounded-lg border border-[#3d494c]/30` con texto `text-xs font-mono text-white`; pares de campos en `grid grid-cols-2 gap-2`.
- **Controles segmentados**: `flex items-center gap-1 bg-[#1c2028] p-1 rounded-lg`; opciones `flex-1 py-1 text-xs font-mono uppercase rounded font-bold`.
- **Botón principal**: `w-full py-2 bg-[#06b6d4] hover:bg-[#4cd7f6] text-[#003640] text-xs font-semibold rounded-lg shadow-md`.
- **Búsqueda de activos**: usar siempre `TickerSearch` con `marketApi.searchTickers`. No crear inputs de ticker propios.
- **Montos y errores**: el monto va en `font-mono` con `$ ` y el código de moneda a la derecha (`text-base font-bold` en totales); los errores van en `text-xs font-mono text-[#ffb4ab]` con `role="alert"`.