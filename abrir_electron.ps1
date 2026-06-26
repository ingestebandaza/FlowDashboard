$ErrorActionPreference = "Continue"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Adb = Join-Path $AppDir "scrcpy-win64-v4.0\adb.exe"
$CSharpDir = Join-Path $AppDir "FlowDashboard.Core"
$CSharpExeCandidates = @(
    (Join-Path $AppDir "FlowDashboard.Core\bin\Release\net8.0\FlowDashboard.Core.exe"),
    (Join-Path $AppDir "FlowDashboard.Core\bin\Debug\net8.0\FlowDashboard.Core.exe")
)
$ElectronDir = Join-Path $AppDir "electron-app"
$ElectronUserData = Join-Path $AppDir "scratch\electron-user-data-runtime"
$FlowDashboardData = Join-Path $AppDir "scratch\flowdashboard-data-runtime"
$PythonScript = Join-Path $AppDir "local_adb_server.py"
$Python = $null
$PythonRequiredModules = @("websockets", "psutil", "websocket")
$ProductModeValue = [string]$env:FLOWDASHBOARD_PRODUCT_MODE
$ProductMode = @("1", "true", "yes").Contains($ProductModeValue.ToLowerInvariant())
$H264FrameMetaSerials = [string]$env:FLOW_H264_FRAME_META_SERIALS
$H264CanaryConfig = Join-Path $AppDir "h264_canary_config.json"

if (-not $H264FrameMetaSerials -and (Test-Path -LiteralPath $H264CanaryConfig)) {
    try {
        $canary = Get-Content -LiteralPath $H264CanaryConfig -Raw | ConvertFrom-Json
        if ($canary.frameMetaSerials) {
            $H264FrameMetaSerials = ($canary.frameMetaSerials | ForEach-Object { [string]$_ } | Where-Object { $_.Trim() } | ForEach-Object { $_.Trim() }) -join ","
        }
    } catch {
        Write-Warn "No se pudo leer h264_canary_config.json: $($_.Exception.Message)"
    }
}

$env:FLOWDASHBOARD_BASE_DIR = $AppDir
$env:FLOWDASHBOARD_RESOURCE_DIR = $AppDir
$env:FLOWDASHBOARD_DATA_DIR = $FlowDashboardData
$env:FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART = "1"
if ($H264FrameMetaSerials) {
    $env:FLOW_H264_FRAME_META_SERIALS = $H264FrameMetaSerials
    $env:FLOW_H264_SCID_SERIALS = $H264FrameMetaSerials
}
if (-not @("1", "true", "yes").Contains(([string]$env:FLOWDASHBOARD_USE_SYSTEM_PROXY).ToLowerInvariant())) {
    foreach ($proxyVar in @("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")) {
        Remove-Item "Env:\$proxyVar" -ErrorAction SilentlyContinue
    }
}

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host $Text -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Text)
    Write-Host "   OK - $Text" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Text)
    Write-Host "   AVISO - $Text" -ForegroundColor Yellow
}

function Test-Http {
    param([string]$Url)
    try {
        Invoke-RestMethod -Uri $Url -TimeoutSec 2 -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Wait-Http {
    param([string]$Url, [int]$MaxSec = 20)
    for ($i = 0; $i -lt ($MaxSec * 2); $i++) {
        if (Test-Http $Url) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Test-PythonDeps {
    param([string]$PythonPath)
    if (-not (Test-Path -LiteralPath $PythonPath)) { return $false }
    $code = "import importlib.util,sys; missing=[m for m in sys.argv[1:] if importlib.util.find_spec(m) is None]; print(','.join(missing)); sys.exit(1 if missing else 0)"
    $output = & $PythonPath -c $code @PythonRequiredModules 2>$null
    return $LASTEXITCODE -eq 0
}

function Select-Python {
    $devPython = "C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe"
    $pathPython = (Get-Command python -ErrorAction SilentlyContinue).Source
    $candidates = @(
        @{ Path = $env:FLOWDASHBOARD_PYTHON; Label = "FLOWDASHBOARD_PYTHON"; Dev = $false },
        @{ Path = (Join-Path $AppDir ".venv\Scripts\python.exe"); Label = ".venv del proyecto"; Dev = $false },
        @{ Path = (Join-Path $AppDir "python\python.exe"); Label = "Python portable del proyecto"; Dev = $false },
        @{ Path = $devPython; Label = "Python de desarrollo hardcodeado"; Dev = $true },
        @{ Path = $pathPython; Label = "python del PATH"; Dev = $true }
    )

    $seen = @{}
    foreach ($candidate in $candidates) {
        $candidatePath = ""
        if ($candidate.Path) {
            $candidatePath = [string]$candidate.Path
        }
        if (-not $candidatePath) { continue }
        if ($seen.ContainsKey($candidatePath.ToLowerInvariant())) { continue }
        $seen[$candidatePath.ToLowerInvariant()] = $true
        if (-not (Test-Path -LiteralPath $candidatePath)) { continue }
        if ($ProductMode -and $candidate.Dev) {
            Write-Warn "Ignorando $($candidate.Label) en modo producto: $candidatePath"
            continue
        }
        if (Test-PythonDeps $candidatePath) {
            if ($candidate.Dev) {
                Write-Warn "Usando $($candidate.Label). Valido para desarrollo, no para instalacion comercial: $candidatePath"
            } else {
                Write-Ok "Python seleccionado: $($candidate.Label)"
            }
            return $candidatePath
        }
        Write-Warn "Python sin dependencias requeridas ($($PythonRequiredModules -join ', ')): $candidatePath"
    }
    return $null
}

function Stop-PortProcess {
    param([int]$Port)
    try {
        $owners = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($ownerPid in $owners) {
            if ($ownerPid -and $ownerPid -ne $PID) {
                Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
            }
        }
    } catch { }
}

Clear-Host
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  FLOWDASHBOARD ELECTRON - ARRANQUE LIMPIO" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

Set-Location -LiteralPath $AppDir
$env:FLOWDASHBOARD_ADB = $Adb
$env:SCRCPY_PATH = Join-Path $AppDir "scrcpy-win64-v4.0\scrcpy.exe"
$env:SCRCPY_SERVER_JAR = Join-Path $AppDir "scrcpy-win64-v4.0\scrcpy-server.jar"
$env:FLOWDASHBOARD_ELECTRON_USER_DATA = $ElectronUserData
New-Item -ItemType Directory -Force -Path $ElectronUserData, $FlowDashboardData | Out-Null

Write-Step "[1/5] Preparando ADB local..."
if (Test-Path -LiteralPath $Adb) {
    & $Adb start-server | Out-Null
    Write-Ok "ADB listo en 127.0.0.1:5037"
} else {
    Write-Warn "No se encontro adb.exe en scrcpy-win64-v4.0"
}

if (-not (Test-Path -LiteralPath $env:SCRCPY_PATH)) {
    Write-Warn "No se encontro scrcpy.exe en scrcpy-win64-v4.0"
}
if (-not (Test-Path -LiteralPath $env:SCRCPY_SERVER_JAR)) {
    Write-Warn "No se encontro scrcpy-server.jar en scrcpy-win64-v4.0"
}

$Python = Select-Python
if ($Python) {
    $env:FLOWDASHBOARD_PYTHON = $Python
}

Write-Step "[2/5] Iniciando backend C# en puerto 5000..."
if (Test-Http "http://127.0.0.1:5000/api/health") {
    Write-Ok "Backend C# ya estaba activo"
} else {
    $CSharpExe = $CSharpExeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($CSharpExe) {
        Start-Process -FilePath $CSharpExe -WorkingDirectory $AppDir -WindowStyle Hidden
    } elseif (-not $ProductMode) {
        Write-Warn "No se encontro FlowDashboard.Core.exe compilado. Usando dotnet run solo en desarrollo."
        Start-Process -FilePath "dotnet" -ArgumentList "run" -WorkingDirectory $CSharpDir -WindowStyle Hidden
    } else {
        Write-Warn "No se encontro FlowDashboard.Core.exe. En producto no se usa dotnet run."
    }
    if (Wait-Http "http://127.0.0.1:5000/api/health" 30) {
        Write-Ok "Backend C# activo"
    } else {
        Write-Warn "Backend C# no respondio en /api/health"
    }
}

Write-Step "[3/5] Iniciando servidor Python en puerto 8765 + socket FlowAgent 8766 + WS H.264 8768..."
if (-not $Python) {
    Write-Warn "No hay Python/backend portable con dependencias. Revisa requirements.txt o empaqueta el backend Python."
} else {
    Write-Host "   Limpiando procesos anteriores en puertos 8765-8768..." -ForegroundColor Yellow
    foreach ($port in @(8765, 8766, 8767, 8768)) {
        Stop-PortProcess $port
    }
    Start-Sleep -Milliseconds 800
    if (Test-Path -LiteralPath $PythonScript) {
        Start-Process -FilePath $Python -ArgumentList "-u", $PythonScript -WorkingDirectory $AppDir -WindowStyle Hidden
        if (Wait-Http "http://127.0.0.1:8765/health" 25) {
            Write-Ok "Servidor Python activo"
        } else {
            Write-Warn "Servidor Python no respondio en /health"
        }
    } else {
        Write-Warn "No se encontro local_adb_server.py"
    }
}

Write-Step "[4/5] Auto-conexion desactivada (Fase 8A)"
Write-Ok "Se omitira auto_connect_devices.ps1"

# Perfil CONTROL: no preparar FlowAgent, Accesibilidad ni captura al abrir.
# El usuario prepara FlowAgent desde Electron cuando va a ejecutar automatizacion.
Write-Step "[5/5] Abriendo Electron..."
Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$ElectronExe = Join-Path $ElectronDir "node_modules\electron\dist\electron.exe"
# --disable-http-cache: fuerza que Electron cargue los JS desde disco en cada arranque,
# sin usar la cache HTTP interna. Necesario para que los cambios en renderer/*.js
# se reflejen sin tener que hacer Ctrl+R manualmente.
if (Test-Path -LiteralPath $ElectronExe) {
    Start-Process -FilePath $ElectronExe -ArgumentList ".", "--disable-http-cache", "--user-data-dir=$ElectronUserData" -WorkingDirectory $ElectronDir -WindowStyle Normal
} elseif (-not $ProductMode) {
    Write-Warn "No se encontro Electron local. Usando npm start solo en desarrollo."
    Start-Process -FilePath "cmd" -ArgumentList "/c npm.cmd start" -WorkingDirectory $ElectronDir -WindowStyle Normal
} else {
    Write-Warn "No se encontro Electron empaquetado/local. En producto no se usa npm start."
}
Write-Ok "Electron iniciado (sin cache HTTP)"

Write-Host ""
Write-Host "Listo. Este launcher NO instala APK, NO lanza FlowAgent y NO configura accesibilidad." -ForegroundColor Green
Write-Host "Usa el escaner del dashboard si quieres incorporar nuevos dispositivos via WiFi, o conecta por USB." -ForegroundColor Green
Write-Host ""
