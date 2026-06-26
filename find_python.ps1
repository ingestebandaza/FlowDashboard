Write-Host "Buscando Python..." -ForegroundColor Cyan

# Intentar comando python directo
try {
    $v = & python --version 2>&1
    Write-Host "python: $v" -ForegroundColor Green
    $path = (Get-Command python).Source
    Write-Host "Ruta: $path" -ForegroundColor Green
} catch {
    Write-Host "python no encontrado en PATH" -ForegroundColor Red
}

# Intentar python3
try {
    $v = & python3 --version 2>&1
    Write-Host "python3: $v" -ForegroundColor Green
} catch {
    Write-Host "python3 no encontrado" -ForegroundColor Gray
}

# Buscar en rutas comunes
$paths = @(
    "C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe",
    "C:\Users\elyup\AppData\Local\Programs\Python\Python311\python.exe",
    "C:\Users\elyup\AppData\Local\Programs\Python\Python312\python.exe",
    "C:\Python310\python.exe",
    "C:\Python311\python.exe"
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        Write-Host "Encontrado: $p" -ForegroundColor Green
    }
}
