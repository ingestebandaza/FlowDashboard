# Audita cada dispositivo: versiones de FlowAgent, AutoJs6, packages relacionados.
# Detecta duplicados (varios "instalaciones" de com.flowlogin.agent — improbable
# pero el usuario reporto haber visto eso en .44).
$adb = 'c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

# Devices conectados
$devOut = & $adb devices 2>&1
$devices = @()
foreach ($line in $devOut) {
    if ($line -match '^([\w\.\:]+)\s+device\s*$') { $devices += $matches[1] }
}
Write-Host "Devices: $($devices.Count)" -ForegroundColor Cyan

$results = @()
foreach ($s in $devices) {
    $row = [PSCustomObject]@{
        Serial = $s
        FlowAgentVersion = ''
        FlowAgentCount = 0
        AutoJs6Standalone = $false
        OtherFlowPkgs = @()
        FlowAgentPaths = @()
    }

    # 1. Buscar TODOS los packages que contengan "flowlogin"
    $pkgs = & $adb -s $s shell "pm list packages | grep flowlogin" 2>&1
    $flowAgentPkgs = @()
    foreach ($p in ($pkgs -split "`r?`n")) {
        if ($p -match 'package:(.+)') {
            $flowAgentPkgs += $matches[1].Trim()
        }
    }
    $row.FlowAgentCount = $flowAgentPkgs.Count
    $row.OtherFlowPkgs = $flowAgentPkgs | Where-Object { $_ -ne 'com.flowlogin.agent' }

    # 2. Versión de com.flowlogin.agent
    if ($flowAgentPkgs -contains 'com.flowlogin.agent') {
        $info = & $adb -s $s shell "dumpsys package com.flowlogin.agent | grep -E 'versionName|codePath'" 2>&1
        foreach ($l in ($info -split "`r?`n")) {
            if ($l -match 'versionName=(\S+)') { $row.FlowAgentVersion = $matches[1] }
            if ($l -match 'codePath=(.+)') { $row.FlowAgentPaths += $matches[1].Trim() }
        }
    }

    # 3. AutoJs6 standalone (Etapa A — debe estar desinstalado)
    $aj = & $adb -s $s shell "pm path org.autojs.autojs6" 2>&1
    if ($aj -match 'package:') { $row.AutoJs6Standalone = $true }

    $results += $row
}

# Mostrar resultados
Write-Host "`n=== AUDIT REPORT ===" -ForegroundColor Cyan
$results | Sort-Object {
    [int](($_.Serial -split '\.')[3] -split ':')[0]
} | Format-Table Serial, FlowAgentVersion, FlowAgentCount, AutoJs6Standalone, @{l='OtherPkgs';e={$_.OtherFlowPkgs -join ', '}}, @{l='Paths';e={$_.FlowAgentPaths -join ' | '}} -AutoSize

# Resumen por categoría
$v100 = ($results | Where-Object { $_.FlowAgentVersion -eq '1.0.0' }).Count
$old = ($results | Where-Object { $_.FlowAgentVersion -ne '1.0.0' -and $_.FlowAgentVersion -ne '' }).Count
$missing = ($results | Where-Object { $_.FlowAgentVersion -eq '' }).Count
$dups = ($results | Where-Object { $_.FlowAgentCount -gt 1 -or $_.OtherFlowPkgs.Count -gt 0 }).Count
$autojs = ($results | Where-Object { $_.AutoJs6Standalone }).Count

Write-Host "`n=== RESUMEN ===" -ForegroundColor Yellow
Write-Host "FlowAgent v1.0.0: $v100"
Write-Host "FlowAgent version vieja: $old"
Write-Host "Sin FlowAgent: $missing"
Write-Host "Devices con DUPLICADOS / paquetes extra: $dups" -ForegroundColor $(if ($dups -gt 0) { 'Red' } else { 'Green' })
Write-Host "Devices con AutoJs6 standalone (debe ser 0): $autojs" -ForegroundColor $(if ($autojs -gt 0) { 'Yellow' } else { 'Green' })

# Lista devices que necesitan reinstall limpio
$needsClean = $results | Where-Object {
    $_.FlowAgentVersion -ne '1.0.0' -or
    $_.FlowAgentCount -gt 1 -or
    $_.OtherFlowPkgs.Count -gt 0 -or
    $_.AutoJs6Standalone
}

if ($needsClean.Count -gt 0) {
    Write-Host "`n=== DEVICES QUE REQUIEREN REINSTALL LIMPIO ===" -ForegroundColor Red
    $needsClean | ForEach-Object { Write-Host "  - $($_.Serial)" }
    $needsClean.Serial | Out-File 'c:\DASHBOARD\FlowDashboard\.upload_tmp\needs_clean.txt' -Encoding utf8
} else {
    Write-Host "`nTodos los devices estan limpios y en v1.0.0." -ForegroundColor Green
    '' | Out-File 'c:\DASHBOARD\FlowDashboard\.upload_tmp\needs_clean.txt' -Encoding utf8
}
