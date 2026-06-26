# Implementation Plan: FlowKeyboard

## FASE 0 - Documentacion

- [x] 0.1 Crear requirements de FlowKeyboard.
- [x] 0.2 Crear diseno tecnico de FlowKeyboard.
- [x] 0.3 Crear checklist vivo de tareas.

## FASE 1 - APK base

- [x] 1.1 Crear `FlowKeyboardService.java`.
- [x] 1.2 Crear layout visual `flow_keyboard_view.xml`.
- [x] 1.3 Crear metadata IME `flow_keyboard_method.xml`.
- [x] 1.4 Declarar servicio en `AndroidManifest.xml`.
- [x] 1.5 Agregar strings del teclado.
- [x] 1.6 Compilar APK sin instalar.

## FASE 2 - Comandos internos

- [x] 2.1 Agregar `keyboard_status` a `AgentSocketClient`/FlowAgent.
- [x] 2.2 Agregar `keyboard_type`.
- [x] 2.3 Agregar `keyboard_clear`.
- [x] 2.4 Agregar `keyboard_backspace`.
- [x] 2.5 Agregar `keyboard_enter`, `keyboard_next`, `keyboard_done`.

## FASE 3 - Backend local

- [x] 3.1 Agregar helper `flow_keyboard_status(serial)`.
- [x] 3.2 Agregar helper `prepare_flow_keyboard(device_ids)`.
- [x] 3.3 Agregar endpoint `POST /flowkeyboard/status`.
- [x] 3.4 Agregar endpoint `POST /flowkeyboard/prepare`.
- [x] 3.5 Agregar endpoint `POST /flowkeyboard/type`.

## FASE 4 - Dashboard Electron

- [x] 4.1 Mostrar estado FlowKeyboard por dispositivo.
- [x] 4.2 Agregar accion explicita "Preparar FlowKeyboard".
- [x] 4.3 Agregar prueba manual de escritura segura.
- [x] 4.4 Integrar con FlowDev Action Console.

## FASE 5 - API para scripts JS

- [x] 5.1 Exponer helper `flow.keyboard.status()`.
- [x] 5.2 Exponer helper `flow.keyboard.type(text, options)`.
- [x] 5.3 Exponer helper `flow.keyboard.clear()`.
- [x] 5.4 Exponer helper `flow.keyboard.enter/next/done()`.
- [ ] 5.5 Migrar gradualmente Login/Register a FlowKeyboard cuando este listo.

## FASE 6 - Pruebas

- [ ] 6.1 Verificar APK en un dispositivo.
- [ ] 6.2 Verificar preparacion IME.
- [ ] 6.3 Verificar escritura de email/password con caracteres especiales.
- [ ] 6.4 Verificar que FlowLogin actual no se rompe si FlowKeyboard no esta activo.
- [ ] 6.5 Verificar lote pequeno y luego 17 dispositivos.
