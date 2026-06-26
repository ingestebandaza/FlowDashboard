$pids = @(26052, 9108, 33980, 35516)
$ports = @{
    26052 = '8766 + 8765'
    9108  = '8766 + 8765 + 8767'
    33980 = '11434 (Ollama/Laixi)'
    35516 = '5000 (Backend C#)'
}

Write-Host '============================================' -ForegroundColor Cyan
Write-Host 'ANALISIS DE PROCESOS EN PUERTOS CRITICOS' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

foreach ($pid in $pids) {
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.Name } else { 'NO ENCONTRADO' }
    $path = if ($proc -and $proc.Path) { $proc.Path } else { 'N/A' }
    $puerto = $ports[$pid]
    
    Write-Host "PID $pid - Puerto(s): $puerto" -ForegroundColor Yellow
    Write-Host "  Nombre: $name" -ForegroundColor White
    Write-Host "  Ruta:   $path" -ForegroundColor Gray
    Write-Host ''
}

Write-Host '============================================' -ForegroundColor Cyan
Write-Host 'CONFLICTOS DETECTADOS' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Puerto 8766: DOS procesos escuchando (PIDs 26052 y 9108)' -ForegroundColor Red
Write-Host '  -> Solo uno deberia escuchar en 8766 (local_adb_server.py)' -ForegroundColor Red
Write-Host ''
Write-Host 'Puerto 8765: DOS procesos escuchando (PIDs 26052 y 9108)' -ForegroundColor Red
Write-Host '  -> Solo uno deberia escuchar en 8765 (local_adb_server.py)' -ForegroundColor Red
Write-Host ''
Write-Host 'Puerto 11434: Ollama/Laixi (PID 33980)' -ForegroundColor Yellow
Write-Host '  -> No interfiere con el proyecto directamente' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Puerto 5000: Backend C# (PID 35516)' -ForegroundColor Green
Write-Host '  -> OK - es nuestro backend' -ForegroundColor Green
