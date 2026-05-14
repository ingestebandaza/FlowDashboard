# UI Style Agent

Estas reglas protegen el estilo visual de `wsapi_demo.html`. Cualquier cambio futuro en esta carpeta debe respetarlas.

## Memoria del Proyecto

- Antes de modificar este programa, leer tambien `PROJECT_CONTEXT.md`.
- `PROJECT_CONTEXT.md` es la memoria viva del proyecto: arquitectura, estado actual, decisiones tomadas, endpoints, APK, flujo FlowLogin/FlowAgent y cambios recientes.
- Cada vez que se haga una modificacion funcional, visual o estructural, actualizar `PROJECT_CONTEXT.md` en la misma tarea.
- Si otro agente de IA trabaja en esta carpeta, basta decirle: "lee AGENTS.md y PROJECT_CONTEXT.md antes de tocar nada".
- No copiar cuentas, passwords ni datos sensibles completos desde `device_names.json` o `.flowlogin_payloads` dentro de la documentacion. Describir la estructura, no los secretos.

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
- Los nombres de dispositivos se pueden editar desde cada cuadro y deben persistir en `device_names.json`, usando el serial/IP como clave.
- La edicion del nombre debe usar el popover visual del dashboard, no `window.prompt()`.
- Los popovers de nombre y perfil deben mantenerse anclados visualmente al boton que los abrio durante scroll o resize.
- Cada dispositivo debe conservar un boton con silueta de persona junto al boton de editar nombre.
- El boton de persona abre un popover visual con textarea de maximo 10 lineas y acciones Limpiar, Cancelar y Guardar.
- La informacion del boton de persona tambien debe persistir en `device_names.json` por serial/IP.
- El tamano base debe mostrar aproximadamente 5 cuadros por fila en desktop.
- Mantener el slider de zoom: derecha hace los cuadros mas grandes y caben menos; izquierda los hace mas pequenos y caben mas.
- Los cuadros no deben deformar la pagina ni desbordar horizontalmente.

## Animacion de Estado

- El indicador superior derecho debe animarse solo cuando tenga `is-online`.
- Mantener una animacion sutil: pulso del punto, brillo verde suave y cambio ligero del texto.
- Respetar siempre `prefers-reduced-motion`.

## Preferencias Generales

- No volver a depender de Laixi. El dashboard debe usar `local_adb_server.py` + `wsapi.js` apuntando al servidor ADB local.
- Para abrir el dashboard en Windows, usar `abrir_dashboard.bat`; este lanzador inicia `local_adb_server.py` si hace falta y abre `wsapi_demo.html`.
- Al cargar `wsapi_demo.html`, el dashboard debe intentar conectarse automaticamente al servidor ADB local para mostrar dispositivos sin pulsar `Conectar`.
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
