# Script para iniciar Electron con verificaciones previas
# Uso: .\iniciar_electron_prueba.ps1

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  INICIAR ELECTRON - PRUEBA CON DISPOSITIVOS                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar Node.js
Write-Host "1️⃣  Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "   ✅ Node.js $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ Node.js no está instalado" -ForegroundColor Red
    Write-Host "   Descarga desde: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Verificar npm
Write-Host "2️⃣  Verificando npm..." -ForegroundColor Yellow
$npmVersion = npm --version 2>$null
if ($npmVersion) {
    Write-Host "   ✅ npm $npmVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ npm no está instalado" -ForegroundColor Red
    exit 1
}

# Verificar que estamos en la carpeta correcta
Write-Host "3️⃣  Verificando carpeta del proyecto..." -ForegroundColor Yellow
if (Test-Path ".\electron-app\src\renderer\app.js") {
    Write-Host "   ✅ Carpeta correcta" -ForegroundColor Green
} else {
    Write-Host "   ❌ No estamos en la carpeta correcta" -ForegroundColor Red
    Write-Host "   Ejecuta desde: c:\DASHBOARD\FlowDashboard" -ForegroundColor Yellow
    exit 1
}

# Verificar que node_modules existe
Write-Host "4️⃣  Verificando dependencias npm..." -ForegroundColor Yellow
if (Test-Path ".\node_modules") {
    Write-Host "   ✅ Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Dependencias no instaladas, instalando..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Error instalando dependencias" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Dependencias instaladas" -ForegroundColor Green
}

# Verificar que Electron está instalado
Write-Host "5️⃣  Verificando Electron..." -ForegroundColor Yellow
if (Test-Path ".\node_modules\electron") {
    Write-Host "   ✅ Electron instalado" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Electron no instalado, instalando..." -ForegroundColor Yellow
    npm install electron --save-dev
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Error instalando Electron" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Electron instalado" -ForegroundColor Green
}

# Verificar backends
Write-Host "6️⃣  Verificando backends..." -ForegroundColor Yellow

# Verificar C# backend
$csharpRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend C# (puerto 5000) está corriendo" -ForegroundColor Green
        $csharpRunning = $true
    }
} catch {
    Write-Host "   ⚠️  Backend C# (puerto 5000) NO está corriendo" -ForegroundColor Yellow
}

# Verificar Python backend
$pythonRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8765/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend Python (puerto 8765) está corriendo" -ForegroundColor Green
        $pythonRunning = $true
    }
} catch {
    Write-Host "   ⚠️  Backend Python (puerto 8765) NO está corriendo" -ForegroundColor Yellow
}

# Verificar ADB
Write-Host "7️⃣  Verificando ADB..." -ForegroundColor Yellow
$adbDevices = adb devices 2>$null | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
if ($adbDevices) {
    $deviceCount = @($adbDevices).Count
    Write-Host "   ✅ $deviceCount dispositivo(s) conectado(s)" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  No hay dispositivos conectados" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  RESUMEN DE VERIFICACIÓN                                       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($csharpRunning -and $pythonRunning) {
    Write-Host "✅ Todos los backends están corriendo" -ForegroundColor Green
} else {
    Write-Host "⚠️  Algunos backends no están corriendo:" -ForegroundColor Yellow
    if (-not $csharpRunning) {
        Write-Host "   - Backend C# (puerto 5000)" -ForegroundColor Yellow
        Write-Host "     Inicia en otra terminal: cd FlowDashboard.Core; dotnet run" -ForegroundColor Gray
    }
    if (-not $pythonRunning) {
        Write-Host "   - Backend Python (puerto 8765)" -ForegroundColor Yellow
        Write-Host "     Inicia en otra terminal: python local_adb_server.py" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Puedes continuar, pero algunas funciones no funcionarán." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  INICIANDO ELECTRON...                                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "💡 Consejos:" -ForegroundColor Cyan
Write-Host "   - Abre DevTools con F12" -ForegroundColor Gray
Write-Host "   - Ve a la pestaña Console" -ForegroundColor Gray
Write-Host "   - Ejecuta: await csharpAPI.healthCheck()" -ForegroundColor Gray
Write-Host "   - Ejecuta: const devices = await csharpAPI.get('/devices')" -ForegroundColor Gray
Write-Host ""

# Iniciar Electron
npm run electron:dev

