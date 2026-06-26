# Dispositivos De Prueba Monolito

Ultima actualizacion: 2026-05-31

## 192.168.1.43:5555

Uso:
- Prueba controlada de uninstall/install del monolito v1.0.0.

Estado observado:
- Package unico: `com.flowlogin.agent`.
- Version instalada tras prueba: `1.0.0`, `versionCode=103`.
- 2026-05-31: `tools/install_monolito_device.ps1 -Serial 192.168.1.43:5555` ejecutado OK.
- El script desinstalo `com.flowlogin.agent`, instalo el monolito, activo permisos/appops, activo accesibilidad real, selecciono FlowKeyboard como IME default y acepto el dialogo de MediaProjection cuando aparecio.
- `dumpsys accessibility` reporto servicios bound:
  - `FlowAgent AutoJS`.
  - `FlowAgent Control`.
- `/flowkeyboard/status` reporto:
  - `installed=true`.
  - `available=true`.
  - `enabled=true`.
  - `selected=true`.
- `/agents` reporto:
  - `agentVersion=1.0.0`.
  - `accessibility=true`.
  - `keyboardInstalled=true`.
  - `keyboardActive=false`.
- Prueba real de FlowKeyboard humano:
  - Se abrio Ajustes -> Search y se enfoco `com.android.settings.intelligence:id/search_src_text`.
  - `dumpsys input_method` confirmo `mImeWindowVis=Active|Visible`, `mInputViewStarted=true`, `mIsInputViewShown=true`.
  - `/flowkeyboard/type-human` escribio `Flow Test 43@ok` con `ok=true`, `charsTyped=15`, `charsFallback=0`, `totalMs=4139`.
  - `uiautomator dump` confirmo el texto final en el `EditText`.
- 2026-05-31: se reinstalo solo `.43` con el monolito actualizado de FlowKeyboard errores humanos corregidos.
- Prueba real de errores corregidos:
  - Campo: `com.android.settings.intelligence:id/search_src_text`.
  - Texto final esperado: `Flow typo 43`.
  - Parametros: `mistakesEnabled=true`, `mistakeRate=0.35`, `maxMistakes=3`.
  - Resultado endpoint: `ok=true`, `charsTyped=12`, `charsFallback=0`, `correctedErrors=3`, `totalMs=3828`.
  - `uiautomator dump` confirmo `text="Flow typo 43"`.

Notas:
- `keyboardActive=false` no significa que el IME no este seleccionado; significa que Android aun no ha creado el `InputView` porque no hay campo de texto enfocado.
- Si `type-human` responde `InputView del FlowKeyboard no esta visible`, el problema no es instalacion: falta enfocar un campo real y desplegar el teclado visual.

## 192.168.1.48:5555

Uso:
- Pruebas preliminares de scrcpy externo.

Modelo:
- `SM-G950U`.

Estado:
- No se modifico APK durante las pruebas scrcpy.
- scrcpy v4.0 arranca server y H.264 en pruebas cortas.
- Pruebas realizadas fueron con ventana externa de `scrcpy.exe`, no dentro del Focus embebido Electron.

Notas:
- Integrar scrcpy SDK/UHID dentro del Focus embebido requiere una fase separada.
- El Focus actual usa canvas/H.264 embebido, no el control socket de `scrcpy.exe`.
