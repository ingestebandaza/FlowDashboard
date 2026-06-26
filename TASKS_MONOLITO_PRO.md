# Tasks Monolito PRO - Auditoría e Implementación de Control

Estados de las tareas:
- [ ] Pendiente
- [~] En progreso
- [x] Completado
- [!] Bloqueado / No verificado
- [-] Deprecado / Eliminado

## Objetivo actual
- El objetivo es implementar CONTROL con `scrcpy-control` como motor principal menos invasivo.
- ADB input será fallback.
- FlowAgent/Accesibilidad NO será fallback automático para Control.
- FlowAgent queda para AUTOMATIZACIÓN, FlowLogin, scripts, click_text, set_text, dump inteligente y comparación técnica.
- MediaProjection/OCR/OpenCV quedan solo bajo demanda.
- No se hará despliegue masivo.

## Reglas duras
- No usar FlowAgent como solución fácil para Control.
- No usar MediaProjection para Control.
- No activar OCR/capture_screen_start en Focus/Grid.
- No instalar ni preparar APK automáticamente para Control.
- No borrar archivos sin lista previa y razón.
- No modificar flota completa.
- Probar solo en `.43`.
- No inventar resultados.
- Cualquier cosa no probada debe marcarse como [!] No verificado.

---

## FASE 0 — Restore point y limpieza de entorno
- [x] Crear restore point.
- [x] Cerrar procesos viejos.
- [x] Reiniciar ADB/backend si aplica.
- [x] Confirmar puertos/procesos limpios.

## FASE 1 — Lectura completa y auditoría documental
- [x] Leer AGENTS.md.
- [x] Leer PROJECT_CONTEXT.md.
- [x] Leer TASKS_MONOLITO_PRO.md.
- [x] Leer documentación técnica.
- [x] Leer documentación local scrcpy.
- [x] Detectar contradicciones.
- [x] Detectar archivos obsoletos.
- [x] Detectar secciones confusas.

## FASE 2 — Limpieza documental
- [x] Corregir AGENTS.md.
- [x] Corregir PROJECT_CONTEXT.md.
- [x] Corregir TASKS_MONOLITO_PRO.md.
- [x] Corregir HANDOFF/DOCUMENTACION_TECNICA si aplica.
- [x] Marcar legacy/deprecado.
- [x] Proponer archivos a borrar o mover.

## FASE 3 — Auditoría técnica de control
- [x] Ver ruta real de /control/tap.
- [x] Ver ruta real de /control/swipe.
- [x] Ver ruta real de /control/keyevent.
- [x] Confirmar si usa scrcpy-control, ADB, FlowAgent o mezcla.
- [x] Revisar `scrcpy_control_channel.py`.
- [x] Revisar formato binario de mensajes touch/key.
- [x] Revisar handshake/scid/socket.
- [!] No verificado coordenadas físicas vs canvas dinámico.
- [!] No verificado rotación/orientación.
- [x] Revisar lifecycle del segundo proceso scrcpy-server.
- [x] Revisar stdout/stderr/logs del server.
- [x] Comparar con cliente oficial de scrcpy.
- [x] Probar scrcpy oficial.
- [x] Probar scrcpy-control Python.
- [x] Probar ADB input.
- [x] Comparar resultados.

*(Ver `reports/fase3_audit_results.md` para el detalle de la auditoría).*

## FASE 4 — Implementación scrcpy-control correcta
- [x] Corregir protocolo si está mal.
- [x] Corregir handshake/socket si está mal.
- [x] Corregir coordenadas/rotación si está mal.
- [x] Dejar ADB fallback.
- [x] No usar FlowAgent como fallback automático para Control.

## FASE 5 — Validación canario .43
- [x] Confirmar que AGENTS.md no contradice PROJECT_CONTEXT.md.
- [x] Confirmar que PROJECT_CONTEXT.md no contradice TASKS_MONOLITO_PRO.md.
- [x] Confirmar que cualquier sección vieja quedó marcada como histórica/deprecada.
- [x] Confirmar que recording está documentado como pendiente si todavía produce MP4 inválido.
- [x] Abrir Electron sin icono de captura.
- [x] Focus/Grid sin MediaProjection.
- [x] Tap con scrcpy-control.
- [x] Swipe con scrcpy-control.
- [x] Back/Home/Recents con scrcpy-control.
- [x] ADB fallback documentado.
- [x] Automation/FlowAgent sigue funcionando aparte.
- [x] Inspector normal sin OCR.
- [!] OCR solo explícito (Pide confirmación UI, no verificado OCR completo).
- [!] Recording manual si aplica (Pendiente por fallo de encoder MP4 en cli).

## FASE 6 — Documentación final
- [x] Actualizar PROJECT_CONTEXT.md.
- [x] Actualizar AGENTS.md.

## FASE 6.1 — Recuperación de Routing Control
- [x] Diagnosticar pérdida total de control en Electron.
- [x] Corregir `NameError` en el backend (reemplazar `sys.modules` con `globals()`).
- [x] Implementar esquema centralizado `should_force_adb(serial)`.
- [x] Modificar payloads de retorno en fallbacks ADB (`routingReason`, `method`, `fallbackUsed`).
- [-] Añadir excepción `.48` como estática en `CONTROL_ADB_ONLY_SERIALS` (Revertido tras recuperación).
- [x] Validación visual de reactividad por el usuario en `.44`, `.45`, `.48`, `.53`.
- [x] Actualizar TASKS_MONOLITO_PRO.md.
- [x] Actualizar HANDOFF.
- [x] Documentar archivos eliminados/movidos.
- [x] Documentar pruebas y pendientes.

## FASE 7 — Rollout Completo Control
- [x] Diagnosticar `.48` (scrcpy_control silent failure inicial).
- [x] Recuperar `.48` completamente validando scrcpy oficial e implementando Dummy Byte y Live Touch Híbrido. Ya no es excepción.
- [ ] Ejecutar prueba de Rollout Completo sobre dispositivos validados.
- [ ] Generar reporte final de Rollout (`reports/full_control_rollout_validated_devices.md`).

---

## FASE 8 — Escalabilidad comercial y descubrimiento dinámico de dispositivos

- `.43-.60` es solo el rack local de pruebas de Esteban.
- El producto final debe funcionar con cualquier cantidad de teléfonos.
- Los dispositivos pueden conectarse por USB o WiFi.
- Los rangos de red deben ser configurables.
- Los dispositivos offline son estados temporales, no fallos.
- Los perfiles deben asignarse dinámicamente por serial detectado.
- No debe haber lógica comercial hardcodeada a `192.168.1.x`.
- No debe decirse que `.54-.60` están fuera del producto, solo fuera de esta sesión de validación local.

### Tareas (Backlog)
- [ ] Implementar botón "Escanear red" en la UI.
- [ ] Permitir configuración de rangos de IPs (ej. `192.168.1.1-254`).
- [ ] Escaneo de dispositivos en background sin bloquear UI.
- [ ] Soporte mixto para dispositivos WiFi y USB.
- [ ] Persistir perfiles y configuración por Serial real, no por IP.
- [ ] Opciones para eliminar dispositivos obsoletos / reintentar conexión.
- [ ] Clasificación de estado: `online`, `offline`, `unauthorized`, etc.

---

## Histórico / Legacy / Fases anteriores

### Fase 9 - Perfiles operativos Control / Automation / Inspection (2026-06-09)
- [x] Crear restore point local antes de tocar archivos.
- [x] Auditar palabras clave sensibles: captura, MediaProjection, setup-smart, auto_reconnect, Inspector, FlowLogin, run_script, stop_script, scrcpy/H.264.
- [x] Definir perfiles internos `control`, `automation`, `inspector`, `ocr`, `recording`.
- [x] Cambiar `/flowagent/setup-smart` a `requestCapture=false` por defecto.
- [x] Quitar setup completo de FlowAgent desde `abrir_electron.ps1`.
- [x] No iniciar auto-reconnect/relaunch de FlowAgent desde `serve_forever()`.
- [x] Mover taps/swipes/navegacion manual de Focus a endpoints ADB `/control/*`.
- [x] Mantener FlowAgent/AutoJs6/FlowKeyboard como perfil `automation` para FlowLogin/scripts.
- [x] Inspector Tree/Hybrid consulta primero UIAutomator; Auto ya no incluye OCR.
- [x] Dejar OCR/OpenCV como accion explicita bajo demanda.
- [x] Releer documentacion local oficial en `informacion de scrcpy/doc/`.
- [x] Implementar recording manual con base en documentacion local oficial de scrcpy.

### Fase 0 a 8 (Resumen)
- Implementadas auditorías globales de Mojibake.
- Implementado FlowKeyboard Humano V2.
- Implementados Perfiles Humanos Por Dispositivo.
- Implementados Gestos Humanos y Esperas por Estado Real.
- FlowAgent Socket unificado sobre el motor AutoJs6 (Accesibilidad única).
- Pruebas graduales exitosas en flota de 17 dispositivos.
