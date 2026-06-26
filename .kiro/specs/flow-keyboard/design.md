# Design: FlowKeyboard

## Overview

FlowKeyboard es un `InputMethodService` incluido en `com.flowlogin.agent`. El teclado escribe usando `InputConnection.commitText()` y acciones IME (`performEditorAction`) para que FlowDashboard controle entradas de texto de forma mas estable que `adb input text`.

El componente queda instalado con FlowAgent, pero su activacion se maneja desde el dashboard/backend mediante una accion explicita de preparacion. En arranques posteriores solo se verifica estado.

## Architecture

```text
Electron / scripts JS
  -> local_adb_server.py
  -> FlowAgent socket command
  -> FlowKeyboardService
  -> Android InputConnection
  -> campo enfocado
```

## Android Components

- `FlowKeyboardService.java`
  - Extiende `android.inputmethodservice.InputMethodService`.
  - Mantiene instancia estatica debil para comandos internos.
  - Expone metodos seguros: `status()`, `typeText()`, `clearText()`, `backspace()`, `enter()`, `next()`, `done()`.
  - Renderiza `R.layout.flow_keyboard_view`.

- `res/xml/flow_keyboard_method.xml`
  - Metadata requerida por Android para listar el IME.

- `res/layout/flow_keyboard_view.xml`
  - Vista compacta, oscura, con botones funcionales.

## Backend Components

- `local_adb_server.py`
  - Constante `FLOW_KEYBOARD_IME = "com.flowlogin.agent/.FlowKeyboardService"`.
  - Helpers:
    - `flow_keyboard_status(serial)`
    - `prepare_flow_keyboard(device_ids)`
    - `flow_keyboard_type(serial, text, delay_ms)`
    - `flow_keyboard_command(serial, action, **options)`
  - Endpoints:
    - `POST /flowkeyboard/status`
    - `POST /flowkeyboard/prepare`
    - `POST /flowkeyboard/type`
    - `POST /flowkeyboard/command`

## Electron / FlowDev API

- `Configuracion -> FlowKeyboard` conserva acciones manuales para verificar, preparar y probar texto.
- `FlowDev Action Console` incluye bloque FlowKeyboard con `Status`, `Type`, `Clear`, `Backspace`, `Enter`, `Next` y `Done`.
- `window.flow.keyboard` expone helpers para automatizaciones JS dentro del dashboard:
  - `status(options)`
  - `type(text, options)`
  - `clear(options)`
  - `backspace(count, options)`
  - `enter(options)`, `next(options)`, `done(options)`
- Por defecto los helpers usan la seleccion actual del dashboard; tambien aceptan `options.serial`, `options.deviceIds` o `options.serials`.

## Socket Commands

```json
{"name":"keyboard_status"}
{"name":"keyboard_type","text":"hello","delayMs":45}
{"name":"keyboard_clear"}
{"name":"keyboard_backspace","count":3}
{"name":"keyboard_enter"}
{"name":"keyboard_next"}
{"name":"keyboard_done"}
```

## Safety

- No se activa al abrir Electron.
- No se reinstala si ya esta listo.
- No guarda texto escrito.
- Los logs deben usar conteos o texto enmascarado.
- Si no hay `InputConnection`, responde error estructurado.

## Compatibility

El APK sigue usando `minSdkVersion=26`. `InputMethodService`, `InputConnection`, `EditorInfo.IME_ACTION_*` y `KeyEvent` estan disponibles en ese rango.
