# Instrucciones para Iniciar el Backend C# FlowDashboard

## Problema Identificado

El APK muestra "Socket desconectado" porque **el backend C# no está corriendo**. Laixi está interfiriendo porque es el servidor antiguo.

## Solución

### Opción 1: Iniciar Backend desde PowerShell (Recomendado)

Abre PowerShell como Administrador y ejecuta:

```powershell
cd "c:\DASHBOARD\FlowDashboard\FlowDashboard.Core\bin\Release\net8.0"
.\FlowDashboard.Core.exe
```

El backend debería mostrar:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5000
```

### Opción 2: Iniciar Backend desde CMD

Abre CMD como Administrador y ejecuta:

```cmd
cd c:\DASHBOARD\FlowDashboard\FlowDashboard.Core\bin\Release\net8.0
FlowDashboard.Core.exe
```

### Opción 3: Usar el Script de Lanzamiento

Ejecuta el script de lanzamiento del dashboard:

```powershell
powershell -ExecutionPolicy Bypass -File "c:\DASHBOARD\FlowDashboard\abrir_dashboard.ps1"
```

## Verificar que el Backend está Corriendo

Una vez que el backend esté corriendo, verifica que está escuchando en los puertos correctos:

```powershell
netstat -ano | findstr "5000 8766"
```

Deberías ver:
- Puerto 5000: HTTP/WebSocket
- Puerto 8766: Socket FlowAgent

## Después de Iniciar el Backend

1. Abre FlowAgent en un dispositivo
2. Verifica que **Socket** muestre "✓ Conectado" (verde)
3. Verifica que **Captura** muestre "✓ Activa" (verde)

## Puertos del Backend

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| HTTP/WebSocket | 5000 | API REST y WebSocket para streaming |
| Socket FlowAgent | 8766 | Comunicación con APK |

## Notas

- El backend debe estar corriendo ANTES de abrir FlowAgent en los dispositivos
- Si ves "Socket desconectado", verifica que el backend esté corriendo
- Si ves "Captura inactiva", verifica que hayas otorgado permisos de captura de pantalla
- Laixi (servidor antiguo) debe estar cerrado para evitar conflictos

---

**Próximo paso:** Inicia el backend C# y luego abre FlowAgent en los dispositivos.
