# Requirements Document

## Introduction

Esta feature agrega al FlowDashboard Pro un **modo desarrollador** accesible desde el sidebar izquierdo mediante un toggle animado. Cuando el modo desarrollador esta activo, el area principal del dashboard reemplaza la grilla de dispositivos por un **Inspector de UI Android** de nivel profesional, similar a Appium Inspector, que permite explorar, interactuar y depurar la jerarquia de vistas de cualquier dispositivo conectado via ADB WiFi.

El inspector se apoya en la infraestructura ya existente: `dump_ui()`, `find_ui_nodes()`, `adb_tap()`, `adb_input_text()` y el canvas WebP de streaming en `stream-renderer.js`. Incluye un sistema de **multiples modos de deteccion** organizados en dos categorias principales: **Deteccion Nativa** (metodos que operan directamente sobre el sistema Android via ADB) y **Deteccion Web** (metodos que operan sobre contenido WebView/HTML embebido en apps). Ademas incluye un **modo fallback de busqueda ciega** para pantallas protegidas contra captura (apps con FLAG_SECURE, antivirus, etc.).

La paleta visual es negro puro (`#000000`), verde-cian neon (`#00F5D4`) y verde esmeralda (`#006F4F`), con estetica minimalista futurista coherente con el dashboard existente.

---

## Glossary

- **Inspector**: El componente de UI del modo desarrollador que muestra el arbol de elementos, el preview y el panel de propiedades.
- **Arbol_UI**: Representacion jerarquica de los nodos de la interfaz Android obtenida mediante `uiautomator dump`.
- **Nodo**: Elemento individual del Arbol_UI con atributos como `resourceId`, `text`, `class`, `bounds`, `clickable`, `enabled`, `content-desc`, `focused`, `scrollable`.
- **Bounds**: Coordenadas rectangulares de un Nodo en formato `[left,top][right,bottom]`.
- **Preview_Canvas**: El canvas HTML que muestra el frame WebP en vivo del dispositivo seleccionado, reutilizando `stream-renderer.js`.
- **Panel_Propiedades**: Seccion del Inspector que muestra los atributos del Nodo seleccionado.
- **Modo_Normal**: Vista por defecto del dashboard con la grilla de dispositivos y live preview.
- **Modo_Desarrollador**: Vista alternativa que muestra el Inspector de UI Android.
- **Toggle_Modo**: Control animado en el sidebar que alterna entre Modo_Normal y Modo_Desarrollador.
- **Modo_Fallback**: Sub-modo del Inspector para pantallas protegidas donde no hay Preview_Canvas disponible.
- **Servidor_Python**: `local_adb_server.py` corriendo en `http://localhost:8765`.
- **Backend_CSharp**: `FlowDashboard.Core` corriendo en `http://localhost:5000`.
- **Electron_Renderer**: `app.js` y `stream-renderer.js` en `electron-app/src/renderer/`.
- **Serial**: Identificador ADB del dispositivo en formato `192.168.1.XX:5555`.
- **Highlight_Overlay**: Rectangulo semitransparente dibujado sobre el Preview_Canvas para resaltar el Nodo seleccionado.
- **Busqueda_Ciega**: Funcionalidad del Modo_Fallback que ejecuta `uiautomator dump` y filtra resultados sin necesitar Preview_Canvas.
- **Modo_Deteccion**: Estrategia activa que el Inspector usa para obtener la jerarquia de UI. Puede ser Nativa o Web.
- **Deteccion_Nativa**: Conjunto de metodos que operan directamente sobre el sistema Android via ADB sin depender de tecnologia web.
- **Deteccion_Web**: Conjunto de metodos que operan sobre contenido WebView o HTML embebido dentro de apps Android.
- **Selector_Deteccion**: Control visual en la barra de herramientas del Inspector que permite elegir el Modo_Deteccion activo.
- **Motor_Deteccion**: Modulo del Servidor_Python que encapsula la logica de cada metodo de deteccion y expone una interfaz unificada.

---

## Requirements

---

### Requirement 1: Toggle Modo Normal / Modo Desarrollador

**User Story:** Como operador del dashboard, quiero un toggle animado en el sidebar para cambiar entre la vista de grilla de dispositivos y el inspector de UI, de modo que pueda alternar entre operacion normal y depuracion sin perder el contexto de la sesion.

#### Acceptance Criteria

1. THE Toggle_Modo SHALL renderizarse en el sidebar izquierdo inmediatamente debajo del logotipo de FlowDashboard Pro, antes de cualquier otro control del sidebar.

2. THE Toggle_Modo SHALL mostrar dos estados claramente diferenciados: etiqueta "Normal" con icono de grilla cuando Modo_Normal esta activo, y etiqueta "Dev" con icono de codigo cuando Modo_Desarrollador esta activo.

3. WHEN el usuario hace clic en el Toggle_Modo, THE Electron_Renderer SHALL completar la transicion visual entre Modo_Normal y Modo_Desarrollador en menos de 300 ms mediante una animacion CSS de fundido cruzado (cross-fade).

4. WHEN el Toggle_Modo cambia de estado, THE Electron_Renderer SHALL persistir el modo activo en `localStorage` bajo la clave `flowdashboard.devMode` para que se restaure al recargar la aplicacion.

5. WHILE Modo_Desarrollador esta activo, THE Electron_Renderer SHALL ocultar completamente la grilla de dispositivos y el panel de cuentas del area principal, sin destruir el estado de los streams WebP activos.

6. WHILE Modo_Normal esta activo, THE Electron_Renderer SHALL ocultar completamente el Inspector y restaurar la grilla de dispositivos con los mismos dispositivos y estado de seleccion previos, sin destruir el estado de los streams WebP activos.

7. THE Toggle_Modo SHALL usar la paleta de colores definida: fondo `#000000`, indicador activo en color `#00F5D4`, borde sutil `#006F4F`, con animacion de deslizamiento del indicador de al menos 200 ms de duracion.

8. IF el Servidor_Python no esta disponible al activar Modo_Desarrollador, THEN THE Inspector SHALL mostrar un mensaje de error "Servidor ADB no disponible" con instrucciones para iniciarlo, sin bloquear la UI.

---

### Requirement 2: Selector de Dispositivo en el Inspector

**User Story:** Como desarrollador, quiero seleccionar que dispositivo inspeccionar desde un dropdown, de modo que pueda cambiar de dispositivo sin salir del modo inspector.

#### Acceptance Criteria

1. WHEN Modo_Desarrollador se activa, THE Inspector SHALL mostrar un dropdown de seleccion de dispositivo poblado con todos los dispositivos cuyo estado sea `online` segun el endpoint `GET /devices` del Servidor_Python.

2. WHEN el usuario selecciona un dispositivo en el dropdown, THE Inspector SHALL mostrar el Serial del dispositivo seleccionado y su nombre personalizado (si existe en `device_names.json`) como etiqueta del dropdown.

3. WHEN el usuario selecciona un dispositivo en el dropdown, THE Inspector SHALL iniciar automaticamente el Preview_Canvas para ese dispositivo reutilizando el mecanismo de `stream-renderer.js`, sin duplicar conexiones WebSocket existentes.

4. IF no hay dispositivos `online` al activar Modo_Desarrollador, THEN THE Inspector SHALL mostrar un dropdown vacio con el mensaje "No hay dispositivos conectados" como opcion deshabilitada, y deshabilitar los controles de inspeccion hasta que haya al menos un dispositivo disponible.

5. WHEN la lista de dispositivos cambia (dispositivo conectado o desconectado), THE Inspector SHALL actualizar el dropdown en un plazo maximo de 30 segundos, coherente con el intervalo de polling existente en `app.js`.

6. THE Inspector SHALL mostrar junto a cada dispositivo en el dropdown un indicador de estado (punto verde para `online`, punto rojo para `offline`) usando los mismos colores del dashboard existente.

---

### Requirement 3: Vista del Arbol de Elementos UI

**User Story:** Como desarrollador, quiero ver la jerarquia completa de elementos de la pantalla del dispositivo seleccionado, de modo que pueda entender la estructura de la UI y localizar elementos especificos.

#### Acceptance Criteria

1. WHEN el usuario hace clic en el boton "Capturar UI" del Inspector, THE Inspector SHALL invocar el endpoint `POST /inspector/dump` del Servidor_Python con el Serial del dispositivo seleccionado y mostrar el Arbol_UI resultante en un panel de arbol colapsable.

2. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/dump` que ejecuta `dump_ui(serial)` y devuelve el XML completo del Arbol_UI junto con la lista de Nodos serializados como JSON, incluyendo los atributos: `index`, `text`, `resourceId`, `class`, `package`, `content-desc`, `checkable`, `checked`, `clickable`, `enabled`, `focusable`, `focused`, `scrollable`, `long-clickable`, `password`, `selected`, `bounds`.

3. THE Inspector SHALL renderizar el Arbol_UI como un arbol colapsable donde cada Nodo muestra su `class` (nombre corto sin paquete) y, si existe, su `text` o `content-desc` como etiqueta secundaria.

4. WHEN el Arbol_UI tiene mas de 3 niveles de profundidad, THE Inspector SHALL renderizar los niveles 4 en adelante colapsados por defecto, con un control de expansion por nodo.

5. IF `dump_ui(serial)` falla o tarda mas de 10 segundos, THEN THE Servidor_Python SHALL devolver un error HTTP 408 con el mensaje "Timeout al capturar UI del dispositivo" y THE Inspector SHALL mostrarlo al usuario con un boton de reintento.

6. THE Inspector SHALL mostrar un indicador de carga (spinner con color `#00F5D4`) unicamente mientras el dump de UI esta en progreso; el spinner SHALL ocultarse en cuanto el dump finalice con exito o con error.

7. WHEN el Arbol_UI se actualiza con una nueva captura, THE Inspector SHALL preservar el estado de expansion/colapso de los nodos que sigan existiendo en la nueva captura, identificados por su `resourceId` o por su ruta de indices.

---

### Requirement 4: Preview de Pantalla con Highlight de Nodo

**User Story:** Como desarrollador, quiero ver la pantalla del dispositivo en tiempo real y que al seleccionar un elemento del arbol se resalte visualmente su posicion, de modo que pueda correlacionar la jerarquia con lo que veo en pantalla.

#### Acceptance Criteria

1. WHILE Modo_Desarrollador esta activo y hay un dispositivo seleccionado, THE Preview_Canvas SHALL mostrar el stream WebP en vivo del dispositivo usando el mismo mecanismo de `stream-renderer.js` que usa el Modo_Normal.

2. WHEN el usuario selecciona un Nodo en el Arbol_UI, THE Inspector SHALL dibujar un Highlight_Overlay sobre el Preview_Canvas en las coordenadas del atributo `bounds` del Nodo seleccionado, con borde de color `#00F5D4` de 2 px de grosor y fondo semitransparente `rgba(0, 245, 212, 0.15)`.

3. WHEN el usuario selecciona un Nodo diferente, THE Inspector SHALL eliminar el Highlight_Overlay anterior y dibujar uno nuevo en las coordenadas del nuevo Nodo seleccionado en estrictamente menos de 50 ms.

4. THE Inspector SHALL escalar las coordenadas del Highlight_Overlay proporcionalmente al tamano actual del Preview_Canvas respecto a la resolucion nativa del dispositivo (1080x1920 para Samsung Galaxy S8/S8+).

5. WHEN el usuario hace clic en una posicion del Preview_Canvas, THE Inspector SHALL calcular las coordenadas nativas correspondientes, buscar el Nodo mas pequeno del Arbol_UI cuyo `bounds` contenga esas coordenadas, seleccionarlo en el Arbol_UI y desplazar el arbol para que el Nodo seleccionado sea visible.

6. IF el Arbol_UI no ha sido capturado aun cuando el usuario hace clic en el Preview_Canvas, THEN THE Inspector SHALL mostrar el mensaje "Captura el arbol UI primero para habilitar la seleccion por clic" sin ejecutar ninguna accion ADB.

7. THE Preview_Canvas en Modo_Desarrollador SHALL mantener la relacion de aspecto 9:16 del dispositivo y ocupar el espacio disponible del panel central sin deformar la imagen.

---

### Requirement 5: Panel de Propiedades del Nodo Seleccionado

**User Story:** Como desarrollador, quiero ver todos los atributos del elemento seleccionado en un panel dedicado, de modo que pueda obtener la informacion necesaria para automatizar interacciones.

#### Acceptance Criteria

1. WHEN el usuario selecciona un Nodo en el Arbol_UI o en el Preview_Canvas, THE Panel_Propiedades SHALL mostrar todos los atributos del Nodo: `resourceId`, `text`, `class`, `package`, `content-desc`, `bounds`, `clickable`, `enabled`, `focusable`, `focused`, `scrollable`, `long-clickable`, `checked`, `selected`, `checkable`, `password`.

2. THE Panel_Propiedades SHALL resaltar con color `#00F5D4` los atributos con valor `true` para `clickable`, `enabled`, `focusable` y `scrollable`, y con color gris `#555555` los atributos con valor `false`.

3. THE Panel_Propiedades SHALL mostrar las coordenadas del centro del Nodo calculadas a partir de `bounds` como `centerX` y `centerY` en pixeles nativos del dispositivo.

4. WHEN el usuario hace clic en el valor de cualquier atributo del Panel_Propiedades, THE Panel_Propiedades SHALL intentar copiar ese valor al portapapeles del sistema y, unicamente si la operacion de copiado es exitosa, mostrar una confirmacion visual de "Copiado" durante 1500 ms.

5. WHEN no hay ningun Nodo seleccionado, THE Panel_Propiedades SHALL mostrar unicamente el mensaje "Selecciona un elemento del arbol o haz clic en el preview", ocultando completamente todos los campos de atributos.

---

### Requirement 6: Acciones sobre el Nodo Seleccionado

**User Story:** Como desarrollador, quiero ejecutar acciones directas sobre el elemento seleccionado (tap, long press, input text, scroll), de modo que pueda probar interacciones sin escribir comandos ADB manualmente.

#### Acceptance Criteria

1. WHEN hay un Nodo seleccionado con `clickable: true`, THE Inspector SHALL mostrar un boton "Tap" habilitado que, al pulsarse, invoque el endpoint `POST /inspector/tap` del Servidor_Python con el Serial y las coordenadas del centro del Nodo.

2. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/tap` que ejecuta `adb_tap(serial, x, y)` y devuelve `{"ok": true}` o un error descriptivo.

3. WHEN hay un Nodo seleccionado con `long-clickable: true`, THE Inspector SHALL mostrar un boton "Long Press" habilitado que, al pulsarse, invoque el endpoint `POST /inspector/long-press` del Servidor_Python con el Serial y las coordenadas del centro del Nodo.

4. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/long-press` que ejecuta `adb_shell(serial, "input swipe X Y X Y 800")` para simular un long press de 800 ms.

5. WHEN hay un Nodo seleccionado con `class` igual a `android.widget.EditText`, THE Inspector SHALL mostrar un campo de texto y un boton "Ingresar Texto" que, al pulsarse, invoque el endpoint `POST /inspector/input-text` del Servidor_Python con el Serial y el texto ingresado.

6. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/input-text` que ejecuta `adb_tap(serial, x, y)` para enfocar el campo y luego `adb_input_text(serial, text)`.

7. WHEN hay un Nodo seleccionado con `scrollable: true`, THE Inspector SHALL mostrar botones "Scroll Arriba" y "Scroll Abajo" que, al pulsarse, invoquen el endpoint `POST /inspector/scroll` del Servidor_Python con el Serial, las coordenadas del Nodo y la direccion.

8. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/scroll` que ejecuta un swipe ADB desde el borde inferior al superior del Nodo para scroll arriba, o desde el borde superior al inferior para scroll abajo, con duracion de 400 ms.

9. IF cualquier accion ADB falla, THEN THE Inspector SHALL intentar mostrar el mensaje de error devuelto por el Servidor_Python en un toast de color `#FF4444` durante 3000 ms; IF el mecanismo de toast no esta disponible, THEN THE Inspector SHALL mostrar el error en el Panel_Propiedades como texto de color `#FF4444`, sin bloquear la UI en ningun caso.

10. WHEN una accion ADB se ejecuta exitosamente, THE Inspector SHALL mostrar un toast de confirmacion de color `#00F5D4` durante 1500 ms y, si el Arbol_UI estaba visible, ofrecer un boton "Refrescar UI" para capturar el nuevo estado.

---

### Requirement 7: Barra de Busqueda de Elementos

**User Story:** Como desarrollador, quiero buscar elementos en el arbol por texto, resourceId o clase, de modo que pueda localizar rapidamente el elemento que necesito sin recorrer el arbol manualmente.

#### Acceptance Criteria

1. THE Inspector SHALL mostrar una barra de busqueda en la parte superior del panel del Arbol_UI con un campo de texto y un selector de criterio (opciones: "Texto", "ResourceId", "Clase").

2. WHEN el usuario escribe en la barra de busqueda con al menos 2 caracteres, THE Inspector SHALL filtrar el Arbol_UI en tiempo real (con debounce de 300 ms) y resaltar los Nodos que coincidan con el criterio seleccionado usando fondo `rgba(0, 245, 212, 0.2)`.

3. WHEN la busqueda produce resultados, THE Inspector SHALL mostrar el contador "N resultados" junto a la barra de busqueda y habilitar botones de navegacion "Anterior" y "Siguiente" para recorrer los resultados.

4. WHEN el usuario navega entre resultados con los botones "Anterior" / "Siguiente", THE Inspector SHALL seleccionar el Nodo correspondiente, expandir su rama en el arbol, desplazar el arbol para hacerlo visible y actualizar el Highlight_Overlay en el Preview_Canvas.

5. IF la busqueda no produce resultados porque ningun Nodo coincide con el termino, THEN THE Inspector SHALL mostrar el mensaje "Sin resultados para '[termino]'" junto a la barra de busqueda y limpiar cualquier Highlight_Overlay previo.

6. IF la busqueda produce coincidencias iniciales que luego quedan inaccesibles (por ejemplo, el Arbol_UI fue actualizado durante la busqueda), THEN THE Inspector SHALL mostrar el mensaje "Los elementos encontrados ya no estan disponibles — recaptura el arbol UI" y limpiar los resaltados.

7. WHEN el usuario borra el contenido de la barra de busqueda, THE Inspector SHALL restaurar el Arbol_UI completo sin filtros y limpiar los resaltados de busqueda, manteniendo el Nodo previamente seleccionado si aun existe.

---

### Requirement 8: Modo Fallback — Busqueda Ciega

**User Story:** Como desarrollador, quiero poder buscar y actuar sobre elementos de la UI incluso cuando la pantalla no se puede capturar (apps con FLAG_SECURE), de modo que pueda automatizar interacciones en apps protegidas.

#### Acceptance Criteria

1. THE Inspector SHALL mostrar un boton "Modo Fallback" en la barra de herramientas del Inspector que, al activarse, muestre el panel de Busqueda_Ciega en lugar del Preview_Canvas.

2. WHEN Modo_Fallback esta activo, THE Inspector SHALL mostrar un campo de texto con placeholder "Buscar por texto, resourceId o clase..." y un boton "Buscar en UI".

3. WHEN el usuario pulsa "Buscar en UI", THE Inspector SHALL invocar el endpoint `POST /inspector/blind-search` del Servidor_Python con el Serial y el termino de busqueda, y mostrar los resultados en una lista.

4. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/blind-search` que ejecuta `dump_ui(serial)` y devuelve todos los Nodos cuyo `text`, `resourceId` o `class` contengan el termino de busqueda (comparacion case-insensitive), incluyendo sus atributos completos y coordenadas del centro. El endpoint SHALL devolver `{"ok": true, "results": []}` cuando el dump es exitoso pero no hay coincidencias.

5. WHEN la busqueda ciega devuelve resultados, THE Inspector SHALL mostrar cada resultado como una tarjeta con: `class` (nombre corto), `text`, `resourceId`, coordenadas del centro (`centerX`, `centerY`) y los atributos `clickable`, `enabled`.

6. WHEN la busqueda ciega devuelve resultados, THE Inspector SHALL mostrar junto a cada resultado un boton "Tap" que, al pulsarse, invoque `POST /inspector/tap` con las coordenadas del centro del Nodo, sin necesitar Preview_Canvas.

7. IF `dump_ui(serial)` falla durante una Busqueda_Ciega (por ejemplo, pantalla bloqueada o app con FLAG_SECURE en el dump), THEN THE Servidor_Python SHALL devolver un error descriptivo y THE Inspector SHALL mostrar el mensaje "No se pudo capturar el arbol UI. La app puede estar bloqueando uiautomator." con sugerencias de alternativas.

8. WHEN Modo_Fallback esta activo, THE Inspector SHALL mostrar un aviso visual "Modo Fallback activo — sin preview de pantalla" con fondo `#1a1a1a` y borde `#006F4F` para indicar claramente el estado al operador.

9. WHEN el usuario desactiva Modo_Fallback, THE Inspector SHALL restaurar el Preview_Canvas y el Arbol_UI al estado previo a la activacion del fallback.

---

### Requirement 9: Nuevos Endpoints del Servidor Python

**User Story:** Como desarrollador del sistema, quiero que el Servidor_Python exponga endpoints REST dedicados para el Inspector, de modo que el Electron_Renderer pueda invocar operaciones de inspeccion de forma estructurada y sin acoplar logica ADB al frontend.

#### Acceptance Criteria

1. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/dump` que acepta `{"serial": "192.168.1.XX:5555"}` y devuelve `{"ok": true, "nodes": [...], "xml": "..."}` donde `nodes` es la lista plana de todos los Nodos con sus atributos completos.

2. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/tap` que acepta `{"serial": "...", "x": N, "y": N}` y devuelve `{"ok": true}` o `{"ok": false, "error": "..."}`.

3. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/long-press` que acepta `{"serial": "...", "x": N, "y": N, "duration": N}` donde `duration` es opcional con valor por defecto 800 ms.

4. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/input-text` que acepta `{"serial": "...", "x": N, "y": N, "text": "..."}` y ejecuta tap para enfocar antes de ingresar el texto.

5. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/scroll` que acepta `{"serial": "...", "x": N, "y1": N, "y2": N, "direction": "up"|"down"}`.

6. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/blind-search` que acepta `{"serial": "...", "query": "...", "field": "any"|"text"|"resourceId"|"class"}` y devuelve `{"ok": true, "results": [...]}`.

7. IF cualquier endpoint del Inspector recibe un `serial` que no corresponde a un dispositivo `online`, THEN THE Servidor_Python SHALL devolver HTTP 404 con `{"error": "Dispositivo no encontrado o no conectado: [serial]"}`.

8. THE Servidor_Python SHALL validar que el campo `serial` no este vacio en todos los endpoints del Inspector y devolver HTTP 400 con `{"error": "El campo serial es requerido"}` si esta ausente o vacio.

---

### Requirement 10: Estetica y Experiencia Visual del Inspector

**User Story:** Como operador del dashboard, quiero que el Inspector tenga una estetica profesional y coherente con el resto del dashboard, de modo que la herramienta se sienta integrada y no como un modulo externo.

#### Acceptance Criteria

1. THE Inspector SHALL usar exclusivamente la paleta de colores definida: fondo de paneles `#000000`, acentos primarios `#00F5D4`, acentos secundarios `#006F4F`, texto principal `#E0E0E0`, texto secundario `#888888`, bordes de paneles `rgba(0, 245, 212, 0.2)`.

2. THE Inspector SHALL organizar su layout en tres paneles horizontales: panel izquierdo para el Arbol_UI (30% del ancho), panel central para el Preview_Canvas (40% del ancho) y panel derecho para el Panel_Propiedades y acciones (30% del ancho).

3. THE Inspector SHALL usar fuente monoespaciada (`font-family: 'Courier New', monospace`) para los valores de atributos en el Panel_Propiedades y para los nombres de clase en el Arbol_UI.

4. WHEN el usuario pasa el cursor sobre un Nodo en el Arbol_UI, THE Inspector SHALL resaltar ese Nodo con fondo `rgba(0, 111, 79, 0.3)` y dibujar un Highlight_Overlay provisional (con opacidad 0.5) en el Preview_Canvas sin cambiar la seleccion activa.

5. THE Toggle_Modo SHALL usar una animacion de tipo "pill slider" donde el indicador se desliza horizontalmente entre las posiciones "Normal" y "Dev" con transicion `ease-in-out` de 250 ms, usando `#00F5D4` como color del indicador activo.

6. THE Inspector SHALL respetar la directiva CSS `prefers-reduced-motion`: cuando esta activa, todas las animaciones del Inspector (transiciones, highlights, toasts) SHALL reducirse a cambios instantaneos sin interpolacion, con excepcion de los spinners de carga que SHALL mantenerse activos para indicar el estado del sistema independientemente de esta preferencia.

7. THE Inspector SHALL mostrar los separadores entre paneles como lineas de 1 px de color `#006F4F` con opacidad 0.6, sin sombras ni efectos adicionales que aumenten el peso visual.

8. WHEN el Inspector esta cargando datos (dump UI, acciones ADB), THE Inspector SHALL mostrar un spinner SVG animado de color `#00F5D4` en el panel correspondiente, sin bloquear los otros paneles.

---

### Requirement 11: Sistema de Modos de Deteccion — Selector y Arquitectura

**User Story:** Como desarrollador, quiero elegir entre multiples metodos de deteccion de UI organizados en categorias Nativa y Web, de modo que pueda usar la tecnica mas adecuada segun el tipo de app que estoy inspeccionando.

#### Acceptance Criteria

1. THE Inspector SHALL mostrar un Selector_Deteccion en la barra de herramientas, con dos pestanas principales: "Nativa" y "Web", cada una con un submenu desplegable que lista los metodos disponibles dentro de esa categoria.

2. WHEN el usuario selecciona un Modo_Deteccion, THE Inspector SHALL persistir la seleccion en `localStorage` bajo la clave `flowdashboard.inspector.detectionMode` y aplicarla inmediatamente a la proxima captura de UI.

3. THE Selector_Deteccion SHALL mostrar junto a cada metodo un indicador de disponibilidad: verde si el metodo esta disponible para el dispositivo seleccionado, amarillo si requiere configuracion adicional, rojo si no esta disponible.

4. WHEN el usuario cambia de Modo_Deteccion, THE Inspector SHALL limpiar el Arbol_UI actual y mostrar el mensaje "Modo de deteccion cambiado a [nombre]. Captura el arbol UI para continuar." sin ejecutar automaticamente una nueva captura.

5. THE Motor_Deteccion SHALL intentar cada metodo en orden de prioridad cuando el metodo seleccionado falla, notificando al usuario con el mensaje "Metodo [nombre] fallo — usando [fallback] como alternativa."

---

### Requirement 12: Deteccion Nativa — Metodos ADB Directos

**User Story:** Como desarrollador, quiero usar metodos de deteccion que operan directamente sobre el sistema Android via ADB, de modo que pueda inspeccionar cualquier app nativa sin depender de tecnologias web.

#### Acceptance Criteria

1. THE Motor_Deteccion SHALL implementar el metodo **UIAutomator Dump** (predeterminado): ejecuta `adb shell uiautomator dump /sdcard/window.xml` y parsea el XML resultante. Este metodo es el mas compatible y funciona en Android 4.3+.

2. THE Motor_Deteccion SHALL implementar el metodo **Accessibility Service Dump**: usa el `FlowAccessibilityService` ya instalado en el APK para obtener el arbol de accesibilidad via el endpoint `POST /inspector/accessibility-dump`. Este metodo funciona incluso cuando `uiautomator` esta bloqueado por la app, ya que opera a nivel de sistema.

3. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/accessibility-dump` que envia el comando `get_accessibility_tree` al APK FlowAgent via el socket existente en puerto 8766 y devuelve el arbol de accesibilidad como JSON.

4. THE Motor_Deteccion SHALL implementar el metodo **Dumpsys Window**: ejecuta `adb shell dumpsys window windows` para obtener informacion de las ventanas activas, paquete en foco y actividad actual. Util cuando `uiautomator dump` falla por pantalla en negro o transicion de actividad.

5. THE Motor_Deteccion SHALL implementar el metodo **View Server (DDMS)**: activa el ViewServer en el dispositivo via `adb shell service call window 1 i32 4939` y se conecta al puerto 4939 via `adb forward` para obtener el arbol de vistas con coordenadas exactas. Requiere que la app tenga `debuggable: true`.

6. THE Motor_Deteccion SHALL implementar el metodo **Screencap + OCR**: captura la pantalla via `adb exec-out screencap -p`, aplica deteccion de texto con Tesseract OCR (si esta disponible en el PC) para identificar elementos de texto visibles y sus posiciones aproximadas. Util como ultimo recurso cuando todos los metodos de dump fallan.

7. THE Motor_Deteccion SHALL implementar el metodo **ADB Shell WM**: ejecuta `adb shell wm size` y `adb shell wm density` para obtener la resolucion y densidad reales del dispositivo, usados para calibrar el escalado del Highlight_Overlay.

8. THE Motor_Deteccion SHALL implementar el metodo **Package Manager Inspect**: ejecuta `adb shell pm dump [package]` para obtener metadatos del paquete activo: version, permisos declarados, actividades, servicios y receivers. Util para entender la estructura de la app antes de inspeccionar.

9. THE Motor_Deteccion SHALL implementar el metodo **Logcat Filter**: ejecuta `adb logcat -d -v brief` con filtros por tag o mensaje para capturar logs recientes de la app activa. Util para correlacionar acciones de UI con eventos en el log.

10. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/native-detect` que acepta `{"serial": "...", "method": "uiautomator"|"accessibility"|"dumpsys"|"viewserver"|"screencap_ocr"|"wm"|"pm_dump"|"logcat", "options": {}}` y devuelve el resultado normalizado al formato de Nodos del Inspector.

---

### Requirement 13: Deteccion Web — Metodos para WebView y Contenido HTML

**User Story:** Como desarrollador, quiero usar metodos de deteccion especializados para apps que usan WebView o tecnologias hibridas (React Native, Ionic, Cordova), de modo que pueda inspeccionar el DOM y los elementos web igual que en un navegador.

#### Acceptance Criteria

1. THE Motor_Deteccion SHALL implementar el metodo **Chrome DevTools Protocol (CDP)**: habilita la depuracion remota de WebView via `adb forward tcp:9222 localabstract:chrome_devtools_remote`, se conecta al endpoint CDP y usa el dominio `DOM.getDocument` para obtener el arbol DOM completo del WebView activo.

2. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/cdp-connect` que ejecuta `adb forward tcp:9222 localabstract:chrome_devtools_remote` para el serial dado y devuelve la lista de targets CDP disponibles en `http://localhost:9222/json`.

3. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/cdp-dump` que acepta `{"serial": "...", "target_id": "..."}` y usa el protocolo CDP para obtener el arbol DOM completo del target seleccionado, normalizandolo al formato de Nodos del Inspector con atributos: `tagName`, `id`, `className`, `textContent`, `href`, `src`, `type`, `value`, `disabled`, `hidden`, `bounds` (calculados via `getBoundingClientRect`).

4. THE Motor_Deteccion SHALL implementar el metodo **WebView JavaScript Injection**: inyecta un script JS en el WebView via CDP `Runtime.evaluate` que serializa el DOM completo con `document.querySelectorAll('*')` y devuelve los elementos con sus atributos y posiciones via `getBoundingClientRect()`.

5. THE Motor_Deteccion SHALL implementar el metodo **React Native Inspector**: detecta si la app usa React Native verificando la presencia del bundle `index.android.bundle` via `adb shell ls /data/data/[package]/files/`. Si se confirma, usa CDP para conectarse al debugger de React Native y obtener el arbol de componentes con sus props y estado.

6. THE Motor_Deteccion SHALL implementar el metodo **Ionic/Cordova WebView**: detecta apps Ionic/Cordova verificando el archivo `config.xml` o el paquete `io.ionic.*` via `adb shell pm list packages`. Si se confirma, usa CDP para inspeccionar el WebView principal y mapea los componentes Ionic a Nodos del Inspector.

7. THE Motor_Deteccion SHALL implementar el metodo **Flutter Inspector**: detecta apps Flutter verificando la presencia del engine `libflutter.so` via `adb shell ls /data/app/[package]/lib/`. Si se confirma, usa el protocolo Dart VM Service (puerto 8181 via `adb forward`) para obtener el arbol de widgets Flutter con sus propiedades.

8. THE Motor_Deteccion SHALL implementar el metodo **Network Intercept (mitmproxy)**: si mitmproxy esta disponible en el PC, configura el proxy en el dispositivo via `adb shell settings put global http_proxy [PC_IP]:8080` e intercepta el trafico HTTP/HTTPS de la app para identificar endpoints de API y estructura de datos. Util para apps que cargan contenido dinamico.

9. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/web-detect` que acepta `{"serial": "...", "method": "cdp"|"js_inject"|"react_native"|"ionic"|"flutter"|"network_intercept", "options": {}}` y devuelve el resultado normalizado al formato de Nodos del Inspector.

10. WHEN el metodo CDP esta activo y el WebView no tiene depuracion habilitada, THE Inspector SHALL mostrar el mensaje "WebView debugging no habilitado. Activa android:debuggable=true en el AndroidManifest o usa un build de debug." con un boton "Intentar habilitar via ADB" que ejecute `adb shell setprop debug.webview.provider com.android.webview`.

---

### Requirement 14: Panel de Seleccion de Modo de Deteccion — UI

**User Story:** Como desarrollador, quiero una interfaz clara y visual para seleccionar y configurar el modo de deteccion activo, de modo que pueda cambiar de metodo rapidamente y entender el estado de cada uno.

#### Acceptance Criteria

1. THE Selector_Deteccion SHALL renderizarse como un panel horizontal en la barra de herramientas del Inspector, con dos grupos de botones: grupo "Nativa" (icono de chip/CPU) y grupo "Web" (icono de globo/navegador), cada grupo con un color de acento diferente: `#00F5D4` para Nativa y `#a78bfa` para Web.

2. WHEN el usuario expande un grupo en el Selector_Deteccion, THE Inspector SHALL mostrar los metodos disponibles como chips seleccionables con: nombre corto del metodo, icono representativo, indicador de disponibilidad (punto de color) y tooltip con descripcion al hacer hover.

3. THE Selector_Deteccion SHALL mostrar el metodo activo actualmente con fondo `rgba(0, 245, 212, 0.2)` y borde `#00F5D4` para metodos Nativos, o fondo `rgba(167, 139, 250, 0.2)` y borde `#a78bfa` para metodos Web.

4. WHEN el usuario hace hover sobre un metodo en el Selector_Deteccion, THE Inspector SHALL mostrar un tooltip con: nombre completo del metodo, descripcion de una linea, requisitos (ej. "Requiere app debuggable"), y compatibilidad (ej. "Android 4.3+").

5. THE Inspector SHALL mostrar en la barra de herramientas el nombre del metodo activo como etiqueta compacta junto al Selector_Deteccion, actualizada en tiempo real cuando cambia el metodo.

6. THE Inspector SHALL mostrar un boton "Auto-detectar" que, al pulsarse, ejecute el endpoint `POST /inspector/auto-detect` del Servidor_Python para determinar automaticamente el mejor metodo disponible para el dispositivo y app activos, y lo seleccione sin intervencion del usuario.

7. THE Servidor_Python SHALL exponer el endpoint `POST /inspector/auto-detect` que prueba los metodos en orden de prioridad (uiautomator → accessibility → cdp → dumpsys → screencap_ocr) y devuelve el primer metodo que produce un arbol de UI valido con al menos 1 nodo, junto con el tiempo de respuesta de cada metodo probado.

---

### Requirement 15: Normalizacion de Resultados entre Metodos de Deteccion

**User Story:** Como desarrollador del sistema, quiero que todos los metodos de deteccion devuelvan datos en el mismo formato, de modo que el Inspector pueda mostrar y operar sobre cualquier resultado sin logica especifica por metodo.

#### Acceptance Criteria

1. THE Motor_Deteccion SHALL normalizar el resultado de todos los metodos al formato de Nodo unificado con los campos: `id` (unico por nodo en la captura), `type` (nativo|web), `method` (nombre del metodo que lo genero), `class` o `tagName`, `text`, `resourceId` o `domId`, `bounds` (`{left, top, right, bottom, width, height}`), `centerX`, `centerY`, `clickable`, `enabled`, `focusable`, `scrollable`, `children` (lista de ids de hijos), `parent` (id del padre), `depth`, `attributes` (mapa de atributos adicionales especificos del metodo).

2. THE Motor_Deteccion SHALL calcular `centerX` y `centerY` en coordenadas nativas del dispositivo para todos los metodos, incluyendo los metodos Web donde las coordenadas originales son relativas al WebView.

3. WHEN un metodo Web devuelve coordenadas relativas al WebView, THE Motor_Deteccion SHALL transformarlas a coordenadas absolutas del dispositivo sumando el offset del WebView obtenido via `uiautomator dump` o via CDP `DOM.getBoxModel`.

4. THE Motor_Deteccion SHALL incluir en cada Nodo el campo `detectionSource` con el nombre del metodo que lo genero, para que el Panel_Propiedades pueda mostrarlo y el usuario sepa el origen de cada elemento.

5. IF un metodo devuelve nodos sin `bounds` validos (ej. elementos ocultos en React Native), THE Motor_Deteccion SHALL asignar `bounds: null` y `centerX: null`, `centerY: null`, y THE Inspector SHALL mostrar esos nodos en el Arbol_UI con un icono de advertencia y deshabilitar las acciones de tap/scroll para ellos.
