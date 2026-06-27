# Guia de uso (sin conocimientos tecnicos) - FlowDashboard 2.0.0

Esta guia explica, paso a paso y en lenguaje sencillo, como hacer las tres cosas
mas importantes con FlowDashboard:

- A) Abrir el programa para usarlo.
- B) Actualizarlo a una version nueva.
- C) Empaquetarlo y publicar una version (crear el instalador).

No necesita saber programar. Solo siga los pasos en orden.

---

## Antes de empezar

- Todo se hace desde la carpeta del proyecto: `C:\DASHBOARD\FlowDashboard`.
- Hay un unico panel de control con menu: el archivo
  **`GESTOR_FLOWDASHBOARD.bat`**.
- Para abrirlo, haga doble clic sobre `GESTOR_FLOWDASHBOARD.bat`.
- Si Windows muestra un aviso de seguridad la primera vez, elija
  "Mas informacion" y luego "Ejecutar de todas formas".

Al abrir el gestor vera un menu con estas opciones:

```
  1. Abrir Dashboard en desarrollo
  2. Validar proyecto
  3. Crear build comercial local
  4. Crear version Beta
  5. Crear version Stable
  6. Publicar release preparada
  7. Restaurar version
  8. Ver diagnosticos
  9. Salir
```

Para elegir una opcion, escriba el numero y pulse ENTER.

---

## A) Abrir el programa para usarlo

Tiene dos formas; ambas hacen lo mismo:

**Forma 1 (recomendada): con el gestor**
1. Doble clic en `GESTOR_FLOWDASHBOARD.bat`.
2. Escriba `1` y pulse ENTER (Abrir Dashboard en desarrollo).
3. Espere a que se abra la ventana de FlowDashboard.

**Forma 2: directa**
1. Doble clic en `abrir_electron.bat`.
2. Espere a que se abra la ventana de FlowDashboard.

Notas:
- Conecte los dispositivos Android por USB antes o despues; apareceran en el
  panel automaticamente. El programa no depende de un numero fijo de
  dispositivos.
- Si algo no responde, cierre la ventana y vuelva a abrirla con los pasos de
  arriba.

---

## B) Actualizar el programa a una version nueva

La aplicacion ya instalada se actualiza sola cuando hay una version publicada
(busca actualizaciones al iniciarse). Usted solo tiene que aceptar cuando se lo
pida y reiniciar la aplicacion.

Si lo que quiere es traer los ultimos cambios al proyecto en su PC para luego
generar una version, pida a la persona tecnica que ejecute la actualizacion del
repositorio, o use el gestor para validar que todo sigue correcto:
1. Doble clic en `GESTOR_FLOWDASHBOARD.bat`.
2. Escriba `2` (Validar proyecto) y pulse ENTER.
3. Si al final dice que todo esta correcto, puede continuar. Si muestra errores,
   avise a la persona tecnica antes de seguir.

---

## C) Empaquetar y publicar una version (crear el instalador)

Todo se hace desde el mismo gestor. Elija segun lo que necesite:

### C.1 Solo crear el instalador en su PC (sin publicar)
Util para probar antes de publicar.
1. Doble clic en `GESTOR_FLOWDASHBOARD.bat`.
2. Escriba `3` (Crear build comercial local) y pulse ENTER.
3. Espere. El proceso tarda varios minutos (compila y arma el instalador).
4. Al terminar tendra el instalador `FlowDashboard-Setup-2.0.0.exe` listo para
   probar.

### C.2 Crear una version Beta (para pruebas con usuarios)
1. Doble clic en `GESTOR_FLOWDASHBOARD.bat`.
2. Escriba `4` (Crear version Beta) y pulse ENTER.
3. Espere a que termine.

### C.3 Crear una version Stable (version oficial)
1. Doble clic en `GESTOR_FLOWDASHBOARD.bat`.
2. Escriba `5` (Crear version Stable) y pulse ENTER.
3. Le preguntara el tipo de incremento de version:
   - `1` patch: correcciones pequenas (ej. 2.0.0 -> 2.0.1).
   - `2` minor: mejoras nuevas (ej. 2.0.0 -> 2.1.0).
   - `3` major: cambios grandes (ej. 2.0.0 -> 3.0.0).
   Si tiene dudas, lo habitual es `1` (patch).
4. Escriba el numero y pulse ENTER. Espere a que termine.

### C.4 Publicar la version ya preparada (subirla a GitHub)
Hagalo despues de haber creado una Beta o Stable.
1. Doble clic en `GESTOR_FLOWDASHBOARD.bat`.
2. Escriba `6` (Publicar release preparada) y pulse ENTER.
3. Como medida de seguridad, le pedira confirmacion: escriba en mayusculas
   `PUBLICAR` y pulse ENTER. Cualquier otra cosa cancela la publicacion.

---

## Si algo sale mal: volver atras

El programa guarda "puntos de restauracion" antes de cambios importantes.
1. Doble clic en `GESTOR_FLOWDASHBOARD.bat`.
2. Escriba `7` (Restaurar version) y pulse ENTER.
3. Vera una lista de puntos disponibles. Escriba el nombre exacto del que quiere
   recuperar y pulse ENTER. Para cancelar, deje el campo vacio y pulse ENTER.

---

## Revisar el estado del proyecto

Para ver un resumen de salud del proyecto (version, instalador, coherencia):
1. Doble clic en `GESTOR_FLOWDASHBOARD.bat`.
2. Escriba `8` (Ver diagnosticos) y pulse ENTER.
3. Lea el resumen. Si aparecen advertencias que no entiende, avise a la persona
   tecnica.

---

## Resumen rapido

| Quiero... | Opcion del gestor |
|-----------|-------------------|
| Abrir el programa | 1 |
| Comprobar que todo esta bien | 2 |
| Crear instalador para probar | 3 |
| Crear version Beta | 4 |
| Crear version oficial (Stable) | 5 |
| Publicar la version preparada | 6 |
| Volver a una version anterior | 7 |
| Ver el estado del proyecto | 8 |
| Cerrar el gestor | 9 |

Recuerde: casi todo se hace desde `GESTOR_FLOWDASHBOARD.bat`. Para solo abrir y
usar el programa, tambien sirve `abrir_electron.bat`.
