# Auditoría de Estado Git

1. **Por qué `electron-app/` aparece untracked:** Se creó durante el desarrollo de las fases 1-8 pero el desarrollador jamás ejecutó `git add` ni `git commit`. Todo el trabajo se mantuvo exclusivamente en el working tree sin versionarse.
2. **Por qué `FlowDashboard.Core/` aparece untracked:** Idéntico motivo. Se creó el proyecto en C# y se construyó, pero no se añadieron los fuentes al control de versiones.
3. **Por qué `version.json`, `docs/`, `archive/` y `abrir_electron.bat` aparecen untracked:** Nunca fueron consolidados. Se escribieron en el working tree sin registrarse en Git, a pesar de pertenecer a las Fases 1 y 2.
4. **Qué componentes comerciales están únicamente en el working tree:**
   - Toda la app Electron (`electron-app/`).
   - Todo el motor C# (`FlowDashboard.Core/`).
   - Toda la documentación nueva (`docs/`).
   - El archivo legado (`archive/`).
   - Los scripts de arranque (`abrir_electron.bat`, `abrir_electron.ps1`).
   - Archivos de configuración (`version.json`, `.venv` local, etc.).
5. **Qué se perdería al ejecutar un `git clean` o restaurar el repositorio:** Se perdería **TODA** la implementación comercial realizada desde la Fase 1 a la 9, devolviendo el proyecto al estado pre-comercial original.
6. **Qué archivos corresponden realmente a cada fase:** La mayoría de los archivos untracked son el producto de las Fases 1 a 9, conviviendo simultáneamente en el disco sin distinción en historial.
7. **Qué cambios están en Git y cuáles no:** Ningún cambio de la estructura comercial está en Git. Las escasas modificaciones tracked corresponden a ajustes visuales previos en archivos preexistentes (como `Login.js`, `.gitignore`, `abrir_dashboard.bat`).
8. **Si `commercial/v2.0.0` apunta al mismo commit que `main`:** Sí, ambos apuntan a `d4ae086`.
9. **Qué commits contienen las Fases 1–9:** No existe ningún commit para estas fases en la rama actual. Están perdidas desde el punto de vista del versionado.
10. **Estrategia de consolidación recomendada:** 
    Aislar y consolidar el código mediante *atomic commits* secuenciales para registrar apropiadamente la historia:
    - Agregar `docs/` y `archive/` (Fase 1).
    - Agregar `version.json` y `abrir_electron` (Fase 2).
    - Agregar `FlowDashboard.Core/` (excluyendo obj/bin).
    - Agregar `electron-app/` (excluyendo node_modules/dist).
