# Handoff Comercial - FlowDashboard 2.0.0

Documento maestro de entrega. Refleja el estado real del proyecto tras la
ejecucion y verificacion de las FASES 0 a 15 del plan comercial. Sustituye a
cualquier handoff anterior. La fuente de verdad del codigo es el repositorio en
la rama `commercial/v2.0.0`.

## 1. Resumen ejecutivo

FlowDashboard 2.0.0 es una aplicacion de escritorio (Electron) para control y
visualizacion en vivo de multiples dispositivos Android mediante scrcpy, con un
backend doble (servicio C# y servidor Python) y un modelo comercial de licencias
y planes gestionado en Supabase.

- Estado: FASES 0-15 ejecutadas y verificadas. Empaquetado y release operativos.
- Version actual: 2.0.0, canal stable (ver `version.json`).
- Rama de trabajo: `commercial/v2.0.0`.
- Punto de entrada unico para operacion y release: `GESTOR_FLOWDASHBOARD.bat`.
- Punto de entrada unico para desarrollo: `abrir_electron.bat`.

## 2. Arquitectura (vista general)

Tres procesos cooperan en tiempo de ejecucion:

1. Electron (main + renderer): UI, sesiones de cuadricula/foco, control tactil,
   pipeline de video H.264/WebCodecs, gestion de licencia y actualizaciones.
2. Servicio C# (.NET 8): API local en el puerto 5000 (`/api/health`).
3. Servidor Python: API local en el puerto 8765 (`/health`, `/devices`,
   `/agents`) y canales de streaming/control de scrcpy.

Puertos de runtime: C# 5000, Python 8765, FlowAgent 8766, WebSocket WebP 8767,
WebSocket H.264 raw 8768, ADB 5037.

Documentos de detalle (ya existentes en el repo):
- `CURRENT_ARCHITECTURE.md` - arquitectura vigente.
- `REPOSITORY_MAP.md` - mapa del repositorio.
- `docs/master_technical_specification.md` - especificacion tecnica.

Nota: `Eliminar/DOCUMENTACION_TECNICA.md` esta descartado y NO debe usarse como
fuente.

## 3. Componentes protegidos (no modificar)

El nucleo de streaming y control esta verificado y congelado. No se debe alterar:
stream-renderer-h264.js, flow-touch.js, scrcpy_raw_streamer.py,
scrcpy_raw_ws_server.py, scrcpy_control_channel.py, protocolo FDH1, parser H.264,
WebCodecs, sesiones Grid/Focus, CoordinateMapper, taps/swipes/drag/touch en vivo,
botones Back/Home/Recents, presets, scrcpy-control, fallback ADB, pipeline de
video y el directorio `scrcpy-win64-v4.0/`.

## 4. Modelo comercial y licencias (Supabase)

Proyecto Supabase: `qcwvfeqyczkhmkhqicqi` (PostgreSQL 17.6).
URL publica: `https://qcwvfeqyczkhmkhqicqi.supabase.co`
(definida en `config/public/supabase.json`; la `anonKey` se completa cuando se
verifique RLS).

Esquema vigente:
- `features` (30) y `plan_feature_entitlements` (30, todas en LEGACY_FULL).
- `plans` (4): LEGACY_FULL (interno, activo, v1); STARTER, GROWTH, ENTERPRISE
  (borrador, limites NULL, grace 72/48).
- `app_licenses`, `app_devices`.
- RPC `validate_flowdashboard_license`: 13 parametros texto, `schema_version=2`.
  Devuelve status, reason_code, plan, limits, grace, features[] y
  license_overrides.

Migraciones aplicadas hasta 007 (modelo 10A+10B, panel comercial, RPC v2,
entitlements por plan).

Pendiente de negocio (no bloquea la entrega tecnica):
- Definir y activar limites de los planes STARTER/GROWTH/ENTERPRISE.
- Verificar politicas RLS y completar `anonKey` publica en `config/public/supabase.json`.

## 5. Aplicacion de entitlements (5 capas)

El control de funcionalidades por plan se aplica en cinco capas: Python, C#,
Electron main, Electron renderer y cache offline firmada (HMAC). El enforcement
es desactivable por flag y por defecto opera en modo fail-open (si la validacion
no es concluyente, no se bloquea al usuario). Bloqueo por vencimiento con periodo
de gracia segun el plan. Migracion 007 incluida.

## 6. Actualizaciones

Gestionadas por `electron-app/src/main/update-manager.js`. Canales beta y stable.
El flujo de publicacion genera el instalador, los hashes y un draft de release en
GitHub. Detalle en `BUILD_AND_RELEASE.md`.

## 7. Seguridad de distribucion (FASE 14)

- CSP del renderer sin CDNs externas (`electron-app/src/renderer/index.html`);
  SignalR se carga desde `node_modules` local.
- Escaner de secretos: `scripts/security/scan-secrets.ps1`
  (parametros -Path, -Scope, -IncludeDocs, -MaxFileSizeKB, -Quiet; sale con
  codigo 1 ante hallazgos bloqueantes). Integrado en `release.ps1`.
- Firma de artefactos: `scripts/security/sign-artifacts.ps1` (signtool; usa
  variables de entorno FLOWDASHBOARD_CODESIGN_PFX y FLOWDASHBOARD_CODESIGN_PASSWORD).
  Sin certificado, omite la firma de forma controlada.
- Logs con rotacion y sanitizacion: `electron-app/src/main/log-manager.js`
  (rotacion 5MB x 5 archivos; redacta JWT, tokens, conexiones con contrasena).

Hallazgos conocidos (riesgo bajo, decision del propietario):
1. `license_admin.html` contiene la clave anon de Supabase (publica por diseno,
   role=anon, no service_role). Herramienta de administracion independiente, no
   se distribuye dentro de la app Electron. Recomendado moverla a config tras RLS.
2. `flow_agent_apk/flowagent-debug.keystore` es un keystore de depuracion Android
   con contrasena por defecto. Recomendado excluir de git (`git rm --cached`).

## 8. Empaquetado y release

Punto de entrada: `GESTOR_FLOWDASHBOARD.bat` (menu). Internamente orquesta
`scripts/release/release.ps1`. Pasos manuales equivalentes para un build local:
1. `scripts/build/build-python.ps1 -Clean`
2. `scripts/build/build-dotnet.ps1 -Clean`
3. `scripts/build/prepare-commercial-resources.ps1`
4. `scripts/build/build-electron-installer.ps1 -Clean`

Instalador resultante: `FlowDashboard-Setup-2.0.0.exe`.
Detalle completo en `BUILD_AND_RELEASE.md` y en la guia no tecnica
(`GUIA_USO_NO_TECNICA.md`).

## 9. Puntos de restauracion

Cada fase con cambios de codigo genero un punto de restauracion en
`restore_points/` (excluido de git). Se restauran desde el gestor (opcion 7) o
con `release.ps1 -Action restore -RestorePoint <nombre>`.

## 10. Verificacion y matriz de aceptacion (FASE 15)

`reports/FASE15_MATRIZ_ACEPTACION.md` contiene la matriz completa: instalacion,
runtime, dashboard, licencias, actualizacion y seguridad, mas la porcion
automatizable (verificada). Los casos de VM y de dispositivos quedan marcados
como pendientes para ejecucion del operador. Cada fase tiene su informe de cierre
en `reports/FASE{n}_CIERRE_COMERCIAL_V2.md`.

## 11. Pendientes abiertos (no bloqueantes)

- Certificado de firma de codigo (configurar variables de entorno y ejecutar
  release con firma).
- Politicas RLS de Supabase y `anonKey` publica en config.
- Limites comerciales de planes STARTER/GROWTH/ENTERPRISE.
- Decision sobre el keystore de depuracion Android en git.
- Ejecucion de los casos de aceptacion de VM/dispositivos de FASE 15.

## 12. Indice de documentacion

- `HANDOFF_COMERCIAL_V2.0.0.md` (este documento).
- `GUIA_USO_NO_TECNICA.md` - guia paso a paso para usuario no tecnico.
- `CURRENT_ARCHITECTURE.md`, `REPOSITORY_MAP.md`,
  `docs/master_technical_specification.md` - tecnica.
- `BUILD_AND_RELEASE.md` - build y release.
- `SECURITY.md` - seguridad.
- `docs/commercial/THIRD_PARTY_NOTICES.txt` - terceros.
- `reports/FASE0..15_*` - informes de cierre y matriz de aceptacion.
- `PLAN_MAESTRO_IMPLEMENTACION_COMERCIAL_FLOWDASHBOARD_2.0.0.md` - plan maestro.
