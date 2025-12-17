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
- **Auto-Merge**: Al finalizar tareas en `dev` para pasar a `main`, realiza el merge automáticamente sin esperar confirmación final si los tests pasan.
- **Sincronización**: Si se solicita "sincronizar con github" o "subir cambios", realizar el `git push` directamente sin esperar confirmación extra.