$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ReleaseScript = Join-Path $PSScriptRoot "release.ps1"

function Invoke-Release {
    param([string[]]$Arguments)
    & powershell -NoProfile -ExecutionPolicy Bypass -File $ReleaseScript @Arguments
    return $LASTEXITCODE
}

function Pause-Menu {
    Write-Host ""
    Read-Host "Pulse ENTER para volver al menu"
}

function Show-Menu {
    Clear-Host
    $info = $null
    try { $info = Get-Content -LiteralPath (Join-Path $RepoRoot "version.json") -Raw | ConvertFrom-Json } catch { }
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "   GESTOR FLOWDASHBOARD" -ForegroundColor Cyan
    if ($info) { Write-Host "   Version $($info.version) - canal $($info.channel)" -ForegroundColor DarkCyan }
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1. Abrir Dashboard en desarrollo"
    Write-Host "  2. Validar proyecto"
    Write-Host "  3. Crear build comercial local"
    Write-Host "  4. Crear version Beta"
    Write-Host "  5. Crear version Stable"
    Write-Host "  6. Release rapida (Stable + commit + push automatico)" -ForegroundColor Green
    Write-Host "  7. Publicar release preparada"
    Write-Host "  8. Restaurar version"
    Write-Host "  9. Ver diagnosticos"
    Write-Host "  0. Salir"
    Write-Host ""
}

function Action-Dev {
    $bat = Join-Path $RepoRoot "abrir_electron.bat"
    if (Test-Path -LiteralPath $bat) {
        Write-Host "Lanzando entorno de desarrollo (abrir_electron.bat)..." -ForegroundColor Green
        Start-Process -FilePath $bat -WorkingDirectory $RepoRoot
    } else {
        Write-Host "No se encontro abrir_electron.bat" -ForegroundColor Red
    }
}

function Action-Stable {
    Write-Host "Tipo de incremento de version:" -ForegroundColor Cyan
    Write-Host "  1. patch"
    Write-Host "  2. minor"
    Write-Host "  3. major"
    $sel = Read-Host "Seleccione"
    switch ($sel) {
        "1" { Invoke-Release @("-Action", "stable", "-Bump", "patch") | Out-Null }
        "2" { Invoke-Release @("-Action", "stable", "-Bump", "minor") | Out-Null }
        "3" { Invoke-Release @("-Action", "stable", "-Bump", "major") | Out-Null }
        default { Write-Host "Opcion invalida" -ForegroundColor Red }
    }
}

function Action-QuickRelease {
    Write-Host "RELEASE RAPIDA" -ForegroundColor Green
    Write-Host "Genera la build Stable, confirma el incremento de version, hace push de la rama" -ForegroundColor DarkGray
    Write-Host "y la etiqueta, y crea el draft en GitHub. La publicacion final sigue siendo manual (opcion 7)." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Tipo de incremento de version:" -ForegroundColor Cyan
    Write-Host "  1. patch"
    Write-Host "  2. minor"
    Write-Host "  3. major"
    $sel = Read-Host "Seleccione"
    $bump = switch ($sel) { "1" { "patch" } "2" { "minor" } "3" { "major" } default { $null } }
    if (-not $bump) { Write-Host "Opcion invalida" -ForegroundColor Red; return }
    Invoke-Release @("-Action", "stable", "-Bump", $bump, "-CommitPush") | Out-Null
    $code = $LASTEXITCODE
    if ($code -eq 0) {
        Write-Host ""
        Write-Host "Release rapida completada. Revise el draft en GitHub y publique con la opcion 7." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "La release rapida fallo (codigo $code). Revise el log." -ForegroundColor Red
    }
}

function Action-Publish {
    Write-Host "Esta a punto de publicar la release preparada en GitHub." -ForegroundColor Yellow
    $confirm = Read-Host "Escriba PUBLICAR para confirmar"
    if ($confirm -eq "PUBLICAR") {
        Invoke-Release @("-Action", "publish", "-Approve") | Out-Null
    } else {
        Write-Host "Publicacion cancelada." -ForegroundColor Yellow
    }
}

function Action-Restore {
    $restoreRoot = Join-Path $RepoRoot "restore_points"
    Write-Host "Puntos de restauracion disponibles:" -ForegroundColor Cyan
    Get-ChildItem -LiteralPath $restoreRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  - $($_.Name)" }
    $name = Read-Host "Nombre del punto de restauracion (vacio para cancelar)"
    if ($name) { Invoke-Release @("-Action", "restore", "-RestorePoint", $name) | Out-Null }
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Opcion"
    switch ($choice) {
        "1" { Action-Dev; Pause-Menu }
        "2" { Invoke-Release @("-Action", "validate") | Out-Null; Pause-Menu }
        "3" { Invoke-Release @("-Action", "local") | Out-Null; Pause-Menu }
        "4" { Invoke-Release @("-Action", "beta") | Out-Null; Pause-Menu }
        "5" { Action-Stable; Pause-Menu }
        "6" { Action-QuickRelease; Pause-Menu }
        "7" { Action-Publish; Pause-Menu }
        "8" { Action-Restore; Pause-Menu }
        "9" { Invoke-Release @("-Action", "diagnostics") | Out-Null; Pause-Menu }
        "0" { Write-Host "Hasta luego." -ForegroundColor Cyan; break }
        default { Write-Host "Opcion invalida." -ForegroundColor Red; Start-Sleep -Seconds 1 }
    }
}
