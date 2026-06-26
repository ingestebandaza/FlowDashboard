Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'VERIFICANDO PUERTOS DEL PROYECTO' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

$netstat = netstat -ano

Write-Host 'Puerto 5000 - Backend C# (WebSocket + HTTP)' -ForegroundColor Cyan
if ($netstat | Select-String ':5000\s') {
    Write-Host 'OK - Abierto' -ForegroundColor Green
} else {
    Write-Host 'ERROR - Cerrado' -ForegroundColor Red
}
Write-Host ''

Write-Host 'Puerto 5037 - ADB Server' -ForegroundColor Cyan
if ($netstat | Select-String ':5037\s') {
    Write-Host 'OK - Abierto' -ForegroundColor Green
} else {
    Write-Host 'ERROR - Cerrado' -ForegroundColor Red
}
Write-Host ''

Write-Host 'Puerto 8765 - Servidor Python (FlowLogin)' -ForegroundColor Cyan
if ($netstat | Select-String ':8765\s') {
    Write-Host 'OK - Abierto' -ForegroundColor Green
} else {
    Write-Host 'ERROR - Cerrado' -ForegroundColor Red
}
Write-Host ''

Write-Host 'Puerto 8766 - Socket FlowAgent' -ForegroundColor Cyan
if ($netstat | Select-String ':8766\s') {
    Write-Host 'OK - Abierto' -ForegroundColor Green
} else {
    Write-Host 'ERROR - Cerrado' -ForegroundColor Red
}
Write-Host ''

Write-Host 'Puerto 5001 - Backend C# (Alternativo)' -ForegroundColor Cyan
if ($netstat | Select-String ':5001\s') {
    Write-Host 'OK - Abierto' -ForegroundColor Green
} else {
    Write-Host 'ERROR - Cerrado' -ForegroundColor Red
}
Write-Host ''

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'RESUMEN' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Puertos necesarios:' -ForegroundColor Cyan
Write-Host '  - 5000: Backend C# (WebSocket + HTTP)' -ForegroundColor White
Write-Host '  - 5001: Backend C# (Alternativo)' -ForegroundColor White
Write-Host '  - 5037: ADB Server' -ForegroundColor White
Write-Host '  - 8765: Servidor Python (FlowLogin)' -ForegroundColor White
Write-Host '  - 8766: Socket FlowAgent' -ForegroundColor White
Write-Host ''
