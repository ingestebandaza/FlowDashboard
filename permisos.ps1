$ErrorActionPreference = "Continue"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Adb = Join-Path $AppDir "scrcpy-win64-v4.0\adb.exe"
$Package = "com.flowlogin.agent"
$Activity = "com.flowlogin.agent/.MainActivity"
$Service = "com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService"

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host $Text -ForegroundColor Cyan
}

function Get-Devices {
    & $Adb devices |
        Select-String "`tdevice$" |
        ForEach-Object { ($_ -split "\s+")[0].Trim() } |
        Where-Object { $_ }
}

function Invoke-Adb {
    param([string]$Serial, [string[]]$Args)
    & $Adb -s $Serial @Args 2>&1
}

function Enable-Accessibility {
    param([string]$Serial)

    Invoke-Adb $Serial @("shell", "settings", "put", "secure", "enabled_accessibility_services", $Service) | Out-Null
    Invoke-Adb $Serial @("shell", "settings", "put", "secure", "accessibility_enabled", "1") | Out-Null
}

function Tap-CaptureDialog {
    param([string]$Serial)

    for ($i = 0; $i -lt 12; $i++) {
        Start-Sleep -Milliseconds 800
        Invoke-Adb $Serial @("shell", "uiautomator", "dump", "--compressed", "/sdcard/flowagent_window.xml") | Out-Null
        $xml = (Invoke-Adb $Serial @("shell", "cat", "/sdcard/flowagent_window.xml") | Out-String)
        if ($xml -match '(text|content-desc)="(Start now|Iniciar ahora|Comenzar ahora|Empezar ahora|Permitir|Allow)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
            $x = [int](([int]$Matches[3] + [int]$Matches[5]) / 2)
            $y = [int](([int]$Matches[4] + [int]$Matches[6]) / 2)
            Invoke-Adb $Serial @("shell", "input", "tap", "$x", "$y") | Out-Null
            return $true
        }
        if ($xml -match 'resource-id="android:id/button1"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
            $x = [int](([int]$Matches[1] + [int]$Matches[3]) / 2)
            $y = [int](([int]$Matches[2] + [int]$Matches[4]) / 2)
            Invoke-Adb $Serial @("shell", "input", "tap", "$x", "$y") | Out-Null
            return $true
        }

        $focus = (Invoke-Adb $Serial @("shell", "dumpsys", "window") | Out-String)
        if ($focus -match "MediaProjectionPermissionActivity") {
            $sizeRaw = (Invoke-Adb $Serial @("shell", "wm", "size") | Out-String)
            $width = 1080
            $height = 1920
            if ($sizeRaw -match "(\d+)x(\d+)") {
                $width = [int]$Matches[1]
                $height = [int]$Matches[2]
            }
            $x = [int]($width * 0.70)
            $y = [int]($height * 0.86)
            Invoke-Adb $Serial @("shell", "input", "tap", "$x", "$y") | Out-Null
            return $true
        }
    }
    return $false
}

function Prepare-Device {
    param([string]$Serial)

    Invoke-Adb $Serial @("reverse", "tcp:8766", "tcp:8766") | Out-Null
    Invoke-Adb $Serial @("reverse", "tcp:5000", "tcp:5000") | Out-Null
    Enable-Accessibility $Serial
    Invoke-Adb $Serial @(
        "shell", "am", "start",
        "-n", $Activity,
        "--es", "host", "127.0.0.1",
        "--es", "serial", $Serial,
        "--ei", "port", "8766",
        "--ez", "autoconnect", "true"
    ) | Out-Null

    $captureAccepted = Tap-CaptureDialog $Serial
    return [pscustomobject]@{
        Serial = $Serial
        CaptureAccepted = $captureAccepted
    }
}

Clear-Host
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  FLOWDASHBOARD - PERMISOS ANDROID" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $Adb)) {
    Write-Host "No se encontro ADB empaquetado: $Adb" -ForegroundColor Red
    exit 1
}

& $Adb start-server | Out-Null
$devices = @(Get-Devices)
if ($devices.Count -eq 0) {
    Write-Host "No hay dispositivos ADB conectados." -ForegroundColor Red
    exit 1
}

Write-Step "Preparando permisos en $($devices.Count) dispositivo(s)..."
$results = @()
foreach ($device in $devices) {
    Write-Host "  $device" -ForegroundColor White
    $results += Prepare-Device $device
}

Write-Step "Resumen"
foreach ($result in $results) {
    $captureText = if ($result.CaptureAccepted) { "captura aceptada" } else { "captura no detectada o ya resuelta" }
    Write-Host "  OK $($result.Serial) - accesibilidad solicitada, reverse listo, $captureText" -ForegroundColor Green
}

Write-Host ""
Write-Host "Este script no instala APKs. Solo prepara permisos/conexion cuando tu lo ejecutas." -ForegroundColor Cyan
