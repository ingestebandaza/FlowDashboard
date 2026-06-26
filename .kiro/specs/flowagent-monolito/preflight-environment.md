# Preflight Environment - flowagent-monolito (Fase 0)

**Fecha de verificacion:** 2026-05-23
**Spec:** flowagent-monolito (Etapa B)
**Host:** Windows 10.0.26200, usuario `elyup`

Este archivo es la bitacora de verificacion del entorno previa a Fase 1. No
sustituye a `PROJECT_CONTEXT.md` (memoria viva del proyecto), que se actualizara
formalmente en Fase 10 segun el plan del spec.

---

## 1. Resumen consolidado

| Componente | Estado | Detalle |
|---|---|---|
| Android Studio | OK (version a confirmar) | `C:\Program Files\Android\Android Studio\bin\studio64.exe`. Sin `product-info.json`; version exacta desde Help > About si se requiere. |
| JBR de Android Studio | NO usable | `C:\Program Files\Android\Android Studio\jbr\bin\java.exe` AUSENTE. No se usa como JDK. |
| JDK 21 (Oracle LTS) | OK | `C:\Program Files\Java\jdk-21`. `JAVA_HOME` apunta aqui. Version `21.0.9+7-LTS-338`. |
| JRE 8 | Presente, no usable para Gradle | `1.8.0_491`. Solo runtime; gana en PATH. |
| JDK 17 (Microsoft OpenJDK) | OK | Instalado el 2026-05-27 en `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot\`. Version `17.0.19+10-LTS` (Microsoft-13877129). `JAVA_HOME` a nivel **Machine** ya apunta aqui (la sesion CMD actual aun arrastra `jdk-21` por herencia de Process; basta reabrir terminal o setear `$env:JAVA_HOME` manualmente para tomarlo). Listo para que AutoJs6 / AGP usen JDK 17 sin instalar nada mas. |
| `ANDROID_HOME` | OK | `C:\Users\elyup\AppData\Local\Android\Sdk` (Machine + Process scope). User scope vacio: no bloqueante. |
| Platforms SDK | OK | `android-35`, `android-36`. |
| Build-tools SDK | OK | `35.0.0`, `36.0.0`, `36.1.0`, `37.0.0`. |
| NDK | NO instalado | Se evaluara en Fase 1 segun `build.gradle` de AutoJs6. |
| cmdline-tools/latest | OK | sdkmanager `20.0`. |
| Licencia SDK | OK | `licenses\android-sdk-license` presente. |
| ADB del SDK | OK | `<sdk>\platform-tools\adb.exe` v1.0.41 (Build 36.0.2-14143358). |
| ADB del dashboard | NO tocar | `scrcpy-win64-v4.0\adb.exe`, uso exclusivo de FlowDashboard. |
| Gradle CLI en PATH | NO presente | No bloquea: AutoJs6 trae su propio `gradlew`. |
| Keystore FlowAgent | OK | `flow_agent_apk\flowagent-debug.keystore`, alias `androiddebugkey`, storepass/keypass `android/android` (debug keystore estandar, no es secreto). SHA-256 `3D:03:FC:28:9D:C2:64:68:CA:7D:4E:DD:6C:ED:D3:66:5D:AA:67:F9:CA:DA:13:46:D0:76:DD:C2:C0:F2:56:71`. Firma identica al `flowagent-debug.apk` desplegado en produccion -> `pm install -r` viable. |

### Riesgo conocido

- En el PATH, `java` resuelve PRIMERO a JRE 8
  (`C:\Program Files (x86)\Common Files\Oracle\Java\java8path\java.exe`),
  no a JDK 21. Gradle suele respetar `JAVA_HOME`, pero cualquier herramienta
  que lance `java` por PATH directo se topara con la JRE 8. Mitigacion:
  invocar el JDK 21 explicitamente (`& "$env:JAVA_HOME\bin\java.exe"`),
  fijar `org.gradle.java.home` en `gradle.properties`, o reordenar PATH si
  resulta necesario en Fase 1.

---

## 2. Salidas crudas de los comandos

### 2.1 Variables de entorno

```
JAVA_HOME=C:\Program Files\Java\jdk-21
ANDROID_HOME=C:\Users\elyup\AppData\Local\Android\Sdk
where java:
C:\Program Files (x86)\Common Files\Oracle\Java\java8path\java.exe
```

### 2.2 `java -version` (PATH directo)

```
java version "1.8.0_491"
Java(TM) SE Runtime Environment (build 1.8.0_491-b10)
Java HotSpot(TM) 64-Bit Server VM (build 25.491-b10, mixed mode)
```

> Nota: salida esperada del riesgo descrito arriba. PATH resuelve a JRE 8.

### 2.3 `& "$env:JAVA_HOME\bin\java.exe" -version` (JDK 21 forzado)

```
java version "21.0.9" 2025-10-21 LTS
Java(TM) SE Runtime Environment (build 21.0.9+7-LTS-338)
Java HotSpot(TM) 64-Bit Server VM (build 21.0.9+7-LTS-338, mixed mode, sharing)
```

### 2.4 `sdkmanager --version`

```
Warning: This version only understands SDK XML versions up to 3 but an SDK XML
file of version 4 was encountered. This can happen if you use versions of
Android Studio and the command-line tools that were released at different times.

20.0
```

> El warning de XML v4 vs v3 indica que `cmdline-tools/latest` (sdkmanager 20.0)
> esta ligeramente desfasado frente al schema escrito por Android Studio.
> No bloquea; se puede actualizar `cmdline-tools` desde Android Studio si se
> requiere en Fase 1.

### 2.5 `adb version` (SDK, no el del dashboard)

```
Android Debug Bridge version 1.0.41
Version 36.0.2-14143358
Installed as C:\Users\elyup\AppData\Local\Android\Sdk\platform-tools\adb.exe
Running on Windows 10.0.26200
```

### 2.6 `Get-ChildItem $env:ANDROID_HOME\build-tools`

```
Name
----
35.0.0
36.0.0
36.1.0
37.0.0
```

> Se detecta `37.0.0` adicional respecto al inventario previo de tareas
> anteriores (que listaba `35.0.0`, `36.0.0`, `36.1.0`). Sin impacto: la
> seleccion final dependera de `compileSdk`/`buildToolsVersion` de AutoJs6.

### 2.7 `gradle --version`

```
gradle no esta en PATH
```

> Esperado y aceptable. AutoJs6 incluye `gradlew`/`gradlew.bat` en su
> repositorio; la version exacta de Gradle se documentara en Fase 1 cuando
> se ejecute `.\gradlew --version` dentro del checkout.

---

## 3. Veredicto

**Listo para Fase 1.**

Requisitos minimos cumplidos:

- JDK 21 instalado y apuntado por `JAVA_HOME` (el riesgo de PATH esta acotado
  y mitigable).
- Android SDK con platforms `android-35`/`android-36`, build-tools modernos
  (hasta `37.0.0`) y licencias aceptadas.
- ADB del SDK funcional y separado del ADB del dashboard.
- Keystore FlowAgent disponible y compatible con la APK ya desplegada en
  produccion.

Pendientes que se resolveran en Fase 1 con el `build.gradle` real de AutoJs6:

- Confirmar AGP/Gradle exigidos. Con JDK 17 ya instalado se cubre el caso AGP < 8.5; con JDK 21 tambien activo se cubre AGP >= 8.5. Decidir cual usar segun lo que pida el `gradle.properties`/`gradle-wrapper.properties` de AutoJs6 (probable `org.gradle.java.home` apuntando al 17).
- Confirmar si AutoJs6 requiere NDK y, en su caso, instalarlo via `sdkmanager`.
- Confirmar `compileSdk` / `buildToolsVersion` para fijar la version concreta
  a usar entre las disponibles.

---

## 4. Notas operativas

- No se modifica `PROJECT_CONTEXT.md` en esta tarea. Esa actualizacion es
  responsabilidad de Fase 10 segun `tasks.md` del spec.
- No se altera la configuracion del ADB del dashboard
  (`scrcpy-win64-v4.0\adb.exe`).
- La debug keystore usa storepass/keypass `android` por convencion publica
  de Android (no es un secreto operativo); se documenta como parametro de
  configuracion necesario para reproducir la firma de produccion.
