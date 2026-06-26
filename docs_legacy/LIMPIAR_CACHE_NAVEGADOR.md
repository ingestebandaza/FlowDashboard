# 🧹 Limpiar Caché del Navegador

## ❌ Problema

```
El dashboard muestra una versión antigua
Los cambios visuales no aparecen
El navegador está cacheando archivos antiguos
```

## ✅ Solución Rápida

### Opción 1: Recarga Forzada (Recomendado)

**Windows/Linux/Mac**:
```
Ctrl+Shift+R (recarga sin caché)
O
Ctrl+F5 (recarga sin caché)
```

### Opción 2: Limpiar Caché Completo

**Chrome**:
1. Abre Chrome
2. Presiona Ctrl+Shift+Delete
3. Selecciona "Todas las cookies y datos de sitios"
4. Haz clic en "Borrar datos"
5. Recarga la página

**Firefox**:
1. Abre Firefox
2. Presiona Ctrl+Shift+Delete
3. Selecciona "Todo"
4. Haz clic en "Limpiar ahora"
5. Recarga la página

**Edge**:
1. Abre Edge
2. Presiona Ctrl+Shift+Delete
3. Selecciona "Todas las cookies y datos de sitios"
4. Haz clic en "Borrar ahora"
5. Recarga la página

### Opción 3: Usar abrir_dashboard.bat

El script ahora:
1. Limpia caché automáticamente
2. Abre el dashboard en http://127.0.0.1:8765/wsapi_demo.html
3. Fuerza recarga sin caché

```
Ejecuta: abrir_dashboard.bat
```

## 🔍 Verificación

### Verificar que los Cambios Aparecen

1. **Abre el Dashboard**
   ```
   http://127.0.0.1:8765/wsapi_demo.html
   ```

2. **Abre la Consola (F12)**
   ```
   Presiona F12
   Ve a la pestaña "Console"
   ```

3. **Busca los Mensajes de Streaming UI**
   ```
   [StreamingUI] Cargando versión limpia...
   [StreamingUI] Inicializando...
   [StreamingUI] Botón de streaming agregado a la barra de controles
   [StreamingUI] Barra de controles hecha sticky
   [StreamingUI] Botón toggle (☰) agregado en esquina superior izquierda
   [StreamingUI] Estilos CSS agregados
   [StreamingUI] Inicialización completada
   [StreamingUI] Módulo cargado correctamente
   ```

4. **Verifica Visualmente**
   - ✅ Botón ☰ en esquina superior izquierda
   - ✅ Botón "Streaming" en barra de controles
   - ✅ Barra de controles permanece fija al desplazar
   - ✅ Menú se oculta/muestra con botón ☰

## 📋 Cambios Realizados

### En wsapi_demo.html
```html
<!-- ANTES -->
<script src="./wsapi.js"></script>
<script src="./streaming_ui_clean.js?v=1.0.0"></script>

<!-- DESPUÉS -->
<script src="./wsapi.js?v=20260521_184643"></script>
<script src="./streaming_ui_clean.js?v=20260521_184643"></script>
```

### En abrir_dashboard.bat
```batch
REM ANTES
start "" "%DASHBOARD_DIR%wsapi_demo.html"

REM DESPUÉS
start "" "http://127.0.0.1:8765/wsapi_demo.html"
```

## 🚀 Próximos Pasos

1. **Recarga Forzada**
   ```
   Ctrl+Shift+R
   ```

2. **Verifica que los Cambios Aparecen**
   ```
   Botón ☰ en esquina superior izquierda
   Botón "Streaming" en barra de controles
   ```

3. **Abre la Consola (F12)**
   ```
   Busca mensajes [StreamingUI]
   ```

4. **Prueba las Características**
   ```
   Haz clic en ☰ para ocultar/mostrar menú
   Haz clic en "Streaming" para activar modo streaming
   Desplázate para verificar que barra es sticky
   ```

## ✅ Checklist

- [ ] Recargaste con Ctrl+Shift+R
- [ ] Ves el botón ☰ en esquina superior izquierda
- [ ] Ves el botón "Streaming" en barra de controles
- [ ] Ves los mensajes [StreamingUI] en la consola
- [ ] Probaste ocultar/mostrar menú
- [ ] Probaste activar modo streaming
- [ ] Probaste que barra es sticky

---

**Versión**: 1.0.0  
**Fecha**: 2026-05-21  
**Estado**: ✅ Listo para Usar
