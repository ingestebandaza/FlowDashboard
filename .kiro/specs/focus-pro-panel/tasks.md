# Focus PRO Panel - Tasks

Fecha: 2026-05-26
Estado general: Fases 0/1/2/3/4/5/6/7/8/9/10 implementadas y validadas. Falta Fase 11 (cierre).
Punto de restauracion previo: `restore_points/PuntoAntesPanelPro`

## Fase 0 - Preparacion

- [x] Crear punto de restauracion `PuntoAntesPanelPro` con copia de `flow-touch.js`, `stream-renderer.js`, `styles.css`, `app.js`, `local_adb_server.py` y `PROJECT_CONTEXT.md`.
- [x] Documentar requirements en `requirements.md`.
- [x] Documentar arquitectura en `design.md`.
- [x] Confirmar reglas: no romper FlowLogin / FlowRegister / Inspector / streaming, no tocar APK, no fallback ADB para gestos.

## Fase 1 - Layout base, switch ON automatico, Back/Home/Recents PRO

- [x] Refactor del HTML del quickbar a estructura `focus-pro-panel` con secciones (Control, Navegacion, FlowKeyboard como acordeon).
- [x] CSS aislado `focus-pro-panel` con paleta por seccion, animaciones acordeon, switch toggle.
- [x] Switch de control reemplaza el boton `Activar control`.
- [x] ON automatico en `openFocus(serial)` cuando `accessibility=true`. Debounce inicial 350 ms para ignorar el primer click.
- [x] Auto-disarm de Fase 9 sigue activo (intacto).
- [x] Botones Back / Home / Recents con icono SVG inline antes del nombre.
- [x] `node --check` OK en `flow-touch.js`.

## Fase 2 - Apps instaladas (lectura)

- [x] Backend `POST /apps/list` con flag `thirdPartyOnly`.
- [x] UI: lista con busqueda inline, copiar nombre de paquete, abrir, force-stop.
- [x] No destructivos en esta fase.
- [x] Verificacion en `192.168.1.43`: 18 apps listadas, launch+force-stop sobre `com.android.settings` OK.

## Fase 3 - Apps destructivas con confirmacion

- [x] Backend `POST /apps/clear-cache`, `/apps/uninstall`.
- [x] Backend `POST /apps/install` multipart.
- [x] UI con confirmacion (doble click) antes de cada accion critica.
- [x] Endpoints listos. Prueba destructiva real queda a discrecion del usuario.

## Fase 4 - Push de archivos

- [x] Backend `POST /file-push` multipart con limite 500 MB.
- [x] UI: drag and drop + picker, ruta destino, estado de subida.
- [x] Endpoint listo.

## Fase 5 - ADB Shell libre

- [x] UI: input + Ejecutar + terminal con scroll.
- [x] Reusa `/adb` existente.
- [x] Sin filtros, comandos libres.

## Fase 6 - Auto.js

- [x] Backend `POST /autojs/push` multipart con cache por hash a `/sdcard/Download/flowdashboard_autojs/`.
- [x] Backend `POST /autojs/prepare-overlay` con appops + fallback Settings.
- [x] UI: picker libre, toggle "forzar reenviar", ejecutar via push+`/autojs/run`, Detener via `/autojs/stop`, Preparar Auto.js.

## Fase 7 - Sistema y Energia

- [x] Backend `POST /system/open-settings` con shortcuts main/wifi/apps/idioma/accesibilidad.
- [x] Backend `POST /power/reboot`, `/power/shutdown` con fallback `svc power shutdown`.
- [x] UI: atajos al sistema, doble confirmacion en reboot/shutdown.

## Fase 8 - FlowKeyboard como acordeon

- [x] Refactorizado en `fp-block fp-collapsible` con animacion.
- [x] Logica existente intacta.

## Fase 9 - Pulido visual y persistencia

- [x] Paleta por seccion con `--fp-color` distinto.
- [x] Animaciones acordeon, hover en botones, switch animado.
- [x] `prefers-reduced-motion` respetado.
- [x] Persistencia abierto/cerrado en `localStorage.flowdashboard.focusPanel.expanded`.

## Fase 10 - Validacion final

- [x] `node --check` OK en `app.js`, `flow-touch.js`.
- [x] `python -m py_compile local_adb_server.py` OK.
- [x] Backend reiniciado y verificado:
  - `/health` HTTP 200.
  - `/apps/list` HTTP 200 con 18 apps de terceros en `192.168.1.43:5555`.
  - `/apps/launch com.android.settings` -> `ok:true, via:"agent"`.
  - `/apps/force-stop com.android.settings` OK.
  - `/system/open-settings` y `/autojs/prepare-overlay` con serial vacio devuelven 500 controlado (esperado).
- [x] `cachedFrames=17`, 17 agentes conectados, FlowLogin sin jobs activos.

## Fase 11 - Cierre

- [ ] Marcar tareas completadas.
- [ ] Documentar riesgos remanentes.
- [ ] Documentar instrucciones de uso.
- [ ] Crear `restore_points/PuntoPanelProEstable`.

## Riesgos controlados

- Multipart en HTTP server stdlib: usar `cgi.FieldStorage` con storage en disco.
- Push de archivos grandes: streaming a disco temp.
- Acciones destructivas (uninstall, clear cache, reboot, shutdown, adb libre): doble confirmacion en UI.
- Auto.js overlay: helper opt-in via `appops`, no automatico.
- FlowLogin/FlowRegister: cero contacto con esos flujos.
