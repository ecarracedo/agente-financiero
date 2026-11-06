# Reglas del Agente (AI Rules)
## 1. Código y Calidad
- **Docstrings**: Todas las funciones y clases deben tener docstrings detallados en **INGLÉS**.
- **Limpieza**: Verificar y eliminar archivos o funciones que ya no se utilicen. Mantener el código limpio.
- **Formato moneda global**: Todo monto monetario debe mostrarse como "$ 1.000,00" (símbolo $, separador de miles con punto, separador decimal con coma, 2 decimales, espacio entre símbolo y número).
## 2. Base de Datos (SQLite)
- **Schema**: Actualizar los esquemas de base de datos ante cualquier cambio en los modelos.
- **Inicialización**: Si se modifica la estructura, actualizar y ejecutar `src/create_empty_db.py` para asegurar consistencia.
## 3. Testing y Verificación
- **Tests Unitarios**: Guardar nuevos tests en la carpeta `tests/`.
- **Scripts de Verificación**: Guardar archivos temporales o scripts de prueba manual con el prefijo `verify_` en la carpeta `verify/`.
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