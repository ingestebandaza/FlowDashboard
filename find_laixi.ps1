# Buscar procesos y puertos de Laixi
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "BUSCANDO LAIXI Y PROCESOS INTERFERENTES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Procesos sospechosos
Write-Host "--- PROCESOS ACTIVOS ---" -ForegroundColor Yellow
$procs = Get-Process | Where-Object {
    $_.Name -match "laixi|adb|python|node|electron|ollama|scrcpy|android|mobile|phone|device" -or
    $_.Path -match "laixi|android|mobile"
} | Select-Object Id, Name, Path, @{N='CPU';E={[math]::Round($_.CPU,1)}}

$procs | ForEach-Object {
    Write-Host "  PID $($_.Id) | $($_.Name)" -ForegroundColor White
    if ($_.Path) { Write-Host "    $($_.Path)" -ForegroundColor Gray }
}

Write-Host ""

# 2. Puertos en uso con proceso
Write-Host "--- PUERTOS EN USO (relevantes) ---" -ForegroundColor Yellow
$netstat = netstat -ano
$relevantPorts = @(5000, 5001, 5037, 8765, 8766, 8767, 11434, 8787, 7680)

foreach ($port in $relevantPorts) {
    $lines = $netstat | Select-String ":$($port)\s"
    if ($lines) {
        foreach ($line in $lines) {
            $parts = ($line -split '\s+' | Where-Object { $_ })
            $procId = $parts[-1]
            $state = $parts[-2]
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            $procName = if ($proc) { $proc.Name } else { "?" }
            Write-Host "  Puerto $port | $state | PID $procId | $procName" -ForegroundColor White
        }
    }
}

Write-Host ""

# 3. Buscar Laixi en programas instalados
Write-Host "--- PROGRAMAS INSTALADOS (Laixi) ---" -ForegroundColor Yellow
$apps = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match "laixi|android|adb|scrcpy" } |
    Select-Object DisplayName, InstallLocation

$apps2 = Get-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match "laixi|android|adb|scrcpy" } |
    Select-Object DisplayName, InstallLocation

($apps + $apps2) | ForEach-Object {
    Write-Host "  $($_.DisplayName)" -ForegroundColor White
    if ($_.InstallLocation) { Write-Host "    $($_.InstallLocation)" -ForegroundColor Gray }
}

Write-Host ""

# 4. Buscar archivos de Laixi en rutas comunes
Write-Host "--- ARCHIVOS LAIXI EN DISCO ---" -ForegroundColor Yellow
$paths = @(
    "$env:LOCALAPPDATA\Programs",
    "$env:APPDATA",
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\Downloads",
    "C:\Program Files",
    "C:\Program Files (x86)"
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        $found = Get-ChildItem $p -Filter "*laixi*" -Recurse -ErrorAction SilentlyContinue -Depth 2
        $found | ForEach-Object { Write-Host "  $($_.FullName)" -ForegroundColor Green }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ANALISIS COMPLETADO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
