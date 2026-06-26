Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'VERIFICACION DETALLADA DE PUERTOS' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

$ports = @(5000, 5001, 5037, 8765, 8766)
$netstat = netstat -ano

foreach ($port in $ports) {
    Write-Host "Puerto $($port):" -ForegroundColor Cyan
    
    $lines = $netstat | Select-String ":$($port)\s"
    
    if ($lines) {
        foreach ($line in $lines) {
            # Extraer información
            $parts = $line -split '\s+' | Where-Object { $_ }
            $state = $parts[-2]
            $pid = $parts[-1]
            
            # Obtener nombre del proceso
            try {
                $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                $processName = if ($process) { $process.Name } else { "Desconocido" }
                $processPath = if ($process) { $process.Path } else { "N/A" }
                
                Write-Host "  Estado: $state" -ForegroundColor Green
                Write-Host "  PID: $pid" -ForegroundColor Green
                Write-Host "  Proceso: $processName" -ForegroundColor Green
                Write-Host "  Ruta: $processPath" -ForegroundColor Green
            } catch {
                Write-Host "  Error al obtener información del proceso" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  NO ESTA EN USO" -ForegroundColor Yellow
    }
    Write-Host ''
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'RESUMEN' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan

$summary = @()
foreach ($port in $ports) {
    $lines = $netstat | Select-String ":$($port)\s"
    if ($lines) {
        $parts = $lines[0] -split '\s+' | Where-Object { $_ }
        $pid = $parts[-1]
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        $processName = if ($process) { $process.Name } else { "Desconocido" }
        $summary += "Puerto $($port) : $processName (PID: $pid)"
    } else {
        $summary += "Puerto $($port) : DISPONIBLE"
    }
}

$summary | ForEach-Object { Write-Host $_ -ForegroundColor White }
Write-Host ''
