# Reglas del Agente (AI Rules)
## 1. Código y Calidad
- **Docstrings**: Todas las funciones y clases deben tener docstrings detallados en **INGLÉS**.
- **Limpieza**: Verificar y eliminar archivos o funciones que ya no se utilicen. Mantener el código limpio.
## 2. Base de Datos (SQLite)
- **Schema**: Actualizar los esquemas de base de datos ante cualquier cambio en los modelos.
- **Inicialización**: Si se modifica la estructura, actualizar y ejecutar `src/create_empty_db.py` para asegurar consistencia.
## 3. Testing y Verificación
- **Tests Unitarios**: Guardar nuevos tests en la carpeta `tests/`.
- **Scripts de Verificación**: Guardar archivos temporales o scripts de prueba manual con el prefijo `verify_` en la carpeta `verify/`.
## 4. Documentación
- **README.md**: Actualizar SIEMPRE tras cambios importantes en instalación, uso o configuración.
- **CHANGELOG**: 
  - Al hacer merge de `dev` a `main`, registrar nuevos features y bugfixes en `CHANGELOG.md` (y `CHANGELOG_es.md` si aplica).
## 5. Flujo de Trabajo (Git)
- **Auto-Merge**: Cuando se realizan cambios en `dev` y se solicita merge a `main`, realizar el merge automáticamente sin esperar confirmación final si los tests pasan. Se recomienda realizar el merge localmente y luego subir los cambios a github. Luego pasar a `dev` para continuar con el desarrollo.
- **Sincronización**: Si se solicita "sincronizar con github" o "subir cambios", realizar el `git push` directamente sin esperar confirmación extra.
## 6. Comunicación
- **Resúmenes cortos y claros**: Responder primero el resultado o la decisión, en pocas líneas. No repetir lo ya dicho, no narrar el proceso paso a paso y no listar opciones que no cambian la decisión. Ampliar solo si se pide o si hay una bifurcación real que el usuario deba elegir.