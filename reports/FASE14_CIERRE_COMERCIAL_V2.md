# FASE 14 - Cierre comercial V2: Seguridad de distribucion

Fecha: 2026-06-27
Rama: commercial/v2.0.0
Punto de restauracion: restore_points/2026-06-27_PRE_FASE14_SEGURIDAD (HEAD 824db4ee)

## 1. Objetivo
Endurecer la seguridad de cara a la distribucion comercial: garantizar que no se filtren secretos, separar configuracion publica de la secreta, reducir superficie del CSP sin romper la UI, preparar la firma de artefactos y aplicar rotacion/sanitizacion de logs.

## 2. Alcance
- Correccion de regla .gitignore que ocultaba scripts/release.
- CSP del renderer: retirar CDN no usado.
- Configuracion publica de Supabase (archivo nuevo rastreado).
- Escaner de secretos robusto e integracion en el pipeline de release.
- Pipeline de firma de artefactos (preparado, con gating por certificado).
- Rotacion y sanitizacion del log de consola de Electron.
Sin tocar componentes protegidos (video, touch, scrcpy, protocolo FDH1, sesiones Grid/Focus, etc.).

## 3. Estado inicial
- .gitignore linea 56 `release/` (sin anclar) ocultaba `scripts/release/` -> release.ps1 y gestor.ps1 no se habian commiteado en FASE 13.
- CSP en electron-app/src/renderer/index.html:6 incluia `https://cdn.jsdelivr.net` en script-src.
- SignalR se carga localmente (index.html:10 desde node_modules); canvasStreaming.js (que referencia jsdelivr en :64) NO se carga en index.html (codigo no usado).
- No existia config/ ni scripts/security/.
- CAPSOLVER_API_KEY no esta hardcodeada: se lee en runtime de config gitignored (local_adb_server.py:870,880,893).
- Log de consola Electron (index.js:64-71) creaba electron-console.log con createWriteStream en modo append, sin rotacion ni sanitizacion.

## 4. Cambios realizados
1. `.gitignore`: `release/` -> `/release/` (anclado a raiz). Verificado: scripts/release/*.ps1 ya NO se ignoran; release/ en raiz sigue ignorado.
2. `electron-app/src/renderer/index.html:6`: retirado `https://cdn.jsdelivr.net` de script-src (verificado que la UI activa no lo usa).
3. `config/public/supabase.json` (NUEVO, rastreado): URL publica + anonKey vacia (pendiente de RLS). Sin secretos.
4. `scripts/security/scan-secrets.ps1` (NUEVO): escaner por patrones (JWT, PEM, certificado, tokens GitHub, CapSolver, conexion PG con password, asignaciones password/secret/api_key), archivos/extensiones prohibidos (.supabase_config.json, .supabase_db_url, mail_config.json, update_config.json, .pfx/.pem/.p12/.key/.keystore...). Scope tracked/staged/all. Codigo de salida 1 si hay bloqueantes.
5. `scripts/security/sign-artifacts.ps1` (NUEVO): firma de instalador/exe/dll con signtool (SHA256 + timestamp + verify). Gating por FLOWDASHBOARD_CODESIGN_PFX/_PASSWORD; si no hay certificado, build interna sin firmar (exit 0). Localiza signtool via Get-Command o Windows Kits.
6. `scripts/release/release.ps1`: Step-SecretScan ahora invoca scan-secrets.ps1 (scope tracked) ademas del escaneo de release_packages; nueva funcion Step-Sign integrada en Invoke-FullPipeline tras Step-BuildInstaller y antes de Step-Hashes.
7. `electron-app/src/main/log-manager.js` (NUEVO): createConsoleLog (rotacion por tamano 5MB, max 5 ficheros) + sanitize (redaccion de JWT, tokens GitHub, CapSolver, conexiones PG, password/secret/api_key). Sin comentarios de codigo.
8. `electron-app/src/main/index.js`: require de log-manager; sustituido createWriteStream directo por createConsoleLog; logStream.write -> appLog.write (lineas ~64-79).

## 5. Verificacion en runtime
- PSParser: release.ps1, scan-secrets.ps1, sign-artifacts.ps1 -> OK.
- `release.ps1 -Action validate`: preflight completo OK (gh WARN correcto, no instalado), 4 node --check + 3 py_compile OK.
- `sign-artifacts.ps1` sin certificado -> mensaje informativo y exit 0 (build interna sin firmar permitida).
- `scan-secrets.ps1 -Scope tracked` -> 1027 archivos analizados, 2 hallazgos BLOCK (ver seccion 7), exit 1 (comportamiento correcto del escaner).
- `node --check` index.js y log-manager.js -> OK. get_diagnostics ambos -> 0.
- Sanitizacion probada: JWT/ghp_/password=/postgresql:// se redactan correctamente.

## 6. Pruebas con dispositivos
No aplica a esta fase (cambios de seguridad/build/logging). El pipeline de video/touch/scrcpy no se modifico. La validacion con dispositivos se mantiene para la fase de empaquetado e2e.

## 7. Hallazgos y correcciones
- HALLAZGO (gitignore): regla `release/` ocultaba scripts/release. CORREGIDO (anclado a `/release/`). El usuario debe forzar el alta de release.ps1 y gestor.ps1 (FASE 13) con `git add -f` (ver bloque de commit).
- HALLAZGO (CSP): jsdelivr en CSP no usado por la UI. CORREGIDO (retirado).
- HALLAZGO escaner #1: `license_admin.html:528` contiene un JWT. Verificado: es la ANON key (role=anon), publica por diseno, NO service_role. license_admin.html es herramienta de administracion standalone, NO se distribuye en la app Electron. Riesgo bajo. Recomendacion futura: mover la anon key a config publica cuando RLS este verificado.
- HALLAZGO escaner #2: `flow_agent_apk/flowagent-debug.keystore` rastreado. Es keystore de DEBUG de Android (password por defecto), no de firma de release. Riesgo bajo. Recomendacion: anadir a .gitignore y `git rm --cached` si se confirma que no es necesario para el build del agente (decision del propietario; no se toca el build del agente en esta fase).
- No se hardcodeo ninguna IP, conteo de dispositivos, serial, ruta ni secreto.

## 8. Componentes protegidos
No se modificaron: stream-renderer-h264.js, flow-touch.js, scrcpy_raw_streamer.py, scrcpy_raw_ws_server.py, scrcpy_control_channel.py, protocolo FDH1, parser H.264, WebCodecs, sesiones Grid/Focus, CoordinateMapper, taps/swipes/drag/live touch, Back/Home/Recents, presets, scrcpy-control, fallback ADB, pipeline de video, scrcpy-win64-v4.0/.

## 9. Coherencia codigo-runtime-documentacion
- CSP documentado: reduccion de unsafe-eval/unsafe-inline se DIFIERE a fase separada con pruebas (segun plan). Solo se retiro el CDN no usado, cambio de riesgo cero.
- config/public/supabase.json refleja la URL publica real del proyecto qcwvfeqyczkhmkhqicqi.
- Escaner y firma integrados en release.ps1 de forma coherente con el pipeline existente.

## 10. Riesgos y mitigaciones
- Riesgo: anon key en license_admin.html. Mitigacion: es publica por diseno; pendiente verificar RLS. Documentado.
- Riesgo: build comercial externa sin firmar. Mitigacion: Step-Sign con -RequireSigning disponible; definir FLOWDASHBOARD_CODESIGN_PFX/_PASSWORD antes de publicar externamente.
- Riesgo: sanitizacion de logs por regex puede no cubrir todos los formatos. Mitigacion: cubre los secretos conocidos del proyecto; rotacion limita exposicion historica.

## 11. Rollback
- restore_points/2026-06-27_PRE_FASE14_SEGURIDAD contiene index.html.bak, index.js.bak, release.ps1.bak y HEAD.txt (824db4ee).
- Archivos nuevos (config/public/supabase.json, scripts/security/*.ps1, log-manager.js): eliminar para revertir.
- .gitignore: revertir `/release/` a `release/` si se requiere (no recomendado).

## 12. Evidencias
- bash 306-307: gitignore corregido y verificado (git check-ignore).
- bash 308-310: jsdelivr solo en canvasStreaming.js (no cargado); index.html carga SignalR local.
- bash 315-316: escaner ejecutado (1027 archivos, 2 BLOCK).
- bash 318: PSParser OK x3.
- bash 319: sign sin cert exit 0; validate OK.
- bash 320-321: node --check OK; sanitizacion verificada.
- get_diagnostics: index.js y log-manager.js -> 0.

## 13. Configuracion y secretos
- Secretos locales gitignored intactos: .supabase_config.json, .supabase_db_url, mail_config.json.
- Nuevo archivo publico no secreto: config/public/supabase.json (anonKey vacia).
- Variables de entorno para firma: FLOWDASHBOARD_CODESIGN_PFX, FLOWDASHBOARD_CODESIGN_PASSWORD (no se almacenan en repo).
- CAPSOLVER_API_KEY: se mantiene en config local gitignored, no en codigo.

## 14. Checklist
- [x] .gitignore corregido (scripts/release recuperable)
- [x] CSP sin CDN no usado
- [x] config/public/supabase.json sin secretos
- [x] Escaner de secretos funcional e integrado
- [x] Pipeline de firma preparado con gating
- [x] Rotacion + sanitizacion de logs
- [x] Sin modificar componentes protegidos
- [x] Sin comentarios en archivos de codigo nuevos
- [x] Sintaxis verificada (PSParser, node --check, get_diagnostics)
- [ ] Alta forzada de release.ps1/gestor.ps1 (la ejecuta el usuario)

## 15. Conclusion y siguiente fase
FASE 14 completada: seguridad de distribucion endurecida sin romper la UI ni los componentes protegidos. Hallazgos del escaner documentados (anon key y keystore debug, ambos de bajo riesgo). Quedan como acciones del propietario: definir el certificado de firma para releases externas y decidir sobre el keystore debug y la anon key del admin. Siguiente: FASE 15.
