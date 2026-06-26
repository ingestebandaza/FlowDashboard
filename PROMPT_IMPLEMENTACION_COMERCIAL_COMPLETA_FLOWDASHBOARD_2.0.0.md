IMPLEMENTACIÓN COMERCIAL COMPLETA DE FLOWDASHBOARD 2.0.0

Vas a trabajar sobre el proyecto real FlowDashboard ubicado en:

C:\DASHBOARD\FlowDashboard

Tu misión general es preparar FlowDashboard para su distribución comercial profesional, manteniendo intacto su funcionamiento actual y construyendo una arquitectura instalable, actualizable, segura, documentada y reproducible.

No debes realizar cambios inmediatamente.

Primero debes estudiar el proyecto, comprobar su ejecución real y presentar el análisis inicial solicitado al final de este mensaje.

1. DOCUMENTOS OBLIGATORIOS

Antes de realizar cualquier acción, lee completamente y en este orden:

AGENTS.md

PROJECT_CONTEXT.md

docs/master_technical_specification.md

PLAN_MAESTRO_IMPLEMENTACION_COMERCIAL_FLOWDASHBOARD_2.0.0.md

ANEXO_CONTROL_COHERENCIA_CODIGO_RUNTIME_DOCUMENTACION.md

Los dos últimos documentos forman un único contrato técnico:

El Plan Maestro define la arquitectura, las fases, los entregables y el orden de implementación.

El Anexo define las reglas obligatorias para mantener coherencia entre código, runtime, documentación, archivos canónicos y archivos legacy.

No omitas ninguna sección.

No resumas esos documentos superficialmente. Debes comprenderlos y aplicar todas sus reglas.

2. FUENTES DE VERDAD

Las fuentes de verdad iniciales son:

código real del repositorio;

ejecución real mediante el launcher oficial;

AGENTS.md;

PROJECT_CONTEXT.md;

docs/master_technical_specification.md;

PLAN_MAESTRO_IMPLEMENTACION_COMERCIAL_FLOWDASHBOARD_2.0.0.md;

ANEXO_CONTROL_COHERENCIA_CODIGO_RUNTIME_DOCUMENTACION.md.

No consideres verdadero algo solamente porque esté escrito en un documento.

Siempre debes contrastar:

documentación;

código;

ejecución real;

procesos;

puertos;

endpoints;

archivos realmente cargados.

Cuando exista una contradicción, el código y la ejecución real tienen prioridad, pero la contradicción debe documentarse y corregirse.

3. DOCUMENTACIÓN PROHIBIDA COMO FUENTE

No leas, no uses y no tomes como referencia técnica:

C:\DASHBOARD\FlowDashboard\DOCUMENTACION_TECNICA.md

Debe clasificarse posteriormente como:

STATUS: PROHIBITED-AS-SOURCE

No bases ninguna decisión en ese documento.

4. PRODUCTO VIGENTE

El producto vigente es el Dashboard Electron que actualmente se inicia mediante:

C:\DASHBOARD\FlowDashboard\abrir_electron.bat

Ese archivo es la única entrada oficial de desarrollo y validación durante la transición.

No abras Electron directamente.

No uses otro launcher para validar el funcionamiento vigente.

Todas las pruebas del producto actual deben comenzar mediante:

abrir_electron.bat

5. COMPONENTES ANTIGUOS QUE NO DEBEN TRATARSE COMO PRODUCTO VIGENTE

No consideres vigentes ni uses como base del producto actual:

FlowDashboard.exe

launcher.py

launcher.spec antiguo

wsapi_demo.html

wsapi.js

updater.py

Crearexe.bat

CrearActualizacion.bat

launchers antiguos

actualizador Python antiguo

dashboard antiguo basado en navegador

documentos de instrucciones antiguos

scripts temporales

hotfixes no verificados

experimentos

spikes

archivos de prueba

SQL destructivos como procedimiento normal

Estos archivos no deben borrarse inicialmente.

Deben:

buscarse sus referencias;

comprobarse sus consumidores;

clasificarse;

documentarse;

moverse a archive/ solo cuando se demuestre que no participan en el runtime;

registrarse en archive/LEGACY_INDEX.md;

conservar un procedimiento de rollback.

Nunca archives o elimines un archivo únicamente por su nombre, fecha o apariencia.

Los archivos desconocidos deben clasificarse como:

UNKNOWN

Un archivo UNKNOWN no se mueve ni se elimina.

6. COMPONENTES PROTEGIDOS

Durante esta implementación comercial no modifiques, reescribas, sustituyas, refactorices ni “mejores” los siguientes componentes:

stream-renderer-h264.js

scrcpy_raw_streamer.py

scrcpy_raw_ws_server.py

scrcpy_control_channel.py

protocolo FDH1

parser H.264

WebCodecs

sesiones Grid

sesiones Focus

CoordinateMapper

taps

swipes

drag

live touch

Back

Home

Recents

wake preflight

presets Eco/Balanced/Pro

control principal mediante scrcpy-control

fallback ADB existente

manejo actual de keyframes

pipeline de vídeo

lógica de reconexión salvo fase específica aprobada

Solo podrás modificar alguno de esos componentes si:

existe una incidencia independiente demostrada;

presentas evidencia;

propones una fase específica;

creas restore point;

obtienes aprobación expresa del propietario.

La implementación comercial no puede utilizarse como excusa para reescribir el motor de vídeo o control.

7. REGLAS FUNCIONALES QUE DEBEN CONSERVARSE

El sistema debe seguir funcionando con una cantidad variable de dispositivos.

No asumas:

16 dispositivos;

17 dispositivos;

IPs concretas;

rangos de red concretos;

seriales concretos;

un único método de conexión;

una única resolución;

una única versión Android.

Debe conservarse:

Grid;

Focus;

vídeo H.264;

control táctil;

taps;

swipes;

Back/Home/Recents;

conexión USB;

conexión Wi-Fi ADB;

agrupación de transportes;

preferencias Auto/USB/Wi-Fi;

control principal scrcpy-control;

fallback ADB;

FlowAgent para Automation;

separación Control/Automation/Inspección;

OCR solo bajo selección;

MediaProjection solo bajo selección;

FlowKeyboard;

FlowLogin;

FlowMail;

Inspector;

FlowTrackName;

grabación;

herramientas;

persistencia de nombres, grupos y configuraciones.

No actives automáticamente:

Accessibility;

MediaProjection;

OCR;

FlowAgent;

IME;

captura de pantalla;

por el simple hecho de abrir Grid o Focus.

8. REGLAS CONTRA HARDCODEO

No hardcodees:

IPs;

cantidad de dispositivos;

seriales;

Android IDs;

nombres de usuarios Windows;

rutas personales;

rutas como C:\Users\...;

ubicación de Python del desarrollador;

rangos de red;

tokens;

claves;

secretos;

fechas;

versión en múltiples archivos;

rutas de instalación;

rutas de datos;

puertos sin una fuente central de configuración.

Debes crear resolutores de rutas y configuración explícitos.

9. DECISIONES COMERCIALES CERRADAS

Producto

Nombre: FlowDashboard
Publisher: FlowDashboard
Primera versión comercial: 2.0.0

Plataforma

Inicialmente:

Windows 10 x64

Windows 11 x64

No implementar inicialmente:

Windows x86;

Windows ARM;

macOS;

Linux;

Microsoft Store.

Experiencia del cliente

El cliente debe ejecutar un único instalador:

FlowDashboard-Setup-2.0.0.exe

Después debe abrir FlowDashboard desde:

escritorio;

menú Inicio.

El cliente no debe instalar manualmente:

Python;

pip;

.NET;

Node.js;

npm;

Electron;

Java;

ADB;

scrcpy.

Instalación

Electron Builder;

NSIS;

instalación por usuario;

acceso directo en escritorio;

acceso directo en menú Inicio;

un solo instalador EXE;

sin requerir permisos administrativos para el uso normal;

conservar datos en la desinstalación por defecto;

permitir borrado total únicamente mediante una opción explícita.

10. ARQUITECTURA OBJETIVO

Desarrollo

Durante la transición:

abrir_electron.bat
  -> abrir_electron.ps1
  -> Electron fuente
  -> Python fuente
  -> C# mediante SDK
  -> ADB/scrcpy local

Producción

La aplicación instalada debe funcionar así:

FlowDashboard.exe
  -> RuntimeManager de Electron
      -> FlowDashboard.Backend.exe
      -> FlowDashboard.Core.exe
      -> adb.exe
      -> scrcpy.exe
      -> scrcpy-server.jar
      -> FlowAgent APK
      -> FlowTrackName.exe

El cliente no ejecutará:

archivos BAT;

PowerShell;

Python;

dotnet run;

npm;

Electron de desarrollo.

11. PYTHON

El backend Python debe empaquetarse con PyInstaller en modo:

onedir

Entrada principal:

local_adb_server.py

Artefacto esperado:

FlowDashboard.Backend.exe

Debe incluir:

intérprete Python;

módulos;

DLL necesarias;

dependencias;

módulos internos;

importaciones dinámicas;

recursos necesarios.

No debe incluir:

.supabase_config.json;

service role;

CAPSOLVER_API_KEY;

claves;

contraseñas;

datos de dispositivos;

logs;

grabaciones;

SQL;

panel administrativo.

El backend empaquetado debe funcionar en un Windows limpio sin Python instalado.

No distribuyas un Python portable suelto como solución comercial definitiva.

El Python portable o toolchain local puede utilizarse únicamente para build/desarrollo si es necesario.

12. C#

El backend C# debe publicarse como:

win-x64
self-contained

No debe depender de .NET instalado en el PC del cliente.

Inicialmente no actives:

trimming;

Native AOT;

single file;

ReadyToRun;

hasta validar completamente el runtime convencional.

El backend debe escuchar únicamente en loopback.

Debe mantener:

MailKit;

MimeKit;

DPAPI;

SignalR si sigue siendo utilizado;

controladores;

endpoints;

FlowMail;

servicios vigentes.

Debe utilizar rutas de datos externas a la carpeta de instalación.

13. FLOWMAIL HELPER

Debes auditar:

FlowDashboard.Core/Services/flowmail_imap_helper.py

Si C# sigue dependiendo de ese helper Python, la estrategia inicial es empaquetarlo como:

FlowDashboard.MailHelper.exe

Debe mantener el contrato actual mediante stdin/stdout.

No debe depender de un python.exe instalado.

No lo integres dentro del backend principal sin demostrar primero que no cambia el flujo real.

14. ADB Y SCRCPY

La fuente canónica es:

scrcpy-win64-v4.0

Debe incluirse dentro de la aplicación instalada.

Como mínimo:

adb.exe

AdbWinApi.dll

AdbWinUsbApi.dll

scrcpy.exe

scrcpy-server.jar

DLL oficiales necesarias

licencias y avisos

No uses copias redundantes de la raíz.

No actualices scrcpy durante la primera implementación comercial.

Empaqueta exactamente la versión que ya está funcionando.

15. FLOWAGENT

El APK canónico detectado es:

flow_agent_monolito/app/build/outputs/apk/app/release/agent-v1.0.0-arm64-v8a.apk

Versión esperada:

versionName: 1.0.0
versionCode: 106

Verifica esta información antes de empaquetar.

No incluyas el proyecto Android completo en el instalador.

No incluyas:

caches Gradle;

APK debug;

builds temporales;

AutoJs6 standalone;

APK duplicados;

código fuente Android.

Debes determinar con evidencia si arm64-v8a cubre todos los dispositivos que se comercializarán.

No asumas compatibilidad universal.

Si hace falta un APK universal, debes proponerlo como cambio separado y validarlo.

16. FLOWTRACKNAME

Solo existe:

Herramientas\FlowTrackName.exe

No existe código fuente.

FlowTrackName:

se incluye en todos los planes;

se incluye en todas las builds comerciales;

no es un diferenciador entre planes;

no debe modificarse;

debe validarse por existencia, tamaño y SHA-256;

debe probarse en Windows limpio;

debe actualizarse reemplazando el binario completo.

No intentes inyectar validación interna.

17. PANEL ADMINISTRATIVO

license_admin.html:

no debe incluirse en el instalador del cliente;

permanece en el PC personal del propietario;

debe ser protegido mediante Supabase Auth, RLS y rol administrativo;

no debe depender únicamente de controles de frontend.

No distribuyas:

SQL administrativos;

migraciones administrativas;

service role;

credenciales;

panel administrativo;

archivos de configuración privada.

18. LICENCIAS

Las licencias deben:

validar email y clave;

exigir coincidencia del email con la licencia;

validar estado;

validar fechas;

validar plan;

validar instalación;

validar límites;

autoaprobar PCs nuevos hasta alcanzar el límite;

separar límites de PC y Android;

conservar historial;

permitir desvincular;

permitir bloquear;

permitir revocar;

permitir renovar;

permitir overrides.

Offline

Permitir hasta:

72 horas

desde la última validación correcta.

Gracia tras vencimiento

Permitir:

48 horas

después de la fecha de vencimiento.

Después de la gracia

Aplicar bloqueo completo controlado:

no cargar Grid;

no cargar Focus;

no iniciar streams;

no permitir control;

no permitir automatizaciones;

no borrar datos;

no borrar configuración;

permitir volver a validar;

permitir buscar actualizaciones;

permitir contacto;

permitir cerrar.

Licencias actuales

Las tres licencias existentes son del propietario y de prueba.

Deben migrarse inicialmente a:

Legacy Full Access

No modificar automáticamente los dos registros legacy con email discordante.

19. SUPABASE

Estado conocido:

RPC actual de 13 parámetros:validate_flowdashboard_license

función antigua:check_app_license

RLS desactivado en tablas actuales;

permisos amplios para authenticated;

tablas actuales:

app_licenses

app_devices

app_device_registrations

app_access_logs

No ejecutes SQL destructivo.

No ejecutes scripts antiguos de limpieza.

No uses:

DROP ... CASCADE como procedimiento normal;

SQL destructivos;

eliminación de datos.

Las migraciones nuevas deben ser:

numeradas;

idempotentes;

reversibles;

auditables;

probadas;

con preflight;

con rollback.

No retires check_app_license hasta demostrar que no existen consumidores.

No distribuyas service role.

El cliente debe utilizar únicamente una clave pública/anon cuando RLS esté correctamente configurado.

20. ACTUALIZACIONES

El actualizador definitivo debe utilizar:

electron-updater

Proveedor inicial:

GitHub Releases

El repositorio seguirá público inicialmente.

El actualizador debe:

buscar actualizaciones al iniciar;

descargar automáticamente;

mostrar progreso;

mostrar versión actual y nueva;

mostrar notas;

ofrecer Reiniciar ahora;

ofrecer Más tarde;

no interrumpir operaciones críticas;

detener backends correctamente;

instalar;

reiniciar;

verificar health;

conservar todos los datos.

Debe soportar:

stable;

beta.

Las actualizaciones deben funcionar incluso cuando la licencia esté vencida o bloqueada.

No utilices como sistema definitivo:

updater.py;

update.json antiguo;

ZIP + robocopy;

CrearActualizacion.bat.

Estos deben archivarse como legacy después de verificar consumidores.

Las releases deben crearse inicialmente como draft.

Solo después de pruebas y aprobación deben publicarse.

21. ORGANIZACIÓN DEL REPOSITORIO

Debes crear progresivamente:

docs/current/
docs/commercial/
docs/architecture/

archive/legacy-dashboard/
archive/legacy-updater/
archive/legacy-sql/
archive/legacy-launchers/
archive/experiments/

scripts/dev/
scripts/build/
scripts/release/
scripts/diagnostics/

build/runtime/
build/staging/
release_packages/

No reorganices todo de una sola vez.

No rompas rutas vigentes.

Antes de mover cada archivo:

busca referencias;

identifica consumidores;

clasifica;

documenta;

crea rollback;

mueve;

valida el launcher oficial.

22. DOCUMENTACIÓN CANÓNICA

Debes crear y mantener:

docs/current/CURRENT_ARCHITECTURE.md

docs/current/REPOSITORY_MAP.md

docs/current/DEVELOPMENT_START.md

docs/current/BUILD_AND_RELEASE.md

docs/current/SECURITY.md

docs/current/RUNTIME_CODE_DOCUMENTATION_MATRIX.md

archive/LEGACY_INDEX.md

Cada documento debe incluir:

STATUS:
Last verified against code:
Last verified against runtime:
Canonical replacement:
Owner:

Estados permitidos:

CURRENT

LEGACY

EXPERIMENTAL

ARCHIVED

PROHIBITED-AS-SOURCE

Un documento sin estado no puede utilizarse como fuente técnica.

23. COHERENCIA ENTRE CÓDIGO, RUNTIME Y DOCUMENTACIÓN

Debes cumplir íntegramente:

ANEXO_CONTROL_COHERENCIA_CODIGO_RUNTIME_DOCUMENTACION.md

No puedes declarar terminada una fase si código, runtime y documentación no describen el mismo sistema.

Debes crear:

scripts/diagnostics/verify-documentation-consistency.ps1

Debe detectar como mínimo:

FlowDashboard.exe descrito como producto vigente;

launcher.py descrito como launcher actual;

updater.py descrito como updater vigente;

wsapi_demo.html descrito como dashboard actual;

versiones contradictorias;

rutas personales;

Python del desarrollador;

dotnet run en producción;

.supabase_config.json dentro del instalador;

SQL destructivo descrito como operación normal;

número fijo de dispositivos;

IPs hardcodeadas;

documentos sin estado;

componentes sin documentación;

rutas legacy en documentación CURRENT.

El script debe fallar con código de salida distinto de cero cuando encuentre contradicciones críticas.

24. CLASIFICACIÓN DE ARCHIVOS

Cada archivo relevante debe clasificarse como:

CANONICAL_RUNTIME

CANONICAL_SOURCE

BUILD_INPUT

GENERATED_ARTIFACT

RUNTIME_DATA

DIAGNOSTIC

EXPERIMENTAL

LEGACY

UNKNOWN

No mover ni borrar archivos UNKNOWN.

25. VERSIONADO

La primera versión oficial unificada es:

2.0.0

Debes crear una única fuente:

version.json

Debe alimentar:

Electron;

Python;

C#;

instalador;

health Python;

health C#;

updater;

nombre de artefactos;

release notes;

manifests.

No debe haber edición manual de la versión en múltiples archivos.

Debes crear:

scripts/release/sync-version.ps1

26. RUTAS Y DATOS

Debes separar:

Aplicación

%LOCALAPPDATA%\Programs\FlowDashboard

Datos

%APPDATA%\FlowDashboard

Los datos deben incluir:

configuración;

nombres de dispositivos;

grupos;

inventarios;

mappings;

licencia;

FlowMail;

logs;

recordings;

cache;

backups;

updates.

Las actualizaciones no pueden borrar datos.

No aceptar nombres arbitrarios desde renderer.

Crear allowlist.

Rechazar:

..;

rutas absolutas;

separadores;

extensiones no permitidas.

Utilizar escritura atómica y backups.

27. RUNTIMEMANAGER

Debes crear:

electron-app/src/main/runtime-manager.js

Responsabilidades:

distinguir desarrollo/producción;

resolver rutas;

iniciar Python;

iniciar C#;

preparar ADB/scrcpy;

health checks;

detectar puertos;

evitar matar procesos ajenos;

reinicios con límite;

logs;

shutdown;

actualizaciones;

errores visibles;

evitar consolas.

El proceso principal de Electron debe gestionar los sidecars en producción.

No debe depender de PowerShell en el cliente.

28. PATH RESOLVER

Debes crear:

electron-app/src/main/path-resolver.js

Debe resolver:

project root;

resources;

runtime;

user data;

logs;

recordings;

scripts;

scrcpy;

FlowAgent;

FlowTrackName;

desarrollo;

producción.

No disperses resolución de rutas por múltiples archivos.

29. INSTALADOR

Utilizar:

electron-builder;

NSIS;

asar;

extraResources;

instalación per-user.

Artefacto:

FlowDashboard-Setup-2.0.0.exe

Debe incluir:

Electron;

Python onedir;

MailHelper;

C# self-contained;

ADB;

scrcpy;

FlowAgent;

FlowTrackName;

scripts vigentes;

recursos;

licencias de terceros.

No debe incluir:

secretos;

panel admin;

SQL;

código fuente Android;

repositorio completo;

logs;

recordings;

restore points;

pruebas;

documentos legacy;

tokens;

certificados.

30. GESTOR AUTOMÁTICO PARA EL PROPIETARIO

Debes crear:

GESTOR_FLOWDASHBOARD.bat

Debe mostrar:

1. Abrir Dashboard en desarrollo
2. Validar proyecto
3. Crear build comercial local
4. Crear versión Beta
5. Crear versión Stable
6. Publicar release preparada
7. Restaurar versión
8. Ver diagnósticos
9. Salir

La lógica principal debe estar en:

scripts/release/release.ps1

El propietario no debe ejecutar comandos manuales separados.

El gestor debe automatizar:

preflight;

restore point;

version bump;

sync version;

pruebas;

build Python;

MailHelper;

publish C#;

recursos;

build Electron;

NSIS;

escaneo de secretos;

hashes;

manifest;

notas;

Git tag;

GitHub draft release;

aprobación;

publicación;

rollback.

Debe detenerse ante cualquier error.

No debe publicar artefactos parciales.

31. SEGURIDAD

No distribuyas:

.supabase_config.json

service role

CAPSOLVER_API_KEY

GitHub token

certificados

claves privadas

passwords

mail passwords

datos de clientes

datos de dispositivos

archivos de licencia administrativa

Debes crear escaneo de secretos previo a releases.

Debes auditar:

CSP;

unsafe-eval;

unsafe-inline;

rutas IPC;

escritura de archivos;

CORS;

puertos;

logs;

variables de entorno;

modo local de licencia.

El modo local de licencia debe quedar deshabilitado en producción.

32. LOGS

Implementar:

rotación;

tamaño máximo;

número máximo;

compresión opcional;

sanitización;

separación por proceso;

exportación diagnóstica;

no registrar secretos;

no registrar contraseñas;

no registrar tokens.

No permitir nuevamente logs de más de 100 MB sin rotación.

33. FIRMA

Preparar pipeline para:

firma del ejecutable;

firma de sidecars cuando corresponda;

firma del instalador;

timestamp;

verificación antes de publicar.

Las builds internas pueden ser unsigned.

Antes del primer cliente externo la build comercial debe ser signed.

No incluir certificados o passwords dentro del repositorio.

34. MANIFIESTO DE BUILD

Cada release debe generar:

release_packages/<version>/build-manifest.json

Debe incluir:

versión;

canal;

commit;

fecha;

publisher;

archivos;

hashes;

tamaños;

versión Electron;

versión Python;

versión C#;

versión scrcpy;

versión ADB;

versión FlowAgent;

hash FlowTrackName;

migraciones;

schema version;

firma;

pruebas.

35. PRUEBAS OBLIGATORIAS

Debes probar:

Desarrollo

abrir_electron.bat;

procesos;

puertos;

health;

dispositivos;

Grid;

Focus;

tap;

swipe;

Back/Home/Recents;

reconexión;

herramientas.

Producción

En Windows limpio:

sin Python;

sin .NET;

sin Node;

sin npm;

sin Java;

instalación;

inicio;

sidecars;

health;

dispositivos;

Grid;

Focus;

control;

FlowAgent;

FlowLogin;

FlowKeyboard;

FlowMail;

Inspector;

OCR bajo selección;

FlowTrackName;

grabación;

actualización;

desinstalación;

conservación de datos.

Licencias

válida;

email incorrecto;

clave incorrecta;

suspendida;

revocada;

vencida;

gracia;

offline;

reloj alterado;

límite PCs;

desvinculación;

bloqueo;

Legacy Full Access;

cambio de plan.

Actualización

stable N a N+1;

beta;

draft;

publicada;

descarga interrumpida;

Más tarde;

Reiniciar ahora;

operación crítica;

licencia vencida;

datos preservados;

fallo;

rollback.

36. ORDEN ESTRICTO DE FASES

Debes seguir estrictamente el Plan Maestro.

Orden:

Fase 0 — Baseline y evidencia.

Fase 1 — Canon y legacy.

Fase 2 — Versionado.

Fase 3 — Rutas y datos.

Fase 4 — RuntimeManager.

Fase 5 — Python.

Fase 6 — C#.

Fase 7 — Recursos.

Fase 8 — Instalador.

Fase 9 — Actualizador.

Fase 10 — Supabase.

Fase 11 — Panel admin.

Fase 12 — Entitlements.

Fase 13 — Gestor de releases.

Fase 14 — Seguridad.

Fase 15 — Validación.

Rollout.

No saltes fases.

No implementes varias fases de una sola vez.

37. REGLAS ANTES DE CADA FASE

Antes de cada fase debes:

crear restore point;

registrar commit;

registrar git status;

listar archivos previstos;

explicar cambios;

explicar riesgos;

definir pruebas;

definir rollback;

esperar aprobación.

No modifiques nada antes de recibir aprobación para esa fase.

38. REGLAS DESPUÉS DE CADA FASE

Al terminar cada fase debes:

detenerte;

listar archivos modificados;

listar archivos creados;

listar archivos archivados;

explicar cambios exactos;

mostrar evidencia;

mostrar pruebas;

mostrar resultados;

actualizar documentación CURRENT;

actualizar REPOSITORY_MAP.md;

actualizar la matriz;

actualizar LEGACY_INDEX.md;

ejecutar el escáner de contradicciones;

documentar rollback;

esperar aprobación.

No avances automáticamente.

39. GATE OBLIGATORIO

Una fase solo puede cerrarse cuando:

Code verified: YES
Runtime verified: YES
Documentation updated: YES
Repository map updated: YES
Legacy index updated: YES
Contradiction scan: PASS
Regression tests: PASS
Rollback tested/documented: YES
Unresolved contradictions: 0

Si existe una contradicción pendiente, la fase permanece abierta.

40. FORMATO OBLIGATORIO DE RESPUESTA AL CERRAR UNA FASE

Debes utilizar exactamente estas secciones:

Resumen de la fase

Evidencia del flujo real

Archivos modificados

Archivos creados

Archivos archivados

Documentación actualizada

Contradicciones encontradas

Contradicciones resueltas

Contradicciones pendientes

Pruebas ejecutadas

Resultados

Riesgos

Rollback

Estado del gate

Solicitud de aprobación

41. PRIMERA ACCIÓN

Empieza únicamente por analizar y preparar la:

FASE 0

No programes fases posteriores.

No hagas modificaciones todavía.

No ejecutes SQL.

No muevas archivos.

No borres archivos.

No cambies versiones.

No instales dependencias.

No cambies configuración.

No detengas procesos sin necesidad.

42. TU PRIMERA RESPUESTA DEBE CONTENER

Tu primera respuesta debe incluir:

A. Comprensión del producto real

arquitectura actual;

launcher;

Electron;

Python;

C#;

ADB;

scrcpy;

FlowAgent;

FlowTrackName;

Supabase;

licencias;

actualizador actual;

datos;

procesos;

puertos.

B. Archivos y procesos vigentes

Lista basada en evidencia.

C. Archivos probablemente legacy

Lista provisional, sin mover ni borrar.

D. Contradicciones detectadas

Entre:

documentación;

código;

runtime;

versiones;

launchers;

actualizadores;

rutas.

E. Riesgos inmediatos

Especialmente:

secretos;

.supabase_config.json;

GitHub público;

RLS;

versiones;

updater antiguo;

archivos sin Git;

logs;

rutas personales;

empaquetado.

F. Plan exacto de Fase 0

Con pasos, comandos, archivos, evidencia y resultado esperado.

G. Acciones de solo lectura necesarias

Scripts o comandos que necesites ejecutar.

Deben ser seguros y no modificar el proyecto.

H. Archivos adicionales necesarios

Solo los imprescindibles.

No solicites indiscriminadamente todo el repositorio si ya tienes acceso.

I. Criterios de aceptación

Objetivos claros y verificables.

J. Rollback

Aunque la Fase 0 no deba modificar funcionalidad.

K. Estado inicial de coherencia

Indicar:

qué documentos parecen actuales;

cuáles son dudosos;

cuáles están prohibidos;

qué matriz necesitas construir.

No realices ningún cambio antes de entregar este análisis y recibir aprobación expresa.