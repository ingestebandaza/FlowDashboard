# PLAN MAESTRO DE IMPLEMENTACIÓN COMERCIAL — FLOWDASHBOARD 2.0.0

## 0. Mandato de trabajo

Este documento debe ser utilizado por la IA implementadora como contrato técnico.

La IA debe:

1. Leer primero:
   - `AGENTS.md`
   - `PROJECT_CONTEXT.md`
   - `docs/master_technical_specification.md`
   - este documento
2. Inspeccionar el código real antes de modificarlo.
3. Confirmar cada ruta, función, endpoint y dependencia mediante evidencia del repositorio y ejecución local.
4. No inventar arquitectura, nombres de archivo ni estados.
5. No ejecutar cambios destructivos en Supabase.
6. Crear un restore point antes de cada fase.
7. Ejecutar cada fase por separado.
8. Detenerse al finalizar cada fase y entregar:
   - archivos modificados;
   - cambios exactos;
   - pruebas ejecutadas;
   - resultados;
   - riesgos;
   - rollback;
   - pendientes.
9. No avanzar de fase sin aprobación del propietario.
10. Usar siempre `abrir_electron.bat` para validar el producto de desarrollo.
11. No usar `electron.exe` directamente.
12. No usar ni tomar como verdad `DOCUMENTACION_TECNICA.md`; es documentación legacy/prohibida.

---

# 1. Decisiones de producto cerradas

## Producto

- Nombre comercial: `FlowDashboard`
- Product name en Windows: `FlowDashboard`
- Publisher mostrado: `FlowDashboard`
- Primera versión comercial unificada: `2.0.0`
- Plataforma inicial:
  - Windows 10 x64
  - Windows 11 x64
- No preparar inicialmente:
  - Windows x86
  - Windows ARM
  - macOS
  - Linux
  - Microsoft Store

## Producto vigente

El producto real es el que actualmente se inicia mediante:

```text
C:\DASHBOARD\FlowDashboard\abrir_electron.bat
```

No considerar producto vigente:

- `FlowDashboard.exe`
- `launcher.py`
- launcher PyInstaller antiguo
- `wsapi_demo.html`
- dashboard antiguo basado en navegador
- `updater.py` como actualizador definitivo
- `Crearexe.bat`
- `CrearActualizacion.bat`

Nunca se ha utilizado `FlowDashboard.exe` como producto real.

## Experiencia del cliente

El cliente debe:

1. Descargar un único archivo:
   `FlowDashboard-Setup-2.0.0.exe`
2. Ejecutarlo.
3. Abrir FlowDashboard desde el escritorio o menú Inicio.

El cliente no instalará manualmente:

- Python
- pip
- .NET
- Node.js
- npm
- Electron
- Java
- ADB
- scrcpy

## Instalación

- Instalador: Electron Builder + NSIS
- Instalación por usuario
- Un solo instalador `.exe`
- Acceso directo en escritorio
- Acceso directo en menú Inicio
- Sin inicio automático por defecto
- No exigir permisos de administrador para el uso normal
- Desinstalación conserva datos por defecto
- Opción separada para borrar datos del usuario

## Actualizaciones

- Buscar actualizaciones al iniciar.
- Descargar automáticamente en segundo plano.
- Mostrar progreso.
- Mostrar:
  - `Reiniciar ahora`
  - `Más tarde`
- No instalar mientras haya operaciones críticas.
- Cerrar ordenadamente backends antes de actualizar.
- Reiniciar la aplicación después de instalar.
- Mantener datos y configuración.
- Soportar canales:
  - `stable`
  - `beta`
- GitHub seguirá público inicialmente.
- Distribución mediante GitHub Releases.
- Repositorio podrá hacerse privado más adelante, pero no en esta fase.

## Panel administrativo

`license_admin.html`:

- no se incluye en el instalador del cliente;
- se usa únicamente desde el PC personal del propietario;
- se endurece igualmente mediante Supabase Auth, RLS y rol administrativo.

## FlowTrackName

- Solo existe `Herramientas\FlowTrackName.exe`.
- No existe código fuente.
- Se incluye en todos los planes.
- Se incluye en todas las builds comerciales.
- No se usa como elemento diferenciador de planes.
- Se valida por existencia y SHA-256.
- No intentar modificarlo ni insertar validación interna.

---

# 2. Reglas duras de no regresión

## Componentes protegidos

No modificar durante las fases comerciales, salvo que exista una incidencia demostrada y una fase independiente aprobada:

- `stream-renderer-h264.js`
- `scrcpy_raw_streamer.py`
- `scrcpy_raw_ws_server.py`
- `scrcpy_control_channel.py`
- protocolo FDH1
- WebCodecs
- parser H.264
- sesiones Grid
- sesiones Focus
- CoordinateMapper
- taps
- swipes
- drag/live touch
- Back/Home/Recents
- wake preflight
- presets Eco/Balanced/Pro
- control principal por scrcpy-control
- fallback ADB actual
- MediaProjection/OCR bajo demanda
- separación Control/Automation/Inspección

## Comportamiento que debe conservarse

- Grid y Focus funcionan con número variable de dispositivos.
- No asumir 16 o 17 teléfonos.
- No hardcodear IPs.
- No hardcodear rangos de red.
- Scrcpy-control sigue siendo motor principal.
- ADB input sigue siendo fallback.
- FlowAgent no se usa como fallback del control manual.
- Abrir Grid/Focus no activa Accessibility, MediaProjection ni OCR.
- FlowAgent solo se prepara para Automation.
- Pruebas funcionales siempre mediante `abrir_electron.bat`.

---

# 3. Arquitectura objetivo

## 3.1 Desarrollo

```text
abrir_electron.bat
  -> abrir_electron.ps1
  -> código Electron
  -> Python fuente
  -> C# mediante dotnet
  -> ADB/scrcpy empaquetado localmente
```

Este flujo se conserva durante la transición.

## 3.2 Producción

```text
FlowDashboard.exe
  -> RuntimeManager de Electron
      -> FlowDashboard.Backend.exe
      -> FlowDashboard.Core.exe
      -> adb.exe
      -> scrcpy 4.0
      -> FlowAgent APK
      -> FlowTrackName.exe
```

El cliente no ejecuta `.bat` ni PowerShell.

## 3.3 Estructura instalada

```text
%LOCALAPPDATA%\Programs\FlowDashboard\
├─ FlowDashboard.exe
├─ resources\
│  ├─ app.asar
│  ├─ runtime\
│  │  ├─ python\
│  │  │  ├─ FlowDashboard.Backend.exe
│  │  │  └─ _internal\
│  │  └─ dotnet\
│  │     ├─ FlowDashboard.Core.exe
│  │     └─ dependencias/runtime
│  ├─ vendor\
│  │  └─ scrcpy-win64-v4.0\
│  ├─ android\
│  │  └─ flowagent\
│  │     └─ agent-v1.0.0-arm64-v8a.apk
│  ├─ tools\
│  │  └─ FlowTrackName.exe
│  └─ scripts\
│     ├─ Login.js
│     └─ otros scripts vigentes
└─ Uninstall FlowDashboard.exe
```

## 3.4 Datos del usuario

```text
%APPDATA%\FlowDashboard\
├─ config\
├─ devices\
├─ license\
├─ mail\
├─ logs\
├─ recordings\
├─ cache\
├─ updates\
└─ backups\
```

Nunca guardar datos modificables dentro de la carpeta de instalación.

---

# 4. FASE 0 — Congelación, evidencia y punto de partida

## Objetivo

Obtener una base verificable antes de reorganizar, empaquetar o cambiar licencias.

## Tareas

1. Crear rama:
   `commercial/v2.0.0`
2. Crear tag:
   `pre-commercial-v2`
3. Crear restore point:
   `restore_points/YYYY-MM-DD_HHMM_PRE_COMMERCIAL_V2`
4. Guardar:
   - commit actual;
   - `git status`;
   - hashes de archivos críticos;
   - inventario de procesos;
   - puertos;
   - `/health`;
   - `/devices`;
   - `/agents`;
   - sesiones H.264.
5. Validar mediante `abrir_electron.bat`:
   - Electron único;
   - Python 8765;
   - H.264 8768;
   - C# 5000;
   - dispositivos;
   - Grid;
   - Focus;
   - tap;
   - swipe;
   - Back/Home/Recents.
6. Capturar estado visual y logs sanitizados.
7. No realizar cambios funcionales.

## Criterio de aceptación

Existe una referencia restaurable y se confirma que el producto funciona antes de la implementación.

## Rollback

Restaurar el restore point y volver al tag `pre-commercial-v2`.

---

# 5. FASE 1 — Clasificación canónica y archivo legacy

## Objetivo

Evitar que personas o IAs confundan componentes vigentes con experimentos o productos antiguos.

## Crear

```text
docs/current/
docs/commercial/
docs/architecture/
archive/legacy-dashboard/
archive/legacy-updater/
archive/legacy-sql/
archive/legacy-launchers/
archive/experiments/
scripts/dev/
scripts/build/
scripts/release/
scripts/diagnostics/
build/runtime/
build/staging/
```

## Documentos obligatorios

- `README.md`
- `CURRENT_ARCHITECTURE.md`
- `REPOSITORY_MAP.md`
- `DEVELOPMENT_START.md`
- `BUILD_AND_RELEASE.md`
- `SECURITY.md`
- `archive/LEGACY_INDEX.md`

## Marcar como legacy, sin borrar inmediatamente

- `FlowDashboard.exe`
- `launcher.py`
- `launcher.spec` antiguo
- `Crearexe.bat`
- `CrearActualizacion.bat`
- `updater.py`
- `wsapi_demo.html`
- `wsapi.js`
- launchers no usados
- SQL destructivos
- documentos `PASOS_*`, `LISTO_*`, `SOLUCION_*`, `PRUEBA_*`
- hotfix temporales
- spikes
- dumps
- scripts diagnósticos antiguos
- copias redundantes de `scrcpy-server` en raíz

## Regla

Antes de mover un archivo:

1. Buscar referencias en todo el repositorio.
2. Registrar consumidores.
3. Confirmar si se usa en runtime.
4. Añadirlo al `LEGACY_INDEX.md`.
5. Mantener shim temporal cuando una ruta vigente todavía dependa de él.
6. Validar `abrir_electron.bat`.

## Criterio de aceptación

Otra IA puede identificar en menos de cinco minutos:

- producto vigente;
- launcher correcto;
- backends;
- recursos;
- archivos legacy;
- documentación fuente de verdad.

---

# 6. FASE 2 — Versionado único 2.0.0

## Objetivo

Eliminar contradicciones entre `1.0.60`, `2.0.0` y versiones antiguas.

## Crear

`version.json`:

```json
{
  "version": "2.0.0",
  "channel": "stable",
  "publisher": "FlowDashboard",
  "productName": "FlowDashboard"
}
```

## Crear script

`scripts/release/sync-version.ps1`

Debe sincronizar:

- `electron-app/package.json`
- `app_meta.py`
- C#:
  - `Version`
  - `AssemblyVersion`
  - `FileVersion`
  - `InformationalVersion`
- nombre del instalador
- `/health` Python
- `/api/health` C#
- UpdateManager
- release notes
- manifests

## Regla

Ninguna versión debe editarse manualmente en varios archivos.

## Criterio de aceptación

Todos los componentes reportan exactamente `2.0.0`.

---

# 7. FASE 3 — Rutas, recursos y datos

## Objetivo

Hacer que el mismo código funcione en desarrollo y producción.

## Crear módulo compartido Electron

`electron-app/src/main/path-resolver.js`

Debe exponer:

- `isPackaged`
- `projectRoot`
- `resourceRoot`
- `runtimeRoot`
- `userDataRoot`
- `logsRoot`
- `recordingsRoot`
- `scriptsRoot`
- `scrcpyRoot`
- `flowAgentApk`
- `flowTrackNameExe`

## Reglas

### Desarrollo

Resolver desde el repositorio.

### Producción

Resolver desde:

- `process.resourcesPath`
- `app.getPath('userData')`

## Migración de datos

Mover progresivamente la persistencia a `%APPDATA%\FlowDashboard`.

Debe incluir migración idempotente desde las ubicaciones antiguas.

## Seguridad

1. No aceptar nombres arbitrarios de archivo desde renderer.
2. Crear allowlist:
   - `device_names.json`
   - `device_groups.json`
   - `device_inventory.json`
   - `device_mappings.json`
   - configuraciones aprobadas.
3. Rechazar:
   - rutas absolutas;
   - `..`;
   - separadores;
   - extensiones no permitidas.
4. Escrituras atómicas:
   - archivo temporal;
   - flush;
   - replace;
   - backup anterior.
5. No migrar secretos a texto plano.

## Criterio de aceptación

La build instalada puede actualizarse sin perder datos.

---

# 8. FASE 4 — RuntimeManager de Electron

## Objetivo

Eliminar la dependencia de PowerShell en producción.

## Crear

`electron-app/src/main/runtime-manager.js`

## Responsabilidades

1. Detectar desarrollo/producción.
2. Verificar recursos obligatorios.
3. Preparar entorno:
   - `FLOWDASHBOARD_RESOURCE_DIR`
   - `FLOWDASHBOARD_DATA_DIR`
   - `FLOWDASHBOARD_ADB`
   - `SCRCPY_PATH`
   - `SCRCPY_SERVER_JAR`
   - `FLOWDASHBOARD_PRODUCT_MODE=1`
4. Iniciar C#.
5. Iniciar Python.
6. Esperar health checks.
7. Detectar puertos ocupados.
8. Distinguir proceso propio de proceso extraño.
9. No matar procesos de terceros indiscriminadamente.
10. Reiniciar sidecar si falla inesperadamente, con límite y backoff.
11. Mantener logs separados.
12. Cerrar procesos ordenadamente al salir.
13. Preparar shutdown para actualizaciones.
14. Mostrar error entendible si falta un runtime.
15. Evitar ventanas de consola.

## Orden de arranque recomendado

1. Validar estructura.
2. Iniciar C#.
3. Iniciar Python.
4. Esperar `/api/health`.
5. Esperar `/health`.
6. Crear BrowserWindow.
7. Cargar UI.
8. Cargar dispositivos y streams.

## No hacer

- No iniciar FlowAgent.
- No instalar APK automáticamente por abrir la aplicación.
- No activar Accessibility.
- No iniciar MediaProjection.
- No modificar H.264.

## Criterio de aceptación

Una build empaquetada inicia todos los servicios sin `.bat`, Python instalado ni .NET instalado.

---

# 9. FASE 5 — Backend Python empaquetado

## Objetivo

Crear un sidecar autónomo.

## Estrategia

PyInstaller `onedir`.

## Crear

- `build_specs/FlowDashboard.Backend.spec`
- `scripts/build/build-python.ps1`

## Entrada

`local_adb_server.py`

## Incluir explícitamente

- `scrcpy_raw_streamer.py`
- `scrcpy_raw_ws_server.py`
- `scrcpy_control_channel.py`
- `scrcpy_manager.py`
- módulos internos importados dinámicamente
- dependencias de `requirements.txt`
- datos necesarios, nunca secretos
- scripts que el backend deba leer
- certificados CA si alguna dependencia los requiere

## Excluir

- `.supabase_config.json`
- service role
- CapSolver key
- mail passwords
- datos de dispositivos
- payloads
- logs
- grabaciones
- SQL
- admin panel
- código Android completo

## Ajustes necesarios

- `BASE_DIR`, `RESOURCE_DIR` y `DATA_DIR` deben funcionar bajo PyInstaller.
- Usar `sys._MEIPASS` solo donde proceda.
- Priorizar rutas entregadas por variables de entorno.
- `find_adb()` debe localizar únicamente ADB empaquetado en producción.
- En producción no ejecutar deep scan del disco buscando otros `adb.exe`.
- El modo local de licencia debe estar deshabilitado en product mode.
- No aceptar `SUPABASE_SERVICE_ROLE_KEY` dentro de cliente.
- El backend cliente usará únicamente clave pública/anon y RPC protegida por RLS.

## FlowMail helper

Auditar `FlowDashboard.Core/Services/flowmail_imap_helper.py`.

Solución inicial recomendada:

- empaquetarlo como `FlowDashboard.MailHelper.exe`;
- mantener contrato stdin/stdout;
- C# invoca el EXE;
- no depender de un `python.exe` genérico.

## Pruebas

- Build onedir.
- Arranque sin Python en PATH.
- `/health`.
- `/devices`.
- `/agents`.
- control canario.
- streaming canario.
- FlowMail helper.
- ruta con espacios.
- usuario Windows distinto.

## Criterio de aceptación

El backend funciona en una VM sin Python instalado.

---

# 10. FASE 6 — Backend C# self-contained

## Objetivo

Eliminar dependencia de .NET instalado.

## Publicación

```powershell
dotnet publish FlowDashboard.Core\FlowDashboard.Core.csproj `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -o build\runtime\dotnet
```

## No activar inicialmente

- trimming
- Native AOT
- single-file
- ReadyToRun

## Motivo

Primero preservar:

- MailKit
- SignalR
- DPAPI
- controladores
- servicios actuales
- helper FlowMail

## Ajustes

- Rutas de datos mediante `FLOWDASHBOARD_DATA_DIR`.
- No guardar `mail_config.json` junto al ejecutable.
- Mantener DPAPI.
- Logs en user data.
- Health debe reportar versión unificada.
- CORS limitado a la aplicación local.
- Escuchar solo en loopback.
- Evitar interfaces públicas.

## Pruebas

- VM sin runtime .NET.
- `/api/health`.
- dispositivos.
- endpoints realmente usados.
- FlowMail.
- SignalR si sigue activo.
- shutdown limpio.

## Criterio de aceptación

C# funciona en Windows limpio sin instalar .NET.

---

# 11. FASE 7 — Recursos comerciales

## scrcpy/ADB

Fuente canónica:

`scrcpy-win64-v4.0`

Incluir:

- `adb.exe`
- `AdbWinApi.dll`
- `AdbWinUsbApi.dll`
- `scrcpy.exe`
- `scrcpy-server.jar`
- DLL oficiales requeridas
- LICENSE/NOTICE

No incluir copias redundantes de raíz.

## FlowAgent

Artefacto canónico:

```text
flow_agent_monolito/app/build/outputs/apk/app/release/
agent-v1.0.0-arm64-v8a.apk
```

Versión esperada:

- versionName: `1.0.0`
- versionCode: `106`

No incluir:

- proyecto Gradle completo;
- caches;
- builds debug;
- APKs legacy;
- AutoJs6 standalone;
- ABIs no usadas sin decisión explícita.

La IA debe verificar si se requiere un APK universal para clientes con dispositivos no arm64. No asumir. Si el producto soporta solo arm64 inicialmente, documentarlo claramente.

## FlowTrackName

Incluir:

`Herramientas\FlowTrackName.exe`

Registrar:

- tamaño;
- SHA-256;
- prueba de arranque;
- ruta instalada.

## Licencias de terceros

Crear:

`THIRD_PARTY_NOTICES.txt`

Incluir avisos/licencias de:

- Electron
- Chromium
- Node
- scrcpy
- PyInstaller
- Python
- .NET
- MailKit/MimeKit
- otras dependencias distribuidas.

---

# 12. FASE 8 — Instalador Electron/NSIS

## Objetivo

Generar un instalador único para el cliente.

## Dependencias

- `electron-builder`
- `electron-updater`

## Configuración

Preferentemente mover la configuración a:

`electron-builder.config.js`

## Ajustes mínimos

```javascript
module.exports = {
  appId: 'com.flowdashboard.desktop',
  productName: 'FlowDashboard',
  artifactName: 'FlowDashboard-Setup-${version}.${ext}',
  asar: true,
  directories: {
    output: '../release_packages'
  },
  win: {
    target: ['nsis']
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'FlowDashboard'
  }
};
```

## `files`

Solo Electron vigente.

## `extraResources`

- Python onedir.
- C# self-contained.
- scrcpy/ADB.
- FlowAgent APK canónico.
- FlowTrackName.
- scripts vigentes.
- licencias de terceros.

## No incluir

- `.supabase_config.json`
- `license_admin.html`
- SQL
- datos de clientes
- logs
- recordings
- restore points
- source Android
- pruebas
- docs legacy
- tokens
- certificados privados
- GitHub token
- CapSolver key
- service role

## Instalación

- Per-user.
- Un clic.
- Accesos directos.
- Desinstalador.
- Conservar `%APPDATA%\FlowDashboard` por defecto.
- Opción separada para borrado completo.

## Criterio de aceptación

`FlowDashboard-Setup-2.0.0.exe` instala y ejecuta el producto en una VM limpia.

---

# 13. FASE 9 — Actualizaciones con electron-updater

## Objetivo

Reemplazar completamente el actualizador Python antiguo.

## Crear

- `electron-app/src/main/update-manager.js`
- IPC seguro para estado/progreso
- UI conectada al nuevo UpdateManager

## Provider

GitHub Releases del repositorio público actual.

## Flujo

1. `checkForUpdates()` después de iniciar.
2. No bloquear la UI mientras consulta.
3. Descargar automáticamente.
4. Mostrar:
   - versión actual;
   - versión disponible;
   - progreso;
   - notas.
5. Al completar:
   - `Reiniciar ahora`;
   - `Más tarde`.
6. Antes de instalar:
   - comprobar operaciones críticas;
   - detener automatizaciones;
   - finalizar grabaciones correctamente;
   - cerrar sidecars mediante RuntimeManager.
7. Ejecutar instalación.
8. Reiniciar.
9. Verificar versión y health.
10. Conservar datos.

## Estados

- idle
- checking
- available
- downloading
- downloaded
- deferred
- installing
- error

## Canales

### Stable

Versiones:

`2.0.0`, `2.0.1`, `2.1.0`

### Beta

Versiones:

`2.1.0-beta.1`

Solo los equipos configurados como beta aceptan prereleases.

## Releases

Artefactos esperados:

- `FlowDashboard-Setup-2.0.0.exe`
- `latest.yml`
- blockmap
- checksums
- release notes

## Reglas

- Releases draft no llegan a clientes.
- Publicar stable solo después de validar actualización N -> N+1.
- No usar el `update.json` antiguo.
- Archivar `updater.py`.
- El updater debe seguir disponible desde la pantalla de licencia.
- Preparar soporte a actualización obligatoria, pero no activarla por defecto.

## Firma

Preparar verificación Authenticode.

Antes del primer cliente externo:

- firmar ejecutable;
- firmar instalador;
- mantener `publisherName` consistente con `FlowDashboard`.

## Criterio de aceptación

Una instalación 2.0.0 detecta, descarga e instala 2.0.1 conservando todos los datos.

---

# 14. FASE 10 — Supabase y modelo comercial

## Estado encontrado

- RPC actual:
  `validate_flowdashboard_license` con 13 parámetros.
- Existe función legacy:
  `check_app_license`.
- RLS desactivado en:
  - `app_licenses`
  - `app_devices`
  - `app_device_registrations`
  - `app_access_logs`
- `authenticated` tiene permisos amplios.
- 3 licencias actuales son del propietario/pruebas.
- 25 PCs registrados.
- 5 registros legacy.
- 2 registros legacy tienen email distinto al titular.
- No hay clientes externos.
- No modificar registros discordantes automáticamente.

## Estrategia

Migraciones nuevas, numeradas e idempotentes.

```text
database/migrations/
001_preflight_and_backup.sql
002_admin_profiles.sql
003_plans_and_features.sql
004_license_assignments.sql
005_installations.sql
006_audit_events.sql
007_rls_and_grants.sql
008_validate_license_v2.sql
009_migrate_legacy.sql
010_retire_legacy_rpc.sql
```

## Tablas objetivo

- `admin_profiles`
- `plans`
- `plan_versions`
- `features`
- `plan_feature_entitlements`
- `license_plan_assignments`
- `license_overrides`
- `license_installations`
- `audit_events`
- tablas de pagos manuales o campos equivalentes

## Planes

Crear inicialmente:

- `Legacy Full Access`
- `Starter`
- `Growth`
- `Enterprise`

`Legacy Full Access`:

- interno;
- no vendible;
- todas las funciones actuales;
- asignado a las 3 licencias existentes.

## Límites

Separar:

- `max_pc_installations`
- `max_android_devices`
- `max_concurrent_android_devices`

Permitir valor ilimitado de forma explícita y consistente.

## Validación

Obligatorio:

- email coincidente;
- clave coincidente;
- licencia activa;
- fechas;
- gracia;
- instalación;
- plan;
- versión de plan;
- overrides.

## Instalaciones

- Autoaprobar nuevos PCs hasta el límite.
- `Desvincular` libera cupo y conserva historia.
- `Bloquear` impide volver a registrar.
- `Revocar` invalida la instalación.
- No eliminar historial.

## Tiempo

- offline grace: 72 horas desde última validación exitosa;
- expiration grace: 48 horas después de `expires_at`;
- ambas configurables administrativamente;
- usar tiempos de servidor;
- proteger contra retroceso del reloj local.

## Pagos manuales

Campos/entidades:

- status;
- método;
- referencia;
- notas;
- fecha de verificación;
- administrador;
- renovación;
- duración;
- evidencia opcional sin guardar datos sensibles innecesarios.

## RLS

1. Activar RLS.
2. Crear `is_admin()`.
3. Restringir CRUD administrativo.
4. Cliente solo ejecuta RPC autorizada.
5. No conceder acceso directo a tablas sensibles.
6. No distribuir service role.
7. Retirar grants innecesarios.
8. Retirar `check_app_license` solo cuando se demuestre que no tiene consumidores.
9. Seguridad definida mediante migración reversible.

## Criterio de aceptación

Un cliente con anon key no puede leer ni modificar licencias directamente, pero puede validar mediante RPC.

---

# 15. FASE 11 — Panel administrativo

## Objetivo

Convertir `license_admin.html` en panel seguro y funcional para el propietario.

## Restricción

No se distribuye a clientes.

## Autenticación

- Supabase Auth.
- Registros públicos desactivados.
- Un administrador actual.
- Comprobar `admin_profiles`.
- El frontend nunca es la única barrera.

## Plan Studio

Permitir:

- crear;
- duplicar;
- versionar;
- publicar;
- archivar;
- nombre;
- descripción;
- precio informativo;
- periodicidad;
- enlace de pago;
- límites;
- funciones;
- preview.

## Licencias

Permitir:

- crear;
- activar;
- suspender;
- revocar;
- renovar;
- cambiar plan;
- cambiar límites;
- gracia personalizada;
- notas de pago;
- historial.

## PCs

Permitir:

- ver;
- renombrar;
- desvincular;
- bloquear;
- revocar;
- última conexión;
- versión de app;
- auditoría.

## Seguridad

- No fallback automático a anon después de 401.
- No almacenar sesión completa insegura en localStorage si existe alternativa.
- Generar claves mediante Web Crypto, no `Math.random()`.
- No hard delete de licencias usadas.
- No borrar logs de auditoría.
- Todas las acciones críticas pasan por RPC transaccional.
- Confirmaciones reforzadas.
- Registro de actor, fecha, motivo y valores anteriores/nuevos.

---

# 16. FASE 12 — Entitlements en FlowDashboard

## Objetivo

Aplicar permisos reales sin dañar funcionalidades.

## Matriz inicial

- `core.dashboard`
- `devices.grid`
- `devices.focus`
- `control.touch`
- `control.keyboard`
- `flowlogin.execute`
- `flowregister.execute`
- `adb.presets`
- `adb.shell`
- `adb.bulk`
- `files.push`
- `apps.manage`
- `flowagent.install`
- `autojs.execute`
- `flowkeyboard.use`
- `inspector.tree`
- `inspector.native`
- `inspector.accessibility`
- `inspector.web`
- `inspector.ocr`
- `inspector.hybrid`
- `recording.video`
- `actions.replicate`
- `power.reboot`
- `power.shutdown`

No incluir FlowTrackName como diferencia de plan.

## Implementación progresiva

### Paso A — Observe only

- Resolver entitlements.
- Registrar qué decisiones se tomarían.
- No bloquear.

### Paso B — UI

- Ocultar/deshabilitar controles.
- Mensajes comerciales claros.

### Paso C — IPC

- Comprobar permisos en proceso principal Electron.

### Paso D — Backend

- Python y C# rechazan endpoints no autorizados.
- No confiar en el renderer.

### Paso E — Enforce

- Activar enforcement después de pruebas.

## Caché offline

- Guardar entitlement firmado/cifrado.
- Usar almacenamiento protegido por Windows/Electron.
- No confiar en localStorage.
- Incluir:
  - license id;
  - plan version;
  - features;
  - límites;
  - issued_at;
  - valid_until;
  - installation id;
  - firma.
- Máximo offline: 72 horas.

## Vencimiento

Después de 48 horas de gracia:

- bloqueo completo controlado;
- no cargar Grid/Focus/streams;
- no iniciar operaciones comerciales;
- permitir:
  - pantalla de licencia;
  - volver a validar;
  - buscar actualización;
  - contacto;
  - cerrar.
- no borrar datos.

## Criterio de aceptación

Manipular la UI no permite ejecutar una función no autorizada.

---

# 17. FASE 13 — GESTOR_FLOWDASHBOARD.bat

## Objetivo

Que el propietario gestione desarrollo, builds y releases desde una sola entrada.

## Crear

`GESTOR_FLOWDASHBOARD.bat`

Debe llamar a PowerShell, sin contener toda la lógica.

## Menú

```text
1. Abrir Dashboard en desarrollo
2. Validar proyecto
3. Crear build comercial local
4. Crear versión Beta
5. Crear versión Stable
6. Publicar release preparada
7. Restaurar versión
8. Ver diagnósticos
9. Salir
```

## Orquestador

`scripts/release/release.ps1`

## Preflight

- raíz correcta;
- rama;
- estado Git;
- herramientas;
- Node/npm;
- Python de build;
- PyInstaller;
- .NET SDK;
- Git;
- GitHub CLI;
- espacio;
- recursos canónicos;
- FlowAgent;
- FlowTrackName;
- ADB;
- scrcpy;
- versiones;
- secretos;
- tests.

## Version bump

Opciones:

- patch;
- minor;
- major;
- beta.

## Restore point automático

Antes de modificar versión o build.

## Build pipeline

1. Preflight.
2. Restore point.
3. Version bump.
4. Sync version.
5. Tests estáticos.
6. Build Python.
7. Build MailHelper.
8. Publish C#.
9. Prepare resources.
10. Build Electron unpacked.
11. Smoke tests.
12. Build NSIS.
13. Secret scan.
14. Hashes.
15. Release notes.
16. Tag.
17. GitHub draft release.
18. Aprobación manual.
19. Publicar.

## Fallos

- `ErrorActionPreference = Stop`.
- Ninguna fase posterior si falla una anterior.
- No incrementar versión definitivamente si build falla.
- Rollback del version bump.
- No publicar assets parciales.
- Logs de release sanitizados.
- Resumen final.

## Publicación

Usar GitHub CLI.

Crear primero release draft.

Solo publicar después de aprobación explícita.

## Criterio de aceptación

El propietario puede preparar una release sin ejecutar comandos manuales separados.

---

# 18. FASE 14 — Seguridad de distribución

## Secretos

Prohibido incluir:

- service role;
- CapSolver key compartida;
- GitHub token;
- certificado;
- password de certificado;
- app password de email;
- datos de clientes;
- `.supabase_config.json`.

## Configuración pública

Separar:

`config/public/supabase.json`

Solo:

- URL pública;
- anon/publishable key cuando RLS esté corregido.

## CapSolver

No distribuir la clave del propietario.

Opciones futuras:

- clave por cliente;
- proxy/backend propio.

## Escaneo

Antes de cada release:

- patrones conocidos;
- entropía;
- JWT service_role;
- PEM;
- PFX;
- passwords;
- tokens GitHub;
- claves CapSolver;
- archivos prohibidos.

## CSP

Auditar y reducir:

- `unsafe-eval`
- `unsafe-inline`
- CDN innecesarios

No romper UI; hacerlo en fase separada con pruebas.

## Logs

- rotación;
- tamaño máximo;
- número máximo;
- compresión;
- sanitización;
- no registrar tokens;
- no registrar claves;
- no registrar contraseñas;
- exportación diagnóstica controlada.

## Firma

Preparar pipeline:

- firma de executables;
- firma NSIS;
- timestamp;
- verificación antes de publicar.

Build interna puede ser unsigned.
Build comercial externa debe ser signed.

---

# 19. FASE 15 — Pruebas y matriz de aceptación

## Entornos

1. PC de desarrollo.
2. VM Windows 10 x64 limpia.
3. VM Windows 11 x64 limpia.
4. PC canario real.
5. Al menos un dispositivo USB.
6. Varios dispositivos Wi-Fi.
7. Dispositivo unauthorized.
8. Sin Internet.
9. Supabase temporalmente no disponible.

## Instalación

- instalación limpia;
- reinstalación;
- reparación;
- actualización;
- desinstalación;
- conservar datos;
- borrar datos opcional;
- rutas con espacios;
- usuario sin admin.

## Runtime

- sin Python;
- sin .NET;
- sin Node;
- ADB incluido;
- scrcpy incluido;
- health;
- shutdown;
- reinicio;
- crash recovery;
- puerto ocupado.

## Dashboard

- Grid;
- Focus;
- reconexión;
- pantalla negra;
- reinicio de dispositivos;
- estabilidad de posiciones;
- taps;
- swipes;
- control físico;
- teclado;
- grabación;
- Apps;
- Files;
- ADB;
- Inspector;
- OCR bajo selección;
- FlowLogin;
- FlowKeyboard;
- FlowMail;
- FlowTrackName.

## Licencias

- válida;
- email incorrecto;
- clave incorrecta;
- pendiente;
- suspendida;
- revocada;
- vencida;
- gracia 48h;
- offline 72h;
- reloj cambiado;
- límite de PCs;
- desvinculación;
- bloqueo;
- plan legacy;
- cambio de plan;
- override.

## Actualización

- stable N -> N+1;
- beta;
- descarga interrumpida;
- hash/firma incorrecta;
- release draft;
- release publicada;
- `Más tarde`;
- `Reiniciar ahora`;
- operación crítica activa;
- actualización con licencia vencida;
- datos preservados;
- rollback documentado.

## Criterio de salida

No entregar a cliente mientras exista un fallo crítico en:

- instalación;
- arranque;
- licencia;
- actualización;
- Grid/Focus;
- control;
- preservación de datos;
- secretos.

---

# 20. Estrategia de rollout

## Etapa A — Solo propietario

- 3 licencias actuales.
- Legacy Full Access.
- Builds beta.
- VMs.
- PCs propios.

## Etapa B — Piloto controlado

- instalación firmada;
- pocos clientes;
- activación manual;
- soporte directo;
- telemetría mínima y respetuosa;
- rollback preparado.

## Etapa C — Comercial

- canal stable;
- documentación;
- firma;
- soporte;
- política de privacidad;
- términos;
- proceso de renovación;
- backups;
- monitoreo de Supabase.

---

# 21. Entregables obligatorios de la IA implementadora

## Código

- RuntimeManager.
- PathResolver.
- UpdateManager.
- PyInstaller specs.
- scripts de build.
- publicación C#.
- electron-builder config.
- GESTOR_FLOWDASHBOARD.bat.
- release.ps1.
- sync-version.ps1.
- secret scanner.
- smoke tests.
- migraciones Supabase.
- entitlement service.
- panel administrativo actualizado.

## Documentación

- arquitectura vigente;
- mapa del repositorio;
- desarrollo;
- build;
- release;
- actualización;
- seguridad;
- rollback;
- Supabase;
- licencias;
- pruebas;
- third-party notices;
- legacy index.

## Artefactos

- build unpacked;
- instalador 2.0.0;
- latest.yml;
- blockmap;
- checksums;
- notas de versión;
- informe de pruebas;
- informe de secretos;
- manifiesto de contenido.

---

# 22. Condiciones para considerar el proyecto listo

FlowDashboard 2.0.0 estará listo cuando:

1. Un Windows 10/11 x64 limpio instala con un único EXE.
2. No requiere Python, .NET, Node, Java, ADB ni scrcpy externos.
3. Electron inicia y detiene todos los sidecars.
4. Grid, Focus y control conservan el funcionamiento actual.
5. Los datos viven fuera de la instalación.
6. Una actualización 2.0.0 -> 2.0.1 funciona.
7. No se distribuyen secretos.
8. RLS protege Supabase.
9. La licencia funciona online/offline según las reglas.
10. El bloqueo por vencimiento no borra datos.
11. El panel admin no está en el cliente.
12. El propietario crea una release desde un único gestor.
13. Existe rollback.
14. Existe documentación actualizada.
15. Los componentes legacy están separados y etiquetados.
16. La build externa está firmada antes del primer cliente.

---

# 23. Orden estricto recomendado

No saltar directamente a Plan Studio o al instalador final.

Orden:

1. Fase 0: baseline.
2. Fase 1: canon/legacy.
3. Fase 2: versión.
4. Fase 3: rutas/datos.
5. Fase 4: RuntimeManager.
6. Fase 5: Python.
7. Fase 6: C#.
8. Fase 7: recursos.
9. Fase 8: instalador.
10. Fase 9: updater.
11. Fase 10: Supabase.
12. Fase 11: admin.
13. Fase 12: entitlements.
14. Fase 13: gestor release.
15. Fase 14: seguridad.
16. Fase 15: validación.
17. Rollout.

Cada fase debe mantener funcional el launcher de desarrollo y debe terminar con evidencia verificable.
