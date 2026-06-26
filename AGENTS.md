# UI Style Agent

Estas reglas protegen el estilo visual de `wsapi_demo.html`. Cualquier cambio futuro en esta carpeta debe respetarlas.

## Memoria del Proyecto

- Antes de modificar este programa, leer tambien `PROJECT_CONTEXT.md`.
- `PROJECT_CONTEXT.md` es la memoria viva del proyecto: arquitectura, estado actual, decisiones tomadas, endpoints, APK, flujo FlowLogin/FlowAgent y cambios recientes.
- Cada vez que se haga una modificacion funcional, visual o estructural, actualizar `PROJECT_CONTEXT.md` en la misma tarea.
- Si otro agente de IA trabaja en esta carpeta, basta decirle: "lee AGENTS.md y PROJECT_CONTEXT.md antes de tocar nada".
- No copiar cuentas, passwords ni datos sensibles completos desde `device_names.json` o `.flowlogin_payloads` dentro de la documentacion. Describir la estructura, no los secretos.
- `DOCUMENTACION_TECNICA.md` es legacy/prohibido como fuente tecnica vigente. No leerlo, no basarse en el y no usarlo para corregir documentacion actual; solo puede mencionarse como archivo historico si aparece en inventarios.

## FlowAgent Monolito (Etapa B - desde 2026-05-27)

- **El FlowAgent ahora ejecuta scripts JavaScript internamente** usando el motor Rhino embebido de AutoJs6 v6.7.0. No requiere instalar AutoJs6 standalone aparte.
- Path del fork: `flow_agent_monolito/` (clone shallow del tag v6.7.0). NO es para reemplazar a `flow_agent_apk/` directamente; convive como `flow_agent_apk` (legado 0.3.8 estable) + `flow_agent_monolito` (nuevo monolito).
- Comandos socket nuevos del FlowAgent: `run_script`, `stop_script`, `ocr_detect`, `image_match_template`. Endpoints HTTP correspondientes en `local_adb_server.py`: `/flowagent/run-script`, `/flowagent/stop-script`, `/flowagent/ocr-detect`, `/flowagent/find-template`.
- El monolito mantiene `applicationId=com.flowlogin.agent` y la misma firma del keystore (`flow_agent_apk/flowagent-debug.keystore`) para que `pm install -r` reemplace al 0.3.8 sin perder permisos.
- Coexistencia con AutoJs6 standalone (Etapa A): NO. El monolito declara la misma `permission android.permission.PLUGIN`. Antes de instalar el monolito en un dispositivo que tenia AutoJs6 standalone, desinstalarlo: `adb uninstall org.autojs.autojs6`.
- Etapa A queda como **fallback historico** para clientes con problemas de espacio (FlowAgent 0.3.8 + AutoJs6 standalone separados pesan menos que el monolito de 100MB).
- Backup del APK 0.3.8 real: `flow_agent_apk/backup_0_3_8/flowagent-0.3.8-from-41.apk` (50KB). Para rollback inmediato si el monolito causa problemas en algun dispositivo.

## Validacion de Licencias (Importante)

**Estado actual (2026-05-14):** El sistema usa **email** como identificador principal para validacion, con deteccion automatica de MAC desde dispositivos Android.

- `local_adb_server.py` valida contra Supabase usando `device_email` (no MAC)
- Endpoint `/device-mac` recupera MAC automaticamente del primer dispositivo conectado
- `wsapi_demo.html` muestra campo de email y recupera MAC automaticamente
- Tablas Supabase `app_device_registrations` y `app_access_logs` usan columna `device_email`
- El servidor usa `service_role` para operaciones internas (no exponer en cliente)
- Para modificar validacion: leer `PROJECT_CONTEXT.md` seccion "Licencias y Admin Supabase"

## Botones de Categorias

- Mantener las opciones `FlowLogin`, `FlowTrack`, `FlowCache`, `FlowCast`, `FlowApple`, `Flowamazon`, `FlowGram` y `FlowTikTok` como tarjetas compactas.
- No convertirlas en una fila con titulo, barra de fondo, tabla o panel visible. Deben quedar como botones individuales.
- La grilla debe caber dentro de la columna derecha sin expandir horizontalmente la pagina.
- Debajo de las categorias debe existir una mini fila de botones Play alineados con cada opcion; por ahora solo `FlowLogin` ejecuta `Login.js`, las demas quedan desactivadas/pendientes.
- Cuando `FlowLogin` este ejecutandose, su tarjeta y su boton Play deben mostrar una animacion sutil.
- Cada boton debe mantener siempre su borde de color usando `--action-color`, incluso cuando no este seleccionado.
- El estado seleccionado debe diferenciarse con un efecto adicional, no quitando el borde base: glow suave, fondo tintado, punto luminoso o elevacion leve.
- Las categorias deben funcionar como seleccion exclusiva: solo una opcion puede tener `is-selected` y `aria-pressed="true"` a la vez.
- Los iconos deben ser SVG inline, no emoji, para evitar problemas de codificacion y tamanos inconsistentes.
- Mantener iconos relacionados con el nombre:
  - `FlowTikTok`: logotipo/forma inspirada en TikTok.
  - `FlowGram`: camara estilo Instagram.
  - `FlowApple`: musica/app music.
  - `FlowCast`: microfono/podcast.

## Botones de Dispositivos

- Los botones `Conectar` y `Actualizar` deben permanecer en la misma fila del titulo `Dispositivos`.
- Deben ser compactos para no desbordar el panel izquierdo.
- El panel izquierdo de `Dispositivos` no debe desplegar ni mostrar la lista de dispositivos; solo titulo, cantidad y botones principales.
- Mantener colores diferenciados:
  - `Conectar`: verde/teal.
  - `Actualizar`: azul/cyan.

## Grilla de Dispositivos

- La visualizacion de dispositivos conectados vive dentro de `Comandos y paquetes`.
- El encabezado de ese panel debe decir `Dispositivos Conectados`.
- El slider de zoom debe estar en la misma fila del encabezado, alineado a la derecha.
- A la izquierda del slider de zoom deben mantenerse botones compactos para seleccionar todos, eliminar cuentas de seleccionados y deseleccionar todos.
- Debajo del titulo `Dispositivos Conectados` debe verse un aviso compacto con la cantidad de dispositivos seleccionados, sin aumentar visualmente la altura de la fila.
- Los dispositivos deben verse como cuadros seleccionables, no como lista vertical.
- Los nombres de dispositivos se pueden editar desde cada cuadro y deben persistir en `device_names.json`, usando MAC Address como clave estable cuando este disponible; solo usar serial/IP como fallback temporal si Android no entrega MAC.
- La edicion del nombre debe usar el popover visual del dashboard, no `window.prompt()`.
- Los popovers de nombre y perfil deben mantenerse anclados visualmente al boton que los abrio durante scroll o resize.
- Cada dispositivo debe conservar un boton con silueta de persona junto al boton de editar nombre.
- El boton de persona abre un popover visual con textarea de maximo 10 lineas y acciones Limpiar, Cancelar y Guardar.
- La informacion del boton de persona tambien debe persistir en `device_names.json` por MAC Address, con fallback temporal por serial/IP si no se puede detectar MAC.
- El tamano base debe mostrar aproximadamente 5 cuadros por fila en desktop.
- Mantener el slider de zoom: derecha hace los cuadros mas grandes y caben menos; izquierda los hace mas pequenos y caben mas.
- Los cuadros no deben deformar la pagina ni desbordar horizontalmente.

## Animacion de Estado

- El indicador superior derecho debe animarse solo cuando tenga `is-online`.
- Mantener una animacion sutil: pulso del punto, brillo verde suave y cambio ligero del texto.
- Respetar siempre `prefers-reduced-motion`.

## Preferencias Generales

- No volver a depender de Laixi. El dashboard debe usar `local_adb_server.py` + `wsapi.js` apuntando al servidor ADB local.
- El producto final es el dashboard Electron. `wsapi_demo.html` queda como legado y no debe recibir funcionalidades nuevas salvo migracion o referencia puntual.
- Para abrir el dashboard final en Windows, usar `abrir_electron.bat`; este lanzador solo inicia ADB, backend C#, servidor Python/socket y Electron.
- Referencia tecnica vigente: `docs/master_technical_specification.md`. Si `PROJECT_CONTEXT.md` o notas antiguas contradicen ese documento, tratar la nota antigua como historica salvo nueva verificacion runtime. `DOCUMENTACION_TECNICA.md` no participa en esta jerarquia porque es legacy/prohibido.
- Arquitectura operativa permanente:
  - Perfil `control`:
    - Estado actual vigente: video Grid/Focus usa scrcpy H.264 raw/frame_meta via Python WS 8768 y Electron WebCodecs/canvas.
    - Control manual usa `scrcpy-control` como motor principal de taps, swipes, live touch y Back/Home/Recents via endpoints `/control/*`.
    - ADB input queda como fallback seguro.
    - FlowAgent/Accesibilidad NO es fallback automático para Control.
    - FlowAgent queda solo para Automation, FlowLogin, scripts JS, click_text, set_text, dump inteligente, FlowKeyboard y comparación técnica.
  - Perfil `automation`: FlowLogin, scripts JS, click por texto, set_text, dump inteligente y FlowKeyboard usan FlowAgent socket + AutoJs6 + AccessibilityServiceUsher + FlowKeyboard. Solo se prepara por accion explicita del usuario.
  - Perfil `inspector`: Tree/Nativo/Auto debe usar primero UIAutomator por ADB y, como complemento, Accessibility/CDP si estan disponibles. OCR/Hybrid son los unicos modos que pueden solicitar captura/MediaProjection.
  - Perfil `ocr`: OCR y OpenCV/template matching pueden llamar `capture_screen_start(streamFrames=false)` solo en ese momento y deben permitir `capture_screen_stop`.
  - Perfil `recording`: grabacion manual usa scrcpy/H.264 guardado en PC; no arrancar automaticamente ni usar MediaProjection por defecto.
  - Grabacion manual actual: endpoints `/recordings/start`, `/recordings/stop`, `/recordings/status` y `/recordings/active`; guardar en `recordings/` con `scrcpy.exe --record --no-window --no-playback --no-control`.
- Todos los componentes deben usar el ADB empaquetado en `scrcpy-win64-v4.0\adb.exe`. No depender del ADB del PATH, Android Studio, SDK instalado en el PC ni `C:\adb`.
- **Arranque / Onboarding de dispositivos nuevos**: Al iniciar el dashboard, SÍ se permite instalar automáticamente el APK monolito SOLO si el dispositivo no tiene `com.flowlogin.agent` instalado. Esto incluye configurar los `adb reverse` e intentar preparar Accesibilidad/FlowKeyboard para automatización. Sin embargo, este proceso de onboarding automático **NO debe iniciar `capture_screen_start`**, **NO debe iniciar MediaProjection**, ni encender iconos de captura.
- **Si el APK ya existe**: NO se debe reinstalar, ni actualizar, ni desinstalar automáticamente. Solo se diagnostica su estado. Si está viejo, se marca para actualización manual.
- **Media Projection / Icono de captura**: Es una regla dura que ni instalar APK, ni abrir FlowAgent, ni activar Accesibilidad pueden encender el icono de captura. El icono solo aparece por demanda explícita (OCR, Template Matching, etc.).
- Abrir Focus/Grid y usar control manual normal no debe encender el icono de captura/proyeccion de Android. Control manual NO usa FlowAgent.
- La deteccion de dispositivos debe ser real: usar `adb devices` y/o escaneo ADB WiFi desde el dashboard. No mostrar dispositivos hardcodeados como conectados.
- Preparar, instalar o actualizar FlowAgent en dispositivos que ya lo tienen debe ser una accion explicita del usuario desde Electron.
- FlowLogin debe tratar `Socket` como canal obligatorio: si un telefono no queda con FlowAgent listo, se omite o se avisa, no debe caer silenciosamente a ADB como motor de login.
- La seccion `Cuentas` debe mantener pestañas visuales solo con iconos y contador para `Total`, `Validos` y `No validos`, cada una con su propio textarea.
- En `Cuentas`, los campos `Delimitador` y `Dividir` deben permanecer lado a lado.
- El contenido de los textareas de `Cuentas`, `Delimitador` y `Dividir` debe persistir en `localStorage`.
- El boton verde junto a `Dividir` reparte lineas de la pestaña activa entre los dispositivos seleccionados, guardando cada bloque en el perfil persistente del telefono.
- `Dividir` no puede aceptar reparto mayor a 10 cuentas por dispositivo; mostrar aviso y no ejecutar si el valor supera 10.
- Debajo de la grilla de dispositivos debe existir un boton pequeño para limpiar cuentas de dispositivos; debe pedir confirmacion y, sin seleccion, limpiar todos los dispositivos conectados.
- Cada tarjeta de dispositivo debe mostrar una columna derecha de puntos, un punto por cuenta guardada en ese telefono. Los puntos deben adaptarse al zoom/tamano del cuadro. Los puntos verdes animados representan cuentas funcionando; usar rojo para fallos futuros.
- Las bolitas de cuenta deben representar estados reales por clon: gris pendiente, azul ejecutando, amarillo reintentando, verde success, naranja ya logueado, rojo error y morado revision.
- El dashboard debe mantener trazabilidad visual de cuentas en la seccion izquierda: numero de cuenta, asignacion a dispositivo/clon y estado.
- `Login.js` debe leer `/sdcard/Download/flowlogin_accounts.json` y reportar progreso en `/sdcard/Download/flowlogin_status.json`; no debe depender de seleccionar manualmente un TXT en cada telefono.
- Los reintentos de login deben ser conservadores: no marcar success sin confirmacion estable y no intentar saltar captchas, 2FA o verificaciones del servicio.
- Evitar emojis nuevos en el HTML.
- Mantener los botones compactos, legibles y sin desbordes.
- No introducir cambios visuales grandes sin revisar primero el layout desktop y mobile.
