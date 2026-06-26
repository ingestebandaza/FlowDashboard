# ANEXO OBLIGATORIO — CONTROL DE COHERENCIA ENTRE CÓDIGO, RUNTIME Y DOCUMENTACIÓN

Este anexo forma parte del Plan Maestro de Implementación Comercial de FlowDashboard 2.0.0.

La IA implementadora no puede declarar una fase completada si no demuestra que:

1. el código vigente;
2. la ejecución real;
3. la documentación;
4. el mapa del repositorio;
5. los scripts de arranque y build;

describen el mismo sistema.

---

## 1. Fuentes de verdad canónicas

Solo estos documentos pueden describir el estado vigente del producto:

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `docs/master_technical_specification.md`
- `docs/current/CURRENT_ARCHITECTURE.md`
- `docs/current/REPOSITORY_MAP.md`
- `docs/current/DEVELOPMENT_START.md`
- `docs/current/BUILD_AND_RELEASE.md`
- `docs/current/SECURITY.md`
- `PLAN_MAESTRO_IMPLEMENTACION_COMERCIAL_FLOWDASHBOARD_2.0.0.md`
- este anexo

La IA debe verificar que no se contradigan.

`DOCUMENTACION_TECNICA.md` está prohibido como fuente de verdad.

---

## 2. Clasificación obligatoria de cada documento

Cada documento técnico debe incluir en su encabezado uno de estos estados:

```text
STATUS: CURRENT
STATUS: LEGACY
STATUS: EXPERIMENTAL
STATUS: ARCHIVED
STATUS: PROHIBITED-AS-SOURCE
```

También debe incluir:

```text
Last verified against code:
Last verified against runtime:
Canonical replacement:
Owner:
```

Los documentos sin estado no pueden utilizarse como referencia técnica.

---

## 3. Clasificación obligatoria de archivos

Antes de mover, archivar o eliminar un archivo, la IA debe clasificarlo como:

- `CANONICAL_RUNTIME`
- `CANONICAL_SOURCE`
- `BUILD_INPUT`
- `GENERATED_ARTIFACT`
- `RUNTIME_DATA`
- `DIAGNOSTIC`
- `EXPERIMENTAL`
- `LEGACY`
- `UNKNOWN`

No se puede mover ni borrar un archivo `UNKNOWN`.

---

## 4. Índice legacy obligatorio

Crear y mantener:

```text
archive/LEGACY_INDEX.md
```

Por cada archivo legacy registrar:

- ruta original;
- nueva ruta;
- fecha;
- motivo;
- reemplazo vigente;
- búsquedas de referencias realizadas;
- consumidores detectados;
- prueba de que ya no participa en runtime;
- rollback.

Nunca archivar por nombre, fecha o apariencia solamente.

---

## 5. Matriz código-documentación-runtime

Crear:

```text
docs/current/RUNTIME_CODE_DOCUMENTATION_MATRIX.md
```

Debe contener como mínimo:

| Componente | Código canónico | Proceso/runtime | Puerto | Launcher | Documentación | Estado verificado |
|---|---|---|---|---|---|---|

Incluir:

- Electron;
- Python;
- C#;
- ADB;
- scrcpy;
- H.264;
- control;
- FlowAgent;
- FlowKeyboard;
- FlowLogin;
- FlowMail;
- Inspector;
- OCR;
- FlowTrackName;
- licencia;
- actualizador;
- instalador.

Una fila no puede marcarse `VERIFIED` sin evidencia de código y runtime.

---

## 6. Prueba de paridad documental por fase

Después de cada fase, la IA debe ejecutar una reconciliación documental:

1. listar archivos modificados;
2. detectar documentos que mencionan esos archivos o componentes;
3. actualizar documentos CURRENT;
4. marcar documentos antiguos como LEGACY;
5. actualizar `REPOSITORY_MAP.md`;
6. actualizar la matriz;
7. buscar referencias obsoletas;
8. buscar rutas antiguas;
9. buscar nombres antiguos;
10. buscar versiones contradictorias;
11. validar enlaces internos;
12. validar que `abrir_electron.bat` siga siendo correcto en desarrollo.

---

## 7. Escaneo obligatorio de contradicciones

Crear un script de solo lectura:

```text
scripts/diagnostics/verify-documentation-consistency.ps1
```

Debe buscar:

- `FlowDashboard.exe` descrito como producto vigente;
- `launcher.py` descrito como launcher vigente;
- `updater.py` descrito como actualizador vigente;
- `wsapi_demo.html` descrito como dashboard vigente;
- versiones distintas de `2.0.0` después de la unificación;
- referencias a rutas personales;
- referencias a Python del usuario;
- referencias a `dotnet run` en producción;
- referencias a `.supabase_config.json` dentro del instalador;
- referencias a SQL destructivos como procedimiento normal;
- número fijo de dispositivos;
- IPs hardcodeadas;
- documentación sin estado;
- componentes CURRENT sin entrada en la matriz.

El script debe devolver código de salida distinto de cero si encuentra contradicciones críticas.

---

## 8. Prueba de runtime obligatoria

No basta con leer código.

Después de cada fase que afecte arranque, rutas, build, licencias o actualización:

1. iniciar mediante `abrir_electron.bat`;
2. verificar procesos;
3. verificar puertos;
4. consultar health;
5. verificar dispositivos;
6. verificar Grid;
7. verificar Focus;
8. verificar control;
9. revisar logs;
10. documentar resultados.

Para build comercial:

1. instalar en VM limpia;
2. comprobar que no existe Python;
3. comprobar que no existe .NET;
4. comprobar que no existe Node;
5. iniciar desde acceso directo;
6. comprobar sidecars;
7. comprobar health;
8. comprobar actualización;
9. comprobar conservación de datos.

---

## 9. Gate de cierre de fase

Una fase solo puede cerrarse cuando todos estos campos estén completos:

```text
Code verified: YES
Runtime verified: YES
Documentation updated: YES
Repository map updated: YES
Legacy index updated: YES
Contradiction scan: PASS
Regression tests: PASS
Rollback tested/documented: YES
Unresolved contradictions: 0
```

Si `Unresolved contradictions` es mayor que cero, la fase queda abierta.

---

## 10. Prohibición de borrado prematuro

Durante la reorganización:

- no borrar archivos directamente;
- mover primero a `archive/`;
- mantener rollback;
- conservar hashes;
- conservar rutas originales en el índice;
- no limpiar restore points;
- no borrar SQL históricos hasta validar migraciones nuevas;
- no borrar launchers antiguos hasta demostrar que ningún flujo los usa.

---

## 11. Documentación generada desde fuentes únicas

Siempre que sea posible, generar automáticamente:

- versión;
- rutas de runtime;
- lista de recursos empaquetados;
- puertos;
- artefactos de release;
- checksums;
- dependencias;
- third-party notices.

No duplicar manualmente datos que puedan derivarse de:

- `version.json`;
- configuración de electron-builder;
- manifiesto de build;
- health endpoints;
- package manifests.

---

## 12. Manifiesto de build obligatorio

Cada build debe generar:

```text
release_packages/<version>/build-manifest.json
```

Debe incluir:

- versión;
- canal;
- commit;
- fecha;
- publisher;
- archivos incluidos;
- SHA-256;
- tamaño;
- versión Python backend;
- versión C#;
- versión Electron;
- versión scrcpy;
- versión ADB;
- versión FlowAgent;
- hash FlowTrackName;
- migraciones requeridas;
- schema version;
- firma;
- resultado de pruebas.

La documentación de release debe referenciar este manifiesto.

---

## 13. Regla de actualización documental

Cada cambio funcional debe actualizar en el mismo commit:

- código;
- tests;
- documentación CURRENT;
- matriz;
- changelog;
- rollback cuando aplique.

No aceptar commits donde la documentación quede para “más tarde”.

---

## 14. Regla de respuesta de la IA

Al finalizar cada fase, la IA debe responder exactamente con estas secciones:

1. `Resumen de la fase`
2. `Evidencia del flujo real`
3. `Archivos modificados`
4. `Archivos archivados`
5. `Documentación actualizada`
6. `Contradicciones encontradas`
7. `Contradicciones resueltas`
8. `Contradicciones pendientes`
9. `Pruebas ejecutadas`
10. `Resultados`
11. `Riesgos`
12. `Rollback`
13. `Estado del gate`
14. `Solicitud de aprobación`

No puede continuar automáticamente a la siguiente fase.

---

## 15. Definición de coherencia total

Se considerará que FlowDashboard está correctamente documentado cuando:

- existe una única descripción del producto vigente;
- existe un único launcher de desarrollo oficial;
- existe un único mecanismo de build comercial;
- existe un único actualizador vigente;
- existe una única fuente de versión;
- todo archivo legacy está indexado;
- ninguna documentación CURRENT referencia componentes legacy como vigentes;
- la matriz coincide con código y runtime;
- el escaneo de contradicciones pasa;
- la build limpia coincide con la documentación;
- no existen contradicciones conocidas sin registrar.
