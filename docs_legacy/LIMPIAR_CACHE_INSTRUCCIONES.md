# 🔄 Cómo Limpiar el Caché y Ver los Cambios

El navegador está cacheando una versión antigua del dashboard. Sigue estos pasos para ver la versión actualizada:

---

## ✅ Opción 1: Limpiar Caché Completo (Recomendado)

### **Paso 1: Cerrar el Dashboard**
1. Cierra el navegador completamente
2. Cierra la ventana del dashboard

### **Paso 2: Limpiar Caché del Navegador**

**En Chrome/Edge:**
1. Presiona `Ctrl + Shift + Delete`
2. Selecciona "Borrar datos de navegación"
3. Marca:
   - ☑️ Cookies y otros datos de sitios
   - ☑️ Archivos en caché
4. Selecciona "Todos los tiempos"
5. Haz clic en "Borrar datos"

**En Firefox:**
1. Presiona `Ctrl + Shift + Delete`
2. Marca:
   - ☑️ Cookies
   - ☑️ Caché
3. Haz clic en "Limpiar ahora"

### **Paso 3: Reiniciar Dashboard**
```bash
python abrir_dashboard.bat
```

### **Paso 4: Abrir en Navegador**
```
http://127.0.0.1:8765
```

---

## ✅ Opción 2: Forzar Recarga (Más Rápido)

1. Abre el dashboard: `http://127.0.0.1:8765`
2. Presiona **Ctrl + F5** (Windows) o **Cmd + Shift + R** (Mac)
3. Espera a que cargue completamente

---

## ✅ Opción 3: Modo Incógnito (Más Rápido)

1. Abre una ventana de incógnito/privada
2. Ve a `http://127.0.0.1:8765`
3. Verás la versión más reciente sin caché

---

## ✅ Opción 4: Limpiar Caché Local del Sistema

**Windows:**
```bash
# Ejecutar en PowerShell como administrador
Remove-Item -Path "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache" -Recurse -Force
```

**macOS:**
```bash
rm -rf ~/Library/Caches/Google/Chrome/
```

**Linux:**
```bash
rm -rf ~/.cache/google-chrome/
```

---

## 🧪 Verificar que está actualizado

Después de limpiar el caché, abre la consola del navegador (F12) y ejecuta:

```javascript
// Debería mostrar "function" en los tres
console.log(typeof initStreamingUI);
console.log(typeof toggleStreamingMode);
console.log(typeof connectScreenStream);
```

Si ves `function` en los tres, ¡está todo actualizado! ✅

---

## 🎯 Qué deberías ver después

Una vez que limpies el caché, deberías ver:

1. ✅ **Botón "Streaming"** en la barra superior
2. ✅ **Botón toggle (☰)** en la esquina superior izquierda
3. ✅ **Menú izquierdo** que se puede ocultar/mostrar
4. ✅ **Modo streaming** con grilla de dispositivos
5. ✅ **Video en vivo** en las tarjetas (si tienes dispositivos conectados)

---

## 🐛 Si aún no ves los cambios

1. Verifica que los archivos existen:
   - `streaming_ui_styles.css`
   - `streaming_ui_implementation.js`

2. Abre la consola (F12) y busca errores en rojo

3. Verifica que el servidor está corriendo:
   ```
   http://127.0.0.1:8765/health
   ```
   Debería mostrar JSON con `"ok": true`

4. Si nada funciona, reinicia completamente:
   - Cierra navegador
   - Cierra dashboard
   - Ejecuta: `python abrir_dashboard.bat`
   - Abre: `http://127.0.0.1:8765`

---

## 📞 Soporte

Si tienes problemas:
1. Intenta Opción 1 (Limpiar caché completo)
2. Si no funciona, intenta Opción 4 (Limpiar caché del sistema)
3. Si aún no funciona, abre un issue con los errores de consola (F12)

---

**¡Después de limpiar el caché, deberías ver todos los cambios!** 🚀
